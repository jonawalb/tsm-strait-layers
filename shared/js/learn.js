// "New here? Learn to play": the same first-run tutorial for every wargame on both sites.
//
//   learnButton(where, { slug, minutes, onStart, sheet })  banner at the TOP of a game's setup screen (above the
//       side / balance / scenario choices). `where` is the setup container; the banner is inserted as its first child.
//   runLesson(steps, { slug, title, onExit })               guided, hands-on lesson. One idea per step.
//   showSheet(sheet)                                        the rules on one screen (goal, controls, ideas that win).
//
// A step: { title, body?, do?, target?, start?, done?, wait? }
//   body/do   text (HTML string or a function returning one). `do` steps wait for the player to act.
//   target    () => element to highlight (optional). Looked up when the step shows, since games redraw.
//   start     () => value; runs when the step shows (e.g. open a panel). Its return value is passed to done().
//   done      (startValue) => true once the player has done the thing. Polled; the lesson then moves on by itself.
// The only thing remembered is whether this player has finished a game's lesson (localStorage `learned:<slug>`),
// which turns the banner into "Replay the tutorial". Nothing else is stored.

const css = `
.learn-banner { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; padding: 10px 14px; margin: 0 0 12px;
  border: 1px solid var(--accent); border-left-width: 4px; border-radius: 4px; background: color-mix(in srgb, var(--accent) 8%, var(--panel)); }
.learn-banner .lb-t { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 220px; }
.learn-banner .lb-t b { font: 600 15px var(--display); color: var(--ink); }
.learn-banner .lb-t span { font-size: 12.5px; color: var(--muted); }
.learn-banner .lb-go { font: 600 14px var(--body); padding: 8px 14px; border-radius: 4px; border: 1px solid var(--accent); background: var(--accent); color: #fff; cursor: pointer; white-space: nowrap; }
.learn-banner .lb-sheet { font: 500 13px var(--body); padding: 7px 12px; border-radius: 4px; border: 1px solid var(--rule); background: var(--panel); color: var(--ink); cursor: pointer; white-space: nowrap; }
.learn-banner button:focus-visible, .learn-card button:focus-visible, .learn-sheet button:focus-visible { outline: 2px solid var(--focus, var(--accent)); outline-offset: 2px; }
.learn-ring { position: fixed; z-index: 9990; pointer-events: none; border: 3px solid var(--accent); border-radius: 6px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent); transition: all .2s ease; }
.learn-card { position: fixed; z-index: 9991; width: min(360px, calc(100vw - 24px)); background: var(--panel); color: var(--ink);
  border: 1px solid var(--rule); border-top: 4px solid var(--accent); border-radius: 6px; padding: 12px 14px 12px; box-shadow: 0 12px 34px rgba(0, 0, 0, .28); font: 14px/1.45 var(--body); }
.learn-card .lc-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; font: 600 11px var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.learn-card .lc-x { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: var(--muted); padding: 0 2px; }
.learn-card h3 { margin: 4px 0 6px; font: 600 18px/1.2 var(--display); }
.learn-card p { margin: 0 0 8px; }
.learn-card .lc-do { padding: 7px 9px; border-radius: 4px; background: color-mix(in srgb, var(--accent) 12%, transparent); }
.learn-card .lc-do::before { content: "Your turn: "; font-weight: 600; }
.learn-card .lc-wait { font-size: 12px; color: var(--muted); margin: 0; }
.learn-card .lc-nav { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; }
.learn-card .lc-nav button { font: 600 13px var(--body); padding: 6px 12px; border-radius: 4px; border: 1px solid var(--rule); background: var(--panel); color: var(--ink); cursor: pointer; }
.learn-card .lc-nav .lc-next { border-color: var(--accent); background: var(--accent); color: #fff; }
.learn-card .lc-nav button:disabled { opacity: .45; cursor: default; }
.learn-bar { height: 3px; background: var(--chip); border-radius: 2px; overflow: hidden; margin-top: 6px; }
.learn-bar i { display: block; height: 100%; background: var(--accent); }
@media (max-width: 600px) { .learn-card { left: 8px !important; right: 8px; bottom: 8px; top: auto !important; width: auto; max-height: 42vh; overflow: auto; padding: 10px 12px; font-size: 13.5px; } .learn-card h3 { font-size: 16px; } }
.learn-sheet { position: fixed; inset: 0; z-index: 9992; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, .45); }
.learn-sheet .ls-card { width: min(640px, 100%); max-height: calc(100vh - 32px); overflow: auto; background: var(--panel); color: var(--ink);
  border: 1px solid var(--rule); border-top: 4px solid var(--accent); border-radius: 6px; padding: 16px 18px; font: 14px/1.5 var(--body); }
.learn-sheet h2 { margin: 0 0 6px; font: 700 22px var(--display); outline: none; }
.learn-sheet h3 { margin: 12px 0 4px; font: 600 12px var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.learn-sheet ul { margin: 0; padding-left: 1.1em; } .learn-sheet li { margin: 2px 0; }
.learn-sheet table { border-collapse: collapse; width: 100%; font-size: 13px; } .learn-sheet td { padding: 3px 6px; border-top: 1px solid var(--rule); vertical-align: top; }
.learn-sheet td:first-child { white-space: nowrap; font-family: var(--mono); font-size: 12px; }
.learn-sheet .ls-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.learn-sheet .ls-foot button { font: 600 13px var(--body); padding: 7px 14px; border-radius: 4px; border: 1px solid var(--rule); background: var(--panel); color: var(--ink); cursor: pointer; }
.learn-sheet .ls-foot .ls-go { border-color: var(--accent); background: var(--accent); color: #fff; }
@media (prefers-reduced-motion: reduce) { .learn-ring { transition: none; } }
`;
let styled = false;
function style() {
  if (styled) return;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); styled = true;
}
const html = v => (typeof v === 'function' ? v() : v) || '';
const learnedKey = slug => `learned:${slug}`;
const learned = slug => { try { return localStorage.getItem(learnedKey(slug)) === '1'; } catch { return false; } };

/** The banner at the top of a game's setup screen. Returns { el, refresh }. */
export function learnButton(where, { slug, minutes = 5, onStart, sheet, blurb } = {}) {
  style();
  const el = document.createElement('div');
  el.className = 'learn-banner';
  el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Tutorial');
  const draw = () => {
    const again = slug && learned(slug);
    el.innerHTML = `<div class="lb-t"><b>${again ? 'Want a refresher?' : 'New here? Learn to play'}</b>
      <span>${blurb || (again ? 'Replay the guided first game.' : `A guided first game, about ${minutes} minutes. Every term is explained as it comes up.`)}</span></div>
      <button type="button" class="lb-go">${again ? 'Replay the tutorial' : `Learn to play (${minutes} min)`}</button>
      ${sheet ? '<button type="button" class="lb-sheet">Rules on one screen</button>' : ''}`;
    el.querySelector('.lb-go').onclick = () => onStart && onStart();
    if (sheet) el.querySelector('.lb-sheet').onclick = () => showSheet(sheet, { onStart });
  };
  draw();
  where.insertBefore(el, where.firstChild);
  return { el, refresh: draw };
}

/** Run a hands-on lesson. Returns { stop }. */
export function runLesson(steps, { slug, title = 'Learn to play', onExit, onFinish } = {}) {
  style();
  let i = -1, timer = null, s0 = null, lastFocus = document.activeElement;
  const ring = document.createElement('div'); ring.className = 'learn-ring'; ring.hidden = true;
  const card = document.createElement('div'); card.className = 'learn-card';
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', title); card.setAttribute('aria-live', 'polite');
  document.body.append(ring, card);

  let settling = () => false;
  const place = () => {
    if (settling()) return;
    const s = steps[i]; const t = s && s.target ? s.target() : null;
    if (!t || !t.getBoundingClientRect || t.offsetParent === null && getComputedStyle(t).position !== 'fixed') {
      ring.hidden = true; card.style.left = `${Math.max(12, innerWidth - card.offsetWidth - 16)}px`; card.style.top = '76px'; return;
    }
    const r = t.getBoundingClientRect();
    ring.hidden = false;
    Object.assign(ring.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left = r.right + 12 + cw < innerWidth ? r.right + 12 : r.left - 12 - cw > 0 ? r.left - 12 - cw : Math.min(innerWidth - cw - 12, Math.max(12, r.left));
    let top = left === r.right + 12 || left === r.left - 12 - cw ? Math.max(12, Math.min(innerHeight - ch - 12, r.top))
      : (r.bottom + 12 + ch < innerHeight ? r.bottom + 12 : Math.max(12, r.top - 12 - ch));
    card.style.left = `${left}px`; card.style.top = `${top}px`;
  };
  const show = () => {
    clearInterval(timer);
    const s = steps[i];
    s0 = s.start ? s.start() : null;
    const t = s.target ? s.target() : null;
    let scrolling = false;
    if (t && t.scrollIntoView) {
      const r = t.getBoundingClientRect();
      // On a phone the card covers the bottom of the screen, so the target must sit in the top half.
      const phone = innerWidth <= 600, low = phone ? innerHeight * 0.5 : innerHeight - 20;
      if (r.top < 60 || r.bottom > low) {
        const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (phone) scrollTo({ top: scrollY + r.top - 64, behavior: smooth ? 'smooth' : 'auto' });
        else t.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
        // Hide the ring while a smooth scroll runs, so it never sits on the wrong element; place it when it settles.
        // A step's start() can switch tabs and move the layout under a running scroll; re-check once it settles.
        const recheck = () => { const r2 = t.getBoundingClientRect(); if (phone && (r2.top < 56 || r2.top > low)) scrollTo({ top: scrollY + r2.top - 64, behavior: 'auto' }); };
        if (smooth) { scrolling = true; ring.hidden = true; settling = () => scrolling; setTimeout(() => { recheck(); scrolling = false; place(); }, 450); }
        else requestAnimationFrame(() => { recheck(); place(); });
      }
    }
    const doing = !!(s.do && s.done);
    card.innerHTML = `<div class="lc-h"><span>${title} · ${i + 1} of ${steps.length}</span><button type="button" class="lc-x" aria-label="Leave the tutorial">×</button></div>
      <h3>${html(s.title)}</h3>${s.body ? `<p>${html(s.body)}</p>` : ''}${s.do ? `<p class="lc-do">${html(s.do)}</p>` : ''}
      ${doing ? `<p class="lc-wait">${html(s.wait) || 'The tutorial moves on when you have done it.'}</p>` : ''}
      <div class="lc-nav"><button type="button" class="lc-back" ${i === 0 ? 'disabled' : ''}>Back</button>
        <button type="button" class="lc-next">${doing ? 'Skip this step' : i === steps.length - 1 ? 'Finish' : 'Next'}</button></div>
      <div class="learn-bar" aria-hidden="true"><i style="width:${Math.round((i + 1) / steps.length * 100)}%"></i></div>`;
    card.querySelector('.lc-x').onclick = () => stop(false);
    card.querySelector('.lc-back').onclick = () => go(i - 1);
    card.querySelector('.lc-next').onclick = () => go(i + 1);
    requestAnimationFrame(place);
    if (!doing) card.querySelector('.lc-next').focus({ preventScroll: true });
    if (doing) timer = setInterval(() => {
      let ok = false; try { ok = s.done(s0); } catch { ok = false; }
      if (ok) { clearInterval(timer); setTimeout(() => go(i + 1), 450); } else place();
    }, 300);
  };
  const go = n => { if (n < 0) return; if (n >= steps.length) { stop(true); return; } i = n; show(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); stop(false); } };
  const onMove = () => place();
  function stop(finished) {
    clearInterval(timer);
    ring.remove(); card.remove();
    document.removeEventListener('keydown', onKey, true); removeEventListener('resize', onMove); removeEventListener('scroll', onMove, true);
    if (finished && slug) { try { localStorage.setItem(learnedKey(slug), '1'); } catch { /* storage blocked */ } }
    if (finished && onFinish) onFinish();
    if (onExit) onExit(finished);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', onKey, true); addEventListener('resize', onMove); addEventListener('scroll', onMove, true);
  go(0);
  return { stop: () => stop(false) };
}

/** The rules on one screen. sheet = { title, goal, controls: [[key, what]], ideas: [..], terms?: [[term, meaning]] } */
export function showSheet(sheet, { onStart } = {}) {
  style();
  const prev = document.activeElement;
  const el = document.createElement('div');
  el.className = 'learn-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', sheet.title || 'How to play');
  el.innerHTML = `<div class="ls-card"><h2>${sheet.title || 'How to play'}</h2>
    ${sheet.goal ? `<h3>Goal</h3><p>${sheet.goal}</p>` : ''}
    ${sheet.controls?.length ? `<h3>Controls</h3><table>${sheet.controls.map(([k, w]) => `<tr><td>${k}</td><td>${w}</td></tr>`).join('')}</table>` : ''}
    ${sheet.ideas?.length ? `<h3>Ideas that win</h3><ul>${sheet.ideas.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${sheet.terms?.length ? `<h3>Terms</h3><table>${sheet.terms.map(([k, w]) => `<tr><td>${k}</td><td>${w}</td></tr>`).join('')}</table>` : ''}
    <div class="ls-foot">${onStart ? '<button type="button" class="ls-go">Learn to play</button>' : ''}<button type="button" class="ls-close">Close</button></div></div>`;
  const close = () => { el.remove(); document.removeEventListener('keydown', key, true); prev && prev.focus && prev.focus(); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  el.addEventListener('click', e => { if (e.target === el) close(); });
  document.body.appendChild(el);
  el.querySelector('.ls-close').onclick = close;
  if (onStart) el.querySelector('.ls-go').onclick = () => { close(); onStart(); };
  document.addEventListener('keydown', key, true);
  // Focus the heading, not Close at the bottom, so a long sheet opens at its top on a phone.
  const h = el.querySelector('h2'); h.tabIndex = -1; h.focus({ preventScroll: true }); el.querySelector('.ls-card').scrollTop = 0;
}
