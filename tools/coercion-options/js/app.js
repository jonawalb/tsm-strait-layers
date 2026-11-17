// Quarantine, Blockade, Invasion: compare Beijing's coercive options under user-set assumptions.
import { escapeHtml as esc, listText } from '../../../shared/js/mapkit.js';
import { OPTIONS, AXES } from '../data/options.js';
import { addExportBar, tableRows } from '../../../shared/js/export.js';
import { scoresFor, changes, DEFAULTS, US_POSTURE } from './model.js';
import { drawRadar, drawBars, OPT_COLOR } from './charts.js';
import { initMap, drawFootprint } from './map.js';
import { drawMatrix, drawCard, drawSources } from './matrix.js';

const $ = id => document.getElementById(id);
const S = { sel: 'quarantine', A: { ...DEFAULTS }, axis: 'usinv', showAll: true, row: null };
const BASE = scoresFor(DEFAULTS);

// ------------------------------------------------------------ hash
function writeHash() {
  const q = new URLSearchParams({ o: S.sel, us: S.A.us, jp: +S.A.jp, g7: +S.A.g7, ei: S.A.ei, ax: S.axis });
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (OPTIONS.some(o => o.id === q.get('o'))) S.sel = q.get('o');
  const us = Number(q.get('us'));
  if (q.has('us') && [-1, 0, 1].includes(us)) S.A.us = us;
  if (q.has('jp')) S.A.jp = q.get('jp') === '1';
  if (q.has('g7')) S.A.g7 = q.get('g7') === '1';
  const ei = Number(q.get('ei'));
  if (q.has('ei') && ei >= 0 && ei <= 100) S.A.ei = Math.round(ei);
  if (AXES.some(a => a.id === q.get('ax'))) S.axis = q.get('ax');
}

// ------------------------------------------------------------ controls
function buildControls() {
  $('spectrum').innerHTML = OPTIONS.map((o, i) => `<button type="button" data-opt="${o.id}" style="--oc:${OPT_COLOR[o.id]}">
    <span class="step">${i + 1}</span><b>${esc(o.short)}</b><small>${esc(o.tag)}</small></button>`).join('');
  $('us').innerHTML = US_POSTURE.map(p => `<button type="button" data-us="${p.v}" title="${esc(p.help)}">${p.name}</button>`).join('');
  $('rowf').innerHTML = `<button type="button" data-row="">All rows</button>` +
    ['legal', 'warning', 'us', 'costs'].map(r => `<button type="button" data-row="${r}">${{ legal: 'Legal framing', warning: 'Warning signs', us: 'U.S. triggers', costs: 'Costs to the PRC' }[r]}</button>`).join('');
}

// ------------------------------------------------------------ render
function render() {
  const sc = scoresFor(S.A);
  const o = OPTIONS.find(x => x.id === S.sel);
  document.querySelectorAll('#spectrum [data-opt]').forEach(b => b.setAttribute('aria-pressed', b.dataset.opt === S.sel));
  document.querySelectorAll('#us [data-us]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.us) === S.A.us));
  document.querySelectorAll('#rowf [data-row]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.row || null) === S.row));
  $('jp').checked = S.A.jp; $('g7').checked = S.A.g7; $('ei').value = S.A.ei;
  $('ei-out').textContent = S.A.ei < 34 ? 'Low' : S.A.ei > 66 ? 'High' : 'Medium';
  $('us-help').textContent = US_POSTURE.find(p => p.v === S.A.us).help;
  drawFootprint(S.sel);
  document.querySelector('.lsw.sel').style.borderTopColor = OPT_COLOR[S.sel];
  $('map-cap').innerHTML = `<b style="color:${OPT_COLOR[S.sel]}">${esc(o.name)}</b>: ${esc(FOOT[S.sel])}`;
  drawRadar($('radar'), { scores: sc, base: BASE, sel: S.sel, showAll: S.showAll, axis: S.axis, onAxis: a => { S.axis = a; render(); } });
  drawBars($('bars'), { scores: sc, base: BASE, sel: S.sel, axis: S.axis, onPick: id => { S.sel = id; render(); } });
  $('bars-h').textContent = `All five options on: ${AXES.find(a => a.id === S.axis).name}`;
  drawCard($('optcard'), S.sel);
  drawMatrix($('matrix'), S.sel, S.row);
  const ch = changes(S.sel, sc, BASE);
  const isDefault = S.A.us === 0 && !S.A.jp && !S.A.g7 && S.A.ei === 50;
  $('moved').innerHTML = isDefault
    ? 'These are the baseline assumptions. Change U.S. posture, allied participation or interdependence to see the scores move. The dashed outline on the radar keeps the baseline.'
    : ch.length ? `For ${esc(o.short.toLowerCase())}: ${esc(listText(ch.slice(0, 3)))} compared with the baseline.` : `These assumptions barely move ${esc(o.short.toLowerCase())}.`;
  $('readout').innerHTML = AXES.map(a => {
    const d = sc[S.sel][a.id] - BASE[S.sel][a.id];
    return `<dt>${a.short}</dt><dd>${sc[S.sel][a.id].toFixed(1)}${Math.abs(d) >= 0.05 ? ` <small>${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}</small>` : ''}</dd>`;
  }).join('');
  writeHash();
}

const FOOT = {
  gray: 'patrols and boardings around outlying islands and air activity across the ADIZ. Schematic.',
  quarantine: 'a declaration line around Taiwan and inspection zones off major ports and Kinmen. Schematic, after the CSIS scenarios and the coast guard\'s "Kinmen model" of inspections.',
  blockade: 'a closure band and zones encircling Taiwan, in the pattern of recent PLA drills. Schematic, not real exercise boxes.',
  seizure: 'isolated moves against small Taiwan-held islands. Schematic.',
  invasion: 'blockade plus crossing axes toward Taiwan\'s west coast. Schematic, no landing sites implied.',
};

// ------------------------------------------------------------ events
document.addEventListener('click', e => {
  const opt = e.target.closest('[data-opt]');
  if (opt) { S.sel = opt.dataset.opt; return render(); }
  const us = e.target.closest('[data-us]');
  if (us) { S.A.us = Number(us.dataset.us); return render(); }
  const row = e.target.closest('[data-row]');
  if (row) { S.row = row.dataset.row || null; return render(); }
});
$('jp').addEventListener('change', e => { S.A.jp = e.target.checked; render(); });
$('g7').addEventListener('change', e => { S.A.g7 = e.target.checked; render(); });
$('ei').addEventListener('input', e => { S.A.ei = Number(e.target.value); render(); });
$('all').addEventListener('change', e => { S.showAll = e.target.checked; render(); });
$('reset').addEventListener('click', () => { S.A = { ...DEFAULTS }; render(); });
$('copy').addEventListener('click', async () => {
  writeHash();
  try { await navigator.clipboard.writeText(location.href); $('copy').textContent = 'Link copied'; }
  catch { $('copy').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy').textContent = 'Copy link to this view'; }, 1800);
});
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[1-5]$/.test(e.key)) { S.sel = OPTIONS[Number(e.key) - 1].id; render(); }
});

buildControls();
initMap($('map'));
drawSources($('srclist'));
readHash();
render();

// ---- export ----
const optName = () => { const o = OPTIONS.find(x => x.id === S.sel); return o.name || o.label || o.id; };
addExportBar(document.querySelector('.mapcol'), {
  target: () => $('map'), title: () => `${optName()}: schematic footprint around Taiwan`,
  note: 'Schematic illustration of a hypothetical option, not a forecast or a real deployment',
});
addExportBar(document.querySelector('.chartcol'), {
  target: () => $('bars'), title: () => `${$('bars-h').textContent} (notional scores)`,
  note: 'Notional TSM teaching scores, not measurements',
});
addExportBar(document.querySelector('.mx-h'), { csv: () => tableRows($('matrix').querySelector('table')), csvLabel: 'Copy table as CSV' });

