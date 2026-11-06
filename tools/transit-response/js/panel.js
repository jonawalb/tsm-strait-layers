// HTML for the side panel readouts (single event and aggregate).
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { METRICS, nice, summaryOf, MIN_BASE, BASE_DAYS, GUARD } from './events.js';
import { COUNTRY } from '../data/context.js';
import { fmtDev } from './chart.js';

const f1 = v => (v == null ? 'n/a' : Math.abs(v) >= 10 ? Math.round(v).toString() : v.toFixed(1));
const pill = c => `<span class="pill" style="color:var(${(COUNTRY[c] || {}).col || '--ally'})">${escapeHtml((COUNTRY[c] || {}).short || c)}</span>`;
const kday = k => (k === 0 ? 'day 0' : (k > 0 ? '+' : '−') + Math.abs(k));

export function shipsHtml(e) {
  return `<ul class="ships">${e.ships.map(s => `<li>${pill(s.country)}<b>${escapeHtml(s.name)}</b>
    <span>${escapeHtml([s.hull, s.cls && s.cls + ' class', s.type].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>`;
}

export function eventListHtml(events, selected, isOff) {
  return events.slice().reverse().map(e => {
    const off = isOff(e);
    return `<li><button type="button" data-ev="${e.id}" aria-pressed="${e.id === selected}" class="${off ? 'off' : ''}">
      <span class="d num">${nice(e.date)}</span>
      <span class="c">${e.countries.map(pill).join('')}</span>
      <span class="s">${escapeHtml(e.ships.map(s => s.name).join(', '))}</span>
      ${off ? `<span class="why">${escapeHtml(off)}</span>` : ''}</button></li>`;
  }).join('');
}

/** Headline + readout for one analyzable event. */
export function singleReadout(a, unit, to) {
  const M = METRICS[a.m], s = summaryOf(a, unit, to), sCount = summaryOf(a, 'count', to);
  const d0 = a.days.find(d => d.k === 0);
  const within = a.b.sd != null && sCount != null && Math.abs(sCount) <= a.b.sd;
  const peak = a.days.filter(d => d.k >= 0 && d.v != null).reduce((p, d) => (d.v > (p?.v ?? -1) ? d : p), null);
  return `<div class="headline">
      <b class="num">${fmtDev(s, unit)}</b>
      <span>${unit === 'pct' ? 'change' : M.unit + ' per day'} against the baseline, averaged over day 0 to +${to}</span>
    </div>
    <p class="fine">${sCount == null ? '' : within
      ? 'That is within one standard deviation of the baseline days, so it falls inside ordinary day-to-day variation.'
      : 'That is more than one standard deviation from the baseline days.'}</p>
    <dl class="readout">
      <dt>Baseline</dt><dd>${f1(a.b.mean)} ${M.unit}/day (sd ${f1(a.b.sd)})</dd>
      <dt>Baseline days</dt><dd>${a.b.n} of ${BASE_DAYS}${a.b.excluded ? ` · ${a.b.excluded} excluded` : ''}${a.b.missing ? ` · ${a.b.missing} missing` : ''}</dd>
      <dt>Transit day</dt><dd>${d0.v} ${M.unit} (${fmtDev(unit === 'pct' ? d0.pct : d0.dev, unit)})</dd>
      <dt>Window peak</dt><dd>${peak ? `${peak.v} on ${kday(peak.k)}` : 'n/a'}</dd>
    </dl>`;
}

export function flagsHtml(a) {
  const out = [];
  if (a.flags.otherTransits.length) out.push(`<li class="warn">Another transit falls inside this window (${a.flags.otherTransits.map(kday).join(', ')}), so the two responses overlap.</li>`);
  if (a.flags.exercises.length) out.push(`<li class="warn">Window overlaps a major exercise: ${a.flags.exercises.join(', ')}. Shaded on the chart.</li>`);
  if (a.b.exercises.length) out.push(`<li class="warn">The baseline includes exercise days (${a.b.exercises.join(', ')}), which raises it. Try "Leave exercise days out of the baseline".</li>`);
  if (a.b.excluded) out.push(`<li>${a.b.excluded} baseline days were left out because another transit or exercise was within ${GUARD} days.</li>`);
  if (a.flags.gaps.length) out.push(`<li>No TSM data for ${a.flags.gaps.map(kday).join(', ')}.</li>`);
  if (a.flags.jcrp.length) out.push(`<li>Joint combat readiness patrol reported on ${a.flags.jcrp.map(kday).join(', ')} (marked J).</li>`);
  if (!out.length) out.push('<li>No other transit, major exercise or data gap inside this window.</li>');
  return out.join('');
}

export function offHtml(e, why, metric) {
  return `<div class="status" data-s="warn"><b>Not analyzable</b><span>${escapeHtml(why)}.</span></div>
    <p class="fine">The ships and date still show on the map. ${metric !== 'air' && e.date >= '2022-08-06'
      ? 'Switch the metric to aircraft to analyze this transit.' : `Events need daily ${METRICS[metric].name.replace(/^(ADIZ|Official)/, s => s === 'ADIZ' ? s : s.toLowerCase())} data on day 0 and at least ${MIN_BASE} usable baseline days.`}</p>`;
}

export function aggReadout(g) {
  const u = g.unit, M = METRICS[g.m];
  const row = (name, G, col) => `<dt style="color:var(${col})">${name}</dt><dd>${fmtDev(G.sumMean, u)} ${G.sumCi ? `<span class="muted">[${fmtDev(G.sumCi[0], u)}, ${fmtDev(G.sumCi[1], u)}]</span>` : '<span class="muted">no interval</span>'} · n=${G.n}</dd>`;
  const small = Math.min(g.us.n, g.ally.n);
  const cross = g.diff && g.diff.ci[0] < 0 && g.diff.ci[1] > 0;
  return `<div class="headline"><b class="num">${g.diff ? fmtDev(g.diff.est, u) : 'n/a'}</b>
      <span>difference, U.S.-present minus no-U.S. events, ${u === 'pct' ? '% vs. baseline' : M.unit + ' per day'}, day 0 to +${g.to}</span></div>
    <dl class="readout">
      ${row('U.S. present', g.us, '--us')}
      ${row('No U.S. ship', g.ally, '--accent')}
      <dt>Difference</dt><dd>${g.diff ? `${fmtDev(g.diff.est, u)} <span class="muted">[${fmtDev(g.diff.ci[0], u)}, ${fmtDev(g.diff.ci[1], u)}]</span>` : 'needs 2+ events per group'}</dd>
    </dl>
    <p class="fine">Brackets: 95% bootstrap interval (2,000 resamples of events, fixed seed).
      ${g.dropped ? `${g.dropped} of ${g.all} events set aside because another transit or an exercise falls in their window.` : `${g.all} events.`}</p>
    ${small < 5 ? `<p class="fine warn">One group has fewer than 5 events. Treat any interval here as very rough.</p>` : ''}
    ${g.diff ? `<p class="fine">${cross ? 'The interval for the difference includes zero: these data do not separate the two groups.' : 'The interval for the difference excludes zero in this sample. That is a descriptive gap, not evidence of cause.'}</p>` : ''}`;
}

export function dayTip(a, k, unit) {
  const d = a.days.find(x => x.k === k); if (!d) return '';
  const M = METRICS[a.m];
  const parts = [`<b>${nice(d.d)}</b> (${kday(k)}): `];
  parts.push(d.v == null ? 'no data' : `${d.v} ${M.unit}, baseline ${f1(a.b.mean)}, ${fmtDev(unit === 'pct' ? d.pct : d.dev, unit)}`);
  if (String(d.flag ?? '').includes('J')) parts.push('. Joint combat readiness patrol');
  if (String(d.flag ?? '').includes('L')) parts.push('. Long-distance flight reported');
  if (d.others.length) parts.push(`. Also transiting: ${d.others.flatMap(o => o.ships.map(s => escapeHtml(s.name))).join(', ')}`);
  if (d.ex.length) parts.push(`. Exercise: ${d.ex.map(x => x.name).join(', ')}`);
  return parts.join('') + '.';
}

export function aggTip(g, k) {
  const j = k + 7, u = g.unit; // 7 = days before the transit (PRE)
  const one = (name, G) => `${name} ${fmtDev(G.mean[j], u)}${G.ci[j] ? ` [${fmtDev(G.ci[j][0], u)}, ${fmtDev(G.ci[j][1], u)}]` : ''}`;
  return `<b>${kday(k)}</b>: ${one('U.S. present', g.us)} · ${one('no U.S.', g.ally)}`;
}
