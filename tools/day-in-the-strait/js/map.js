// Map for one day: the ADIZ shaded by entries, approximate CCG areas, and a schematic Strait transit.
import { createProjection, drawBasemap, el } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { ADIZ } from '../../../shared/data/adiz.js';
import { LOC_LABEL } from './day.js';

// Approximate reference points per tracker location category (island or sea-area centers, not positions).
const ANCHOR = {
  Kinmen: [118.37, 24.36], Dongsha: [116.72, 20.7], Penghu: [119.2, 23.45],
  'East of Taiwan': [122.45, 23.05], Taiwan: [120.45, 21.6],
};
const PLACES = [['Taipei', 121.56, 25.04], ['Kaohsiung', 120.3, 22.63], ['Xiamen', 118.09, 24.48, 'end'], ['Fuzhou', 119.3, 26.08, 'end']];

export function createDayMap(svg) {
  const proj = createProjection({ lon0: 116.1, lon1: 123.4, lat0: 20.3, lat1: 26.4, width: 1000 });
  drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 0 });
  const adiz = el('path', { d: proj.line(ADIZ, true), class: 'adiz' }, svg);
  const lab = el('g', {}, svg);
  PLACES.forEach(([n, lon, lat, a]) => {
    const [x, y] = proj.project([lon, lat]);
    el('circle', { cx: x, cy: y, r: 3, class: 'town' }, lab);
    el('text', { x: a ? x - 8 : x + 8, y: y + 5, class: 'm-place', 'text-anchor': a ? 'end' : 'start' }, lab, n);
  });
  const P = p => proj.project(p);
  el('text', { x: P([117, 25.9])[0], y: P([117, 25.9])[1], class: 'm-country' }, lab, 'CHINA');
  el('text', { x: P([120.95, 23.7])[0], y: P([120.95, 23.7])[1], class: 'm-country', 'text-anchor': 'middle' }, lab, 'TAIWAN');
  const adizLab = el('text', { x: P([118.25, 21.35])[0], y: P([118.25, 21.35])[1], class: 'm-adiz' }, lab, '');
  const layer = el('g', {}, svg);

  function update(c) {
    layer.innerHTML = '';
    const share = c.adiz != null ? Math.min(1, c.adiz / 30) : 0;
    adiz.style.setProperty('--heat', (0.04 + share * 0.16).toFixed(3));
    adizLab.textContent = c.adiz != null ? `Taiwan ADIZ · ${c.adiz} aircraft (median line or ADIZ)` : 'Taiwan ADIZ';
    // Schematic transit arrow through the Strait (actual track not recorded).
    if (c.transits.length) {
      const pts = [[121.2, 26.3], [120.1, 24.9], [119.2, 23.2], [118.6, 21.4]].map(P);
      el('path', { d: 'M' + pts.map(p => p.join(' ')).join('L'), class: 'm-transit', 'marker-end': 'url(#m-arrow)' }, layer);
      const names = c.transits.map(t => t[1]).join(', ');
      el('text', { x: pts[1][0] + 14, y: pts[1][1] - 6, class: 'm-transit-t' }, layer, `${names} (schematic route)`);
    }
    // CCG approximate areas for this day.
    c.incidents.forEach((i, k) => {
      if (i.loc === 'Taiping Island') {
        const [x, y] = P([116.2, 20.45]);
        el('text', { x, y, class: 'm-ccg-t' }, layer, '↙ CCG at Taiping Island, about 1,500 km southwest');
        return;
      }
      const [x, y] = P(ANCHOR[i.loc]);
      el('circle', { cx: x, cy: y, r: 30, class: 'm-ccg' }, layer);
      el('circle', { cx: x, cy: y, r: 30, class: 'm-ccg-pulse' }, layer);
      const right = i.loc !== 'East of Taiwan';
      el('text', { x: right ? x + 38 : x - 38, y: y + 5 + k * 18, class: 'm-ccg-t', 'text-anchor': right ? 'start' : 'end' }, layer, `CCG · ${LOC_LABEL[i.loc]}`);
    });
  }
  return { update };
}
