// Views for the wave-3 layers (data/layers.js) and the change log (data/changes.js), both loaded lazily.
// Profile sections, Taiwan legislature, Succession watch, What changed, triggers, sanctions and visits.
// Every view says "not loaded yet" when its layer is absent.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { yearOf, activeAt } from './edges.js';
import { COUNTRY_NAMES, srcLink } from './profile.js';
import { todayISO } from './transitions.js';
import { recs, hasLayer, sanctionsFor, sanctionActive, voteIndex, agreementPairs, CHOICE, rulesFor, ladderSigs, feeders, ageAt, yearsBetween } from './layerdata.js';

const NOT_LOADED = what => `<p class="fine">${esc(what)} not loaded yet.</p>`;
const nm = (people, id) => people.get(id)?.name || String(id).replace(/^[A-Z]{3}-/, '').replace(/-/g, ' ');
const pick = (people, id, attr = 'data-pick') => people.has(id) ? `<button type="button" class="linkbtn" ${attr}="${esc(id)}">${esc(people.get(id).name)}</button>` : esc(nm(people, id));
const yrs = y => y == null ? '' : y < 1 ? `${Math.round(y * 12)} mo` : `${y.toFixed(1)} yr`;

// ---------- LY helpers ----------
export const PARTY = { DPP: 'Democratic Progressive Party', KMT: 'Kuomintang', TPP: "Taiwan People's Party", IND: 'Independent' };
const PARTY_ORDER = ['DPP', 'KMT', 'TPP', 'IND'];
// Party now (open caucus record) or the latest one; also used per vote date.
function partyAt(LD, id, iso) {
  const cs = recs(LD, 'ly_votes', 'caucus').filter(c => c.person === id);
  const ok = c => (!c.start || String(c.start) <= iso) && (!c.end || String(c.end) >= iso);
  return cs.find(ok) || cs.slice().sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')))[0] || null;
}
// Majority choice of each party on a vote (plurality of cast votes; a tie gives no majority).
function partyMajority(LD, x) {
  const by = {};
  for (const [id, c] of x.m) { const p = partyAt(LD, id, x.v.date)?.party || 'IND'; if (p === 'IND') continue; (by[p] ||= {})[c] = (by[p][c] || 0) + 1; }
  const out = {};
  for (const [p, cnt] of Object.entries(by)) { const s = Object.entries(cnt).sort((a, b) => b[1] - a[1]); out[p] = s.length > 1 && s[0][1] === s[1][1] ? null : s[0][0]; }
  return out;
}
let lyCache = { LD: null };
function lyStats(LD) {
  if (lyCache.LD === LD) return lyCache;
  const VI = voteIndex(LD);
  const maj = VI.map(x => partyMajority(LD, x));
  const ids = [...new Set([...recs(LD, 'ly_votes', 'caucus').map(c => c.person), ...VI.flatMap(x => [...x.m.keys()])])];
  lyCache = { LD, VI, maj, ids };
  return lyCache;
}
function voteSummary(LD, id) {
  const { VI, maj } = lyStats(LD);
  let cast = 0, line = 0, absent = 0; const def = [];
  VI.forEach((x, i) => {
    const c = x.m.get(id); if (!c) { absent++; return; }
    cast++;
    const p = partyAt(LD, id, x.v.date)?.party, mj = p && maj[i][p];
    if (!mj) return;
    if (c === mj) line++; else def.push({ v: x.v, c, mj });
  });
  return { cast, line, absent, def, n: VI.length };
}

// ---------- profile ----------
export function profileLayersHtml(p, LD, ctx) {
  if (LD === undefined) return '<h3 class="pf-h">Seats, promotions, sanctions and legislation</h3><p class="fine">Loading these records…</p>';
  if (!LD) return `<h3 class="pf-h">Seats, promotions, sanctions and legislation</h3>${NOT_LOADED('The layer file is')}`;
  const { people, orgs, asOfY } = ctx;
  const org = id => orgs.get(id)?.name || id;
  const out = [];
  // CCP Central Committee
  const cc = recs(LD, 'ccp_cc', 'cc_member').filter(r => r.person === p.id);
  if (cc.length) out.push(`<h3 class="pf-h">CCP Central Committee</h3><ul class="pf-list">${cc.map(r => `<li><b>${r.cc}th Central Committee, ${esc(r.rank === 'CCDI' ? 'CCDI member' : r.rank + ' member')}</b>, elected ${esc(r.elected || '?')} ${srcLink(r.source, 'src')}
    ${r.promoted_full ? `<br><span class="fine">Promoted to full member ${esc(r.promoted_full.date)}${r.promoted_full.plenum ? `, ${esc(r.promoted_full.plenum)}` : ''}</span> ${srcLink(r.promoted_full.source, 'src')}` : ''}
    ${r.expelled ? `<br><span class="stpill" data-s="bad">Expelled ${esc(r.expelled)}</span> ${r.removal ? `<span class="fine">${esc(r.removal)}${r.removal_plenum ? `, ${esc(r.removal_plenum)}` : ''}</span>` : ''} ${srcLink(r.removal_source || r.source, 'src')}` : ''}</li>`).join('')}</ul>`);
  // PLA promotions with cohort-mates
  const pr = recs(LD, 'ccp_cc', 'promotion').filter(r => r.person === p.id);
  if (pr.length) {
    const all = recs(LD, 'ccp_cc', 'promotion');
    out.push(`<h3 class="pf-h">PLA promotions</h3><ul class="pf-list">${pr.map(r => {
      const mates = all.filter(x => x.cohort === r.cohort && x.person !== p.id);
      return `<li><b>${esc(r.rank)}</b>, ${esc(r.date)}${r.post_at_promotion ? ` <span class="fine">as ${esc(r.post_at_promotion)}</span>` : ''} ${srcLink(r.source, 'src')}
        <br><span class="fine">${esc(r.ceremony || r.cohort)}</span>
        ${mates.length ? `<br>Same ceremony: ${mates.map(m => `${pick(people, m.person)} <span class="fine">${esc(m.rank)}</span>`).join(', ')}` : '<br><span class="fine">No other index person recorded at this ceremony.</span>'}</li>`;
    }).join('')}</ul>`);
  }
  // Sanctions
  if (hasLayer(LD, 'sanctions')) {
    const s = sanctionsFor(LD, p, asOfY);
    const row = (r, extra = '') => `<li><span class="sgn" data-sg="-1">${esc(r.imposer)}</span> ${esc(r.authority)} <span class="fine">${esc(r.date)}${r.lifted ? `, lifted ${esc(r.lifted)}` : ''}</span>${extra}${r.reason ? `<br><span class="fine">${esc(r.reason)}</span>` : ''} ${srcLink(r.source, 'src')}${r.lifted_source ? ` ${srcLink(r.lifted_source, 'lifted')}` : ''}</li>`;
    if (s.on.length || s.onOrg.length || s.issued.length) {
      out.push(`<h3 class="pf-h">Sanctions <span class="fine">state level</span></h3>
        ${s.on.length ? `<p class="pf-sub">On this person</p><ul class="pf-list">${s.on.map(r => row(r)).join('')}</ul>` : ''}
        ${s.onOrg.length ? `<p class="pf-sub">On an organization they were in at the time</p><ul class="pf-list">${s.onOrg.map(x => row(x.r, ` <span class="fine">on ${esc(org(x.r.target))}, while ${esc(x.posts[0].title)}</span>`)).join('')}</ul>` : ''}
        ${s.issued.length ? `<details class="pr-d"><summary>Issued by an organization they were in <span class="fine">${s.issued.length}</span></summary><ul class="pf-list">${s.issued.map(x => row(x.r, ` <span class="fine">${esc(org(x.r.imposer_org))}, while ${esc(x.posts[0].title)}; target ${people.has(x.r.target) ? pick(people, x.r.target) : esc(org(x.r.target))}</span>`)).join('')}</ul></details>` : ''}`);
    }
  }
  // U.S. Congress
  if (hasLayer(LD, 'us_congress')) {
    const cau = recs(LD, 'us_congress', 'caucus').filter(r => r.person === p.id);
    const bills = recs(LD, 'us_congress', 'bill').filter(r => r.sponsor === p.id || (r.cosponsors || []).includes(p.id));
    const vis = recs(LD, 'us_congress', 'visit').filter(r => (r.members || []).includes(p.id) || (r.met || []).includes(p.id));
    if (cau.length || bills.length || vis.length) out.push(`<h3 class="pf-h">U.S. Congress</h3>
      ${cau.length ? `<ul class="pf-list">${cau.map(r => `<li>${esc(r.caucus)}${r.role ? `, ${esc(r.role)}` : ''} <span class="fine">${r.congress}th Congress</span> ${srcLink(r.source, 'src')}</li>`).join('')}</ul>` : ''}
      ${bills.length ? `<p class="pf-sub">Bills <span class="fine">${bills.filter(b => b.sponsor === p.id).length} sponsored, ${bills.filter(b => b.sponsor !== p.id).length} cosponsored</span></p><ul class="pf-list">${bills.map(b => `<li>${b.sponsor === p.id ? '<b>Sponsor</b>' : 'Cosponsor'}: ${esc(b.bill)} ${esc(b.title || '')} <span class="fine">${esc(b.date || '')}${b.status ? `; ${esc(b.status)}` : ''}</span> ${srcLink(b.source, 'src')}</li>`).join('')}</ul>` : ''}
      ${vis.length ? `<p class="pf-sub">Taiwan visits</p><ul class="pf-list">${vis.map(v => visitLi(v, people)).join('')}</ul>` : ''}`);
  }
  // Legislative Yuan
  const lyPost = p.country === 'TWN' && p.posts.some(x => /^TWN-LY/.test(x.org));
  if (p.country === 'TWN' && (lyPost || recs(LD, 'ly_votes', 'caucus').some(c => c.person === p.id))) {
    if (!hasLayer(LD, 'ly_votes')) out.push(`<h3 class="pf-h">Legislative Yuan</h3>${NOT_LOADED('Caucus and voting records are')}`);
    else {
      const cs = recs(LD, 'ly_votes', 'caucus').filter(c => c.person === p.id);
      const sm = voteSummary(LD, p.id);
      const bills = recs(LD, 'ly_votes', 'cosponsor').filter(b => b.sponsor === p.id || (b.cosponsors || []).includes(p.id));
      out.push(`<h3 class="pf-h">Legislative Yuan</h3>
        ${cs.length ? `<ul class="pf-list">${cs.map(c => `<li><span class="pty" data-p="${esc(c.party)}">${esc(c.party)}</span> caucus <span class="fine">${esc(c.start || '?')}–${esc(c.end || 'present')}${c.end_reason ? `, ${esc(c.end_reason)}` : ''}</span> ${srcLink(c.source, 'src')}</li>`).join('')}</ul>` : '<p class="fine">No caucus record.</p>'}
        ${sm.cast ? `<dl class="readout"><dt>Recorded votes cast</dt><dd><b class="num">${sm.cast}</b> of ${sm.n} <span class="fine">${sm.absent} not recorded</span></dd>
          <dt>With party majority</dt><dd><b class="num">${sm.line + sm.def.length ? Math.round(100 * sm.line / (sm.line + sm.def.length)) : '–'}%</b> <span class="fine">${sm.line} of ${sm.line + sm.def.length} votes where the party had a majority</span></dd></dl>
          ${sm.def.length ? `<details class="pr-d"><summary>Defections <span class="fine">${sm.def.length}</span></summary><ul class="pf-list">${sm.def.map(d => `<li><span class="tl-d">${esc(d.v.date)}</span> ${esc(d.v.title || d.v.title_native || d.v.id)}: voted ${CHOICE[d.c]}, party ${CHOICE[d.mj]} ${srcLink(d.v.source, 'src')}</li>`).join('')}</ul></details>` : '<p class="fine">No votes against the party majority.</p>'}` : '<p class="fine">No recorded votes cast in this file.</p>'}
        ${bills.length ? `<p class="fine">${bills.length} bills sponsored or cosponsored in this file.</p>` : ''}`);
    }
  }
  return out.join('');
}

function visitLi(v, people, attr = 'data-pick') {
  const r = v.prc_reaction;
  return `<li><span class="tl-d">${esc(v.date)}</span> ${(v.members || []).map(id => pick(people, id, attr)).join(', ')} ${srcLink(v.source, 'src')}
    ${(v.met || []).length ? `<br><span class="fine">Met:</span> ${v.met.map(id => pick(people, id, attr)).join(', ')}` : ''}
    <br>${r ? `<span class="sgn" data-sg="-1">PRC ${esc(r.actor)}</span> <span class="fine">${esc(r.date)}</span> ${esc(r.summary)} ${srcLink(r.source, 'src')}` : '<span class="fine">No PRC reaction recorded.</span>'}</li>`;
}

// ---------- Connections: sanctions table and visits ----------
const SCOLS = [['imposer', 'Imposer'], ['authority', 'Authority'], ['target', 'Target'], ['date', 'Date'], ['lifted', 'Lifted'], ['source', 'Source']];
export function renderSanctionsPanel(el, LD, state, ctx) {
  const { people, orgs, cmp, iso, asOfY } = ctx;
  if (!LD) { el.innerHTML = `<h3 class="cal-h">Sanctions and congressional visits</h3>${LD === undefined ? '<p class="fine">Loading…</p>' : NOT_LOADED('The layer file is')}`; return; }
  const tname = id => people.get(id)?.name || orgs.get(id)?.name || id;
  let S = recs(LD, 'sanctions', 'sanction');
  const cset = new Set(cmp);
  const touches = r => cset.has(r.target) || cmp.some(id => people.get(id)?.posts.some(x => x.org === r.target && activeAt(x, yearOf(r.date) ?? asOfY, asOfY)));
  if (state.only && cmp.length) S = S.filter(touches);
  const k = state.sort.k, dir = state.sort.dir === 'asc' ? 1 : -1;
  const val = r => k === 'target' ? tname(r.target) : String(r[k] ?? '');
  S = S.slice().sort((a, b) => dir * val(a).localeCompare(val(b)) || String(b.date).localeCompare(String(a.date)));
  const live = cmp.flatMap(id => recs(LD, 'sanctions', 'sanction').filter(r => sanctionActive(r, iso) && touches(r) && (r.target === id || people.get(id)?.posts.some(x => x.org === r.target))).map(r => ({ id, r })));
  const vis = recs(LD, 'us_congress', 'visit').slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  el.innerHTML = `<h3 class="cal-h">Sanctions <span class="fine">state to target, shown as red state-level ties in the chart</span></h3>
    ${hasLayer(LD, 'sanctions') ? `${cmp.length ? `<p class="fine">${live.length ? `In force at ${esc(iso.slice(0, 7))} on compared actors or their organizations: ${[...new Set(live.map(x => `${x.r.imposer} → ${nm(people, x.id)}`))].map(s => `<span class="sgn" data-sg="-1">${esc(s)}</span>`).join(' ')}` : `No sanction in force at ${esc(iso.slice(0, 7))} on the compared actors or their organizations.`}</p>
      <label class="tg"><input type="checkbox" data-sx-only${state.only ? ' checked' : ''}><span class="sw"></span><span class="t">Only compared actors and their organizations</span></label>` : ''}
    <div class="tablewrap"><table><caption class="fine">${S.length} sanction records. Dates as given by the imposer. Organization targets include defense firms and state bodies.</caption>
      <thead><tr>${SCOLS.map(([c, l]) => c === 'source' ? `<th scope="col">${l}</th>` : `<th scope="col" aria-sort="${k === c ? (dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="thbtn" data-sxs="${c}">${l}${k === c ? (dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${S.map(r => `<tr><td>${esc(r.imposer)}</td><td>${esc(r.authority)}</td><td>${people.has(r.target) ? pick(people, r.target, 'data-open') : esc(tname(r.target))}${r.reason ? `<br><span class="fine">${esc(r.reason)}</span>` : ''}</td><td class="num">${esc(r.date)}</td><td class="num">${r.lifted ? `${esc(r.lifted)} ${srcLink(r.lifted_source, 'src')}` : '–'}</td><td>${srcLink(r.source, 'source')}</td></tr>`).join('') || '<tr><td colspan="6" class="fine">No records match.</td></tr>'}</tbody></table></div>` : NOT_LOADED('Sanctions are')}
    <h3 class="cal-h">Congressional visits to Taiwan</h3>
    ${hasLayer(LD, 'us_congress') ? `<ul class="pf-list vis-l">${vis.map(v => visitLi(v, people, 'data-open')).join('') || '<li class="fine">None recorded.</li>'}</ul>` : NOT_LOADED('Congressional records are')}`;
  el.querySelectorAll('[data-sxs]').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.sxs; state.sort = { k: c, dir: state.sort.k === c && state.sort.dir === 'asc' ? 'desc' : 'asc' }; ctx.onChange(); el.querySelector(`[data-sxs="${c}"]`)?.focus();
  }));
  el.querySelector('[data-sx-only]')?.addEventListener('change', e => { state.only = e.target.checked; ctx.onChange(); el.querySelector('[data-sx-only]')?.focus(); });
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => ctx.onOpen(b.dataset.open)));
}

// ---------- Taiwan legislature tab ----------
export function renderLegislature(el, LD, state, ctx) {
  const { people } = ctx;
  if (!LD || !hasLayer(LD, 'ly_votes')) {
    el.innerHTML = `<h2 class="cal-h">Taiwan legislature</h2>${LD === undefined ? '<p class="fine">Loading…</p>' : NOT_LOADED('Legislative Yuan votes, caucuses and bills are')}<p class="fine">This tab shows party blocs, a legislator-by-vote matrix and an agreement network once the Legislative Yuan file is in the build.</p>`;
    return;
  }
  const { VI, maj, ids } = lyStats(LD);
  const now = todayISO();
  const topics = [...new Set(VI.map(x => x.v.topic || 'other'))];
  const cols = VI.map((x, i) => ({ ...x, i })).filter(x => state.topic === 'all' || (x.v.topic || 'other') === state.topic);
  const party = id => partyAt(LD, id, now)?.party || 'IND';
  const seated = ids.filter(id => recs(LD, 'ly_votes', 'caucus').some(c => c.person === id && !c.end));
  const blocs = PARTY_ORDER.map(p => ({ p, n: seated.filter(id => party(id) === p).length })).filter(b => b.n);
  const total = blocs.reduce((s, b) => s + b.n, 0) || 1;
  const rows = ids.filter(id => cols.some(x => x.m.has(id)) || seated.includes(id));
  const groups = PARTY_ORDER.map(p => ({ p, ids: rows.filter(id => party(id) === p).sort((a, b) => nm(people, a).localeCompare(nm(people, b))) })).filter(g => g.ids.length);
  const L1 = { yes: 'Y', no: 'N', abstain: 'A', absent: '·' };
  const cell = (x, id) => {
    const c = x.m.get(id) || 'absent';
    const pv = partyAt(LD, id, x.v.date)?.party, mj = pv && maj[x.i][pv];
    const def = c !== 'absent' && mj && c !== mj;
    return `<td class="v v-${c}${def ? ' def' : ''}"><span aria-hidden="true">${L1[c]}${def ? '!' : ''}</span><span class="sr">${CHOICE[c]}${def ? `, against ${pv} majority (${CHOICE[mj]})` : ''}</span></td>`;
  };
  // Agreement network on the filtered votes.
  const pairs = agreementPairs(cols, Math.min(10, Math.max(3, Math.floor(cols.length / 2))));
  const cross = pairs.filter(q => party(q.a) !== party(q.b));
  el.innerHTML = `<h2 class="cal-h">Taiwan legislature <span class="fine">Legislative Yuan, ${VI.length} recorded votes, data as of ${esc(LD.ly_votes.asOf || '')}</span></h2>
    <div class="choices turn-fam" role="group" aria-label="Topic"><button type="button" data-lyt="all" aria-pressed="${state.topic === 'all'}">All topics <span class="fine">${VI.length}</span></button>${topics.map(t => `<button type="button" data-lyt="${esc(t)}" aria-pressed="${state.topic === t}">${esc(t)} <span class="fine">${VI.filter(x => (x.v.topic || 'other') === t).length}</span></button>`).join('')}</div>
    <h3 class="cal-h">Party blocs <span class="fine">seated members with an open caucus record</span></h3>
    <div class="ly-blocs" role="img" aria-label="${esc(blocs.map(b => `${b.p} ${b.n}`).join(', '))}">${blocs.map(b => `<span class="pty-bar" data-p="${b.p}" style="flex:${b.n}">${b.p} ${b.n}</span>`).join('')}</div>
    <ul class="turn-sum">${blocs.map(b => `<li><b class="num">${b.n}</b><span>${esc(PARTY[b.p] || b.p)}</span><small>${Math.round(100 * b.n / total)}% of ${total} seated</small></li>`).join('')}</ul>
    <h3 class="cal-h">Votes <span class="fine">${cols.length} shown</span></h3>
    <p class="fine">Y yes, N no, A abstain, · not recorded. <span class="v def ly-key"><span aria-hidden="true">!</span></span> marks a vote against the legislator's party majority on that vote. Column numbers are listed below the matrix with titles and sources.</p>
    ${cols.length ? `<div class="tablewrap ly-wrap" tabindex="0" role="region" aria-label="Legislator by vote matrix, scrollable"><table class="ly-mx"><caption class="sr">Recorded votes by legislator, grouped by party</caption>
      <thead><tr><th scope="col">Legislator</th><th scope="col">With party</th>${cols.map(x => `<th scope="col" class="ly-c"><abbr title="${esc(`${x.v.date} ${x.v.title || x.v.title_native || x.v.id}`)}">${x.i + 1}</abbr></th>`).join('')}</tr></thead>
      ${groups.map(g => `<tbody><tr class="ly-g"><th scope="rowgroup" colspan="${cols.length + 2}"><span class="pty" data-p="${g.p}">${g.p}</span> ${esc(PARTY[g.p] || '')} <span class="fine">${g.ids.length}</span></th></tr>
        ${g.ids.map(id => { const sm = voteSummary(LD, id); const d = sm.line + sm.def.length; return `<tr><th scope="row">${pick(people, id, 'data-open')}</th><td class="num">${d ? Math.round(100 * sm.line / d) + '%' : '–'}</td>${cols.map(x => cell(x, id)).join('')}</tr>`; }).join('')}</tbody>`).join('')}
    </table></div>
    <details class="pr-d"><summary>Vote list <span class="fine">${cols.length}</span></summary><ol class="pf-list ly-list">${cols.map(x => `<li value="${x.i + 1}"><span class="tl-d">${esc(x.v.date)}</span> <span class="pill">${esc(x.v.topic || 'other')}</span> ${esc(x.v.title || x.v.title_native || x.v.id)}${x.v.title && x.v.title_native ? ` <span class="fine" lang="zh">${esc(x.v.title_native)}</span>` : ''} <span class="fine">yes ${(x.v.yes || []).length}, no ${(x.v.no || []).length}, abstain ${(x.v.abstain || []).length}</span> ${srcLink(x.v.source, 'source')}</li>`).join('')}</ol></details>` : '<p class="fine">No votes on this topic.</p>'}
    <h3 class="cal-h">Agreement network <span class="fine">a line joins two legislators who cast the same vote on at least 90% of at least ${Math.min(10, Math.max(3, Math.floor(cols.length / 2)))} shared votes shown</span></h3>
    <figure class="turn-fig"><svg class="ly-net" viewBox="0 0 800 420" role="img" aria-label="${esc(`${pairs.length} agreeing pairs, ${cross.length} across party lines`)}"></svg>
      <figcaption class="legend">${PARTY_ORDER.map(p => `<span><i class="lg-dot pty-dot" data-p="${p}"></i>${p}</span>`).join('')}<span><i class="sw-lv"></i>Same party</span><span><i class="sw-lv x"></i>Across parties</span></figcaption></figure>
    <p class="fine">${pairs.length} agreeing pairs; ${cross.length} cross party lines.</p>
    ${cross.length ? `<details class="pr-d"><summary>Cross-party pairs <span class="fine">${cross.length}</span></summary><ul class="pf-list">${cross.slice(0, 200).map(q => `<li>${pick(people, q.a, 'data-open')} <span class="fine">${party(q.a)}</span> and ${pick(people, q.b, 'data-open')} <span class="fine">${party(q.b)}</span>: ${q.agree} of ${q.shared}</li>`).join('')}</ul></details>` : ''}`;
  el.querySelectorAll('[data-lyt]').forEach(b => b.addEventListener('click', () => { state.topic = b.dataset.lyt; ctx.onChange(); el.querySelector(`[data-lyt="${CSS.escape(state.topic)}"]`)?.focus(); }));
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => ctx.onOpen(b.dataset.open)));
  drawAgreement(el.querySelector('.ly-net'), [...new Set(pairs.flatMap(q => [q.a, q.b]))], pairs, party, people);
}
function drawAgreement(svg, ids, pairs, party, people) {
  const d3 = window.d3; if (!d3 || !svg) return;
  const ax = { DPP: 200, KMT: 600, TPP: 400, IND: 400 }, ay = { DPP: 210, KMT: 210, TPP: 90, IND: 340 };
  const nodes = ids.map(id => ({ id, p: party(id), x: ax[party(id)] + Math.random() * 20, y: ay[party(id)] + Math.random() * 20 }));
  const links = pairs.map(q => ({ source: q.a, target: q.b, x: party(q.a) !== party(q.b) }));
  const sim = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id(d => d.id).distance(30).strength(0.05))
    .force('charge', d3.forceManyBody().strength(-18)).force('x', d3.forceX(d => ax[d.p]).strength(0.08)).force('y', d3.forceY(d => ay[d.p]).strength(0.08))
    .force('collide', d3.forceCollide(6)).stop();
  for (let i = 0; i < 250; i++) sim.tick();
  const c = v => Math.max(8, Math.min(792, v)), cy = v => Math.max(8, Math.min(412, v));
  svg.innerHTML = links.map(l => `<line class="ly-e${l.x ? ' x' : ''}" x1="${c(l.source.x)}" y1="${cy(l.source.y)}" x2="${c(l.target.x)}" y2="${cy(l.target.y)}"/>`).join('')
    + nodes.map(n => `<circle class="pty-dot" data-p="${n.p}" cx="${c(n.x)}" cy="${cy(n.y)}" r="5"><title>${esc(nm(people, n.id))} (${n.p})</title></circle>`).join('');
}

// ---------- Succession watch tab ----------
export function renderSuccession(el, LD, state, ctx) {
  const { L, people, orgs, asOfY } = ctx;
  if (!LD || !hasLayer(LD, 'succession')) { el.innerHTML = `<h2 class="cal-h">Succession watch</h2>${LD === undefined ? '<p class="fine">Loading…</p>' : NOT_LOADED('Age, term and succession records are')}`; return; }
  const iso = L.asOf, sigs = ladderSigs(LD, people, orgs);
  const rows = [];
  for (const p of L.people) if (p.tier === 1 && p.status === 'active') for (const x of p.posts) if (x.end == null && activeAt(x, asOfY, asOfY)) rows.push({ p, x });
  const countries = [...new Set(rows.map(r => r.p.country))].sort();
  const shown = rows.filter(r => state.c === 'all' || r.p.country === state.c).sort((a, b) => a.p.country.localeCompare(b.p.country) || a.p.name.localeCompare(b.p.name));
  const row = ({ p, x }) => {
    const age = ageAt(p.born, iso), inPost = yearsBetween(x.start, iso);
    const rules = rulesFor(LD, p.country, x, orgs.get(x.org));
    const fd = feeders(sigs, x, p, people, orgs, asOfY, asOfY);
    return `<tr><th scope="row">${pick(people, p.id, 'data-open')}<br><span class="fine">${esc(p.country)}</span></th>
      <td>${esc(x.title)}<br><span class="fine">${esc(orgs.get(x.org)?.name || x.org)}</span></td>
      <td class="num">${age ? `${age.approx ? 'about ' : ''}${age.years}` : '<span class="fine">birth date not sourced</span>'}</td>
      <td class="num">${x.start ? `${yrs(inPost)}<br><span class="fine">since ${esc(x.start)}</span>` : '<span class="fine">start not sourced</span>'}${x.last_seen ? `<br><span class="fine">last confirmed ${esc(x.last_seen)}</span> ${srcLink(x.last_seen_source, 'src')}` : ''}</td>
      <td>${rules.length ? `<ul class="pf-list">${rules.map(r => `<li><b>${esc(r.max_age_or_term)}</b><br><span class="fine">${esc(r.rank_or_post)}. ${esc(r.rule)}</span> ${srcLink(r.source, 'source')}</li>`).join('')}</ul>` : '<span class="fine">no rule on file</span>'}</td>
      <td>${fd.length ? fd.map(f => `<p class="fine">From ${esc(f.ladder.from_post)}: observed ${f.ladder.n_observed} time${f.ladder.n_observed === 1 ? '' : 's'}, e.g. ${(f.ladder.examples || []).map(id => pick(people, id, 'data-open')).join(', ')} ${srcLink(f.ladder.source, 'src')}</p>
        ${f.cands.length ? `<p class="fine">Now in that post:</p><ul class="pf-list">${f.cands.slice().sort((a, b) => a.p.name.localeCompare(b.p.name)).map(c => `<li>${pick(people, c.p.id, 'data-open')} <span class="fine">${esc(c.post.title)}, ${esc(orgs.get(c.post.org)?.name || c.post.org)}</span></li>`).join('')}</ul>` : '<p class="fine">Nobody in the index holds a feeder post now.</p>'}`).join('') : '<span class="fine">no feeder pattern on file</span>'}</td></tr>`;
  };
  el.innerHTML = `<h2 class="cal-h">Succession watch</h2>
    <p class="w-warn"><b>People in posts that have fed this post before. Not a forecast; no ranking.</b></p>
    <div class="turn-ctl"><label>Country <select class="sel-in" data-sc><option value="all">All countries</option>${countries.map(c => `<option value="${c}"${c === state.c ? ' selected' : ''}>${esc(COUNTRY_NAMES[c] || c)}</option>`).join('')}</select></label></div>
    <div class="tablewrap"><table class="succ"><caption class="fine">${shown.length} open posts held by tier-1 people at ${esc(iso)}. Age and term rules are quoted from each record with its source; a rule is shown only when its wording names this rank or post. Candidates are listed alphabetically by the ladder they come from.</caption>
      <thead><tr><th scope="col">Incumbent</th><th scope="col">Post</th><th scope="col">Age</th><th scope="col">Time in post</th><th scope="col">Age or term rule</th><th scope="col">Candidates</th></tr></thead>
      <tbody>${shown.map(row).join('') || '<tr><td colspan="6" class="fine">No open posts match.</td></tr>'}</tbody></table></div>`;
  el.querySelector('[data-sc]').addEventListener('change', e => { state.c = e.target.value; ctx.onChange(); el.querySelector('[data-sc]')?.focus(); });
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => ctx.onOpen(b.dataset.open)));
}

// ---------- What changed tab ----------
export const CHANGE_KINDS = { added: 'Added', status: 'Status change', post_start: 'Post started', post_end: 'Post ended', dropped: 'Dropped' };
export function renderChanges(el, CH, state, ctx) {
  const { people } = ctx;
  if (!CH) { el.innerHTML = `<h2 class="cal-h">What changed</h2>${CH === undefined ? '<p class="fine">Loading…</p>' : NOT_LOADED('The change log is')}`; return; }
  const countries = [...new Set(CH.map(c => c.country))].sort();
  const its = CH.filter(c => (state.k === 'all' || c.kind === state.k) && (state.c === 'all' || c.country === state.c));
  const dates = [...new Set(its.map(c => c.date))].sort().reverse();
  const who = c => people.has(c.person) ? pick(people, c.person, 'data-open') : esc(c.name || c.person);
  el.innerHTML = `<h2 class="cal-h">What changed</h2>
    <p class="fine">Changes to the index, dated by when they entered it. Real-world dates are in each post.</p>
    <div class="turn-ctl"><label>Country <select class="sel-in" data-chc><option value="all">All countries</option>${countries.map(c => `<option value="${c}"${c === state.c ? ' selected' : ''}>${esc(COUNTRY_NAMES[c] || c)}</option>`).join('')}</select></label></div>
    <div class="choices turn-fam" role="group" aria-label="Kind of change"><button type="button" data-chk="all" aria-pressed="${state.k === 'all'}">All kinds <span class="fine">${CH.length}</span></button>${Object.entries(CHANGE_KINDS).filter(([k]) => CH.some(c => c.kind === k)).map(([k, l]) => `<button type="button" data-chk="${k}" aria-pressed="${state.k === k}">${l} <span class="fine">${CH.filter(c => c.kind === k).length}</span></button>`).join('')}</div>
    ${dates.map(d => {
      const day = its.filter(c => c.date === d), add = day.filter(c => c.kind === 'added'), rest = day.filter(c => c.kind !== 'added');
      const byC = {}; for (const c of add) (byC[c.country] ||= []).push(c);
      return `<section class="chg-day"><h3 class="pf-h">${esc(d)} <span class="fine">${day.length} changes</span></h3><ul class="pf-list">
        ${add.length ? `<li><details class="pr-d"><summary><span class="pill">Added</span> ${add.length} people added to the index</summary>${Object.keys(byC).sort().map(c => `<p class="fine"><b>${esc(COUNTRY_NAMES[c] || c)}</b> ${byC[c].length}</p><p class="chg-names">${byC[c].map(who).join(', ')}</p>`).join('')}</details></li>` : ''}
        ${rest.map(c => `<li><span class="pill">${esc(CHANGE_KINDS[c.kind] || c.kind)}</span> ${who(c)} <span class="fine">${esc(c.country)}</span>: ${esc(c.detail || '')} ${c.source ? srcLink(c.source, 'src') : ''}</li>`).join('')}</ul></section>`;
    }).join('') || '<p class="fine">No changes match.</p>'}`;
  el.querySelector('[data-chc]').addEventListener('change', e => { state.c = e.target.value; ctx.onChange(); el.querySelector('[data-chc]')?.focus(); });
  el.querySelectorAll('[data-chk]').forEach(b => b.addEventListener('click', () => { state.k = b.dataset.chk; ctx.onChange(); el.querySelector(`[data-chk="${state.k}"]`)?.focus(); }));
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => ctx.onOpen(b.dataset.open)));
}

// ---------- Triggers (calendar section and watch markers) ----------
export const TRIG_KINDS = { election: 'Election', inauguration: 'Inauguration or address', recall: 'Recall', budget_vote: 'Budget vote', arms_sale: 'Arms sale', transit: 'Transit', visit: 'Visit', speech: 'Speech', law: 'Law', other: 'Other' };
export const isFuture = r => !!r.scheduled || String(r.date) > todayISO();
export function triggerKindSelect(trigs, k) {
  const kinds = Object.keys(TRIG_KINDS).filter(x => trigs.some(r => r.kind === x));
  return `<label class="trg-sel">Taiwan politics events <select class="sel-in" data-trig-kind><option value="all">All kinds</option>${kinds.map(x => `<option value="${x}"${x === k ? ' selected' : ''}>${esc(TRIG_KINDS[x])}</option>`).join('')}</select></label>`;
}
export function renderTriggers(el, LD, state, ctx) {
  const { people } = ctx;
  if (!LD || !hasLayer(LD, 'triggers')) { el.innerHTML = `<h3 class="cal-h">Taiwan politics events</h3>${LD === undefined ? '<p class="fine">Loading…</p>' : NOT_LOADED('Taiwan politics events are')}`; return; }
  const all = recs(LD, 'triggers', 'trigger');
  const its = all.filter(r => state.k === 'all' || r.kind === state.k).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const kinds = Object.keys(TRIG_KINDS).filter(x => all.some(r => r.kind === x));
  const y0 = Math.min(...all.map(r => +String(r.date).slice(0, 4))), y1 = Math.max(+todayISO().slice(0, 4) + 1, ...all.map(r => +String(r.date).slice(0, 4) + 1));
  const W = 800, padL = 118, X = d => padL + ((yearOf(d) - y0) / (y1 - y0)) * (W - padL - 8);
  const lanes = kinds.filter(k => its.some(r => r.kind === k)), H = 24 + lanes.length * 22;
  const ys = []; for (let y = y0; y <= y1; y++) ys.push(y);
  el.innerHTML = `<h3 class="cal-h">Taiwan politics events <span class="fine">${all.length} dated events, past and scheduled</span></h3>
    <div class="choices turn-fam" role="group" aria-label="Event kind"><button type="button" data-tk="all" aria-pressed="${state.k === 'all'}">All kinds</button>${kinds.map(k => `<button type="button" data-tk="${k}" aria-pressed="${state.k === k}">${esc(TRIG_KINDS[k])} <span class="fine">${all.filter(r => r.kind === k).length}</span></button>`).join('')}</div>
    <figure class="turn-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${its.length} Taiwan politics events from ${y0} to ${y1}`)}">
      ${ys.map(y => `<line x1="${X(`${y}-01-01`)}" x2="${X(`${y}-01-01`)}" y1="10" y2="${H - 2}" class="tk"/><text x="${X(`${y}-01-01`) + 3}" y="10" class="tk">${y}</text>`).join('')}
      <line x1="${X(todayISO())}" x2="${X(todayISO())}" y1="12" y2="${H - 2}" class="trg-now"/>
      ${lanes.map((k, i) => `<text x="0" y="${28 + i * 22}" class="tk cal-lane">${esc(TRIG_KINDS[k])}</text>`).join('')}
      ${its.map(r => `<circle class="trg-m${isFuture(r) ? ' fut' : ''}" cx="${X(r.date)}" cy="${24 + lanes.indexOf(r.kind) * 22}" r="4.5"><title>${esc(`${r.date} ${TRIG_KINDS[r.kind] || r.kind}: ${r.title}${isFuture(r) ? ' (scheduled)' : ''}`)}</title></circle>`).join('')}</svg>
      <figcaption class="legend"><span><i class="lg-dot trg-k"></i>Past event</span><span><i class="lg-dot trg-k fut"></i>Scheduled or future</span><span><i class="sw-now"></i>Today</span></figcaption></figure>
    <div class="tablewrap"><table><caption class="fine">${its.length} events, newest first. Scheduled ones are marked.</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Kind</th><th scope="col">Event</th><th scope="col">People</th><th scope="col">Source</th></tr></thead>
      <tbody>${its.slice().reverse().map(r => `<tr class="${isFuture(r) ? 'fut' : ''}"><td class="num">${esc(r.date)}</td><td>${esc(TRIG_KINDS[r.kind] || r.kind)}${isFuture(r) ? ' <span class="pill trg-fut">scheduled</span>' : ''}</td><td>${esc(r.title)}</td><td>${(r.actors || []).map(id => pick(people, id, 'data-open')).join(', ')}</td><td>${srcLink(r.source, 'source')}</td></tr>`).join('') || '<tr><td colspan="5" class="fine">No events of this kind.</td></tr>'}</tbody></table></div>`;
  el.querySelectorAll('[data-tk]').forEach(b => b.addEventListener('click', () => { state.k = b.dataset.tk; ctx.onChange(); el.querySelector(`[data-tk="${state.k}"]`)?.focus(); }));
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => ctx.onOpen(b.dataset.open)));
}
// Markers for one tenure window [from, to] (ISO) in the "On their watch" section.
export function triggerStripHtml(trigs, from, to, k) {
  const its = trigs.filter(r => (k === 'all' || r.kind === k) && String(r.date) >= from && String(r.date) <= to);
  const a = Date.parse(from), b = Math.max(a + 1, Date.parse(to));
  const pc = d => Math.max(0, Math.min(100, ((Date.parse(d) - a) / (b - a)) * 100));
  return { n: its.length, html: `<div class="trg-strip" role="img" aria-label="${esc(`${its.length} Taiwan politics events during this tenure`)}">${its.map(r => `<i class="${isFuture(r) ? 'fut' : ''}" style="left:${pc(r.date)}%" title="${esc(`${r.date} ${r.title}`)}"></i>`).join('')}<span>${esc(from.slice(0, 7))}</span><span>${esc(to.slice(0, 7))}</span></div>
    ${its.length ? `<details class="pr-d"><summary>Events during this tenure <span class="fine">${its.length}</span></summary><ul class="pf-list">${its.map(r => `<li><span class="tl-d">${esc(r.date)}</span> <span class="pill">${esc(TRIG_KINDS[r.kind] || r.kind)}</span> ${esc(r.title)}${isFuture(r) ? ' <span class="pill trg-fut">scheduled</span>' : ''} ${srcLink(r.source, 'src')}</li>`).join('')}</ul></details>` : ''}` };
}
