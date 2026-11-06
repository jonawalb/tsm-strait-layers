// Day card (report text on demand) and the list of entry days in the window.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { ALL, SECTORS, SECTOR_INFO, nice, niceShort, reportUrl, reportText, addDays } from './data.js';

const secNames = day => SECTORS.filter(s => day.mask & (1 << SECTORS.indexOf(s))).map(s => SECTOR_INFO[s].name);

let token = 0;
export function renderDay(box, day, onStep) {
  if (!day) { box.innerHTML = '<p class="fine">Click a bar on the timeline or a day in the list to read its report.</p>'; return; }
  const my = ++token;
  const secs = secNames(day);
  const windowNote = day.daily
    ? `6 a.m. ${niceShort(day.d)} to 6 a.m. ${niceShort(addDays(day.d, 1))} (UTC+8)`
    : 'Single-day report';
  const links = day.ids.map(id => `<a href="${reportUrl(id)}" target="_blank" rel="noopener">MND report ${id}</a>`).join(' · ');
  box.innerHTML = `
    <div class="day-h"><h3>${nice(day.d)}</h3>
      <span class="nav"><button type="button" class="btn sm" data-step="-1" aria-label="Previous report day">‹</button><button type="button" class="btn sm" data-step="1" aria-label="Next report day">›</button></span></div>
    <p class="fine">${windowNote}${day.jcrp ? ' · <span class="pill jc">JCRP</span>' : ''}${day.ldf ? ' · <span class="pill">Long-range flight</span>' : ''}</p>
    ${day.report ? `<dl class="readout">
      <dt>Aircraft</dt><dd>${day.total ?? 'not stated'}</dd>
      <dt>Median line / ADIZ</dt><dd>${day.entered ?? 'not stated'}</dd>
      <dt>Sectors named</dt><dd>${secs.length ? secs.join(', ') : day.era === 1 ? 'not given in this period' : 'none'}</dd></dl>
      ${day.notext ? '<p class="fine">MND\'s English page for this report has no text, so no figures could be read. The report may have been posted as an image.</p>' : ''}
      <p class="links">${links}<br><a href="${reportUrl(day.ids[0])}" target="_blank" rel="noopener">View MND's flight-path map</a> <span class="muted">(image on the report page)</span></p>
      <div class="rtext" aria-live="polite"><p class="fine">Loading report text…</p></div>`
    : `<p class="fine">${day.daily ? 'No report for this window in MND\'s English list.' : 'No report. Before August 2022 MND published only when aircraft entered the southwestern ADIZ.'}</p>`}`;
  box.querySelectorAll('[data-step]').forEach(b => b.onclick = () => onStep(Number(b.dataset.step)));
  if (!day.report) return;
  reportText(day).then(list => {
    if (my !== token) return;
    const el = box.querySelector('.rtext');
    el.innerHTML = list.map(r => r.text
      ? `<pre>${escapeHtml(r.text)}</pre>`
      : `<p class="fine">Text for report ${r.id} is not in this build.</p>`).join('');
  });
}

export function renderDayList(box, S, onPick) {
  const days = [];
  for (let i = S.to; i >= S.from; i--) {
    const d = ALL[i];
    if (!d.mask) continue;
    if (S.jcrpOnly && !d.jcrp) continue;
    if (S.sec && !(d.mask & (1 << SECTORS.indexOf(S.sec)))) continue;
    days.push(d);
  }
  const LIM = 60;
  const head = `<p class="fine">${days.length.toLocaleString('en-US')} day${days.length === 1 ? '' : 's'} with ${S.sec ? `a ${SECTOR_INFO[S.sec].name.toLowerCase()} ADIZ entry` : 'an ADIZ entry'}${S.jcrpOnly ? ' on JCRP days' : ''}${days.length > LIM ? `, newest ${LIM} shown` : ''}.</p>`;
  box.innerHTML = head + `<ol class="days">${days.slice(0, LIM).map(d => `<li><button type="button" data-i="${d.i}" aria-pressed="${d.i === S.day}">
    <span class="dt">${nice(d.d)}</span><span class="num">${d.entered ?? '?'}</span>
    <span class="secs">${secNames(d).map(n => n.replace(/ern$/, '')).join(' · ')}</span>${d.jcrp ? '<span class="pill jc">JCRP</span>' : ''}</button></li>`).join('')}</ol>`;
  box.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => onPick(ALL[Number(b.dataset.i)]));
}
