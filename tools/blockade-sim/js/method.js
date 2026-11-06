// "How to read it", method, baseline table, sources and citation, rendered below the tool.
import { SOURCES, FACTS, ASSUME } from '../data/params.js';
import { PORTWATCH } from '../data/portwatch.js';
import { CABLE_META } from '../data/cables.js';
import { escapeHtml } from '../../../shared/js/mapkit.js';

const link = k => {
  const s = SOURCES[k];
  if (!s) return '';
  return s.u ? `<a href="${s.u}" target="_blank" rel="noopener">${escapeHtml(s.short || s.t)}</a>` : escapeHtml(s.short || s.t);
};

export function mountMethod() {
  const facts = FACTS.map(f => `<tr><td>${f.item}</td><td>${f.fig}</td><td>${f.src.map(link).join('; ')}</td></tr>`).join('');
  const assume = ASSUME.filter(a => a.notional).map(a => `<tr><td>${a.t}</td><td class="num">${a.fmt ? a.fmt(a.v) : a.v + (a.u ? ' ' + a.u : '')}</td><td>${escapeHtml(a.why || a.note || '')}</td></tr>`).join('');
  const srcs = Object.values(SOURCES).map(s => `<li>${escapeHtml(s.t)}.${s.u ? ` <a href="${s.u}" target="_blank" rel="noopener">${escapeHtml(s.u.replace(/^https?:\/\//, '').slice(0, 60))}${s.u.length > 68 ? '…' : ''}</a>` : ''}${s.note ? ' ' + escapeHtml(s.note) : ''}</li>`).join('');
  document.getElementById('method').innerHTML = `
  <div class="col">
    <h2>How to read it</h2>
    <p>Pick a scenario on the right, then press Play or drag the day slider. The map shows cargo reaching Taiwan's ports (blue), traffic passing through the Strait (teal) and traffic diverted east of the island (yellow, dashed). Line widths follow the model's flows for that day. Cables turn red when cut and green when repaired; a small ship marks a cable ship on its way.</p>
    <p>The eight gauges give the state of the island on the chosen day. The tabs below the gauges show each part of the system over 180 days. The shaded span is the period the quarantine or blockade is in force. Pin a scenario, change something, and the timeline and the comparison table show both runs side by side. Copy link shares the exact scenario, including any assumptions you changed.</p>
    <p>A quarantine and a blockade work through different channels. In a quarantine the coast guard boards a share of ships and lets most go after a delay; the damage comes mostly from owners and insurers who stop sending ships. In a blockade the navy turns ships away, and insurers withdraw cover. Try the coast guard quarantine with the insurance market holding, then with the area listed: the second run shows the mechanism in Jonathan Walberg's paper <i>The Uninsurable Strait</i>, where private risk decisions do most of the coercive work while the sea stays open.</p>

    <h2 class="mt">How the model works</h2>
    <h3>Ships and insurers</h3>
    <p>Each day, cargo reaching Taiwan is the share of owners still willing to sail times the share of their ships the enforcer lets through. Willingness falls toward a target set by the insurance market: a small fall if the market holds, a larger one once the area is listed for war risk, and most of the traffic once cover is cancelled after the notice period. The speed of that fall, and of the premium rise, is fitted to the Red Sea in late 2023, where Bab el-Mandeb transits fell 58 percent within about seven weeks (time constant about 20 days). After the scenario lifts, willingness and premiums return slowly, because listings are removed long after the danger passes. In a quarantine, boarded ships arrive after an inspection delay and a share is turned back. Escorts cut the share of ships stopped; allied convoys also make owners more willing to sail. A state-backed insurance facility replaces part of the lost cover after a set-up period. Premium levels come from the Red Sea (0.07% of hull value before the listing, about 1% a month later) and the Black Sea in 2022 (about 5%). No Taiwanese or Chinese waters are on the Joint War Committee's listed areas today, and standard hull war clauses end cover automatically on the outbreak of war between the United States and China.</p>
    <h3>Fuel and power</h3>
    <p>Liquefied natural gas, coal and oil are stocks measured in days of normal use, as in TSM's <a href="../energy-blockade/">Energy Blockade Clock</a>. Arrivals follow the cargo share above. Renewables run at their normal share; coal plants, gas plants and oil-fired plants each run up to their normal share of generation while fuel lasts. Non-power uses take what is left. When supply falls short, the drawdown policy decides who loses power: shared evenly, or essential services, the energy sector and chip fabs first. A reserve can be held back from LNG for essential services. As a check, a full blockade (every ship turned away, no rationing, default assumptions) empties LNG on day 10 and coal on day 40 here; the CSIS <i>Lights Out?</i> wargames found gas ran out in about 10 days and coal at about 7 weeks.</p>
    <h3>Cables</h3>
    <p>Cutting a landing area takes down every international cable whose only Taiwanese landings are in the chosen areas (cables that also land elsewhere stay up). Taiwan has no cable repair ship of its own; ships come from the Yokohama and Southeast Asia and Indian Ocean maintenance zones. Each repair waits for access (peacetime, after the scenario lifts, or under escort), then for a ship to sail in, then for the repair itself, one cable at a time per ship. Capacity per cable is not public, so the gauge counts systems, not bandwidth.</p>
    <h3>Chips and trade</h3>
    <p>Chip output follows the power fabs receive. Any day below the fab threshold stops most output, and fabs then need several days to recalibrate before they reach full output. Electronic-component exports follow chip output (and the cargo share, if air freight is also restricted); all other exports follow both the cargo share and power to industry. Exports lost are split across destinations by their 2025 shares of Taiwan's exports.</p>
    <h3>What it leaves out</h3>
    <p>Kinetic strikes on ports, terminals or plants; ship-by-ship arrival timing; LNG boil-off and grid stability limits; inputs to fabs other than power (chemicals, gases, parts); price effects and demand response abroad; second-order financial effects; Taiwan's own countermeasures beyond the choices offered; and anything a real adversary would do to adapt. The shipping lanes and zones on the map are schematic. Use it to see which clock runs out first and which choices buy time, not to predict a date.</p>
  </div>
  <div class="col">
    <h2>Sourced baseline</h2>
    <div class="tablewrap"><table><thead><tr><th>Item</th><th>Figure</th><th>Source</th></tr></thead><tbody>${facts}</tbody></table></div>
    <h2 class="mt">Assumptions</h2>
    <p class="fine">Values the model needs that no public source gives. Each is adjustable in the Assumptions drawer.</p>
    <div class="tablewrap"><table><thead><tr><th>Assumption</th><th>Default</th><th>Why</th></tr></thead><tbody>${assume}</tbody></table></div>
    <h2 class="mt">Data</h2>
    <p class="fine">Shipping: IMF PortWatch daily transits and port calls, fetched ${PORTWATCH.fetched}, baseline window ${PORTWATCH.window[0]} to ${PORTWATCH.window[1]}. Source: International Monetary Fund; AIS-derived estimates, averaged and summed to weeks for this tool. Cables: TeleGeography Submarine Cable Map, fetched ${CABLE_META.fetched}, CC BY-SA 4.0; the derived cable file is shared under the same licence.</p>
    <h2 class="mt">Sources</h2>
    <ul class="src">${srcs}</ul>
    <h2 class="mt">How to cite</h2>
    <p class="cite">Taiwan Security Monitor, "Blockade &amp; Quarantine Simulator," TSM Interactive, George Mason University, ${new Date().getFullYear()}. Scenario link and access date. Shipping data: IMF PortWatch. Cable data: TeleGeography (CC BY-SA 4.0).</p>
  </div>`;
}
