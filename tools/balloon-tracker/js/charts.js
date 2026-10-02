// Timeline of balloons per reporting day, and a month-of-year chart showing the winter season.
import { el } from '../../../shared/js/mapkit.js';
import { EVENTS, SHEET_ONLY, SEASONS, MONTH_ABBR, seasonOf, countOf, nice } from './data.js';

const MS = 864e5;
const t = d => new Date(d + 'T00:00:00Z').getTime();

export function drawTimeline(svg, { onPick, onHover, end }) {
  const W = 1000, H = 170, L = 30, R = 8, TOP = 12, BOT = 140;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const first = [...EVENTS, ...SHEET_ONLY].map(e => e.d).sort()[0];
  const t0 = t(first.slice(0, 7) + '-01') - 15 * MS, t1 = t(end) + 5 * MS;
  const x = d => L + ((t(d) - t0) / (t1 - t0)) * (W - L - R);
  const max = Math.max(...EVENTS.map(countOf), ...SHEET_ONLY.map(e => e.n));
  const y = v => BOT - (v / max) * (BOT - TOP);
  const bw = Math.max(2, (W - L - R) / ((t1 - t0) / MS));

  const ax = el('g', { class: 'axis' }, svg);
  for (let v = 0; v <= max; v += max > 10 ? 5 : 2) {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, ax);
    el('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end' }, ax, v);
  }
  // winter bands (Nov-Mar) and month ticks
  for (let yr = +first.slice(0, 4) - 1; yr <= +end.slice(0, 4); yr++) {
    const a = Math.max(x(`${yr}-11-01`), L), b = Math.min(x(`${yr + 1}-04-01`), W - R);
    if (b > a) el('rect', { x: a, y: TOP, width: b - a, height: BOT - TOP, class: 'winter' }, svg);
  }
  for (let m = new Date(t0 + 15 * MS); m.getTime() <= t1; m.setUTCMonth(m.getUTCMonth() + 1)) {
    const d = m.toISOString().slice(0, 10), xx = x(d);
    el('line', { x1: xx, x2: xx, y1: BOT, y2: BOT + (m.getUTCMonth() === 0 ? 8 : 3) }, ax);
    if (m.getUTCMonth() === 0) el('text', { x: xx + 3, y: BOT + 18 }, ax, d.slice(0, 4));
    else if (m.getUTCMonth() % 3 === 0) el('text', { x: xx + 2, y: BOT + 14, class: 'mo' }, ax, MONTH_ABBR[m.getUTCMonth()]);
  }
  el('line', { x1: L, x2: W - R, y1: BOT, y2: BOT, class: 'base' }, ax);

  const bars = el('g', {}, svg);
  const marks = [];
  const add = (d, v, cls, ev) => {
    const r = el('rect', { x: x(d) - bw / 2, y: y(v), width: bw, height: BOT - y(v), class: cls, tabindex: ev ? 0 : -1,
      role: ev ? 'button' : 'img', 'aria-label': `${nice(d)}: ${v} balloon${v === 1 ? '' : 's'}${ev ? '' : ' (TSM sheet only)'}` }, bars);
    // wide invisible hit area
    const hit = el('rect', { x: x(d) - 4, y: TOP, width: 8, height: BOT - TOP, class: 'hit' }, bars);
    [r, hit].forEach(n => {
      n.addEventListener('pointerenter', e => onHover({ d, v, ev }, e));
      n.addEventListener('pointerleave', () => onHover(null));
      if (ev) n.addEventListener('click', () => onPick(ev));
    });
    r.addEventListener('keydown', e => { if (ev && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(ev); } });
    marks.push({ r, d });
  };
  SHEET_ONLY.forEach(e => add(e.d, e.n, 'bar sheet', null));
  EVENTS.forEach(e => add(e.d, countOf(e), 'bar', e));
  return {
    update({ season, dayD }) {
      marks.forEach(({ r, d }) => {
        r.classList.toggle('off', !!season && seasonOf(d) !== season);
        r.classList.toggle('sel', d === dayD);
      });
    },
  };
}

/* Balloons by calendar month, one bar per season, July to June so each winter sits in the middle. */
export function drawSeasonality(svg, { onSeason }) {
  const W = 1000, H = 220, L = 30, R = 8, TOP = 16, BOT = 190;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const order = [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5];
  const tot = {};
  SEASONS.forEach(s => { tot[s] = new Array(12).fill(0); });
  EVENTS.forEach(e => { tot[seasonOf(e.d)][+e.d.slice(5, 7) - 1] += countOf(e); });
  SHEET_ONLY.forEach(e => { tot[seasonOf(e.d)][+e.d.slice(5, 7) - 1] += e.n; });
  const max = Math.max(1, ...SEASONS.flatMap(s => tot[s]));
  const gw = (W - L - R) / 12, bw = Math.min(26, (gw - 10) / SEASONS.length);
  const y = v => BOT - (v / max) * (BOT - TOP);
  const ax = el('g', { class: 'axis' }, svg);
  const step = max > 50 ? 20 : max > 20 ? 10 : 5;
  for (let v = 0; v <= max; v += step) {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, ax);
    el('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end' }, ax, v);
  }
  const groups = [];
  order.forEach((m, j) => {
    const gx = L + j * gw;
    el('text', { x: gx + gw / 2, y: BOT + 18, 'text-anchor': 'middle' }, ax, MONTH_ABBR[m]);
    SEASONS.forEach((s, k) => {
      const v = tot[s][m];
      const bx = gx + (gw - bw * SEASONS.length) / 2 + k * bw;
      const r = el('rect', { x: bx + 1, y: y(v), width: bw - 2, height: Math.max(0, BOT - y(v)), class: `sbar s${k % 4}`, 'data-season': s }, svg);
      const tt = el('title', {}, r); tt.textContent = `${MONTH_ABBR[m]}, ${s} season: ${v} balloon${v === 1 ? '' : 's'}`;
      r.addEventListener('click', () => onSeason(s));
      groups.push(r);
    });
  });
  el('line', { x1: L, x2: W - R, y1: BOT, y2: BOT, class: 'base' }, ax);
  return {
    legend: SEASONS.map((s, k) => ({ s, k })),
    update({ season }) { groups.forEach(r => r.classList.toggle('off', !!season && r.dataset.season !== season)); },
  };
}
