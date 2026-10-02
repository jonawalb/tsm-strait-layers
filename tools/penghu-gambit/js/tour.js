// Guided walkthrough: a fixed sequence of setups with short explanations.
const ROC = { ashm: 2, shorad: 2, marines: 1, reserves: 2, stocks: 1, drones: 1, mines: { N: false, E: true, W: false }, demo: true, harden: false };
const PLA = { plan: 'assault', strikes: 1, sector: 'E', lift: 4, vertical: 'heli', offload: false };
const set = (roc = {}, pla = {}, extra = {}) => ({ roc: { ...ROC, ...roc, mines: { ...ROC.mines, ...(roc.mines || {}) } }, pla: { ...PLA, ...pla }, turns: 8, view: 0, ...extra });

export const STEPS = [
  { title: 'Why Penghu',
    body: 'Penghu sits in the middle of the Strait, about 50 km from Taiwan\'s coast. Shi Lang took it first in 1683, Japan did the same in 1895, and in three of 24 CSIS wargame runs China captured it as a staging base. Taiwan\'s missiles there can also hit ships bound for Taiwan itself. This game asks what it would take to seize.',
    set: set() },
  { title: 'Play one game',
    body: 'Press Next turn to step through a game in 12-hour turns. Every row in the log shows the chance of an event, the dice and the result, so you can see why things happened. Here the PLA spends one turn striking, then lands on the east coast, which Taiwan has mined.',
    set: set({}, {}, { view: 2 }) },
  { title: 'The combat results table',
    body: 'Once troops are ashore, each turn the ratio of PLA to ROC strength picks a column and one die picks a row. The highlighted cell is this turn\'s result. The table, like most numbers here, is a notional assumption you can inspect and change.',
    set: set({}, {}, { view: 3 }) },
  { title: 'A thousand games',
    body: 'One game is one roll of the dice. The Monte Carlo card replays the same setup 1,000 times with seeded dice and shows how often the PLA holds Magong, the defense holds, or the fight stalls. With this setup the PLA rarely takes Magong inside four days.',
    set: set() },
  { title: 'Guess the beach wrong',
    body: 'Now Taiwan has mined the east coast and the PLA lands in the west instead. No mines, and the airfield is off the route. The PLA\'s chances rise sharply. Mines only matter where the landing comes.',
    set: set({}, { sector: 'W' }) },
  { title: 'More lift changes the math',
    body: 'Give the PLA six landing groups per wave and two strike turns, and it takes Magong in more than half the games. The biggest driver is now the offload rate, with strike turns and lift close behind, echoing CSIS\'s finding that dwindling lift limits an invasion. An extra strike turn lowers the PLA\'s odds here because it uses up a turn of a fixed four-day window.',
    set: set({}, { sector: 'W', lift: 6, strikes: 2 }) },
  { title: 'Or starve it',
    body: 'A blockade skips the landing. Turns become five days, and the garrison lives on its stocks plus whatever slips through. Buy more stocks and watch the outcome move. Every number is notional; the shape of the trade is the point.',
    set: set({ stocks: 3 }, { plan: 'blockade' }) },
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
