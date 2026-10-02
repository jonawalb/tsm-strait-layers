// Data model: parse statement rows, assign weeks, apply theme rules, aggregate a grid.
import { THEMES } from '../data/themes.js';

export const SOURCES = ['MFA', 'MND', 'TAO'];
export const SOURCE_NAMES = { MFA: 'Foreign Ministry', MND: 'Defense Ministry', TAO: 'Taiwan Affairs Office' };
export const TR_LABEL = ['TSM translation', 'Official English', 'Machine translation (Google)', 'Chinese only (no official English)',
  'Machine translation (Claude)'];
export const FIRST_WEEK = '2022-06-27';
export const LAST_DAY = '2026-09-30';
export const RANGES = {
  all: { label: 'Jul 2022 – Sep 2026', from: '2022-06-27', to: LAST_DAY },
  y25: { label: '2025 – Sep 2026', from: '2024-12-30', to: LAST_DAY },
  y26: { label: 'Jan – Sep 2026', from: '2025-12-29', to: LAST_DAY },
};

const DAY = 864e5;
const T0 = Date.parse(FIRST_WEEK + 'T00:00:00Z');
export const weekOf = iso => Math.floor((Date.parse(iso + 'T00:00:00Z') - T0) / (7 * DAY));
export const weekStart = w => new Date(T0 + w * 7 * DAY).toISOString().slice(0, 10);
export const N_WEEKS = weekOf(LAST_DAY) + 1;

export const THEME_RE = THEMES.map(t => new RegExp(t.re, 'i'));
export const THEME_RE_G = THEMES.map(t => new RegExp(t.re, 'gi'));

export function parseRows(rows, streams) {
  return rows.map((r, i) => {
    const rec = { i, s: SOURCES[r[0]], d: r[1], sp: r[2], as: r[3], q: r[4], a: r[5], zh: r[6],
      u: r[7], uz: r[8], lk: r[9], tr: r[10], st: streams[r[11]], ua: r[12] ? r[12].split(' ') : [], w: weekOf(r[1]), th: 0 };
    THEME_RE.forEach((re, k) => { if (re.test(rec.a)) rec.th |= 1 << k; });
    return rec;
  });
}

const CJK = /[㐀-鿿]/;
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build a matcher for the free-text phrase search. Chinese input searches the Chinese
// answer text; anything else searches the English answer. Returns null for an empty phrase.
export function phraseMatcher(phrase) {
  const p = (phrase || '').trim();
  if (!p) return null;
  const zh = CJK.test(p);
  const re = new RegExp(escapeRe(p).replace(/\s+/g, '\\s+'), zh ? 'g' : 'gi');
  const test = r => { re.lastIndex = 0; return re.test(zh ? r.zh : r.a); };
  return { phrase: p, zh, re, test };
}

// Aggregate: cells[row][week] -> array of record indices. Row 0..THEMES-1 are themes;
// row THEMES.length is the phrase row (only when a phrase is active). Theme rules read the
// English answer, so the weekly total (the share denominator) counts only statements with
// English text; a Chinese phrase search counts statements with Chinese text instead.
// held[w] counts every statement TSM holds that week from the selected sources, with or
// without English, so a week of Chinese-only items is not drawn as "none held".
export function aggregate(recs, { sources, matcher }) {
  const on = new Set(sources);
  const nRows = THEMES.length + 1;
  const cells = Array.from({ length: nRows }, () => Array.from({ length: N_WEEKS }, () => []));
  const total = new Array(N_WEEKS).fill(0);
  const held = new Array(N_WEEKS).fill(0);
  const bySource = Object.fromEntries(SOURCES.map(s => [s, new Array(N_WEEKS).fill(0)]));
  let nMatch = 0;
  for (const r of recs) {
    if (r.w < 0 || r.w >= N_WEEKS) continue;
    bySource[r.s][r.w]++;
    if (!on.has(r.s)) continue;
    held[r.w]++;
    if (!(matcher?.zh ? r.zh : r.a)) continue;
    total[r.w]++;
    if (matcher && !matcher.test(r)) continue;
    if (matcher) { cells[THEMES.length][r.w].push(r.i); nMatch++; }
    for (let k = 0; k < THEMES.length; k++) if (r.th & (1 << k)) cells[k][r.w].push(r.i);
  }
  return { cells, total, held, bySource, nMatch };
}

export function valueOf(agg, row, w, metric) {
  const n = agg.cells[row][w].length;
  if (metric === 'share') return agg.total[w] ? n / agg.total[w] : 0;
  return n;
}

// Split English text into sentences, and Chinese text on full stops.
export function sentences(text, zh = false) {
  if (!text) return [];
  if (zh) return text.split(/(?<=[。！？；])/).filter(s => s.trim());
  return text.split(/(?<=[.!?]["”’']?)\s+(?=["“‘'(]?[A-Z0-9])/).filter(s => s.trim());
}
