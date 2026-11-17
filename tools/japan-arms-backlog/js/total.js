// Backlog value over time. Japan has no published monthly backlog series before March 2026, so this chart shows
// (a) today's open cases stacked by notification date ("vintage"), and (b) the tracker's own monthly totals from
// March 2026 onward. Neither view is a historical backlog total.
import { el } from '../../../shared/js/mapkit.js';
import { OPEN, CATS, ASOF, fmtB, fmtD } from './model.js';
import { MONTHS as RECS, fmtHouse } from './mdata.js';

const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const VINTAGE_NOTES = [
  { key: 'awacs_mcu', t: 'AWACS upgrade, 2013' },
  { key: 'f35', t: 'F-35, July 2020 (41%)' },
  { key: 'amraam_2025', t: 'Jan. 2025 munitions' },
];

export function createTotal(svg, readout, { onSelect }) {
  let view = 'vintage', idx = -1, pts = [];
  const box = svg.parentElement;
  svg.setAttribute('tabindex', '0');

  function frame() {
    svg.textContent = '';
    const W = Math.max(300, box.clientWidth), narrow = W < 620;
    const H = narrow ? 250 : 270, L = narrow ? 44 : 54, R = narrow ? 12 : 20, T = 18, B = 26;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);
    return { W, H, L, R, T, B, narrow };
  }

  function yAxis(f, Y, max, step) {
    const g = el('g', { class: 't-grid' }, svg);
    for (let v = 0; v <= max; v += step) {
      el('line', { x1: f.L, x2: f.W - f.R, y1: Y(v), y2: Y(v) }, g);
      el('text', { x: f.L - 6, y: Y(v) + 4, 'text-anchor': 'end' }, g, `$${v / 1000}B`);
    }
  }

  function drawVintage() {
    const f = frame();
    const t0 = Date.UTC(2013, 0, 1), t1 = ASOF.getTime();
    const X = t => f.L + (t - t0) / (t1 - t0) * (f.W - f.L - f.R);
    const max = 60000;
    const Y = v => f.T + (1 - v / max) * (f.H - f.T - f.B);
    const bands = el('g', { class: 'g-admin' }, svg);
    [[t0, Date.UTC(2017, 0, 20), 'Obama'], [Date.UTC(2017, 0, 20), Date.UTC(2021, 0, 20), 'Trump'], [Date.UTC(2021, 0, 20), Date.UTC(2025, 0, 20), 'Biden'], [Date.UTC(2025, 0, 20), t1, 'Trump']]
      .forEach(([a, b, nm], i) => {
        if (i % 2) el('rect', { x: X(a), y: f.T, width: X(b) - X(a), height: f.H - f.T - f.B }, bands);
        if (X(b) - X(a) > 40) el('text', { x: X(a) + 4, y: f.T + 12 }, bands, nm);
      });
    yAxis(f, Y, max, 10000);
    const xg = el('g', { class: 't-x' }, svg);
    for (let y = 2013; y <= 2026; y += f.narrow ? 3 : 1) el('text', { x: X(Date.UTC(y, 0, 1)), y: f.H - 8, 'text-anchor': 'middle' }, xg, f.narrow ? `’${String(y).slice(2)}` : y);
    const sorted = [...OPEN].sort((a, b) => a.nD - b.nD);
    const times = [t0, ...new Set(sorted.map(c => c.nD.getTime())), t1];
    const cum = times.map(t => {
      const o = {}; let s = 0;
      CATS.forEach(k => { s += sorted.filter(c => c.cat === k && c.nD.getTime() <= t).reduce((a, c) => a + c.m, 0); o[k] = s; });
      return o;
    });
    const stack = el('g', { class: 't-stack' }, svg);
    CATS.forEach((k, ki) => {
      const top = times.map((t, i) => [X(t), Y(cum[i][k])]);
      const bot = times.map((t, i) => [X(t), Y(ki ? cum[i][CATS[ki - 1]] : 0)]);
      const stepPath = arr => arr.map((p, i) => (i ? `L${p[0]} ${arr[i - 1][1]}L${p[0]} ${p[1]}` : `M${p[0]} ${p[1]}`)).join('');
      const rev = [...bot].reverse();
      const back = rev.map((p, i) => (i ? `L${rev[i - 1][0]} ${p[1]}L${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`)).join('');
      el('path', { class: `cat-${k}`, d: stepPath(top) + back + 'Z' }, stack);
    });
    const leg = el('g', { class: 't-leg' }, svg);
    CATS.forEach((k, i) => {
      const lx = f.L + 8 + i * (f.narrow ? 88 : 110);
      el('rect', { x: lx, y: f.T + 22, width: 10, height: 10, class: `cat-${k}` }, leg);
      el('text', { x: lx + 14, y: f.T + 31 }, leg, k);
    });
    const ann = el('g', { class: 't-ann' }, svg);
    VINTAGE_NOTES.forEach(n => {
      const c = OPEN.find(o => o.key === n.key); if (!c) return;
      const i = times.indexOf(c.nD.getTime());
      const x = X(times[i]), yv = Y(cum[i].Munitions);
      const g = el('g', { tabindex: 0, role: 'button', 'aria-label': `${n.t}. Show case.` }, ann);
      const low = yv - 20 < f.T + 44;
      if (!low) el('line', { x1: x, x2: x, y1: yv, y2: yv - 16 }, g);
      const anchor = x < f.L + 160 ? 'start' : 'end';
      el('text', { x: anchor === 'start' ? x + 4 : x - 6, y: low ? yv + 14 : yv - 20, 'text-anchor': anchor }, g, n.t);
      g.addEventListener('click', () => onSelect(n.key));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(n.key); } });
    });
    pts = [];
    for (let y = 2013; y <= 2026; y++) for (let m = 0; m < 12; m++) {
      const t = Date.UTC(y, m + 1, 0); if (t > t1) break;
      let i = times.length - 1; while (i > 0 && times[i] > t) i--;
      const c = cum[i];
      pts.push({ x: X(t), y: Y(c.Munitions), label: `End of ${MON[m]} ${y}: ${fmtB(c.Munitions)} of today's open cases already notified · Traditional ${fmtB(c.Traditional)}, Asymmetric ${fmtB(c.Asymmetric - c.Traditional)}, Munitions ${fmtB(c.Munitions - c.Asymmetric)}` });
    }
    cursorLayer(f);
  }

  function drawMonths() {
    const f = frame();
    const n = RECS.length, slots = Math.max(n, 6), max = 60000;
    const bw = Math.min(70, (f.W - f.L - f.R) / slots * 0.6);
    const X = i => f.L + (i + 0.5) / slots * (f.W - f.L - f.R);
    const Y = v => f.T + (1 - v / max) * (f.H - f.T - f.B);
    yAxis(f, Y, max, 10000);
    const g = el('g', { class: 't-bars' }, svg);
    const xg = el('g', { class: 't-x' }, svg);
    RECS.forEach((r, i) => {
      let base = 0;
      CATS.forEach(k => {
        const v = r.cats[k].m;
        el('rect', { class: `cat-${k}`, x: X(i) - bw / 2, y: Y(base + v), width: bw, height: Y(base) - Y(base + v) }, g);
        base += v;
      });
      el('text', { x: X(i), y: Y(r.total) - 6, 'text-anchor': 'middle', class: 't-val' }, g, fmtHouse(r.total));
      const [y, m] = r.mo.split('-').map(Number);
      el('text', { x: X(i), y: f.H - 8, 'text-anchor': 'middle' }, xg, `${MON[m - 1]} ${y}`);
    });
    if (n < slots) {
      el('text', { x: X(n) - bw / 2, y: f.T + (f.H - f.T - f.B) / 2, class: 't-empty' }, svg, 'Later months appear as the tracker records them.');
    }
    pts = RECS.map((r, i) => ({ x: X(i), y: Y(r.total), label: `${r.label} record: ${fmtHouse(r.total)} across ${r.rows.filter(x => !x.out).length} open cases (data to ${fmtD(r.end)})` }));
    cursorLayer(f);
  }

  function cursorLayer(f) {
    const g = el('g', { class: 't-cursor' }, svg);
    const ln = el('line', { y1: f.T, y2: f.H - f.B }, g), dot = el('circle', { r: 4.5 }, g);
    g.style.display = 'none';
    const set = i => {
      idx = Math.max(0, Math.min(pts.length - 1, i));
      const p = pts[idx];
      g.style.display = '';
      ln.setAttribute('x1', p.x); ln.setAttribute('x2', p.x);
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
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

  function draw() { view === 'months' ? drawMonths() : drawVintage(); }
  new ResizeObserver(draw).observe(box);
  return { setView(v) { if (v !== view) idx = -1; view = v; draw(); }, get view() { return view; } };
}
