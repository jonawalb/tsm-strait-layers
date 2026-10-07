// Guided briefing: fixed scenarios with short explanations (pattern from strait-layers/js/tour.js).
// Numbers in the text are read from the model run for that step, so they stay in step with the model.
import { PRESETS } from './state.js';

const P = k => structuredClone(PRESETS.find(p => p.k === k).v);
const pc = v => Math.round(v * 100) + '%';
const runs = t => (t == null ? 'never runs out in this run' : 'runs out on day ' + t);
const low = s => (s.days.some(d => d.supply < d.need - 0.005) ? `power falls to ${pc(s.minGrid.grid)} of normal demand`
  : `power holds at the ${pc(s.minGrid.grid)} of normal demand that rationing allows`);

export const STEPS = [
  { title: 'Past drills did not stop ships',
    body: () => 'Start with what has happened. In every large PLA exercise around Taiwan since 2022, IMF PortWatch counts about as many ships in the Strait and in Taiwan\'s ports as in the four weeks before, or more (see Evidence below). Coercion so far has set precedents without moving traffic.',
    set: () => ({ ...P('cgq'), sev: 0, ins: 'hold', dur: 30 }), day: 15, tab: 'ship' },
  { title: 'A quarantine works through insurers',
    body: s => `Now the coast guard boards 30 percent of Taiwan-bound ships and lets most go. War-risk underwriters list the area on day ${s.ev.listed}. Owners pull back as they did in the Red Sea, and cargo arriving falls to ${pc(Math.min(...s.days.slice(0, s.cfg.dur).map(d => d.arrive)))} of normal even though few ships are turned away.`,
    set: () => P('cgq'), day: 40, tab: 'ship' },
  { title: 'The LNG clock is the short one',
    body: s => `Gas makes almost half of Taiwan's electricity and the tanks hold about eleven days. In this quarantine LNG ${runs(s.ev.runout.lng)}; after that gas plants run only on what arrives. Coal and oil last much longer.`,
    set: () => P('cgq'), day: 50, tab: 'energy' },
  { title: 'The same quarantine with the market holding',
    body: s => `Keep the boardings but let insurers hold their terms. LNG now ${runs(s.ev.runout.lng)}. The difference between this run and the last is the insurance channel alone, the mechanism in Walberg's Uninsurable Strait paper.`,
    set: () => ({ ...P('cgq'), ins: 'hold' }), day: 50, tab: 'energy' },
  { title: 'Cables are cut once and fixed slowly',
    body: s => `Cut the north coast landings and the outlying-island cables. Taiwan has no repair ship of its own, and foreign cable ships stay out until the quarantine lifts, so the last cable returns on day ${Math.max(...s.repairs.map(r => r.done))}.`,
    set: () => P('grey'), day: 60, tab: 'cables' },
  { title: 'A blockade adds force and pulls cover',
    body: s => `In a naval blockade most ships are turned away and insurers cancel cover after notice. LNG ${runs(s.ev.runout.lng)} and ${low(s)}. Rationing early protects the fabs for a while.`,
    set: () => P('blk'), day: 45, tab: 'energy' },
  { title: 'Convoys and a state insurance pool',
    body: s => `Allied convoys and a government-backed war-risk facility bring owners back. LNG ${runs(s.ev.runout.lng)} and ${low(s)}. Pin this run, change one assumption in the drawer, and compare.`,
    set: () => P('convoy'), day: 45, tab: 'energy' },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided briefing');
  root.prepend(card);
  const show = () => {
    const s = STEPS[i];
    const sim = apply(s.set(), s.day, s.tab);
    card.innerHTML = `<div class="tour-h"><span>Briefing ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close briefing">×</button></div>
      <h3>${s.title}</h3><p>${s.body(sim)}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { const n = i + Number(b.dataset.d); if (n >= STEPS.length) stop(); else { i = n; show(); } }; });
    card.querySelector('.solid').focus();
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
