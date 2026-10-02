// Shareable state in the URL hash, e.g. #m=2026-04&w=asym_ip&c=f16&cat=asym,mun&st=delivering&sort=value&gone=1&v=vintage
import { CATS, STATUSES, byKey } from './model.js';
import { MONTHS } from './mdata.js';

const ABBR = { Traditional: 'trad', Asymmetric: 'asym', Munitions: 'mun' };
const FULL = Object.fromEntries(Object.entries(ABBR).map(([k, v]) => [v, k]));

export function writeHash(S) {
  const q = new URLSearchParams();
  if (S.month) q.set('m', S.month);
  if (S.wedge) q.set('w', S.wedge);
  if (S.sel) q.set('c', S.sel);
  if (S.cats.size < CATS.length) q.set('cat', [...S.cats].map(k => ABBR[k]).join(','));
  if (S.status !== 'all') q.set('st', S.status);
  if (S.sort !== 'age') q.set('sort', S.sort);
  if (S.gone) q.set('gone', '1');
  if (S.view !== 'topline') q.set('v', S.view);
  history.replaceState(null, '', q.toString() ? '#' + q.toString() : location.pathname + location.search);
}

export function readHash(S) {
  const q = new URLSearchParams(location.hash.slice(1));
  const mo = MONTHS.find(m => m.mo === q.get('m'));
  if (mo) S.month = mo.mo;
  if (mo && mo.wedges.some(w => w.id === q.get('w'))) S.wedge = q.get('w');
  if (byKey[q.get('c')] && !byKey[q.get('c')].early) S.sel = q.get('c');  // timeline cases only
  const cats = (q.get('cat') || '').split(',').map(a => FULL[a]).filter(Boolean);
  if (cats.length) S.cats = new Set(cats);
  if (STATUSES.some(s => s.id === q.get('st'))) S.status = q.get('st');
  if (['age', 'value', 'new'].includes(q.get('sort'))) S.sort = q.get('sort');
  if (q.get('gone') === '1') S.gone = true;
  if (q.get('v') === 'vintage') S.view = 'vintage';
  if (S.sel && byKey[S.sel].gone) S.gone = true;
}
