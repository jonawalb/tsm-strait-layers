// Reach calculations: which missiles and launch areas reach a site, and which sites sit inside a ring.
import { distKm } from '../../../shared/js/mapkit.js';
import { COUNTRIES_INDOPAC } from '../../../shared/data/countries-indopac.js';
import { SITES } from '../data/sites.js';
import { MISSILES, LAUNCH } from '../data/pla.js';

const CHN = COUNTRIES_INDOPAC.find(c => c.iso === 'CHN');
export const PRC_RINGS = CHN.rings;
export const TWN_RINGS = COUNTRIES_INDOPAC.find(c => c.iso === 'TWN').rings;
const PRC_PTS = PRC_RINGS.flat();

export const SITE = Object.fromEntries(SITES.map(s => [s.id, s]));
export const MISSILE = Object.fromEntries(MISSILES.map(m => [m.id, m]));
export const LAUNCH_BY = Object.fromEntries(LAUNCH.map(l => [l.id, l]));

/** Nearest point of PRC territory (Natural Earth 50m outline vertices, ~5–10 km spacing). */
export function nearestPRC(p) {
  let best = Infinity, at = null;
  for (const q of PRC_PTS) { const d = distKm(p, q); if (d < best) { best = d; at = q; } }
  return { km: best, at };
}

const PRC_CACHE = new Map();
export function siteReach(site) {
  if (!PRC_CACHE.has(site.id)) PRC_CACHE.set(site.id, nearestPRC(site.c));
  const prc = PRC_CACHE.get(site.id);
  const launch = LAUNCH.map(l => ({ ...l, km: distKm(l.c, site.c) }))
    .map(l => ({ ...l, by: MISSILES.filter(m => l.km <= m.r).map(m => m.id) }));
  const fromPRC = MISSILES.filter(m => prc.km <= m.r).map(m => m.id);
  return { prc, launch, fromPRC };
}

/** Sites within a missile's range of a launch area. */
export function sitesInRing(missileId, launchId) {
  const m = MISSILE[missileId], l = LAUNCH_BY[launchId];
  return SITES.map(s => ({ s, km: distKm(l.c, s.c) })).filter(o => o.km <= m.r).sort((a, b) => a.km - b.km);
}

/** Shortest class that reaches a site from PRC territory, or null. */
export const shortestFromPRC = site => MISSILES.find(m => siteReach(site).prc.km <= m.r) || null;
