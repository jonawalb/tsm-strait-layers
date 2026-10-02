// Briefing Packet Builder: settings panel, URL hash, build pipeline, preview scaling, output.
import { AS_OF, MIN_DATE, MONTHS, EX_LIST, PADS, defaultRange, parseRange, rangeToken, resolve, priorPeriod } from './range.js';
import { Sources, summary, chartDays, ccg, transits, exercises } from './data.js';
import { SECTIONS, SEC_TITLE, summaryBlocks, chartBlocks, ccgBlocks, transitBlocks, exerciseBlocks } from './sections.js';
import { statementBlocks, aisBlocks, sourceBlocks } from './sections2.js';
import { loadStatements, selectStatements } from './statements.js';
import { overlapsAis, aisSummary } from './ais.js';
import { coverHtml, keyFigures } from './cover.js';
import { paginate } from './paginate.js';
import { esc, fmtRange, fmtDate, monthName, spanDays, todayIso } from './util.js';
import { createTour } from './tour.js';

const $ = id => document.getElementById(id);
const ALL = SECTIONS.map(s => s.id);
const S = { r: defaultRange(), secs: new Set(ALL), cap: 8, forWho: '' };
let doc = { sheets: [] }, buildId = 0;

// ---- Hash ------------------------------------------------------------------
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const r = parseRange(h.get('r'));
  if (r) S.r = r;
  if (h.has('s')) S.secs = new Set(h.get('s').split(',').filter(k => ALL.includes(k)));
  const n = +h.get('n');
  if (n >= 3 && n <= 20) S.cap = n;
  S.forWho = (h.get('for') || '').slice(0, 80);
}
function hashString() {
  const h = new URLSearchParams({ r: rangeToken(S.r), s: ALL.filter(k => S.secs.has(k)).join(','), n: S.cap });
  if (S.forWho) h.set('for', S.forWho);
  return '#' + h.toString();
}
const shareUrl = () => location.href.split('#')[0] + hashString();
const writeHash = () => history.replaceState(null, '', hashString());

// ---- Controls --------------------------------------------------------------
function mountControls() {
  $('month').innerHTML = MONTHS.map(m => `<option value="${m}">${monthName(m)}${m === AS_OF.slice(0, 7) ? ' (to date)' : ''}</option>`).join('');
  $('exercise').innerHTML = EX_LIST.map(e => `<option value="${e.id}">${esc(e.short)} · ${fmtRange(e.start, e.end)}</option>`).join('');
  for (const id of ['from', 'to']) { $(id).min = MIN_DATE; $(id).max = AS_OF; }
  $('sections').innerHTML = SECTIONS.map(s => `<label class="tg"><input type="checkbox" data-sec="${s.id}"><span class="sw"></span>
    <span class="t">${s.title}<small>${s.help}</small></span></label>`).join('');
  $('preset').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const R = resolve(S.r), k = b.dataset.k;
    if (k === '7d') S.r = { kind: '7d' };
    if (k === 'm') S.r = { kind: 'm', m: S.r.kind === 'm' ? S.r.m : R.to.slice(0, 7) };
    if (k === 'ex') S.r = S.r.kind === 'ex' ? S.r : { kind: 'ex', id: EX_LIST[0].id, pad: 3 };
    if (k === 'c') S.r = { kind: 'c', from: R.from, to: R.to };
    update();
  });
  $('month').addEventListener('change', e => { S.r = { kind: 'm', m: e.target.value }; update(); });
  $('exercise').addEventListener('change', e => { S.r = { kind: 'ex', id: e.target.value, pad: S.r.pad ?? 3 }; update(); });
  $('pad').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.r = { ...S.r, pad: +b.dataset.p }; update();
  });
  const custom = () => { if ($('from').value && $('to').value) { S.r = { kind: 'c', from: $('from').value, to: $('to').value }; update(); } };
  $('from').addEventListener('change', custom);
  $('to').addEventListener('change', custom);
  $('sections').addEventListener('change', e => {
    const k = e.target.dataset.sec; if (!k) return;
    e.target.checked ? S.secs.add(k) : S.secs.delete(k); update();
  });
  $('cap').addEventListener('input', e => { S.cap = +e.target.value; $('cap-out').textContent = S.cap; update(250); });
  $('for').addEventListener('input', e => { S.forWho = e.target.value.trim(); update(400); });
  $('print').addEventListener('click', () => window.print());
  $('pdf').addEventListener('click', makePdf);
  $('copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl()); flash($('copy-link'), 'Link copied'); }
    catch { flash($('copy-link'), 'Copy the address bar'); }
  });
}

function flash(btn, text) {
  const t = btn.textContent; btn.textContent = text;
  setTimeout(() => { btn.textContent = t; }, 1600);
}

function syncControls(R) {
  $('preset').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === S.r.kind)));
  $('range-detail').querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== S.r.kind; });
  if (S.r.kind === 'm') $('month').value = S.r.m;
  if (S.r.kind === 'ex') {
    $('exercise').value = S.r.id;
    $('pad').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.p === S.r.pad)));
  }
  $('from').value = R.from; $('to').value = R.to;
  $('sections').querySelectorAll('input').forEach(i => {
    i.checked = S.secs.has(i.dataset.sec);
    if (i.dataset.sec === 'ais') i.closest('.tg').classList.toggle('off', !overlapsAis(R));
  });
  $('cap').value = S.cap; $('cap-out').textContent = S.cap;
  if (document.activeElement !== $('for')) $('for').value = S.forWho;
  const P = priorPeriod(R.from, R.to);
  $('range-read').innerHTML = `<dt>Range</dt><dd>${fmtRange(R.from, R.to)}</dd><dt>Days</dt><dd>${spanDays(R.from, R.to)}</dd>
    <dt>Compared with</dt><dd>${fmtRange(P.from, P.to)}</dd><dt>Data through</dt><dd>${fmtDate(AS_OF)}</dd>`;
}

// ---- Build -----------------------------------------------------------------
let timer = 0;
function update(delay = 0) {
  const R = resolve(S.r);
  syncControls(R);
  writeHash();
  clearTimeout(timer);
  timer = setTimeout(() => build(R), delay);
}

async function build(R) {
  const id = ++buildId;
  $('bar-status').textContent = 'Building the packet…';
  const src = new Sources(), on = k => S.secs.has(k);
  const ctx = {};
  if (on('sum') || on('chart')) ctx.sum = summary(R, src);
  if (on('ccg') || on('chart')) ctx.ccg = ccg(R, src);
  if (on('tr') || on('chart')) ctx.tr = transits(R, src);
  if (on('ex')) ctx.ex = exercises(R, src);
  if (on('st')) ctx.st = selectStatements(await loadStatements(), R, S.cap, src);
  const showAis = on('ais') && overlapsAis(R);
  if (showAis) ctx.ais = await aisSummary(R, src);
  if (id !== buildId) return;

  const blocks = [];
  let num = 0;
  if (on('sum')) blocks.push(...summaryBlocks(R, ctx.sum, ++num));
  if (on('chart')) blocks.push(...chartBlocks(R, chartDays(R, ctx.ccg.rows, ctx.tr.rows), ++num));
  if (on('ccg')) blocks.push(...ccgBlocks(R, ctx.ccg, ++num));
  if (on('tr')) blocks.push(...transitBlocks(R, ctx.tr, ++num));
  if (on('ex')) blocks.push(...exerciseBlocks(R, ctx.ex, ++num));
  if (on('st')) blocks.push(...statementBlocks(R, ctx.st, S.cap, ++num));
  if (showAis) blocks.push(...aisBlocks(R, ctx.ais, ++num));
  const secs = [...S.secs].filter(k => k !== 'ais' || showAis);
  const gen = todayIso();
  blocks.push(...sourceBlocks(R, secs, src, ++num, gen));

  await document.fonts.ready;
  if (id !== buildId) return;
  const run = esc(`${R.title} · ${fmtRange(R.from, R.to)}`);
  const cover = toc => coverHtml({ R, forWho: S.forWho, gen, toc, keys: keyFigures(Object.fromEntries(Object.entries(ctx).filter(([k]) => on(k)))), share: shareUrl() });
  const order = [...ALL.filter(k => S.secs.has(k) && (k !== 'ais' || showAis)), 'src'];
  doc = paginate($('preview'), { coverHtml: cover(order.map(k => ({ title: SEC_TITLE[k], page: '' }))), blocks, run, titles: SEC_TITLE });
  doc.sheets[0].innerHTML = cover(order.map(k => ({ title: SEC_TITLE[k], page: doc.firstPage[k] ?? '' })));
  doc.R = R;
  fit();
  document.body.classList.remove('loading');
  const N = doc.sheets.length;
  $('bar-status').innerHTML = `<b>${esc(R.title)}</b> · ${fmtRange(R.from, R.to)} · ${N} ${N === 1 ? 'page' : 'pages'}, US Letter`;
}

// ---- Preview scaling -------------------------------------------------------
function fit() {
  const w = $('preview').clientWidth;
  const k = Math.min(1, (w - 2) / 816);
  $('preview').style.setProperty('--k', k.toFixed(4));
}
let rt = 0;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 100); });

// ---- PDF -------------------------------------------------------------------
async function makePdf() {
  const btn = $('pdf'), st = $('pdf-status');
  if (!doc.sheets.length) return;
  btn.disabled = true;
  const keep = st.textContent;
  try {
    st.textContent = 'Loading the PDF library…';
    const { downloadPdf } = await import('./pdf.js');
    await downloadPdf(doc.sheets, {
      title: `TSM briefing packet: ${doc.R.title}, ${fmtRange(doc.R.from, doc.R.to)}`, file: doc.R.file,
      onProgress: (i, n) => { st.textContent = `Rendering page ${i} of ${n}…`; },
    });
    st.textContent = 'PDF saved to your downloads.';
    setTimeout(() => { st.textContent = keep; }, 4000);
  } catch (e) {
    st.textContent = `The PDF could not be built (${e.message}). Use "Print or save as PDF" instead.`;
  } finally {
    btn.disabled = false;
  }
}

// ---- Boot ------------------------------------------------------------------
readHash();
mountControls();
update();
addEventListener('hashchange', () => { readHash(); update(); });
const tour = createTour(document.body, patch => {
  if (patch.r) S.r = patch.r;
  if (patch.secs) S.secs = new Set(patch.secs);
  if (patch.cap) S.cap = patch.cap;
  update();
  if (patch.focus) document.getElementById(patch.focus)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
});
$('start-tour').addEventListener('click', tour.start);
