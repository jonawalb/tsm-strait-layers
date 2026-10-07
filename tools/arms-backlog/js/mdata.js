// Month-by-month backlog: lookups, number formats, change summaries and per-case status history.
// Months come from two publishers ('pub'): the Cato Institute to December 2024, TSM from January 2025.
import { MONTHS, SHORT } from '../data/months.js';

export { MONTHS };
export const LATEST = MONTHS[MONTHS.length - 1].mo;
export const moIndex = mo => MONTHS.findIndex(m => m.mo === mo);

/** make_fig1.py house format: $x.xxB at or above $1,000M, else $xxxM. */
export const fmtHouse = m => m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${Math.round(m).toLocaleString('en-US')}M`;
/** Table 1 format: whole millions with a thousands separator, no unit. */
export const fmtTable = m => m == null ? 'value not yet public' : `$${Math.round(m).toLocaleString('en-US')}`;

// A case with two rows that month (the two Stinger sales) gets the plural name; a single row its own short name.
const SHORT_X = { stinger: 'Stinger missiles (2 cases)' };
const shortName = (k, m) => (m.rows.filter(r => r.k === k).length > 1 && SHORT_X[k]) || SHORT[k] || (m.rows.find(r => r.k === k) || {}).n || k;
const list = a => a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const rowsM = rows => rows.reduce((s, r) => s + (r.m || 0), 0);

/** One line describing what changed since the previous month. */
export function changeSummary(i) {
  const m = MONTHS[i], prev = MONTHS[i - 1], c = m.chg, parts = [];
  // Rows added this month: new notifications, and cases the tracker found it had missed ('ak': 'review').
  // A row joining a case already open is named by its own row name.
  const addName = r => m.rows.filter(x => x.k === r.k).length > 1 ? r.n : shortName(r.k, m);
  const added = m.rows.filter(r => r.add && !r.out);
  const notified = added.filter(r => r.ak !== 'review'), review = added.filter(r => r.ak === 'review');
  if (notified.length) {
    parts.push(`${notified.length === 1 ? 'New case' : `${notified.length} new cases`} notified to Congress (${list(notified.map(addName))}): +${fmtHouse(rowsM(notified))}`);
  }
  if (review.length) {
    // "HIMARS (December 2022; value not yet public)": the caveat stays with its own case.
    const nv = n => n.endsWith(')') ? `${n.slice(0, -1)}; value not yet public)` : `${n} (value not yet public)`;
    const names = review.map(r => r.nv ? nv(addName(r)) : addName(r));
    parts.push(`Earlier sales added to the count (${list(names)}): +${fmtHouse(rowsM(review))}`);
  }
  const found = m.rows.filter(r => r.vf);
  if (found.length) parts.push(`${list(found.map(r => shortName(r.k, m)))} value now public and counted: +${fmtHouse(rowsM(found))}`);
  const outBy = why => c.out.filter(k => m.rows.find(r => r.k === k).out === why);
  const outM = keys => m.rows.filter(r => keys.includes(r.k) && r.out).reduce((s, r) => s + r.m, 0);
  const del = outBy('delivered'), rem = outBy('removed'), can = outBy('cancelled');
  if (del.length) parts.push(`${list(del.map(k => shortName(k, m)))} fully delivered: −${fmtHouse(outM(del))}`);
  if (rem.length) parts.push(`${list(rem.map(k => shortName(k, m)))} removed from the backlog: −${fmtHouse(outM(rem))}`);
  if (can.length) parts.push(`${list(can.map(k => shortName(k, m)))} cancelled: −${fmtHouse(outM(can))}`);
  if (c.newp.length) {
    const names = list(c.newp.map(k => shortName(k, m)));
    parts.push(c.rule ? `${c.rule}: ${names} newly shown as partly delivered` : `${names} now partly delivered`);
  }
  if (!parts.length) parts.push(prev ? `No cases added, removed or newly partly delivered since ${prev.label}` : 'First monthly update');
  const tot = prev && prev.total !== m.total ? `Total ${fmtHouse(m.total)}, was ${fmtHouse(prev.total)}.` : `Total ${fmtHouse(m.total)}${prev ? ', unchanged' : ''}.`;
  return `${parts.join('. ')}. ${tot}`;
}

/**
 * A case's status in every month it appears, with consecutive identical entries merged.
 * Each entry: { from, to, st, p, add, out, newp }.
 */
export function caseHistory(key) {
  const out = [];
  MONTHS.forEach((m, i) => {
    const rows = m.rows.filter(r => r.k === key);
    if (!rows.length) return;
    const multi = rows.length > 1 && new Set(rows.map(r => r.st)).size > 1;
    const st = multi ? rows.map(r => `${r.n}: ${r.st}`).join(' ') : rows[0].st;
    const r = rows[0];
    const prevRow = i ? MONTHS[i - 1].rows.find(x => x.k === key && !x.out) : null;
    const e = { from: m, to: m, st, p: r.p, add: !!r.add, out: r.out || null, newp: !!(prevRow && r.p && !prevRow.p) };
    const last = out[out.length - 1];
    if (last && last.st === e.st && last.p === e.p && !e.add && !e.out && !e.newp && !last.out) last.to = m;
    else out.push(e);
  });
  return out;
}

/** Publisher of a month, for source lines and notes. */
export const PUB = {
  TSM: { short: 'TSM', name: 'Taiwan Security Monitor' },
  Cato: { short: 'Cato', name: 'Cato Institute' },
};
export const EXIT = { delivered: 'Fully delivered', removed: 'Removed', cancelled: 'Cancelled' };

/** Wedge metadata in the make_fig1.py house style. */
export const WEDGE = {
  trad: { lines: ['Traditional'], fill: '#003505', ink: '#003505', cat: 'Traditional', ip: false },
  trad_ip: { lines: ['Traditional, Delivery', 'In Progress'], fill: '#E97100', ink: '#E97100', cat: 'Traditional', ip: true },
  mun: { lines: ['Munition'], fill: '#228B22', ink: '#228B22', cat: 'Munitions', ip: false },
  mun_ip: { lines: ['Munition, Delivery', 'in Progress'], fill: '#E97100', ink: '#E97100', cat: 'Munitions', ip: true },
  asym: { lines: ['Asymmetric'], fill: '#186618', ink: '#186618', cat: 'Asymmetric', ip: false },
  asym_ip: { lines: ['Asymmetric, Delivery', 'in Progress'], fill: '#ED7D31', ink: '#E97100', cat: 'Asymmetric', ip: true },
};
export const wedgeName = id => WEDGE[id].lines.join(' ').replace('Delivery In', 'Delivery in');

/** Status text as HTML: escaped, with any bare URL turned into a short link named for its site, e.g.
 * "…by 2026: https://www.reuters.com/…" becomes "…by 2026 (reuters.com)". */
export function statusHtml(text) {
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return String(text).split(/(https?:\/\/[^\s]+?)(?=[.,;)]?(?:\s|$))/).map((part, i) => {
    if (i % 2 === 0) return esc(part).replace(/:\s*$/, '');
    let host = part;
    try { host = new URL(part).hostname.replace(/^www\./, ''); } catch (e) { /* not a URL after all */ }
    return ` (<a href="${esc(part)}" target="_blank" rel="noopener">${esc(host)}</a>)`;
  }).join('');
}
