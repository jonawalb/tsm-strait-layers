// Strait Landing engine: one seeded game, 12-hour turn by 12-hour turn.
// Mechanics: Hughes salvo model for ship losses in transit, a queue at each beach and port (unloading
// capacity by sea state), random-search strikes on hidden launchers, and Lanchester square-law ground combat.
import { ZONES, ZONE_KEYS, REACH, LIFT, UNLOAD, STRIKES, ROC, TURNS, WIN } from '../data/params.js';
import { uni, normal, poisson } from './rng.js';
import { drawStart, wave, band, firstCalm } from './weather.js';

const r1 = v => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * setup: { month, wait (0-3 or 'calm'), zones: [main, second|null], us, prep ('hunt'|'sweep'|'cut'|'even'),
 *          roc: { mines: {zone: 0-1}, demo: 0-1, forward: 0-1 } }
 */
export function createGame(setup, seed, P) {
  const start = drawStart(seed, setup.month);
  const main = setup.zones[0];
  const waitDays = setup.wait === 'calm' ? firstCalm(start, ZONES[main].pt) : setup.wait;
  const roc = setup.roc || {};
  const fwd = roc.forward ?? 0.5;
  const G = {
    seed, P, setup, start, waitDays, dday: start + waitDays, t: 0, over: false,
    ready: { amph: LIFT.amph.n, ferry: LIFT.ferry.n },
    queue: Object.fromEntries(ZONE_KEYS.map(z => [z, { amph: 0, ferry: 0, dmgA: 0, dmgF: 0 }])),
    back: [],
    ashore: Object.fromEntries(ZONE_KEYS.map(z => [z, 0])),
    fresh: Object.fromEntries(ZONE_KEYS.map(z => [z, 0])),
    // Coastal defenders scale with the forward share: 0.5 is the default posture.
    def: Object.fromEntries(ZONE_KEYS.map(z => [z, ZONES[z].def * (0.6 + 0.8 * fwd)])),
    reserves: ROC.reserves.map((r, i) => ({ id: i, s: r.s * (1.4 - 0.8 * fwd), at: r.at, dest: r.at, eta: 0 })),
    mob: 0,
    launchers: Array.from({ length: ROC.launchers }, () => ({ alive: true, ammo: ROC.magazine, exposed: false })),
    mines: { ...(roc.mines || ROC.mines) },
    demo: roc.demo ?? ROC.demo,
    port: Object.fromEntries(ZONE_KEYS.map(z => [z, 'roc'])),
    breakout: Object.fromEntries(ZONE_KEYS.map(z => [z, false])),
    short: Object.fromEntries(ZONE_KEYS.map(z => [z, 1])),
    stats: { lostAmph: 0, lostFerry: 0, lostTroops: 0, missiles: 0, hits: 0, killedLaunchers: 0, mined: 0, landed: 0, plaKIA: 0, rocKIA: 0 },
    hist: [], log: [],
  };
  // Waiting days: two strike turns each, while Taiwan mobilizes and lays more mines.
  const prep = [];
  for (let d = 0; d < waitDays; d++) {
    for (let h = 0; h < 2; h++) prep.push(...strike(G, STRIKES[setup.prep || 'even'].s, `prep${d}-${h}`, setup.zones));
    G.mob += 2 * P.reserveEff * ROC.mobRate * 1.5;
    for (const z of ZONE_KEYS) G.mines[z] = Math.min(1, G.mines[z] + 0.1);
  }
  if (waitDays) {
    const each = G.mob / 3;
    for (const z of ZONE_KEYS) G.def[z] += each;
    prep.push({ ph: 'Waiting', ev: `${waitDays} day${waitDays > 1 ? 's' : ''} of preparatory strikes`, res: `Taiwan mobilizes ${r1(G.mob)} points of reserves and lays more mines`, tone: 'roc' });
    G.mob = 0;
  }
  G.prepLog = prep;
  G.hist.push(snapshot(G));
  return G;
}

/** Sea state for turn t (1-based) at zone z: metres and band. */
export function seaAt(G, t, z) {
  const day = G.dday + Math.floor((t - 1) / 2);
  const m = wave(ZONES[z].pt, day);
  return { m, b: band(m), day };
}

/** Random-search strikes: hunt launchers, sweep mines in the chosen zones, set road interdiction. */
function strike(G, share, key, zones) {
  const { P, seed } = G;
  const [h, s, c] = share;
  const rows = [];
  let killed = 0, looked = 0;
  G.launchers.forEach((L, i) => {
    if (!L.alive) return;
    looked++;
    const p = 1 - Math.exp(-(L.exposed ? P.huntExposed : P.huntHidden) * h);
    if (uni(seed, `hunt-${key}`, i) < p) { L.alive = false; killed++; }
  });
  G.stats.killedLaunchers += killed;
  if (looked) rows.push({ ph: 'Strikes', ev: `Hunt ${looked} hidden or exposed missile batteries`, res: killed ? `${killed} destroyed` : 'none found', tone: killed ? 'pla' : 'roc' });
  const zs = zones.filter(Boolean);
  for (const z of zs) {
    const before = G.mines[z];
    G.mines[z] *= Math.exp(-P.sweep * s / zs.length);
    if (before > 0.02) rows.push({ ph: 'Mine clearing', ev: `Sweep the ${ZONES[z].area} approaches`, res: `mine threat ${Math.round(before * 100)}% → ${Math.round(G.mines[z] * 100)}%`, tone: 'pla' });
  }
  G.cut = clamp(P.cut * c, 0, 0.95);
  return rows;
}

/**
 * Play one 12-hour turn.
 * pla: { send: {zone: {amph, ferry}}, strike: preset key, port: {zone: bool} }
 * roc: { fire: 0-1 share of ready batteries that fire, moves: {reserveId: zone}, ca: {zone: bool} }
 */
export function step(G, pla, roc) {
  const { P, seed } = G;
  const t = ++G.t;
  const rows = [];
  const sea = Object.fromEntries(ZONE_KEYS.map(z => [z, seaAt(G, t, z)]));
  G.launchers.forEach(L => { L.firedNow = false; });

  // 1. Strikes
  rows.push(...strike(G, STRIKES[pla.strike].s, `t${t}`, G.setup.zones));
  G.launchers.forEach(L => { L.exposed = false; });

  // 2. Ships sail (rough seas keep them in port)
  const sailed = {};
  for (const z of ZONE_KEYS) {
    const o = pla.send?.[z];
    if (!o) continue;
    const a = Math.min(o.amph | 0, G.ready.amph), f = Math.min(o.ferry | 0, G.ready.ferry);
    if (!a && !f) continue;
    if (sea[z].b === 2) { rows.push({ ph: 'Sailing', ev: `Seas ${sea[z].m} m off the ${ZONES[z].area}`, res: 'too rough: the wave stays in port', tone: 'roc' }); continue; }
    G.ready.amph -= a; G.ready.ferry -= f;
    G.queue[z].amph += a; G.queue[z].ferry += f;
    sailed[z] = { amph: a, ferry: f };
    rows.push({ ph: 'Sailing', ev: `${a} amphibious and ${f} ferry group${a + f === 1 ? '' : 's'} sail for the ${ZONES[z].area}`, res: `${r1(a * LIFT.amph.size + f * LIFT.ferry.size)} points embarked`, tone: '' });
  }

  // 3. Taiwan's anti-ship missiles against everything afloat (Hughes salvo model)
  const afloat = ZONE_KEYS.filter(z => G.queue[z].amph + G.queue[z].ferry > 0);
  const nAfloat = afloat.reduce((a, z) => a + G.queue[z].amph + G.queue[z].ferry, 0);
  const ready = G.launchers.filter(L => L.alive && L.ammo > 0);
  const nFire = nAfloat ? Math.round(clamp(roc.fire ?? 1, 0, 1) * ready.length) : 0;
  let missiles = 0;
  ready.slice(0, nFire).forEach(L => { const m = Math.min(ROC.salvo, L.ammo); L.ammo -= m; missiles += m; L.exposed = true; L.firedNow = true; });
  G.stats.missiles += missiles;
  const weightOf = z => (G.queue[z].amph * LIFT.amph.weight + G.queue[z].ferry * LIFT.ferry.weight) * ZONES[z].expo;
  const wsum = afloat.reduce((a, z) => a + weightOf(z), 0);
  const us = G.setup.us && t >= 3 ? P.usHits : 0;
  for (const z of afloat) {
    const share = weightOf(z) / wsum;
    const M = missiles * share;
    const E = P.escorts * share;
    const mean = Math.max(0, P.alpha * M - P.b3 * E) + us * share;
    const hits = poisson(seed, `salvo-t${t}-${z}`, mean);
    if (missiles || us) {
      const lost = applyHits(G, z, hits, `hit-t${t}-${z}`);
      rows.push({ ph: 'Missiles', ev: Math.round(M) ? `${Math.round(M)} Taiwanese missiles at the ${ZONES[z].area} shipping; escorts stop up to ${Math.round(P.b3 * E)}${us ? ` · plus U.S. and allied strikes` : ''}` : `U.S. and allied strikes on the ${ZONES[z].area} shipping (Taiwan fired no missiles here)`, res: hits ? `${hits} hit${hits > 1 ? 's' : ''}; ${lost.a} amphibious and ${lost.f} ferry group${lost.a + lost.f === 1 ? '' : 's'} sunk (a group takes several hits; damage carries over)` : 'no hits', tone: hits ? 'roc' : 'pla', salvo: { M: r1(M), E: r1(E), mean: r1(mean), hits } });
    }
  }
  if (!nFire && nAfloat && ready.length) rows.push({ ph: 'Missiles', ev: `${ready.length} batteries hold fire and stay hidden`, res: 'no salvo', tone: '' });

  // 4. Mines, for groups arriving this turn
  for (const z of Object.keys(sailed)) {
    const pm = P.pMine * G.mines[z];
    if (pm <= 0.001) continue;
    let la = 0, lf = 0;
    for (let i = 0; i < sailed[z].amph; i++) if (uni(seed, `mine-t${t}-${z}-a`, i) < pm) la++;
    for (let i = 0; i < sailed[z].ferry; i++) if (uni(seed, `mine-t${t}-${z}-f`, i) < pm) lf++;
    la = Math.min(la, G.queue[z].amph); lf = Math.min(lf, G.queue[z].ferry);
    G.queue[z].amph -= la; G.queue[z].ferry -= lf;
    G.stats.lostAmph += la; G.stats.lostFerry += lf; G.stats.mined += la + lf;
    G.stats.lostTroops += la * LIFT.amph.size + lf * LIFT.ferry.size;
    rows.push({ ph: 'Mines', ev: `${sailed[z].amph + sailed[z].ferry} groups cross the ${ZONES[z].area} minefield (${Math.round(pm * 100)}% each)`, res: la + lf ? `${la + lf} lost` : 'none lost', tone: la + lf ? 'roc' : '' });
  }

  // 5. Unloading: beach and port capacity by sea state; the rest waits offshore
  for (const z of ZONE_KEYS) {
    const q = G.queue[z];
    G.short[z] = 1;
    if (!q.amph && !q.ferry && G.ashore[z] <= 0) continue;
    const b = sea[z].b, Z = ZONES[z];
    // A captured port works at full rate, a wrecked one at a quarter. U.S. and allied air strikes halve either
    // from D+1 (CSIS: in one iteration "U.S. air strikes prevented its use").
    const held = (G.port[z] === 'pla' ? 1 : G.port[z] === 'wrecked' ? 0.25 : 0) * (G.setup.us && t >= 3 ? P.usPort : 1);
    const beach = Z.beach * (G.breakout[z] ? 1.5 : 1);
    // Each facility has one turn of working time. A point of cargo takes 1 / (capacity x sea factor) of it.
    // Ferries use the port first; amphibious groups use the beach first.
    const fac = [{ k: 'port', cap: Z.port.cap * held, left: 1 }, { k: 'beach', cap: beach, left: 1 }];
    const unload = (type, n, order) => {
      let done = 0;
      for (const f of order) {
        const rate = f.cap * UNLOAD[f.k][type][b];
        if (rate <= 0) continue;
        const cost = LIFT[type].size / rate;
        while (done < n && f.left >= cost - 1e-9) { f.left -= cost; done++; }
      }
      return done;
    };
    // Troops already ashore must be supplied first (CSIS: supply "progressively reduces the number of new
    // formations that can be transported"). Supply takes working time at the port first, then the beach.
    let need = P.supply * G.ashore[z];
    for (const f of fac) {
      const rate = f.cap * UNLOAD[f.k].amph[b];
      if (rate <= 0 || need <= 0) continue;
      const use = Math.min(f.left, need / rate);
      f.left -= use; need -= use * rate;
    }
    G.short[z] = G.ashore[z] > 0 && need > 0.05 * G.ashore[z] * P.supply + 1e-9 ? 1 - need / (P.supply * G.ashore[z]) : 1;
    // Order: amphibious groups on the beach, ferries at the quay, then each uses what is left of the other.
    let ua = unload('amph', q.amph, [fac[1]]);
    let uf = unload('ferry', q.ferry, [fac[0]]);
    ua += unload('amph', q.amph - ua, [fac[0]]);
    uf += unload('ferry', q.ferry - uf, [fac[1]]);
    q.amph -= ua; q.ferry -= uf;
    const pts = ua * LIFT.amph.size + uf * LIFT.ferry.size;
    G.ashore[z] += pts; G.fresh[z] = pts; G.stats.landed += pts;
    if (ua || uf) G.back.push({ at: t + Z.cycle, amph: ua, ferry: uf });
    const wait = q.amph + q.ferry;
    if (G.short[z] < 1) rows.push({ ph: 'Supply', ev: `${Z.area}: seas ${sea[z].m ?? '?'} m cut deliveries to the troops ashore`, res: `${Math.round(G.short[z] * 100)}% of supply needs met; they fight at reduced strength`, tone: 'roc' });
    if (!ua && !uf && !wait) continue;
    rows.push({ ph: 'Unloading', ev: `${Z.area}: seas ${sea[z].m ?? '?'} m${held === 1 ? ', port in use' : held ? ', wrecked port' : ''}`, res: `${ua + uf} group${ua + uf === 1 ? '' : 's'} unload, +${r1(pts)} points${wait ? `; ${wait} wait offshore` : ''}`, tone: pts ? 'pla' : 'roc' });
  }

  // 6. Taiwan's reserves move (interdiction can delay them), mobilization from turn 3
  for (const r of G.reserves) {
    const dest = roc.moves?.[r.id];
    if (dest && dest !== r.dest && r.eta <= 0) { r.dest = dest; r.eta = REACH[r.at][dest]; r.at = null; }
  }
  for (const r of G.reserves) {
    if (r.at) continue;
    if (uni(seed, `cut-t${t}`, r.id) < (G.cut || 0)) { rows.push({ ph: 'Roads', ev: `Reserve group ${r.id + 1} moving to the ${ZONES[r.dest].area}`, res: 'delayed by strikes on the roads', tone: 'pla' }); r.s *= 0.95; continue; }
    r.eta--;
    if (r.eta <= 0) { r.at = r.dest; r.eta = 0; rows.push({ ph: 'Roads', ev: `Reserve group ${r.id + 1} reaches the ${ZONES[r.at].area}`, res: `+${r1(r.s)} points`, tone: 'roc' }); }
  }
  if (t >= 3) {
    const target = roc.mobTo || busiest(G);
    const add = ROC.mobRate * P.reserveEff;
    G.def[target] += add;
    rows.push({ ph: 'Mobilization', ev: `Mobilized reserves join the ${ZONES[target].area} defense`, res: `+${r1(add)} points`, tone: 'roc' });
  }

  // 7. Ground combat in each lodgment (Lanchester square law)
  for (const z of ZONE_KEYS) {
    if (G.ashore[z] < 0.05) continue;
    rows.push(...fight(G, z, t, !!roc.ca?.[z], !!pla.port?.[z]));
  }

  // 8. Ships that unloaded head home and reload
  G.back = G.back.filter(b => { if (b.at <= t + 1) { G.ready.amph += b.amph; G.ready.ferry += b.ferry; return false; } return true; });
  for (const z of ZONE_KEYS) G.fresh[z] = 0;

  G.log.push({ t, rows, sea });
  G.hist.push(snapshot(G));
  if (t >= TURNS) { G.over = true; G.result = judge(G); }
  return rows;
}

/** Hits against the shipping afloat off zone z. Ferries draw more hits (bigger, softer targets). */
function applyHits(G, z, hits, key) {
  const q = G.queue[z];
  let a = 0, f = 0;
  for (let i = 0; i < hits; i++) {
    const wa = q.amph * LIFT.amph.weight, wf = q.ferry * LIFT.ferry.weight;
    if (wa + wf <= 0) break;
    if (uni(G.seed, key, i) < wf / (wa + wf)) {
      q.dmgF += 1;
      if (q.dmgF >= LIFT.ferry.w) { q.dmgF -= LIFT.ferry.w; q.ferry--; f++; }
    } else {
      q.dmgA += 1;
      if (q.dmgA >= LIFT.amph.w) { q.dmgA -= LIFT.amph.w; q.amph--; a++; }
    }
  }
  G.stats.hits += hits; G.stats.lostAmph += a; G.stats.lostFerry += f;
  G.stats.lostTroops += a * LIFT.amph.size + f * LIFT.ferry.size;
  return { a, f };
}

/** Taiwan's strength present in zone z (coastal defenders plus reserves that have arrived). */
export function defAt(G, z) {
  return G.def[z] + G.reserves.filter(r => r.at === z).reduce((a, r) => a + r.s, 0);
}

/** Zone with the most PLA troops ashore or afloat. */
export function busiest(G) {
  let best = G.setup.zones[0], v = -1;
  for (const z of ZONE_KEYS) { const x = G.ashore[z] + G.queue[z].amph + G.queue[z].ferry * 1.5; if (x > v) { v = x; best = z; } }
  return best;
}

function fight(G, z, t, counter, portAssault) {
  const { P, seed } = G;
  const rows = [];
  const D0 = defAt(G, z), A0 = G.ashore[z];
  const supplied = 1 - (1 - G.short[z]) * (1 - P.unsupplied);
  const eA = (A0 - (1 - P.fresh) * G.fresh[z]) * P.support * supplied * (counter && t > 1 ? 1.2 : 1);
  const eD = D0 * (counter ? 1 : P.fort);
  let I;
  if (counter) I = P.caInt;
  else I = eA >= eD ? 1 : 0.4;
  const nA = Math.exp(P.noise * normal(seed, `gA-t${t}-${z}`) - P.noise * P.noise / 2);
  const nD = Math.exp(P.noise * normal(seed, `gD-t${t}-${z}`) - P.noise * P.noise / 2);
  const lossA = Math.min(A0, P.kill * I * eD * nA);
  const lossD = Math.min(D0, P.kill * I * eA * nD);
  G.ashore[z] = A0 - lossA;
  takeDef(G, z, lossD);
  G.stats.plaKIA += lossA; G.stats.rocKIA += lossD;
  const what = counter ? 'Taiwan counterattacks' : eA >= eD ? 'PLA attacks out of the lodgment' : 'Both sides dig in';
  rows.push({ ph: 'Ground', ev: `${ZONES[z].area}: ${what}. PLA ${r1(A0)} vs Taiwan ${r1(D0)} (effective ${r1(eA)} vs ${r1(eD)})`, res: `PLA −${r1(lossA)}, Taiwan −${r1(lossD)}`, tone: lossA > lossD ? 'roc' : 'pla', ground: { A0: r1(A0), D0: r1(D0), eA: r1(eA), eD: r1(eD), I } });
  const D1 = defAt(G, z);
  if (D1 < 0.5 && G.ashore[z] >= 5 && !G.breakout[z]) {
    G.breakout[z] = true;
    rows.push({ ph: 'Breakout', ev: `The ${ZONES[z].area} defense collapses`, res: 'lodgment widens: more beaches in use', tone: 'pla' });
  }
  if (portAssault && G.port[z] === 'roc') {
    const ratio = G.ashore[z] * P.support / Math.max(0.01, D1 * P.fort);
    if (ratio >= P.portRatio) {
      const x = uni(seed, `demo-${z}`);
      G.port[z] = x < G.demo ? 'wrecked' : 'pla';
      rows.push({ ph: 'Port', ev: `${ZONES[z].port.t} falls at ${r1(ratio)}:1`, res: G.port[z] === 'pla' ? 'taken intact: ferries can unload at the quay' : 'demolition charges wreck it: a quarter of its capacity', tone: G.port[z] === 'pla' ? 'pla' : 'roc' });
    } else rows.push({ ph: 'Port', ev: `Assault on ${ZONES[z].port.t} at ${r1(ratio)}:1`, res: `needs ${P.portRatio}:1; the port holds`, tone: 'roc' });
  }
  if (G.ashore[z] < 0.3 && A0 >= 0.3) rows.push({ ph: 'Ground', ev: `The ${ZONES[z].area} lodgment`, res: 'is destroyed', tone: 'roc' });
  if (G.ashore[z] < 0.3) G.ashore[z] = 0;
  return rows;
}

/** Spread Taiwan's losses over the coastal defenders and reserves in zone z. */
function takeDef(G, z, loss) {
  const here = G.reserves.filter(r => r.at === z);
  const tot = defAt(G, z);
  if (tot <= 0) return;
  const f = Math.min(1, loss / tot);
  G.def[z] *= 1 - f;
  here.forEach(r => { r.s *= 1 - f; });
}

export function snapshot(G) {
  return {
    t: G.t,
    ashore: { ...G.ashore }, def: Object.fromEntries(ZONE_KEYS.map(z => [z, defAt(G, z)])),
    afloat: Object.fromEntries(ZONE_KEYS.map(z => [z, G.queue[z].amph * LIFT.amph.size + G.queue[z].ferry * LIFT.ferry.size])),
    ready: { ...G.ready }, launchers: G.launchers.filter(L => L.alive).length,
    missiles: G.launchers.reduce((a, L) => a + (L.alive ? L.ammo : 0), 0),
    mines: { ...G.mines }, port: { ...G.port }, stats: { ...G.stats },
  };
}

/** Outcome after D+3. */
export function judge(G) {
  const P = G.P;
  let best = null;
  for (const z of ZONE_KEYS) {
    const A = G.ashore[z]; if (A <= 0) continue;
    const D = defAt(G, z), ratio = A / Math.max(0.1, D);
    const supplied = G.port[z] !== 'roc' || A >= WIN.noPortAshore;
    const secure = A >= WIN.minAshore && ratio >= WIN.ratio && supplied;
    const cand = { z, A: r1(A), D: r1(D), ratio: Math.min(99, r1(ratio)), secure, port: G.port[z] };
    if (!best || (secure && !best.secure) || (secure === best.secure && A > best.A)) best = cand;
  }
  const total = ZONE_KEYS.reduce((a, z) => a + G.ashore[z], 0);
  let outcome;
  if (best?.secure) outcome = 'pla';
  else if (total < WIN.repulsed || !best || best.ratio < 0.5) outcome = 'roc';
  else outcome = 'contested';
  return { outcome, best, total: r1(total), stats: G.stats, P };
}
