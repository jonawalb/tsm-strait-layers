// Turnover view: removals, investigations, unexplained replacements and retirements by month,
// with a case table and "N of M" counts per organization family. Built from status + status_date.
import { COUNTRY_NAMES, STATUS_TEXT, srcLink } from './profile.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

export const TURN_STATUSES = ['removed', 'under_investigation', 'unaccounted', 'retired'];
const FLAG = new Set(['removed', 'under_investigation', 'unaccounted']);
const COLOR = { removed: 'var(--bad)', under_investigation: 'var(--warn)', unaccounted: 'var(--c6)', retired: 'var(--faint)' };

// Organization family for a post: CHN gets PLA-specific families; others go by org type.
function familyFn(L) {
  const orgs = new Map(L.orgs.map(o => [o.id, o]));
  const chn = id => {
    for (let o = orgs.get(id), i = 0; o && i < 8; o = orgs.get(o.parent), i++) {
      if (/^CHN-(ETC|STC|WTC|NTC|CTC)$/.test(o.id)) return 'Theater commands';
      if (/^CHN-(PLAN|PLAAF|PLAA|PLARF|ISF|JLSF|SSF|ASF|CSF|NDU|AMS)$/.test(o.id)) return 'Services, arms and academies';
      if (/^CHN-(PAP|CCG)$/.test(o.id)) return 'PAP and Coast Guard';
      if (o.id === 'CHN-CMC' || o.id.startsWith('CHN-CMC-')) return 'CMC and its departments';
    }
    return 'Party and state';
  };
  const other = id => ({ military: 'Military', coastguard: 'Coast guard', security: 'Security and intelligence', intelligence: 'Security and intelligence' }[orgs.get(id)?.type] || 'Government, party and legislature');
  return (country, id) => country === 'CHN' ? chn(id) : other(id);
}
const monthOf = d => /^\d{4}$/.test(d) ? `${d}-07` : d.slice(0, 7);

export function turnoverCases(L) {
  const fam = familyFn(L);
  const orgName = new Map(L.orgs.map(o => [o.id, o.name]));
  return L.people.filter(p => TURN_STATUSES.includes(p.status) && p.status_date).map(p => {
    const last = p.posts.slice().sort((a, b) => String(b.end ?? '9999').localeCompare(String(a.end ?? '9999')) || String(b.start || '').localeCompare(String(a.start || '')))[0];
    return { p, status: p.status, date: p.status_date, month: monthOf(p.status_date), yearOnly: /^\d{4}$/.test(p.status_date),
      last: last ? `${last.title}, ${orgName.get(last.org) || last.org}` : '', fams: new Set(p.posts.map(x => fam(p.country, x.org))) };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// state: {c, fam, since}; ctx: {onChange, onOpen}
export function renderTurnover(el, L, cases, state, ctx) {
  const fam = familyFn(L);
  const countries = Object.keys(COUNTRY_NAMES).filter(c => cases.some(k => k.p.country === c));
  if (!countries.includes(state.c)) state.c = countries[0] || 'CHN';
  const inC = cases.filter(k => k.p.country === state.c);
  const fams = [...new Set(L.people.filter(p => p.country === state.c).flatMap(p => p.posts.map(x => fam(p.country, x.org))))].sort();
  if (state.fam !== 'all' && !fams.includes(state.fam)) state.fam = 'all';
  const sinceY = String(state.since);
  const shown = inC.filter(k => (state.fam === 'all' || k.fams.has(state.fam)) && k.date.slice(0, 4) >= sinceY);

  // N of M: people who held a post in the family at any point since the start year, and how many of them were flagged since then.
  const held = (p, f) => p.posts.some(x => fam(p.country, x.org) === f && (x.end == null || String(x.end).slice(0, 4) >= sinceY));
  const summary = (state.fam === 'all' ? fams : [state.fam]).map(f => {
    const M = L.people.filter(p => p.country === state.c && held(p, f));
    const N = M.filter(p => FLAG.has(p.status) && String(p.status_date).slice(0, 4) >= sinceY);
    return { f, M: M.length, N: N.length };
  }).filter(s => s.M);

  // Monthly timeline.
  const m0 = `${sinceY}-01`, m1 = L.asOf.slice(0, 7);
  const months = []; for (let [y, m] = m0.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= m1; m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
  const byM = new Map(months.map(m => [m, []])); for (const k of shown) byM.get(k.month)?.push(k);
  const maxN = Math.max(1, ...[...byM.values()].map(v => v.length));
  const W = 800, H = 170, pad = 24, bw = (W - pad) / months.length;
  const bars = months.map((m, i) => { let y = H - 18; return TURN_STATUSES.map(s => { const ks = byM.get(m).filter(k => k.status === s); if (!ks.length) return ''; const h = ks.length / maxN * (H - 36); y -= h;
    return `<rect x="${pad + i * bw + 0.5}" y="${y}" width="${Math.max(1, bw - 1)}" height="${h}" style="fill:${COLOR[s]}"><title>${m}: ${ks.length} ${STATUS_TEXT[s].toLowerCase()}. ${ks.map(k => k.p.name).join(', ')}</title></rect>`; }).join(''); }).join('');
  const ticks = months.map((m, i) => m.endsWith('-01') ? `<line x1="${pad + i * bw}" x2="${pad + i * bw}" y1="${H - 18}" y2="${H - 13}" class="tk"/><text x="${pad + i * bw + 2}" y="${H - 3}" class="tk">${m.slice(0, 4)}</text>` : '').join('');
  const yo = shown.filter(k => k.yearOnly).length;

  el.innerHTML = `<div class="turn-ctl">
      <label>Country <select class="sel-in" data-tc>${countries.map(c => `<option value="${c}"${c === state.c ? ' selected' : ''}>${esc(COUNTRY_NAMES[c])}</option>`).join('')}</select></label>
      <label>Since <select class="sel-in" data-ts>${Array.from({ length: +L.asOf.slice(0, 4) - 2011 }, (_, i) => 2012 + i).map(y => `<option${String(y) === sinceY ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
    </div>
    <div class="choices turn-fam" role="group" aria-label="Organization family"><button type="button" data-tf="all" aria-pressed="${state.fam === 'all'}">All organizations</button>${fams.map(f => `<button type="button" data-tf="${esc(f)}" aria-pressed="${state.fam === f}">${esc(f)}</button>`).join('')}</div>
    <ul class="turn-sum">${summary.map(s => `<li><b class="num">${s.N}</b> of <b class="num">${s.M}</b> <span>${esc(s.f)}</span><small>removed, under investigation or replaced without explanation since ${sinceY}</small></li>`).join('')}</ul>
    <figure class="turn-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cases per month since ${sinceY}, stacked by status">${bars}<line x1="${pad}" x2="${W}" y1="${H - 18}" y2="${H - 18}" class="tk"/>${ticks}
      <text x="0" y="12" class="tk">${maxN}</text></svg>
      <figcaption class="legend">${TURN_STATUSES.map(s => `<span><i class="lg-sq" style="background:${COLOR[s]}"></i>${STATUS_TEXT[s]}</span>`).join('')}${yo ? `<span class="fine">${yo} case(s) dated only to a year are placed at mid-year</span>` : ''}</figcaption></figure>
    <div class="tablewrap"><table><caption class="fine">${shown.length} cases. Click a name for the full profile.</caption>
      <thead><tr><th scope="col">Name</th><th scope="col">Last post</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col">Source</th></tr></thead>
      <tbody>${shown.map(k => `<tr><td><button type="button" class="linkbtn" data-open="${esc(k.p.id)}">${esc(k.p.name)}</button>${k.p.name_native ? ` <span class="fine">${esc(k.p.name_native)}</span>` : ''}</td>
        <td>${esc(k.last)}</td><td><span class="stpill" data-s="${k.status === 'removed' ? 'bad' : FLAG.has(k.status) ? 'warn' : ''}">${esc(STATUS_TEXT[k.status])}</span></td>
        <td class="num">${esc(k.date)}</td><td>${srcLink(k.p.status_source, 'source')}</td></tr>`).join('') || '<tr><td colspan="5" class="fine">No cases match.</td></tr>'}</tbody></table></div>`;
  el.querySelector('[data-tc]').addEventListener('change', e => { state.c = e.target.value; state.fam = 'all'; ctx.onChange(); });
  el.querySelector('[data-ts]').addEventListener('change', e => { state.since = +e.target.value; ctx.onChange(); });
  el.querySelectorAll('[data-tf]').forEach(b => b.addEventListener('click', () => { state.fam = b.dataset.tf; ctx.onChange(); el.querySelector(`[data-tf="${CSS.escape(state.fam)}"]`)?.focus(); }));
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => ctx.onOpen(b.dataset.open)));
}
