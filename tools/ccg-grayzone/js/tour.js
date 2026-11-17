// Short guided walkthrough. Each step picks a year window and slider date (and optionally an incident)
// and explains it. Counts in the text are computed from the data, not typed in.
import { INC, LOC, niceLong, nice } from './model.js';

const count = f => INC.filter(f).length;
const byYear = (y, loc) => count(i => i.year === y && (!loc || i.loc === loc));
const find = f => INC.find(f);

export function steps() {
  const js = find(i => i.major.startsWith('Joint Sword'));
  const dec = find(i => i.major === 'East Coast of Taiwan');
  const dong = find(i => i.loc === 'Dongsha');
  const jm = INC.filter(i => i.major.startsWith('Justice Mission'));
  const jun26 = new Set(INC.filter(i => i.ym === '2026-06').map(i => LOC[i.loc].label));
  const east26 = INC.filter(i => i.loc === 'East of Taiwan' && i.year === '2026');
  const lastEast = east26.at(-1);
  const md = i => nice(i.date, { month: 'long', day: 'numeric' });
  return [
    { title: 'Kinmen sets the pattern', year: '2024', date: '2024-09-30',
      body: `The tracker starts in June 2024. Most rows are Kinmen: formations of four China Coast Guard ships entering restricted waters for about two hours, sometimes twice in one day. It holds ${byYear('2024')} incidents for 2024, ${byYear('2024', 'Kinmen')} of them at Kinmen.` },
    { title: 'Exercise days', year: '2024', date: '2024-12-31', pick: dec?.id,
      body: `The tracker files some rows as major incidents. On ${js ? niceLong(js.date) : 'one exercise day'}, during Joint Sword 2024B, it records CCG ships in Matsu's restricted waters and a CCG circuit of Taiwan that did not enter restricted waters. On ${dec ? nice(dec.date, { month: 'long', day: 'numeric' }) : 'December 6'} it records CCG ships off Taiwan's east coast through the 9th.` },
    { title: 'Dongsha becomes a regular', year: '2025', date: '2025-09-30', pick: dong?.id,
      body: `Dongsha first appears on March 12, 2025, when CCG ships entered its restricted waters after the CGA boarded Chinese fishing boats. By the end of 2025 the tracker holds ${byYear('2025', 'Dongsha')} Dongsha incidents, against ${byYear('2025', 'Kinmen')} at Kinmen.` },
    { title: 'Justice Mission-2025', year: '2025', date: '2025-12-31', pick: jm.at(-1)?.id,
      body: `The year closes with Justice Mission-2025. The tracker records ${jm.map(i => `${parseInt(i.vessels, 10)} CCG ships on ${nice(i.date, { month: 'long', day: 'numeric' })}`).join(' and ')} in the waters around Taiwan.` },
    { title: '2026: the gray zone spreads', year: '2026', date: '2026-06-30',
      body: `In June 2026 the tracker records incidents at ${jun26.size} locations: ${[...jun26].join(', ')}. The Taiping Island row lists Sansha law-enforcement ships and the Southwest of Taiwan row lists Haixun and other non-CCG ships, as recorded.` },
    { title: 'East of Taiwan keeps coming back', year: '2026', date: lastEast.date, pick: lastEast.id,
      body: `After ${md(east26[0])}, 2026, the tracker records CCG ships east of Taiwan again on ${east26.slice(1).map(md).join(', ').replace(/, ([^,]*)$/, ' and $1')}. The September 3 card links the CGA release that names the two ships, 1306 Putuoshan and 2502 Daishan.` },
    { title: 'Compare the years', year: 'all', date: null,
      body: 'Switch between all years and a single year with the year buttons, press play, or filter by location. Amber tags mark data notes, and green links point to CGA releases checked by hand. Pins sit at approximate positions around each location, never at exact coordinates.' },
  ];
}

export function createTour(root, apply) {
  let i = -1, STEPS = [];
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided walkthrough');
  root.appendChild(card);
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const show = () => {
    const s = STEPS[i];
    apply(s);
    card.innerHTML = `<div class="tour-h"><span>Walkthrough ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${esc(s.title)}</h3><p>${esc(s.body)}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const n = i + Number(b.dataset.d);
      if (n >= STEPS.length) stop(); else { i = n; show(); }
    });
    card.querySelector('.solid').focus();
  };
  const start = () => { STEPS = steps(); i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
