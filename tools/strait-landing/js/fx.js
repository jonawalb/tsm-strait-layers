// Motion for Strait Landing (both sites): ship groups crossing the lanes, missile
// salvos as tracers from the Taiwan side with a burst for each hit, mine strikes, the build-up race chart drawing
// its newest leg, and the sea-state strip turning over its new cell. Presentation only: the numbers are already
// on the page before any of this runs, and nothing waits on it. Off under reduced motion.
import { ZONES, ZONE_KEYS } from '../data/params.js';
import { reveal, pulse, shake, flash, ping, burst, tracer, reduced } from '../../../shared/js/motion.js';

export const FX = true;
document.documentElement.classList.add('sl-fx');

const NS = 'http://www.w3.org/2000/svg';
const trailer = () => document.documentElement.dataset.skin === 'trailer';
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeInOut = u => (u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
let gen = 0;

function layer(svg) {
  let g = svg.querySelector(':scope > g.sl-fxg');
  if (!g) { g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'sl-fxg'); g.setAttribute('pointer-events', 'none'); }
  svg.appendChild(g);
  return g;
}
function mk(tag, attrs, parent) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; }
const zoneOf = s => ZONE_KEYS.find(z => s.includes(ZONES[z].area));

/** Ship groups sailing a lane: small marks that run from the Fujian end to the waiting area off the coast. */
function convoy(fx, from, to, amph, ferry, g) {
  const n = Math.min(amph + ferry, 8), nA = Math.min(amph, Math.round(n * amph / Math.max(1, amph + ferry)));
  const dx = to[0] - from[0], dy = to[1] - from[1], L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
  for (let i = 0; i < n; i++) {
    const off = (i % 4 - 1.5) * 6, s = i < nA
      ? mk('circle', { r: 3.2, class: 'sl-fx-ship' }, fx)
      : mk('rect', { width: 6.4, height: 6.4, class: 'sl-fx-ferry' }, fx);
    const t0 = performance.now() + i * 55, ms = 820;
    const step = now => {
      if (g !== gen || !s.isConnected) { s.remove(); return; }
      const u = Math.max(0, Math.min(1, (now - t0) / ms)), e = easeInOut(u);
      const x = from[0] + dx * e + px * off, y = from[1] + dy * e + py * off;
      if (s.tagName === 'circle') { s.setAttribute('cx', x); s.setAttribute('cy', y); } else { s.setAttribute('x', x - 3.2); s.setAttribute('y', y - 3.2); }
      s.setAttribute('opacity', u < .1 ? u * 10 : u > .85 ? (1 - u) / .15 : 1);
      if (u < 1) requestAnimationFrame(step); else s.remove();
    };
    requestAnimationFrame(step);
  }
}

/** Numbers the motion layer compares before and after a turn. */
export function snap(G) {
  return { ashore: { ...G.ashore }, port: { ...G.port }, lost: G.stats.lostAmph + G.stats.lostFerry, launchers: G.launchers.filter(L => L.alive).length };
}

/** After a turn is resolved and drawn. */
export function turn({ pre, G, rows, geom, svg }) {
  if (!FX) return;
  const g = ++gen;
  svg.querySelector(':scope > g.sl-fxg')?.replaceChildren();
  const log = document.getElementById('log').firstElementChild;
  if (log) { log.classList.add('sl-fx-new'); log.querySelectorAll('li').forEach((li, i) => li.style.setProperty('--i', Math.min(i, 14))); }
  pulse(document.getElementById('resolve'));
  const st = document.getElementById('status');
  flash(st);
  if (G.stats.lostAmph + G.stats.lostFerry > pre.lost || G.launchers.filter(L => L.alive).length < pre.launchers) wait(500).then(() => g === gen && shake(st));
  race(document.getElementById('race'));
  if (reduced()) return;
  const fx = layer(svg), rich = trailer(), n = rich ? 16 : 11;
  const at = z => {
    const { from, mid, port } = geom(z);
    const dx = mid[0] - from[0], dy = mid[1] - from[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    return { from, mid, port, ux, uy, fleet: [mid[0] - ux * 30, mid[1] - uy * 30], inland: [mid[0] + ux * 46, mid[1] + uy * 46], bars: [mid[0] + 22, mid[1] - 14] };
  };
  let salvoAt = 0;
  for (const r of rows) {
    const z = zoneOf(r.ev); if (!z) continue;
    const A = at(z);
    if (r.ph === 'Sailing') {
      const m = r.ev.match(/^(\d+) amphibious and (\d+) ferry/);
      if (m) convoy(fx, A.from, A.fleet, +m[1], +m[2], g);
    } else if (r.ph === 'Missiles' && r.salvo) {
      // Streaks from the Taiwan side of the zone to the shipping offshore; one burst per hit.
      const streaks = Math.min(8, Math.max(1, Math.round(r.salvo.M))), hits = Math.min(r.salvo.hits, 10), d0 = 380 + salvoAt;
      salvoAt += 220;
      for (let i = 0; i < streaks; i++) {
        const j = (i % 4 - 1.5) * 7, k = (i % 3 - 1) * 8;
        wait(d0 + i * 60).then(() => g === gen && tracer(fx, A.inland[0] - A.uy * j, A.inland[1] + A.ux * j, A.fleet[0] + k, A.fleet[1] - k * .6, { color: 'var(--roc)', ms: 420 }));
      }
      for (let i = 0; i < hits; i++) {
        const a = i * 2.4, rr = 6 + (i % 3) * 5;
        wait(d0 + 420 + i * 70).then(() => g === gen && burst(fx, A.fleet[0] + Math.cos(a) * rr, A.fleet[1] + Math.sin(a) * rr, { color: 'var(--warn)', n, r: 16 }));
      }
    } else if (r.ph === 'Mines') {
      const lost = +(r.res.match(/^(\d+) lost/) || [0, 0])[1];
      for (let i = 0; i < Math.min(lost, 8); i++) {
        const x = A.mid[0] - A.ux * 14 + (i % 4 - 1.5) * 6 * -A.uy, y = A.mid[1] - A.uy * 14 + (i % 4 - 1.5) * 6 * A.ux;
        wait(700 + i * 80).then(() => g === gen && burst(fx, x, y, { color: 'var(--warn)', n: Math.round(n * .6), r: 11 }));
      }
    } else if (r.ph === 'Breakout') {
      wait(800).then(() => g === gen && ping(fx, A.bars[0], A.bars[1], { color: 'var(--accent)', r: 54, width: rich ? 3 : 2 }));
    }
  }
  for (const z of ZONE_KEYS) {
    const A = at(z), dA = G.ashore[z] - pre.ashore[z];
    if (dA > 0.05) wait(900).then(() => g === gen && ping(fx, A.bars[0], A.bars[1], { color: 'var(--prc)', r: 30 }));
    else if (dA < -0.05) wait(900).then(() => g === gen && burst(fx, A.bars[0], A.bars[1], { color: 'var(--roc)', n: Math.round(n * .7), r: 18 }));
    if (G.port[z] !== pre.port[z]) wait(950).then(() => g === gen && (G.port[z] === 'wrecked'
      ? burst(fx, A.port[0], A.port[1], { color: 'var(--warn)', n, r: 22 })
      : ping(fx, A.port[0], A.port[1], { color: 'var(--prc)', r: 34, width: rich ? 3 : 2 })));
  }
}

/** The race chart draws its newest leg, the new dots pop in and the new sea cell turns over. */
function race(svg) {
  if (!svg || reduced()) return;
  for (const cls of ['sl-lineA', 'sl-lineD']) {
    const pl = svg.querySelector('.' + cls); if (!pl) continue;
    const pts = pl.getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number));
    if (pts.length < 2) continue;
    const [a, b] = pts.slice(-2), seg = Math.hypot(b[0] - a[0], b[1] - a[1]), L = pl.getTotalLength();
    pl.style.strokeDasharray = `${L} ${L}`; pl.style.strokeDashoffset = seg;
    pl.getBoundingClientRect();
    pl.style.transition = 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)'; pl.style.strokeDashoffset = 0;
  }
  const dotsA = svg.querySelectorAll('.sl-dotA'), dotsD = svg.querySelectorAll('.sl-dotD');
  for (const d of [dotsA[dotsA.length - 1], dotsD[dotsD.length - 1]]) d?.classList.add('sl-fx-pop');
  svg.querySelector('.sl-afloat')?.classList.add('sl-fx-fade');
  const known = [...svg.querySelectorAll('.sl-seacell')].filter(c => c.dataset.b !== 'x');
  known[known.length - 1]?.classList.add('sl-fx-flip');
}

/** First launch: the Resolve button pulses. */
export function launch() {
  if (!FX) return;
  gen++;
  pulse(document.getElementById('resolve'));
}

/** After-action review: cards rise in, table rows stagger, and the 1,000-week bars grow from zero. */
export function aar() {
  if (!FX) return;
  reveal(document.querySelectorAll('#aar .status, #aar .sl-lede, #aar .sl-aarcard, #aar .sl-aar-actions'));
  document.querySelectorAll('#aar-table tbody tr').forEach((tr, i) => { tr.style.setProperty('--i', Math.min(i, 12)); tr.classList.add('sl-fx-row'); });
}
export function mc(out) {
  if (!FX || reduced()) return;
  const bars = [...out.querySelectorAll('.sl-mcbar i')].map(i => [i, i.style.width]);
  bars.forEach(([i]) => { i.classList.add('sl-fx-grow'); i.style.width = '0%'; });
  requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach(([i, w]) => { i.style.width = w; })));
}
