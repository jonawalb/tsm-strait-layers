// Guided walkthrough: six steps that set the packet and explain what changed.
const ALL = ['sum', 'chart', 'ccg', 'tr', 'ex', 'st', 'ais'];

export const STEPS = [
  { title: 'A packet for one month',
    body: 'The builder opens on the latest complete month. The preview on the left is the packet itself: a cover, then numbered US Letter pages, laid out as they will print.',
    set: { r: { kind: 'm', m: '2026-08' }, secs: ALL, cap: 8, focus: 'sec-range' } },
  { title: 'Summary against the prior period',
    body: 'The first section totals Taiwan MND\'s daily reports for the range and compares each daily average with the same number of days just before it. The chart below it marks patrols, coast guard incidents and allied transits day by day.',
    set: { focus: 'preview' } },
  { title: 'An exercise window',
    body: 'Pick a listed PLA exercise and the range becomes its dates plus a few days on each side. Justice Mission-2025 brings in its trigger, zones, reported peaks and dated statements, each with a link.',
    set: { r: { kind: 'ex', id: 'justice-mission-2025', pad: 3 }, secs: ALL, focus: 'sec-range' } },
  { title: 'PRC statements, by a fixed rule',
    body: 'Official answers from the Foreign Ministry, Defense Ministry and Taiwan Affairs Office are picked by a published rule and quoted word for word from their English text, which is labeled as official, TSM or machine translation, with a link to the transcript. Choose how many to include.',
    set: { cap: 6, focus: 'sec-opts' } },
  { title: 'AIS for September 2026',
    body: 'The last seven days overlap TSM\'s live AIS window (Sept. 4–28, 2026), so the packet adds an AIS summary. For other ranges that switch is dimmed and the section is left out.',
    set: { r: { kind: '7d' }, secs: ALL, focus: 'sec-secs' } },
  { title: 'Print, download, share',
    body: 'Download PDF makes a file in one click; Print gives sharper, searchable text through "Save as PDF". The address bar holds every setting, so a copied link rebuilds the same packet.',
    set: { focus: 'sec-out' } },
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
    card.querySelector('.solid').focus({ preventScroll: true });
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
