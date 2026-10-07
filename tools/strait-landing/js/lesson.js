// "Learn to play": a hands-on first landing on a fixed week (seed 58, April, central coast). Folds in the old walkthrough.
import { learnButton, runLesson, showSheet } from '../../../shared/js/learn.js';

const SLUG = 'strait-landing';
const $ = s => document.querySelector(s);
// Seed 58 in April: 2.3 m (moderate) seas on the first day, calm two days later. Going at once fails on this week;
// waiting for calm wins it with the default orders, so the lesson can show why the weather matters.
const LESSON = { seed: 58, month: 3 };

export const SHEET = {
  title: 'Strait Landing on one screen',
  goal: '<b>As the PLA planner</b>, you win if, when D+3 ends, you hold a <b>lodgment</b> (a foothold ashore) of at least 15 points (about 15,000 troops) that outnumbers Taiwan\'s defenders there 1.5 to 1, and you either hold a port or have 30 points ashore. <b>As Taiwan\'s commander</b>, you win if the landing is defeated: fewer than 3 points ashore, or outnumbered 2 to 1 at its largest lodgment. Anything in between is <b>contested</b>. Eight 12-hour turns, from D-day (the landing day) to D+3.',
  controls: [
    ['Your side', 'PLA planner (attack) or Taiwan commander (defend).'],
    ['Month', 'Picks a real week of weather from that month (ERA5 records, 1996–2025).'],
    ['Map zone / zone buttons', 'PLA: main landing zone. A second zone splits your ships.'],
    ['D-day', 'Go now, wait 1–3 days, or wait for the first calm day.'],
    ['Launch / Take command', 'Starts the eight turns.'],
    ['Sliders', 'PLA: how many amphibious ship groups and ferry groups sail this turn.'],
    ['Strikes', 'PLA: hunt missile launchers, clear mines, or cut the roads Taiwan\'s reserves use.'],
    ['Assault port', 'PLA: try to take the zone\'s port (needs 3 to 1).'],
    ['Fire / Reserves / Counterattack', 'Taiwan: how many missile batteries fire, where reserve groups go, whether to attack the beachhead.'],
    ['Resolve turn, or N', 'Plays the turn. The log shows every number.'],
  ],
  ideas: [
    'Waves decide the first day. Amphibious ships unload at full rate only in slight seas (up to 1.25 m) and at a quarter rate in moderate seas. On most weeks, waiting for calm beats going at once.',
    'A landing is a race: put troops ashore faster than Taiwan\'s reserves reach the beach and its missiles sink the ships waiting offshore.',
    'Ports multiply your lift. Civilian ferries carry twice as much but need a port you hold, or slight seas on a beach. Taking a port needs 3 to 1.',
    'Hunt the missile launchers early, while your ships are most exposed.',
    'For Taiwan: fire your missiles in mass (the escorts can stop a small salvo entirely), get reserves to the landing quickly, and counterattack only when roughly even; attacking too early gives up your prepared positions.',
  ],
  terms: [
    ['Point', 'About 1,000 troops with their equipment (notional).'],
    ['Lodgment', 'The area the attacker holds ashore.'],
    ['Sea state', 'Wave height band: slight ≤ 1.25 m, moderate 1.25–2.5 m, rough > 2.5 m (nothing sails).'],
    ['RO-RO ferry', 'Roll-on/roll-off civilian car ferry, drafted to carry troops and vehicles.'],
    ['H-hour, D+1', 'The moment of landing; the day after D-day.'],
    ['Salvo model', 'Missiles fired minus missiles the escorts stop = hits on ships (Hughes 1995).'],
    ['Reserves', 'Taiwan\'s mobile army groups held back to reinforce whichever beach is hit.'],
    ['3 to 1', 'The classic rule of thumb for the edge an attacker needs to take a defended position.'],
  ],
};

/**
 * where: element the banner goes into. api: { S, game: () => G, reset(seedKeep), render() }.
 */
export function mountLesson(where, api) {
  const { S } = api;
  const G = () => api.game();
  const pick = () => {
    S.role = 'pla'; S.seed = LESSON.seed;
    Object.assign(S.setup, { month: LESSON.month, wait: 0, zones: ['central', null], us: true, prep: 'hunt' });
    api.reset(true);
  };
  const steps = [
    { title: 'What winning means',
      body: 'You plan a PLA landing on Taiwan\'s west coast. After eight 12-hour turns (D-day to D+3) you need a <b>lodgment</b>, a foothold ashore, of at least <b>15 points</b> (1 point ≈ 1,000 troops) that outnumbers Taiwan\'s defenders there <b>1.5 to 1</b>, plus a port or 30 points ashore. This bar will keep score.',
      target: () => $('#status') },
    { title: 'The map',
      body: 'Three broad landing zones, each with a commercial port (the small squares). Crossings run 140 km to the northwest coast and 220 km to the southwest. The thick red line is your main zone: the central coast. Each zone shows today\'s wave height: green slight, amber moderate, red rough.',
      target: () => $('#box') },
    { title: 'The weather is real',
      body: () => `Each game plays a real week of waves from 30 years of records (ERA5). Today the central coast has <b>${$('.sl-days [data-wait="0"] .sl-chip')?.textContent || 'moderate'}</b> waves: <b>moderate</b>, so amphibious ships unload at only a quarter of their rate. Waiting gives calmer seas and extra strikes, but each day Taiwan mobilizes and lays more mines.`,
      do: 'Under <b>4 · D-day</b>, choose <b>Wait for calm</b>.',
      target: () => $('#panel [data-wait="calm"]'),
      done: () => S.setup.wait === 'calm' },
    { title: 'Launch',
      body: 'The other choices can stay as they are: April, the central coast, U.S. and allied strikes on (Taiwan does not fight alone).',
      do: 'Press <b>Launch the landing</b>.',
      target: () => $('#launch'),
      done: () => S.phase === 'play' },
    { title: 'Your orders each turn',
      body: '<b>Amphibious ship groups</b> (1 point each) can land on a beach. <b>Ferry groups</b> are civilian roll-on/roll-off car ferries (2 points each): they need a port you hold, or slight seas. Ships that unload sail home and come back three turns later. <b>Strikes</b> hunt Taiwan\'s missile launchers, clear mines, or cut the roads its reserves use. The defaults are sensible.',
      target: () => $('#o-amph')?.closest('.sec') },
    { title: 'Play the first turn',
      body: 'Ships afloat face Taiwan\'s anti-ship missiles and mines on the way in; then whatever reaches the beach unloads and fights.',
      do: 'Press <b>Resolve turn 1</b> (or the N key).',
      target: () => $('#resolve'),
      done: () => (G()?.t || 0) >= 1 },
    { title: 'Read what happened',
      body: () => `The bar now reads <b>${$('#status-t')?.textContent || ''}</b>: your points ashore on the central coast against Taiwan\'s points at the same beaches. Green means you lead 1.5 to 1 or better, amber is close, red means you are outnumbered. The log below lists every step of the turn with its numbers: missiles fired and stopped, ships lost, troops landed, losses ashore.`,
      target: () => $('#status') },
    { title: 'The race that decides it',
      body: 'Red is your strength ashore, the pale band is troops still afloat offshore, teal is Taiwan\'s strength at your beaches. Taiwan\'s reserves arrive over the next turns and counterattack. You win by keeping the red line climbing faster than the teal one. Taking the port (it needs 3 to 1) lets your ferries unload at full rate.',
      target: () => $('#race-card') },
    { title: 'Finish the landing',
      do: 'Resolve the remaining turns, through D+3 night. The defaults are fine; try a strike or the port assault if you like.',
      target: () => $('#resolve') || $('#to-aar'),
      done: () => !!G()?.over },
    { title: 'What the result means',
      body: () => {
        const o = G()?.result?.outcome;
        const t = o === 'pla' ? 'Your lodgment is <b>secure</b>.' : o === 'roc' ? 'Your landing was <b>defeated</b>.' : 'Your landing is <b>contested</b>: neither side has won yet.';
        return `${t} The review below replays other plans on the <b>same week and the same dice</b>, so the only difference is the choice. Compare your row with "go at once" to see what waiting for calm was worth, then the 1,000-week run to see how lucky this week was. Colors follow the map whichever side you play: red marks a PLA success, green a Taiwan one. You can also switch sides and command Taiwan.`;
      },
      target: () => $('#aar-table') },
  ];
  // On a phone the lesson card covers the bottom half of the screen: bring each target into the top half first.
  for (const st of steps) if (st.target) st.start = () => {
    const t = st.target();
    if (t && innerWidth <= 600) { const r = t.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight * 0.5) scrollBy({ top: r.top - 70, behavior: 'auto' }); }
  };
  const start = () => {
    pick();
    scrollTo({ top: 0 });
    runLesson(steps, { slug: SLUG, title: 'Learn to play', onExit: () => banner.refresh() });
  };
  const banner = learnButton(where, { slug: SLUG, minutes: 6, onStart: start, sheet: SHEET });
  return { start, sheet: () => showSheet(SHEET, { onStart: start }) };
}
