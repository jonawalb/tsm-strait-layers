// Selected official PRC statements in range. The corpus (tools/rhetoric-heatmap/data/statements.js,
// about 2.7 MB) is imported only when the section is switched on.
//
// Selection rule, shown on the page: take Taiwan-related answers in range that have English text;
// score each by how many of the Rhetoric Heatmap's twelve theme patterns its answer matches; take
// the highest scores, alternating between the Foreign Ministry, Defense Ministry and Taiwan Affairs
// Office so no single body fills the list; show them in date order. Quotes are verbatim excerpts.
import { THEMES } from '../../rhetoric-heatmap/data/themes.js';
import { clip } from './util.js';

export const BODIES = ['Foreign Ministry', 'Defense Ministry', 'Taiwan Affairs Office'];
export const BODY_SHORT = ['MFA', 'MND', 'TAO'];
// Codes follow tools/rhetoric-heatmap/data/statements.js: 0 TSM, 1 official English, 2 machine (Google), 3 Chinese only,
// 4 machine translation by Claude (TAO, Jul-Sep 2026, Chinese original kept).
export const TRANSLATION = ['TSM translation', 'official English', 'machine translation', 'Chinese only', 'machine translation (Claude)'];
const RX = THEMES.map(t => ({ ...t, rx: new RegExp(t.re, 'i') }));

let corpus = null;
export async function loadStatements() {
  if (!corpus) corpus = import('../../rhetoric-heatmap/data/statements.js').then(m => m.STATEMENTS);
  return corpus;
}

const themesOf = s => RX.filter(t => t.rx.test(s)).map(t => t.short);

/** The sentence(s) of an answer that carry the most theme matches, as a verbatim excerpt. */
function excerpt(answer, max = 420) {
  const paras = answer.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const sents = [];
  paras.forEach(p => (p.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) || [p]).forEach(s => sents.push(s.trim())));
  let best = 0, bestScore = -1;
  sents.forEach((s, i) => { const k = themesOf(s).length; if (k > bestScore) { best = i; bestScore = k; } });
  let out = sents[best];
  if (out.length < 200 && sents[best + 1]) out += ' ' + sents[best + 1];
  const cut = clip(out, max);
  return (best > 0 ? '… ' : '') + cut;
}

/**
 * @returns {{picked: object[], total: number, byBody: number[], chineseOnly: number, themes: [string, number][]}}
 */
export function selectStatements(rows, R, cap, src) {
  const inRange = rows.filter(r => r[1] >= R.from && r[1] <= R.to);
  const byBody = [0, 0, 0], themeN = {};
  let chineseOnly = 0;
  const cands = [];
  const seen = new Set();
  for (const r of inRange) {
    byBody[r[0]]++;
    const en = r[5] || '';
    if (!en.trim() || r[10] === 3) { chineseOnly++; continue; }
    const th = themesOf(en);
    th.forEach(t => themeN[t] = (themeN[t] || 0) + 1);
    const key = r[7] + '|' + en.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    cands.push({ r, th, score: th.length });
  }
  const queues = [0, 1, 2].map(b => cands.filter(c => c.r[0] === b)
    .sort((a, z) => z.score - a.score || z.r[5].length - a.r[5].length || a.r[1].localeCompare(z.r[1])));
  const picked = [];
  // Alternate bodies, always taking from the body whose next candidate scores highest first.
  while (picked.length < cap && queues.some(q => q.length)) {
    const order = queues.map((q, b) => [b, q[0]?.score ?? -1]).filter(x => x[1] >= 0).sort((a, z) => z[1] - a[1]);
    for (const [b] of order) { if (picked.length < cap && queues[b].length) picked.push(queues[b].shift()); }
  }
  picked.sort((a, z) => a.r[1].localeCompare(z.r[1]) || a.r[0] - z.r[0]);
  const out = picked.map(({ r, th }) => ({
    body: r[0], date: r[1], who: r[2], asker: r[3], q: clip(r[4], 170), quote: excerpt(r[5]),
    url: r[7], url2: r[8], linkKind: r[9], tr: TRANSLATION[r[10]] ?? 'translation source not recorded', themes: th,
  }));
  out.forEach(s => {
    src.add('PRC official statements', `${BODIES[s.body]}, ${s.who || 'spokesperson'}, ${s.date}${s.linkKind === 2 ? ' (index page)' : ''}`, s.url);
    if (s.url2) src.add('PRC official statements', `${BODIES[s.body]}, ${s.date}, Chinese original`, s.url2);
  });
  const themes = Object.entries(themeN).sort((a, z) => z[1] - a[1]);
  return { picked: out, total: inRange.length, byBody, chineseOnly, themes };
}
