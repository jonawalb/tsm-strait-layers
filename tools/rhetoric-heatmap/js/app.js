// PRC Rhetoric Heatmap: state, controls, URL hash and rendering.
import { TSM } from '../../../shared/data/tsm.js';
import { THEMES } from '../data/themes.js';
import { EVENTS } from '../data/events.js';
import { SOURCES, RANGES, SOURCE_NAMES, parseRows, aggregate, phraseMatcher, weekOf, weekStart } from './model.js';
import { createGrid } from './grid.js';
import { renderDetail } from './detail.js';
import { createTour } from './tour.js';
import { renderRules } from './rules.js';
import { renderProfile } from './profile.js';
import { addExportBar } from '../../../shared/js/export.js';
import { chart, wipe, fade, grow, rise, count, onChange, ring } from './fx.js';

const $ = id => document.getElementById(id);
const S = { rangeKey: 'all', range: RANGES.all, metric: 'count', sources: [...SOURCES], phrase: '', matcher: null,
  sel: { row: 9, w: weekOf('2022-08-01') } };
let recs = [], agg = null;
const JCRP = TSM.daily.filter(d => String(d[5] ?? '').includes('J')).map(d => d[0]);

// ---- URL hash -------------------------------------------------------------
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (RANGES[q.get('r')]) { S.rangeKey = q.get('r'); S.range = RANGES[S.rangeKey]; }
  if (['count', 'share'].includes(q.get('m'))) S.metric = q.get('m');
  if (q.has('s')) { const s = q.get('s').split(',').filter(x => SOURCES.includes(x)); if (s.length) S.sources = s; }
  if (q.has('q')) { S.phrase = q.get('q').slice(0, 60); S.sel = null; }
  const c = (q.get('c') || '').split('@');
  if (c.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(c[1])) {
    const row = c[0] === 'phrase' ? THEMES.length : THEMES.findIndex(t => t.id === c[0]);
    if (row >= 0) S.sel = { row, w: weekOf(c[1]) };
  }
}
function writeHash() {
  const q = new URLSearchParams({ r: S.rangeKey, m: S.metric, s: S.sources.join(',') });
  if (S.phrase) q.set('q', S.phrase);
  if (S.sel) q.set('c', `${S.sel.row === THEMES.length ? 'phrase' : THEMES[S.sel.row].id}@${weekStart(S.sel.w)}`);
  history.replaceState(null, '', '#' + q.toString());
}

// ---- Controls --------------------------------------------------------------
function mountControls() {
  $('ranges').innerHTML = Object.entries(RANGES).map(([k, r]) => `<button type="button" data-r="${k}">${r.label}</button>`).join('');
  $('ranges').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) apply({ rangeKey: b.dataset.r }); });
  $('metric').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) apply({ metric: b.dataset.m }); });
  $('sources').innerHTML = SOURCES.map(s => `<label class="tg"><input type="checkbox" value="${s}"><span class="sw"></span>
    <span class="t"><span class="pill src-${s}">${s}</span> ${SOURCE_NAMES[s]}<small id="n-${s}"></small></span></label>`).join('');
  $('sources').addEventListener('change', () => {
    const on = [...$('sources').querySelectorAll('input:checked')].map(i => i.value);
    if (!on.length) { $('sources').querySelector(`input[value="${S.sources[0]}"]`).checked = true; return; }
    apply({ sources: on });
  });
  let t;
  $('phrase').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => apply({ phrase: $('phrase').value }), 220); });
  $('phrase-form').addEventListener('submit', e => { e.preventDefault(); apply({ phrase: $('phrase').value }); });
  $('clear-phrase').addEventListener('click', () => apply({ phrase: '' }));
  $('examples').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) apply({ phrase: b.dataset.q }); });
  $('copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; } catch { $('copy-link').textContent = 'Copy from the address bar'; }
    setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
  });
}

function syncControls() {
  $('ranges').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.r === S.rangeKey));
  $('metric').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === S.metric));
  $('sources').querySelectorAll('input').forEach(i => { i.checked = S.sources.includes(i.value); });
  if ($('phrase').value !== S.phrase && document.activeElement !== $('phrase')) $('phrase').value = S.phrase;
  $('clear-phrase').hidden = !S.phrase;
}

// ---- Apply a state patch and redraw ---------------------------------------
function apply(patch = {}) {
  if (patch.rangeKey) { S.rangeKey = patch.rangeKey; S.range = RANGES[patch.rangeKey]; }
  if (patch.metric) S.metric = patch.metric;
  if (patch.sources) S.sources = patch.sources;
  if ('phrase' in patch) {
    S.phrase = patch.phrase.trim().slice(0, 60);
    if (!patch.sel) S.sel = null;
  }
  if ('sel' in patch) S.sel = patch.sel;
  render();
}

function render() {
  S.matcher = phraseMatcher(S.phrase);
  if (S.sel?.row === THEMES.length && !S.matcher) S.sel = null;
  agg = aggregate(recs, { sources: S.sources, matcher: S.matcher });
  const wa = Math.max(0, weekOf(S.range.from)), wb = weekOf(S.range.to);
  if (S.sel && (S.sel.w < wa || S.sel.w > wb)) {
    // Keep the row, move to its busiest week inside the new range.
    let best = null;
    for (let w = wa; w <= wb; w++) { const n = agg.cells[S.sel.row][w].length; if (n && (!best || n > best.n)) best = { w, n }; }
    S.sel = best ? { row: S.sel.row, w: best.w } : null;
  }
  if (S.matcher && !S.sel) {
    // Select the busiest week for the phrase within the range.
    let best = null;
    for (let w = Math.max(0, weekOf(S.range.from)); w <= weekOf(S.range.to); w++) {
      const n = agg.cells[THEMES.length][w].length;
      if (n && (!best || n > best.n)) best = { w, n };
    }
    if (best) S.sel = { row: THEMES.length, w: best.w };
  }
  syncControls();
  const { max } = grid.render(S, agg, JCRP);
  $('legend-max').textContent = S.metric === 'share' ? '100%' : `${max} statements`;
  $('legend-note').textContent = S.metric === 'share' ? 'Share of the week\'s Taiwan-related statements with English text' : 'Statements per week (square-root scale)';
  const inRange = recs.filter(r => r.d >= S.range.from && r.d <= S.range.to);
  SOURCES.forEach(s => { $('n-' + s).textContent = `${inRange.filter(r => r.s === s).length.toLocaleString()} statements in range`; });
  $('phrase-count').textContent = S.matcher
    ? `${agg.nMatch.toLocaleString()} statement${agg.nMatch === 1 ? '' : 's'} contain “${S.matcher.phrase}” (${S.matcher.zh ? 'searched in Chinese text, which TSM holds only for 2026 items' : 'searched in the English answers'}).`
    : `${recs.length.toLocaleString()} Taiwan-related statements, July 2022 to October 2026.`;
  renderDetail($('detail'), S, agg, recs);
  renderProfile($('profile'), S, agg, recs);
  animate();
  writeHash();
}

// Motion (see fx.js). Runs after each render and never changes what was drawn.
function animate() {
  const svg = $('hm-svg');
  const view = [S.rangeKey, S.metric, S.sources.join('.'), S.phrase].join('|');
  onChange('view', view, () => {
    chart(svg, first => {
      wipe(svg.querySelector('.cells'), { first });
      fade(svg.querySelectorAll('.ev-band, .ev-label, .ev-stem'), { first, delay: first ? 250 : 100, max: 40 });
    }, { gap: 0 });
    chart($('profile'), first => grow($('profile').querySelectorAll('.pf-bar'), { first, axis: 'x', stagger: first ? 320 : 140 }), { gap: 0 });
  });
  count($('legend-max'));
  SOURCES.forEach(s => count($('n-' + s)));
  selMotion();
}
function selMotion() {
  onChange('sel', S.sel ? S.sel.row + '@' + S.sel.w : null, first => {
    if (first || !S.sel) return;
    const r = $('hm-svg').querySelector('.sel');
    if (r) ring($('hm-svg'), +r.getAttribute('x') + +r.getAttribute('width') / 2, +r.getAttribute('y') + +r.getAttribute('height') / 2, { r: 22 });
    rise($('detail').children, { stagger: 35, max: 12 });
  });
}

const grid = createGrid({
  labelSvg: $('hm-labels'), svg: $('hm-svg'), scroller: $('hm-scroll'), tip: $('hm-tip'),
  onSelect: sel => { S.sel = sel; grid.drawSelection(); renderDetail($('detail'), S, agg, recs); selMotion(); writeHash(); },
});

// ---- Export ----------------------------------------------------------------
// The PNG joins the row-label SVG and the full (unscrolled) heatmap into one temporary SVG.
function combinedSvg() {
  const lab = $('hm-labels'), hm = $('hm-svg');
  const lw = +lab.getAttribute('width'), w = +hm.getAttribute('width'), h = +hm.getAttribute('height');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${lw + w} ${h}`);
  svg.setAttribute('width', lw + w); svg.setAttribute('height', h);
  svg.style.cssText = 'position:absolute;left:-99999px;top:0';
  const a = lab.cloneNode(true), b = hm.cloneNode(true);
  a.removeAttribute('id'); b.removeAttribute('id'); b.removeAttribute('tabindex');
  b.setAttribute('x', lw); b.querySelectorAll('.sel, .focus').forEach(n => n.remove());
  svg.append(a, b);
  document.querySelector('.hm').appendChild(svg);
  setTimeout(() => svg.remove(), 8000);
  return svg;
}
function csvRows() {
  const wa = Math.max(0, weekOf(S.range.from)), wb = weekOf(S.range.to);
  const rows = [['week_start', ...THEMES.map(t => t.label), ...(S.matcher ? [`phrase: ${S.matcher.phrase}`] : []), 'taiwan_statements_total']];
  for (let w = wa; w <= wb; w++) {
    rows.push([weekStart(w), ...THEMES.map((t, k) => agg.cells[k][w].length),
      ...(S.matcher ? [agg.cells[THEMES.length][w].length] : []), agg.total[w]]);
  }
  return rows;
}
function mountExport() {
  addExportBar(document.querySelector('.legend'), {
    target: combinedSvg,
    title: () => `PRC rhetoric on Taiwan by week, ${S.range.label}${S.phrase ? ` · “${S.phrase}”` : ''} (${S.sources.join(', ')}, ${S.metric === 'share' ? 'share of week' : 'statement count'})`,
    note: 'Data: TSM coded MFA, MND and TAO statements',
    csv: csvRows,
  });
}

// ---- Boot ------------------------------------------------------------------
async function boot() {
  readHash();
  mountControls();
  renderRules($('rules'), $('events-list'), EVENTS);
  const { STATEMENTS, STREAMS } = await import('../data/statements.js');
  recs = parseRows(STATEMENTS, STREAMS);
  document.body.classList.remove('loading');
  render();
  const G = grid.geometry();
  if (S.sel && G) $('hm-scroll').scrollLeft = Math.max(0, (S.sel.w - G.w0) * G.cw * ($('hm-svg').getBoundingClientRect().width / G.W) - 120);
  const tour = createTour($('stage'), patch => {
    apply({ phrase: '', ...patch });
    const g = grid.geometry();
    if (S.sel && g) $('hm-scroll').scrollLeft = Math.max(0, (S.sel.w - g.w0) * g.cw * ($('hm-svg').getBoundingClientRect().width / g.W) - 160);
  });
  $('start-tour').addEventListener('click', tour.start);
  mountExport();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
}
boot();
