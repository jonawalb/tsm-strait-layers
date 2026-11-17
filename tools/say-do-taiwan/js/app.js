// Say-Do Gap Monitor: state, controls and rendering. Shared verbatim by say-do-taiwan and say-do-global;
// everything config-specific comes from data/meta.js and data/behaviour.js.
import { META } from '../data/meta.js';
import { BEH } from '../data/behaviour.js';
import { DIM, seriesLabel, seriesHelp, tgt, TEST, fmtP, fmt, fmtN, esc, per, pers, verdict, testStatus, testLine, setMetaRes, chanceRange, chanceText } from './labels.js';
import { drawSeries, drawCCF, drawES, drawDL } from './charts.js';
import { renderSpikes } from './evidence.js';
import { createTour, DEFAULTS } from './tour.js';
import { initDetail, setDetail, detailMode } from './detail.js';

setMetaRes(META.res);
const $ = id => document.getElementById(id);
const DAY = 864e5;
const di = (d, base) => Math.round((Date.parse(d) - Date.parse(base)) / DAY);
const addDays = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const COUNTRY = { CN: 'China', RU: 'Russia', IR: 'Iran', VE: 'Venezuela' };
const cache = {};
const def = DEFAULTS[META.config.id];
const S = { s: 0, kind: 'tone', t: '', dim: 'threat', b: '', r: 'week', w: 'all', spike: null };
const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
const phone = () => matchMedia('(max-width: 640px)').matches;
initDetail();

async function load(i) {
  if (!cache[i]) {
    const [a, b] = await Promise.all([import(`../data/s${i}.js`), import(`../data/r${i}.js`)]);
    cache[i] = { R: a.RHET, X: b.RES };
  }
  return cache[i];
}
const stream = () => META.streams[S.s];
const key = () => S.kind === 'tone' ? `tone:${S.dim}` : S.kind === 'sal' ? `sal:${S.t}` : `stance:${S.t}:${S.dim}`;
const beh = () => BEH.find(b => b.id === S.b);
const behsFor = cc => BEH.filter(b => b.countries.includes(cc));

// ---------------------------------------------------------------------------------------------- series
function rhetSeries(R, k, a0, a1, res) {
  const cols = R.cols, ci = cols.indexOf(k);
  const cn = k.startsWith('stance:') ? cols.indexOf('stance_n:' + k.slice(7)) : cols.indexOf('n');
  const step = res === 'week' ? 7 : 1, n = Math.round(di(a1, a0) / step) + 1;
  const sum = new Float64Array(n), cnt = new Float64Array(n);
  const off = di(R.first, a0);
  for (const row of R.rows) {
    const d = off + row[0];
    if (d < 0) continue;
    const i = Math.floor(d / step);
    if (i >= n) continue;
    sum[i] += row[ci]; cnt[i] += row[cn];
  }
  const min = res === 'week' ? (k.startsWith('stance:') ? 2 : 3) : 1;
  return Array.from(sum, (s, i) => cnt[i] >= min ? s / cnt[i] : null);
}
function behSeries(b, a0, a1, res) {
  const step = res === 'week' ? 7 : 1, n = Math.round(di(a1, a0) / step) + 1;
  if (b.weekly_only) {
    const off = di(a0, b.wfirst) / 7;
    return Array.from({ length: n }, (_, i) => b.weekly[off + i] ?? null);
  }
  const off = di(a0, b.first);
  if (res === 'day') return Array.from({ length: n }, (_, i) => b.daily[off + i] ?? null);
  return Array.from({ length: n }, (_, i) => {
    let s = 0, k = 0;
    for (let j = 0; j < 7; j++) { const v = b.daily[off + 7 * i + j]; if (v != null) { s += v; k++; } }
    if (k < 4) return null;
    return b.agg === 'sum' ? (s * 7) / k : s / k;
  });
}

// ---------------------------------------------------------------------------------------------- controls
function seg(root, items, cur, on) {
  root.innerHTML = items.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join('');
  root.querySelectorAll('button').forEach(b => b.onclick = () => on(b.dataset.v));
}
function opts(sel, items, cur) {
  sel.innerHTML = items.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
}
function syncControls() {
  const st = stream(), cc = st.country, targets = META.targets[cc] || [];
  const countries = [...new Set(META.streams.map(s => s.country))];
  $('country-row').hidden = countries.length < 2;
  opts($('country'), countries.map(c => [c, COUNTRY[c] || c]), cc);
  opts($('stream'), META.streams.filter(s => s.country === cc).map(s => [String(s.i), `${s.label} (${fmtN(s.n_docs)} docs, ${s.first.slice(0, 4)}–${s.last.slice(0, 4)})`]), String(S.s));
  seg($('kind'), [['tone', 'Overall tone'], ['stance', 'Tone on a target'], ['sal', 'Attention']], S.kind, v => { S.kind = v; fixState(); update().then(showVerdict); });
  $('target-row').hidden = S.kind === 'tone';
  opts($('target'), targets.map(t => [t, tgt(t)]), S.t);
  $('dim-row').hidden = S.kind === 'sal';
  opts($('dim'), (S.kind === 'tone' ? META.tone : META.stance).map(d => [d, DIM[d]]), S.dim);
  $('series-help').textContent = seriesHelp(key());
  opts($('beh'), behsFor(cc).map(b => [b.id, b.short + (b.weekly_only ? ' (weekly only)' : '')]), S.b);
  const b = beh();
  $('beh-help').textContent = b ? `${b.label}. ${b.note}` : '';
  seg($('res'), [['week', 'Weekly'], ['day', 'Daily']], S.r, v => { S.r = v; S.spike = null; update().then(showVerdict); });
  $('res').querySelector('[data-v="day"]').disabled = !!(b && b.weekly_only);
  seg($('win'), META.windows.map(w => [w.id, w.start ? `Since ${w.start.slice(0, 4)}` : 'Full overlap']), S.w, v => { S.w = v; S.spike = null; update().then(showVerdict); });
}
function fixState() {
  const st = stream(), cc = st.country, targets = META.targets[cc] || [];
  if (!targets.includes(S.t)) S.t = targets[0] || '';
  const dims = S.kind === 'tone' ? META.tone : META.stance;
  if (!dims.includes(S.dim)) S.dim = dims.includes('threat') ? 'threat' : dims[0];
  if (!behsFor(cc).some(b => b.id === S.b)) S.b = behsFor(cc)[0]?.id || '';
  if (beh()?.weekly_only) S.r = 'week';
  if (!META.windows.some(w => w.id === S.w)) S.w = 'all';
}

// ---------------------------------------------------------------------------------------------- render
let seriesState = null;
async function update(push = true) {
  fixState();
  syncControls();
  const { R, X } = await load(S.s);
  const k = key(), b = beh(), res = S.r, P = META.res[res];
  const r = X[res]?.[S.w]?.[k]?.[S.b];
  const fam = META.bh[`${res}|${S.w}`] || { m: 0, nominal: 0, survive: 0, top: [] };
  if (push) history.replaceState(null, '', '#' + new URLSearchParams({ s: stream().stream, k, b: S.b, r: res, w: S.w }));
  // verdict
  const v = verdict(r, fam, res, META.calib);
  $('verdict').dataset.s = v.cls;
  $('v-head').textContent = v.head;
  $('v-body').textContent = v.body;
  $('v-pair').innerHTML = `<b>${esc(stream().label)}</b>: ${esc(seriesLabel(k))} <span aria-hidden="true">→</span> <b>${esc(b.short)}</b> · ${res === 'week' ? 'weekly' : 'daily'}` +
    (r ? ` · ${esc(r.a[0])} to ${esc(r.a[1])} (${fmtN(r.n)} ${per(res)}s, rhetoric present in ${Math.round(r.cov * 100)}% of them)` : '');
  if ($('v-fam')) $('v-fam').innerHTML = `Across all ${fmtN(fam.m)} tests in this view, ${fmtN(fam.survive)} survive${fam.survive === 1 ? 's' : ''} correction; even if nothing were related, ${chanceText(fam, META.calib)} would pass p &lt; 0.05. <a href="#fam" class="jump">${fam.survive ? 'Show them' : 'See the count'}</a>`;
  $('chips').innerHTML = ['c', 'e', 'd'].map(c => {
    const t = r && r[c], s = testStatus(t);
    const lab = s === 'sig' ? 'survives correction' : s === 'nom' ? 'p < .05, not after correction' : s === 'none' ? 'not significant' : 'not tested';
    return `<li data-s="${s}"><b>${TEST[c]}</b><span>${lab}</span>${t && t.pu != null ? `<span class="num full-only" title="p: how likely a result this strong is if rhetoric and behaviour were unrelated. q: p adjusted for every test in this view (Benjamini–Hochberg).">p ${fmtP(t.pu)} · q ${fmtP(t.q)}</span>` : ''}</li>`;
  }).join('');
  // series chart
  let a0, a1;
  if (r) [a0, a1] = r.a;
  else {
    const f = [R.first, b.weekly_only ? b.wfirst : b.first].sort().pop();
    const l = [stream().last, b.last].sort()[0];
    a0 = f; a1 = l > f ? l : f;
    if (res === 'week') { const wd = (new Date(a0).getUTCDay() + 6) % 7; a0 = addDays(a0, -wd); a1 = addDays(a1, -((new Date(a1).getUTCDay() + 6) % 7)); }
  }
  const step = res === 'week' ? 7 : 1;
  const dates = Array.from({ length: Math.max(0, Math.round(di(a1, a0) / step) + 1) }, (_, i) => addDays(a0, i * step));
  const rhet = rhetSeries(R, k, a0, a1, res), bser = behSeries(b, a0, a1, res);
  const used = new Set(r?.e?.ev || []);
  const spikes = (R.spikes[k] || []).map(s => {
    const d = res === 'week' ? s.week : s.peak_day;
    return { ...s, key: s.week, i: Math.round(di(d, a0) / step), used: used.has(d) };
  }).filter(s => s.i >= 0 && s.i < dates.length).sort((x, y) => y.week.localeCompare(x.week));
  seriesState = { dates, rhet, bser, spikes, b, k, res };
  const isShare = k.startsWith('sal:');
  drawSeries($('series'), { dates, rhet, beh: bser, spikes, res, sel: S.spike,
    rLabel: `${seriesLabel(k)} (${isShare ? 'share of docs' : 'machine-scored mean'})`, bLabel: `${b.short} (${b.unit}${res === 'week' && b.agg === 'mean' ? ', weekly average' : res === 'week' ? ', per week' : ''})`,
    rFmt: v => isShare ? Math.round(v * 100) + '%' : v.toFixed(2) }, hover);
  const wrap = $('series').parentElement;
  if (wrap && !wrap.nextElementSibling?.classList.contains('scroll-cue')) wrap.insertAdjacentHTML('afterend', '<p class="fine scroll-cue">Swipe the chart sideways for later years.</p>');
  $('series').setAttribute('aria-label', `Line chart of ${seriesLabel(k)} in ${stream().label} above bars of ${b.label}, ${dates[0]} to ${dates[dates.length - 1]}. ${spikes.length} spike ${per(res)}s are marked.`);
  hover(-1);
  // tests
  const ok = r && r.s === 'ok';
  drawCCF($('ccf'), ok ? r.c : { why: r ? r.why : 'No overlap in this window' }, res);
  drawES($('es'), ok ? r.e : { why: r ? r.why : 'No analysis' }, P, res, b.unit);
  drawDL($('dl'), ok ? r.d : { why: r ? r.why : 'No analysis' }, res);
  $('ccf-t').innerHTML = ok ? testText('c', r, res, b) : '';
  $('es-t').innerHTML = ok ? testText('e', r, res, b) : '';
  $('dl-t').innerHTML = ok ? testText('d', r, res, b) : '';
  // spikes + evidence
  renderSpikes($('spikes'), spikes, S.spike, res, k2 => { S.spike = k2; update(); }, { label: stream().label, lang: stream().lang, esTested: !!(r && r.s === 'ok' && testStatus(r.e) !== 'na') });
  if ($('v-plain')) $('v-plain').innerHTML = plainResult(r, k, b, res);
  $('spike-count').textContent = spikes.length ? `${spikes.length} in view` : '';
  if (spikes.length && !$('spike-note')) $('spikes').insertAdjacentHTML('beforebegin', '<p class="fine" id="spike-note"></p>');
  if ($('spike-note')) $('spike-note').textContent = spikes.length ? `Not every spike enters the event study: a spike within ${pers(P.h, res)} of an earlier one, too close to the start or end of the data, or without behaviour data around it is left out (the "in event study" tag marks those used).` : '';
  renderFamily(fam, res);
}

/** One plain sentence per test saying what the result means, for readers who skip the statistics. */
function meaning(c, r, res, b, st) {
  if (c === 'c') {
    const dir = r.c.rk >= 0 ? 'higher' : 'lower';
    if (st === 'sig') return `Meaning: in this record, when this rhetoric rose, the behaviour ran ${dir} than usual ${pers(r.c.k, res)} later, more often than chance across all these tests would explain. An association, not a cause.`;
    if (st === 'nom') return `Meaning: a hint that this rhetoric moves first (${pers(r.c.k, res)} ahead), but no stronger than chance produces across this many tests.`;
    return 'Meaning: no sign in this record that this rhetoric rises before the behaviour.';
  }
  if (c === 'e') {
    if (st === 'sig') return 'Meaning: behaviour changed more after rhetoric spikes than after randomly placed dates.';
    if (st === 'na') return 'Meaning: there are too few spikes to tell whether behaviour changes after them.';
    return 'Meaning: no sign in this record that behaviour after rhetoric spikes differs from behaviour after random dates.';
  }
  if (st === 'sig') return 'Meaning: past rhetoric explains some of the behaviour beyond the behaviour\'s own recent past (fitted to past data, not a tested forecast).';
  if (st === 'nom') return 'Meaning: past rhetoric may explain a little of the behaviour beyond its own recent past, but no more than chance produces across this many tests.';
  return 'Meaning: no sign in this record that past rhetoric adds anything beyond the behaviour\'s own recent past.';
}

function testText(c, r, res, b) {
  const t = r[c], st = testStatus(t);
  const cap = w => w ? w[0].toUpperCase() + w.slice(1) : '';
  const mean = `<span class="mean">${meaning(c, r, res, b, st)}</span>`;
  if (st === 'na') {
    // Not run: say why in a full sentence and show no empty numbers line.
    const why = (t && t.why) || (c === 'e' ? r.e.why : '') || 'Not enough data for this test';
    let pre = '';
    if (c === 'e' && t && t.pre != null) pre = ` Behaviour was already ${t.pre >= 0 ? 'above' : 'below'} its usual level before the spikes (${fmt(t.pre)} ${esc(b.unit)}), so any later change may continue a movement already under way (too few spikes to test this).`;
    const det = c === 'e' && t && t.cm != null ? ` <span class="full-only">${esc(testLine(c, r, res, b))}</span>` : '';
    return `<b>Not tested:</b> ${esc(why.replace(/: shown, not tested$/, ''))}. ${mean}${pre}${det}`;
  }
  const tag = st === 'sig' ? '<b class="good">Survives correction.</b>' : st === 'nom' ? '<b class="warn">p < .05 alone; does not survive correction.</b>' : '<b>Not significant.</b>';
  // Short series: the p that counts is the shuffle (permutation/placebo) check, not the model p. Say so in plain words.
  const short = t.pu != null && t.p != null && t.pu !== t.p
    ? ` <span class="short">Short series (${fmtN(r.n)} ${per(res)}s, under 150): the page judges it by the shuffle check (p ${fmtP(t.pu)}), not the model p (${fmtP(t.p)}), because with so few periods the model cannot reliably tell a real link from each series' own slow drift.</span>` : '';
  const pp = c === 'e' ? (t.pe != null ? ` · placebo p ${fmtP(t.pe)}` : '') : (t.pp != null ? ` · permutation p ${fmtP(t.pp)}` : '');
  let extra = '';
  if (c === 'c') extra = ` Same ${per(res)}: r = ${fmt(r.c.r0)}. Behaviour leading rhetoric: r = ${fmt(r.c.br)} at ${pers(r.c.bk, res)} (p ${fmtP(r.c.bp)}, context only).`;
  if (c === 'e' && t.pre != null) extra = ` Pre-trend: ${fmt(t.pre)} ${esc(b.unit)} in the ${pers(META.res[res].H, res)} before the spike, relative to baseline${t.prp != null ? ` (p ${fmtP(t.prp)})` : ''}.` + (t.why ? ` ${esc(cap(t.why))}.` : '');
  return `${tag} ${mean}${short} <span class="full-only">${esc(testLine(c, r, res, b))}${extra}</span> <span class="num full-only">p ${fmtP(t.p)}${t.pu !== t.p && t.pu != null ? ` (used ${fmtP(t.pu)})` : ''}${pp} · q ${fmtP(t.q)}</span>`;
}

/** One plain-English sentence for the current view, shown under the main chart. */
function plainResult(r, k, b, res) {
  if (!r) return 'In words: these two series do not overlap in this window, so nothing is tested.';
  if (r.s !== 'ok') return `In words: this pair is shown but not tested, because ${esc(r.why)}.`;
  const st = ['c', 'e', 'd'].map(c => testStatus(r[c]));
  const nsig = st.filter(x => x === 'sig').length, nnom = st.filter(x => x === 'nom').length;
  const out = nsig ? `${nsig} of the 3 tests survive${nsig === 1 ? 's' : ''} correction for multiple testing`
    : nnom ? `${nnom} of the 3 tests reach${nnom === 1 ? 'es' : ''} p < 0.05 alone, but none survives correction` : 'none of the 3 tests finds a sign in this record of the rhetoric moving first';
  const c = r.c;
  const lead = c && c.rk != null ? ` With the rhetoric ${pers(c.k, res)} ahead of the behaviour, the correlation is r = ${fmt(c.rk)}; in the same ${per(res)} it is r = ${fmt(c.r0)} (r runs from −1 to 1; 0 means no relation).` : '';
  return `In words: ${out}.${lead}`;
}

function hover(i, click) {
  const o = seriesState, tip = $('tip');
  if (!o || i < 0) { tip.innerHTML = 'Hover or tap the chart for values (or focus it and use the arrow keys); tap a marked spike, or press Enter on it, to read its evidence.'; return; }
  const sp = o.spikes.find(s => Math.abs(s.i - i) <= (o.res === 'week' ? 0 : 3));
  tip.innerHTML = `<b>${o.res === 'week' ? 'Week of ' : ''}${o.dates[i]}</b> · rhetoric ${o.rhet[i] == null ? 'no documents' : o.rhet[i].toFixed(3)} · ${esc(o.b.short)} ${o.bser[i] == null ? 'no data' : Math.round(o.bser[i] * 10) / 10}` + (sp ? ` · <span class="warn">spike (z ${sp.z.toFixed(1)})</span>` : '');
  if (click && sp) { S.spike = sp.key; update(); $('spikes').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
}

function renderFamily(fam, res) {
  const card = document.querySelector('.fam');
  if (card && !card.id) card.id = 'fam';
  const cr = chanceRange(fam, META.calib);
  const rng = a => `${+(a[0] * 100).toFixed(1)}–${+(a[1] * 100).toFixed(1)}%`;
  const inRange = fam.nominal <= cr.hi;
  $('fam-sum').innerHTML = `Across all <b>${fmtN(fam.m)}</b> primary tests at this resolution and window, <b>${fmtN(fam.nominal)}</b> reach p < 0.05. If rhetoric and behaviour were unrelated, about <b>${fmtN(cr.flat)}</b> would if every test were an exact 5% test.` +
    (cr.lo !== cr.hi ? ` They are not: on unrelated simulated series the distributed-lag model passes ${rng(META.calib.d)} of the time, the event study ${rng(META.calib.e)} and the lead-lag test ${rng(META.calib.c)}, so <b>${fmtN(cr.lo)} to ${fmtN(cr.hi)}</b> would pass even if nothing were related. ${fmtN(fam.nominal)} is ${inRange ? 'inside that range, so the count alone is no sign of a real link' : 'above that range'}; tests also share series, which is why only the correction decides.` : '') +
    ` <b>${fmtN(fam.survive)}</b> survive${fam.survive === 1 ? 's' : ''} Benjamini–Hochberg at q < 0.05` +
    (fam.survive ? `, ${fmtN(fam.robust)} of them confirmed by the permutation or placebo check.` : '. <b>Nothing survives correction.</b>');
  $('fam-list').innerHTML = fam.top.map(t => {
    const s = META.streams[t.s], bb = BEH.find(x => x.id === t.b);
    return `<li><button type="button" data-s="${t.s}" data-k="${esc(t.k)}" data-b="${esc(t.b)}">${esc(s.label)}: ${esc(seriesLabel(t.k))} → ${esc(bb ? bb.short : t.b)}<span>${TEST[t.t]} · q ${fmtP(t.q)}${t.robust ? '' : ' · check fails'}</span></button></li>`;
  }).join('');
  $('fam-list').querySelectorAll('button').forEach(btn => btn.onclick = () => {
    apply({ s: +btn.dataset.s, k: btn.dataset.k, b: btn.dataset.b });
    $('verdict').scrollIntoView({ block: 'start', behavior: smooth() });
  });
}

/** Set state from {s (index or stream id), k, b, r, w} and render. */
function apply(o) {
  if (o.s != null) {
    const i = typeof o.s === 'number' ? o.s : META.streams.findIndex(x => x.stream === o.s);
    if (i >= 0) S.s = i;
  }
  if (o.k) {
    const p = o.k.split(':');
    S.kind = p[0];
    if (p[0] === 'tone') S.dim = p[1]; else if (p[0] === 'sal') S.t = p[1]; else { S.t = p[1]; S.dim = p[2]; }
  }
  if (o.b) S.b = o.b;
  if (o.r) S.r = o.r;
  if (o.w) S.w = o.w;
  S.spike = null;
  return update().then(() => {
    if (o.openSpike) {
      const first = document.querySelector('#spikes button[data-k]');
      if (first) { S.spike = first.dataset.k; return update(); }
    }
  });
}
/** The reader's current view, in the same form apply() takes (used to restore it after the walkthrough). */
const getView = () => ({ s: stream().stream, k: key(), b: S.b, r: S.r, w: S.w });
const fromHash = () => {
  const h = new URLSearchParams(location.hash.slice(1));
  return h.get('s') ? { s: h.get('s'), k: h.get('k'), b: h.get('b'), r: h.get('r'), w: h.get('w') } : null;
};
/** On a phone, after a control change, bring the verdict back into view if it has scrolled away. */
function showVerdict() {
  if (!phone()) return;
  const top = $('verdict').getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * 0.6) $('verdict').scrollIntoView({ block: 'start', behavior: smooth() });
}
/** Headline across every view, built from the multiple-testing summary so it always matches the data. */
function renderHeadline() {
  const el = $('headline-num');
  if (!el) return;
  const views = Object.entries(META.bh);
  const m = views.reduce((a, [, f]) => a + f.m, 0), sv = views.reduce((a, [, f]) => a + f.survive, 0);
  const recent = views.filter(([k]) => !k.endsWith('|all'));
  const sr = recent.reduce((a, [, f]) => a + f.survive, 0);
  const since = META.windows.find(w => w.start)?.start?.slice(0, 4);
  const by = {};
  views.forEach(([, f]) => f.top.forEach(t => { by[t.s] = (by[t.s] || 0) + 1; }));
  const [topS, topN] = Object.entries(by).sort((a, b) => b[1] - a[1])[0] || [];
  const pooled = META.bh_pooled;
  el.innerHTML = `Across ${views.length === 4 ? 'four' : fmtN(views.length)} views (<b>${fmtN(m)}</b> tests in all, corrected within each view), <b>${fmtN(sv)}</b> survive correction for multiple testing` +
    (since && recent.length ? `, and <b>${sr ? fmtN(sr) : 'none'}</b> since ${since}` : '') + '.' +
    (pooled ? ` Corrected all together, ${fmtN(pooled.survive)} survive.` : '') +
    (topN > 1 && topN * 2 >= sv ? ` ${topN === sv ? 'All' : fmtN(topN) + ' of the ' + fmtN(sv)} come from one stream: ${esc(META.streams[topS].label)}.` : '');
}

// ---------------------------------------------------------------------------------------------- wiring
$('country').onchange = e => { S.s = META.streams.find(s => s.country === e.target.value).i; S.spike = null; update().then(showVerdict); };
$('stream').onchange = e => { S.s = +e.target.value; S.spike = null; update().then(showVerdict); };
$('target').onchange = e => { S.t = e.target.value; S.spike = null; update().then(showVerdict); };
$('dim').onchange = e => { S.dim = e.target.value; S.spike = null; update().then(showVerdict); };
$('beh').onchange = e => { S.b = e.target.value; S.spike = null; update().then(showVerdict); };
$('copy-link').onclick = () => navigator.clipboard?.writeText(location.href).then(() => { $('copy-link').textContent = 'Link copied'; setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1600); });
// Tour text placeholders are filled from meta, so no chance count is typed by hand.
const tourFill = (k, set) => k === 'chance' ? chanceText(META.bh[`${set.r}|${set.w}`] || { m: 0 }, META.calib) : null;
const tour = createTour(document.body, apply, getView, { mode: detailMode, set: setDetail }, tourFill);
if ($('chance-all')) {
  const ms = Object.values(META.bh).map(f => f.m), cr = Object.values(META.bh).map(f => chanceRange(f, META.calib));
  $('chance-all').textContent = `Between ${fmtN(Math.min(...ms))} and ${fmtN(Math.max(...ms))} tests run in each view. Even if nothing were related, roughly ${fmtN(Math.min(...cr.map(c => c.lo)))} to ${fmtN(Math.max(...cr.map(c => c.hi)))} of them would reach p < 0.05 in a view: more than a flat 5%, because the distributed-lag test runs liberal on unrelated data. The multiple-testing panel gives the range for the current view.`;
}
// Plain captions under the three test charts (shown in Simple mode too).
const CAP = {
  ccf: 'Bars: correlation between the two series when rhetoric is shifted by that many periods (right of 0 = rhetoric first). Lines: 95% range for each lag on its own.',
  es: 'Line: behaviour around rhetoric spikes compared with its usual level; shaded band: 95% range. Grey block: before the spike; blue block: after.',
  dl: 'Dots: change in behaviour, in standard deviations, for a one-standard-deviation rise in rhetoric that many periods earlier; lines: 95% range. The grey dot at 0 is the same period and is not part of the test.',
};
for (const [id, t] of Object.entries(CAP)) $(id)?.insertAdjacentHTML('afterend', `<p class="fine cap">${t}</p>`);
$('start-tour').onclick = () => tour.start();
// Prepared views (the "Presenting this" steps): data-view holds a link hash such as "s=...&k=...&b=...".
document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
  const h = new URLSearchParams(btn.dataset.view);
  apply({ s: h.get('s'), k: h.get('k'), b: h.get('b'), r: h.get('r'), w: h.get('w'), openSpike: h.get('spike') === '1' })
    .then(() => (h.get('focus') ? document.querySelector(h.get('focus')) : $('verdict'))?.scrollIntoView({ block: 'start', behavior: smooth() }));
}));
document.addEventListener('click', e => {
  const a = e.target.closest('a.jump');
  if (!a) return;
  e.preventDefault();
  document.querySelector(a.getAttribute('href'))?.scrollIntoView({ block: 'start', behavior: smooth() });
});
// A pasted link, or Back and Forward, re-renders the view it names.
addEventListener('hashchange', () => { const v = fromHash(); if (v && v.s && !(v.s === stream().stream && v.k === key() && v.b === S.b && v.r === S.r && v.w === S.w)) apply(v); });

// Phone: a result bar stays on screen while the verdict is scrolled away, with a jump to the controls.
const bar = document.createElement('div');
bar.className = 'sticky-res';
bar.hidden = true;
bar.innerHTML = '<span id="sticky-head"></span><button type="button" class="btn">Change pair</button>';
document.body.appendChild(bar);
bar.querySelector('button').onclick = () => document.querySelector('.panel .sec')?.scrollIntoView({ block: 'start', behavior: smooth() });
new MutationObserver(() => { $('sticky-head').textContent = $('v-head').textContent; bar.dataset.s = $('verdict').dataset.s || ''; })
  .observe($('v-head'), { childList: true, characterData: true, subtree: true });
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { bar.hidden = e.isIntersecting || tour.active(); }, { threshold: 0 }).observe($('verdict'));
}

renderHeadline();
apply(fromHash() || def);
$('asof').textContent = `Rhetoric index ${META.rhetoric.corpus_manifest.slice(0, 10)}; analysis built ${META.generated}.`;
