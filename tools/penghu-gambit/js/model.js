// Penghu Gambit game engine: one seeded game, turn by turn, with every die roll logged.
import { SECTORS, CRT, CRT_COLS, RESULTS, TURN_HOURS, BLOCKADE_DAYS } from '../data/params.js';

/** Mulberry32: a small seeded generator so every game and every Monte Carlo batch can be replayed. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = v => Math.round(v * 100) / 100;

/** Roll n independent chances p. Returns { hits, rolls }. */
function rollMany(R, n, p) {
  const rolls = [];
  let hits = 0;
  for (let i = 0; i < n; i++) { const x = R(); rolls.push(x); if (x < p) hits++; }
  return { hits, rolls };
}

/** Effective ROC strength before the terrain multiplier. */
function rocStrength(S, P) {
  return S.garrison * (S.stocks > 0 ? 1 : P.noStock);
}

export function crtColumn(ratio) {
  return CRT_COLS.findIndex(c => ratio < c.max);
}

/**
 * Play one game.
 * cfg: { roc: {ashm, shorad, marines, reserves, stocks, drones, mines:{N,E,W}, demo, harden},
 *        pla: {plan, strikes, sector, lift, vertical, offload}, turns }
 * P: probability table (PROB_DEF with user edits). log=false skips the text log for Monte Carlo speed.
 */
export function playGame(cfg, P, seed, log = true) {
  const R = rng(seed);
  const { roc, pla } = cfg;
  const sec = SECTORS[pla.sector];
  const S = {
    ashm: Array.from({ length: roc.ashm }, () => P.salvos),
    shorad: roc.shorad, drones: roc.drones,
    garrison: P.garrison + roc.marines + roc.reserves * P.reserveEff,
    stocks: P.baseStock + roc.stocks * 7,
    ashore: 0, fleet: pla.lift, progress: 0, airfield: 'roc', mineEff: 1,
    sunk: 0, mined: 0, downed: 0, droneHits: 0, strikeKills: 0,
  };
  const start = { garrison: S.garrison, ashm: roc.ashm, shorad: roc.shorad, drones: roc.drones };
  const turns = [];
  let outcome = null, wonAt = null;
  const hk = roc.harden ? P.hardenFactor : 1;

  const strikes = (T, intensity, label) => {
    const rows = [];
    const alive = S.ashm.map((s, i) => i).filter(i => S.ashm[i] !== null);
    const pa = Math.min(1, P.pStrikeAshm * intensity * hk), ps = Math.min(1, P.pStrikeShorad * intensity * hk), pd = Math.min(1, P.pStrikeDrone * intensity * hk);
    const a = rollMany(R, alive.length, pa);
    a.rolls.forEach((x, j) => { if (x < pa) S.ashm[alive[j]] = null; });
    const s = rollMany(R, S.shorad, ps); S.shorad -= s.hits;
    const d = rollMany(R, S.drones, pd); S.drones -= d.hits;
    S.strikeKills += a.hits + s.hits + d.hits;
    if (log) {
      if (alive.length) rows.push({ ph: label, ev: `${alive.length} missile batter${alive.length > 1 ? 'ies' : 'y'} targeted`, p: pa, rolls: a.rolls, res: a.hits ? `${a.hits} destroyed` : 'all survive', tone: a.hits ? 'pla' : 'roc' });
      if (s.rolls.length) rows.push({ ph: label, ev: `${s.rolls.length} air defense unit${s.rolls.length > 1 ? 's' : ''} targeted`, p: ps, rolls: s.rolls, res: s.hits ? `${s.hits} destroyed` : 'all survive', tone: s.hits ? 'pla' : 'roc' });
      if (d.rolls.length) rows.push({ ph: label, ev: `${d.rolls.length} drone team${d.rolls.length > 1 ? 's' : ''} targeted`, p: pd, rolls: d.rolls, res: d.hits ? `${d.hits} destroyed` : 'all survive', tone: d.hits ? 'pla' : 'roc' });
      T.rows.push(...rows);
    }
  };

  for (let t = 1; t <= cfg.turns && !outcome; t++) {
    const T = { t, rows: [], crt: null };
    if (pla.plan === 'blockade') {
      T.label = `Days ${(t - 1) * BLOCKADE_DAYS}–${t * BLOCKADE_DAYS}`;
      T.phase = 'Blockade';
      strikes(T, P.assaultStrike, 'Strikes');
      const ashmAlive = S.ashm.filter(s => s !== null).length;
      const leak = Math.min(0.9, P.leak + P.ashmLeak * ashmAlive);
      const use = BLOCKADE_DAYS * (1 - leak);
      const before = S.stocks;
      S.stocks = Math.max(0, S.stocks - use);
      if (log) T.rows.push({ ph: 'Supply', ev: `${BLOCKADE_DAYS} days pass; ${Math.round(leak * 100)}% of needs slip through`, p: null, rolls: [], res: `stocks ${r2(before)} → ${r2(S.stocks)} days`, tone: S.stocks <= 0 ? 'pla' : '' });
      if (S.stocks <= 0) {
        const x = R();
        const cap = x < P.pCap;
        if (log) T.rows.push({ ph: 'Siege', ev: 'Garrison out of supply: does it capitulate?', p: P.pCap, rolls: [x], res: cap ? 'capitulates' : 'holds on', tone: cap ? 'pla' : 'roc' });
        if (cap) { outcome = 'pla'; wonAt = t; S.progress = sec.steps; }
      }
    } else {
      T.label = `Hours ${(t - 1) * TURN_HOURS}–${t * TURN_HOURS}`;
      const assault = t - pla.strikes; // 1 = landing turn
      T.phase = assault < 1 ? 'Preparatory strikes' : assault === 1 ? 'Landing' : 'Fight ashore';
      strikes(T, assault < 1 ? 1 : P.assaultStrike, assault < 1 ? 'Prep strikes' : 'Strikes');
      if (assault < 1) {
        const before = S.mineEff;
        S.mineEff *= 1 - P.mcm;
        if (log && roc.mines[pla.sector]) T.rows.push({ ph: 'Mine clearing', ev: `PLA sweeps the ${sec.t.toLowerCase()} approaches`, p: null, rolls: [], res: `mine threat ${Math.round(before * 100)}% → ${Math.round(S.mineEff * 100)}%` });
      } else {
        landing(T, assault);
        combat(T);
      }
      S.stocks = Math.max(0, S.stocks - P.burn);
      if (S.progress >= sec.steps && !outcome) { outcome = 'pla'; wonAt = t; }
    }
    T.state = snapshot();
    turns.push(T);
  }

  function landing(T, assault) {
    // Sea wave
    const sent = Math.min(pla.lift, S.fleet);
    let afloat = sent;
    if (sent > 0) {
      const batteries = S.ashm.map((s, i) => i).filter(i => S.ashm[i] > 0);
      const p = Math.min(1, P.pAshmHit * sec.expo);
      const rolls = [];
      let hits = 0;
      for (const i of batteries) {
        if (afloat - hits <= 0) break;
        S.ashm[i]--; const x = R(); rolls.push(x); if (x < p) hits++;
      }
      afloat -= hits; S.fleet -= hits; S.sunk += hits;
      if (log) T.rows.push({ ph: 'Sea crossing', ev: `${sent} landing group${sent > 1 ? 's' : ''} sail; ${rolls.length} missile salvo${rolls.length === 1 ? '' : 's'}`, p: rolls.length ? p : null, rolls, res: rolls.length ? `${hits} group${hits === 1 ? '' : 's'} sunk` : 'no batteries able to fire', tone: hits ? 'roc' : 'pla' });
      if (roc.mines[pla.sector] && afloat > 0) {
        const pm = P.pMine * S.mineEff;
        const m = rollMany(R, afloat, pm);
        afloat -= m.hits; S.fleet -= m.hits; S.mined += m.hits;
        if (log) T.rows.push({ ph: 'Mines', ev: `${m.rolls.length} group${m.rolls.length > 1 ? 's' : ''} cross the mined sector`, p: pm, rolls: m.rolls, res: `${m.hits} stopped`, tone: m.hits ? 'roc' : '' });
      }
      const pts = afloat * P.groupPts * (pla.offload ? 1 - P.offloadCut : 1);
      S.ashore += pts;
      if (log) T.rows.push({ ph: 'Ashore', ev: `${afloat} group${afloat === 1 ? '' : 's'} land${pla.offload ? ' (reduced offload)' : ''}`, p: null, rolls: [], res: `+${r2(pts)} pts`, tone: pts > 0 ? 'pla' : 'roc' });
    } else if (log && assault > 1) {
      T.rows.push({ ph: 'Sea crossing', ev: 'No amphibious lift left', p: null, rolls: [], res: 'no wave' });
    }
    // Vertical envelopment
    const pv = 1 - Math.pow(1 - P.pShorad, S.shorad);
    const vert = (n, each, eff, what) => {
      const v = rollMany(R, n, pv);
      const pts = (n - v.hits) * each * eff;
      S.ashore += pts; S.downed += v.hits;
      if (log) T.rows.push({ ph: 'Air lift', ev: `${n} ${what} lift groups vs ${S.shorad} air defense unit${S.shorad === 1 ? '' : 's'}`, p: pv, rolls: v.rolls, res: `${v.hits} downed, +${r2(pts)} pts`, tone: v.hits ? 'roc' : 'pla' });
    };
    if ((pla.vertical === 'heli' || pla.vertical === 'both') && assault <= 2) vert(2, 0.25, 1, 'helicopter');
    if ((pla.vertical === 'air' || pla.vertical === 'both') && assault === 1) vert(4, 0.5, P.airborneEff, 'airborne');
    // Airfield reinforcement
    if (S.airfield === 'pla') {
      S.ashore += P.airBonus;
      if (log) T.rows.push({ ph: 'Air landing', ev: 'Transports use the captured airfield', p: null, rolls: [], res: `+${P.airBonus} pts`, tone: 'pla' });
    }
    // Drones against troops ashore
    if (S.drones > 0 && S.ashore > 0) {
      const d = rollMany(R, S.drones, P.pDrone);
      const dmg = Math.min(S.ashore, d.hits * P.droneDmg);
      S.ashore -= dmg; S.droneHits += d.hits;
      if (log) T.rows.push({ ph: 'Drones', ev: `${S.drones} drone team${S.drones > 1 ? 's' : ''} strike the lodgment`, p: P.pDrone, rolls: d.rolls, res: `−${r2(dmg)} pts`, tone: d.hits ? 'roc' : '' });
    }
  }

  function combat(T) {
    if (S.ashore < 0.05) {
      if (log) T.rows.push({ ph: 'Ground', ev: 'No PLA force ashore', p: null, rolls: [], res: 'no fighting' });
      return;
    }
    const def = rocStrength(S, P) * P.defMult;
    const ratio = def > 0 ? S.ashore / def : Infinity;
    const col = crtColumn(ratio);
    const roll = 1 + Math.floor(R() * 6);
    const code = CRT[roll - 1][col], res = RESULTS[code];
    const pl = S.ashore * res.pla, rl = S.garrison * res.roc;
    S.ashore -= pl; S.garrison -= rl;
    let adv = res.adv;
    if (S.garrison < 0.5) adv = sec.steps; // collapse
    const from = S.progress;
    S.progress = Math.min(sec.steps, S.progress + adv);
    T.crt = { ratio, col, roll, code };
    if (log) T.rows.push({ ph: 'Ground', ev: `PLA ${r2(S.ashore + pl)} vs ROC ${r2(def)} (strength ${r2(def / P.defMult)} × ${P.defMult} terrain)`, p: null, rolls: [], res: `die ${roll}, ${CRT_COLS[col].t}: ${res.t}. PLA −${r2(pl)}, ROC −${r2(rl)}`, tone: adv > 0 ? 'pla' : code === 'EX' ? '' : 'roc' });
    if (sec.airStep && from < sec.airStep && S.progress >= sec.airStep && S.progress < sec.steps) {
      if (roc.demo) {
        const x = R();
        const ok = x < P.pDemo;
        S.airfield = ok ? 'wrecked' : 'pla';
        if (log) T.rows.push({ ph: 'Airfield', ev: 'Airfield falls; demolition charges fired', p: P.pDemo, rolls: [x], res: ok ? 'runway wrecked' : 'demolition fails', tone: ok ? 'roc' : 'pla' });
      } else {
        S.airfield = 'pla';
        if (log) T.rows.push({ ph: 'Airfield', ev: 'Airfield falls intact', p: null, rolls: [], res: 'PLA can fly in troops', tone: 'pla' });
      }
    }
  }

  function snapshot() {
    return {
      ashm: S.ashm.filter(s => s !== null).length, salvos: S.ashm.reduce((a, s) => a + (s || 0), 0),
      shorad: S.shorad, drones: S.drones, garrison: r2(S.garrison), stocks: r2(S.stocks),
      ashore: r2(S.ashore), fleet: S.fleet, progress: S.progress, airfield: S.airfield, mineEff: S.mineEff,
    };
  }

  if (!outcome) {
    if (pla.plan === 'blockade') outcome = S.stocks > 0 ? 'roc' : 'stale';
    else {
      const ratio = S.ashore / Math.max(0.01, rocStrength(S, P) * P.defMult);
      outcome = S.ashore < 0.5 || (S.progress === 0 && ratio < 0.5) ? 'roc' : 'stale';
    }
  }
  return {
    turns, outcome, wonAt, start, steps: sec.steps,
    stats: { sunk: S.sunk, mined: S.mined, downed: S.downed, droneHits: S.droneHits, strikeKills: S.strikeKills, landed: S.ashore },
  };
}
