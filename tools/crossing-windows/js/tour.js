// Guided walkthrough: a fixed sequence of settings with short explanations.
export const STEPS = [
  { title: 'Thirty years, one row each',
    body: 'Each row of the top grid is a year from 1996 to 2025; each column is a week. Darker cells mean more days that week opened a three-day window with waves at or below sea state 3 (1.25 m) and wind at or below 21 knots.',
    set: { wk: 14 }, scroll: 'heatmap' },
  { title: 'The claimed windows',
    body: 'Ian Easton\'s The Chinese Invasion Threat is cited for rating April and October the best months to cross. The brackets and shaded bands mark them. In this record, late spring into summer scores higher than either.',
    set: { wk: 14 }, scroll: 'weekchart' },
  { title: 'Why October falls short',
    body: 'Open a mid-October week. At the center point the median daily maximum wind rises from 17 kt in September to 26 kt in October and median wave height nearly doubles, so most days fail the wave test. Wind fails too. Fog and typhoons play a small part.',
    set: { wk: 40 }, scroll: 'drill' },
  { title: 'Summer: calm seas, typhoon risk',
    body: 'June to August has the calmest wind and waves of the year. But in early August, in roughly a third of years a tropical storm passed within 500 km of the Strait center that week. The red line on the week chart tracks that exposure.',
    set: { wk: 31 }, scroll: 'weekchart' },
  { title: 'Tighten the limit',
    body: 'Set waves to sea state 2 (0.5 m), the state in which the U.S. Navy rates its LCAC hovercraft. Only about 2 percent of days in thirty years open a three-day window at this open-water point.',
    set: { h: 0.5, w: 16, wk: 22 }, scroll: 'heatmap' },
  { title: 'Loosen it',
    body: 'At sea state 4 (2.5 m) and 27 knots, April and the summer open up and October partly recovers. The answer to "when" depends heavily on what the landing craft can take.',
    set: { h: 2.5, w: 27, wk: 40 }, scroll: 'monthchart' },
  { title: 'Spring fog',
    body: 'Fog reports at Xiamen peak from February to April. The fog test removes spring days that the wind and wave tests would pass. Switch stations or turn fog off in the panel.',
    set: { wk: 12, st: 'xiamen' }, scroll: 'drill' },
  { title: 'Moon, darkness and tide',
    body: 'For the chosen week and year, the bottom chart shows predicted tide at a public port, night shading and the moon. At Taichung Port and Kinmen the modelled spring range tops 4 m, so the hour of a crossing matters as much as the week.',
    set: { wk: 14, yr: 2027, port: 'taichung' }, scroll: 'dr-tide' },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Walkthrough');
  root.appendChild(card);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = () => {
    const st = STEPS[i];
    apply(st.set);
    document.getElementById(st.scroll)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    card.innerHTML = `<div class="tour-h"><span>Step ${i + 1} of ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${st.title}</h3><p>${st.body}</p>
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
