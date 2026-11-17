// Guided walkthrough for Narrative Diffusion.
const STEPS = [
  { title: 'One talking point, many mouths',
    body: 'Beijing\'s campaign against Japanese Prime Minister Takaichi\'s Taiwan remarks. Each row is a source; each dot is a record that uses the talking point. Grey behind a row means TSM collected from that source that month; blank means it did not.',
    set: { preset: 'takaichi', text: '', range: 'fit' } },
  { title: 'The relay',
    body: 'The chain below the timeline puts sources in the order the talking point first reached them in TSM\'s data, with the gap in days between each. Red nodes are official agencies, blue are state media. Each node\'s date opens its first record.',
    set: { preset: 'takaichi', text: '', range: 'fit' } },
  { title: 'An exercise spreads in a day',
    body: 'Justice Mission-2025 reached PLA Daily, China Taiwan Network, People\'s Daily and Xinhua within days of 29 December 2025. TSM\'s Defense Ministry data misses the spokesperson\'s answer on the drill; it shows up here only as a China Taiwan Network headline, a live example of the one-channel gap before May 2026.',
    set: { preset: 'justice', text: '', range: 'fit' } },
  { title: 'Beware of first appearances',
    body: 'The Foreign Ministry cited Resolution 2758 from 2022, but TSM\'s state-media collection starts in 2025. An asterisk on a date means TSM had no collection from that source in that month or the month before, so the true first use may be earlier.',
    set: { preset: 'res2758', text: '', range: 'all' } },
  { title: 'Search your own phrase',
    body: 'Type any phrase in English or Chinese. Custom searches run over titles and short text windows around Taiwan-related sentences, so treat the result as a floor, not a full count.',
    set: { preset: null, text: '麻烦制造者', range: 'fit' } },
  { title: 'Mind the coverage',
    body: 'The coverage bars show how many months in the window TSM holds anything from each source, and how many with article text rather than headlines only. A source with no dots may simply be one TSM did not collect.',
    set: { preset: 'cheng', text: '', range: 'recent' } },
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
    card.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { const n = i + Number(b.dataset.d); if (n >= STEPS.length) stop(); else { i = n; show(); } }; });
    card.querySelector('.solid').focus();
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
