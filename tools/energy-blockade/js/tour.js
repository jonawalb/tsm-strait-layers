// Guided briefing: fixed scenario states with short explanations (pattern from strait-layers/js/tour.js).
const NONE = { conserve: false, commerce: false, heavy: false, fuel: false, oilgen: false };
const REP = { lng: 11, coal: 41, oil: 146 };

export const STEPS = [
  { title: 'Almost all of it comes by sea',
    body: 'Taiwan imports about 97 percent of its energy. With no blockade, arrivals match use and every tank stays full. Around 30 LNG cargoes a month keep the gas tanks topped up.',
    set: { sev: 0, dur: 90, stock: REP, policy: 'csis', measures: NONE, day: 20 } },
  { title: 'The LNG clock is short',
    body: 'Stop every inbound cargo. Gas stocks cover about eleven days of normal use, so by the second week gas-fired plants, almost half the grid in 2025, start to shut down.',
    set: { sev: 100, dur: 120, stock: REP, policy: 'csis', measures: NONE, day: 12 } },
  { title: 'Coal buys about six weeks',
    body: 'Coal yards hold roughly 40 days. The model burns coal first to stretch the gas. When the coal runs out, only renewables and a little oil remain: less than a fifth of normal output.',
    set: { sev: 100, dur: 120, stock: REP, policy: 'csis', measures: NONE, day: 45 } },
  { title: 'Who loses power is a choice',
    body: 'When supply falls short, someone has to be cut. Keeping factories running means dark homes and shops; protecting households means idle fabs. Switch the priority and watch the strip reorder.',
    set: { sev: 100, dur: 120, stock: REP, policy: 'households', measures: NONE, day: 20 } },
  { title: 'Shedding demand early stretches the stocks',
    body: 'Conservation, a commercial curfew and idling heavy industry cut demand before the tanks empty. In this run gas lasts a week longer and coal five days longer, and the lowest point rises from about 16 to 26 percent of demand.',
    set: { sev: 100, dur: 120, stock: REP, policy: 'csis', measures: { conserve: true, commerce: true, heavy: true, fuel: true, oilgen: true }, day: 30 } },
  { title: 'A leaky quarantine is a different problem',
    body: 'If half the cargoes still arrive, gas still runs short within weeks, but the grid sags instead of collapsing. A quarantine works through time, insurance and nerves more than through a sudden blackout.',
    set: { sev: 50, dur: 150, stock: REP, policy: 'csis', measures: NONE, day: 60 } },
  { title: 'Bigger stocks move the cliffs',
    body: 'The 2027 rule raises the LNG requirement to 14 days, and Taipower has studied storing coal for up to 50 days. Compare the run-out days in the tanks with the reported levels. Then build your own scenario.',
    set: { sev: 100, dur: 120, stock: { lng: 14, coal: 50, oil: 146 }, policy: 'csis', measures: NONE, day: 14 } },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided briefing');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Briefing ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close briefing">×</button></div>
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
