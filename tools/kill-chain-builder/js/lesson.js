// "Learn to play": a hands-on first game on the presets. Folds in the old walkthrough's content.
import { learnButton, runLesson } from '../../../shared/js/learn.js';

const SLUG = 'kill-chain-builder';
const $ = s => document.querySelector(s);
const nodeEl = id => $(`#kc-board .node[data-id="${id}"]`);

// Phones: the lesson card covers the bottom of the screen, so bring each step's target into the upper part.
const lift = el => {
  if (!el || innerWidth > 600 || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  if (r.top < 70 || r.top > innerHeight * 0.4) scrollBy({ top: r.top - Math.max(70, innerHeight * 0.15), behavior: 'instant' });
};
const onPhone = steps => steps.map(s => s.target ? { ...s, start: () => { const v = s.start ? s.start() : null; lift(s.target()); return v; } } : s);

export const SHEET = {
  title: 'Kill Chain Builder on one screen',
  goal: 'Build a chain of sensors, command nodes and shooters that <b>closes</b> against a moving target, or find the node whose loss <b>breaks</b> it. A chain closes when one path passes every step: find, fix, track, target, engage.',
  controls: [
    ['Palette button', 'Add a node to its lane (or drag it onto the board).'],
    ['Drag a round port', 'Link that node to another node.'],
    ['Click a node', 'Select it. The inspector at the bottom of the panel shows its numbers and links.'],
    ['Tab, Enter', 'Move to a node, select it.'],
    ['Arrow keys', 'Move the focused node.'],
    ['Delete', 'Remove the focused node.'],
    ['Build with menus', 'Add nodes and links from drop-down menus in the panel, no dragging needed.'],
    ['Pick targets', 'Then click (or Enter on) a node to knock it out. Click again to restore it.'],
    ['Strike 1 / Strike 2', 'Knock out random nodes.'],
    ['Preset chains', 'Load one of three example chains, or a blank board.'],
  ],
  ideas: [
    'Speed matters as much as reach. Every minute of reporting and deciding lets the target move away from the aim point.',
    'Pair a precise sensor (to fix the target) with a fast-updating one (to keep the aim point fresh).',
    'Count independent paths, not nodes. Five sensors that all report through one command post are one path.',
    'A single point of failure is a node whose loss alone breaks the chain. Strike it first, or protect it first.',
  ],
  terms: [
    ['Kill chain', 'The steps to strike a target: find, fix, track, target, engage, assess (F2T2EA).'],
    ['Fix', 'Pin down the target\'s position precisely enough to aim at (here, 5 km or better).'],
    ['Seeker basket', 'How far from the aim point a weapon\'s own seeker can still search and find the target.'],
    ['Independent paths', 'Closing paths that share no node. The number of nodes an adversary must hit to break the chain.'],
    ['Single point of failure', 'A node every closing path depends on.'],
    ['ASBM', 'Anti-ship ballistic missile.'],
    ['OTH radar', 'Over-the-horizon radar: very long reach, coarse position.'],
    ['EMCON', 'Emissions control: the target goes radio and radar silent.'],
  ],
};

export function mountLesson(where, api) {
  const { S } = api;
  const reset = () => api.loadPreset('pla');
  const choose = () => { if (!S.choose) { S.choose = true; api.update(); } };
  const steps = [
    { title: 'What you are trying to do',
      body: 'A <b>kill chain</b> is the sequence a military runs to strike a target: <b>find</b> it, <b>fix</b> its position, <b>track</b> it as it moves, <b>target</b> it (assign a weapon and approve the shot), <b>engage</b>. A chain <b>closes</b> when one path passes every step. This box says whether the chain on the board closes; the six bars under it light up for each step the best path passes, down to <b>assess</b> (judging the damage).',
      target: () => $('#kc-status') },
    { title: 'Reading the board',
      body: 'Sensors sit on the left, command nodes and datalinks in the middle, shooters on the right. Arrows show who reports to whom. The thick red path is the fastest one that closes. This is a notional PLA chain: a satellite and an over-the-horizon radar feed a theater headquarters that fires anti-ship ballistic missiles (ASBMs) at a U.S. carrier group 1,200 km out.',
      target: () => $('.boardbox') },
    { title: 'Two sensors make one aim point',
      body: 'The satellite fixes the carrier precisely, but its picture is over an hour old when a missile arrives. The over-the-horizon (OTH) radar is coarse but updates every minute. Together they keep the aim point inside the missile\'s <b>seeker basket</b>: the area its own seeker can search. The timeline under the board shows this.',
      target: () => $('.card.under') },
    { title: 'Knock out the radar',
      body: 'The tutorial has switched on <b>Pick targets</b> (in the panel under Adversary attacks). In this mode a click knocks a node out, the way an adversary\'s strike would.',
      do: 'Click the <b>OTH radar</b> node on the board (or Tab to it and press Enter).',
      start: () => choose(),
      target: () => nodeEl(1),
      done: () => S.dead.has(1) },
    { title: 'Read what happened',
      body: () => `The missiles are still in range, but the chain now breaks at <b>Track</b>. Only the satellite\'s old fix is left: at 30 knots the carrier moves about 66 km before impact, far outside a 40 km basket. The panel now reads: <i>${$('#kc-status b')?.textContent || ''}</i>.`,
      target: () => $('#kc-why') },
    { title: 'A short chain with one weak spot',
      do: 'Load the <b>Taiwan coastal defense chain</b> preset.',
      target: () => $('[data-p="twn"]'),
      done: () => S.preset === 'twn' && !S.dead.size },
    { title: 'Find the single point of failure',
      body: 'This chain is fast: radar and drone reports reach a local command that fires within minutes. But every path runs through that one command post. The panel lists it under <b>Single points of failure</b>, and the board tags it.',
      do: 'Pick targets is on again. Click the <b>Local command</b> node to knock it out.',
      start: () => choose(),
      target: () => nodeEl(2),
      done: () => S.preset === 'twn' && S.dead.has(2) },
    { title: 'The idea that wins: independent paths',
      do: 'Load the <b>U.S. JADC2-style mesh</b> preset.',
      body: 'One strike ended that chain: redundant sensors and shooters do not help when they share one node. Now compare a mesh like the one JADC2 (the U.S. plan to link every sensor to every shooter) aims at.',
      target: () => $('[data-p="mesh"]'),
      done: () => S.preset === 'mesh' && !S.dead.size },
    { title: 'Count the paths an attacker must cut',
      body: 'Here the target is a mobile missile launcher that stays located for only about 20 minutes. Drones and an early-warning aircraft feed strike aircraft over two datalinks, so there are <b>two independent paths</b>: paths that share no node. An attacker must hit at least two nodes to break this chain. Try <b>Strike 1 random node</b> a few times and press <b>Restore all</b> between tries.',
      target: () => $('#kc-read') },
    { title: 'Your turn to build',
      body: 'Load <b>Blank board</b>, add nodes from the palette, and drag from a round port to link them. Change the target, its distance and speed in the panel. A red status means the chain closes (bad news for the target); a green one means it breaks. Every number except the two ASBM ranges is notional: the structure is the lesson.',
      target: () => $('#kc-palette') },
  ];
  const start = () => {
    reset();
    scrollTo({ top: 0 });
    runLesson(onPhone(steps), { slug: SLUG, title: 'Learn to play', onExit: () => banner.refresh() });
  };
  const banner = learnButton(where, { slug: SLUG, minutes: 5, onStart: start, sheet: SHEET });
  return { start };
}
