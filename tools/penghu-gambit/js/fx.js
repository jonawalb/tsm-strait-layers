// Motion for Penghu Gambit (both sites): dice that tumble before they settle, the
// combat results table rolling down its column, strikes and salvos as tracers on the map, hits as bursts, and
// numbers that count to their new values. Presentation only: every number is already on the page before any of
// this runs, and nothing here waits on or delays the game. Off under reduced motion.
import { countUp, reveal, pulse, shake, flash, ping, burst, tracer, reduced } from '../../../shared/js/motion.js';

export const FX = true;
document.documentElement.classList.add('pg-fx');

const NS = 'http://www.w3.org/2000/svg';
const trailer = () => document.documentElement.dataset.skin === 'trailer';
const f2 = v => (Math.round(v * 100) / 100).toString();
let gen = 0;

/** Centre of an SVG element in the SVG's user space, or null when it is not rendered (e.g. hidden on phones). */
function centre(node) {
  if (!node || !node.getClientRects().length) return null;
  try { const b = node.getBBox(); return [b.x + b.width / 2, b.y + b.height / 2]; } catch { return null; }
}
function layer(svg) {
  let g = svg.querySelector(':scope > g.pg-fxg');
  if (!g) { g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'pg-fxg'); g.setAttribute('pointer-events', 'none'); svg.appendChild(g); }
  else svg.appendChild(g); // keep on top of whatever the map just drew
  return g;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Dice in the turn log: each roll tumbles through random values, then settles on its real value. */
function tumble(log, g) {
  const rows = [...log.querySelectorAll('table.log tbody tr')];
  rows.forEach((tr, i) => { tr.style.setProperty('--i', Math.min(i, 12)); tr.classList.add('pg-in'); });
  const rolls = [...log.querySelectorAll('.roll')];
  rolls.forEach((r, i) => {
    const final = r.textContent, row = rows.indexOf(r.closest('tr'));
    const until = performance.now() + 260 + Math.min(row, 10) * 45 + (i % 4) * 30;
    r.classList.add('pg-tumbling');
    const tick = () => {
      if (g !== gen || !r.isConnected) return;
      if (performance.now() >= until) { r.textContent = final; r.classList.remove('pg-tumbling'); r.classList.add('pg-settled'); return; }
      r.textContent = Math.random().toFixed(2);
      setTimeout(tick, 55);
    };
    tick();
  });
  const end = log.querySelector('.endline');
  if (end) reveal([end]);
}

/** Combat results table: a marker runs down the column, then lands on this turn's cell. */
function rollCrt(crtEl, g) {
  const hit = crtEl.querySelector('td.hit');
  if (!hit) return;
  const tr = hit.closest('tr'), ci = [...tr.children].indexOf(hit);
  const col = [...crtEl.querySelectorAll('tbody tr')].map(r => r.children[ci]);
  const target = col.indexOf(hit), steps = 6 + target;
  hit.classList.remove('hit');
  let k = 0;
  const tick = () => {
    if (g !== gen || !hit.isConnected) return;
    col.forEach(c => c.classList.remove('pg-rolling'));
    if (k >= steps) { hit.classList.add('hit', 'pg-land'); return; }
    col[k % col.length].classList.add('pg-rolling');
    k++; setTimeout(tick, 50);
  };
  tick();
}

/** Called after a turn is drawn. prev and st are the states before and after; forward is a one-turn step. */
export function turn({ svg, log, crt, readout, prevReadout, prev, st, cfg, view, game, forward }) {
  if (!FX) return;
  const g = ++gen;
  svg.querySelector(':scope > g.pg-fxg')?.replaceChildren();
  if (!forward || reduced()) return;
  tumble(log, g);
  rollCrt(crt, g);
  counts(readout, prevReadout);
  const rich = trailer(), fx = layer(svg);
  const vb = svg.viewBox.baseVal;
  const n = rich ? 16 : 11;

  // Strikes: tracers in from the northwest (the Fujian side) to each ROC asset destroyed this turn.
  const lost = [];
  for (const [k, cls] of [['ashm', 'ashm'], ['shorad', 'shorad'], ['drones', 'drone']]) {
    const toks = svg.querySelectorAll(`.pg-tok.${cls}`);
    for (let i = st[k]; i < prev[k]; i++) lost.push(toks[i]);
  }
  lost.forEach((t, i) => {
    const c = centre(t); if (!c) return;
    const x0 = vb.x + 12 + i * 10, y0 = vb.y + 12;
    wait(i * 90).then(() => g === gen && tracer(fx, x0, y0, c[0], c[1], { color: 'var(--prc)', ms: 420 }))
      .then(() => { if (g !== gen) return; burst(fx, c[0], c[1], { color: 'var(--prc)', n, r: 20 }); });
  });
  if (lost.length) { const z = svg.querySelector('.pg-zone'); if (z?.getClientRects().length) wait(420).then(() => g === gen && shake(z)); }

  // Anti-ship salvos: tracers from Taiwan's side to the landing force; bursts on the groups sunk.
  const fired = Math.max(0, (prev.salvos ?? 0) - (st.salvos ?? 0));
  const ships = [...svg.querySelectorAll('.pg-fleet .pg-ship')];
  const fleetC = centre(svg.querySelector('.pg-fleet'));
  if (fired && fleetC) {
    const from = centre(svg.querySelector('.pg-zone rect')) || [vb.x + vb.width - 10, vb.y + vb.height * 0.6];
    for (let i = 0; i < Math.min(fired, 8); i++) {
      const jx = (i % 3 - 1) * 14, jy = (i % 2) * 10 - 5;
      wait(i * 70).then(() => g === gen && tracer(fx, from[0], from[1] + (i % 4 - 1.5) * 8, fleetC[0] + jx, fleetC[1] + jy, { color: 'var(--roc)', ms: 480 }));
    }
  }
  const sunk = ships.slice(st.fleet, prev.fleet);
  sunk.forEach((s, i) => {
    const c = centre(s); if (!c) return;
    wait(420 + i * 80).then(() => { if (g !== gen) return; burst(fx, c[0], c[1], { color: 'var(--warn)', n, r: 18 }); });
  });
  if (sunk.length) { const fl = svg.querySelector('.pg-fleet'); wait(460).then(() => g === gen && fl?.isConnected && shake(fl)); }

  // The lodgment: a ping when troops land or advance, sparks when it takes losses.
  const lodge = centre(svg.querySelector('.pg-lodge circle'));
  if (lodge) {
    if (st.progress > prev.progress) wait(300).then(() => g === gen && ping(fx, lodge[0], lodge[1], { color: 'var(--accent)', r: 46, width: rich ? 3 : 2 }));
    else if (st.ashore > prev.ashore + 0.01) wait(300).then(() => g === gen && ping(fx, lodge[0], lodge[1], { color: 'var(--prc)', r: 34 }));
    if (st.ashore < prev.ashore - 0.01 && prev.ashore > 0.05) wait(360).then(() => g === gen && burst(fx, lodge[0], lodge[1], { color: 'var(--roc)', n: Math.round(n * 0.7), r: 22 }));
  }
  if (st.airfield !== prev.airfield) {
    const af = centre(svg.querySelector('.pg-af'));
    if (af) wait(250).then(() => g === gen && (st.airfield === 'wrecked' ? burst(fx, af[0], af[1], { color: 'var(--warn)', n, r: 24 }) : ping(fx, af[0], af[1], { color: 'var(--prc)', r: 36 })));
  }
  if (game.outcome === 'pla' && game.wonAt === view) {
    const t = centre(svg.querySelector('.pg-town'));
    if (t) wait(350).then(() => { if (g !== gen) return; burst(fx, t[0], t[1], { color: 'var(--prc)', n: n + 6, r: 34, ms: 800 }); ping(fx, t[0], t[1], { color: 'var(--accent)', r: 60, width: 3, ms: 1100 }); });
  }
}

/** Readout values that changed count to their new value (numbers with a unit) or flash (everything else). */
function counts(readout, before) {
  const dds = [...readout.querySelectorAll('dd')];
  dds.forEach((dd, i) => {
    const was = before[i], now = dd.textContent;
    if (was == null || was === now) return;
    const m = now.match(/^(-?[\d.]+) (pts|days)$/), w = was.match(/^(-?[\d.]+) (pts|days)$/);
    if (m && w) countUp(dd, +m[1], { from: +w[1], ms: 600, fmt: v => `${f2(v)} ${m[2]}` });
    flash(dd);
  });
}

/** Monte Carlo card: the outcome bar and the capture curve grow in, the shares count up. */
export function mc(card) {
  if (!FX || reduced()) return;
  const grow = [...card.querySelectorAll('.mc-bar .seg')].map(s => [s, 'width', s.style.width]);
  grow.push(...[...card.querySelectorAll('.cb-b')].map(s => [s, 'height', s.style.height]));
  grow.push(...[...card.querySelectorAll('td.dbar span')].map(s => [s, 'width', s.style.width]));
  grow.forEach(([s, p]) => { s.classList.add('pg-grow'); s.style[p] = '0%'; });
  requestAnimationFrame(() => requestAnimationFrame(() => grow.forEach(([s, p, v]) => { s.style[p] = v; })));
  card.querySelectorAll('.mc-leg b.num').forEach(b => { const v = parseFloat(b.textContent); countUp(b, v, { from: 0, ms: 600, fmt: x => `${Math.round(x)}%` }); });
}

/** A short flash on the status box when the headline changes. */
export function status(el, before) { if (FX && before && before !== el.textContent) flash(el); }

/** Wire the buttons that fire a turn to pulse. */
export function wire(buttons) { if (FX) buttons.forEach(b => b?.addEventListener('click', () => pulse(b))); }
