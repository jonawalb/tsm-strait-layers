// Information weight (lambda-hat) by theater: the benchmark strip, the profile likelihood and the fitted mixture.
import { vbw, el, esc, f3, lin, placeTip } from './util.js';

const CRIT = 3.841; // chi-square(1) 95% point
const npdf = (x, mu, sd) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

/** Profile points plus the MLE itself, sorted by lambda. */
export function stops(T) {
  return [...T.profile, { ...T.fit, mle: true }].sort((a, b) => a.lam - b.lam);
}

export function renderNull(svg, T) {
  const W = vbw(svg, 320, 560), H = 210, M = { l: 16, r: 16, t: 30, b: 30 };
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const X = lin(0, 1, M.l, W - M.r);
  el('rect', { x: X(T.null.q05), y: M.t - 6, width: Math.max(2, X(T.null.q95) - X(T.null.q05)), height: H - M.b - M.t + 6, class: 'band' }, svg);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) el('text', { x: X(v), y: H - 10, 'text-anchor': 'middle' }, svg, v.toFixed(2));
  el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, class: 'grid' }, svg);
  const cols = new Map();
  T.null.lam.forEach(v => { const k = Math.round(v * 50); cols.set(k, (cols.get(k) || 0) + 1); });
  const gap = Math.min(6.2, (H - M.b - M.t - 4) / Math.max(...cols.values()));
  const seen = new Map();
  for (const v of T.null.lam) {
    const k = Math.round(v * 50);
    const n = seen.get(k) || 0;
    seen.set(k, n + 1);
    el('circle', { cx: X(k / 50), cy: H - M.b - 4 - n * gap, r: Math.max(1.8, Math.min(2.7, gap / 2)), class: v >= T.fit.lam - 1e-9 ? 'nd hi' : 'nd' }, svg);
  }
  const lx = X(T.fit.lam);
  el('rect', { x: X(T.profileCI[0]), y: 8, width: Math.max(2, X(T.profileCI[1]) - X(T.profileCI[0])), height: 5, class: 'ci-bar' }, svg);
  el('line', { x1: lx, x2: lx, y1: 4, y2: H - M.b, class: 'lam-line' }, svg);
  el('text', { x: Math.min(lx + 6, W - 90), y: 22, class: 'lam-t' }, svg, `λ̂ = ${f3(T.fit.lam)}`);
}

export function renderProfile(svg, T, sel) {
  const W = vbw(svg, 320, 560), H = 210, M = { l: 40, r: 14, t: 14, b: 30 };
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pts = stops(T);
  const top = T.fit.loglik;
  const lr = p => Math.max(0, 2 * (top - p.loglik));
  const ymax = Math.max(CRIT * 2.2, Math.min(40, Math.max(...pts.map(lr))));
  const X = lin(0, 1, M.l, W - M.r), Y = lin(0, ymax, H - M.b, M.t);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) el('text', { x: X(v), y: H - 10, 'text-anchor': 'middle' }, svg, v.toFixed(2));
  el('line', { x1: M.l, x2: W - M.r, y1: Y(CRIT), y2: Y(CRIT), class: 'crit' }, svg);
  el('text', { x: W - M.r, y: Y(CRIT) - 5, 'text-anchor': 'end', class: 'crit-t' }, svg, '95% cut-off');
  el('text', { x: M.l - 6, y: Y(0) + 4, 'text-anchor': 'end' }, svg, '0');
  el('text', { x: M.l - 6, y: Y(CRIT) + 4, 'text-anchor': 'end' }, svg, '3.8');
  el('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.lam).toFixed(1)} ${Y(Math.min(ymax, lr(p))).toFixed(1)}`).join(''), class: 'prof' }, svg);
  const s = pts[sel];
  el('circle', { cx: X(s.lam), cy: Y(Math.min(ymax, lr(s))), r: 5.5, class: 'prof-cur' }, svg);
  return { lr: lr(s), inside: lr(s) <= CRIT };
}

export function renderMixture(svg, tip, wrap, T, sel) {
  const W = vbw(svg, 340, 900), H = 260, M = { l: 14, r: 14, t: 16, b: 30 }, BW = 1;
  const span = Math.min(12, Math.max(5, Math.ceil(Math.max(...T.obs.map(o => Math.abs(o.m)))) + 1));
  const LO = -span, HI = span;
  svg.innerHTML = '';
  tip.hidden = true;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const s = stops(T)[sel];
  const X = lin(LO, HI, M.l, W - M.r);
  const cells = [{ y: 0, cls: 'h-l', label: 'resolved No' }, { y: 1, cls: 'h-h', label: 'resolved Yes' }];
  const counts = cells.map(c => {
    const h = new Map();
    for (const o of T.obs) {
      if (o.y !== c.y) continue;
      const b = Math.floor((Math.max(LO, Math.min(HI - 1e-6, o.m)) - LO) / BW);
      h.set(b, (h.get(b) || 0) + 1);
    }
    return h;
  });
  const nL = T.obs.filter(o => !o.y).length, nH = T.obs.length - nL;
  // Density scaled to counts per bin.
  const dens = (m, y) => (y
    ? (1 - s.lam) * npdf(m, s.beta_h ?? 0, 1) + s.lam * npdf(m, s.nu_h ?? 0, s.tau)
    : (1 - s.lam) * npdf(m, 0, 1) + s.lam * npdf(m, s.nu_l ?? 0, s.tau));
  let ymax = 1;
  counts.forEach(h => h.forEach(v => { ymax = Math.max(ymax, v); }));
  for (let m = LO; m <= HI; m += 0.1) ymax = Math.max(ymax, dens(m, 0) * nL * BW * 0.8);
  const Y = lin(0, ymax * 1.05, H - M.b, M.t);
  for (const v of [-10, -5, 0, 5, 10].filter(v => Math.abs(v) < span)) el('text', { x: X(v), y: H - 10, 'text-anchor': 'middle' }, svg, v > 0 ? `+${v}` : `${v}`);
  el('line', { x1: M.l, x2: W - M.r, y1: Y(0), y2: Y(0), class: 'grid' }, svg);
  cells.forEach((c, ci) => counts[ci].forEach((v, b) => {
    const x = X(LO + b * BW);
    const r = el('rect', { x: x + (c.y ? BW * 0.5 * (W - M.l - M.r) / (HI - LO) : 0) + 0.5, y: Y(v), width: (W - M.l - M.r) / (HI - LO) / (nH ? 2 : 1) - 1,
      height: Y(0) - Y(v), class: c.cls, tabindex: 0 }, svg);
    const show = () => {
      tip.innerHTML = `<b>${v} contract-event${v > 1 ? 's' : ''}</b><span class="tt-d">${c.label}, movement ${LO + b * BW} to ${LO + (b + 1) * BW} noise s.d.</span>`;
      const k = svg.getBoundingClientRect().width / W;
      placeTip(tip, wrap, (x + 6) * k, Y(v) * k);
    };
    r.addEventListener('pointerenter', show); r.addEventListener('focus', show);
    r.addEventListener('pointerleave', () => { tip.hidden = true; }); r.addEventListener('blur', () => { tip.hidden = true; });
  }));
  const curve = (y, n, cls, part) => {
    let d = '';
    for (let m = LO; m <= HI + 1e-9; m += 0.1) {
      const v = part === 'noise' ? (1 - s.lam) * npdf(m, y ? (s.beta_h ?? 0) : 0, 1)
        : part === 'inf' ? s.lam * npdf(m, y ? (s.nu_h ?? 0) : (s.nu_l ?? 0), s.tau) : dens(m, y);
      d += `${d ? 'L' : 'M'}${X(m).toFixed(1)} ${Y(v * n * BW).toFixed(1)}`;
    }
    el('path', { d, class: cls }, svg);
  };
  curve(0, nL, 'mx-noise', 'noise');
  curve(0, nL, 'mx-inf', 'inf');
  curve(0, nL, 'mx-all', 'all');
  if (nH) curve(1, nH, 'mx-all h', 'all');
  return s;
}

/** Plain-language reading per theater, following the paper's Results section. */
export function lamReading(key, T) {
  const sh = Math.round(T.null.shareGE * 100);
  const base = `λ̂ = ${f3(T.fit.lam)}, 95% profile interval ${f3(T.profileCI[0])}–${f3(T.profileCI[1])}, from ${T.n} contract-events on ${T.nContracts} contracts around ${T.nEvents} dated events. ${sh}% of 100 simulated markets with no informed traders produce an estimate at least this large.`;
  if (key === 'iran_israel') {
    return { s: 'warn', head: 'Weak evidence of informed flow', text: `${base} The estimate sits at the upper edge of that benchmark (one-sided p about 0.05). The nonparametric lower bound is ${f3(T.sharpLo)}, so without the normal-mixture form the data do not rule out a λ near zero, and the moment-based estimator's test rejects that form (J = ${T.gmm.J.toFixed(1)} on ${T.gmm.df} d.f.).` };
  }
  if (key === 'russia_ukraine') {
    return { s: 'good', head: 'No signal', text: `${base} The estimate lies well inside the benchmark: these contracts show no movement pattern around the war's major events that a public-news market could not produce. Every contract here resolved No.` };
  }
  return { s: 'bad', head: 'Premise fails: no information', text: `${base} In contracts that resolve No, informed traders should push prices down, but ${Math.round(T.sharePosML * 100)}% of movements around PLA exercises were upward (mean +${T.meanML.toFixed(2)} s.d.), which is what public news does. The sign restriction binds and the benchmark spans ${f3(T.null.q05)}–${f3(T.null.q95)}, so the estimate carries no information. The nonparametric lower bound is ${f3(T.sharpLo)}.` };
}
