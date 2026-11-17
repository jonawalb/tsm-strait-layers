// Side panel: everything recorded for the selected day, each item linked to its source.
import { escapeHtml as E } from '../../../shared/js/mapkit.js';
import { METRICS, LAYERS, LANES, W, RHETORIC, TIMELINE, ZONES, ANOM, AIS, aisOn, docsOn, mondayOf, nice, weekday,
  addDays, grayMonth, transitUrl } from './data.js';

const MND = id => `https://www.mnd.gov.tw/en/News/PLAAct/${id}`;
const fmtZ = z => (z == null ? 'n/a' : (z >= 0 ? '+' : '−') + Math.abs(z).toFixed(1));
const link = (url, text) => url ? `<a href="${E(url)}" target="_blank" rel="noopener">${E(text)}</a>` : E(text);
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
const SECTOR_NAMES = Object.fromEntries(Object.entries(LAYERS.sectorInfo).map(([k, v]) => [k, v.name]));

export function dayHtml(day) {
  const d = day.d;
  const flags = [];
  if (day.flag.includes('J')) flags.push(link(day.flagUrls?.J, 'Joint combat readiness patrol (MND release)'));
  if (day.flag.includes('L')) flags.push(link(day.flagUrls?.L, 'Long-range flight training (MND release)'));
  const sec = Object.keys(SECTOR_NAMES).filter(s => day.mask & (1 << ['N', 'C', 'SW', 'SE', 'E', 'NE'].indexOf(s))).map(s => SECTOR_NAMES[s]);
  const reports = day.mnd.length ? day.mnd.map(id => link(MND(id), `MND report ${id}`)).join(', ') : '<span class="muted">no MND report text on file for this window</span>';
  return `<h3 class="dhead">${weekday(d)} ${nice(d)}</h3>
    <p class="fine">Taiwan MND window 06:00 ${nice(d, false)} to 06:00 ${nice(addDays(d, 1), false)}.</p>
    <dl class="readout">${METRICS.map(m => `<dt>${m.short}</dt><dd>${day.v[m.key] ?? '<span class="muted">no data</span>'}</dd>`).join('')}
      <dt>Sectors</dt><dd>${sec.length ? E(sec.join(', ')) + (day.rare ? ' + ' + E(day.rare) : '') : '<span class="muted">none named</span>'}</dd></dl>
    ${flags.length ? `<p class="flagline">${flags.join('<br>')}</p>` : ''}
    <p class="fine">Sources: ${reports}.</p>`;
}

export function anomalyHtml(day) {
  const rows = METRICS.map(m => {
    const z = day.z[m.key], b = day.base[m.key], hit = z != null && z >= ANOM.thr;
    return `<tr class="${hit ? 'hit' : ''}"><td>${m.short}</td><td class="num">${day.v[m.key] ?? '–'}</td><td class="num">${b ? b.med : '–'}</td>
      <td class="num">${fmtZ(z)}</td><td>${hit ? '<span class="status" data-s="bad">above</span>' : ''}</td></tr>`;
  }).join('');
  return `<div class="tablewrap"><table class="anom"><thead><tr><th>Series</th><th class="num">Day</th><th class="num">Median</th><th class="num">z</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function eventsHtml(day, ex) {
  const d = day.d, out = [];
  if (ex) {
    const x = ex.x, st = ex.state === 'on' ? `day ${ex.k + 1} of ${Math.round((Date.parse(x.end) - Date.parse(x.start)) / 864e5) + 1}` : 'zones announced, not yet in force';
    const said = (TIMELINE[x.id] || []).filter(t => t.date === d);
    const Z = ZONES[x.id];
    out.push(`<article class="ev ex"><p class="evh"><span class="dot prc"></span><b>${E(x.short)}</b> <span class="muted">${E(st)}</span></p>
      <p class="fine">${E(x.trigger || '')}</p>
      ${said.map(t => `<p class="said"><b>${E(t.who)}</b> ${E(t.text)} ${link(t.url, t.label)}</p>`).join('')}
      <p class="fine">${Z ? `Zones: ${E(Z.note.slice(0, 220))}${Z.note.length > 220 ? '…' : ''} ${Z.sources.map(s => link(s.url, s.label)).join(' · ')}` : 'No officially published zone coordinates, so no zone is drawn.'}</p>
      <p class="fine">Event sources: ${x.sources.slice(0, 4).map(u => link(u, host(u))).join(' · ')}</p></article>`);
  }
  day.ccg.forEach(c => out.push(`<article class="ev"><p class="evh"><span class="dot ccg"></span><b>China Coast Guard, ${E(c.loc)}</b></p>
    <p class="fine">${E(c.desc)}${c.timeline ? '. ' + E(c.timeline) : ''}${c.vessels ? ` Hulls: ${E(c.vessels)}.` : ''}</p>
    ${c.flags.length ? `<p class="fine warnline">Data note: ${E(c.flags.join('; '))}</p>` : ''}
    <p class="fine">${c.cites.length ? c.cites.map(x => link(x.url, x.label)).join(' · ') : 'Source: TSM CCG incident tracker (compiled from CGA releases).'}</p></article>`));
  day.transits.forEach(t => out.push(`<article class="ev"><p class="evh"><span class="dot us"></span><b>Strait transit: ${E(t.name)}</b></p>
    <p class="fine">${E([t.country, t.type, t.cls, t.hull].filter(Boolean).join(' · '))}. ${transitUrl(t) ? link(transitUrl(t), 'Source') : 'Source: TSM transit tracker.'} The route drawn is schematic; direction and track are not recorded.</p></article>`));
  day.cables.forEach(c => out.push(`<article class="ev"><p class="evh"><span class="dot cable"></span><b>${E(c.title)}</b>${c.monthOnly ? ' <span class="pill">month only</span>' : ''}</p>
    <p class="fine">${E(c.summary.slice(0, 260))}${c.summary.length > 260 ? '…' : ''}</p>
    <p class="fine">${c.at ? `Marker: ${E(c.area)} (area, not the fault position). ` : 'Not on this map. '}${(c.sources || []).map(s => link(s.url, s.label || host(s.url))).join(' · ')}</p></article>`));
  if (aisOn(d)) {
    const z = AIS.zones.filter(q => q.entries[d]).sort((a, b) => b.entries[d] - a.entries[d]);
    out.push(`<article class="ev"><p class="evh"><span class="dot ais"></span><b>AIS zone entries</b> <span class="muted">PRC-flag and watchlist MMSIs</span></p>
      <p class="fine">${z.length ? z.map(q => `${E(q.name.replace(/ \(approx\.\)/, ''))}: ${q.entries[d]}`).join('; ') : 'No entries recorded this day.'} Zones are approximate; most PRC-flag AIS traffic is civilian.</p></article>`);
  }
  const mi = grayMonth(d);
  if (mi >= 0) {
    const tot = [0, 0];
    LAYERS.gray.grid.forEach(c => { if (c[0] === mi) tot[c[3]] += c[4]; });
    out.push(`<p class="fine">Gray-zone month ${E(LAYERS.gray.months[mi])}: ${tot[0]} coast guard and ${tot[1]} maritime-militia vessel-days on this map (watchlist vessels, Global Fishing Watch events).</p>`);
  }
  return out.join('') || '<p class="fine muted">No exercise, coast guard incident, transit or cable event recorded for this day.</p>';
}

export function rhetoricHtml(day, metric) {
  const wk = mondayOf(day.d);
  const rows = LANES.map(l => {
    const r = l.byWeek.get(wk);
    if (!r) return `<tr><td>${E(l.label)}</td><td colspan="3" class="muted">no records this week</td></tr>`;
    const v = r[W[metric.key]], z = r[W[metric.z]];
    return `<tr><td title="${E(l.desc)}">${E(l.label)}</td><td class="num">${r[2]}/${r[1]}</td><td class="num">${v == null ? '–' : metric.key === 'sal' ? Math.round(v * 100) + '%' : v.toFixed(2)}</td>
      <td class="num ${z != null && Math.abs(z) >= 3 ? 'zhit' : ''}">${fmtZ(z)}</td></tr>`;
  }).join('');
  const docs = docsOn(day.d);
  const lanesBy = Object.fromEntries(LANES.map(l => [l.key, l.label]));
  const list = docs ? Object.entries(docs.docs).map(([k, items]) => `<li><b>${E(lanesBy[k])}</b> <span class="muted">${docs.n[k]} record${docs.n[k] === 1 ? '' : 's'}</span>
      ${items.map(([t, u, s]) => `<div class="doc">${link(u, t || host(u))}${s ? `<q>${E(s)}</q>` : ''}</div>`).join('')}</li>`).join('') : '';
  const al = RHETORIC.alerts.filter(a => (a.start.length === 7 ? day.d.slice(0, 7) >= a.start && day.d.slice(0, 7) <= a.end : wk >= a.start && wk <= a.end));
  return `<div class="tablewrap"><table class="rh"><thead><tr><th>Week of ${nice(wk, false)}</th><th class="num">Taiwan</th><th class="num">${E(metric.key === 'sal' ? 'Share' : 'Mean')}</th><th class="num">z</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="fine">Taiwan: records that mention Taiwan / all records that week. ${E(metric.key === 'sal' ? 'Share' : 'Mean')}: ${E(metric.unit)}. z: this week against the stream's previous 12 weeks.</p>
    ${al.map(a => `<div class="alert"><b>Corpus alert:</b> ${E(a.kind)} of Taiwan in ${E(a.stream.split('|')[0])} (${E(a.stream.split('|')[1])}) ${a.dir === 'up' ? 'rose' : 'fell'} to ${a.mean} against a baseline of ${a.base}, z ${fmtZ(a.z)} (${E(a.tier)}).
      ${a.evidence.slice(0, 2).map(e => `<div class="doc">${link(e.url, e.title || host(e.url))}${e.text ? `<q>${E(e.text)}</q>` : ''}</div>`).join('')}</div>`).join('')}
    ${list ? `<p class="eyebrow sm">Records that mention Taiwan on ${nice(day.d, false)}</p><ul class="docs">${list}</ul>` : `<p class="fine muted">No MFA, MND, TAO or state-media record in the corpus mentions Taiwan on this date.</p>`}`;
}

