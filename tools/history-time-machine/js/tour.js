// Guided tour: seven stops, each sets the year, filters and (optionally) the comparison year.
export const STEPS = [
  { title: '1895: Taiwan becomes a Japanese colony',
    body: 'The Qing Empire loses the First Sino-Japanese War and cedes Taiwan and Penghu to Japan in the Treaty of Shimonoseki. The mainland stays under the Qing until 1912.',
    set: { a: 1895, e: 'shimonoseki', b: null } },
  { title: '1943–1945: the Allies decide, Japan surrenders',
    body: 'The Cairo Communiqué says Formosa and the Pescadores are to be restored to the Republic of China. After Japan\'s surrender in 1945, ROC officials take over Taiwan and Penghu.',
    set: { a: 1945, e: 'retrocession', b: null } },
  { title: '1949: two governments across the Strait',
    body: 'Compare 1948 with 1949. The PRC takes the mainland, and the ROC government retreats to Taiwan while keeping Kinmen, Matsu and the Dachen Islands just off the mainland coast.',
    set: { a: 1949, b: 1948, e: 'prc-1949' } },
  { title: '1955: the Dachens are given up',
    body: 'In the first Strait crisis the PRC shells the offshore islands. Washington signs a defense treaty that covers only Taiwan and Penghu, and helps evacuate the Dachens. Kinmen and Matsu stay with the ROC to this day.',
    set: { a: 1955, b: 1954, e: 'dachen' } },
  { title: '1971–1979: recognition moves to Beijing',
    body: 'The filters now show U.S. policy and status events. Resolution 2758 gives China\'s UN seat to the PRC, the Shanghai Communiqué "acknowledges" the Chinese position, and in 1979 Washington recognizes Beijing while Congress passes the Taiwan Relations Act. Compare 1970 with 1979 and watch the bands flip.',
    set: { a: 1979, b: 1970, e: 'normalization', f: ['us', 'status'] } },
  { title: '1987–1996: democratization under pressure',
    body: 'Martial law ends in 1987. Taiwan\'s first direct presidential election in 1996 comes with PLA missile tests nearby and two U.S. carrier groups sent to the area.',
    set: { a: 1996, e: 'election-1996', b: null, f: ['dom', 'mil', 'us'] } },
  { title: '2022–2025: exercises around Taiwan',
    body: 'The filter now shows cross-Strait military events. Since the Pelosi visit in August 2022, several large named PLA exercises around Taiwan have followed political events in Taipei and Washington. The map has not changed since 1955; the pressure has moved to the sea and air around it.',
    set: { a: 2025, e: 'jm-2025', b: null, f: ['mil'] } },
];

export function createTour(slot, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided tour');
  slot.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Tour ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close tour">×</button></div>
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
  return { start, stop, goto: n => { i = n; card.hidden = false; show(); } };
}
