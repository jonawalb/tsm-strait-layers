// Guided walkthrough: a fixed sequence of allocator states with short explanations.
// STEPS is Taiwan's walkthrough; other countries carry their own `tour` array in their profile.
export const STEPS = [
  { title: 'Start with the real money',
    body: 'On September 3, 2026 the cabinet asked for NT$145.7bn in defense spending as part of a supplementary budget. Mapped onto this model, more than a third goes to drones and uncrewed boats, and almost half sits in classified programs and personnel lines the model cannot score.',
    set: { b: 's145', preset: 'cabinet', supp: 0.6, warn: 5 } },
  { title: 'A porcupine mix',
    body: 'Spread the same money across coastal missiles, drones, mines, strike, resilience and ammunition. Cheap, mobile systems survive the opening strikes better and cover more of the crossing, so more of the invasion force comes under fire.',
    set: { b: 's145', preset: 'porcupine' } },
  { title: 'A legacy-platform mix',
    body: 'Put most of it into fighters, submarines and big ships. Each platform is capable, but they are few, expensive and easy to find at their bases, so in this model the PLA\'s first strikes remove much of that investment before the fleet sails.',
    set: { b: 's145', preset: 'legacy' } },
  { title: 'Suppression is the hinge',
    body: 'Turn PLA suppression down and the legacy mix engages about a third of the fleet instead of under a quarter, and keeps it under fire as long as the porcupine does, though the porcupine still engages more. Much of the case for the porcupine rests on the assumption that Taiwan absorbs a heavy first strike. Move the suppression slider to see how much the answer depends on it.',
    set: { b: 's145', preset: 'legacy', supp: 0.1 } },
  { title: 'Mines need warning',
    body: 'Mines are cheap and do not need a live track to work, but only if they are in the water before the fleet arrives. With one day of warning most of the minefield is never laid.',
    set: { b: 's145', preset: 'porcupine', supp: 0.6, warn: 1 } },
  { title: 'Scale and diminishing returns',
    body: 'Switch to the proposed NT$1.25 trillion eight-year plan. Every category saturates, so the first billions buy far more than the last. Drag the boundaries in the bar to see where extra money still moves the result.',
    set: { b: 's1250', preset: 'porcupine', supp: 0.6, warn: 5 } },
];

export function createTour(root, apply, getSteps = () => STEPS) {
  let i = -1, steps = getSteps();
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = steps[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Walkthrough ${i + 1} / ${steps.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.title}</h3><p>${s.body}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === steps.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const n = i + Number(b.dataset.d);
      if (n >= steps.length) stop(); else { i = n; show(); }
    });
    card.querySelector('.solid').focus();
  };
  const start = () => { steps = getSteps(); i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
