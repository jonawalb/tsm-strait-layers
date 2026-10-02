// Side panel: headline status, scenario presets, options, island readout, selected cable and the cut list.
import { escapeHtml, listText } from '../../../shared/js/mapkit.js';
import { CABLES, META } from '../data/cables.js';
const FETCH_YEAR = Number(META.fetched.slice(0, 4));
import { LP, inService } from './network.js';
import { PRESETS, PRESET } from './presets.js';

const esc = escapeHtml;
const STATUS_TEXT = { good: 'Connected', warn: 'Via China only', bad: 'Cut off' };

export function createPanel(root, S, act) {
  root.innerHTML = `
    <div class="sec"><div class="status" id="headline"></div><p class="fine" id="headline-note"></p></div>
    <div class="sec">
      <p class="eyebrow">Cut scenarios</p>
      <div class="choices" id="presets">${PRESETS.map(p => `<button type="button" data-p="${p.id}" aria-pressed="false"><b>${esc(p.name)}</b><br><small>${esc(p.sub)}</small></button>`).join('')}</div>
      <p class="fine">Or click any cable on the map, or use the list below, to cut it yourself.</p>
    </div>
    <div class="sec">
      <p class="eyebrow">Islands</p>
      <div class="tablewrap"><table class="isl-table"><thead><tr><th>Island</th><th>Status</th><th title="Cable links still landing here">Links</th><th title="How many more cuts would cut it off from the world">Cuts to isolate</th></tr></thead><tbody id="isl-body"></tbody></table></div>
    </div>
    <div class="sec" id="detail" hidden></div>
    <div class="sec">
      <p class="eyebrow">Options</p>
      <label class="slider"><span class="sl-h"><span>Network as of</span><output id="year-out"></output></span>
        <input type="range" id="year" min="2000" max="2029" step="1">
        <small>Cables count from their ready-for-service year. Retired cables are not in the source data.</small></label>
      <label class="tg"><input type="checkbox" id="opt-planned"><span class="sw"></span><span class="t">Include planned cables<small>Systems TeleGeography lists as planned, from their expected RFS year</small></span></label>
      <label class="tg"><input type="checkbox" id="opt-prc"><span class="sw"></span><span class="t">Count links that land only in mainland China<small>CSCN (Kinmen to Dadeng Island and Guanyin Mountain) and TSE-1 (Tanshui to Fuzhou)</small></span></label>
      <label class="tg"><input type="checkbox" id="opt-regional"><span class="sw"></span><span class="t">Show regional cables<small>Systems that pass near Taiwan without landing there</small></span></label>
    </div>
    <div class="sec">
      <div class="list-h"><p class="eyebrow">Cables landing in Taiwan</p><button type="button" class="btn" id="clear">Restore all</button></div>
      <p class="fine">Press a landing or segment to cut it. International cables are cut at each Taiwanese landing; domestic cables by segment.</p>
      <div id="cable-list" class="cable-list"></div>
    </div>`;
  const $ = s => root.querySelector(s);
  root.querySelectorAll('#presets button').forEach(b => b.onclick = () => act.preset(b.dataset.p));
  $('#year').oninput = e => act.set({ year: +e.target.value, preset: null });
  $('#opt-planned').onchange = e => act.set({ planned: e.target.checked });
  $('#opt-prc').onchange = e => act.set({ prcCounts: e.target.checked });
  $('#opt-regional').onchange = e => act.set({ regional: e.target.checked });
  $('#clear').onclick = () => act.preset('none');

  const list = $('#cable-list');
  const intl = CABLES.filter(c => !c.domestic).sort((a, b) => (a.rfsYear - b.rfsYear) || a.name.localeCompare(b.name));
  const dom = CABLES.filter(c => c.domestic).sort((a, b) => a.rfsYear - b.rfsYear);
  const row = c => `<div class="crow" data-cable="${c.id}">
      <button type="button" class="cname" data-sel="${c.id}"><i class="sw-${c.domestic ? 'dom' : c.prcOnly ? 'prc' : 'intl'}"></i>${esc(c.name)} <span class="num muted">${c.rfsYear}${c.planned ? ' planned' : ''}</span></button>
      <div class="units">${c.units.map(u => `<button type="button" class="unit" data-u="${esc(u.id)}" aria-pressed="false" title="Cut ${esc(c.name)}: ${esc(u.label)}">${esc(u.label)}</button>`).join('')}</div></div>`;
  list.innerHTML = `<p class="sub">International</p>${intl.map(row).join('')}<p class="sub">Domestic (Taiwan to its outlying islands)</p>${dom.map(row).join('')}`;
  list.querySelectorAll('.unit').forEach(b => b.onclick = () => act.toggleCut(b.dataset.u));
  list.querySelectorAll('.cname').forEach(b => {
    b.onclick = () => act.select(b.dataset.sel);
    b.onpointerenter = () => act.hover(b.dataset.sel);
    b.onpointerleave = () => act.hover(null);
  });

  return {
    render(R) {
      $('#year').value = S.year; $('#year-out').textContent = S.year;
      $('#opt-planned').checked = S.planned; $('#opt-prc').checked = S.prcCounts; $('#opt-regional').checked = S.regional;
      root.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === S.preset)));

      const lost = R.islands.filter(i => i.status === 'bad'), prcOnly = R.islands.filter(i => i.status === 'warn');
      const s = lost.length ? 'bad' : prcOnly.length || R.intlNonPrcLive < R.intlNonPrcTotal ? 'warn' : 'good';
      const h = $('#headline');
      h.dataset.s = s;
      h.innerHTML = `<b>${R.intlNonPrcLive} of ${R.intlNonPrcTotal} international cables</b>
        <span>still connect Taiwan beyond mainland China${R.prcTotal ? `, plus ${R.prcLive} of ${R.prcTotal} links that land only in mainland China` : ''}, as of ${S.year}.</span>`;
      const dark = R.lps.filter(l => l.dark).map(l => l.name);
      $('#headline-note').innerHTML = [
        S.preset && PRESET[S.preset]?.name && !PRESETS.some(p => p.id === S.preset) ? `<b>Replay:</b> ${esc(PRESET[S.preset].name)}.` : '',
        lost.length ? `<b class="bad-t">Cut off:</b> ${esc(listText(lost.map(i => i.short)))}.` : 'No island is cut off.',
        prcOnly.length ? `<b class="warn-t">Only via mainland China:</b> ${esc(listText(prcOnly.map(i => i.short)))}.` : '',
        dark.length ? `Landing points with no working cable: ${esc(listText(dark))}.` : '',
      ].filter(Boolean).join(' ');

      $('#isl-body').innerHTML = R.islands.map(i => `<tr data-s="${i.status}"><td>${esc(i.name)}</td>
        <td><span class="dot" data-s="${i.status}"></span>${STATUS_TEXT[i.status]}${i.status === 'good' && !i.toTaiwan ? '<br><small class="muted">not linked to Taiwan</small>' : ''}</td>
        <td class="num">${i.links}</td><td class="num">${i.routes}</td></tr>`).join('');

      list.querySelectorAll('.crow').forEach(r => {
        const c = CABLES.find(x => x.id === r.dataset.cable);
        const on = inService(c, S.year, S.planned);
        r.classList.toggle('off', !on);
        r.classList.toggle('sel', S.sel === c.id);
        r.hidden = c.planned && !S.planned;
      });
      list.querySelectorAll('.unit').forEach(b => b.setAttribute('aria-pressed', String(S.cut.has(b.dataset.u))));

      const d = $('#detail'), c = CABLES.find(x => x.id === S.sel);
      d.hidden = !c;
      if (c) {
        const foreign = c.lps.filter(id => LP[id].country !== 'Taiwan');
        const on = inService(c, S.year, S.planned);
        const cutN = c.units.filter(u => S.cut.has(u.id)).length;
        d.innerHTML = `<div class="list-h"><p class="eyebrow">Selected cable</p><button type="button" class="x" aria-label="Close">×</button></div>
          <h3 class="dh">${esc(c.name)}</h3>
          <dl class="readout">
            <dt>Status</dt><dd>${c.planned ? 'Planned' : on ? (c.rfsYear < FETCH_YEAR ? 'In service' : 'In service or under construction (TeleGeography)') : 'Not yet in service'}${cutN ? ` · ${cutN} of ${c.units.length} ${c.domestic ? 'segments' : 'Taiwan landings'} cut` : ''}</dd>
            <dt>RFS</dt><dd>${esc(c.rfs || c.rfsYear || 'n/a')}</dd>
            <dt>Length</dt><dd>${esc(c.length || 'not listed')}</dd>
            <dt>Owners</dt><dd>${esc(c.owners || 'not listed')}</dd>
            ${c.suppliers ? `<dt>Supplier</dt><dd>${esc(c.suppliers)}</dd>` : ''}
            <dt>In Taiwan</dt><dd>${esc(listText(c.twLps.map(id => LP[id].name)))}</dd>
            ${foreign.length ? `<dt>Abroad</dt><dd>${esc(foreign.map(id => `${LP[id].name} (${LP[id].country})`).join('; '))}</dd>` : ''}
          </dl>
          <div class="row-btns"><button type="button" class="btn" id="cut-all">${cutN === c.units.length ? 'Restore this cable' : 'Cut this cable'}</button>
          <a class="btn" href="https://www.submarinecablemap.com/submarine-cable/${encodeURIComponent(c.id)}" target="_blank" rel="noopener">TeleGeography page</a></div>`;
        d.querySelector('.x').onclick = () => act.select(null);
        d.querySelector('#cut-all').onclick = () => act.cutCable(c.id, cutN !== c.units.length);
      }
    },
  };
}
