// "How to read it", method, real budgets, spending menu and sources for countries other than Taiwan.
// The method list is generated from the profile's own notional parameters, so the page and the model cannot drift.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`;
const lc = t => t.charAt(0).toLowerCase() + t.slice(1);

function method(P) {
  const C = Object.fromEntries(P.cats.map(c => [c.id, c])), g = P.geo, cur = P.cur;
  const ks = P.cats.filter(c => c.id !== 'other').map(c => `${lc(c.t)} ${c.k.toLocaleString('en-US')}`).join(', ');
  const shoot = P.cats.filter(c => c.w > 0);
  const reach = shoot.map(c => `${lc(c.t)} ${c.reach >= g.km ? 'the whole approach' : c.reach + ' km'}`).join(', ');
  const w = shoot.map(c => `${lc(c.t)} ${Math.round(c.w * 100)}%`).join(', ');
  const T = P.doc.terms;
  return `<ol class="method">
    <li><b>Diminishing returns.</b> Each category starts from a notional baseline <i>b</i> that ${P.name} already has. Spending <i>x</i> raises capability to <code>E = 1 − (1 − b)·e<sup>−x/k</sup></code>, so the first billions buy the most. The scale <i>k</i>, in ${cur} billions: ${ks}.</li>
    <li><b>Suppression.</b> ${T.attacker} opens with missile and air strikes of strength <i>s</i>. Mobile systems survive at <code>1 − s·(1 − 0.55·E<sub>${T.c4}</sub>)·(1 − 0.35·E<sub>air</sub>)</code>. ${T.platforms} are few and sit at known bases, so they survive at <code>1 − 1.1·s·(1 − 0.35·E<sub>air</sub>)</code>.</li>
    <li><b>Tracking and sustainment.</b> Shooters need a track: <code>0.55 + 0.45·E<sub>${T.c4}</sub>·(1 − 0.4·s)</code>. They need ammunition to keep firing: <code>0.6 + 0.4·E<sub>ammo</sub></code>. Drones carry some of their own sensing and depend on tracking half as much.</li>
    <li><b>${C.mines.t}</b> need no track, but only the share <code>1 − e<sup>−days/3.5</sup></code> is in place before the assault.</li>
    <li><b>Layer strength</b> is capability × survival × tracking × sustainment. Each layer can engage at most a notional share of the force (${w}). The share engaged is <code>1 − Π(1 − p)</code> across layers.</li>
    <li><b>Approach under fire</b> is the share of a ${g.km} km approach at ${g.speed} ${g.unit === 'kn' ? 'knots' : 'km/h'} where the strengths of all layers that reach it add up to at least 0.3. Notional reaches from ${T.edge}: ${reach}.</li>
    <li><b>Resilience</b> is <code>100 × (0.3·E<sub>${T.c4}</sub> + 0.25·E<sub>ammo</sub> + 0.2·E<sub>air</sub> + 0.25·mobile survival)</code>.</li>
    <li><b>The ranges.</b> Each of 200 runs draws, uniformly and independently: strike strength <i>s</i> from 20% to 80%; warning from 2 to 10 days; every scale <i>k</i> multiplied by 0.5 to 2; every baseline by 0.6 to 1.4; every maximum share by 0.6 to 1.4; and attacker speed by 0.75 to 1.5. The same draws are used for every plan. Bands show the 10th to 90th percentile of runs, and the thin line the lowest and highest.</li>
  </ol>`;
}

function menu(P) {
  const rows = P.cats.filter(c => c.id !== 'other').map(c => `<tr><td>${c.t}</td><td>${c.unit}</td><td class="num">${P.money(c.cost)}</td>
    <td>${c.src ? `${c.basis}${c.est ? ' <span class="pill">estimate</span>' : ''} ${link(c.src, c.srcName)}` : '<span class="notional">notional</span>'}</td></tr>`).join('');
  return `<div class="tablewrap"><table class="menu"><thead><tr><th>Category</th><th>Unit</th><th>Unit cost</th><th>Basis and source</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function renderDoc(P, left, right) {
  const D = P.doc;
  // howto[0] described the old single-run readout; the generic text below replaces it. howto[1+] (the country's mixes) stay.
  left.innerHTML = `<h2>How to read it</h2>
    <p>Pick a budget, then divide it across eight kinds of capability. The tool does not say whether a plan would win a fight. <b>What it buys</b> prices each line at the unit costs in the spending menu below, marked cited or <span class="notional">notional</span>, and the trade-off box shows what moving money from one line to another gives up and gets. <b>Range model</b> runs a simple notional model 200 times with six assumptions drawn from wide ranges and shows only the spread of results: never one number, a verdict or a chance of victory. Where two plans' bands overlap, the model cannot separate them.</p>
    ${D.howto.slice(1).map(p => `<p>${p}</p>`).join('')}
    <h2 class="mt">The scenario</h2><p><b>Notional model, not a prediction.</b> ${D.scenario}</p>
    <h2 class="mt">How the range model works</h2>
    <p>The model has the same structure as the Taiwan version. Every coefficient, baseline, reach, weight and scale below is <span class="notional">notional</span>; the central values can be changed under "Edit the notional parameters". It is a teaching model, does not predict what any real program would do, and other factors it leaves out can outweigh everything in it.</p>
    ${method(P)}
    <p>${D.leavesOut}</p>`;
  right.innerHTML = `<h2>The real budgets</h2>
    <div class="tablewrap"><table><thead><tr>${D.real.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${D.real.rows.map(r => `<tr>${r.map((v, i) => `<td${i === 1 ? ' class="num"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${D.real.note ? `<p class="fine mt8">${D.real.note}</p>` : ''}
    <h2 class="mt">The spending menu</h2>
    <p class="fine">Unit costs come from the sources named in each row. Program totals from U.S. notifications include support, training and spares, so the cost per unit is a program cost, not a flyaway price. Rows marked estimate are divided out or converted by us. ${D.menuNote || ''}</p>
    ${menu(P)}
    ${D.related && D.related.length ? `<h2 class="mt">Related budget lines</h2><ul class="src">${D.related.map(r => `<li><b>${r.b}</b> ${r.t} ${link(r.url, r.src)}</li>`).join('')}</ul>` : ''}
    <h2 class="mt">Sources</h2>
    <ul class="src">${D.sources.map(s => `<li>${s.t ? s.t + ' ' : ''}${s.url ? link(s.url, s.src) : s.src}${s.d ? `, ${s.d}` : ''}.${s.n ? ' ' + s.n : ''}</li>`).join('')}
      <li>Model structure adapted from the Taiwan version of this tool and the crossing mode of ${link('../strait-layers/', 'Strait Layers')}. Baselines, reaches, weights, scales, the scenario geometry and all coefficients are notional.</li></ul>
    ${D.missing ? `<p class="fine mt8"><b>What is missing.</b> ${D.missing}</p>` : ''}`;
}
