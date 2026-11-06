// Live window: decode thinned fixes, detect AIS gaps, position jumps and loitering, draw a frame.
import { LIVE } from '../data/live.js';
import { distKm } from '../../../shared/js/mapkit.js';

export const T0 = Date.parse(LIVE.t0);
export const T_END = Math.ceil((Date.parse(LIVE.t1) - T0) / 60000);
export const CATS = {
  prc: { t: 'PRC-flag vessel, force not attributed', short: 'PRC-flag', color: '--c7' },
  shared: { t: 'Shared placeholder MMSI', short: 'Shared MMSI', color: '--warn' },
  cand: { t: 'Coast guard name, unreviewed candidate', short: 'Candidate', color: '--ccg' },
  watch: { t: 'Watchlist vessel (sourced)', short: 'Watchlist', color: '--prc' },
};
const JUMP_KN = 40; // implied speed above this = position jump, not a voyage

const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DEC = new Uint8Array(128);
for (let i = 0; i < 64; i++) DEC[DIGITS.charCodeAt(i)] = i;

/** Decode one varint track string (see scripts/build.py encode_track) into fixes. */
function decodeTrack(str) {
  const f = [];
  let i = 0, t = 0, la = 0, lo = 0;
  const next = () => {
    let v = 0, shift = 0, c;
    do { c = DEC[str.charCodeAt(i++)]; v += (c & 31) * 2 ** shift; shift += 5; } while (c & 32);
    return v;
  };
  const zz = v => (v % 2 ? -(v + 1) / 2 : v / 2);
  while (i < str.length) {
    t += next(); la += zz(next()); lo += zz(next());
    const s = next();
    f.push({ t, lat: la / 1e4, lon: lo / 1e4, sog: s === 0 ? null : (s - 1) / 10 });
  }
  return f;
}

/**
 * Vessels with decoded fixes: f = [{t, lon, lat, sog}], plus summary fields.
 * jumps: fix indexes that imply an impossible speed (shared MMSI or bad fix).
 * land: fix indexes whose straight segment from the previous fix crosses land (computed at build time).
 */
export const VESSELS = LIVE.ves.map(([mmsi, name, c, z], k) => {
  const f = decodeTrack(LIVE.tr[k]);
  const jumps = [];
  for (let i = 1; i < f.length; i++) {
    const h = (f[i].t - f[i - 1].t) / 60, km = distKm([f[i - 1].lon, f[i - 1].lat], [f[i].lon, f[i].lat]);
    if (km > 5 && km / 1.852 / Math.max(h, 1 / 6) > JUMP_KN) jumps.push(i);
  }
  const v = { mmsi, name, cat: LIVE.cats[c], zones: (z || []).map(j => LIVE.zl[j]), f, jumps: new Set(jumps), land: new Set(LIVE.lb[k] || []), label: name || `MMSI ${mmsi}` };
  if (LIVE.seed[mmsi]) v.seed = LIVE.seed[mmsi];
  return v;
});
export const BY_MMSI = new Map(VESSELS.map(v => [v.mmsi, v]));

/** Index of the last fix at or before minute t (binary search), or -1. */
export function lastIdx(v, t) {
  let lo = 0, hi = v.f.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (v.f[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Eight-point compass direction from fix a to fix b. */
export function compass(a, b) {
  const dx = (b.lon - a.lon) * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180), dy = b.lat - a.lat;
  return POINTS[Math.round(((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360) / 45) % 8];
}

/** Human date range of the live window, e.g. ['September 4', 'September 28, 2026']. */
export const RANGE = [LIVE.t0, LIVE.t1].map((s, i) => new Date(Date.parse(s)).toLocaleDateString('en-US',
  { month: 'long', day: 'numeric', ...(i ? { year: 'numeric' } : {}), timeZone: 'UTC' }));

/** Silences longer than minH hours between consecutive fixes (position jumps excluded). */
export function detectGaps(minH) {
  const out = [];
  VESSELS.forEach(v => {
    for (let i = 1; i < v.f.length; i++) {
      const h = (v.f[i].t - v.f[i - 1].t) / 60;
      if (h >= minH && !v.jumps.has(i)) {
        const a = v.f[i - 1], b = v.f[i];
        out.push({ v, a, b, h, km: distKm([a.lon, a.lat], [b.lon, b.lat]), dir: compass(a, b), land: v.land.has(i) });
      }
    }
  });
  return out.sort((x, y) => y.h - x.h);
}

/**
 * Loitering: a run of fixes at or under maxKn that stays within radiusKm of the run's first fix
 * for at least minH hours. Returns episodes {v, t0, t1, c:[lon,lat], n}.
 */
export function detectLoiter(maxKn, radiusKm, minH) {
  const out = [];
  VESSELS.forEach(v => {
    const f = v.f;
    let i = 0;
    while (i < f.length) {
      if (f[i].sog == null || f[i].sog > maxKn) { i++; continue; }
      let j = i;
      while (j + 1 < f.length && f[j + 1].sog != null && f[j + 1].sog <= maxKn && !v.jumps.has(j + 1)
        && distKm([f[i].lon, f[i].lat], [f[j + 1].lon, f[j + 1].lat]) <= radiusKm && f[j + 1].t - f[j].t <= 6 * 60) j++;
      if ((f[j].t - f[i].t) / 60 >= minH) out.push({ v, t0: f[i].t, t1: f[j].t, c: [f[i].lon, f[i].lat], n: j - i + 1 });
      i = j + 1;
    }
  });
  return out;
}

/**
 * Draw one frame to the canvas. S: state; ctx: 2D context in SVG units; k: screen px per SVG unit;
 * landPath: Path2D of the basemap land in SVG units (gap connectors are erased where they pass over it).
 * Returns an array of {v, x, y} for hit-testing.
 */
export function drawFrame(ctx, proj, S, colors, gaps, loiter, k, landPath) {
  ctx.clearRect(0, 0, proj.W, proj.H);
  const t = S.t, trail = S.trail * 60, px = 1 / k;
  const vis = v => S.cats[v.cat] && (!S.sel || S.selOnly !== true || v === S.sel);
  const shown = gaps.filter(g => vis(g.v) && (S.allGaps || (t >= g.a.t && t <= g.b.t)));
  // 1. gap connectors: faint, dotted, only where the straight line stays off land, then erased under land
  ctx.setLineDash([1.5 * px, 4 * px]); ctx.lineCap = 'round';
  shown.forEach(g => {
    if (g.land) return;
    const active = t >= g.a.t && t <= g.b.t;
    const [x1, y1] = proj.project([g.a.lon, g.a.lat]), [x2, y2] = proj.project([g.b.lon, g.b.lat]);
    ctx.strokeStyle = colors.dark; ctx.lineWidth = (active ? 1.4 : 1) * px; ctx.globalAlpha = active ? 0.55 : 0.3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
  if (landPath) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(landPath, 'evenodd'); ctx.restore();
  }
  // 2. loiter rings
  loiter.forEach(L => {
    if (!vis(L.v) || t < L.t0 || t > L.t1 + trail) return;
    const [x, y] = proj.project(L.c);
    ctx.beginPath(); ctx.arc(x, y, 9 * px, 0, 7);
    ctx.strokeStyle = colors.loiter; ctx.lineWidth = 1.5 * px; ctx.stroke();
  });
  // 3. trails, broken at silences, position jumps and segments that would cross land
  const hits = [];
  VESSELS.forEach(v => {
    if (!vis(v)) return;
    const i = lastIdx(v, t);
    if (i < 0) return;
    const col = colors[v.cat];
    const isSel = S.sel === v;
    ctx.strokeStyle = col; ctx.lineWidth = (isSel ? 2.4 : 1.1) * px; ctx.globalAlpha = isSel ? 1 : 0.55;
    ctx.beginPath();
    let pen = false;
    for (let j = i; j >= 0 && v.f[j].t >= t - trail; j--) {
      const [x, y] = proj.project([v.f[j].lon, v.f[j].lat]);
      const broken = j < i && ((v.f[j + 1].t - v.f[j].t) / 60 >= S.gapH || v.jumps.has(j + 1) || v.land.has(j + 1));
      if (!pen || broken) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      pen = true;
    }
    ctx.stroke(); ctx.globalAlpha = 1;
    // current marker: solid if heard within the gap threshold, hollow if silent ("dark")
    const last = v.f[i];
    const silentH = (t - last.t) / 60;
    if (i === v.f.length - 1 && silentH > 1) return; // no more fixes in the window
    const [x, y] = proj.project([last.lon, last.lat]);
    const dark = silentH >= S.gapH;
    ctx.beginPath(); ctx.arc(x, y, (isSel ? 5.5 : v.cat === 'prc' ? 2.6 : 4) * px, 0, 7);
    if (dark) { ctx.strokeStyle = colors.dark; ctx.lineWidth = 1.4 * px; ctx.stroke(); }
    else { ctx.fillStyle = col; ctx.fill(); if (isSel || v.cat !== 'prc') { ctx.strokeStyle = colors.halo; ctx.lineWidth = 1.2 * px; ctx.stroke(); } }
    hits.push({ v, x, y, dark, silentH });
  });
  // 4. gap end points: ring where the ship went dark, small square where it reappeared.
  // Silences under way at the scrubber time are drawn full size; the rest (pinned with "show every") small and faint.
  shown.forEach(g => {
    const active = t >= g.a.t && t <= g.b.t, sz = active ? 1 : 0.55;
    ctx.globalAlpha = active ? 1 : 0.45;
    const [x1, y1] = proj.project([g.a.lon, g.a.lat]), [x2, y2] = proj.project([g.b.lon, g.b.lat]);
    ctx.beginPath(); ctx.arc(x1, y1, 5 * sz * px, 0, 7);
    if (active) { ctx.fillStyle = colors.halo; ctx.fill(); }
    ctx.strokeStyle = colors.dark; ctx.lineWidth = (active ? 1.6 : 1) * px; ctx.stroke();
    const r = 3 * sz * px;
    ctx.fillStyle = colors.dark; ctx.fillRect(x2 - r, y2 - r, 2 * r, 2 * r);
    if (active) { ctx.strokeStyle = colors.halo; ctx.lineWidth = 1 * px; ctx.strokeRect(x2 - r, y2 - r, 2 * r, 2 * r); }
  });
  ctx.globalAlpha = 1;
  return hits;
}
