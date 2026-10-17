// Monthly tracker records (March 2026 onward): lookups, number formats, wedges, change summaries and per-case history.
// No monthly Japan backlog total was published before March 2026, so nothing earlier is drawn.
import { RECORDS } from '../data/cases.js';

const ORDER = [['trad', 'Traditional', false], ['trad_ip', 'Traditional', true], ['mun', 'Munitions', false],
  ['mun_ip', 'Munitions', true], ['asym', 'Asymmetric', false], ['asym_ip', 'Asymmetric', true]];

/** Records with Figure 1 wedges derived from the rows (open rows only; empty wedges dropped). */
export const MONTHS = RECORDS.map(r => {
  const open = r.rows.filter(x => !x.out);
  const wedges = ORDER.map(([id, cat, ip]) => {
    const rows = open.filter(x => x.cat === cat && !!x.p === ip);
    return { id, keys: rows.map(x => x.k), m: rows.reduce((s, x) => s + x.m, 0) };
  }).filter(w => w.m > 0);
  return { ...r, wedges };
});
export const LATEST = MONTHS[MONTHS.length - 1].mo;
export const moIndex = mo => MONTHS.findIndex(m => m.mo === mo);

/** House format: $x.xxB at or above $1,000M, else $xxxM. */
export const fmtHouse = m => m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${(Math.round(m * 100) / 100).toLocaleString('en-US')}M`;
/** Table format: millions with a thousands separator and up to two decimals, no unit. */
export const fmtTable = m => `$${(Math.round(m * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const list = a => a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
export const EXIT = { delivered: 'Fully delivered', removed: 'Removed' };

/** One line describing what changed since the previous record. */
export function changeSummary(i) {
  const m = MONTHS[i], prev = MONTHS[i - 1], parts = [];
  if (!prev) {
    const n = m.rows.filter(r => r.ups.length).length;
    const added = m.rows.filter(r => r.add);
    parts.push(`First monthly record. ${m.rows.filter(r => !r.out).length} open cases at month end${added.length ? `, including ${list(added.map(r => r.n))}, notified this month (+${fmtHouse(added.reduce((s, r) => s + r.m, 0))})` : ''}; ${n} ${n === 1 ? 'case has' : 'cases have'} a dated development this month`);
  } else {
    const added = m.rows.filter(r => r.add), out = m.rows.filter(r => r.out), newp = m.rows.filter(r => r.newp);
    if (added.length) parts.push(`${added.length === 1 ? 'New case' : `${added.length} new cases`} notified (${list(added.map(r => r.n))}): +${fmtHouse(added.reduce((s, r) => s + r.m, 0))}`);
    if (out.length) parts.push(`${list(out.map(r => r.n))} left the backlog: −${fmtHouse(out.reduce((s, r) => s + r.m, 0))}`);
    if (newp.length) parts.push(`${list(newp.map(r => r.n))} now partly delivered`);
    const ups = m.rows.filter(r => r.ups.length).length;
    if (ups) parts.push(`${ups} ${ups === 1 ? 'case has' : 'cases have'} a dated development`);
    if (!parts.length) parts.push(`No cases added, removed or newly partly delivered since ${prev.label}`);
  }
  const tot = prev && Math.abs(prev.total - m.total) > 0.005 ? `Total ${fmtHouse(m.total)}, was ${fmtHouse(prev.total)}.` : `Total ${fmtHouse(m.total)}${prev ? ', unchanged' : ''}.`;
  return `${parts.join('. ')}. ${tot}`;
}

/** A case's entry in every monthly record: { mo, label, p, add, out, newp, ups }. */
export function caseHistory(key) {
  return MONTHS.flatMap(m => m.rows.filter(r => r.k === key).map(r => ({ mo: m.mo, label: m.label, ...r })));
}

/** Wedge metadata in the TSM Figure 1 house style. */
export const WEDGE = {
  trad: { lines: ['Traditional'], fill: '#003505', ink: '#003505', cat: 'Traditional', ip: false },
  trad_ip: { lines: ['Traditional, Delivery', 'In Progress'], fill: '#E97100', ink: '#E97100', cat: 'Traditional', ip: true },
  mun: { lines: ['Munition'], fill: '#228B22', ink: '#228B22', cat: 'Munitions', ip: false },
  mun_ip: { lines: ['Munition, Delivery', 'in Progress'], fill: '#E97100', ink: '#E97100', cat: 'Munitions', ip: true },
  asym: { lines: ['Asymmetric'], fill: '#186618', ink: '#186618', cat: 'Asymmetric', ip: false },
  asym_ip: { lines: ['Asymmetric, Delivery', 'in Progress'], fill: '#ED7D31', ink: '#E97100', cat: 'Asymmetric', ip: true },
};
export const wedgeName = id => WEDGE[id].lines.join(' ').replace('Delivery In', 'Delivery in');

export function host(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    if (h !== 'web.archive.org') return h;
    const inner = u.match(/\/web\/[^/]+\/(https?:\/\/[^/]+)/);
    return inner ? `${new URL(inner[1]).hostname.replace(/^www\./, '')} (archived)` : h;
  } catch { return 'source'; }
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** "text (site)" with the site linked. */
export const srcLink = (u, label) => u ? ` <a href="${esc(u)}" target="_blank" rel="noopener">${esc(label || host(u))}</a>` : '';
