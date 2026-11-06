// Gantt-style case timeline: notification -> contract -> first delivery -> expected completion.
import { el, escapeHtml } from '../../../shared/js/mapkit.js';
import { ASOF, fmtD, fmtM, fmtAge } from './model.js';

const ADMINS = [
  { name: 'Trump', a: Date.UTC(2017, 0, 20), b: Date.UTC(2021, 0, 20) },
  { name: 'Biden', a: Date.UTC(2021, 0, 20), b: Date.UTC(2025, 0, 20) },
  { name: 'Trump', a: Date.UTC(2025, 0, 20), b: Date.UTC(2029, 0, 20) },
];
const KIND = { contract: 'Contract or LOA', delivery: 'First delivery', expect: 'Expected completion', event: 'Milestone', done: 'Left the backlog' };
const VB = { verified: 'Notification checked against the official record', tsm: 'From TSM\'s dataset only', diff: 'Matches the official record, with a caveat' };

export function createGantt(svg, tip, { onSelect }) {
  let rows = [], sel = null;
  const box = svg.parentElement;

  function showTip(evt, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = box.getBoundingClientRect();
    const x = Math.min(evt.clientX - r.left + 12, r.width - 290);
    tip.style.left = Math.max(0, x) + 'px';
    tip.style.top = (evt.clientY - r.top + 14) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };

  function draw() {
    svg.textContent = '';
    const W = Math.max(320, box.clientWidth);
    const narrow = W < 620;
    const LW = narrow ? 0 : Math.min(270, Math.round(W * 0.3));
    const RH = narrow ? 40 : 27, TOP = 40, PADR = 16;
    const minN = rows.length ? Math.min(...rows.map(c => c.nD.getTime())) : Date.UTC(2017, 0, 1);
    const maxE = Math.max(ASOF.getTime(), ...rows.map(c => (c.expect ? c.expect.date.getTime() : 0)));
    const y0 = new Date(minN).getUTCFullYear(), y1 = new Date(maxE).getUTCFullYear() + 1;
    const t0 = Date.UTC(y0, 0, 1), t1 = Date.UTC(y1, 0, 1);
    const X = t => LW + 8 + (t - t0) / (t1 - t0) * (W - LW - 8 - PADR);
    const H = TOP + Math.max(1, rows.length) * RH + 24;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);

    const adm = el('g', { class: 'g-admin' }, svg);
    ADMINS.forEach((a, i) => {
      const xa = Math.max(X(a.a), X(t0)), xb = Math.min(X(a.b), X(t1));
      if (xb <= xa) return;
      if (i % 2 === 0) el('rect', { x: xa, y: 16, width: xb - xa, height: H - 16 }, adm);
      if (xb - xa > 46) el('text', { x: xa + 4, y: 12 }, adm, a.name);
    });
    const ax = el('g', { class: 'g-axis' }, svg);
    const step = (W - LW) / (y1 - y0) < 34 ? 2 : 1;
    for (let y = y0; y <= y1; y++) {
      const x = X(Date.UTC(y, 0, 1));
      el('line', { x1: x, y1: 30, x2: x, y2: H }, ax).style.opacity = y % step ? 0 : 0.7;
      if (!(y % step) && y < y1) el('text', { x: x + 3, y: 34 }, ax, narrow ? `’${String(y).slice(2)}` : y);
    }

    const body = el('g', {}, svg);
    if (!rows.length) el('text', { x: W / 2, y: TOP + 20, 'text-anchor': 'middle', class: 'g-empty' }, body, 'No cases match these filters.');
    rows.forEach((c, i) => {
      const y = TOP + i * RH;
      const by = narrow ? y + 25 : y + RH / 2;
      const g = el('g', { class: `g-row${c.gone ? ' gone' : ''}`, role: 'listitem', tabindex: 0, 'data-key': c.key,
        'aria-selected': String(c.key === sel),
        'aria-label': `${c.name}, ${fmtM(c.m)}, notified ${fmtD(c.notified)}, ${c.gone ? c.outcome.toLowerCase() + ' ' + fmtD(c.left) : 'waiting ' + fmtAge(c.age)}` }, body);
      el('rect', { class: 'hit', x: 0, y: y + 1, width: W, height: RH - 2, rx: 3 }, g);
      const vb = c.verify.v;
      const dot = el('circle', { cx: 7, cy: narrow ? y + 11 : by, r: 3.6, class: 'mk' }, g);
      dot.style.fill = vb === 'verified' ? 'var(--good)' : vb === 'diff' ? 'var(--warn)' : 'var(--panel)';
      dot.style.stroke = vb === 'verified' ? 'var(--good)' : vb === 'diff' ? 'var(--warn)' : 'var(--muted)';
      dot.style.strokeWidth = 1.4;
      dot.addEventListener('pointerenter', e => showTip(e, `<b>${VB[vb]}</b><span class="d">${escapeHtml(c.verify.note || '')}</span>`));
      dot.addEventListener('pointerleave', hideTip);
      const nm = el('text', { class: 'nm', x: 16, y: (narrow ? y + 11 : by) + 4 }, g, trunc(c.name, narrow ? Math.floor((W - 90) / 6.9) : Math.floor((LW - 70) / 6.6)));
      if (narrow) el('tspan', { class: 'val', dx: 6 }, nm, fmtM(c.m));
      else el('text', { class: 'val', x: LW, y: by + 4, 'text-anchor': 'end' }, g, fmtM(c.m));

      const xa = X(c.nD.getTime()), xe = X(c.endD.getTime());
      el('rect', { class: `wait cat-${c.cat}`, x: xa, y: by - 5, width: Math.max(2, xe - xa), height: 10, rx: 2 }, g);
      if (c.delivery) {
        const xd = Math.max(xa, X(c.delivery.date.getTime()));
        el('rect', { class: 'deliv', x: xd, y: by - 5, width: Math.max(3, xe - xd), height: 10, rx: 2 }, g);
      } else if (c.partial) {
        el('rect', { class: 'deliv', x: xe - 6, y: by - 5, width: 6, height: 10, rx: 2 }, g);
      }
      if (!c.gone && c.expect && c.expect.date > ASOF) {
        const xx = X(c.expect.date.getTime());
        el('path', { class: 'fut', d: `M${xe + 2} ${by}H${xx}` }, g);
        mark(el('circle', { class: 'fut-end mk', cx: xx, cy: by, r: 4 }, g), c, c.expect);
      }
      mark(el('circle', { class: `start cat-${c.cat} mk`, cx: xa, cy: by, r: 5 }, g), c,
        { m: 'notified', d: c.notified, t: `Notified to Congress, ${fmtM(c.m)}` });
      c.ms.forEach(m => {
        const x = X(m.date.getTime());
        if (m.m === 'contract') mark(el('rect', { class: 'ct mk', x: x - 4.5, y: by - 4.5, width: 9, height: 9, transform: `rotate(45 ${x} ${by})` }, g), c, m);
        else if (m.m === 'event') mark(el('line', { class: 'ev mk', x1: x, y1: by - 8, x2: x, y2: by + 8 }, g), c, m);
        else if (m.m === 'done') mark(el('rect', { class: 'done mk', x: x - 5, y: by - 5, width: 10, height: 10, rx: 2 }, g), c, m);
        else if (m.m === 'delivery' && !c.gone) mark(el('circle', { class: 'deliv mk', cx: x, cy: by, r: 3.5 }, g), c, m);
        else if (m.m === 'expect' && m.date <= ASOF) mark(el('circle', { class: 'fut-end mk', cx: x, cy: by, r: 4 }, g), c, m);
      });
      g.addEventListener('click', () => onSelect(c.key));
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.key); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const sib = body.children[i + (e.key === 'ArrowDown' ? 1 : -1)];
          if (sib && sib.focus) sib.focus();
        }
      });
    });

    const tx = X(ASOF.getTime());
    const td = el('g', { class: 'g-today' }, svg);
    el('line', { x1: tx, y1: 20, x2: tx, y2: H - 16 }, td);
    el('text', { x: tx, y: H - 3, 'text-anchor': 'middle' }, td, 'Data date, Sept. 30, 2026');
  }

  function mark(node, c, m) {
    node.addEventListener('pointerenter', e => {
      const kind = m.m === 'notified' ? 'Congressional notification' : KIND[m.m];
      showTip(e, `<b>${escapeHtml(c.name)}</b><span class="d">${kind} · ${fmtD(m.d)}</span>${escapeHtml(m.t)}`);
    });
    node.addEventListener('pointerleave', hideTip);
  }

  const ro = new ResizeObserver(() => draw());
  ro.observe(box);
  svg.addEventListener('pointerleave', hideTip);

  return {
    update(list, selected) { rows = list; sel = selected; draw(); },
    select(key) {
      sel = key;
      svg.querySelectorAll('.g-row').forEach(g => g.setAttribute('aria-selected', String(g.dataset.key === key)));
    },
    focus(key) { const g = svg.querySelector(`.g-row[data-key="${key}"]`); if (g) g.focus({ preventScroll: false }); },
  };
}

function trunc(s, n) { return s.length > n ? s.slice(0, Math.max(4, n - 1)) + '…' : s; }
