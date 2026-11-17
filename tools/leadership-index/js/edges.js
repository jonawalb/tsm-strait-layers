// Derived, typed edges for the Leadership Index. Pure functions, no DOM, so node tests can import them.
// Four layers: career overlap (co), formal hierarchy (hi), co-appearance (ca), shared background (bg).
// Every edge carries `why`: a list of {text, sources:[url]} that the page shows when the edge is picked.

export const LAYERS = {
  co: { label: 'Career overlap', help: 'Posts in the same organization at the same time' },
  hi: { label: 'Formal hierarchy', help: 'Sourced reporting line (reports to)' },
  ca: { label: 'Co-appearance', help: 'Sourced joint event, meeting or inspection' },
  bg: { label: 'Shared background', help: 'Same home province, school or background tag' },
  rel: { label: 'Relations', help: 'Sourced personal relation: blue friendly, red adversarial, grey neutral or mixed' },
  fa: { label: 'Faction', help: 'Members of the same sourced faction at the same time' },
  mt: { label: 'Meetings', help: 'Sourced meetings, calls, talks and joint statements; thicker lines mean more encounters up to the chosen date' },
  st: { label: 'State alignment', help: 'State-level, not personal. Drawn only from the selected person or between compared actors', derived: true },
};
export const SIGN_TEXT = { 1: 'Friendly', '-1': 'Adversarial', 0: 'Neutral or mixed' };
export const FACTION_COLORS = ['--c2', '--c6', '--c3', '--c5', '--c8', '--c4', '--c7'];

// Decimal year. YYYY reads as mid-year, YYYY-MM as mid-month, YYYY-MM-DD as that day.
export function yearOf(d) {
  if (d == null || d === '') return null;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(d));
  if (!m) return null;
  const y = +m[1];
  if (!m[2]) return y + 0.5;
  if (!m[3]) return y + (+m[2] - 0.5) / 12;
  return y + (+m[2] - 1) / 12 + (+m[3] - 0.5) / 365;
}

// [start, end] of a dated span; end null = still current = asOf. Missing start = unknown (null).
export function span(x, asOfY) {
  const s = yearOf(x.start);
  const e = x.end == null ? asOfY : yearOf(x.end);
  return [s, e == null ? asOfY : e];
}

// A post or reporting line is active at t when it has started (or its start is unknown) and has not ended.
export function activeAt(x, t, asOfY) {
  const [s, e] = span(x, asOfY);
  return (s == null || s <= t) && e >= t;
}

const norm = s => String(s || '').toLowerCase().replace(/[.,'’()]/g, '').replace(/\s+/g, ' ').trim();
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const fmtY = y => { const yy = Math.floor(y); const mo = Math.min(12, Math.floor((y - yy) * 12) + 1); return `${yy}-${String(mo).padStart(2, '0')}`; };
const uniq = a => [...new Set(a.filter(Boolean))];

// Length of the union of [s, e] intervals.
function unionLength(iv) {
  const s = iv.slice().sort((a, b) => a[0] - b[0]);
  let tot = 0, cs = null, ce = null;
  for (const [a, b] of s) {
    if (cs == null || a > ce) { if (cs != null) tot += ce - cs; cs = a; ce = b; }
    else ce = Math.max(ce, b);
  }
  if (cs != null) tot += ce - cs;
  return tot;
}

// Build all edges once from the merged data. Date filtering happens later with edgeActive().
export function buildEdges(L) {
  const asOfY = yearOf(L.asOf);
  const people = L.people;
  const byId = new Map(people.map(p => [p.id, p]));
  const orgName = new Map(L.orgs.map(o => [o.id, o.name]));
  const edges = [];

  // 1. Career overlap: same org, overlapping date ranges. Posts with no start date are skipped.
  const byOrg = new Map();
  for (const p of people) for (const post of p.posts) {
    const [s, e] = span(post, asOfY);
    if (s == null || e < s) continue;
    if (!byOrg.has(post.org)) byOrg.set(post.org, []);
    byOrg.get(post.org).push({ p: p.id, post, s, e });
  }
  const co = new Map();
  for (const [org, list] of byOrg) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (A.p === B.p) continue;
      const s = Math.max(A.s, B.s), e = Math.min(A.e, B.e);
      if (e <= s) continue;
      const k = key(A.p, B.p);
      if (!co.has(k)) co.set(k, { a: A.p < B.p ? A.p : B.p, b: A.p < B.p ? B.p : A.p, iv: [], why: [] });
      const E = co.get(k);
      const [X, Y] = A.p === E.a ? [A, B] : [B, A];
      E.iv.push([s, e]);
      E.why.push({
        text: `${orgName.get(org) || org}: ${byId.get(X.p).name} as ${X.post.title} (${X.post.start || '?'}–${X.post.end || 'present'}) and ${byId.get(Y.p).name} as ${Y.post.title} (${Y.post.start || '?'}–${Y.post.end || 'present'}). Overlap ${fmtY(s)} to ${fmtY(e)}, about ${(e - s).toFixed(1)} years.`,
        sources: uniq([X.post.source, Y.post.source]),
      });
    }
  }
  for (const E of co.values()) {
    edges.push({ layer: 'co', a: E.a, b: E.b, weight: +unionLength(E.iv).toFixed(2),
      from: Math.min(...E.iv.map(v => v[0])), to: null, why: E.why });
  }

  // 2. Formal hierarchy: a reports to b. Active only while the reporting line holds.
  for (const p of people) for (const r of p.reports_to || []) {
    if (!byId.has(r.person)) continue;
    const [s, e] = span(r, asOfY);
    edges.push({ layer: 'hi', a: p.id, b: r.person, dir: true, weight: 1, from: s, to: r.end == null ? null : e,
      why: [{ text: `${p.name} reports to ${byId.get(r.person).name} (${r.start || '?'}–${r.end || 'present'}).`, sources: uniq([r.source]) }] });
  }

  // 3. Co-appearance: sourced joint events. Aggregated per pair.
  const ca = new Map();
  for (const c of L.coappear || []) {
    if (!byId.has(c.a) || !byId.has(c.b) || c.a === c.b) continue;
    const k = key(c.a, c.b);
    if (!ca.has(k)) ca.set(k, { layer: 'ca', a: c.a < c.b ? c.a : c.b, b: c.a < c.b ? c.b : c.a, weight: 0, from: Infinity, to: null, why: [] });
    const E = ca.get(k);
    E.weight += 1;
    E.from = Math.min(E.from, yearOf(c.date) ?? asOfY);
    E.why.push({ text: `${c.date || 'Undated'}: ${c.event}`, sources: uniq([c.source]) });
  }
  edges.push(...ca.values());

  // 4. Shared background: birthplace province (same country only), education institution, background tag.
  const attrs = new Map(); // attribute key -> [{p, label, sources}]
  const add = (k, p, label, sources) => { if (!attrs.has(k)) attrs.set(k, []); attrs.get(k).push({ p, label, sources }); };
  const personSrc = p => (p.sources || []).map(s => s.url);
  for (const p of people) {
    const prov = norm((p.birthplace || '').split(',')[0]);
    if (prov) add(`prov:${p.country}:${prov}`, p.id, `born in ${(p.birthplace || '').split(',')[0].trim()}`, personSrc(p));
    for (const e of p.education || []) if (norm(e.inst)) add(`edu:${norm(e.inst)}`, p.id, `studied at ${e.inst}${e.years ? ` (${e.years})` : ''}`, uniq([e.source]));
    for (const t of uniq((p.background || []).map(norm))) add(`tag:${t}`, p.id, `background tag "${(p.background || []).find(x => norm(x) === t)}"`, personSrc(p));
  }
  const bg = new Map();
  for (const [k, list] of attrs) {
    const seen = new Map(); for (const x of list) if (!seen.has(x.p)) seen.set(x.p, x); // one entry per person per attribute
    const L2 = [...seen.values()];
    for (let i = 0; i < L2.length; i++) for (let j = i + 1; j < L2.length; j++) {
      const A = L2[i], B = L2[j];
      const kk = key(A.p, B.p);
      if (!bg.has(kk)) bg.set(kk, { layer: 'bg', a: A.p < B.p ? A.p : B.p, b: A.p < B.p ? B.p : A.p, weight: 0, from: -Infinity, to: null, why: [] });
      const E = bg.get(kk);
      E.weight += 1;
      const kind = k.startsWith('prov:') ? 'Same home province' : k.startsWith('edu:') ? 'Same institution' : 'Same background tag';
      E.why.push({ text: `${kind}: ${byId.get(A.p).name} ${A.label}; ${byId.get(B.p).name} ${B.label}.`, sources: uniq([...A.sources, ...B.sources]) });
    }
  }
  edges.push(...bg.values());
  // 5. Relations: signed, sourced person-to-person ties, one edge per pair and sign.
  const R = L.relations || {};
  const rel = new Map();
  for (const r of R.person_relations || []) {
    if (!byId.has(r.a) || !byId.has(r.b)) continue;
    const k = key(r.a, r.b) + '|' + r.sign;
    if (!rel.has(k)) rel.set(k, { layer: 'rel', a: r.a < r.b ? r.a : r.b, b: r.a < r.b ? r.b : r.a, sign: r.sign, weight: 0, from: Infinity, to: null, open: false, why: [] });
    const E = rel.get(k), [s, e] = span(r, asOfY);
    E.weight += 1; E.from = Math.min(E.from, s ?? -Infinity);
    if (r.end == null) E.open = true; else E.to = Math.max(E.to ?? -Infinity, e);
    E.why.push({ text: `${SIGN_TEXT[r.sign]}${r.type ? ` (${r.type})` : ''}, ${r.start || '?'}–${r.end || 'present'}${r.note ? `: ${r.note}` : ''}`, sources: uniq([r.source]) });
  }
  for (const E of rel.values()) { if (E.open) E.to = null; delete E.open; edges.push(E); }

  // 6. Faction: members of the same faction whose memberships overlap.
  (R.factions || []).forEach((f, fi) => {
    const ms = (f.members || []).filter(m => byId.has(m.person)).map(m => ({ m, s: yearOf(m.start), e: m.end == null ? asOfY : yearOf(m.end) ?? asOfY }));
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const A = ms[i], B = ms[j];
      if (A.m.person === B.m.person) continue;
      const s = Math.max(A.s ?? -Infinity, B.s ?? -Infinity), e = Math.min(A.e, B.e);
      if (e < s) continue;
      const [x, y] = A.m.person < B.m.person ? [A, B] : [B, A];
      edges.push({ layer: 'fa', a: x.m.person, b: y.m.person, faction: f.id, fc: FACTION_COLORS[fi % FACTION_COLORS.length], weight: 1, from: s, to: (A.m.end == null && B.m.end == null) ? null : e,
        why: [{ text: `Both in ${f.name}${f.name_native ? ` (${f.name_native})` : ''}${f.party ? `, ${f.party}` : ''}: ${byId.get(x.m.person).name} as ${x.m.role || 'member'} (${x.m.start || '?'}–${x.m.end || 'present'}), ${byId.get(y.m.person).name} as ${y.m.role || 'member'} (${y.m.start || '?'}–${y.m.end || 'present'}).`,
          sources: uniq([x.m.source, y.m.source, f.source]) }] });
    }
  });
  edges.forEach((e, i) => { e.id = `${e.layer}:${e.a}|${e.b}:${i}`; });
  return edges;
}

// State alignment between two countries at t: the latest sourced dyad that has started (and not ended).
export function dyadAt(L, ca, cb, t) {
  const asOfY = yearOf(L.asOf);
  const ds = (L.relations?.state_dyads || []).filter(d => ((d.a === ca && d.b === cb) || (d.a === cb && d.b === ca)) && activeAt(d, t, asOfY));
  return ds.sort((x, y) => (yearOf(y.start) ?? 0) - (yearOf(x.start) ?? 0))[0] || null;
}
// A state-level edge for a cross-country pair with no person-level relation. Not a personal tie.
export function stateEdge(L, p, q, t) {
  if (p.country === q.country) return null;
  const d = dyadAt(L, p.country, q.country, t);
  if (!d) return null;
  const [a, b] = p.id < q.id ? [p, q] : [q, p];
  return { layer: 'st', a: a.id, b: b.id, sign: d.sign, weight: 1, from: null, to: null, id: `st:${a.id}|${b.id}`,
    why: [{ text: `State level, not a personal relationship: ${d.a}–${d.b} ${d.type || ''} (${SIGN_TEXT[d.sign].toLowerCase()}) since ${d.start || '?'}${d.note ? `. ${d.note}` : ''}`, sources: uniq([d.source]) }] };
}

// Is the edge in force at decimal year t? Overlap and co-appearance ties count once they have formed;
// hierarchy counts only while the line holds; background is static.
export function edgeActive(e, t) {
  if (e.from != null && e.from !== -Infinity && e.from > t) return false;
  if (e.to != null && e.to < t) return false;
  return true;
}

// Status in force at t: removed / under investigation only apply from status_date on (if dated).
export function statusAt(p, t) {
  if (p.status === 'active') return 'active';
  const sd = yearOf(p.status_date);
  return sd == null || sd <= t ? p.status : 'active';
}

// Earliest dated post start across everyone (for the slider range).
export function earliestYear(L) {
  let m = Infinity;
  for (const p of L.people) for (const post of p.posts) { const y = yearOf(post.start); if (y != null && y < m) m = y; }
  return Number.isFinite(m) ? Math.floor(m) : null;
}
