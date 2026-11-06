// Guided briefing: a fixed sequence of scenario states with short explanations.
const NONE = { emcon: false, jam: false, blind: false, aew: false, c2: false };
const RC0 = { radar: false, mpa: false, supp: 0, disperse: false, mines: false, drones: false };

export const STEPS = [
  { title: 'Rings show reach, not threat',
    body: 'Each ring is how far a PLA system reaches from a representative launch area. The long-range ballistic layers push U.S. forces away from Taiwan (anti-access). The short-range layers make the Strait itself dangerous (area denial).',
    set: { mode: 'approach', blue: { route: 0, t: 0.12, free: null }, cm: NONE, zoom: 'region' } },
  { title: 'Far out, the chain is thin',
    body: 'Here the group is already inside DF-26 and DF-21D range. The PLA closes the kill chain with only a few long-reach sensors: skywave radar to find the group and satellite passes to fix and track it.',
    set: { mode: 'approach', blue: { route: 0, t: 0.55, free: null }, cm: NONE } },
  { title: 'Counter-targeting breaks it',
    body: 'Jam the skywave radar and blind the satellites. The group is still in range of the same missiles, but the PLA can no longer hold a track, so it cannot aim. Out here, defending the ship starts with denying the sensors.',
    set: { mode: 'approach', blue: { route: 0, t: 0.55, free: null }, cm: { ...NONE, jam: true, blind: true } } },
  { title: 'Close in, the chain is dense',
    body: 'In the Strait every Blue action is on, and coastal missiles can still fire. Surface-wave radar closes the chain on its own, and in this model coastal units do not need theater command to shoot. Denial is hardest to break at short range.',
    set: { mode: 'approach', blue: { route: 1, t: 0.42, free: null }, cm: { emcon: true, jam: true, blind: true, aew: true, c2: true }, zoom: 'strait' } },
  { title: 'Range is not the end of the story',
    body: 'Missiles that can fire still have to get through. This salvo model trades incoming missiles against decoys, interceptor kill chances and a finite magazine. Watch the interceptor bar drain across successive salvos.',
    set: { mode: 'salvo', blue: { route: 1, t: 0.42, free: null }, cm: NONE, zoom: 'strait' } },
  { title: 'Denial works both ways',
    body: 'Flip the map. A PLA amphibious group crossing to Taichung sails into Taiwan\'s own anti-ship umbrella, drone belt and minefield. The profile under the map shows how many hours of the crossing are spent under fire.',
    set: { mode: 'crossing', red: { route: 1, t: 0.6, free: null }, rc: { ...RC0, drones: true, mines: true }, zoom: 'strait' } },
  { title: 'Suppression versus survival',
    body: 'The PLA answer is to strike Taiwan\'s radars and patrol aircraft first and hunt its launchers. Dispersed, hidden launchers survive that campaign far better than fixed sites.',
    set: { mode: 'crossing', red: { route: 1, t: 0.6, free: null }, rc: { ...RC0, radar: true, mpa: true, supp: 0.6, disperse: true, drones: true, mines: true } } },
  { title: 'What TSM data shows',
    body: 'The last tab is the real record: daily PLA air and naval activity, joint combat readiness patrols, China Coast Guard incursions and allied transits from Taiwan Security Monitor trackers. Drag across the timeline to pick any window.',
    set: { mode: 'activity', range: '2026', zoom: 'region' } },
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
      <div class="tour-nav"><button type="button" class="ghost" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
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
  return { start, stop, active: () => i >= 0 };
}
