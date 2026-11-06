// Search the corpus for a talking point and summarize its spread across lanes.
import { LANES, MONTHS, COVERAGE, FULLTEXT } from '../data/coverage.js';

export const KIND = ['Official statement', 'Headline only', 'Full text'];
const DAY = 864e5;
export const toT = d => Date.parse(d + 'T00:00:00Z');
export const fromT = t => new Date(t).toISOString().slice(0, 10);
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parse(rows) {
  return rows.map((r, i) => ({ i, lane: r[0], zh: r[1], d: r[2], t: toT(r[2]), title: r[3], u: r[4], text: r[5], kind: r[6] }));
}

// A query is either a preset {re, ctx} or free text (escaped, whitespace-flexible).
export function matcher(q) {
  if (q.preset) {
    const re = new RegExp(q.preset.re, 'i'), ctx = q.preset.ctx ? new RegExp(q.preset.ctx, 'i') : null;
    return { re: new RegExp(q.preset.re, 'gi'), test: r => re.test(r.title + ' ' + r.text) && (!ctx || ctx.test(r.title + ' ' + r.text)) };
  }
  const p = (q.text || '').trim();
  if (p.length < 2) return null;
  const src = escapeRe(p).replace(/\s+/g, '\\s+');
  const re = new RegExp(src, 'i');
  return { re: new RegExp(src, 'gi'), test: r => re.test(r.title + ' ' + r.text) };
}

export function summarize(recs, m) {
  const hits = recs.filter(m.test);
  const byLane = LANES.map(() => []);
  hits.forEach(r => byLane[r.lane].push(r));
  const firsts = byLane.map((rs, lane) => (rs.length ? { lane, r: rs[0], n: rs.length, gap: gapBefore(lane, rs[0].d) } : null)).filter(Boolean)
    .sort((a, b) => a.r.t - b.r.t || a.lane - b.lane);
  const firstOfficial = firsts.find(f => LANES[f.lane].group === 'official');
  const media = firsts.filter(f => LANES[f.lane].group === 'media');
  const lags = firstOfficial ? media.map(f => (f.r.t - firstOfficial.r.t) / DAY) : [];
  return { hits, byLane, firsts, firstOfficial, median: lags.length ? median(lags) : null };
}

const median = a => { const s = [...a].sort((x, y) => x - y); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

// True when TSM collected nothing from this lane in the month of the first hit or the month before,
// so the "first appearance" could simply be the first month TSM looked.
export function gapBefore(lane, d) {
  const key = LANES[lane].key, mi = MONTHS.indexOf(d.slice(0, 7));
  if (mi < 0) return true;
  const c = COVERAGE[key];
  return !(c[mi] > 0 && (mi === 0 || c[mi - 1] > 0));
}

export function coverageIn(laneKey, m0, m1) {
  const i0 = Math.max(0, MONTHS.indexOf(m0)), i1 = MONTHS.indexOf(m1) < 0 ? MONTHS.length - 1 : MONTHS.indexOf(m1);
  let any = 0, full = 0, n = 0;
  for (let i = i0; i <= i1; i++) { n++; if (COVERAGE[laneKey][i] > 0) any++; if (FULLTEXT[laneKey][i] > 0) full++; }
  return { any, full, n };
}
