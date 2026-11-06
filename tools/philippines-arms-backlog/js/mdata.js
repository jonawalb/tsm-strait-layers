// Monthly tracker records (March 2026 onward): lookups, number formats, wedges, change summaries and per-case history.
// Each record keeps the two tiers apart: tot.contracted and tot.nna. No monthly Philippine figure was published before
// March 2026, so nothing earlier is drawn.
import { RECORDS } from '../data/cases.js';

const CAT_ID = { Traditional: 'trad', Munitions: 'mun', Asymmetric: 'asym' };
// Clockwise order: the contracted tier first (with its partly delivered slices), then notified-not-accepted.
const ORDER = [];
for (const tier of ['contracted', 'nna']) {
  for (const cat of ['Traditional', 'Munitions', 'Asymmetric']) {
    ORDER.push([`${tier === 'contracted' ? 'c' : 'n'}_${CAT_ID[cat]}`, tier, cat, false]);
    if (tier === 'contracted') ORDER.push([`c_${CAT_ID[cat]}_ip`, tier, cat, true]);
  }
}

/** Records with Figure 1 wedges derived from the rows (open rows only; empty wedges dropped). */
export const MONTHS = RECORDS.map(r => {
  const open = r.rows.filter(x => !x.out);
  const wedges = ORDER.map(([id, tier, cat, ip]) => {
    const rows = open.filter(x => x.tier === tier && x.cat === cat && (tier !== 'contracted' || !!x.p === ip));
    return { id, tier, keys: rows.map(x => x.k), m: rows.reduce((s, x) => s + x.m, 0) };
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
const TN = { contracted: 'contracted', nna: 'notified, not accepted' };

/** One line describing what changed since the previous record, tier by tier. */
export function changeSummary(i) {
  const m = MONTHS[i], prev = MONTHS[i - 1], parts = [];
  const added = m.rows.filter(r => r.add), out = m.rows.filter(r => r.out), moved = m.rows.filter(r => r.moved);
  const ups = m.rows.filter(r => r.ups.length).length;
  if (!prev) parts.push(`First monthly record. ${m.rows.filter(r => !r.out).length} open cases at month end`);
  if (added.length) parts.push(`${added.length === 1 ? 'New notification' : `${added.length} new notifications`}: ${list(added.map(r => r.n))}, +${fmtHouse(added.reduce((s, r) => s + r.m, 0))} to the ${list([...new Set(added.map(r => TN[r.tier]))])} tier`);
  if (moved.length) parts.push(`${list(moved.map(r => r.n))} moved to the ${TN[moved[0].tier]} tier`);
  if (out.length) parts.push(`${list(out.map(r => r.n))} left the backlog`);
  if (ups) parts.push(`${ups} ${ups === 1 ? 'case has' : 'cases have'} a dated development`);
  if (prev && !added.length && !moved.length && !out.length) parts.push(`No case added, signed or removed since ${prev.label}`);
  const tier = t => {
    const was = prev ? prev.tot[t] : null;
    return `${t === 'contracted' ? 'Contracted' : 'Notified, not accepted'} ${fmtHouse(m.tot[t])}${was === null ? '' : Math.abs(was - m.tot[t]) > 0.005 ? ` (was ${fmtHouse(was)})` : ', unchanged'}`;
  };
  return `${parts.join('. ')}. ${tier('contracted')}; ${tier('nna')}.`;
}

/** A case's entry in every monthly record: { mo, label, tier, p, add, out, moved, ups }. */
export function caseHistory(key) {
  return MONTHS.flatMap(m => m.rows.filter(r => r.k === key).map(r => ({ mo: m.mo, label: m.label, ...r })));
}

/** Wedge metadata. Contracted wedges use TSM's Figure 1 greens (orange for deliveries in progress); notified-not-accepted
 *  wedges are grey, because nothing has been bought. */
export const WEDGE = {
  c_trad: { lines: ['Contracted,', 'Traditional'], fill: '#003505', ink: '#003505' },
  c_trad_ip: { lines: ['Contracted, Traditional,', 'Delivery in Progress'], fill: '#E97100', ink: '#B85600' },
  c_mun: { lines: ['Contracted,', 'Munition'], fill: '#228B22', ink: '#1E7B34' },
  c_mun_ip: { lines: ['Contracted, Munition,', 'Delivery in Progress'], fill: '#E97100', ink: '#B85600' },
  c_asym: { lines: ['Contracted,', 'Asymmetric'], fill: '#186618', ink: '#186618' },
  c_asym_ip: { lines: ['Contracted, Asymmetric,', 'Delivery in Progress'], fill: '#ED7D31', ink: '#B85600' },
  n_trad: { lines: ['Notified, Not Accepted,', 'Traditional'], fill: '#6E746D', ink: '#4A4F49' },
  n_mun: { lines: ['Notified, Not Accepted,', 'Munition'], fill: '#A3A89F', ink: '#4A4F49' },
  n_asym: { lines: ['Notified, Not Accepted,', 'Asymmetric'], fill: '#C3C7BE', ink: '#4A4F49' },
};
export const wedgeName = id => WEDGE[id].lines.join(' ').replace(', Delivery in', ', delivery in');

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
