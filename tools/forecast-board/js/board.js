// Live board: every open contract on the latest archived price, with a 60-day sparkline.
import { el, esc, cents, signedPts, fmtUSD, dayLabel, THEATER_COLOR } from './util.js';

const SW = 132, SH = 30;

function spark(rows, color) {
  const svg = el('svg', { viewBox: `0 0 ${SW} ${SH}`, class: 'spark', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  if (!rows || rows.length < 2) return svg;
  const vals = rows.map(r => r[1]);
  const lo = Math.max(0, Math.min(...vals) - 2), hi = Math.min(100, Math.max(...vals) + 2);
  const x = i => 1 + (i / (rows.length - 1)) * (SW - 6);
  const y = v => SH - 2 - ((v - lo) / (hi - lo || 1)) * (SH - 4);
  el('path', { d: rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(r[1]).toFixed(1)}`).join(''), class: 'sp-line', style: `stroke:${color}` }, svg);
  const last = rows[rows.length - 1];
  el('circle', { cx: x(rows.length - 1), cy: y(last[1]), r: 2.4, style: `fill:${color}` }, svg);
  return svg;
}

/** Families visible under the current filter and sort. */
export function visibleFamilies(board, st) {
  let fams = board.families.filter(f => st.th === 'all' || f.th === st.th);
  if (st.sort === 'move') {
    const mv = f => Math.max(...f.contracts.map(c => Math.abs(c.d7 ?? 0)));
    fams = [...fams].sort((a, b) => mv(b) - mv(a));
  } else if (st.sort === 'vol') {
    fams = [...fams].sort((a, b) => b.vol - a.vol);
  }
  return fams;
}

export function renderBoard(root, board, st, onOpen) {
  root.innerHTML = '';
  const fams = visibleFamilies(board, st);
  if (!fams.length) {
    root.innerHTML = '<p class="fine">No open contracts in this theater on the latest archive.</p>';
    return;
  }
  let lastTh = null;
  for (const f of fams) {
    if (st.sort === 'theater' && f.th !== lastTh) {
      lastTh = f.th;
      const h = document.createElement('h3');
      h.className = 'th-h';
      h.innerHTML = `<i style="background:${THEATER_COLOR[f.th]}"></i>${esc(board.theaters[f.th])}`;
      root.appendChild(h);
    }
    const card = document.createElement('section');
    card.className = 'fam';
    const single = f.contracts.length === 1;
    card.innerHTML = single ? '' : `<div class="fam-h"><p class="fam-t">${esc(f.event)}</p>
      <span class="fine">${f.daily ? 'next five days shown · ' : ''}${fmtUSD(f.vol)} traded</span></div>`;
    const list = document.createElement('div');
    list.className = 'rows';
    for (const c of f.contracts) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'row';
      b.dataset.id = c.id;
      if (st.m === c.id) b.setAttribute('aria-current', 'true');
      const d7 = c.d7 == null ? '' : `<span class="chg ${c.d7 > 0.05 ? 'up' : c.d7 < -0.05 ? 'down' : ''}" title="Change over 7 days, in cents">${signedPts(c.d7)}</span>`;
      const meta = [c.deadline ? `deadline ${dayLabel(c.deadline)}` : '', single ? `${fmtUSD(f.vol)} traded` : ''].filter(Boolean).join(' · ');
      b.innerHTML = `<span class="rq${single ? ' one' : ''}">${esc(c.q)}<small>${meta}</small></span>
        <span class="rs"></span><span class="rp">${cents(c.p)}</span>${d7 || '<span class="chg">new</span>'}`;
      b.querySelector('.rs').appendChild(spark(c.spark, THEATER_COLOR[c.th]));
      b.setAttribute('aria-label', `${c.q}: ${cents(c.p)} per one-dollar Yes share${c.d7 != null ? `, ${signedPts(c.d7)} cents over 7 days` : ''}. Open price history.`);
      b.onclick = () => onOpen(c.id);
      list.appendChild(b);
    }
    card.appendChild(list);
    root.appendChild(card);
  }
}

/** Panel readouts for the board. */
export function boardSummary(board, st) {
  const fams = visibleFamilies(board, st);
  const cs = fams.flatMap(f => f.contracts);
  const movers = [...cs].filter(c => c.d7 != null).sort((a, b) => Math.abs(b.d7) - Math.abs(a.d7)).slice(0, 3);
  return { n: cs.length, nf: fams.length, movers };
}
