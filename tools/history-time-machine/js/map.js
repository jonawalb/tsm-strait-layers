// Control map: Taiwan, Penghu, Kinmen, Matsu, the Dachens and the facing mainland coast, shaded by controller.
import { createProjection, el } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { LAND_INDOPAC } from '../../../shared/data/land-indopac.js';
import { PLACES, POWERS, DACHEN_LONLAT, controller } from '../data/control.js';

const BOX = { lon0: 116.3, lon1: 123.25, lat0: 21.8, lat1: 28.85 };
const SEAM = 28; // LAND_TAIWAN stops at 28N; LAND_INDOPAC fills the coast north of it.

// Anchor, halo radius (px) and label placement for each place.
const ANCHOR = {
  taiwan: { c: [120.95, 23.75], r: 0 },
  penghu: { c: [119.57, 23.55], r: 22, lab: [119.2, 23.28], anchor: 'end' },
  kinmen: { c: [118.36, 24.45], r: 17, lab: [118.36, 24.12], anchor: 'middle' },
  matsu: { c: [120.1, 26.18], r: 22, lab: [120.44, 25.95], anchor: 'start' },
  dachen: { c: DACHEN_LONLAT, r: 16, lab: [122.12, 28.52], anchor: 'start' },
  mainland: { c: [117.7, 26.5], r: 0 },
  strait: { c: [119.8, 24.3], r: 0 },
};
const CITIES = [['Taipei', 121.56, 25.04], ['Fuzhou', 119.3, 26.08], ['Xiamen', 118.09, 24.48], ['Kaohsiung', 120.3, 22.63]];

const inBox = p => p[0] >= BOX.lon0 - 0.3 && p[0] <= BOX.lon1 + 0.3 && p[1] >= BOX.lat0 - 0.3 && p[1] <= BOX.lat1 + 0.3;
const within = (c, a, b, d, e) => c[0] >= a && c[0] <= b && c[1] >= d && c[1] <= e;

function classify(ring) {
  if (ring.length > 500) return 'mainland';
  const c = ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length], [0, 0]);
  if (within(c, 118.19, 118.52, 24.36, 24.56)) return 'kinmen';
  if (within(c, 119.86, 120.56, 25.92, 26.42)) return 'matsu';
  if (within(c, 119.28, 119.76, 23.1, 23.82)) return 'penghu';
  if (c[0] > 122.3) return 'other';
  if (c[0] >= 120.0 && c[1] <= 25.8) return 'taiwan';
  return 'mainland';
}

// Group rings once; every map instance reuses them.
let GROUPS = null;
function groups() {
  if (GROUPS) return GROUPS;
  GROUPS = { taiwan: [], penghu: [], kinmen: [], matsu: [], mainland: [], other: [], north: [] };
  for (const r of LAND_TAIWAN) if (r.some(inBox)) GROUPS[classify(r)].push(r);
  const asia = LAND_INDOPAC.filter(r => r.some(inBox)).sort((a, b) => b.length - a.length)[0];
  if (asia) GROUPS.north.push(asia);
  return GROUPS;
}

let uid = 0;
/** Draw a control map into `svg`. Returns { update(year, opts) }. */
export function createMap(svg, { label = '' } = {}) {
  const proj = createProjection({ ...BOX, width: 560 });
  const P = proj.project;
  const G = groups();
  const id = 'htm' + (++uid);
  svg.setAttribute('viewBox', `0 0 ${proj.W} ${proj.H}`);
  svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  const ySeam = P([0, SEAM])[1];
  const cs = el('clipPath', { id: id + 's' }, defs); el('rect', { x: 0, y: ySeam + 0.6, width: proj.W, height: proj.H }, cs);
  const cn = el('clipPath', { id: id + 'n' }, defs); el('rect', { x: 0, y: 0, width: proj.W, height: ySeam + 1 }, cn);

  el('rect', { x: 0, y: 0, width: proj.W, height: proj.H, class: 'tsm-sea' }, svg);
  const grat = el('g', { class: 'tsm-grat' }, svg);
  for (let lon = 117; lon <= 123; lon++) { const [x] = P([lon, 0]); el('line', { x1: x, y1: 0, x2: x, y2: proj.H }, grat); el('text', { x: x + 3, y: proj.H - 5 }, grat, lon + '°E'); }
  for (let lat = 22; lat <= 28; lat++) { const [, y] = P([0, lat]); el('line', { x1: 0, y1: y, x2: proj.W, y2: y }, grat); el('text', { x: 4, y: y - 3 }, grat, lat + '°N'); }

  const land = el('g', {}, svg);
  const shapes = {};
  const mk = (key, rings, clip) => {
    const p = el('path', { d: proj.path(rings), class: 'htm-land', 'fill-rule': 'evenodd', 'data-place': key }, land);
    if (clip) p.setAttribute('clip-path', `url(#${clip})`);
    (shapes[key] = shapes[key] || []).push(p);
  };
  mk('mainland', G.mainland, id + 's');
  mk('mainland', G.north, id + 'n');
  mk('other', G.other);
  ['taiwan', 'penghu', 'kinmen', 'matsu'].forEach(k => mk(k, G[k]));

  // Halos make the small islands readable and carry the controller color.
  const halos = {};
  const haloG = el('g', {}, svg);
  for (const k of ['penghu', 'kinmen', 'matsu', 'dachen']) {
    const a = ANCHOR[k], [x, y] = P(a.c);
    halos[k] = el('circle', { cx: x, cy: y, r: a.r, class: 'htm-halo' + (k === 'dachen' ? ' marker' : '') }, haloG);
  }

  const labG = el('g', {}, svg);
  for (const [n, lon, lat] of CITIES) {
    const [x, y] = P([lon, lat]);
    el('circle', { cx: x, cy: y, r: 2, class: 'htm-city' }, labG);
    el('text', { x: x + (n === 'Xiamen' || n === 'Fuzhou' ? -5 : 5), y: y + 3.5, class: 't-place', 'text-anchor': n === 'Xiamen' || n === 'Fuzhou' ? 'end' : 'start' }, labG, n);
  }
  const bigLab = (t, c, cls = 'htm-biglab') => { const [x, y] = P(c); return el('text', { x, y, class: cls, 'text-anchor': 'middle' }, labG, t); };
  bigLab('TAIWAN', [120.93, 23.55]);
  bigLab('MAINLAND', [117.6, 27.0]);
  const sl = bigLab('Taiwan Strait', [119.65, 24.05], 't-sea');
  sl.setAttribute('transform', `rotate(-48 ${P([119.65, 24.05]).join(' ')})`);
  const placeLab = {};
  for (const k of ['penghu', 'kinmen', 'matsu', 'dachen']) {
    const a = ANCHOR[k], [x, y] = P(a.lab);
    placeLab[k] = el('text', { x, y, class: 't-label htm-plab', 'text-anchor': a.anchor }, labG, PLACES.find(p => p.id === k).name.split(' (')[0]);
  }
  const dNote = P([122.12, 28.52]);
  el('text', { x: dNote[0], y: dNote[1] + 13, class: 'htm-note', 'text-anchor': 'start' }, labG, 'marker only');

  const hi = el('circle', { class: 'htm-hi', r: 0, cx: -99, cy: -99 }, svg);
  const yearTag = el('text', { x: 14, y: 40, class: 'htm-yeartag', 'text-anchor': 'start' }, svg, label);

  function update(year, { place = null, changed = new Set(), tag = null } = {}) {
    const ctl = Object.fromEntries(PLACES.map(p => [p.id, controller(p, year)]));
    for (const k in shapes) for (const s of shapes[k]) {
      s.style.fill = k === 'other' ? '' : `color-mix(in srgb, var(${POWERS[ctl[k]].col}) 42%, var(--land))`;
      s.classList.toggle('changed', changed.has(k));
    }
    for (const k in halos) {
      halos[k].style.stroke = `var(${POWERS[ctl[k]].col})`;
      halos[k].style.fill = `color-mix(in srgb, var(${POWERS[ctl[k]].col}) ${k === 'dachen' ? 60 : 16}%, transparent)`;
      halos[k].classList.toggle('changed', changed.has(k));
      placeLab[k].classList.toggle('changed', changed.has(k));
    }
    if (place && ANCHOR[place]) {
      const [x, y] = P(ANCHOR[place].c);
      const r = { taiwan: 80, mainland: 70, strait: 120 }[place] || ANCHOR[place].r + 12;
      hi.setAttribute('cx', x); hi.setAttribute('cy', y); hi.setAttribute('r', r);
      hi.classList.remove('pulse'); void hi.getBBox(); hi.classList.add('pulse');
    } else hi.setAttribute('r', 0);
    yearTag.textContent = tag ?? String(year);
  }
  return { update };
}
