// Calibration: reliability diagram, outcome rug and Brier scores for resolved contracts.
import { vbw, el, esc, f3, lin, placeTip, THEATER_COLOR } from './util.js';

let W = 560;
const H = 490, M = { l: 50, r: 16, t: 34, b: 96 };
const RUG_YES = 14, RUG_NO = H - 22;

export function renderReliability(svg, tip, wrap, cal, series, st, onOpen) {
  W = vbw(svg, 340, 560);
  svg.innerHTML = '';
  tip.hidden = true;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const S = cal.summary[String(st.lead)][st.th];
  const X = lin(0, 1, M.l, W - M.r), Y = lin(0, 1, H - M.b, M.t);
  const g = el('g', {}, svg);
  for (const v of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    el('line', { x1: X(v), x2: X(v), y1: M.t, y2: H - M.b, class: 'grid' }, g);
    el('line', { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), class: 'grid' }, g);
    el('text', { x: X(v), y: H - M.b + 16, 'text-anchor': 'middle' }, g, `${Math.round(v * 100)}¢`);
    el('text', { x: M.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, g, `${Math.round(v * 100)}%`);
  }
  el('text', { x: (M.l + W - M.r) / 2, y: H - M.b + 34, 'text-anchor': 'middle', class: 'ax-t' }, g,
    `Price ${st.lead} day${st.lead > 1 ? 's' : ''} before the outcome was decided`);
  el('text', { x: 14, y: (M.t + H - M.b) / 2, transform: `rotate(-90 14 ${(M.t + H - M.b) / 2})`, 'text-anchor': 'middle', class: 'ax-t' }, g, 'Share that resolved Yes');
  el('line', { x1: X(0), y1: Y(0), x2: X(1), y2: Y(1), class: 'diag' }, g);
  el('text', { x: X(0.97), y: Y(0.97) + 16, 'text-anchor': 'end', class: 'diag-t' }, g, 'perfectly calibrated');
  if (!S || !S.n) {
    el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'empty-t' }, svg, 'No resolved contracts with a price at this lead');
    return;
  }
  // Bins with Wilson 95% intervals; area proportional to count.
  const maxN = Math.max(...S.bins.map(b => b.n));
  const bins = el('g', {}, svg);
  S.bins.forEach(b => {
    const gx = el('g', { class: 'bin', tabindex: 0, role: 'img',
      'aria-label': `Prices ${Math.round(b.lo * 100)} to ${Math.round(b.hi * 100)} cents: ${b.n} contracts, mean price ${Math.round(b.f * 100)} cents, ${Math.round(b.o * 100)} percent resolved Yes` }, bins);
    el('line', { x1: X(b.f), x2: X(b.f), y1: Y(b.ci[0]), y2: Y(b.ci[1]), class: 'ci' }, gx);
    el('circle', { cx: X(b.f), cy: Y(b.o), r: 4 + 12 * Math.sqrt(b.n / maxN), class: 'bin-dot' }, gx);
    const tipIt = () => {
      tip.innerHTML = `<b>${b.n} contract${b.n > 1 ? 's' : ''} priced ${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}¢</b>
        <span class="tt-d">mean price ${(b.f * 100).toFixed(1)}¢ · resolved Yes ${(b.o * 100).toFixed(0)}%</span>
        <small>95% interval for the Yes share: ${(b.ci[0] * 100).toFixed(0)}–${(b.ci[1] * 100).toFixed(0)}%</small>`;
      const r = svg.getBoundingClientRect(), k = r.width / W;
      placeTip(tip, wrap, X(b.f) * k, Y(b.o) * k);
    };
    gx.addEventListener('pointerenter', tipIt);
    gx.addEventListener('focus', tipIt);
    gx.addEventListener('pointerleave', () => { tip.hidden = true; });
    gx.addEventListener('blur', () => { tip.hidden = true; });
  });
  // Rug: each contract at its price, Yes along the top, No along the bottom.
  el('text', { x: M.l, y: RUG_YES - 6, class: 'lane-t' }, svg, 'Resolved Yes');
  el('text', { x: M.l, y: RUG_NO + 14, class: 'lane-t' }, svg, 'Resolved No');
  const rug = el('g', {}, svg);
  const key = String(st.lead);
  for (const c of cal.contracts) {
    if (!(key in c.f) || (st.th !== 'all' && c.th !== st.th)) continue;
    const p = c.f[key][0];
    const jit = ((parseInt(c.id, 10) % 7) - 3) * 1.6;
    const a = el('circle', { cx: X(p), cy: (c.y ? RUG_YES + 8 : RUG_NO - 12) + jit, r: 3.2, class: `rug ${c.y ? 'yes' : 'no'}`,
      style: `fill:${THEATER_COLOR[c.th]}` }, rug);
    a.addEventListener('pointerenter', () => {
      const s = series[c.id];
      tip.innerHTML = `<b>${esc(s ? s.q : c.id)}</b><span class="tt-d">${(p * 100).toFixed(1)}¢ on ${c.f[key][1]} · resolved ${c.y ? 'Yes' : 'No'}</span><small>Click to open its price path</small>`;
      const r = svg.getBoundingClientRect(), k = r.width / W;
      placeTip(tip, wrap, X(p) * k, (c.y ? RUG_YES + 8 : RUG_NO - 12) * k);
    });
    a.addEventListener('pointerleave', () => { tip.hidden = true; });
    a.addEventListener('click', () => onOpen(c.id));
  }
}

const ROWS = [['all', 'All theaters'], ['taiwan', null], ['mideast', null], ['russia', null], ['other', null]];

export function brierTable(cal, names, st) {
  const L = String(st.lead);
  const body = ROWS.map(([k, n]) => {
    const r = cal.summary[L][k];
    if (!r || !r.n) return `<tr><td>${esc(n || names[k])}</td><td class="num" colspan="5">no contracts at this lead</td></tr>`;
    const sel = st.th === k ? ' class="sel"' : '';
    return `<tr${sel}><td>${esc(n || names[k])}</td><td class="num">${r.n} <small>(${r.nYes} Yes)</small></td>
      <td class="num"><b>${f3(r.brier)}</b></td><td class="num">${r.ci ? `${f3(r.ci[0])}–${f3(r.ci[1])}` : '–'}</td>
      <td class="num">${f3(r.brierBase)}</td><td class="num">${r.missing}</td></tr>`;
  }).join('');
  return `<table><caption>Brier score, ${L} day${L === '1' ? '' : 's'} out (lower is better; always quoting 50¢ scores 0.250)</caption>
    <thead><tr><th>Theater</th><th class="num">Contracts</th><th class="num">Brier</th><th class="num">95% interval</th>
    <th class="num">Base rate<sup>a</sup></th><th class="num">No price<sup>b</sup></th></tr></thead><tbody>${body}</tbody></table>
    <p class="fine tnote"><sup>a</sup> Brier score of always quoting the share of contracts in that row that resolved Yes. It uses the answer, so it is a yardstick, not a rival forecaster.
    <sup>b</sup> Resolved contracts with no archived price within ${cal.staleDays} days of that lead (often contracts listed only days before they closed).
    Intervals resample whole questions (Polymarket events), ${cal.bootB.toLocaleString('en-US')} draws.</p>`;
}

/** One-line plain reading of the selected row. */
export function calibReading(cal, names, st) {
  const r = cal.summary[String(st.lead)][st.th];
  if (!r || !r.n) return 'No resolved contracts in this theater have a price at this lead.';
  const name = st.th === 'all' ? 'Across all theaters' : names[st.th];
  if (r.nYes <= 1) {
    return `${name}: ${r.n} contracts, ${r.nYes} resolved Yes. With ${r.nYes ? 'almost every' : 'every'} contract ending No, a low Brier score (${f3(r.brier)}; the mean squared gap between price and outcome, lower is better) mostly records that traders priced the event low and it did not happen. It cannot tell skill from a lucky call.`;
  }
  const better = r.brier < r.brierBase;
  return `${name}: Brier ${f3(r.brier)} on ${r.n} contracts (${r.nYes} Yes), against ${f3(r.brierBase)} for quoting the base rate. Calibration error ${f3(r.reliability)}, discrimination ${f3(r.resolution)}. ` +
    (better ? 'Prices sorted events that happened from ones that did not better than the base rate did.' : 'Prices did no better than the base rate.') +
    ` Contracts on one question move together, so the effective sample is closer to ${r.nClusters} questions.`;
}
