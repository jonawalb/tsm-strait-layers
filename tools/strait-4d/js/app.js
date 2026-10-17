// Strait 4D: state, controls, playback, presets and URL hash.
import { ALL, N, FIRST, LAST, METRICS, PRESETS, ANOM, RHET_METRICS, indexOf, nice, exerciseOn, computeAnomalies,
  anomalyDays, grayTop, LAYERS } from './data.js';
import { createCamera, DEFAULT_VIEW } from './camera.js';
import { createScene } from './scene.js';
import { createTimeline } from './timeline.js';
import { dayHtml, anomalyHtml, eventsHtml, rhetoricHtml } from './panel.js';
import { createTour } from './tour.js';
import { escapeHtml as E } from '../../../shared/js/mapkit.js';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LAYER_KEYS = ['sectors', 'zones', 'flags', 'ccg', 'trail', 'gray', 'ais', 'transits', 'cables', 'labels'];
const S = {
  i: indexOf('2026-09-17'), layers: Object.fromEntries(LAYER_KEYS.map(k => [k, true])), playing: false, speed: 3,
  preset: null, window: null, rhetMetric: RHET_METRICS[0], anomOn: true, tl: 'full', t: 0, reduced,
};

const canvas = $('#scene'), stage = $('#stagebox'), tip = $('#tip');
const cam = createCamera(canvas, settled => { render(); if (settled) writeHash(); });
const scene = createScene(canvas, cam);
const tl = createTimeline($('#timeline'), i => { stop(); go(i); });

/* ---------- rendering ---------- */
let raf = 0, lastPanel = 0, panelDay = -1;
function render() { if (!raf) raf = requestAnimationFrame(frame); }
let prevT = 0;
function frame(t) {
  raf = 0;
  const dt = prevT ? Math.min(100, t - prevT) : 16;
  prevT = t; S.t = t;
  if (S.playing) {
    S.acc = (S.acc || 0) + dt / 1000 * S.speed;
    if (S.acc >= 1) {
      const step = Math.floor(S.acc); S.acc -= step;
      const end = S.window ? S.window[1] : N - 1;
      S.i = Math.min(end, S.i + step);
      if (S.i >= end) stop();
    }
  }
  const day = ALL[S.i];
  S.day = day; S.ex = exerciseOn(day.d);
  scene.draw(S);
  tl.draw(S);
  hud(day);
  if (panelDay !== S.i && (!S.playing || t - lastPanel > 250)) { panel(day); lastPanel = t; panelDay = S.i; }
  const animated = !reduced && ((S.layers.flags && day.flag) || (S.layers.transits && day.transits.length));
  if (S.playing || animated) raf = requestAnimationFrame(frame); else prevT = 0;
}

function resize() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(280, r.width), h = Math.max(320, Math.min(720, w < 560 ? w * 1.05 : w * 0.6));
  canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  cam.resize(w, h);
  tl.resize();
  render();
}

/* ---------- HUD and panel ---------- */
const ZFMT = z => (z >= 0 ? '+' : '−') + Math.abs(z).toFixed(1);
function hud(day) {
  const ex = S.ex;
  $('#hud-date').textContent = nice(day.d);
  $('#hud-counts').innerHTML = METRICS.map(m => {
    const v = day.v[m.key], z = day.z[m.key], hit = day.anom.includes(m.key);
    return `<div class="hc${hit ? ' hit' : ''}"><b class="num">${v ?? '–'}</b><span>${m.short}</span>${hit ? `<i title="Robust z ${ZFMT(z)} against the trailing ${ANOM.window}-day median">▲ ${ZFMT(z)}</i>` : ''}</div>`;
  }).join('');
  const tags = [];
  if (ex) tags.push(`<span class="tag prc">${E(ex.x.short)}${ex.state === 'on' ? '' : ' (announced)'}</span>`);
  if (day.flag.includes('J')) tags.push('<span class="tag acc">Joint combat readiness patrol</span>');
  if (day.flag.includes('L')) tags.push('<span class="tag us">Long-range flight</span>');
  if (day.ccg.length) tags.push(`<span class="tag ccg">${day.ccg.length} coast guard incident${day.ccg.length > 1 ? 's' : ''}</span>`);
  if (day.transits.length) tags.push(`<span class="tag us">Allied transit</span>`);
  if (day.cables.length) tags.push(`<span class="tag cable">Cable incident</span>`);
  $('#hud-tags').innerHTML = tags.join('');
  $('#day').value = S.i;
  $('#day').setAttribute('aria-valuetext', nice(day.d));
  $('#day-out').textContent = day.d;
}
function panel(day) {
  $('#dayread').innerHTML = dayHtml(day);
  $('#anomread').innerHTML = anomalyHtml(day);
  $('#events').innerHTML = eventsHtml(day, S.ex);
  $('#rhetoric').innerHTML = rhetoricHtml(day, S.rhetMetric);
}

/* ---------- navigation ---------- */
function go(i, { hash = true } = {}) {
  S.i = Math.max(0, Math.min(N - 1, i));
  if (S.window && (S.i < S.window[0] || S.i > S.window[1])) clearPreset();
  render();
  if (hash) writeHashSoon();
}
function play() {
  if (S.playing) return stop();
  const end = S.window ? S.window[1] : N - 1;
  if (S.i >= end) S.i = S.window ? S.window[0] : Math.max(0, N - 365);
  S.playing = true; S.acc = 0; prevT = 0;
  $('#play').textContent = 'Pause'; $('#play').setAttribute('aria-pressed', 'true');
  render();
}
function stop() {
  if (!S.playing) return;
  S.playing = false;
  $('#play').textContent = 'Play'; $('#play').setAttribute('aria-pressed', 'false');
  panelDay = -1; render(); writeHash();
}
function setTimelineView() {
  if (S.tl === 'zoom') { const a = S.window ? S.window[0] - 10 : S.i - 60; tl.setView(a, S.window ? S.window[1] + 10 : S.i + 60); }
  else tl.setView(0, N - 1);
  document.querySelectorAll('#tlview button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S.tl)));
}
function applyPreset(id, { playIt = false, d = null } = {}) {
  const p = PRESETS.find(q => q.id === id);
  if (!p) return clearPreset();
  S.preset = id; S.window = [indexOf(p.from), indexOf(p.to)]; S.tl = 'zoom';
  S.i = indexOf(d || p.focus);
  setTimelineView();
  document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === id)));
  if (playIt) { S.i = S.window[0]; stop(); play(); } else render();
  writeHashSoon();
}
function clearPreset() {
  S.preset = null; S.window = null;
  document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', 'false'));
  setTimelineView();
}
function jumpAnomaly(dir) {
  const xs = anomalyDays();
  const next = dir > 0 ? xs.find(i => i > S.i) : [...xs].reverse().find(i => i < S.i);
  if (next != null) { stop(); if (S.window && (next < S.window[0] || next > S.window[1])) clearPreset(); if (S.tl === 'zoom') { S.i = next; setTimelineView(); } go(next); }
}

/* ---------- controls ---------- */
function buildControls() {
  $('#presets').innerHTML = PRESETS.map(p => `<button type="button" data-p="${p.id}" aria-pressed="false"><b>${E(p.label)}</b><span>${E(p.when)}</span></button>`).join('');
  $('#presets').addEventListener('click', e => { const b = e.target.closest('button'); if (b) applyPreset(b.dataset.p, { playIt: true }); });
  const day = $('#day');
  day.max = N - 1;
  day.addEventListener('input', () => { stop(); go(+day.value); });
  $('#play').onclick = play;
  $('#prev').onclick = () => { stop(); go(S.i - 1); };
  $('#next').onclick = () => { stop(); go(S.i + 1); };
  $('#anom-prev').onclick = () => jumpAnomaly(-1);
  $('#anom-next').onclick = () => jumpAnomaly(1);
  $('#speed').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.speed = +b.dataset.s; syncPressed('#speed', 's', S.speed); });
  $('#tlview').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.tl = b.dataset.v; setTimelineView(); render(); writeHashSoon(); });
  $('#layers').addEventListener('change', e => { const k = e.target.dataset.l; if (!k) return; S.layers[k] = e.target.checked; render(); writeHashSoon(); });
  $('#rmetric').innerHTML = RHET_METRICS.map(m => `<button type="button" data-m="${m.key}" title="${E(m.unit)}">${E(m.name)}</button>`).join('');
  $('#rmetric').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.rhetMetric = RHET_METRICS.find(m => m.key === b.dataset.m); syncPressed('#rmetric', 'm', S.rhetMetric.key); panelDay = -1; render(); writeHashSoon(); });
  const win = $('#aw'), thr = $('#at');
  const onAnom = () => { ANOM.window = +win.value; ANOM.thr = +thr.value; $('#aw-out').textContent = win.value + ' days'; $('#at-out').textContent = '≥ ' + (+thr.value).toFixed(1);
    computeAnomalies(); $('#anom-count').textContent = anomalyDays().length; panelDay = -1; render(); writeHashSoon(); };
  win.addEventListener('input', onAnom); thr.addEventListener('input', onAnom);
  $('#cam-reset').onclick = () => { cam.set({ ...DEFAULT_VIEW }); writeHashSoon(); };
  $('#cam-top').onclick = () => { cam.set({ pitch: 0, yaw: 0 }); writeHashSoon(); };
  $('#cam-tilt').onclick = () => { cam.set({ pitch: cam.pitch > 40 ? 25 : 58 }); writeHashSoon(); };
  $('#cam-turn').onclick = () => { cam.set({ yaw: cam.yaw + 30 }); writeHashSoon(); };
  $('#copy-link').onclick = async () => { writeHash(); try { await navigator.clipboard.writeText(location.href); $('#copy-link').textContent = 'Link copied'; } catch { $('#copy-link').textContent = 'Copy the address bar'; } setTimeout(() => { $('#copy-link').textContent = 'Copy link'; }, 1600); };
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, [contenteditable]') && e.target.id !== 'day') return;
    if (e.target === canvas) return;
    if (e.key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); play(); }
  });
  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') tip.hidden = true; });
  // Touch has no hover: a tap (no drag) on a mark shows its tooltip; a tap on empty map hides it.
  let downAt = null;
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse' && downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8) hover(e); downAt = null; });
  new ResizeObserver(resize).observe(stage);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { scene.readTheme(); tl.readTheme(); render(); });
  const tour = createTour(document.body, s => {
    if (s.preset) applyPreset(s.preset, { d: s.d }); else { clearPreset(); go(indexOf(s.d)); }
    if (s.cam) cam.set({ ...s.cam });
    stop();
  });
  $('#start-tour').onclick = () => tour.start();
}
function syncPressed(sel, attr, val) { document.querySelectorAll(`${sel} button`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] == val))); }
function syncControls() {
  document.querySelectorAll('#layers input[data-l]').forEach(i => { i.checked = !!S.layers[i.dataset.l]; });
  syncPressed('#speed', 's', S.speed); syncPressed('#rmetric', 'm', S.rhetMetric.key);
  $('#aw').value = ANOM.window; $('#at').value = ANOM.thr;
  $('#aw-out').textContent = ANOM.window + ' days'; $('#at-out').textContent = '≥ ' + ANOM.thr.toFixed(1);
  $('#anom-count').textContent = anomalyDays().length;
}

/* ---------- canvas hover ---------- */
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
function hover(e) {
  if (cam.dragging) { tip.hidden = true; return; }
  const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const hits = scene.hits;
  let h = null;
  for (let k = hits.length - 1; k >= 0 && !h; k--) {
    const q = hits[k];
    if (q.c ? Math.hypot(q.c[0] - x, q.c[1] - y) <= q.r : inPoly(x, y, q.pts)) h = q;
  }
  if (!h) { tip.hidden = true; return; }
  tip.innerHTML = tipHtml(h);
  tip.hidden = false;
  const sr = stage.getBoundingClientRect();
  const tx = Math.min(sr.width - 290, x + 14), ty = Math.max(4, y - 10);
  tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = ty + 'px';
}
function tipHtml(h) {
  const D = h.data;
  if (h.kind === 'ccg') return `<b>China Coast Guard, ${E(D.loc.label)}</b><span class="tt-d">${D.past ? 'Earlier in the last two weeks' : 'This day'}: ${D.list.length} incident${D.list.length > 1 ? 's' : ''}</span>${D.list.slice(0, 3).map(x => `<small>${x.date}: ${E(x.desc)}</small>`).join('')}<small>Pin at a reference point for the area, not the position.</small>`;
  if (h.kind === 'zone') return `<b>${E(D.ex.short)}: zone ${E(D.z.label)}</b><span class="tt-d">${D.st === 'on' ? 'In force' : D.st === 'pending' ? 'Announced, not yet in force' : 'Expired'}</span><small>Announced ${D.z.announced}. Vertices from the official notice.</small>`;
  if (h.kind === 'sector') return `<b>${E(LAYERS.sectorInfo[D.s].name)} ADIZ sector</b><span class="tt-d">Named in MND's report for this window</span><small>${D.adiz ?? 'n/a'} aircraft entered the ADIZ or crossed the median line in total; MND does not split the count by sector.</small>`;
  if (h.kind === 'gray') { const top = grayTop(D.mi, D.i, D.j).filter(v => (v.force === 'CCG') === !D.f); return `<b>${D.f ? 'Maritime militia' : 'Coast guard'} vessel-days: ${D.n}</b><span class="tt-d">${LAYERS.gray.months[D.mi]}, half-degree cell ${(D.i * 0.5).toFixed(1)}E ${(D.j * 0.5).toFixed(1)}N</span>${top.slice(0, 3).map(v => `<small>${E(v.name || v.mmsi)}${v.hull ? ' (' + E(v.hull) + ')' : ''}: ${v.n} days</small>`).join('')}`; }
  if (h.kind === 'cable') return `<b>${E(D.c.title)}</b><span class="tt-d">${D.c.date}${D.b ? `, ${D.b} days ago` : ''}</span><small>${E(D.c.area)}: area marker, not the fault position.</small>`;
  if (h.kind === 'transit') return `<b>Allied Strait transit</b>${D.map(t => `<small>${E(t.name)} (${E(t.country)})</small>`).join('')}<small>Route is schematic.</small>`;
  if (h.kind === 'ais') return `<b>${E(D.name)}</b><span class="tt-d">${D.n} AIS entries this day</span><small>PRC-flag and watchlist MMSIs; zone approximate.</small>`;
  return '';
}

/* ---------- hash ---------- */
let hashT = 0;
function writeHashSoon() { clearTimeout(hashT); hashT = setTimeout(writeHash, 250); }
function writeHash() {
  const q = new URLSearchParams({ d: ALL[S.i].d });
  if (S.preset) q.set('p', S.preset);
  q.set('l', LAYER_KEYS.filter(k => S.layers[k]).join(','));
  q.set('cam', [cam.yaw, cam.pitch, cam.zoom, cam.tx, cam.ty].map(v => +v.toFixed(2)).join(','));
  if (S.rhetMetric.key !== 'sal') q.set('m', S.rhetMetric.key);
  if (ANOM.window !== 60) q.set('aw', ANOM.window);
  if (ANOM.thr !== 3) q.set('at', ANOM.thr);
  if (S.tl !== 'full' && !S.preset) q.set('tl', S.tl);
  history.replaceState(null, '', '#' + q);
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const d = q.get('d');
  if (q.has('l')) { const on = new Set(q.get('l').split(',')); LAYER_KEYS.forEach(k => { S.layers[k] = on.has(k); }); }
  const m = RHET_METRICS.find(x => x.key === q.get('m')); if (m) S.rhetMetric = m;
  const aw = +q.get('aw'), at = +q.get('at');
  if ([30, 60, 90, 180].includes(aw) || (aw >= 30 && aw <= 180)) ANOM.window = aw;
  if (at >= 2 && at <= 6) ANOM.thr = at;
  if (q.has('aw') || q.has('at')) computeAnomalies();
  const c = (q.get('cam') || '').split(',').map(Number);
  if (c.length === 5 && c.every(Number.isFinite)) cam.set({ yaw: c[0], pitch: c[1], zoom: c[2], tx: c[3], ty: c[4] });
  if (q.get('tl') === 'zoom') S.tl = 'zoom';
  if (q.get('p') && PRESETS.some(p => p.id === q.get('p'))) applyPreset(q.get('p'), { d: /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null });
  else if (/^\d{4}-\d{2}-\d{2}$/.test(d || '') && d >= FIRST && d <= LAST) S.i = indexOf(d);
}

buildControls();
readHash();
syncControls();
setTimelineView();
$('#asof').textContent = nice(LAST);
document.querySelectorAll('.asof2').forEach(e => { e.textContent = nice(LAST); });
resize();
