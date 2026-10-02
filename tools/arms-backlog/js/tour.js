// Guided walkthrough: a fixed sequence of views with short explanations.
const ALLC = ['Traditional', 'Asymmetric', 'Munitions'];
const base = { cats: ALLC, status: 'all', sort: 'age', gone: false, view: 'topline' };

export const STEPS = [
  { title: 'US$29.72 billion, sold but not delivered',
    body: 'That is the value of 28 U.S. arms sales to Taiwan that Congress has been notified of and Taiwan has not fully received. Each row below is one case. The bar runs from the notification date to the data date.',
    set: { ...base, sel: 'f16' } },
  { title: 'The oldest cases date to 2017',
    body: 'Sorted by time waiting, the top rows are the June 2017 JSOW glide bombs and Mk 48 torpedoes. Taiwan\'s defense ministry now lists both, along with the F-16s, as delayed.',
    set: { ...base, sel: 'agm154c' } },
  { title: 'One case is a quarter of the total',
    body: 'The 66 F-16 Block 70 fighters, notified in August 2019 at US$8 billion, are the largest line. The first two jets left the U.S. mainland on Aug. 17, 2026, years behind the original schedule. They reached Hawaii, turned back from a Sept. 6 attempt to fly on, and had not reached Taiwan by late September.',
    set: { ...base, sort: 'value', sel: 'f16' } },
  { title: 'Deliveries under way',
    body: 'Orange marks cases where some equipment has arrived. TSM keeps a case\'s full value in the total until the last item is delivered, so the headline overstates what is still owed for these eight cases. In August 2026 the F-16 munitions and AIM-9X cases joined the list.',
    set: { ...base, status: 'delivering', sel: 'hcds' } },
  { title: 'December 2025 reset the clock',
    body: 'Six backlog cases worth US$10.9 billion were notified on December 17, 2025, part of the largest U.S. arms package for Taiwan by value. Taiwan\'s defense ministry issued contracts for the HIMARS, Paladin and anti-armor missile cases in April 2026, with completion dates running to 2032 and 2034.',
    set: { ...base, sort: 'new', sel: 'himars25' } },
  { title: 'The total moves slowly',
    body: 'The monthly total barely moves between new notifications. Cases leave when fully delivered: the Stingers in December 2025, the 2024 ALTIUS drones in March 2026, the Abrams tanks in April 2026. TSM also dropped one case, 30mm ammunition, in January 2025.',
    set: { ...base, gone: true, sel: 'abrams' } },
  { title: 'How the backlog piled up',
    body: 'Stack today\'s open cases by notification date and you can see which years produced what Taiwan is still waiting for: the 2019 F-16 sale, the late-2020 asymmetric package, and the December 2025 package.',
    set: { ...base, view: 'vintage', sel: 'hcds', scroll: 'totalbox' } },
  { title: 'Month by month, since November 2023',
    body: 'The panel at the top redraws every monthly update as a figure and a table: the Cato Institute\'s November 2023 baseline and its 2024 updates, then TSM\'s from January 2025. Step through with the arrows or the ← and → keys. Select a wedge to filter the table, or a case for its status in every update.',
    set: { ...base, sel: 'f16', month: '2023-11', scroll: 'monthview' } },
];

export function createTour(apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Walkthrough');
  document.body.appendChild(card);
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
    card.querySelector('.solid').focus();
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
