// Shared export helpers: "Download PNG" for a tool's main SVG (or canvas) and "Copy data as CSV".
// Import from tools/<slug>/js/: '../../../shared/js/export.js'.
//
//   import { addExportBar } from '../../../shared/js/export.js';
//   addExportBar(hostEl, {
//     target: () => document.getElementById('map'),   // SVG or canvas to export (function, read at click time)
//     title: () => 'CCG incidents, 2026',             // heading stamped on the image (string or function)
//     note: 'Data: TSM China Coast Guard Incident Tracker', // optional source line
//     csv: () => [['date', 'count'], ...rows],         // optional; adds a "Copy data as CSV" button
//     where: 'append' | 'prepend' | 'after',           // placement relative to hostEl (default append)
//   });
//
// The PNG is drawn at 2x: the SVG is cloned with computed styles inlined (so CSS variables and classes
// survive), the page's Google Fonts are embedded when reachable, and a title, the TSM credit line and
// an export date are stamped around it.

const SLUG = (location.pathname.match(/\/tools\/([^/]+)\//) || [])[1] || 'tsm';
const today = () => new Date().toISOString().slice(0, 10);
const val = v => (typeof v === 'function' ? v() : v);
const PROPS = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight',
  'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order', 'visibility', 'color',
  'vector-effect', 'text-decoration', 'shape-rendering', 'mix-blend-mode', 'stop-color', 'stop-opacity'];

let fontCss = null;
/** @font-face rules with data: URLs for the page's Google Fonts (latin subset). '' if unavailable. */
function embeddedFonts() {
  if (fontCss) return fontCss;
  const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find(l => /fonts\.googleapis\.com/.test(l.href));
  if (!link) return (fontCss = Promise.resolve(''));
  fontCss = (async () => {
    const css = await (await fetch(link.href)).text();
    const blocks = css.split('@font-face').slice(1)
      .map(b => '@font-face' + b.slice(0, b.indexOf('}') + 1))
      .filter(b => /U\+0000-00FF/i.test(b));
    const out = await Promise.all(blocks.map(async b => {
      const url = (b.match(/url\((https:[^)]+)\)/) || [])[1];
      if (!url) return '';
      const buf = await (await fetch(url)).arrayBuffer();
      let s = ''; const u = new Uint8Array(buf);
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return b.replace(url, `data:font/woff2;base64,${btoa(s)}`);
    }));
    return out.join('\n');
  })().catch(() => '');
  return fontCss;
}

/** Copy an SVG with computed styles inlined; hidden nodes are dropped. */
function inlineClone(svg) {
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
  const drop = [];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el), d = dst[i];
    if (cs.display === 'none') { drop.push(d); return; }
    d.removeAttribute('class');
    d.setAttribute('style', PROPS.map(p => {
      const v = cs.getPropertyValue(p);
      return v && v !== 'none' || ['fill', 'stroke'].includes(p) ? `${p}:${v}` : '';
    }).filter(Boolean).join(';'));
  });
  drop.forEach(d => d.remove());
  clone.querySelectorAll('title, desc').forEach(t => t.remove());
  return clone;
}

/** Nearest ancestor background colour, so maps keep their sea and charts their panel. */
function backdrop(el) {
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && !/rgba\(.*,\s*0\)$|transparent/.test(c)) return c;
  }
  return getComputedStyle(document.body).backgroundColor || '#f2f2ee';
}

async function svgImage(svg, w, h) {
  const clone = inlineClone(svg);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', w); clone.setAttribute('height', h);
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const fonts = await Promise.race([embeddedFonts(), new Promise(r => setTimeout(() => r(''), 4000))]);
  if (fonts) {
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = fonts; clone.prepend(st);
  }
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/** Wrap text to a width; returns lines. */
function wrap(ctx, text, width) {
  const words = String(text).split(/\s+/), lines = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > width && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** Render the target (SVG or canvas) with a title, credit line and date; resolves to a PNG blob. */
export async function renderPng(target, { title = document.title.split(' | ')[0], note = '' } = {}) {
  const el = val(target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  const S = 2, pad = 20, root = getComputedStyle(document.documentElement);
  const ink = root.getPropertyValue('--ink').trim() || '#14201a', muted = root.getPropertyValue('--muted').trim() || '#56625b';
  const accent = root.getPropertyValue('--accent').trim() || '#e8753a';
  const disp = root.getPropertyValue('--display').trim() || 'Georgia, serif', body = root.getPropertyValue('--body').trim() || 'Arial, sans-serif';
  const W = Math.max(w + pad * 2, 480);
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `700 20px ${disp}`;
  const tLines = wrap(probe, val(title), W - pad * 2);
  probe.font = `12px ${body}`;
  const credit = 'Taiwan Security Monitor · Schar School of Policy and Government, George Mason University';
  const stamp = `${val(note) ? val(note) + ' · ' : ''}Exported ${today()} from TSM Interactive · ${location.href.split('#')[0]}`;
  const sLines = wrap(probe, stamp, W - pad * 2);
  probe.font = `600 12.5px ${body}`;
  const cLines = wrap(probe, credit, W - pad * 2);
  const head = pad + tLines.length * 25 + 8, foot = 14 + cLines.length * 17 + sLines.length * 16 + pad;
  const H = head + h + foot;
  const cv = document.createElement('canvas');
  cv.width = W * S; cv.height = H * S;
  const ctx = cv.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#f2f2ee';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 4);
  ctx.fillStyle = ink; ctx.font = `700 20px ${disp}`; ctx.textBaseline = 'top';
  tLines.forEach((l, i) => ctx.fillText(l, pad, pad + i * 25));
  const x0 = Math.round((W - w) / 2);
  ctx.fillStyle = backdrop(el.parentElement || el);
  ctx.fillRect(x0, head, w, h);
  if (el instanceof HTMLCanvasElement) ctx.drawImage(el, x0, head, w, h);
  else ctx.drawImage(await svgImage(el, w, h), x0, head, w, h);
  let y = head + h + 14;
  ctx.fillStyle = ink; ctx.font = `600 12.5px ${body}`; cLines.forEach(l => { ctx.fillText(l, pad, y); y += 17; });
  ctx.fillStyle = muted; ctx.font = `12px ${body}`;
  sLines.forEach(l => { ctx.fillText(l, pad, y); y += 16; });
  return new Promise(res => cv.toBlob(res, 'image/png'));
}

/** renderPng, then save the file. */
export async function downloadPng(target, { title, note = '', filename } = {}) {
  const blob = await renderPng(target, { title, note });
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || `tsm-${SLUG}-${today()}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Rows (array of arrays) to CSV text. */
export function toCsv(rows) {
  const q = v => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(r => r.map(q).join(',')).join('\n');
}

/** Rows from an HTML table's text (header row included). */
export function tableRows(table) {
  const t = val(table);
  if (!t) return [];
  return [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
}

/** Copy CSV text to the clipboard; falls back to a file download. Returns 'copied' or 'downloaded'. */
export async function copyCsv(rows, filename) {
  const text = toCsv(val(rows));
  try { await navigator.clipboard.writeText(text); return 'copied'; }
  catch {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = filename || `tsm-${SLUG}-${today()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    return 'downloaded';
  }
}

function flash(btn, text) {
  const was = btn.dataset.label || btn.textContent;
  btn.dataset.label = was; btn.textContent = text;
  clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = was; }, 1800);
}

/** Add a small export toolbar next to a chart or map. Returns the bar element. */
export function addExportBar(host, { target, title, note = '', csv, csvLabel = 'Copy data as CSV', pngLabel = 'Download PNG', where = 'append', filename } = {}) {
  if (!host) return null;
  const bar = document.createElement('div');
  bar.className = 'tsm-export';
  if (target) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn tsm-export-btn'; b.textContent = pngLabel;
    b.onclick = async () => {
      b.disabled = true;
      try { await downloadPng(target, { title: val(title) || undefined, note: val(note), filename }); flash(b, 'Saved'); }
      catch (e) { console.warn('PNG export failed', e); flash(b, 'Export failed'); }
      finally { b.disabled = false; }
    };
    bar.appendChild(b);
  }
  if (csv) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn tsm-export-btn'; b.textContent = csvLabel;
    b.onclick = async () => {
      const rows = val(csv) || [];
      const how = await copyCsv(rows);
      flash(b, how === 'copied' ? `Copied ${Math.max(0, rows.length - 1)} rows` : 'Saved as file');
    };
    bar.appendChild(b);
  }
  if (where === 'prepend') host.prepend(bar);
  else if (where === 'after') host.after(bar);
  else host.appendChild(bar);
  return bar;
}
