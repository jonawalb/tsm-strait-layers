// Wargame Results Explorer: wiring for filters, matrix, driver bars, cards, findings, tour and URL hash.
import { GAMES, SCENARIOS, FORMATS } from '../data/games.js';
import { CASES, DIMS, OUTCOMES } from '../data/cases.js';
import { SOURCES } from '../data/sources.js';
import { fromHash, toHash, DEFAULT } from './state.js';
import { renderMatrix, renderDrivers, renderContrasts } from './matrix.js';
import { renderCards, renderFindings } from './cards.js';
import { createTour } from './tour.js';
import { esc, gameById, OUT_ORDER } from './util.js';
import * as fx from './fx.js';
import { widths } from './fxbars.js';
import { reduced } from '../../../shared/js/motion.js';

// First view: each row's outcome bar grows in from the left as it scrolls into view (no trace left in the DOM).
function growTallies(root) {
  if (!fx.ON || reduced() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    e.target.animate([{ transform: 'scaleX(0)', transformOrigin: '0 50%' }, { transform: 'scaleX(1)', transformOrigin: '0 50%' }],
      { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  }), { threshold: 0.1 });
  root.querySelectorAll('.tbar').forEach(b => io.observe(b));
}
// When a filter changes which rows or studies are shown, fade the new set in instead of jumping.
const shown = new WeakMap();
function settle(el, key) {
  const prev = shown.get(el);
  shown.set(el, key);
  if (prev == null || prev === key || !fx.ON || reduced()) return;
  el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
}
let firstRender = true;

const $ = id => document.getElementById(id);
let st = fromHash();

function visibleCases() {
  return CASES.filter(r => {
    const g = gameById(r.game);
    const tags = r.tags || [r.scen];
    if (st.scen.length && !tags.some(t => st.scen.includes(t))) return false;
    if (st.fmt.length && !st.fmt.includes(g.format)) return false;
    if (st.japan !== 'any' && r.japan !== st.japan) return false;
    if (st.us !== 'any' && r.us !== st.us) return false;
    return true;
  });
}

/** Build a button group. multi=true toggles values in a list; otherwise picks one. */
function choices(el, opts, get, set, multi) {
  el.innerHTML = Object.entries(opts).map(([k, v]) => `<button type="button" data-v="${k}">${esc(v)}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    const v = b.dataset.v, cur = get();
    set(multi ? (cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]) : v);
  });
  return () => el.querySelectorAll('button').forEach(b => {
    const cur = get();
    b.setAttribute('aria-pressed', String(multi ? cur.includes(b.dataset.v) : cur === b.dataset.v));
  });
}

const syncers = [];
function update(patch, opts = {}) {
  st = { ...st, ...patch };
  const h = toHash(st);
  if (h !== location.hash && !(h === '' && location.hash === '')) history.replaceState(null, '', h || location.pathname + location.search);
  render(opts);
}

const handlers = {
  group: g => update({ group: g }),
  open: (id, scroll = true) => {
    update({ open: id });
    if (id && scroll) {
      const el = $('g-' + id);
      if (el) { el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); el.focus({ preventScroll: true }); }
    }
  },
};

function renderReadout(rows, games) {
  const runs = rows.reduce((a, r) => a + r.n, 0);
  const t = {};
  rows.forEach(r => OUT_ORDER.forEach(k => { if (r.tally[k]) t[k] = (t[k] || 0) + r.tally[k]; }));
  $('readout').innerHTML = `<dt>Studies</dt><dd>${games.length}</dd><dt>Scenario rows</dt><dd>${rows.length}</dd><dt>Runs</dt><dd>${runs}</dd>`;
  $('otally').innerHTML = OUT_ORDER.filter(k => t[k]).map(k =>
    `<li><i class="sw o-${k}" aria-hidden="true"></i>${esc(OUTCOMES[k].label)}<b class="num">${t[k]}</b></li>`).join('') || '<li>None</li>';
}

function render() {
  const rows = visibleCases();
  const ids = new Set(rows.map(r => r.game));
  const games = GAMES.filter(g => ids.has(g.id));
  syncers.forEach(f => f());
  renderMatrix($('matrix'), rows, st, handlers);
  settle($('matrix'), rows.map(r => r.id).join() + '|' + st.group);
  fx.stagger($('matrix'), 'tr.row');
  if (firstRender) growTallies($('matrix'));
  renderDrivers($('drivers'), rows, st);
  widths($('drivers'), '.dbar i', e => `${st.group}|${e.closest('.drow')?.querySelector('.dl b')?.textContent}|${e.className}`);
  renderContrasts($('contrasts'), st);
  settle($('contrasts'), st.group);
  renderCards($('cards'), games, st, handlers);
  settle($('cards'), games.map(g => g.id).join());
  fx.stagger($('cards'), '.gcard');
  renderFindings($('agree'), $('disagree'), games);
  fx.stagger($('agree'), 'li');
  fx.stagger($('disagree'), 'li');
  renderReadout(rows, games);
  fx.count($('readout'), 'dd');
  fx.count($('otally'), 'b.num');
  firstRender = false;
  $('dname').textContent = st.group !== 'none' ? DIMS[st.group].label : 'an assumption';
}

function setup() {
  syncers.push(choices($('f-scen'), SCENARIOS, () => st.scen, v => update({ scen: v }), true));
  syncers.push(choices($('f-fmt'), FORMATS, () => st.fmt, v => update({ fmt: v }), true));
  syncers.push(choices($('f-japan'), { any: 'Any', ...DIMS.japan.vals }, () => st.japan, v => update({ japan: v })));
  syncers.push(choices($('f-us'), { any: 'Any', ...DIMS.us.vals }, () => st.us, v => update({ us: v })));
  const gopts = { none: 'No grouping', ...Object.fromEntries(Object.entries(DIMS).map(([k, d]) => [k, d.label])) };
  syncers.push(choices($('f-group'), gopts, () => st.group, v => update({ group: v })));
  syncers.push(choices($('f-weight'), { runs: 'Count runs', cases: 'Count rows' }, () => st.weight, v => update({ weight: v })));

  $('reset').onclick = () => update({ ...DEFAULT, scen: [], fmt: [], focus: [] });
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); $('copy-msg').textContent = 'Link copied.'; }
    catch { $('copy-msg').textContent = 'Copy the address bar to share this view.'; }
  };
  window.addEventListener('hashchange', () => { st = { ...fromHash(), focus: st.focus }; render(); });

  const tour = createTour(document.body, (set, target) => {
    if (!set) { update({ focus: [] }); return; }
    update({ scen: [], fmt: [], japan: 'any', us: 'any', ...set });
    const el = target && $(target);
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  $('tour').onclick = () => tour.start();

  $('legend').innerHTML = OUT_ORDER.map(k => `<li><i class="sw o-${k}" aria-hidden="true"></i><span><b>${esc(OUTCOMES[k].label)}.</b> ${esc(OUTCOMES[k].rule)}</span></li>`).join('');
  const used = ['fb', 'ca', 'lo', 'ds', 'bb', 'ap', 'pf', 'spf', 'jfss', 'fbWeb', 'dsWeb', 'bbWeb', 'jfssWeb', 'rand'];
  $('srclist').innerHTML = used.map(k => `<li><a href="${esc(SOURCES[k].url)}" target="_blank" rel="noopener">${esc(SOURCES[k].label)}</a></li>`).join('');
}

setup();
render();
if (st.open) requestAnimationFrame(() => handlers.open(st.open));
