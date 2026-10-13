// "Learn to play": a hands-on first lesson (shared/js/learn.js) and the one-screen rules sheet.
// Folds in the old walkthrough (js/tour.js). `done` checks read the page itself: the equilibrium box and the open tab.

const $ = s => document.querySelector(s);
const mod = () => document.body.dataset.mod;
const status = m => ($(`#${m.toLowerCase()}-status b`)?.textContent || '').trim();
const slider = k => $(`#sl-${k}`)?.closest('.slider');
const tab = m => $(`.tabs [data-m="${m}"]`);
const jump = () => [...document.querySelectorAll('#panel .btn')].find(b => /bluff-proof/.test(b.textContent));

export const STEPS = [
  { title: 'What you are trying to do',
    body: 'Each tab is a small crisis game. You are <b>S</b>, a government making a threat (in a Taiwan crisis, read S as either side). <b>R</b> is the other side, holding something S wants (the <em>stake</em>). S wins if R gives way without a war. The catch: R cannot see whether S would really fight. The question in every tab is the same: <b>when does R believe the threat?</b>' },
  { title: 'Read the game tree',
    body: 'Read it left to right. <b>N</b> (nature, or chance) first decides whether S is <b>resolute</b> (would really fight) or <b>irresolute</b> (would rather back down). S then stays quiet or threatens. R concedes or resists. The pairs in brackets are <b>payoffs</b>: what S and R each end up with, where the stake is worth 1. The dashed line means R cannot tell the two S types apart. Thick lines are what actually happens.',
    target: () => $('#a-tree') },
  { title: 'The equilibrium box',
    body: 'An <b>equilibrium</b> is a pair of plans where neither side can do better by changing its own plan alone: the stable way this game gets played. Right now it is <em>semi-separating</em>: the irresolute S bluffs 13% of the time, R calls (resists) 83% of threats, and war happens 25% of the time. Bluffs and calls are in balance.',
    target: () => $('#a-status') },
  { title: 'Make backing down expensive',
    body: 'An <b>audience cost</b> is the price a leader pays at home for threatening in public and then backing down: lost votes, lost face.',
    do: 'Drag the <b>Audience cost of backing down</b> slider to 0.40 or more (or use the arrow keys on it).',
    target: () => slider('a'),
    done: () => status('A') === 'Commitment' },
  { title: 'Now the threat is credible',
    body: 'Backing down now costs S more than fighting, so even the irresolute S would fight. The threat is <b>credible</b>: believable, because carrying it out is in S’s own interest. R concedes, war falls to 0%, and the audience cost is never actually paid. This is Fearon’s (1994) commitment logic.',
    target: () => $('#a-read') },
  { title: 'Or let a reputation do the work',
    body: 'The <b>prior</b> is what R believes about S before the crisis: the chance S is resolute.',
    do: 'Bring the audience cost back below 0.40, then raise <b>Prior that S is resolute</b> to about 0.80. You can also click the colored map: left is a low audience cost, up is a high prior.',
    target: () => (status('A') === 'Commitment' ? slider('a') : slider('p')),
    done: () => status('A') === 'Pooling bluff' },
  { title: 'A reputation invites bluffs',
    body: 'R already thinks S is probably resolute, so it concedes to any threat, and the irresolute S bluffs and wins. The threat works without tied hands: a strong reputation can make bluffing pay. On the map, each color is a different equilibrium and the dot is your setup.',
    target: () => $('#a-region') },
  { title: 'Signals: pay to be believed',
    body: 'A <b>signal</b> is something S does to show it is resolute. Talk is cheap, so a believable signal must cost more than a bluffer would pay. Tab B compares two ways to pay: <b>sink costs</b> (mobilize, paid whatever happens) and <b>tie hands</b> (a public pledge, paid only if S retreats).',
    do: 'Open tab <b>B · Costly signals</b>, then press <b>Set the smallest bluff-proof signal</b>.',
    target: () => (mod() === 'B' ? jump() : tab('B')),
    done: () => mod() === 'B' && ['Separating', 'Commitment'].includes(status('B')) },
  { title: 'Salami tactics: one slice at a time',
    body: 'In tab C a challenger takes small slices, one after another. The defender is weak (would rather give way) or tough (always resists). A weak defender resists early slices to protect its <b>reputation</b>, so even a 5% chance that it is tough keeps the challenger out of the early slices.',
    do: 'Open tab <b>C · Salami tactics</b>, then press <b>Play it out</b> to watch one history.',
    target: () => (mod() === 'C' ? $('#c-play') : tab('C')),
    done: () => mod() === 'C' && !!$('#c-strip li.hid') },
  { title: 'The idea that wins',
    body: 'A threat works when a bluffer would not make it. S gets there three ways: make backing down costly (tab A), pay up front (tab B), or keep a little doubt alive (tab C). Fearon’s comparison table in tab B shows the trade-off: tying hands costs S less on average but carries more risk of war. And with no doubt at all, salami deterrence unravels: tick <b>Complete information</b> in tab C to see every slice taken. All values are <span class="notional">notional</span>: they teach the logic and estimate nothing. The address bar stores your exact setup, so you can share it.' },
];

export const SHEET = {
  title: 'Deterrence Lab: the rules on one screen',
  goal: 'You are S, a government making a threat or commitment. R holds the stake and cannot see whether S would really fight. Move the payoffs and beliefs and watch which <b>equilibrium</b> results: when R believes S, when bluffing pays, and when the crisis ends in war.',
  controls: [
    ['Tabs A · B · C', 'Pick a model: audience costs, costly signals, salami tactics. ← → move between tabs.'],
    ['Sliders', 'Set payoffs and beliefs. Arrow keys nudge a focused slider.'],
    ['Colored map', 'Click or drag to move both plotted parameters at once.'],
    ['Bluff-proof button (B)', 'Jumps to the smallest signal a bluffer would not send.'],
    ['Play it out / New draw (C)', 'Animate one history of the salami game, or draw another.'],
    ['Address bar', 'Stores the tab and every parameter, so a link reproduces your setup.'],
  ],
  ideas: [
    'A threat is believed when a bluffer would not make it.',
    'A big enough audience cost makes even the irresolute type fight, so R concedes and the cost is never paid.',
    'A strong reputation (high prior) also works, but lets the irresolute type bluff and win.',
    'Tying hands is cheaper on average than sinking costs, but riskier.',
    'A little doubt about the defender deters early salami slices; with none, deterrence unravels.',
  ],
  terms: [
    ['Payoff', 'What a side ends up with in an outcome. The stake is worth 1.'],
    ['Equilibrium', 'Plans where neither side gains by changing its own plan alone.'],
    ['Resolute', 'An S that would really fight if resisted.'],
    ['Credible', 'Believable, because carrying out the threat is in S’s interest.'],
    ['Signal', 'A costly action that shows S’s type.'],
    ['Prior / posterior', 'R’s belief that S is resolute before / after seeing what S did.'],
    ['Pooling / separating', 'Both types act alike (R learns nothing) / act differently (R learns the type).'],
    ['Audience cost', 'The domestic price of backing down after a public threat.'],
  ],
};
