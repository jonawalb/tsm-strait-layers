// Guided walkthrough: fixed view states with short explanations.
import { weekOf } from './model.js';

const STEPS = [
  { title: 'Rows are themes, columns are weeks',
    body: 'Each row is a theme defined by a keyword rule applied to the spokesperson\'s answer. Each column is one week. Darker cells mean more statements that week used that theme. Grey bands mark large PLA exercises.',
    set: { rangeKey: 'all', metric: 'count', sources: ['MFA', 'MND', 'TAO'], sel: null } },
  { title: 'August 2022: the warning spike',
    body: 'The week Speaker Pelosi landed in Taipei, the Foreign Ministry\'s answers filled with warnings and punishment language. The panel shows the actual sentences, with a link to each day\'s transcript.',
    set: { rangeKey: 'all', sel: { row: 9, w: weekOf('2022-08-01') } } },
  { title: 'November 2025: Japan becomes the target',
    body: 'After Japanese Prime Minister Takaichi\'s 7 November 2025 remarks in the Diet on a Taiwan contingency (as reporters described them at the briefings), Japan moved into Beijing\'s Taiwan answers and stayed for weeks, alongside claims about history and UN Resolution 2758.',
    set: { rangeKey: 'y25', sel: { row: 5, w: weekOf('2025-11-24') } } },
  { title: 'Search any phrase',
    body: 'Type a phrase, in English or Chinese, and the heatmap redraws for only the statements that contain it. The top row shows where the phrase itself appears. Try “play with fire” or 台独.',
    set: { rangeKey: 'all', phrase: 'play with fire' } },
  { title: 'Watch the seams',
    body: 'Dashed lines mark changes in how TSM collected the data: every Foreign Ministry Q&A from 2026, Taiwan Affairs Office releases from April 2026, and all three Defense Ministry channels from May 2026. Switch to share to compare across them.',
    set: { rangeKey: 'y26', metric: 'share', sel: null } },
  { title: 'Each agency has its own register',
    body: 'Turn sources on and off. The Taiwan Affairs Office talks to Taiwan\'s public about compatriots and integration as much as it attacks Lai Ching-te. The Defense Ministry carries most of the PLA language.',
    set: { rangeKey: 'y26', metric: 'count', sources: ['TAO'], sel: { row: 11, w: weekOf('2026-05-11') } } },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
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
