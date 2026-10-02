// "This Week in the Strait" on the landing page. Paints the MND-based tiles from the small shared data first,
// then loads the heavier tool data (CCG tracker, AIS window, statement corpus) after first paint.
import * as S from './stats.js';
import * as R from './render.js';

const DARK_FLEET_CATS = ['prc', 'shared', 'watch']; // Dark Fleet's default vessel filter (tools/dark-fleet/js/main.js)
const GAP_H = 12; // Dark Fleet's default silence threshold, hours

const SOURCES = `Sources: Taiwan Ministry of National Defense daily reports as compiled in the TSM tracker
  (<a href="https://www.mnd.gov.tw/en/News/PLAActivities" target="_blank" rel="noopener">mnd.gov.tw</a>);
  TSM China Coast Guard incident tracker, from Coast Guard Administration releases
  (<a href="https://www.cga.gov.tw/" target="_blank" rel="noopener">cga.gov.tw</a>); TSM's list of allied transits;
  TSM's AIS database (terrestrial AIS via AISStream.io); PRC Foreign Ministry, Defense Ministry and Taiwan Affairs
  Office transcripts. Each MND day runs 06:00 to 06:00 Taiwan time. Counts are as reported; nothing is estimated.`;

const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
const afterPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

/** Fill `root` (a <section>) with the week dashboard. */
export async function mountWeek(root) {
  root.innerHTML = `<div class="wk-h"><h2 id="week-h">This week in the Strait</h2><p class="wk-when" id="wk-when">Loading the latest data…</p></div>
    <div class="wk-grid" id="wk-grid"></div><p class="fine wk-src">${SOURCES}</p>`;
  const grid = root.querySelector('#wk-grid');
  let TSM;
  try { ({ TSM } = await import('../../data/tsm.js')); }
  catch (e) { console.error(e); root.querySelector('#wk-when').textContent = 'The weekly data could not be loaded.'; return; }

  const W = S.windows(TSM.asOf);
  root.querySelector('#wk-when').innerHTML = `<b>${S.short(W.w0)} – ${S.long(W.w1)}</b> · Data through ${S.long(TSM.asOf)}`;
  const metrics = S.METRICS.map(m => S.metric(TSM.daily, W, m));
  grid.innerHTML = metrics.map(m => R.metricTile(m, W)).join('')
    + R.flagsTile(S.flags(TSM.daily, W))
    + R.transitTile(S.transits(TSM.transits, W))
    + R.loadingTile('ccg', 'China Coast Guard incidents', 'the CCG tracker')
    + R.loadingTile('ais', 'AIS around Taiwan', 'the AIS window')
    + R.loadingTile('st', 'Latest PRC official statement', 'the statement corpus');
  const fill = (k, html) => { grid.querySelector(`[data-slot="${k}"]`).outerHTML = html; };

  await afterPaint();
  // Heavy modules, smallest first, one at a time so the page stays responsive.
  idle(async () => {
    try {
      const { INCIDENTS, TRACKER } = await import('../../../tools/ccg-grayzone/data/incidents.js');
      fill('ccg', R.ccgTile(S.ccg(INCIDENTS, W), W, TRACKER));
    } catch (e) { console.error(e); fill('ccg', R.failTile('China Coast Guard incidents', 'tools/ccg-grayzone/')); }
    try {
      const L = await import('../../../tools/dark-fleet/js/live.js');
      fill('ais', R.aisTile(S.ais(L.VESSELS, L.detectGaps(GAP_H), L.T0, L.T_END, W, GAP_H, DARK_FLEET_CATS)));
    } catch (e) { console.error(e); fill('ais', R.failTile('AIS around Taiwan', 'tools/dark-fleet/')); }
    try {
      const [{ STATEMENTS }, { THEMES }, M] = await Promise.all([
        import('../../../tools/rhetoric-heatmap/data/statements.js'),
        import('../../../tools/rhetoric-heatmap/data/themes.js'),
        import('../../../tools/rhetoric-heatmap/js/model.js'),
      ]);
      const st = S.statements(STATEMENTS, W);
      if (!st.latest) throw new Error('no statements');
      // Link the heatmap cell for the theme most often matched this week (theme rules read English text only).
      const res = THEMES.map(t => new RegExp(t.re, 'i'));
      const hits = THEMES.map(() => 0);
      STATEMENTS.forEach(r => { if (r[5] && r[1] >= W.w0 && r[1] <= W.w1) res.forEach((re, k) => { if (re.test(r[5])) hits[k]++; }); });
      const k = hits.indexOf(Math.max(...hits));
      const q = new URLSearchParams({ r: 'y26', m: 'count', s: 'MFA,MND,TAO' });
      if (hits[k] > 0) q.set('c', `${THEMES[k].id}@${M.weekStart(M.weekOf(W.w1))}`);
      const label = hits[k] > 0 ? `Heatmap: “${THEMES[k].short}” this week →` : 'Rhetoric heatmap, 2026 →';
      fill('st', R.statementTile(st, `tools/rhetoric-heatmap/#${q.toString().replace(/&/g, '&amp;')}`, label));
    } catch (e) { console.error(e); fill('st', R.failTile('Latest PRC official statement', 'tools/rhetoric-heatmap/', true)); }
  });
}
