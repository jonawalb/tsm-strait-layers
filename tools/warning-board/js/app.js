// Indicators & Warning Board: set indicators, read the domain gauges and the analyst's judgment.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { INDICATORS, PRESETS } from '../data/indicators.js';
import { SOURCES, EXERCISES } from '../data/sources.js';
import { exerciseFor, exerciseLink, linkHtml } from '../../../shared/js/links.js';
import { addExportBar } from '../../../shared/js/export.js';
import { assess, TIMING } from './model.js';
import { analystText } from './narrative.js';
import { drawGauges, drawBand, drawBoard, detailHtml, drawExercises } from './board.js';
import { createTour } from './tour.js';
import * as fx from './fx.js';
import { widths } from './fxbars.js';
import { flash, reduced } from '../../../shared/js/motion.js';

// Gauge arcs are rebuilt on every render; sweep each from its previous score (0 on first render) to the new one.
// Same arc as board.js drawGauges; the sweep always ends on the exact path the board drew.
const gaugeArc = f => { const t = Math.PI * (1 - f); return `M12 62A48 48 0 0 1 ${(60 + 48 * Math.cos(t)).toFixed(2)} ${(62 - 48 * Math.sin(t)).toFixed(2)}`; };
let gaugePrev = null;
function sweepGauges(a) {
  const prev = gaugePrev;
  gaugePrev = a.domains.map(d => d.score);
  if (!fx.ON || reduced()) return;
  [...$('gauges').querySelectorAll('.gauge')].forEach((g, i) => {
    const path = g.querySelector('.g-fg'), to = a.domains[i]?.score, from = prev ? prev[i] : 0;
    if (!path || to == null || from === to) return;
    const final = path.getAttribute('d'), f0 = Math.min(0.999, from), f1 = Math.min(0.999, to), t0 = performance.now();
    let last = gaugeArc(f0); path.setAttribute('d', last);
    const step = t => {
      if (!path.isConnected || path.getAttribute('d') !== last) return;
      const u = Math.min(1, (t - t0) / 520), e = 1 - Math.pow(1 - u, 3);
      last = u < 1 ? gaugeArc(f0 + (f1 - f0) * e) : final;
      path.setAttribute('d', last);
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

const $ = id => document.getElementById(id);
const S = { states: {}, timing: 'days', preset: 'exercise', selected: null, hx: false };

const fromPreset = k => ({ ...PRESETS[k].set });
const same = (a, b) => INDICATORS.every(i => (a[i.id] || 0) === (b[i.id] || 0));
function matchPreset() {
  return Object.keys(PRESETS).find(k => same(S.states, PRESETS[k].set)) || (INDICATORS.every(i => !S.states[i.id]) ? 'clear' : 'custom');
}

// ------------------------------------------------------------ hash: #s=<one digit per indicator>&t=d|w|m
const TCODE = { days: 'd', weeks: 'w', months: 'm' };
function writeHash() {
  const s = INDICATORS.map(i => S.states[i.id] || 0).join('');
  const q = new URLSearchParams({ s, t: TCODE[S.timing] });
  if (S.selected) q.set('i', S.selected);
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const s = q.get('s');
  if (s && /^[0-2]+$/.test(s) && s.length === INDICATORS.length) {
    S.states = {};
    INDICATORS.forEach((i, k) => { if (+s[k]) S.states[i.id] = +s[k]; });
  } else {
    S.states = fromPreset('exercise');
  }
  const t = Object.keys(TCODE).find(k => TCODE[k] === q.get('t'));
  if (t) S.timing = t;
  const i = q.get('i');
  S.selected = INDICATORS.some(x => x.id === i) ? i : null;
}

// ------------------------------------------------------------ render
function render() {
  const a = assess(S.states, S.timing);
  S.preset = matchPreset();
  drawGauges($('gauges'), a);
  sweepGauges(a);
  fx.count($('gauges'), '.g-val');
  drawBand($('band'), a);
  fx.count($('band'), '.ov-h .num');
  widths($('band'), '.ov-bar i');
  drawBoard($('board'), S.states, S.selected, S.hx);
  fx.stagger($('board'), '.ind');
  $('status').dataset.s = a.band.s;
  $('status').innerHTML = `<b>${esc(a.band.name)}</b><span>${a.lit} of ${INDICATORS.length} indicators lit (${a.observed} observed) · signals built over ${TIMING[S.timing].name.toLowerCase()}</span>`;
  $('msum').innerHTML = `<span class="ms-dot" data-s="${a.band.s}"></span><b>${esc(a.band.name)}</b><span>${a.lit} lit · hard-to-fake ${Math.round(a.Dt * 100)}</span><a href="#status">Read the assessment</a>`;
  fx.changed($('status'));
  $('analyst').innerHTML = analystText(a, S.states, S.timing);
  fx.changed($('analyst'));
  $('readout').innerHTML = `
    <dt>Overall signal</dt><dd>${Math.round(a.S * 100)} / 100</dd>
    <dt>Hard-to-fake signal</dt><dd>${Math.round(a.Dt * 100)} / 100</dd>
    <dt>Domains above line</dt><dd>${a.breadth} of 5</dd>`;
  fx.changed($('readout'));
  document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === S.preset));
  document.querySelectorAll('#timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === S.timing));
  $('preset-note').textContent = PRESETS[S.preset]?.note || (S.preset === 'custom' ? 'Your own combination. Share it with the link below.' : 'Nothing set.');
  const sel = INDICATORS.find(i => i.id === S.selected);
  $('detail').innerHTML = detailHtml(sel, SOURCES);
  writeHash();
}

function setState(id, v) {
  if (v) S.states[id] = v; else delete S.states[id];
  S.selected = id;
  render();
  flash(document.querySelector(`.ind[data-id="${id}"]`));
  document.querySelector(`[data-set="${id}"][data-v="${v}"]`)?.focus();
}

// ------------------------------------------------------------ events
$('board').addEventListener('click', e => {
  const b = e.target.closest('[data-set]');
  if (b) return setState(b.dataset.set, Number(b.dataset.v));
  const n = e.target.closest('[data-info]');
  if (n) {
    S.selected = S.selected === n.dataset.info ? null : n.dataset.info;
    render();
    document.querySelector(`[data-info="${n.dataset.info}"]`)?.focus();
    if (S.selected && window.matchMedia('(max-width: 1020px)').matches) $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
// Arrow keys move within a radio group
$('board').addEventListener('keydown', e => {
  const b = e.target.closest('[data-set]');
  if (!b || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const v = Math.max(0, Math.min(2, Number(b.dataset.v) + (e.key === 'ArrowRight' ? 1 : -1)));
  setState(b.dataset.set, v);
});
$('presets').addEventListener('click', e => {
  const b = e.target.closest('[data-p]');
  if (!b) return;
  S.states = b.dataset.p === 'clear' ? {} : fromPreset(b.dataset.p);
  if (b.dataset.p === 'preconflict' && S.timing === 'days') S.timing = 'weeks';
  render();
});
$('timing').addEventListener('click', e => {
  const b = e.target.closest('[data-t]');
  if (b) { S.timing = b.dataset.t; render(); }
});
$('hx').addEventListener('change', e => { S.hx = e.target.checked; render(); });
$('copy').addEventListener('click', async () => {
  writeHash();
  try { await navigator.clipboard.writeText(location.href); $('copy').textContent = 'Link copied'; }
  catch { $('copy').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy').textContent = 'Copy link to this board'; }, 1800);
});

const tour = createTour((set, focus) => {
  document.querySelectorAll('.focus-ring').forEach(n => n.classList.remove('focus-ring'));
  if (!set) return;
  S.states = fromPreset(set.preset);
  S.timing = set.timing;
  S.selected = null;
  render();
  if (focus === 'overlap') document.querySelector('.overlap')?.classList.add('focus-ring');
  if (focus === 'exercises') { $('exercises-box').classList.add('focus-ring'); $('exercises-box').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else window.scrollTo({ top: $('main').offsetTop - 10, behavior: 'smooth' });
});
$('start-tour').addEventListener('click', () => tour.start());

// ------------------------------------------------------------ static sections
$('srclist').innerHTML = Object.entries(SOURCES).map(([, s]) =>
  `<li>${esc(s.cite)} ${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">Link</a>` : '<i>(not online)</i>'}</li>`).join('');
fx.chart($('exercises'), 'ex', () => drawExercises($('exercises'), EXERCISES));
$('ex-links').innerHTML = EXERCISES.map(e => { const x = exerciseFor(e.start); return x ? linkHtml(exerciseLink(x.id, e.start), e.name) : ''; }).join('');
addExportBar($('exercises-box'), { target: () => $('exercises'), title: 'Announced or reported length of major PLA exercises around Taiwan, 2022–2025', note: "Dates: TSM exercise-event list (Exercises as Theater), sources linked in the tool" });
$('ind-count').textContent = INDICATORS.length;

readHash();
render();
