// Guided walkthrough. Each step sets a window, filters or ship, and explains it. Counts come from the data.
import { ROWS, MONTHS, MND, STRAIT, HULLS, nice, monthName } from './model.js';

const mi = ym => MONTHS.indexOf(ym);

export function steps() {
  const n = ROWS.length;
  const by = k => ROWS.filter(r => r.strait === k).length;
  const rels = new Set(ROWS.map(r => r.rel)).size;
  const miy = by('miyako');
  const loop = HULLS.get('LY3:134').rows.map(i => ROWS[i]).filter(r => r.date >= '2025-07');
  const dec = ROWS.filter(r => r.ym === '2025-12');
  const jm = ROWS.filter(r => r.date >= '2025-12-27' && r.date <= '2025-12-30');
  const monthly = MONTHS.map(ym => ({ ym, n: ROWS.filter(r => r.ym === ym).length }));
  const topJ = monthly.slice().sort((a, b) => b.n - a.n)[0];
  const topM = MND.filter(m => m.mean != null).sort((a, b) => b.mean - a.mean)[0];
  const jul26 = HULLS.get('RH:103').rows.map(i => ROWS[i]).filter(r => r.date >= '2026-07');
  const empty = monthly.filter(m => m.n === 0).map(m => monthName(m.ym));
  return [
    { title: 'What Japan reports', end: MONTHS.length - 1, span: 99, hull: null,
      body: `Japan's Joint Staff Office published ${rels} releases from January 2025 to September 2026 that record PLA Navy ships crossing a strait or channel through Japan's islands. This tool turns them into ${n} crossings. Each arrow points the way the ships went, and its thickness grows with the number of crossings.` },
    { title: 'The Miyako Strait carries most of the traffic', end: MONTHS.length - 1, span: 99, hull: null, pick: ROWS.filter(r => r.strait === 'miyako').at(-1).i,
      body: `${miy} of the ${n} crossings, ${Math.round(miy / n * 100)} percent, went through the Miyako Strait between Okinawa and Miyako Island. Osumi (${by('osumi')}) and Tsushima (${by('tsushima')}) come next. Japan reported only ${by('yonaguni_taiwan')} crossings between Yonaguni and Taiwan.` },
    { title: 'One destroyer, one loop around Japan', end: mi('2025-08'), span: 2, hull: 'LY3:134',
      body: `Luyang III destroyer 134 and replenishment ship 886 went northeast through the Tsushima Strait on ${nice(loop[0].date)}, east through the Soya Strait with a Russian destroyer on ${nice(loop[1].date)}, and back into the East China Sea through the Miyako Strait on ${nice(loop[2].date)}. Pick any ship in the panel to trace its crossings.` },
    { title: 'December 2025: a carrier and an exercise', end: mi('2025-12'), span: 1, hull: null, ep: true, pick: dec.find(r => r.ships.some(s => s[0] === 'CV'))?.i,
      body: `Japan reported ${dec.length} crossings in December 2025, including the carrier Liaoning going out through the Miyako Strait on December 6 and back on the 12th. Of these, ${jm.length} were Miyako crossings between December 27 and 30, around the Justice Mission-2025 exercise, by two frigates and a destroyer. The releases do not mention the exercise.` },
    { title: 'Set against Taiwan\'s daily counts', end: MONTHS.length - 1, span: 99, hull: null,
      body: `The line on the timeline is Taiwan's Ministry of National Defense count of PLA Navy ships around Taiwan, averaged by month. It peaked in ${monthName(topM.ym, true)} at ${topM.mean.toFixed(1)} ships a day. Japan's busiest month was ${monthName(topJ.ym, true)} with ${topJ.n} crossings. The two measure different things: ships near Taiwan on a given day against ships passing Japan's straits.` },
    { title: 'Summer 2026: sailing with Russia', end: mi('2026-08'), span: 2, hull: 'RH:103', ep: true,
      body: `Renhai destroyer 103, Luyang III destroyer 124 and replenishment ship 903 sailed with a Russian frigate from the Miyako Strait on ${nice(jul26[0].date)}, up Japan's Pacific coast and west through the Soya Strait. The three Chinese ships then left through the Tsushima Strait on ${nice(jul26.at(-1).date)}. Diamonds mark the positions Japan reported on the way.` },
    { title: 'What is missing', end: MONTHS.length - 1, span: 99, hull: null,
      body: `Japan publishes what its forces detect and chooses to announce. No crossings were released for ${empty.join(', ')}. Ships Japan did not detect or did not announce are missing, and no submarine crossings appear. Only five crossings between Yonaguni and Taiwan were released. Treat the counts as a floor.` },
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
export { STRAIT };
