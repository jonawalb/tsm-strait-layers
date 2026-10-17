// The mine warfare model: laying budget, clearance effort over time, and assault losses.
// All parameters come from data/params.js and are notional. Readouts use expected values;
// the animation shows one seeded random draw of the same odds.
import { GRID, LAYING, ASSETS, CLEAR, MINES, ASSAULT } from '../data/params.js';

export const N = GRID.cols * GRID.rows;
export const idx = (c, r) => r * GRID.cols + c;
export const colOf = i => i % GRID.cols;
export const rowOf = i => Math.floor(i / GRID.cols);

/** Deterministic pseudo-random number in [0,1) for an integer key. */
export function rand(k) {
  let x = (k + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export const budget = S => Math.floor(S.ships * S.sorties * LAYING.minesPerShipSortie / LAYING.minesPerGroup);
export const used = mines => mines.reduce((a, m) => a + (m ? 1 : 0), 0);
export const isMixed = mines => mines.includes(1) && mines.includes(2);

/** Leftmost column of each lane, spread evenly across the front. */
export function laneCols(n) {
  return Array.from({ length: n }, (_, i) => Math.min(GRID.cols - ASSAULT.laneWidth, Math.round((i + 0.5) * GRID.cols / n) - 1));
}
export function inLane(c, lanes) {
  return laneCols(lanes).findIndex(l => c >= l && c < l + ASSAULT.laneWidth);
}

/** Cells the PLA must search, in the order it searches them (seaward rows first). */
export function plan(strat, lanes) {
  const out = [];
  for (let r = 0; r < GRID.rows; r++) {
    if (strat === 'area') { for (let c = 0; c < GRID.cols; c++) out.push(idx(c, r)); continue; }
    for (const l of laneCols(lanes)) for (let c = l; c < l + ASSAULT.laneWidth; c++) out.push(idx(c, r));
  }
  return out;
}

/** Hour-by-hour clearance effort for a strategy. */
export function simulate(S, strat) {
  const order = plan(strat, S.lanes);
  const mix = isMixed(S.mines) ? CLEAR.mixedPenalty : 1;
  const E = [0];
  let finish = null;
  for (let h = 0; h < CLEAR.maxHours; h++) {
    let eff = 0;
    for (const a of ASSETS) eff += S.assets[a.k] * (S.fires ? Math.exp(-a.att * h) : 1) * a.rate;
    E.push(E[h] + eff / mix);
    if (finish == null && E[h + 1] >= order.length) { finish = h + 1; break; }
    if (h > 24 * 5 && eff / mix < 0.002) break; // attrition has stopped the effort
  }
  const w = ASSETS.reduce((s, a) => s + S.assets[a.k] * a.rate, 0);
  const pClear = { 1: 0, 2: 0 };
  if (w > 0) for (const t of [1, 2]) pClear[t] = ASSETS.reduce((s, a) => s + S.assets[a.k] * a.rate * a.p[t], 0) / w;
  return { order, E, finish, pClear, mix };
}

export const sweptAt = (sim, h) => Math.min(sim.order.length, Math.floor(sim.E[Math.min(Math.max(0, Math.round(h)), sim.E.length - 1)] + 1e-9));

/** Residual threat in each cell at hour h: 0 empty, 1 intact group, 1 - pClear if searched. */
export function residual(S, sim, h) {
  const res = new Float32Array(N), swept = new Uint8Array(N);
  const n = sweptAt(sim, h);
  for (let k = 0; k < n; k++) swept[sim.order[k]] = 1;
  for (let i = 0; i < N; i++) {
    const m = S.mines[i];
    if (m) res[i] = swept[i] ? 1 - sim.pClear[m] : 1;
  }
  return { res, swept, n };
}

/** Approach columns the landing craft use. */
export function assaultCols(strat, lanes) {
  if (strat === 'area') {
    const step = GRID.cols / ASSAULT.areaColumns;
    return Array.from({ length: ASSAULT.areaColumns }, (_, i) => Math.floor(i * step + step / 2));
  }
  return laneCols(lanes).flatMap(l => Array.from({ length: ASSAULT.laneWidth }, (_, j) => l + j));
}

/** Expected landing craft lost crossing the field. Craft are assigned to columns in turn. */
export function assault(S, strat, res) {
  const cols = assaultCols(strat, S.lanes);
  const surv = cols.map(c => {
    let p = 1;
    for (let r = 0; r < GRID.rows; r++) { const i = idx(c, r), m = S.mines[i]; if (m) p *= 1 - MINES[m].hit * res[i]; }
    return p;
  });
  let lost = 0;
  for (let k = 0; k < ASSAULT.craft; k++) lost += 1 - surv[k % cols.length];
  return { cols, surv, lost };
}

/** Everything the panel and compare table need for one strategy at the time available. */
export function evaluate(S, strat) {
  const sim = simulate(S, strat);
  const H = S.hours;
  const { res, swept, n } = residual(S, sim, H);
  let found = 0, empty = 0;
  for (let k = 0; k < n; k++) { const i = sim.order[k], m = S.mines[i]; if (m) found += sim.pClear[m]; else empty++; }
  const lanesOpen = strat === 'lanes'
    ? laneCols(S.lanes).filter(l => { for (let r = 0; r < GRID.rows; r++) for (let c = l; c < l + ASSAULT.laneWidth; c++) if (!swept[idx(c, r)]) return false; return true; }).length
    : null;
  const rowsClear = Math.floor(n / (strat === 'area' ? GRID.cols : S.lanes * ASSAULT.laneWidth));
  const mcmLost = S.fires ? ASSETS.map(a => ({ t: a.t, n: S.assets[a.k] * (1 - Math.exp(-a.att * H)) })) : [];
  const now = assault(S, strat, res);
  const done = sim.finish != null ? assault(S, strat, residual(S, sim, sim.finish).res) : null;
  const frontKm = assaultCols(strat, S.lanes).length * GRID.cellM / 1000 * (strat === 'area' ? GRID.cols / ASSAULT.areaColumns : 1);
  return { strat, sim, res, swept, n, found, empty, lanesOpen, rowsClear, mcmLost, now, done, frontKm };
}

/** Losses with no clearance at all, for reference. */
export function baseline(S) {
  const res = new Float32Array(N);
  for (let i = 0; i < N; i++) res[i] = S.mines[i] ? 1 : 0;
  return assault(S, 'area', res).lost;
}

// ---- Presets ---------------------------------------------------------------------
// Each preset returns a scored list of cells; the top `budget` cells are mined.
const PRESET_FNS = {
  barrier: (c, r) => -Math.abs(r - 5) * 10 - (r === 5 || r === 6 ? 0 : 5) + rand(c * 31 + r) * 0.5,
  beach: (c, r) => r * 10 + rand(c * 17 + r) * 4,
  scatter: (c, r) => rand(c * 7919 + r * 104729),
  mixed: (c, r) => -Math.abs(r - 6) * 3 + rand(c * 13 + r * 7) * 6,
};
export const PRESETS = [
  { k: 'barrier', t: 'Barrier line', s: 'A belt across the middle' },
  { k: 'beach', t: 'Beach belt', s: 'Dense near the landing area' },
  { k: 'scatter', t: 'Scattered', s: 'Thin coverage everywhere' },
  { k: 'mixed', t: 'Mixed types', s: 'Moored and bottom mines' },
];

export function applyPreset(k, S) {
  const cells = [];
  for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) cells.push({ i: idx(c, r), s: PRESET_FNS[k](c, r) });
  cells.sort((a, b) => b.s - a.s);
  const out = new Uint8Array(N), nb = Math.min(budget(S), N);
  for (let j = 0; j < nb; j++) {
    const i = cells[j].i;
    out[i] = k === 'mixed' ? (rand(i * 3 + 1) < 0.5 ? 1 : 2) : k === 'beach' ? 2 : 1;
  }
  return out;
}

// ---- Hash encoding of the minefield: 2 bits per cell, hex -------------------------
export function encodeMines(m) {
  let s = '';
  for (let i = 0; i < N; i += 2) s += ((m[i] << 2) | (m[i + 1] || 0)).toString(16);
  return s;
}
export function decodeMines(s) {
  if (!/^[0-9a-f]+$/.test(s) || s.length !== Math.ceil(N / 2)) return null;
  const m = new Uint8Array(N);
  for (let j = 0; j < s.length; j++) {
    const v = parseInt(s[j], 16);
    m[2 * j] = Math.min(2, v >> 2);
    if (2 * j + 1 < N) m[2 * j + 1] = Math.min(2, v & 3);
  }
  return m;
}
