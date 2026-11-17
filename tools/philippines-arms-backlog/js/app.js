// Philippines Arms Sales Backlog: state, wiring and the two-tier headline.
import { CATS, OPEN, byKey, visible, summary, fmtM, fmtAge, fmtD, AS_OF, LEFT } from './model.js';
import { EXCLUDED, UNRESOLVED, UNIVERSE, ALT } from '../data/cases.js';
import { addExportBar } from '../../../shared/js/export.js';
import { createGantt } from './gantt.js';
import { createTotal } from './total.js';
import { buildFilters, syncFilters, renderDetail } from './panel.js';
import { createTour } from './tour.js';
import { readHash, writeHash } from './hash.js';
import { createMonthView } from './monthview.js';
import { renderExcluded } from './excluded.js';
import { LATEST } from './mdata.js';
import { countUp } from '../../../shared/js/motion.js';

const DEFAULTS = () => ({ cats: new Set(CATS), status: 'all', sort: 'tier', gone: false, sel: 'boats-2020', view: 'notified', month: LATEST, wedge: null });
const S = DEFAULTS();
readHash(S);
let mv = null;

const sm = summary();
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function headline() {
  document.querySelectorAll('[data-asof]').forEach(n => { n.textContent = fmtD(AS_OF); });
  const boats = byKey['boats-2020'];
  const big = OPEN.filter(c => c.tier === 'nna').reduce((a, b) => (b.m > a.m ? b : a), { m: 0 });
  countUp(document.getElementById('big-c'), sm.totals.contracted, { from: 0, ms: 750, fmt: n => `$${Math.round(n)}M` });
  document.getElementById('big-n').textContent = `$${(sm.totals.nna / 1000).toFixed(2)}B`;
  document.getElementById('sub-c').textContent = `${sm.nTier.contracted} case under a signed LOA, at its notified value. The signed contract was ₱${(boats.signed.php / 1e9).toFixed(2)} billion.`;
  document.getElementById('sub-n').textContent = `${sm.nTier.nna} cases notified to Congress with no signed LOA. They may never become purchases.${ALT ? ` The State Department lists the F-16 LOA as withdrawn; counted as an exit, this tier would be ${fmtM(ALT.nna_without_f16)}.` : ''}`;
  document.getElementById('sum-line').textContent = `The two tiers together come to ${fmtM(sm.totals.contracted + sm.totals.nna)} notified; ${Math.round(sm.totals.contracted / (sm.totals.contracted + sm.totals.nna) * 1000) / 10}% of it is under contract.`;
  const fill = { 'boats-m': fmtM(boats.m), 'boats-php': `₱${(boats.signed.php / 1e9).toFixed(2)} billion`, 'u-n': String(UNIVERSE.n), 'u-first': UNIVERSE.first.slice(0, 4) };
  document.querySelectorAll('[data-fill]').forEach(n => { n.textContent = fill[n.dataset.fill]; });
  const o = sm.oldest;
  const U = UNIVERSE.by;
  document.getElementById('tiles').innerHTML = `
    <div><dt>One case, ${Math.round(big.m / sm.totals.nna * 100)}% of the unaccepted tier</dt><dd class="num">${fmtM(big.m)}</dd>
      <small>${big.key === 'f16-2025' ? 'The 2025 F-16 case. Its LOA, offered at $4.05B, expired unsigned on June 30, 2025; State\'s April 2026 report lists it as withdrawn.' : `${big.name}, notified ${fmtD(big.notified)}.`} <button type="button" data-go="f16">Show</button></small></div>
    <div><dt>Delivered since 2014</dt><dd class="num">${fmtM(U.delivered.m)}</dd>
      <small>${U.delivered.n} of ${UNIVERSE.n} notified cases, out of ${fmtM(UNIVERSE.m)} notified. <button type="button" data-go="history">Show</button></small></div>
    <div><dt>Longest open</dt><dd>${fmtAge(o.age)}</dd>
      <small>${o.name}, notified ${fmtD(o.notified)}. <button type="button" data-go="oldest">Show</button></small></div>
    <div><dt>Out of both tiers</dt><dd>${EXCLUDED.length} cases</dd>
      <small>Delivered, or dead: lost to a competitor or superseded. ${UNRESOLVED.length} questions open.${LEFT.length ? ` ${LEFT.length} left since March 2026.` : ''} <button type="button" data-go="excluded">Show</button></small></div>`;
  document.querySelectorAll('#tiles [data-go]').forEach(btn => btn.onclick = () => {
    const g = btn.dataset.go;
    if (g === 'excluded') { document.getElementById('excluded').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); return; }
    if (g === 'history') { apply({ view: 'notified', scroll: 'totalbox' }); return; }
    if (g === 'f16') apply({ cats: CATS, status: 'nna', sort: 'value', sel: big.key });
    if (g === 'oldest') apply({ cats: CATS, status: 'all', sort: 'age', sel: o.key });
    document.getElementById('ganttbox').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
}

const gantt = createGantt(document.getElementById('gantt'), document.getElementById('tip'), { onSelect: k => select(k) });
const total = createTotal(document.getElementById('total'), document.getElementById('total-read'), {
  onSelect: k => { if (byKey[k].gone && !S.gone) S.gone = true; S.status = 'all'; select(k); render(); gantt.focus(k); },
});

let list = [];
function render() {
  list = visible(S);
  if (S.sel && !list.some(c => c.key === S.sel)) S.sel = list.length ? list[0].key : null;
  gantt.update(list, S.sel);
  syncFilters(S, list);
  renderDetail(S.sel ? byKey[S.sel] : null, list, (k, focus) => { select(k); if (focus) gantt.focus(k); });
  const sub = { tier: 'Contracted first, then by dollar value', age: 'Sorted by time since notification', value: 'Sorted by dollar value', new: 'Most recent notification first' }[S.sort];
  document.getElementById('gantt-sub').textContent = `${sub}. Dot at left: filled = high confidence in the tier, hollow = medium.`;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
  document.getElementById('total-title').textContent = S.view === 'months'
    ? 'The two tiers in each monthly tracker record'
    : 'Every notified sale since 2014, by what became of it';
  document.getElementById('total-sub').textContent = S.view === 'months'
    ? 'Left bar contracted, right bar notified but not accepted, from the first record in March 2026. No monthly Philippine figure was published before then.'
    : 'Cumulative notified value, stacked at each notification date and coloured by outcome. A history of notifications, not of the backlog.';
  total.setView(S.view);
  writeHash(S);
}

function select(k) {
  S.sel = k;
  gantt.select(k);
  renderDetail(byKey[k], list, (kk, focus) => { select(kk); if (focus) gantt.focus(kk); });
  writeHash(S);
}

function apply(set) {
  if (set.cats) S.cats = new Set(set.cats);
  ['status', 'sort', 'gone', 'view', 'sel'].forEach(k => { if (k in set) S[k] = set[k]; });
  render();
  if (set.month && mv) { S.month = set.month; S.wedge = null; mv.render(true); }
  if (set.scroll) document.getElementById(set.scroll).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

if (!LEFT.length) document.getElementById('gone-wrap').remove();
buildFilters(S, render);
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { S.view = b.dataset.view; render(); });
const tour = createTour(apply);
document.getElementById('tour-btn').onclick = () => tour.start();
document.getElementById('copy-link').onclick = async e => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(location.href); b.textContent = 'Link copied'; }
  catch { b.textContent = 'Copy the address bar'; }
  setTimeout(() => { b.textContent = 'Copy link to this view'; }, 1800);
};

headline();
const NOTE = `Data: TSM Philippines arms sales backlog tracker, as of ${fmtD(AS_OF)}`;
addExportBar(document.getElementById('ganttbox'), { where: 'after', target: () => document.getElementById('gantt'), note: NOTE,
  title: 'U.S. arms sales to the Philippines: open cases by tier' });
addExportBar(document.getElementById('totalbox'), { target: () => document.getElementById('total'), note: NOTE,
  title: () => document.getElementById('total-title').textContent });

render();
renderExcluded(document.getElementById('excluded'));
mv = createMonthView(S, {
  save: () => writeHash(S),
  showInTimeline: k => {
    if (byKey[k].gone && !S.gone) S.gone = true;
    if (!byKey[k].gone && !S.cats.has(byKey[k].cat)) S.cats.add(byKey[k].cat);
    S.status = 'all';
    S.sel = k;
    render();
    requestAnimationFrame(() => requestAnimationFrame(() => gantt.focus(k)));
  },
});

addEventListener('hashchange', () => {
  Object.assign(S, DEFAULTS());
  readHash(S);
  render();
  mv.render(false);
});
