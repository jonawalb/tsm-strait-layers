// Escalation Ladder: branching crisis scenario with meters, a Kahn-style ladder and a mini tree map.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { walk, visited, band, NODES } from './engine.js';
import { drawLadder } from './ladder-view.js';
import { drawTree, TOTAL_NODES, ENDINGS } from './treemap.js';
import { drawKinmen, kinmenStats } from './kinmen.js';
// Tracker counts in node notes ({kinmen}, {total}, {asOf}) come from the live CCG data, so they never go stale.
const fillStats = t => { const st = kinmenStats(); return t.replace(/\{(kinmen|total|asOf)\}/g, (_, k) => st[k]); };
import { RUNGS } from '../data/ladder.js';
import { addExportBar } from '../../../shared/js/export.js';
import { TSM } from '../../../shared/data/tsm.js';
import { SOURCES } from '../data/sources.js';

const $ = id => document.getElementById(id);
const S = { path: [], compare: null, showFx: false };
const METERS = [
  { k: 'risk', name: 'Escalation risk', help: 'How likely the crisis is to climb further, and how fast.' },
  { k: 'cred', name: 'Deterrence credibility', help: 'How seriously Beijing might take Taipei\'s and its partners\' resolve.' },
  { k: 'cost', name: 'Economic cost', help: 'Cost to Taiwan and its partners from disrupted shipping, insurance and trade.' },
];
const rungName = n => RUNGS[n - 1].name;
const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);
const cites = ids => (ids || []).map(id => SOURCES[id] ? `<a class="cite" href="#src-${id}">${esc(SOURCES[id].short)}</a>` : '').join('');

// ---------------------------------------------------------------- hash
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const digits = k => (q.get(k) || '').replace(/[^0-3]/g, '').split('').map(Number);
  S.path = walk(digits('p')).path;
  const c = digits('c');
  S.compare = q.has('c') ? walk(c).path : null;
}
function writeHash() {
  const q = new URLSearchParams();
  if (S.path.length) q.set('p', S.path.join(''));
  if (S.compare) q.set('c', S.compare.join(''));
  const h = q.toString();
  history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
}

// ---------------------------------------------------------------- scene
function fxChips(fx) {
  return METERS.map(m => `<span class="fx fx-${m.k}" title="${m.name}">${m.name.split(' ')[0]} ${sign(fx[m.k] || 0)}</span>`).join('');
}

function renderScene(w) {
  const n = w.node;
  const box = $('scene');
  if (n.ending) {
    const m = w.meters;
    box.innerHTML = `
      <p class="eyebrow">Ending ${Object.values(NODES).filter(x => x.ending).indexOf(n) + 1} of ${ENDINGS} · after ${w.steps.length} moves · peak rung ${w.peak}</p>
      <h2 tabindex="-1" id="scene-h" class="tone-${n.tone}">${esc(n.title)}</h2>
      <p class="story">${esc(n.text)}</p>
      <div class="lesson"><b>What this path shows</b><p>${esc(n.lesson)}</p></div>
      <p class="sum">You finished with <b>${band(m.risk)}</b> escalation risk (${m.risk}), <b>${band(m.cred)}</b> deterrence credibility (${m.cred}) and <b>${band(m.cost)}</b> economic cost (${m.cost}). <span class="notional">notional</span></p>
      <p class="cites-row">Grounded in: ${cites(n.cite)}</p>
      <div class="end-actions">
        <button type="button" class="btn solid" data-act="compare">Replay and compare</button>
        <button type="button" class="btn" data-act="restart">Start over</button>
        <button type="button" class="btn" data-act="back">Back one step</button>
      </div>`;
    return;
  }
  const q = n.actor === 'Washington & Tokyo' ? 'What do Washington and Tokyo do?' : `What does ${n.actor} do?`;
  box.innerHTML = `
    <p class="eyebrow">${esc(n.day)} · ${esc(n.actor)} to move · rung ${n.rung}: ${esc(rungName(n.rung))}</p>
    <h2 tabindex="-1" id="scene-h">${esc(n.title)}</h2>
    <p class="story">${esc(n.text)}</p>
    ${n.note ? `<p class="note">${esc(fillStats(n.note))}</p>` : ''}
    <p class="cites-row">Grounded in: ${cites(n.cite)}</p>
    <h3 class="q">${q}</h3>
    <div class="opts" role="group" aria-label="${esc(q)}">
      ${n.opts.map((o, i) => `<button type="button" class="opt" data-i="${i}">
        <span class="k" aria-hidden="true">${i + 1}</span>
        <span class="ot"><b>${esc(o.label)}</b><span>${esc(o.detail)}</span>
        ${o.cite ? `<span class="ocite">${o.cite.map(id => esc(SOURCES[id].short)).join(' · ')}</span>` : ''}
        ${S.showFx ? `<span class="fxrow">${fxChips(o.fx)}</span>` : ''}</span>
      </button>`).join('')}
    </div>`;
}

// ---------------------------------------------------------------- panel pieces
function renderMeters(w) {
  const last = w.steps[w.steps.length - 1];
  $('meters').innerHTML = METERS.map(m => {
    const v = w.meters[m.k], d = last ? last.delta[m.k] : null;
    return `<div class="meter m-${m.k}">
      <div class="mh"><span>${m.name}</span><span class="num">${v}${d != null ? ` <small class="d ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${sign(d)}</small>` : ''}</span></div>
      <div class="bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-label="${m.name}"><i style="width:${v}%"></i></div>
      <small class="mhelp">${m.help}</small></div>`;
  }).join('');
  $('mini').innerHTML = METERS.map(m => `<span class="mm m-${m.k}"><span>${m.name.split(' ')[0]}</span><b class="num">${w.meters[m.k]}</b><i style="width:${w.meters[m.k]}%"></i></span>`).join('');
  const n = w.node;
  const s = n.rung >= 7 ? 'bad' : n.rung >= 4 ? 'warn' : 'good';
  $('rung-status').dataset.s = s;
  $('rung-status').innerHTML = `<b>Rung ${n.rung}: ${esc(rungName(n.rung))}</b><span>${esc(RUNGS[n.rung - 1].hint)} Peak so far: rung ${w.peak}.</span>`;
}

function renderLog(w) {
  const items = w.steps.map((s, i) => {
    const next = i + 1 < w.steps.length ? w.steps[i + 1].node : w.node;
    return `<li><span class="lg-h">${esc(s.node.day)} · ${esc(s.node.actor)}</span>
      <b>${esc(s.opt.label)}</b>
      <span class="lg-then">Then: ${esc(next.title)}</span>
      <span class="fxrow">${fxChips(s.delta)}</span></li>`;
  });
  $('log').innerHTML = items.length ? items.join('') : '<li class="empty">No moves yet. Choose Taipei\'s first response above.</li>';
  $('log-count').textContent = `${w.steps.length} move${w.steps.length === 1 ? '' : 's'}`;
}

function renderCompare(w) {
  const box = $('compare');
  if (!S.compare) { box.hidden = true; return; }
  box.hidden = false;
  const a = walk(S.compare), b = w;
  const row = (label, fa, fb) => `<tr><th scope="row">${label}</th><td>${fa}</td><td>${fb}</td></tr>`;
  const where = x => esc(x.node.ending ? x.node.title : `${x.node.title} (in progress)`);
  const mv = (x, k) => `${x.meters[k]}`;
  const diff = k => { const d = b.meters[k] - a.meters[k]; return d ? ` <small class="d ${d > 0 ? 'up' : 'dn'}">${sign(d)}</small>` : ''; };
  box.innerHTML = `<p class="eyebrow">Replay and compare</p>
    <div class="tablewrap"><table class="cmp-t">
      <thead><tr><th></th><th><span class="lsw lsw-cmp"></span>Path A</th><th><span class="lsw lsw-cur"></span>This path</th></tr></thead>
      <tbody>
        ${row('Where it ends', where(a), where(b))}
        ${row('Peak rung', a.peak, b.peak + (b.peak - a.peak ? ` <small class="d ${b.peak > a.peak ? 'up' : 'dn'}">${sign(b.peak - a.peak)}</small>` : ''))}
        ${METERS.map(m => row(m.name, mv(a, m.k), mv(b, m.k) + diff(m.k))).join('')}
        ${row('Moves', a.steps.length, b.steps.length)}
      </tbody></table></div>
    <div class="row-btns"><button type="button" class="btn" data-act="swap">Load path A</button>
    <button type="button" class="btn" data-act="clearcmp">Clear comparison</button></div>`;
}

// ---------------------------------------------------------------- main render
function render(focus = false) {
  const w = walk(S.path);
  S.path = w.path;
  const ids = visited(S.path);
  const rungs = ids.map(id => NODES[id].rung);
  const cmpIds = S.compare ? visited(S.compare) : null;
  drawLadder($('ladder'), { current: w.node.rung, peak: w.peak, rungs, compare: cmpIds ? cmpIds.map(id => NODES[id].rung) : null });
  drawTree($('tree'), { cur: ids, cmp: cmpIds, onPick: id => { S.path = S.path.slice(0, ids.indexOf(id)); render(true); } });
  $('tree-cap').textContent = `${ids.length} of ${TOTAL_NODES} situations visited · ${ENDINGS} possible endings`;
  renderScene(w);
  renderMeters(w);
  renderLog(w);
  renderCompare(w);
  $('back').disabled = !S.path.length;
  writeHash();
  if (focus) $('scene-h')?.focus({ preventScroll: false });
}

function choose(i) {
  const n = walk(S.path).node;
  if (n.ending || !n.opts[i]) return;
  S.path = [...S.path, i];
  render(true);
}

function act(a) {
  if (a === 'restart') { S.path = []; render(true); }
  if (a === 'back') { S.path = S.path.slice(0, -1); render(true); }
  if (a === 'compare') { S.compare = [...S.path]; S.path = []; render(true); }
  if (a === 'clearcmp') { S.compare = null; render(); }
  if (a === 'swap') { const t = S.compare; S.compare = [...S.path]; S.path = t; render(true); }
}

// ---------------------------------------------------------------- wiring
document.addEventListener('click', e => {
  const opt = e.target.closest('.opt');
  if (opt) return choose(Number(opt.dataset.i));
  const b = e.target.closest('[data-act]');
  if (b) act(b.dataset.act);
});
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
});
$('back').addEventListener('click', () => act('back'));
$('restart').addEventListener('click', () => act('restart'));
$('showfx').addEventListener('change', e => { S.showFx = e.target.checked; render(); });
$('copy').addEventListener('click', async () => {
  writeHash();
  try { await navigator.clipboard.writeText(location.href); $('copy').textContent = 'Link copied'; }
  catch { $('copy').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy').textContent = 'Copy link to this path'; }, 1800);
});
window.addEventListener('hashchange', () => { readHash(); render(); });

// Sources list and the Kinmen chart
$('srclist').innerHTML = Object.entries(SOURCES).map(([id, s]) =>
  `<li id="src-${id}">${esc(s.cite)} <a href="${s.url}" target="_blank" rel="noopener">Link</a></li>`).join('');
const ks = kinmenStats();
$('kinmen-cap').textContent = `${ks.kinmen} of ${ks.total} China Coast Guard incidents that TSM recorded in 2026 (latest recorded incident ${ks.asOf}) were near Kinmen.`;
drawKinmen($('kinmen'));
addExportBar(document.querySelector('.ladder-col'), {
  target: () => $('ladder'), title: 'Hypothetical Kinmen quarantine crisis: escalation ladder for this path',
  note: 'Hypothetical educational scenario, not a prediction; rungs after Kahn',
});
addExportBar($('kinmen').nextElementSibling, {
  where: 'after', target: () => $('kinmen'), title: `China Coast Guard incidents per month in 2026, near Kinmen and elsewhere (latest recorded incident ${ks.asOf})`,
  note: 'Colored bars: near Kinmen; grey: elsewhere; * partial month. Data: TSM China Coast Guard Incident Tracker',
  csv: () => {
    const rows = TSM.ccg.filter(r => r[0].startsWith('2026'));
    const out = [['month', 'near_kinmen', 'elsewhere']];
    for (let m = 1; m <= Number(TSM.asOf.slice(5, 7)); m++) {
      const mm = `2026-${String(m).padStart(2, '0')}`, inM = rows.filter(r => r[0].startsWith(mm));
      out.push([mm, inM.filter(r => r[1] === 'Kinmen').length, inM.filter(r => r[1] !== 'Kinmen').length]);
    }
    return out;
  },
});

readHash();
render();
