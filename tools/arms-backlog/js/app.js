// Arms Sales Backlog: state, wiring and headline numbers.
import { CATS, byKey, visible, summary, fmtB, fmtAge, fmtD, TOPLINE } from './model.js';
import { addExportBar } from '../../../shared/js/export.js';
import { createGantt } from './gantt.js';
import { createTotal } from './total.js';
import { buildFilters, syncFilters, renderDetail } from './panel.js';
import { createTour } from './tour.js';
import { readHash, writeHash } from './hash.js';
import { renderNotes } from './notes.js';
import { createMonthView } from './monthview.js';
import { LATEST } from './mdata.js';

const DEFAULTS = () => ({ cats: new Set(CATS), status: 'all', sort: 'age', gone: false, sel: 'f16', view: 'topline', month: LATEST, wedge: null });
const S = DEFAULTS();
readHash(S);
let mv = null;  // month view, created last

const sm = summary();
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function headline() {
  const big = document.getElementById('big-total');
  const target = sm.total / 1000;
  if (reduce) big.textContent = `$${target.toFixed(2)}B`;
  else {
    let step = 0;
    const N = 40;
    const tick = () => {
      step++;
      const e = 1 - (1 - step / N) ** 3;
      big.textContent = `$${(target * e).toFixed(2)}B`;
      if (step < N) setTimeout(tick, 22);
    };
    tick();
  }
  document.getElementById('big-sub').textContent =
    `${sm.n} open cases notified to Congress since June 2017. Full case value counts until final delivery.`;
  const o = sm.oldest;
  document.getElementById('tiles').innerHTML = `
    <div><dt>Deliveries under way</dt><dd class="num">${fmtB(sm.delivM)}</dd>
      <small>${sm.delivN} cases partly delivered. <button type="button" data-go="delivering">Show them</button></small></div>
    <div><dt>Longest wait</dt><dd>${fmtAge(o.age)}</dd>
      <small>Notified ${fmtD(o.notified)}: JSOW and Mk 48 torpedoes. <button type="button" data-go="oldest">Show</button></small></div>
    <div><dt>Median wait</dt><dd>${fmtAge(sm.median)}</dd><small>Across all ${sm.n} open cases, from notification to the data date.</small></div>
    <div><dt>Left since Jan. 2025</dt><dd class="num">${fmtB(sm.leftM)}</dd>
      <small>Abrams, Stingers, 2024 ALTIUS; one case removed. <button type="button" data-go="gone">Show</button></small></div>`;
  document.querySelectorAll('#tiles [data-go]').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    // all categories, so the case each tile names is in the list even if a category was switched off
    if (g === 'delivering') apply({ cats: CATS, status: 'delivering', sel: 'hcds' });
    if (g === 'oldest') apply({ cats: CATS, status: 'all', sort: 'age', sel: 'agm154c' });
    if (g === 'gone') apply({ cats: CATS, gone: true, sel: 'abrams' });
    document.getElementById('ganttbox').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
}

const gantt = createGantt(document.getElementById('gantt'), document.getElementById('tip'), { onSelect: k => select(k) });
const total = createTotal(document.getElementById('total'), document.getElementById('total-read'), {
  onSelect: k => { if (byKey[k].gone && !S.gone) S.gone = true; select(k); render(); gantt.focus(k); },
});

let list = [];
function render() {
  list = visible(S);
  if (S.sel && !list.some(c => c.key === S.sel)) S.sel = list.length ? list[0].key : null;
  gantt.update(list, S.sel);
  syncFilters(S, list);
  renderDetail(S.sel ? byKey[S.sel] : null, list, (k, focus) => { select(k); if (focus) gantt.focus(k); });
  const sub = { age: 'Sorted by time waiting', value: 'Sorted by dollar value', new: 'Most recent notification first' }[S.sort];
  document.getElementById('gantt-sub').textContent = `${sub}. Open circle = reported expected completion. Dot at left: filled = notification verified against the official record.`;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
  document.getElementById('total-title').textContent = S.view === 'vintage' ? 'Today\'s backlog by notification date' : 'Backlog total, as published each month';
  document.getElementById('total-sub').textContent = S.view === 'vintage'
    ? 'Open cases stacked when Congress was notified. Cases already delivered are not shown, so earlier years look smaller than the backlog was at the time.'
    : 'Monthly total as published: the Cato Institute\'s updates in 2024, TSM\'s since January 2025. Select a label to open that case. Hover or use arrow keys to read a month.';
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
// Export: both charts as PNG; the case list and the monthly total as CSV
const NOTE = 'Data: TSM Taiwan Arms Sales Backlog tracker (monthly updates and dataset), as of Aug. 31, 2026';
addExportBar(document.getElementById('ganttbox'), { where: 'after', target: () => document.getElementById('gantt'), note: NOTE,
  title: 'U.S. arms sales to Taiwan: open cases from notification to delivery',
  csv: () => [['case', 'category', 'value_usd_m', 'notified', 'state', 'years_waiting', 'partial_delivery', 'status', 'official_link'],
    ...visible(S).map(c => [c.name, c.cat, c.m, c.notified, c.state, c.age.toFixed(2), c.partial ? 'yes' : 'no', c.status, c.link])] });
addExportBar(document.getElementById('totalbox'), { target: () => document.getElementById('total'), note: NOTE,
  title: () => document.getElementById('total-title').textContent,
  csv: () => [['month', 'backlog_usd_m', 'source'], ...TOPLINE.map(t => [t.mo, t.m, t.src || ''])] });

render();
renderNotes();
// Month by month (top of the page): TSM's Figure 1 and Table 1 for each monthly update.
mv = createMonthView(S, {
  save: () => writeHash(S),
  showInTimeline: k => {
    if (byKey[k].gone && !S.gone) S.gone = true;
    if (!byKey[k].gone && !S.cats.has(byKey[k].cat)) S.cats.add(byKey[k].cat);
    S.status = 'all';
    S.sel = k;
    render();
    // after the timeline's ResizeObserver redraw, which replaces the rows
    requestAnimationFrame(() => requestAnimationFrame(() => gantt.focus(k)));
  },
});

// A pasted or edited hash (or back/forward) redraws everything from it; writeHash uses replaceState, so no loop.
addEventListener('hashchange', () => {
  Object.assign(S, DEFAULTS());
  readHash(S);
  render();
  mv.render(false);
});
