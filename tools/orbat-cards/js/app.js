// Order of Battle Cards: state, modes, wiring.
import { distKm, escapeHtml } from '../../../shared/js/mapkit.js';
import { UNITS, COUNTRY, TAIPEI, GENERAL_SOURCES, MISSING, METHOD } from '../data/units.js';
import { createMap } from './map.js';
import { renderDeck, syncDeck } from './cards.js';
import { createQuiz } from './quiz.js';
import { createTour } from './tour.js';
import { addExportBar } from '../../../shared/js/export.js';

const ORDER = Object.keys(COUNTRY);
const byId = Object.fromEntries(UNITS.map(u => [u.id, u]));
const S = { mode: 'browse', countries: new Set(ORDER), sel: null, flipped: new Set(), cmp: [] };
readHash();
if (!S.sel) S.sel = UNITS[0].id;

addExportBar(document.getElementById('mapbox'), {
  where: 'after', target: () => document.getElementById('map'),
  title: () => `Formation headquarters around Taiwan: ${ORDER.filter(c => S.countries.has(c)).map(c => COUNTRY[c].name).join(', ')}`,
  note: 'Markers sit on the headquarters city, not on any facility. Sources on each card',
  csv: () => [['formation', 'country', 'type', 'headquarters_city', 'region', 'role', 'sources'],
    ...UNITS.map(u => [u.name, COUNTRY[u.country].name, u.type, u.hq, u.region, u.role, u.sources.map(x => x.u).join(' ')])],
  csvLabel: 'Copy formation list as CSV',
});
const panel = document.getElementById('mode-panel');
const deck = document.getElementById('deck');
const map = createMap(document.getElementById('map'), document.getElementById('tip'), UNITS, { onPick: id => pick(id, true) });
const quiz = createQuiz(panel, {
  pool: () => UNITS.filter(u => S.countries.has(u.country)),
  onHighlight: id => { map.quiz(id); map.select([], {}); },
  onReveal: id => { map.quiz(null); S.sel = id; map.select([id]); sync(); },
});
const km = (a, b) => Math.round(distKm(a, b)).toLocaleString('en-US');

renderDeck(deck, UNITS, {
  onFlip: id => { S.flipped.has(id) ? S.flipped.delete(id) : S.flipped.add(id); S.sel = id; sync(); },
  onShow: id => { pick(id, false); document.getElementById('mapbox').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); },
  onCompare: id => toggleCompare(id),
});

function pick(id, fromMap) {
  S.sel = id;
  if (S.mode === 'compare') { toggleCompare(id, true); return; }
  if (S.mode === 'quiz') return;
  if (!S.countries.has(byId[id].country)) S.countries.add(byId[id].country);
  render();
  if (fromMap) {
    const card = deck.querySelector(`.ocard[data-id="${id}"]`);
    if (card) { card.scrollIntoView({ behavior: 'auto', block: 'nearest' }); card.querySelector('.front [data-act="flip"]')?.focus({ preventScroll: true }); }
  }
}

function toggleCompare(id, addOnly = false) {
  const i = S.cmp.indexOf(id);
  if (i >= 0 && !addOnly) S.cmp.splice(i, 1);
  else if (i < 0) { S.cmp.push(id); if (S.cmp.length > 2) S.cmp.shift(); }
  S.mode = 'compare';
  S.sel = id;
  render();
}

function countryButtons() {
  const box = document.getElementById('countries');
  box.innerHTML = ORDER.map(k => `<button type="button" class="k-${k}" data-k="${k}">${COUNTRY[k].name}<small>${UNITS.filter(u => u.country === k).length}</small></button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (S.countries.has(k) && S.countries.size > 1) S.countries.delete(k); else S.countries.add(k);
    render();
    if (S.mode === 'quiz') quiz.start();
  });
}

function browsePanel() {
  const u = byId[S.sel];
  const groups = ORDER.filter(k => S.countries.has(k)).map(k => `<p class="lbl eyebrow">${COUNTRY[k].name}</p>
    <div class="choices">${UNITS.filter(x => x.country === k).map(x => `<button type="button" data-id="${x.id}" aria-pressed="${x.id === S.sel}">${escapeHtml(x.short)}</button>`).join('')}</div>`).join('');
  panel.innerHTML = `
    ${u ? `<div class="status"><b>${escapeHtml(u.name)}</b><span>${COUNTRY[u.country].name} · HQ ${escapeHtml(u.hq)} · ${km(u.ll, TAIPEI)} km from Taipei</span></div>` : ''}
    <p class="fine">Pick a formation here, on the map or in the deck. Flip a card to read its role, equipment and sources.</p>
    ${groups}`;
  panel.querySelectorAll('[data-id]').forEach(b => b.onclick = () => pick(b.dataset.id, true));
}

function comparePanel() {
  const [a, b] = S.cmp.map(id => byId[id]);
  const opts = sel => UNITS.filter(u => S.countries.has(u.country)).map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${escapeHtml(u.short)} (${COUNTRY[u.country].code})</option>`).join('');
  const d = map.compare(a, b);
  const cell = (u, f) => (u ? f(u) : '<span class="fine">Pick a card</span>');
  panel.innerHTML = `
    <p class="eyebrow">Compare two formations</p>
    <div class="row2cmp">
      <label class="fine">Card A <select id="cmp-a"><option value="">Choose</option>${opts(S.cmp[0])}</select></label>
      <label class="fine">Card B <select id="cmp-b"><option value="">Choose</option>${opts(S.cmp[1])}</select></label>
    </div>
    ${d != null ? `<div class="status"><b>${km(a.ll, b.ll)} km</b><span>between the two headquarters cities, great-circle distance</span></div>` : '<p class="fine">Press <b>Compare</b> on two cards, click two map markers, or choose from the lists.</p>'}
    <table class="cmp-table">
      <tr><th></th><td>${cell(a, u => `<b>${escapeHtml(u.short)}</b>`)}</td><td>${cell(b, u => `<b>${escapeHtml(u.short)}</b>`)}</td></tr>
      <tr><th>Country</th><td>${cell(a, u => COUNTRY[u.country].name)}</td><td>${cell(b, u => COUNTRY[u.country].name)}</td></tr>
      <tr><th>Type</th><td>${cell(a, u => escapeHtml(u.type))}</td><td>${cell(b, u => escapeHtml(u.type))}</td></tr>
      <tr><th>HQ city</th><td>${cell(a, u => escapeHtml(u.hq))}</td><td>${cell(b, u => escapeHtml(u.hq))}</td></tr>
      <tr><th>To Taipei</th><td class="num">${cell(a, u => km(u.ll, TAIPEI) + ' km')}</td><td class="num">${cell(b, u => km(u.ll, TAIPEI) + ' km')}</td></tr>
      <tr><th>Role</th><td>${cell(a, u => escapeHtml(u.role))}</td><td>${cell(b, u => escapeHtml(u.role))}</td></tr>
      <tr><th>Equipment</th><td>${cell(a, u => `<ul>${u.equipment.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`)}</td><td>${cell(b, u => `<ul>${u.equipment.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`)}</td></tr>
    </table>
    ${S.cmp.length ? '<button type="button" class="btn" id="cmp-clear">Clear comparison</button>' : ''}`;
  const setAB = () => {
    S.cmp = [panel.querySelector('#cmp-a').value, panel.querySelector('#cmp-b').value].filter(Boolean);
    render();
  };
  panel.querySelector('#cmp-a').onchange = setAB;
  panel.querySelector('#cmp-b').onchange = setAB;
  const clr = panel.querySelector('#cmp-clear');
  if (clr) clr.onclick = () => { S.cmp = []; render(); };
}

function sync() {
  const visible = new Set(UNITS.filter(u => S.countries.has(u.country)).map(u => u.id));
  syncDeck(deck, { visible, flipped: S.flipped, sel: S.sel, cmp: S.mode === 'compare' ? S.cmp : [] });
  const quizzing = S.mode === 'quiz';
  deck.hidden = quizzing;
  document.getElementById('flip-all').hidden = quizzing;
  document.getElementById('deck-title').textContent = quizzing ? 'Cards are hidden during the quiz' : `${visible.size} cards`;
  const fa = document.getElementById('flip-all');
  const allF = [...visible].every(id => S.flipped.has(id));
  fa.setAttribute('aria-pressed', String(allF));
  fa.textContent = allF ? 'Show fronts' : 'Flip all';
  writeHash();
}

function render() {
  document.querySelectorAll('.modes button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === S.mode)));
  document.querySelectorAll('#countries button').forEach(b => b.setAttribute('aria-pressed', String(S.countries.has(b.dataset.k))));
  map.filter(S.countries);
  if (S.mode !== 'compare') map.compare(null, null);
  if (S.mode !== 'quiz') map.quiz(null);
  if (S.mode === 'browse') { map.select(S.sel ? [S.sel] : []); browsePanel(); }
  if (S.mode === 'compare') { map.select(S.cmp); comparePanel(); }
  sync();
}

function setMode(m) {
  S.mode = m;
  render();
  if (m === 'quiz') quiz.start();
}

function writeHash() {
  const q = new URLSearchParams({ m: S.mode });
  if (S.countries.size < ORDER.length) q.set('c', [...S.countries].join(','));
  if (S.sel) q.set('s', S.sel);
  if (S.cmp.length) q.set('x', S.cmp.join(','));
  history.replaceState(null, '', '#' + q);
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (['browse', 'compare', 'quiz'].includes(q.get('m'))) S.mode = q.get('m');
  const c = (q.get('c') || '').split(',').filter(k => COUNTRY[k]);
  if (c.length) S.countries = new Set(c);
  if (byId[q.get('s')]) S.sel = q.get('s');
  S.cmp = (q.get('x') || '').split(',').filter(id => byId[id]).slice(0, 2);
}

// Wiring
countryButtons();
document.querySelectorAll('.modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
document.getElementById('flip-all').onclick = () => {
  const vis = UNITS.filter(u => S.countries.has(u.country)).map(u => u.id);
  const allF = vis.every(id => S.flipped.has(id));
  vis.forEach(id => (allF ? S.flipped.delete(id) : S.flipped.add(id)));
  sync();
};
document.addEventListener('keydown', e => { if (S.mode === 'quiz') quiz.key(e); });
const tour = createTour(set => {
  if (set.countries) S.countries = new Set(set.countries);
  if (set.sel) S.sel = set.sel;
  if (set.flip) S.flipped = new Set(set.flip);
  S.cmp = set.cmp || [];
  setMode(set.mode || 'browse');
});
document.getElementById('tour-btn').onclick = () => tour.start();
document.getElementById('copy-link').onclick = async e => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(location.href); b.textContent = 'Link copied'; } catch { b.textContent = 'Copy the address bar'; }
  setTimeout(() => { b.textContent = 'Copy link to this view'; }, 1800);
};
const a = (s) => `<a href="${s.u}" target="_blank" rel="noopener">${escapeHtml(s.t)}</a>`;
document.getElementById('sources').innerHTML = GENERAL_SOURCES.map(s => `<li>${a(s)}${s.note ? `. ${escapeHtml(s.note)}` : ''}</li>`).join('');
document.getElementById('missing').innerHTML = MISSING.map(m => `<li>${escapeHtml(m)}</li>`).join('');
document.getElementById('method').innerHTML = METHOD;
setMode(S.mode);
