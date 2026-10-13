// Island Chains & Access: state, hash, wiring.
import { SITES, LAYERS } from '../data/sites.js';
import { MISSILES, LAUNCH } from '../data/pla.js';
import { createMap, BOXES } from './map.js';
import { buildPanel, renderPanel } from './panel.js';
import { createTour } from './tour.js';
import { renderTable, tableCsv } from './table.js';
import { addExportBar } from '../../../shared/js/export.js';
import { SITE, siteReach, sitesInRing } from './model.js';

const $ = id => document.getElementById(id);
const S = { mode: 'site', site: 'kadena', ring: { missile: 'df21d', launch: 'fujian' }, layers: new Set(LAYERS.map(l => l.id)), chains: true, measure: false, mpts: [] };

// Hash: #m=site&s=kadena  or  #m=ring&k=df26&l=fujian ; &hide=au,jp ; &chains=0
const q = new URLSearchParams(location.hash.slice(1));
if (q.get('m') === 'ring') S.mode = 'ring';
if (SITE[q.get('s')]) S.site = q.get('s');
if (MISSILES.some(m => m.id === q.get('k'))) S.ring.missile = q.get('k');
if (LAUNCH.some(l => l.id === q.get('l'))) S.ring.launch = q.get('l');
(q.get('hide') || '').split(',').forEach(id => S.layers.delete(id));
if (q.get('chains') === '0') S.chains = false;

buildPanel($('panel'));
renderTable($('ic-table'));
const map = createMap($('ic-map'), $('ic-tip'), {
  onSite: id => { if (S.measure) return; S.mode = 'site'; S.site = id; if (!S.layers.has(SITE[id].layer)) S.layers.add(SITE[id].layer); update(); },
  onLaunch: id => { if (S.measure) return; S.mode = 'ring'; S.ring.launch = id; update(); },
  onClick: p => {
    if (!S.measure) return;
    S.mpts = S.mpts.length >= 2 ? [p] : [...S.mpts, p];
    map.drawMeasure(S.mpts);
  },
});

function update() {
  const reach = S.mode === 'site' ? siteReach(SITE[S.site]) : null;
  const ringSites = new Set(S.mode === 'ring' ? sitesInRing(S.ring.missile, S.ring.launch).map(o => o.s.id) : []);
  map.draw({ site: S.site, reach, ring: S.ring, ringSites, layers: S.layers, chains: S.chains, mode: S.mode });
  renderPanel(S);
  const h = new URLSearchParams({ m: S.mode });
  if (S.mode === 'site') h.set('s', S.site); else { h.set('k', S.ring.missile); h.set('l', S.ring.launch); }
  const hidden = LAYERS.map(l => l.id).filter(id => !S.layers.has(id));
  if (hidden.length) h.set('hide', hidden.join(','));
  if (!S.chains) h.set('chains', '0');
  history.replaceState(null, '', '#' + h.toString());
}

// Panel events
$('ic-modes').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (b) { S.mode = b.dataset.m; update(); } });
$('ic-site-pick').addEventListener('change', e => { S.site = e.target.value; S.layers.add(SITE[S.site].layer); update(); });
$('ic-missiles').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) { S.ring.missile = b.dataset.k; update(); } });
$('ic-launch-pick').addEventListener('change', e => { S.ring.launch = e.target.value; update(); });
$('panel').addEventListener('change', e => {
  if (e.target.dataset.layer) { e.target.checked ? S.layers.add(e.target.dataset.layer) : S.layers.delete(e.target.dataset.layer); update(); }
  if (e.target.id === 'ic-chains') { S.chains = e.target.checked; update(); }
});
$('panel').addEventListener('click', e => { const b = e.target.closest('button[data-site]'); if (b) { S.mode = 'site'; S.site = b.dataset.site; update(); } });

// Map toolbar
$('ic-zin').onclick = () => map.zoomIn();
$('ic-zout').onclick = () => map.zoomOut();
document.querySelectorAll('[data-box]').forEach(b => b.onclick = () => map.zoomBox(BOXES[b.dataset.box]));
$('ic-measure').onclick = () => {
  S.measure = !S.measure; S.mpts = [];
  $('ic-measure').setAttribute('aria-pressed', String(S.measure));
  $('ic-mapbox').classList.toggle('measuring', S.measure);
  map.drawMeasure([]);
};
$('ic-copy').onclick = async () => {
  const b = $('ic-copy');
  try { await navigator.clipboard.writeText(location.href); b.textContent = 'Link copied'; } catch { b.textContent = 'Copy the address bar'; }
  setTimeout(() => { b.textContent = 'Copy link'; }, 1800);
};

const tour = createTour($('ic-mapbox'), set => {
  if (set.mode) S.mode = set.mode;
  if (set.site) S.site = set.site;
  if (set.ring) S.ring = { ...set.ring };
  if (set.layers) S.layers = new Set(set.layers);
  if (set.chains != null) S.chains = set.chains;
  if (set.zoom) map.zoomBox(BOXES[set.zoom]);
  update();
});
$('ic-tour').onclick = () => tour.start();

addExportBar(document.querySelector('.ic-legend'), {
  where: 'after', target: () => $('ic-map'),
  title: () => S.mode === 'site' ? `PLA missile reach to ${SITE[S.site].n}`
    : `${MISSILES.find(m => m.id === S.ring.missile).name} range from the ${LAUNCH.find(l => l.id === S.ring.launch).n} (notional launch area)`,
  note: 'Ranges: CSIS Missile Threat. Launch areas notional. Sites from public sources',
});
addExportBar($('ic-table'), { where: 'prepend', csv: tableCsv, csvLabel: 'Copy site table as CSV' });

update();
if (innerWidth < 700) map.zoomBox(BOXES.near);
