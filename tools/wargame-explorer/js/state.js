// View state and its URL-hash encoding, so any view can be shared as a link.
// Hash keys: s=scenarios, f=formats, j=Japan basing, u=U.S. intervention, g=group-by dimension,
// w=weight (runs|cases), c=open study card.
import { SCENARIOS, FORMATS } from '../data/games.js';
import { DIMS } from '../data/cases.js';

export const DEFAULT = { scen: [], fmt: [], japan: 'any', us: 'any', group: 'japan', weight: 'runs', open: '', focus: [] };

export function fromHash(h = location.hash) {
  const st = { ...DEFAULT, scen: [], fmt: [], focus: [] };
  const p = new URLSearchParams(h.replace(/^#/, ''));
  const list = (k, ok) => (p.get(k) || '').split(',').filter(v => v in ok);
  st.scen = list('s', SCENARIOS);
  st.fmt = list('f', FORMATS);
  if (p.get('j') in DIMS.japan.vals) st.japan = p.get('j');
  if (p.get('u') in DIMS.us.vals) st.us = p.get('u');
  const g = p.get('g');
  if (g === 'none' || g in DIMS) st.group = g;
  if (p.get('w') === 'cases') st.weight = 'cases';
  st.open = p.get('c') || '';
  return st;
}

export function toHash(st) {
  const p = new URLSearchParams();
  if (st.scen.length) p.set('s', st.scen.join(','));
  if (st.fmt.length) p.set('f', st.fmt.join(','));
  if (st.japan !== 'any') p.set('j', st.japan);
  if (st.us !== 'any') p.set('u', st.us);
  if (st.group !== DEFAULT.group) p.set('g', st.group);
  if (st.weight !== 'runs') p.set('w', st.weight);
  if (st.open) p.set('c', st.open);
  const s = p.toString().replace(/%2C/g, ',');
  return s ? '#' + s : '';
}
