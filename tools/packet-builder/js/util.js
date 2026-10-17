// Small helpers shared by the packet builder modules: dates, numbers, escaping.

const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** ISO date plus n days (UTC, no time-zone drift). */
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Number of calendar days from a to b, inclusive. */
export const spanDays = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;

/** Last day of a YYYY-MM month as ISO. */
export function monthEnd(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export const monthName = ym => `${MONTH_LONG[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;

/** "Aug. 4, 2026", or "Aug. 4" with year: false. */
export function fmtDate(iso, year = true) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MON[m - 1]} ${d}${year ? ', ' + y : ''}`;
}

/** Compact range: "Aug. 1–31, 2026", "Aug. 25 – Sept. 3, 2026", "Dec. 26, 2025 – Jan. 2, 2026". */
export function fmtRange(a, b) {
  if (a === b) return fmtDate(a);
  const [ya, ma] = a.split('-'), [yb, mb] = b.split('-');
  if (ya !== yb) return `${fmtDate(a)} – ${fmtDate(b)}`;
  if (ma !== mb) return `${fmtDate(a, false)} – ${fmtDate(b)}`;
  return `${fmtDate(a, false)}–${+b.slice(8)}, ${yb}`;
}

/** Today's date as the reader's browser sees it, ISO. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const fmtN = (n, dp = 0) => n == null || Number.isNaN(n) ? '–'
  : n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Signed percent change, or null when there is no base. */
export const pctChange = (now, before) => (before == null || now == null || before === 0) ? null : (now - before) / before * 100;

export const plural = (n, one, many = one + 's') => `${fmtN(n)} ${n === 1 ? one : many}`;

/** Parse an HTML string into a single element. */
export function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Shorten text at a word boundary. */
export function clip(s, max) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.7)).replace(/[,;:.\s]+$/, '') + '…';
}
