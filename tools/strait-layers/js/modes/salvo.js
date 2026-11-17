// Salvo exchange: a simplified Hughes-style salvo model for PLA shots against a defended group.
import { PLA } from '../layers.js';

export const SALVO_DEFAULTS = {
  ships: 3, vls: 40, pkc: 0.7, pkb: 0.45, shots: 2, soft: 0.2, waves: 3, stay: 2,
  n: { ascm: 24, df21: 6, df26: 4 },
};

export const SALVO_CONTROLS = [
  { k: 'ships', t: 'Escorts with interceptors', min: 1, max: 8, step: 1, f: v => v },
  { k: 'vls', t: 'Interceptors per escort', min: 8, max: 96, step: 4, f: v => v },
  { k: 'pkc', t: 'Kill chance per interceptor vs cruise', min: 0.3, max: 0.95, step: 0.05, f: v => Math.round(v * 100) + '%' },
  { k: 'pkb', t: 'Kill chance per interceptor vs ballistic', min: 0.1, max: 0.9, step: 0.05, f: v => Math.round(v * 100) + '%' },
  { k: 'shots', t: 'Interceptors fired per incoming', min: 1, max: 3, step: 1, f: v => v },
  { k: 'soft', t: 'Decoys and jamming defeat', min: 0, max: 0.6, step: 0.05, f: v => Math.round(v * 100) + '%' },
  { k: 'waves', t: 'Salvos fired', min: 1, max: 6, step: 1, f: v => v },
  { k: 'stay', t: 'Hits to put a ship out of action', min: 1, max: 4, step: 1, f: v => v },
];

const L = Object.fromEntries(PLA.map(l => [l.id, l]));

/**
 * Run successive salvos. Only layers in `cleared` (in range with a closed kill chain) fire.
 * Ballistic threats are engaged first; decoys are half as effective against them.
 * Returns expected values per wave.
 */
export function runSalvo(cfg, cleared) {
  let mag = cfg.ships * cfg.vls;
  const shooters = cleared.filter(id => cfg.n[id] > 0);
  const waves = [];
  for (let w = 0; w < cfg.waves; w++) {
    const magBefore = mag;
    const byType = shooters.map(id => ({ id, n: cfg.n[id], ballistic: !!L[id].ballistic }))
      .sort((a, b) => Number(b.ballistic) - Number(a.ballistic));
    let soft = 0, killed = 0, leaked = 0, incoming = 0;
    const parts = [];
    for (const t of byType) {
      const s = t.n * cfg.soft * (t.ballistic ? 0.5 : 1);
      const left = t.n - s;
      const engaged = Math.min(left, Math.floor(mag / cfg.shots));
      const pk = t.ballistic ? cfg.pkb : cfg.pkc;
      const k = engaged * (1 - (1 - pk) ** cfg.shots);
      mag -= engaged * cfg.shots;
      incoming += t.n; soft += s; killed += k; leaked += left - k;
      parts.push({ id: t.id, n: t.n, soft: s, killed: k, leaked: left - k });
    }
    waves.push({ incoming, soft, killed, leaked, magBefore, magAfter: mag, parts });
  }
  const hits = waves.reduce((a, w) => a + w.leaked, 0);
  return { waves, hits, shipsOut: Math.min(cfg.ships + 1, hits / cfg.stay), total: cfg.ships * cfg.vls };
}

/** Split an expected count into whole dots that sum to n. */
function dots(part) {
  const s = Math.round(part.soft), k = Math.round(part.killed);
  return { soft: s, killed: Math.min(k, part.n - s), leaked: Math.max(0, part.n - s - k) };
}

export function renderSalvo(res, cfg) {
  if (!res.waves.length || !res.waves[0].incoming) {
    return `<p class="empty">No PLA anti-ship layer can fire at the group here, so there is no salvo to defend against. Move the group closer, or switch off Blue actions in the Approach tab.</p>`;
  }
  const rows = res.waves.map((w, i) => {
    const cells = w.parts.map(p => {
      const d = dots(p);
      return `<span class="salvo-type" title="${L[p.id].name}">` +
        '<i class="m soft"></i>'.repeat(d.soft) + '<i class="m kill"></i>'.repeat(d.killed) + '<i class="m leak"></i>'.repeat(d.leaked) + '</span>';
    }).join('');
    const pct = res.total ? w.magAfter / res.total * 100 : 0;
    return `<div class="wave"><div class="wave-h"><b>Salvo ${i + 1}</b><span>${Math.round(w.incoming)} in · ${Math.round(w.leaked)} leak</span></div>
      <div class="wave-dots">${cells}</div>
      <div class="mag" title="Interceptors left"><span style="width:${pct.toFixed(1)}%"></span></div>
      <div class="fine">${Math.round(w.magAfter)} of ${res.total} interceptors left</div></div>`;
  }).join('');
  const out = res.shipsOut >= 1 ? `about <b>${res.shipsOut.toFixed(1)}</b> ships out of action` : 'no ship likely out of action';
  return `<div class="salvo-sum"><b>${res.hits.toFixed(1)}</b> expected hits after ${cfg.waves} salvo${cfg.waves > 1 ? 's' : ''}: ${out}.</div>
    <div class="legend-dots"><span><i class="m soft"></i>Decoyed</span><span><i class="m kill"></i>Intercepted</span><span><i class="m leak"></i>Leaked</span></div>
    ${rows}`;
}
