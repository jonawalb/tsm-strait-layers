// Guided walkthrough: a fixed sequence of views with short explanations. Figures come from data/cases.js.
import { summary, byKey, fmtB, fmtAge, fmtD } from './model.js';
import { LATEST } from './mdata.js';

const ALLC = ['Traditional', 'Asymmetric', 'Munitions'];
const base = { cats: ALLC, status: 'all', sort: 'age', gone: false, view: 'vintage' };

function steps() {
  const sm = summary();
  const f35 = byKey.f35, aw = byKey.awacs_mcu;
  return [
    { title: `US$${(sm.total / 1000).toFixed(1)} billion, sold but not delivered`,
      body: `That is the notified value of ${sm.n} U.S. arms sales to Japan that Congress has been told of and Japan has not fully received. Each row below is one case. The bar runs from the notification date to the data date.`,
      set: { ...base, sort: 'value', sel: 'f35' } },
    { title: 'One case is two-fifths of the total',
      body: `The July 2020 F-35 case for 63 F-35A and 42 F-35B is ${fmtB(f35.m)}, ${Math.round(f35.m / sm.total * 100)}% of the backlog. 54 of the 147 F-35s Japan plans to buy were in service on March 31, 2026, so deliveries under this case have begun.`,
      set: { ...base, sort: 'value', sel: 'f35' } },
    { title: 'Deliveries under way',
      body: `Orange marks the ${sm.delivN} cases where some equipment has arrived: ${sm.deliv.map(c => c.name).join('; ')}. A case's full value stays in the total until its last item arrives, so the headline overstates what is still owed.`,
      set: { ...base, status: 'delivering', sel: 'tomahawk' } },
    { title: `A 2013 case still running to ${aw.expect ? aw.expect.d.slice(0, 4) : 'today'}`,
      body: `The E-767 AWACS computer upgrade was notified in September 2013, ${fmtAge(aw.age)} ago. One of four aircraft has been returned. A March 2025 contract change put completion at Dec. 23, 2028; the contract's current end date is ${aw.expect ? fmtD(aw.expect.d) : 'not public'}.`,
      set: { ...base, sort: 'age', sel: 'awacs_mcu' } },
    { title: 'Aegis Ashore became the ASEV',
      body: 'Japan cancelled the land-based Aegis Ashore in June 2020, but the sale survived. Two amendments added shipboard equipment and test targets for the Aegis System Equipped Vessels, raising the case from $2.15 billion to $3.39 billion.',
      set: { ...base, status: 'amended', sel: 'aegis_ws' } },
    { title: 'The amendments channel',
      body: 'Triangles mark Section 36(b)(5)(C) amendments. They appear only in the Federal Register, not in DSCA\'s list of sales, and they can add value to old cases: the RQ-4 support increment alone added $1.61 billion in 2025.',
      set: { ...base, status: 'amended', sel: 'rq4_cls' } },
    { title: 'How the backlog piled up',
      body: 'This chart stacks today\'s open cases by notification date. It is not a history of the backlog: Japan has no published monthly backlog total, and cases already delivered are not in it.',
      set: { ...base, sel: 'f35', scroll: 'totalbox' } },
    { title: 'Month by month, from March 2026',
      body: 'The panel at the top shows the tracker\'s own monthly record, starting with March 2026. Select a wedge to filter the table, or a case for its record. The excluded and unresolved cases are listed further down the page.',
      set: { ...base, sel: 'tomahawk', month: LATEST, scroll: 'monthview' } },
  ];
}

export function createTour(apply) {
  let i = -1;
  const STEPS = steps();
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Walkthrough');
  document.body.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Step ${i + 1} of ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
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
