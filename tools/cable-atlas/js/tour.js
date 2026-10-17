// Guided walkthrough: six fixed states with short explanations.
const STEPS = [
  { title: 'The cables under the First Island Chain',
    body: 'Every colored line is a submarine cable that TeleGeography lists as landing in Taiwan (blue), Japan\'s Nansei islands (magenta) or the Philippines (gold). Thinner lines link islands within one country (teal for Taiwan\'s outlying islands); red marks the two Taiwan cables that land only in mainland China. Diamonds are recorded incidents; squares are home ports of cable-repair ships.',
    set: { scen: 'none', view: 'fic', region: 'taiwan' } },
  { title: 'Many cables, few beaches',
    body: 'Taiwan\'s international systems come ashore at a handful of towns: Toucheng on the Yilan coast, Tanshui and Pa Li north of Taipei, Fangshan in the south, plus Dawu (TPU, 2026) and the Kinmen links to Xiamen. Circle size shows how many international systems land at each town.',
    set: { scen: 'none', view: 'taiwan', region: 'taiwan' } },
  { title: 'Remove the three landing areas',
    body: 'This is the node-removal test from the Landing Stations paper: take out Toucheng, New Taipei and Fangshan together. The panel counts what still lands, and how much published design capacity those systems carry. What remains is TPU at Dawu and CSCN, the short Kinmen link that reaches only mainland China.',
    set: { scen: 'tw-three', view: 'taiwan', region: 'taiwan' } },
  { title: 'The outlying islands hang by a few threads',
    body: 'Penghu, Kinmen and the Matsu islands reach the outside world through Taiwan over a few domestic cables. The Routes column counts how many more cuts would isolate each island by cable. Microwave and satellite backups exist for Matsu and are not in this cable-only model.',
    set: { scen: 'tw-domestic', view: 'outer', region: 'taiwan' } },
  { title: 'One strait, many systems',
    body: 'Taiwan\'s routes south to Hong Kong and Southeast Asia, and several Philippine systems, share the Luzon Strait; the trans-Pacific systems leave Taiwan eastward instead. Cutting every system whose drawn route crosses the strait shows how much connectivity shares that one corridor. The routes are schematic, so treat this as an upper bound on exposure.',
    set: { scen: 'luzon', view: 'fic', region: 'taiwan' } },
  { title: 'The record, and how long repairs take',
    body: 'Below the map, the incident log lists each cut or damage event in the atlas, with the official statements and reporting it rests on. Further down, Repair capacity shows how long past repairs took and how far the nearest cable ships sit. Open any site, cable or incident for its dossier.',
    set: { scen: 'none', view: 'taiwan', region: 'taiwan' } },
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
