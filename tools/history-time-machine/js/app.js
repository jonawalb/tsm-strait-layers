// Taiwan Time Machine: wires the year slider, maps, timeline, panel, compare view, tour and URL hash.
import { EVENTS, CATS, yearOf } from '../data/events.js';
import { PLACES, controller, YEAR0, YEAR1 } from '../data/control.js';
import { createMap } from './map.js';
import { createTimeline } from './timeline.js';
import { renderControl, renderEvent, renderFilters, renderLegend, renderDiff, renderTable, renderSources, diffOf, eraText } from './panel.js';
import { createTour } from './tour.js';
import { readHash, writeHash } from './hash.js';
import { SRC } from '../data/sources.js';
import { addExportBar } from '../../../shared/js/export.js';

const $ = id => document.getElementById(id);
const EVS = [...EVENTS].sort((a, b) => a.date.localeCompare(b.date));
const BY_ID = new Map(EVS.map(e => [e.id, e]));
const S = { a: 1949, b: null, sel: 'prc-1949', f: new Set(CATS.map(c => c.id)) };

const mapA = createMap($('map-a'));
const mapB = createMap($('map-b'));
const visible = () => EVS.filter(e => e.cats.some(c => S.f.has(c)));
const tl = createTimeline($('timeline'), {
  onYear: (y, which) => { stopPlay(); which === 'b' ? setB(y) : setYear(y); },
  onEvent: e => pick(e.id, true),
});

function firstIn(year) { return visible().find(e => yearOf(e) === year) || null; }

function setYear(y, keepSel = false) {
  S.a = Math.max(YEAR0, Math.min(YEAR1, y));
  if (!keepSel || !BY_ID.get(S.sel) || yearOf(BY_ID.get(S.sel)) !== S.a) S.sel = firstIn(S.a)?.id || null;
  render();
}
function setB(y) { S.b = Math.max(YEAR0, Math.min(YEAR1, y)); render(); }

function pick(id, jump) {
  const e = BY_ID.get(id);
  if (!e) return;
  if (!e.cats.some(c => S.f.has(c))) e.cats.forEach(c => S.f.add(c));
  S.sel = id;
  if (jump) S.a = yearOf(e);
  render();
}

function changedSet(y0, y1) {
  return new Set(PLACES.filter(p => controller(p, y0) !== controller(p, y1)).map(p => p.id));
}

function render() {
  const list = visible();
  const ev = S.sel ? BY_ID.get(S.sel) : null;
  const cmp = S.b != null;
  $('year').value = S.a;
  $('year-out').textContent = S.a;
  $('era').textContent = eraText(S.a);
  renderControl($('ctl'), $('ctl-title'), S.a, S.a - 1);
  renderEvent($('event'), ev, S.a, {
    prev: [...list].reverse().find(e => yearOf(e) < S.a),
    next: list.find(e => yearOf(e) > S.a),
    sameYear: list.filter(e => yearOf(e) === S.a),
  });
  const place = ev && yearOf(ev) === S.a ? ev.place : null;
  $('maps').classList.toggle('split', cmp);
  $('box-b').hidden = !cmp;
  $('diff').hidden = !cmp;
  $('b-wrap').hidden = !cmp;
  $('compare').checked = cmp;
  if (cmp) {
    const ch = changedSet(S.a, S.b);
    // Left map always shows the earlier year; the event highlight follows the main year.
    const [lo, hi] = S.a <= S.b ? [S.a, S.b] : [S.b, S.a];
    mapA.update(lo, { place: lo === S.a ? place : null, changed: ch });
    mapB.update(hi, { place: hi === S.a && lo !== S.a ? place : null, changed: ch });
    $('year-b').value = S.b;
    $('year-b-out').textContent = S.b;
    renderDiff($('diff'), diffOf(S.a, S.b, list));
  } else {
    mapA.update(S.a, { place, changed: changedSet(S.a - 1, S.a) });
  }
  const tlSvg = $('timeline');
  tlSvg.dataset.compare = cmp ? '1' : '0';
  tlSvg.dataset.a = S.a;
  if (cmp) tlSvg.dataset.b = S.b;
  tl.setEvents(list, S.sel);
  tl.setYears(S.a, S.b);
  $('prev-ev').disabled = !list.some(e => e.date < (ev ? ev.date : S.a + '-00'));
  $('next-ev').disabled = !list.some(e => ev ? e.date > ev.date : yearOf(e) > S.a);
  document.querySelectorAll('#filters input').forEach(i => { i.checked = S.f.has(i.value); });
  writeHash(S);
}

function step(dir) {
  const list = visible(), ev = S.sel ? BY_ID.get(S.sel) : null;
  const i = ev ? list.indexOf(ev) : -1;
  let n;
  if (i >= 0) n = list[i + dir];
  else n = dir > 0 ? list.find(e => yearOf(e) > S.a) : [...list].reverse().find(e => yearOf(e) < S.a);
  if (n) pick(n.id, true);
}

// Play: one year every 650 ms, pausing a beat on years with events.
let timer = null;
function stopPlay() { clearTimeout(timer); timer = null; $('play').setAttribute('aria-pressed', 'false'); $('play').textContent = 'Play'; }
function tick() {
  if (S.a >= YEAR1) { stopPlay(); return; }
  setYear(S.a + 1);
  timer = setTimeout(tick, firstIn(S.a) ? 1400 : 450);
}
$('play').addEventListener('click', () => {
  if (timer) { stopPlay(); return; }
  if (S.a >= YEAR1) setYear(YEAR0);
  $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = 'Pause';
  timer = setTimeout(tick, 400);
});

$('year').addEventListener('input', e => { stopPlay(); setYear(+e.target.value); });
$('year-b').addEventListener('input', e => setB(+e.target.value));
$('prev-ev').addEventListener('click', () => { stopPlay(); step(-1); });
$('next-ev').addEventListener('click', () => { stopPlay(); step(1); });
$('compare').addEventListener('change', e => {
  if (e.target.checked) S.b = S.a < 1990 ? Math.min(YEAR1, S.a + (S.a < 1955 ? Math.max(1, 1955 - S.a) : 30)) : 1945;
  else S.b = null;
  render();
});
const PAIRS = [[1894, 1895], [1944, 1945], [1948, 1949], [1954, 1955], [1978, 1979], [1986, 1996]];
$('pairs').innerHTML = PAIRS.map(([a, b]) => `<button type="button" class="btn" data-a="${a}" data-b="${b}">${a} / ${b}</button>`).join('');
$('pairs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.a = +b.dataset.b; S.b = Math.max(YEAR0, +b.dataset.a); S.sel = firstIn(S.a)?.id || null;
  render();
});
// Jump buttons inside rendered HTML (event card, diff, table).
document.addEventListener('click', e => {
  const b = e.target.closest('.jump');
  if (b && !b.closest('#evtable')) pick(b.dataset.id, true);
});

function onFilter(c, on) {
  on ? S.f.add(c) : S.f.delete(c);
  if (S.sel && !BY_ID.get(S.sel).cats.some(x => S.f.has(x))) S.sel = firstIn(S.a)?.id || null;
  render();
}
renderLegend($('legend'));
renderTable($('evtable'), EVS, (id) => { pick(id, true); $('maps').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); });
renderSources($('sources'));
addExportBar($('maps'), {
  where: 'after', target: () => $('map-a'),
  title: () => `Who controlled Taiwan and its outlying islands at the end of ${S.a}`,
  note: 'TSM Taiwan Time Machine; sources listed on the page',
});
addExportBar($('evtable').closest('.tablewrap'), {
  where: 'after', csvLabel: 'Copy event list as CSV',
  csv: () => [['date', 'event', 'categories', 'sources'],
    ...EVS.map(e => [e.date, e.title, e.cats.map(c => CATS.find(k => k.id === c)?.name || c).join('; '), e.src.map(k => SRC[k].u).join(' ')])],
});

const tour = createTour($('tour-slot'), s => {
  stopPlay();
  S.f = new Set(s.f || CATS.map(c => c.id));
  S.a = s.a; S.b = s.b ?? null; S.sel = s.e || firstIn(s.a)?.id || null;
  render();
});
$('start-tour').addEventListener('click', () => tour.start());
$('copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; }
  catch { $('copy-link').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
});

readHash(S, new Set(BY_ID.keys()));
if (!S.sel || yearOf(BY_ID.get(S.sel)) !== S.a) S.sel = firstIn(S.a)?.id || null;
const tourParam = new URLSearchParams(location.hash.slice(1)).get('tour');
renderFilters($('filters'), S.f, onFilter);
render();
if (tourParam) tour.goto(Math.max(0, Math.min(6, +tourParam - 1)));
