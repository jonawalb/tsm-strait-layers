// "What if these cables are cut" scenarios. Landing-site losses cut every cable branch or segment at those
// towns (the node-removal exercise in Walberg, "Landing Stations as Littoral Chokepoints"); the corridor
// scenario cuts every cable whose drawn route crosses a box. Incident replays come from data/incidents.js.
import { CABLES } from '../data/cables.js';
import { INCIDENTS } from '../data/incidents.js';
import { unitsAt, unitsOfCable, UNIT } from './net.js';

// Bashi and Balintang channels between Taiwan and Luzon (lon0, lat0, lon1, lat1).
const LUZON_STRAIT = [119.8, 19.4, 122.4, 21.7];
const crosses = (c, b) => c.geom.some(s => s.some(([x, y], i) => {
  if (i === 0) return false;
  const [x0, y0] = s[i - 1];
  for (let t = 0; t <= 1; t += 0.1) {
    const px = x0 + t * (x - x0), py = y0 + t * (y - y0);
    if (px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3]) return true;
  }
  return false;
}));
export const LUZON_CABLES = CABLES.filter(c => !c.domestic && crosses(c, LUZON_STRAIT)).map(c => c.id);

const TW_DOMESTIC = ['taiwan-penghu-kinmen-matsu-no-2-tpkm2', 'taiwan-penghu-kinmen-matsu-no-3-tpkm3', 'taiwan-matsu-no-4'];
export const SCENARIOS = [
  { id: 'none', region: 'all', name: 'Everything in service', sub: 'No cuts', cut: () => [] },
  { id: 'tw-toucheng', region: 'taiwan', name: 'Lose Toucheng', sub: 'Yilan, northeast coast', view: 'taiwan',
    cut: () => unitsAt(['toucheng-taiwan']) },
  { id: 'tw-newtaipei', region: 'taiwan', name: 'Lose Tanshui and Pa Li', sub: 'New Taipei, north coast', view: 'taiwan',
    cut: () => unitsAt(['tanshui-taiwan', 'pa-li-taiwan']) },
  { id: 'tw-fangshan', region: 'taiwan', name: 'Lose Fangshan', sub: 'Pingtung, south coast', view: 'taiwan',
    cut: () => unitsAt(['fangshan-taiwan']) },
  { id: 'tw-three', region: 'taiwan', name: 'Lose all three landing areas', sub: 'Toucheng, New Taipei, Fangshan', view: 'taiwan',
    cut: () => unitsAt(['toucheng-taiwan', 'tanshui-taiwan', 'pa-li-taiwan', 'fangshan-taiwan']) },
  { id: 'tw-domestic', region: 'taiwan', name: 'Cut the outlying-island cables', sub: 'TPKM2, TPKM3, Taiwan–Matsu No. 4', view: 'outer',
    cut: () => TW_DOMESTIC.flatMap(unitsOfCable) },
  { id: 'luzon', region: 'all', name: 'Cut the Luzon Strait corridor', sub: `${LUZON_CABLES.length} systems whose drawn route crosses it`, view: 'fic',
    cut: () => LUZON_CABLES.flatMap(unitsOfCable) },
  { id: 'ry-okinawa', region: 'ryukyu', name: 'Lose Okinawa Island landings', sub: 'Naha, Itoman, Yomitan and others', view: 'ryukyu',
    cut: () => unitsAt(['naha-japan', 'yaese-japan', 'itoman-japan', 'yomitan-japan', 'komesu-japan', 'nago-japan']) },
  { id: 'ph-baler', region: 'philippines', name: 'Lose Baler', sub: 'Pacific coast of Luzon', view: 'philippines',
    cut: () => unitsAt(['baler-philippines']) },
  { id: 'ph-batangas', region: 'philippines', name: 'Lose Batangas', sub: 'South China Sea side of Luzon', view: 'philippines',
    cut: () => unitsAt(['batangas-philippines']) },
];
// Replays: incidents whose records name the units that were damaged.
for (const i of INCIDENTS.filter(i => i.cut && i.cut.length)) {
  SCENARIOS.push({ id: 'r-' + i.id, region: i.region, replay: true, name: i.title, sub: i.dateLabel, view: i.view,
    year: i.year, cut: () => i.cut.filter(u => UNIT[u]) });
}
export const SCENARIO = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));
