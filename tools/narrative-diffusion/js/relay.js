// Relay diagram: sources in the order the talking point first appeared in each, linked
// source to source with the lag in days. Each node links to its first record.
import { el, escapeHtml } from '../../../shared/js/mapkit.js';
import { LANES } from '../data/coverage.js';

const DAY = 864e5;
const lagText = d => (d < 1 ? 'same day' : d < 60 ? `+${Math.round(d)} d` : `+${(d / 30.4).toFixed(0)} mo`);

export function renderRelay(svg, sum, sel, onPick) {
  const W = Math.max(320, svg.parentElement.clientWidth);
  const fs = sum.firsts;
  svg.replaceChildren();
  if (!fs.length) { svg.setAttribute('height', 40); svg.setAttribute('viewBox', `0 0 ${W} 40`); el('text', { x: 8, y: 24, class: 'ax' }, svg, 'No appearances.'); return; }
  const cw = 124, cols = Math.max(2, Math.min(fs.length, Math.floor((W - 16) / cw))), rh = 104;
  const rows = Math.ceil(fs.length / cols);
  const H = rows * rh + 8;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);
  const step = (W - 16) / cols;
  const pos = fs.map((f, i) => {
    const r = Math.floor(i / cols), c = r % 2 ? cols - 1 - (i % cols) : i % cols; // snake rows
    return { x: 8 + 40 + (step - 80 / cols) * (c + 0.5), y: 30 + r * rh };
  });
  const maxN = Math.max(...fs.map(f => f.n));
  const rad = n => 7 + 13 * Math.sqrt(n / maxN);

  // Edges
  for (let i = 1; i < fs.length; i++) {
    const a = pos[i - 1], b = pos[i];
    const lag = (fs[i].r.t - fs[i - 1].r.t) / DAY;
    const handoff = LANES[fs[i - 1].lane].group !== LANES[fs[i].lane].group;
    const ra = rad(fs[i - 1].n) + 2, rb = rad(fs[i].n) + 5;
    let d, lx, ly;
    if (a.y === b.y) {
      const dir = Math.sign(b.x - a.x);
      d = `M${a.x + dir * ra} ${a.y}L${b.x - dir * rb} ${b.y}`; lx = (a.x + b.x) / 2; ly = a.y - 8;
    } else {
      const dir = a.x > W / 2 ? 1 : -1, bend = a.x + dir * 42;
      d = `M${a.x + dir * ra} ${a.y}C${bend} ${a.y} ${bend} ${b.y} ${b.x + dir * rb} ${b.y}`;
      lx = bend - dir * 8; ly = (a.y + b.y) / 2 + 18;
    }
    el('path', { d, class: 'edge' + (handoff ? ' hand' : ''), 'marker-end': 'url(#arr)' }, svg);
    el('text', { x: lx, y: ly, class: 'lag', 'text-anchor': a.y === b.y ? 'middle' : (a.x > W / 2 ? 'end' : 'start') }, svg, lagText(lag));
  }

  // Nodes
  fs.forEach((f, i) => {
    const p = pos[i], ln = LANES[f.lane];
    const g = el('g', { class: 'node' + (sel?.lane === f.lane ? ' on' : ''), tabindex: 0, role: 'button', 'data-lane': f.lane,
      'aria-label': `${ln.name}: first on ${f.r.d}, ${f.n} records` }, svg);
    el('circle', { cx: p.x, cy: p.y, r: rad(f.n), class: 'n ' + ln.group + (f.gap ? ' gap' : '') }, g);
    el('text', { x: p.x, y: p.y + 4, class: 'n-num' }, g, String(f.n));
    el('text', { x: p.x, y: p.y + rad(maxN) + 16, class: 'n-name' }, g, ln.name);
    const a = el('a', { href: f.r.u, target: '_blank', rel: 'noopener' }, svg);
    el('text', { x: p.x, y: p.y + rad(maxN) + 30, class: 'n-date' }, a, `${f.r.d}${f.gap ? '*' : ''} ↗`)
      .appendChild(el('title', {}, null, `Open the first record: ${escapeHtml(f.r.title)}`));
  });
  svg.querySelectorAll('.node').forEach(g => {
    const go = () => onPick({ lane: +g.dataset.lane });
    g.addEventListener('click', go);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  const defs = el('defs', {}, svg);
  const mk = el('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', class: 'arrow' }, mk);
}
