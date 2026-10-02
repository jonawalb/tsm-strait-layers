// Guided walkthrough: fixed parameter states with short explanations. Modeled on strait-layers/js/tour.js.
import { A_DEFAULTS } from './models/crisis.js';
import { B_DEFAULTS } from './models/signal.js';
import { C_DEFAULTS } from './models/reputation.js';

export const STEPS = [
  { title: 'A threat is information',
    body: 'S threatens and R must guess whether S would really fight. Here R thinks S is probably irresolute, so the irresolute type bluffs some of the time and R calls some of the time. Follow the thick lines in the tree: war happens with positive probability.',
    set: { m: 'A', A: { ...A_DEFAULTS } } },
  { title: 'Audience costs tie hands',
    body: 'Raise the cost of backing down above the irresolute type’s net loss from war (a ≥ cₕ − q). Now both types would fight, R believes every threat and concedes, and the audience cost is never paid. This is Fearon’s commitment logic in one step.',
    set: { m: 'A', A: { ...A_DEFAULTS, a: 0.8 } } },
  { title: 'Optimistic receivers invite bluffs',
    body: 'Keep the audience cost low but make R believe S is likely resolute. R concedes to any threat, so the irresolute type bluffs and wins. A strong reputation can make bluffing pay.',
    set: { m: 'A', A: { ...A_DEFAULTS, p: 0.85, a: 0.2 } } },
  { title: 'Sinking costs: pay to be believed',
    body: 'A mobilization that costs k whatever happens separates the types once k exceeds what the irresolute type could gain. R’s posterior after the signal jumps to 1. The price is that the resolute type burns k every time.',
    set: { m: 'B', B: { ...B_DEFAULTS, tech: 'sunk', k: 0.35 } } },
  { title: 'Tying hands: pay only if you fold',
    body: 'A public commitment costs nothing unless S backs down. Past a ≥ c − vᵢ no one who commits will fold. Compare the table: tying hands leaves S better off on average but carries a higher chance of war, the second of the two main results in Fearon (1997).',
    set: { m: 'B', B: { ...B_DEFAULTS, tech: 'tied', k: 0.36 } } },
  { title: 'Salami tactics and reputation',
    body: 'A defender faces ten slices. Even a 5% chance that it is tough keeps the challenger out of the early slices, because a weak defender will resist early to protect its reputation. Press “Play it out” to watch one history.',
    set: { m: 'C', C: { ...C_DEFAULTS } } },
  { title: 'Without doubt, deterrence unravels',
    body: 'Remove all uncertainty about the defender. The weak defender gives way on the last slice, so resisting the one before it buys nothing, and the logic runs back to the first slice. Every slice is taken. Small doubts carry the whole deterrent.',
    set: { m: 'C', C: { ...C_DEFAULTS, p0: 0 } } },
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
