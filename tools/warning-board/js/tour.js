// Guided walkthrough: six board states with short explanations.
export const STEPS = [
  { title: 'A quiet year is not a blank board',
    body: 'Even with no crisis, some indicators are lit: amphibious shipbuilding, legal revisions, cyber access in infrastructure. They show capability and intent over years, but they say little about timing.',
    set: { preset: 'routine', timing: 'months' } },
  { title: 'An exercise lights up the board',
    body: 'A two-day Joint Sword-type drill adds closure zones, forward deployments, coast guard massing, red-line rhetoric and civilian ferries. The military and political gauges jump.',
    set: { preset: 'exercise', timing: 'days' } },
  { title: 'But the pattern is exercise-shaped',
    body: 'About half of the weighted signal comes from indicators that exercises routinely produce. What is missing matters more: no stop-loss, no mobilization order, no asset repatriation, no blood drives.',
    set: { preset: 'exercise', timing: 'days' }, focus: 'overlap' },
  { title: 'Short events are hard to see',
    body: 'Each exercise charted below ran one to four days by its announced or reported dates. A TSM-affiliated working paper argues that satellite imagery of PLA bases cannot reliably catch surges that short, which makes base imagery a surveillance tool more than a warning tool.',
    set: { preset: 'exercise', timing: 'days' }, focus: 'exercises' },
  { title: 'Preparation looks different',
    body: 'In this invented case, slow and costly preparations appear in every domain and build over weeks: stop-loss, mobilization, blood drives, asset repatriation, public messaging about sacrifice. The combination supports strategic warning.',
    set: { preset: 'preconflict', timing: 'weeks' } },
  { title: 'Timing still matters',
    body: 'Compress the same signals into a few days and the board stops short of strategic warning. An analyst would first ask whether this is a short-notice exercise or deliberate surprise, and look for signals that persist.',
    set: { preset: 'preconflict', timing: 'days' } },
];

export function createTour(apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided walkthrough');
  document.body.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set, s.focus);
    card.innerHTML = `<div class="tour-h"><span>Walkthrough ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
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
  const stop = () => { card.hidden = true; i = -1; apply(null, null); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
