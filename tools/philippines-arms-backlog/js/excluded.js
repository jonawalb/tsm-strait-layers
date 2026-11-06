// Out of both tiers: notified Philippine cases that were delivered or died (lost to a competitor or superseded), U.S.
// equipment that reached Manila without a notified FMS case, records that are not Philippine cases, and open questions.
// Each reason links the source that documents the outcome, or is labelled an assumption.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { EXCLUDED, OUT_OF_SCOPE, PHANTOMS, UNRESOLVED, UNIVERSE } from '../data/cases.js';
import { fmtD, fmtM } from './model.js';
import { srcLink } from './mdata.js';

const WHY = {
  delivered: 'Delivered', assumed_delivered: 'Assumed delivered (no completion source found)',
  lost: 'Dead: lost to a competitor', superseded: 'Dead: superseded',
  assumed_lost: 'Assumed dead (no outcome source found)', assumed_superseded: 'Assumed superseded (no source found)',
};
const GROUP = r => r.endsWith('delivered') ? 'delivered' : 'dead';
const SHORT = { delivered: 'Delivered', dead: 'Dead' };

export function renderExcluded(box) {
  let filter = 'all';
  const counts = { delivered: EXCLUDED.filter(e => GROUP(e.reason) === 'delivered').length, dead: EXCLUDED.filter(e => GROUP(e.reason) === 'dead').length };
  const sumM = k => EXCLUDED.filter(e => k === 'all' || GROUP(e.reason) === k).reduce((s, e) => s + e.m, 0);
  const U = UNIVERSE.by;
  function draw() {
    const rows = EXCLUDED.filter(e => filter === 'all' || GROUP(e.reason) === filter);
    box.innerHTML = `
      <div class="ex-h">
        <div>
          <p class="eyebrow">Out of both tiers</p>
          <h2 class="ex-t">${EXCLUDED.length} notified cases that are delivered or dead</h2>
          <p class="fine">Since ${fmtD(UNIVERSE.first)}, ${UNIVERSE.n} U.S. arms sales to the Philippines have been notified to Congress, ${fmtM(UNIVERSE.m)} in all. ${U.contracted.n} (${fmtM(U.contracted.m)}) ${U.contracted.n === 1 ? 'is' : 'are'} under a signed LOA, ${U.nna.n} (${fmtM(U.nna.m)}) ${U.nna.n === 1 ? 'is' : 'are'} notified but not accepted, ${U.delivered.n} (${fmtM(U.delivered.m)}) were delivered and ${U.dead.n} (${fmtM(U.dead.m)}) died. A case is marked delivered or dead only where a linked source documents it; otherwise the reason is labelled an assumption.</p>
          <p class="fine">Dates are the "date report delivered to Congress" printed in each Federal Register notice. DSCA press releases can be a day or two later.</p>
        </div>
        <div class="seg ex-f" role="group" aria-label="Filter excluded cases">
          <button type="button" class="btn" data-f="all" aria-pressed="${filter === 'all'}">All ${EXCLUDED.length}</button>
          ${Object.entries(SHORT).map(([k, l]) => `<button type="button" class="btn" data-f="${k}" aria-pressed="${filter === k}">${l} ${counts[k]}</button>`).join('')}
        </div>
      </div>
      <div class="tablewrap ex-wrap" tabindex="0" role="region" aria-label="Delivered and dead cases">
        <table class="ex-table">
          <thead><tr><th scope="col">Case</th><th scope="col">Notified</th><th scope="col">Value</th><th scope="col">Why it is out</th></tr></thead>
          <tbody>${rows.map(e => `<tr><th scope="row"><span class="ex-tn">TN ${escapeHtml(e.tn)}</span>${escapeHtml(e.name)}</th>
            <td>${fmtD(e.notified)}</td><td class="num">${fmtM(e.m)}</td>
            <td><span class="pill ex-${e.reason.startsWith('assumed') ? 'assumed' : GROUP(e.reason)}">${WHY[e.reason]}</span> ${escapeHtml(e.why)}<span class="ex-src">${e.osrc ? ` Outcome:${srcLink(e.osrc)}` : ''}${e.evid.length ? ` See also:${e.evid.map(u => srcLink(u)).join('')}` : ''} Notice:${srcLink(e.src, 'federalregister.gov')}</span></td></tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="fine">Shown: ${rows.length} cases, ${fmtM(sumM(filter))} notified.</p>
      <div class="ex-cols">
        <details class="ex-d" open><summary class="eyebrow">Why some U.S. equipment is absent</summary>
          <p class="fine">This tracker counts sales notified to Congress. These reached the Philippines another way, or never existed.</p>
          <ul>${OUT_OF_SCOPE.map(o => `<li><b>${escapeHtml(o.n)}.</b> ${escapeHtml(o.why)}${o.srcs.map(u => srcLink(u)).join('')}</li>`).join('')}</ul></details>
        <details class="ex-d"><summary class="eyebrow">${UNRESOLVED.length} open questions</summary>
          <ul>${UNRESOLVED.map(u => `<li><b>${escapeHtml(u.t)}.</b> ${escapeHtml(u.why)}${srcLink(u.src)}</li>`).join('')}</ul></details>
        <details class="ex-d"><summary class="eyebrow">${PHANTOMS.length} records that are not Philippine cases</summary>
          <p class="fine">Earlier data sets carried these. None is in either tier.</p>
          <ul>${PHANTOMS.map(p => `<li>Listed as the Philippines: ${escapeHtml(p.claim)}. Actually ${escapeHtml(p.actual)}.${srcLink(p.src)}</li>`).join('')}</ul></details>
      </div>`;
    box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; draw(); box.querySelector(`[data-f="${filter}"]`).focus(); });
  }
  draw();
}
