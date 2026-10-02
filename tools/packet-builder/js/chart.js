// Daily chart for the packet: aircraft (with median-line/ADIZ share), flags, CCG incidents,
// allied transits and ship counts. Returns an SVG string sized for a Letter page's text column.
import { fmtDate } from './util.js';

const W = 704, L = 44, R = 8;
const Y = { flag: 12, a0: 30, a1: 196, ev: 212, s0: 232, s1: 292, axis: 310 };
const H = 318;

function niceMax(v) {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

export function dailyChart(days) {
  const n = days.length, iw = W - L - R, bw = iw / n;
  const x = i => L + i * bw, cx = i => L + (i + 0.5) * bw;
  const barW = Math.max(1, bw * (n > 120 ? 0.9 : 0.72));
  const aMax = niceMax(Math.max(1, ...days.map(d => d.air ?? 0)));
  const ya = v => Y.a1 - v / aMax * (Y.a1 - Y.a0);
  const sMax = niceMax(Math.max(1, ...days.map(d => Math.max(d.plan ?? 0, d.off ?? 0))));
  const ys = v => Y.s1 - v / sMax * (Y.s1 - Y.s0);
  const o = [];
  o.push(`<svg class="dchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily PLA activity chart">`);
  // Exercise days
  days.forEach((d, i) => { if (d.ex) o.push(`<rect class="exd" x="${x(i)}" y="${Y.a0 - 22}" width="${bw}" height="${Y.s1 - Y.a0 + 22}"/>`); });
  // Aircraft grid
  const aSteps = aMax % 4 === 0 ? 4 : 5;
  for (let k = 0; k <= aSteps; k++) {
    const v = aMax * k / aSteps, y = ya(v);
    o.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="yl" x="${L - 5}" y="${y + 3}">${v}</text>`);
  }
  // Bars
  days.forEach((d, i) => {
    const bx = cx(i) - barW / 2;
    if (d.air == null) { o.push(`<rect class="na" x="${bx}" y="${Y.a1 - 3}" width="${barW}" height="3"/>`); return; }
    o.push(`<rect class="b-air" x="${bx}" y="${ya(d.air)}" width="${barW}" height="${Y.a1 - ya(d.air)}"/>`);
    if (d.adiz != null) o.push(`<rect class="b-adiz" x="${bx}" y="${ya(d.adiz)}" width="${barW}" height="${Y.a1 - ya(d.adiz)}"/>`);
    if (n <= 35 && d.air > 0) o.push(`<text class="v" x="${cx(i)}" y="${ya(d.air) - 3}">${d.air}</text>`);
  });
  o.push(`<line class="axis" x1="${L}" x2="${W - R}" y1="${Y.a1}" y2="${Y.a1}"/>`);
  // Flags
  const r = Math.min(5, Math.max(2.5, bw * 0.4));
  days.forEach((d, i) => {
    if (d.flag.includes('J')) o.push(`<path class="f-j" d="M${cx(i) - r} ${Y.flag - r}L${cx(i) + r} ${Y.flag - r}L${cx(i)} ${Y.flag + r}Z"/>`);
    if (d.flag.includes('L')) o.push(`<rect class="f-l" x="${cx(i) - r * .8}" y="${Y.flag + (d.flag.includes('J') ? r + 2 : -r * .8)}" width="${r * 1.6}" height="${r * 1.6}" transform="rotate(45 ${cx(i)} ${Y.flag + (d.flag.includes('J') ? r + 2 + r * .8 : 0)})"/>`);
  });
  // Events row
  o.push(`<text class="rl" x="${L - 5}" y="${Y.ev + 3}">events</text>`);
  days.forEach((d, i) => {
    if (d.ccg) o.push(`<circle class="e-ccg" cx="${cx(i) - (d.tr ? r * .7 : 0)}" cy="${Y.ev}" r="${r * .85}"/>`);
    if (d.tr) o.push(`<rect class="e-tr" x="${cx(i) + (d.ccg ? r * .7 : 0) - r * .8}" y="${Y.ev - r * .8}" width="${r * 1.6}" height="${r * 1.6}"/>`);
  });
  // Ships panel
  const sSteps = sMax % 2 === 0 ? 2 : 1;
  for (let k = 0; k <= sSteps; k++) {
    const v = sMax * k / sSteps, y = ys(v);
    o.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="yl" x="${L - 5}" y="${y + 3}">${v}</text>`);
  }
  for (const [key, cls] of [['plan', 'l-plan'], ['off', 'l-off']]) {
    let dstr = '', pen = false;
    days.forEach((d, i) => {
      if (d[key] == null) { pen = false; return; }
      dstr += `${pen ? 'L' : 'M'}${cx(i).toFixed(1)} ${ys(d[key]).toFixed(1)}`; pen = true;
    });
    if (dstr) o.push(`<path class="${cls}" d="${dstr}"/>`);
    if (n <= 62) days.forEach((d, i) => { if (d[key] != null) o.push(`<circle class="${cls}-d" cx="${cx(i)}" cy="${ys(d[key])}" r="${n <= 35 ? 2.2 : 1.5}"/>`); });
  }
  o.push(`<line class="axis" x1="${L}" x2="${W - R}" y1="${Y.s1}" y2="${Y.s1}"/>`);
  o.push(`<text class="pl" x="${L + 4}" y="${Y.a0 - 4}">PLA aircraft per day</text><text class="pl" x="${L + 4}" y="${Y.s0 - 5}">Ships per day</text>`);
  // X axis
  if (n <= 62) {
    const step = n <= 10 ? 1 : n <= 21 ? 2 : n <= 35 ? 4 : 7;
    days.forEach((d, i) => {
      if (i % step) return;
      o.push(`<line class="tick" x1="${cx(i)}" x2="${cx(i)}" y1="${Y.s1}" y2="${Y.s1 + 4}"/><text class="xl" x="${cx(i)}" y="${Y.axis}">${fmtDate(d.d, false)}</text>`);
    });
  } else {
    days.forEach((d, i) => {
      if (d.d.slice(8) !== '01') return;
      const m = +d.d.slice(5, 7);
      o.push(`<line class="tick" x1="${x(i)}" x2="${x(i)}" y1="${Y.s1}" y2="${Y.s1 + 4}"/><text class="xl" x="${x(i) + 2}" y="${Y.axis}" style="text-anchor:start">${MON[m - 1]}${m === 1 ? ' ' + d.d.slice(0, 4) : ''}</text>`);
    });
  }
  o.push('</svg>');
  return o.join('');
}

export const CHART_LEGEND = `<p class="legend">
  <span><i class="sw s-air"></i>Aircraft</span><span><i class="sw s-adiz"></i>Crossed median line or entered ADIZ</span>
  <span><i class="sw s-na"></i>No TSM data</span><span><i class="sw s-ex"></i>Listed exercise day</span>
  <span><i class="mk m-j"></i>Joint combat readiness patrol</span><span><i class="mk m-l"></i>Long-range flight</span>
  <span><i class="mk m-ccg"></i>CCG incident</span><span><i class="mk m-tr"></i>Allied transit</span>
  <span><i class="ln l1"></i>PLAN ships</span><span><i class="ln l2"></i>Official ships</span></p>`;
