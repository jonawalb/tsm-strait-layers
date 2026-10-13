// Canvas renderer: a tilted map tile of the Strait with extruded, time-dependent layers. No library.
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { ADIZ } from '../../../shared/data/adiz.js';
import { toKm } from './camera.js';
import { LAYERS, ZONES, SECTORS, hasSector, zoneState, grayMonth, grayCells, AIS, aisOn, ALL } from './data.js';

const BOX = { lon0: 115, lon1: 125, lat0: 20, lat1: 28 };
const MEDIAN = [[122.0, 27.0], [118.0, 23.0]];
const TW = [120.95, 23.7];
export const PLACES = [
  ['Taipei', 121.56, 25.04, 'tw'], ['Kaohsiung', 120.3, 22.62, 'tw'], ['Hualien', 121.6, 23.98, 'tw'], ['Taichung', 120.68, 24.15, 'tw'],
  ['Kinmen', 118.35, 24.44, 'isl', 1], ['Matsu', 119.95, 26.16, 'isl'], ['Penghu', 119.58, 23.57, 'isl'], ['Dongsha', 116.72, 20.7, 'isl'],
  ['Yonaguni', 123.0, 24.47, 'isl'], ['Xiamen', 118.09, 24.48, 'cn'], ['Fuzhou', 119.3, 26.08, 'cn'], ['Wenzhou', 120.67, 28.0, 'cn'],
  ['Shantou', 116.68, 23.35, 'cn'], ['Batanes', 121.95, 20.45, 'isl'],
];
const km = pts => pts.map(toKm);
const LAND = LAND_TAIWAN.map(r => {
  const k = km(r);
  // Coast segments that lie on the clip-box edge are not drawn as coastline.
  const edge = r.map((p, i) => { const q = r[(i + 1) % r.length]; const on = v => Math.abs(v[0] - BOX.lon0) < 1e-3 || Math.abs(v[0] - BOX.lon1) < 1e-3 || Math.abs(v[1] - BOX.lat0) < 1e-3 || Math.abs(v[1] - BOX.lat1) < 1e-3; return on(p) && on(q); });
  return { k, edge };
});
const ADIZ_K = km(ADIZ), MEDIAN_K = km(MEDIAN), ROUTE_K = km(LAYERS.route);
const SECTOR_K = Object.fromEntries(SECTORS.map(s => [s, km(LAYERS.sectorInfo[s].poly)]));
const TILE = km([[BOX.lon0, BOX.lat0], [BOX.lon1, BOX.lat0], [BOX.lon1, BOX.lat1], [BOX.lon0, BOX.lat1]]);
const LOC = new Map(LAYERS.ccgLocs.map(l => [l.key, { ...l, k: toKm(l.at) }]));
const AIS_K = AIS.zones.map(z => ({ ...z, box: z.ring.length <= 5, k: km(z.ring) }));
const GMAX = Math.max(...LAYERS.gray.grid.map(c => c[4]));
const circleK = (c, r, n = 72) => Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
const TW_RING = circleK(toKm(TW), 255);

export function createScene(canvas, cam) {
  const ctx = canvas.getContext('2d');
  const probe = document.createElement('canvas').getContext('2d');
  let C = {};
  const rgba = (col, a) => {
    probe.fillStyle = '#000'; probe.fillStyle = col;
    const s = probe.fillStyle;
    if (s.startsWith('#')) { const n = parseInt(s.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
    return s.replace(/rgba?\(([^)]+)\)/, (m, v) => `rgba(${v.split(',').slice(0, 3).join(',')},${a})`);
  };
  const readTheme = () => {
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim() || '#888';
    C = { bg: g('--bg'), panel: g('--panel'), ink: g('--ink'), muted: g('--muted'), faint: g('--faint'), rule: g('--rule'), sea: g('--sea'),
      land: g('--land'), coast: g('--coast'), grat: g('--grat'), prc: g('--prc'), ccg: g('--ccg'), mil: g('--c5'), us: g('--us'),
      accent: g('--accent'), roc: g('--roc'), cable: g('--c3'), ais: g('--c7'), font: g('--body'), mono: g('--mono'), display: g('--display') };
    C.dark = matchMedia('(prefers-color-scheme: dark)').matches;
  };
  readTheme();

  const P = (p, z = 0) => cam.project(p[0], p[1], z);
  const path = (pts, z = 0, close = true) => {
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = P(p, z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (close) ctx.closePath();
  };
  const centroid = pts => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  let hits = [];

  /** An extruded polygon, painted back to front. */
  function prism(pts, z0, z1, fill, side, stroke) {
    const n = pts.length;
    const faces = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      faces.push({ a, b, d: P(m, (z0 + z1) / 2)[2] });
    }
    faces.sort((p, q) => q.d - p.d);
    faces.forEach(f => {
      ctx.beginPath();
      const [x1, y1] = P(f.a, z0), [x2, y2] = P(f.b, z0), [x3, y3] = P(f.b, z1), [x4, y4] = P(f.a, z1);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath();
      ctx.fillStyle = side; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.6; ctx.stroke(); }
    });
    path(pts, z1); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
    return pts.map(p => P(p, z1));
  }

  function base() {
    const { w, h } = cam;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, C.panel); sky.addColorStop(1, C.bg);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    // Map tile with thickness.
    prism(TILE, -22, 0, C.sea, rgba(C.coast, C.dark ? 0.55 : 0.45), null);
    // Graticule.
    ctx.strokeStyle = rgba(C.grat, 0.9); ctx.lineWidth = 0.7;
    for (let lon = 116; lon < 125; lon++) path([toKm([lon, BOX.lat0]), toKm([lon, BOX.lat1])], 0, false), ctx.stroke();
    for (let lat = 21; lat < 28; lat++) path([toKm([BOX.lon0, lat]), toKm([BOX.lon1, lat])], 0, false), ctx.stroke();
    // Land: a shadow pass at sea level, then the land surface raised slightly.
    ctx.fillStyle = rgba(C.coast, 0.55);
    LAND.forEach(r => { path(r.k, 0); ctx.fill(); });
    ctx.fillStyle = C.land;
    LAND.forEach(r => { path(r.k, 3); ctx.fill(); });
    ctx.strokeStyle = C.coast; ctx.lineWidth = 0.8;
    LAND.forEach(r => {
      ctx.beginPath();
      r.k.forEach((p, i) => { if (r.edge[i]) return; const [x1, y1] = P(p, 3), [x2, y2] = P(r.k[(i + 1) % r.k.length], 3); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); });
      ctx.stroke();
    });
    // ADIZ and the median (Davis) line.
    ctx.setLineDash([6, 4]); ctx.strokeStyle = rgba(C.muted, 0.85); ctx.lineWidth = 1.1;
    path(ADIZ_K, 0.5); ctx.stroke();
    ctx.setLineDash([2, 4]); ctx.strokeStyle = rgba(C.ink, 0.6);
    path(MEDIAN_K, 0.5, false); ctx.stroke();
    ctx.setLineDash([]);
  }

  function draw(S) {
    const dpr = canvas.width / cam.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hits = [];
    base();
    const day = S.day, d = day.d, L = S.layers, objs = [];

    // Flat overlays first.
    if (L.ais && aisOn(d)) {
      const max = Math.max(1, ...AIS_K.map(z => z.entries[d] || 0));
      AIS_K.forEach(z => {
        const n = z.entries[d] || 0;
        path(z.k, 1);
        if (!z.box) { ctx.fillStyle = rgba(C.ais, n ? 0.1 + 0.4 * n / max : 0.03); ctx.fill(); }
        ctx.strokeStyle = rgba(C.ais, n ? 0.9 : 0.35); ctx.lineWidth = n ? 1.2 : 0.7; ctx.stroke();
        if (n) hits.push({ kind: 'ais', pts: z.k.map(p => P(p, 1)), data: { ...z, n } });
      });
    }
    if (L.flags && day.flag) {
      const col = day.flag.includes('J') ? C.accent : C.us;
      ctx.save(); ctx.setLineDash([10, 7]); ctx.lineDashOffset = S.reduced ? 0 : -S.t * 0.02;
      ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 2.2; path(TW_RING, 2); ctx.stroke(); ctx.restore();
      path(TW_RING, 2); ctx.fillStyle = rgba(col, 0.06); ctx.fill();
    }
    if (L.zones && S.ex) {
      const Z = ZONES[S.ex.x.id];
      (Z?.zones || []).forEach(z => {
        const st = zoneState(z, d), k = km(z.pts.slice(0, -1));
        if (st === 'hidden') return;
        if (st === 'on') { objs.push({ d: P(centroid(k), 15)[2], draw: () => { const top = prism(k, 0, 30, rgba(C.prc, 0.34), rgba(C.prc, 0.2), rgba(C.prc, 0.95)); hits.push({ kind: 'zone', pts: top, data: { z, st, ex: S.ex.x } }); } }); return; }
        ctx.setLineDash(st === 'pending' ? [5, 4] : [2, 3]);
        path(k, 1); ctx.strokeStyle = rgba(C.prc, st === 'pending' ? 0.95 : 0.4); ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = rgba(C.prc, st === 'pending' ? 0.08 : 0.03); ctx.fill(); ctx.setLineDash([]);
        hits.push({ kind: 'zone', pts: k.map(p => P(p, 1)), data: { z, st, ex: S.ex.x } });
      });
    }
    if (L.sectors && day.mask) {
      const adiz = day.v.adiz;
      const top = 2 + (adiz != null ? 1.8 * Math.sqrt(adiz) : 3);
      SECTORS.filter(s => hasSector(day, s)).forEach(s => {
        const k = SECTOR_K[s];
        objs.push({ d: P(centroid(k), top / 2)[2] + 400, draw: () => { const t = prism(k, 0, top, rgba(C.prc, 0.13), rgba(C.prc, 0.22), rgba(C.prc, 0.55)); hits.push({ kind: 'sector', pts: t, data: { s, adiz } }); } });
      });
    }
    if (L.gray) {
      const mi = grayMonth(d);
      if (mi >= 0) {
        const c = LAYERS.gray.cell, pad = c * 0.12;
        grayCells(mi).forEach(([m, i, j, f, n]) => {
          const lon0 = i * c + pad, lat0 = j * c + pad, lon1 = (i + 1) * c - pad, lat1 = (j + 1) * c - pad;
          const off = f ? c * 0.38 : 0;  // militia column sits beside the coast guard one in a shared cell
          const k = km([[lon0 + off, lat0], [lon1 - (f ? 0 : c * 0.38), lat0], [lon1 - (f ? 0 : c * 0.38), lat1], [lon0 + off, lat1]]);
          const hgt = 4 + 90 * Math.sqrt(n / GMAX), col = f ? C.mil : C.ccg;
          objs.push({ d: P(centroid(k), hgt / 2)[2], draw: () => { const t = prism(k, 0, hgt, rgba(col, 0.92), rgba(col, 0.55), rgba(C.ink, 0.25)); hits.push({ kind: 'gray', pts: t, data: { mi, i, j, f, n } }); } });
        });
      }
    }
    if (L.transits && day.transits.length) {
      ctx.strokeStyle = rgba(C.us, 0.9); ctx.lineWidth = 3; path(ROUTE_K, 2, false); ctx.stroke();
      const tot = ROUTE_K.length - 1, phase = S.reduced ? 0.5 : (S.t / 4000) % 1;
      for (let q = 0; q < 4; q++) {
        const u = ((phase + q / 4) % 1) * tot, a = ROUTE_K[Math.floor(u)], b = ROUTE_K[Math.min(tot, Math.floor(u) + 1)], f = u % 1;
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], [x, y] = P(p, 2);
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fillStyle = C.us; ctx.fill();
      }
      const mid = P(ROUTE_K[2], 2);
      hits.push({ kind: 'transit', c: mid, r: 22, data: day.transits });
      label(day.transits.map(t => t.name).join(', '), mid[0] + 10, mid[1] - 10, C.us, 'left', true);
    }
    if (L.ccg) {
      const span = L.trail ? 13 : 0, byLoc = new Map();
      for (let b = 0; b <= span; b++) {
        const rec = ALL[day.i - b];
        if (!rec) break;
        rec.ccg.forEach(x => { const o = byLoc.get(x.loc) || byLoc.set(x.loc, { today: [], past: [] }).get(x.loc); (b ? o.past : o.today).push({ x, b }); });
      }
      byLoc.forEach((o, loc) => {
        const L0 = LOC.get(loc);
        if (!L0 || L0.at[1] < BOX.lat0) return;
        objs.push({ d: P(L0.k, 30)[2] - 200, draw: () => pin(L0, o) });
      });
    }
    if (L.cables) {
      for (let b = 0; b <= 30; b++) {
        const rec = ALL[day.i - b];
        if (!rec) break;
        rec.cables.filter(c => c.at).forEach(c => objs.push({ d: P(toKm(c.at), 10)[2] - 300, draw: () => cable(c, b) }));
      }
    }
    objs.sort((a, b) => b.d - a.d).forEach(o => o.draw());
    if (L.labels) places(S);
    return hits;
  }

  function pin(L0, o) {
    const n = o.today.length, base = P(L0.k, 3);
    const alphaPast = o.past.length ? Math.max(...o.past.map(p => 1 - p.b / 14)) : 0;
    if (!n && alphaPast) {
      ctx.beginPath(); ctx.arc(base[0], base[1], 5, 0, 7); ctx.fillStyle = rgba(C.ccg, 0.15 + 0.5 * alphaPast); ctx.fill();
      hits.push({ kind: 'ccg', c: base, r: 9, data: { loc: L0, list: o.past.map(p => p.x), past: true } });
      return;
    }
    if (!n) return;
    const h = 40 + 18 * (n - 1), top = P(L0.k, h);
    ctx.beginPath(); ctx.ellipse(base[0], base[1], 12, 5, 0, 0, 7); ctx.fillStyle = rgba(C.ccg, 0.3); ctx.fill();
    ctx.strokeStyle = C.ccg; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
    ctx.beginPath(); ctx.arc(top[0], top[1], 7, 0, 7); ctx.fillStyle = C.ccg; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.panel; ctx.stroke();
    if (n > 1) label('×' + n, top[0] + 10, top[1] + 4, C.ccg, 'left');
    hits.push({ kind: 'ccg', c: top, r: 12, data: { loc: L0, list: o.today.map(p => p.x) } });
  }

  function cable(c, b) {
    const a = 1 - b / 31, [x, y] = P(toKm(c.at), 2), [tx, ty] = P(toKm(c.at), 28);
    ctx.strokeStyle = rgba(C.cable, a); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(tx, ty - 7); ctx.lineTo(tx + 6, ty); ctx.lineTo(tx, ty + 7); ctx.lineTo(tx - 6, ty); ctx.closePath();
    ctx.fillStyle = rgba(C.cable, a); ctx.fill(); ctx.strokeStyle = rgba(C.panel, a); ctx.lineWidth = 1.2; ctx.stroke();
    hits.push({ kind: 'cable', c: [tx, ty], r: 11, data: { c, b } });
  }

  function label(text, x, y, col, align = 'center', strong = false) {
    ctx.font = `${strong ? 600 : 500} 12px ${C.font}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5; ctx.strokeStyle = rgba(C.panel, 0.92); ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y);
  }
  function places() {
    PLACES.forEach(([name, lon, lat, kind, below]) => {
      const [x, y, dep] = cam.ll(lon, lat, 4);
      if (cam.w < 560 && (kind === 'cn' || name === 'Taichung' || name === 'Hualien')) return;
      if (dep < 60 || x < -40 || x > cam.w + 40 || y < -10 || y > cam.h + 10) return;
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fillStyle = kind === 'cn' ? C.muted : C.ink; ctx.fill();
      label(name, x + 6, below ? y + 9 : y - 8, kind === 'cn' ? C.muted : C.ink, 'left');
    });
    const [mx, my] = cam.ll(119.6, 24.6, 1);
    ctx.save(); ctx.font = `500 10.5px ${C.mono}`; ctx.fillStyle = C.muted; ctx.textAlign = 'center';
    ctx.fillText('median line', mx, my); ctx.restore();
  }

  return { draw, readTheme, get hits() { return hits; } };
}
