// Wave-3 layer data (data/layers.js, loaded lazily): indexes, tie layers and succession matching.
// Pure functions, no DOM. Every layer is optional; a missing layer gives empty results.
import { yearOf, activeAt } from './edges.js';

const pk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const uniq = a => [...new Set(a.filter(Boolean))];
export const recs = (LD, layer, type) => (LD?.[layer]?.records || []).filter(r => !type || r.type === type);
export const hasLayer = (LD, layer) => !!LD?.[layer]?.records;

// ---------- tie layers ----------
export const NEW_LAYERS = {
  pc: { label: 'Promotion cohort', help: 'Promoted at the same CMC rank ceremony (PLA). Shown from the ceremony date' },
  cs: { label: 'Co-sponsorship', help: 'Sponsor or cosponsor of the same U.S. bill, or Legislative Yuan bill when loaded. Shown from the bill date' },
  lv: { label: 'LY vote agreement', help: 'Two legislators cast the same vote on at least 90% of at least 10 shared recorded votes. Shown from the 10th shared vote' },
  sx: { label: 'Sanctions (state level)', help: 'A state sanctioning a compared actor, drawn from the imposing state. Connections view only, not a personal tie', derived: true },
};

export function cohortEdges(LD, people) {
  const by = new Map();
  for (const r of recs(LD, 'ccp_cc', 'promotion')) if (people.has(r.person) && r.cohort) (by.get(r.cohort) || by.set(r.cohort, []).get(r.cohort)).push(r);
  const out = [];
  for (const [cohort, rs] of by) for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const [x, y] = rs[i].person < rs[j].person ? [rs[i], rs[j]] : [rs[j], rs[i]];
    if (x.person === y.person) continue;
    out.push({ layer: 'pc', a: x.person, b: y.person, weight: 1, from: yearOf(x.date), to: null, cohort,
      why: [{ text: `${cohort}: ${people.get(x.person).name} to ${x.rank}, ${people.get(y.person).name} to ${y.rank}. ${x.ceremony || ''}`.trim(), sources: uniq([x.source, y.source]) }] });
  }
  return out;
}

// Pairs of people on the same bill (sponsor plus cosponsors). One edge per pair; weight = shared bills.
export function cosponsorEdges(LD, people) {
  const bills = [...recs(LD, 'us_congress', 'bill').map(b => ({ ...b, where: 'U.S.' })), ...recs(LD, 'ly_votes', 'cosponsor').map(b => ({ ...b, where: 'LY' }))];
  const E = new Map();
  for (const b of bills) {
    const ids = uniq([b.sponsor, ...(b.cosponsors || [])]).filter(id => people.has(id)).sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pk(ids[i], ids[j]);
      if (!E.has(k)) E.set(k, { layer: 'cs', a: ids[i], b: ids[j], weight: 0, from: Infinity, to: null, why: [] });
      const e = E.get(k);
      e.weight += 1; e.from = Math.min(e.from, yearOf(b.date) ?? Infinity);
      e.why.push({ text: `${b.where} bill ${b.bill}${b.title || b.bill_native ? `, ${b.title || b.bill_native}` : ''} (${b.date || 'undated'})`, sources: uniq([b.source]) });
    }
  }
  for (const e of E.values()) if (e.from === Infinity) e.from = null;
  return [...E.values()];
}

// Vote choice per person per vote. Absent = not listed under yes, no or abstain.
export const CHOICE = { yes: 'Yes', no: 'No', abstain: 'Abstain', absent: 'Absent' };
export function voteIndex(LD) {
  const votes = recs(LD, 'ly_votes', 'vote').slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  return votes.map(v => {
    const m = new Map();
    for (const c of ['yes', 'no', 'abstain']) for (const id of v[c] || []) m.set(id, c);
    return { v, m };
  });
}

export function agreementPairs(VI, minShared = 10, minRate = 0.9) {
  const ids = uniq(VI.flatMap(x => [...x.m.keys()])).sort();
  const idx = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length, shared = new Uint16Array(n * n), agree = new Uint16Array(n * n), tenth = new Map();
  for (const { v, m } of VI) {
    const es = [...m.entries()].map(([id, c]) => [idx.get(id), c]);
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      let [a, ca] = es[i], [b, cb] = es[j]; if (a > b) [a, b, ca, cb] = [b, a, cb, ca];
      const k = a * n + b; shared[k]++; if (ca === cb) agree[k]++;
      if (shared[k] === minShared) tenth.set(k, v.date);
    }
  }
  const out = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const k = a * n + b;
    if (shared[k] >= minShared && agree[k] / shared[k] >= minRate) out.push({ a: ids[a], b: ids[b], shared: shared[k], agree: agree[k], rate: agree[k] / shared[k], from: tenth.get(k) });
  }
  return out;
}

export function voteEdges(LD, people) {
  if (!hasLayer(LD, 'ly_votes')) return [];
  const src = recs(LD, 'ly_votes', 'vote')[0]?.source;
  return agreementPairs(voteIndex(LD)).filter(p => people.has(p.a) && people.has(p.b)).map(p => ({
    layer: 'lv', a: p.a, b: p.b, weight: 1, rate: p.rate, from: yearOf(p.from), to: null,
    why: [{ text: `Same vote on ${p.agree} of ${p.shared} shared recorded Legislative Yuan votes (${Math.round(p.rate * 100)}%). Each vote's source is in the Taiwan legislature tab.`, sources: uniq([src]) }],
  }));
}

// ---------- sanctions ----------
export const sanctionActive = (r, iso) => String(r.date) <= iso && (!r.lifted || String(r.lifted) > iso);
// Sanctions touching a person: on them, on an org they held a post in at the sanction date, or issued by an org they were in.
export function sanctionsFor(LD, p, asOfY) {
  const S = recs(LD, 'sanctions', 'sanction');
  const at = (org, d) => p.posts.filter(x => x.org === org && activeAt(x, yearOf(d) ?? asOfY, asOfY));
  return {
    on: S.filter(r => r.target === p.id),
    onOrg: S.map(r => ({ r, posts: at(r.target, r.date) })).filter(x => x.posts.length),
    issued: S.map(r => ({ r, posts: r.imposer_org ? at(r.imposer_org, r.date) : [] })).filter(x => x.posts.length),
  };
}

// State-level adversarial ties for the Connections view: imposing state -> compared actor, in force at iso.
export function sanctionTies(LD, ids, people, iso, asOfY, stateName) {
  const nodes = new Map(), edges = new Map();
  for (const id of ids) {
    const p = people.get(id); if (!p) continue;
    const s = sanctionsFor(LD, p, asOfY);
    const items = [...s.on.map(r => ({ r, via: null })), ...s.onOrg.map(x => ({ r: x.r, via: x.posts[0] }))].filter(x => sanctionActive(x.r, iso));
    for (const { r, via } of items) {
      const sid = `state:${r.imposer}`;
      if (!nodes.has(sid)) nodes.set(sid, { id: sid, state: true, name: `${stateName(r.imposer)} (state)`, short: `${r.imposer} (state)`, country: r.imposer, tier: 1, posts: [], activeNow: true, statusNow: 'active', topPost: 'Imposing state, not a person' });
      const k = `${sid}|${id}`;
      if (!edges.has(k)) edges.set(k, { layer: 'sx', a: sid, b: id, sign: -1, weight: 0, from: null, to: null, id: `sx:${k}`, why: [] });
      const e = edges.get(k); e.weight += 1;
      e.why.push({ text: `State level, not personal: ${r.imposer} ${r.authority}, ${r.date}${via ? ` (on ${r.target}, where ${p.name} held ${via.title})` : ''}. ${r.reason || ''}`.trim(), sources: uniq([r.source]) });
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

// ---------- succession ----------
const STOP = new Set(['of', 'the', 'and', 'for', 'a', 'cpc', 'central', 'committee', 'national', 'people', 'peoples', "people's", 'republic', 'office', 'ministry', 'department']);
export const normTitle = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/,?\s*(second|third|fourth) (term|tenure).*$/, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').replace(/[ ,;]+$/, '').trim();
const normText = s => String(s || '').toLowerCase().replace(/political bureau/g, 'politburo').replace(/[-–]/g, ' ').replace(/\s+/g, ' ');
const words = s => normText(s).split(/[^a-z0-9']+/).filter(Boolean);
const orgAbbr = id => String(id || '').split('-').slice(1).join('-').toLowerCase();
// "title" appears in text and is not the tail of a vice/deputy title.
function hasTitle(text, title) {
  if (!title) return false;
  let i = text.indexOf(title);
  while (i >= 0) {
    const before = text.slice(Math.max(0, i - 8), i);
    const okL = i === 0 || /[^a-z]$/.test(text[i - 1]);
    const okR = !/[a-z]/.test(text[i + title.length] || '') || text[i + title.length] === 's';
    if (okL && okR && !/(vice|deputy)[ /]$/.test(before)) return true;
    i = text.indexOf(title, i + 1);
  }
  return false;
}
// Does an age/term rule's rank_or_post text describe this post? Text match only; nothing inferred.
export function ruleMatches(rule, post, org) {
  const text = normText(rule.rank_or_post);
  const title = normTitle(post.title);
  const tw = title.split(' ');
  if (tw.length >= 2 && hasTitle(text, title)) return true;
  if (tw.length === 1 && words(text)[0] === title && !/ of /.test(text)) return true;
  const ab = orgAbbr(post.org);
  const abHit = ab.length >= 3 && words(text).some(w => w.length >= 3 && ((ab.startsWith(w) && w.length >= ab.length - 2) || (ab.length >= 4 && w.startsWith(ab))));
  if (abHit && hasTitle(text, title)) return true;
  if (org && /theater command/i.test(org.name) && hasTitle(text, `theater ${title}`)) return true;
  if (org && (title === 'member' || /^member\b/.test(title))) {
    const ow = words(org.name).filter(w => !STOP.has(w));
    if (ow.length && ow.every(w => words(text).includes(w))) return true;
  }
  return false;
}
export function rulesFor(LD, country, post, org) {
  return recs(LD, 'succession', 'age_rule').filter(r => r.country === country && ruleMatches(r, post, org));
}

// Ladder sides from the ladder's own examples: which titles and orgs the from/to posts used.
function sideSig(posts, orgs) {
  const os = posts.map(x => orgs.get(x.org)).filter(Boolean);
  const common = os.length ? os.map(o => new Set(words(o.name))).reduce((a, b) => new Set([...a].filter(w => b.has(w)))) : new Set();
  return { titles: new Set(posts.map(x => normTitle(x.title))), orgs: new Set(posts.map(x => x.org)), common: [...common].filter(w => !STOP.has(w)) };
}
const sigMatch = (sig, post, orgs, country) => {
  const o = orgs.get(post.org);
  if (!o || o.country !== country || !sig.titles.has(normTitle(post.title))) return false;
  return sig.orgs.has(post.org) || (sig.common.length > 0 && sig.common.every(w => words(o.name).includes(w)));
};
const score = (text, post, orgs) => { const tw = new Set(words(text)); return words(`${post.title} ${orgs.get(post.org)?.name || ''}`).filter(w => tw.has(w) && !STOP.has(w)).length; };
export function ladderSigs(LD, people, orgs) {
  return recs(LD, 'succession', 'ladder').map(l => {
    const from = [], to = [];
    for (const id of l.examples || []) {
      const p = people.get(id); if (!p) continue;
      let best = null;
      for (const A of p.posts) for (const B of p.posts) {
        if (A === B) continue;
        const ae = yearOf(A.end), bs = yearOf(B.start), as = yearOf(A.start);
        if (bs == null || !((ae != null && ae <= bs + 0.01) || (as != null && as < bs))) continue;
        const sc = score(l.from_post, A, orgs) + score(l.to_post, B, orgs);
        if (!best || sc > best.sc) best = { sc, A, B };
      }
      if (best) { from.push(best.A); to.push(best.B); }
    }
    return { l, from: sideSig(from, orgs), to: sideSig(to, orgs), ok: from.length > 0 };
  }).filter(x => x.ok);
}
// For an incumbent's post: ladders that end in it, and who now holds a feeder post.
export function feeders(sigs, post, incumbent, people, orgs, t, asOfY) {
  const out = [];
  for (const s of sigs) {
    if (!sigMatch(s.to, post, orgs, s.l.country)) continue;
    const cands = [];
    for (const q of people.values()) {
      if (q.id === incumbent.id || q.status !== 'active') continue;
      const hit = q.posts.find(x => activeAt(x, t, asOfY) && x.end == null && sigMatch(s.from, x, orgs, s.l.country));
      if (hit) cands.push({ p: q, post: hit });
    }
    out.push({ ladder: s.l, cands });
  }
  return out;
}

// Whole years between a birth date (YYYY, YYYY-MM or YYYY-MM-DD) and iso; year-only births are approximate.
export function ageAt(born, iso) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(born || ''); if (!m) return null;
  const [y, mo, d] = iso.split('-').map(Number);
  let a = y - +m[1];
  if (m[2] && (mo < +m[2] || (mo === +m[2] && m[3] && d < +m[3]))) a -= 1;
  return { years: a, approx: !m[2] };
}
export function yearsBetween(a, iso) {
  const s = yearOf(a), e = yearOf(iso); if (s == null || e == null) return null;
  return Math.max(0, e - s);
}
