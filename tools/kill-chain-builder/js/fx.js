// Motion for Kill Chain Builder on Interactive Deterrence (and localhost) only. On TSM Interactive every
// export here is a no-op, so the tool there looks and behaves as before. Presentation only: effects are drawn
// on layers laid over the board and the timeline, never change a number, and are off under reduced motion.
//   before()        call at the start of an update, to remember what the readouts said
//   after(r, spof)  call once the board, panel and timeline have been redrawn
import { pulse, flash, shake, burst, ping, reduced } from '../../../shared/js/motion.js';
import { NW, NH } from './board.js';

export const MOTION = true; // Same motion on both sites (owner, 2026-09-30).
if (MOTION) document.documentElement.classList.add('kc-m');
const on = () => MOTION && !reduced();
const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const mk = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; };
const ease = u => 1 - (1 - u) ** 3;
const anim = (ms, frame) => new Promise(res => {
  const t0 = performance.now();
  const step = now => { const u = Math.min(1, (now - t0) / ms); frame(u); if (u < 1) requestAnimationFrame(step); else res(); };
  requestAnimationFrame(step);
});

// A layer over an SVG that lives inside a horizontally scrolling box, so effects outlive the SVG's redraws.
function layer(svg) {
  const box = svg.parentElement;
  let o = box.querySelector(':scope > svg.kc-fx');
  if (!o) {
    o = document.createElementNS(NS, 'svg');
    o.setAttribute('class', 'kc-fx'); o.setAttribute('aria-hidden', 'true');
    o.style.minWidth = getComputedStyle(svg).minWidth;
    box.appendChild(o);
  }
  o.setAttribute('viewBox', svg.getAttribute('viewBox'));
  return o;
}

const S0 = { ids: null, dead: new Set(), seeing: new Set(), closes: null, sig: '', read: [], nodes: null };
let prev = { ...S0 }, api = null, run = 0;

export function initFx(a) {
  api = a;
  if (!MOTION) return;
  // A pulse on the strike and preset buttons that were pressed.
  document.addEventListener('click', e => { const b = e.target.closest('[data-strike], #kc-choose, #kc-restore, [data-p]'); if (b && on()) pulse(b); });
}

export function before() {
  if (!MOTION) return;
  prev.read = [...document.querySelectorAll('#kc-read dd')].map(d => d.textContent);
}

const center = n => [n.x + NW / 2, n.y + NH / 2];

export function after(r) {
  if (!MOTION || !api) return;
  const { S } = api, board = $('kc-board');
  const ids = new Set(S.nodes.map(n => n.id)), seeing = new Set(r.seeing);
  const closes = !!(r.best && r.best.closes), sig = r.best ? r.best.p.join('>') + (closes ? '+' : '-') : '';
  const first = prev.ids == null;
  // A preset or a walkthrough step replaces the whole board (node ids restart at 0): treat it like a first view.
  const reload = !first && S.nodes !== prev.nodes && (S.nodes.length === 0 || S.nodes[0] !== prev.first);
  const was = prev;
  prev = { ids, dead: new Set(S.dead), seeing, closes, sig, read: [], nodes: S.nodes, first: S.nodes[0] };
  if (!on()) return;
  const fx = layer(board), byId = new Map(S.nodes.map(n => [n.id, n]));

  // Struck nodes burst; new nodes and sensors that just gained sight of the target ping.
  if (!reload) for (const id of S.dead) if (!was.dead.has(id) && byId.has(id)) { const [x, y] = center(byId.get(id)); burst(fx, x, y, { color: 'var(--bad)', n: 14, r: 42, ms: 700 }); }
  if (!first && !reload) for (const id of ids) if (!was.ids.has(id)) { const [x, y] = center(byId.get(id)); ping(fx, x, y, { color: 'var(--accent)', r: 70, ms: 700 }); }
  for (const id of seeing) if ((first || reload || !was.seeing.has(id)) && byId.has(id)) {
    const n = byId.get(id); ping(fx, n.x + NW, n.y + NH / 2, { color: 'var(--c7)', r: 54, ms: 900 });
  }

  // The chain status box: a shake when a strike breaks the chain, a flash whenever the verdict flips.
  const box = $('kc-status');
  if (!first && was.closes && !closes && S.dead.size > was.dead.size) shake(box);
  if (!first && was.closes !== closes) flash(box);
  // Readouts whose value changed.
  const dds = document.querySelectorAll('#kc-read dd');
  if (dds.length === was.read.length) dds.forEach((d, i) => { if (d.textContent !== was.read[i]) flash(d); });

  // A closing path (new, or a different one): run a tracer from the sensor through command to the shooter,
  // then race the clock along the timeline.
  if (closes && (sig !== was.sig || reload)) chainRun(board, fx, r.best.p, byId);
}

async function chainRun(board, fx, p, byId) {
  const my = ++run;
  const g = mk('g', { class: 'kc-run' }, fx);
  for (let i = 1; i < p.length; i++) {
    if (my !== run) break;
    const edge = board.querySelector(`.edge[data-a="${p[i - 1]}"][data-b="${p[i]}"]`);
    if (!edge) continue;
    const d = edge.getAttribute('d'), L = edge.getTotalLength();
    const glow = mk('path', { d, class: 'kc-trace-glow', 'stroke-dasharray': L, 'stroke-dashoffset': L }, g);
    const line = mk('path', { d, class: 'kc-trace', 'stroke-dasharray': L, 'stroke-dashoffset': L }, g);
    const head = mk('circle', { r: 4.5, class: 'kc-head' }, g);
    await anim(260, u => {
      const e = ease(u), off = L * (1 - e), pt = edge.isConnected ? edge.getPointAtLength(L * e) : null;
      line.setAttribute('stroke-dashoffset', off); glow.setAttribute('stroke-dashoffset', off);
      if (pt) { head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y); }
    });
    head.remove();
  }
  if (my === run) {
    const n = byId.get(p[p.length - 1]);
    if (n) burst(fx, n.x + NW / 2, n.y + NH / 2, { color: 'var(--accent)', n: 12, r: 46, ms: 650 });
    pulse($('kc-status'));
    raceClock();
  }
  await anim(500, u => g.setAttribute('opacity', 1 - u));
  g.remove();
}

/** A sweep along the timeline from the target's appearance to impact, then a ping on the impact point. */
async function raceClock() {
  const tl = $('kc-timeline'), imp = tl.querySelector('.impact');
  if (!imp) return;
  const fx = layer(tl), x0 = 12, x1 = +imp.getAttribute('cx'), y = +imp.getAttribute('cy'), ok = imp.classList.contains('in');
  const g = mk('g', {}, fx);
  const band = mk('rect', { x: x0, y: 22, width: 0, height: 26, class: 'kc-sweep-band' }, g);
  const hand = mk('line', { x1: x0, x2: x0, y1: 18, y2: 190, class: 'kc-sweep' }, g);
  await anim(700, u => { const x = x0 + (x1 - x0) * ease(u); hand.setAttribute('x1', x); hand.setAttribute('x2', x); band.setAttribute('width', x - x0); });
  ping(fx, x1, y, { color: ok ? 'var(--good)' : 'var(--bad)', r: 30, ms: 700 });
  await anim(350, u => g.setAttribute('opacity', 1 - u));
  g.remove();
}
