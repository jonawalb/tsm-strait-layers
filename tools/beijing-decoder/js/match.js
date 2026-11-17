// Find dictionary formulations in free text and compute a heuristic "temperature".
import { FORMULATIONS, TIERS } from '../data/formulations.js';

const COMPILED = FORMULATIONS.map(f => ({ f, en: new RegExp(f.ere, 'gi'), zh: new RegExp(f.zre, 'g') }));

// Returns non-overlapping spans [{start, end, f}], preferring higher tier, then longer spans.
export function findSpans(text) {
  const all = [];
  for (const { f, en, zh } of COMPILED) {
    for (const re of [en, zh]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        if (!m[0]) { re.lastIndex++; continue; }
        all.push({ start: m.index, end: m.index + m[0].length, f });
      }
    }
  }
  all.sort((a, b) => b.f.tier - a.f.tier || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const taken = [];
  for (const s of all) if (!taken.some(t => s.start < t.end && t.start < s.end)) taken.push(s);
  return taken.sort((a, b) => a.start - b.start);
}

export const BANDS = [
  { max: 1.5, name: 'Cool', desc: 'Routine position statements only.' },
  { max: 2.5, name: 'Mild', desc: 'Criticism or demands, no warning of consequences.' },
  { max: 3.5, name: 'Warm', desc: 'Warns of failure or consequences.' },
  { max: 4.5, name: 'Hot', desc: 'Promises a response: countermeasures, punishment.' },
  { max: 9, name: 'Very hot', desc: 'Invokes force or the PLA.' },
];

// Temperature = highest tier matched, plus 0.5 for each additional distinct formulation at
// tier 3 or above (at most +1.0), capped at 5. Shown to the user with this explanation.
export function temperature(spans) {
  const distinct = new Map();
  spans.forEach(s => distinct.set(s.f.id, s.f));
  const fs = [...distinct.values()];
  if (!fs.length) return null;
  const top = Math.max(...fs.map(f => f.tier));
  const hot = fs.filter(f => f.tier >= 3).length;
  const bonus = Math.min(1, Math.max(0, hot - 1) * 0.5);
  const score = Math.min(5, top + bonus);
  const band = BANDS.find(b => score <= b.max);
  const byTier = [1, 2, 3, 4, 5].map(t => fs.filter(f => f.tier === t));
  const topF = fs.filter(f => f.tier === top);
  const why = [`Highest tier found: ${top}, ${TIERS[top].name} (${topF.map(f => f.en).slice(0, 3).join('; ')}).`];
  if (bonus) why.push(`${hot} distinct warning-or-stronger formulas appear, adding +${bonus.toFixed(1)}.`);
  else if (hot <= 1 && top >= 3) why.push('Only one warning-or-stronger formula appears, so no bonus.');
  return { score, band, top, byTier, n: fs.length, why };
}
