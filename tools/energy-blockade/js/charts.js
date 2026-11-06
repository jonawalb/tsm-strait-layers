// Reservoir gauges, the grid supply chart and the sector strip.
import { el, svgPoint } from '../../../shared/js/mapkit.js';
import { FUELS, SECTORS, NOTIONAL } from '../data/baseline.js';

let W = 1000;
const PAD = { l: 44, r: 14, t: 14, b: 26 };
const xOf = t => PAD.l + (t / (NOTIONAL.horizon - 1)) * (W - PAD.l - PAD.r);
const tOf = x => Math.round(Math.max(0, Math.min(NOTIONAL.horizon - 1, (x - PAD.l) / (W - PAD.l - PAD.r) * (NOTIONAL.horizon - 1))));

/** Match the viewBox to the rendered width so chart text stays at its real size. */
function fit(svg) { W = Math.max(320, Math.round(svg.clientWidth || svg.parentElement.clientWidth || 1000)); }

// ---- Gauges -------------------------------------------------------------------
export function mountGauges(box) {
  const items = [...FUELS.map(f => ({ k: f.k, n: f.n, sub: f.long, col: f.col })),
    { k: 'grid', n: 'Grid', sub: 'Supply vs. demand', col: 'var(--c3)' }];
  box.innerHTML = items.map(g => `
    <figure class="gauge" data-k="${g.k}" style="--gc:${g.col}">
      <div class="tank" role="meter" aria-label="${g.n} level" aria-valuemin="0" aria-valuemax="100">
        <div class="fill"><span class="wave"></span></div>
        <div class="ticks"><i></i><i></i><i></i></div>
        <b class="lvl num"></b>
      </div>
      <figcaption><b>${g.n}</b><span class="sub">${g.sub}</span><span class="left num"></span></figcaption>
    </figure>`).join('');
}

export function updateGauges(box, sim, day) {
  const d = sim.days[day];
  FUELS.forEach(f => {
    const g = box.querySelector(`[data-k="${f.k}"]`);
    const cap = Math.max(sim.cap0[f.k], 0.001), s = d.stock[f.k];
    const frac = Math.max(0, Math.min(1, s / cap));
    g.querySelector('.fill').style.height = (frac * 100).toFixed(1) + '%';
    g.querySelector('.tank').setAttribute('aria-valuenow', Math.round(frac * 100));
    g.querySelector('.lvl').textContent = s >= 0.5 ? `${Math.round(s)} d` : 'Empty';
    g.dataset.state = s < 0.5 ? 'empty' : frac < 0.3 ? 'low' : 'ok';
    const r = sim.runout[f.k];
    g.querySelector('.left').innerHTML = r == null ? 'Lasts the blockade' : `Runs out day <b>${r}</b>`;
  });
  const g = box.querySelector('[data-k="grid"]');
  const frac = Math.min(1, d.supply / d.demand);
  g.querySelector('.fill').style.height = (frac * 100).toFixed(1) + '%';
  g.querySelector('.tank').setAttribute('aria-valuenow', Math.round(frac * 100));
  g.querySelector('.lvl').textContent = Math.round(frac * 100) + '%';
  g.dataset.state = frac < 0.5 ? 'empty' : frac < 0.9 ? 'low' : 'ok';
  g.querySelector('.left').innerHTML = `${Math.round(d.supply * 100)}% of normal output`;
}

// ---- Scrubbable chart helpers ---------------------------------------------------
function scrubbable(svg, onScrub) {
  if (svg._scrub) { svg._scrub.cb = onScrub; return; }
  svg._scrub = { cb: onScrub };
  let down = false;
  const go = e => svg._scrub.cb(tOf(svgPoint(svg, e)[0]));
  svg.addEventListener('pointerdown', e => { down = true; svg.setPointerCapture(e.pointerId); go(e); });
  svg.addEventListener('pointermove', e => { if (down) go(e); });
  svg.addEventListener('pointerup', () => { down = false; });
  svg.addEventListener('pointercancel', () => { down = false; });
}

function band(g, H, dur, label = true) {
  if (dur <= 0) return;
  const x1 = xOf(Math.min(dur, NOTIONAL.horizon - 1));
  el('rect', { x: PAD.l, y: PAD.t, width: Math.max(0, x1 - PAD.l), height: H - PAD.t - PAD.b, class: 'band' }, g);
  el('line', { x1, x2: x1, y1: PAD.t, y2: H - PAD.b, class: 'band-end' }, g);
  if (label) el('text', { x: x1 - 6, y: PAD.t + 12, class: 'band-t', 'text-anchor': 'end' }, g, 'Blockade lifts');
}

function xAxis(g, H) {
  for (let t = 0; t < NOTIONAL.horizon; t += W < 600 ? 60 : 30) {
    el('line', { x1: xOf(t), x2: xOf(t), y1: H - PAD.b, y2: H - PAD.b + 4, class: 'ax' }, g);
    el('text', { x: xOf(t), y: H - 8, class: 'ax-t', 'text-anchor': 'middle' }, g, t === 0 ? 'Day 0' : String(t));
  }
}

function cursor(g, H, day) {
  const x = xOf(day);
  el('line', { x1: x, x2: x, y1: PAD.t - 6, y2: H - PAD.b, class: 'cur' }, g);
  el('circle', { cx: x, cy: PAD.t - 6, r: 6, class: 'cur-h' }, g);
}

// ---- Supply chart ------------------------------------------------------------------
const LAYERS = [
  { k: 'renew', n: 'Renewables', c: 'var(--c3)' },
  { k: 'coal', n: 'Coal', c: 'var(--c8)' },
  { k: 'gas', n: 'Gas', c: 'var(--c1)' },
  { k: 'oil', n: 'Oil and other', c: 'var(--c2)' },
  { k: 'backup', n: 'Oil backup', c: 'var(--c5)' },
];
export const SUPPLY_LAYERS = LAYERS;

export function drawSupply(svg, sim, dur, day, onScrub) {
  fit(svg);
  const H = W < 600 ? 230 : 290;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const g = el('g', {}, svg);
  const yOf = v => H - PAD.b - Math.min(1.1, v) / 1.1 * (H - PAD.t - PAD.b);
  band(g, H, dur);
  [0, 0.25, 0.5, 0.75, 1].forEach(v => {
    el('line', { x1: PAD.l, x2: W - PAD.r, y1: yOf(v), y2: yOf(v), class: 'grid' }, g);
    el('text', { x: PAD.l - 6, y: yOf(v) + 4, class: 'ax-t', 'text-anchor': 'end' }, g, Math.round(v * 100) + '%');
  });
  const base = sim.days.map(() => 0);
  LAYERS.forEach(L => {
    const top = sim.days.map((d, i) => base[i] + d.gen[L.k]);
    if (top.every((v, i) => v - base[i] < 1e-6)) return;
    const up = sim.days.map((d, i) => `${xOf(i).toFixed(1)} ${yOf(top[i]).toFixed(1)}`);
    const dn = sim.days.map((d, i) => `${xOf(i).toFixed(1)} ${yOf(base[i]).toFixed(1)}`).reverse();
    el('path', { d: `M${up.join('L')}L${dn.join('L')}Z`, class: 'area', fill: L.c }, g);
    top.forEach((v, i) => { base[i] = v; });
  });
  const dem = sim.days.map((d, i) => `${xOf(i).toFixed(1)} ${yOf(d.demand).toFixed(1)}`);
  el('path', { d: 'M' + dem.join('L'), class: 'demand' }, g);
  const short = sim.days.map((d, i) => `${xOf(i).toFixed(1)} ${yOf(d.demand).toFixed(1)}`);
  const sup = sim.days.map((d, i) => `${xOf(i).toFixed(1)} ${yOf(d.supply).toFixed(1)}`).reverse();
  el('path', { d: `M${short.join('L')}L${sup.join('L')}Z`, class: 'gap' }, g);
  el('text', { x: PAD.l + 6, y: yOf(sim.days[0].demand) + 14, class: 'dem-t' }, g, 'Demand');
  xAxis(g, H);
  cursor(g, H, day);
  scrubbable(svg, onScrub);
}

// ---- Sector strip --------------------------------------------------------------------
export function drawSectors(svg, sim, dur, day, onScrub) {
  fit(svg);
  const rowH = 36, H = PAD.t + SECTORS.length * rowH + PAD.b;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const g = el('g', {}, svg);
  band(g, H, dur, false);
  const cw = (W - PAD.l - PAD.r) / NOTIONAL.horizon;
  SECTORS.forEach((s, r) => {
    const y = PAD.t + r * rowH + 17;
    let run = null;
    const flush = i => {
      if (!run) return;
      el('rect', { x: xOf(run.i0) - cw / 2, y, width: (i - run.i0) * cw + 0.6, height: rowH - 20, class: 'cell s-' + run.s }, g);
      run = null;
    };
    sim.days.forEach((d, i) => {
      const v = d.served[s.k], st = v >= 0.97 ? 'ok' : v >= NOTIONAL.dark ? 'cut' : 'dark';
      if (!run || run.s !== st) { flush(i); run = { i0: i, s: st }; }
    });
    flush(sim.days.length);
    el('text', { x: PAD.l, y: y - 5, class: 'row-t' }, g, s.n);
  });
  xAxis(g, H);
  cursor(g, H, day);
  scrubbable(svg, onScrub);
}
