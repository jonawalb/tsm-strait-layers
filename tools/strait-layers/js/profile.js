// Route profile: which layers cover each kilometre of the route, with a draggable cursor.
import { el, along, routeLengths, fmt } from './geo.js';

const Wd = 1000, ROW = 18, LABEL = 150, PAD = 6;
let cache = { key: null };

export function drawProfile(svg, { key, pts, rows, t, onScrub }) {
  const total = routeLengths(pts).at(-1);
  const h = rows.length * ROW + 28;
  if (cache.key !== key) {
    svg.setAttribute('viewBox', `0 0 ${Wd} ${h}`);
    svg.style.aspectRatio = `${Wd} / ${h}`;
    svg.innerHTML = '';
    const N = 200, cw = (Wd - LABEL - PAD) / N;
    rows.forEach((row, i) => {
      const y = i * ROW + 4;
      el('text', { x: LABEL - 8, y: y + ROW / 2 + 3, class: 'pf-label' + (row.strong ? ' strong' : ''), 'text-anchor': 'end' }, svg, row.label);
      el('rect', { x: LABEL, y: y + 2, width: Wd - LABEL - PAD, height: ROW - 6, class: 'pf-track' }, svg);
      let run = null, d = '';
      for (let k = 0; k <= N; k++) {
        const on = k < N && row.test(along(pts, (k + 0.5) / N));
        if (on && run == null) run = k;
        if (!on && run != null) { d += `M${(LABEL + run * cw).toFixed(1)} ${y + 2}h${((k - run) * cw).toFixed(1)}v${ROW - 6}h${(-(k - run) * cw).toFixed(1)}z`; run = null; }
      }
      el('path', { d, fill: `var(${row.col})`, class: 'pf-on' + (row.strong ? ' strong' : '') }, svg);
    });
    const ay = rows.length * ROW + 18;
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      el('text', { x: LABEL + f * (Wd - LABEL - PAD), y: ay, class: 'pf-axis', 'text-anchor': f === 0 ? 'start' : f === 1 ? 'end' : 'middle' }, svg, fmt(f * total) + ' km');
    });
    const cur = el('g', { class: 'pf-cursor' }, svg);
    el('line', { x1: 0, x2: 0, y1: 0, y2: rows.length * ROW + 4 }, cur);
    el('circle', { cx: 0, cy: rows.length * ROW + 4, r: 5 }, cur);
    cache = { key, cur };
    const scrub = e => {
      const r = svg.getBoundingClientRect();
      const f = ((e.clientX - r.left) / r.width * Wd - LABEL) / (Wd - LABEL - PAD);
      onScrub(Math.max(0, Math.min(1, f)));
    };
    let down = false;
    svg.onpointerdown = e => { down = true; svg.setPointerCapture(e.pointerId); scrub(e); };
    svg.onpointermove = e => { if (down) scrub(e); };
    svg.onpointerup = () => { down = false; };
  }
  cache.cur.style.display = t == null ? 'none' : '';
  if (t != null) cache.cur.setAttribute('transform', `translate(${(LABEL + t * (Wd - LABEL - PAD)).toFixed(1)} 0)`);
}

export function resetProfile() { cache = { key: null }; }
