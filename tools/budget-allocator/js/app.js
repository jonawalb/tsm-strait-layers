// Defense Budget Allocator: state, URL hash and rendering.
// Taiwan is the default country; its page text is the static HTML. Other countries swap in their own profile.
import { COUNTRIES as ALL_COUNTRIES, REGIONS } from '../data/countries.js';
import { SITE } from '../../../shared/js/site.js';
// TSM Interactive shows Taiwan only; Interactive Deterrence shows every country.
const COUNTRIES = SITE === 'tsm' ? ALL_COUNTRIES.slice(0, 1) : ALL_COUNTRIES;
import { ctx, setProfile } from './ctx.js';
import { evaluate, verdict, explain } from './model.js';
import { setShare, normalize, barHtml, mountDragBar, mountSliders, money } from './alloc.js';
import { createStrip } from './strip.js';
import { renderCompare, mobileWeighted } from './compare.js';
import { createTour } from './tour.js';
import { renderDoc } from './doc.js';
import { mountParams, readOver, writeOver } from './params.js';
import { addExportBar, tableRows } from '../../../shared/js/export.js';
import * as fx from './fx.js';

const $ = id => document.getElementById(id);
const byKey = k => COUNTRIES.find(c => c.k === k);
const P = () => ctx.P;
const refMixOf = p => p.refMix ? normalize(Object.fromEntries(p.cats.map(c => [c.id, p.refMix.lines.filter(l => l.cat === c.id).reduce((a, l) => a + l.bn, 0)]))) : null;
const mixOf = k => (k === 'cabinet' ? refMixOf(P()) : normalize({ ...P().presets[k].mix }));

const S = { c: 'tw', b: null, shares: null, locks: {}, supp: 0, warn: 0, preset: null, over: { cats: {}, geo: {} } };
const budget = () => P().budgets.find(x => x.k === S.b);

/** Switch country and reset to its defaults. */
function useCountry(k, keepOver = false) {
  const p = byKey(k) || COUNTRIES[0];
  S.c = p.k;
  if (!keepOver) S.over = { cats: {}, geo: {} };
  setProfile(p, S.over);
  const d = p.defaults;
  S.b = d.b; S.supp = d.supp; S.warn = d.warn; S.preset = d.preset; S.locks = {};
  S.shares = mixOf(d.preset);
}

// ---- hash ------------------------------------------------------------------------
// Taiwan links carry no country key, so every Taiwan link made before the selector existed still works.
function writeHash() {
  const q = new URLSearchParams();
  if (S.c !== 'tw') q.set('c', S.c);
  q.set('b', S.b); q.set('a', ctx.cats.map(c => Math.round(S.shares[c.id] * 1000)).join('.'));
  q.set('sp', Math.round(S.supp * 100)); q.set('w', S.warn);
  writeOver(q, S.over);
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  useCountry(byKey(q.get('c')) ? q.get('c') : 'tw');
  S.over = readOver(q, P()); setProfile(P(), S.over);
  if (P().budgets.some(x => x.k === q.get('b'))) S.b = q.get('b');
  const a = (q.get('a') || '').split('.').map(Number);
  if (a.length === ctx.cats.length && a.every(v => Number.isFinite(v) && v >= 0) && a.some(v => v > 0)) {
    S.shares = normalize(Object.fromEntries(ctx.cats.map((c, i) => [c.id, a[i]]))); S.preset = null;
  }
  const sp = +q.get('sp'); if (q.has('sp') && Number.isFinite(sp)) S.supp = Math.max(0, Math.min(90, sp)) / 100;
  const w = +q.get('w'); if (q.has('w') && Number.isFinite(w)) S.warn = Math.max(1, Math.min(14, Math.round(w)));
}
readHash();

// ---- static swaps: Taiwan keeps the page's own HTML ------------------------------------
const TW = { eyebrow: $('strip-eyebrow').innerHTML, note: $('strip-note').textContent,
  scen: $('scen-title').textContent, cmp: $('cmp-note').textContent, alloc: $('alloc-note').textContent };
{ const tw = byKey('tw'), L = tw.refMix.lines;
  $('realtable').innerHTML = L.map(l => `<tr><td>${l.t}</td><td class="num">${l.bn.toFixed(1)}</td><td>${tw.cats.find(c => c.id === l.cat).t}</td></tr>`).join('')
    + `<tr><td><b>Total</b></td><td class="num"><b>${L.reduce((a, l) => a + l.bn, 0).toFixed(1)}</b></td><td></td></tr>`; }
function mountCountry() {
  const p = P(), tw = p.k === 'tw';
  $('countries').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === p.k));
  $('country-sub').textContent = `${p.name} · ${p.sub}`;
  $('strip-eyebrow').innerHTML = tw ? TW.eyebrow : p.strip.eyebrow;
  $('strip-note').textContent = tw ? TW.note : p.strip.note;
  $('play').textContent = p.strip.play;
  $('scen-title').textContent = tw ? TW.scen : '3 · Set the scenario';
  $('cmp-note').textContent = tw ? TW.cmp : 'Best value in each column is highlighted. All plans use the same budget and scenario.';
  $('alloc-note').textContent = tw ? TW.alloc : 'Moving one slider rescales the unlocked categories so the total stays fixed. Lock a category to hold its amount. Unit counts use the unit costs in the spending menu below, marked cited or notional, and only give a sense of scale.';
  $('supp-l').textContent = p.text.supp[0]; $('supp-h').textContent = p.text.supp[1];
  $('warn-l').textContent = p.text.warn[0]; $('warn-h').textContent = p.text.warn[1];
  $('tw-left').hidden = $('tw-right').hidden = !tw;
  $('cx-left').hidden = $('cx-right').hidden = tw;
  if (!tw) {
    renderDoc(p, $('cx-left'), $('cx-right'));
    const t = $('cx-right').querySelector('table.menu');
    if (t) addExportBar(t.parentElement, { csv: () => tableRows(t), csvLabel: 'Copy menu as CSV', where: 'after' });
  }
  $('budgets').innerHTML = p.budgets.map(b => `<button type="button" data-b="${b.k}"><b>${b.t}</b><br><span class="muted">${b.s}</span></button>`).join('');
  $('budgets').querySelectorAll('button').forEach(btn => btn.onclick = () => { S.b = btn.dataset.b; if (S.preset === 'cabinet' && p.refMix && S.b !== p.refMix.budget) S.preset = null; render(); });
  const list = [['porcupine', p.presets.porcupine.t], ['legacy', p.presets.legacy.t], ['even', p.presets.even.t]];
  if (p.refMix) list.push(['cabinet', p.refMix.label]);
  $('presets').innerHTML = list.map(([k, t]) => `<button type="button" data-p="${k}">${t}</button>`).join('');
  $('presets').querySelectorAll('button').forEach(btn => btn.onclick = () => applyPreset(btn.dataset.p));
  params.build();
}
function applyPreset(k) { S.shares = mixOf(k); S.preset = k; S.locks = {}; render(); }

$('countries').parentElement.hidden = COUNTRIES.length < 2;
// Grouped by region. Buttons show the name only; the chosen country's scenario line sits underneath.
$('countries').innerHTML = REGIONS.map(g => {
  const cs = g.ks.map(byKey).filter(Boolean);
  return cs.length ? `<p class="cgroup">${g.t}</p><div class="choices countries" role="group" aria-label="${g.t}">${cs.map(c => `<button type="button" data-c="${c.k}" title="${c.sub}">${c.name}</button>`).join('')}</div>` : '';
}).join('');
$('countries').querySelectorAll('button').forEach(btn => btn.onclick = () => {
  if (btn.dataset.c === S.c) return;
  useCountry(btn.dataset.c); mountCountry(); render();
});

const strip = createStrip($('strip'), (t, hit, n) => {
  $('clock').textContent = `Hour ${(t * evaluate(S.shares, budget().bn, S).hours).toFixed(1)} · ${hit} of ${n} ${P().strip.noun} hit`;
});
const onMix = s => { S.shares = normalize(s); S.preset = null; render(); };
const bar = mountDragBar($('dragbar'), () => S, onMix);
const sliders = mountSliders($('sliders'), () => ({ shares: S.shares, total: budget().bn, locks: S.locks }),
  (id, v) => { S.shares = setShare(S.shares, S.locks, id, v); S.preset = null; render(); },
  id => { S.locks[id] = !S.locks[id]; render(); });
const params = mountParams($('params-body'), () => S.over, over => { S.over = over; setProfile(P(), S.over); render(); });

function bindRange(id, get, set, f) {
  const i = $(id);
  i.oninput = () => { set(+i.value); render(); };
  return () => { i.value = get(); $(id + '-out').textContent = f(get()); };
}
const drawSupp = bindRange('supp', () => Math.round(S.supp * 100), v => { S.supp = v / 100; }, v => v + '%');
const drawWarn = bindRange('warn', () => S.warn, v => { S.warn = v; }, v => v + (v === 1 ? ' day' : ' days'));
$('play').onclick = () => { fx.press($('play')); strip.play(); };

// ---- render ----------------------------------------------------------------------
function referenceHtml(p) {
  if (p.refMix && S.b === p.refMix.budget) {
    const col = id => ctx.cat[id].col;
    return `<p class="eyebrow sm">${p.refMix.title}</p>${barHtml(refMixOf(p), { labels: true })}
       <ul class="reflist">${p.refMix.lines.map(l => `<li><span class="sw8" style="background:var(${col(l.cat)})"></span>${l.t}<b class="num">${(p.refMix.fmt || (v => v.toFixed(1)))(l.bn)}</b></li>`).join('')}</ul>`;
  }
  const t = p.refText && p.refText[S.b];
  return t ? `<p class="eyebrow sm">${t[0]}</p><p class="fine">${t[1]}</p>` : '';
}

function render() {
  const p = P(), B = budget(), r = evaluate(S.shares, B.bn, S), v = verdict(r);
  document.querySelectorAll('#budgets button').forEach(b => b.setAttribute('aria-pressed', b.dataset.b === S.b));
  document.querySelectorAll('#presets button').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.p === S.preset);
    if (b.dataset.p === 'cabinet') { b.disabled = S.b !== p.refMix.budget; b.title = b.disabled ? p.refMix.off : ''; }
  });
  $('budget-note').textContent = B.note;
  $('alloc-title').textContent = `Your allocation · ${money(B.bn)}`;
  bar.draw(); sliders.draw(); drawSupp(); drawWarn(); params.draw();
  $('reference').innerHTML = referenceHtml(p);
  // status + readout
  const st = $('status'); st.dataset.s = v.s; st.innerHTML = `<b>${v.b}</b><span>${v.t}</span>`;
  fx.verdict(st, v.b);
  const T = p.text.tiles;
  $('tiles').innerHTML = [
    ['Force engaged', Math.round(r.engaged * 100) + '%', T.engaged],
    ['Hours under fire', `${r.fireHours.toFixed(1)} h`, T.hours(r.hours.toFixed(1))],
    ['Shooters left', Math.round(mobileWeighted(r) * 100) + '%', T.shooters],
    ['Resilience', Math.round(r.resilience), 'out of 100'],
  ].map(([t, b, s]) => `<div class="tile"><span>${t}</span><b>${b}</b><small>${s}</small></div>`).join('');
  fx.tiles($('tiles'));
  $('why').innerHTML = explain(r);
  $('layers').innerHTML = r.layers.map(l => `<li><span class="sw8" style="background:var(${l.col})"></span>${l.t}<span class="lbar"><i style="width:${Math.round(l.st * 100)}%;background:var(${l.col})"></i></span><span class="num">${Math.round(l.p * 100)}%</span></li>`).join('');
  fx.widths($('layers'), '.lbar i', e => e.closest('li').textContent.replace(/\d+%$/, ''));
  // comparison
  const rows = [{ t: 'Your plan', you: true, shares: S.shares },
    { t: p.presets.porcupine.t, s: p.presets.porcupine.s, shares: mixOf('porcupine') },
    { t: p.presets.legacy.t, s: p.presets.legacy.s, shares: mixOf('legacy') }];
  if (p.refMix && S.b === p.refMix.budget) rows.push({ t: p.refMix.label, s: p.refMix.sub, shares: refMixOf(p) });
  $('compare').innerHTML = renderCompare(rows, B.bn, S);
  $('cmp-title').textContent = `Compare at ${money(B.bn)}, ${Math.round(S.supp * 100)}% suppression, ${S.warn}-day warning`;
  strip.set(r);
  writeHash();
}

const tour = createTour($('stage'), s => {
  if (s.b) S.b = s.b;
  if (s.supp != null) S.supp = s.supp;
  if (s.warn != null) S.warn = s.warn;
  if (s.preset) { S.shares = mixOf(s.preset); S.preset = s.preset; S.locks = {}; }
  render(); strip.play();
}, () => P().tour);
$('start-tour').onclick = () => tour.start();
addExportBar($('strip-note'), {
  target: () => $('strip'),
  title: () => `${P().strip.exportTitle}, ${money(budget().bn)} plan: ${$('clock').textContent}`,
  note: `Notional model (${SITE === 'tsm' ? 'TSM ' : ''}Defense Budget Allocator), not a forecast`,
  where: 'after',
});
addExportBar($('real').parentElement, { csv: () => tableRows($('real')), csvLabel: 'Copy table as CSV', where: 'after' });
$('copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; }
  catch { $('copy-link').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
};
mountCountry();
render();
