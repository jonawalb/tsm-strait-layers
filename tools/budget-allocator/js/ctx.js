// The active country profile, with any user edits to its notional parameters applied.
// Every other module reads categories and geometry from here, so switching country swaps the whole model.
export const ctx = { P: null, cats: [], cat: {}, geo: null };

/** Activate a profile. `over` = { cats: {id: {base,k,reach,w}}, geo: {km, speed} } holds user edits. */
export function setProfile(P, over = { cats: {}, geo: {} }) {
  ctx.P = P;
  ctx.cats = P.cats.map(c => ({ ...c, ...(over.cats[c.id] || {}) }));
  ctx.cat = Object.fromEntries(ctx.cats.map(c => [c.id, c]));
  ctx.geo = { ...P.geo, ...over.geo };
  ctx.geo.kmh = ctx.geo.speed * (ctx.geo.unit === 'kn' ? 1.852 : 1);
}
