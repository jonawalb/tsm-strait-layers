// Allocation controls: a draggable stacked bar and one slider per category, locked to the total.
import { ctx } from './ctx.js';
import { ON as MOTION } from './fx.js';
import { units } from './buys.js';

export const fmtBn = v => v >= 1000 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(1) : v.toFixed(2);
/** Money in the active country's currency, e.g. "NT$145.7bn". */
export const money = bn => ctx.P.money(bn);

/** Change one share and rebalance the unlocked others so the total stays at 1. Returns a new object. */
export function setShare(shares, locks, id, v) {
  const s = { ...shares };
  const lockedSum = ctx.cats.filter(c => c.id !== id && locks[c.id]).reduce((a, c) => a + s[c.id], 0);
  v = Math.max(0, Math.min(1 - lockedSum, v));
  let delta = v - s[id];
  s[id] = v;
  const pool = ctx.cats.filter(c => c.id !== id && !locks[c.id]);
  if (!pool.length) { s[id] -= delta; return s; }
  if (delta > 0) {
    // take from the others in proportion to what they hold
    const have = pool.reduce((a, c) => a + s[c.id], 0);
    if (have <= 1e-9) { s[id] -= delta; return s; }
    const take = Math.min(delta, have);
    pool.forEach(c => { s[c.id] -= take * s[c.id] / have; });
    s[id] -= delta - take;
  } else if (delta < 0) {
    // give back to the modeled others in proportion to what they hold (equally if all empty)
    const recv = pool.filter(c => c.id !== 'other');
    const use = recv.length ? recv : pool;
    // weight by current share plus a small floor so emptied categories also get some back
    const wt = c => s[c.id] + 0.02, have = use.reduce((a, c) => a + wt(c), 0);
    use.forEach(c => { s[c.id] += -delta * wt(c) / have; });
  }
  return normalize(s);
}

export function normalize(s) {
  const t = ctx.cats.reduce((a, c) => a + Math.max(0, s[c.id] || 0), 0) || 1;
  return Object.fromEntries(ctx.cats.map(c => [c.id, Math.max(0, s[c.id] || 0) / t]));
}

/** Render a static stacked bar (used for references and comparison rows). */
export function barHtml(shares, { labels = false } = {}) {
  return `<div class="sbar">${ctx.cats.filter(c => shares[c.id] > 0.0005).map(c =>
    `<span style="flex:${shares[c.id]};background:var(${c.col})" title="${c.t}: ${Math.round(shares[c.id] * 100)}%">${labels && shares[c.id] > 0.07 ? Math.round(shares[c.id] * 100) + '%' : ''}</span>`).join('')}</div>`;
}

/** Interactive bar: drag a boundary to move money between the two neighbouring categories. */
export function mountDragBar(el, get, onChange) {
  const draw = () => {
    const s = get().shares;
    // Interactive Deterrence: update the segments in place so the bar reflows smoothly (see budget-allocator.css).
    if (MOTION && el.dataset.k === ctx.P.k && el.querySelectorAll('.seg').length === ctx.cats.length) {
      let x = 0;
      const grips = el.querySelectorAll('.grip');
      ctx.cats.forEach((c, i) => {
        const w = s[c.id], seg = el.querySelector(`.seg[data-id="${c.id}"]`);
        seg.style.flex = w; seg.textContent = w > 0.06 ? Math.round(w * 100) + '%' : '';
        x += w; if (grips[i]) grips[i].style.left = `${x * 100}%`;
      });
      return;
    }
    if (MOTION) el.dataset.k = ctx.P.k;
    el.innerHTML = ctx.cats.map(c => { const w = s[c.id]; return `<span class="seg" style="flex:${w};background:var(${c.col})" data-id="${c.id}">${w > 0.06 ? Math.round(w * 100) + '%' : ''}</span>`; }).join('')
      + ctx.cats.slice(0, -1).map((c, i) => { const x = ctx.cats.slice(0, i + 1).reduce((a, d) => a + s[d.id], 0); return `<i class="grip" style="left:${x * 100}%" data-i="${i}"></i>`; }).join('');
  };
  let drag = null;
  const edges = s => { const e = [0]; ctx.cats.forEach(c => e.push(e[e.length - 1] + s[c.id])); return e; };
  el.addEventListener('pointerdown', ev => {
    const r = el.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width;
    const e = edges(get().shares);
    let best = -1, bd = 0.03;
    for (let i = 1; i < ctx.cats.length; i++) {
      const d = Math.abs(e[i] - x);
      // among coincident boundaries prefer the one whose left segment we are dragging into
      if (d < bd || (d === bd && best >= 0)) { bd = d; best = i; }
    }
    if (best < 0) return;
    drag = { i: best, r };
    el.setPointerCapture(ev.pointerId);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', ev => {
    if (!drag) return;
    const x = Math.max(0, Math.min(1, (ev.clientX - drag.r.left) / drag.r.width));
    const s = { ...get().shares }, e = edges(s), i = drag.i;
    const a = ctx.cats[i - 1].id, b = ctx.cats[i].id;
    const lo = e[i - 1], hi = e[i + 1];
    const nx = Math.max(lo, Math.min(hi, x));
    s[a] = nx - lo; s[b] = hi - nx;
    onChange(s);
  });
  const end = () => { drag = null; el.classList.remove('dragging'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  return { draw };
}

/** Slider rows. */
export function mountSliders(el, get, onShare, onLock) {
  const build = () => {
  el.dataset.k = ctx.P.k;
  el.innerHTML = ctx.cats.map(c => `
    <div class="arow" data-id="${c.id}">
      <div class="arow-h">
        <span class="sw8" style="background:var(${c.col})"></span>
        <label for="al-${c.id}">${c.t}</label>
        <button type="button" class="lock" data-id="${c.id}" aria-pressed="false" aria-label="Lock ${c.t}" title="Lock this amount while you move others">lock</button>
      </div>
      <input type="range" id="al-${c.id}" min="0" max="1000" step="1">
      <div class="arow-f"><output id="ao-${c.id}" class="num"></output><small id="au-${c.id}"></small></div>
    </div>`).join('');
  ctx.cats.forEach(c => {
    const i = el.querySelector('#al-' + c.id);
    i.addEventListener('input', () => onShare(c.id, +i.value / 1000));
  });
  el.querySelectorAll('.lock').forEach(b => b.addEventListener('click', () => onLock(b.dataset.id)));
  };
  const draw = () => {
    if (el.dataset.k !== ctx.P.k) build();
    const { shares, total, locks } = get();
    ctx.cats.forEach(c => {
      const bn = shares[c.id] * total;
      el.querySelector('#al-' + c.id).value = Math.round(shares[c.id] * 1000);
      el.querySelector('#ao-' + c.id).textContent = `${money(bn)} · ${Math.round(shares[c.id] * 100)}%`;
      el.querySelector('#au-' + c.id).innerHTML = c.cost ? `≈ ${units(c, bn)} ${c.src ? `<span class="cited" title="Unit cost from a cited source; see the menu table below">${c.est ? 'cited, est.' : 'cited'}</span>` : '<span class="notional">notional</span>'}` : 'no effect in the model';
      const lb = el.querySelector(`.lock[data-id="${c.id}"]`);
      lb.setAttribute('aria-pressed', !!locks[c.id]);
      lb.textContent = locks[c.id] ? 'locked' : 'lock';
    });
  };
  return { draw };
}
