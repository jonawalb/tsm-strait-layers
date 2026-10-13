// "This Week in the Strait": pure computations over TSM data. No DOM, no numbers of its own.
// The week is the seven MND reporting windows ending at TSM.asOf; the baseline is the 30 windows before it.

const DAY = 864e5;
export const iso = t => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => iso(Date.parse(d + 'T00:00:00Z') + n * DAY);
export const WEEK = 7, BASE = 30;

const fmtDate = (d, o) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
export const short = d => fmtDate(d, { month: 'short', day: 'numeric' });
export const long = d => fmtDate(d, { month: 'short', day: 'numeric', year: 'numeric' });
export const dow = d => fmtDate(d, { weekday: 'narrow' });

/** Week and baseline date ranges ending at asOf (inclusive). */
export function windows(asOf) {
  const w0 = addDays(asOf, -(WEEK - 1));
  return { asOf, w0, w1: asOf, b0: addDays(w0, -BASE), b1: addDays(w0, -1),
    days: Array.from({ length: WEEK }, (_, i) => addDays(w0, i)) };
}

export const METRICS = [
  { k: 'aircraft', i: 1, label: 'PLA aircraft', unit: 'sorties reported by MND' },
  { k: 'adiz', i: 2, label: 'ADIZ entries', unit: 'aircraft entering Taiwan\'s ADIZ' },
  { k: 'plan', i: 3, label: 'PLAN ships', unit: 'navy vessels around Taiwan' },
  { k: 'official', i: 4, label: 'Official ships', unit: 'other state vessels (MND count)' },
];

const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

/** One daily metric: week total and daily mean against the prior-30-day daily mean, plus the series. */
export function metric(daily, W, m) {
  const by = new Map(daily.map(r => [r[0], r]));
  const val = d => { const r = by.get(d); return r && r[m.i] != null ? r[m.i] : null; };
  const series = [];
  for (let d = W.b0; d <= W.w1; d = addDays(d, 1)) series.push({ d, v: val(d), week: d >= W.w0 });
  const wk = series.filter(p => p.week && p.v != null), base = series.filter(p => !p.week && p.v != null);
  const wMean = mean(wk.map(p => p.v)), bMean = mean(base.map(p => p.v));
  const peak = wk.reduce((a, p) => (!a || p.v > a.v ? p : a), null);
  return { ...m, series, total: wk.reduce((s, p) => s + p.v, 0), nWeek: wk.length, nBase: base.length,
    wMean, bMean, pct: wMean != null && bMean ? (wMean - bMean) / bMean * 100 : null, peak };
}

/** Joint combat readiness patrol ('J') and long-range flight ('L') days in the week and baseline. */
export function flags(daily, W) {
  const by = new Map(daily.map(r => [r[0], r[5] || '']));
  const days = W.days.map(d => ({ d, f: by.get(d) ?? null }));
  const count = (a, b, c) => { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if ((by.get(d) || '').includes(c)) n++; return n; };
  return { days, j: count(W.w0, W.w1, 'J'), l: count(W.w0, W.w1, 'L'), jBase: count(W.b0, W.b1, 'J'), lBase: count(W.b0, W.b1, 'L') };
}

/** Allied Strait transits: rows [date, name, hull, class, type, country]. */
export function transits(rows, W) {
  const wk = rows.filter(t => t[0] >= W.w0 && t[0] <= W.w1);
  const base = rows.filter(t => t[0] >= W.b0 && t[0] <= W.b1);
  const last = rows.filter(t => t[0] <= W.w1).reduce((a, t) => (!a || t[0] > a[0] ? t : a), null);
  const lastDay = last ? rows.filter(t => t[0] === last[0]) : [];
  return { wk, base, last, lastDay };
}

/** CCG incidents from the CCG Gray-Zone tracker: {date, loc, id, ...}. */
export function ccg(incidents, W) {
  const wk = incidents.filter(x => x.date >= W.w0 && x.date <= W.w1);
  const base = incidents.filter(x => x.date >= W.b0 && x.date <= W.b1);
  const upTo = incidents.filter(x => x.date <= W.w1);
  const last = upTo.reduce((a, x) => (!a || x.date > a.date || (x.date === a.date && x.id > a.id) ? x : a), null);
  const locs = {};
  wk.forEach(x => { locs[x.loc] = (locs[x.loc] || 0) + 1; });
  return { wk, base, last, locs };
}

/**
 * AIS from the Dark Fleet live window. MND windows run 06:00-06:00 Taiwan time (UTC+8), so the week is
 * w0 22:00 UTC (previous day) to w1+1 22:00 UTC. vessels: decoded [{mmsi, cat, f:[{t}]}]; t = minutes since t0.
 * gaps: silences of gapH or more (Dark Fleet's own detectGaps), counted when the silence starts in the week.
 * cats: the vessel categories Dark Fleet shows by default, so the counts match the linked view.
 */
export function ais(vessels, gaps, t0ms, tEnd, W, gapH, cats) {
  const a = (Date.parse(W.w0 + 'T22:00:00Z') - DAY - t0ms) / 6e4;
  const b = (Date.parse(W.w1 + 'T22:00:00Z') - t0ms) / 6e4;
  const covered = a >= 0;
  const on = v => cats.includes(v.cat);
  const heard = vessels.filter(v => on(v) && v.f.some(p => p.t >= a && p.t < b));
  const dark = gaps.filter(g => on(g.v) && g.a.t >= a && g.a.t < b);
  const darkVessels = new Set(dark.map(g => g.v.mmsi)).size;
  return { heard: heard.length, watch: heard.filter(v => v.cat === 'watch').length, dark: dark.length, darkVessels,
    covered, gapH, tLink: Math.max(0, Math.min(tEnd, Math.round(b))) };
}

/**
 * Statements: rows [source, date, spokesperson, asker, question, answerEn, answerZh, url, urlZh, linkKind, translation, ...].
 * latest: the first answer to a question (file order) on the newest date up to the week's end, so opening
 * remarks are skipped. latestEn: the same rule over rows that carry English text, used when the newest answer
 * exists only in Chinese. Also counts rows in the week.
 */
export function statements(rows, W) {
  let latest = null, latestEn = null;
  const bySrc = [0, 0, 0];
  for (const r of rows) {
    if (r[1] > W.w1) continue;
    if (r[1] >= W.w0) bySrc[r[0]]++;
    if (!r[4] || /announcement|opening/i.test(r[3])) continue; // opening remarks, not an answer
    if (!latest || r[1] > latest[1]) latest = r;
    if (r[5] && (!latestEn || r[1] > latestEn[1])) latestEn = r;
  }
  return { latest, latestEn: latest && latest[5] ? null : latestEn, bySrc, total: bySrc[0] + bySrc[1] + bySrc[2] };
}

/** First sentence(s) of a statement, cut at about n characters on a word boundary. */
export function snippet(text, n = 260) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('。'));
  return stop > n * 0.5 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '…';
}
