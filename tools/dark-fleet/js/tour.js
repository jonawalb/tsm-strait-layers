// Guided walkthrough of the live window and the archive.
import { RANGE } from './live.js';

export const STEPS = [
  { title: 'What the receivers heard',
    body: `Each dot is a ship with a Chinese (PRC-flag) MMSI, heard by shore-based AIS receivers between ${RANGE[0]} and ${RANGE[1]}. Trails show the last hours of movement. Around Taiwan only a handful are heard at any moment, and nearly all are merchant or fishing traffic with no force attribution.`,
    set: { mode: 'live', ext: 'taiwan', t: 7920, trail: 12, allGaps: false, gapH: 12 } },
  { title: 'One number, several ships',
    body: 'MMSI 412000000 is a placeholder that many ships broadcast at once, including a China Coast Guard cutter in a documented 2023 case. Here it jumps between Hong Kong and Keelung within an hour. The viewer breaks the track at each jump instead of drawing an impossible voyage.',
    set: { mode: 'live', ext: 'region', t: 8940, trail: 48, sel: '412000000' } },
  { title: 'Going dark',
    body: 'A ring marks where a ship went dark, labelled with how long it stayed silent, and a square marks where it reappeared. The faint dotted line between them is not a route: it is drawn beneath land, and dropped when a straight line would cross land, with the distance given in the label. A ship that reappears hundreds of kilometers away most likely sailed out of receiver range; one that reappears in place may have switched its transponder off.',
    set: { mode: 'live', ext: 'taiwan', t: 9000, trail: 12, gapH: 12, allGaps: true } },
  { title: 'Loitering and close approaches',
    body: 'Orange rings mark ships that stayed slow inside a small circle for many hours. Diamonds are moments when two PRC-flag ships were close together, as flagged by TSM’s database. Both patterns also describe ships waiting at anchor, so read them as leads to check, not findings.',
    set: { mode: 'live', ext: 'taiwan', t: 10000, trail: 12, allGaps: false, coloc: true } },
  { title: 'Coverage decides what you see',
    body: 'Zoom out and most heard traffic sits near Hong Kong and the Pearl River Delta, where receivers are dense. Mid-Strait, east of Taiwan and the Spratlys are thinly covered by shore stations. Absence of AIS is not absence of the ship, and PLA Navy ships rarely broadcast at all.',
    set: { mode: 'live', ext: 'region', t: 10000, trail: 24, allGaps: false } },
  { title: 'The longer record',
    body: 'The archive switches to Global Fishing Watch events for vessels on TSM’s sourced watchlist, back to January 2024. Each square counts vessel-days in a month. Militia vessel-days cluster in the Spratlys and at Scarborough Shoal, and at home ports, mostly on Hainan.',
    set: { mode: 'archive', ext: 'region', month: 32, span: 12, forces: { CCG: true, PAFMM: true } } },
  { title: 'Near Taiwan',
    body: 'Around Taiwan the archive holds far fewer watchlist vessel-days than in the South China Sea. Click any square to list the vessels behind it, with the source for each MMSI pairing. Drag the monthly chart to move through time.',
    set: { mode: 'archive', ext: 'taiwan', month: 32, span: 12, forces: { CCG: true, PAFMM: true } } },
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
