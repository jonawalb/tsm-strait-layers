// Japan Arms Sales Backlog: state, wiring and headline numbers.
import { CATS, byKey, visible, summary, fmtB, fmtAge, fmtD, AS_OF, LEFT } from './model.js';
import { REGISTER, EXCLUDED, UNRESOLVED } from '../data/cases.js';
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

const DEFAULTS = () => ({ cats: new Set(CATS), status: 'all', sort: 'age', gone: false, sel: 'f35', view: 'vintage', month: LATEST, wedge: null });
const S = DEFAULTS();
readHash(S);
let mv = null;

const sm = summary();
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function headline() {
  document.querySelectorAll('[data-asof]').forEach(n => { n.textContent = fmtD(AS_OF); });
  countUp(document.getElementById('big-total'), sm.total / 1000, { from: 0, ms: 750, fmt: n => `$${n.toFixed(2)}B` });
  const sub = CATS.map(k => `${k} ${fmtB(sm.byCat[k])} (${sm.nCat[k]})`).join(' · ');
  document.getElementById('big-sub').textContent = `${sm.n} open cases notified to Congress since 2013. ${sub}. Full notified value counts until final delivery.`;
  const o = sm.oldest, b = sm.biggest;
  const fleet = REGISTER['F-35A'] + REGISTER['F-35B'];
  document.getElementById('tiles').innerHTML = `
    <div><dt>One case, ${Math.round(b.m / sm.total * 100)}%</dt><dd class="num">${fmtB(b.m)}</dd>
      <small>${b.name}, notified ${fmtD(b.notified)}. ${fleet} of the 147 F-35s Japan plans to buy were in service on ${fmtD(REGISTER.as_of)}. <button type="button" data-go="biggest">Show</button></small></div>
    <div><dt>Deliveries under way</dt><dd class="num">${fmtB(sm.delivM)}</dd>
      <small>${sm.delivN} cases partly delivered, counted at full value. <button type="button" data-go="delivering">Show them</button></small></div>
    <div><dt>Longest wait</dt><dd>${fmtAge(o.age)}</dd>
      <small>Notified ${fmtD(o.notified)}: ${o.name}${o.expect ? `, work due by ${fmtD(o.expect.d)}` : ''}. <button type="button" data-go="oldest">Show</button></small></div>
    <div><dt>Excluded</dt><dd>${EXCLUDED.length} cases</dd>
      <small>Delivered, assumed delivered, excluded on age or assumed used up; ${UNRESOLVED.length} questions open.${LEFT.length ? ` ${LEFT.length} left since March 2026.` : ''} <button type="button" data-go="excluded">Show</button></small></div>`;
  document.querySelectorAll('#tiles [data-go]').forEach(btn => btn.onclick = () => {
    const g = btn.dataset.go;
    if (g === 'excluded') { document.getElementById('excluded').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); return; }
    if (g === 'biggest') apply({ cats: CATS, status: 'all', sort: 'value', sel: b.key });
    if (g === 'delivering') apply({ cats: CATS, status: 'delivering', sel: 'f35' });
    if (g === 'oldest') apply({ cats: CATS, status: 'all', sort: 'age', sel: o.key });
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
  document.getElementById('gantt-sub').textContent = `${sub}. Open circle = reported expected completion. Dot at left: filled = high confidence in the case's status, hollow = medium.`;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
  document.getElementById('total-title').textContent = S.view === 'months'
    ? 'Backlog total in each monthly tracker record'
    : 'Notified value of today\'s open cases, by notification date';
  document.getElementById('total-sub').textContent = S.view === 'months'
    ? 'The tracker\'s own monthly totals, from its first record in March 2026 (March to June built retrospectively from dated sources). No monthly Japan backlog total was published before then, so none is drawn.'
    : 'Not a history of the backlog. Each open case is stacked at its notification date at today\'s value (amended cases include later amendments). Delivered cases are left out, so earlier years look smaller than the backlog was at the time.';
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

// The "left the backlog" toggle only exists once a case has left (none so far).
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
const NOTE = `Data: TSM Japan arms sales backlog tracker, as of ${fmtD(AS_OF)}`;
addExportBar(document.getElementById('ganttbox'), { where: 'after', target: () => document.getElementById('gantt'), note: NOTE,
  title: 'U.S. arms sales to Japan: open cases from notification to delivery' });
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
