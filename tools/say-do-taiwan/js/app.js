// Say-Do Gap Monitor: state, controls and rendering. Shared verbatim by say-do-taiwan and say-do-global;
// everything config-specific comes from data/meta.js and data/behaviour.js.
import { META } from '../data/meta.js';
import { BEH } from '../data/behaviour.js';
import { DIM, seriesLabel, seriesHelp, tgt, TEST, fmtP, fmt, fmtN, esc, per, pers, verdict, testStatus, testLine, setMetaRes } from './labels.js';
import { drawSeries, drawCCF, drawES, drawDL } from './charts.js';
import { renderSpikes } from './evidence.js';
import { createTour, DEFAULTS } from './tour.js';

setMetaRes(META.res);
const $ = id => document.getElementById(id);
const DAY = 864e5;
const di = (d, base) => Math.round((Date.parse(d) - Date.parse(base)) / DAY);
const addDays = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const COUNTRY = { CN: 'China', RU: 'Russia', IR: 'Iran', VE: 'Venezuela' };
const cache = {};
const def = DEFAULTS[META.config.id];
const S = { s: 0, kind: 'tone', t: '', dim: 'threat', b: '', r: 'week', w: 'all', spike: null };

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
  seg($('kind'), [['tone', 'Overall tone'], ['stance', 'Tone on a target'], ['sal', 'Attention']], S.kind, v => { S.kind = v; fixState(); update(); });
  $('target-row').hidden = S.kind === 'tone';
  opts($('target'), targets.map(t => [t, tgt(t)]), S.t);
  $('dim-row').hidden = S.kind === 'sal';
  opts($('dim'), (S.kind === 'tone' ? META.tone : META.stance).map(d => [d, DIM[d]]), S.dim);
  $('series-help').textContent = seriesHelp(key());
  opts($('beh'), behsFor(cc).map(b => [b.id, b.short + (b.weekly_only ? ' (weekly only)' : '')]), S.b);
  const b = beh();
  $('beh-help').textContent = b ? `${b.label}. ${b.note}` : '';
  seg($('res'), [['week', 'Weekly'], ['day', 'Daily']], S.r, v => { S.r = v; S.spike = null; update(); });
  $('res').querySelector('[data-v="day"]').disabled = !!(b && b.weekly_only);
  seg($('win'), META.windows.map(w => [w.id, w.start ? `Since ${w.start.slice(0, 4)}` : 'Full overlap']), S.w, v => { S.w = v; S.spike = null; update(); });
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
  const v = verdict(r, fam, res);
  $('verdict').dataset.s = v.cls;
  $('v-head').textContent = v.head;
  $('v-body').textContent = v.body;
  $('v-pair').innerHTML = `<b>${esc(stream().label)}</b>: ${esc(seriesLabel(k))} <span aria-hidden="true">→</span> <b>${esc(b.short)}</b> · ${res === 'week' ? 'weekly' : 'daily'}` +
    (r ? ` · ${esc(r.a[0])} to ${esc(r.a[1])} (${fmtN(r.n)} ${per(res)}s, rhetoric in ${Math.round(r.cov * 100)}%)` : '');
  $('chips').innerHTML = ['c', 'e', 'd'].map(c => {
    const t = r && r[c], s = testStatus(t);
    const lab = s === 'sig' ? 'survives correction' : s === 'nom' ? 'p < .05, not after correction' : s === 'none' ? 'not significant' : 'not tested';
    return `<li data-s="${s}"><b>${TEST[c]}</b><span>${lab}</span><span class="num">${t && t.pu != null ? `p ${fmtP(t.pu)} · q ${fmtP(t.q)}` : ''}</span></li>`;
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
    rLabel: `${seriesLabel(k)} (${isShare ? 'share of documents' : 'document mean'})`, bLabel: `${b.short} (${b.unit}${res === 'week' && b.agg === 'mean' ? ', weekly average' : res === 'week' ? ', per week' : ''})`,
    rFmt: v => isShare ? Math.round(v * 100) + '%' : v.toFixed(2) }, hover);
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
  renderSpikes($('spikes'), spikes, S.spike, res, k2 => { S.spike = k2; update(); });
  $('spike-count').textContent = spikes.length ? `${spikes.length} in view` : '';
  renderFamily(fam, res);
}

function testText(c, r, res, b) {
  const t = r[c], st = testStatus(t);
  const tag = st === 'sig' ? '<b class="good">Survives correction.</b>' : st === 'nom' ? '<b class="warn">p < .05 alone; does not survive correction.</b>' : st === 'none' ? '<b>Not significant.</b>' : '<b>Not tested.</b>';
  const pp = c === 'e' ? (t.pe != null ? `placebo p ${fmtP(t.pe)}` : '') : (t.pp != null ? `permutation p ${fmtP(t.pp)}` : '');
  let extra = '';
  if (c === 'c') extra = ` Same ${per(res)}: r = ${fmt(r.c.r0)}. Behaviour leading rhetoric: r = ${fmt(r.c.br)} at ${pers(r.c.bk, res)} (p ${fmtP(r.c.bp)}, context only).`;
  if (c === 'e' && t.pre != null) extra = ` Pre-trend: ${fmt(t.pre)} ${esc(b.unit)} in the ${pers(META.res[res].H, res)} before the spike, relative to baseline${t.prp != null ? ` (p ${fmtP(t.prp)})` : ''}.` + (t.why ? ` ${esc(t.why)}.` : '');
  if (c === 'e' && t.pm == null && t.why) return `${tag} ${esc(t.why)}.`;
  return `${tag} ${esc(testLine(c, r, res, b))}${extra} <span class="num">p ${fmtP(t.p)}${t.pu !== t.p && t.pu != null ? ` (used ${fmtP(t.pu)})` : ''} · ${pp} · q ${fmtP(t.q)}</span>`;
}

function hover(i, click) {
  const o = seriesState, tip = $('tip');
  if (!o || i < 0) { tip.innerHTML = 'Hover or tap the chart for values (or focus it and use the arrow keys); tap a marked spike, or press Enter on it, to read its evidence.'; return; }
  const sp = o.spikes.find(s => Math.abs(s.i - i) <= (o.res === 'week' ? 0 : 3));
  tip.innerHTML = `<b>${o.res === 'week' ? 'Week of ' : ''}${o.dates[i]}</b> · rhetoric ${o.rhet[i] == null ? 'no documents' : o.rhet[i].toFixed(3)} · ${esc(o.b.short)} ${o.bser[i] == null ? 'no data' : Math.round(o.bser[i] * 10) / 10}` + (sp ? ` · <span class="warn">spike (z ${sp.z.toFixed(1)})</span>` : '');
  if (click && sp) { S.spike = sp.key; update(); $('spikes').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
}

function renderFamily(fam, res) {
  const exp = Math.round(fam.m * 0.05);
  $('fam-sum').innerHTML = `Across all <b>${fmtN(fam.m)}</b> primary tests at this resolution and window, <b>${fmtN(fam.nominal)}</b> reach p < 0.05. If no rhetoric predicted any behaviour, about <b>${fmtN(exp)}</b> would by chance. <b>${fmtN(fam.survive)}</b> survive${fam.survive === 1 ? 's' : ''} Benjamini–Hochberg at q < 0.05` +
    (fam.survive ? `, ${fmtN(fam.robust)} of them confirmed by the permutation or placebo check.` : '. <b>Nothing survives correction.</b>');
  $('fam-list').innerHTML = fam.top.map(t => {
    const s = META.streams[t.s], bb = BEH.find(x => x.id === t.b);
    return `<li><button type="button" data-s="${t.s}" data-k="${esc(t.k)}" data-b="${esc(t.b)}">${esc(s.label)}: ${esc(seriesLabel(t.k))} → ${esc(bb ? bb.short : t.b)}<span>${TEST[t.t]} · q ${fmtP(t.q)}${t.robust ? '' : ' · check fails'}</span></button></li>`;
  }).join('');
  $('fam-list').querySelectorAll('button').forEach(btn => btn.onclick = () => {
    apply({ s: +btn.dataset.s, k: btn.dataset.k, b: btn.dataset.b });
    $('verdict').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
  update();
}

// ---------------------------------------------------------------------------------------------- wiring
$('country').onchange = e => { S.s = META.streams.find(s => s.country === e.target.value).i; S.spike = null; update(); };
$('stream').onchange = e => { S.s = +e.target.value; S.spike = null; update(); };
$('target').onchange = e => { S.t = e.target.value; S.spike = null; update(); };
$('dim').onchange = e => { S.dim = e.target.value; S.spike = null; update(); };
$('beh').onchange = e => { S.b = e.target.value; S.spike = null; update(); };
$('copy-link').onclick = () => navigator.clipboard?.writeText(location.href).then(() => { $('copy-link').textContent = 'Link copied'; setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1600); });
const tour = createTour(document.body, apply);
$('start-tour').onclick = () => tour.start();

const h = new URLSearchParams(location.hash.slice(1));
apply(h.get('s') ? { s: h.get('s'), k: h.get('k'), b: h.get('b'), r: h.get('r'), w: h.get('w') } : def);
$('asof').textContent = `Rhetoric index ${META.rhetoric.corpus_manifest.slice(0, 10)}; analysis built ${META.generated}.`;
