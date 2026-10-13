// SVG map: basemap, range rings, geography layers, units, zoom/pan and pointer handling.
import { W, H, project, unproject, destination, circlePath, linePath, distKm, el, fmt } from './geo.js';
import { COAST, TS12, CZ24, ADIZ } from './data/geo.js';
import { PLA, TAIWAN, BASES, FUJIAN, MEDIAN_LINE, FIRST_ISLAND_CHAIN, PLACES, SEAS } from './layers.js';

const LABEL_BEARING = { df26: 110, df21: 90, srbm: 345, ascm: 40, sam: 195, sig: 75, aew: 15, surf: 300, sky: 70,
  twascm: 200, twatacms: 285, twmpa: 150, twradar: 240, twdrone: 250 };
const labelFits = ([x, y]) => x > 95 && x < W - 95 && y > 30 && y < H - 30;

export function createMap(svg, handlers) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const root = el('g', {}, svg);
  el('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H, fill: 'var(--sea)' }, root);
  const g = {};
  for (const k of ['grat', 'geoUnder', 'land', 'geo', 'rings', 'twRings', 'labels', 'overlay', 'bases', 'route', 'lines', 'units', 'measure']) {
    g[k] = el('g', { class: 'g-' + k }, root);
  }

  // Graticule
  for (let lon = 112; lon <= 134; lon += 2) {
    const [x] = project([lon, 0]);
    el('line', { x1: x, y1: 0, x2: x, y2: H, class: 'grat' }, g.grat);
    el('text', { x: x + 3, y: H - 6, class: 't-grat' }, g.grat, lon + '°E');
  }
  for (let lat = 18; lat <= 32; lat += 2) {
    const [, y] = project([0, lat]);
    el('line', { x1: 0, y1: y, x2: W, y2: y, class: 'grat' }, g.grat);
    el('text', { x: 4, y: y - 3, class: 't-grat' }, g.grat, lat + '°N');
  }

  // Geography layers
  const geo = {};
  geo.cz24 = el('path', { d: CZ24, class: 'zone zone-24' }, g.geoUnder);
  geo.ts12 = el('path', { d: TS12, class: 'zone zone-12' }, g.geoUnder);
  el('path', { d: COAST, class: 'land', 'fill-rule': 'evenodd' }, g.land);
  geo.adiz = el('g', {}, g.geo);
  el('path', { d: linePath(ADIZ) + 'Z', class: 'adiz' }, geo.adiz);
  const [ax, ay] = project([123.1, 26.2]);
  el('text', { x: ax, y: ay, class: 't-geo' }, geo.adiz, 'Taiwan ADIZ');
  geo.median = el('g', {}, g.geo);
  el('path', { d: linePath(MEDIAN_LINE), class: 'median' }, geo.median);
  const [mx, my] = project([121.2, 26.35]);
  el('text', { x: mx, y: my, class: 't-geo', transform: `rotate(-47 ${mx} ${my})` }, geo.median, 'Median line');
  geo.fic = el('g', {}, g.geo);
  el('path', { d: linePath(FIRST_ISLAND_CHAIN), class: 'fic' }, geo.fic);
  const [fx, fy] = project([128.9, 27.6]);
  el('text', { x: fx, y: fy, class: 't-geo t-fic', transform: `rotate(-58 ${fx} ${fy})` }, geo.fic, 'First Island Chain');
  const [zx, zy] = project([121.9, 22.2]);
  geo.zlabel = el('text', { x: zx, y: zy, class: 't-geo t-zone' }, g.geoUnder, '12 / 24 nm');

  // Range rings
  const unionOutline = (centers, r) => {
    let d = '';
    centers.forEach(c => {
      let run = [];
      const flush = () => { if (run.length > 1) d += 'M' + run.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L'); run = []; };
      for (let b = 0; b <= 360; b += 2) {
        const ll = destination(c, b, r);
        if (centers.some(o => o !== c && distKm(o, ll) < r - 0.5)) flush(); else run.push(project(ll));
      }
      flush();
    });
    return d;
  };
  const rings = {};
  const drawRing = (layer, parent) => {
    const grp = el('g', { class: 'ring', 'data-id': layer.id }, parent);
    const cls = 'ring-path' + (layer.role === 'sensor' ? ' sensor' : '') + (layer.r >= 2000 ? ' huge' : layer.r >= 800 ? ' big' : '');
    const centers = layer.cs || [layer.c];
    const col = `var(${layer.col})`;
    if (centers.length === 1) {
      const d = circlePath(centers[0], layer.r) + (layer.rin ? circlePath(centers[0], layer.rin) : '');
      el('path', { d, class: cls, 'fill-rule': 'evenodd', stroke: col, fill: col }, grp);
    } else {
      // Union of several circles: one nonzero fill, and an outline that skips arcs inside other circles.
      el('path', { d: centers.map(c => circlePath(c, layer.r)).join(''), class: cls, stroke: 'none', fill: col, 'fill-rule': 'nonzero' }, grp);
      el('path', { d: unionOutline(centers, layer.r), class: cls + ' outline', stroke: col, fill: 'none' }, grp);
    }
    const b0 = LABEL_BEARING[layer.id] ?? 45;
    for (const c of centers.slice(0, 1).concat(centers.slice(1))) {
      for (const b of [b0, b0 + 25, b0 - 25, b0 + 60, b0 - 60, b0 + 120, b0 + 180]) {
        const ll = destination(c, b, layer.r);
        const p = project(ll);
        if (labelFits(p) && !centers.some(o => o !== c && distKm(o, ll) < layer.r - 1)) {
          el('text', { x: p[0], y: p[1] - 4, class: 't-ring', 'text-anchor': 'middle', fill: `var(${layer.col})` }, grp,
            (layer.short || layer.name.split(' (')[0]) + ' ' + layer.rng.replace('*', ''));
          return grp;
        }
      }
    }
    return grp;
  };
  [...PLA].sort((a, b) => b.r - a.r).forEach(l => { rings[l.id] = drawRing(l, g.rings); });
  [...TAIWAN].sort((a, b) => b.r - a.r).forEach(l => { rings[l.id] = drawRing(l, g.twRings); });
  const centers = [...new Set(PLA.map(l => l.c.join(',')))].map(s => s.split(',').map(Number));
  centers.forEach(c => { const [x, y] = project(c); el('path', { d: `M${x} ${y - 5}L${x + 4.5} ${y + 3.5}L${x - 4.5} ${y + 3.5}Z`, class: 'launch' }, g.rings); });

  // Labels
  PLACES.forEach(([n, lon, lat, side]) => {
    const [x, y] = project([lon, lat]);
    el('circle', { cx: x, cy: y, r: 1.8, class: 'place-dot' }, g.labels);
    el('text', { x: x + side * 5, y: y + 3.5, class: 't-place', 'text-anchor': side > 0 ? 'start' : 'end' }, g.labels, n);
  });
  SEAS.forEach(([n, lon, lat, rot]) => {
    const [x, y] = project([lon, lat]);
    el('text', { x, y, class: 't-sea', 'text-anchor': 'middle', transform: rot ? `rotate(${rot} ${x} ${y})` : '' }, g.labels, n);
  });
  { const [x, y] = project([121.05, 23.6]); el('text', { x, y, class: 't-big', 'text-anchor': 'middle', transform: `rotate(-72 ${x} ${y})` }, g.labels, 'TAIWAN'); }
  { const [x, y] = project([116.8, 28.2]); el('text', { x, y, class: 't-big', 'text-anchor': 'middle' }, g.labels, 'CHINA'); }
  { const y = project([0, 17.2])[1];
    el('path', { d: `M${W - 52} ${y}L${W - 14} ${y}`, class: 'guam-arrow', 'marker-end': 'url(#arrow-ally)' }, g.labels);
    el('text', { x: W - 56, y: y + 4, class: 't-base', 'text-anchor': 'end' }, g.labels, 'Guam ' + fmt(distKm(FUJIAN, [144.8, 13.44])) + ' km from Pingtan'); }

  // Allied sites
  BASES.filter(b => !b.hidden).forEach(b => {
    const [x, y] = project(b.c);
    el('rect', { x: x - 3.5, y: y - 3.5, width: 7, height: 7, class: 'base', transform: `rotate(45 ${x} ${y})` }, g.bases);
    el('text', { x: x + 7, y: y + 11 + (b.dy || 0), class: 't-base' }, g.bases, b.short || b.n);
  });

  // Units
  const units = {};
  const mkUnit = (key, label) => {
    const u = el('g', { class: 'unit unit-' + key, tabindex: 0, role: 'button', 'aria-label': `${label}: drag, or use arrow keys to move` }, g.units);
    const inner = el('g', {}, u);
    el('circle', { r: 16, class: 'pulse' }, inner);
    el('circle', { r: 22, class: 'hit' }, inner);
    if (key === 'blue') {
      el('ellipse', { rx: 13, ry: 8, class: 'sym' }, inner);
      el('path', { d: 'M-6 2L6 2L4 -3L-4 -3Z', class: 'sym-in' }, inner);
    } else {
      el('path', { d: 'M0 -12L12 0L0 12L-12 0Z', class: 'sym' }, inner);
      el('path', { d: 'M-5 3L5 3L3 -2L-3 -2Z', class: 'sym-in' }, inner);
    }
    const t = el('text', { x: 18, y: -12, class: 't-unit' }, inner, label);
    units[key] = { g: u, inner, text: t, pos: null };
    u.addEventListener('keydown', e => {
      const step = e.shiftKey ? 0.5 : 0.1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (!d || !units[key].pos) return;
      e.preventDefault();
      handlers.onUnitDrag(key, [units[key].pos[0] + d[0], units[key].pos[1] + d[1]]);
    });
  };
  mkUnit('blue', 'U.S. surface group');
  mkUnit('red', 'PLA amphibious group');

  // Zoom and pan
  const vb = { x: 0, y: 0, w: W, h: H };
  const applyVB = () => {
    vb.w = Math.max(W / 6, Math.min(W, vb.w)); vb.h = vb.w * H / W;
    vb.x = Math.max(0, Math.min(W - vb.w, vb.x)); vb.y = Math.max(0, Math.min(H - vb.h, vb.y));
    svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
    const z = W / vb.w;
    svg.style.setProperty('--z', z.toFixed(3));
    Object.values(units).forEach(u => u.pos && placeUnit(u));
    handlers.onZoom?.(z);
  };
  const zoomAt = (factor, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => {
    const nw = Math.max(W / 6, Math.min(W, vb.w / factor)), f = nw / vb.w;
    vb.x = cx - (cx - vb.x) * f; vb.y = cy - (cy - vb.y) * f; vb.w = nw; applyVB();
  };
  const zoomToBox = ([lon0, lat0, lon1, lat1]) => {
    const [x0, y0] = project([lon0, lat1]), [x1, y1] = project([lon1, lat0]);
    const w = Math.max(x1 - x0, (y1 - y0) * W / H);
    vb.w = w; vb.x = (x0 + x1) / 2 - w / 2; vb.y = (y0 + y1) / 2 - (w * H / W) / 2; applyVB();
  };
  const toMap = e => {
    const r = svg.getBoundingClientRect();
    return [vb.x + (e.clientX - r.left) / r.width * vb.w, vb.y + (e.clientY - r.top) / r.height * vb.h];
  };

  const pointers = new Map();
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, e);
    svg.setPointerCapture(e.pointerId);
    const unitEl = e.target.closest?.('.unit');
    const key = unitEl ? (unitEl.classList.contains('unit-blue') ? 'blue' : 'red') : null;
    drag = { key, start: [e.clientX, e.clientY], vb: { ...vb }, moved: false, pinch: null };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      drag.pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), w: vb.w };
    }
  });
  svg.addEventListener('pointermove', e => {
    if (!drag || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    const dx = e.clientX - drag.start[0], dy = e.clientY - drag.start[1];
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const target = drag.pinch.w * drag.pinch.d / d;
      zoomAt(vb.w / target, ...toMap({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }));
      return;
    }
    if (drag.key) { handlers.onUnitDrag(drag.key, unproject(...toMap(e))); return; }
    if (drag.moved && vb.w < W) {
      const r = svg.getBoundingClientRect();
      vb.x = drag.vb.x - dx / r.width * vb.w; vb.y = drag.vb.y - dy / r.height * vb.h; applyVB();
      svg.classList.add('panning');
    }
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (drag && !drag.moved && !drag.key && !drag.pinch && e.type === 'pointerup') handlers.onClick(unproject(...toMap(e)));
    if (pointers.size === 0) { drag = null; svg.classList.remove('panning'); }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.01), ...toMap(e));
  }, { passive: false });

  function placeUnit(u) {
    const [x, y] = project(u.pos), z = W / vb.w;
    u.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(1 / z).toFixed(3)})`);
    const right = x > vb.x + vb.w * 0.8;
    u.text.setAttribute('x', right ? -18 : 18);
    u.text.setAttribute('text-anchor', right ? 'end' : 'start');
  }

  // Measure tool
  const drawMeasure = pts => {
    g.measure.innerHTML = '';
    if (!pts.length) return;
    pts.forEach(p => { const [x, y] = project(p); el('circle', { cx: x, cy: y, r: 4, class: 'measure-pt' }, g.measure); });
    if (pts.length < 2) return;
    el('path', { d: linePath(pts), class: 'measure-line' }, g.measure);
    const km = distKm(pts[0], pts[1]);
    const [x, y] = project([(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2]);
    el('text', { x, y: y - 8, class: 't-measure', 'text-anchor': 'middle' }, g.measure, `${fmt(km)} km · ${fmt(km / 1.852)} nm`);
  };

  applyVB();
  return {
    g, rings, geo, units,
    setUnit(key, pos, { state = '', visible = true } = {}) {
      const u = units[key];
      u.g.style.display = visible && pos ? '' : 'none';
      if (!pos) return;
      u.pos = pos; u.g.dataset.state = state; placeUnit(u);
    },
    setLines(lines) {
      g.lines.innerHTML = '';
      lines.forEach(({ from, to, col }) => {
        const [x1, y1] = project(from), [x2, y2] = project(to);
        el('line', { x1, y1, x2, y2, class: 'fire-line', stroke: `var(${col})` }, g.lines);
      });
    },
    setRoute(pts, cls) {
      g.route.innerHTML = '';
      if (pts) el('path', { d: linePath(pts), class: 'route ' + cls, 'marker-end': `url(#arrow-${cls})` }, g.route);
    },
    drawMeasure,
    zoomIn: () => zoomAt(1.6), zoomOut: () => zoomAt(1 / 1.6), zoomToBox,
    reset: () => { vb.x = 0; vb.y = 0; vb.w = W; applyVB(); },
  };
}
