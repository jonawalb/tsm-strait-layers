// Page blocks for the statements, AIS and sources-and-method sections.
import { esc, fmtDate, fmtRange, fmtN, plural } from './util.js';
import { head, para, link, table, SEC_TITLE } from './sections.js';
import { BODY_SHORT } from './statements.js';
import { AIS_WINDOW } from './ais.js';

export function statementBlocks(R, X, cap, num) {
  const sec = 'st', out = [head(sec, num, 'Taiwan-related answers from PRC Foreign Ministry, Defense Ministry and Taiwan Affairs Office briefings')];
  if (!X.total) {
    out.push(para(sec, 'TSM\'s statement corpus has no Taiwan-related answers in this range. The corpus starts in July 2022.'));
    return out;
  }
  const bodies = X.byBody.map((v, i) => v ? `${BODY_SHORT[i]} ${v}` : '').filter(Boolean).join(', ');
  const th = X.themes.slice(0, 4).map(([k, v]) => `${esc(k)} (${v})`).join(', ');
  let s = `TSM's corpus holds <b>${plural(X.total, 'Taiwan-related answer')}</b> in this range (${bodies}).`;
  if (th) s += ` The themes that recur most in the English text: ${th}.`;
  s += ` ${X.picked.length ? `Below are ${X.picked.length} of them, chosen by the rule on the sources page` : 'None has English text to quote'}${X.chineseOnly ? `; ${X.chineseOnly} with no English translation are not quoted` : ''}.`;
  out.push(para(sec, s));
  X.picked.forEach(q => out.push({ sec, t: 'b', html: `<div class="quote">
    <p class="q-meta"><span class="pill b${q.body}">${BODY_SHORT[q.body]}</span> ${fmtDate(q.date)} · ${esc(q.who || 'Spokesperson')}${q.asker ? ` · asked by ${esc(q.asker)}` : ''}</p>
    ${q.q ? `<p class="q-q">Q: ${esc(q.q)}</p>` : ''}
    <blockquote>${esc(q.quote)}</blockquote>
    <p class="q-src">${link(q.url, q.linkKind === 2 ? 'Briefing index page' : 'Transcript')}${q.url2 ? ` · ${link(q.url2, 'Chinese original')}` : ''} · ${esc(q.tr)}${q.themes.length ? ` · <span class="muted">${esc(q.themes.join(', '))}</span>` : ''}</p></div>` }));
  return out;
}

export function aisBlocks(R, A, num) {
  const sec = 'ais', out = [head(sec, num, 'Chinese-flag ships in TSM\'s own AIS database, live window Sept. 4–28, 2026')];
  const a = R.from < AIS_WINDOW.from ? AIS_WINDOW.from : R.from, b = R.to > AIS_WINDOW.to ? AIS_WINDOW.to : R.to;
  out.push(para(sec, `For ${fmtRange(a, b)}, TSM's receivers logged <b>${fmtN(A.fixes)}</b> position reports (thinned to one per ship every ${A.live.thin} minutes) from <b>${plural(A.ships, 'ship')}</b> with a Chinese MMSI or on TSM's watchlist.${a !== R.from || b !== R.to ? ' Only part of this packet\'s range falls inside the AIS window.' : ''}`));
  out.push(table(sec, ['Category', 'Ships', 'Position reports'], A.cats.map(c => `<tr><td>${esc(c.label)}</td><td class="num">${fmtN(c.ships)}</td><td class="num">${fmtN(c.fixes)}</td></tr>`)));
  if (A.named.length) {
    out.push(para(sec, '<b>Ships flagged for a closer look</b>: shared placeholder numbers and coast-guard-like names. The name is what the transponder broadcast; none is a verified identification.', 'sub'));
    out.push(table(sec, ['MMSI', 'Broadcast name', 'Why listed', 'Reports'], A.named.map(v => `<tr><td class="num">${esc(v.mmsi)}</td><td>${esc(v.name)}</td>
      <td>${v.cat === 'shared' ? 'Shared placeholder MMSI' : v.cat === 'cand' ? 'Coast-guard-like name, unreviewed' : 'Watchlist'}${v.seed?.src ? ` (${link(v.seed.src, 'source')})` : ''}</td><td class="num">${fmtN(v.n)}</td></tr>`)));
  }
  if (A.zones.length) {
    out.push(para(sec, `<b>Zone entries</b>, ${fmtRange(A.zoneSpan[0], A.zoneSpan[1])}. Zones are approximate polygons, so counts are indicative.${A.zoneGaps.length ? ` The database has no zone episodes for ${A.zoneGaps.map(d => fmtDate(d)).join(', ')}, so ${A.zoneGaps.length === 1 ? 'that day is' : 'those days are'} not counted.` : ''}`, 'sub'));
    out.push(table(sec, ['Zone', 'Entries'], A.zones.map(z => `<tr><td>${esc(z.name)}</td><td class="num">${fmtN(z.entries)}</td></tr>`)));
  }
  out.push(para(sec, `${A.coloc ? `The database logged ${plural(A.coloc, 'close approach', 'close approaches')} between these ships in the range. ` : ''}A ship missing from AIS may be out of receiver range, missed by a receiver, or have its transponder off; this data cannot tell which. PLA Navy ships rarely broadcast, and coast guard ships often use shared numbers. Explore the tracks in the Dark Fleet Viewer.`, 'fine'));
  return out;
}

const METHOD = {
  sum: 'Daily counts come from shared/data/tsm.js, TSM\'s cleaned record of Taiwan MND daily reports (TSM PLA Activity Center and earlier TSM trackers, checked against MND). A row covers MND\'s 06:00 to 06:00 window and is filed under its start date. "Median line or ADIZ" is MND\'s headline count of aircraft that crossed the median line and/or entered the ADIZ; before 2026 it is kept only where TSM\'s figure matches MND. Patrol and long-range flight days are MND press releases, one per day. The prior period is the same number of days ending the day before the range starts.',
  chart: 'The chart draws the same daily rows. Exercise shading uses the listed dates of TSM\'s 13 exercise events.',
  ccg: 'CCG incidents come from the CCG Gray-Zone Map data module: TSM\'s CGA/CCG Incident Tracker (complete version dated Sept. 24, 2026, with Sept. 28 corrections), compiled from Coast Guard Administration releases. Text is as recorded, shortened for the page. "CGA release" links mark rows checked by hand.',
  tr: 'Transits come from TSM\'s Taiwan Strait Transit Tracker (2017 to 2026) in shared/data/tsm.js. Rows added in the 2026 rebuild carry their own source link.',
  ex: 'Exercises come from TSM\'s Exercises as Theater event list (13 URL-sourced events) and the Anatomy of an Exercise annotations. Statement text there is paraphrased; quoted words are verbatim.',
  st: 'Statements come from TSM\'s corpus of Taiwan-related answers at PRC Foreign Ministry, Defense Ministry and Taiwan Affairs Office briefings (the Rhetoric Heatmap data). Selection rule: keep answers in range with English text; score each by how many of the heatmap\'s 12 theme patterns it matches; take the top scores, alternating between the three bodies; list by date. The quote is the sentence (or two) with the most theme matches, cut at a word boundary where marked with an ellipsis. English is labeled as TSM, official or machine translation. The corpus is much denser from April 2026, when TSM widened its intake, so counts across years are not comparable.',
  ais: 'AIS figures come from the Dark Fleet Viewer data modules: TSM\'s AIS database of terrestrial fixes received through AISStream.io, PRC-flag (MMSI 412, 413, 414) and watchlist ships only, thinned to one fix per ship per 10 minutes. Days are UTC. Zone entries come from the database\'s zone events.',
};

const LOCAL = {
  sum: 'TSM PLA Activity Center and PLAAF/PLAN trackers (TSM local), rebuilt against MND reports; see shared/data/tsm_sources.md.',
  ccg: 'TSM CGA/CCG Incident Tracker, complete version, Sept. 24, 2026 (TSM local).',
  tr: 'TSM Taiwan Strait Transit Tracker (TSM local).',
  ex: 'TSM, Exercises as Theater event list, data/exercise_events.json (TSM local, research in progress).',
  st: 'TSM MFA, MND and TAO statement repositories and 2026 intake (TSM local).',
  ais: 'TSM AIS Tracking Database, tsm_ais.sqlite (TSM local).',
};

export function sourceBlocks(R, secs, src, num, gen) {
  const sec = 'src', out = [{ sec, t: 'break' }, head(sec, num, 'Every link used in this packet, and how each section was computed')];
  const on = ['sum', 'chart', 'ccg', 'tr', 'ex', 'st', 'ais'].filter(k => secs.includes(k));
  out.push({ sec, t: 'rows', into: 'ul', cont: SEC_TITLE.src, wrap: '<ul class="method"></ul>',
    rows: on.map(k => `<li><b>${SEC_TITLE[k]}.</b> ${METHOD[k]}</li>`) });
  const local = [...new Set(on.map(k => LOCAL[k === 'chart' ? 'sum' : k]).filter(Boolean))];
  out.push(para(sec, '<b>TSM datasets</b> (not online; described in the site\'s data notes)', 'sub'));
  out.push({ sec, t: 'rows', into: 'ul', cont: SEC_TITLE.src, wrap: '<ul class="srcl"></ul>', rows: local.map(s => `<li>${esc(s)}</li>`) });
  for (const [g, items] of src.groups) {
    out.push(para(sec, `<b>${esc(g)}</b> (${plural(items.length, 'link')})`, 'sub'));
    out.push({ sec, t: 'rows', into: 'ol', cont: `${SEC_TITLE.src}: ${g}`, wrap: '<ol class="srcl"></ol>',
      rows: items.map(it => `<li>${esc(it.label)}<br>${link(it.url, it.url)}</li>`) });
  }
  out.push(para(sec, `Generated ${fmtDate(gen)} with TSM Interactive, Briefing Packet Builder. Counts describe what Taiwan's government and TSM's trackers reported; they do not measure intent. Links were checked when each data set was built, not when this packet was generated.`, 'fine'));
  return out;
}
