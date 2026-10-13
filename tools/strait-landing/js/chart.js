// The build-up race: PLA strength ashore against Taiwan's strength at the same beaches, turn by turn,
// with the sea state of each 12-hour turn as a strip underneath.
import { el } from '../../../shared/js/mapkit.js';
import { TURNS, ZONE_KEYS } from '../data/params.js';
import { BANDS } from './weather.js';

let W = 900;
const H = 280, L = 40, R = 30, T = 22, B = 58;
export const turnLabel = t => {
  if (t <= 0) return 'H-hour';
  const day = Math.floor((t - 1) / 2), half = (t - 1) % 2;
  return `${day ? `D+${day}` : 'D-day'} ${half ? 'night' : 'day'}`;
};

/**
 * hist: snapshots (index 0 = before H-hour). zone: a zone key or 'all'. seas: per turn {b, m} for that zone.
 * ghost: optional snapshots of a comparison plan on the same seed.
 */
export function drawRace(svg, { hist, zone, seas, ghost = null }) {
  svg.replaceChildren();
  W = matchMedia('(max-width: 640px)').matches ? 470 : 900;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pick = (s, k) => (zone === 'all' ? ZONE_KEYS.reduce((a, z) => a + s[k][z], 0) : s[k][zone]);
  const defPick = s => (zone === 'all' ? Math.max(...ZONE_KEYS.map(z => (s.ashore[z] > 0 ? s.def[z] : 0)), 0) : s.def[zone]);
  const series = hist.map(s => ({ A: pick(s, 'ashore'), F: pick(s, 'afloat'), D: defPick(s) }));
  const gser = ghost ? ghost.map(s => pick(s, 'ashore')) : [];
  const top = Math.max(20, ...series.map(v => Math.max(v.A + v.F, v.D)), ...gser);
  const ymax = Math.ceil(top / 10) * 10;
  const x = t => L + (W - L - R) * t / TURNS, y = v => T + (H - T - B) * (1 - v / ymax);
  const ax = el('g', { class: 'tsm-axis' }, svg);
  for (let v = 0; v <= ymax; v += ymax > 60 ? 20 : 10) {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'sl-grid' }, ax);
    el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, ax, String(v));
  }
  el('text', { x: 4, y: 11, class: 'sl-axt' }, ax, 'Strength (points, 1 ≈ 1,000 troops)');
  for (let t = 0; t <= TURNS; t += 2) el('text', { x: x(t), y: H - B + 16, 'text-anchor': 'middle' }, ax, t === 0 ? 'H-hour' : `D${t / 2 === 1 ? '' : `+${t / 2 - 1}`} end`.replace('D end', 'D-day end'));
  // Sea strip
  const sy = H - B + 26;
  el('text', { x: L - 6, y: sy + 10, 'text-anchor': 'end', class: 'sl-axt' }, ax, 'Seas');
  for (let t = 1; t <= TURNS; t++) {
    const s = seas[t - 1];
    const r = el('rect', { x: x(t - 1) + 1, y: sy, width: x(t) - x(t - 1) - 2, height: 14, class: 'sl-seacell', 'data-b': s ? s.b : 'x' }, svg);
    el('title', {}, r, s ? `${turnLabel(t)}: ${s.m ?? '?'} m, ${BANDS[s.b].t.toLowerCase()}` : `${turnLabel(t)}: not yet known`);
    if (s && s.m != null) el('text', { x: (x(t - 1) + x(t)) / 2, y: sy + 11, 'text-anchor': 'middle', class: 'sl-seanum' }, svg, `${s.m}`);
  }
  // Afloat band stacked above PLA ashore
  const n = series.length;
  if (n > 1) {
    const up = series.map((v, t) => `${x(t)},${y(v.A + v.F)}`), dn = series.map((v, t) => `${x(t)},${y(v.A)}`).reverse();
    el('polygon', { points: [...up, ...dn].join(' '), class: 'sl-afloat' }, svg);
  }
  if (ghost && ghost.length > 1) el('polyline', { points: gser.map((v, t) => `${x(t)},${y(v)}`).join(' '), class: 'sl-ghost' }, svg);
  el('polyline', { points: series.map((v, t) => `${x(t)},${y(v.D)}`).join(' '), class: 'sl-lineD' }, svg);
  el('polyline', { points: series.map((v, t) => `${x(t)},${y(v.A)}`).join(' '), class: 'sl-lineA' }, svg);
  series.forEach((v, t) => {
    el('circle', { cx: x(t), cy: y(v.A), r: 3, class: 'sl-dotA' }, svg);
    el('circle', { cx: x(t), cy: y(v.D), r: 3, class: 'sl-dotD' }, svg);
  });
  if (n <= TURNS) el('rect', { x: x(n - 1), y: T, width: x(TURNS) - x(n - 1), height: H - T - B, class: 'sl-future' }, svg);
  const last = series[n - 1];
  svg.setAttribute('aria-label', `Build-up race chart. After ${n - 1} of ${TURNS} turns the PLA has ${Math.round(last.A)} points ashore${last.F ? ` and ${Math.round(last.F)} afloat` : ''}; Taiwan has ${Math.round(last.D)} points at the same beaches.`);
}
