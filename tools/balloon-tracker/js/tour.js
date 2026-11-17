// Guided walkthrough for the Balloon Tracker.
export const STEPS = [
  { title: 'What MND reports',
    body: 'Taiwan\'s Ministry of National Defense adds a balloon section to its daily report when it detects a PRC balloon. In December 2023, early January 2024 and December 2024 it also gave the time, altitude and position of each one, as a distance and bearing from a Taiwanese city.',
    set: { season: 'best', day: null } },
  { title: 'Positions are computed',
    body: 'Each dot is placed by TSM from MND\'s wording, for example "101 nautical miles southwest of Keelung". The dashed line runs from the city to the dot. MND rounds distances and uses 8-point bearings, so every dot is approximate.',
    set: { season: 'best', day: 'first', sel: 'first' } },
  { title: 'They drift east',
    body: 'Every heading MND states is east or northeast. Many are first detected over the northern Strait, west or northwest of Keelung, and MND reports each one disappearing within a few hours.',
    set: { season: 'best', day: 'first' } },
  { title: 'Gaps and counts only',
    body: 'From mid-January to April 2024 the English reports carry no balloon section; TSM\'s sheet has counts for those days (hollow bars). From February 2025 MND gives only a count. None of these days has a dot on the map. The map does not guess.',
    set: { season: null, day: null } },
  { title: 'A winter phenomenon',
    body: 'The month chart adds up balloons by calendar month for each season, from MND text and TSM\'s sheet. Reports cluster from December to March and all but vanish in summer. Click a season\'s bar to filter the page to that winter.',
    set: { season: null, day: null, scroll: '#seas-h' } },
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
