// Blue approach: PLA F2T2EA kill chain against a U.S. surface group.
import { distKm, fmt, listText } from '../geo.js';
import { PLA } from '../layers.js';

export const BLUE_ACTIONS = [
  { k: 'emcon', t: 'Go silent (EMCON)', s: 'Stop radiating. Passive intercept loses the group.' },
  { k: 'jam', t: 'Jam skywave radar', s: 'Blinds the long-range over-the-horizon radar.' },
  { k: 'blind', t: 'Blind satellites', s: 'Counter-space jamming or dazzling of ISR satellites.' },
  { k: 'aew', t: 'Shoot down the KJ-500', s: 'Removes the airborne radar over the Strait.' },
  { k: 'c2', t: 'Disrupt joint command', s: 'In this model, long-range shots need theater-level fusion and coastal units fire on their own.' },
];

const L = Object.fromEntries(PLA.map(l => [l.id, l]));
const SHIP_KM_PER_MIN = 30 * 1.852 / 60; // 30 knots

/** Evaluate the PLA kill chain against a ship at position p, given Blue countermeasures cm. */
export function assessBlue(p, cm) {
  const d = Object.fromEntries(PLA.map(l => [l.id, distKm(l.c, p)]));
  const sky = !cm.jam && d.sky >= L.sky.rin && d.sky <= L.sky.r;
  const sig = !cm.emcon && d.sig <= L.sig.r;
  const surf = d.surf <= L.surf.r;
  const aew = !cm.aew && d.aew <= L.aew.r;
  const sat = !cm.blind;
  const src = { find: [], fix: [], track: [] };
  if (sky) src.find.push('skywave radar');
  if (sig) src.find.push('signals intercept');
  if (sat) { src.find.push('satellites'); src.fix.push('satellites'); }
  if (surf) ['find', 'fix', 'track'].forEach(k => src[k].push('surface-wave radar'));
  if (aew) ['find', 'fix', 'track'].forEach(k => src[k].push('KJ-500'));
  if (sat && (sky || sig)) src.track.push('satellite passes cued by ' + (sky ? 'skywave radar' : 'signals intercept'));
  const find = src.find.length > 0, fix = find && src.fix.length > 0, track = fix && src.track.length > 0;
  const inRange = PLA.filter(l => l.role === 'ship' && d[l.id] <= l.r);
  const cleared = track ? inRange.filter(l => !(l.c2 && cm.c2)) : [];
  const chain = [find, fix, track, cleared.length > 0, cleared.length > 0, cleared.length > 0 && fix];
  return { d, src, find, fix, track, inRange, cleared, chain };
}

export function statusOf(r) {
  if (!r.find) return { s: 'clear', b: 'Undetected', t: 'No PLA sensor covers this position.' };
  if (!r.track) return { s: 'seen', b: 'Detected, no firing track', t: 'The PLA knows roughly where the group is but cannot aim.' };
  if (!r.cleared.length) return { s: 'tracked', b: 'Tracked, not engageable',
    t: r.inRange.length ? 'In range, but the firing decision is blocked.' : 'Out of range of every anti-ship layer.' };
  return { s: 'hot', b: `Targetable by ${r.cleared.length} layer${r.cleared.length > 1 ? 's' : ''}`, t: listText(r.cleared.map(l => l.name)) + '.' };
}

export function whyText(r) {
  if (!r.find) return '<b>No sensor sees the group.</b> Every link after Find fails.';
  if (!r.fix) return `<b>Found by ${listText(r.src.find)}</b>, but nothing fixes its position precisely enough to aim.`;
  if (!r.track) return `<b>Fixed by ${listText(r.src.fix)}</b>, but only in snapshots. Without a continuous track, a missile with a long flight time arrives where the ship used to be.`;
  if (!r.inRange.length) return `<b>Tracked by ${listText(r.src.track)}</b>, but no anti-ship layer reaches this far.`;
  if (!r.cleared.length) return `<b>Tracked and in range of ${listText(r.inRange.map(l => l.name))}</b>, but command disruption stops the firing decision for long-range shots.`;
  return `<b>Chain closed.</b> Found by ${listText(r.src.find)}; tracked by ${listText(r.src.track)}.`;
}

/** Notional time of flight and how far a 30-knot ship moves meanwhile. */
export function flightTimes(r) {
  return r.cleared.map(l => {
    const min = r.d[l.id] / l.kmPerMin + (l.ballistic ? 2 : 0.5);
    return { l, min, moveKm: min * SHIP_KM_PER_MIN };
  });
}

export function notesFor(r, p, twCenters) {
  const n = [];
  if (r.d.sam <= L.sam.r) n.push('Blue aircraft overhead would be inside long-range SAM coverage from the mainland.');
  if (r.d.srbm <= L.srbm.r) n.push('Inside DF-15/16 short-range ballistic missile reach (land attack).');
  if (twCenters.some(c => distKm(c, p) <= 150)) n.push("Inside Taiwan's own coastal anti-ship coverage.");
  if (r.d.sky < L.sky.rin) n.push('Inside the skywave radar skip zone; it cannot see this close.');
  return n;
}

export function renderFlightTable(r) {
  const ft = flightTimes(r);
  if (!ft.length) return '';
  return `<table class="mini"><thead><tr><th>Weapon</th><th>Range to group</th><th>Flight*</th><th>Ship moves</th></tr></thead><tbody>${
    ft.map(({ l, min, moveKm }) => `<tr><td><span class="dot" style="color:var(${l.col})"></span>${l.name}</td><td class="num">${fmt(r.d[l.id])} km</td><td class="num">~${Math.round(min)} min</td><td class="num">~${fmt(moveKm)} km</td></tr>`).join('')
  }</tbody></table><p class="fine">*Notional average speeds. Ship at 30 knots.</p>`;
}

/** Rows for the route-profile strip. */
export function profileRows(cm) {
  const rows = PLA.filter(l => l.role === 'ship' || l.id === 'sam').map(l => ({
    label: l.short || l.name.replace(' (HQ-9 / S-400 class)', ''), col: l.col,
    test: p => distKm(l.c, p) <= l.r,
  }));
  rows.push({ label: 'Kill chain closed', col: '--bad', strong: true, test: p => assessBlue(p, cm).cleared.length > 0 });
  return rows;
}
