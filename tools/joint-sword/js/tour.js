// Guided walkthrough: a fixed sequence of views with short explanations.

export const STEPS = [
  { title: 'August 2022: the template',
    body: 'Two days before the drills, Xinhua published six closure zones with exact coordinates. Here they are announced but not yet in force. Press Play or drag the slider to move day by day.',
    set: { view: 'replay', x: 'aug-2022', k: -2, m: 'air' } },
  { title: 'Zones in force',
    body: 'On Aug. 4 the zones took effect and the PLA fired ballistic missiles into them. TSM daily counts start on Aug. 6, so the first days show "no TSM data"; the panel gives the peaks reported at the time.',
    set: { view: 'replay', x: 'aug-2022', k: 2, m: 'air' } },
  { title: 'Named, but no coordinates',
    body: 'For Joint Sword-2024A the Eastern Theater Command announced zones around Taiwan and its outlying islands but published no coordinates, so the map draws none. The aircraft count rose on both exercise days, then fell back within a day.',
    set: { view: 'replay', x: 'joint-sword-2024a', k: 1, m: 'air' } },
  { title: 'One day, a record count',
    body: 'Joint Sword-2024B lasted about 13 hours. Taiwan reported a record 153 aircraft in the 25 hours to 06:00 the next morning; TSM\'s daily record puts that count on the exercise day.',
    set: { view: 'replay', x: 'joint-sword-2024b', k: 0, m: 'air' } },
  { title: 'Justice Mission-2025',
    body: 'Seven zones, published the morning before the live-fire day. Its stated subjects included blockading key ports, and Taiwan reported rockets landing inside its contiguous zone.',
    set: { view: 'replay', x: 'justice-mission-2025', k: 1, m: 'air' } },
  { title: 'Compare the shapes',
    body: 'Overlay exercises on day 0. Switch to "× usual level" to scale each by its prior 30 days. Watch how quickly each returns to normal, then ask whether that looks more like rehearsal or performance.',
    set: { view: 'compare', picks: ['dec-2022', 'joint-sword-2023', 'joint-sword-2024a', 'joint-sword-2024b', 'strait-thunder-2025a', 'justice-mission-2025'], norm: true } },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Step ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
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
