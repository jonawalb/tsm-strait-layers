// Guided walkthrough for the decoder.
const STEPS = [
  { title: 'Paste or pick a statement',
    body: 'Here is a Defense Ministry answer from 9 June 2026. Every recurring formula the dictionary knows is highlighted in place, shaded by tier: pale for routine positions, dark for threats and force.',
    run: a => { a.loadSample(2); a.setTier(0); a.select('by-force'); } },
  { title: 'Hover for the gloss, click for the record',
    body: 'Each highlight has a tooltip with the Chinese original and a gloss. Click one and the panel shows what the formula has signalled, how often TSM has seen it, and dated examples linked to the transcripts.',
    run: a => a.select('by-force') },
  { title: 'Temperature is a rule, not a verdict',
    body: 'The temperature takes the highest tier found and adds half a point for each extra warning-or-stronger formula, up to one point. The rule is shown under the gauge so you can check it against the text.',
    run: a => a.select('doomed') },
  { title: 'Chinese works too',
    body: 'This is a Taiwan Affairs Office answer in the original Chinese. The dictionary matches 决不承诺放弃使用武力 (never promise to renounce force) next to 九二共识, the persuasion and the threat in one paragraph.',
    run: a => { a.loadSample(3); a.select('never-renounce'); } },
  { title: 'Browse by tier',
    body: 'Filter the dictionary to one tier. Threat-tier formulas such as countermeasures and punishment are rarer than warnings, and the bars show when they were used, per 100 Taiwan-related statements.',
    run: a => { a.setTier(4); a.select('countermeasures'); } },
  { title: 'Read presence and absence',
    body: 'Baseline phrases like the one-China principle appear in about a third of Taiwan-related answers, so they tell you little on their own. What moves is the mix: a statement heavy with tier 4 and 5 formulas, or one that drops them, is the signal.',
    run: a => { a.setTier(0); a.select('one-china'); } },
];

export function createTour(root, api) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    s.run(api);
    card.innerHTML = `<div class="tour-h"><span>Walkthrough ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.title}</h3><p>${s.body}</p>
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
