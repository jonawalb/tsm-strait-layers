// Event grouping, coverage checks, baselines, deviations and the seeded bootstrap.
import { TSM } from '../../../shared/data/tsm.js';
import { EXERCISES, FIXES } from '../data/context.js';

export const DAY = 86400000;
export const PRE = 7, POST = 10, BASE_DAYS = 30, GUARD = 3, MIN_BASE = 10;
export const OFFSETS = Array.from({ length: PRE + POST + 1 }, (_, i) => i - PRE);
export const AS_OF = TSM.asOf;

export const METRICS = {
  air: { i: 1, name: 'PLA aircraft', short: 'Aircraft', unit: 'aircraft', from: '2022-08-06',
    help: 'Aircraft detected around Taiwan, per Taiwan MND daily reports.' },
  adiz: { i: 2, name: 'ADIZ entries', short: 'ADIZ', unit: 'entries', from: '2022-08-07', fromText: 'Aug. 7, 2022',
    help: 'Aircraft that crossed the median line or entered Taiwan\'s ADIZ.' },
  plan: { i: 3, name: 'PLAN ships', short: 'PLAN ships', unit: 'ships', from: '2024-08-13', fromText: 'Aug. 13, 2024',
    help: 'People\'s Liberation Army Navy vessels detected around Taiwan.' },
  off: { i: 4, name: 'Official ships', short: 'Official', unit: 'ships', from: '2024-08-13', fromText: 'Aug. 13, 2024',
    help: 'Other PRC government ("official") ships reported by Taiwan MND.' },
};

const iso = t => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => iso(Date.parse(d) + n * DAY);
export const diffDays = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
export const nice = (d, y = true) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US',
  { month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}), timeZone: 'UTC' });

const byDate = new Map(TSM.daily.map(r => [r[0], r]));
export const row = d => byDate.get(d) || null;
export const val = (d, m) => { const r = byDate.get(d); return r && r[METRICS[m].i] != null ? r[METRICS[m].i] : null; };

// ---- Events: same-day ship transits grouped into one event -------------------------------
const fixShip = ([date, name, hull, cls, type, country]) => {
  const row = FIXES.rows[`${date}|${name}`] || {};
  if (row.hull) hull = row.hull;
  const n = row.name || FIXES.names[name] || name;
  const t = FIXES.types[type] || FIXES.typeByClass[cls] || type || '';
  return { name: n, rawName: name, hull, cls: cls || '', type: t, rawType: type, country };
};

export const EVENTS = (() => {
  const m = new Map();
  for (const t of TSM.transits) {
    const d = (FIXES.rows[`${t[0]}|${t[1]}`] || {}).date || t[0];
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(fixShip(t));
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, ships], idx) => {
    const countries = [...new Set(ships.map(s => s.country))];
    const us = countries.includes('USA');
    return { id: date, idx, date, ships, countries, us,
      group: us ? (countries.length > 1 ? 'joint' : 'us') : 'ally' };
  });
})();
export const eventById = id => EVENTS.find(e => e.id === id) || null;
const EVENT_DATES = EVENTS.map(e => e.date);

const exerciseDays = new Set();
EXERCISES.forEach(x => { for (let d = x.from; d <= x.to; d = addDays(d, 1)) exerciseDays.add(d); });
const nearExercise = d => EXERCISES.some(x => diffDays(d, x.from) >= -GUARD && diffDays(d, x.to) <= GUARD);
const nearOtherTransit = (d, self) => EVENT_DATES.some(t => t !== self && Math.abs(diffDays(d, t)) <= GUARD);

// ---- Baseline and window -------------------------------------------------------------
export function baseline(e, m, { dropExercises = false } = {}) {
  const vals = [];
  let excluded = 0, missing = 0, exerciseInBase = [];
  for (let k = BASE_DAYS; k >= 1; k--) {
    const d = addDays(e.date, -k);
    if (nearOtherTransit(d, e.date)) { excluded++; continue; }
    if (dropExercises && nearExercise(d)) { excluded++; continue; }
    const v = val(d, m);
    if (v == null) { missing++; continue; }
    if (exerciseDays.has(d)) exerciseInBase.push(d);
    vals.push(v);
  }
  const n = vals.length;
  const mean = n ? vals.reduce((a, b) => a + b, 0) / n : null;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  const exNames = EXERCISES.filter(x => exerciseInBase.some(d => d >= x.from && d <= x.to)).map(x => x.name);
  return { n, mean, sd, excluded, missing, exercises: dropExercises ? [] : exNames };
}

/** Why an event cannot be analyzed for metric m, or null if it can. */
export function unavailable(e, m, opts) {
  const M = METRICS[m];
  if (e.date < M.from) {
    return m === 'air' ? 'Before TSM daily aircraft data (from Aug. 6, 2022)'
      : `${M.name} are recorded from ${M.fromText} only`;
  }
  if (addDays(e.date, POST) > AS_OF) return 'Window runs past the latest data';
  if (val(e.date, m) == null) return 'No daily data on the transit day';
  const b = baseline(e, m, opts);
  if (b.n < MIN_BASE) return `Only ${b.n} usable baseline days (need ${MIN_BASE})`;
  return null;
}

/** Everything the single-event view needs. */
export function analyze(e, m, opts) {
  const why = unavailable(e, m, opts);
  if (why) return { e, m, why };
  const b = baseline(e, m, opts);
  const days = OFFSETS.map(k => {
    const d = addDays(e.date, k), v = val(d, m), r = row(d);
    const dev = v == null ? null : v - b.mean;
    const pct = v == null || !b.mean ? null : (v - b.mean) / b.mean * 100;
    const others = EVENTS.filter(o => o.date === d && o.id !== e.id);
    const ex = EXERCISES.filter(x => d >= x.from && d <= x.to);
    return { k, d, v, dev, pct, flag: r ? r[5] : '', others, ex };
  });
  const flags = {
    otherTransits: days.filter(x => x.others.length).map(x => x.k),
    exercises: [...new Set(days.flatMap(x => x.ex.map(y => y.name)))],
    gaps: days.filter(x => x.v == null).map(x => x.k),
    jcrp: days.filter(x => String(x.flag ?? '').includes('J')).map(x => x.k),
  };
  return { e, m, b, days, flags };
}

export function summaryOf(a, unit, to) {
  const xs = a.days.filter(x => x.k >= 0 && x.k <= to).map(x => (unit === 'pct' ? x.pct : x.dev)).filter(v => v != null);
  return xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : null;
}

// ---- Seeded bootstrap -----------------------------------------------------------------
export const SEED = 20260916, REPS = 2000;
export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const quant = (s, q) => { const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const meanOf = xs => { const v = xs.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

/**
 * Aggregate mode. Groups analyzable events into U.S.-present vs. no-U.S.; averages the
 * per-day deviation; percentile bootstrap (resampling events) for each day and for the
 * summary window. Same seed every time, so the intervals are reproducible.
 */
export function aggregate(m, { unit, to, clean, dropExercises }) {
  const opts = { dropExercises };
  const all = EVENTS.map(e => analyze(e, m, opts)).filter(a => !a.why);
  const kept = clean ? all.filter(a => !a.flags.otherTransits.length && !a.flags.exercises.length) : all;
  const pick = x => (unit === 'pct' ? x.pct : x.dev);
  const rng = mulberry32(SEED);
  const groups = {};
  for (const [g, test] of [['us', a => a.e.us], ['ally', a => !a.e.us]]) {
    const ev = kept.filter(test);
    const mat = ev.map(a => a.days.map(pick));
    const sums = ev.map(a => summaryOf(a, unit, to));
    const mean = OFFSETS.map((_, j) => meanOf(mat.map(r => r[j])));
    const n = ev.length;
    const bootDay = OFFSETS.map(() => []), bootSum = [];
    if (n >= 2) {
      for (let r = 0; r < REPS; r++) {
        const idx = Array.from({ length: n }, () => Math.floor(rng() * n));
        OFFSETS.forEach((_, j) => { const v = meanOf(idx.map(i => mat[i][j])); if (v != null) bootDay[j].push(v); });
        bootSum.push(meanOf(idx.map(i => sums[i])));
      }
    }
    const ci = arr => { if (arr.length < 50) return null; const s = arr.filter(v => v != null).sort((a, b) => a - b); return [quant(s, 0.025), quant(s, 0.975)]; };
    groups[g] = { events: ev, n, mean, ci: bootDay.map(ci), sums, sumMean: meanOf(sums), sumCi: ci(bootSum), bootSum };
  }
  const { us, ally } = groups;
  let diff = null;
  if (us.bootSum.length && ally.bootSum.length) {
    const d = us.bootSum.map((v, i) => v - ally.bootSum[i]).sort((a, b) => a - b);
    diff = { est: us.sumMean - ally.sumMean, ci: [quant(d, 0.025), quant(d, 0.975)] };
  }
  return { m, unit, to, all: all.length, dropped: all.length - kept.length, us, ally, diff };
}
