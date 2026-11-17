// Data model: JSO strait crossings, strait gates, month windows, MND daily PLAN counts and exercise dates.
import { JSO } from '../data/passages.js';
import { EXERCISES } from '../data/exercises.js';
import { TSM } from '../../../shared/data/tsm.js';

export { JSO, EXERCISES };
export const CLS = JSO.classes;
const DIRB = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
export const DIR_WORD = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };

/**
 * Strait gates. `at` is a drawing point in the channel; `out` is the bearing toward the far side
 * (Pacific, Sea of Japan or Sea of Okhotsk). Positions are schematic, for drawing arrows only.
 */
export const STRAITS = [
  { key: 'miyako', name: 'Miyako Strait', short: 'Miyako', note: 'between Okinawa and Miyako Island', at: [126.45, 25.5], out: 135, outTo: 'Pacific', inTo: 'East China Sea', color: 'var(--c1)', lab: [22, -18] },
  { key: 'yonaguni_taiwan', name: 'Yonaguni–Taiwan', short: 'Yonaguni–Taiwan', note: 'between Yonaguni Island and Taiwan', at: [122.45, 24.55], out: 180, outTo: 'Pacific', inTo: 'East China Sea', color: 'var(--c2)', lab: [4, -44], anchor: 'middle' },
  { key: 'yonaguni_iriomote', name: 'Yonaguni–Iriomote', short: 'Yonaguni–Iriomote', note: 'between Yonaguni and Iriomote islands', at: [123.4, 24.38], out: 180, outTo: 'Pacific', inTo: 'East China Sea', color: 'var(--c5)', lab: [16, 30] },
  { key: 'amami_yokoate', name: 'Amami–Yokoate', short: 'Amami', note: 'between Amami Oshima and Yokoate Island', at: [129.15, 28.6], out: 45, outTo: 'Pacific', inTo: 'East China Sea', color: 'var(--c3)', lab: [-14, 20], anchor: 'end' },
  { key: 'osumi', name: 'Osumi Strait', short: 'Osumi', note: 'south of Kyushu', at: [130.8, 30.85], out: 90, outTo: 'Pacific', inTo: 'East China Sea', color: 'var(--c4)', lab: [0, 34], anchor: 'middle' },
  { key: 'tsushima', name: 'Tsushima Strait', short: 'Tsushima', note: 'between Kyushu and the Korean Peninsula', at: [129.55, 34.05], out: 45, outTo: 'Sea of Japan', inTo: 'East China Sea', color: 'var(--c6)', lab: [-16, 10], anchor: 'end' },
  { key: 'tsugaru', name: 'Tsugaru Strait', short: 'Tsugaru', note: 'between Honshu and Hokkaido', at: [140.55, 41.45], out: 90, outTo: 'Pacific', inTo: 'Sea of Japan', color: 'var(--c7)', lab: [16, -12] },
  { key: 'soya', name: 'Soya Strait', short: 'Soya', note: 'between Hokkaido and Sakhalin', at: [141.95, 45.65], out: 90, outTo: 'Sea of Okhotsk', inTo: 'Sea of Japan', color: 'var(--c8)', lab: [16, -10] },
];
export const STRAIT = Object.fromEntries(STRAITS.map(s => [s.key, s]));

/** Is a crossing heading out (toward `outTo`) through its strait? */
export const isOut = r => Math.cos((DIRB[r.dir] - STRAIT[r.strait].out) * Math.PI / 180) > 0;

export const ROLES = [
  { key: 'carrier', label: 'Carriers' }, { key: 'destroyer', label: 'Destroyers' }, { key: 'frigate', label: 'Frigates' },
  { key: 'amphib', label: 'Landing ships' }, { key: 'intel', label: 'Intelligence ships' }, { key: 'support', label: 'Support ships' },
];

export const shipLabel = ([c, h]) => {
  const k = CLS[c];
  if (c === 'CV') return `${JSO.carrierNames[h] || 'carrier'} (${h})`;
  if (c === 'FJ') return 'Fujian (carrier)';
  return `${k[0]} ${h}`;
};
export const shipLong = ([c, h]) => {
  const k = CLS[c];
  if (c === 'CV') return `Kuznetsov-class carrier ${JSO.carrierNames[h]}, hull ${h}`;
  if (c === 'FJ') return 'Carrier Fujian';
  return `${k[0]}-class ${k[1]}, hull ${h}`;
};
export const hullKey = ([c, h]) => (c === 'FJ' ? 'FJ' : `${c}:${h}`);

export const ROWS = JSO.rows.map(([date, strait, dir, ships, rel, note], i) => ({
  i, date, strait, dir, ships, rel, note, ym: date.slice(0, 7),
  roles: new Set(ships.map(s => CLS[s[0]][2])), out: null,
}));
ROWS.forEach(r => { r.out = isOut(r); });
export const relUrl = id => `https://www.mod.go.jp/js/pdf/${id.slice(1, 5)}/${id}.pdf`;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (ym, long) => `${(long ? MON_L : MON)[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
export const nice = d => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;
export const niceShort = d => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;

/** Month keys Jan 2025 .. Sep 2026. */
export const MONTHS = (() => {
  const out = [];
  for (let y = 2025, m = 1; y < 2026 || (y === 2026 && m <= 9); m === 12 ? (y++, m = 1) : m++) out.push(`${y}-${String(m).padStart(2, '0')}`);
  return out;
})();
export const monthEnd = ym => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).toISOString().slice(0, 10);

/** Window: months [a..b] (indexes into MONTHS). */
export const windowOf = (end, span) => ({ a: Math.max(0, end - span + 1), b: end });
export const inWin = (r, w) => r.ym >= MONTHS[w.a] && r.ym <= MONTHS[w.b];
export const winLabel = w => (w.a === w.b ? monthName(MONTHS[w.a], true) : `${monthName(MONTHS[w.a])} to ${monthName(MONTHS[w.b])}`);

/** MND daily PLAN ship counts by month: mean ships per reporting day, and days with data. */
export const MND = (() => {
  const by = {};
  TSM.daily.forEach(r => {
    const ym = r[0].slice(0, 7);
    if (!MONTHS.includes(ym)) return;
    const o = (by[ym] ??= { sum: 0, n: 0, max: 0, jcrp: [] });
    if (r[3] != null) { o.sum += r[3]; o.n++; o.max = Math.max(o.max, r[3]); }
    if (r[5].includes('J')) o.jcrp.push(r[0]);
  });
  return MONTHS.map(ym => {
    const o = by[ym] || { sum: 0, n: 0, max: 0, jcrp: [] };
    return { ym, mean: o.n ? o.sum / o.n : null, n: o.n, max: o.max, jcrp: o.jcrp };
  });
})();
export const MND_AS_OF = TSM.asOf;

/** Every appearance of each hull, in date order. */
export const HULLS = (() => {
  const m = new Map();
  ROWS.forEach(r => r.ships.forEach(s => {
    const k = hullKey(s);
    if (!m.has(k)) m.set(k, { key: k, ship: s, rows: [] });
    m.get(k).rows.push(r.i);
  }));
  return m;
})();

/** Filter predicate shared by map, chart, panel and table. */
export function visible(r, S) {
  if (!S.straits.has(r.strait)) return false;
  if (![...r.roles].some(x => S.roles.has(x))) return false;
  return true;
}
