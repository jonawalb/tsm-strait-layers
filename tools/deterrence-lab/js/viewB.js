// Module B view: tying hands versus sinking costs.
import { solveSignal, noBluffSize, maxSize, committed, B_CLASSES } from './models/signal.js';
import { el, f2, pct, clamp, slider, choices, sec, frame, axes, regionRaster, dragPlot, legend, tex } from './ui.js';

const SLIDERS = [
  { key: 'k', label: 'Signal size', math: 's', min: 0, max: 1.2, step: 0.01, help: 'Sunk cost k paid up front, or hands-tying cost a paid only on retreat.' },
  { key: 'p', label: 'Prior that S is resolute', math: 'p', min: 0.02, max: 0.98, step: 0.01 },
  { key: 'vI', label: 'Irresolute type’s value of the stake', math: 'v<sub>I</sub>', min: 0.05, max: 0.95, step: 0.01, help: 'The resolute type values it at 1. Kept below c.' },
  { key: 'c', label: 'S’s cost of war', math: 'c', min: 0.1, max: 1, step: 0.01, help: 'Kept at or below 1, so the resolute type will fight.' },
  { key: 'P0', label: 'Share of R types that want war anyway', math: 'P<sub>0</sub>', min: 0, max: 0.6, step: 0.01, help: 'R’s war cost is uniform; this share has a negative cost.' },
  { key: 'H', label: 'R’s highest war cost', math: 'c̄<sub>R</sub>', min: 0.2, max: 5, step: 0.05 },
];
const TECH = [
  { v: 'sunk', t: 'Sink costs', s: 'Mobilize: pay k now, win or lose' },
  { v: 'tied', t: 'Tie hands', s: 'Commit publicly: pay a only on retreat' },
];

export function mountB(stage, panel, S, changed) {
  stage.innerHTML = `
    <div class="card fig">
      <div class="fig-h"><p class="eyebrow">What a signal of this size does</p><p class="fine">Current size marked. Dashed line: smallest size at which no signaler would back down.</p></div>
      <svg id="b-lines" class="lines" role="img" aria-label="Line chart of posterior belief, bluff rate and chance of war against signal size"></svg>
      <div class="legend" id="b-lleg"></div>
    </div>
    <div class="card fig">
      <div class="fig-h"><p class="eyebrow">Which equilibrium, by signal size and prior</p><p class="fine">Click or drag to move the point.</p></div>
      <svg id="b-region" class="region" role="img" aria-label="Region plot of equilibrium type by signal size and prior. Click or drag to move."></svg>
      <div class="legend" id="b-leg"></div>
    </div>`;
  const P = S.B;
  const tsec = sec(panel, 'Signal technology');
  const tech = choices(tsec, TECH, P.tech, v => { P.tech = v; changed(); }, 'Signal technology');
  const status = sec(panel, 'Equilibrium');
  status.insertAdjacentHTML('beforeend', `<div class="status" id="b-status"><b></b><span></span></div><p class="why" id="b-why"></p>
    <div class="bayes"><p class="fine">R’s posterior after seeing the signal (Bayes’ rule)</p><div id="b-bayes"></div></div>
    <dl class="readout" id="b-read"></dl>`);
  const ctl = sec(panel, 'Parameters');
  const sl = {};
  for (const s of SLIDERS) sl[s.key] = slider(ctl, s, P[s.key], v => { P[s.key] = v; fix(s.key); changed(); });
  const jump = document.createElement('button');
  jump.type = 'button'; jump.className = 'btn'; jump.textContent = 'Set the smallest bluff-proof signal';
  ctl.insertBefore(jump, ctl.children[2]);
  jump.addEventListener('click', () => { P.k = +Math.min(maxSize(P), noBluffSize(P) + 0.005).toFixed(3); changed(); });
  const cmp = sec(panel, 'Fearon’s comparison');
  cmp.insertAdjacentHTML('beforeend', `<p class="fine">Each technology at its smallest bluff-proof size, same parameters.</p><div class="tablewrap"><table class="mini" id="b-cmp"></table></div>`);

  function fix(k) {
    if (P.vI >= P.c) { if (k === 'vI') P.c = Math.min(1, +(P.vI + 0.01).toFixed(2)); else P.vI = Math.max(0.05, +(P.c - 0.01).toFixed(2)); }
    if (P.vI >= P.c) P.vI = +(P.c - 0.01).toFixed(2);
  }

  const lineSvg = stage.querySelector('#b-lines'), regSvg = stage.querySelector('#b-region');
  let FR = null, FL = null;
  dragPlot(regSvg, () => FR, (x, y) => { P.k = +clamp(x, 0, maxSize(P)).toFixed(2); P.p = +clamp(y, 0.02, 0.98).toFixed(2); changed(); });
  dragPlot(lineSvg, () => FL, x => { P.k = +clamp(x, 0, maxSize(P)).toFixed(2); changed(); });

  function render() {
    tech.set(P.tech);
    sl.k.setMax(maxSize(P).toFixed(2));
    for (const s of SLIDERS) sl[s.key].set(P[s.key]);
    const all = solveSignal(P, P.k), e = all[0];
    FL = drawLines(lineSvg, P);
    FR = drawRegion(regSvg, P);
    legend(stage.querySelector('#b-lleg'), [['--c1', 'Pr(resolute | signal)'], ['--c2', 'Irresolute signals'], ['--bad', 'Pr(war)']]);
    legend(stage.querySelector('#b-leg'), Object.entries(B_CLASSES).filter(([k]) => P.tech === 'tied' || k !== 'commit').map(([, c]) => c).map(c => [c.col, c.label, c.short]));
    panelText(P, e, all);
    compare(P);
  }

  function panelText(P, e, all) {
    const box = panel.querySelector('#b-status'), c = B_CLASSES[e.cls];
    box.dataset.s = e.cls === 'sep' || e.cls === 'commit' ? 'good' : e.cls === 'silent' ? 'bad' : 'warn';
    box.querySelector('b').textContent = c.label;
    box.querySelector('span').textContent = c.short;
    const others = all.slice(1).filter(x => x.cls !== 'silent' || x.ic);
    panel.querySelector('#b-why').innerHTML = why(P, e) + (others.length && e.cls !== 'silent'
      ? ` <em>Also an equilibrium: ${others.map(x => B_CLASSES[x.cls].label.toLowerCase()).join(', ')}${others.some(x => x.cls === 'silent') ? ' (silence survives the Intuitive Criterion here)' : ''}.</em>` : '');
    const node = panel.querySelector('#b-bayes');
    if (e.sR + e.sI > 0) tex(node, `\\mu=\\frac{p\\,\\sigma_R}{p\\,\\sigma_R+(1-p)\\,\\sigma_I}=\\frac{${f2(P.p * e.sR)}}{${f2(P.p * e.sR)}+${f2(1 - P.p)}\\cdot${f2(e.sI)}}=${f2(e.post)}`, true);
    else tex(node, `\\text{Nobody signals, so R\\text{'}s belief stays at } p=${f2(P.p)}`, true);
    panel.querySelector('#b-read').innerHTML = [
      ['R pushes after a signal', e.pi == null ? '–' : pct(e.pi)],
      ['Pr(S fights | signal)', e.phi == null ? '–' : pct(e.phi)],
      ['Irresolute signals', pct(e.sI)],
      ['Pr(war)', pct(e.pWar)],
      ['Pr(bluff called)', pct(e.pBluffCalled)],
      ['Expected cost paid', f2(e.cost)],
      ['S’s expected payoff', f2(e.uAvg)],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  }

  function compare(P) {
    const rows = ['sunk', 'tied'].map(t => {
      const Q = { ...P, tech: t }, s = Math.min(maxSize(Q), noBluffSize(Q) + 1e-6), e = solveSignal(Q, s)[0];
      return { t, s, e };
    });
    panel.querySelector('#b-cmp').innerHTML = `<thead><tr><th></th><th>Sink costs</th><th>Tie hands</th></tr></thead><tbody>${[
      ['Size', r => f2(r.s)], ['Outcome', r => B_CLASSES[r.e.cls].label], ['Pr(war)', r => pct(r.e.pWar)],
      ['Cost paid', r => f2(r.e.cost)], ['S payoff', r => f2(r.e.uAvg)],
    ].map(([k, fn]) => `<tr><td>${k}</td><td class="num">${fn(rows[0])}</td><td class="num">${fn(rows[1])}</td></tr>`).join('')}</tbody>`;
  }
  return { render };
}

function why(P, e) {
  const k = f2(P.k);
  if (P.tech === 'sunk') {
    if (e.cls === 'sep') return `At k = ${k} the irresolute type would pay more than it could gain (k ≥ (1 − P₀)v<sub>I</sub> = ${f2((1 - P.P0) * P.vI)}), while the resolute type still profits (k ≤ (1 − P₀)c = ${f2((1 - P.P0) * P.c)}). The signal tells R the type. The price is that the resolute type burns k every time.`;
    if (e.cls === 'semi') return `The signal is cheap enough that bluffing sometimes pays. The irresolute type signals ${pct(e.sI)} of the time, which keeps R pushing with probability 1 − k/v<sub>I</sub> = ${pct(e.pi)} and makes the bluffer indifferent.`;
    if (e.cls === 'pool') return 'The signal is so cheap that both types send it. R learns nothing.';
    return `Even the resolute type would not pay k = ${k}: fighting when pushed is cheaper than signaling.`;
  }
  if (e.cls === 'commit') return `a = ${k} ≥ c − v<sub>I</sub> = ${f2(P.c - P.vI)}: retreat now costs the irresolute type more than war. Every signaler fights if pushed, so only the receivers who want war anyway push. No one bluffs, and no cost is paid unless war comes.`;
  if (e.cls === 'sep') return 'Hands are tied tightly enough that the irresolute type expects to be pushed often by war-seeking receivers and stays silent. The signal reveals the type.';
  if (e.cls === 'semi') return `The bond is too weak to commit the irresolute type (a < c − v<sub>I</sub>), so it bluffs ${pct(e.sI)} of the time. R pushes with probability v<sub>I</sub>/(v<sub>I</sub> + a) = ${pct(e.pi)}, and when it does the bluffer backs down and pays a.`;
  if (e.cls === 'pool') return 'A costless public commitment is cheap talk: both types make it and R ignores it.';
  return 'No one ties hands.';
}

function drawLines(svg, P) {
  const mx = maxSize(P);
  const F = frame(svg, { W: 760, H: 280, m: { l: 52, r: 14, t: 12, b: 42 }, x: [0, mx], y: [0, 1] });
  const { g, sx, sy } = F, n = 240, pts = { post: [], sI: [], war: [] };
  const bands = [];
  for (let i = 0; i <= n; i++) {
    const s = mx * i / n, e = solveSignal(P, s)[0];
    pts.post.push([s, e.post]); pts.sI.push([s, e.sI]); pts.war.push([s, e.pWar]);
    if (!bands.length || bands[bands.length - 1].cls !== e.cls) bands.push({ cls: e.cls, s0: s });
  }
  bands.forEach((b, i) => {
    const s1 = i + 1 < bands.length ? bands[i + 1].s0 : mx;
    el('rect', { x: sx(b.s0), y: sy(1), width: Math.max(0, sx(s1) - sx(b.s0)), height: sy(0) - sy(1), fill: `var(${B_CLASSES[b.cls].col})`, 'fill-opacity': 0.14 }, g);
  });
  const path = arr => { let d = '', pen = false; for (const [x, y] of arr) { if (y == null) { pen = false; continue; } d += (pen ? 'L' : 'M') + `${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`; pen = true; } return d; };
  el('path', { d: path(pts.post), class: 'ln', stroke: 'var(--c1)' }, g);
  el('path', { d: path(pts.sI), class: 'ln', stroke: 'var(--c2)' }, g);
  el('path', { d: path(pts.war), class: 'ln', stroke: 'var(--bad)' }, g);
  const nb = noBluffSize(P);
  if (nb <= mx) el('line', { x1: sx(nb), x2: sx(nb), y1: sy(0), y2: sy(1), class: 'bound' }, g);
  if (P.tech === 'tied' && committed(P, mx)) el('text', { x: sx(P.c - P.vI) + 5, y: sy(0.95), class: 'bl' }, g, 'a = c − vᵢ');
  axes(F, { xt: ticks(mx), yt: [0, 0.25, 0.5, 0.75, 1], xl: P.tech === 'sunk' ? 'Sunk cost k' : 'Hands-tying cost a', yl: 'Probability', yf: v => pct(v) });
  el('line', { x1: sx(P.k), x2: sx(P.k), y1: sy(0), y2: sy(1), class: 'now' }, g);
  return F;
}

function drawRegion(svg, P) {
  const mx = maxSize(P);
  const F = frame(svg, { W: 760, H: 300, m: { l: 52, r: 14, t: 12, b: 42 }, x: [0, mx], y: [0, 1] });
  regionRaster(F, 140, 50, (s, p) => ({ key: solveSignal({ ...P, p }, s)[0].cls }),
    Object.fromEntries(Object.entries(B_CLASSES).map(([k, c]) => [k, c.col])));
  axes(F, { xt: ticks(mx), yt: [0, 0.25, 0.5, 0.75, 1], xl: P.tech === 'sunk' ? 'Sunk cost k' : 'Hands-tying cost a', yl: 'Prior p (resolute)' });
  el('circle', { cx: F.sx(P.k), cy: F.sy(P.p), r: 7, class: 'mark' }, F.g);
  return F;
}

const ticks = mx => { const st = mx > 1 ? 0.25 : 0.2, t = []; for (let v = 0; v <= mx + 1e-9; v += st) t.push(+v.toFixed(2)); return t; };
