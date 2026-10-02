// Styles for the shared site bar (chrome.js mountNav). Injected as a <style> so pages that do not
// load shared/css/tsm.css (strait-layers) get the same bar. Uses TSM tokens with light fallbacks.
export const NAV_CSS = `
.tsm-bar { max-width: 1400px; margin: 0 auto; border-bottom: 1px solid var(--rule, #d3d6cd); font: 13px/1.3 var(--body, "IBM Plex Sans", Arial, sans-serif); position: relative; z-index: 40; }
.tsm-bar-in { display: flex; align-items: center; gap: 6px 14px; min-height: 44px; padding-block: 6px; flex-wrap: wrap; }
.tsm-bar a { text-decoration: none; }
.tsm-bar-home { display: inline-flex; align-items: center; gap: 7px; color: var(--brand-ink, #033303); font-family: var(--display, Georgia, serif); font-weight: 700; font-size: 14.5px; letter-spacing: .02em; border-radius: 3px; }
.tsm-bar-home img { width: 24px; height: 24px; }
.tsm-bar-btn { display: inline-flex; align-items: center; gap: 7px; background: transparent; border: 1px solid var(--rule, #d3d6cd); border-radius: 3px; padding: 5px 10px; cursor: pointer; font: 600 13px var(--body, sans-serif); color: var(--ink, #14201a); }
.tsm-bar-btn:hover { border-color: var(--muted, #56625b); }
.tsm-caret { width: 7px; height: 7px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-2px) rotate(45deg); }
.tsm-bar-btn[aria-expanded="true"] .tsm-caret { transform: translateY(1px) rotate(-135deg); }
.tsm-bar-menu { position: relative; }
.tsm-menu { position: absolute; top: calc(100% + 6px); left: 0; width: min(760px, calc(100vw - 32px)); max-height: min(70vh, 560px); overflow: auto; background: var(--panel, #fbfbf8); border: 1px solid var(--rule, #d3d6cd); border-radius: 4px; box-shadow: 0 10px 30px rgba(0, 0, 0, .18); padding: 12px 14px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px 18px; }
.tsm-menu[hidden] { display: none; }
.tsm-menu-g p { margin: 0 0 4px; font-family: var(--display, Georgia, serif); font-weight: 600; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted, #56625b); }
.tsm-menu-g ul { list-style: none; margin: 0; padding: 0; }
.tsm-menu-g a { display: block; padding: 4px 6px; margin-inline: -6px; border-radius: 3px; color: var(--ink, #14201a); }
.tsm-menu-g a:hover { background: var(--chip, #e7e9e1); }
.tsm-menu-g a[aria-current] { font-weight: 600; box-shadow: inset 3px 0 0 var(--accent, #e8753a); }
.tsm-menu-all { grid-column: 1 / -1; color: var(--blue, #1b4fd4) !important; padding-top: 6px; border-top: 1px solid var(--rule, #d3d6cd); }
.tsm-bar-search { position: relative; flex: 0 1 220px; min-width: 150px; }
.tsm-bar-search input { width: 100%; font: 13px var(--body, sans-serif); color: var(--ink, #14201a); background: var(--panel, #fbfbf8); border: 1px solid var(--rule, #d3d6cd); border-radius: 3px; padding: 5px 9px; }
.tsm-bar-search input::placeholder { color: var(--muted, #56625b); }
.tsm-q-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; min-width: 240px; list-style: none; margin: 0; padding: 4px; background: var(--panel, #fbfbf8); border: 1px solid var(--rule, #d3d6cd); border-radius: 4px; box-shadow: 0 10px 30px rgba(0, 0, 0, .18); }
.tsm-q-list[hidden] { display: none; }
.tsm-q-list a { display: flex; flex-direction: column; padding: 5px 8px; border-radius: 3px; color: var(--ink, #14201a); }
.tsm-q-list a span { font-size: 11.5px; color: var(--muted, #56625b); }
.tsm-q-list [aria-selected="true"] a, .tsm-q-list a:hover { background: var(--chip, #e7e9e1); }
.tsm-q-none { padding: 6px 8px; color: var(--muted, #56625b); }
.tsm-bar-step { margin-left: auto; display: flex; align-items: center; gap: 4px 10px; font-size: 12.5px; }
.tsm-bar-step a { color: var(--ink, #14201a); border: 1px solid var(--rule, #d3d6cd); border-radius: 3px; padding: 4px 9px; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tsm-bar-step a:hover { border-color: var(--muted, #56625b); }
.tsm-step-n { color: var(--muted, #56625b); font-family: var(--mono, monospace); font-size: 11.5px; white-space: nowrap; }
.tsm-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.tsm-bar :focus-visible { outline: 2px solid var(--accent, #e8753a); outline-offset: 2px; }
@media (max-width: 760px) {
  .tsm-bar-home span { display: none; }
  .tsm-bar-search { flex: 1 1 140px; }
  .tsm-bar-step { margin-left: 0; width: 100%; }
  .tsm-step-t { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .tsm-bar-step a { padding: 3px 12px; font-size: 15px; line-height: 1.2; }
}
@media print { .tsm-bar { display: none; } }
`;
