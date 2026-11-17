// "Statements": documents in the TSM rhetoric corpus attributed to a person as speaker or author.
// data/rhetoric_people.js is optional; if it is missing nothing is shown. Readouts (a ministry's summary of a
// meeting) are counted apart from the person's own words. See scoring/RHETORIC_ATTRIBUTION.md.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

export async function loadRhetoric(fixture) {
  if (fixture) return { meta: {}, people: {} }; // fake fixture people never meet real corpus counts
  try {
    const m = await import('../data/rhetoric_people.js');
    return { meta: m.RHETORIC?.meta || {}, people: m.RHETORIC?.people || {} };
  } catch {
    return { meta: {}, people: {} };
  }
}

const isReadout = s => /readout/.test(s.match_rule || '');
const SRC = { mfa_cn: 'PRC MFA', mfa_cn_archive: 'PRC MFA', mfa_cn_live: 'PRC MFA', tao_cn: 'PRC Taiwan Affairs Office', mnd_cn: 'PRC Ministry of National Defense',
  kremlin_en: 'Kremlin', kremlin_ru: 'Kremlin', mid_ru: 'Russian MFA', mid_en: 'Russian MFA', telegram_ru: 'Russian MFA Telegram', scrf_ru: 'Russian Security Council', duma_ru: 'State Duma',
  whitehouse: 'White House', state_dept: 'State Department', in_mea: 'India MEA', tw_ey_en: 'Taiwan Executive Yuan', tw_ey_zh: 'Taiwan Executive Yuan', tw_mac_zh: 'Taiwan Mainland Affairs Council', tw_mofa_en: 'Taiwan MOFA', tw_mofa_zh: 'Taiwan MOFA', mil_ru: 'Russian Defense Ministry' };
const srcName = k => SRC[k] || k;

function chart(byMonth, first, last) {
  const m0 = (first || '').slice(0, 7), m1 = (last || '').slice(0, 7);
  if (!m0 || !m1) return '';
  const months = [];
  for (let [y, m] = m0.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= m1; m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
  const max = Math.max(1, ...months.map(m => byMonth[m] || 0));
  const W = 600, H = 90, bw = W / months.length;
  const bars = months.map((m, i) => byMonth[m] ? `<rect x="${(i * bw).toFixed(2)}" y="${H - 14 - (byMonth[m] / max) * (H - 22)}" width="${Math.max(0.8, bw - 0.4).toFixed(2)}" height="${(byMonth[m] / max) * (H - 22)}"><title>${m}: ${byMonth[m]}</title></rect>` : '').join('');
  const years = months.map((m, i) => m.endsWith('-01') && (months.length < 90 || +m.slice(0, 4) % 2 === 0) ? `<text x="${(i * bw).toFixed(1)}" y="${H - 2}">${m.slice(0, 4)}</text>` : '').join('');
  return `<svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Attributed documents per month, ${m0} to ${m1}, peak ${max}">
    <text x="0" y="8">${max}</text>${bars}<line x1="0" x2="${W}" y1="${H - 14}" y2="${H - 14}"/>${years}</svg>`;
}

export function statementsHtml(p, R) {
  const r = R.people[p.id];
  if (!r || !r.n_docs) return '';
  const agg = {}; for (const [k, n] of Object.entries(r.sources || {})) agg[srcName(k)] = (agg[srcName(k)] || 0) + n;
  const srcs = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const samples = (r.samples || []).slice(0, 8);
  const pct = r.n_docs ? Math.round((r.n_readout || 0) / r.n_docs * 100) : 0;
  return `<h3 class="pf-h">Statements</h3>
    <p class="fine">Documents in the TSM rhetoric corpus where this person is the speaker or author (matched on titles/metadata, 30/30 precision in two spot checks). Searched: ${esc(R.meta.coverage || 'TSM rhetoric corpus')}; official outlets only, so counts are lower bounds. <a href="#rhetoric-method">Method</a>.</p>
    <dl class="readout st-read">
      <dt>Documents</dt><dd><b class="num">${r.n_docs.toLocaleString('en-US')}</b> <span class="fine">${esc(r.first)} to ${esc(r.last)}</span></dd>
      <dt>Own words</dt><dd><b class="num">${(r.n_direct || 0).toLocaleString('en-US')}</b> <span class="fine">speeches, statements, interviews, press conferences</span></dd>
      <dt>Readouts</dt><dd><b class="num">${(r.n_readout || 0).toLocaleString('en-US')}</b> <span class="fine">${pct}%; a ministry's summary of a meeting, not the person's own words</span></dd>
      <dt>Mention Taiwan</dt><dd><b class="num">${(r.taiwan_docs || 0).toLocaleString('en-US')}</b></dd>
    </dl>
    <div class="st-split" aria-hidden="true"><i class="d" style="flex:${r.n_direct || 0}"></i><i class="r" style="flex:${r.n_readout || 0}"></i></div>
    ${chart(r.by_month || {}, r.first, r.last)}
    <p class="fine">Monthly bars count all attributed documents, readouts included; the file gives the readout split as totals only.</p>
    ${srcs.length ? `<p class="fine st-src">Top sources: ${srcs.map(([k, n]) => `${esc(k)} ${n.toLocaleString('en-US')}`).join(' · ')}</p>` : ''}
    ${samples.length ? `<ul class="st-samples">${samples.map(s => `<li><span class="tl-d">${esc(s.date || '')}</span> <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a> <span class="fine">${esc(srcName(s.source))}</span>${isReadout(s) ? ' <span class="pill st-ro" title="A ministry summary of a meeting, not the person\'s own words">readout</span>' : ''}</li>`).join('')}</ul>` : ''}`;
}

export function rhetoricMethodHtml(R) {
  const n = Object.keys(R.people).length;
  return `<li id="rhetoric-method"><b>Statements</b>: ${n ? `${n} people have documents attributed from the TSM rhetoric corpus` : 'no documents from the TSM rhetoric corpus are loaded yet'}${R.meta.snapshot ? `, local snapshot to ${esc(R.meta.snapshot)}` : ''}. A document counts only when the person is its speaker or author, from an official outlet of the person's own country: the press-conference speaker field, or the person's name in a speech or readout position in the title. People who are only mentioned, counterparts in a meeting and activity headlines never count. Readouts, a ministry's summary of the person's meeting or call, are counted apart from the person's own words and are not quotations. Two independent spot checks of 30 random attributed documents each found 30 of 30 correct. The search covers the official full-text documents of the Rhetoric Search build named above; it has no Taiwan Presidential Office or Defense Ministry outlets and no Japanese, Korean, Philippine, Australian, Vietnamese or Indonesian outlets, so counts are lower bounds and absence means nothing. Taiwan mentions are counted on full text.${R.meta.counting_note ? ` ${esc(R.meta.counting_note)}` : ''}</li>`;
}
