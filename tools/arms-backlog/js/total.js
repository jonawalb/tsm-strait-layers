// Backlog total over time: the published monthly topline (Cato Institute 2024, TSM from 2025), or today's open cases stacked by notification date.
import { el } from '../../../shared/js/mapkit.js';
import { OPEN, CATS, TOPLINE, ASOF, fmtB } from './model.js';

const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const moLabel = s => { const [y, m] = s.split('-').map(Number); return `${MON[m - 1]} ${y}`; };

// Changes to the topline, from the Cato Institute's 2024 updates and TSM's monthly posts.
// key = case to select when clicked (null: a case that left before 2025, so it has no timeline row).
const EVENTS = [
  { mo: '2024-01', d: 1105, t: 'Earlier sales added to the count (PAC-3 MSE, Stingers, HIMARS)', key: 'pac3' },
  { mo: '2024-01', d: -1246, t: 'Paladin (2021) cancelled; Phalanx and AN/SLQ-32 delivered', key: null },
  { mo: '2024-04', d: 520, t: 'HIMARS (Dec. 2022) value made public', key: 'himars22' },
  { mo: '2024-06', d: 837, t: 'ALTIUS-600M and Switchblade notified; earlier sales added', key: 'altius24' },
  { mo: '2024-10', d: 1988, t: 'NASAMS and radars notified', key: 'nasams' },
  { mo: '2024-11', d: -436, t: 'HIMARS (Oct. 2020) delivered', key: null },
  { mo: '2025-01', d: -332, t: '30mm ammunition removed', key: 'ammo30' },
  { mo: '2025-12', d: 10918, t: 'Six new cases notified Dec. 17', key: 'himars25' },
  { mo: '2025-12', d: -440, t: 'Stinger deliveries complete', key: 'stinger' },
  { mo: '2026-03', d: -300, t: 'ALTIUS-600M-V delivered', key: 'altius24' },
  { mo: '2026-04', d: -2000, t: 'Abrams delivered', key: 'abrams' },
];
const VINTAGE_NOTES = [
  { key: 'f16', t: 'F-16 Block 70' },
  { key: 'hcds', t: 'Oct.–Dec. 2020 package' },
  { key: 'himars25', t: 'Dec. 2025 package' },
];

export function createTotal(svg, readout, { onSelect }) {
  let view = 'topline', idx = -1, pts = [];
  const box = svg.parentElement;
  svg.setAttribute('tabindex', '0');

  function frame() {
    svg.textContent = '';
    const W = Math.max(320, box.clientWidth), narrow = W < 620;
    const H = narrow ? 250 : 270, L = narrow ? 44 : 54, R = narrow ? 12 : 20, T = 18, B = 26;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);
    return { W, H, L, R, T, B, narrow };
  }

  function yAxis(f, Y, max) {
    const g = el('g', { class: 't-grid' }, svg);
    for (let v = 0; v <= max; v += 5000) {
      el('line', { x1: f.L, x2: f.W - f.R, y1: Y(v), y2: Y(v) }, g);
      el('text', { x: f.L - 6, y: Y(v) + 4, 'text-anchor': 'end' }, g, `$${v / 1000}B`);
    }
  }

  function drawTopline() {
    const f = frame();
    const n = TOPLINE.length, max = 35000;
    const X = i => f.L + (i + 0.5) / n * (f.W - f.L - f.R);
    const Y = v => f.T + (1 - v / max) * (f.H - f.T - f.B);
    yAxis(f, Y, max);
    const xg = el('g', { class: 't-x' }, svg);
    TOPLINE.forEach((p, i) => {
      const [y, m] = p.mo.split('-').map(Number);
      if (m === 1 || m === 7) el('text', { x: X(i), y: f.H - 8, 'text-anchor': 'middle' }, xg, m === 1 ? `Jan. ${y}` : 'July');
    });
    const step = TOPLINE.map((p, i) => `${i ? 'L' : 'M'}${X(i - 0.5)} ${Y(p.m)}L${X(i + 0.5)} ${Y(p.m)}`).join('');
    el('path', { class: 't-area', d: `${step}L${X(n - 0.5)} ${Y(0)}L${X(-0.5)} ${Y(0)}Z` }, svg);
    el('path', { class: 't-line', d: step }, svg);
    const ann = el('g', { class: 't-ann' }, svg);
    const seen = {};
    EVENTS.forEach((e, n) => {
      const i = TOPLINE.findIndex(p => p.mo === e.mo);
      const k = seen[e.mo] = (seen[e.mo] || 0) + 1;
      const x = X(i - 0.5), yv = Y(TOPLINE[i].m), up = e.d > 0;
      const cy = up ? yv - 16 : yv + 16 + (k - 1) * 22;
      const g = el('g', e.key ? { tabindex: 0, role: 'button', 'aria-label': `${e.t}, ${moLabel(e.mo)}. Show case.` } : { role: 'img', 'aria-label': `${e.t}, ${moLabel(e.mo)}.` }, ann);
      el('line', { x1: x, x2: x, y1: yv, y2: cy }, g);
      el('circle', { cx: x, cy, r: 9, class: up ? 'b-up' : 'b-down' }, g);
      el('text', { x, y: cy + 4, 'text-anchor': 'middle', class: 'b-n' }, g, n + 1);
      if (e.key) {
        g.addEventListener('click', () => onSelect(e.key));
        g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(e.key); } });
      }
    });
    const list = document.getElementById('total-events');
    list.hidden = false;
    list.innerHTML = EVENTS.map((e, n) => `<li><button type="button" data-k="${e.key || ''}" ${e.key ? '' : 'disabled'}><i class="${e.d > 0 ? 'b-up' : 'b-down'}">${n + 1}</i><span class="${e.d > 0 ? 'up' : 'down'}">${e.d > 0 ? '+' : '−'}${fmtB(Math.abs(e.d))}</span> ${moLabel(e.mo)}: ${e.t}</button></li>`).join('');
    list.querySelectorAll('button[data-k]:not([disabled])').forEach(b => b.onclick = () => onSelect(b.dataset.k));
    pts = TOPLINE.map((p, i) => ({ x: X(i), y: Y(p.m), label: `${moLabel(p.mo)}: ${fmtB(p.m)} undelivered` + (p.src ? ` (${p.pub === 'Cato' ? 'Cato Institute' : 'TSM'} monthly post)` : '') }));
    cursorLayer(f);
  }

  function drawVintage() {
    const f = frame();
    document.getElementById('total-events').hidden = true;
    const t0 = Date.UTC(2017, 0, 1), t1 = ASOF.getTime();
    const X = t => f.L + (t - t0) / (t1 - t0) * (f.W - f.L - f.R);
    const max = 30000;
    const Y = v => f.T + (1 - v / max) * (f.H - f.T - f.B);
    const bands = el('g', { class: 'g-admin' }, svg);
    [[Date.UTC(2017, 0, 20), Date.UTC(2021, 0, 20), 'Trump'], [Date.UTC(2021, 0, 20), Date.UTC(2025, 0, 20), 'Biden'], [Date.UTC(2025, 0, 20), t1, 'Trump']]
      .forEach(([a, b, nm], i) => {
        if (i !== 1) el('rect', { x: X(a), y: f.T, width: X(b) - X(a), height: f.H - f.T - f.B }, bands);
        el('text', { x: X(a) + 4, y: f.T + 12 }, bands, nm);
      });
    yAxis(f, Y, max);
    const xg = el('g', { class: 't-x' }, svg);
    for (let y = 2017; y <= 2026; y += f.narrow ? 2 : 1) el('text', { x: X(Date.UTC(y, 0, 1)), y: f.H - 8, 'text-anchor': 'middle' }, xg, f.narrow ? `’${String(y).slice(2)}` : y);
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
      const lx = f.L + 8 + i * (f.narrow ? 90 : 110);
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
      el('text', { x: x - 6, y: low ? yv + 14 : yv - 20, 'text-anchor': 'end' }, g, n.t);
      g.addEventListener('click', () => onSelect(n.key));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter') onSelect(n.key); });
    });
    pts = [];
    for (let y = 2017; y <= 2026; y++) for (let m = 0; m < 12; m++) {
      const t = Date.UTC(y, m + 1, 0); if (t > t1) break;
      let i = times.length - 1; while (i > 0 && times[i] > t) i--;
      const c = cum[i];
      pts.push({ x: X(t), y: Y(c.Munitions), label: `End of ${MON[m]} ${y}: ${fmtB(c.Munitions)} of today's backlog already notified · Traditional ${fmtB(c.Traditional)}, Asymmetric ${fmtB(c.Asymmetric - c.Traditional)}, Munitions ${fmtB(c.Munitions - c.Asymmetric)}` });
    }
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

  function draw() { view === 'vintage' ? drawVintage() : drawTopline(); }
  new ResizeObserver(draw).observe(box);
  return { setView(v) { if (v !== view) idx = -1; view = v; draw(); }, get view() { return view; } };
}
