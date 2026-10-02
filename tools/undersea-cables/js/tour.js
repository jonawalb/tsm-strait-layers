// Guided walkthrough: fixed scenario states with short explanations.
export const STEPS = [
  { title: 'Taiwan\'s links to the world',
    body: 'Each colored line is a submarine cable that TeleGeography lists as landing in Taiwan. Blue cables run to other countries; red ones land only in mainland China; green ones link Taiwan to its own outlying islands. Grey lines are regional systems that pass by without landing.',
    set: { preset: 'none', view: 'region', year: 2026 } },
  { title: 'A few towns carry most of the traffic',
    body: 'International cables come ashore at a handful of towns: Toucheng and Wujie on the Yilan coast, Tanshui and Pa Li north of Taipei, and Fangshan and Dawu in the south. Hover a landing point to see which cables use it.',
    set: { preset: 'none', view: 'taiwan' } },
  { title: 'Cut the north coast',
    body: 'Cutting the cables at Tanshui and Pa Li removes several systems at once, but the main island stays connected through the east and south coasts. The panel counts what is left. The model has no capacity data, so "left" means cables, not bandwidth.',
    set: { preset: 'north', view: 'taiwan' } },
  { title: 'The outlying islands are thin',
    body: 'Penghu, Kinmen and the Matsu islands hang off the main island by a few domestic cables each. The "Cuts to isolate" column shows how many more cuts would cut an island off.',
    set: { preset: 'none', view: 'outer' } },
  { title: 'February 2023: Matsu goes dark',
    body: 'A Chinese fishing boat damaged the Taiwan–Matsu No. 2 cable on February 2, 2023, and a Chinese cargo ship damaged No. 3 on February 8. In this replay the network is set to 2023, before Taiwan–Matsu No. 4 entered service, and every Matsu island loses its cable link. In reality Chunghwa Telecom fell back on a microwave radio link, which this model leaves out.',
    set: { preset: 'r2023', view: 'matsu' } },
  { title: 'Early 2025: two more incidents',
    body: 'On January 3, 2025 the Trans-Pacific Express cable was damaged near Keelung; Taiwan\'s coast guard linked it to the freighter Shunxing-39. On February 25 the Taiwan–Penghu No. 3 cable was cut, and the captain of the Hong Tai 58 was later sentenced to three years. In the model neither cut isolates an island, because other cables remain. The incident cards below the map carry the reporting.',
    set: { preset: 'r2025', view: 'taiwan' } },
  { title: 'Links that only reach China',
    body: 'Kinmen has a 21 km cable, CSCN, to the mainland coast opposite. Cut Kinmen\'s domestic links and it can still reach the internet, but only through mainland China. The option "Count links that land only in mainland China" decides whether the model treats that as connected.',
    set: { preset: 'kinmen', view: 'outer' } },
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
