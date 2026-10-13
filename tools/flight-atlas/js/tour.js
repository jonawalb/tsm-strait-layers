// Guided walkthrough: a fixed sequence of atlas states with short explanations.
export const STEPS = [
  { title: 'Where PLA aircraft enter',
    body: 'Each shaded region is one of the ADIZ sectors that Taiwan\'s Ministry of National Defense names in its daily report. Darker means more days in the selected window on which MND said aircraft entered that sector. The regions are TSM\'s approximate drawing, not official lines.',
    set: { preset: 'year', sec: null, day: null, jcrpOnly: false, metric: 'days' } },
  { title: 'The southwest was the whole story',
    body: 'From late 2020 to mid-2022, MND published a report only when aircraft entered the southwestern ADIZ. The shaded band on the timeline marks that era. Drag the window into it and every other sector goes blank.',
    set: { range: ['2021-01-01', '2021-12-31'], sec: 'SW', day: null, jcrpOnly: false, metric: 'days' } },
  { title: 'The daily report names every sector',
    body: 'From August to November 2022 MND listed aircraft around Taiwan but named no sectors (the darker band). From mid-November 2022 the daily report names each sector entered. In its first year the southwest still dominates; by 2024 northern entries are routine.',
    set: { range: ['2024-01-01', '2024-12-31'], sec: 'N', day: null, jcrpOnly: false, metric: 'days' } },
  { title: 'Joint combat readiness patrols',
    body: 'Orange ticks above the timeline are JCRP days, as flagged in TSM\'s daily data from MND press releases. Switch on "JCRP days only" to see which sectors the patrols reach. Since late 2022, MND named the eastern ADIZ on about 42% of patrol days with entries, against about 23% of other entry days.',
    set: { range: ['2022-11-15', 'end'], sec: 'E', day: null, jcrpOnly: true, metric: 'share' } },
  { title: 'Read the source',
    body: 'Click any bar on the timeline, or any day in the list, to open that day\'s MND report text. Every day links to the report page on MND\'s site, where MND posts its flight-path map. This atlas reads the text only.',
    set: { preset: 'year', sec: null, day: 'latest', jcrpOnly: false, metric: 'days' } },
  { title: 'Month by month',
    body: 'The tables under the map count, for each month and year, the days with a reported entry into each sector. Click a month or a year to move the window there, or press Play to step through time.',
    set: { preset: 'all', sec: null, day: null, jcrpOnly: false, metric: 'days', scroll: '#months-h' } },
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
