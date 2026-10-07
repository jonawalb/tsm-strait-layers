// Vessel cards: live-window vessel (with a speed/silence timeline) and archive watchlist vessel.
import { el, escapeHtml, fmt } from '../../../shared/js/mapkit.js';
import { CATS, T0, T_END } from './live.js';
import { LIVE } from '../data/live.js';

const ZN = {
  taiwan_12nm: 'Taiwan 12 nm', taiwan_24nm: 'Taiwan 24 nm', median_line_5nm: 'Median line ±5 nm', taiwan_strait_box: 'Taiwan Strait box',
  east_of_taiwan_box: 'East of Taiwan box', kinmen_restricted: 'Kinmen restricted', matsu_restricted: 'Matsu restricted',
  wuqiu_restricted: 'Wuqiu restricted', dongyin_restricted: 'Dongyin restricted', penghu_24nm: 'Penghu 24 nm',
  pratas_24nm: 'Pratas 24 nm', pratas_12nm: 'Pratas 12 nm', bashi_channel_box: 'Bashi Channel box', senkaku_24nm: 'Senkaku 24 nm',
  senkaku_12nm: 'Senkaku 12 nm', miyako_strait_box: 'Miyako Strait box', scarborough_12nm: 'Scarborough 12 nm',
};
export const zoneName = z => ZN[z] || z.replace(/_/g, ' ');
export const when = t => new Date(T0 + t * 60000).toISOString().replace('T', ' ').slice(5, 16) + ' UTC';
const hrs = h => (h >= 48 ? (h / 24).toFixed(1) + ' days' : h.toFixed(1) + ' h');

function sourceBlock(s) {
  if (!s) return '';
  const conf = { A: 'A: official document or photo-verified pairing', B: 'B: two independent OSINT sources', C: 'C: single source or pattern inference' }[s.conf] || s.conf;
  return `<dl class="readout">
    <dt>Watchlist force</dt><dd>${escapeHtml(s.force)}</dd>
    ${s.hull ? `<dt>Hull</dt><dd>${escapeHtml(s.hull)}</dd>` : ''}
    ${s.cls ? `<dt>Class</dt><dd>${escapeHtml(s.cls)}</dd>` : ''}
    <dt>Confidence</dt><dd>${escapeHtml(conf)}</dd></dl>
    ${s.note ? `<p class="fine">Watchlist note: ${escapeHtml(s.note)}</p>` : ''}
    <p class="fine">Source for the MMSI pairing: ${s.src ? `<a href="${escapeHtml(s.src)}" target="_blank" rel="noopener">${escapeHtml(s.src.replace(/^https?:\/\//, '').slice(0, 60))}</a>` : 'none listed'}${s.srcGeneric ? ' (a generic link, not a record for this ship)' : ''}.</p>`;
}

export function liveCard(v, S, gaps, loiter) {
  const f = v.f;
  const my = gaps.filter(g => g.v === v), ml = loiter.filter(l => l.v === v);
  const longest = my.length ? Math.max(...my.map(g => g.h)) : 0;
  const partners = new Map();
  LIVE.coloc.forEach(c => { const o = c[1] === v.mmsi ? c[2] : c[2] === v.mmsi ? c[1] : null; if (o) partners.set(o, (partners.get(o) || 0) + 1); });
  const cat = CATS[v.cat];
  const warn = v.cat === 'shared'
    ? `<p class="flag">MMSI ${v.mmsi} is a placeholder: the country code followed by zeros. Many ships broadcast placeholders like this at the same time; <a href="https://www.sealight.live/posts/gray-zone-tactics-playbook-spoofing" target="_blank" rel="noopener">SeaLight documented</a> a China Coast Guard cutter using 412000000 in April 2023. Positions under this number can come from several ships, so the track is broken wherever the position jumps (${v.jumps.size} jump${v.jumps.size === 1 ? '' : 's'} here).</p>`
    : v.cat === 'cand' ? `<p class="flag">The broadcast name matches a coast guard pattern, but this MMSI is not on TSM’s sourced watchlist. Unreviewed: it may be a civilian ship with a similar name.</p>`
      : v.cat === 'prc' ? `<p class="fine">A PRC-flag MMSI (country code 412–414). Most such traffic is merchant and fishing vessels; TSM makes no claim about who operates it.</p>` : '';
  return `
    <div class="card-h"><div><p class="eyebrow">Vessel</p><h3 class="vname">${escapeHtml(v.label)}</h3></div>
      <button type="button" class="btn x-card" aria-label="Close vessel card">Close</button></div>
    <p><span class="pill" style="color:var(${cat.color})">${cat.t}</span></p>
    ${warn}
    ${v.seed && v.cat !== 'shared' ? sourceBlock(v.seed) : v.seed ? `<details class="rule"><summary>Watchlist entry</summary>${sourceBlock(v.seed)}</details>` : ''}
    <dl class="readout">
      <dt>MMSI</dt><dd>${v.mmsi}</dd>
      <dt>Fixes shown</dt><dd>${fmt(f.length)} (≤1 per ${LIVE.thinMin} min)</dd>
      <dt>First heard</dt><dd>${when(f[0].t)}</dd>
      <dt>Last heard</dt><dd>${when(f[f.length - 1].t)}</dd>
      <dt>Silences ≥${S.gapH} h</dt><dd>${my.length}${my.length ? `, longest ${hrs(longest)}` : ''}</dd>
      <dt>Loitering</dt><dd>${ml.length} episode${ml.length === 1 ? '' : 's'}</dd>
      <dt>Zones (approx.)</dt><dd>${v.zones.length ? v.zones.map(zoneName).join(', ') : 'none'}</dd>
      ${partners.size ? `<dt>Close to</dt><dd>${[...partners].map(([m, n]) => `<button type="button" class="linkish" data-mmsi="${m}">${m}</button> (${n})`).join(', ')}</dd>` : ''}
    </dl>
    <p class="eyebrow sm">Speed and silences across the window · click to jump</p>
    <svg class="vtl" id="vtl" role="img" aria-label="Speed over time for this vessel, with silences shaded"></svg>`;
}

export function drawVesselTimeline(svg, v, S, gaps, loiter, onPick) {
  const W = Math.max(280, Math.round(svg.clientWidth || 320)), H = 84, L = 26, R = 6, T = 6, B = 16;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  const X = t => L + t / T_END * (W - L - R);
  const smax = Math.max(12, ...v.f.map(p => p.sog ?? 0));
  const Y = s => T + (H - T - B) * (1 - s / smax);
  gaps.filter(g => g.v === v).forEach(g => el('rect', { x: X(g.a.t), y: T, width: Math.max(1.5, X(g.b.t) - X(g.a.t)), height: H - T - B, class: 'vtl-gap' }, svg));
  loiter.filter(l => l.v === v).forEach(l => el('rect', { x: X(l.t0), y: H - B - 4, width: Math.max(1.5, X(l.t1) - X(l.t0)), height: 4, class: 'vtl-loiter' }, svg));
  let d = '', prev = null;
  v.f.forEach((p, i) => {
    if (p.sog == null) return;
    const brk = prev == null || (p.t - prev.t) / 60 >= S.gapH || v.jumps.has(i);
    d += (brk ? 'M' : 'L') + X(p.t).toFixed(1) + ' ' + Y(p.sog).toFixed(1); prev = p;
  });
  el('path', { d, class: 'vtl-line' }, svg);
  for (let day = 0; day * 1440 <= T_END; day++) {
    const tt = day * 1440 - (new Date(T0).getUTCHours() * 60 + new Date(T0).getUTCMinutes());
    if (tt < 0) continue;
    el('text', { x: X(tt), y: H - 3, class: 'axis-t', 'text-anchor': 'middle' }, svg, new Date(T0 + tt * 60000).getUTCDate());
  }
  el('text', { x: L - 4, y: Y(smax) + 8, class: 'axis-t', 'text-anchor': 'end' }, svg, Math.round(smax));
  el('text', { x: L - 4, y: Y(0), class: 'axis-t', 'text-anchor': 'end' }, svg, '0 kn');
  el('line', { x1: X(S.t), x2: X(S.t), y1: T, y2: H - B, class: 'vtl-now' }, svg);
  svg.onclick = e => { const r = svg.getBoundingClientRect(); const t = Math.round(((e.clientX - r.left) / r.width * W - L) / (W - L - R) * T_END); onPick(Math.max(0, Math.min(T_END, t))); };
}

export function archiveCard(v) {
  const ev = v.events || {};
  const names = { loitering: 'Loitering', port_visit: 'Port visits', fishing: 'Fishing', encounter: 'Encounters', gap: 'AIS gaps' };
  return `
    <div class="card-h"><div><p class="eyebrow">Watchlist vessel</p><h3 class="vname">${escapeHtml(v.name || 'MMSI ' + v.mmsi)}</h3></div>
      <button type="button" class="btn x-card" aria-label="Close vessel card">Close</button></div>
    <dl class="readout"><dt>MMSI</dt><dd>${v.mmsi}</dd></dl>
    ${sourceBlock(v)}
    <p class="eyebrow sm">Global Fishing Watch events on record</p>
    <dl class="readout">${Object.entries(ev).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<dt>${names[k] || k}</dt><dd>${fmt(n)}</dd>`).join('') || '<dt>Events</dt><dd>none</dd>'}
      ${v.span ? `<dt>First–last</dt><dd>${v.span[0]} – ${v.span[1]}</dd>` : ''}</dl>`;
}
