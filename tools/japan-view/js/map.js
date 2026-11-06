// Map: Japan's southwestern islands to Hokkaido, strait-crossing arrows, hull trails and carrier episodes.
import { createProjection, drawBasemap, el, destination, escapeHtml } from '../../../shared/js/mapkit.js';
import { LAND_INDOPAC } from '../../../shared/data/land-indopac.js';
import { STRAITS, STRAIT, ROWS, JSO, niceShort, nice, shipLabel, DIR_WORD } from './model.js';

const EXT = { lon0: 119, lon1: 148, lat0: 19.5, lat1: 46.6, width: 1000 };
const LABELS = [
  ['CHINA', 120.4, 31.6, 't-country'], ['TAIWAN', 120.95, 23.1, 't-country sm'], ['JAPAN', 138.2, 36.9, 't-country'],
  ['KOREA', 127.8, 37.3, 't-country sm'], ['RUSSIA', 136.5, 45.8, 't-country sm'],
  ['East China Sea', 125.3, 29.6, 't-sea'], ['Sea of Japan', 134.2, 40.7, 't-sea'], ['Pacific Ocean', 142.5, 30.5, 't-sea'],
  ['Philippine Sea', 131.5, 22.3, 't-sea'], ['Okinawa', 128.3, 26.55, 't-place'], ['Kyushu', 131.3, 32.4, 't-place'],
];
const HALF = 26; // half-length of a crossing arrow, map units

export function createMap(svg, tip, { onPick, onHover }) {
  const proj = createProjection(EXT);
  drawBasemap(svg, proj, LAND_INDOPAC, { gratStep: 5 });
  const P = p => proj.project(p);
  const lab = el('g', { class: 'labels' }, svg);
  LABELS.forEach(([t, lon, lat, c]) => { const [x, y] = P([lon, lat]); el('text', { x, y, class: c, 'text-anchor': 'middle' }, lab, t); });
  const epiG = el('g', { class: 'episodes' }, svg);
  const trailG = el('g', { class: 'trail' }, svg);
  const gatesG = el('g', { class: 'gates' }, svg);

  // One pair of arrows per strait: outbound (toward outTo) and inbound.
  const G = {};
  STRAITS.forEach(s => {
    const [cx, cy] = P(s.at);
    const g = el('g', { class: 'gate' }, gatesG);
    g.style.setProperty('--sc', s.color);
    const dirs = {};
    for (const out of [true, false]) {
      const b = out ? s.out : (s.out + 180) % 360;
      const [ux, uy] = unit(proj, s.at, b);
      const side = out ? 1 : -1, off = 7;
      const px = -uy * off * side, py = ux * off * side;
      const x0 = cx - ux * HALF + px, y0 = cy - uy * HALF + py, x1 = cx + ux * HALF + px, y1 = cy + uy * HALF + py;
      const a = el('g', { class: 'arrow', tabindex: 0, role: 'button' }, g);
      el('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'hit' }, a);
      const line = el('line', { x1: x0, y1: y0, x2: x1 - ux * 6, y2: y1 - uy * 6, class: 'shaft' }, a);
      const head = el('path', { d: headPath(x1, y1, ux, uy, 9), class: 'head' }, a);
      const n = el('text', { x: x1 + ux * 12 + px * .6, y: y1 + uy * 12 + py * .6 + 4, class: 'n', 'text-anchor': 'middle' }, a, '');
      const key = { s: s.key, out };
      a.addEventListener('click', () => onPick(key));
      a.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(key); } });
      a.addEventListener('pointerenter', e => onHover(key, e));
      a.addEventListener('pointermove', e => onHover(key, e));
      a.addEventListener('pointerleave', () => onHover(null));
      a.addEventListener('focus', () => onHover(key, null, a));
      a.addEventListener('blur', () => onHover(null));
      dirs[out ? 'o' : 'i'] = { a, line, head, n };
    }
    const [lx, ly] = s.lab;
    el('text', { x: cx + lx, y: cy + ly, class: 'gate-name', 'text-anchor': s.anchor || 'start' }, g, s.short);
    G[s.key] = dirs;
  });
  svg.appendChild(trailG);

  function update({ counts, sel, hullRows, episodes, showEp }) {
    STRAITS.forEach(s => {
      for (const k of ['o', 'i']) {
        const d = G[s.key][k], n = counts[s.key]?.[k] || 0;
        d.a.classList.toggle('zero', n === 0);
        d.line.setAttribute('stroke-width', n ? (1.6 + Math.sqrt(n) * 1.25).toFixed(1) : 1);
        d.n.textContent = n || '';
        d.a.setAttribute('aria-label', `${s.name}, toward the ${k === 'o' ? s.outTo : s.inTo}: ${n} crossings`);
        d.a.classList.toggle('sel', !!sel && sel.strait === s.key && sel.out === (k === 'o'));
      }
    });
    drawTrail(hullRows);
    drawEpisodes(showEp ? episodes : []);
  }

  function drawTrail(rows) {
    trailG.replaceChildren();
    if (!rows || !rows.length) return;
    const seen = {};
    rows.forEach((r, k) => {
      const [cx, cy] = P(STRAIT[r.strait].at);
      const j = seen[r.strait] = (seen[r.strait] ?? -1) + 1;
      const a = -Math.PI / 2 + j * 0.9, rad = 30 + Math.floor(j / 7) * 20;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      el('line', { x1: cx, y1: cy, x2: x, y2: y, class: 'trail-line' }, trailG);
      const g = el('g', { class: 'trail-pt', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, trailG);
      el('circle', { r: 9 }, g);
      el('text', { y: 3.5, 'text-anchor': 'middle' }, g, String(k + 1));
    });
  }

  function drawEpisodes(list) {
    epiG.replaceChildren();
    list.forEach(ep => {
      const pts = ep.pts.filter(p => p[1] >= EXT.lon0 && p[1] <= EXT.lon1 && p[2] >= EXT.lat0 && p[2] <= EXT.lat1);
      if (!pts.length) return;
      const xy = pts.map(p => P([p[1], p[2]]));
      const g = el('g', { class: `ep ${ep.kind}` }, epiG);
      if (xy.length > 1) el('path', { d: 'M' + xy.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L'), class: 'ep-line' }, g);
      pts.forEach((p, k) => {
        const [x, y] = xy[k];
        const d = el('path', { d: `M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z`, class: 'ep-pt', tabindex: 0 }, g);
        const html = `<b>${escapeHtml(ep.title)}</b><span class="tt-d">${nice(p[0])}, ${escapeHtml(p[3])}</span>${p[4].map(shipLabel).join(', ')}`;
        d.addEventListener('pointerenter', e => showTip(html, e));
        d.addEventListener('pointerleave', () => { tip.hidden = true; });
        d.addEventListener('focus', () => showTip(html, null, d));
        d.addEventListener('blur', () => { tip.hidden = true; });
      });
      const [lx, ly] = xy[xy.length - 1];
      el('text', { x: lx + 9, y: ly + 4, class: 'ep-lab' }, g, niceShort(pts[pts.length - 1][0]));
    });
  }

  function showTip(html, e, anchor) {
    tip.innerHTML = html;
    tip.hidden = false;
    place(tip, svg, e, anchor);
  }

  return { update, showTip, hideTip: () => { tip.hidden = true; }, place: (e, a) => place(tip, svg, e, a) };
}

/** Screen-space unit vector for a bearing at a point (the projection is not conformal). */
function unit(proj, at, b) {
  const [x0, y0] = proj.project(at), [x1, y1] = proj.project(destination(at, b, 50));
  const L = Math.hypot(x1 - x0, y1 - y0);
  return [(x1 - x0) / L, (y1 - y0) / L];
}
const headPath = (x, y, ux, uy, s) => `M${x} ${y}L${x - ux * s - uy * s * .6} ${y - uy * s + ux * s * .6}L${x - ux * s + uy * s * .6} ${y - uy * s - ux * s * .6}Z`;

export function place(tip, svg, e, anchor) {
  const box = svg.parentElement.getBoundingClientRect();
  let x, y;
  if (e) { x = e.clientX - box.left; y = e.clientY - box.top; } else {
    const r = anchor.getBoundingClientRect(); x = r.left + r.width / 2 - box.left; y = r.top - box.top;
  }
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(4, Math.min(box.width - w - 4, x + 14)) + 'px';
  tip.style.top = Math.max(4, y + h + 20 > box.height ? y - h - 12 : y + 14) + 'px';
}

/** Tooltip HTML for an arrow group. */
export function arrowTip(key, rows) {
  const s = STRAIT[key.s];
  const last = rows[rows.length - 1];
  return `<b>${s.name}</b><span class="tt-d">${s.note}; toward the ${key.out ? s.outTo : s.inTo}</span>` +
    `${rows.length} crossing${rows.length === 1 ? '' : 's'} in this window` +
    (last ? `<small>Latest: ${nice(last.date)}, heading ${DIR_WORD[last.dir]}. ${last.ships.map(shipLabel).join(', ')}</small>` : '');
}
export { JSO, ROWS };
