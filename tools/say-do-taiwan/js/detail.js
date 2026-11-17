// Simple | Full detail switch. Shared verbatim by say-do-taiwan and say-do-global.
// Body class detail-simple / detail-full; the reader's choice is kept in localStorage 'et-detail' (house key).
// A page without [data-detail] buttons always shows Full detail, so nothing is hidden there.
const KEY = 'et-detail';
let mode = 'simple';
try { if (localStorage.getItem(KEY) === 'full') mode = 'full'; } catch { /* storage blocked: default to Simple */ }

export const detailMode = () => mode;

/** Show a mode. persist=false is for the walkthrough, which must never change the reader's saved choice. */
export function setDetail(m, persist = true) {
  mode = m === 'full' ? 'full' : 'simple';
  document.body.classList.toggle('detail-simple', mode === 'simple');
  document.body.classList.toggle('detail-full', mode === 'full');
  document.querySelectorAll('[data-detail]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.detail === mode)));
  if (persist) { try { localStorage.setItem(KEY, mode); } catch { /* ignore */ } }
}

export function initDetail() {
  const btns = document.querySelectorAll('[data-detail]');
  if (!btns.length) { mode = 'full'; setDetail('full', false); return; }
  btns.forEach(b => b.addEventListener('click', () => setDetail(b.dataset.detail)));
  setDetail(mode, false);
}
