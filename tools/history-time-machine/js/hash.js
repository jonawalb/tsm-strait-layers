// Shareable state in the URL hash, e.g. #y=1955&b=1954&e=dachen&f=us,mil
import { YEAR0, YEAR1 } from '../data/control.js';
import { CATS } from '../data/events.js';

const ALL = CATS.map(c => c.id);
const yr = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(YEAR0, Math.min(YEAR1, n)) : null; };

export function writeHash(S) {
  const q = new URLSearchParams({ y: S.a });
  if (S.b != null) q.set('b', S.b);
  if (S.sel) q.set('e', S.sel);
  if (S.f.size !== ALL.length) q.set('f', [...S.f].join(',') || 'none');
  history.replaceState(null, '', '#' + q.toString());
}

export function readHash(S, validIds) {
  const q = new URLSearchParams(location.hash.slice(1));
  if (yr(q.get('y')) != null) S.a = yr(q.get('y'));
  if (yr(q.get('b')) != null) S.b = yr(q.get('b'));
  if (q.has('f')) S.f = new Set(q.get('f').split(',').filter(c => ALL.includes(c)));
  if (validIds.has(q.get('e'))) S.sel = q.get('e');
  return q.has('y');
}
