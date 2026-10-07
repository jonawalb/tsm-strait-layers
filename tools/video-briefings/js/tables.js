// The week in numbers: headline tiles, daily MND table, CCG incidents and exercises, rhetoric measures and quotes.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f1 = x => (x == null ? 'n/a' : x.toFixed(1));
const day = s => new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const pct = (a, b) => (a == null || !b ? null : Math.round((a / b - 1) * 100));

function delta(p, label) {
  if (p == null) return `<span class="d na">${label}: n/a</span>`;
  return `<span class="d ${p > 0 ? 'up' : p < 0 ? 'down' : ''}"><i aria-hidden="true">${p > 0 ? '▲' : p < 0 ? '▼' : '■'}</i> ${Math.abs(p)}% ${label}</span>`;
}

function tile(label, big, sub, deltas) {
  return `<div class="tile"><span class="t-l">${label}</span><b class="t-b num">${big}</b><span class="t-s">${sub}</span><span class="t-d">${deltas}</span></div>`;
}

export function renderData(F) {
  const M = F.metrics, C = F.ccg, R = F.rhetoric;
  $('#tiles').innerHTML = [
    tile('PLA aircraft', M.air.total ?? 'n/a', `12-week avg ${f1(M.air.base.weekly)} a week`,
      delta(pct(M.air.total, M.air.base.weekly), 'vs 12-week avg') + delta(pct(M.air.total, M.air.prev.total), 'vs prev. week')),
    tile('Entered ADIZ', M.adiz.total ?? 'n/a', `12-week avg ${f1(M.adiz.base.weekly)} a week`,
      delta(pct(M.adiz.total, M.adiz.base.weekly), 'vs 12-week avg') + delta(pct(M.adiz.total, M.adiz.prev.total), 'vs prev. week')),
    tile('PLA Navy ships', f1(M.plan.perDay), `per day · 12-week avg ${f1(M.plan.base.perDay)}`,
      delta(pct(M.plan.perDay, M.plan.base.perDay), 'vs 12-week avg') + delta(pct(M.plan.perDay, M.plan.prev.perDay), 'vs prev. week')),
    tile('Official ships', f1(M.off.perDay), `per day · 12-week avg ${f1(M.off.base.perDay)}`,
      delta(pct(M.off.perDay, M.off.base.perDay), 'vs 12-week avg') + delta(pct(M.off.perDay, M.off.prev.perDay), 'vs prev. week')),
    tile('CCG incursions', C.n, `12-week avg ${f1(C.basePerWeek)} a week · ${C.ytd} in ${F.week.start.slice(0, 4)}`,
      `<span class="d">${C.prev} the previous week</span>`),
    tile('PRC official items', R.docsTotal, 'TAO, MFA, Defense; EN + ZH',
      `<span class="d">${R.rows.filter(r => r.z != null && Math.abs(r.z) >= R.notableZ).length} tone measures outside normal range</span>`),
  ].join('');

  const flag = f => (f.includes('J') ? '★' : '') + (f.includes('L') ? '✈' : '');
  const row = (label, a, b, c, d, cls = '') => `<tr class="${cls}"><th scope="row">${label}</th><td class="num">${a}</td><td class="num">${b}</td><td class="num">${c}</td><td class="num">${d}</td></tr>`;
  $('#t-days').innerHTML = `<caption class="sr">Daily MND counts for ${esc(F.week.label)}</caption>
    <thead><tr><th scope="col">Day</th><th scope="col">Aircraft</th><th scope="col">ADIZ</th><th scope="col">PLAN ships</th><th scope="col">Official ships</th></tr></thead><tbody>
    ${F.days.map(d => row(`${day(d.date)} <span class="flag">${flag(d.flag)}</span>`, d.air ?? '–', d.adiz ?? '–', d.plan ?? '–', d.off ?? '–')).join('')}
    ${row('Week total', M.air.total ?? '–', M.adiz.total ?? '–', M.plan.total ?? '–', M.off.total ?? '–', 'sum')}
    ${row('Per day', f1(M.air.perDay), f1(M.adiz.perDay), f1(M.plan.perDay), f1(M.off.perDay), 'sum')}
    ${row('Previous week, per day', f1(M.air.prev.perDay), f1(M.adiz.prev.perDay), f1(M.plan.prev.perDay), f1(M.off.prev.perDay), 'ref')}
    ${row('12-week avg, per day', f1(M.air.base.perDay), f1(M.adiz.base.perDay), f1(M.plan.base.perDay), f1(M.off.base.perDay), 'ref')}
    ${row('12-week range, weekly totals', `${M.air.base.min}–${M.air.base.max}`, `${M.adiz.base.min}–${M.adiz.base.max}`, `${M.plan.base.min}–${M.plan.base.max}`, `${M.off.base.min}–${M.off.base.max}`, 'ref')}</tbody>`;
  $('#basewin').textContent = `${F.baseline.from} to ${F.baseline.to}`;

  const X = F.exercise;
  const ex = X.active.length
    ? X.active.map(x => `<p><b>${esc(x.name)}</b>, ${esc(x.start)} to ${esc(x.end)}. ${x.zones.length ? `${x.zones.length} published closure zones.` : 'No published zone coordinates.'} ${x.sources.slice(0, 3).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">source ${i + 1}</a>`).join(' ')}</p>`).join('')
    : `<p>No declared exercise this week. Most recent in TSM's list: <b>${esc(X.last?.name || 'n/a')}</b>, ${esc(X.last?.start || '')} to ${esc(X.last?.end || '')}.</p>`;
  const inc = C.incidents.length
    ? `<div class="tablewrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Location</th><th scope="col">Recorded</th></tr></thead><tbody>
      ${C.incidents.map(i => `<tr><td class="num">${esc(i.date)}</td><td>${esc(i.loc)}</td><td>${esc(i.desc)}${i.vessels ? ` <span class="muted">(${esc(i.vessels)})</span>` : ''}
        ${(i.cites || []).map(c => ` <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`).join('')}</td></tr>`).join('')}</tbody></table></div>`
    : '<p>No incursions recorded this week.</p>';
  $('#ccg').innerHTML = `<p class="eyebrow">Declared exercises</p>${ex}<p class="eyebrow">CCG incursions (${C.n})</p>${inc}
    <p class="fine">Weekly counts, previous 12 weeks: ${C.weekly.slice(0, -1).map(w => w.n).join(', ')}. Tracker version ${esc(C.tracker.version)}, last row ${esc(C.tracker.last)}.${C.covered ? '' : ' <b>The tracker ends before this week does.</b>'}</p>
    ${F.transits.length ? `<p class="eyebrow">Allied Strait transits</p><p>${F.transits.map(t => `${esc(t.date)}: ${esc(t.name)} (${esc(t.hull)}, ${esc(t.type)}, ${esc(t.country)})`).join('<br>')}</p>` : ''}`;

  const top = new Set(R.top);
  $('#t-rh').innerHTML = `<thead><tr><th scope="col">Measure</th><th scope="col">Week</th><th scope="col">Change</th><th scope="col">z</th><th scope="col">Docs</th></tr></thead><tbody>
    ${R.rows.map(r => `<tr class="${top.has(r.key) ? 'top' : ''}${r.z != null && Math.abs(r.z) >= R.notableZ ? ' out' : ''}"><th scope="row">${esc(r.label)}<small>${esc(r.scope)}</small></th>
      <td class="num">${r.value?.toFixed(3) ?? 'n/a'}</td><td class="num">${r.delta == null ? 'n/a' : (r.delta > 0 ? '+' : '') + r.delta.toFixed(3)}</td>
      <td class="num">${r.z == null ? 'n/a' : (r.z > 0 ? '+' : '') + r.z.toFixed(2)}</td><td class="num">${r.n}</td></tr>`).join('')}</tbody>`;
  $('#quotes').innerHTML = R.quotes.length ? `<p class="eyebrow">Official quotes (≤300 characters)</p>` + R.quotes.map(q => `<blockquote class="q">
    <p>${esc(q.text)}</p><footer>${esc(q.source)}, ${esc(q.date)} · <a href="${esc(q.url)}" target="_blank" rel="noopener">statement</a> · hostility score ${q.hostility.toFixed(2)}</footer></blockquote>`).join('') : '';
}
