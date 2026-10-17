// Crowd Forecast Board: state, tabs, panel and URL hash.
import { $, esc, cents, signedPts, dayLabel, f3, loadJSON, PAPER_THEATER, polyURL, THEATER_COLOR } from './util.js';
import { renderBoard, boardSummary } from './board.js';
import { renderDetail, pickerHTML } from './detail.js';
import { renderReliability, brierTable, calibReading } from './calib.js';
import { renderNull, renderProfile, renderMixture, lamReading, stops } from './lambda.js';
import { createTour } from './tour.js';
import { TSM } from '../../../shared/data/tsm.js';

const VIEWS = ['board', 'market', 'calib', 'lambda', 'method'];
const st = { v: 'board', th: 'all', sort: 'theater', m: '567621', lead: 7, lt: 'iran_israel', ls: null, zoom: true, pla: true };
const PLA = TSM.daily.map(r => [r[0], r[1]]);

/** Taiwan MND joint combat readiness patrol days, each with its MND press release (TSM daily data). */
function jcrpEvents() {
  const src = TSM.sources.flags || {};
  return TSM.daily.filter(r => r[5].includes('J') && src[r[0]] && src[r[0]].J).map(r => ({
    date: r[0], text: `Taiwan MND reports a PLA joint combat readiness patrol (${r[1]} aircraft that day)`, src: src[r[0]].J, type: 'jcrp' }));
}
let D = null;

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (VIEWS.includes(h.get('v'))) st.v = h.get('v');
  if (h.get('th')) st.th = h.get('th');
  if (['theater', 'move', 'vol'].includes(h.get('sort'))) st.sort = h.get('sort');
  if (h.get('m')) st.m = h.get('m');
  if (h.get('zoom') === '0') st.zoom = false;
  if (h.get('pla') === '0') st.pla = false;
  if (['1', '7', '30'].includes(h.get('lead'))) st.lead = +h.get('lead');
  if (PAPER_THEATER[h.get('lt')]) st.lt = h.get('lt');
}
function writeHash() {
  const h = new URLSearchParams({ v: st.v, th: st.th, sort: st.sort, m: st.m, lead: st.lead, lt: st.lt, zoom: st.zoom ? 1 : 0, pla: st.pla ? 1 : 0 });
  history.replaceState(null, '', `#${h}`);
}

const choice = (items, cur, attr) => `<div class="choices">${items.map(([k, n, c]) =>
  `<button type="button" data-${attr}="${k}" aria-pressed="${String(k) === String(cur)}">${c ? `<i class="swc" style="background:${c}"></i>` : ''}${esc(n)}</button>`).join('')}</div>`;

function theaterChoices() {
  return choice([['all', 'All theaters'], ...D.board.order.map(k => [k, D.board.theaters[k], THEATER_COLOR[k]])], st.th, 'th');
}

function panelHTML() {
  const B = D.board;
  if (st.v === 'board') {
    const s = boardSummary(B, st);
    return `<div class="sec"><p class="eyebrow">Theater</p>${theaterChoices()}</div>
      <div class="sec"><p class="eyebrow">Order</p>${choice([['theater', 'By theater'], ['move', 'Biggest 7-day move'], ['vol', 'Most traded']], st.sort, 'sort')}</div>
      <div class="sec"><dl class="readout"><dt>Open contracts</dt><dd>${s.n} in ${s.nf} questions</dd>
        <dt>Latest price</dt><dd>${dayLabel(B.dataLast)} (UTC)</dd></dl></div>
      <div class="sec"><p class="eyebrow">Largest 7-day moves</p>${s.movers.map(c => `<button type="button" class="mover" data-open="${c.id}">
        <span>${esc(c.q)}</span><b>${cents(c.p)} <small>${signedPts(c.d7)}</small></b></button>`).join('') || '<p class="fine">None.</p>'}</div>`;
  }
  if (st.v === 'market') {
    const m = D.series[st.m];
    const cal = D.cal.contracts.find(c => c.id === st.m);
    const last = m.s[m.s.length - 1];
    const fc = cal ? Object.entries(cal.f).map(([L, [p, d]]) => `<dt>${L} day${L === '1' ? '' : 's'} before</dt><dd>${cents(p * 100)} <small>${dayLabel(d)}</small></dd>`).join('') : '';
    return `<div class="sec"><p class="q">${esc(m.q)}</p>
        <p><span class="res ${m.closed ? (m.y ? 'res-yes' : 'res-no') : 'res-open'}">${m.closed ? (m.y == null ? 'closed' : `resolved ${m.y ? 'Yes' : 'No'}`) : 'open'}</span>
        <span class="pill" style="color:${THEATER_COLOR[m.th]}">${esc(B.theaters[m.th])}</span></p>
        <dl class="readout"><dt>${m.closed ? 'Last price' : 'Latest price'}</dt><dd>${cents(last[1])} <small>${dayLabel(last[0])}</small></dd>
        <dt>Deadline</dt><dd>${dayLabel(m.deadline)}</dd>${m.closed && m.dday ? `<dt>Decided</dt><dd>${dayLabel(m.dday)}</dd>` : ''}
        ${fc}${cal && m.y != null && cal.f['7'] ? `<dt>Brier at 7 days</dt><dd>${(cal.f['7'][0] - m.y) ** 2 < 0.001 ? '&lt;0.001' : f3((cal.f['7'][0] - m.y) ** 2)}</dd>` : ''}
        <dt>Archived days</dt><dd>${m.s.length}${m.src === 'supplement' ? ' <small>recovered tape</small>' : ''}</dd>
        <dt>Tape volume</dt><dd>$${Math.round(m.vol).toLocaleString('en-US')}</dd></dl></div>
      <div class="sec"><label class="tg"><input type="checkbox" id="opt-zoom" ${st.zoom ? 'checked' : ''}><span class="sw"></span><span class="t">Fit the price axis to the data<small>Off: the full 0–100¢ scale</small></span></label>
        ${m.th === 'taiwan' ? `<label class="tg"><input type="checkbox" id="opt-pla" ${st.pla ? 'checked' : ''}><span class="sw"></span><span class="t">PLA aircraft per day<small>TSM daily counts from Taiwan MND reports</small></span></label>` : ''}</div>
      ${m.rule ? `<div class="sec"><details class="rule"><summary>Resolution rule (opening)</summary><p>${esc(m.rule)}${m.rule.length >= 300 ? '…' : ''}</p></details></div>` : ''}
      <div class="sec"><a class="btn" href="${polyURL(m.slug)}" target="_blank" rel="noopener">Contract on Polymarket</a></div>`;
  }
  if (st.v === 'calib') {
    const r = D.cal.summary[String(st.lead)][st.th];
    return `<div class="sec"><p class="eyebrow">Lead time</p>${choice([[1, '1 day before'], [7, '7 days before'], [30, '30 days before']], st.lead, 'lead')}</div>
      <div class="sec"><p class="eyebrow">Theater</p>${theaterChoices()}</div>
      <div class="sec"><dl class="readout"><dt>Contracts</dt><dd>${r.n} (${r.nYes ?? 0} Yes)</dd><dt>Questions</dt><dd>${r.nClusters ?? 0}</dd>
        <dt>Brier</dt><dd><b>${f3(r.brier)}</b></dd><dt>95% interval</dt><dd>${r.ci ? `${f3(r.ci[0])}–${f3(r.ci[1])}` : '–'}</dd>
        <dt>Base-rate Brier</dt><dd>${f3(r.brierBase)}</dd><dt>Calibration error</dt><dd>${f3(r.reliability)}</dd><dt>Discrimination</dt><dd>${f3(r.resolution)}</dd></dl></div>`;
  }
  if (st.v === 'lambda') {
    const T = D.lam.theaters[st.lt];
    const pts = stops(T);
    const i = st.ls ?? pts.findIndex(p => p.mle);
    return `<div class="sec"><p class="eyebrow">Paper theater</p>${choice(Object.entries(PAPER_THEATER).map(([k, n]) => [k, n]), st.lt, 'lt')}</div>
      <div class="sec"><label class="slider"><span class="eyebrow">Hold <span class="nt">λ</span> at <b id="ls-val">${f3(pts[i].lam)}</b></span>
        <input type="range" id="ls" min="0" max="${pts.length - 1}" step="1" value="${i}" aria-label="Value of lambda for the fitted mixture"></label>
        <p class="fine" id="ls-read" aria-live="polite"></p></div>
      <div class="sec"><dl class="readout"><dt>λ̂</dt><dd><b>${f3(T.fit.lam)}</b></dd><dt>Profile 95%</dt><dd>${f3(T.profileCI[0])}–${f3(T.profileCI[1])}</dd>
        <dt>Event bootstrap</dt><dd>${f3(T.bootEvent[0])}–${f3(T.bootEvent[1])}</dd><dt>Benchmark 90%</dt><dd>${f3(T.null.q05)}–${f3(T.null.q95)}</dd>
        <dt>Benchmark ≥ λ̂</dt><dd>${Math.round(T.null.shareGE * 100)}% of ${T.null.R}</dd><dt>Lower bound</dt><dd>${f3(T.sharpLo)}</dd>
        <dt>Sample</dt><dd>${T.n} moves · ${T.nContracts} contracts · ${T.nEvents} events</dd></dl></div>
      <div class="sec"><p class="eyebrow">Other specifications (<span class="nt">λ̂</span>)</p><dl class="readout">${Object.entries(T.variants).map(([k, v]) =>
        `<dt>${esc({ tier12_h24: 'Add tier-2 events', tier1_h12: '12-hour windows', tier1_h48: '48-hour windows', freeze_only: 'Freeze tapes only', token_fail_kept: 'Keep token-check fails', drop_suspect: 'Drop questioned label' }[k] || k)}</dt><dd>${f3(v)}</dd>`).join('')}</dl></div>`;
  }
  return `<div class="sec"><p class="fine">Method notes, data gaps and how to cite. The data were built ${dayLabel(B.built)} by <code>scripts/build.py</code>.</p></div>`;
}

function bindPanel() {
  const P = $('panel');
  P.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { st.th = b.dataset.th; render(); });
  P.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { st.sort = b.dataset.sort; render(); });
  P.querySelectorAll('[data-lead]').forEach(b => b.onclick = () => { st.lead = +b.dataset.lead; render(); });
  P.querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { st.lt = b.dataset.lt; st.ls = null; render(); });
  P.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openMarket(b.dataset.open));
  const z = $('opt-zoom'), pl = $('opt-pla');
  if (z) z.onchange = () => { st.zoom = z.checked; render(); };
  if (pl) pl.onchange = () => { st.pla = pl.checked; render(); };
  const s = $('ls');
  if (s) s.oninput = () => { st.ls = +s.value; drawLambdaSel(); };
}

function openMarket(id) {
  if (!D.series[id]) return;
  st.m = id; st.v = 'market';
  render();
  $('mk-chart').focus({ preventScroll: true });
  // From a long board, the chart can be far off screen: bring the price-path card into view.
  const top = $('view-market').getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * 0.6) $('view-market').scrollIntoView({ block: 'start' });
}

function drawLambdaSel() {
  const T = D.lam.theaters[st.lt];
  const i = st.ls ?? stops(T).findIndex(p => p.mle);
  const pr = renderProfile($('lam-prof'), T, i);
  const s = renderMixture($('lam-mix'), $('lam-tip'), $('lam-wrap'), T, i);
  if ($('ls-val')) $('ls-val').textContent = f3(s.lam);
  if ($('ls-read')) $('ls-read').textContent = s.mle ? 'This is the maximum-likelihood fit.' :
    `Likelihood-ratio statistic ${pr.lr.toFixed(2)}: ${pr.inside ? 'inside' : 'outside'} the 95% interval. Informed spread τ = ${s.tau.toFixed(2)}, informed mean in No contracts ν = ${(s.nu_l ?? 0).toFixed(2)}.`;
}

function render() {
  VIEWS.forEach(v => {
    $(`view-${v}`).hidden = v !== st.v;
    const t = $(`tab-${v}`);
    t.setAttribute('aria-selected', String(v === st.v));
    t.tabIndex = v === st.v ? 0 : -1;
  });
  if (st.v === 'board') renderBoard($('board'), D.board, st, openMarket);
  if (st.v === 'market') {
    const m = D.series[st.m];
    $('mk-title').textContent = m.q;
    $('mk-pick').value = st.m;
    renderDetail($('mk-chart'), $('mk-tip'), $('mk-wrap'), $('mk-events'), m, D.events[m.th], D.cal.contracts.find(c => c.id === st.m),
      { zoom: st.zoom, pla: m.th === 'taiwan' && st.pla ? PLA : null });
  }
  if (st.v === 'calib') {
    renderReliability($('cal-chart'), $('cal-tip'), $('cal-wrap'), D.cal, D.series, st, openMarket);
    $('cal-table').innerHTML = brierTable(D.cal, D.board.theaters, st);
    $('cal-reading').textContent = calibReading(D.cal, D.board.theaters, st);
  }
  if (st.v === 'lambda') {
    const T = D.lam.theaters[st.lt];
    const r = lamReading(st.lt, T);
    $('lam-status').dataset.s = r.s;
    $('lam-head').textContent = `${PAPER_THEATER[st.lt]}: ${r.head}`;
    $('lam-text').textContent = r.text;
    renderNull($('lam-null'), T);
  }
  $('panel').innerHTML = panelHTML();
  bindPanel();
  if (st.v === 'lambda') drawLambdaSel();
  writeHash();
}

function bindTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((t, i) => {
    t.onclick = () => { st.v = t.dataset.v; render(); };
    t.onkeydown = e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const n = tabs[(i + d + tabs.length) % tabs.length];
      st.v = n.dataset.v; render(); n.focus();
    };
  });
}

async function main() {
  readHash();
  try {
    const [board, series, cal, lam, events] = await Promise.all(['board.json', 'series.json', 'calibration.json', 'lambda.json', 'events.json'].map(loadJSON));
    D = { board, series, cal, lam, events };
    D.events.taiwan = [...D.events.taiwan, ...jcrpEvents()].sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    $('asof').textContent = `Could not load the data (${e.message}).`;
    return;
  }
  if (!D.series[st.m]) st.m = Object.keys(D.series)[0];
  if (st.th !== 'all' && !D.board.order.includes(st.th)) st.th = 'all';
  $('asof').textContent = `Prices through ${dayLabel(D.board.dataLast)} (UTC). ${D.cal.contracts.length} resolved contracts scored. Built ${dayLabel(D.board.built)}.`;
  $('cite-date').textContent = dayLabel(D.board.built);
  $('mk-pick').innerHTML = pickerHTML(D.series, D.board.theaters, D.board.order);
  $('mk-pick').onchange = e => { st.m = e.target.value; render(); };
  bindTabs();
  $('copy-link').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; } catch { $('copy-link').textContent = 'Copy the address bar'; }
    setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
  };
  const tour = createTour($('stage'), set => { Object.assign(st, set); render(); });
  $('start-tour').onclick = () => tour.start();
  let rt;
  let lastW = innerWidth;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 30) { lastW = innerWidth; render(); } }, 200); });
  render();
}

main();
