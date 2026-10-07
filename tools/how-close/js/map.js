// World map: land, PRC and Taiwan, distance rings around Taipei, and the great-circle route to the chosen place.
import { el, fmt, svgPoint } from '../../../shared/js/mapkit.js';
import { LAND, CHN, TWN } from '../data/world.js';
import { makeProjection, greatCircle, ringCircle, TAIPEI, PINGTAN, norm } from './geo.js';

const VIEWS = {
  world: [-30, -58, 330, 80],
  asia: [70, -15, 185, 58],
  strait: [112, 19, 130, 31],
};

export function createMap(svg, { onPick }) {
  const proj = makeProjection(1000);
  const { W, H, project } = proj;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const root = el('g', {}, svg);
  el('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H, class: 'hc-sea' }, root);

  const grat = el('g', { class: 'hc-grat' }, root);
  for (let lon = 0; lon <= 330; lon += 30) {
    const [x] = project([lon, 0]);
    el('line', { x1: x, y1: 0, x2: x, y2: H }, grat);
  }
  for (let lat = -30; lat <= 60; lat += 30) {
    const [, y] = project([0, lat]);
    el('line', { x1: 0, y1: y, x2: W, y2: y }, grat);
  }
  el('path', { d: proj.path(LAND), class: 'hc-land', 'fill-rule': 'evenodd' }, root);
  el('path', { d: proj.path(CHN), class: 'hc-prc' }, root);
  el('path', { d: proj.path(TWN), class: 'hc-roc' }, root);

  const rings = el('g', { class: 'hc-rings' }, root);
  [1000, 3000, 5500].forEach(km => {
    el('path', { d: proj.line(ringCircle(TAIPEI, km), true), class: 'hc-ring' }, rings);
    const [x, y] = project([TAIPEI[0], TAIPEI[1] + km / 111.2]);
    el('text', { x, y: y - 3, class: 'hc-ring-t', 'text-anchor': 'middle' }, rings, `${fmt(km)} km from Taipei`);
  });

  const route = el('g', {}, root);
  const marks = el('g', {}, root);
  const fixed = el('g', {}, root);
  const [tx, ty] = project(TAIPEI), [px, py] = project(PINGTAN);
  el('circle', { cx: px, cy: py, r: 2.4, class: 'hc-pingtan' }, fixed);
  el('circle', { cx: tx, cy: ty, r: 3.2, class: 'hc-taipei' }, fixed);
  const tWrap = el('g', { class: 'hc-s' }, el('g', { transform: `translate(${tx} ${ty})` }, fixed));
  const tLabel = el('text', { x: 7, y: 4, class: 'hc-label hc-label-tw' }, tWrap, 'Taipei');

  // View box handling (animated when motion is allowed)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let vb = [0, 0, W, H], anim = 0;
  const setVB = v => {
    vb = v;
    svg.setAttribute('viewBox', v.map(n => n.toFixed(1)).join(' '));
    svg.style.setProperty('--z', (W / v[2]).toFixed(3));
  };
  const boxToVB = ([lon0, lat0, lon1, lat1]) => {
    const [x0, y0] = project([lon0, lat1]), [x1, y1] = project([lon1 > 330 ? 330 : lon1, lat0]);
    let w = Math.max(x1 - x0, (y1 - y0) * W / H), h = w * H / W;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let x = Math.max(0, Math.min(W - w, cx - w / 2)), y = Math.max(0, Math.min(H - h, cy - h / 2));
    if (w > W) { w = W; h = H; x = 0; y = 0; }
    return [x, y, w, h];
  };
  const goTo = target => {
    cancelAnimationFrame(anim);
    if (reduce.matches) return setVB(target);
    const from = vb.slice();
    let t0 = null;
    const step = now => {
      t0 ??= now;
      const t = Math.min(1, (now - t0) / 650), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setVB(from.map((v, i) => v + (target[i] - v) * e));
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
    clearTimeout(snap); snap = setTimeout(() => { cancelAnimationFrame(anim); setVB(target); }, 850); // land on the target even if frames are throttled
  };
  let snap = 0;

  svg.addEventListener('click', e => {
    const [x, y] = svgPoint(svg, e);
    const [lon, lat] = proj.unproject(x, y);
    if (lat < -58 || lat > 80) return;
    onPick([norm(lon) > 180 ? norm(lon) - 360 : norm(lon), lat]);
  });

  return {
    view(name) { goTo(boxToVB(VIEWS[name])); },
    /** Draw the route to the chosen place and zoom to fit it. */
    show(point, { fit = true } = {}) {
      route.innerHTML = ''; marks.innerHTML = '';
      const p = [point.lon, point.lat];
      const gc = greatCircle(p, TAIPEI);
      el('path', { d: proj.line(gc), class: 'hc-route-halo' }, route);
      el('path', { d: proj.line(gc), class: 'hc-route' }, route);
      el('path', { d: proj.line(greatCircle(p, PINGTAN)), class: 'hc-route2' }, route);
      const [x, y] = project(p);
      el('circle', { cx: x, cy: y, r: 9, class: 'hc-you-halo' }, marks);
      el('circle', { cx: x, cy: y, r: 4, class: 'hc-you' }, marks);
      const right = x > W * 0.8;
      const yWrap = el('g', { class: 'hc-s' }, el('g', { transform: `translate(${x} ${y})` }, marks));
      el('text', { x: right ? -9 : 9, y: -7, class: 'hc-label hc-label-you', 'text-anchor': right ? 'end' : 'start' }, yWrap, point.name);
      tLabel.setAttribute('x', x < tx ? 7 : -7);
      tLabel.setAttribute('text-anchor', x < tx ? 'start' : 'end');
      if (!fit) return;
      // Fit the route: longitudes unwrapped relative to Taipei so the box never spans the seam.
      const lons = gc.map(q => { let l = norm(q[0]); return l; }), lats = gc.map(q => q[1]);
      let lon0 = Math.min(...lons), lon1 = Math.max(...lons);
      if (lon1 - lon0 > 300) return goTo([0, 0, W, H]);
      let lat0 = Math.min(...lats), lat1 = Math.max(...lats);
      const padLon = Math.max(8, (lon1 - lon0) * 0.18), padLat = Math.max(6, (lat1 - lat0) * 0.25);
      goTo(boxToVB([lon0 - padLon, Math.max(-58, lat0 - padLat), lon1 + padLon, Math.min(80, lat1 + padLat)]));
    },
    proj,
  };
}
