// AIS summary from the Dark Fleet Viewer's data modules (tools/dark-fleet/data/live.js and zones.js).
// Both are imported only when the packet range overlaps the live AIS window.
// Track decoding follows tools/dark-fleet/js/live.js (see tools/dark-fleet/data/schema.md).

export const AIS_WINDOW = { from: '2026-09-04', to: '2026-09-28' };

const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DEC = new Uint8Array(128);
for (let i = 0; i < 64; i++) DEC[DIGITS.charCodeAt(i)] = i;

/** Minutes-since-t0 of every fix in one varint track string. */
function fixTimes(str) {
  const out = [];
  let i = 0, t = 0;
  const next = () => {
    let v = 0, shift = 0, c;
    do { c = DEC[str.charCodeAt(i++)]; v += (c & 31) * 2 ** shift; shift += 5; } while (c & 32);
    return v;
  };
  while (i < str.length) { t += next(); next(); next(); next(); out.push(t); }
  return out;
}

export const overlapsAis = R => !(R.to < AIS_WINDOW.from || R.from > AIS_WINDOW.to);

let mods = null;
const load = () => mods ||= Promise.all([import('../../dark-fleet/data/live.js'), import('../../dark-fleet/data/zones.js')]);

const CAT_LABEL = {
  prc: 'PRC-flag ships, force not attributed',
  shared: 'Shared placeholder MMSIs',
  cand: 'Coast-guard-like names, not on the watchlist',
  watch: 'Watchlist vessels (sourced)',
};

/** Counts over fixes whose UTC date falls in [R.from, R.to]. */
export async function aisSummary(R, src) {
  const [{ LIVE }, { ZONE_COUNTS, ZONE_GEOM }] = await load();
  const t0 = Date.parse(LIVE.t0);
  const a = (Date.parse(R.from + 'T00:00:00Z') - t0) / 60000;
  const b = (Date.parse(R.to + 'T00:00:00Z') + 864e5 - t0) / 60000;
  const cats = Object.fromEntries(LIVE.cats.map(c => [c, { ships: 0, fixes: 0 }]));
  const named = [];
  let fixes = 0, ships = 0;
  LIVE.ves.forEach(([mmsi, name, ci], k) => {
    const n = fixTimes(LIVE.tr[k]).filter(t => t >= a && t < b).length;
    if (!n) return;
    const c = LIVE.cats[ci];
    ships++; fixes += n; cats[c].ships++; cats[c].fixes += n;
    if (c !== 'prc') named.push({ mmsi, name: name || '(no name broadcast)', cat: c, n, seed: LIVE.seed[mmsi] || null });
  });
  const zname = Object.fromEntries(ZONE_GEOM.map(z => [z.id, z.name]));
  const zones = Object.entries(ZONE_COUNTS.zones).map(([id, z]) => ({
    id, name: zname[id] || id,
    entries: Object.entries(z.entries).filter(([d]) => d >= R.from && d <= R.to).reduce((s, [, v]) => s + v, 0),
  })).filter(z => z.entries > 0).sort((x, y) => y.entries - x.entries);
  const coloc = LIVE.coloc.filter(c => c[0] >= a && c[0] < b).length;
  src.add('AIS', 'AISStream.io (terrestrial AIS feed used by the TSM AIS database)', 'https://aisstream.io/');
  named.forEach(v => { if (v.seed?.src) src.add('AIS', `Watchlist note for MMSI ${v.mmsi}`, v.seed.src); });
  const clipFrom = R.from < AIS_WINDOW.from ? AIS_WINDOW.from : R.from;
  const clipTo = R.to > ZONE_COUNTS.to ? ZONE_COUNTS.to : R.to;
  // Days inside the span with no zone episodes in any zone (the database skipped 2026-09-23).
  const have = new Set(Object.values(ZONE_COUNTS.zones).flatMap(z => Object.keys(z.entries)));
  const zoneGaps = [];
  for (let t = Date.parse(clipFrom); t <= Date.parse(clipTo); t += 864e5) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (!have.has(d)) zoneGaps.push(d);
  }
  return {
    ships, fixes, coloc, zones, zoneGaps, named: named.sort((x, y) => y.n - x.n),
    cats: LIVE.cats.map(c => ({ c, label: CAT_LABEL[c], ...cats[c] })),
    live: { t0: LIVE.t0, t1: LIVE.t1, thin: LIVE.thinMin }, zoneSpan: [clipFrom, clipTo],
  };
}
