// "On their watch": tracked posts and the TSM activity recorded during each tenure.
// Activity during a tenure is description, not attribution. Coverage windows come from the data itself.
import { TSM } from '../../../shared/data/tsm.js';
import { EXERCISES } from '../data/exercise_events.js';

// Posts whose holders' tenures are compared with TSM activity. Matched by org id and title pattern.
export const TRACKED = [
  { key: 'chn-cmc-chair', label: 'CMC Chairman', org: 'CHN-CMC', title: /^Chairman$/ },
  { key: 'chn-cmc-vc', label: 'CMC Vice Chairman', org: 'CHN-CMC', title: /^Vice Chairman/ },
  { key: 'chn-mnd', label: 'PRC Minister of National Defense', org: 'CHN-MND', title: /^Minister of National Defense$/ },
  { key: 'chn-etc-cdr', label: 'Eastern Theater Command Commander', org: 'CHN-ETC', title: /^Commander$/ },
  { key: 'chn-etc-pc', label: 'Eastern Theater Command Political Commissar', org: 'CHN-ETC', title: /^Political Commissar$/ },
  { key: 'chn-plan-cdr', label: 'PLA Navy Commander', org: 'CHN-PLAN', title: /^Commander$/ },
  { key: 'chn-plaaf-cdr', label: 'PLA Air Force Commander', org: 'CHN-PLAAF', title: /^Commander$/ },
  { key: 'chn-ccg', label: 'China Coast Guard head', org: 'CHN-CCG', title: /^(Director General|Director|Commander|Head)\b/ },
  { key: 'chn-tao', label: 'Taiwan Affairs Office Director', org: 'CHN-TAO', title: /^Director\b/ },
  { key: 'twn-mnd', label: 'ROC Minister of National Defense', org: 'TWN-MND', title: /^Minister of National Defense$/ },
  { key: 'twn-cgs', label: 'ROC Chief of the General Staff', org: 'TWN-GSH', title: /^Chief of the General Staff$/ },
  { key: 'twn-cga', label: 'Taiwan Coast Guard Administration head', org: 'TWN-CGA', title: /^Director-General\b/ },
  { key: 'usa-indopacom', label: 'INDOPACOM Commander', org: 'USA-INDOPACOM', title: /^Commander$/ },
  { key: 'usa-secdef', label: 'U.S. Secretary of Defense / War', org: 'USA-DOW', title: /^Secretary of (Defense|War)\b/ },
];

// Coverage per series, from the data.
const D = TSM.daily;
const firstWhere = f => D.find(f)?.[0] ?? null;
export const COVER = {
  aircraft: [firstWhere(r => r[1] != null), TSM.asOf],
  adiz: [firstWhere(r => r[2] != null), TSM.asOf],
  plan: [firstWhere(r => r[3] != null), TSM.asOf],
  jcrp: ['2022-12-01', TSM.asOf], // flags rebuilt from MND press releases from 2022-12 (TOOL_BRIEF)
  ccg: [TSM.ccg.length ? TSM.ccg.map(r => r[0]).sort()[0].slice(0, 4) + '-01-01' : null, TSM.asOf],
  transits: [TSM.transits.map(r => r[0]).sort()[0], TSM.asOf],
  exercises: [EXERCISES[0]?.start_date, TSM.asOf],
};
export const TRANSIT_GAP = ['2025-09-01', '2026-01-31']; // gap in the TSM transit list (TOOL_BRIEF)

// Schema dates to ISO days: YYYY reads as mid-year, YYYY-MM as mid-month (the page-wide convention).
export function isoOf(d, fallback) {
  if (d == null || d === '') return fallback;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(d);
  if (!m) return fallback;
  return m[3] ? d : m[2] ? `${m[1]}-${m[2]}-15` : `${m[1]}-07-01`;
}
const precise = d => d == null || /^\d{4}-\d{2}-\d{2}$/.test(d);
const clip = ([a, b], [c, d]) => { const s = a > c ? a : c, e = b < d ? b : d; return c && s <= e ? [s, e] : null; };
const days = ([a, b]) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
const mean = xs => xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;

// All holders of each tracked post, as {key, person, post, from, to, approx}. Holders without a start date are listed apart.
export function trackedTenures(L) {
  const out = new Map(TRACKED.map(t => [t.key, { t, held: [], undated: [] }]));
  for (const p of L.people) for (const post of p.posts) for (const t of TRACKED) {
    if (post.org !== t.org || !t.title.test(post.title)) continue;
    const slot = out.get(t.key);
    if (!post.start) { slot.undated.push({ person: p, post }); continue; }
    slot.held.push({ person: p, post, from: isoOf(post.start), to: isoOf(post.end, L.asOf), approx: !precise(post.start) || (post.end != null && !precise(post.end)) });
  }
  for (const s of out.values()) s.held.sort((a, b) => a.from < b.from ? -1 : 1);
  return out;
}

// Activity numbers for an ISO window. Each series is clipped to its own coverage.
export function activity([a, b]) {
  const res = { window: [a, b] };
  const w = c => clip([a, b], c);
  const rows = win => win ? D.filter(r => r[0] >= win[0] && r[0] <= win[1]) : [];
  const air = w(COVER.aircraft), ra = rows(air);
  res.days = air ? days(air) : 0;
  res.covered = air;
  const v = (rs, i) => rs.map(r => r[i]).filter(x => x != null);
  res.aircraft = { mean: mean(v(ra, 1)), n: v(ra, 1).length };
  const ad = rows(w(COVER.adiz)); res.adiz = { mean: mean(v(ad, 2)), n: v(ad, 2).length };
  const pl = rows(w(COVER.plan)); res.plan = { mean: mean(v(pl, 3)), n: v(pl, 3).length, win: w(COVER.plan) };
  const jw = w(COVER.jcrp), jr = rows(jw);
  res.jcrp = { per30: jr.length ? jr.filter(r => r[5].includes('J')).length / jr.length * 30 : null, count: jr.filter(r => r[5].includes('J')).length, n: jr.length };
  const cw = w(COVER.ccg); res.ccg = { count: cw ? TSM.ccg.filter(r => r[0] >= cw[0] && r[0] <= cw[1]).length : null, win: cw };
  const tw = w(COVER.transits);
  res.transits = { count: tw ? TSM.transits.filter(r => r[0] >= tw[0] && r[0] <= tw[1]).length : null, win: tw, gap: tw ? !!clip(tw, TRANSIT_GAP) : false };
  res.exercises = EXERCISES.filter(e => e.start_date >= a && e.start_date <= b);
  return res;
}
