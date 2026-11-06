// Shareable view state in the URL hash, e.g. #m=approach&br=1&bt=0.42&cm=jam,blind
const MODES = ['approach', 'crossing', 'salvo', 'activity'];
const round = v => Math.round(v * 1000) / 1000;
const flags = o => Object.keys(o).filter(k => o[k] === true).join(',');
const pos = p => p.map(v => v.toFixed(3)).join(',');

export function writeHash(S) {
  const q = new URLSearchParams({ m: S.mode });
  if (S.mode === 'crossing') {
    q.set('rr', S.red.route); S.red.free ? q.set('rp', pos(S.red.free)) : q.set('rt', round(S.red.t));
    q.set('rc', flags(S.rc)); q.set('sp', S.rc.supp); q.set('kn', S.knots);
  } else if (S.mode === 'activity') {
    q.set('from', S.range[0]); q.set('to', S.range[1]);
  } else {
    q.set('br', S.blue.route); S.blue.free ? q.set('bp', pos(S.blue.free)) : q.set('bt', round(S.blue.t));
    q.set('cm', flags(S.cm));
  }
  history.replaceState(null, '', '#' + q.toString());
}

export function readHash(S) {
  const q = new URLSearchParams(location.hash.slice(1));
  const m = q.get('m');
  if (!MODES.includes(m)) return;
  S.mode = m;
  const num = (k, lo, hi) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; };
  const pt = k => { const v = (q.get(k) || '').split(',').map(Number); return v.length === 2 && v.every(Number.isFinite) ? v : null; };
  const setFlags = (k, o) => { if (!q.has(k)) return; const on = new Set(q.get(k).split(',')); Object.keys(o).forEach(f => { if (typeof o[f] === 'boolean') o[f] = on.has(f); }); };
  if (num('br', 0, 3) != null) S.blue.route = num('br', 0, 3) | 0;
  if (num('bt', 0, 1) != null) S.blue.t = num('bt', 0, 1);
  if (pt('bp')) S.blue.free = pt('bp');
  if (num('rr', 0, 2) != null) S.red.route = num('rr', 0, 2) | 0;
  if (num('rt', 0, 1) != null) S.red.t = num('rt', 0, 1);
  if (pt('rp')) S.red.free = pt('rp');
  if (num('sp', 0, 0.9) != null) S.rc.supp = num('sp', 0, 0.9);
  if (num('kn', 6, 20) != null) S.knots = num('kn', 6, 20);
  setFlags('cm', S.cm);
  setFlags('rc', S.rc);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(q.get('from') || '') && iso.test(q.get('to') || '')) S.range = [q.get('from'), q.get('to')];
}
