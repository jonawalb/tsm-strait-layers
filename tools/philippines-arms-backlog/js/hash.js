// Shareable state in the URL hash, e.g. #m=2026-07&w=n_trad&c=f16-2025&cat=trad,mun&st=nna&sort=value&gone=1&v=months
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
  if (S.sort !== 'tier') q.set('sort', S.sort);
  if (S.gone) q.set('gone', '1');
  if (S.view !== 'notified') q.set('v', S.view);
  history.replaceState(null, '', q.toString() ? '#' + q.toString() : location.pathname + location.search);
}

export function readHash(S) {
  const q = new URLSearchParams(location.hash.slice(1));
  const mo = MONTHS.find(m => m.mo === q.get('m'));
  if (mo) S.month = mo.mo;
  if (mo && mo.wedges.some(w => w.id === q.get('w'))) S.wedge = q.get('w');
  if (byKey[q.get('c')]) S.sel = q.get('c');
  const cats = (q.get('cat') || '').split(',').map(a => FULL[a]).filter(Boolean);
  if (cats.length) S.cats = new Set(cats);
  if (STATUSES.some(s => s.id === q.get('st'))) S.status = q.get('st');
  if (['tier', 'age', 'value', 'new'].includes(q.get('sort'))) S.sort = q.get('sort');
  if (q.get('gone') === '1') S.gone = true;
  if (q.get('v') === 'months') S.view = 'months';
  if (S.sel && byKey[S.sel].gone) S.gone = true;
}
