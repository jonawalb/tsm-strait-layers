// Side panel: the redundancy calculator (region, scenarios, island readout, cut list, options) and the dossier.
import { escapeHtml as esc, listText } from '../../../shared/js/mapkit.js';
import { DURATIONS } from '../data/repair.js';
import { REGIONS, UNIT } from './net.js';
import { SCENARIOS, SCENARIO } from './scenarios.js';
import { fmtTbps } from './util.js';
import { renderDossier } from './dossier.js';

const STATUS = { good: 'Connected', warn: 'Via China only', bad: 'Cut off' };

export function createPanel(root, S, act) {
  root.innerHTML = `
    <div class="ptabs" role="tablist" aria-label="Panel">
      <button type="button" role="tab" id="tab-calc" aria-controls="pane-calc">Redundancy calculator</button>
      <button type="button" role="tab" id="tab-dos" aria-controls="pane-dos">Dossier</button>
    </div>
    <div id="pane-calc" role="tabpanel" aria-labelledby="tab-calc">
      <div class="sec">
        <div class="seg" role="group" aria-label="Region">${REGIONS.map(r => `<button type="button" class="btn" data-r="${r.id}">${esc(r.name.replace(' (Ryukyu) islands', ''))}</button>`).join('')}</div>
        <div class="status" id="headline"></div>
        <dl class="readout" id="kpis"></dl>
        <p class="fine" id="note"></p>
      </div>
      <div class="sec">
        <p class="eyebrow">What if these are cut?</p>
        <div class="choices" id="scen"></div>
        <details class="replays"><summary>Replay a recorded incident</summary><div class="choices" id="replays"></div></details>
        <p class="fine">Or switch on <b>Cut mode</b> on the map and click cables, or open a landing site's dossier to cut it.</p>
      </div>
      <div class="sec">
        <p class="eyebrow" id="isl-h">Islands</p>
        <div class="tablewrap"><table class="isl"><thead><tr><th>Island</th><th>Status</th><th title="Edge-disjoint cable routes to anywhere outside the region: how many more cuts isolate it">Routes</th><th title="International systems landing on the island that are still working">Intl.</th></tr></thead><tbody id="isl-body"></tbody></table></div>
      </div>
      <div class="sec">
        <div class="list-h"><p class="eyebrow">Cuts</p><button type="button" class="btn" id="clear">Restore all</button></div>
        <div id="cuts" class="cuts"></div>
        <p class="fine" id="repair-ref"></p>
      </div>
      <div class="sec">
        <p class="eyebrow">Network</p>
        <label class="slider"><span class="sl-h"><span>In service by</span><output id="year-out"></output></span>
          <input type="range" id="year" min="2000" max="2026" step="1" aria-label="Network year">
          <small>Cables count from their ready-for-service year. Retired cables are not in the source data, so earlier years undercount.</small></label>
        <label class="tg"><input type="checkbox" id="opt-planned"><span class="sw"></span><span class="t">Add planned systems<small>Cables TeleGeography lists as planned (ORCA, E2A, Candle, AUG East and others)</small></span></label>
      </div>
    </div>
    <div id="pane-dos" role="tabpanel" aria-labelledby="tab-dos" hidden><div class="sec" id="dossier"></div></div>`;
  const $ = s => root.querySelector(s);
  const tabs = [['calc', $('#tab-calc'), $('#pane-calc')], ['dos', $('#tab-dos'), $('#pane-dos')]];
  tabs.forEach(([id, b]) => { b.onclick = () => act.set({ tab: id }); b.onkeydown = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = id === 'calc' ? 'dos' : 'calc'; act.set({ tab: n }); $('#tab-' + n).focus(); } }; });
  root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => act.region(b.dataset.r));
  $('#year').oninput = e => act.set({ year: +e.target.value, scen: null });
  $('#opt-planned').onchange = e => act.set({ planned: e.target.checked });
  $('#clear').onclick = () => act.scenario('none');
  const scenBtn = s => `<button type="button" data-s="${s.id}" aria-pressed="false"><b>${esc(s.name)}</b><br><small>${esc(s.sub)}</small></button>`;

  let builtFor = null;
  const days = DURATIONS.filter(d => d.days != null).map(d => d.days).sort((a, b) => a - b);

  return {
    render(R) {
      tabs.forEach(([id, b, p]) => { const on = S.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; p.hidden = !on; });
      root.querySelectorAll('[data-r]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.r === S.region)));
      const reg = R.regions.find(r => r.id === S.region);
      const list = SCENARIOS.filter(s => !s.replay && (s.region === 'all' || s.region === S.region));
      const reps = SCENARIOS.filter(s => s.replay && s.region === S.region);
      if (builtFor !== S.region) {
        builtFor = S.region;
        $('#scen').innerHTML = list.map(scenBtn).join('');
        $('#replays').innerHTML = reps.map(scenBtn).join('');
        $('.replays').hidden = !reps.length;
        root.querySelectorAll('[data-s]').forEach(b => { b.onclick = () => act.scenario(b.dataset.s); });
      }
      root.querySelectorAll('[data-s]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === S.scen)));

      const lost = reg.nodes.filter(n => n.status === 'bad'), prc = reg.nodes.filter(n => n.status === 'warn');
      const h = $('#headline');
      h.dataset.s = lost.length ? 'bad' : prc.length || reg.intlLive < reg.intlTotal ? 'warn' : 'good';
      const nonPrcTotal = reg.intlTotal - reg.prcOnlyTotal, nonPrcLive = reg.intlLive - reg.prcOnlyLive;
      h.innerHTML = `<b>${nonPrcLive} of ${nonPrcTotal} international systems</b><span>still land in ${esc(reg.name === 'Taiwan' ? 'Taiwan' : 'the ' + reg.name)}${reg.prcOnlyTotal ? ` (plus ${reg.prcOnlyLive} of ${reg.prcOnlyTotal} that reach only mainland China)` : ''}, network as of ${S.year}${S.planned ? ' with planned systems' : ''}.</span>`;
      const cap = reg.capLive, capT = reg.capTotal;
      $('#kpis').innerHTML = `
        <dt>Landing towns with a working international cable</dt><dd>${reg.sitesLive} of ${reg.sites}</dd>
        <dt>Published design capacity still landing</dt><dd>${capT.known ? `${fmtTbps(cap.tbps)} of ${fmtTbps(capT.tbps)} <span class="muted">(${capT.known} of ${capT.n} systems publish a figure)</span>` : 'no published figures'}</dd>
        <dt>Islands cut off</dt><dd>${lost.length}${prc.length ? `, plus ${prc.length} reachable only via China` : ''} of ${reg.nodes.length}</dd>`;
      $('#note').innerHTML = [
        S.scen && SCENARIO[S.scen]?.replay ? `<b>Replay:</b> ${esc(SCENARIO[S.scen].name)} (${esc(SCENARIO[S.scen].sub)}).` : '',
        lost.length ? `<b class="bad-t">Cut off by cable:</b> ${esc(listText(lost.map(n => n.name)))}.` : 'No island is cut off by cable.',
        prc.length ? `<b class="warn-t">Only via mainland China:</b> ${esc(listText(prc.map(n => n.name)))}.` : '',
        'Design capacity is what a whole system was built to carry, shared by every country it serves. It is not Taiwan\'s lit bandwidth.',
      ].filter(Boolean).join(' ');

      $('#isl-h').textContent = `Islands: ${reg.name}`;
      const rows = [...reg.nodes].sort((a, b) => ({ bad: 0, warn: 1, good: 2 }[a.status] - { bad: 0, warn: 1, good: 2 }[b.status]) || b.intlTotal - a.intlTotal || a.name.localeCompare(b.name));
      $('#isl-body').innerHTML = rows.map(n => `<tr data-s="${n.status}"><td><button type="button" class="linkish" data-n="${n.id}">${esc(n.name)}</button></td>
        <td><span class="dot" data-s="${n.status}"></span>${STATUS[n.status]}</td><td class="num">${n.routes}</td>
        <td class="num">${n.intlTotal ? `${n.intlLive}/${n.intlTotal}` : '–'}</td></tr>`).join('');
      root.querySelectorAll('[data-n]').forEach(b => b.onclick = () => act.node(b.dataset.n));

      const cuts = [...S.cut].filter(id => UNIT[id]);
      const byCable = new Map();
      for (const id of cuts) { const u = UNIT[id]; if (!byCable.has(u.cable)) byCable.set(u.cable, []); byCable.get(u.cable).push(u); }
      $('#cuts').innerHTML = byCable.size ? [...byCable].map(([c, us]) => `<button type="button" class="chip" data-c="${esc(c.id)}" title="Restore ${esc(c.name)}">${esc(c.name.replace(/ Cable System| \(.*\)$/g, ''))}${us.length < c.units.length ? ` <small>${esc(us.map(u => u.label).join(', '))}</small>` : ''} <span aria-hidden="true">×</span></button>`).join('')
        : '<p class="fine">Nothing cut.</p>';
      root.querySelectorAll('[data-c]').forEach(b => b.onclick = () => act.restoreCable(b.dataset.c));
      $('#repair-ref').innerHTML = cuts.length && days.length
        ? `How long would that last? In the sourced repair records in this atlas, restoring a damaged cable took ${days[0]} to ${days[days.length - 1]} days (median ${days[Math.floor(days.length / 2)]}). The calculator does not model repair time; see <a href="#repair">Repair capacity</a>.` : '';
      $('#year').value = S.year; $('#year-out').textContent = S.year; $('#opt-planned').checked = S.planned;
      renderDossier($('#dossier'), S, R, act);
    },
  };
}
