// After-action review: the player's game beside other plans on the same seed (same week of weather, same dice),
// then 1,000 weeks of the player's plan against the doctrinal plan.
import { ZONES, ZONE_KEYS } from '../data/params.js';
import { play } from './montecarlo.js';
import { plaDoctrine, plaRecorded, rocDoctrine, rocPassive, rocRecorded, PLA_SETUPS, ROC_SETUP } from './policy.js';
import { MONTHS } from './weather.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const OUT = {
  pla: { t: 'PLA lodgment secure', s: 'bad', short: 'Secure' },
  contested: { t: 'Contested', s: 'warn', short: 'Contested' },
  roc: { t: 'Landing defeated', s: 'good', short: 'Defeated' },
};
const r0 = v => Math.round(v);

/** Setup and policies that define "your plan" for replays. */
export function yourPlan(S, rec) {
  if (S.role === 'pla') return { setup: { ...S.setup }, pla: plaRecorded(rec), roc: G => rocDoctrine(G) };
  return { setup: aiSetup(S), pla: plaDoctrine, roc: rocRecorded(rec) };
}

/** The PLA's plan when the player defends: doctrine, with the zone drawn from the seed and hidden. */
export function aiSetup(S) {
  const u = (S.seed * 9301 + 49297) % 233280 / 233280;
  const main = u < 0.45 ? 'central' : u < 0.75 ? 'south' : 'north';
  const second = u > 0.85 ? (main === 'north' ? 'central' : 'north') : null;
  return { ...PLA_SETUPS.doctrine, month: S.setup.month, zones: [main, second], us: S.setup.us, roc: S.setup.roc };
}

function alternatives(S, rec) {
  const P = S.P, seed = S.seed;
  if (S.role === 'pla') {
    const mine = S.setup, R = plaRecorded(rec), roc = G => rocDoctrine(G);
    const list = [
      ['Doctrine: wait for calm, central coast, hunt launchers, ferries only in calm seas or to a port', { ...PLA_SETUPS.doctrine, month: mine.month, roc: ROC_SETUP }, plaDoctrine],
    ];
    if (mine.wait !== 'calm') list.push(['Your orders, but wait for the first calm day', { ...mine, wait: 'calm' }, R]);
    if (mine.wait !== 0) list.push(['Your orders, but go at once', { ...mine, wait: 0 }, R]);
    list.push(['Your orders, ferries only to a port you hold', mine, G => { const o = R(G); for (const z in o.send) if (G.port[z] === 'roc') o.send[z].ferry = 0; return o; }]);
    for (const z of ZONE_KEYS) if (z !== mine.zones[0]) list.push([`Your orders, main landing on the ${ZONES[z].area}`, { ...mine, zones: [z, mine.zones[1] === z ? null : mine.zones[1]] }, R]);
    list.push([mine.us ? 'Your orders, Taiwan fights alone' : 'Your orders, with U.S. and allied strikes', { ...mine, us: !mine.us }, R]);
    return list.map(([n, s, f]) => [n, play(s, seed, P, f, roc)]);
  }
  const setup = aiSetup(S), mineR = rocRecorded(rec);
  return [
    ['Doctrine: rush reserves to the landing, counterattack when even', setup, G => rocDoctrine(G)],
    ['Counterattack at once, even outnumbered', setup, G => rocDoctrine(G, { caRatio: 0.6 })],
    ['Hold positions, never counterattack', setup, rocPassive],
    ['Your orders, but hold missiles until ships bunch up offshore', setup, G => { const o = mineR(G); const afloat = ZONE_KEYS.reduce((a, z) => a + G.queue[z].amph + G.queue[z].ferry, 0); return { ...o, fire: afloat + G.ready.amph + G.ready.ferry > 0 && G.t >= 1 && afloat >= 12 ? 1 : 0 }; }],
    ['Default posture and doctrine (no extra mines or demolition)', { ...setup, roc: ROC_SETUP }, G => rocDoctrine(G)],
  ].map(([n, s, f]) => [n, play(s, seed, P, plaDoctrine, f)]);
}

const row = (name, G, you = false) => {
  const R = G.result, o = OUT[R.outcome];
  const b = R.best;
  return `<tr${you ? ' class="you"' : ''}><th scope="row">${esc(name)}</th><td><span class="sl-out" data-s="${o.s}">${o.short}</span></td>`
    + `<td class="num">${r0(R.total)}</td><td class="num">${b ? (b.ratio >= 10 ? '10:1+' : `${b.ratio}:1`) : '–'}</td><td class="num">${R.stats.lostAmph + R.stats.lostFerry}</td><td class="num">${r0(R.stats.lostTroops)}</td><td>${b && b.port !== 'roc' ? (b.port === 'pla' ? 'intact' : 'wrecked') : 'none'}</td></tr>`;
};

export function renderAAR(S, G, rec) {
  const R = G.result, o = OUT[R.outcome];
  const alts = alternatives(S, rec);
  const pla = S.role === 'pla';
  const better = alts.filter(([, A]) => rank(A.result, pla) > rank(R, pla));
  document.getElementById('aar-status').dataset.s = pla ? o.s : ({ bad: 'bad', warn: 'warn', good: 'good' })[o.s];
  document.getElementById('aar-title').textContent = o.t;
  document.getElementById('aar-sub').textContent = summary(G, pla);
  document.getElementById('aar-table').innerHTML = `<thead><tr><th scope="col">Plan (same week, same dice)</th><th scope="col">Result</th><th scope="col">PLA ashore</th><th scope="col">Best ratio</th><th scope="col">Ship groups lost</th><th scope="col">Troops lost at sea</th><th scope="col">Port</th></tr></thead><tbody>`
    + row(pla ? 'Your plan' : 'Your defense', G, true) + alts.map(([n, A]) => row(n, A)).join('') + '</tbody>';
  document.getElementById('aar-lede').textContent = better.length
    ? `On this same week, ${better.length} of ${alts.length} other plans did better for ${pla ? 'the PLA' : 'Taiwan'}: ${better.slice(0, 2).map(([n]) => n.charAt(0).toLowerCase() + n.slice(1)).join('; ')}.`
    : `No other plan tried here did better for ${pla ? 'the PLA' : 'Taiwan'} on this week. One week is one draw of weather and dice; the 1,000-week run below shows whether the plan holds up.`;
}

/** Rank outcomes from the chosen side's view, then PLA strength ashore as a tie-break. */
function rank(R, pla) {
  const v = { pla: 2, contested: 1, roc: 0 }[R.outcome];
  return pla ? v * 1000 + R.total : (2 - v) * 1000 - R.total;
}

function summary(G, pla) {
  const R = G.result, s = R.stats, b = R.best;
  const parts = [];
  parts.push(`After D+3 the PLA has ${r0(R.total)} points ashore${b ? `, best at the ${ZONES[b.z].area}${b.D < 0.5 ? ', where Taiwan has almost nothing left' : ` at ${b.ratio}:1 against ${b.D} points of Taiwan's forces`}` : ''}.`);
  parts.push(`${s.lostAmph + s.lostFerry} ship groups were lost (${s.lostAmph} amphibious, ${s.lostFerry} ferry), with about ${r0(s.lostTroops)},000 troops, ${s.mined} of them to mines.`);
  parts.push(`Taiwan fired ${s.missiles} anti-ship missiles; strikes destroyed ${s.killedLaunchers} batteries.`);
  return parts.join(' ');
}

/** 1,000 weeks of your plan and of the doctrinal plan, run in chunks so the page stays responsive. */
export function runBatch(S, rec, onDone, n = 1000) {
  const P = S.P;
  const pla = S.role === 'pla';
  // As the PLA, your plan is your setup plus your recorded turn-by-turn shares. As Taiwan, the landing zone moves
  // from week to week, so your recorded moves would not fit: the batch tests your posture with doctrinal orders.
  const you = pla ? yourPlan(S, rec) : { pla: plaDoctrine, roc: G => rocDoctrine(G) };
  const other = pla
    ? { name: 'Doctrinal plan', setup: { ...PLA_SETUPS.doctrine, month: S.setup.month, roc: ROC_SETUP }, pla: plaDoctrine, roc: G => rocDoctrine(G) }
    : { name: 'Default posture, doctrinal orders', pla: plaDoctrine, roc: G => rocDoctrine(G) };
  const acc = { you: tally(), other: tally() };
  let i = 1;
  const chunk = () => {
    const end = Math.min(n, i + 99);
    for (; i <= end; i++) {
      const s1 = pla ? you.setup : aiSetup({ ...S, seed: i });
      add(acc.you, play(s1, i, P, you.pla, you.roc));
      const s2 = pla ? other.setup : { ...aiSetup({ ...S, seed: i }), roc: ROC_SETUP };
      add(acc.other, play(s2, i, P, other.pla, other.roc));
    }
    if (i <= n) setTimeout(chunk, 0); else onDone(render(acc, n, other.name, S));
  };
  setTimeout(chunk, 0);
}
const tally = () => ({ pla: 0, contested: 0, roc: 0, ashore: [], lost: [] });
function add(T, G) { T[G.result.outcome]++; T.ashore.push(G.result.total); T.lost.push(G.result.stats.lostAmph + G.result.stats.lostFerry); }
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

function render(acc, n, otherName, S) {
  const bar = (T, name) => {
    const seg = k => `<i data-s="${OUT[k].s}" style="width:${(T[k] / n * 100).toFixed(1)}%" title="${OUT[k].t}: ${(T[k] / n * 100).toFixed(0)}%"></i>`;
    return `<div class="sl-mcrow"><p><b>${esc(name)}</b> <span class="muted">median ${r0(med(T.ashore))} points ashore · ${r0(med(T.lost))} ship groups lost</span></p>
      <div class="sl-mcbar" role="img" aria-label="${esc(name)}: PLA secure ${(T.pla / n * 100).toFixed(0)}%, contested ${(T.contested / n * 100).toFixed(0)}%, defeated ${(T.roc / n * 100).toFixed(0)}%">${seg('pla')}${seg('contested')}${seg('roc')}</div>
      <p class="sl-mcnums num">${(T.pla / n * 100).toFixed(0)}% secure · ${(T.contested / n * 100).toFixed(0)}% contested · ${(T.roc / n * 100).toFixed(0)}% defeated</p></div>`;
  };
  return `<p class="fine">${n.toLocaleString('en-US')} weeks of ${MONTHS[S.setup.month]} weather drawn from 1996–2025, each with its own dice. ${S.role === 'pla' ? 'Your plan replays your setup and, turn by turn, the share of ready ships you sent, your split and your strike and port orders.' : 'The PLA plays its doctrinal plan, and its landing zone changes from week to week, so this run tests your posture (mines, forward share, demolition) with doctrinal orders against the default posture.'}</p>`
    + bar(acc.you, S.role === 'pla' ? 'Your plan' : 'Your posture, doctrinal orders') + bar(acc.other, otherName);
}
