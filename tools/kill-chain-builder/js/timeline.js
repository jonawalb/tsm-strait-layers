// Under-board readouts: the best path's timeline with position error growth, and a per-node check table.
import { el, fmt, escapeHtml } from '../../../shared/js/mapkit.js';
import { TYPES, CATS, CH_NAMES } from '../data/catalog.js';
import { distOf, reachOf } from './model.js';

const W = 900, H = 206, L = 12, R = 12;
const f1 = x => (Math.round(x * 10) / 10).toLocaleString('en-US');
const SEG_CLS = { wait: 'wait', proc: 'proc', decide: 'decide', relay: 'relay', launch: 'launch', flight: 'flight' };

export function renderTimeline(svg, r, S, label) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const b = r.best;
  if (!b) { el('text', { x: W / 2, y: H / 2, class: 'tl-empty', 'text-anchor': 'middle' }, svg, 'Connect a sensor to a shooter to see the timeline.'); return; }
  const tMax = Math.max(b.total, Number.isFinite(b.dwell) ? b.dwell : 0) * 1.06;
  const x = t => L + (W - L - R) * t / tMax;
  // Row 1: time segments.
  let t0 = 0;
  const row = el('g', {}, svg);
  el('text', { x: L, y: 14, class: 'tl-h' }, row, `Time from the target's appearance to impact: ${f1(b.total)} min`);
  for (const s of b.segs) {
    const g = el('g', {}, row);
    el('rect', { x: x(t0), y: 22, width: Math.max(1, x(t0 + s.min) - x(t0)), height: 26, class: 'seg ' + SEG_CLS[s.k] }, g);
    el('title', {}, g, `${s.label}: ${f1(s.min)} min`);
    const wpx = x(t0 + s.min) - x(t0), full = `${s.label} ${f1(s.min)}′`, short = `${f1(s.min)}′`;
    const txt = full.length * 6.2 + 10 < wpx ? full : short.length * 6.2 + 8 < wpx ? short : '';
    if (txt) el('text', { x: x(t0) + 5, y: 39, class: 'seg-t' }, g, txt);
    t0 += s.min;
  }
  // Row 2: position error.
  const y0 = 186, y1 = 92, v = r.v;
  const tDet = b.segs[0].min, sig0 = TYPES[S.nodes.find(n => n.id === b.sensor).type].sigma;
  const eFix = sig0 + v * (b.total - tDet);
  const eMax = Math.max(eFix, b.err, b.basket) * 1.12 || 1;
  const y = e => y0 - (y0 - y1) * e / eMax;
  el('line', { x1: L, x2: W - R, y1: y0, y2: y0, class: 'axis' }, svg);
  const ok = b.err <= b.basket;
  const srcTxt = b.src.kind === 'fix' ? `${label(b.sensor)} fix` : `${label(b.src.id)} ${b.src.kind === 'mid' ? 'in-flight updates' : 'track'}`;
  el('text', { x: L, y: 72, class: 'tl-h' }, svg, 'Position error of the aim point (km)');
  el('text', { x: W - R, y: 72, class: 'tl-h ' + (ok ? 'ok' : 'no'), 'text-anchor': 'end' }, svg,
    `At impact: ${f1(b.err)} km from ${srcTxt} vs ${b.basket} km basket`);
  el('line', { x1: L, x2: W - R, y1: y(b.basket), y2: y(b.basket), class: 'basket' }, svg);
  el('text', { x: L + 2, y: y(b.basket) - 5, class: 'tl-lbl' }, svg, `seeker basket ${b.basket} km`);
  el('path', { d: `M${x(tDet)} ${y(sig0)}L${x(b.total)} ${y(eFix)}`, class: 'errline' }, svg);
  el('text', { x: x(tDet) > L + 200 ? x(tDet) - 6 : x(tDet) + 6, y: y(sig0) - (x(tDet) > L + 200 ? 6 : 24), class: 'tl-lbl', 'text-anchor': x(tDet) > L + 200 ? 'end' : 'start' }, svg, `fix from ${label(b.sensor)}, aging`);
  if (b.src.kind !== 'fix') {
    const tt = TYPES[S.nodes.find(n => n.id === b.src.id).type];
    el('path', { d: `M${x(Math.max(0, b.total - b.src.age))} ${y(tt.sigma)}L${x(b.total)} ${y(b.err)}`, class: 'trkline' }, svg);
    el('text', { x: x(Math.max(0, b.total - b.src.age)) - 6, y: y(tt.sigma) - 6, class: 'tl-lbl', 'text-anchor': 'end' }, svg, `${label(b.src.id)} ${b.src.kind === 'mid' ? 'updates' : 'track'}`);
  }
  if (Number.isFinite(b.dwell)) {
    el('line', { x1: x(b.dwell), x2: x(b.dwell), y1: 20, y2: y0, class: 'dwell' }, svg);
    el('text', { x: x(b.dwell) - 4, y: y0 - 6, class: 'tl-lbl warn', 'text-anchor': 'end' }, svg, 'target moves and hides');
  }
  el('circle', { cx: x(b.total), cy: y(b.err), r: 6, class: 'impact ' + (ok ? 'in' : 'out') }, svg);
  for (let t = 0; t <= tMax; t += tickStep(tMax)) {
    el('line', { x1: x(t), x2: x(t), y1: y0, y2: y0 + 4, class: 'axis' }, svg);
    el('text', { x: x(t), y: y0 + 15, class: 'tick', 'text-anchor': t === 0 ? 'start' : 'middle' }, svg, `${t}′`);
  }
}
const tickStep = m => [1, 2, 5, 10, 15, 20, 30, 60].find(s => m / s <= 10) || 120;

export function renderChecks(tbody, r, S, label) {
  tbody.innerHTML = S.nodes.map(n => {
    const t = TYPES[n.type], dead = S.dead.has(n.id);
    let det = '', st = '';
    if (t.cat === 'sensor') {
      const d = r.det.get(n.id);
      det = d.ch ? `${fmt(d.range)} km on ${CH_NAMES[d.ch]}` : 'no usable channel';
      st = d.skip ? 'skip zone' : d.ok ? 'sees target' : 'too far or too faint';
    } else if (t.cat === 'shooter') {
      det = `reach ${fmt(reachOf(n))} km`;
      st = distOf(n, S.sc) <= reachOf(n) ? 'in range' : 'out of range';
    } else { det = t.authority ? `decides in ${t.decide} min` : `relays in ${t.relay} min`; st = '–'; }
    const dist = t.cat === 'c2' ? '–' : `${fmt(distOf(n, S.sc))} km`;
    return `<tr${dead ? ' class="dead"' : ''}><td>${escapeHtml(label(n.id))}</td><td>${CATS[t.cat].name}</td><td class="num">${dist}</td><td class="num">${det}</td><td>${dead ? 'knocked out' : st}</td></tr>`;
  }).join('') || '<tr><td colspan="5">No nodes on the board.</td></tr>';
}
