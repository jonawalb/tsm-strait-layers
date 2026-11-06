// Tone of statements over time (data/tone_people.js, optional). Charts are drawn generically from meta.metrics.
// Optional overlay: monthly mean PLA aircraft from TSM daily data on the same time axis, for comparison only.
import { TSM } from '../../../shared/data/tsm.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

let AIR = null;
function aircraftByMonth() {
  if (AIR) return AIR;
  const s = new Map();
  for (const r of TSM.daily) if (r[1] != null) { const m = r[0].slice(0, 7); const v = s.get(m) || [0, 0]; v[0] += r[1]; v[1]++; s.set(m, v); }
  AIR = new Map([...s].map(([m, [t, n]]) => [m, t / n]));
  return AIR;
}
const monthsBetween = (a, b) => { const out = []; for (let [y, m] = a.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= b; m === 12 ? (y++, m = 1) : m++) out.push(`${y}-${String(m).padStart(2, '0')}`); return out; };

function chart(metric, byMonth, months, overlay) {
  const W = 600, H = 130, L = 30, Rr = overlay ? 34 : 6, T = 8, B = 20;
  const [lo, hi] = metric.scale || [0, 1];
  const x = i => L + (months.length < 2 ? 0 : i / (months.length - 1)) * (W - L - Rr);
  const y = v => T + (1 - (v - lo) / ((hi - lo) || 1)) * (H - T - B);
  const pts = months.map((m, i) => byMonth[m] && Number.isFinite(byMonth[m][metric.key]) ? [i, byMonth[m][metric.key], byMonth[m].n, m] : null);
  let d = '', pen = false;
  for (const p of pts) { if (!p) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`; pen = true; }
  let ov = '';
  if (overlay) {
    const A = aircraftByMonth();
    const vals = months.map(m => A.get(m) ?? null);
    const max = Math.max(1, ...vals.filter(v => v != null));
    const ya = v => T + (1 - v / max) * (H - T - B);
    let od = '', op = false;
    vals.forEach((v, i) => { if (v == null) { op = false; return; } od += `${op ? 'L' : 'M'}${x(i).toFixed(1)} ${ya(v).toFixed(1)}`; op = true; });
    ov = `<path class="tn-air" d="${od}"/><text x="${W - 2}" y="${T + 6}" text-anchor="end" class="tn-air-t">${Math.round(max)} aircraft/day</text><text x="${W - 2}" y="${H - B}" text-anchor="end" class="tn-air-t">0</text>`;
  }
  const ticks = months.map((m, i) => m.endsWith('-01') ? `<text x="${x(i).toFixed(1)}" y="${H - 5}">${m.slice(0, 4)}</text>` : '').join('');
  return `<svg class="tn-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(metric.label)} by month, ${months[0]} to ${months.at(-1)}">
    <text x="0" y="${T + 4}">${esc(String(hi))}</text><text x="0" y="${H - B}">${esc(String(lo))}</text>
    <line x1="${L}" x2="${W - Rr}" y1="${H - B}" y2="${H - B}"/>${ticks}${ov}
    <path class="tn-line" d="${d}"/>${pts.filter(Boolean).map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="2.4"><title>${p[3]}: ${p[1].toFixed(2)} (n=${p[2]})</title></circle>`).join('')}</svg>`;
}

// Returns '' when the person has no tone data. `heading` adds the Statements heading when the Statements block is absent.
export function toneHtml(p, TONE, { overlayAllowed, overlay, heading }) {
  const r = TONE?.people?.[p.id];
  const metrics = TONE?.meta?.metrics || [];
  if (!r || !metrics.length) return '';
  const keys = Object.keys(r.by_month || {}).sort();
  if (!keys.length) return '';
  const months = monthsBetween(keys[0], keys.at(-1));
  return `${heading ? '<h3 class="pf-h">Statements</h3>' : ''}
    <p class="pf-sub">Tone by month</p>
    ${overlayAllowed ? `<label class="tcol"><input type="checkbox" data-tone-overlay${overlay ? ' checked' : ''}> Overlay monthly PLA aircraft around Taiwan</label>
      ${overlay ? '<p class="w-warn">Shown together for comparison; co-movement is not evidence of cause.</p>' : ''}` : ''}
    ${metrics.map(m => `<div class="tn-m"><p class="tr-h"><b>${esc(m.label)}</b> <span class="fine">${esc(m.low_label || '')} ↔ ${esc(m.high_label || '')}</span></p>
      ${chart(m, r.by_month, months, overlay && overlayAllowed)}
      <p class="fine">${esc(m.definition || '')}</p>
      <p class="fine tn-val">${esc(m.validated || '')}</p></div>`).join('')}
    <p class="fine">Hover a point for the month's reading and the number of documents behind it.${overlay && overlayAllowed ? ' Grey line: monthly mean of daily PLA aircraft reported by Taiwan MND (TSM PLA Activity Center), right-hand scale.' : ''}</p>`;
}
