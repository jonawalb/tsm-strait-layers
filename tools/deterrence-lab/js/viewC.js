// Module C view: salami tactics as a Kreps-Wilson reputation game.
import { simulate, expectations, firstProbeStage } from './models/reputation.js';
import { el, f2, pct, slider, choices, sec, frame, axes } from './ui.js';

const SLIDERS = [
  { key: 'N', label: 'Number of slices', math: 'N', min: 2, max: 25, step: 1, fmt: v => String(v) },
  { key: 'lp', label: 'Prior that the defender is tough', math: 'p<sub>0</sub>', min: -4, max: -0.3, step: 0.05, fmt: v => fmtP(10 ** v),
    help: 'Log scale. Tough defenders resist every slice, whatever it costs.' },
  { key: 'b', label: 'Challenger’s gain from an unresisted slice', math: 'b', min: 0.1, max: 0.95, step: 0.01, help: 'A resisted slice pays b − 1 < 0.' },
  { key: 'a', label: 'Weak defender’s value of a quiet round', math: 'a', min: 1.05, max: 5, step: 0.05, help: 'Resisting costs the weak defender 1; giving way costs 0.' },
];
const fmtP = p => p >= 0.1 ? p.toFixed(2) : p >= 0.01 ? p.toFixed(3) : p.toPrecision(2);
const TYPES = [{ v: '1', t: 'Weak defender', s: 'Would rather give way, if reputation did not matter' }, { v: '0', t: 'Tough defender', s: 'Resists every slice' }];

export function mountC(stage, panel, S, changed) {
  stage.innerHTML = `
    <div class="card fig">
      <div class="fig-h"><p class="eyebrow">Reputation, slice by slice</p><p class="fine">Dots: the reputation the challenger needs to see before it holds back. Line: the defender’s reputation in this draw.</p></div>
      <svg id="c-chart" class="lines" role="img" aria-label="Chart of the defender's reputation and the challenger's deterrence threshold over successive slices"></svg>
      <div class="legend" id="c-leg"></div>
    </div>
    <div class="card fig">
      <div class="fig-h"><p class="eyebrow">This draw, in order</p>
        <div class="row"><button type="button" class="btn" id="c-play">Play it out</button><button type="button" class="btn" id="c-new">New draw</button></div></div>
      <ol class="strip" id="c-strip" aria-live="polite"></ol>
      <p class="fine" id="c-detail" aria-live="polite">Tap or click a slice to read its numbers.</p>
    </div>`;
  const P = S.C;
  const tsec = sec(panel, 'Who is defending');
  const typ = choices(tsec, TYPES, String(P.weak), v => { P.weak = +v; changed(); }, 'Defender type');
  tsec.insertAdjacentHTML('beforeend', '<p class="fine">The challenger never sees the type. It only sees what the defender did to earlier slices.</p>');
  const status = sec(panel, 'Equilibrium');
  status.insertAdjacentHTML('beforeend', `<div class="status" id="c-status"><b></b><span></span></div><p class="why" id="c-why"></p><dl class="readout" id="c-read"></dl>`);
  const ctl = sec(panel, 'Parameters');
  const sl = {};
  const val = k => k === 'lp' ? Math.log10(Math.max(P.p0, 1e-4)) : P[k];
  for (const s of SLIDERS) sl[s.key] = slider(ctl, s, val(s.key), v => {
    if (s.key === 'lp') { P.p0 = +(10 ** v).toPrecision(3); ci.checked = false; } else P[s.key] = v;
    changed();
  });
  ctl.insertAdjacentHTML('beforeend', `<label class="tg"><input type="checkbox" id="c-ci"><span class="sw"></span><span class="t">Complete information<small>Set the prior to zero: Selten’s chain-store paradox.</small></span></label>`);
  const ci = ctl.querySelector('#c-ci');
  ci.addEventListener('change', () => { P.p0 = ci.checked ? 0 : 0.05; changed(); });

  let shown = Infinity, timer = null;
  const chartEl = stage.querySelector('#c-chart');
  // Slice details were hover-only (title); a tap, click or Enter now shows them under the strip.
  const stripEl = stage.querySelector('#c-strip'), detailEl = stage.querySelector('#c-detail');
  const showDetail = e => { const li = e.target.closest('li[title]'); if (li && li.title) detailEl.textContent = li.title; };
  stripEl.addEventListener('click', showDetail);
  stripEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(e); } });
  stage.querySelector('#c-new').addEventListener('click', () => { P.seed = (P.seed * 7 + 13) % 99991; shown = Infinity; changed(); });
  stage.querySelector('#c-play').addEventListener('click', () => {
    clearInterval(timer);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { shown = Infinity; render(); return; }
    shown = 0; render();
    // Stop if the player switched tabs mid-animation (the chart is no longer on the page).
    timer = setInterval(() => { if (!chartEl.isConnected) { clearInterval(timer); return; } shown++; render(); if (shown >= P.N) clearInterval(timer); }, 380);
  });

  function render() {
    typ.set(String(P.weak));
    for (const s of SLIDERS) sl[s.key].set(val(s.key));
    ci.checked = P.p0 === 0;
    if (P.p0 === 0) sl.lp.text('0');
    const steps = simulate(P);
    drawChart(stage.querySelector('#c-chart'), P, steps, shown);
    stage.querySelector('#c-leg').innerHTML = `<span class="lg"><i style="background:var(--c3)"></i>Challenger holds back above the dots</span>
      <span class="lg"><i style="background:var(--c1)"></i>Reputation</span><span class="lg"><i style="background:var(--c2)"></i>Slice resisted</span><span class="lg"><i style="background:var(--bad)"></i>Slice allowed</span>`;
    strip(stage.querySelector('#c-strip'), steps, shown);
    panelText(P);
  }

  function panelText(P) {
    const k1 = firstProbeStage(P), deterred = P.N - k1, ex = expectations(P, P.weak);
    const box = panel.querySelector('#c-status');
    box.dataset.s = deterred >= P.N / 2 ? 'good' : deterred > 0 ? 'warn' : 'bad';
    box.querySelector('b').textContent = P.p0 === 0 ? 'Every slice is taken' : deterred === 0 ? 'Probed from the first slice' : `Deterred for ${deterred} of ${P.N} slices`;
    box.querySelector('span').innerHTML = P.p0 === 0 ? 'With no doubt about the defender, backward induction unravels deterrence.'
      : `The challenger holds back while the defender’s reputation exceeds b<sup>k</sup>, where k is the number of slices left.`;
    panel.querySelector('#c-why').innerHTML = P.p0 === 0
      ? 'On the last slice the weak defender gives way, so the challenger takes it. Then resisting on the second-to-last slice buys nothing, and so on back to the first. This is Selten’s paradox.'
      : `The challenger stays out while p<sub>0</sub> = ${fmtP(P.p0)} > b<sup>k</sup>. That holds for every slice with k > ln p<sub>0</sub> / ln b = ${f2(Math.log(P.p0) / Math.log(P.b))}. A weak defender resists early probes with some probability to keep the reputation it needs, and gives way near the end.`;
    const who = P.weak ? 'weak' : 'tough';
    panel.querySelector('#c-read').innerHTML = [
      ['First slice probed', k1 === 0 ? 'none' : `slice ${P.N - k1 + 1}`],
      [`Expected probes (${who})`, f2(ex.probes)],
      ['Expected resisted', f2(ex.resisted)],
      ['Expected allowed', f2(ex.accommodated)],
      ['Expected quiet rounds', f2(ex.deterred)],
      P.weak ? ['Weak defender payoff', f2(ex.payoff)] : ['Tough defender', 'resists every probe'],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  }
  return { render };
}

function strip(ol, steps, shown) {
  ol.innerHTML = steps.map((s, i) => {
    const hide = i >= shown;
    const kind = !s.probe ? 'out' : s.resist ? 'res' : 'acc';
    const word = { out: 'Held back', res: 'Resisted', acc: 'Allowed' }[kind];
    const detail = `Slice ${i + 1}, ${s.k} left. Reputation ${fmtP(s.p)}. Probe chance ${pct(s.pProbe)}${s.probe ? `; weak defender resists with ${pct(s.pResist ?? 1)}` : ''}.`;
    return `<li class="${hide ? 'hid' : kind}"${hide ? '' : ` title="${detail}" tabindex="0"`}><span class="n">${i + 1}</span><span class="w">${hide ? '' : word}</span><span class="sr">${hide ? '' : detail}</span></li>`;
  }).join('');
}

function drawChart(svg, P, steps, shown) {
  const lo = Math.max(1e-5, Math.min(P.p0 || 1, P.b ** P.N) / 3);
  const F = frame(svg, { W: 760, H: 300, m: { l: 58, r: 14, t: 12, b: 42 }, x: [0.5, P.N + 0.5], y: [lo, 1], ylog: true });
  const { g, sx, sy } = F;
  // Deterrence zone: above b^k at each slice.
  const zone = [];
  for (let i = 1; i <= P.N; i++) { const t = P.b ** (P.N - i + 1); zone.push([sx(i - 0.5), sy(t)], [sx(i + 0.5), sy(t)]); }
  el('path', { d: `M${sx(0.5)} ${sy(1)}L` + zone.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L') + `L${sx(P.N + 0.5)} ${sy(1)}Z`, fill: 'var(--c3)', 'fill-opacity': 0.13 }, g);
  const yt = []; for (let e = 0; 10 ** e >= lo; e--) yt.push(10 ** e);
  axes(F, { xt: range(P.N), yt, xl: 'Slice (first to last)', yl: 'Pr(tough), log scale', xf: v => String(v), yf: v => v >= 0.01 ? String(v) : `1e${Math.round(Math.log10(v))}` });
  for (let i = 1; i <= P.N; i++) el('circle', { cx: sx(i), cy: sy(P.b ** (P.N - i + 1)), r: 3.2, class: 'thr' }, g);
  const vis = steps.slice(0, Math.min(shown, steps.length));
  const y = p => sy(Math.max(p, lo));
  if (vis.length) {
    let d = `M${sx(0.5)} ${y(vis[0].p)}`;
    vis.forEach((s, i) => { d += `L${sx(i + 1)} ${y(s.p)}L${sx(i + 1.5)} ${y(s.pNext)}`; });
    el('path', { d, class: 'ln', stroke: 'var(--c1)' }, g);
    vis.forEach((s, i) => {
      if (!s.probe) return;
      el('circle', { cx: sx(i + 1), cy: y(s.p), r: 6, fill: s.resist ? 'var(--c2)' : 'var(--bad)', class: 'ev' }, g);
    });
  }
  if (P.p0 === 0 || vis.some(s => s.pNext === 0)) el('text', { x: F.m.l + 6, y: sy(lo) - 16, class: 'bl' }, g, 'reputation 0 plotted at the floor');
}

const range = n => { const st = n > 15 ? 2 : 1, t = []; for (let i = 1; i <= n; i += st) t.push(i); return t; };
