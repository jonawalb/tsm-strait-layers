// Cut scenarios. Each returns the set of units to cut; some also set the year or the view.
// Historical replays map reported incidents onto TeleGeography's cable and segment names (see method notes).
import { UNITS, LP } from './network.js';
import { CABLES } from '../data/cables.js';

const MATSU = new Set(['nangan', 'beigan', 'dongyin', 'juguang']);
const isl = id => LP[id].island;
/** Units that link a group of islands to anything outside the group. */
const linksOut = group => UNITS.filter(u => u.kind === 'dom'
  ? group.has(isl(u.a)) !== group.has(isl(u.b))
  : group.has(isl(u.lp))).map(u => u.id);
const at = lps => UNITS.filter(u => lps.includes(u.lp) || (u.kind === 'dom' && (lps.includes(u.a) || lps.includes(u.b)))).map(u => u.id);
const seg = (cable, a, b) => `${cable}:${[a, b].sort().join('~')}`;
const TPE = 'trans-pacific-express-tpe-cable-system@tanshui-taiwan';
const TPKM2 = 'taiwan-penghu-kinmen-matsu-no-2-tpkm2', TPKM3 = 'taiwan-penghu-kinmen-matsu-no-3-tpkm3';

export const PRESETS = [
  { id: 'none', name: 'No cuts', sub: 'Every cable working', cut: () => [] },
  { id: 'matsu', name: 'Matsu isolation', sub: 'Cut every cable into Matsu', view: 'matsu',
    cut: () => linksOut(MATSU) },
  { id: 'north', name: 'North coast', sub: 'Tanshui and Pa Li landings', view: 'taiwan',
    cut: () => at(['tanshui-taiwan', 'pa-li-taiwan']) },
  { id: 'east', name: 'Northeast coast', sub: 'Toucheng and Wujie (Yilan)', view: 'taiwan',
    cut: () => at(['toucheng-taiwan', 'wujie-taiwan']) },
  { id: 'kinmen', name: 'Kinmen from Taiwan', sub: 'Cut Kinmen\'s domestic links', view: 'outer',
    cut: () => UNITS.filter(u => u.kind === 'dom' && (isl(u.a) === 'kinmen') !== (isl(u.b) === 'kinmen')).map(u => u.id) },
  { id: 'penghu', name: 'Penghu isolation', sub: 'Cut every cable into Penghu', view: 'outer',
    cut: () => linksOut(new Set(['penghu'])) },
  { id: 'r2023', name: 'Feb 2023 replay', sub: 'Both Matsu cables cut', view: 'matsu', year: 2023,
    cut: () => [seg(TPKM2, 'tanshui-taiwan', 'dongyin-taiwan'), seg(TPKM3, 'taoyuan-taiwan', 'nangan-taiwan')] },
  { id: 'r2025', name: 'Early 2025 replay', sub: 'TPE and Taiwan–Penghu No. 3', view: 'taiwan', year: 2025,
    cut: () => [TPE, seg(TPKM3, 'huxi-township-taiwan', 'tainan-taiwan')] },
  { id: 'nonprc', name: 'Only China left', sub: 'Cut every cable except PRC-only links', view: 'region',
    cut: () => CABLES.filter(c => !c.domestic && !c.prcOnly).flatMap(c => c.units.map(u => u.id)) },
];
// Replays reached from the incident timeline only.
export const REPLAYS = [
  { id: 'rTPE', name: 'Jan 2025: TPE damaged', view: 'taiwan', year: 2025, cut: () => [TPE] },
  { id: 'rMatsu25', name: 'Jan–Feb 2025: Matsu No. 2 and No. 3 fail', view: 'matsu', year: 2025,
    cut: () => [seg(TPKM2, 'tanshui-taiwan', 'dongyin-taiwan'), seg(TPKM3, 'taoyuan-taiwan', 'nangan-taiwan')] },
  { id: 'rPenghu', name: 'Feb 2025: Taiwan–Penghu No. 3 cut', view: 'outer', year: 2025, cut: () => [seg(TPKM3, 'huxi-township-taiwan', 'tainan-taiwan')] },
  { id: 'rOct25', name: 'Oct 2025: Matsu No. 2 damaged', view: 'matsu', year: 2025, cut: () => [seg(TPKM2, 'tanshui-taiwan', 'dongyin-taiwan')] },
  { id: 'rMar26', name: 'Mar 2026: Matsu No. 3 Dongyin–Beigan damaged', view: 'matsu', year: 2026, cut: () => [seg(TPKM3, 'beigan-taiwan', 'dongyin-taiwan')] },
  { id: 'rApr26', name: 'Apr 2026: Matsu No. 3 Dongyin–Beigan broken', view: 'matsu', year: 2026, cut: () => [seg(TPKM3, 'beigan-taiwan', 'dongyin-taiwan')] },
];
export const PRESET = Object.fromEntries([...PRESETS, ...REPLAYS].map(p => [p.id, p]));
