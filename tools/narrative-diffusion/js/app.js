// Narrative Diffusion: pick a talking point, trace where it appears across sources.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { PRESETS } from '../data/presets.js';
import { parse, matcher, summarize, toT, KIND } from './model.js';
import { createTimeline } from './timeline.js';
import { renderRelay } from './relay.js';
import { renderTiles, renderRecords, renderCoverage } from './panel.js';
import { createTour } from './tour.js';
import { addExportBar } from '../../../shared/js/export.js';
import { LANES } from '../data/coverage.js';

const $ = id => document.getElementById(id);
const SPAN = [toT('2022-07-01'), toT('2026-09-30')];
const RANGES = { fit: 'Fit to talking point', recent: '2025 – Sep 2026', all: 'Jul 2022 – Sep 2026' };
const S = { preset: 'takaichi', text: '', range: 'fit', sel: null };
let recs = [], sum = null, m = null, win = SPAN;

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (PRESETS.some(p => p.id === q.get('p'))) S.preset = q.get('p');
  if (q.get('q')) { S.text = q.get('q').slice(0, 60); S.preset = null; }
  if (RANGES[q.get('r')]) S.range = q.get('r');
}
function writeHash() {
  const q = new URLSearchParams();
  if (S.preset) q.set('p', S.preset); else if (S.text) q.set('q', S.text);
  q.set('r', S.range);
  history.replaceState(null, '', '#' + q.toString());
}

function windowFor() {
  if (S.range === 'all' || !sum.hits.length) return SPAN;
  if (S.range === 'recent') return [toT('2025-01-01'), SPAN[1]];
  const a = sum.hits[0].t, b = sum.hits[sum.hits.length - 1].t;
  const pad = Math.max(12 * 864e5, (b - a) * 0.06);
  return [Math.max(SPAN[0], a - pad), Math.min(SPAN[1], b + pad)];
}

function syncControls() {
  $('presets').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === S.preset));
  $('ranges').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.r === S.range));
  if (document.activeElement !== $('q')) $('q').value = S.preset ? '' : S.text;
  const p = PRESETS.find(x => x.id === S.preset);
  $('about').innerHTML = p
    ? `<p class="eyebrow">Talking point</p><h3>${escapeHtml(p.label)} <span lang="zh" class="zh">${escapeHtml(p.zh)}</span></h3><p>${escapeHtml(p.note)}</p>
       <details><summary>Matching rule</summary><p class="fine">A record matches when its title or text window matches <code>${escapeHtml(p.re)}</code> (case-insensitive)${p.ctx ? ` and also <code>${escapeHtml(p.ctx)}</code>` : ''}.</p></details>`
    : `<p class="eyebrow">Your search</p><h3>“${escapeHtml(S.text)}”</h3><p class="fine">Custom searches run over record titles and the short text windows TSM ships with this page (sentences that mention Taiwan or a preset), not over whole articles. They can miss uses deeper in an article.</p>`;
}

function render() {
  m = matcher(S.preset ? { preset: PRESETS.find(p => p.id === S.preset) } : { text: S.text });
  syncControls();
  if (!m) { $('status').textContent = 'Type at least two characters.'; return; }
  sum = summarize(recs, m);
  win = windowFor();
  $('status').textContent = sum.hits.length ? '' : 'No records match. Try a shorter phrase, or Chinese.';
  renderTiles($('tiles'), sum);
  timeline.render(sum, win, S.sel);
  renderRelay($('relay'), sum, S.sel, pick);
  renderRecords($('records'), sum, S.sel, m, sel => { S.sel = sel; render(); });
  renderCoverage($('coverage'), sum, win);
  writeHash();
}

function pick(sel) {
  S.sel = sel;
  render();
  if (matchMedia('(max-width: 1020px)').matches) $('records').scrollIntoView({ block: 'start' });
}

const timeline = createTimeline($('timeline'), $('tl-tip'), { onPick: pick });

function set(patch) { Object.assign(S, patch); S.sel = patch.sel ?? null; render(); }

async function boot() {
  readHash();
  $('presets').innerHTML = PRESETS.map(p => `<button type="button" data-p="${p.id}">${escapeHtml(p.label)}<small lang="zh">${escapeHtml(p.zh)}</small></button>`).join('');
  $('presets').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) set({ preset: b.dataset.p, text: '' }); });
  $('ranges').innerHTML = Object.entries(RANGES).map(([k, v]) => `<button type="button" data-r="${k}">${v}</button>`).join('');
  $('ranges').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { S.range = b.dataset.r; render(); } });
  let t;
  $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { const v = $('q').value.trim(); if (v.length >= 2) set({ preset: null, text: v.slice(0, 60) }); }, 280); });
  $('search').addEventListener('submit', e => { e.preventDefault(); const v = $('q').value.trim(); if (v.length >= 2) set({ preset: null, text: v.slice(0, 60) }); });
  $('copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; } catch { $('copy-link').textContent = 'Copy from the address bar'; }
    setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
  });
  const { RECORDS } = await import('../data/corpus.js');
  recs = parse(RECORDS);
  document.body.classList.remove('loading');
  render();
  const label = () => (S.preset ? PRESETS.find(p => p.id === S.preset).label : `“${S.text}”`);
  const csv = () => [['date', 'source', 'group', 'kind', 'title', 'url'],
    ...sum.hits.slice().sort((a, b) => a.t - b.t).map(r => [r.d, LANES[r.lane].name, LANES[r.lane].group, KIND[r.kind], r.title, r.u])];
  addExportBar(document.querySelector('.tl-card'), {
    target: () => $('timeline'), title: () => `Where “${label().replace(/[“”]/g, '')}” appears, by source`,
    note: 'Data: TSM PRC official-statement and state-media corpus', csv,
  });
  addExportBar($('relay').closest('.card'), {
    target: () => $('relay'), title: () => `First appearance of “${label().replace(/[“”]/g, '')}” in each source`,
    note: 'Data: TSM PRC official-statement and state-media corpus',
  });
  const tour = createTour($('stage'), patch => set(patch));
  $('start-tour').addEventListener('click', tour.start);
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
}
boot();
