// Small helpers shared by the Forecast Board modules.
export const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with attributes, optionally appended to a parent and given text. */
export function el(tag, attrs = {}, parent = null, text = null) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-05-19' -> '19 May 2026'. */
export const dayLabel = d => (d ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '–');
export const monLabel = d => `${MON[+d.slice(5, 7) - 1]} ’${d.slice(2, 4)}`;
/** Days since 1970 for a YYYY-MM-DD date (UTC). */
export const dnum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
export const dstr = n => new Date(n * 864e5).toISOString().slice(0, 10);

export const cents = c => (c == null ? '–' : c < 1 && c > 0 ? `${c.toFixed(2)}¢` : c < 10 ? `${c.toFixed(1)}¢` : `${Math.round(c)}¢`);
export const signedPts = c => (c == null ? '–' : `${c > 0 ? '+' : c < 0 ? '−' : '±'}${Math.abs(c) < 10 ? Math.abs(c).toFixed(1) : Math.round(Math.abs(c))}`);
export const fmtUSD = v => (v == null ? '–' : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
export const f3 = x => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(3));

/** Position a tooltip near a point inside a positioned wrapper, kept inside it. */
export function placeTip(tip, wrap, x, y) {
  const w = wrap.clientWidth;
  tip.hidden = false;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = x + 14, top = y - th - 10;
  if (left + tw > w) left = Math.max(0, x - tw - 14);
  if (top < 0) top = Math.min(y + 14, Math.max(0, wrap.clientHeight - th));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

/** Linear scale. */
export const lin = (d0, d1, r0, r1) => v => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

/** Polyline path through [x, y] points, breaking where a point is null. */
export function linePath(pts) {
  let s = '', pen = false;
  for (const p of pts) {
    if (!p) { pen = false; continue; }
    s += `${pen ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    pen = true;
  }
  return s;
}

/** Load a JSON file from ../data (gate.js decrypts on the published site). */
export async function loadJSON(name) {
  const r = await fetch(new URL(`../data/${name}`, import.meta.url));
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

export const THEATER_COLOR = { taiwan: 'var(--c1)', mideast: 'var(--c2)', russia: 'var(--c3)', other: 'var(--c4)' };
export const PAPER_THEATER = { iran_israel: 'Iran/Israel', russia_ukraine: 'Russia/Ukraine', taiwan: 'Taiwan' };
export const polyURL = slug => `https://polymarket.com/market/${encodeURIComponent(slug || '')}`;

/** ViewBox width for a chart: its on-screen width, clamped, so text stays near 11px on phones. */
export const vbw = (svg, lo, hi) => Math.round(Math.max(lo, Math.min(hi, (svg.parentElement && svg.parentElement.clientWidth) || hi)));
