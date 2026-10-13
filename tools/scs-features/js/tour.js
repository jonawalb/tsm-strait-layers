// Guided walkthrough for the South China Sea map.
export const STEPS = [
  { title: 'Five occupants, one sea',
    body: 'Each marker is a feature that China, Vietnam, the Philippines, Malaysia or Taiwan occupies or controls, as tracked by CSIS\'s Asia Maritime Transparency Initiative. Diamonds are China\'s large artificial islands. Use the buttons in the panel to show one claimant at a time.',
    set: { view: 'sea' } },
  { title: 'The Spratlys are the crowded part',
    body: 'Vietnam holds the most Spratly features, many of them small. China holds seven, but they are the largest: between 2013 and 2015 it built them up into artificial islands, three of them with 3,000-meter-class runways.',
    set: { view: 'spratly' } },
  { title: 'Island-building in numbers',
    body: 'The Pentagon reported that China added more than 3,200 acres of land to its seven Spratly features before pausing in late 2015. AMTI puts Mischief Reef alone at about 1,379 acres. The timeline under the map walks through the campaign.',
    set: { feature: 'mischief-reef', tl: 'build' } },
  { title: 'Rings are not rights',
    body: 'Each ring is 12 nautical miles around a feature. The 2016 tribunal found several of these features, including Mischief Reef, Subi Reef and Second Thomas Shoal, to be submerged at high tide. Such features generate no territorial sea of their own, so their rings turn grey when you apply the award.',
    set: { view: 'spratly', state: { ts12: true, award: true } } },
  { title: 'Whose 200 nautical miles?',
    body: 'Measured from mainland and major-island coasts, the approximate 200 nm zones of Vietnam, the Philippines, Malaysia and Brunei cover most of the Spratlys. The tribunal found that no Spratly feature can generate a 200 nm zone of its own.',
    set: { view: 'sea', state: { eez: true } } },
  { title: 'Second Thomas Shoal',
    body: 'The Philippines took possession of Second Thomas Shoal in 1999 and keeps a contingent of marines on the BRP Sierra Madre, a navy transport ship it grounded on the reef. Resupplying them has produced the sharpest clashes of recent years. The timeline tab lists them, with the vessels named in reporting.',
    set: { feature: 'second-thomas-shoal', tl: 'thomas', view: 'thomas' } },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour'; card.hidden = true;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Guided walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Walkthrough ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.title}</h3><p>${s.body}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const n = i + Number(b.dataset.d); if (n >= STEPS.length) stop(); else { i = n; show(); } });
    card.querySelector('.solid').focus();
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
