// Mini map of the whole scenario tree: columns are decision levels, the path taken is highlighted.
import { el } from '../../../shared/js/mapkit.js';
import { NODES } from '../data/tree.js';

const W = 330, H = 226, PADX = 14, PADY = 12, PADB = 28;
const LEVELS = [];
Object.entries(NODES).forEach(([id, n]) => { (LEVELS[n.level] ||= []).push(id); });
const POS = {};
LEVELS.forEach((ids, lv) => ids.forEach((id, i) => {
  POS[id] = [PADX + lv * (W - 2 * PADX) / (LEVELS.length - 1), PADY + (ids.length === 1 ? (H - PADY - PADB) / 2 : i * (H - PADY - PADB) / (ids.length - 1))];
}));
const EDGES = [];
Object.entries(NODES).forEach(([id, n]) => (n.opts || []).forEach((o, i) => EDGES.push([id, o.next, i])));

/**
 * Draw the tree. `cur` and `cmp` are arrays of visited node ids. onPick(id) is called for a visited node.
 */
export function drawTree(svg, { cur, cmp = null, onPick }) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const onPath = (list, a, b) => { for (let i = 0; i < list.length - 1; i++) if (list[i] === a && list[i + 1] === b) return true; return false; };
  const eg = el('g', {}, svg);
  EDGES.forEach(([a, b]) => {
    const [x1, y1] = POS[a], [x2, y2] = POS[b];
    const mx = (x1 + x2) / 2;
    const d = `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
    const cls = onPath(cur, a, b) ? 'edge cur' : cmp && onPath(cmp, a, b) ? 'edge cmp' : 'edge';
    el('path', { d, class: cls }, eg);
  });
  // draw highlighted edges on top
  [...eg.querySelectorAll('.edge.cmp'), ...eg.querySelectorAll('.edge.cur')].forEach(p => eg.appendChild(p));
  const here = cur[cur.length - 1];
  Object.entries(POS).forEach(([id, [x, y]]) => {
    const n = NODES[id];
    const inCur = cur.includes(id), inCmp = cmp && cmp.includes(id);
    const g = el('g', { class: `tn${inCur ? ' on' : ''}${inCmp ? ' cmpon' : ''}${id === here ? ' here' : ''}${n.ending ? ' end ' + n.tone : ''}`, transform: `translate(${x} ${y})` }, svg);
    if (n.ending) el('rect', { x: -6, y: -6, width: 12, height: 12, rx: 2 }, g);
    else el('circle', { r: 6 }, g);
    if (id === here) el('circle', { r: 10, class: 'halo' }, g);
    el('title', {}, g, `${n.ending ? 'Ending' : n.day + ', ' + n.actor}: ${n.title}${inCur && id !== here ? ' (click to return here)' : ''}`);
    if (inCur && id !== here && onPick) {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `Return to: ${n.title}`);
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => onPick(id));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id); } });
    }
  });
  ['Taipei', 'U.S.', 'Japan', 'Taipei', 'U.S.+JP', 'End'].forEach((t, i) => {
    el('text', { x: PADX + i * (W - 2 * PADX) / 5, y: H - 6, class: 'lv', 'text-anchor': i === 0 ? 'start' : i === 5 ? 'end' : 'middle' }, svg, t);
  });
}

export const TOTAL_NODES = Object.keys(NODES).length;
export const ENDINGS = Object.values(NODES).filter(n => n.ending).length;
