// Shareable view state in the URL hash.
const num = (q, k, lo, hi) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; };

export function writeHash(S) {
  const q = new URLSearchParams({ m: S.mode, x: S.ext });
  if (S.mode === 'live') {
    q.set('t', Math.round(S.t)); q.set('g', S.gapH); q.set('tr', S.trail);
    q.set('c', Object.keys(S.cats).filter(k => S.cats[k]).join(','));
    q.set('lo', `${S.lo.kn},${S.lo.km},${S.lo.h}`);
    if (S.allGaps) q.set('all', 1);
    if (!S.coloc) q.set('co', 0);
    if (S.sel) q.set('v', S.sel.mmsi);
  } else {
    q.set('mo', S.month); q.set('sp', S.span);
    q.set('f', Object.keys(S.forces).filter(k => S.forces[k]).join(','));
    if (S.sel) q.set('v', S.sel);
  }
  q.set('ov', Object.keys(S.ov).filter(k => S.ov[k]).join(','));
  history.replaceState(null, '', '#' + q.toString());
}

export function readHash(S) {
  const q = new URLSearchParams(location.hash.slice(1));
  if (!['live', 'archive'].includes(q.get('m'))) return;
  S.mode = q.get('m');
  if (['taiwan', 'region'].includes(q.get('x'))) S.ext = q.get('x');
  const set = (k, lo, hi, f) => { const v = num(q, k, lo, hi); if (v != null) f(v); };
  set('t', 0, 1e5, v => { S.t = v; });
  set('g', 2, 72, v => { S.gapH = v; });
  set('tr', 1, 48, v => { S.trail = v; });
  set('mo', 0, 999, v => { S.month = v | 0; });
  set('sp', 1, 12, v => { S.span = [1, 3, 12].includes(v) ? v : 3; });
  if (q.has('c')) { const on = new Set(q.get('c').split(',')); Object.keys(S.cats).forEach(k => { S.cats[k] = on.has(k); }); }
  if (q.has('f')) { const on = new Set(q.get('f').split(',')); Object.keys(S.forces).forEach(k => { S.forces[k] = on.has(k); }); }
  if (q.has('ov')) { const on = new Set(q.get('ov').split(',')); Object.keys(S.ov).forEach(k => { S.ov[k] = on.has(k); }); }
  const lo = (q.get('lo') || '').split(',').map(Number);
  if (lo.length === 3 && lo.every(Number.isFinite)) S.lo = { kn: lo[0], km: lo[1], h: lo[2] };
  S.allGaps = q.get('all') === '1';
  S.coloc = q.get('co') !== '0';
  if (/^\d{9}$/.test(q.get('v') || '')) S.sel = q.get('v');
}
