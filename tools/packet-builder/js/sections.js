// Turns computed data into page blocks for the paginator.
// Block shapes: {sec, t:'h', html} heading kept with the next block; {sec, t:'b', html};
// {sec, t:'rows', wrap, into, rows[], cont} a table or list that may continue across pages;
// {sec, t:'break'} start a new page.
import { esc, fmtDate, fmtRange, fmtN, pctChange, plural, clip } from './util.js';
import { dailyChart, CHART_LEGEND } from './chart.js';
import { DAILY_FIRST } from './data.js';

export const SECTIONS = [
  { id: 'sum', title: 'Summary numbers', help: 'Aircraft, ADIZ, ships, patrols, with the prior period' },
  { id: 'chart', title: 'Daily chart', help: 'Day-by-day counts with events marked' },
  { id: 'ccg', title: 'China Coast Guard incidents', help: 'TSM CCG tracker, from June 2024' },
  { id: 'tr', title: 'Allied transits', help: 'Taiwan Strait transits by allied navies' },
  { id: 'ex', title: 'Exercises', help: 'Listed major PLA exercises in range' },
  { id: 'st', title: 'PRC official statements', help: 'Selected quotes with links' },
  { id: 'ais', title: 'AIS summary', help: 'Only for ranges within Sept. 4–28, 2026' },
];
export const SEC_TITLE = Object.fromEntries([...SECTIONS.map(s => [s.id, s.title]), ['src', 'Sources and method']]);

export const head = (sec, num, desc = '') => ({ sec, t: 'h', html:
  `<header class="sec-h"><p class="sec-n">${String(num).padStart(2, '0')}</p><div><h2>${SEC_TITLE[sec]}</h2>${desc ? `<p class="sec-d">${desc}</p>` : ''}</div></header>` });
export const para = (sec, html, cls = 'lead') => ({ sec, t: 'b', html: `<p class="${cls}">${html}</p>` });
export const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
export const table = (sec, cols, rows, cls = '') => ({ sec, t: 'rows', into: 'tbody', cont: SEC_TITLE[sec],
  wrap: `<table class="ptab ${cls}"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody></tbody></table>`, rows });

const trendWord = p => p == null ? '' : Math.abs(p) < 5 ? 'about the same as' : p > 0 ? `${fmtN(Math.abs(p))}% higher than` : `${fmtN(Math.abs(p))}% lower than`;
const arrow = p => p == null ? '' : `<b class="chg">${Math.abs(p) < 0.5 ? '±0%' : (p > 0 ? '▲ ' : '▼ ') + fmtN(Math.abs(p)) + '%'}</b>`;

function tile(label, a, b, unit, n) {
  if (!a.n) return `<div class="tile"><p class="t-l">${label}</p><p class="t-v na">–</p><p class="t-s">No TSM data for this range</p></div>`;
  const p = pctChange(a.avg, b.avg);
  const prior = b.n ? `Prior ${n} days: ${fmtN(b.total)} ${arrow(p)}` : `Prior ${n} days: no TSM data`;
  return `<div class="tile"><p class="t-l">${label}</p><p class="t-v num">${fmtN(a.total)}</p>
    <p class="t-s">${fmtN(a.avg, 1)} ${unit} a day</p><p class="t-p">${prior}</p>
    ${a.n < a.days ? `<p class="t-c">TSM data for ${a.n} of ${a.days} days</p>` : ''}</div>`;
}

function flagTile(label, now, prior, n, has = true, priorHas = true) {
  // No daily rows in range (e.g. before the record starts): no data, not zero.
  if (!has) return `<div class="tile"><p class="t-l">${label}</p><p class="t-v na">–</p><p class="t-s">No TSM data for this range</p></div>`;
  const list = now.length ? now.slice(0, 6).map(d => fmtDate(d, false)).join(', ') + (now.length > 6 ? ` and ${now.length - 6} more` : '') : 'None reported';
  return `<div class="tile"><p class="t-l">${label}</p><p class="t-v num">${now.length}</p><p class="t-s">${list}</p>
    <p class="t-p">Prior ${n} days: ${priorHas ? prior.length : 'no TSM data'}</p></div>`;
}

export function summaryBlocks(R, S, num) {
  const { now, prior, P, n } = S, sec = 'sum';
  const out = [head(sec, num, `${fmtRange(R.from, R.to)} compared with the ${n} days before, ${fmtRange(P.from, P.to)}`)];
  if (!now.air.n) {
    out.push(para(sec, `TSM's daily record of Taiwan Ministry of National Defense (MND) reports starts ${fmtDate(DAILY_FIRST)}, so there are no daily counts for this range. Later sections still list incidents, exercises and statements that fall in it.`));
  } else {
    const p = pctChange(now.air.avg, prior.air.avg);
    let s = `Over ${n === 1 ? 'this day' : `these ${n} days`}, Taiwan's Ministry of National Defense (MND) reported <b>${plural(now.air.total, 'PLA aircraft', 'PLA aircraft')}</b> around Taiwan`;
    s += now.adiz.n ? `; <b>${fmtN(now.adiz.total)}</b> of them crossed the median line or entered Taiwan's air defense identification zone (ADIZ)${now.adiz.n < now.adiz.days ? ` (on the ${now.adiz.n} days with an ADIZ figure)` : ''}.` : '.';
    if (now.peak && n > 1) s += ` The busiest day was ${fmtDate(now.peak.d)}, with ${plural(now.peak.v, 'aircraft', 'aircraft')}.`;
    s += ` MND reported ${now.jcrp.length ? plural(now.jcrp.length, 'joint combat readiness patrol') : 'no joint combat readiness patrols'} and ${now.lrf.length ? plural(now.lrf.length, 'long-range flight') : 'no long-range flights'}.`;
    if (p != null) s += ` Per reported day, aircraft activity was ${trendWord(p)} the prior ${n} days.`;
    out.push(para(sec, s));
  }
  out.push({ sec, t: 'b', html: `<div class="tiles">
    ${tile('PLA aircraft', now.air, prior.air, 'aircraft', n)}
    ${tile('Median line or ADIZ', now.adiz, prior.adiz, 'aircraft', n)}
    ${flagTile('Joint combat readiness patrol days', now.jcrp, prior.jcrp, n, now.air.n > 0, prior.air.n > 0)}
    ${tile('PLAN ship-days', now.plan, prior.plan, 'ships', n)}
    ${tile('Official ship-days', now.off, prior.off, 'ships', n)}
    ${flagTile('Long-range flight days', now.lrf, prior.lrf, n, now.air.n > 0, prior.air.n > 0)}</div>` });
  out.push(para(sec, 'Arrows compare daily averages over days with data, so a range with a missing day is not penalized. Ship-days add up each day\'s count: a ship seen on three days counts three times. "Official ships" are other PRC government vessels MND reports alongside the PLA Navy. Patrol and long-range flight days are days with an MND press release describing one.', 'fine'));
  return out;
}

export function chartBlocks(R, days, num) {
  const sec = 'chart';
  const any = days.some(d => d.air != null);
  const out = [head(sec, num, 'One column per MND reporting day (06:00 to 06:00, filed under the start date)')];
  out.push({ sec, t: 'b', html: `<figure class="fig">${dailyChart(days)}${CHART_LEGEND}</figure>` });
  if (!any) out.push(para(sec, `No TSM daily counts exist for this range (the record starts ${fmtDate(DAILY_FIRST)}). Event markers are still shown.`, 'fine'));
  else if (days.some(d => d.air != null && d.plan == null)) out.push(para(sec, 'Ship counts are missing for part of this range: TSM\'s ship record starts Aug. 13, 2024 and has a few days where TSM\'s count contradicted MND.', 'fine'));
  return out;
}

export function ccgBlocks(R, C, num) {
  const sec = 'ccg', out = [head(sec, num, 'China Coast Guard formations and other PRC government ships reported by Taiwan\'s Coast Guard Administration')];
  if (!C.covered) {
    out.push(para(sec, `TSM's CCG incident tracker covers ${fmtDate(C.tracker.first)} to ${fmtDate(C.tracker.last)}, so it has no rows for this range. That is a gap in the record, not evidence that nothing happened.`));
    return out;
  }
  const locs = Object.entries(C.byLoc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join(', ');
  out.push(para(sec, C.rows.length ? `TSM recorded <b>${plural(C.rows.length, 'incident')}</b> in this range: ${locs}.` : 'TSM recorded no China Coast Guard incidents in this range.'));
  if (C.partial) out.push(para(sec, `The tracker covers ${fmtDate(C.tracker.first)} to ${fmtDate(C.tracker.last)}; days outside that span have no rows.`, 'fine'));
  if (C.rows.length) {
    out.push(table(sec, ['Date', 'Where', 'What was recorded', 'Vessels', 'Source'], C.rows.map(x => `<tr>
      <td class="nw">${fmtDate(x.date, false)}</td><td>${esc(x.loc)}</td>
      <td>${esc(clip([x.desc, x.timeline].filter(Boolean).join('. '), 190))}${x.flags.map(f => ` <span class="tag">${esc(f.label)}</span>`).join('')}</td>
      <td>${esc(clip(x.vessels, 70))}</td>
      <td>${x.cites.length ? x.cites.map(c => link(c.url, 'CGA release')).join('<br>') : '<span class="muted">TSM tracker</span>'}</td></tr>`), 'ccg'));
  }
  return out;
}

export function transitBlocks(R, T, num) {
  const sec = 'tr', out = [head(sec, num, 'Publicly reported Taiwan Strait transits by U.S. and allied navies')];
  const by = Object.entries(T.byCountry).map(([k, v]) => `${esc(k)} ${v}`).join(', ');
  out.push(para(sec, T.rows.length ? `TSM's transit tracker lists <b>${plural(T.rows.length, 'ship transit')}</b> in this range (${by}).` : 'TSM\'s transit tracker lists no allied transits in this range.'));
  if (T.gap) out.push(para(sec, 'Between September 12, 2025 and January 16, 2026 the tracker has a single entry (November 5, 2025). Other transits in those months may be missing from this list.', 'note'));
  if (T.rows.length) out.push(table(sec, ['Date', 'Ship', 'Hull', 'Class and type', 'Country'],
    T.rows.map(t => `<tr><td class="nw">${fmtDate(t[0], false)}</td><td>${esc(t[1])}</td><td class="num">${esc(t[2])}</td><td>${esc(t[3])} ${esc(t[4]).toLowerCase()}</td><td>${esc(t[5])}</td></tr>`)));
  return out;
}

export function exerciseBlocks(R, E, num) {
  const sec = 'ex', out = [head(sec, num, 'Major PLA exercises from TSM\'s 13-event list (Exercises as Theater)')];
  if (!E.rows.length) {
    out.push(para(sec, `No exercise on TSM's list falls in this range.${E.before ? ` The most recent listed exercise before it was <b>${esc(E.before.short)}</b>, ${fmtRange(E.before.start, E.before.end)}.` : ''}`));
    return out;
  }
  E.rows.forEach((e, k) => {
    const peaks = [e.peakAir, e.peakShips].filter(Boolean).map(s => esc(s)).join(' ');
    out.push({ sec, t: 'b', html: `<div class="excard"><h3>${esc(e.name)}</h3><p class="exdates">${fmtRange(e.start, e.end)}</p>
      <dl class="exdl"><dt>Trigger</dt><dd>${esc(e.trigger)}</dd><dt>Zones</dt><dd>${esc(clip(e.zones, 360))}</dd>
      <dt>Forces</dt><dd>${esc(clip(e.forces, 300))}</dd><dt>Reported peaks</dt><dd>${clip(peaks, 380)}</dd>
      ${e.note ? `<dt>Note</dt><dd>${esc(e.note)}</dd>` : ''}</dl></div>` });
    if (e.timeline.length) {
      out.push(para(sec, `<b>${esc(e.short)}: announcements and statements</b> (paraphrased; quoted words are verbatim)`, 'sub'));
      out.push(table(sec, ['Date', 'Who', 'What', 'Source'], e.timeline.map(t => `<tr><td class="nw">${fmtDate(t.date, false)}</td><td>${esc(t.who)}</td><td>${esc(t.text)}</td><td>${link(t.url, t.label)}</td></tr>`)));
    }
    if (k < E.rows.length - 1) out.push({ sec, t: 'b', html: '<hr class="soft">' });
  });
  return out;
}
