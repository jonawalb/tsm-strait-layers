// Guided walkthrough: each step sets a view state and scrolls to the part of the page it explains.
export const STEPS = [
  { title: 'Eight published games, one table',
    body: 'Each row is a scenario variant that a report scores on its own. The columns are the assumptions that shape a Taiwan wargame. The outcome column shows how the report scored its runs. Click a study name to open its card and sources.',
    set: { group: 'none', focus: [] }, target: 'matrix' },
  { title: 'Japan basing is the clearest driver',
    body: 'Grouped by Japan basing, no invasion run in which the U.S. could fight from Japan was scored an outright PLA victory, though the nuclear games left a PRC enclave in 5 of 15. The one CSIS run with Japan closed, "Ragnarok," was a PLA victory. CSIS built that run to find what China would need to win.',
    set: { group: 'japan', scen: ['invasion'], focus: ['fb-rag', 'fb-base'] }, target: 'matrix' },
  { title: 'Controlled comparisons carry the weight',
    body: 'Rows from different studies differ in many ways at once. The strongest evidence comes from one study changing one assumption. These notes list those comparisons for the grouping you picked.',
    set: { group: 'japan', scen: [], focus: ['lo-33', 'lo-33j'] }, target: 'drivers' },
  { title: 'U.S. entry, and when',
    body: 'Group by U.S. intervention. With no U.S. combat role, CSIS\'s invasion run and its blockade runs go China\'s way. Arms aid on the Ukraine model left Taiwan\'s imports at 1 percent of demand.',
    set: { group: 'us', scen: [], focus: ['fb-alone', 'lo-22u', 'lo-11'] }, target: 'matrix' },
  { title: 'Blockades behave differently',
    body: 'Filtered to blockade and quarantine games, U.S. convoys kept Taiwan supplied in the three U.S.-combat runs shown here, at high cost. The report has more runs than this table shows. Closing Japan made supply harder without collapsing it.',
    set: { group: 'japan', scen: ['blockade', 'quarantine'], focus: ['lo-33j'] }, target: 'matrix' },
  { title: 'Where the games part ways',
    body: 'The games agree on cost, Japan and the vulnerability of the amphibious fleet. They differ on how decisive the fighting is, on nuclear use and on striking the mainland. Every point links to the pages it summarizes.',
    set: { group: 'japan', scen: [], focus: [] }, target: 'findings' },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour'; card.hidden = true;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Guided walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set, s.target);
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
  const stop = () => { card.hidden = true; i = -1; apply(null); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
