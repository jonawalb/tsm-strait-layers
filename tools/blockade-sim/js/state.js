// Scenario state, presets and the shareable URL hash.
import { ASSUME } from '../data/params.js';

export const AREAS = [
  { k: 'north', n: 'North coast', s: 'Tanshui and Pa-li, New Taipei' },
  { k: 'yilan', n: 'Toucheng', s: 'Yilan, northeast coast' },
  { k: 'pingtung', n: 'Fangshan', s: 'Pingtung, south coast' },
  { k: 'taitung', n: 'Dawu', s: 'Taitung, southeast coast' },
  { k: 'outlying', n: 'Outlying islands', s: 'Domestic cables to Penghu, Kinmen, Matsu' },
];

export const PRESETS = [
  { k: 'cgq', n: 'Coast guard quarantine', s: 'Customs inspections, insurers list the area',
    v: { mode: 'q', sev: 30, dur: 60, esc: 'none', ins: 'listed', fac: false, cab: [], rep: 'after', stk: 'reported', pol: 'conserve', floor: 0, air: false } },
  { k: 'grey', n: 'Quarantine plus cable cuts', s: 'Deniable cuts at two landing areas',
    v: { mode: 'q', sev: 30, dur: 90, esc: 'none', ins: 'listed', fac: false, cab: ['north', 'outlying'], rep: 'after', stk: 'reported', pol: 'conserve', floor: 0, air: false } },
  { k: 'blk', n: 'Naval blockade', s: 'Ships turned away, cover withdrawn',
    v: { mode: 'b', sev: 80, dur: 90, esc: 'none', ins: 'withdrawn', fac: false, cab: ['north', 'yilan', 'pingtung', 'taitung', 'outlying'], rep: 'after', stk: 'reported', pol: 'ration', floor: 0, air: true } },
  { k: 'convoy', n: 'Blockade with allied convoys', s: 'Escorts and a state-backed insurance pool',
    v: { mode: 'b', sev: 80, dur: 90, esc: 'allied', ins: 'withdrawn', fac: true, cab: ['north', 'yilan', 'pingtung', 'taitung', 'outlying'], rep: 'escorted', stk: 'reported', pol: 'ration', floor: 0, air: true } },
];

export const DEFAULT = { ...PRESETS[0].v };

const KEYS = { mode: 'm', sev: 's', dur: 'd', esc: 'e', ins: 'i', fac: 'f', cab: 'c', rep: 'r', stk: 'k', pol: 'p', floor: 'l', air: 'a' };

/** Encode a scenario (and any changed assumptions) into a compact hash string. */
export function encode(cfg, over = {}) {
  const parts = Object.entries(KEYS).map(([k, s]) => {
    const v = cfg[k];
    if (Array.isArray(v)) return `${s}=${v.join('.')}`;
    if (typeof v === 'boolean') return `${s}=${v ? 1 : 0}`;
    return `${s}=${v}`;
  });
  Object.entries(over).forEach(([k, v]) => parts.push(`x.${k}=${v}`));
  return parts.join('&');
}

export function decode(hash) {
  const cfg = { ...DEFAULT, cab: [...DEFAULT.cab] }, over = {};
  let cmp = null;
  const rev = Object.fromEntries(Object.entries(KEYS).map(([k, s]) => [s, k]));
  (hash || '').replace(/^#/, '').split('&').filter(Boolean).forEach(p => {
    const [s, raw = ''] = p.split('=');
    const v = decodeURIComponent(raw);
    if (s.startsWith('x.')) {
      const a = ASSUME.find(x => x.k === s.slice(2));
      const n = Number(v);
      if (a && Number.isFinite(n)) over[a.k] = Math.max(a.min, Math.min(a.max, n));
      return;
    }
    if (s === 'cmp') { cmp = v; return; }
    const k = rev[s];
    if (!k) return;
    if (k === 'cab') cfg.cab = v ? v.split('.').filter(a => AREAS.some(x => x.k === a)) : [];
    else if (k === 'fac' || k === 'air') cfg[k] = v === '1';
    else if (['sev', 'dur', 'floor'].includes(k)) { const n = Number(v); if (Number.isFinite(n)) cfg[k] = n; }
    else cfg[k] = v;
  });
  cfg.sev = Math.max(0, Math.min(100, cfg.sev));
  cfg.dur = Math.max(7, Math.min(180, cfg.dur));
  cfg.floor = Math.max(0, Math.min(5, cfg.floor));
  if (!['q', 'b'].includes(cfg.mode)) cfg.mode = 'q';
  if (!['none', 'tw', 'allied'].includes(cfg.esc)) cfg.esc = 'none';
  if (!['hold', 'listed', 'withdrawn'].includes(cfg.ins)) cfg.ins = 'listed';
  if (!['peace', 'after', 'escorted'].includes(cfg.rep)) cfg.rep = 'after';
  if (!['normal', 'conserve', 'ration'].includes(cfg.pol)) cfg.pol = 'conserve';
  if (!['reported', 'statutory', 'y2027'].includes(cfg.stk)) cfg.stk = 'reported';
  return { cfg, over, cmp };
}

/** Assumption values with user overrides applied. */
export function resolve(over) {
  return Object.fromEntries(ASSUME.map(a => [a.k, over[a.k] ?? a.v]));
}
