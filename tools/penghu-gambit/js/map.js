// Map of the Penghu archipelago: notional sectors, the notional defense zone, base-level places and game state.
import { createProjection, drawBasemap, el, circlePath } from '../../../shared/js/mapkit.js';
import { LAND_PENGHU } from '../data/land.js';
import { PLACES, SECTOR_GEO } from '../data/sources.js';
import { SECTORS } from '../data/params.js';

const BOX = { lon0: 119.28, lon1: 120.22, lat0: 23.16, lat1: 23.86, width: 1000 };

export function createMap(svg, tip, { onSector }) {
  const proj = createProjection(BOX);
  const P = ll => proj.project(ll);
  const { root } = drawBasemap(svg, proj, LAND_PENGHU, { gratStep: 0.5 });
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  // Phones: crop to the islands and the three sectors so the pieces are big enough to read and tap.
  const full = svg.getAttribute('viewBox');
  const [zx0, zy0] = P([119.28, 23.84]), [zx1, zy1] = P([119.95, 23.44]);
  const crop = `${zx0} ${zy0} ${zx1 - zx0} ${zy1 - zy0}`;
  const small = matchMedia('(max-width: 600px)');
  const fit = () => svg.setAttribute('viewBox', small.matches ? crop : full);
  fit(); small.addEventListener('change', fit);

  // Static labels
  const lab = el('g', { class: 'pg-labels' }, root);
  const [tx, ty] = P([120.13, 23.30]);
  el('text', { x: tx, y: ty, class: 'pg-big' }, lab, 'TAIWAN');
  const [cx, cy] = P([119.93, 23.68]);
  el('text', { x: cx, y: cy, class: 'pg-water' }, lab, 'Penghu Channel');
  const [fx, fy] = P([119.29, 23.845]);
  el('path', { d: `M${fx + 60} ${fy + 26}L${fx + 6} ${fy + 4}`, class: 'pg-arrow', 'marker-end': 'url(#pg-head)' }, lab);
  el('text', { x: fx + 66, y: fy + 32, class: 'pg-note' }, lab, 'Fujian coast about 145 km');
  const defs = el('defs', {}, svg);
  const mk = el('marker', { id: 'pg-head', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', class: 'pg-headfill' }, mk);

  // Scale bar (10 km)
  const [s0x, s0y] = P([119.30, 23.19]), [s1x] = P([119.30 + 10 / (111.32 * Math.cos(23.47 * Math.PI / 180)), 23.19]);
  const sc = el('g', { class: 'pg-scale' }, root);
  el('line', { x1: s0x, y1: s0y, x2: s1x, y2: s0y }, sc);
  el('text', { x: s0x, y: s0y - 6 }, sc, '10 km');

  const layer = el('g', {}, root);
  const top = el('g', {}, root);

  // Tooltip helper
  const tipOn = (node, html) => {
    node.addEventListener('pointerenter', e => show(e, html()));
    node.addEventListener('pointermove', e => move(e));
    node.addEventListener('pointerleave', () => { tip.hidden = true; });
  };
  function show(e, html) { tip.innerHTML = html; tip.hidden = false; move(e); }
  function move(e) {
    const box = svg.parentElement.getBoundingClientRect();
    tip.style.left = Math.min(e.clientX - box.left + 14, box.width - tip.offsetWidth - 6) + 'px';
    tip.style.top = Math.min(e.clientY - box.top + 14, box.height - tip.offsetHeight - 6) + 'px';
  }

  function draw(cfg, st, info) {
    layer.replaceChildren(); top.replaceChildren();
    const assault = cfg.pla.plan === 'assault';
    const center = [119.585, 23.58];

    if (!assault) {
      el('path', { d: circlePath(proj, center, 30), class: 'pg-ring' }, layer);
      for (let b = 0; b < 360; b += 30) {
        const a = b * Math.PI / 180;
        const [x, y] = P([center[0] + 0.294 * Math.sin(a), center[1] + 0.27 * Math.cos(a)]);
        el('path', { d: `M${x - 9} ${y}l4 -5h10l4 5l-4 4h-10z`, class: 'pg-ship' }, layer);
      }
      const [rx, ry] = P([119.585, 23.86]);
      el('text', { x: rx, y: ry + 16, class: 'pg-note mid' }, layer, 'Blockade line, 30 km out (notional)');
    }

    // Sectors
    for (const [k, g] of Object.entries(SECTOR_GEO)) {
      const on = assault && cfg.pla.sector === k, s = SECTORS[k];
      const grp = el('g', { class: `pg-sector${on ? ' on' : ''}${assault ? '' : ' dim'}`, tabindex: assault ? 0 : -1, role: 'button', 'aria-label': `Land on the ${s.t.toLowerCase()}` }, layer);
      el('path', { d: proj.line(g.path), class: 'pg-route' }, grp);
      const [bx, by] = P(g.path[1]);
      el('ellipse', { cx: bx, cy: by, rx: 34, ry: 22, class: 'pg-beach' }, grp);
      if (cfg.roc.mines[k]) {
        const eff = on && st ? st.mineEff : 1;
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * Math.PI * 2;
          el('circle', { cx: bx + 44 * Math.cos(a), cy: by + 31 * Math.sin(a), r: 3.2, class: 'pg-mine', opacity: 0.25 + 0.75 * eff }, grp);
        }
      }
      const [lx, ly] = P(g.label);
      el('text', { x: lx, y: ly, class: 'pg-slabel' }, grp, `${s.t}`);
      el('text', { x: lx, y: ly + 15, class: 'pg-note mid' }, grp, on ? 'PLA landing sector' : 'notional sector');
      if (assault) {
        grp.addEventListener('click', () => onSector(k));
        grp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSector(k); } });
      }
      tipOn(grp, () => `<b>${s.t} sector</b><span class="tt-d">${s.s}</span>${s.steps} objectives from the beach to Magong${s.airStep ? `; the airfield is objective ${s.airStep}` : '; the airfield is off this route'}.<br>${cfg.roc.mines[k] ? 'Mined. ' : ''}Broad and notional: not a real beach assessment.${assault ? '<small>Click to make this the landing sector</small>' : ''}`);
    }

    // PLA progress along the landing route
    if (assault && st && info.turn > 0) {
      const g = SECTOR_GEO[cfg.pla.sector];
      const upto = g.path.slice(1, 2 + st.progress);
      if (upto.length > 1) el('path', { d: proj.line(upto), class: 'pg-adv', 'marker-end': 'url(#pg-head)' }, top);
      const at = P(g.path[1 + st.progress] || g.path[g.path.length - 1]);
      if (st.ashore > 0.05) {
        const r = 10 + Math.sqrt(st.ashore) * 7;
        const n = el('g', { class: 'pg-lodge' }, top);
        el('circle', { cx: at[0], cy: at[1], r }, n);
        el('text', { x: at[0], y: at[1] + 4 }, n, st.ashore.toFixed(1));
        tipOn(n, () => `<b>PLA force ashore</b>${st.ashore.toFixed(2)} strength points (about ${Math.round(st.ashore * 1000).toLocaleString('en-US')} troops at the notional conversion). Objective ${st.progress} of ${SECTORS[cfg.pla.sector].steps}.`);
      }
      const [ox, oy] = P(g.path[0]);
      const fl = el('g', { class: 'pg-fleet' }, top);
      for (let i = 0; i < cfg.pla.lift; i++) {
        const x = ox + (i % 3 - 1) * 16, y = oy + Math.floor(i / 3) * 12 - 6;
        el('path', { d: `M${x - 7} ${y}l3 -4h8l3 4l-3 3h-8z`, class: i < st.fleet ? 'pg-ship' : 'pg-ship lost' }, fl);
      }
      tipOn(fl, () => `<b>Amphibious lift</b>${st.fleet} of ${cfg.pla.lift} landing groups still afloat. Lost ships are not replaced.`);
    }

    // Places (base level, public)
    for (const p of PLACES) {
      const [x, y] = P(p.ll);
      const g = el('g', { class: `pg-place ${p.k}` }, top);
      if (p.k === 'airbase') {
        const cls = st ? `pg-af ${st.airfield}` : 'pg-af roc';
        el('rect', { x: x - 11, y: y - 4, width: 22, height: 8, rx: 2, class: cls, transform: `rotate(-70 ${x} ${y})` }, g);
        el('text', { x: x + 6, y: y - 18, class: 'pg-plabel', 'text-anchor': 'middle' }, g, 'Magong Air Base');
      } else {
        const taken = st && info.outcome === 'pla' && info.turn >= info.wonAt;
        el('circle', { cx: x, cy: y, r: 7, class: `pg-town${taken ? ' taken' : ''}` }, g);
        el('text', { x: x - 10, y: y + 22, class: 'pg-plabel end' }, g, 'Magong');
      }
      tipOn(g, () => `<b>${p.t}</b><span class="tt-d">${p.s}</span>${p.k === 'airbase' ? airText(st) : 'The objective. The PLA wins when it holds Magong.'}`);
    }

    // Notional defense zone inset
    drawZone(cfg, st);
  }

  function airText(st) {
    const s = st ? st.airfield : 'roc';
    return s === 'pla' ? 'Held by the PLA and usable: transports fly in reinforcements each turn.'
      : s === 'wrecked' ? 'Captured, but the runway was wrecked by demolition.'
        : 'Held by Taiwan. Public, base-level location only.';
  }

  function drawZone(cfg, st) {
    const [x0, y0] = P([119.72, 23.43]);
    const W = 262, H = 150;
    const g = el('g', { class: 'pg-zone' }, top);
    el('rect', { x: x0, y: y0, width: W, height: H, rx: 6 }, g);
    el('text', { x: x0 + 10, y: y0 + 20, class: 'pg-ztitle' }, g, 'ROC assets');
    el('text', { x: x0 + 10, y: y0 + 36, class: 'pg-note' }, g, 'Notional zone, not real positions');
    const rows = [
      ['ashm', cfg.roc.ashm, st ? st.ashm : cfg.roc.ashm, 'Missile batteries'],
      ['shorad', cfg.roc.shorad, st ? st.shorad : cfg.roc.shorad, 'Air defense'],
      ['drone', cfg.roc.drones, st ? st.drones : cfg.roc.drones, 'Drone teams'],
    ];
    rows.forEach(([k, n, alive, t], r) => {
      const y = y0 + 58 + r * 26;
      el('text', { x: x0 + 10, y: y + 4, class: 'pg-zl' }, g, t);
      for (let i = 0; i < n; i++) {
        const x = x0 + 130 + i * 24, dead = i >= alive;
        const cls = `pg-tok ${k}${dead ? ' dead' : ''}`;
        if (k === 'ashm') el('path', { d: `M${x} ${y - 9}L${x + 9} ${y + 7}H${x - 9}z`, class: cls }, g);
        else if (k === 'shorad') el('circle', { cx: x, cy: y, r: 8, class: cls }, g);
        else el('path', { d: `M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}z`, class: cls }, g);
        if (dead) el('path', { d: `M${x - 7} ${y - 7}L${x + 7} ${y + 7}M${x + 7} ${y - 7}L${x - 7} ${y + 7}`, class: 'pg-x' }, g);
      }
      if (!n) el('text', { x: x0 + 130, y: y + 4, class: 'pg-note' }, g, 'none');
    });
    const gar = st ? st.garrison : null;
    el('text', { x: x0 + 10, y: y0 + H - 12, class: 'pg-zl' }, g, gar == null ? 'Garrison at full strength' : `Garrison ${gar.toFixed(1)} pts · stocks ${st.stocks.toFixed(1)} days`);
    tipOn(g, () => '<b>Notional defense zone</b>Taiwan\'s assets are shown here, off the islands, on purpose. The model tracks how many survive, not where they are. Crossed-out tokens were destroyed by strikes.');
  }

  return { draw, proj };
}
