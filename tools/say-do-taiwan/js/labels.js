// Labels, number formatting and the plain-language verdict. Shared verbatim by say-do-taiwan and say-do-global.

export const DIM = {
  hostility: 'Hostility', threat: 'Threat and coercive signalling', conciliation: 'Conciliation',
  grievance: 'Grievance and victimhood', escalation: 'Escalation framing', deescalation: 'De-escalation framing',
  esc_balance: 'Escalation balance',
};
export const DIM_HELP = {
  hostility: 'Share of sentences that are hostile or confrontational.',
  threat: 'Share of sentences that threaten or signal coercion.',
  conciliation: 'Share of sentences that are conciliatory or cooperative.',
  grievance: 'Share of sentences that voice grievance or victimhood (under-detected by the model).',
  escalation: 'Share of sentences that frame a conflict as escalating.',
  deescalation: 'Share of sentences that urge calm or a settlement.',
  esc_balance: 'Escalation framing minus de-escalation framing (−1 to 1).',
};
const TGT = { US: 'the U.S.', UKRAINE: 'Ukraine', NATO: 'NATO', WEST: '"the West"', ISRAEL: 'Israel', TAIWAN: 'Taiwan',
  JAPAN: 'Japan', PHILIPPINES: 'the Philippines' };
export const tgt = t => TGT[t] || t;
export const TEST = { c: 'Lead-lag correlation', e: 'Event study', d: 'Distributed lag' };

export function seriesLabel(key) {
  const p = key.split(':');
  if (p[0] === 'tone') return `${DIM[p[1]]}, all statements`;
  if (p[0] === 'sal') return `Attention to ${tgt(p[1])}`;
  return `${DIM[p[2]]} in sentences on ${tgt(p[1])}`;
}
export function seriesHelp(key) {
  const p = key.split(':');
  if (p[0] === 'tone') return DIM_HELP[p[1]] + ' Mean over documents.';
  if (p[0] === 'sal') return `Share of documents that mention ${tgt(p[1])} (self-mentions excluded).`;
  return `${DIM_HELP[p[2]]} Only sentences that mention ${tgt(p[1])}, averaged over documents that mention it. This is the tone of sentences about ${tgt(p[1])}, not necessarily tone aimed at it.`;
}
export const unitOf = key => key.startsWith('sal:') ? 'share of docs' : key.includes('esc_balance') ? 'balance' : 'mean probability';

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export function fmtP(p) {
  if (p == null || !isFinite(p)) return '–';
  if (p >= 0.01) return p.toFixed(p >= 0.1 ? 2 : 3);
  if (p >= 0.001) return p.toFixed(4);
  const e = Math.floor(Math.log10(p)), m = p / 10 ** e;
  return `${m.toFixed(1)}×10${String(e).split('').map(c => SUP[c]).join('')}`;
}
export const fmt = (v, d = 2) => v == null || !isFinite(v) ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
export const fmtN = v => v == null ? '–' : Number(v).toLocaleString('en-US');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const per = res => res === 'week' ? 'week' : 'day';
export const pers = (n, res) => `${Math.abs(n)} ${per(res)}${Math.abs(n) === 1 ? '' : 's'}`;

/** Status of one test: 'sig' (q < .05), 'nom' (used p < .05, not corrected), 'none', or 'na'. */
export function testStatus(t) {
  if (!t || t.pu == null) return 'na';
  if (t.q != null && t.q < 0.05) return 'sig';
  return t.pu < 0.05 ? 'nom' : 'none';
}

/** One-line description of what each test found, in words. */
export function testLine(code, r, res, beh) {
  const u = beh.unit;
  if (code === 'c') {
    const c = r.c, i = (c.r.length - 1) / 2 + c.k;
    return `Strongest lead: r = ${fmt(c.rk)} with rhetoric ${pers(c.k, res)} ahead (95% CI ${fmt(c.lo[i])} to ${fmt(c.hi[i])}).`;
  }
  if (code === 'e') {
    const e = r.e;
    if (e.cm == null) return e.why || 'No usable spikes.';
    return `Across ${e.n} spikes, behaviour moved ${fmt(e.cm)} ${u} from the ${pers(META_RES[res].H, res)} before the spike to the ${pers(META_RES[res].H, res)} after it (95% CI ${fmt(e.clo)} to ${fmt(e.chi)}).`;
  }
  const d = r.d;
  if (d.cum == null) return d.why || 'Model not estimable.';
  return `Lagged rhetoric terms, summed: ${fmt(d.cum)} SD of behaviour per SD of rhetoric (SE ${d.cse.toFixed(2)}); F = ${d.F}.`;
}
export let META_RES = {};
export const setMetaRes = r => { META_RES = r; };

/** Plain-language verdict for a pair. */
export function verdict(r, fam, res) {
  if (!r) return { cls: 'na', head: 'No analysis for this combination', body: 'The rhetoric and behaviour series do not overlap in this window.' };
  if (r.s !== 'ok') return { cls: 'na', head: 'Not tested', body: `${r.why[0].toUpperCase() + r.why.slice(1)}. The page shows the series but runs no test.` };
  const st = ['c', 'e', 'd'].map(k => [k, testStatus(r[k])]);
  const sig = st.filter(s => s[1] === 'sig').map(s => s[0]);
  const nom = st.filter(s => s[1] === 'nom').map(s => s[0]);
  const exp = Math.round(fam.m * 0.05);
  if (sig.length) {
    const fragile = sig.filter(k => r[k].ok === false);
    return { cls: 'sig', head: `${sig.length === 1 ? 'One test' : sig.length + ' tests'} survive${sig.length === 1 ? 's' : ''} correction`,
      body: `${sig.map(k => TEST[k]).join(' and ')} pass${sig.length === 1 ? 'es' : ''} Benjamini–Hochberg at q < 0.05 across all ${fmtN(fam.m)} tests in this view. ` +
        (fragile.length ? `The permutation or placebo check for ${fragile.map(k => TEST[k].toLowerCase()).join(' and ')} does not agree (p > 0.05): treat it as fragile. ` : '') +
        'This is a predictive association in the past record, not proof that the statements caused the behaviour. Check the pre-trend and read the spike evidence.' };
  }
  if (nom.length) return { cls: 'nom', head: 'Suggestive at most', body:
    `${nom.map(k => TEST[k]).join(' and ')} reach${nom.length === 1 ? 'es' : ''} p < 0.05 on ${nom.length === 1 ? 'its' : 'their'} own, but nothing survives correction for the ${fmtN(fam.m)} tests in this view. By chance alone about ${fmtN(exp)} of them would pass p < 0.05.` };
  return { cls: 'none', head: 'No evidence that this rhetoric leads this behaviour',
    body: 'None of the three tests reaches p < 0.05, even before correcting for multiple tests.' };
}
