// "What it buys": what each line of the plan pays for at the unit costs in the spending menu, what moving money
// between lines trades away, and (Taiwan) how long the matching U.S. arms sale has taken to arrive.
// Nothing here models an outcome; it is arithmetic on cited or labelled-notional costs.
import { ctx } from './ctx.js';
import { money } from './alloc.js';

const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const ym = s => { const [y, m] = s.split('-').map(Number); return { y, m: m || 6 }; };
const fmtYM = s => { const d = ym(s); return `${MON[d.m - 1]} ${d.y}`; };
const years = (a, b) => { const x = ym(a), y = ym(b); return ((y.y - x.y) * 12 + (y.m - x.m)) / 12; };
const yrs = v => `${v.toFixed(1)} yr${v >= 0.95 && v < 1.05 ? '' : 's'}`;

/** Units of a category that `bn` pays for, as text. */
export function units(c, bn) {
  if (!c.cost) return '';
  const n = bn / c.cost;
  const t = n < 1 ? n.toFixed(2) : n < 10 ? n.toFixed(1) : Math.floor(n).toLocaleString('en-US');
  return `${t} × ${c.unit}`;
}

const badge = c => c.src ? `<span class="cited" title="${c.basis ? c.basis.replace(/"/g, '&quot;') : ''}">${c.est ? 'cited, est.' : 'cited'}</span>` : '<span class="notional">notional</span>';

/** Reference wait for a category, as one line of text (Taiwan only). */
export function waitText(ref, asof) {
  if (!ref) return '';
  const n = `Notified ${fmtYM(ref.notified)}`;
  if (ref.done) return `${n}; complete ${fmtYM(ref.done)} (<b>${yrs(years(ref.notified, ref.done))}</b>)`;
  if (ref.left) return `${n}; left TSM's backlog ${fmtYM(ref.left)} with no delivery reported`;
  if (ref.first) return `${n}; first delivery ${fmtYM(ref.first)} (<b>${yrs(years(ref.notified, ref.first))}</b>); not complete`;
  return `${n}; no deliveries by ${fmtYM(asof)} (<b>${yrs(years(ref.notified, asof))}</b> and counting)`;
}

export function renderBuys(el, shares, total) {
  const P = ctx.P, R = P.refCases;
  const rows = ctx.cats.map(c => {
    const bn = shares[c.id] * total;
    const ref = R && R[c.id];
    return `<tr${bn < total * 0.0005 ? ' class="zero"' : ''}><td><span class="sw8" style="background:var(${c.col})"></span> ${c.t}</td>
      <td class="num">${money(bn)}</td>
      <td>${c.id === 'other' ? '<span class="fine">Not a purchase the tool can price</span>' : `${units(c, bn)} ${badge(c)}`}</td>
      ${R ? `<td class="fine">${ref ? `${ref.name}: ${waitText(ref, P.refAsof)} <a href="${ref.src}" target="_blank" rel="noopener">source</a>` : ''}</td>` : ''}</tr>`;
  }).join('');
  el.innerHTML = `<div class="tablewrap"><table class="buys"><thead><tr><th>Line</th><th>Amount</th><th>Pays for, at the menu's unit cost</th>${R ? '<th>How long the matching U.S. sale has taken</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Trade-off: move an amount from one line to another and show what is given up and gained. */
export function mountTrade(el, get, onApply) {
  const opts = () => ctx.cats.filter(c => c.id !== 'other').map(c => `<option value="${c.id}">${c.t}</option>`).join('');
  const build = () => {
    el.dataset.k = ctx.P.k;
    el.innerHTML = `<div class="trade-ctl">
        <label>Move <output id="tr-amt" class="num"></output>
          <input type="range" id="tr-pct" min="1" max="50" step="1" value="10" aria-label="Share of the budget to move"></label>
        <label>from <select id="tr-from">${opts()}</select></label>
        <label>to <select id="tr-to">${opts()}</select></label>
        <button type="button" class="btn" id="tr-apply">Apply to my plan</button>
      </div>
      <div class="trade-out" id="tr-out" aria-live="polite"></div>`;
    const ids = ctx.cats.filter(c => c.id !== 'other').map(c => c.id);
    el.querySelector('#tr-from').value = ids.includes('platforms') ? 'platforms' : ids[ids.length - 1];
    el.querySelector('#tr-to').value = ids[0];
    ['#tr-pct', '#tr-from', '#tr-to'].forEach(s => el.querySelector(s).addEventListener('input', draw));
    el.querySelector('#tr-apply').onclick = () => { const m = move(); if (m.bn > 0) onApply(m.from.id, m.to.id, m.bn / get().total); };
  };
  const move = () => {
    const { shares, total } = get();
    const from = ctx.cat[el.querySelector('#tr-from').value], to = ctx.cat[el.querySelector('#tr-to').value];
    const want = +el.querySelector('#tr-pct').value / 100 * total;
    return { from, to, want, bn: from === to ? 0 : Math.min(want, shares[from.id] * total) };
  };
  const draw = () => {
    if (el.dataset.k !== ctx.P.k) build();
    const { total } = get(), m = move(), P = ctx.P, R = P.refCases;
    el.querySelector('#tr-amt').textContent = money(m.want);
    const out = el.querySelector('#tr-out');
    if (m.from === m.to) { out.innerHTML = '<p class="fine">Pick two different lines.</p>'; return; }
    if (m.bn <= 0) { out.innerHTML = `<p class="fine">Your plan has nothing in ${m.from.t.toLowerCase()} to move.</p>`; return; }
    const capped = m.bn < m.want - 1e-9 ? ` Your plan only has ${money(m.bn)} there, so that is all that moves.` : '';
    const w = r => R && R[r.id] ? `<small>${R[r.id].name}: ${waitText(R[r.id], P.refAsof)}</small>` : '';
    out.innerHTML = `<div class="trade-pair">
        <div><span>You give up</span><b>${units(m.from, m.bn)}</b>${badge(m.from)}${w(m.from)}</div>
        <div><span>You get</span><b>${units(m.to, m.bn)}</b>${badge(m.to)}${w(m.to)}</div>
      </div><p class="fine">${money(m.bn)} is ${Math.round(m.bn / total * 100)}% of the budget.${capped}</p>`;
  };
  return { draw };
}
