// How Close Is China? Wires search, map, card and the URL hash together.
import { CITIES } from '../data/cities.js';
import { createMap } from './map.js';
import { createSearch } from './search.js';
import { renderCard, renderDetails, renderScale, downloadPNG } from './card.js';
import { summarize, comparePair, cityKey, cityObj, nearestCity, TAIPEI, STRAIT_KM } from './geo.js';
import { distKm, fmt, escapeHtml } from '../../../shared/js/mapkit.js';
import { addExportBar } from '../../../shared/js/export.js';

const $ = id => document.getElementById(id);
const QUICK = ['tokyo--japan', 'manila--philippines', 'seoul--south-korea', 'sydney--australia', 'honolulu--united-states',
  'washington-d-c--united-states', 'london--united-kingdom', 'new-delhi--india'];
const BY_KEY = new Map();
CITIES.forEach(c => { const k = cityKey(c); if (!BY_KEY.has(k)) BY_KEY.set(k, c); });

let current = null;
const map = createMap($('hc-map'), { onPick: pickPoint });
const search = createSearch($('hc-q'), $('hc-list'), c => choose({ ...cityObj(c), key: cityKey(c) }));

function choose(pt, { fit = true, hash = true } = {}) {
  current = pt;
  const s = summarize(pt);
  const pair = comparePair(s.p);
  renderCard($('hc-card'), pt, s, pair);
  renderDetails($('hc-details'), pt, s);
  renderScale($('hc-scale'), s, pt);
  map.show(pt, { fit });
  renderBars(pt, s);
  document.querySelectorAll('#hc-quick button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === pt.key)));
  if (!pt.custom) search.set(`${pt.name}, ${pt.country}`);
  $('hc-live').textContent = `${pt.name}: ${Math.round(s.toTaipei).toLocaleString('en-US')} kilometres to Taipei.`;
  if (hash) {
    const h = pt.custom ? `p=${pt.lon.toFixed(2)},${pt.lat.toFixed(2)}` : `city=${pt.key}`;
    history.replaceState(null, '', '#' + h);
  }
}

function pickPoint([lon, lat], label) {
  const near = nearestCity([lon, lat]);
  const name = label || (near.km < 40 ? `Near ${near.city[0]}` : `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'W' : 'E'}`);
  choose({ name, country: near.km < 40 ? near.city[1] : '', lon, lat, custom: true });
}

function fromHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const key = (q.get('city') || '').toLowerCase();
  if (key && BY_KEY.has(key)) { const c = BY_KEY.get(key); choose({ ...cityObj(c), key }, { hash: false }); return true; }
  const p = (q.get('p') || '').split(',').map(Number);
  if (p.length === 2 && p.every(Number.isFinite) && Math.abs(p[1]) <= 80) { pickPoint(p); return true; }
  return false;
}

// Quick picks
$('hc-quick').innerHTML = QUICK.filter(k => BY_KEY.has(k)).map(k => {
  const c = BY_KEY.get(k);
  return `<button type="button" data-k="${k}" aria-pressed="false">${c[0]}</button>`;
}).join('');
$('hc-quick').addEventListener('click', e => {
  const b = e.target.closest('button[data-k]');
  if (b) choose({ ...cityObj(BY_KEY.get(b.dataset.k)), key: b.dataset.k });
});

// Views
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.view === 'fit' && current) map.show(current); else map.view(b.dataset.view);
}));

// Share
$('hc-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); flash('Link copied'); }
  catch { flash('Copy the address bar to share'); }
});
$('hc-png').addEventListener('click', () => current && downloadPNG(current, summarize(current), comparePair([current.lon, current.lat])));
if (navigator.share) {
  $('hc-share').hidden = false;
  $('hc-share').addEventListener('click', () => navigator.share({ title: 'How Close Is China?', url: location.href }).catch(() => {}));
}
if ('geolocation' in navigator) {
  $('hc-locate').hidden = false;
  $('hc-locate').addEventListener('click', () => {
    flash('Finding your location in the browser. Nothing is sent to us.');
    navigator.geolocation.getCurrentPosition(
      pos => pickPoint([pos.coords.longitude, pos.coords.latitude], 'Your location'),
      () => flash('Location unavailable. Search a city instead.'),
      { maximumAge: 600000, timeout: 10000 });
  });
}
function flash(msg) { const f = $('hc-flash'); f.textContent = msg; f.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => { f.hidden = true; }, 3200); }

function renderBars(pt, s) {
  const rows = QUICK.filter(k => BY_KEY.has(k) && k !== pt.key).map(k => { const c = BY_KEY.get(k); return { k, name: c[0], km: distKm([c[2], c[3]], TAIPEI) }; });
  rows.push({ k: pt.key || '', name: pt.name, km: s.toTaipei, cur: true }, { name: 'Taiwan Strait, narrowest', km: STRAIT_KM, strait: true });
  rows.sort((a, b) => a.km - b.km);
  const max = Math.max(...rows.map(r => r.km));
  $('hc-bars').innerHTML = rows.map(r => `<li class="${r.cur ? 'cur' : ''}${r.strait ? ' strait' : ''}" ${r.k && !r.cur ? `data-k="${r.k}" tabindex="0" role="button"` : ''}>
    <span class="nm">${escapeHtml(r.name)}</span><span class="bar"><span style="width:${Math.max(0.6, r.km / max * 100).toFixed(1)}%"></span></span><span class="v">${fmt(r.km)} km</span></li>`).join('');
}
const barPick = e => { const li = e.target.closest('li[data-k]'); if (li && (e.type === 'click' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose({ ...cityObj(BY_KEY.get(li.dataset.k)), key: li.dataset.k }); } };
$('hc-bars').addEventListener('click', barPick);
$('hc-bars').addEventListener('keydown', barPick);

window.addEventListener('hashchange', fromHash);
if (!fromHash()) choose({ ...cityObj(BY_KEY.get('washington-d-c--united-states')), key: 'washington-d-c--united-states' }, { hash: false });
addExportBar(document.querySelector('.stage > .mapbox'), {
  target: () => document.getElementById('hc-map'),
  title: () => `How close is China? ${document.querySelector('#hc-card .hc-place')?.textContent || ''} to Taipei`,
  note: 'Great-circle distances; coastlines Natural Earth',
  pngLabel: 'Download map PNG',
  where: 'after',
});
