// Two views. 'notified': every U.S. arms sale notified for the Philippines since 2014, stacked by notification date and
// coloured by what became of it (delivered, contracted, notified-not-accepted, dead). It is a history of notifications,
// not of the backlog. 'months': the tracker's own monthly records from March 2026, with the two tiers as separate bars.
import { el } from '../../../shared/js/mapkit.js';
import { ASOF, fmtD, fmtM, parseD } from './model.js';
import { MONTHS as RECS, fmtHouse } from './mdata.js';
import { NOTIFICATIONS } from '../data/cases.js';

const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
export const OUTCOMES = [
  ['delivered', 'Delivered'], ['contracted', 'Contracted, not fully delivered'],
  ['nna', 'Notified, not accepted'], ['dead', 'Dead: lost or superseded'],
];
const OUT_NAME = Object.fromEntries(OUTCOMES);

export function createTotal(svg, readout, { onSelect }) {
  let view = 'notified', idx = -1, pts = [];
  const box = svg.parentElement;
  svg.setAttribute('tabindex', '0');

  function frame() {
    svg.textContent = '';
    const W = Math.max(300, box.clientWidth), narrow = W < 620;
    const H = narrow ? 260 : 280, L = narrow ? 44 : 54, R = narrow ? 12 : 20, T = 18, B = 26;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);
    return { W, H, L, R, T, B, narrow };
  }

  function yAxis(f, Y, max, step, fmt) {
    const g = el('g', { class: 't-grid' }, svg);
    for (let v = 0; v <= max + 1e-6; v += step) {
      el('line', { x1: f.L, x2: f.W - f.R, y1: Y(v), y2: Y(v) }, g);
      el('text', { x: f.L - 6, y: Y(v) + 4, 'text-anchor': 'end' }, g, fmt(v));
    }
  }

  function drawNotified() {
    const f = frame();
    const t0 = Date.UTC(2014, 0, 1), t1 = ASOF.getTime();
    const X = t => f.L + (t - t0) / (t1 - t0) * (f.W - f.L - f.R);
    const total = NOTIFICATIONS.reduce((s, n) => s + n.m, 0);
    const max = Math.ceil(total / 2000) * 2000;
    const Y = v => f.T + (1 - v / max) * (f.H - f.T - f.B);
    yAxis(f, Y, max, 2000, v => `$${v / 1000}B`);
    const xg = el('g', { class: 't-x' }, svg);
    for (let y = 2014; y <= ASOF.getUTCFullYear(); y += f.narrow ? 3 : 1) el('text', { x: X(Date.UTC(y, 0, 1)), y: f.H - 8, 'text-anchor': 'middle' }, xg, f.narrow ? `’${String(y).slice(2)}` : y);
    const times = [t0, ...new Set(NOTIFICATIONS.map(n => parseD(n.d).getTime())), t1];
    const cum = times.map(t => {
      const o = {}; let s = 0;
      OUTCOMES.forEach(([k]) => { s += NOTIFICATIONS.filter(n => n.o === k && parseD(n.d).getTime() <= t).reduce((a, n) => a + n.m, 0); o[k] = s; });
      return o;
    });
    const top = OUTCOMES[OUTCOMES.length - 1][0];
    const stack = el('g', { class: 't-stack' }, svg);
    OUTCOMES.forEach(([k], ki) => {
      const up = times.map((t, i) => [X(t), Y(cum[i][k])]);
      const lo = times.map((t, i) => [X(t), Y(ki ? cum[i][OUTCOMES[ki - 1][0]] : 0)]);
      const stepPath = arr => arr.map((p, i) => (i ? `L${p[0]} ${arr[i - 1][1]}L${p[0]} ${p[1]}` : `M${p[0]} ${p[1]}`)).join('');
      const rev = [...lo].reverse();
      const back = rev.map((p, i) => (i ? `L${rev[i - 1][0]} ${p[1]}L${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`)).join('');
      el('path', { class: `o-${k}`, d: stepPath(up) + back + 'Z' }, stack);
    });
    // Each notification is a labelled step you can select.
    const ann = el('g', { class: 't-ann' }, svg);
    const seen = new Set();
    NOTIFICATIONS.forEach(n => {
      const t = parseD(n.d).getTime(), i = times.indexOf(t);
      if (seen.has(t)) return;
      seen.add(t);
      const same = NOTIFICATIONS.filter(x => parseD(x.d).getTime() === t);
      const x = X(t), yv = Y(cum[i][top]);
      const g = el('g', { tabindex: 0, role: 'button', 'aria-label': `${fmtD(n.d)}: ${same.map(s => `${s.n}, ${fmtM(s.m)}, ${OUT_NAME[s.o]}`).join('; ')}` }, ann);
      el('circle', { cx: x, cy: yv, r: 4, class: `b-${same[0].o}` }, g);
      const open = same.find(s => s.o === 'contracted' || s.o === 'nna');
      g.addEventListener('click', () => { if (open) onSelect(open.key); else document.getElementById('excluded').scrollIntoView({ block: 'start' }); });
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); g.dispatchEvent(new Event('click')); } });
    });
    pts = times.slice(1, -1).map(t => {
      const i = times.indexOf(t), c = cum[i];
      const same = NOTIFICATIONS.filter(n => parseD(n.d).getTime() === t);
      const d = same[0].d;
      return { x: X(t), y: Y(c[top]), label: `${fmtD(d)}: ${same.map(s => `${s.n} ${fmtM(s.m)} (${OUT_NAME[s.o].toLowerCase()})`).join('; ')}. Notified to date ${fmtM(c[top])}, of which delivered ${fmtM(c.delivered)} and contracted ${fmtM(c.contracted - c.delivered)}.` };
    });
    cursorLayer(f);
  }

  function drawMonths() {
    const f = frame();
    const n = RECS.length, slots = Math.max(n, 6);
    const max = Math.ceil(Math.max(...RECS.map(r => r.tot.nna)) / 1000) * 1000;
    const gw = (f.W - f.L - f.R) / slots, bw = Math.min(30, gw * 0.32);
    const X = i => f.L + (i + 0.5) * gw;
    const Y = v => f.T + (1 - v / max) * (f.H - f.T - f.B);
    yAxis(f, Y, max, 1000, v => `$${v / 1000}B`);
    const g = el('g', { class: 't-bars' }, svg);
    const xg = el('g', { class: 't-x' }, svg);
    RECS.forEach((r, i) => {
      [['contracted', -1], ['nna', 1]].forEach(([t, side]) => {
        const x = X(i) + side * (bw / 2 + 1) - bw / 2;
        el('rect', { class: `o-${t}`, x, y: Y(r.tot[t]), width: bw, height: Math.max(1.5, Y(0) - Y(r.tot[t])) }, g);
        if (!f.narrow) el('text', { x: x + bw / 2, y: Y(r.tot[t]) - 5, 'text-anchor': 'middle', class: 't-val' }, g, fmtHouse(r.tot[t]));
      });
      const [y, m] = r.mo.split('-').map(Number);
      el('text', { x: X(i), y: f.H - 8, 'text-anchor': 'middle' }, xg, f.narrow ? MON[m - 1].slice(0, 3) : `${MON[m - 1]} ${y}`);
    });
    if (n < slots) el('text', { x: X(n) - gw / 2 + 8, y: f.T + (f.H - f.T - f.B) / 2, class: 't-empty' }, svg, 'Later months appear as the tracker records them.');
    pts = RECS.map((r, i) => ({ x: X(i), y: Y(r.tot.nna), label: `${r.label} record (data to ${fmtD(r.end)}): contracted ${fmtHouse(r.tot.contracted)} · notified, not accepted ${fmtHouse(r.tot.nna)}` }));
    cursorLayer(f);
  }

  function cursorLayer(f) {
    const g = el('g', { class: 't-cursor' }, svg);
    const ln = el('line', { y1: f.T, y2: f.H - f.B }, g);
    g.style.display = 'none';
    const set = i => {
      idx = Math.max(0, Math.min(pts.length - 1, i));
      const p = pts[idx];
      g.style.display = '';
      ln.setAttribute('x1', p.x); ln.setAttribute('x2', p.x);
      readout.textContent = p.label;
    };
    svg.onpointermove = e => {
      const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * f.W;
      let best = 0; pts.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(pts[best].x - x)) best = i; });
      set(best);
    };
    svg.onkeydown = e => {
      if (e.target !== svg) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); set((idx < 0 ? pts.length : idx) + (e.key === 'ArrowRight' ? 1 : -1)); }
    };
    if (idx >= 0 && idx < pts.length) set(idx); else { idx = pts.length - 1; set(idx); }
  }

  function draw() { view === 'months' ? drawMonths() : drawNotified(); }
  new ResizeObserver(draw).observe(box);
  return { setView(v) { if (v !== view) idx = -1; view = v; draw(); }, get view() { return view; } };
}
