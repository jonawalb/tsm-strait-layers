// Dark Fleet Viewer: state, modes, playback, hit-testing and URL hash. Loaded by app.js after first paint.
import { el, fmt } from '../../../shared/js/mapkit.js';
import { cssVar, EXTENTS } from './map.js';
import { BY_MMSI, T_END, RANGE, detectGaps, detectLoiter, drawFrame, CATS } from './live.js';
import { drawArchive, drawMonthChart, vesselsInCell, monthLabel, monthlyTotals, MONTHS, AVESSELS, FORCE } from './archive.js';
import { addExportBar } from '../../../shared/js/export.js';
import { liveCard, drawVesselTimeline, archiveCard, when } from './card.js';
import { livePanel, archivePanel, gapList, colocList, zoneBars } from './panel.js';
import { LIVE } from '../data/live.js';
import { readHash, writeHash } from './hash.js';
import { createTour } from './tour.js';

const $ = id => document.getElementById(id);

export const S = {
  mode: 'live', ext: 'taiwan', t: 7920, trail: 12, speed: 60, playing: false,
  cats: { prc: true, shared: true, cand: false, watch: true },
  gapH: 12, allGaps: false, lo: { kn: 1, km: 3, h: 24 }, coloc: true,
  ov: { adiz: true, median: true, zones: false },
  sel: null, month: MONTHS.length - 1, span: 3, forces: { CCG: true, PAFMM: true }, cell: null,
};
readHash(S);

let map = null; // set by start()
let gaps = [], loiter = [], hits = [], cells = [], colors = {};

function readColors() {
  colors = {
    prc: cssVar('--c7'), shared: cssVar('--warn'), cand: cssVar('--ccg'), watch: cssVar('--prc'),
    dark: cssVar('--ink'), loiter: cssVar('--accent'), halo: cssVar('--panel'), ccg: cssVar('--ccg'), pafmm: cssVar('--c5'),
  };
}

// ---- mode + panel -------------------------------------------------------------------------
function mountMode() {
  document.body.dataset.mode = S.mode;
  document.querySelectorAll('.modes [data-mode]').forEach(b => b.setAttribute('aria-selected', b.dataset.mode === S.mode));
  $('panel').innerHTML = S.mode === 'live' ? livePanel() : archivePanel();
  const bind = (id, get, set) => { const i = $(id); if (!i) return; i.checked = get(); i.onchange = () => { set(i.checked); update(); }; };
  ['prc', 'shared', 'cand'].forEach(c => bind('cat-' + c, () => S.cats[c], v => { S.cats[c] = v; }));
  ['adiz', 'median', 'zones'].forEach(k => bind('ov-' + k, () => S.ov[k], v => { S.ov[k] = v; }));
  bind('all-gaps', () => S.allGaps, v => { S.allGaps = v; });
  bind('ov-coloc', () => S.coloc, v => { S.coloc = v; });
  FORCE.forEach(f => bind('f-' + f.k, () => S.forces[f.k], v => { S.forces[f.k] = v; S.cell = null; }));
  const sl = (id, get, set, fmtv, recompute) => {
    const i = $(id); if (!i) return;
    i.value = get(); $(id + '-out').textContent = fmtv(get());
    i.oninput = () => { set(+i.value); $(id + '-out').textContent = fmtv(+i.value); if (recompute) detect(); update(); };
  };
  sl('gap-h', () => S.gapH, v => { S.gapH = v; }, v => v + ' h', true);
  sl('lo-kn', () => S.lo.kn, v => { S.lo.kn = v; }, v => v + ' kn', true);
  sl('lo-km', () => S.lo.km, v => { S.lo.km = v; }, v => v + ' km', true);
  sl('lo-h', () => S.lo.h, v => { S.lo.h = v; }, v => v + ' h', true);
  document.querySelectorAll('#span button').forEach(b => b.onclick = () => { S.span = +b.dataset.span; S.cell = null; update(); });
  if (S.mode === 'live') { zoneBars(); colocList(LIVE.coloc, r => { stop(); S.t = r[0]; S.sel = BY_MMSI.get(r[1]) || null; update(); }); }
  $('scrub').max = T_END;
}

function detect() {
  gaps = detectGaps(S.gapH);
  loiter = detectLoiter(S.lo.kn, S.lo.km, S.lo.h);
}

// ---- render -------------------------------------------------------------------------------
function setExtent() {
  map.setExtent(S.ext);
  document.querySelectorAll('[data-ext]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ext === S.ext));
}

function update() {
  map.show(S.ov);
  const { ctx, k } = map.sizeCanvas();
  const top = map.top; top.innerHTML = '';
  if (S.mode === 'live') renderLive(ctx, k, top); else renderArchive(ctx, k, top);
  writeHash(S);
}

function renderLive(ctx, k, top) {
  hits = drawFrame(ctx, map.proj, S, colors, gaps, loiter, k, map.landPath);
  if (S.coloc) LIVE.coloc.forEach(c => {
    if (Math.abs(c[0] - S.t) > 90 && !S.allGaps) return;
    const [x, y] = map.proj.project([c[6], c[5]]);
    el('path', { d: `M${x} ${y - 6}l6 6l-6 6l-6 -6z`, class: 'coloc' + (Math.abs(c[0] - S.t) <= 90 ? ' on' : '') }, top);
  });
  // gap labels at the point where the ship went dark: silences under way first, then the longest; no overlaps
  const boxes = [], isOn = g => S.t >= g.a.t && S.t <= g.b.t;
  gaps.filter(g => S.cats[g.v.cat] && (S.allGaps || isOn(g)) && map.inView([g.a.lon, g.a.lat]))
    .sort((p, q) => isOn(q) - isOn(p)).slice(0, 40).forEach(g => {
      if (boxes.length >= 6) return;
      const [x, y] = map.proj.project([g.a.lon, g.a.lat]);
      const sub = g.land || g.km >= 150;
      const b = [x + 6, y - 16, x + 6 + (sub ? 150 : 70), y + (sub ? 12 : 0)];
      if (boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return;
      boxes.push(b);
      const tx = el('text', { x: x + 8, y: y - 4, class: 't-gap' }, top);
      el('tspan', { x: x + 8 }, tx, `dark ${durTxt(g.h)}`);
      if (sub) el('tspan', { x: x + 8, dy: 12, class: 't-gap-sub' }, tx, g.km < 1 ? 'back in place' : `back ${fmt(g.km)} km ${g.dir}${g.land ? ', path unknown' : ''}`);
    });
  if (S.sel) {
    const h = hits.find(x => x.v === S.sel);
    if (h) el('text', { x: h.x + 8, y: h.y + 4, class: 't-sel' }, top, S.sel.label);
  }
  const vis = hits.filter(h => map.inView(map.proj.unproject(h.x, h.y)));
  const dark = vis.filter(h => h.dark).length;
  $('now-t').textContent = when(S.t);
  $('now-s').textContent = `${fmt(vis.length - dark)} vessels heard in this view · ${dark} dark (silent ${S.gapH} h or more)`;
  $('scrub').value = S.t;
  $('scrub-out').textContent = when(S.t);
  $('trail-out').textContent = S.trail + ' h';
  gapList(gaps.filter(g => S.cats[g.v.cat]), map.inView, g => { stop(); S.t = Math.round((g.a.t + g.b.t) / 2); S.sel = g.v; update(); });
  const lv = loiter.filter(l => S.cats[l.v.cat] && map.inView(l.c));
  $('lo-sum').innerHTML = `<b>${lv.length}</b> loitering episode${lv.length === 1 ? '' : 's'} in this view (orange rings while under way). Ships at anchor off a port count too.`;
  renderCard();
}

const durTxt = h => (h >= 48 ? (h / 24).toFixed(1) + ' d' : h.toFixed(0) + ' h');

function renderArchive(ctx, k, top) {
  const r = drawArchive(ctx, map.proj, S, colors, k);
  cells = r.cells;
  if (S.cell) {
    const c = cells.find(x => x.i === S.cell[0] && x.j === S.cell[1]);
    if (c) el('rect', { x: c.box[0], y: c.box[1], width: c.box[2] - c.box[0], height: c.box[3] - c.box[1], class: 'cell-sel' }, top);
  }
  const tot = drawMonthChart($('months'), S, EXTENTS[S.ext].box, m => { stop(); S.month = m; S.cell = null; update(); });
  const range = S.span > 1 ? `${monthLabel(Math.max(0, S.month - S.span + 1))} – ${monthLabel(S.month)}` : monthLabel(S.month);
  const sum = [0, 1].map(f => tot.slice(Math.max(0, S.month - S.span + 1), S.month + 1).reduce((s, x) => s + x[f], 0));
  $('now-t').textContent = range;
  $('now-s').textContent = `In this view: ${fmt(sum[0])} coast guard and ${fmt(sum[1])} militia vessel-days with a GFW event.`;
  document.querySelectorAll('#span button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.span === S.span));
  $('scrub').value = S.month; $('scrub').max = MONTHS.length - 1;
  $('scrub-out').textContent = monthLabel(S.month);
  const list = $('cell-list');
  if (S.cell) {
    const vs = vesselsInCell(S, S.cell[0], S.cell[1]);
    list.innerHTML = `<p class="fine">${vs.length} vessel${vs.length === 1 ? '' : 's'} near ${(S.cell[1] * 0.5 + 0.25).toFixed(2)}°N ${(S.cell[0] * 0.5 + 0.25).toFixed(2)}°E:</p><ol>${vs.slice(0, 12).map(v =>
      `<li><button type="button" class="linkish" data-mmsi="${v.mmsi}">${v.name || v.mmsi}</button><span class="num">${v.n} d</span><small>${v.force}${v.hull ? ' · hull ' + v.hull : ''} · conf. ${v.conf}</small></li>`).join('')}</ol>`;
    list.querySelectorAll('[data-mmsi]').forEach(b => b.onclick = () => { S.sel = b.dataset.mmsi; renderCard(); });
  }
  renderCard();
}

function renderCard() {
  const card = $('card');
  if (!card) return;
  if (!S.sel) { card.hidden = true; return; }
  card.hidden = false;
  if (S.mode === 'live') {
    card.innerHTML = liveCard(S.sel, S, gaps, loiter);
    drawVesselTimeline($('vtl'), S.sel, S, gaps, loiter, t => { stop(); S.t = t; update(); });
    card.querySelectorAll('[data-mmsi]').forEach(b => b.onclick = () => { S.sel = BY_MMSI.get(b.dataset.mmsi) || S.sel; update(); });
  } else {
    const v = AVESSELS[S.sel];
    card.innerHTML = v ? archiveCard({ ...v, mmsi: S.sel }) : '';
  }
  card.querySelector('.x-card').onclick = () => { S.sel = null; update(); };
}

// ---- playback -----------------------------------------------------------------------------
let raf = null, lastTs = 0;
function frame(ts) {
  if (!S.playing) return;
  const dt = Math.min(100, ts - (lastTs || ts)); lastTs = ts;
  if (S.mode === 'live') {
    S.t += dt / 1000 * S.speed * 6;
    if (S.t >= T_END) { S.t = T_END; stop(); }
    update();
  } else if (ts - (frame.m || 0) > 700) {
    frame.m = ts; S.month += 1;
    if (S.month >= MONTHS.length - 1) { S.month = MONTHS.length - 1; stop(); }
    update();
  }
  raf = requestAnimationFrame(frame);
}
function play() {
  if (S.mode === 'live' && S.t >= T_END) S.t = 0;
  if (S.mode === 'archive' && S.month >= MONTHS.length - 1) S.month = 0;
  S.playing = true; lastTs = 0; $('play').textContent = 'Pause'; $('play').setAttribute('aria-pressed', 'true');
  raf = requestAnimationFrame(frame);
}
function stop() { S.playing = false; cancelAnimationFrame(raf); $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false'); }

// ---- events -------------------------------------------------------------------------------
$('play').onclick = () => (S.playing ? stop() : play());
$('scrub').oninput = e => { stop(); if (S.mode === 'live') S.t = +e.target.value; else { S.month = +e.target.value; S.cell = null; } update(); };
$('trail').oninput = e => { S.trail = +e.target.value; update(); };
$('speed').onchange = e => { S.speed = +e.target.value; };
document.querySelectorAll('[data-ext]').forEach(b => b.onclick = () => { S.ext = b.dataset.ext; S.cell = null; setExtent(); update(); });
document.querySelectorAll('.modes [data-mode]').forEach(b => b.onclick = () => switchMode(b.dataset.mode));
function switchMode(m) {
  stop(); S.mode = m; S.sel = null; S.cell = null;
  if (m === 'archive' && S.ext === 'taiwan') S.ext = 'region';
  setExtent(); mountMode(); update();
}

$('tracks').addEventListener('click', e => {
  const r = $('tracks').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, k = map.scale();
  if (S.mode === 'live') {
    let best = null, bd = 14;
    hits.forEach(h => { const d = Math.hypot(h.x * k - x, h.y * k - y); if (d < bd) { bd = d; best = h; } });
    S.sel = best ? best.v : null;
  } else {
    const c = cells.find(c => x / k >= c.box[0] && x / k <= c.box[2] && y / k >= c.box[1] && y / k <= c.box[3]);
    S.cell = c ? [c.i, c.j] : null; S.sel = null;
  }
  update();
});
$('tracks').addEventListener('pointermove', e => {
  const r = $('tracks').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, k = map.scale();
  const tip = $('maptip');
  if (S.mode === 'live') {
    const h = hits.find(h => Math.hypot(h.x * k - x, h.y * k - y) < 10);
    if (!h) { tip.hidden = true; $('tracks').style.cursor = ''; return; }
    $('tracks').style.cursor = 'pointer';
    tip.innerHTML = `<b>${h.v.label}</b><br>${CATS[h.v.cat].short} · MMSI ${h.v.mmsi}<br>${h.dark ? `silent for ${h.silentH.toFixed(0)} h` : 'heard ' + (h.silentH < 1 ? 'within the hour' : h.silentH.toFixed(0) + ' h ago')}`;
  } else {
    const c = cells.find(c => x / k >= c.box[0] && x / k <= c.box[2] && y / k >= c.box[1] && y / k <= c.box[3]);
    if (!c) { tip.hidden = true; return; }
    tip.innerHTML = `<b>${c.n[0] + c.n[1]} vessel-days</b><br>coast guard ${c.n[0]} · militia ${c.n[1]}<br><small>Click to list vessels</small>`;
  }
  tip.hidden = false;
  tip.style.left = Math.min(x + 14, r.width - tip.offsetWidth - 6) + 'px';
  tip.style.top = Math.max(6, y - tip.offsetHeight - 8) + 'px';
});
$('tracks').addEventListener('pointerleave', () => { $('maptip').hidden = true; });
document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea, button') && e.key !== ' ') return;
  if (e.key === ' ' && e.target === document.body) { e.preventDefault(); S.playing ? stop() : play(); }
});
$('copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; } catch { $('copy-link').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
};

const tour = createTour($('mapbox'), set => {
  stop();
  if (set.mode && set.mode !== S.mode) { S.mode = set.mode; mountMode(); }
  Object.entries(set).forEach(([k, v]) => { if (k === 'sel') S.sel = S.mode === 'live' ? BY_MMSI.get(v) || null : v; else if (k !== 'mode') S[k] = typeof v === 'object' && !Array.isArray(v) && v ? { ...S[k], ...v } : v; });
  if (!('sel' in set)) S.sel = null;
  detect(); setExtent(); mountMode(); update();
});
$('start-tour').onclick = () => tour.start();

/** Called by app.js with the map it already drew, once the AIS data modules have loaded. */
/** The map is an SVG basemap with tracks on a canvas above it. For export, lay the canvas into the SVG
 *  as an image for the moment the exporter clones it, then take it out again. */
function mapForExport() {
  const svg = $('map'), cv = $('tracks'), p = map.proj;
  const img = el('image', { x: 0, y: 0, width: p.W, height: p.H, preserveAspectRatio: 'none', href: cv.toDataURL('image/png') }, svg);
  setTimeout(() => img.remove(), 0);
  return svg;
}
function wireExport() {
  addExportBar($('mapbox'), {
    where: 'after', target: mapForExport,
    title: () => S.mode === 'live' ? `Chinese-flag AIS tracks around Taiwan, ${$('scrub-out').textContent}` : `Watchlist coast guard and militia vessel-days, ${$('scrub-out').textContent}`,
    note: () => S.mode === 'live' ? 'Data: TSM AIS database (terrestrial AIS). Coverage is thin; absence of a track is not absence of a ship.' : 'Data: Global Fishing Watch events for TSM watchlist vessels',
    csv: () => [['month', 'ccg_vessel_days', 'militia_vessel_days'], ...monthlyTotals(EXTENTS[S.ext].box).map((t, i) => [MONTHS[i], t[0], t[1]])],
    csvLabel: 'Copy monthly vessel-days as CSV',
  });
}

export function start(m) {
  map = m;
  wireExport();
  const d = new Date(Date.parse(LIVE.t1)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  $('banner-date').textContent = d;
  document.querySelectorAll('[data-live-range]').forEach(n => { n.textContent = `${RANGE[0]} to ${RANGE[1]}`; });
  document.querySelectorAll('[data-live-short]').forEach(n => {
    const [a, b] = [LIVE.t0, LIVE.t1].map(x => new Date(Date.parse(x)));
    n.textContent = `Fixes, ${a.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} ${a.getUTCDate()}–${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  });
  readColors();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); update(); });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(update, 120); });
  if (typeof S.sel === 'string') S.sel = S.mode === 'live' ? BY_MMSI.get(S.sel) || null : S.sel;
  if (S.t > T_END) S.t = T_END;
  detect(); setExtent(); mountMode(); update();
}
