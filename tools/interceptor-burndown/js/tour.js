// Guided walkthrough: fixed scenario states with short explanations (pattern from strait-layers/js/tour.js).
// Each `set` overrides the default state; anything not named returns to its default.
import { SALVOS } from '../data/threats.js';
import { INV_PRESETS } from '../data/inventory.js';

const SV = k => ({ ...SALVOS.find(s => s.k === k).v });
const INV = k => ({ ...INV_PRESETS.find(p => p.k === k).v });

export const STEPS = [
  { title: 'A magazine, not a shield',
    body: 'Day 0 shows the open-source estimate of Taiwan\'s long-range interceptors: roughly 1,500 Patriot and Tien Kung rounds, with 80% assumed able to fire. None of these counts is official. Each colored band is one missile type.',
    set: { day: 0 } },
  { title: 'Two shots per missile halves the clock',
    body: 'This salvo spends the Pentagon\'s estimated 900 short-range ballistic missiles and 400 cruise missiles over ten days. Firing two interceptors at every ballistic missile raises the kill chance and empties the Patriot and Tien Kung III stocks within the first week.',
    set: { day: 5 } },
  { title: 'Shoot, look, then shoot again',
    body: 'Firing a second interceptor only after the first misses saves rounds, but against a ballistic missile there is often no time to look; the model assumes a second shot is possible half the time. The magazine lasts two days longer, and because the PRC stock is finite, fewer missiles get through in total.',
    set: { doc: { b: 'sls', c: 's', d: 's' }, day: 7 } },
  { title: 'Cheap drones, expensive interceptors',
    body: 'At the scale of Russia\'s 7 September 2025 attack on Ukraine, 810 drones and the largest of the war to that date, the magazine holds if long-range missiles are kept for missiles and drones go to guns, jammers and cheaper launchers. The leaker chart shows the price: most drones get through.',
    set: { salvo: SV('ukr'), day: 20 } },
  { title: 'Or spend everything on them',
    body: 'Let every interceptor fire at drones and the same raid drains the ballistic missile defense in days. Drone counts for a PRC campaign have no public estimate, so this is the input to treat most carefully.',
    set: { salvo: SV('ukr'), dronePol: 'all', savePac: false, day: 3 } },
  { title: 'Production is a trickle',
    body: 'Tien Kung III can be built at about 96 a year in peacetime, a quarter of a missile a day. Double it and the dry day barely moves. Resupply matters over months, not over a missile campaign measured in days.',
    set: { prod: 192, day: 6 } },
  { title: 'Planned orders buy days, not weeks',
    body: 'Add the T-Dome plan (230 more Tien Kung III, 128 Tien Kung IV) and the 123 NASAMS missiles due by 2031. Against the ten-day SRBM campaign the dry day moves by a couple of days.',
    set: { inv: INV('planned'), day: 7 } },
  { title: 'What moves the answer',
    body: 'The sensitivity chart moves one input at a time and ranks them. Firing doctrine, salvo size and how much of the magazine can fire move the dry day more than modest changes in stock. Switch the chart to leakers to see drones take over.',
    set: { metric: 'dry', day: 5 }, scroll: 'torcard' },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided walkthrough');
  root.prepend(card);
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
    card.querySelector('.solid').focus({ preventScroll: true });
    if (s.scroll) document.getElementById(s.scroll)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  };
  const start = () => { i = 0; card.hidden = false; show(); card.scrollIntoView({ block: 'nearest' }); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop, active: () => i >= 0 };
}
