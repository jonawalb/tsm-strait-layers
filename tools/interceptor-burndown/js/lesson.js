// "Learn to play": a hands-on first run from the default scenario. Folds in the old walkthrough's content.
import { learnButton, runLesson } from '../../../shared/js/learn.js';

const SLUG = 'interceptor-burndown';
const $ = id => document.getElementById(id);
const head = () => $('status').querySelector('b').textContent;
const dryDay = () => { const m = /runs dry on day (\d+)/.exec(head()); return m ? +m[1] : null; };
const dryText = d => d == null ? 'past the last day shown' : `day ${d}`;

// Phones: the lesson card covers the bottom of the screen, so bring each step's target into the upper part.
const lift = el => {
  if (!el || innerWidth > 600 || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  if (r.top < 70 || r.top > innerHeight * 0.4) scrollBy({ top: r.top - Math.max(70, innerHeight * 0.15), behavior: 'instant' });
};
const onPhone = steps => steps.map(s => s.target ? { ...s, start: () => { const v = s.start ? s.start() : null; lift(s.target()); return v; } } : s);

export const SHEET = {
  title: 'Interceptor Burn-down on one screen',
  goal: 'See how long Taiwan\'s air and missile defense interceptors last against a daily PRC salvo. The headline number is the <b>dry day</b>: the day the last interceptor able to hit a ballistic missile is fired. A later dry day and fewer <b>leakers</b> (threats that get through) are better for Taiwan.',
  controls: [
    ['Play / Space', 'Run the campaign day by day. Press again to pause.'],
    ['Day slider', 'Jump to any day. Arrow keys move one day.'],
    ['Drag a chart', 'Move the day by clicking or dragging across either chart.'],
    ['1 · PRC daily salvo', 'Pick a preset or set ballistic, cruise and drone numbers per day.'],
    ['2 · Taiwan\'s interceptors', 'Pick an inventory (today, or with planned orders) or set each system.'],
    ['3 · Engagement rules', 'How many interceptors each threat gets, and the chance each one kills.'],
    ['4 · Resupply', 'Production and U.S. deliveries during the campaign.'],
    ['Reset', 'Back to the default scenario.'],
  ],
  ideas: [
    'Firing doctrine moves the dry day more than modest changes in stock. Two shots per missile empties the magazine twice as fast.',
    'Keep expensive interceptors for missiles. Spending them on cheap drones drains ballistic defense in days.',
    'Production and planned orders buy days, not weeks, against a campaign measured in days.',
    'Check the sensitivity chart: inputs at the top deserve the most scrutiny.',
  ],
  terms: [
    ['Interceptor', 'A missile fired to shoot down an incoming missile or drone.'],
    ['Magazine', 'The total stock of interceptors on hand.'],
    ['SRBM', 'Short-range ballistic missile: fast, falls steeply, the hardest to stop.'],
    ['GLCM', 'Ground-launched cruise missile: flies low like a small jet.'],
    ['Leaker', 'A threat that gets through the defense.'],
    ['Shoot-look-shoot', 'Fire one interceptor, check the result, fire again only after a miss.'],
    ['Kill chance', 'The chance one interceptor destroys its target (notional).'],
    ['Notional', 'An assumption chosen for teaching, not a sourced figure.'],
  ],
};

/** helpers: { S, reset() } from app.js. */
export function mountLesson(where, { S, reset }) {
  let before = null;
  const steps = [
    { title: 'The question',
      body: 'Taiwan\'s air and missile defense runs on a stock of <b>interceptors</b>: missiles that shoot down incoming missiles. Each one can be fired once. This tool fires a daily PRC salvo at that stock and counts down. The headline is the <b>dry day</b>, when the last interceptor able to stop a ballistic missile is gone. Pushing it later is the goal.',
      target: () => $('status') },
    { title: 'The magazine on day 0',
      body: 'Each bar is one system: about 1,500 Patriot and Tien Kung rounds in all, by open-source estimate, with 80% assumed in position and able to fire. None of these counts is official. The salvo here spreads the Pentagon\'s estimated 900 short-range ballistic missiles (SRBMs) and 400 cruise missiles over ten days.',
      target: () => $('mags') },
    { title: 'Run the campaign',
      do: 'Press <b>Play</b> (or the Space bar) and let it run past the dry day.',
      target: () => $('play'),
      done: () => { const d = dryDay(); return d != null && S.day >= d; } },
    { title: 'Read the charts',
      body: 'The first chart shows the whole magazine shrinking, one colored band per system. The vertical line marks the dry day. Below it, the leaker chart shows how many threats arrive each day and how many get through. Drag across either chart to read any day.',
      target: () => $('burn') },
    { title: 'Change how Taiwan fires',
      body: 'By default Taiwan fires two interceptors at every ballistic missile (<b>shoot-shoot</b>). <b>Shoot-look-shoot</b> fires one, checks, and fires again only after a miss. It saves rounds, but against a fast ballistic missile there is often no time to look; the model assumes a second shot is possible half the time.',
      do: 'Under <b>3 · Engagement rules</b>, Ballistic, press <b>Shoot-look-shoot</b>.',
      start: () => { before = dryDay(); },
      target: () => document.querySelector('#rules [data-c="b"][data-k="sls"]'),
      done: () => S.doc.b === 'sls' },
    { title: 'Doctrine buys days',
      body: () => `The dry day moved from <b>${dryText(before)}</b> to <b>${dryText(dryDay())}</b>. Because the PRC stock is finite, fewer missiles get through in total too. How you fire matters more than modest changes in how many rounds you hold.`,
      target: () => $('status') },
    { title: 'Now a drone swarm',
      do: 'Under <b>1 · PRC daily salvo</b>, pick <b>Russia, Sept. 2025, nightly</b>: 810 drones and 13 missiles, the size of Russia\'s 7 September 2025 attack on Ukraine, repeated every day.',
      target: () => document.querySelector('#salvo-choices [data-k="ukr"]'),
      done: () => S.salvo.d === 810 },
    { title: 'Cheap drones, expensive interceptors',
      body: 'Ballistic defense now lasts, because long-range missiles are kept for missiles and drones go to guns, jammers and cheaper launchers. The price shows in the leaker chart: most drones get through.',
      do: 'Under <b>Fire missiles at drones?</b> pick <b>Any interceptor</b>, then switch off <b>Keep PAC-3 for ballistic missiles</b>.',
      start: () => { before = dryDay(); },
      target: () => S.dronePol === 'all' ? $('savepac').closest('label') : document.querySelector('#drone-choices [data-k="all"]'),
      done: () => S.dronePol === 'all' && !S.savePac },
    { title: 'Spent on drones',
      body: () => `Ballistic defense now ${dryDay() ? `runs dry on <b>day ${dryDay()}</b>` : 'still lasts, but watch the bars drain'}. Drone numbers for a PRC campaign have no public estimate, so treat this input most carefully.`,
      target: () => $('status') },
    { title: 'What moves the answer',
      body: 'This chart moves one input at a time, 25% down and up, and ranks inputs by how far they move the dry day (or, with the other button, the leakers). Inputs at the top deserve the most scrutiny. Production and planned orders sit low: they buy days, not weeks. Press <b>Reset</b> to start over and test your own scenario. All results are expected values from a notional model, not a forecast.',
      target: () => $('torcard') },
  ];
  const start = () => {
    reset();
    scrollTo({ top: 0 });
    runLesson(onPhone(steps), { slug: SLUG, title: 'Learn to play', onExit: () => banner.refresh() });
  };
  const banner = learnButton(where, { slug: SLUG, minutes: 5, onStart: start, sheet: SHEET });
  return { start };
}
