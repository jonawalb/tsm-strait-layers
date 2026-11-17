// Guided walkthrough: fixed view states with short explanations.
export const STEPS = [
  { title: 'What traders pay today',
    body: 'Each row is a Polymarket contract that pays $1 if the event happens by its deadline. The Taiwan contracts come first: invasion, blockade and clash prices, with their last 60 days as a line.',
    set: { v: 'board', th: 'taiwan', sort: 'theater' } },
  { title: 'A price path, with the news beside it',
    body: 'The 2026 invasion contract, day by day. Dots along the top are joint combat readiness patrols announced by Taiwan’s MND, and grey bars are PLA aircraft per day. Hover the chart, or focus it and use the arrow keys, to read the price on any day and the events near it.',
    set: { v: 'market', m: '567621' } },
  { title: 'A contract that resolved',
    body: 'The September 2026 invasion contract expired worthless. The small markers show its price 1, 7 and 30 days before the deadline: the prices that get scored.',
    set: { v: 'market', m: '1633606' } },
  { title: 'Did 20¢ mean 20%?',
    body: 'Every resolved contract, at its price a week before the outcome. Circles near the diagonal mean prices matched how often things happened. Most contracts sit near zero and resolved No.',
    set: { v: 'calib', th: 'all', lead: 7 } },
  { title: 'Taiwan: too few outcomes to judge',
    body: 'Twelve resolved Taiwan and China contracts, one Yes. A low Brier score here mostly records that nothing happened. It cannot show the crowd would see an attack coming.',
    set: { v: 'calib', th: 'taiwan', lead: 7 } },
  { title: 'Is anyone trading on inside knowledge?',
    body: 'Walberg’s λ is the share of price moves around news that came from informed traders. For Iran/Israel the estimate is about 0.24, at the edge of what a market with no insiders produces: weak evidence.',
    set: { v: 'lambda', lt: 'iran_israel', ls: null } },
  { title: 'Taiwan fails the test’s premise',
    body: 'Invasion contracts that later resolved No rose when the PLA exercised. That is public news at work, not insiders, so the Taiwan estimate carries no information. Move the slider to see how little the fit changes.',
    set: { v: 'lambda', lt: 'taiwan', ls: null } },
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
    card.innerHTML = `<div class="tour-h"><span>Step ${i + 1} of ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.title}</h3><p>${s.body}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const n = i + Number(b.dataset.d);
      if (n >= STEPS.length) stop(); else { i = n; show(); }
    });
    card.querySelector('.solid').focus({ preventScroll: true });
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
