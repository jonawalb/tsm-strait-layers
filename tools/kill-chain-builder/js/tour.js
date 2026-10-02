// Guided walkthrough: a fixed sequence of board states with short explanations.
export const STEPS = [
  { title: 'A kill chain is a path',
    body: 'Sensors on the left report through command nodes in the middle to shooters on the right. A chain closes when one path passes every step: find, fix, track, target, engage. The highlighted links are the fastest path that closes.',
    set: { preset: 'pla' } },
  { title: 'Two sensors make one aim point',
    body: 'The satellite fixes the carrier precisely, but its imagery is over an hour old by the time a missile arrives. The over-the-horizon radar is coarse but current. Together they keep the aim point inside the seeker basket. Read the timeline under the board.',
    set: { preset: 'pla', sel: 1 } },
  { title: 'Break the track',
    body: 'Knock out the radar. The satellite can still fix the carrier, but at 30 knots the ship has moved about 66 km by impact, well outside a 40 km basket. The missiles are still in range; the chain fails at Track.',
    set: { preset: 'pla', dead: [1] } },
  { title: 'Close in, the chain is short',
    body: 'Taiwan\'s coastal chain is fast: radar and drone reports reach a local command that fires within minutes, and a slow amphibious group barely moves. But every path runs through one command post, marked as a single point of failure.',
    set: { preset: 'twn' } },
  { title: 'One strike, no chain',
    body: 'Knock out the local command and both sensors and both launchers are cut off. Redundant sensors and shooters do not help when they share one node.',
    set: { preset: 'twn', dead: [2] } },
  { title: 'A mesh against a fleeting target',
    body: 'A mobile launcher stays located for about 20 minutes. Paths through the theater headquarters, or from the satellite, take too long. Drones and the AEW aircraft feed aircraft directly over datalinks, giving two independent paths.',
    set: { preset: 'mesh' } },
  { title: 'Mesh resilience',
    body: 'Knock out a datalink. One path survives through the other link, so the chain still closes. The count of independent paths tells you how many nodes an adversary must hit to break the chain.',
    set: { preset: 'mesh', dead: [5] } },
  { title: 'Build your own',
    body: 'Drag nodes from the palette, connect them from the round ports, and change the target. Every number is notional; the point is the structure. Use Strike to test what you built.',
    set: { preset: 'mesh' } },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'Guided walkthrough');
  root.insertBefore(card, root.querySelector('.boardbox'));
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Walkthrough ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.title}</h3><p>${s.body}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const n = i + Number(b.dataset.d);
      if (n >= STEPS.length) stop(); else { i = n; show(); }
    });
    card.querySelector('.solid').focus({ preventScroll: true });
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
