// Panel markup for the two modes, plus small list renderers.
import { escapeHtml, fmt } from '../../../shared/js/mapkit.js';
import { CATS, VESSELS } from './live.js';
import { FORCE, AVESSELS } from './archive.js';
import { ZONE_COUNTS } from '../data/zones.js';
import { zoneName, when } from './card.js';

const tg = (id, label, help = '') => `<label class="tg"><input type="checkbox" id="${id}"><span class="sw"></span><span class="t">${label}${help ? `<small>${help}</small>` : ''}</span></label>`;
const slider = (id, label, min, max, step, help = '') => `<div class="slider"><div class="sl-h"><label for="${id}">${label}</label><output id="${id}-out"></output></div>
  <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">${help ? `<small>${help}</small>` : ''}</div>`;

const overlays = `<div class="sec"><p class="eyebrow">Reference lines</p>
  ${tg('ov-adiz', 'Taiwan ADIZ', 'TSM GIS layer')}
  ${tg('ov-median', 'Median line', 'Taiwan MND endpoints, 27°N 122°E to 23°N 118°E')}
  ${tg('ov-zones', 'TSM zones of interest', 'Approximate v0 geometry: centroid buffers and boxes, not legal baselines')}</div>`;

export function livePanel() {
  const n = c => VESSELS.filter(v => v.cat === c).length;
  return `
  <div class="sec" id="card" hidden></div>
  <div class="sec">
    <div class="status" id="now"><b id="now-t"></b><span id="now-s"></span></div>
  </div>
  <div class="sec">
    <p class="eyebrow">Who is on the map</p>
    ${tg('cat-prc', `${CATS.prc.t} <span class="num muted">${fmt(n('prc'))}</span>`, 'Merchant, fishing and other traffic with a Chinese MMSI')}
    ${tg('cat-shared', `${CATS.shared.t} <span class="num muted">${n('shared')}</span>`, '412000000 and 413000000, used by many ships at once')}
    ${tg('cat-cand', `${CATS.cand.t} <span class="num muted">${n('cand')}</span>`, 'Name match only, not on the sourced watchlist. Off by default.')}
    <p class="fine">Watchlist China Coast Guard, PLA Navy and militia vessels heard with a valid, unique MMSI in this window: <b>${n('watch')}</b>. The collector’s own watchlist holds only the shared placeholder 412000000, so force labels here come only from TSM’s sourced watchlist. See “Why so few?” below the map.</p>
  </div>
  <div class="sec">
    <p class="eyebrow">Dark periods</p>
    ${slider('gap-h', 'Count a silence as dark after', 2, 72, 1, 'Ring where a ship went dark, square where it reappeared. The path between is unknown.')}
    ${tg('all-gaps', 'Show every dark period at once', 'Otherwise only silences under way at the slider time')}
    <div id="gap-list" class="list"></div>
  </div>
  <div class="sec">
    <p class="eyebrow">Loitering</p>
    ${slider('lo-kn', 'Speed at or under', 0.5, 4, 0.5)}
    ${slider('lo-km', 'Staying within', 1, 10, 1)}
    ${slider('lo-h', 'For at least', 6, 96, 6)}
    <p class="fine" id="lo-sum"></p>
  </div>
  <div class="sec">
    <p class="eyebrow">Close approaches</p>
    ${tg('ov-coloc', 'Show co-location events', 'Pairs of PRC-flag vessels close together, flagged by TSM’s database')}
    <div id="coloc-list" class="list"></div>
  </div>
  <div class="sec">
    <div class="sec-h"><p class="eyebrow">Zone entries</p><span class="fine">${ZONE_COUNTS.from} to ${ZONE_COUNTS.to}</span></div>
    <p class="fine">Entries by PRC-flag vessels into TSM zones, from the database’s zone episodes, which can end a day earlier than the fixes. Zones are approximate.</p>
    <div id="zone-bars" class="zbars"></div>
  </div>
  ${overlays}`;
}

export function archivePanel() {
  const n = f => Object.values(AVESSELS).filter(v => v.force === f).length;
  return `
  <div class="sec" id="card" hidden></div>
  <div class="sec">
    <div class="status" id="now"><b id="now-t"></b><span id="now-s"></span></div>
    <div class="choices" id="span">${[[1, 'One month'], [3, 'Three months'], [12, 'Twelve months']].map(([k, t]) => `<button type="button" data-span="${k}">${t}</button>`).join('')}</div>
  </div>
  <div class="sec">
    <p class="eyebrow">Watchlist forces</p>
    ${FORCE.map(f => tg('f-' + f.k, `<i class="swatch" style="background:var(${f.color})"></i>${f.t} <span class="num muted">${n(f.k)} vessels</span>`)).join('')}
    <p class="fine">Only MMSIs on TSM’s sourced watchlist, each paired to a hull or name by AMTI, CSIS or a ship registry. No PLA Navy MMSI is on the watchlist yet.</p>
  </div>
  <div class="sec">
    <p class="eyebrow">Selected cell</p>
    <div id="cell-list" class="list"><p class="fine">Click a square on the map to list the vessels behind it.</p></div>
  </div>
  ${overlays}`;
}

export function gapList(gaps, inView, onPick) {
  const vis = gaps.filter(g => inView([g.a.lon, g.a.lat]) || inView([g.b.lon, g.b.lat]));
  const box = document.getElementById('gap-list');
  box.innerHTML = `<p class="fine"><b>${vis.length}</b> dark period${vis.length === 1 ? '' : 's'} touch this view. Longest first:</p>
    <ol>${vis.slice(0, 6).map((g, i) => `<li><button type="button" class="linkish" data-i="${i}">${escapeHtml(g.v.label)}</button>
      <span class="num">${g.h >= 48 ? (g.h / 24).toFixed(1) + ' d' : g.h.toFixed(0) + ' h'}</span><small>${when(g.a.t)} · reappeared ${g.km < 1 ? 'in place' : fmt(g.km) + ' km ' + g.dir}${g.land ? ' (straight line crosses land, not drawn)' : ''}</small></li>`).join('')}</ol>`;
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => onPick(vis[+b.dataset.i]));
}

export function colocList(rows, onPick) {
  const box = document.getElementById('coloc-list');
  const pairs = new Map();
  rows.forEach(r => { const k = [r[1], r[2]].sort().join('–'); const p = pairs.get(k) || { k, n: 0, first: r, types: new Set() }; p.n++; p.types.add(r[3]); pairs.set(k, p); });
  const list = [...pairs.values()].sort((a, b) => b.n - a.n);
  const nm = m => { const v = VESSELS.find(x => x.mmsi === m); return v ? v.label : m; };
  const days = [...new Set(rows.map(r => when(r[0]).slice(0, 5)))];
  const span = days.length ? (days.length === 1 ? `on ${days[0]}` : `from ${days[0]} to ${days[days.length - 1]}`) : '';
  box.innerHTML = `<p class="fine">${rows.length} flagged moments across ${list.length} pairs ${span} (the database has derived close approaches for ${days.length === 1 ? 'that day' : 'those days'} only), all between PRC-flag ships with no force attribution. Most frequent pairs:</p>
    <ol>${list.slice(0, 5).map((p, i) => `<li><button type="button" class="linkish" data-i="${i}">${escapeHtml(nm(p.first[1]))} + ${escapeHtml(nm(p.first[2]))}</button><span class="num">${p.n}×</span><small>${[...p.types].join(', ').replace(/_/g, '-')}</small></li>`).join('')}</ol>`;
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => onPick(list[+b.dataset.i].first));
}

export function zoneBars() {
  const z = Object.entries(ZONE_COUNTS.zones).map(([k, v]) => ({ k, n: Object.values(v.entries).reduce((a, b) => a + b, 0), ves: v.vessels }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(...z.map(x => x.n));
  document.getElementById('zone-bars').innerHTML = z.map(x => `<div class="zb"><span>${zoneName(x.k)}</span>
    <i style="width:${(x.n / max * 100).toFixed(1)}%"></i><b class="num">${fmt(x.n)}</b><small class="num">${x.ves} vessels</small></div>`).join('') + zoneGapNote();
}

/** Days inside the zone-episode range for which the database holds no zone episodes at all (e.g. Sep 23). */
function zoneGapNote() {
  const have = new Set(Object.values(ZONE_COUNTS.zones).flatMap(v => Object.keys(v.entries)));
  const miss = [];
  for (let t = Date.parse(ZONE_COUNTS.from); t <= Date.parse(ZONE_COUNTS.to); t += 864e5) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (!have.has(d)) miss.push(d);
  }
  return miss.length ? `<p class="fine">The database derived no zone episodes for ${miss.join(', ')}, although fixes were received, so the totals leave ${miss.length === 1 ? 'that day' : 'those days'} out.</p>` : '';
}
