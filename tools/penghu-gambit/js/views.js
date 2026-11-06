// Result views: the turn log with its probability rows, the combat results table and the Monte Carlo card.
import { CRT, CRT_COLS, RESULTS, SECTORS } from '../data/params.js';

const pct = p => p == null ? '' : `${Math.round(p * 1000) / 10}%`;
const f2 = v => (Math.round(v * 100) / 100).toString();
const OUT = {
  pla: { t: 'PLA holds Magong', c: 'pla' },
  roc: { t: 'Defense holds', c: 'roc' },
  stale: { t: 'Stalemate', c: 'stale' },
};
export const outcomeText = k => OUT[k].t;

/** Rolls shown as values; a roll under the chance succeeds. */
function rollsHtml(r) {
  if (!r.rolls.length) return '<span class="muted">none</span>';
  return r.rolls.map(x => {
    const hit = r.p != null && x < r.p;
    return `<span class="roll${hit ? ' hit' : ''}" title="${hit ? 'under the chance: it happens' : 'over the chance: it does not'}">${x.toFixed(2)}</span>`;
  }).join(' ');
}

export function turnLogHtml(game, v, cfg) {
  if (v === 0) {
    return `<p class="fine">Setup. Press <b>Next turn</b> to play turn 1. Each row will show the chance of an event, the dice (random numbers from 0 to 1) and the result. A roll below the chance means the event happens.</p>`;
  }
  const T = game.turns[v - 1];
  const rows = T.rows.map(r => `<tr class="${r.tone || ''}"><td>${r.ph}</td><td>${r.ev}</td><td class="num">${pct(r.p)}</td><td class="num rolls">${rollsHtml(r)}</td><td>${r.res}</td></tr>`).join('');
  let end = '';
  if (v === game.turns.length) {
    const o = OUT[game.outcome];
    end = `<p class="endline ${o.c}"><b>${o.t}${game.wonAt ? ` on turn ${game.wonAt}` : ` after ${game.turns.length} turns`}.</b> ${endWhy(game, cfg)}</p>`;
  }
  return `<div class="tablewrap"><table class="log"><thead><tr><th>Phase</th><th>Event</th><th>Chance</th><th>Dice</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>${end}`;
}

function endWhy(game, cfg) {
  const s = game.turns[game.turns.length - 1].state;
  if (cfg.pla.plan === 'blockade') {
    return game.outcome === 'pla' ? 'Supplies ran out and the garrison capitulated.'
      : game.outcome === 'roc' ? `Stocks lasted: ${f2(s.stocks)} days remain.` : 'Stocks are gone but the garrison has not given up.';
  }
  return game.outcome === 'pla' ? `PLA forces reached Magong with ${f2(s.ashore)} points ashore.`
    : game.outcome === 'roc' ? (s.ashore < 0.5 ? 'The landing force was destroyed or never got ashore.' : 'The PLA is pinned on the beach and outnumbered more than two to one.')
      : `The PLA holds a lodgment (${f2(s.ashore)} points, objective ${s.progress} of ${SECTORS[cfg.pla.sector].steps}) but not Magong.`;
}

export function crtHtml(crt) {
  const head = CRT_COLS.map((c, i) => `<th class="${crt && crt.col === i ? 'on' : ''}">${c.t}</th>`).join('');
  const body = CRT.map((row, r) => `<tr><th>${r + 1}</th>${row.map((code, c) => {
    const on = crt && crt.col === c && crt.roll === r + 1;
    return `<td class="c-${code}${on ? ' hit' : ''}${crt && crt.col === c ? ' col' : ''}">${code}</td>`;
  }).join('')}</tr>`).join('');
  const key = Object.entries(RESULTS).map(([k, r]) => `<li><b class="c-${k}">${k}</b> ${r.t}: PLA −${r.pla * 100}%, ROC −${r.roc * 100}%${r.adv ? ', PLA advances one objective' : ''}</li>`).join('');
  return `<table class="crt"><thead><tr><th>Die</th>${head}</tr></thead><tbody>${body}</tbody></table>
    <ul class="crt-key">${key}</ul>`;
}

export function readoutHtml(st, cfg, v, game) {
  const assault = cfg.pla.plan === 'assault';
  const rows = [
    ['PLA ashore', assault ? `${f2(st.ashore)} pts` : 'none (blockade)'],
    ['Objective', assault ? `${st.progress} of ${SECTORS[cfg.pla.sector].steps}` : '–'],
    ['Landing groups afloat', assault ? `${st.fleet} of ${cfg.pla.lift}` : '–'],
    ['ROC garrison', `${f2(st.garrison)} pts`],
    ['Missile batteries', `${st.ashm} of ${cfg.roc.ashm}${assault ? ` · ${st.salvos} salvos left` : ''}`],
    ['Air defense units', `${st.shorad} of ${cfg.roc.shorad}`],
    ['Drone teams', `${st.drones} of ${cfg.roc.drones}`],
    ['Supplies', `${f2(st.stocks)} days`],
    ['Airfield', st.airfield === 'roc' ? 'ROC' : st.airfield === 'pla' ? 'PLA, usable' : 'PLA, wrecked'],
  ];
  return rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}

/** Monte Carlo card: outcome bar, cumulative capture curve and the lever table. */
export function mcHtml(mc, drv, cfg) {
  const n = mc.n, seg = k => (mc[k] / n * 100);
  const bar = ['pla', 'stale', 'roc'].map(k => `<span class="seg ${OUT[k].c}" style="width:${seg(k)}%" title="${OUT[k].t}: ${mc[k]} of ${n}"></span>`).join('');
  const leg = ['pla', 'stale', 'roc'].map(k => `<li><span class="sw ${OUT[k].c}"></span>${OUT[k].t} <b class="num">${Math.round(seg(k))}%</b> <span class="muted num">(${mc[k]})</span></li>`).join('');
  // Cumulative share of runs in which the PLA holds Magong by each turn
  let cum = 0;
  const cols = mc.wonAt.slice(1).map((c, i) => { cum += c; return { t: i + 1, v: cum / n }; });
  const maxv = Math.max(0.05, ...cols.map(c => c.v));
  const unit = cfg.pla.plan === 'blockade' ? 'day' : 'hour';
  const step = cfg.pla.plan === 'blockade' ? 5 : 12;
  const bars = cols.map(c => `<div class="cb"><span class="cb-v num">${Math.round(c.v * 100)}%</span><span class="cb-b" style="height:${c.v / maxv * 100}%"></span><span class="cb-t num">T${c.t}</span></div>`).join('');
  const dr = drv.slice(0, 8).map(d => {
    const w = Math.min(50, Math.abs(d.d) * 100 * 1.5);
    const sign = d.d > 0 ? '+' : d.d < 0 ? '−' : '±';
    return `<tr><td>${d.t}</td><td class="dbar"><span class="${d.d > 0 ? 'up' : 'down'}" style="width:${w}%;${d.d > 0 ? 'left:50%' : `left:${50 - w}%`}"></span></td><td class="num">${sign}${Math.abs(Math.round(d.d * 1000) / 10)} pp</td></tr>`;
  }).join('');
  const avg = cfg.pla.plan === 'assault'
    ? `On average per game: ${f2(mc.sunk)} landing groups sunk by missiles, ${f2(mc.mined)} stopped by mines, ${f2(mc.downed)} air lifts downed, ${f2(mc.droneHits)} drone hits, ${f2(mc.strikeKills)} ROC assets destroyed by strikes.`
    : `On average per game: ${f2(mc.strikeKills)} ROC assets destroyed by strikes.`;
  return `
    <div class="mc-bar" role="img" aria-label="Outcome shares">${bar}</div>
    <ul class="mc-leg">${leg}</ul>
    <p class="fine">${avg}</p>
    <div class="mc-cols">
      <div><p class="lbl"><b>PLA holds Magong by turn N</b> <small>cumulative, 1 turn = ${step} ${unit}s</small></p><div class="cum">${bars}</div></div>
      <div><p class="lbl"><b>Key drivers</b> <small>change in the PLA's chance of taking Magong, in percentage points (pp)</small></p>
        <table class="drv"><tbody>${dr || '<tr><td>No levers to test.</td></tr>'}</tbody></table></div>
    </div>`;
}
