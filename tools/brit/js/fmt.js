// Shared helpers: money formatting, color bins, sector groups, BRI status.
import { META } from '../data/countries.js';

// USD millions -> "$1.2bn" / "$340m" / "$1.34tn"
export function usd(m) {
  if (m == null || Number.isNaN(m)) return 'n/a';
  const a = Math.abs(m);
  if (a >= 1e6) return `$${(m / 1e6).toFixed(2)}tn`;
  if (a >= 1e4) return `$${(m / 1e3).toFixed(1)}bn`;
  if (a >= 1e3) return `$${(m / 1e3).toFixed(2)}bn`;
  if (a >= 1) return `$${Math.round(m)}m`;
  if (a > 0) return `$${(m * 1000).toFixed(0)}k`;
  return '$0';
}

// Bin edges in USD millions, shared by both metrics so the two maps are comparable.
export const EDGES = [100, 1000, 5000, 15000, 40000, 100000];
export const EDGE_LABELS = ['$0.1bn', '$1bn', '$5bn', '$15bn', '$40bn', '$100bn'];
export function bin(m) {
  if (!(m > 0)) return -1;
  let i = 0;
  while (i < EDGES.length && m >= EDGES[i]) i++;
  return i; // 0..6
}
export const binColor = (b) => (b < 0 ? 'var(--nodata)' : `var(--r${b})`);

export const METRICS = {
  ad: {
    label: 'State lending & grants', span: '2000–2021', short: 'AidData lending & grants',
    value: (c) => c?.ad?.t ?? null,
    note: 'AidData GCDF 3.0, constant 2021 USD',
  },
  aei: {
    label: 'Investment & construction', span: '2005–2023', short: 'AEI investment + construction',
    value: (c) => (c?.aei ? c.aei.i + c.aei.c : null),
    note: 'AEI China Global Investment Tracker, nominal USD',
  },
};

// Sector groups for project points (colors use shared series tokens).
const GROUPS = [
  ['Energy', 'var(--c2)', ['Energy']],
  ['Transport', 'var(--c1)', ['Transport and Storage']],
  ['Industry & mining', 'var(--c8)', ['Industry, Mining, Construction']],
  ['Communications', 'var(--c6)', ['Communications']],
  ['Finance & budget support', 'var(--c5)', ['Action Relating To Debt', 'Banking and Financial Services', 'General Budget Support',
    'Trade Policies and Regulations', 'Business and Other Services', 'Other Commodity Assistance']],
  ['Social & public services', 'var(--c3)', ['Education', 'Health', 'Water Supply and Sanitation', 'Government and Civil Society',
    'Other Social Infrastructure and Services', 'Population Policies/Programmes and Reproductive Health',
    'Agriculture, Forestry, Fishing', 'General Environmental Protection', 'Developmental Food Aid/Food Security Assistance',
    'Emergency Response', 'Disaster Prevention and Preparedness', 'Reconstruction Relief and Rehabilitation']],
  ['Other', 'var(--c7)', ['Other Multisector', 'Unspecified']],
];
export const SECTOR_GROUPS = GROUPS.map(([name, color]) => ({ name, color }));
const sectorToGroup = {};
GROUPS.forEach(([, , list], gi) => list.forEach((s) => { sectorToGroup[s] = gi; }));
export const sectorName = (i) => META.sectors[i];
export const sectorColor = (i) => GROUPS[sectorToGroup[META.sectors[i]] ?? 6][1];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function ym(s) {
  if (!s) return '';
  const [y, m] = s.split('-');
  return m ? `${MONTHS[+m - 1]} ${y}` : y;
}

// BRI status: on | ex (exited) | un (uncertain) | none
export function briStatus(c) {
  const b = c?.bri;
  if (!b) return { k: 'none', text: 'No BRI memorandum on record' };
  if (b.x) return { k: 'ex', text: `Left the BRI in ${b.x}` + (b.j ? ` (joined ${ym(b.j)})` : '') };
  if (b.u) return { k: 'un', text: 'BRI membership uncertain' };
  return { k: 'on', text: `Signed a BRI memorandum${b.j ? `, ${ym(b.j)}` : ''}` };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : 0);
