// Market detail: one contract's daily price path with dated, sourced events on the same axis.
import { vbw, el, esc, cents, dayLabel, monLabel, dnum, dstr, lin, linePath, placeTip, THEATER_COLOR } from './util.js';

let W = 900, H = 360;
const M = { l: 44, r: 18, t: 34, b: 30 };
const GAP_DAYS = 7; // break the line across gaps longer than this

const niceMax = v => [5, 10, 15, 20, 25, 40, 50, 60, 80, 100].find(t => t >= v) || 100;

/** opts.zoom: fit the price axis to the data; opts.pla: [[date, aircraft]] TSM daily counts to draw as bars. */
export function renderDetail(svg, tip, wrap, listEl, mk, events, cal, opts = {}) {
  W = vbw(svg, 340, 900); H = W < 600 ? 300 : 360;
  svg.innerHTML = '';
  tip.hidden = true;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const s = mk.s;
  const end = [s[s.length - 1][0], mk.closed ? mk.dday : null, mk.deadline && mk.deadline <= dstr(dnum(s[s.length - 1][0]) + 120) ? mk.deadline : null]
    .filter(Boolean).sort().pop();
  const x0 = dnum(s[0][0]) - 1, x1 = Math.max(dnum(end) + 1, x0 + 10);
  const top = opts.zoom ? niceMax(Math.max(...s.map(r => r[1]), ...(cal ? Object.values(cal.f).map(f => f[0] * 100) : [0]), mk.closed && mk.y ? 100 : 0) * 1.15) : 100;
  const X = lin(x0, x1, M.l, W - M.r), Y = lin(0, top, H - M.b, M.t);
  const color = THEATER_COLOR[mk.th];
  const g = el('g', {}, svg);
  const step = { 5: 1, 10: 2.5, 15: 5, 20: 5, 25: 5, 40: 10, 50: 10, 60: 20, 80: 20, 100: 25 }[top];
  for (let v = 0; v <= top + 1e-9; v += step) {
    el('line', { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), class: 'grid' }, g);
    el('text', { x: M.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, g, `${+v.toFixed(2)}¢`);
  }
  // TSM daily PLA aircraft counts as low bars along the bottom (own scale, right axis).
  const pla = (opts.pla || []).filter(r => r[1] != null && dnum(r[0]) >= x0 && dnum(r[0]) <= x1);
  if (pla.length) {
    const amax = Math.max(...pla.map(r => r[1]), 10);
    const band = (H - M.t - M.b) * 0.28;
    const bw = Math.max(1, (X(x0 + 1) - X(x0)) * 0.7);
    const pg = el('g', { class: 'pla' }, g);
    for (const [d, a] of pla) el('rect', { x: X(dnum(d)) - bw / 2, y: H - M.b - (a / amax) * band, width: bw, height: (a / amax) * band }, pg);
    el('text', { x: W - M.r, y: H - M.b - band - 4, 'text-anchor': 'end', class: 'pla-t' }, g, `PLA aircraft (MND), max ${amax}/day`);
  }
  // Month ticks, thinned to fit.
  const months = [];
  for (let d = x0; d <= x1; d++) { const ds = dstr(d); if (ds.endsWith('-01')) months.push(d); }
  const every = Math.ceil(months.length / (W < 600 ? 4 : 8)) || 1;
  months.forEach((d, i) => { if (i % every === 0) el('text', { x: X(d), y: H - 10, 'text-anchor': 'middle' }, g, monLabel(dstr(d))); });
  if (mk.deadline && dnum(mk.deadline) <= x1) {
    el('line', { x1: X(dnum(mk.deadline)), x2: X(dnum(mk.deadline)), y1: M.t, y2: H - M.b, class: 'deadline' }, g);
    el('text', { x: X(dnum(mk.deadline)) - 4, y: M.t + 12, 'text-anchor': 'end', class: 'dl-t' }, g, 'deadline');
  }
  // Events in range: dotted guides and markers along the top.
  const evs = (events || []).filter(e => dnum(e.date) >= x0 && dnum(e.date) <= x1);
  const eg = el('g', {}, svg);
  for (const e of evs) {
    const ex = X(dnum(e.date));
    el('line', { x1: ex, x2: ex, y1: M.t - 8, y2: H - M.b, class: 'ev-line' }, eg);
    el('circle', { cx: ex, cy: M.t - 14, r: 4.5, class: 'ev-dot' }, eg);
  }
  // Price path.
  const pts = [];
  let prev = null;
  for (const [d, c] of s) {
    const n = dnum(d);
    if (prev != null && n - prev > GAP_DAYS) pts.push(null);
    pts.push([X(n), Y(c)]);
    prev = n;
  }
  el('path', { d: linePath(pts), class: 'price', style: `stroke:${color}` }, svg);
  if (mk.closed && mk.y != null) {
    const yv = mk.y ? Math.min(100, top) : 0;
    el('circle', { cx: X(dnum(mk.dday)), cy: Y(yv), r: 6, class: mk.y ? 'res-dot yes' : 'res-dot no' }, svg);
  }
  // Forecast markers at each lead for resolved contracts.
  if (cal && cal.f) {
    for (const [L, [p, d]] of Object.entries(cal.f)) {
      el('circle', { cx: X(dnum(d)), cy: Y(p * 100), r: 4, class: 'fc-dot' }, svg);
      el('text', { x: X(dnum(d)), y: Y(p * 100) - 8, 'text-anchor': 'middle', class: 'fc-t' }, svg, `−${L}d`);
    }
  }
  const cross = el('line', { y1: M.t, y2: H - M.b, class: 'cross', visibility: 'hidden' }, svg);
  const dot = el('circle', { r: 4.5, class: 'cur-dot', visibility: 'hidden', style: `fill:${color}` }, svg);

  const byDay = new Map(s.map(r => [r[0], r[1]]));
  let cur = s.length - 1;
  const show = i => {
    cur = Math.max(0, Math.min(s.length - 1, i));
    const [d, c] = s[cur];
    const cx = X(dnum(d)), cy = Y(c);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
    const near = evs.filter(e => Math.abs(dnum(e.date) - dnum(d)) <= 1);
    const air = pla.find(r => r[0] === d);
    tip.innerHTML = `<b>${cents(c)}</b><span class="tt-d">${dayLabel(d)} (UTC)</span>` +
      (air ? `<small>PLA aircraft reported by MND: ${air[1]}</small>` : '') +
      near.map(e => `<span class="tt-ev">${dayLabel(e.date)}: ${esc(e.text)}</span>`).join('');
    const r = svg.getBoundingClientRect(), k = r.width / W;
    placeTip(tip, wrap, cx * k, cy * k);
  };
  const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); };
  const nearestIdx = n => {
    let best = 0, bd = Infinity;
    s.forEach((r, i) => { const dd = Math.abs(dnum(r[0]) - n); if (dd < bd) { bd = dd; best = i; } });
    return best;
  };
  svg.onpointermove = ev => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (W / r.width);
    show(nearestIdx(x0 + ((px - M.l) / (W - M.l - M.r)) * (x1 - x0)));
  };
  svg.onpointerleave = hide;
  svg.onblur = hide;
  svg.onkeydown = e => {
    const step = { ArrowRight: 1, ArrowLeft: -1, PageUp: 7, PageDown: -7, End: 1e6, Home: -1e6 }[e.key];
    if (step == null) return;
    e.preventDefault();
    show(tip.hidden && Math.abs(step) === 1 ? cur : cur + step);
  };

  // Accessible event list (also the source list for this chart).
  listEl.innerHTML = evs.length
    ? evs.map((e, i) => `<li><button type="button" class="ev-go" data-i="${i}">${dayLabel(e.date)}</button> ${esc(e.text)}
        ${e.src ? `<a href="${esc(e.src)}" target="_blank" rel="noopener">source</a>` : ''}
        ${byDay.has(e.date) ? `<span class="fine">price that day ${cents(byDay.get(e.date))}</span>` : ''}</li>`).join('')
    : '<li class="fine">No events from the sourced event lists fall inside this contract\'s trading window.</li>';
  listEl.querySelectorAll('.ev-go').forEach(b => b.onclick = () => {
    show(nearestIdx(dnum(evs[+b.dataset.i].date)));
    svg.focus({ preventScroll: true });
  });
  return evs.length;
}

/** Options for the contract picker: open first, then resolved, grouped by theater. */
export function pickerHTML(series, theaters, order) {
  const out = [];
  for (const th of order) {
    const ids = Object.keys(series).filter(id => series[id].th === th);
    const open = ids.filter(id => !series[id].closed).sort((a, b) => (series[a].deadline || '').localeCompare(series[b].deadline || ''));
    const res = ids.filter(id => series[id].closed).sort((a, b) => (series[b].dday || '').localeCompare(series[a].dday || ''));
    if (open.length) out.push(`<optgroup label="${esc(theaters[th])}: open">${open.map(id => `<option value="${id}">${esc(series[id].q)}</option>`).join('')}</optgroup>`);
    if (res.length) out.push(`<optgroup label="${esc(theaters[th])}: resolved">${res.map(id => `<option value="${id}">${esc(series[id].q)} (${series[id].y ? 'Yes' : 'No'})</option>`).join('')}</optgroup>`);
  }
  return out.join('');
}
