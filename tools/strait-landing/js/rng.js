// Keyed random numbers. Every chance event draws from its own key (event, turn, zone, index), so two plans
// played on the same seed face the same weather and the same dice wherever they make the same choices.
// This is the "common random numbers" technique used to compare policies in simulation studies.

/** FNV-1a 32-bit hash of a string. */
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Uniform [0,1) for (seed, key, index). Mulberry32 finaliser on a mixed state. */
export function uni(seed, key, i = 0) {
  let a = (fnv(key) ^ Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca77)) >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Standard normal from two keyed uniforms (Box-Muller). */
export function normal(seed, key, i = 0) {
  const u = Math.max(1e-12, uni(seed, key, 2 * i)), v = uni(seed, key, 2 * i + 1);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Poisson draw with mean m by inversion (m stays small in this game). */
export function poisson(seed, key, m) {
  if (m <= 0) return 0;
  const u = uni(seed, key);
  let k = 0, p = Math.exp(-m), c = p;
  while (u > c && k < 200) { k++; p *= m / k; c += p; }
  return k;
}

/** Binomial count of n trials at chance p, one keyed uniform per trial. */
export function binom(seed, key, n, p) {
  let k = 0;
  for (let i = 0; i < n; i++) if (uni(seed, key, i) < p) k++;
  return k;
}

export const randomSeed = () => 1 + Math.floor(Math.random() * 999998);
