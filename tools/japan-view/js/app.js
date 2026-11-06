// Japan's View: state, time window, URL hash and wiring.
import { ROWS, STRAITS, STRAIT, ROLES, MONTHS, JSO, HULLS, windowOf, inWin, winLabel, visible, monthName, nice } from './model.js';
import { createMap, arrowTip } from './map.js';
import { createChart } from './chart.js';
import { renderFilters, renderDetail, renderHulls, renderTable, renderEpisodes } from './panel.js';
import { createTour } from './tour.js';

const $ = id => document.getElementById(id);
const ALL = 99;
const S = {
  end: MONTHS.length - 1, span: ALL, straits: new Set(STRAITS.map(s => s.key)), roles: new Set(ROLES.map(r => r.key)),
  sel: null, hull: null, ep: false, w: null,
};

// ---- URL hash ----
function writeHash() {
  const q = new URLSearchParams({ m: MONTHS[S.end], sp: S.span });
  if (S.straits.size < STRAITS.length) q.set('st', [...S.straits].join(','));
  if (S.roles.size < ROLES.length) q.set('ro', [...S.roles].join(','));
  if (S.sel != null) q.set('c', S.sel);
  if (S.hull) q.set('h', S.hull);
  if (S.ep) q.set('ep', 1);
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const m = MONTHS.indexOf(q.get('m') || '');
  if (m >= 0) S.end = m;
  const sp = Number(q.get('sp'));
  if (sp === ALL || (Number.isInteger(sp) && sp >= 1 && sp <= MONTHS.length)) S.span = sp;
  if (q.has('st')) { const v = q.get('st').split(',').filter(k => STRAIT[k]); if (v.length) S.straits = new Set(v); }
  if (q.has('ro')) { const v = q.get('ro').split(',').filter(k => ROLES.some(r => r.key === k)); if (v.length) S.roles = new Set(v); }
  const c = Number(q.get('c'));
  if (q.has('c') && Number.isInteger(c) && ROWS[c]) S.sel = c;
  if (HULLS.has(q.get('h') || '')) S.hull = q.get('h');
  S.ep = q.get('ep') === '1';
}

// ---- Elements ----
const tip = $('map-tip');
const map = createMap($('map'), tip, {
  onPick: key => {
    const list = current().filter(r => r.strait === key.s && r.out === key.out);
    if (list.length) { S.sel = list[list.length - 1].i; render(); }
  },
  onHover: (key, e, anchor) => {
    if (!key) { tip.hidden = true; return; }
    const list = current().filter(r => r.strait === key.s && r.out === key.out);
    map.showTip(arrowTip(key, list), e, anchor);
  },
});
const chart = createChart($('chart'), $('chart-tip'), { onMonth: i => { S.end = i; S.span = 1; render(); } });
const tour = createTour($('mapbox'), step => {
  S.end = step.end; S.span = step.span === 99 ? ALL : step.span; S.hull = step.hull;
  S.straits = new Set(STRAITS.map(s => s.key)); S.roles = new Set(ROLES.map(r => r.key));
  S.ep = !!step.ep;
  S.sel = step.pick ?? null;
  render();
});

/** Rows in the window that pass the filters, oldest first. */
function current() { return ROWS.filter(r => inWin(r, S.w) && visible(r, S)); }

function render() {
  S.w = windowOf(S.end, S.span === ALL ? MONTHS.length : S.span);
  const rows = current();
  if (S.sel != null && !rows.some(r => r.i === S.sel)) S.sel = null;
  const counts = {}, per = {};
  rows.forEach(r => { const c = (counts[r.strait] ??= { o: 0, i: 0 }); c[r.out ? 'o' : 'i']++; });
  ROWS.forEach(r => { if (inWin(r, S.w) && [...r.roles].some(x => S.roles.has(x))) per[r.strait] = (per[r.strait] || 0) + 1; });
  const hullRows = S.hull ? HULLS.get(S.hull).rows.map(i => ROWS[i]) : null;
  const eps = JSO.episodes.filter(ep => ep.s.slice(0, 7) <= MONTHS[S.w.b] && ep.e.slice(0, 7) >= MONTHS[S.w.a]);
  map.update({ counts, sel: S.sel != null ? ROWS[S.sel] : null, hullRows, episodes: eps, showEp: S.ep });

  const monthly = MONTHS.map(ym => {
    const by = {};
    let total = 0;
    ROWS.forEach(r => { if (r.ym === ym && visible(r, S)) { by[r.strait] = (by[r.strait] || 0) + 1; total++; } });
    return { ym, by, total };
  });
  chart.update({ monthly, w: S.w });

  $('win').textContent = winLabel(S.w);
  $('count').textContent = rows.length;
  $('ships').textContent = rows.reduce((a, r) => a + r.ships.length, 0);
  $('hulls').textContent = new Set(rows.flatMap(r => r.ships.map(s => s[0] + s[1]))).size;
  $('slider').value = S.end;
  $('slider').setAttribute('aria-valuetext', monthName(MONTHS[S.end], true));
  document.querySelectorAll('[data-span]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.span) === S.span)));
  const list = rows.map(r => r.i);
  const on = {
    strait: (k, only) => {
      if (only) S.straits = new Set([k]);
      else if (S.straits.has(k)) { if (S.straits.size > 1) S.straits.delete(k); } else S.straits.add(k);
      render();
    },
    role: k => { if (S.roles.has(k)) { if (S.roles.size > 1) S.roles.delete(k); } else S.roles.add(k); render(); },
    pick: (i, jump) => {
      if (i == null) return;
      S.sel = i;
      if (jump && !inWin(ROWS[i], S.w)) { S.end = MONTHS.indexOf(ROWS[i].ym); S.span = 1; }
      if (jump && !visible(ROWS[i], S)) { S.straits.add(ROWS[i].strait); ROWS[i].roles.forEach(x => S.roles.add(x)); }
      render();
    },
    hull: k => { S.hull = S.hull === k ? null : k; render(); },
  };
  renderFilters($('filters'), S, per, on);
  renderDetail($('detail'), S, list, on);
  renderHulls($('hullbox'), S, rows, on);
  renderTable($('rows'), $('table-note'), S, list, on);
  renderEpisodes($('eps'), S, eps, on);
  $('ep-toggle').checked = S.ep;
  writeHash();
}

// ---- Controls ----
const sl = $('slider');
sl.max = MONTHS.length - 1;
sl.addEventListener('input', () => { S.end = Number(sl.value); if (S.span === ALL) S.span = 1; stopPlay(); render(); });
$('ticks').innerHTML = MONTHS.map((ym, i) => (ym.endsWith('-01') || i === 0) ? `<span style="left:${i / (MONTHS.length - 1) * 100}%">${ym.slice(0, 4)}</span>` : '').join('');
document.querySelectorAll('[data-span]').forEach(b => b.onclick = () => {
  S.span = Number(b.dataset.span);
  if (S.span === ALL) S.end = MONTHS.length - 1; // "Everything" means the whole record, not everything up to the slider month
  stopPlay(); render();
});
$('ep-toggle').addEventListener('change', e => { S.ep = e.target.checked; render(); });
let timer = null;
const playBtn = $('play');
function stopPlay() { clearInterval(timer); timer = null; playBtn.setAttribute('aria-pressed', 'false'); playBtn.innerHTML = '<span aria-hidden="true">▶</span> Play'; }
playBtn.onclick = () => {
  if (timer) { stopPlay(); return; }
  if (S.span === ALL) S.span = 1;
  if (S.end >= MONTHS.length - 1) S.end = S.span - 1;
  playBtn.setAttribute('aria-pressed', 'true');
  playBtn.innerHTML = '<span aria-hidden="true">❚❚</span> Pause';
  render();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  timer = setInterval(() => { if (S.end >= MONTHS.length - 1) { stopPlay(); return; } S.end++; render(); }, reduce ? 1800 : 1000);
};
$('start-tour').onclick = () => { stopPlay(); tour.start(); };
$('copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; } catch { $('copy-link').textContent = 'Copy from the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
};
$('asof').textContent = `Latest crossing ${nice(ROWS[ROWS.length - 1].date)}`;

readHash();
render();
window.addEventListener('hashchange', () => { readHash(); render(); });
