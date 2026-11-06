// PLA crossing: Taiwan's denial chain against an amphibious group crossing the Strait.
import { distKm, routeLengths, along, fmt, listText } from '../geo.js';
import { TAIWAN } from '../layers.js';

export const PLA_ACTIONS = [
  { k: 'radar', t: 'Strike coastal radars', s: 'Opening SRBM strikes on Taiwan\'s shore surveillance radars.' },
  { k: 'mpa', t: 'Shoot down patrol aircraft', s: 'Removes P-3C and MQ-9B coverage over the Strait.' },
];
export const TW_ACTIONS = [
  { k: 'disperse', t: 'Disperse and hide launchers', s: 'In this model, mobile launchers halve losses to PLA suppression strikes.' },
  { k: 'mines', t: 'Mine the approaches', s: 'Adds a notional minefield within ~15 km of the landing area.' },
  { k: 'drones', t: 'Field drones and USVs', s: 'Adds short-range attack drones and uncrewed surface vessels.' },
];

const T = Object.fromEntries(TAIWAN.map(l => [l.id, l]));
const near = (l, p) => Math.min(...l.cs.map(c => distKm(c, p)));
export const MINE_KM = 15;

export function survivingLaunchers(rc) {
  return Math.max(0, 1 - rc.supp * (rc.disperse ? 0.5 : 1));
}

/** Evaluate Taiwan's chain against a PLA group at p, on a route ending at the landing area. */
export function assessRed(p, route, rc) {
  const beach = route.pts[route.pts.length - 1];
  const d = Object.fromEntries(TAIWAN.map(l => [l.id, near(l, p)]));
  const beachKm = distKm(beach, p);
  const radar = !rc.radar && d.twradar <= T.twradar.r;
  const mpa = !rc.mpa && d.twmpa <= T.twmpa.r;
  const eyes = beachKm <= 25;
  const src = { find: ['satellite imagery'], fix: [], track: [] };
  if (radar) ['find', 'fix', 'track'].forEach(k => src[k].push('coastal radar'));
  if (mpa) ['find', 'fix', 'track'].forEach(k => src[k].push('maritime patrol'));
  if (eyes) ['find', 'fix', 'track'].forEach(k => src[k].push('observers at the beach'));
  const fix = src.fix.length > 0, track = fix && src.track.length > 0;
  const surv = survivingLaunchers(rc);
  const weapons = [];
  if (d.twascm <= T.twascm.r && surv > 0) weapons.push(T.twascm.short);
  if (rc.drones && d.twdrone <= T.twdrone.r) weapons.push(T.twdrone.short);
  const mines = rc.mines && beachKm <= MINE_KM;
  const engage = track ? weapons : [];
  const chain = [true, fix, track, engage.length > 0, engage.length > 0, engage.length > 0 && fix];
  return { d, beachKm, src, fix, track, weapons, engage, mines, surv, chain };
}

export function statusRed(r) {
  if (r.engage.length || r.mines) {
    const all = [...r.engage, ...(r.mines ? ['sea mines'] : [])];
    return { s: 'hot', b: `Under fire from ${all.length} layer${all.length > 1 ? 's' : ''}`, t: listText(all) + '.' };
  }
  if (!r.track) return { s: 'seen', b: 'Seen, not tracked', t: 'Satellites show the fleet, but Taiwan cannot hold a firing track here.' };
  return { s: 'tracked', b: 'Tracked, out of reach', t: 'Taiwan can see the group but no anti-ship layer reaches it yet.' };
}

export function whyRed(r) {
  if (!r.fix) return '<b>Satellite imagery shows the fleet assembling</b>, but no Taiwanese sensor fixes it at sea. Striking radars and patrol aircraft first is how the PLA buys this blindness.';
  if (!r.engage.length && !r.mines) return `<b>Tracked by ${listText(r.src.track)}</b>, but no Taiwanese anti-ship weapon reaches this point.`;
  return `<b>Chain closed.</b> Tracked by ${listText(r.src.track)}. ${r.surv < 1 ? `${Math.round(r.surv * 100)}% of coastal launchers survive suppression.` : ''}`;
}

/** Hours the group spends under each threat for the whole crossing at a given speed (knots). */
export function exposure(route, rc, knots) {
  const L = routeLengths(route.pts), total = L[L.length - 1];
  const kmh = knots * 1.852, n = Math.max(20, Math.round(total));
  let fire = 0, mines = 0;
  for (let i = 0; i < n; i++) {
    const r = assessRed(along(route.pts, (i + 0.5) / n), route, rc);
    if (r.engage.length) fire += total / n;
    if (r.mines) mines += total / n;
  }
  return { totalKm: total, hours: total / kmh, fireHours: fire / kmh, mineHours: mines / kmh };
}

export function renderExposure(route, rc, knots) {
  const e = exposure(route, rc, knots);
  const port = route.pts[0];
  const atacms = Math.min(...T.twatacms.cs.map(c => distKm(c, port)));
  return `<dl class="readout">
    <dt>Crossing</dt><dd>${fmt(e.totalKm)} km · ${e.hours.toFixed(1)} h at ${knots} kn</dd>
    <dt>Under fire</dt><dd>${e.fireHours.toFixed(1)} h (${Math.round(e.fireHours / e.hours * 100)}% of the crossing)</dd>
    ${rc.mines ? `<dt>In minefield</dt><dd>${e.mineHours.toFixed(1)} h</dd>` : ''}
    <dt>Launchers left</dt><dd>${Math.round(survivingLaunchers(rc) * 100)}%</dd>
    <dt>${route.port}</dt><dd>${fmt(atacms)} km from ATACMS${atacms <= T.twatacms.r ? ' · <b class="warn">in reach</b>' : ''}</dd>
  </dl>`;
}

export function profileRowsRed(route, rc) {
  const rows = [
    { label: 'Maritime patrol', col: '--twsense', test: p => !rc.mpa && near(T.twmpa, p) <= T.twmpa.r },
    { label: 'Coastal radar', col: '--twsense', test: p => !rc.radar && near(T.twradar, p) <= T.twradar.r },
    { label: 'Coastal anti-ship', col: '--tw', test: p => near(T.twascm, p) <= T.twascm.r },
  ];
  if (rc.drones) rows.push({ label: 'Drones & USVs', col: '--twdrone', test: p => near(T.twdrone, p) <= T.twdrone.r });
  if (rc.mines) rows.push({ label: 'Sea mines', col: '--twdrone', test: p => distKm(route.pts[route.pts.length - 1], p) <= MINE_KM });
  rows.push({ label: 'Taiwan chain closed', col: '--bad', strong: true, test: p => { const r = assessRed(p, route, rc); return r.engage.length > 0 || r.mines; } });
  return rows;
}
