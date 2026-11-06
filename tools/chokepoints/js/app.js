// Chokepoint Dashboard: state, URL hash and wiring.
import { VOYAGES, PRESETS } from '../data/voyages.js';
import { CHOKEPOINTS } from '../data/chokepoints.js';
import { route } from './graph.js';
import { createMap, VIEWS } from './map.js';
import { buildPanel, renderResult, renderToggles, renderFacts } from './panel.js';
import { renderTable, factsCsv } from './table.js';
import { addExportBar } from '../../../shared/js/export.js';

const IDS = CHOKEPOINTS.map(c => c.id);
const S = { voyage: 'pg-sha', closed: new Set(), knots: 14, usd: 60000, focus: 'malacca' };

const q = new URLSearchParams(location.hash.slice(1));
if (VOYAGES.some(v => v.id === q.get('v'))) S.voyage = q.get('v');
if (q.has('c')) S.closed = new Set(q.get('c').split(',').filter(c => IDS.includes(c)));
const kn = +q.get('kn'); if (kn >= 8 && kn <= 22) S.knots = Math.round(kn);
const usd = +q.get('usd'); if (usd >= 20000 && usd <= 150000) S.usd = Math.round(usd / 5000) * 5000;

buildPanel(document.getElementById('panel'));
renderTable(document.getElementById('cp-table'));
addExportBar(document.querySelector('.stage > .mapbox'), {
  where: 'after', target: () => document.getElementById('cp-map'),
  title: () => {
    const v = VOYAGES.find(x => x.id === S.voyage);
    const shut = CHOKEPOINTS.filter(c => S.closed.has(c.id)).map(c => c.short);
    return `${v.name}: ${shut.length ? 'route with ' + shut.join(', ') + ' closed' : 'shortest route, all chokepoints open'}`;
  },
  note: 'Sea lanes hand-drawn and approximate; Natural Earth basemap',
});
addExportBar(document.querySelector('.cp-facts-t').closest('.tablewrap'), { where: 'after', csv: factsCsv, csvLabel: 'Copy fact sheet as CSV' });
const map = createMap(document.getElementById('cp-map'), document.getElementById('cp-tip'), {
  onToggle: id => { toggle(id); },
  onFocus: id => { if (S.focus !== id) { S.focus = id; renderFacts(id); renderToggles(S, last); } },
});

let last = null, lastKey = '';
function update({ fit = false } = {}) {
  const v = VOYAGES.find(x => x.id === S.voyage);
  const base = route(v.from, v.to);
  const cur = route(v.from, v.to, S.closed);
  last = cur;
  const twClosed = CHOKEPOINTS.some(c => c.tw && S.closed.has(c.id));
  map.draw({ cur, base, from: v.from, to: v.to, closed: S.closed, onRoute: cur ? cur.tags : [], focus: S.focus, twClosed });
  renderResult(S, cur, base);
  renderToggles(S, cur);
  const key = S.voyage + (cur ? cur.nodes.join() : '');
  if (fit || key !== lastKey) map.fit([...(cur || base).pts, ...base.pts]);
  lastKey = key;
  const h = new URLSearchParams({ v: S.voyage });
  if (S.closed.size) h.set('c', [...S.closed].join(','));
  if (S.knots !== 14) h.set('kn', S.knots);
  if (S.usd !== 60000) h.set('usd', S.usd);
  history.replaceState(null, '', '#' + h.toString());
}
function toggle(id) {
  S.closed.has(id) ? S.closed.delete(id) : S.closed.add(id);
  S.focus = id; renderFacts(id); update();
}

document.getElementById('cp-voyages').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]'); if (!b) return;
  S.voyage = b.dataset.v; update({ fit: true });
});
document.getElementById('cp-toggles').addEventListener('change', e => {
  if (e.target.matches('input[type=checkbox]')) toggle(e.target.value);
});
document.getElementById('cp-presets').addEventListener('click', e => {
  const b = e.target.closest('button[data-p]'); if (!b) return;
  const p = PRESETS.find(x => x.id === b.dataset.p);
  S.closed = new Set(p.closed);
  if (p.closed[0]) { S.focus = p.closed[0]; renderFacts(S.focus); }
  update();
});
document.getElementById('cp-kn').addEventListener('input', e => { S.knots = +e.target.value; update(); });
document.getElementById('cp-usd').addEventListener('input', e => { S.usd = +e.target.value; update(); });
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.view === 'fit') { lastKey = ''; update({ fit: true }); } else map.view(VIEWS[b.dataset.view]);
}));
document.getElementById('cp-copy').addEventListener('click', async () => {
  const b = document.getElementById('cp-copy');
  try { await navigator.clipboard.writeText(location.href); b.textContent = 'Link copied'; } catch { b.textContent = 'Copy the address bar'; }
  setTimeout(() => { b.textContent = 'Copy link'; }, 1800);
});

renderFacts(S.focus);
update({ fit: true });
