// "Why Kinmen": monthly China Coast Guard incidents in TSM's 2026 tracker, Kinmen versus everywhere else.
import { TSM } from '../../../shared/data/tsm.js';
import { el } from '../../../shared/js/mapkit.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function kinmenStats() {
  const rows = TSM.ccg.filter(r => r[0].startsWith('2026'));
  const k = rows.filter(r => r[1] === 'Kinmen').length;
  // The CCG tracker ends at its latest recorded incident, which is earlier than the PLA daily series' asOf.
  const last = rows.reduce((m, r) => (r[0] > m ? r[0] : m), '');
  return { total: rows.length, kinmen: k, asOf: last };
}

export function drawKinmen(svg) {
  const rows = TSM.ccg.filter(r => r[0].startsWith('2026'));
  const lastM = Number(TSM.asOf.slice(5, 7));
  const months = MON.slice(0, lastM).map((m, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const inM = rows.filter(r => r[0].slice(5, 7) === mm);
    return { m, k: inM.filter(r => r[1] === 'Kinmen').length, o: inM.filter(r => r[1] !== 'Kinmen').length };
  });
  const W = 520, H = 150, L = 26, B = 22, T = 10;
  const max = Math.max(4, ...months.map(d => d.k + d.o));
  const bw = (W - L - 6) / months.length;
  const y = v => T + (H - T - B) * (1 - v / max);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  for (let v = 0; v <= max; v += 2) {
    el('line', { x1: L, x2: W, y1: y(v), y2: y(v), class: 'kgrid' }, svg);
    el('text', { x: L - 5, y: y(v) + 3, class: 'kax', 'text-anchor': 'end' }, svg, String(v));
  }
  months.forEach((d, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64;
    const g = el('g', {}, svg);
    el('title', {}, g, `${d.m} 2026: ${d.k} near Kinmen, ${d.o} elsewhere`);
    el('rect', { x, y: y(d.k), width: w, height: y(0) - y(d.k), class: 'kbar-k' }, g);
    el('rect', { x, y: y(d.k + d.o), width: w, height: y(d.k) - y(d.k + d.o), class: 'kbar-o' }, g);
    el('text', { x: x + w / 2, y: H - 6, class: 'kax', 'text-anchor': 'middle' }, g, d.m + (i === lastM - 1 ? '*' : ''));
  });
}
