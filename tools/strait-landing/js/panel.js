// Side panel: the plan (setup) and each turn's orders, for either side.
import { ZONES, ZONE_KEYS, STRIKES, LIFT, TURNS, MAX_WAIT } from '../data/params.js';
import { MONTHS, CLIM, wave, band, BANDS, fmtDate, firstCalm } from './weather.js';
import { defAt, seaAt } from './model.js';
import { turnLabel } from './chart.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = v => Math.round(v * 10) / 10;
const pct = v => `${Math.round(v * 100)}%`;
const btn = (attrs, inner, on) => `<button type="button" ${attrs} aria-pressed="${on ? 'true' : 'false'}">${inner}</button>`;
const seaChip = (m, b) => `<span class="sl-chip" data-b="${b}">${m ?? '?'} m</span>`;

// ---------- Setup ----------

export function setupHTML(S, start) {
  const s = S.setup, main = s.zones[0], pt = ZONES[main].pt;
  const c = CLIM[pt][s.month];
  const months = MONTHS.map((m, i) => {
    const cc = CLIM[pt][i];
    return btn(`data-month="${i}" aria-label="${m}: ${pct(cc[0])} of days slight or calmer"`,
      `<b>${m.slice(0, 3)}</b><span class="sl-mbar" aria-hidden="true"><i data-b="0" style="width:${cc[0] * 100}%"></i><i data-b="1" style="width:${cc[1] * 100}%"></i><i data-b="2" style="width:${cc[2] * 100}%"></i></span>`, i === s.month);
  }).join('');
  const zoneBtns = (which) => ZONE_KEYS.map(z => btn(`data-zone${which}="${z}"`, `<b>${ZONES[z].t}</b><small>${ZONES[z].area} · ${ZONES[z].km} km</small>`, s.zones[which] === z)).join('')
    + (which === 1 ? btn('data-zone1=""', '<b>None</b><small>one landing only</small>', !s.zones[1]) : '');
  const calmK = firstCalm(start, pt);
  const days = Array.from({ length: MAX_WAIT + 1 }, (_, k) => {
    const m = wave(pt, start + k), b = band(m);
    return btn(`data-wait="${k}"`, `<b>${k ? `Wait ${k} day${k > 1 ? 's' : ''}` : 'Go now'}</b><small>${fmtDate(start + k)}</small>${seaChip(m, b)}`, s.wait === k);
  }).join('') + btn('data-wait="calm"', `<b>Wait for calm</b><small>${wave(pt, start + calmK) <= 1.25 ? `first slight day (${calmK ? `${calmK} day${calmK > 1 ? 's' : ''}` : 'today'})` : `none slight: calmest day (${calmK ? `${calmK} day${calmK > 1 ? 's' : ''}` : 'today'})`}</small>`, s.wait === 'calm');
  const isPla = S.role === 'pla';
  return `
  <div class="sec">
    <p class="eyebrow">1 · Your side</p>
    <div class="choices sl-two">${btn('data-role="pla"', '<b>PLA planner</b><small>land and build up</small>', isPla)}${btn('data-role="roc"', '<b>Taiwan commander</b><small>defend the coast</small>', !isPla)}</div>
  </div>
  <div class="sec">
    <p class="eyebrow">2 · Month</p>
    <div class="sl-months" role="group" aria-label="Month of the landing">${months}</div>
    <p class="fine">Seas in mid-Strait off the ${esc(ZONES[main].area)} in ${MONTHS[s.month]}, ERA5 1996–2025: <b>${pct(c[0])}</b> of days slight or calmer, ${pct(c[1])} moderate, ${pct(c[2])} rough. Each game plays a real week drawn from those 30 years.</p>
  </div>
  ${isPla ? `
  <div class="sec">
    <p class="eyebrow">3 · Landing zones</p>
    <p class="fine">Main landing (click the map or choose):</p>
    <div class="choices sl-zones">${zoneBtns(0)}</div>
    <p class="fine">Second landing (splits the lift):</p>
    <div class="choices sl-zones">${zoneBtns(1)}</div>
  </div>
  <div class="sec">
    <p class="eyebrow">4 · D-day</p>
    <p class="fine">A three-day forecast for the ${esc(ZONES[main].area)}. Each day you wait adds two turns of strikes, while Taiwan mobilizes and lays more mines.</p>
    <div class="choices sl-days">${days}</div>
    ${s.wait !== 0 ? `<p class="fine">Strikes while you wait:</p><div class="choices sl-strikes">${Object.entries(STRIKES).map(([k, v]) => btn(`data-prep="${k}"`, `<b>${v.t}</b>`, s.prep === k)).join('')}</div>` : ''}
  </div>
  <div class="sec">
    <p class="eyebrow">5 · Outside help for Taiwan</p>
    <label class="tg"><input type="checkbox" id="us" ${s.us ? 'checked' : ''}><span class="sw"></span><span class="t">U.S. and allied strikes on shipping from D+1<small>The CSIS base case assumed U.S. and Japanese intervention. Off = Taiwan fights alone.</small></span></label>
  </div>` : `
  <div class="sec">
    <p class="eyebrow">3 · Mines</p>
    <p class="fine">Three loads of mines. Where the landing will come is hidden until H-hour.</p>
    ${ZONE_KEYS.map(z => `<div class="sl-stepper"><span>${esc(ZONES[z].area)}</span><button type="button" class="btn" data-mine="${z}" data-d="-1" aria-label="Fewer mines off the ${esc(ZONES[z].area)}">−</button><b class="num">${Math.round((S.setup.roc.mines[z] || 0) / 0.35)}</b><button type="button" class="btn" data-mine="${z}" data-d="1" aria-label="More mines off the ${esc(ZONES[z].area)}">+</button></div>`).join('')}
  </div>
  <div class="sec">
    <p class="eyebrow">4 · Posture</p>
    <label class="slider"><span class="sl-h"><span>Forward at the beaches vs. held back as reserves</span><output class="num">${pct(S.setup.roc.forward)}</output></span>
      <input type="range" id="forward" min="0" max="1" step="0.1" value="${S.setup.roc.forward}"><small>More forward: stronger beaches everywhere, smaller reserves to move.</small></label>
    <label class="tg"><input type="checkbox" id="demo" ${S.setup.roc.demo > 0.6 ? 'checked' : ''}><span class="sw"></span><span class="t">Prepare the ports for demolition<small>A port that falls is wrecked 85% of the time instead of 50%.</small></span></label>
    <label class="tg"><input type="checkbox" id="us" ${s.us ? 'checked' : ''}><span class="sw"></span><span class="t">U.S. and allied strikes on shipping from D+1<small>As in the CSIS base case.</small></span></label>
  </div>`}
  <div class="sec">
    <button type="button" class="btn solid sl-go" id="launch">${isPla ? 'Launch the landing' : 'Take command'}</button>
    <p class="fine">Seed <span class="num">${S.seed}</span> · <button type="button" class="linkish" id="reseed">new week</button></p>
  </div>`;
}

// ---------- Turn orders ----------

export function ordersHTML(S, G, o) {
  const t = G.t + 1;
  const zones = G.setup.zones.filter(Boolean);
  const seas = ZONE_KEYS.map(z => { const s = seaAt(G, t, z); return `<span class="sl-seaz"><span>${esc(ZONES[z].area)}</span>${seaChip(s.m, s.b)}</span>`; }).join('');
  const head = `<div class="sec sl-turnhead"><p class="eyebrow">Turn ${t} of ${TURNS} · ${turnLabel(t)}</p><div class="sl-seas">${seas}</div></div>`;
  if (S.role === 'pla') {
    const main = zones[0];
    const ports = zones.map(z => `<label class="tg"><input type="checkbox" data-port="${z}" ${o.port[z] ? 'checked' : ''} ${G.port[z] !== 'roc' ? 'disabled' : ''}><span class="sw"></span><span class="t">Assault ${esc(ZONES[main === z ? z : z].port.t)}<small>${G.port[z] === 'roc' ? `Needs ${G.P.portRatio}:1 over its defenders; troops ashore ${r1(G.ashore[z])}` : G.port[z] === 'pla' ? 'Held intact' : 'Taken, but wrecked'}</small></span></label>`).join('');
    return head + `
    <div class="sec">
      <p class="eyebrow">Send this wave</p>
      <p class="fine">In port and loaded: <b class="num">${G.ready.amph}</b> amphibious and <b class="num">${G.ready.ferry}</b> ferry groups. ${G.back.length ? `${G.back.reduce((a, b) => a + b.amph + b.ferry, 0)} more are on the way back.` : ''}</p>
      <label class="slider"><span class="sl-h"><span>Amphibious ship groups</span><output class="num" id="o-amph-v">${o.amph}</output></span><input type="range" id="o-amph" min="0" max="${G.ready.amph}" value="${o.amph}"><small>${LIFT.amph.size} point each. Land on beaches in slight or moderate seas.</small></label>
      <label class="slider"><span class="sl-h"><span>Civilian RO-RO ferry groups</span><output class="num" id="o-ferry-v">${o.ferry}</output></span><input type="range" id="o-ferry" min="0" max="${G.ready.ferry}" value="${o.ferry}"><small>${LIFT.ferry.size} points each. Full rate only at a port you hold; on a beach, a third of the rate and only in slight seas.</small></label>
      ${zones[1] ? `<label class="slider"><span class="sl-h"><span>Share to the ${esc(ZONES[main].area)}</span><output class="num" id="o-share-v">${pct(o.share)}</output></span><input type="range" id="o-share" min="0" max="1" step="0.1" value="${o.share}"><small>The rest goes to the ${esc(ZONES[zones[1]].area)}.</small></label>` : ''}
    </div>
    <div class="sec">
      <p class="eyebrow">Strikes this turn</p>
      <div class="choices sl-strikes">${Object.entries(STRIKES).map(([k, v]) => btn(`data-strike="${k}"`, `<b>${v.t}</b>`, o.strike === k)).join('')}</div>
      ${ports}
    </div>
    <div class="sec"><button type="button" class="btn solid sl-go" id="resolve" aria-keyshortcuts="N">Resolve turn ${t}</button></div>`;
  }
  // Taiwan
  const fire = [['1', 'Fire everything', 'every battery with missiles'], ['0.5', 'Fire half', 'keep half hidden'], ['0', 'Hold fire', 'hide from the hunters']]
    .map(([v, a, b]) => btn(`data-fire="${v}"`, `<b>${a}</b><small>${b}</small>`, String(o.fire) === v)).join('');
  const reserves = G.reserves.map(r => {
    const where = r.at ? `at the ${ZONES[r.at].area}` : `moving to the ${ZONES[r.dest].area} (${r.eta} turn${r.eta === 1 ? '' : 's'})`;
    const sel = ZONE_KEYS.map(z => `<option value="${z}" ${(o.moves[r.id] || r.dest) === z ? 'selected' : ''}>${ZONES[z].area}</option>`).join('');
    return `<label class="sl-res"><span>Group ${r.id + 1} · <b class="num">${r1(r.s)}</b> pts · ${where}</span><select data-move="${r.id}" ${r.at ? '' : 'disabled'} aria-label="Send reserve group ${r.id + 1} to">${sel}</select></label>`;
  }).join('');
  const lodg = ZONE_KEYS.filter(z => G.ashore[z] > 0);
  const ca = lodg.length ? lodg.map(z => `<label class="tg"><input type="checkbox" data-ca="${z}" ${o.ca[z] ? 'checked' : ''}><span class="sw"></span><span class="t">Counterattack at the ${esc(ZONES[z].area)}<small>You ${r1(defAt(G, z))} vs PLA ${r1(G.ashore[z])} ashore. Attacking gives up your prepared positions.</small></span></label>`).join('')
    : '<p class="fine">No PLA troops ashore yet.</p>';
  const afloat = ZONE_KEYS.map(z => G.queue[z].amph + G.queue[z].ferry).reduce((a, b) => a + b, 0);
  return head + `
  <div class="sec">
    <p class="eyebrow">Anti-ship missiles</p>
    <p class="fine"><b class="num">${G.launchers.filter(L => L.alive).length}</b> batteries left, <b class="num">${G.launchers.reduce((a, L) => a + (L.alive ? L.ammo : 0), 0)}</b> missiles. ${afloat ? `${afloat} ship groups are offshore now; more may sail this turn.` : 'No ships offshore yet; they may sail this turn.'} A battery that fires is easier to find next turn.</p>
    <div class="choices sl-three">${fire}</div>
  </div>
  <div class="sec">
    <p class="eyebrow">Reserves</p>${reserves}
    <label class="sl-res"><span>Mobilized reserves (from turn 3) join</span><select id="mobto">${ZONE_KEYS.map(z => `<option value="${z}" ${o.mobTo === z ? 'selected' : ''}>${ZONES[z].area}</option>`).join('')}</select></label>
  </div>
  <div class="sec"><p class="eyebrow">Counterattack</p>${ca}</div>
  <div class="sec"><button type="button" class="btn solid sl-go" id="resolve" aria-keyshortcuts="N">Resolve turn ${t}</button></div>`;
}

/** Default orders for the coming turn. */
export function defaultOrders(S, G) {
  if (S.role === 'pla') {
    const zones = G.setup.zones.filter(Boolean);
    const b = seaAt(G, G.t + 1, zones[0]).b;
    const portHeld = zones.some(z => G.port[z] !== 'roc');
    return { amph: G.ready.amph, ferry: portHeld || b === 0 ? G.ready.ferry : 0, share: zones[1] ? 0.7 : 1, strike: G.t < 2 ? 'hunt' : 'hunt', port: Object.fromEntries(zones.map(z => [z, true])) };
  }
  return { fire: 1, moves: {}, ca: {}, mobTo: null };
}

export { BANDS };
