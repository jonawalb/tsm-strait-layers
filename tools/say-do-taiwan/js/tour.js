// Guided walkthrough and default view, per config (shared verbatim by say-do-taiwan and say-do-global).

export const DEFAULTS = {
  taiwan: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'air', r: 'week', w: 'all' },
  global: { s: 'telegram_ru|ru|all', k: 'stance:UKRAINE:threat', b: 'ua_total', r: 'week', w: 'all' },
};

export const STEPS = {
  taiwan: [
    { title: 'Say, then do?', body: 'The top panel is how often Foreign Ministry press conferences mentioned Taiwan each week. The bars below are PLA aircraft per day around Taiwan, from Taiwan MND. The question: do rises in what Beijing says come before rises in what the PLA does?',
      set: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'air', r: 'week', w: 'all' }, focus: '#verdict' },
    { title: 'Together is not before', body: 'In the lead-lag chart, the bar at 0 is clearly positive: talk about Taiwan and PLA flights rise in the same week, usually because both answer the same event. The bars to the right, where rhetoric comes first, are small. Same-week movement is not a forecast.',
      set: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'air', r: 'week', w: 'all' }, focus: '.tests' },
    { title: 'Read the spike weeks', body: 'Triangles mark spike weeks: the series\' biggest rises over its own 12-week baseline. The open week in the list shows what was said. Official sentences are quoted; state-media items show only the headline and a link.',
      set: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'exer', r: 'week', w: 'all' }, focus: '#spikes', openSpike: true },
    { title: 'Event study with pre-trends', body: 'The event study lines up the spikes and asks how far behaviour moved from the weeks before a spike to the weeks after. The left shaded block is the pre-trend. If behaviour was already climbing before the spike, the rhetoric did not start it.',
      set: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'exer', r: 'week', w: 'all' }, focus: '.tests' },
    { title: 'Short series need more caution', body: 'China Coast Guard counts start in mid-2024, so this pair has about 117 weeks. For series under 150 periods the page uses the larger of the model p-value and a permutation p-value, which is why a strong-looking regression does not pass.',
      set: { s: 'mfa_cn|en|all', k: 'stance:TAIWAN:conciliation', b: 'ccg', r: 'week', w: 'all' }, focus: '#verdict' },
    { title: 'Correct for the hundreds of tests', body: 'Every pair, measure and test in a view is one family. The panel at the bottom counts how many tests pass p < 0.05 against how many would pass by chance, and lists the few that survive Benjamini–Hochberg. Here is one of the two daily survivors.',
      set: { s: 'mfa_cn|en|all', k: 'stance:US:conciliation', b: 'exer', r: 'day', w: 'all' }, focus: '.fam' },
    { title: 'Mostly, nothing', body: 'Switch to weekly data since 2025 and nothing survives correction. For PRC rhetoric and PLA activity around Taiwan, the honest reading is that public statements are a weak guide to what comes next.',
      set: { s: 'prc_statemedia_headlines|en|all', k: 'tone:threat', b: 'air', r: 'week', w: '2025' }, focus: '.fam' },
  ],
  global: [
    { title: 'Say, then do?', body: 'The top line is the threat tone of sentences that mention Ukraine on Maria Zakharova\'s and Dmitry Medvedev\'s Telegram channels (archived copies, not every post). The bars are Russian missiles and drones launched at Ukraine per day, as the Ukrainian Air Force reported them. Do threats come before bigger strikes? Here there is no sign of it in this record: none of the three tests reaches p < 0.05.',
      set: { s: 'telegram_ru|ru|all', k: 'stance:UKRAINE:threat', b: 'ua_total', r: 'week', w: 'all' }, focus: '#verdict' },
    { title: 'A pair that survives, with a warning', body: 'Conciliatory sentences that mention the U.S., on any subject, on the same channels were followed a week later by more launches at Ukraine (lead-lag r = +0.33 at +1 week; r runs from −1 to 1). Two tests survive correction across the 1,912 weekly tests. But the event study has only 4 spikes, so it is not tested, and launches were already +17.75 a day above baseline before those spikes, then rose a further +18.99 after them, so the later rise may continue a climb already under way (too few spikes to test this). Read it as an association in the record, not intent.',
      set: { s: 'telegram_ru|ru|all', k: 'stance:US:conciliation', b: 'ua_total', r: 'week', w: 'all' }, focus: '.tests' },
    { title: 'Read the spike weeks', body: 'The open week shows what was said. This one is about dialogue between Washington and Caracas: the measure counts any conciliatory sentence that mentions the U.S., not only sentences about Ukraine. Official sentences are quoted up to 300 characters in the original language, untranslated, with a link; media items show only the headline and a link. Posts in which the channel quotes an opponent (for example a Ukrainian minister) are left out of this list, but the tone model still scores them.',
      set: { s: 'telegram_ru|ru|all', k: 'stance:US:conciliation', b: 'ua_drones', r: 'week', w: 'all' }, focus: '#spikes', openSpike: true },
    { title: 'Outcomes are not actions', body: 'Ship transits through Hormuz measure what shipping did, not what Iran did. Iran\'s own actions cannot be tested here: its three direct attacks on Israel are too few for any test.',
      set: { s: 'iran_mfa_en|en|all', k: 'stance:ISRAEL:threat', b: 'hormuz', r: 'week', w: 'all' }, focus: '#beh-help' },
    { title: 'Venezuela: shown, not tested', body: 'No Venezuelan pair is tested. The Foreign Ministry corpus is thin before 2024 (338 texts in 2021, 112 in 2022) and the ACLED data end in September 2024, so rhetoric is present in only 11% of weeks here against the 50% the page requires. ACLED counts are weekly only, by licence.',
      set: { s: 'mppre_es|es|all', k: 'stance:US:hostility', b: 've_vac', r: 'week', w: 'all' }, focus: '#verdict' },
    { title: 'Correct for the many tests', body: 'This panel counts how many tests reach p < 0.05 against how many would even if nothing were related. In this view that is {chance}, more than a flat 5% because the distributed-lag test runs liberal on unrelated data. Since 2025, nothing survives correction at either resolution.',
      set: { s: 'kremlin_en|en|all', k: 'tone:threat', b: 'ua_missiles', r: 'day', w: '2025' }, focus: '.fam' },
  ],
};

/** Walkthrough. apply(view) sets a view; getView() returns the reader's current view so closing restores it.
 *  Each step scrolls to and outlines its target. The tour may show Full detail for a step, but never saves it. */
export function createTour(root, apply, getView, detail, fill) {
  const steps = STEPS[document.body.dataset.config] || [];
  let i = -1, saved = null, savedMode = null, lit = null;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Walkthrough');
  root.appendChild(card);
  const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const unlight = () => { if (lit) lit.classList.remove('tour-focus'); lit = null; };
  const light = async s => {
    unlight();
    const t = s.focus && document.querySelector(s.focus);
    if (!t) return;
    if (detail && t.closest('.full-only') && detail.mode() !== 'full') detail.set('full', false);
    lit = t;
    t.classList.add('tour-focus');
    t.scrollIntoView({ block: matchMedia('(max-width: 640px)').matches ? 'start' : 'center', behavior: smooth() });
  };
  const show = async () => {
    const s = steps[i];
    await apply({ ...s.set, openSpike: s.openSpike });
    card.innerHTML = `<div class="tour-h"><span>Step ${i + 1} / ${steps.length}</span><button type="button" class="x" aria-label="Close walkthrough and restore your view">×</button></div>
      <h3>${s.title}</h3><p>${fill ? s.body.replace(/\{(\w+)\}/g, (m, k) => fill(k, s.set) ?? m) : s.body}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === steps.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const n = i + Number(b.dataset.d);
      if (n >= steps.length) stop(); else { i = n; show(); }
    });
    card.querySelector('.solid').focus({ preventScroll: true });
    light(s);
  };
  const start = () => {
    if (!steps.length) return;
    if (i < 0) { saved = getView ? getView() : null; savedMode = detail ? detail.mode() : null; }
    i = 0; card.hidden = false; document.body.classList.add('touring'); show();
  };
  const stop = () => {
    if (i < 0) return;
    card.hidden = true; i = -1; unlight(); document.body.classList.remove('touring');
    if (detail && savedMode) detail.set(savedMode, false);
    if (saved) apply(saved);
    saved = null;
    document.getElementById('start-tour')?.focus({ preventScroll: true });
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop, active: () => i >= 0 };
}
