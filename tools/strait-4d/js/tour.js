// Guided walkthrough: each step sets a day, a preset and a camera.
export const STEPS = [
  { title: 'The Strait in four dimensions',
    body: 'Every layer here comes from data Taiwan Security Monitor already holds. Drag to pan, Shift-drag (or two fingers) to tilt and turn, and scroll to zoom. The timeline below runs from August 2022 to the latest MND report.',
    set: { d: '2026-09-17', cam: { yaw: -14, pitch: 48, zoom: 0.95, tx: 20, ty: -45 } } },
  { title: 'August 2022: zones announced',
    body: 'Two days before the drills, six closure zones were published with coordinates. Dashed outlines are announced zones that are not yet in force.',
    set: { preset: 'aug-2022', d: '2022-08-03', cam: { yaw: -8, pitch: 46, zoom: 1.25, tx: 60, ty: 0 } } },
  { title: 'Zones in force, sectors lit',
    body: 'Raised red blocks are zones in force. Lower red slabs are the ADIZ sectors that MND named that day; their height follows the day\'s ADIZ count, which MND does not split by sector.',
    set: { preset: 'joint-sword-2023', d: '2023-04-10', cam: { yaw: -20, pitch: 54, zoom: 1.2, tx: 40, ty: 40 } } },
  { title: 'A one-day record',
    body: 'Joint Sword-2024B lasted about 13 hours. The red dot on the timeline marks a day far above its trailing baseline. Use "Next anomaly" to step through such days across the whole record.',
    set: { preset: 'joint-sword-2024b', d: '2024-10-14', cam: { yaw: 12, pitch: 50, zoom: 1.15, tx: 40, ty: 0 } } },
  { title: 'Coast guard pressure',
    body: 'Pink pins are China Coast Guard incidents from TSM\'s CGA-sourced tracker. Columns are monthly vessel-days of watchlist coast guard (pink) and militia (amber) ships from Global Fishing Watch events.',
    set: { preset: 'justice-mission-2025', d: '2025-12-29', cam: { yaw: -30, pitch: 56, zoom: 1.05, tx: -40, ty: -60 } } },
  { title: 'What Beijing said that week',
    body: 'The bottom lanes of the timeline show how much PRC official and state-media records mention Taiwan each week. The panel lists the day\'s records with links, and quotes official sentences only.',
    set: { preset: 'strait-thunder-2025a', d: '2025-04-01', cam: { yaw: -14, pitch: 48, zoom: 0.95, tx: 20, ty: -45 } } },
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
