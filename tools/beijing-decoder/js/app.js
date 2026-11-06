// Beijing Decoder: paste a statement, see matched formulations inline, a temperature
// readout, and a dictionary with corpus counts and examples.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { TIERS } from '../data/formulations.js';
import { SAMPLES } from '../data/samples.js';
import { findSpans, temperature, BANDS } from './match.js';
import { byId, renderList, renderDetail, tierPill, csvRows } from './dictionary.js';
import { addExportBar } from '../../../shared/js/export.js';
import { dayLink, linkHtml } from '../../../shared/js/links.js';
import { createTour } from './tour.js';

const $ = id => document.getElementById(id);
const S = { sample: 2, sel: null, tier: 0, query: '' };

// ---- Hash --------------------------------------------------------------------
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const s = parseInt(q.get('s'), 10);
  if (Number.isInteger(s) && SAMPLES[s]) S.sample = s;
  if (q.get('s') === 'own') S.sample = -1;
  if (byId[q.get('f')]) S.sel = q.get('f');
  const t = parseInt(q.get('t'), 10);
  if (t >= 1 && t <= 5) S.tier = t;
}
function writeHash() {
  const q = new URLSearchParams();
  q.set('s', S.sample >= 0 ? S.sample : 'own');
  if (S.sel) q.set('f', S.sel);
  if (S.tier) q.set('t', S.tier);
  history.replaceState(null, '', '#' + q.toString());
}

// ---- Decode ------------------------------------------------------------------
function decode() {
  const text = $('input').value;
  const spans = findSpans(text);
  let html = '', last = 0;
  for (const s of spans) {
    html += escapeHtml(text.slice(last, s.start));
    html += `<mark class="hl t${s.f.tier}${s.f.id === S.sel ? ' on' : ''}" tabindex="0" data-id="${s.f.id}">${escapeHtml(text.slice(s.start, s.end))}</mark>`;
    last = s.end;
  }
  html += escapeHtml(text.slice(last));
  $('decoded').innerHTML = html.trim() ? html : '<span class="fine">Paste a statement above to decode it.</span>';
  renderTemp(temperature(spans), spans);
}

function renderTemp(t, spans) {
  const box = $('temp');
  if (!t) {
    box.innerHTML = `<div class="gauge">${BANDS.map(b => `<span>${b.name}</span>`).join('')}</div>
      <p class="fine">No formulation from the dictionary found. That does not make the text mild: the dictionary covers ${Object.keys(byId).length} recurring formulas, not every threat.</p>`;
    return;
  }
  const pct = ((t.score - 1) / 4) * 100;
  const found = [...new Map(spans.map(s => [s.f.id, s.f])).values()].sort((a, b) => b.tier - a.tier);
  box.innerHTML = `<div class="t-head"><b class="t-name tb${Math.round(Math.min(5, t.score))}">${t.band.name}</b><span class="num">${t.score.toFixed(1)} / 5</span></div>
    <div class="gauge" role="img" aria-label="Temperature ${t.score.toFixed(1)} of 5, ${t.band.name}">${BANDS.map(b => `<span>${b.name}</span>`).join('')}<i style="left:${pct.toFixed(1)}%"></i></div>
    <p class="t-desc">${t.band.desc}</p>
    <p class="fine">${t.why.join(' ')}</p>
    <div class="t-tiers">${t.byTier.map((fs, i) => `<div class="t-row"><span>${tierPill(i + 1)}</span><span class="t-fs">${fs.length ? fs.map(f => `<button type="button" class="chip" data-id="${f.id}">${escapeHtml(f.en)}</button>`).join('') : '<span class="fine">none</span>'}</span></div>`).join('')}</div>
    <p class="fine"><span class="num">${found.length}</span> distinct formulations, <span class="num">${spans.length}</span> matches.</p>`;
}

// ---- Tooltips on highlights ----------------------------------------------------
function showTip(m) {
  const f = byId[m.dataset.id];
  const tip = $('tip');
  tip.innerHTML = `<p class="tt-zh" lang="zh">${escapeHtml(f.zh)}</p><p class="tt-en"><b>${escapeHtml(f.en)}</b></p>${tierPill(f.tier)}<p class="tt-g">${escapeHtml(f.gloss)}</p><p class="fine">Click for examples and counts.</p>`;
  tip.hidden = false;
  const box = $('decode-card').getBoundingClientRect(), r = m.getBoundingClientRect();
  const left = Math.min(Math.max(4, r.left - box.left), box.width - tip.offsetWidth - 4);
  tip.style.left = left + 'px';
  tip.style.top = (r.bottom - box.top + 6) + 'px';
}

function select(id, scroll = false) {
  S.sel = id;
  renderDetail($('detail'), id);
  renderList($('list'), S);
  document.querySelectorAll('#decoded .hl').forEach(m => m.classList.toggle('on', m.dataset.id === id));
  writeHash();
  if (scroll && matchMedia('(max-width: 1020px)').matches) $('detail').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function loadSample(i) {
  S.sample = i;
  const s = SAMPLES[i];
  $('input').value = s.text;
  const links = [s.u && `<a href="${escapeHtml(s.u)}" target="_blank" rel="noopener">transcript</a>`, s.uz && s.uz !== s.u && `<a href="${escapeHtml(s.uz)}" target="_blank" rel="noopener">Chinese original</a>`].filter(Boolean).join(' · ');
  $('sample-meta').innerHTML = `${s.s} spokesperson${s.sp ? ' ' + escapeHtml(s.sp) : ''}, ${s.d}. ${s.q ? `Asked: “${escapeHtml(s.q.length > 160 ? s.q.slice(0, 157) + '…' : s.q)}” ` : ''}${links}${dayLink(s.d) ? ' · ' + linkHtml(dayLink(s.d), 'That day in the Strait') : ''}`;
  syncSamples();
  decode();
  writeHash();
}
function syncSamples() { $('samples').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === S.sample)); }

// ---- Boot -------------------------------------------------------------------------
readHash();
$('samples').innerHTML = SAMPLES.map((s, i) => `<button type="button" data-i="${i}">${escapeHtml(s.label)}</button>`).join('');
$('samples').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) loadSample(+b.dataset.i); });
$('tiers').innerHTML = `<button type="button" data-t="0">All</button>` + Object.entries(TIERS).map(([k, v]) => `<button type="button" data-t="${k}">${k} · ${v.name}</button>`).join('');
$('tiers').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; S.tier = +b.dataset.t; syncTiers(); renderList($('list'), S); writeHash(); });
const syncTiers = () => $('tiers').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.t === S.tier));
$('filter').addEventListener('input', () => { S.query = $('filter').value; renderList($('list'), S); });
$('list').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) select(b.dataset.id, true); });
$('temp').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) select(b.dataset.id, true); });
let t;
$('input').addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => { if (S.sample >= 0) { S.sample = -1; syncSamples(); $('sample-meta').textContent = 'Your own text. Nothing you paste leaves your browser.'; } decode(); writeHash(); }, 150);
});
$('clear').addEventListener('click', () => { $('input').value = ''; S.sample = -1; syncSamples(); $('sample-meta').textContent = 'Your own text. Nothing you paste leaves your browser.'; decode(); writeHash(); $('input').focus(); });
const dec = $('decoded');
dec.addEventListener('mouseover', e => { const m = e.target.closest('.hl'); if (m) showTip(m); });
dec.addEventListener('mouseout', e => { if (e.target.closest('.hl')) $('tip').hidden = true; });
dec.addEventListener('focusin', e => { const m = e.target.closest('.hl'); if (m) showTip(m); });
dec.addEventListener('focusout', () => { $('tip').hidden = true; });
dec.addEventListener('click', e => { const m = e.target.closest('.hl'); if (m) select(m.dataset.id, true); });
dec.addEventListener('keydown', e => { const m = e.target.closest('.hl'); if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(m.dataset.id, true); } });

syncTiers();
if (S.sample >= 0) loadSample(S.sample); else { $('sample-meta').textContent = 'Your own text. Nothing you paste leaves your browser.'; decode(); }
if (!S.sel) {
  // Default: the strongest formulation in the loaded sample.
  const spans = findSpans($('input').value);
  S.sel = spans.length ? spans.reduce((a, b) => (b.f.tier > a.f.tier ? b : a)).f.id : 'fire';
}
select(S.sel);
const tour = createTour($('stage'), { loadSample, select, setTier: v => { S.tier = v; syncTiers(); renderList($('list'), S); } });
$('start-tour').addEventListener('click', tour.start);
addExportBar(document.querySelector('.dict-head'), { csv: csvRows, csvLabel: 'Copy counts as CSV' });
$('copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; } catch { $('copy-link').textContent = 'Copy from the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
});
