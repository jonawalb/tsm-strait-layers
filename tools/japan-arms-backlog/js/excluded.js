// Excluded and unresolved: notified Japan cases left out of the total (delivered, excluded on age, or consumed
// services), records that turned out not to be Japan cases, and open questions. Each excluded case links its source.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { EXCLUDED, PHANTOMS, UNRESOLVED, UNIVERSE } from '../data/cases.js';
import { fmtD, fmtM } from './model.js';
import { srcLink } from './mdata.js';

const WHY = { delivered: 'Delivered', partial: 'Delivered in part (6 of 8; 2 unaccounted)', assumed: 'Assumed delivered (no completion source found)', age: 'Excluded on age', consumed: 'Assumed used up (services; no end date found)' };
const SHORT = { delivered: 'Delivered', partial: 'Delivered in part', assumed: 'Assumed delivered', age: 'Excluded on age', consumed: 'Assumed used up' };

export function renderExcluded(box) {
  let filter = 'all';
  const counts = Object.fromEntries(Object.keys(WHY).map(k => [k, EXCLUDED.filter(e => e.reason === k).length]));
  const sumM = k => EXCLUDED.filter(e => k === 'all' || e.reason === k).reduce((s, e) => s + e.m, 0);
  function draw() {
    const rows = EXCLUDED.filter(e => filter === 'all' || e.reason === filter);
    box.innerHTML = `
      <div class="ex-h">
        <div>
          <p class="eyebrow">Excluded and unresolved</p>
          <h2 class="ex-t">${EXCLUDED.length} notified cases left out of the total</h2>
          <p class="fine">The tracker's universe holds ${UNIVERSE} cases in all: the open cases above and these ${EXCLUDED.length}, ${fmtM(sumM('all'))} notified. A case is marked delivered only where a source documents completion; the rest are labelled as assumptions or as excluded on age, a tracker policy. TN 18-44 is listed separately under open questions and is not counted.</p>
          <p class="fine">Dates: where the linked notice is a Federal Register notice, the date is its "date report delivered to Congress"; otherwise it is the DSCA press-release date, which can be a few days later (TN 18-44: released Nov. 19, 2018, certification delivered Nov. 16). TN 16-46 shows its original 2016 notification date; its linked notice is the 2019 amendment.</p>
        </div>
        <div class="seg ex-f" role="group" aria-label="Filter excluded cases">
          <button type="button" class="btn" data-f="all" aria-pressed="${filter === 'all'}">All ${EXCLUDED.length}</button>
          ${Object.entries(SHORT).map(([k, l]) => `<button type="button" class="btn" data-f="${k}" aria-pressed="${filter === k}">${l} ${counts[k]}</button>`).join('')}
        </div>
      </div>
      <div class="tablewrap ex-wrap" tabindex="0" role="region" aria-label="Excluded cases">
        <table class="ex-table">
          <thead><tr><th scope="col">Case</th><th scope="col">Notified</th><th scope="col">Value</th><th scope="col">Why it is out</th></tr></thead>
          <tbody>${rows.map(e => `<tr><th scope="row"><span class="ex-tn">TN ${escapeHtml(e.tn)}</span>${escapeHtml(e.name)}</th>
            <td>${fmtD(e.notified)}</td><td class="num">${fmtM(e.m)}</td>
            <td><span class="pill ex-${e.reason}">${WHY[e.reason]}</span> ${escapeHtml(e.why)}<span class="ex-src">${e.dsrc ? ` Delivery:${srcLink(e.dsrc)}` : ''} Notice:${srcLink(e.src)}${e.nsrc ? srcLink(e.nsrc) : ''}${e.reg ? ` Register:${srcLink(e.reg)}` : ''}</span></td></tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="fine">Shown: ${rows.length} cases, ${fmtM(sumM(filter))} notified. These cases are not drawn on the timeline: most have no sourced date for their last delivery.</p>
      <div class="ex-cols">
        <details class="ex-d"><summary class="eyebrow">${UNRESOLVED.length} open questions</summary>
          <ul>${UNRESOLVED.map(u => `<li><b>${escapeHtml(u.t)}.</b> ${escapeHtml(u.why)}${srcLink(u.src)}</li>`).join('')}</ul></details>
        <details class="ex-d"><summary class="eyebrow">${PHANTOMS.length} records that are not Japan cases</summary>
          <p class="fine">A scraper followed broken DSCA links to index pages and read another country's sale as Japan's. None of these is in the total.</p>
          <ul>${PHANTOMS.map(p => `<li>Listed as Japan: ${escapeHtml(p.claim)}. Actually ${escapeHtml(p.actual)}.</li>`).join('')}</ul></details>
      </div>`;
    box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; draw(); box.querySelector(`[data-f="${filter}"]`).focus(); });
  }
  draw();
}
