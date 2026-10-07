// Guided walkthrough and default view, per config (shared verbatim by say-do-taiwan and say-do-global).

export const DEFAULTS = {
  taiwan: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'air', r: 'week', w: 'all' },
  global: { s: 'telegram_ru|ru|all', k: 'stance:UKRAINE:threat', b: 'ua_total', r: 'week', w: 'all' },
};

const STEPS = {
  taiwan: [
    { title: 'Say, then do?', body: 'The top panel is how often Foreign Ministry press conferences mentioned Taiwan each week. The bars below are PLA aircraft per day around Taiwan, from Taiwan MND. The question: do rises in what Beijing says come before rises in what the PLA does?',
      set: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'air', r: 'week', w: 'all' } },
    { title: 'Together is not before', body: 'In the lead-lag chart, the bar at 0 is clearly positive: talk about Taiwan and PLA flights rise in the same week, usually because both answer the same event. The bars to the right, where rhetoric comes first, are small. Same-week movement is not a forecast.',
      set: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'air', r: 'week', w: 'all' } },
    { title: 'Read the spike weeks', body: 'Triangles mark spike weeks: the series\' biggest rises over its own 12-week baseline. Open one in the list to read what was said. Official sentences are quoted; state-media items show only the headline and a link.',
      set: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'exer', r: 'week', w: 'all' } },
    { title: 'Event study with pre-trends', body: 'The event study lines up the spikes and asks how far behaviour moved from the weeks before a spike to the weeks after. The left shaded block is the pre-trend. If behaviour was already climbing before the spike, the rhetoric did not start it.',
      set: { s: 'mfa_cn|en|all', k: 'sal:TAIWAN', b: 'exer', r: 'week', w: 'all' } },
    { title: 'Short series need more caution', body: 'China Coast Guard counts start in mid-2024, so this pair has about 117 weeks. For series under 150 periods the page uses the larger of the model p-value and a permutation p-value, which is why a strong-looking regression does not pass.',
      set: { s: 'mfa_cn|en|all', k: 'stance:TAIWAN:conciliation', b: 'ccg', r: 'week', w: 'all' } },
    { title: 'Correct for the hundreds of tests', body: 'Every pair, measure and test in a view is one family. The panel at the bottom counts how many tests pass p < 0.05 against how many would pass by chance, and lists the few that survive Benjamini–Hochberg. Here is one of the two daily survivors.',
      set: { s: 'mfa_cn|en|all', k: 'stance:US:conciliation', b: 'exer', r: 'day', w: 'all' } },
    { title: 'Mostly, nothing', body: 'Switch to weekly data since 2025 and nothing survives correction. For PRC rhetoric and PLA activity around Taiwan, the honest reading is that public statements are a weak guide to what comes next.',
      set: { s: 'prc_statemedia_headlines|en|all', k: 'tone:threat', b: 'air', r: 'week', w: '2025' } },
  ],
  global: [
    { title: 'Say, then do?', body: 'The top panel is the threat tone of sentences that mention Ukraine on official Russian Telegram channels. The bars are Russian missiles and drones launched at Ukraine per day, as the Ukrainian Air Force reported them. Do threats come before bigger strikes?',
      set: { s: 'telegram_ru|ru|all', k: 'stance:UKRAINE:threat', b: 'ua_total', r: 'week', w: 'all' } },
    { title: 'A pair that survives', body: 'Conciliatory language about the U.S. on official Russian Telegram channels was followed a week later by more launches at Ukraine. This passes correction across nearly 2,000 tests. It is an association in the record, not proof of intent.',
      set: { s: 'telegram_ru|ru|all', k: 'stance:US:conciliation', b: 'ua_total', r: 'week', w: 'all' } },
    { title: 'Read the spike weeks', body: 'Open a spike week in the list to read what was said that week. Official sentences are quoted up to 300 characters, with a link; media items show only the headline and a link.',
      set: { s: 'telegram_ru|ru|all', k: 'stance:US:conciliation', b: 'ua_drones', r: 'week', w: 'all' } },
    { title: 'Outcomes are not actions', body: 'Ship transits through Hormuz measure what shipping did, not what Iran did. The page labels these series as outcomes. Iran\'s three direct attacks on Israel are too few to test at all.',
      set: { s: 'iran_mfa_en|en|all', k: 'stance:ISRAEL:threat', b: 'hormuz', r: 'week', w: 'all' } },
    { title: 'Venezuela, weekly only', body: 'ACLED event counts are shown only by week, as its licence requires transformed outputs. The Foreign Ministry series is in Spanish, a language the tone model was not checked on, so read levels with care.',
      set: { s: 'mppre_es|es|all', k: 'stance:US:hostility', b: 've_vac', r: 'week', w: 'all' } },
    { title: 'Correct for the thousands of tests', body: 'The panel at the bottom counts how many tests pass p < 0.05 against how many would by chance. Since 2025, nothing survives correction at either resolution.',
      set: { s: 'kremlin_en|en|all', k: 'tone:threat', b: 'ua_missiles', r: 'day', w: '2025' } },
  ],
};

export function createTour(root, apply) {
  const steps = STEPS[document.body.dataset.config] || [];
  let i = -1;
  const card = document.createElement('div');
  card.className = 'tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = steps[i];
    apply(s.set);
    card.innerHTML = `<div class="tour-h"><span>Step ${i + 1} / ${steps.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.title}</h3><p>${s.body}</p>
      <div class="tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === steps.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const n = i + Number(b.dataset.d);
      if (n >= steps.length) stop(); else { i = n; show(); }
    });
    card.querySelector('.solid').focus();
  };
  const start = () => { if (!steps.length) return; i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
