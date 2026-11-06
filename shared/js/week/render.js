// "This Week in the Strait": tile markup. Every number comes from the stats in ./stats.js.
import { short, long, dow, snippet } from './stats.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = x => Math.round(x).toLocaleString('en-US');
const n1 = x => (Math.round(x * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const DAY_URL = d => `tools/day-in-the-strait/#d=${d}`;
const SRC = ['Foreign Ministry', 'Defense Ministry', 'Taiwan Affairs Office'];
const SRC_SHORT = ['MFA', 'MND', 'TAO'];

/** Bar sparkline: 30 baseline days (muted) + 7 week days (strong), dashed line at the baseline mean. */
function spark(m) {
  const vals = m.series.map(p => p.v ?? 0), max = Math.max(1, ...vals);
  const W = 148, H = 36, bw = W / m.series.length;
  const bars = m.series.map((p, i) => {
    if (p.v == null) return `<rect class="sp-na" x="${(i * bw).toFixed(1)}" y="${H - 2}" width="${(bw - 1).toFixed(1)}" height="2"/>`;
    const h = Math.max(1.5, p.v / max * (H - 4));
    return `<rect class="${p.week ? 'sp-wk' : 'sp-b'}" x="${(i * bw).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${h.toFixed(1)}"><title>${short(p.d)}: ${p.v}</title></rect>`;
  }).join('');
  const y = m.bMean != null ? (H - m.bMean / max * (H - 4)).toFixed(1) : null;
  const line = y != null ? `<line class="sp-mean" x1="0" x2="${W}" y1="${y}" y2="${y}"/>` : '';
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${bars}${line}</svg>`;
}

function delta(pct) {
  if (pct == null) return '<span class="wk-d">no baseline</span>';
  const r = Math.round(pct), dir = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
  const txt = r === 0 ? 'level with' : `${r > 0 ? '+' : '−'}${Math.abs(r)}% vs`;
  return `<span class="wk-d" data-dir="${dir}">${txt} prior 30 days</span>`;
}

export function metricTile(m, W) {
  const cov = m.nWeek < 7 ? `<span class="wk-cov">${m.nWeek} of 7 days reported</span>` : '';
  if (!m.nWeek) return `<div class="wk-tile"><p class="wk-k">${esc(m.label)}</p><p class="wk-v">n/a</p><p class="wk-s">No reported days this week.</p></div>`;
  return `<div class="wk-tile">
    <p class="wk-k"><a href="tools/strait-snapshot/#m=${W.w1.slice(0, 7)}">${esc(m.label)}</a></p>
    <p class="wk-v num">${n0(m.total)}<small>this week</small></p>
    ${spark(m)}
    <p class="wk-s"><span class="num">${n1(m.wMean)}</span>/day against <span class="num">${n1(m.bMean)}</span>/day. ${delta(m.pct)} ${cov}</p>
    <a class="wk-go" href="${DAY_URL(m.peak.d)}">Busiest: ${short(m.peak.d)} (${m.peak.v}) →</a>
  </div>`;
}

export function flagsTile(f) {
  const cell = ({ d, f: x }) => {
    const j = x && x.includes('J'), l = x && x.includes('L');
    const what = x == null ? 'no report' : j && l ? 'joint combat readiness patrol and long-range flight' : j ? 'joint combat readiness patrol' : l ? 'long-range flight' : 'neither';
    return `<a class="wk-day" href="${DAY_URL(d)}" data-j="${!!j}" data-l="${!!l}" aria-label="${long(d)}: ${what}" title="${short(d)}: ${what}">
      <span>${dow(d)}</span><b>${j ? 'J' : ''}${l ? 'L' : ''}${!j && !l ? '·' : ''}</b></a>`;
  };
  const sum = f.j || f.l ? `${f.j} JCRP day${f.j === 1 ? '' : 's'}, ${f.l} long-range flight day${f.l === 1 ? '' : 's'}`
    : 'No JCRP or long-range flight announced';
  return `<div class="wk-tile">
    <p class="wk-k">Patrols &amp; long-range flights</p>
    <p class="wk-v num">${f.j + f.l ? n0(f.j) + '<small>JCRP</small> ' + n0(f.l) + '<small>long-range</small>' : '0<small>days flagged</small>'}</p>
    <div class="wk-days">${f.days.map(cell).join('')}</div>
    <p class="wk-s">${sum}. Prior 30 days: ${f.jBase} JCRP, ${f.lBase} long-range.</p>
  </div>`;
}

export function transitTile(t) {
  const names = rows => rows.map(r => esc(r[1])).join(', ');
  const ctry = rows => [...new Set(rows.map(r => r[5]))].join(', ');
  const wkDays = [...new Set(t.wk.map(r => r[0]))];
  const link = wkDays.length ? wkDays.at(-1) : t.last?.[0];
  const body = t.wk.length ? `${names(t.wk)} (${esc(ctry(t.wk))}).`
    : t.last ? `Last recorded: ${short(t.last[0])}, ${names(t.lastDay)} (${esc(ctry(t.lastDay))}).` : 'None recorded.';
  return `<div class="wk-tile">
    <p class="wk-k">Allied Strait transits</p>
    <p class="wk-v num">${t.wk.length}<small>ship-transit${t.wk.length === 1 ? '' : 's'}</small></p>
    <p class="wk-s">${body} Prior 30 days: ${t.base.length}.</p>
    ${link ? `<a class="wk-go" href="tools/transit-response/#v=single&amp;e=${link}">PLA response around ${short(link)} →</a>` : ''}
  </div>`;
}

export function ccgTile(c, W, tracker) {
  const locs = Object.entries(c.locs).map(([k, v]) => `${esc(k)} ${v}`).join(', ');
  const body = c.wk.length ? `${locs}.` : c.last ? `Last recorded: ${short(c.last.date)}, ${esc(c.last.loc)}.` : 'None recorded.';
  const href = c.last ? `tools/ccg-grayzone/#y=${c.last.date.slice(0, 4)}&amp;d=${c.last.date}&amp;i=${c.last.id}` : 'tools/ccg-grayzone/';
  return `<div class="wk-tile">
    <p class="wk-k">China Coast Guard incidents</p>
    <p class="wk-v num">${c.wk.length}<small>recorded</small></p>
    <p class="wk-s">${body} Prior 30 days: ${c.base.length}. Tracker updated ${short(tracker.version)}.</p>
    <a class="wk-go" href="${href}">Open the incident map →</a>
  </div>`;
}

export function aisTile(a) {
  return `<div class="wk-tile">
    <p class="wk-k">AIS around Taiwan</p>
    <p class="wk-v num">${n0(a.heard)}<small>PRC-flag MMSIs heard</small></p>
    <p class="wk-s"><span class="num">${n0(a.dark)}</span> silences of ${a.gapH} h or more, by <span class="num">${n0(a.darkVessels)}</span> MMSIs.
      Terrestrial receivers only: a silence can mean a ship left coverage.</p>
    <a class="wk-go" href="tools/dark-fleet/#m=live&amp;x=taiwan&amp;t=${a.tLink}&amp;g=${a.gapH}&amp;all=1">See the silences →</a>
  </div>`;
}

export function loadingTile(slot, label, what) {
  return `<div class="wk-tile wk-wait${slot === 'st' ? ' wk-quote' : ''}" data-slot="${slot}" aria-busy="true"><p class="wk-k">${esc(label)}</p><p class="wk-s">Loading ${esc(what)}…</p></div>`;
}
export function failTile(label, href, wide) {
  return `<div class="wk-tile${wide ? ' wk-quote' : ''}"><p class="wk-k">${esc(label)}</p><p class="wk-s">Could not load this data here.</p><a class="wk-go" href="${href}">Open the tool →</a></div>`;
}

export function statementTile(s, heatHref, heatLabel) {
  const r = s.latest, en = !!r[5];
  const quote = r => `<blockquote${r[5] ? '' : ' lang="zh"'}>${esc(r[5] ? snippet(r[5], 240) : snippet(r[6], 110))}</blockquote>`;
  const who = r => `<b>${SRC[r[0]]}</b>, ${short(r[1])}${r[2] ? `, ${esc(r[2])}` : ''}`;
  const counts = s.total ? `${s.total} Taiwan-related answers this week (${s.bySrc.map((n, i) => `${SRC_SHORT[i]} ${n}`).join(', ')}).` : 'No Taiwan-related answers recorded this week.';
  return `<div class="wk-tile wk-quote">
    <p class="wk-k">Latest PRC official statement</p>
    <p class="wk-who">${who(r)}${en ? '' : ' · <span class="pill">Chinese only</span>'}</p>
    ${quote(r)}
    ${s.latestEn ? `<p class="wk-who">Latest with English text: ${who(s.latestEn)}</p>${quote(s.latestEn)}` : ''}
    <p class="wk-s">${counts}</p>
    <p class="wk-links">${r[7] ? `<a href="${esc(r[7])}" target="_blank" rel="noopener">Official transcript</a>` : ''}
      <a class="wk-go" href="${heatHref}">${esc(heatLabel)}</a></p>
  </div>`;
}
