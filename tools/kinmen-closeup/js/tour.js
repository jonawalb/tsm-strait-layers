// Guided walkthrough; counts come from the data.
import { INC, FIXES, AIS, hullCounts, niceLong } from './model.js';

export function steps() {
  const y = yr => INC.filter(i => i.year === yr).length;
  const top = hullCounts(INC).slice(0, 3);
  const entries = INC.filter(i => i.hEntry != null);
  const morning = entries.filter(i => i.hEntry >= 6 && i.hEntry < 12).length;
  const night = entries.filter(i => i.hEntry < 6 || i.hEntry >= 18).length;
  const aft = entries.filter(i => i.hEntry >= 12 && i.hEntry < 18).length;
  const pairs = INC.filter((i, k) => k && Math.abs(Date.parse(i.date) - Date.parse(INC[k - 1].date)) <= 864e5).length;
  const sep8 = INC.filter(i => i.date === '2026-09-08');
  const inside = FIXES.filter(f => f.zone).length;
  return [
    { title: 'The waters Taiwan claims to control', year: 'all', date: '2024-06-24', waters: true,
      body: 'The blue line is the limit of Kinmen\'s restricted waters and the red line the prohibited waters, drawn from the vertices the Mainland Affairs Council printed for the Defense Ministry\'s 2004 announcement. Both run close to the Xiamen coast on the west. PRC ships need permission to enter them under Taiwan\'s cross-strait relations act.' },
    { title: 'A regular rhythm', year: '2024', date: '2024-12-31',
      body: `TSM's tracker starts at Kinmen in June 2024 with formations of four China Coast Guard ships entering the restricted waters for about two hours. It records ${y('2024')} Kinmen incidents in 2024, ${y('2025')} in 2025 and ${y('2026')} so far in 2026.` },
    { title: 'The same hulls come back', year: 'all', date: '2026-09-28', hull: top[0][0],
      body: `The panel counts hull numbers across incidents. ${top.map(([h, n]) => `${h} appears in ${n}`).join(', ')}. Click a hull to see which incidents it joined; other pins fade.` },
    { title: 'Daylight hours', year: 'all', date: '2026-09-28',
      body: `${entries.length} incidents record a clock time for entering the waters. ${morning} fall between 06:00 and noon, ${aft} between noon and 18:00, and ${night} at night (18:00 to 06:00). Switch the chart to "first time recorded" to include detections.` },
    { title: 'Back-to-back days', year: '2026', date: '2026-09-11', pick: sep8[1]?.k,
      body: `${pairs} incidents came within a day of the previous one. On September 8, 2026 the CGA reported two separate intrusions by the same four hulls, then the same formation on September 10 and 11. The incident cards link each CGA release.` },
    { title: 'What AIS shows, and does not', year: 'all', date: '2026-09-28', ais: true,
      body: `Squares are AIS fixes from PRC-flag vessels in this map box from TSM's live AIS window (${niceLong(AIS.t0.slice(0, 10))} to ${niceLong(AIS.t1.slice(0, 10))}): ${FIXES.length} fixes from ${new Set(FIXES.map(f => f.mmsi)).size} vessels, ${inside} inside the restricted waters, and none identified as China Coast Guard. Receiver coverage here is thin, and the tracker notes at least one incursion in which the CCG ships had switched off AIS. None of the ${INC.filter(i => i.date >= AIS.t0.slice(0, 10)).length} Kinmen incidents in the AIS window shows up in these fixes.` },
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
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const n = i + Number(b.dataset.d); if (n >= STEPS.length) stop(); else { i = n; show(); } });
    card.querySelector('.solid').focus();
  };
  const start = () => { STEPS = steps(); i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
