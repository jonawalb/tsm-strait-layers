// Defense Budget Allocator: state, URL hash and rendering.
// Taiwan is the default country; its page text is the static HTML. Other countries swap in their own profile.
// Two views: "What it buys" (priced plan, trade-offs, reference delivery times) and "Range model" (spreads only).
import { COUNTRIES as ALL_COUNTRIES, REGIONS } from '../data/countries.js';
import { SITE } from '../../../shared/js/site.js';
// TSM Interactive shows Taiwan only; Interactive Deterrence shows every country.
const COUNTRIES = SITE === 'tsm' ? ALL_COUNTRIES.slice(0, 1) : ALL_COUNTRIES;
import { ctx, setProfile } from './ctx.js';
import { setShare, normalize, barHtml, mountDragBar, mountSliders, money } from './alloc.js';
import { renderBuys, mountTrade } from './buys.js';
import { ranges, drivers, midValue, METRICS } from './range.js';
import { renderCompare } from './compare.js';
import { renderDoc } from './doc.js';
import { mountParams, readOver, writeOver } from './params.js';
import { addExportBar, tableRows } from '../../../shared/js/export.js';
import * as fx from './fx.js';

const $ = id => document.getElementById(id);
const byKey = k => COUNTRIES.find(c => c.k === k);
const P = () => ctx.P;
const refMixOf = p => p.refMix ? normalize(Object.fromEntries(p.cats.map(c => [c.id, p.refMix.lines.filter(l => l.cat === c.id).reduce((a, l) => a + l.bn, 0)]))) : null;
const mixOf = k => (k === 'cabinet' ? refMixOf(P()) : normalize({ ...P().presets[k].mix }));

const S = { c: 'tw', b: null, shares: null, locks: {}, preset: null, mode: 'buys', over: { cats: {}, geo: {} } };
const budget = () => P().budgets.find(x => x.k === S.b);

/** Switch country and reset to its defaults. */
function useCountry(k, keepOver = false) {
  const p = byKey(k) || COUNTRIES[0];
  S.c = p.k;
  if (!keepOver) S.over = { cats: {}, geo: {} };
  setProfile(p, S.over);
  const d = p.defaults;
  S.b = d.b; S.preset = d.preset; S.locks = {};
  S.shares = mixOf(d.preset);
}

// ---- hash ------------------------------------------------------------------------
// Taiwan links carry no country key, so every Taiwan link made before the selector existed still works.
// Old links may still carry sp= and w= (the removed scenario sliders); they are ignored.
function writeHash() {
  const q = new URLSearchParams();
  if (S.c !== 'tw') q.set('c', S.c);
  q.set('b', S.b); q.set('a', ctx.cats.map(c => Math.round(S.shares[c.id] * 1000)).join('.'));
  if (S.mode === 'range') q.set('m', 'range');
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
  S.mode = q.get('m') === 'range' ? 'range' : 'buys';
}
readHash();

// ---- static swaps: Taiwan keeps the page's own HTML ------------------------------------
const TW = { alloc: $('alloc-note').textContent };
{ const tw = byKey('tw'), L = tw.refMix.lines;
  $('realtable').innerHTML = L.map(l => `<tr><td>${l.t}</td><td class="num">${l.bn.toFixed(1)}</td><td>${tw.cats.find(c => c.id === l.cat).t}</td></tr>`).join('')
    + `<tr><td><b>Total</b></td><td class="num"><b>${L.reduce((a, l) => a + l.bn, 0).toFixed(1)}</b></td><td></td></tr>`; }
function mountCountry() {
  const p = P(), tw = p.k === 'tw';
  $('countries').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === p.k));
  $('country-sub').textContent = `${p.name} · ${p.sub}`;
  $('alloc-note').textContent = tw ? TW.alloc : 'Moving one slider rescales the unlocked categories so the total stays fixed. Lock a category to hold its amount. Unit counts use the unit costs in the spending menu below, marked cited or notional.';
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

document.querySelectorAll('.modes button').forEach(btn => btn.onclick = () => { S.mode = btn.dataset.m; fx.press(btn); render(); });

const onMix = s => { S.shares = normalize(s); S.preset = null; render(); };
const bar = mountDragBar($('dragbar'), () => S, onMix);
const sliders = mountSliders($('sliders'), () => ({ shares: S.shares, total: budget().bn, locks: S.locks }),
  (id, v) => { S.shares = setShare(S.shares, S.locks, id, v); S.preset = null; render(); },
  id => { S.locks[id] = !S.locks[id]; render(); });
const trade = mountTrade($('trade'), () => ({ shares: S.shares, total: budget().bn }), (from, to, share) => {
  const s = { ...S.shares }, d = Math.min(share, s[from]);
  s[from] -= d; s[to] += d; S.shares = normalize(s); S.preset = null; render();
});
const params = mountParams($('params-body'), () => S.over, over => { S.over = over; setProfile(P(), S.over); render(); });

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

const pct = v => Math.round(v * 100);
function renderRange(total) {
  const g = ranges(S.shares, total);
  $('ranges').innerHTML = METRICS.map(m => {
    const r = g[m.id], u = m.id === 'res' ? '' : '%';
    // A band of zero width (the middle 80% of runs all give one value) is not drawn; the value is shown instead.
    const flat = pct(r.lo) === pct(r.hi), none = pct(r.min) === pct(r.max);
    if (none) return `<div class="rg"><div class="rg-h"><b>${m.t}</b><span class="num">${pct(r.min)}${u}</span></div>
      <small>${m.s}. Every run gives ${pct(r.min)}${u}, so there is no spread to show.</small></div>`;
    return `<div class="rg"><div class="rg-h"><b>${m.t}</b><span class="num">${flat ? pct(r.lo) : `${pct(r.lo)}–${pct(r.hi)}`}${u}</span></div>
      <div class="rg-track" role="img" aria-label="${m.t}: middle 80% of runs ${flat ? `all at ${pct(r.lo)}` : `between ${pct(r.lo)} and ${pct(r.hi)}`}${u}; full spread ${pct(r.min)} to ${pct(r.max)}${u}">
        <i class="w" style="left:${r.min * 100}%;width:${(r.max - r.min) * 100}%"></i>${flat ? '' : `<i class="b" style="left:${r.lo * 100}%;width:${Math.max(0.6, (r.hi - r.lo) * 100)}%"></i>`}</div>
      <small>${m.s}.${flat ? ` The middle 80% of runs all give ${pct(r.lo)}${u}.` : ''} Full spread ${pct(r.min)}–${pct(r.max)}${u}.</small></div>`;
  }).join('');
  const d = drivers(S.shares, total), top = Math.max(...d.map(x => x.swing), 1e-9);
  $('drivers').innerHTML = d.map(x => `<li><span>${x.t}</span><span class="lbar"><i style="width:${Math.round(x.swing / top * 100)}%"></i></span><span class="num">${pct(x.swing)} pts</span></li>`).join('');
  fx.widths($('drivers'), '.lbar i', e => e.closest('li').firstChild.textContent);
  const plan = Math.abs(midValue(mixOf('porcupine'), total) - midValue(mixOf('legacy'), total));
  $('drv-note').textContent = `For scale: switching between the ${P().presets.porcupine.t.toLowerCase()} and ${P().presets.legacy.t.toLowerCase()} mixes moves the same measure by ${pct(plan)} points with every assumption held at the middle of its range. ${d[0].swing > plan ? `The biggest single unknown, ${d[0].t.toLowerCase()}, moves it more than that choice does.` : 'That is more than any single unknown moves it.'}`;
}

function render() {
  const p = P(), B = budget();
  document.querySelectorAll('#budgets button').forEach(b => b.setAttribute('aria-pressed', b.dataset.b === S.b));
  document.querySelectorAll('#presets button').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.p === S.preset);
    if (b.dataset.p === 'cabinet') { b.disabled = S.b !== p.refMix.budget; b.title = b.disabled ? p.refMix.off : ''; }
  });
  document.querySelectorAll('.modes button').forEach(b => b.setAttribute('aria-selected', b.dataset.m === S.mode));
  $('m-buys').hidden = S.mode !== 'buys'; $('m-range').hidden = S.mode !== 'range';
  $('budget-note').textContent = B.note;
  $('alloc-title').textContent = `Your allocation · ${money(B.bn)}`;
  bar.draw(); sliders.draw();
  $('reference').innerHTML = referenceHtml(p);
  if (S.mode === 'buys') { renderBuys($('buys'), S.shares, B.bn); trade.draw(); }
  else { params.draw(); renderRange(B.bn); }
  const rows = [{ t: 'Your plan', you: true, shares: S.shares },
    { t: p.presets.porcupine.t, s: p.presets.porcupine.s, shares: mixOf('porcupine') },
    { t: p.presets.legacy.t, s: p.presets.legacy.s, shares: mixOf('legacy') }];
  if (p.refMix && S.b === p.refMix.budget) rows.push({ t: p.refMix.label, s: p.refMix.sub, shares: refMixOf(p) });
  $('compare').innerHTML = renderCompare(rows, B.bn, S.mode);
  $('cmp-title').textContent = S.mode === 'range' ? `Compare ranges at ${money(B.bn)}` : `Compare mixes at ${money(B.bn)}`;
  $('cmp-note').textContent = S.mode === 'range'
    ? 'Each cell shows the middle 80% of runs, with the bar under it. All plans face the same 200 draws. Overlapping bands mean the model cannot separate the plans.'
    : 'All plans use the same budget and the same unit costs.';
  writeHash();
}

addExportBar($('real').parentElement, { csv: () => tableRows($('real')), csvLabel: 'Copy table as CSV', where: 'after' });
$('copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; }
  catch { $('copy-link').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
};
mountCountry();
render();
