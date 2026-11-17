// Profile card for the selected person, and the "why are these two linked" explanation for a picked edge.
import { LAYERS, yearOf, activeAt, statusAt } from './edges.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

export const COUNTRY_NAMES = {
  CHN: 'China (PRC)', TWN: 'Taiwan', USA: 'United States', JPN: 'Japan', PHL: 'Philippines', AUS: 'Australia',
  KOR: 'South Korea', PRK: 'North Korea', RUS: 'Russia', IND: 'India', VNM: 'Vietnam', IDN: 'Indonesia',
};
export const STATUS_TEXT = { active: 'Active', removed: 'Removed', under_investigation: 'Under investigation', retired: 'Retired', deceased: 'Deceased', unaccounted: 'Replaced, fate not announced' };
const STATUS_S = { active: 'good', removed: 'bad', under_investigation: 'warn', retired: '', deceased: '', unaccounted: 'warn' };

// Headshot (hotlinked, lazy) or an initials avatar. Status ring comes from CSS on [data-s].
const initials = n => String(n || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
export function avatarHtml(p, cls = 'av') {
  return p.photo?.src
    ? `<span class="${cls}"><img src="${esc(p.photo.src)}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('noimg');this.parentNode.textContent='${initials(p.name)}'"></span>`
    : `<span class="${cls} noimg" aria-hidden="true">${esc(initials(p.name))}</span>`;
}
export function creditHtml(p) {
  const ph = p.photo; if (!ph?.page) return '';
  const commons = /commons\.wikimedia\.org/.test(ph.page);
  return `<p class="credit"><a href="${esc(ph.page)}" target="_blank" rel="noopener">Photo: ${esc(ph.author || 'unknown author')}, ${esc(ph.license)}${commons ? ', via Wikimedia Commons' : ''}</a></p>`;
}

const pathOf = u => { try { return new URL(u).pathname.slice(0, 48); } catch { return ''; } };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'link'; } };
export const srcLink = (u, label) => u ? `<a class="sl" href="${esc(u)}" target="_blank" rel="noopener">${esc(label || host(u))}</a>` : '<span class="fine">no source</span>';
const ym = t => { const y = Math.floor(t); const m = Math.min(12, Math.floor((t - y) * 12) + 1); return `${y}-${String(m).padStart(2, '0')}`; };

export function renderEmptyProfile(el, hasData) {
  el.innerHTML = hasData
    ? '<p class="eyebrow">Profile</p><p class="fine">Pick a person in the network, the table or the search box to see posts, career, ties and sources.</p>'
    : '<p class="eyebrow">Profile</p><p class="fine">No leader records are loaded yet. Profiles appear here once the country files pass the build checks.</p>';
}

// ctx: {orgs: Map, people: Map, t, asOfY, ties: [edges touching p, visible + active], cent: {degree, betweenness, ...}, n, onPick}
export function renderProfile(el, p, ctx) {
  const { orgs, people, t, asOfY, ties, cent, n } = ctx;
  const st = statusAt(p, t);
  const org = id => orgs.get(id)?.name || id;
  const current = p.posts.filter(x => activeAt(x, t, asOfY));
  const dated = p.posts.filter(x => yearOf(x.start) != null).sort((a, b) => yearOf(a.start) - yearOf(b.start));
  const undated = p.posts.filter(x => yearOf(x.start) == null);

  // Timeline scale: first dated start to asOf.
  const t0 = dated.length ? Math.floor(yearOf(dated[0].start)) : Math.floor(asOfY) - 5;
  const t1 = asOfY;
  const pc = y => Math.max(0, Math.min(100, ((y - t0) / Math.max(1, t1 - t0)) * 100));
  const bar = x => {
    const s = yearOf(x.start), e = x.end == null ? asOfY : (yearOf(x.end) ?? asOfY);
    const future = s > t;
    return `<li class="tl-row${future ? ' future' : ''}">
      <div class="tl-lab"><span>${esc(x.title)}, ${esc(org(x.org))}</span> <span class="tl-d">${esc(x.start || '?')}–${x.end ? esc(x.end) : x.last_seen ? `last confirmed ${esc(x.last_seen)}` : 'present'}${x.end_inferred ? ' <small title="End date taken from the status change, not the post source">(end from status)</small>' : ''}</span> ${srcLink(x.source, 'src')}${postNotes(x)}</div>
      <div class="tl-track"><i style="left:${pc(s)}%;width:${Math.max(1.2, pc(e) - pc(s))}%"></i></div></li>`;
  };
  const byLayer = {};
  for (const e of ties) (byLayer[e.layer] ||= []).push(e);

  el.innerHTML = `
    <div class="pf-head${ctx.big ? ' big' : ''}" style="--k:var(--k-${p.country})" data-s="${st}">
      ${avatarHtml(p, 'pf-av')}
      <div class="pf-id"><p class="eyebrow">${esc(COUNTRY_NAMES[p.country] || p.country)} · Tier ${p.tier}</p>
      <h2 class="pf-name">${esc(p.name)}</h2>
      ${p.name_native ? `<p class="pf-native" lang="${p.country === 'CHN' || p.country === 'TWN' ? 'zh' : ''}">${esc(p.name_native)}</p>` : ''}
      <p class="pf-status"><span class="stpill" data-s="${STATUS_S[st]}">${STATUS_TEXT[st]}</span>${st !== 'active' && p.status_date ? ` since ${esc(p.status_date)}` : ''}
        ${st !== 'active' ? srcLink(p.status_source, 'source') : ''}${p.status !== st ? ` <span class="fine">(${STATUS_TEXT[p.status].toLowerCase()} from ${esc(p.status_date)})</span>` : ''}</p>
      ${ctx.badges || ''}
      ${ctx.onCmp ? `<p class="pf-act"><button type="button" class="btn sm" data-cmp="${esc(p.id)}" aria-pressed="${!!ctx.inCmp}">${ctx.inCmp ? 'Remove from comparison' : 'Add to comparison'}</button></p>` : ''}
      ${creditHtml(p)}</div>
    </div>
    <dl class="readout pf-cent">
      <dt>Ties shown</dt><dd><b class="num">${cent ? cent.degree : 0}</b> people${cent ? ` <span class="fine">rank ${cent.degreeRank} of ${n}</span>` : ''}</dd>
      <dt>Betweenness</dt><dd><b class="num">${cent ? cent.betweenness.toFixed(3) : '0.000'}</b>${cent ? ` <span class="fine">rank ${cent.betweennessRank} of ${n}</span>` : ''}</dd>
    </dl>
    <p class="fine">Both are computed on the network as currently filtered, at ${ym(t)}.</p>

    <h3 class="pf-h">Posts at ${ym(t)}</h3>
    ${current.length ? `<ul class="pf-list">${current.map(x => `<li><b>${esc(x.title)}</b>, ${esc(org(x.org))} <span class="fine">since ${esc(x.start || '?')}</span> ${srcLink(x.source, 'src')}${x.last_seen && !x.end ? ` <span class="fine lastseen">last confirmed ${esc(x.last_seen)}</span> ${srcLink(x.last_seen_source, 'src')}` : ''}</li>`).join('')}</ul>` : '<p class="fine">No sourced post active at this date.</p>'}

    <h3 class="pf-h">Career</h3>
    ${dated.length ? `<div class="tl-axis"><span>${t0}</span><span>${Math.floor(t1)}</span></div>
    <ol class="tl">${dated.map(bar).join('')}<li class="tl-now" style="left:${pc(t)}%" aria-hidden="true"></li></ol>` : ''}
    ${undated.length ? `<ul class="pf-list">${undated.map(x => `<li>${esc(x.title)}, ${esc(org(x.org))} <span class="fine">start date not sourced${x.end ? `, ended ${esc(x.end)}` : x.last_seen ? `, last confirmed ${esc(x.last_seen)}` : ''}</span> ${srcLink(x.source, 'src')}${postNotes(x)}</li>`).join('')}</ul>` : ''}
    ${!p.posts.length ? '<p class="fine">No sourced posts.</p>' : ''}

    ${(p.education.length || p.background.length || p.birthplace || p.born) ? `<h3 class="pf-h">Background</h3><ul class="pf-list">
      ${p.born ? `<li>Born ${esc(p.born)}${p.birthplace ? `, ${esc(p.birthplace)}` : ''}</li>` : p.birthplace ? `<li>Birthplace: ${esc(p.birthplace)}</li>` : ''}
      ${p.education.map(e => `<li>${esc(e.inst)}${e.years ? ` <span class="fine">${esc(e.years)}</span>` : ''} ${srcLink(e.source, 'src')}</li>`).join('')}
      ${p.background.length ? `<li>${p.background.map(b => `<span class="pill">${esc(b)}</span>`).join(' ')}</li>` : ''}
    </ul>` : ''}
    ${p.notes ? `<p class="pf-notes">${esc(p.notes)}</p>` : ''}

    ${ctx.traits || ''}
    ${ctx.watch || ''}
    ${ctx.statements || ''}
    ${ctx.meetings || ''}
    ${ctx.layers || ''}

    <h3 class="pf-h">Ties</h3>
    ${ties.length ? Object.keys(LAYERS).filter(k => byLayer[k]).map(k => `
      <div class="tie-grp"><p class="tie-h"><i class="sw-${k}"></i>${LAYERS[k].label} <span class="fine">${byLayer[k].length}</span></p>
      <ul class="ties">${byLayer[k].sort((a, b) => b.weight - a.weight).map(e => {
        const o = e.a === p.id ? e.b : e.a; const q = people.get(o);
        const dir = e.layer === 'hi' ? (e.a === p.id ? 'reports to ' : 'supervises ') : '';
        return `<li><details><summary><span>${dir}<button type="button" class="linkbtn" data-pick="${esc(o)}">${esc(q.name)}</button> <span class="fine">${q.country}${e.layer === 'co' ? ` · ${e.weight} yr` : e.weight > 1 ? ` · ×${e.weight}` : ''}</span></span></summary>
          <ul class="why">${e.why.map(w => `<li>${esc(w.text)} ${w.sources.map(u => srcLink(u)).join(' ')}</li>`).join('')}</ul></details></li>`;
      }).join('')}</ul></div>`).join('') : '<p class="fine">No ties in the layers and filters now shown.</p>'}

    <h3 class="pf-h">Sources</h3>
    <ul class="src">${allSources(p).map(s => `<li>${srcLink(s.url, s.title || host(s.url))}${s.publisher ? `, ${esc(s.publisher)}` : ''}${s.accessed ? ` <span class="fine">accessed ${esc(s.accessed)}</span>` : ''}</li>`).join('') || '<li>No sources listed.</li>'}</ul>
    ${p.speech_sources?.length ? `<h3 class="pf-h">Speeches and transcripts <span class="fine">held for later coding</span></h3>
    <ul class="src">${p.speech_sources.map(u => `<li>${srcLink(u, host(u) + pathOf(u))}</li>`).join('')}</ul>` : ''}`;
  el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); ctx.onPick(b.dataset.pick); }));
  el.querySelector('[data-cmp]')?.addEventListener('click', () => ctx.onCmp(p.id));
}

// Start/end notes and their own sources, and the source for "last confirmed".
function postNotes(x) {
  const bits = [];
  if (x.start_note || x.start_source) bits.push(`start: ${x.start_note ? esc(x.start_note) + ' ' : ''}${x.start_source ? srcLink(x.start_source, 'src') : ''}`);
  if (x.end_note || x.end_source) bits.push(`end: ${x.end_note ? esc(x.end_note) + ' ' : ''}${x.end_source ? srcLink(x.end_source, 'src') : ''}`);
  if (x.last_seen && !x.end) bits.push(`last confirmed ${esc(x.last_seen)} ${srcLink(x.last_seen_source, 'src')}`);
  return bits.length ? `<br><span class="fine tl-note">${bits.join(' · ')}</span>` : '';
}

// Person-level sources plus every URL cited on a post, status, education entry or reporting line.
function allSources(p) {
  const seen = new Set(), out = [];
  const push = s => { if (s?.url && !seen.has(s.url)) { seen.add(s.url); out.push(s); } };
  (p.sources || []).forEach(push);
  [p.status_source, ...p.posts.flatMap(x => [x.source, x.start_source, x.end_source, x.last_seen_source]), ...p.education.map(x => x.source), ...p.reports_to.map(x => x.source)].forEach(u => push(u && { url: u }));
  return out;
}

export function renderPair(el, a, b, edges, onPick, onClose, focus = false) {
  el.hidden = false;
  el.innerHTML = `<div class="pair-h"><p class="eyebrow">Why these two are linked</p><button type="button" class="x" aria-label="Close">×</button></div>
    <p class="pair-names"><button type="button" class="linkbtn" data-pick="${esc(a.id)}">${esc(a.name)}</button> and <button type="button" class="linkbtn" data-pick="${esc(b.id)}">${esc(b.name)}</button></p>
    ${edges.map(e => `<div class="tie-grp"><p class="tie-h"><i class="sw-${e.layer}"></i>${LAYERS[e.layer].label}${e.layer === 'co' ? ` <span class="fine">${e.weight} yr overlap</span>` : ''}</p>
      <ul class="why">${e.why.map(w => `<li>${esc(w.text)} ${w.sources.map(u => srcLink(u)).join(' ')}</li>`).join('')}</ul></div>`).join('')}`;
  el.querySelector('.x').addEventListener('click', onClose);
  el.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => onPick(btn.dataset.pick)));
  if (focus) el.querySelector('.x').focus({ preventScroll: true });
}
