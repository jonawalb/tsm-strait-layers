// Guided walkthrough: a fixed sequence of scenario states with short explanations.
const PLA = { v: 6, h: 4, u: 4 };

export const STEPS = [
  { title: 'Mines buy time',
    body: 'Four minelayers made two sorties and laid a barrier across the approach. The PLA has 48 hours and a modest mine countermeasures (MCM) force. The shaded cells are what it has searched. The rest is still dangerous.',
    set: { preset: 'barrier', ships: 4, sorties: 2, assets: PLA, hours: 48, strat: 'area', fires: false } },
  { title: 'Most of the search is empty water',
    body: 'The PLA does not know where the mines are, so it has to search every cell it plans to use. Look at the readout: most of the cells it searched held nothing. The threat of mines costs time even where there are none.',
    set: { preset: 'scatter', ships: 4, sorties: 2, assets: PLA, hours: 48, strat: 'area', fires: false } },
  { title: 'Lanes are faster',
    body: 'Instead of the whole area, the PLA clears two narrow lanes, or Q-routes, to the beach. The search finishes in a fraction of the time. This is how real clearance operations usually work.',
    set: { preset: 'barrier', ships: 4, sorties: 2, assets: PLA, hours: 48, strat: 'lanes', lanes: 2, fires: false } },
  { title: 'Lanes channel the assault',
    body: 'Every landing craft now has to use a few kilometres of front. That makes the assault predictable, and a defender with coastal missiles and drones knows exactly where to aim. The comparison table shows the trade.',
    set: { preset: 'barrier', ships: 4, sorties: 2, assets: PLA, hours: 48, strat: 'lanes', lanes: 1, fires: false } },
  { title: 'Mixed types slow the hunt',
    body: 'Moored contact mines and bottom influence mines need different search methods. A mixed field costs more effort per cell, and helicopter sweeps are weak against bottom mines. In 1991 Tripoli hit a moored mine and Princeton a bottom mine on the same morning.',
    set: { preset: 'mixed', ships: 4, sorties: 2, assets: PLA, hours: 48, strat: 'lanes', lanes: 2, fires: false } },
  { title: 'Clearance under fire',
    body: 'MCM ships are slow and work in predictable patterns. If Taiwan\'s coastal fires cover the field, the MCM force shrinks every hour it works, and the search slows further. Mines channel; fires destroy.',
    set: { preset: 'mixed', ships: 4, sorties: 2, assets: PLA, hours: 72, strat: 'lanes', lanes: 2, fires: true } },
  { title: 'Warning time is the decisive variable',
    body: 'Ten minelayers with three sorties lay a far denser field. That requires days of warning and a political decision to mine before shots are fired. With 72 hours of warning, Taiwan gets a much thinner field. Every number here is notional; the shape of the trade is the point.',
    set: { preset: 'mixed', ships: 10, sorties: 3, assets: PLA, hours: 72, strat: 'lanes', lanes: 2, fires: true } },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Walkthrough ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.title}</h3><p>${s.body}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const n = i + Number(b.dataset.d);
      if (n >= STEPS.length) stop(); else { i = n; show(); }
    });
    card.querySelector('.solid').focus();
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
