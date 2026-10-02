// The packet's cover page: TSM branding, title, date range, key figures and contents.
import { esc, fmtDate, fmtRange, fmtN, spanDays } from './util.js';
import { AS_OF } from './range.js';

const SITE = 'https://jonawalb.github.io/tsm-strait-layers/';

/**
 * @param {object} c  {R, forWho, gen, toc: [{title, page}], keys: [{v, l}], share}
 */
export function coverHtml({ R, forWho, gen, toc, keys, share }) {
  const days = spanDays(R.from, R.to);
  return `<div class="cv-band">
      <img src="../../shared/assets/tsm-logo.png" alt="Taiwan Security Monitor, George Mason University" width="132" height="132">
      <div><p class="cv-org">Taiwan Security Monitor</p>
      <p class="cv-school">Schar School of Policy and Government<br>George Mason University</p></div>
    </div>
    <div class="cv-main">
      <p class="cv-kicker">Briefing packet · ${esc(R.kicker)}</p>
      <h1 class="cv-title">${esc(R.title)}</h1>
      <p class="cv-range">${fmtRange(R.from, R.to)} <span>· ${days} ${days === 1 ? 'day' : 'days'}</span></p>
      ${forWho ? `<p class="cv-for">Prepared for ${esc(forWho)}</p>` : ''}
      ${keys.length ? `<div class="cv-keys">${keys.map(k => `<div><b class="num">${k.v}</b><span>${esc(k.l)}</span></div>`).join('')}</div>` : ''}
      <p class="cv-toch">Contents</p>
      <ol class="cv-toc">${toc.map(t => `<li><span>${esc(t.title)}</span><i></i><b class="num">${t.page}</b></li>`).join('')}</ol>
    </div>
    <footer class="cv-foot">
      <p><b>Prepared with TSM Interactive</b> · <a href="${esc(share)}" target="_blank" rel="noopener">Rebuild this packet online</a></p>
      <p>Generated ${fmtDate(gen)} · TSM data through ${fmtDate(AS_OF)} · <a href="${SITE}" target="_blank" rel="noopener">jonawalb.github.io/tsm-strait-layers</a></p>
    </footer>`;
}

/** Up to four headline figures for the sections that are switched on. */
export function keyFigures(ctx) {
  const k = [];
  const s = ctx.sum?.now;
  if (s?.air.n) k.push({ v: fmtN(s.air.total), l: 'PLA aircraft reported' });
  if (s?.adiz.n) k.push({ v: fmtN(s.adiz.total), l: 'crossed median line or entered ADIZ' });
  if (ctx.ccg?.covered) k.push({ v: fmtN(ctx.ccg.rows.length), l: 'China Coast Guard incidents' });
  if (ctx.ex?.rows.length) k.push({ v: fmtN(ctx.ex.rows.length), l: ctx.ex.rows.length === 1 ? 'listed PLA exercise' : 'listed PLA exercises' });
  if (ctx.st?.total && k.length < 4) k.push({ v: fmtN(ctx.st.total), l: 'Taiwan-related PRC statements' });
  if (ctx.tr && k.length < 4) k.push({ v: fmtN(ctx.tr.rows.length), l: 'allied Strait transits' });
  return k.slice(0, 4);
}
