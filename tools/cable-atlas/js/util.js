// Small formatting helpers shared by the atlas modules.
export const fmtTbps = t => t == null ? 'n/a' : t >= 10 ? `${Math.round(t)} Tbps` : t >= 1 ? `${t.toFixed(1)} Tbps` : `${Math.round(t * 1000)} Gbps`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM-DD' or 'YYYY-MM' to '2 Feb 2023' / 'Feb 2023'. */
export const fmtDate = d => {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return (day ? day + ' ' : '') + (m ? MON[m - 1] + ' ' : '') + y;
};
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
