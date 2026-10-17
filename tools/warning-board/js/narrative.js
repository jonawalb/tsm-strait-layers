// Plain-language "what an analyst would say" text for the current board.
import { INDICATORS } from '../data/indicators.js';
import { TIMING, EXO } from './model.js';
import { listText, escapeHtml as esc } from '../../../shared/js/mapkit.js';

const names = (list, n = 3) => listText(list.slice(0, n).map(i => `<b>${esc(i.name.toLowerCase())}</b>`));
const pct = v => Math.round(v * 100) + '%';

/** Unlit indicators that would most change the judgment if they appeared. */
export function nextToWatch(states, n = 3) {
  return INDICATORS.filter(i => !states[i.id] && i.w >= 2)
    .sort((a, b) => b.w * (1 - EXO[b.ex]) - a.w * (1 - EXO[a.ex]))
    .slice(0, n);
}

export function analystText(a, states, timing) {
  const p = [];
  const topDomains = [...a.domains].sort((x, y) => y.score - x.score).filter(d => d.score > 0.2).map(d => d.name.toLowerCase());
  switch (a.band.id) {
    case 0:
      p.push(a.lit
        ? `Nothing here stands out from a normal year. The lit indicators, such as ${names(INDICATORS.filter(i => states[i.id]), 2)}, are long-running trends that show capability and intent over years but say little about timing.`
        : 'The board is empty. Set indicators by hand or pick a preset to see how an analyst would read them.');
      break;
    case 1:
      p.push(`Activity is above baseline, but the signal is thin: ${a.lit} indicators, concentrated in ${listText(topDomains.slice(0, 2)) || 'one area'}. An analyst would keep watching and would not issue a warning on this pattern.`);
      break;
    case 2:
      p.push(`This looks like a major exercise. About ${pct(a.exShare)} of the weighted signal comes from indicators that exercises routinely produce, such as ${names(a.exerciseTypical)}.`);
      p.push(a.discriminating.length
        ? `Only a few harder-to-fake preparations are lit (${names(a.discriminating, 2)}), and not enough to move the judgment.`
        : 'What is missing matters more: none of the slow, costly preparations that an exercise does not need, such as stop-loss orders, national mobilization or asset repatriation, is visible.');
      break;
    case 3:
      p.push(`Some of what is lit goes beyond what an exercise needs: ${names(a.discriminating) || 'several low-overlap indicators'}. An analyst would flag this as anomalous and ask for more collection.`);
      if (timing === 'days') p.push('Because everything appeared within days, the first question is whether this is a short-notice exercise or deliberate surprise. Signals that persist over the following weeks would settle it.');
      else if (a.breadth < 4) p.push(`The signal is strong in ${listText(topDomains.slice(0, 3))} but not yet broad. Preparation for large-scale action would be expected to show up across more domains.`);
      break;
    case 4:
      p.push(`Indicators that exercises rarely produce are lit in ${a.breadth} of 5 domains, including ${names(a.longLead.length ? a.longLead : a.discriminating)}. ${TIMING[timing].text}`);
      p.push('An analyst would issue strategic warning: a judgment that preparation for large-scale action may be under way and that decision-makers should act on it. Strategic warning does not predict a date.');
      break;
  }
  const nxt = nextToWatch(states);
  if (a.band.id < 4 && nxt.length) p.push(`What would change the judgment: ${names(nxt)}.`);
  const img = INDICATORS.filter(i => states[i.id] && i.obs === 'imagery');
  if (timing === 'days' && img.length) p.push(`A caution on collection: ${names(img, 2)} ${img.length > 1 ? 'are' : 'is'} mainly seen in satellite imagery, which can miss surges that last only a few days.`);
  return p.map(t => `<p>${t}</p>`).join('');
}
