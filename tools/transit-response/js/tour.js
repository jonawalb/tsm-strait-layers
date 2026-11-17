// Guided walkthrough: a fixed sequence of views with short explanations.
const BASE = { unit: 'count', to: 3, dropx: false, clean: false, showev: true, m: 'air' };

export const STEPS = [
  { title: 'One dot, one transit day',
    body: 'Each dot is a day when allied warships went through the Taiwan Strait. Filled dots have enough TSM daily data to analyze; hollow ones came before the daily record began or lack enough data. This is the most recent event in the tracker.',
    set: { ...BASE, view: 'single', ev: '2026-09-18' } },
  { title: 'Start from a baseline',
    body: 'The dashed line is the average of the 30 days before the transit, leaving out days near other transits. The lower panel shows each day above or below it. Here, a U.S. destroyer transit in August 2024.',
    set: { ...BASE, view: 'single', ev: '2024-08-22' } },
  { title: 'Watch for what else happened',
    body: 'This October 2024 transit came six days after Joint Sword-2024B, and the exercise days sit inside the baseline. Leaving exercise days out lowers the baseline and changes the picture. Always read the flags in the side panel.',
    set: { ...BASE, view: 'single', ev: '2024-10-20', dropx: true } },
  { title: 'Ship counts since August 2024',
    body: 'From August 2024, TSM also has daily PLAN ship and official ship counts. Only 19 transits can be analyzed for ships, against 35 for aircraft, so these views are short on events.',
    set: { ...BASE, view: 'single', ev: '2026-01-16', m: 'plan' } },
  { title: 'U.S. transits against the rest',
    body: 'This view averages the deviations over every analyzable event, split by whether a U.S. ship took part. The bands are 95% bootstrap intervals. Where they overlap heavily, the data do not separate the groups.',
    set: { ...BASE, view: 'agg' } },
  { title: 'Test the result',
    body: 'Switch to percent of baseline and set aside events that overlap another transit or an exercise. If the gap between groups moves a lot, it was fragile. The TSM working paper "Calibrated Coercion" takes up this question with a fuller design.',
    set: { ...BASE, view: 'agg', unit: 'pct', clean: true, dropx: true } },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Step ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
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
