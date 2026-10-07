// Guided walkthrough through the deck.
const ALL = ['PRC', 'ROC', 'JPN', 'PHL', 'USA'];

export const STEPS = [
  { title: 'One command faces Taiwan',
    body: 'The PLA\'s Eastern Theater Command in Nanjing is, in the DoD\'s words, the command responsible for operations against Taiwan. Units in its area include three group armies, a fleet, an air force and a Rocket Force base, whose missiles would be allocated to it at the Central Military Commission\'s direction.',
    set: { countries: ['PRC'], sel: 'etc', flip: ['etc'] } },
  { title: 'Two group armies hold the amphibious brigades',
    body: 'The 72nd (Huzhou) and 73rd (Xiamen) Group Armies each have two amphibious combined arms brigades and long-range rocket launchers. The 71st, farther north, has none.',
    set: { countries: ['PRC'], sel: 'ga73', flip: ['ga72', 'ga73'] } },
  { title: 'Missiles aimed at the island',
    body: 'Rocket Force Base 61, headquartered in Huangshan, is made up mostly of short-range ballistic missile brigades that researchers assess are aimed at Taiwan.',
    set: { countries: ['PRC'], sel: 'base61', flip: ['base61'] } },
  { title: 'Japan\'s southwestern chain',
    body: 'Since 2016 Japan has opened garrisons on Yonaguni, Amami, Miyako and Ishigaki, several with anti-ship and air defense missiles. The 15th Brigade and the Southwestern Air Defense Force are headquartered in Naha.',
    set: { countries: ['JPN'], sel: 'yonaguni', flip: ['yonaguni'] } },
  { title: 'The Luzon Strait',
    body: 'South of Taiwan, the Philippines has added outposts in Batanes, and U.S. Marines have brought NMESIS anti-ship launchers there during Balikatan exercises.',
    set: { countries: ['PHL', 'USA'], sel: 'batanes', flip: ['batanes'] } },
  { title: 'Compare two cards',
    body: 'Compare mode sets two formations side by side and measures the distance between their headquarters cities. Here: the 73rd Group Army and Taiwan\'s Kinmen Defense Command.',
    set: { mode: 'compare', countries: ALL, sel: 'kinmen', cmp: ['ga73', 'kinmen'] } },
  { title: 'Test yourself',
    body: 'Quiz mode asks where units are headquartered and which unit sits in a highlighted city. Turn countries on or off to change the question pool.',
    set: { mode: 'quiz', countries: ALL, sel: 'etc' } },
];

export function createTour(apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Walkthrough');
  document.body.appendChild(card);
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
    card.querySelector('.solid').focus({ preventScroll: true });
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
