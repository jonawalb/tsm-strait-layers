// Locator map: the three open-water grid points, the weather stations and the tide ports.
import { createProjection, drawBasemap, el } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { POINTS, STATIONS } from './model.js';
import { PORTS } from './astro.js';

// Station coordinates as listed in NOAA's isd-history.csv (https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv).
const STATION_LL = { pingtan: [119.783, 25.517], xiamen: [118.128, 24.544], taichung: [120.621, 24.265] };
const TC_CENTER = [119.5, 24.0];

export function createLocator(svg, { onPoint, onPort, onStation }) {
  const proj = createProjection({ lon0: 117.4, lon1: 121.9, lat0: 22.2, lat1: 26.0, width: 420 });
  drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 1 });
  const layer = el('g', {}, svg);
  const tcRing = el('circle', { class: 'tc-ring' }, layer);
  const [cx, cy] = proj.project(TC_CENTER);
  const kmPx = proj.project([TC_CENTER[0], TC_CENTER[1] + 1])[1] - cy; // negative: px per 111 km upward
  const mk = [];
  for (const [id, p] of Object.entries(POINTS)) {
    const [x, y] = proj.project(p.ll);
    const g = el('g', { class: 'pt', tabindex: 0, role: 'button', 'aria-label': `Use ${p.label} grid point` }, layer);
    el('circle', { cx: x, cy: y, r: 7 }, g);
    el('text', { x: x + 10, y: y + 4, class: 't-label' }, g, p.label.split(' ')[0]);
    g.onclick = () => onPoint(id);
    g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPoint(id); } };
    mk.push(['pt', id, g]);
  }
  for (const [id, ll] of Object.entries(STATION_LL)) {
    const [x, y] = proj.project(ll);
    const g = el('g', { class: 'stn', tabindex: 0, role: 'button', 'aria-label': `Use ${STATIONS[id].label} for fog` }, layer);
    el('path', { d: `M${x} ${y - 6}L${x + 5.5} ${y + 4}L${x - 5.5} ${y + 4}Z` }, g);
    g.onclick = () => onStation(id);
    g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStation(id); } };
    mk.push(['stn', id, g]);
  }
  for (const [id, p] of Object.entries(PORTS)) {
    const [x, y] = proj.project([p.grid[1], p.grid[0]]);
    const g = el('g', { class: 'port', tabindex: 0, role: 'button', 'aria-label': `Use ${p.label} for tides` }, layer);
    el('rect', { x: x - 4.5, y: y - 4.5, width: 9, height: 9 }, g);
    g.onclick = () => onPort(id);
    g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPort(id); } };
    mk.push(['port', id, g]);
  }
  return {
    update(s) {
      for (const [kind, id, g] of mk) g.classList.toggle('on', (kind === 'pt' && id === s.p) || (kind === 'stn' && s.fog && id === s.st) || (kind === 'port' && id === s.port));
      tcRing.setAttribute('cx', cx); tcRing.setAttribute('cy', cy);
      tcRing.setAttribute('r', Math.max(0, -kmPx * s.r / 111.2));
      tcRing.style.display = s.r > 0 ? '' : 'none';
    },
  };
}
