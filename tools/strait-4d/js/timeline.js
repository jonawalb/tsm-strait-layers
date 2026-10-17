// Timeline strip: daily counts, exercise spans, flags, anomalies, incidents and weekly rhetoric lanes. Click or drag to scrub.
import { ALL, N, EXERCISES, LANES, W, laneRange, indexOf, mondayOf, nice } from './data.js';

const ROWS = { air: [6, 58], ship: [70, 24], ev: [100, 12], rh: [118, 0] };
const LANE_H = 11, LEFT = 104;

export function createTimeline(canvas, onPick) {
  const ctx = canvas.getContext('2d');
  let C = {}, view = [0, N - 1], w = 600, h = 160, S = null;
  const readTheme = () => {
    const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
    C = { ink: g('--ink'), muted: g('--muted'), faint: g('--faint'), rule: g('--rule'), chip: g('--chip'), prc: g('--prc'), ccg: g('--ccg'),
      us: g('--us'), accent: g('--accent'), cable: g('--c3'), blue: g('--blue'), panel: g('--panel'), bad: g('--bad'), mono: g('--mono'), off: g('--c7') };
  };
  readTheme();
  const x = i => LEFT + (i - view[0]) / Math.max(1, view[1] - view[0]) * (w - LEFT - 8);
  const iAt = px => Math.round(view[0] + (px - LEFT) / (w - LEFT - 8) * (view[1] - view[0]));

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    w = Math.max(280, r.width); h = ROWS.rh[0] + LANES.length * LANE_H + 6;
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(state) {
    S = state;
    ctx.clearRect(0, 0, w, h);
    const i0 = Math.max(0, view[0]), i1 = Math.min(N - 1, view[1]), span = i1 - i0 + 1;
    const bw = Math.max(0.6, (w - LEFT - 8) / span - (span < 200 ? 1 : 0));
    ctx.save(); ctx.beginPath(); ctx.rect(LEFT - 4, 0, w - LEFT + 4, h); ctx.clip();
    // Exercise spans across all rows.
    EXERCISES.forEach(ex => {
      const a = indexOf(ex.start), b = indexOf(ex.end);
      if (b < i0 || a > i1 || ex.end < ALL[0].d) return;
      ctx.fillStyle = C.prc; ctx.globalAlpha = 0.12;
      ctx.fillRect(x(a) - bw / 2, 0, Math.max(3, x(b) - x(a) + bw), h); ctx.globalAlpha = 1;
    });
    // Aircraft and ADIZ bars.
    let maxA = 1, maxS = 1;
    for (let i = i0; i <= i1; i++) { const v = ALL[i].v; maxA = Math.max(maxA, v.air || 0); maxS = Math.max(maxS, (v.plan || 0) + (v.off || 0)); }
    const [ay, ah] = ROWS.air, [sy, sh] = ROWS.ship;
    for (let i = i0; i <= i1; i++) {
      const r = ALL[i], X = x(i) - bw / 2;
      if (r.v.air != null) { const hh = r.v.air / maxA * ah; ctx.fillStyle = C.faint; ctx.fillRect(X, ay + ah - hh, bw, hh); }
      if (r.v.adiz != null) { const hh = r.v.adiz / maxA * ah; ctx.fillStyle = C.prc; ctx.fillRect(X, ay + ah - hh, bw, hh); }
      if (r.v.plan != null) { const hp = r.v.plan / maxS * sh, ho = (r.v.off || 0) / maxS * sh; ctx.fillStyle = C.blue; ctx.fillRect(X, sy + sh - hp, bw, hp); ctx.fillStyle = C.off; ctx.fillRect(X, sy + sh - hp - ho, bw, ho); }
      if (r.flag) { ctx.fillStyle = r.flag.includes('J') ? C.accent : C.us; ctx.fillRect(X, ay - 5, Math.max(2, bw), 3); }
      if (r.anom.length && S.anomOn) { ctx.fillStyle = C.bad; ctx.beginPath(); ctx.arc(x(i), ay + 1, Math.min(3, Math.max(1.6, bw)), 0, 7); ctx.fill(); }
      const ev = ROWS.ev[0];
      if (r.ccg.length) { ctx.fillStyle = C.ccg; ctx.fillRect(X, ev, Math.max(1.5, bw), 4); }
      if (r.transits.length) { ctx.fillStyle = C.us; ctx.fillRect(X, ev + 4, Math.max(1.5, bw), 4); }
      if (r.cables.length) { ctx.fillStyle = C.cable; ctx.fillRect(X, ev + 8, Math.max(2, bw), 4); }
    }
    // Rhetoric lanes (weekly).
    const m = S.rhetMetric;
    LANES.forEach((l, k) => {
      const [lo, hi] = laneRange(l, m.key), y = ROWS.rh[0] + k * LANE_H;
      ctx.fillStyle = C.chip; ctx.fillRect(LEFT, y, w - LEFT - 8, LANE_H - 1);
      l.weeks.forEach(row => {
        const a = indexOf(row[0]), b = a + 6;
        if (b < i0 || a > i1 || row[0] < '2022-07-25') return;
        const v = row[W[m.key]];
        if (v == null) return;
        const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
        ctx.fillStyle = C.prc; ctx.globalAlpha = 0.12 + 0.88 * t;
        ctx.fillRect(x(a) - bw / 2, y, Math.max(1, x(b) - x(a) + bw), LANE_H - 1); ctx.globalAlpha = 1;
        const z = row[W[m.z]];
        if (z != null && Math.abs(z) >= 3) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(x(a) - bw / 2 + 0.5, y + 0.5, Math.max(1, x(b) - x(a) + bw) - 1, LANE_H - 2); }
      });
    });
    // Window range when a preset is active.
    if (S.window) {
      ctx.strokeStyle = C.ink; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      [S.window[0], S.window[1]].forEach(i => { if (i >= i0 && i <= i1) { ctx.beginPath(); ctx.moveTo(x(i), 0); ctx.lineTo(x(i), h); ctx.stroke(); } });
      ctx.setLineDash([]);
    }
    ctx.restore();
    // Row labels.
    ctx.font = `500 10px ${C.mono}`; ctx.fillStyle = C.muted; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('Aircraft', 4, ROWS.air[0] + 10); ctx.fillText(' ADIZ', 4, ROWS.air[0] + 24);
    ctx.fillText('Ships', 4, ROWS.ship[0] + 12); ctx.fillText('Events', 4, ROWS.ev[0] + 6);
    LANES.forEach((l, k) => ctx.fillText(l.label.replace('State media', 'Media').replace('Taiwan Affairs Office', 'TAO').replace(' Ministry', ' Min.'), 4, ROWS.rh[0] + k * LANE_H + LANE_H / 2));
    // Cursor.
    const cx = x(S.i);
    ctx.fillStyle = C.ink; ctx.fillRect(cx - 1, 0, 2, h);
    ctx.beginPath(); ctx.moveTo(cx - 5, 0); ctx.lineTo(cx + 5, 0); ctx.lineTo(cx, 6); ctx.fill();
    // Axis ticks: first of month (or year when zoomed out).
    ctx.font = `400 10px ${C.mono}`; ctx.fillStyle = C.muted; ctx.textAlign = 'center';
    const yearly = span > 500;
    let lastX = -1e9;
    for (let i = i0; i <= i1; i++) {
      const d = ALL[i].d;
      if (d.slice(8) !== '01' || (yearly && d.slice(5, 7) !== '01')) continue;
      const tx = x(i);
      if (tx - lastX < 46) continue;
      lastX = tx;
      ctx.fillRect(tx, ROWS.ship[0] - 4, 1, 3);
      ctx.fillText(yearly ? d.slice(0, 4) : nice(d, false).replace(/ \d+$/, '') + (d.slice(5, 7) === '01' ? " '" + d.slice(2, 4) : ''), tx, ROWS.ship[0] - 9);
    }
  }

  let dragging = false;
  const pick = e => { const r = canvas.getBoundingClientRect(); const px = e.clientX - r.left; if (px < LEFT - 6) return; onPick(Math.max(view[0], Math.min(view[1], iAt(px)))); };
  canvas.addEventListener('pointerdown', e => { dragging = true; canvas.setPointerCapture(e.pointerId); pick(e); });
  canvas.addEventListener('pointermove', e => { if (dragging) pick(e); else hover(e); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointerleave', () => { canvas.title = ''; });
  function hover(e) {
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < LEFT) return;
    const i = Math.max(0, Math.min(N - 1, iAt(px))), rec = ALL[i];
    if (py >= ROWS.rh[0]) {
      const k = Math.floor((py - ROWS.rh[0]) / LANE_H), l = LANES[k];
      const row = l && l.byWeek.get(mondayOf(rec.d));
      canvas.title = l ? `${l.label}, week of ${nice(mondayOf(rec.d))}: ` + (row ? `${row[2]} of ${row[1]} records mention Taiwan` : 'no records') : '';
    } else canvas.title = `${nice(rec.d)}: ${rec.v.air ?? 'n/a'} aircraft, ${rec.v.adiz ?? 'n/a'} ADIZ/median`;
  }

  return {
    resize, draw, readTheme,
    setView(a, b) { view = [Math.max(0, a), Math.min(N - 1, b)]; },
    get view() { return view; },
  };
}
