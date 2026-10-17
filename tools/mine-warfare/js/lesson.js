// "Learn to play": a hands-on first game on the barrier field. Folds in the old walkthrough's content.
import { learnButton, runLesson } from '../../../shared/js/learn.js';

const SLUG = 'mine-warfare';
const $ = id => document.getElementById(id);
const shown = el => el && el.offsetParent !== null;
const statusEl = () => shown($('status')) ? $('status') : $('status-mini');

// Phones: the lesson card covers the bottom of the screen, so bring each step's target into the upper part.
const lift = el => {
  if (!el || innerWidth > 600 || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  if (r.top < 70 || r.top > innerHeight * 0.4) scrollBy({ top: r.top - Math.max(70, innerHeight * 0.15), behavior: 'instant' });
};
const onPhone = steps => steps.map(s => s.target ? { ...s, start: () => { const v = s.start ? s.start() : null; lift(s.target()); return v; } } : s);

export const SHEET = {
  title: 'Mine Warfare Simulator on one screen',
  goal: 'Two sides, one stretch of sea. <b>Taiwan</b> lays mines off a generic landing beach to make a landing slow and costly. The <b>PLA</b> clears them with a mine countermeasures (MCM) force, then sends 48 landing craft to the beach. The status box shows how much of the search is done in the time available and how many craft a landing would lose.',
  controls: [
    ['Click or drag the grid', 'Paint mine groups with the chosen tool (moored, bottom, or erase).'],
    ['Arrow keys + Space', 'With the grid focused: move the cursor, place or remove a group.'],
    ['Patterns', 'Lay a ready-made field: barrier, beach belt, scattered, mixed types.'],
    ['Minelayers, sorties', 'Set how many mines Taiwan can lay before the landing (its warning time).'],
    ['PLA sliders', 'MCM vessels, helicopters, underwater drones, and hours before the landing.'],
    ['Clear lanes / area', 'Search narrow routes to the beach, or every cell.'],
    ['Coastal fires', 'Taiwan\'s missiles and guns hit the MCM force while it works.'],
    ['Run clearance and assault', 'Animate the search, then the landing. The hour slider replays the search.'],
  ],
  ideas: [
    'Mines buy time. The PLA must search every cell it will use, and most of that is empty water.',
    'Lanes are faster to clear than the whole area, but they funnel the landing into a few kilometres of front.',
    'Mixed mine types cost more search effort, and helicopters are weak against bottom mines.',
    'Mines channel; fires destroy. Covering the field with coastal fires shrinks the MCM force every hour.',
    'Warning time decides the field: more minelayers and sorties mean a far denser field.',
  ],
  terms: [
    ['MCM', 'Mine countermeasures: finding and destroying sea mines.'],
    ['Moored contact mine', 'Floats on a cable and explodes when a hull touches it.'],
    ['Bottom influence mine', 'Sits on the seabed and fires on a ship\'s magnetic or acoustic signature.'],
    ['Q-route', 'A narrow lane cleared through a minefield.'],
    ['Sortie', 'One trip out to lay mines and back.'],
    ['UUV', 'Uncrewed underwater vehicle: an underwater drone with sonar.'],
    ['Notional', 'An assumption chosen for teaching, not a sourced figure.'],
  ],
};

/** helpers: { S, reset() } from app.js. */
export function mountLesson(where, { S, reset }) {
  const bottoms = () => S.mines.reduce((a, m) => a + (m === 2), 0);
  let b0 = 0, ran = false;
  const steps = [
    { title: 'Two sides, one question',
      body: 'As <b>Taiwan</b> you lay mines; as the <b>PLA</b> you clear them and then land 48 landing craft. Taiwan wants the landing slow and costly; the PLA wants it fast and cheap. This box tracks both: how much of the PLA\'s search is done in the hours it has, and how many craft a landing would lose.',
      target: statusEl },
    { title: 'Reading the grid',
      body: 'A generic 12 by 7 km stretch of sea, not a real place. PLA ships wait at the top; the beach is at the bottom. Each marked cell holds a group of eight mines. Four minelayers making two trips (<b>sorties</b>) laid this barrier. Shaded cells are what the PLA has searched in 48 hours.',
      target: () => $('box') },
    { title: 'Your move as Taiwan',
      body: '<b>Moored contact</b> mines float on a cable; <b>bottom influence</b> mines sit on the seabed and fire on a ship\'s magnetic or acoustic signature. Bottom mines are harder for helicopters to sweep.',
      do: 'Pick <b>Bottom influence</b> in the panel, then click three mine cells on the grid to swap them.',
      start: () => { b0 = bottoms(); },
      target: () => S.tool === 2 ? $('box') : document.querySelector('#tool [data-v="2"]'),
      done: () => bottoms() >= b0 + 3 },
    { title: 'Most of the search is empty water',
      body: 'The PLA does not know where the mines are, so it must search every cell it plans to use. Here it is searching the whole area. Check <b>Empty water searched</b>: most of its effort finds nothing. The threat of mines costs time even where there are none.',
      target: () => $('readout') },
    { title: 'Your move as the PLA',
      do: 'Under <b>2 · The PLA clears it</b>, press <b>Clear lanes</b>.',
      body: 'Real clearance operations cut narrow lanes, called Q-routes, to the beach instead of searching everything.',
      target: () => document.querySelector('#strat [data-k="lanes"]'),
      done: () => S.strat === 'lanes' },
    { title: 'Lanes are faster, but they funnel',
      body: 'The search now finishes in a fraction of the time. The price is in the last row: every landing craft has to use a few kilometres of front, exactly where a defender would aim coastal missiles, artillery and drones.',
      target: () => $('compare') },
    { title: 'Send the landing',
      do: 'Press <b>Run clearance and assault</b> and watch it to the end.',
      start: () => { ran = false; $('run').addEventListener('click', () => { ran = true; }, { once: true }); },
      target: () => $('run'),
      done: () => ran && $('run').textContent !== 'Stop' && /assault landed/.test($('hour-t').textContent) },
    { title: 'Mines channel; fires destroy',
      body: 'The animation shows one random draw; the panel\'s numbers are the averages to trust. MCM ships are slow and work in predictable patterns. If Taiwan\'s coastal fires cover the field, the MCM force shrinks every hour it works.',
      do: 'Switch on <b>Taiwan\'s coastal fires cover the field</b>.',
      target: () => $('fires').closest('label'),
      done: () => S.fires },
    { title: 'Read the cost of clearing under fire',
      body: 'The readout now lists the MCM units lost by the landing hour, and the search slows as the force shrinks.',
      target: () => $('readout') },
    { title: 'Warning time decides the field',
      body: 'The biggest variable sits outside the grid: how early Taiwan decides to lay. Ten minelayers making three sorties lay a far denser field than four making one, but that takes days of warning and a political decision to mine before shots are fired. Try the minelayer and sortie controls next. Every number is notional; the shape of the trade is the point.',
      target: () => $('ships') },
  ];
  const start = () => {
    reset();
    scrollTo({ top: 0 });
    runLesson(onPhone(steps), { slug: SLUG, title: 'Learn to play', onExit: () => banner.refresh() });
  };
  const banner = learnButton(where, { slug: SLUG, minutes: 5, onStart: start, sheet: SHEET });
  return { start };
}
