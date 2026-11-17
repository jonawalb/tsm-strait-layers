// World choropleth with zoom, BRI outlines, small-state markers and project points. Uses global d3 (v7.9.0).
import { WORLD } from '../data/world.js';
import { COUNTRIES } from '../data/countries.js';
import { POINTS } from '../data/points.js';
import { IMAGERY } from '../data/imagery.js';
import { METRICS, bin, binColor, usd, briStatus, sectorColor, sectorName, escapeHtml } from './fmt.js';

const W = 960, H = 520;
export const VIEWS = {
  world: null,
  sea: [[92, -12], [142, 28]], sas: [[60, 4], [98, 38]], pac: [[138, -26], [205, 8]],
  cas: [[46, 34], [90, 56]], afr: [[-20, -36], [54, 38]], lac: [[-120, -56], [-32, 32]], eur: [[-12, 34], [45, 66]],
};

const rProj = (a) => 2 + 20 * Math.sqrt(Math.min(a || 0, 20000) / 20000);
const rGlobal = (a) => 1 + 6 * Math.sqrt(Math.min(a || 0, 20000) / 20000);

export function createMap({ svg: svgEl, tip, onSelect, onProject, onSat }) {
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  const proj = d3.geoNaturalEarth1().rotate([-30, 0]).fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' });
  const path = d3.geoPath(proj);
  const root = svg.append('g');
  root.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
  root.append('path').attr('class', 'grat').attr('d', path(d3.geoGraticule10()));

  const feats = WORLD.features;
  const name = (iso) => feats.find((f) => f.id === iso)?.properties.name || COUNTRIES[iso]?.nm || iso;
  const gCty = root.append('g');
  const gBri = root.append('g');
  const gSmall = root.append('g');
  const gGlobal = root.append('g');
  const gSel = root.append('g');
  const gPts = root.append('g');
  const gSat = root.append('g');

  const ctys = gCty.selectAll('path').data(feats).join('path')
    .attr('class', 'cty').attr('d', path).attr('data-iso', (d) => d.id);
  const briFeats = feats.filter((f) => COUNTRIES[f.id]?.bri && f.id !== 'CHN');
  gBri.selectAll('path').data(briFeats).join('path')
    .attr('class', (d) => `bri ${briStatus(COUNTRIES[d.id]).k}`).attr('d', path);
  const smallFeats = feats.filter((f) => f.properties.small && (COUNTRIES[f.id]?.ad || COUNTRIES[f.id]?.aei || COUNTRIES[f.id]?.bri));
  const smalls = gSmall.selectAll('circle').data(smallFeats).join('circle')
    .attr('class', (d) => `smalldot${COUNTRIES[d.id]?.bri ? ' bri-m' : ''}`)
    .attr('cx', (d) => proj([d.properties.lx, d.properties.ly])[0])
    .attr('cy', (d) => proj([d.properties.lx, d.properties.ly])[1]);

  let metric = 'ad', briOnly = false, k = 1, selected = null, projData = [];

  function fillFor(iso) {
    if (iso === 'CHN') return 'var(--rcn)';
    return binColor(bin(METRICS[metric].value(COUNTRIES[iso])));
  }
  function paint() {
    ctys.attr('fill', (d) => fillFor(d.id))
      .classed('nd', (d) => d.id !== 'CHN' && bin(METRICS[metric].value(COUNTRIES[d.id])) < 0)
      .classed('dim', (d) => briOnly && d.id !== 'CHN' && briStatus(COUNTRIES[d.id]).k === 'none');
    smalls.attr('fill', (d) => fillFor(d.id))
      .classed('dim', (d) => briOnly && briStatus(COUNTRIES[d.id]).k === 'none');
  }

  // Tooltip
  const box = svgEl.parentElement;
  function showTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    const r = box.getBoundingClientRect();
    let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width - 6) x = ev.clientX - r.left - tip.offsetWidth - 14;
    if (y + tip.offsetHeight > r.height - 6) y = ev.clientY - r.top - tip.offsetHeight - 14;
    tip.style.left = `${Math.max(4, x)}px`; tip.style.top = `${Math.max(4, y)}px`;
  }
  const hideTip = () => { tip.hidden = true; };
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  function ctyTip(iso) {
    const c = COUNTRIES[iso];
    if (iso === 'CHN') return `<b>China</b><small>Source of all flows shown</small>`;
    const v = METRICS[metric].value(c);
    const other = metric === 'ad' ? 'aei' : 'ad';
    const ov = METRICS[other].value(c);
    return `<b>${escapeHtml(name(iso))}</b>`
      + `<span class="tt-d">${METRICS[metric].label}: ${v != null ? usd(v) : 'none recorded'}</span>`
      + `<span class="tt-d">${METRICS[other].label}: ${ov != null ? usd(ov) : 'none recorded'}</span>`
      + `<small>${briStatus(c).text}</small>`;
  }
  for (const sel of [ctys, smalls]) {
    sel.on('pointermove', (ev, d) => { ctys.classed('hover', (x) => x.id === d.id); showTip(ev, ctyTip(d.id)); })
      .on('pointerleave', () => { ctys.classed('hover', false); hideTip(); })
      .on('click', (ev, d) => { if (!dragged) onSelect(d.id); });
  }

  // Zoom
  let dragged = false, curT = d3.zoomIdentity;
  const zoom = d3.zoom().scaleExtent([1, 40]).translateExtent([[0, 0], [W, H]])
    .filter((ev) => (ev.type === 'wheel' ? true : !ev.button))
    .on('start', () => { dragged = false; })
    .on('zoom', (ev) => {
      if (ev.sourceEvent?.type === 'mousemove' || ev.sourceEvent?.type === 'pointermove') { dragged = true; svgEl.classList.add('panning'); }
      root.attr('transform', ev.transform);
      curT = ev.transform; drawLine();
      if (ev.transform.k !== k) { k = ev.transform.k; rescale(); }
    })
    .on('end', () => { svgEl.classList.remove('panning'); setTimeout(() => { dragged = false; }, 0); });
  svg.call(zoom).on('dblclick.zoom', null);

  function rescale() {
    smalls.attr('r', 3.6 / Math.sqrt(k));
    gPts.selectAll('circle').attr('r', (d) => rProj(d.a) / Math.sqrt(k));
    gGlobal.selectAll('circle').attr('r', (d) => rGlobal(d[4]) / Math.sqrt(k));
    satMarks.attr('transform', (d) => { const [x, y] = proj(d.c); return `translate(${x},${y}) scale(${1 / k})`; });
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function zoomToBox([[x0, y0], [x1, y1]], maxK = 12) {
    const s = Math.max(1, Math.min(maxK, 0.88 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
    const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(s).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    (reduce ? svg : svg.transition().duration(650)).call(zoom.transform, t);
  }
  function zoomToView(v) {
    const b = VIEWS[v];
    if (!b) { (reduce ? svg : svg.transition().duration(650)).call(zoom.transform, d3.zoomIdentity); return; }
    const pts = [];
    for (let lon = b[0][0]; lon <= b[1][0]; lon += 2) for (const lat of [b[0][1], (b[0][1] + b[1][1]) / 2, b[1][1]]) pts.push(proj([lon, lat]));
    zoomToBox([[d3.min(pts, (p) => p[0]), d3.min(pts, (p) => p[1])], [d3.max(pts, (p) => p[0]), d3.max(pts, (p) => p[1])]]);
  }
  function zoomToCountry(iso) {
    const f = feats.find((x) => x.id === iso);
    if (!f) return;
    let b = path.bounds(f);
    if (b[1][0] - b[0][0] > W * 0.55 || f.properties.small) {
      const [x, y] = proj([f.properties.lx, f.properties.ly]);
      const r = f.properties.small ? 40 : 160;
      b = [[x - r, y - r * 0.55], [x + r, y + r * 0.55]];
    }
    zoomToBox(b, 9);
  }

  function select(iso, { zoomTo = true } = {}) {
    selected = iso;
    gSel.selectAll('path').data(iso ? feats.filter((f) => f.id === iso) : []).join('path').attr('class', 'cty-sel').attr('d', path);
    if (iso && zoomTo) zoomToCountry(iso);
  }

  function showProjects(list) {
    projData = (list || []).filter((p) => p.ll && p.a > 0).sort((a, b) => b.a - a.a);
    gPts.selectAll('circle').data(projData, (d) => d.id).join('circle')
      .attr('class', 'pt').attr('data-id', (d) => d.id)
      .attr('cx', (d) => proj(d.ll)[0]).attr('cy', (d) => proj(d.ll)[1])
      .attr('r', (d) => rProj(d.a) / Math.sqrt(k))
      .attr('fill', (d) => sectorColor(d.s)).attr('stroke', (d) => sectorColor(d.s))
      .on('pointermove', (ev, d) => showTip(ev, `<b>${escapeHtml(d.ti)}</b><span class="tt-d">${usd(d.a)} · ${d.y ?? 'year n/a'} · ${escapeHtml(sectorName(d.s))}</span><small>${escapeHtml(d.st || '')}${d.pr && d.pr !== 'precise' ? ' · located to ' + escapeHtml(d.pr) : ''}</small>`))
      .on('pointerleave', hideTip)
      .on('click', (ev, d) => { ev.stopPropagation(); onProject(d.id); });
  }
  function highlightProject(id) {
    gPts.selectAll('circle').classed('sel', (d) => d.id === id);
    const d = projData.find((p) => p.id === id);
    if (d) { const [x, y] = proj(d.ll); zoomToBox([[x - 30, y - 18], [x + 30, y + 18]], Math.max(k, 8)); }
  }
  function showAll(on) {
    const data = on ? POINTS.filter((p) => p[4] > 0) : [];
    gGlobal.selectAll('circle').data(data).join('circle').attr('class', 'gpt')
      .attr('cx', (d) => proj([d[2], d[3]])[0]).attr('cy', (d) => proj([d[2], d[3]])[1])
      .attr('r', (d) => rGlobal(d[4]) / Math.sqrt(k)).attr('fill', (d) => sectorColor(d[5]));
  }

  // Satellite views: a marker per imaged site; the card opens on the map with a leader line to the site.
  const sats = Object.values(IMAGERY).map((m) => ({ ...m, c: [(m.bbox[0] + m.bbox[2]) / 2, (m.bbox[1] + m.bbox[3]) / 2] }));
  const satMarks = gSat.selectAll('g').data(sats).join('g').attr('class', 'satm').attr('data-sat', (d) => d.id);
  satMarks.append('rect').attr('x', -6).attr('y', -6).attr('width', 12).attr('height', 12).attr('transform', 'rotate(45)');
  satMarks.on('pointermove', (ev, d) => showTip(ev, `<b>${escapeHtml(d.site || 'Project site')}</b><span class="tt-d">${escapeHtml(name(d.iso))}</span><small>Satellite view, before and after: click to open</small>`))
    .on('pointerleave', hideTip)
    .on('click', (ev, d) => { ev.stopPropagation(); hideTip(); onSat(d.id); });

  const card = document.createElement('div');
  card.className = 'satcard'; card.hidden = true;
  card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'Satellite view');
  box.appendChild(card);
  const lineSvg = d3.select(box).append('svg').attr('class', 'satline').attr('aria-hidden', 'true');
  const ln = lineSvg.append('line');
  const lnDot = lineSvg.append('circle').attr('r', 5);
  let openSatId = null, openC = null;
  const narrow = () => matchMedia('(max-width: 760px)').matches;

  function drawLine() {
    if (!openSatId) { lineSvg.style('display', 'none'); return; }
    const d = { c: openC };
    const sr = svgEl.getBoundingClientRect(), br = box.getBoundingClientRect(), cr = card.getBoundingClientRect();
    const sc = sr.width / W, p = curT.apply(proj(d.c));
    const px = sr.left - br.left + p[0] * sc, py = sr.top - br.top + p[1] * sc;
    const visible = px >= sr.left - br.left && px <= sr.right - br.left && py >= sr.top - br.top && py <= sr.bottom - br.top;
    lineSvg.style('display', visible ? null : 'none').attr('width', br.width).attr('height', br.height);
    const x0 = cr.left - br.left, y0 = cr.top - br.top;
    const ax = Math.max(x0, Math.min(px, x0 + cr.width)), ay = Math.max(y0, Math.min(py, y0 + cr.height));
    ln.attr('x1', ax).attr('y1', ay).attr('x2', px).attr('y2', py);
    lnDot.attr('cx', px).attr('cy', py);
  }
  addEventListener('resize', drawLine);

  function closeSat() {
    openSatId = null; openC = null; card.hidden = true; card.innerHTML = ''; svgEl.classList.remove('sat-open');
    satMarks.classed('on', false); drawLine();
  }
  function openSat(id) {
    const d = sats.find((s) => String(s.id) === String(id));
    if (!d) return;
    openSatId = d.id; openC = d.c; svgEl.classList.add('sat-open');
    satMarks.classed('on', (s) => s.id === d.id).filter((s) => s.id === d.id).raise();
    const e = escapeHtml;
    card.innerHTML = `<div class="sc-h"><div><b>${e(d.site || 'Project site')}</b><span class="meta">${e(name(d.iso))}</span></div>`
      + `<button type="button" class="sc-x" aria-label="Close satellite view">×</button></div>`
      + `<div class="swipe" style="--v:50%"><img src="img/${d.id}_before.jpg" alt="${e(`Before: ${d.before.sensor} image, ${d.before.date}`)}">`
      + `<img class="aft" src="img/${d.id}_after.jpg" alt="${e(`After: ${d.after.sensor} image, ${d.after.date}`)}"><i class="bar"></i>`
      + `<span class="lab l">Before · ${e(d.before.date.slice(0, 4))}</span><span class="lab r">After · ${e(d.after.date.slice(0, 4))}</span></div>`
      + `<input type="range" min="0" max="100" value="50" aria-label="Slide between the before and after images">`
      + `<p class="sc-n">${e(d.note || '')}</p>`
      + `<p class="sc-f">Before ${e(d.before.date)}, ${e(d.before.sensor)}. After ${e(d.after.date)}, ${e(d.after.sensor)}. ${e(d.credit)}</p>`;
    card.hidden = false;
    card.classList.toggle('left', false);
    const sw = card.querySelector('.swipe');
    card.querySelector('input').addEventListener('input', (ev) => sw.style.setProperty('--v', `${ev.target.value}%`));
    card.querySelector('.sc-x').addEventListener('click', () => { closeSat(); onSat(null); });
    card.querySelectorAll('img').forEach((im) => im.addEventListener('load', drawLine));
    flyTo(d.c);
    return card.querySelector('.sc-x');
  }
  // put the site left of centre so the card (top right) does not cover it; on phones the card sits under the map
  function flyTo(c, minK = 26) {
    const [x, y] = proj(c), s = Math.max(k, minK);
    const t = d3.zoomIdentity.translate(narrow() ? W / 2 : W * 0.3, H / 2).scale(s).translate(-x, -y);
    (reduce ? svg : svg.transition().duration(650)).call(zoom.transform, t);
    drawLine();
  }

  // Automatic view for any mapped project: EOxCloudless yearly Sentinel-2 mosaics (Web Mercator tiles) centred on
  // the project's mapped point. Not reviewed by hand, and labelled as such.
  const EOX = (yr) => `https://tiles.maps.eox.at/wmts/1.0.0/${yr === 2016 ? 's2cloudless_3857' : `s2cloudless-${yr}_3857`}/default/g`;
  const EOX_AFTER = 2025;
  function mosaic(yr, lon, lat, z) {
    const n = 2 ** z, la = (lat * Math.PI) / 180;
    const fx = ((lon + 180) / 360) * n, fy = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n;
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const ox = (fx - (tx - 1)) * 256, oy = (fy - (ty - 1)) * 256;   // point inside the 3x3 block, in px
    let imgs = '';
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const x = (((tx + i) % n) + n) % n, y = ty + j;
      if (y < 0 || y >= n) continue;
      imgs += `<img src="${EOX(yr)}/${z}/${y}/${x}.jpg" alt="" style="left:${(i + 1) * 256}px;top:${(j + 1) * 256}px">`;
    }
    return `<div class="tiles" style="left:calc(50% - ${ox.toFixed(1)}px);top:calc(50% - ${oy.toFixed(1)}px)">${imgs}</div>`;
  }
  function openLive(p, iso) {
    if (!p?.ll) return;
    openSatId = p.id; openC = p.ll; svgEl.classList.add('sat-open');
    satMarks.classed('on', false);
    const e = escapeHtml, precise = !p.pr || p.pr === 'precise';
    const before = Math.min(EOX_AFTER - 1, Math.max(2016, (p.y || 2016) - 1));
    let z = precise ? 15 : 12;
    const render = () => {
      const v = card.querySelector('input')?.value ?? 50;
      card.innerHTML = `<div class="sc-h"><div><b>${e(p.ti)}</b><span class="meta">${e(name(iso))} · ${e(String(p.y ?? 'year n/a'))} · ${usd(p.a)}</span></div>`
        + `<button type="button" class="sc-x" aria-label="Close satellite view">×</button></div>`
        + `<div class="swipe live" style="--v:${v}%" role="img" aria-label="${e(`Sentinel-2 yearly mosaics of the mapped point, ${before} and ${EOX_AFTER}`)}">`
        + `<div class="lyr">${mosaic(before, p.ll[0], p.ll[1], z)}</div><div class="lyr aft">${mosaic(EOX_AFTER, p.ll[0], p.ll[1], z)}</div>`
        + `<i class="bar"></i>${precise ? '<i class="xh"></i>' : ''}<span class="lab l">${before}</span><span class="lab r">${EOX_AFTER}</span>`
        + `<span class="zb"><button type="button" data-z="1" aria-label="Zoom imagery in">+</button><button type="button" data-z="-1" aria-label="Zoom imagery out">−</button></span></div>`
        + `<input type="range" min="0" max="100" value="${v}" aria-label="Slide between the earlier and later images">`
        + `<p class="sc-n"><b>Automatic view, not checked by hand.</b> ${precise ? 'The ring marks the project\'s mapped location; the project itself may be small, hidden or not yet built.' : `AidData locates this project only to ${e(p.pr || 'an area')}, so the image shows the general area, not the site.`}${(p.y || 0) <= 2016 ? ` Agreed in ${e(String(p.y ?? 'an unknown year'))}; 2016 is the earliest mosaic, so work may already show.` : ''}</p>`
        + `<p class="sc-f">Yearly cloud-free Sentinel-2 mosaics: <a href="https://cloudless.eox.at" rel="noopener" target="_blank">EOxCloudless</a> by EOX IT Services GmbH, contains modified Copernicus Sentinel data ${before} and ${EOX_AFTER}; ${before === 2016 ? 'the 2016 layer is CC BY 4.0, ' : ''}later layers CC BY-NC-SA 4.0. Location: AidData GeoGCDF v3.0.1.</p>`;
      const sw = card.querySelector('.swipe');
      card.querySelector('input').addEventListener('input', (ev) => sw.style.setProperty('--v', `${ev.target.value}%`));
      card.querySelector('.sc-x').addEventListener('click', () => { closeSat(); onSat(null); });
      card.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => { z = Math.max(9, Math.min(16, z + +b.dataset.z)); render(); }));
    };
    card.innerHTML = '';
    render();
    card.hidden = false;
    flyTo(p.ll, precise ? 26 : 12);
  }
  addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && openSatId) { closeSat(); onSat(null); } });

  paint(); rescale();
  return {
    openSat, openLive, closeSat,
    get openSatId() { return openSatId; },
    setMetric(m) { metric = m; paint(); },
    setBriOnly(on) { briOnly = on; paint(); },
    select, showProjects, highlightProject, showAll, zoomToView,
    zoomBy(f) { svg.transition().duration(reduce ? 0 : 250).call(zoom.scaleBy, f); },
    name,
    get selected() { return selected; },
  };
}
