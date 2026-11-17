// Notional scoring: baseline scores plus sensitivities times the user's assumptions, clamped to 0–10.
import { OPTIONS, AXES, SCORES, SENS } from '../data/options.js';

export const DEFAULTS = { us: 0, jp: false, g7: false, ei: 50 };
export const US_POSTURE = [
  { v: -1, name: 'Restrained', help: 'Washington signals it will stay out militarily.' },
  { v: 0, name: 'Ambiguous', help: 'Strategic ambiguity, as today.' },
  { v: 1, name: 'Committed', help: 'Washington signals it would defend Taiwan.' },
];

const clamp = v => Math.max(0, Math.min(10, v));

/** Scores for every option under assumptions A = { us, jp, g7, ei (0–100) }. */
export function scoresFor(A) {
  const x = { us: A.us, jp: A.jp ? 1 : 0, g7: A.g7 ? 1 : 0, ei: (A.ei - 50) / 50 };
  const out = {};
  OPTIONS.forEach(o => {
    out[o.id] = {};
    AXES.forEach(ax => {
      const sens = SENS[o.id][ax.id] || {};
      const delta = Object.entries(sens).reduce((a, [k, c]) => a + c * x[k], 0);
      out[o.id][ax.id] = Math.round(clamp(SCORES[o.id][ax.id] + delta) * 10) / 10;
    });
  });
  return out;
}

/** Short sentences describing the biggest changes from the default assumptions for one option. */
export function changes(optId, now, base) {
  const list = AXES.map(ax => ({ ax, d: now[optId][ax.id] - base[optId][ax.id] }))
    .filter(c => Math.abs(c.d) >= 0.3)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return list.map(c => `${c.ax.name} ${c.d > 0 ? 'rises' : 'falls'} by ${Math.abs(c.d).toFixed(1)}`);
}
