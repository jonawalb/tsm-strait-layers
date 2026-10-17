// Guided walkthrough: a fixed sequence of views with short explanations. Figures come from data/cases.js.
import { summary, byKey, fmtM, fmtD } from './model.js';
import { LATEST } from './mdata.js';
import { UNIVERSE, ALT } from '../data/cases.js';

const ALLC = ['Traditional', 'Asymmetric', 'Munitions'];
const base = { cats: ALLC, status: 'all', sort: 'tier', gone: false, view: 'notified' };

function steps() {
  const sm = summary(), U = UNIVERSE.by;
  const f16 = byKey['f16-2025'], boats = byKey['boats-2020'];
  const nnaN = sm.nTier.nna;
  return [
    { title: 'Two numbers, not one',
      body: `Only ${fmtM(sm.totals.contracted)} of U.S. arms sales to the Philippines is under a signed Letter of Offer and Acceptance and not yet delivered. Another ${fmtM(sm.totals.nna)} was notified to Congress but never accepted. The tracker keeps them apart.`,
      set: { ...base, sel: boats.key } },
    { title: 'The contracted backlog is one case',
      body: `The ${fmtD(boats.notified)} riverine boats case was notified at ${fmtM(boats.m)}. Manila cut it to fit its budget and signed for ₱${(boats.signed.php / 1e9).toFixed(2)} billion. Deliveries have begun. The solid stretch of its bar starts at the first funding release, because the LOA date is not public.`,
      set: { ...base, status: 'contracted', sel: boats.key } },
    ...(f16.gone ? [] : [{ title: `${fmtM(f16.m)} that was never signed`,
      body: `The 2025 F-16 case is ${Math.round(f16.m / sm.totals.nna * 100)}% of the notified-not-accepted tier. The U.S. offered an LOA at $4.05 billion in June 2025; it expired unsigned, and the State Department now lists the case as withdrawn. It stays in this tier because a notification does not expire; without it the tier would be ${ALT ? fmtM(ALT.nna_without_f16) : 'smaller'}.`,
      set: { ...base, status: 'nna', sort: 'value', sel: f16.key } }]),
    { title: 'A notification is permission, not a purchase',
      body: `Of ${UNIVERSE.n} sales notified since 2014, ${fmtM(U.delivered.m)} was delivered and ${fmtM(U.dead.m)} died: two attack-helicopter options lost to Turkey's T129, and a 2021 F-16 case overtaken by the 2025 one.`,
      set: { ...base, sel: f16.key, scroll: 'totalbox' } },
    { title: 'Where the money would come from',
      body: `Two of the ${nnaN} notified-not-accepted cases, the TH-73A and Bell 505 trainer helicopters, would be paid with U.S. Foreign Military Financing. The rest name Philippine national funds.`,
      set: { ...base, status: 'nna', sel: 'bell505-2026' } },
    { title: 'Month by month, from March 2026',
      body: 'The panel at the top is the monthly record. Contracted wedges are green, notified-not-accepted wedges grey, and the table gives each tier its own subtotal. A case moves tiers only when a source shows a signed LOA.',
      set: { ...base, sel: boats.key, month: LATEST, scroll: 'monthview' } },
    { title: 'What is left out, and why',
      body: 'Delivered and dead cases, Black Hawks and C-130Js bought outside FMS, and records that turned out to be other countries\' sales are listed below the timeline with their sources.',
      set: { ...base, sel: boats.key, scroll: 'excluded' } },
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
