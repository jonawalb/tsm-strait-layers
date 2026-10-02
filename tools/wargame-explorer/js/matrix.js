// Assumptions-vs-outcomes matrix, the "group by" driver bars and the within-study contrasts.
import { DIMS, OUTCOMES, CONTRASTS, CASES } from '../data/cases.js';
import { SCENARIOS, FORMATS } from '../data/games.js';
import { esc, cites, gameById, OUT_ORDER } from './util.js';

const COLS = ['japan', 'us', 'taiwan', 'missiles', 'mainland'];
const caseById = id => CASES.find(c => c.id === id);

function tallyBar(tally, n) {
  const segs = OUT_ORDER.filter(k => tally[k]).map(k =>
    `<i class="o-${k}" style="flex:${tally[k]}" title="${esc(OUTCOMES[k].label)}: ${tally[k]} of ${n}"></i>`).join('');
  return `<span class="tbar" role="img" aria-label="${esc(OUT_ORDER.filter(k => tally[k]).map(k => `${OUTCOMES[k].label}: ${tally[k]}`).join('; '))}">${segs}</span>`;
}

/** The matrix table. Rows are grouped by the active dimension when one is chosen. */
export function renderMatrix(el, rows, st, on) {
  const g = st.group !== 'none' ? st.group : null;
  const order = g ? Object.keys(DIMS[g].vals) : [null];
  const head = `<thead><tr><th scope="col">Study and variant</th><th scope="col" class="num">Runs</th><th scope="col">Outcome</th>${COLS.map(k =>
    `<th scope="col" class="dimh${k === g ? ' on' : ''}"><button type="button" data-dim="${k}" aria-pressed="${k === g}" title="Group rows by ${esc(DIMS[k].label)}">${esc(DIMS[k].label)}</button></th>`).join('')}</tr></thead>`;
  let body = '';
  for (const v of order) {
    const grp = rows.filter(r => !g || r[g] === v);
    if (!grp.length) continue;
    if (g) body += `<tr class="grp"><th colspan="${COLS.length + 3}" scope="rowgroup">${esc(DIMS[g].label)}: ${esc(DIMS[g].vals[v])}</th></tr>`;
    body += grp.map(r => {
      const game = gameById(r.game);
      const tags = (r.tags || [r.scen]).map(t => SCENARIOS[t]).join(', ');
      return `<tr class="row${st.focus.includes(r.id) ? ' focus' : ''}" data-case="${r.id}" data-game="${r.game}">
        <th scope="row" data-l="Study"><button type="button" class="rowbtn" data-open="${r.game}">${esc(game.short)}</button>
          <span class="vname">${esc(r.name)}</span><span class="vmeta">${esc(tags)} · ${esc(FORMATS[game.format])}</span></th>
        <td class="num" data-l="Runs">${r.n}</td>
        <td data-l="Outcome" class="oc">${tallyBar(r.tally, r.n)}<span class="res">${esc(r.result)}</span>
          ${r.note ? `<span class="rnote">${esc(r.note)}</span>` : ''}<span class="cites">${cites(r.c)}</span></td>
        ${COLS.map(k => `<td data-l="${esc(DIMS[k].label)}" class="${k === g ? 'on' : ''}"><span class="val v-${r[k]}">${esc(DIMS[k].vals[r[k]])}</span></td>`).join('')}
      </tr>`;
    }).join('');
  }
  el.innerHTML = head + `<tbody>${body || `<tr><td colspan="${COLS.length + 3}" class="empty">No scenario rows match these filters.</td></tr>`}</tbody>`;
  el.querySelectorAll('[data-dim]').forEach(b => b.onclick = () => on.group(b.dataset.dim === st.group ? 'none' : b.dataset.dim));
  el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => on.open(b.dataset.open));
}

/** Stacked bars: outcomes by value of the chosen assumption, weighted by runs or by rows. */
export function renderDrivers(el, rows, st) {
  const g = st.group !== 'none' ? st.group : null;
  if (!g) { el.innerHTML = '<p class="fine">Pick an assumption above (or click a column heading) to see outcomes split by it.</p>'; return; }
  const groups = Object.keys(DIMS[g].vals).map(v => {
    const rs = rows.filter(r => r[g] === v);
    const t = {}; let n = 0;
    rs.forEach(r => OUT_ORDER.forEach(k => {
      const x = st.weight === 'runs' ? (r.tally[k] || 0) : (r.tally[k] ? r.tally[k] / r.n : 0);
      if (x) { t[k] = (t[k] || 0) + x; n += x; }
    }));
    return { v, rs, t, n };
  }).filter(x => x.rs.length);
  const max = Math.max(1, ...groups.map(x => x.n));
  const unit = st.weight === 'runs' ? 'runs' : 'rows';
  el.innerHTML = `<p class="dh">Outcomes by <b>${esc(DIMS[g].label)}</b>, counting ${unit}</p>` + groups.map(x => {
    const segs = OUT_ORDER.filter(k => x.t[k]).map(k =>
      `<i class="o-${k}" style="width:${(x.t[k] / max) * 100}%" title="${esc(OUTCOMES[k].label)}: ${+x.t[k].toFixed(1)}"></i>`).join('');
    const studies = [...new Set(x.rs.map(r => gameById(r.game).short))];
    return `<div class="drow"><div class="dl"><b>${esc(DIMS[g].vals[x.v])}</b><span>${+x.n.toFixed(1)} ${x.n === 1 ? unit.slice(0, -1) : unit} · ${studies.length} ${studies.length === 1 ? 'study' : 'studies'}</span></div>
      <div class="dbar" role="img" aria-label="${esc(DIMS[g].vals[x.v])}: ${esc(OUT_ORDER.filter(k => x.t[k]).map(k => `${OUTCOMES[k].label} ${+x.t[k].toFixed(1)}`).join(', '))}">${segs}</div></div>`;
  }).join('');
}

/** Controlled within-study comparisons for the active dimension. */
export function renderContrasts(el, st) {
  const g = st.group !== 'none' ? st.group : null;
  const list = CONTRASTS.filter(x => !g || x.dim === g);
  if (!list.length) { el.innerHTML = '<p class="fine">No study varies this assumption on its own, so there is no controlled comparison for it.</p>'; return; }
  el.innerHTML = list.map(x => {
    const a = caseById(x.a), b = x.b ? caseById(x.b) : null;
    const pair = b ? `${esc(a.name)} <span aria-hidden="true">vs.</span><span class="vh"> versus </span> ${esc(b.name)}` : esc(a.name);
    return `<li><span class="ct">${esc(gameById(a.game).short)} · ${esc(DIMS[x.dim].label)}</span><b>${pair}</b><p>${esc(x.t)}</p><span class="cites">${cites(x.c)}</span></li>`;
  }).join('');
}
