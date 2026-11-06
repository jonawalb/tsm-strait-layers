// Lays page blocks out on fixed US Letter sheets (816 x 1056 CSS px = 8.5 x 11 in).
// Blocks are appended one at a time; when a block overflows the sheet body it moves to a new
// sheet. Tables and lists continue row by row, repeating their header on the next sheet.
import { frag } from './util.js';

function makeSheet(container, run, cover = false) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  const sheet = document.createElement('article');
  sheet.className = cover ? 'sheet cover' : 'sheet';
  if (!cover) {
    sheet.innerHTML = `<header class="sh-head"><img src="../../shared/assets/tsm-logo.png" alt="" width="30" height="30">
      <p class="sh-org">Taiwan Security Monitor · Briefing packet</p><p class="sh-range">${run}</p></header>
      <div class="sh-body"></div>
      <footer class="sh-foot"><span>Prepared with TSM Interactive</span><span class="sh-sec"></span><span class="sh-pg"></span></footer>`;
  }
  slot.appendChild(sheet);
  container.appendChild(slot);
  return sheet;
}

const intoOf = (wrap, sel) => wrap.matches(sel) ? wrap : wrap.querySelector(sel);

/**
 * @param {HTMLElement} container
 * @param {{coverHtml: string, blocks: object[], run: string, titles: Record<string,string>}} doc
 * @returns {{sheets: HTMLElement[], firstPage: Record<string, number>}}
 */
export function paginate(container, { coverHtml, blocks, run, titles }) {
  container.textContent = '';
  const cover = makeSheet(container, run, true);
  cover.innerHTML = coverHtml;
  const sheets = [cover], firstPage = {};
  let sheet, body;
  const next = () => {
    sheet = makeSheet(container, run);
    body = sheet.querySelector('.sh-body');
    sheets.push(sheet);
  };
  const over = () => body.scrollHeight > body.clientHeight + 1;
  next();

  let held = null; // a section heading waiting for its first block
  /** Append nodes (plus any held heading) together; move them to a new sheet if they overflow. */
  const place = (el, sec) => {
    const nodes = held ? [frag(held.html), el] : [el];
    held = null;
    nodes.forEach(n => body.appendChild(n));
    if (over() && body.childElementCount > nodes.length) {
      nodes.forEach(n => n.remove());
      next();
      nodes.forEach(n => body.appendChild(n));
    }
    sheet.dataset.sec ||= sec;
    firstPage[sec] ??= sheets.length;
    return nodes;
  };

  for (const b of blocks) {
    if (b.t === 'break') { if (body.childElementCount) next(); continue; }
    if (b.t === 'h') { held = b; continue; }
    if (b.t === 'b') { place(frag(b.html), b.sec); continue; }
    // Rows: open the container (with any held heading), then add rows one at a time.
    let wrap = frag(b.wrap), into = intoOf(wrap, b.into);
    let opened = place(wrap, b.sec);
    for (const row of b.rows) {
      const isTr = row.trimStart().startsWith('<tr');
      const el = isTr ? frag(`<table><tbody>${row}</tbody></table>`).querySelector('tr') : frag(row);
      into.appendChild(el);
      if (!over()) continue;
      el.remove();
      if (into.childElementCount === 0) {
        // Nothing of this container fits here: move it, and its heading, to the next sheet.
        opened.forEach(n => n.remove());
        next();
        opened.forEach(n => body.appendChild(n));
        if (opened.length > 1) firstPage[b.sec] = sheets.length;
      } else {
        next();
        body.appendChild(frag(`<p class="cont">${b.cont} (continued)</p>`));
        const done = (+into.getAttribute('start') || 1) + into.childElementCount;
        wrap = frag(b.wrap);
        into = intoOf(wrap, b.into);
        if (into.tagName === 'OL') into.setAttribute('start', done);
        body.appendChild(wrap);
        opened = [wrap];
      }
      sheet.dataset.sec ||= b.sec;
      into.appendChild(el);
    }
  }
  if (!body.childElementCount && sheets.length > 1) { sheet.parentElement.remove(); sheets.pop(); }
  const N = sheets.length;
  sheets.forEach((s, i) => {
    const pg = s.querySelector('.sh-pg');
    if (pg) pg.textContent = `Page ${i + 1} of ${N}`;
    const sc = s.querySelector('.sh-sec');
    if (sc) sc.textContent = titles[s.dataset.sec] || '';
  });
  return { sheets, firstPage };
}
