// Deterrence Lab: tab switching, shared state, URL hash, walkthrough.
import { A_DEFAULTS } from './models/crisis.js';
import { B_DEFAULTS } from './models/signal.js';
import { C_DEFAULTS } from './models/reputation.js';
import { mountA } from './viewA.js';
import { mountB } from './viewB.js';
import { mountC } from './viewC.js';
import { createTour } from './tour.js';
import { addExportBar } from '../../../shared/js/export.js';

const S = { m: 'A', A: { ...A_DEFAULTS }, B: { ...B_DEFAULTS }, C: { ...C_DEFAULTS } };
const KEYS = {
  A: { p: 'p', a: 'a', q: 'q', cL: 'cl', cH: 'ch', cR: 'cr' },
  B: { tech: 't', k: 's', p: 'p', vI: 'vi', c: 'c', P0: 'p0', H: 'h' },
  C: { N: 'n', p0: 'p0', b: 'b', a: 'a', weak: 'w', seed: 'r' },
};
const LIMITS = {
  A: { p: [0.01, 0.99], a: [0, 1.5], q: [0.1, 0.9], cL: [0, 0.89], cH: [0.11, 2], cR: [0, 1.5] },
  B: { k: [0, 2], p: [0.02, 0.98], vI: [0.05, 0.95], c: [0.1, 1], P0: [0, 0.6], H: [0.2, 5] },
  C: { N: [2, 25], p0: [0, 0.5], b: [0.1, 0.95], a: [1.05, 5], weak: [0, 1], seed: [0, 99991] },
};

function writeHash() {
  const q = new URLSearchParams({ m: S.m });
  for (const [k, short] of Object.entries(KEYS[S.m])) q.set(short, String(S[S.m][k]));
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const m = q.get('m');
  if (!['A', 'B', 'C'].includes(m)) return;
  S.m = m;
  for (const [k, short] of Object.entries(KEYS[m])) {
    if (!q.has(short)) continue;
    const raw = q.get(short);
    if (k === 'tech') { if (raw === 'sunk' || raw === 'tied') S.B.tech = raw; continue; }
    const v = Number(raw), lim = LIMITS[m][k];
    if (Number.isFinite(v) && lim) S[m][k] = Math.max(lim[0], Math.min(lim[1], (k === 'N' || k === 'weak' || k === 'seed') ? Math.round(v) : v));
  }
}

const stage = document.getElementById('stage'), panel = document.getElementById('panel');
const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
let view = null;
const MOUNT = { A: mountA, B: mountB, C: mountC };

function mount() {
  stage.innerHTML = ''; panel.innerHTML = '';
  document.body.dataset.mod = S.m;
  tabs.forEach(t => { const on = t.dataset.m === S.m; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  view = MOUNT[S.m](stage, panel, S, changed);
  view.render();
  addExports();
  writeHash();
}
/** A PNG button under each figure of the current model. */
function addExports() {
  const tab = tabs.find(t => t.dataset.m === S.m);
  const model = tab?.querySelector('b')?.textContent || '';
  stage.querySelectorAll('.card.fig').forEach(card => {
    const svg = card.querySelector('svg[id]');
    if (!svg) return;
    addExportBar(card, {
      target: () => svg,
      title: () => `Deterrence Lab${model ? ' · ' + model : ''}: ${card.querySelector('.eyebrow')?.textContent || ''}`,
      note: 'Formal teaching model (TSM Deterrence Lab); parameters as set in the tool link',
    });
  });
}
let raf = 0;
function changed() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { view.render(); writeHash(); });
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => { if (S.m !== t.dataset.m) { S.m = t.dataset.m; mount(); } });
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length];
    n.focus(); n.click();
  });
});

const tour = createTour(document.getElementById('tour-root'), set => {
  S.m = set.m;
  if (set[set.m]) Object.assign(S[set.m], set[set.m]);
  mount();
});
document.getElementById('start-tour').addEventListener('click', () => tour.start());
document.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', ev => {
  ev.preventDefault(); S.m = a.dataset.goto; mount(); document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

readHash();
mount();

// Render the method-section math once KaTeX has loaded (the scripts are deferred).
function renderMath() {
  if (!window.renderMathInElement) return false;
  document.querySelectorAll('.below').forEach(node => window.renderMathInElement(node, {
    delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false,
  }));
  view.render();
  return true;
}
if (!renderMath()) window.addEventListener('load', renderMath, { once: true });
