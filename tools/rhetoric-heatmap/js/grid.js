// Week × theme heatmap, drawn as SVG: event band, phrase row, theme rows, time axis,
// JCRP ticks and per-source coverage rows. Hover shows a tooltip; click or arrow keys select.
import { el } from '../../../shared/js/mapkit.js';
import { THEMES } from '../data/themes.js';
import { EVENTS, SEAMS } from '../data/events.js';
import { SOURCES, weekOf, weekStart, valueOf } from './model.js';

const ROW = 22, GAP = 2, EVH = 40, AXH = 22, TICKH = 14, COVH = 11, LABW = 150;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function createGrid({ labelSvg, svg, scroller, tip, onSelect, onHover }) {
  let G = null; // current geometry + data

  function rowsOf(S) {
    const rows = THEMES.map((t, k) => ({ k, label: t.short, kind: 'theme' }));
    if (S.matcher) rows.unshift({ k: THEMES.length, label: `“${S.matcher.phrase}”`, kind: 'phrase' });
    return rows;
  }

  function render(S, agg, jcrp) {
    const w0 = Math.max(0, weekOf(S.range.from)), w1 = weekOf(S.range.to);
    const nW = w1 - w0 + 1;
    const avail = Math.max(200, scroller.clientWidth - 2);
    const cw = Math.max(3.4, avail / nW);
    const W = Math.round(cw * nW);
    const rows = rowsOf(S);
    const yGrid = EVH;
    const gridH = rows.length * (ROW + GAP);
    const yAxis = yGrid + gridH + 2;
    const yTick = yAxis + AXH;
    const yCov = yTick + TICKH + 6;
    const H = yCov + SOURCES.length * (COVH + 3) + 4;
    const x = w => (w - w0) * cw;
    G = { S, agg, rows, w0, w1, cw, yGrid, W, H };

    // Colour scale
    let max = 0;
    for (const r of rows) for (let w = w0; w <= w1; w++) max = Math.max(max, valueOf(agg, r.k, w, S.metric));
    G.max = max;
    const pct = v => (S.metric === 'share' ? Math.min(1, v) : (max ? Math.sqrt(v / max) : 0)) * 100;

    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W); svg.setAttribute('height', H);

    // Exercise bands and labels
    const lanes = [-1e9, -1e9];
    for (const ev of EVENTS) {
      const a = weekOf(ev.start), b = weekOf(ev.end);
      if (b < w0 || a > w1) continue;
      const xa = x(a), xb = x(b) + cw;
      el('rect', { x: xa, y: yGrid - 3, width: Math.max(2, xb - xa), height: gridH + 6, class: 'ev-band' }, svg);
      const text = ev.short, tw = text.length * 6.4 + 10;
      let lane = lanes[0] <= xa ? 0 : lanes[1] <= xa ? 1 : (lanes[0] < lanes[1] ? 0 : 1);
      lanes[lane] = xa + tw;
      const ly = 12 + lane * 15;
      el('path', { d: `M${xa + 0.5} ${ly + 3}V${yGrid - 3}`, class: 'ev-stem' }, svg);
      const t = el('text', { x: xa + 3, y: ly, class: 'ev-label' }, svg, text);
      t.appendChild(el('title', {}, null, `${ev.name}, ${ev.start}${ev.end !== ev.start ? ' to ' + ev.end : ''}`));
    }

    // Cells
    const g = el('g', { class: 'cells' }, svg);
    rows.forEach((r, ri) => {
      const y = yGrid + ri * (ROW + GAP);
      for (let w = w0; w <= w1; w++) {
        const n = agg.cells[r.k][w].length;
        const rect = el('rect', { x: x(w) + (cw > 5 ? 0.5 : 0), y, width: Math.max(1, cw - (cw > 5 ? 1 : 0.3)), height: ROW }, g);
        if (!agg.held[w]) { rect.setAttribute('class', 'c-empty'); continue; }
        if (!n) { rect.setAttribute('class', 'c-zero'); continue; }
        rect.style.fill = `color-mix(in oklab, var(${r.kind === 'phrase' ? '--heat2' : '--heat'}) ${Math.max(12, pct(valueOf(agg, r.k, w, S.metric))).toFixed(0)}%, var(--cell0))`;
      }
    });

    // Seams (collection changes)
    for (const sm of SEAMS) {
      const w = weekOf(sm.date);
      if (w <= w0 || w > w1) continue;
      el('path', { d: `M${x(w)} ${yGrid - 6}V${H}`, class: 'seam' }, svg).appendChild(el('title', {}, null, sm.text));
    }

    // Time axis: month ticks, year labels
    const step = cw * 4.3 < 26 ? 3 : 1;
    const t0 = Date.parse(weekStart(w0) + 'T00:00:00Z');
    const d = new Date(t0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    let first = true, lastX = -1e9;
    for (; d.getTime() <= Date.parse(S.range.to + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1)) {
      const m = d.getUTCMonth();
      if (m % step) continue;
      const xx = ((d.getTime() - t0) / (7 * 864e5)) * cw;
      el('path', { d: `M${xx} ${yAxis}v5`, class: 'ax-tick' + (m === 0 ? ' yr' : '') }, svg);
      const lab = m === 0 || first ? `${MONTHS[m]} ${d.getUTCFullYear()}` : MONTHS[m];
      if (xx + lab.length * 6 < W && xx > lastX) {
        el('text', { x: xx + 2, y: yAxis + 16, class: 'ax-label' + (m === 0 ? ' yr' : '') }, svg, lab);
        lastX = xx + lab.length * 6.2 + 6;
      }
      first = false;
    }

    // JCRP ticks
    for (const d of jcrp) {
      const w = weekOf(d);
      if (w < w0 || w > w1) continue;
      el('rect', { x: x(w) + cw / 2 - 1, y: yTick + 2, width: 2, height: TICKH - 4, class: 'jcrp' }, svg).appendChild(el('title', {}, null, `Joint combat readiness patrol, ${d} (TSM)`));
    }

    // Coverage rows: statements held per source per week (all Taiwan-related records)
    SOURCES.forEach((s, i) => {
      const y = yCov + i * (COVH + 3);
      let cmax = 1;
      for (let w = w0; w <= w1; w++) cmax = Math.max(cmax, agg.bySource[s][w]);
      for (let w = w0; w <= w1; w++) {
        const n = agg.bySource[s][w];
        if (!n) continue;
        const r = el('rect', { x: x(w), y, width: Math.max(1, cw - 0.3), height: COVH, class: 'cov' }, svg);
        r.style.opacity = (0.25 + 0.75 * Math.sqrt(n / cmax)).toFixed(2);
      }
    });

    drawSelection();
    drawLabels(rows, { yGrid, yTick, yCov, H });
    return { max, nW };
  }

  function drawLabels(rows, { yGrid, yTick, yCov, H }) {
    labelSvg.replaceChildren();
    labelSvg.setAttribute('viewBox', `0 0 ${LABW} ${H}`);
    labelSvg.setAttribute('width', LABW); labelSvg.setAttribute('height', H);
    el('text', { x: LABW - 8, y: 24, class: 'lab-ev' }, labelSvg, 'Exercises');
    rows.forEach((r, i) => {
      const t = el('text', { x: LABW - 8, y: yGrid + i * (ROW + GAP) + 15, class: 'lab-row' + (r.kind === 'phrase' ? ' phrase' : ''), 'data-row': i }, labelSvg,
        r.label.length > 22 ? r.label.slice(0, 21) + '…”' : r.label);
      if (r.kind === 'theme') t.appendChild(el('title', {}, null, THEMES[r.k].label));
    });
    el('text', { x: LABW - 8, y: yTick + 11, class: 'lab-small' }, labelSvg, 'Readiness patrols');
    SOURCES.forEach((s, i) => el('text', { x: LABW - 8, y: yCov + i * (COVH + 3) + 9, class: 'lab-small' }, labelSvg, `${s} Taiwan items held`));
  }

  function hit(e) {
    if (!G) return null;
    const b = svg.getBoundingClientRect();
    const px = (e.clientX - b.left) * (G.W / b.width), py = (e.clientY - b.top) * (G.H / b.height);
    const ri = Math.floor((py - G.yGrid) / (ROW + GAP));
    const w = G.w0 + Math.floor(px / G.cw);
    if (ri < 0 || ri >= G.rows.length || w < G.w0 || w > G.w1) return null;
    return { row: G.rows[ri].k, w };
  }

  function drawSelection() {
    svg.querySelector('.sel')?.remove();
    const sel = G?.S.sel;
    if (!sel) return;
    const ri = G.rows.findIndex(r => r.k === sel.row);
    if (ri < 0 || sel.w < G.w0 || sel.w > G.w1) return;
    el('rect', { x: (sel.w - G.w0) * G.cw - 1, y: G.yGrid + ri * (ROW + GAP) - 1, width: G.cw + 2, height: ROW + 2, class: 'sel' }, svg);
  }

  svg.addEventListener('pointermove', e => {
    const h = hit(e);
    if (!h) { tip.hidden = true; onHover?.(null); return; }
    const n = G.agg.cells[h.row][h.w].length, tot = G.agg.total[h.w];
    const name = h.row === THEMES.length ? `“${G.S.matcher.phrase}”` : THEMES[h.row].label;
    const held = G.agg.held[h.w], lang = G.S.matcher?.zh ? 'Chinese' : 'English';
    tip.innerHTML = `<b>${name}</b><br>Week of ${weekStart(h.w)}<br>` + (!held ? 'No Taiwan-related statements held for the selected sources'
      : `<span class="num">${n}</span> of <span class="num">${tot}</span> Taiwan statements with ${lang} text${tot ? ` (${Math.round(100 * n / tot)}%)` : ''}`
        + (held > tot ? `<br><span class="num">${held - tot}</span> more held without ${lang} text` : ''));
    const box = scroller.parentElement.getBoundingClientRect();
    tip.hidden = false;
    const tx = Math.min(e.clientX - box.left + 14, box.width - tip.offsetWidth - 6);
    tip.style.left = Math.max(4, tx) + 'px';
    tip.style.top = (e.clientY - box.top + 14) + 'px';
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.addEventListener('click', e => { const h = hit(e); if (h) onSelect(h); });
  svg.addEventListener('keydown', e => {
    if (!G) return;
    const sel = G.S.sel || { row: G.rows[0].k, w: G.w1 };
    let ri = Math.max(0, G.rows.findIndex(r => r.k === sel.row)), w = sel.w;
    if (e.key === 'ArrowLeft') w--; else if (e.key === 'ArrowRight') w++;
    else if (e.key === 'ArrowUp') ri--; else if (e.key === 'ArrowDown') ri++;
    else return;
    e.preventDefault();
    ri = Math.max(0, Math.min(G.rows.length - 1, ri)); w = Math.max(G.w0, Math.min(G.w1, w));
    onSelect({ row: G.rows[ri].k, w });
    const cx = (w - G.w0) * G.cw * (svg.getBoundingClientRect().width / G.W);
    if (cx < scroller.scrollLeft + 20 || cx > scroller.scrollLeft + scroller.clientWidth - 20) scroller.scrollLeft = cx - scroller.clientWidth / 2;
  });

  return { render, drawSelection, geometry: () => G };
}
