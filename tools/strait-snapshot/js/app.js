// Strait Snapshot Live: month selector, headline numbers, and the six-figure schema.
import { MONTHS, MONTH_NAMES, AS_OF, REPORTS, CCG_LOCS, CCG, BY_DATE, monthStats, monthDays, yearSeries, prevYm, yearAgo, pct, nice, niceY } from './data.js';
import { addExportBar } from '../../../shared/js/export.js';
import { INDEX_URL } from '../data/reports.js';
import { drawDaily, drawShips } from './figs-daily.js';
import { drawMonthly, drawYoY } from './figs-trend.js';
import { drawCCG, drawOverview } from './figs-ccg.js';

const $ = s => document.querySelector(s);
const S = { ym: MONTHS.at(-2) || MONTHS[0], metric: 'total', show2023: false };
readHash();

/* Month selector */
const picker = $('#months');
picker.innerHTML = MONTHS.map(ym => {
  const s = monthStats(ym);
  return `<button type="button" data-ym="${ym}" aria-pressed="false"><b>${MONTH_NAMES[s.m - 1].slice(0, 3)}</b><span>${s.partial ? 'partial' : s.total.toLocaleString('en-US')}</span></button>`;
}).join('');
picker.querySelectorAll('button').forEach(b => b.onclick = () => { S.ym = b.dataset.ym; render(); });
$('#prev').onclick = () => step(-1);
$('#next').onclick = () => step(1);
function step(d) {
  const i = MONTHS.indexOf(S.ym) + d;
  if (i >= 0 && i < MONTHS.length) { S.ym = MONTHS[i]; render(); }
}
document.querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { S.metric = b.dataset.metric; render(); });
$('#show2023').onchange = e => { S.show2023 = e.target.checked; render(); };

/* Headline numbers */
function delta(cur, prev, label) {
  const p = pct(cur, prev);
  if (p == null) return `<span class="d na">${label}: n/a</span>`;
  const r = Math.round(p);
  return `<span class="d ${r > 0 ? 'up' : r < 0 ? 'down' : ''}"><i aria-hidden="true">${r > 0 ? '▲' : r < 0 ? '▼' : '■'}</i> ${Math.abs(r)}% ${label}</span>`;
}
function tile(label, big, sub, deltas = '') {
  return `<div class="tile"><span class="t-l">${label}</span><b class="t-b num">${big}</b><span class="t-s">${sub}</span><span class="t-d">${deltas}</span></div>`;
}
function headlines(s) {
  const p = monthStats(prevYm(s.ym));
  const y = monthStats(yearAgo(s.ym));
  const pm = MONTH_NAMES[p.m - 1].slice(0, 3), yl = `${MONTH_NAMES[y.m - 1].slice(0, 3)} ${y.y}`;
  const perDayMoM = s.days !== p.days || s.partial;
  const perDayYoY = s.days !== y.days || s.partial;
  const airMoM = perDayMoM ? delta(s.perDay, p.perDay, `vs ${pm}, per day`) : delta(s.total, p.total, `vs ${pm}`);
  const airYoY = y.days ? (perDayYoY ? delta(s.perDay, y.perDay, `vs ${yl}, per day`) : delta(s.total, y.total, `vs ${yl}`)) : `<span class="d na">vs ${yl}: no data</span>`;
  const adizMoM = perDayMoM ? delta(s.adiz / s.days, p.adiz != null ? p.adiz / p.days : null, `vs ${pm}, per day`) : delta(s.adiz, p.adiz, `vs ${pm}`);
  const ccgYtd = MONTHS.filter(m => m <= s.ym).reduce((a, m) => a + monthStats(m).ccg.length, 0);
  const byLoc = CCG_LOCS.map(l => [l.label, s.ccg.filter(c => c[1] === l.key).length]).filter(x => x[1]);
  $('#tiles').innerHTML = [
    tile('PLA aircraft', s.total.toLocaleString('en-US'), `${s.perDay.toFixed(1)} per day over ${s.days} day${s.days === 1 ? '' : 's'}`, airMoM + airYoY),
    tile('Entered the ADIZ', s.adiz != null ? s.adiz.toLocaleString('en-US') : '—', s.adizShare != null ? `${Math.round(s.adizShare * 100)}% of aircraft` : 'Not recorded', adizMoM),
    tile('PLAN ships', s.planAvg != null ? s.planAvg.toFixed(1) : '—', s.planPeak ? `average per day · peak ${s.planPeak[3]} on ${nice(s.planPeak[0])}` : '', delta(s.planAvg, p.planAvg, `vs ${pm}`)),
    tile('Official ships', s.official != null ? s.official.toLocaleString('en-US') : '—', s.officialPerDay != null ? `daily sightings summed · ${s.officialPerDay.toFixed(1)} per day` : '', delta(s.officialPerDay, p.officialPerDay, `vs ${pm}, per day`)),
    tile('Joint combat readiness patrols', s.jcrp.length, s.jcrp.length ? s.jcrp.map(nice).join(', ') : 'None flagged', `<span class="d na">${p.jcrp.length} in ${pm}</span>`),
    tile('CCG incursions', s.ccg.length, byLoc.length ? byLoc.map(([k, n]) => `${k} ${n}`).join(' · ') : 'None recorded', `<span class="d na">${ccgYtd} so far in 2026</span>`),
  ].join('');
  const peak = s.peak ? `Peak day ${nice(s.peak[0])}: ${s.peak[1]} aircraft${String(s.peak[5] ?? '').includes('J') ? ', a joint combat readiness patrol day' : ''}.` : '';
  const zero = s.zero.length ? `${s.zero.length} day${s.zero.length > 1 ? 's' : ''} with zero aircraft (${s.zero.map(nice).join(', ')}).` : 'No zero-aircraft days.';
  const tr = s.transits.length ? `Allied Strait transits: ${s.transits.map(t => `${t[1]} (${t[5]}, ${nice(t[0])})`).join('; ')}.` : 'No allied Strait transits recorded.';
  const ldf = s.ldf.length ? ` Long-distance flights flagged on ${s.ldf.map(nice).join(', ')}.` : '';
  $('#facts').textContent = `${peak} ${zero} ${tr}${ldf}`;
}

/* Render everything */
function render() {
  const s = monthStats(S.ym);
  picker.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.ym === S.ym));
  $('#prev').disabled = S.ym === MONTHS[0];
  $('#next').disabled = S.ym === MONTHS.at(-1);
  document.querySelectorAll('[data-metric]').forEach(b => b.setAttribute('aria-pressed', b.dataset.metric === S.metric));
  $('#show2023').checked = S.show2023;
  const title = `${s.name} 2026`;
  $('#mtitle').textContent = title;
  $('#mnote').innerHTML = s.partial
    ? `Partial month: TSM data runs through ${niceY(AS_OF)} (${s.days} of ${s.calendarDays} days). Changes are compared per reported day.`
    : `${s.days} of ${s.calendarDays} days reported.`;
  const rep = REPORTS[S.ym];
  $('#report').innerHTML = rep
    ? `<a href="${rep.url}" target="_blank" rel="noopener">Read the published ${s.name} 2026 Strait Snapshot</a> <span class="muted">(published ${niceY(rep.published)})</span>`
    : `The ${s.name} report is not yet published. <a href="${INDEX_URL}" target="_blank" rel="noopener">All Strait Snapshot reports</a>`;
  document.querySelectorAll('.mname').forEach(e => { e.textContent = s.name; });
  headlines(s);
  drawDaily($('#f1'), S.ym);
  drawMonthly($('#f2'), S.ym, S);
  drawShips($('#f3'), S.ym);
  const n = drawCCG($('#f4'), S.ym);
  $('#f4-n').textContent = n ? `${n} in ${s.name}` : `none in ${s.name}`;
  drawOverview($('#f5'), S.ym);
  drawYoY($('#f6'), S.ym, S);
  writeHash();
}

function writeHash() {
  const q = new URLSearchParams({ m: S.ym });
  if (S.metric !== 'total') q.set('v', 'perday');
  if (S.show2023) q.set('y23', '1');
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (MONTHS.includes(q.get('m'))) S.ym = q.get('m');
  if (q.get('v') === 'perday') S.metric = 'perDay';
  if (q.get('y23') === '1') S.show2023 = true;
}

$('#copy-link').onclick = async e => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; }
  catch { e.target.textContent = 'Copy the address bar'; }
  setTimeout(() => { e.target.textContent = 'Copy link'; }, 1800);
};
document.addEventListener('keydown', e => {
  if (e.target.closest('input, [role="group"]')) return;
  if (e.key === '[') step(-1);
  if (e.key === ']') step(1);
});
/* Export: PNG for every figure, CSV of the numbers behind it */
const SRC_DAILY = 'Data: TSM PLA Activity Center (Taiwan MND daily reports)';
const DAILY_HEAD = ['date', 'aircraft', 'adiz_entries', 'plan_ships', 'official_ships', 'flag'];
const dailyRows = days => [DAILY_HEAD, ...days.map(d => d.row ? d.row.slice(0, 6) : [d.date, '', '', '', '', ''])];
const monthName = () => `${monthStats(S.ym).name} 2026`;
const ytdDays = () => {
  const end = monthDays(S.ym).at(-1).date, out = [];
  for (let t = Date.parse('2026-01-01'); t <= Date.parse(end); t += 864e5) { const d = new Date(t).toISOString().slice(0, 10); out.push({ date: d, row: BY_DATE.get(d) || null }); }
  return out;
};
const FIGS = {
  f1: { title: () => `Daily PLA air activity, ${monthName()}`, note: SRC_DAILY, csv: () => dailyRows(monthDays(S.ym)) },
  f2: { title: () => `Monthly PLA aircraft ${S.metric === 'perDay' ? 'per reported day' : 'totals'}, 2024–2026`, note: SRC_DAILY,
    csv: () => [['year', 'month', 'aircraft_total', 'per_reported_day', 'days_reported', 'calendar_days'],
      ...[...(S.show2023 ? [2023] : []), 2024, 2025, 2026].flatMap(y => yearSeries(y).filter(s => s.total != null)
        .map(s => [y, s.m, s.total, s.perDay?.toFixed(2), s.days, s.calendarDays]))] },
  f6: { title: () => `${monthStats(S.ym).name} air activity, year over year`, note: SRC_DAILY },
  f3: { title: () => `PLAN and official ships, ${monthName()}`, note: SRC_DAILY, csv: () => dailyRows(monthDays(S.ym)) },
  f4: { title: () => `China Coast Guard incursions by location, January to ${monthName()}`, note: 'Data: TSM CGA/CCG Incident Tracker 2026, with four September incidents added from CGA releases',
    csv: () => [['date', 'location', 'description'], ...CCG.filter(c => c[0] <= monthDays(S.ym).at(-1).date)] },
  f5: { title: () => `Multi-domain overview, January to ${monthName()}`, note: SRC_DAILY + '; TSM CCG and Strait transit trackers', csv: () => dailyRows(ytdDays()) },
};
Object.entries(FIGS).forEach(([id, o]) => {
  const box = document.getElementById(id);
  addExportBar(box, { target: () => box.querySelector('svg'), where: 'after', ...o });
});

let rt, lastW = innerWidth;
addEventListener('resize', () => {
  if (innerWidth === lastW) return;
  lastW = innerWidth; clearTimeout(rt); rt = setTimeout(render, 150);
});
render();

{ const a = document.getElementById('asof'); if (a) a.textContent = niceY(AS_OF); }
