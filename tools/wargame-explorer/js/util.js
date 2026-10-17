// Small shared helpers: escaping, citation links, lookups.
import { SOURCES } from '../data/sources.js';
import { GAMES } from '../data/games.js';

export const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export const gameById = id => GAMES.find(g => g.id === id);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** One citation as a compact link that opens the source at the cited PDF page. */
export function citeLink(ci) {
  const s = SOURCES[ci.src];
  if (!s) return '';
  const href = ci.pdfPage ? `${s.url}#page=${ci.pdfPage}` : s.url;
  const pg = /^\d/.test(ci.page) || /^[IVXL]+$/.test(ci.page) ? `p. ${ci.page}` : '';
  const txt = pg ? `${s.short}, ${pg}` : s.short;
  const title = `${s.label}${pg ? `, ${pg}` : ''}`;
  return `<a class="cite" href="${esc(href)}" target="_blank" rel="noopener" title="${esc(title)}">${esc(txt)}</a>`;
}

export const cites = list => (list || []).map(citeLink).join(' ');

/** Iterations in a case, split by outcome class, in a fixed order. */
export const OUT_ORDER = ['fails', 'mixed', 'prc', 'nuclear', 'na'];
