// Module A view: audience-cost crisis game. Game tree, (a, p) region plot, and the side panel.
import { solveCrisis, typeInfo, muStar, A_CLASSES } from './models/crisis.js';
import { el, f2, pct, clamp, slider, sec, frame, axes, regionRaster, dragPlot, legend, tex } from './ui.js';

const SLIDERS = [
  { key: 'p', label: 'Prior that S is resolute', math: 'p', min: 0.01, max: 0.99, step: 0.01, help: 'What R believes before the crisis.' },
  { key: 'a', label: 'Audience cost of backing down', math: 'a', min: 0, max: 1.5, step: 0.01, help: 'Paid by S only if it threatens publicly and then retreats.' },
  { key: 'q', label: 'S wins a war with probability', math: 'q', min: 0.1, max: 0.9, step: 0.01 },
  { key: 'cL', label: 'Resolute type’s war cost', math: 'c<sub>L</sub>', min: 0, max: 0.89, step: 0.01, help: 'Kept below q, so war is worth fighting for this type.' },
  { key: 'cH', label: 'Irresolute type’s war cost', math: 'c<sub>H</sub>', min: 0.11, max: 2, step: 0.01, help: 'Kept above q, so this type would rather not fight.' },
  { key: 'cR', label: 'R’s war cost', math: 'c<sub>R</sub>', min: 0, max: 1.5, step: 0.01, help: 'If q + c<sub>R</sub> ≤ 1, R prefers war to conceding.' },
];
const A_MAX = 1.5;

export function mountA(stage, panel, S, changed) {
  stage.innerHTML = `
    <div class="card fig">
      <div class="fig-h"><p class="eyebrow">Game tree · equilibrium play highlighted</p><p class="fine">Payoffs are (S, R): what each side ends up with, where the stake is worth 1. Line weight shows how likely each move is.</p><p class="fine swipe">Swipe sideways to see the whole tree.</p></div>
      <div class="treewrap"><svg id="a-tree" class="tree" role="img" aria-label="Game tree of the crisis game with the equilibrium path highlighted"></svg></div>
    </div>
    <div class="card fig">
      <div class="fig-h"><p class="eyebrow">Which equilibrium, by audience cost and prior</p>
        <div class="seg" role="group" aria-label="Color the map by">
          <button type="button" data-c="eq" aria-pressed="true">Equilibrium</button><button type="button" data-c="war" aria-pressed="false">Chance of war</button></div></div>
      <svg id="a-region" class="region" role="img" aria-label="Region plot: audience cost on the horizontal axis, prior on the vertical axis. Click or drag to move the current point."></svg>
      <div class="legend" id="a-legend"></div>
    </div>`;
  const P = S.A;
  const status = sec(panel, 'Equilibrium');
  status.insertAdjacentHTML('beforeend', `<div class="status" id="a-status"><b></b><span></span></div><p class="why" id="a-why"></p>`);
  const ro = sec(panel, 'Readout');
  ro.insertAdjacentHTML('beforeend', `<dl class="readout" id="a-read"></dl><div class="bayes"><p class="fine">R’s posterior after a threat (Bayes’ rule)</p><div id="a-bayes"></div></div>`);
  const ctl = sec(panel, 'Parameters');
  const sl = {};
  for (const s of SLIDERS) sl[s.key] = slider(ctl, s, P[s.key], v => { P[s.key] = v; fixTypes(s.key); changed(); });
  ctl.insertAdjacentHTML('beforeend', `<p class="fine">All values are abstract utilities on a scale where the stake is worth 1. They illustrate the logic; they are not estimates of any real government’s costs.</p>`);

  function fixTypes(k) {
    if (P.cL >= P.q) P.cL = Math.max(0, +(P.q - 0.01).toFixed(2));
    if (P.cH <= P.q) P.cH = +(P.q + 0.01).toFixed(2);
    sl.cL.setMax((P.q - 0.01).toFixed(2)); sl.cH.setMin((P.q + 0.01).toFixed(2));
    if (k !== 'cL') sl.cL.set(P.cL);
    if (k !== 'cH') sl.cH.set(P.cH);
  }
  fixTypes();

  let colorBy = 'eq';
  stage.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    colorBy = b.dataset.c;
    stage.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));

  const regionSvg = stage.querySelector('#a-region');
  let F = null;
  dragPlot(regionSvg, () => F, (x, y) => {
    P.a = +clamp(x, 0, A_MAX).toFixed(2); P.p = +clamp(y, 0.01, 0.99).toFixed(2);
    sl.a.set(P.a); sl.p.set(P.p); changed();
  });

  function render() {
    for (const s of SLIDERS) sl[s.key].set(P[s.key]);
    const all = solveCrisis(P), e = all[0];
    drawTree(stage.querySelector('#a-tree'), P, e);
    F = drawRegion(regionSvg, P, colorBy);
    legend(stage.querySelector('#a-legend'), colorBy === 'eq'
      ? Object.entries(A_CLASSES).filter(([k]) => k !== 'war').map(([, c]) => [c.col, c.label, c.short])
      : [['--bad', 'Darker = war more likely']]);
    panelText(P, e, all);
  }

  function panelText(P, e, all) {
    const box = panel.querySelector('#a-status'), c = A_CLASSES[e.cls];
    box.dataset.s = e.pWar > 0.2 ? 'bad' : e.pWar > 0 ? 'warn' : 'good';
    box.querySelector('b').textContent = c.label;
    box.querySelector('span').textContent = c.short;
    const T = typeInfo(P), ms = muStar(P);
    panel.querySelector('#a-why').innerHTML = why(P, e, T, ms) + (all.length > 1 ? ` <em>Other equilibria exist at these values.</em>` : '')
      + (P.a === 0 && e.cls === 'semi' ? ' <em>At a = 0 the irresolute type is indifferent, so any higher bluff rate is also an equilibrium; the tool shows the lowest.</em>' : '');
    panel.querySelector('#a-read').innerHTML = [
      ['R concedes if Pr(fight) ≥', ms >= 1 ? 'never (R prefers war)' : f2(ms)],
      ['Irresolute type fights?', T.H.fight ? 'yes, hands tied' : `no, backs down (a < ${f2(P.cH - P.q)})`],
      ['Irresolute threatens', pct(e.sigma.H)],
      ['R resists a threat', pct(e.rho)],
      ['Pr(threat)', pct(e.pThreat)],
      ['Pr(war)', pct(e.pWar)],
      ['Pr(S backs down)', pct(e.pBack)],
      ['Pr(R concedes)', pct(e.pConcede)],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const sL = e.sigma.L, sH = e.sigma.H, den = P.p * sL + (1 - P.p) * sH;
    const node = panel.querySelector('#a-bayes');
    if (den > 0) {
      const post = P.p * sL / den;
      tex(node, `\\mu=\\frac{p\\,\\sigma_L}{p\\,\\sigma_L+(1-p)\\,\\sigma_H}=\\frac{${f2(P.p * sL)}}{${f2(P.p * sL)}+${f2(1 - P.p)}\\cdot${f2(sH)}}=${f2(post)}`, true);
    } else tex(node, `\\text{No threat on the path of play; R\\text{'}s belief after one is not pinned down by Bayes\\text{'} rule.}`, true);
  }
  return { render };
}

function why(P, e, T, ms) {
  if (e.cls === 'commit') return `Backing down would cost S more than fighting (a = ${f2(P.a)} ≥ c<sub>H</sub> − q = ${f2(P.cH - P.q)}). Both types would fight, so R believes the threat and concedes. The audience cost is never paid.`;
  if (e.cls === 'pool') return `R already thinks S is likely resolute (p = ${f2(P.p)} ≥ ${f2(ms)}). Resisting is not worth the risk, so R concedes to any threat, and the irresolute type bluffs freely.`;
  if (e.cls === 'semi') return `Pure bluffing fails because R would call it, and pure honesty fails because R would then concede and bluffing would pay. The irresolute type bluffs just often enough (${pct(e.sigma.H)}) to leave R indifferent, and R resists just often enough (${pct(e.rho)} = 1/(1+a)) to leave the bluffer indifferent. A higher audience cost lowers how often R has to call.`;
  if (e.cls === 'sep') return `R prefers war to conceding (q + c<sub>R</sub> = ${f2(P.q + P.cR)} ≤ 1), so it resists every threat. Only the resolute type threatens, and every threat ends in war.`;
  if (e.cls === 'quiet') return 'No type gains from threatening, so the status quo holds.';
  return 'Both types would fight and R resists anyway.';
}

// ---- Game tree -------------------------------------------------------------------------------
function drawTree(svg, P, e) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '0 0 760 430');
  const T = typeInfo(P), gE = el('g', {}, svg), g = el('g', {}, svg), gN = el('g', {}, svg);
  const w = pr => 1.2 + 5 * pr;
  const edge = (x1, y1, x2, y2, label, prob, reach, anchorEnd = false) => {
    const on = reach * prob > 0.001;
    el('line', { x1, y1, x2, y2, class: 'edge' + (on ? ' on' : ''), 'stroke-width': on ? w(prob) : 1.2 }, gE);
    const len = Math.hypot(x2 - x1, y2 - y1), nx = (y1 - y2) / len, ny = (x2 - x1) / len;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, o = y2 > y1 + 1 ? 1 : -1;
    const t = anchorEnd
      ? el('text', { x: mx + 6, y: my + (o > 0 ? -12 : 24), class: 'el', 'text-anchor': 'start' }, g, label + ' ')
      : el('text', { x: mx + o * nx * 12, y: my + o * ny * 12 + (o > 0 ? 9 : 0), class: 'el', 'text-anchor': 'middle' }, g, label + ' ');
    if (prob != null) el('tspan', { class: 'ep' + (on ? ' on' : '') }, t, pct(prob));
  };
  const node = (x, y, lbl, cls = '') => { el('circle', { cx: x, cy: y, r: 13, class: 'nd ' + cls }, gN); el('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'nl' }, gN, lbl); };
  const leaf = (x, y, s, r, name, reach) => {
    el('text', { x, y: y - 3, class: 'lf-n' + (reach > 0.001 ? ' on' : '') }, g, name);
    el('text', { x, y: y + 12, class: 'lf' + (reach > 0.001 ? ' on' : '') }, g, `(${f2(s)}, ${f2(r)})`);
    if (reach > 0.001) el('text', { x: x + 128, y: y + 12, class: 'lf-p', 'text-anchor': 'end' }, g, pct(reach));
  };
  node(36, 215, 'N', 'nat');
  const blocks = [['L', 108, 'Resolute', P.p], ['H', 322, 'Irresolute', 1 - P.p]];
  for (const [t, y0, name, pr] of blocks) {
    const sg = e.sigma[t], rho = e.rho, fight = T[t].fight, c = t === 'L' ? P.cL : P.cH;
    edge(36, 215, 150, y0, name, pr, 1, true);
    node(150, y0, 'S');
    edge(150, y0, 330, y0 - 64, 'Quiet', 1 - sg, pr);
    leaf(340, y0 - 64, 0, 0, 'Status quo', pr * (1 - sg));
    edge(150, y0, 300, y0 + 22, 'Threaten', sg, pr);
    node(300, y0 + 22, 'R', 'r');
    edge(300, y0 + 22, 440, y0 - 16, 'Concede', 1 - rho, pr * sg);
    leaf(450, y0 - 16, 1, -1, 'S gets the stake', pr * sg * (1 - rho));
    edge(300, y0 + 22, 450, y0 + 56, 'Resist', rho, pr * sg);
    node(450, y0 + 56, 'S');
    const reach = pr * sg * rho;
    edge(450, y0 + 56, 590, y0 + 26, 'Back down', fight ? 0 : 1, reach);
    leaf(600, y0 + 26, -P.a, 0, 'Audience cost', fight ? 0 : reach);
    edge(450, y0 + 56, 590, y0 + 90, 'Fight', fight ? 1 : 0, reach);
    leaf(600, y0 + 90, P.q - c, -P.q - P.cR, 'War', fight ? reach : 0);
  }
  el('path', { d: 'M300 143 C 322 220, 322 280, 300 331', class: 'infoset' }, gE);
  el('text', { x: 326, y: 232, class: 'el' }, g, 'Information set: R cannot tell the types apart');
}

// ---- Region plot -----------------------------------------------------------------------------
function drawRegion(svg, P, colorBy) {
  const F = frame(svg, { W: 760, H: 270, m: { l: 52, r: 14, t: 12, b: 42 }, x: [0, A_MAX], y: [0, 1] });
  regionRaster(F, 150, 60, (a, p) => {
    const e = solveCrisis({ ...P, a, p })[0];
    return colorBy === 'eq' ? { key: e.cls } : { key: 'war', alpha: 0.04 + 0.8 * e.pWar };
  }, colorBy === 'eq' ? Object.fromEntries(Object.entries(A_CLASSES).map(([k, c]) => [k, c.col])) : { war: '--bad' });
  const { g, sx, sy } = F, aTie = P.cH - P.q, ms = 1 / (P.q + P.cR);
  if (aTie <= A_MAX && ms < 1) {
    el('line', { x1: sx(aTie), x2: sx(aTie), y1: sy(0), y2: sy(1), class: 'bound' }, g);
    el('text', { x: sx(aTie) + 5, y: sy(0.96), class: 'bl' }, g, 'a = cₕ − q');
  }
  if (ms < 1) {
    el('line', { x1: sx(0), x2: sx(Math.min(aTie, A_MAX)), y1: sy(ms), y2: sy(ms), class: 'bound' }, g);
    el('text', { x: sx(0) + 5, y: sy(ms) - 5, class: 'bl' }, g, 'p = 1/(q + cᵣ)');
  }
  axes(F, { xt: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5], yt: [0, 0.25, 0.5, 0.75, 1], xl: 'Audience cost a', yl: 'Prior p (resolute)' });
  el('circle', { cx: sx(P.a), cy: sy(P.p), r: 7, class: 'mark' }, g);
  return F;
}
