// "Learn to play": a hands-on first game on the default setup. Folds in the old walkthrough's content.
import { learnButton, runLesson } from '../../../shared/js/learn.js';

const SLUG = 'penghu-gambit';
const $ = id => document.getElementById(id);
const shown = el => el && el.offsetParent !== null;
const statusEl = () => shown($('status')) ? $('status') : $('status-mini');
const pct = () => { const m = /in (\d+)% of games/.exec(statusEl().textContent); return m ? +m[1] : null; };

// Phones: the lesson card covers the bottom of the screen, so bring each step's target into the upper part.
const lift = el => {
  if (!el || innerWidth > 600 || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  if (r.top < 70 || r.top > innerHeight * 0.4) scrollBy({ top: r.top - Math.max(70, innerHeight * 0.15), behavior: 'instant' });
};
const onPhone = steps => steps.map(s => s.target ? { ...s, start: () => { const v = s.start ? s.start() : null; lift(s.target()); return v; } } : s);

export const SHEET = {
  title: 'Penghu Gambit on one screen',
  goal: 'The PLA wins by getting troops to <b>Magong</b>, Penghu\'s main town, or by starving the garrison into giving up. Taiwan wins (<b>defense holds</b>) if the landing force is destroyed or pinned on the beach, or the garrison still has supplies. Anything else is a <b>stalemate</b>. Set both sides, play one game turn by turn, then read how 1,000 games turn out.',
  controls: [
    ['− / +', 'Buy or sell Taiwan\'s defenses within a 100-point budget.'],
    ['Plan buttons', 'PLA: seize by assault, or blockade and starve.'],
    ['Map sector', 'Click (or Tab and Enter) a coast sector to land there.'],
    ['Next turn / Back', 'Step through one game, 12 hours per assault turn.'],
    ['Turn slider', 'Jump to any turn. Arrow keys move it one turn.'],
    ['Play all turns', 'Animate the whole game. Press again to stop.'],
    ['New dice', 'Replay with a different random seed.'],
    ['Edit the assumptions', 'Change any probability or rate; everything updates.'],
    ['Phone tabs', '1 Setup, 2 Play, 3 1,000 games.'],
  ],
  ideas: [
    'One game is luck. Judge a setup by the 1,000-game result in the status box.',
    'Mines only help where the landing actually comes. Guess the beach wrong and they are wasted points.',
    'Landing lift is the PLA\'s scarcest asset: every group sunk at sea is strength that never reaches the beach.',
    '<b>Key drivers</b> ranks the levers that move the PLA\'s chances most. Start there.',
    'Against a blockade, only stocks and time matter.',
  ],
  terms: [
    ['Strength point', 'About 1,000 troops (notional).'],
    ['Landing group', 'One wave\'s worth of ships carrying about one strength point.'],
    ['Preparatory strikes', 'Turns of missile and air strikes before the landing. They wear down defenses but give warning.'],
    ['Combat results table', 'A board-wargame chart: the strength ratio picks a column, a die picks a row, the cell gives the losses.'],
    ['Monte Carlo', 'Replaying the same setup 1,000 times with different dice to see how often each outcome comes up.'],
    ['Notional', 'An assumption chosen for teaching, not a sourced figure.'],
  ],
};

/** helpers: { reset(), tab(name) } from app.js. */
export function mountLesson(where, { reset, tab }) {
  let before = null;
  const steps = [
    { title: 'Who wins',
      body: 'This is a board-wargame model of a PLA attempt to seize Penghu, the islands in the middle of the Taiwan Strait. The PLA wins by getting troops to <b>Magong</b>, the main town. Taiwan wins if the landing force is destroyed or pinned on the beach. The box says how often the PLA wins across 1,000 replays of this setup.',
      target: statusEl },
    { title: 'Why Penghu',
      body: 'Penghu sits about 50 km off Taiwan\'s coast. Shi Lang took it first in 1683, Japan did the same in 1895, and in three of 24 CSIS wargame runs China captured it as a staging base. Taiwan\'s missiles there can also hit ships bound for Taiwan itself.',
      target: () => $('box') },
    { title: 'Reading the map',
      body: 'Three broad, notional landing sectors ring the main island. The red one is where the PLA lands in this setup (east). Dots around it are Taiwan\'s mines. Magong and its air base are marked; Taiwan\'s missile batteries, air defense and drone teams sit in a notional box, not real positions.',
      target: () => $('box') },
    { title: 'Play the first turn',
      do: 'Press <b>Next turn</b>.',
      target: () => $('next'),
      done: () => +$('scrub').value >= 1 },
    { title: 'Every die is shown',
      body: 'Each row in the log is one event: its <b>chance</b>, the <b>dice</b> rolled (random numbers from 0 to 1) and the result. A roll under the chance means it happens. Turn 1 is preparatory strikes: missiles hunting Taiwan\'s batteries, air defense and drones.',
      target: () => $('log') },
    { title: 'Land and fight',
      do: 'Press <b>Next turn</b> twice more, to turn 3.',
      body: 'Turn 2 is the landing: groups cross under missile fire and through the mines. From turn 3 the troops ashore fight.',
      target: () => $('next'),
      done: () => +$('scrub').value >= 3 },
    { title: 'The combat results table',
      body: 'Each ground fight compares PLA and Taiwan strength. The ratio picks a column, one die picks a row, and the highlighted cell gives each side\'s losses and whether the PLA advances toward Magong. Like most numbers here, the table is a notional assumption you can inspect.',
      target: () => shown($('crt-wrap')) ? $('crt-wrap') : $('readout') },
    { title: 'Guess the beach',
      do: 'Click the <b>West coast</b> sector on the map to land there instead.',
      start: () => { tab('play'); before = pct(); },
      target: () => document.querySelectorAll('#map .pg-sector')[2] || $('box'),
      done: () => document.querySelector('#sector [data-k="W"]')?.getAttribute('aria-pressed') === 'true' && !$('mc').classList.contains('busy') },
    { title: 'Mines only work where the landing comes',
      body: () => { const now = pct(); return `Taiwan mined the east coast; the west has no mines and the airfield is off the route. ${before != null && now != null ? `The PLA\'s chance moved from <b>${before}%</b> to <b>${now}%</b> of games.` : 'Watch the PLA\'s chance in the status box.'} One game is luck; this 1,000-game share is what to judge a setup by.`; },
      target: statusEl },
    { title: 'What moves the odds',
      body: '<b>Key drivers</b> changes one lever at a time, replays the same 1,000 games, and ranks the levers by how much they move the PLA\'s chance, in percentage points (pp). Lift and landing losses usually top the list, echoing CSIS\'s finding that dwindling lift limits an invasion. Now set your own defense in the panel (Setup tab on a phone), or try the PLA\'s other plan: a <b>blockade</b> that starves the garrison. Every number is notional; the shape of the trade-offs is the point.',
      start: () => tab('mc'),
      target: () => document.querySelector('#mc .drv') || $('mc-card') },
  ];
  const start = () => {
    reset();
    scrollTo({ top: 0 });
    runLesson(onPhone(steps), { slug: SLUG, title: 'Learn to play', onExit: () => banner.refresh() });
  };
  const banner = learnButton(where, { slug: SLUG, minutes: 5, onStart: start, sheet: SHEET });
  return { start };
}
