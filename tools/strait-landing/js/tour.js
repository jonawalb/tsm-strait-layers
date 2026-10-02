// Guided walkthrough: a card that steps through the page and highlights each part.
const STEPS = [
  { t: 'The question', el: 'race-card',
    b: 'A landing is a race. The attacker has to put troops ashore faster than the defender can bring its reserves to the beach and sink the ships still offshore. This chart is the race: red is PLA strength ashore, teal is Taiwan\'s strength at the same beaches.' },
  { t: 'The map', el: 'box',
    b: 'Three broad landing zones on Taiwan\'s west coast, each with a commercial port. Crossings run about 140 km to the northwest coast and 220 km to the southwest. The zones are generalized regions; the game has no beach-level detail.' },
  { t: 'The weather is real', el: 'panel',
    b: 'Pick a month. Each game plays a real week of sea states drawn from 30 years of ERA5 wave data for the middle of the Strait. You get a three-day forecast and can wait for calmer seas, but every day you wait, Taiwan mobilizes and lays more mines.' },
  { t: 'Lift and waves', el: 'panel',
    b: 'Each 12-hour turn you choose how many amphibious ship groups and civilian RO-RO ferry groups to send. Ships that unload go home to reload and come back three turns later (four from the southwest). Ferries carry more but need a port or calm seas to unload. What cannot unload waits offshore.' },
  { t: 'Missiles and mines', el: 'log',
    b: 'Ships afloat face Taiwan\'s anti-ship missiles. The salvo model subtracts what the escorts can stop and turns the rest into hits. Strikes can hunt the launchers (easier after they fire), clear mines off your beaches or cut the roads Taiwan\'s reserves use. The log shows every number.' },
  { t: 'The fight ashore', el: 'race-card',
    b: 'Ashore, both sides wear each other down in proportion to the other side\'s strength (Lanchester\'s square law). Defenders in prepared positions count for more; troops who landed this turn count for less. Taiwan\'s reserves arrive and counterattack. Taking a port needs 3 to 1 and it may be wrecked when it falls.' },
  { t: 'Review', el: 'aar',
    b: 'After D+3 the review replays your plan against other plans on the same week and the same dice, then runs 1,000 weeks of your plan against the doctrinal one. You can also play Taiwan\'s commander: switch sides in the panel.' },
];

export function createTour() {
  let i = -1, hi = null;
  const card = document.createElement('div');
  card.className = 'sl-tour'; card.hidden = true;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Guided walkthrough');
  document.body.appendChild(card);
  const mark = id => {
    hi?.classList.remove('tour-hi');
    hi = id ? document.getElementById(id) : null;
    if (hi && !hi.hidden) {
      hi.classList.add('tour-hi');
      hi.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  };
  const show = () => {
    const s = STEPS[i];
    mark(s.el);
    card.innerHTML = `<div class="tour-h"><span>Walkthrough ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.t}</h3><p>${s.b}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { const n = i + Number(b.dataset.d); if (n >= STEPS.length) stop(); else { i = n; show(); } }; });
    card.querySelector('.solid').focus({ preventScroll: true });
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { if (card.hidden) return; card.hidden = true; i = -1; mark(''); document.getElementById('start-tour')?.focus({ preventScroll: true }); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) { e.stopPropagation(); stop(); } }, true);
  return { start, stop };
}
