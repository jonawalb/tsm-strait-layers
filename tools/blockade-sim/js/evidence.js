// Evidence panel: what real data says about the model's two key behaviours.
// 1. Red Sea 2023-24: how fast commercial traffic left a listed area (IMF PortWatch weekly transits).
// 2. Past PLA drills around Taiwan: Strait transits and Taiwan port calls before and during each exercise.
import { lineChart, legend } from './charts.js';
import { PORTWATCH } from '../data/portwatch.js';
import { RED_SEA_MARKS } from '../data/params.js';

const $ = id => document.getElementById(id);
const FROM = '2023-07-03', TO = '2024-12-30';

export function drawEvidence() {
  const pick = k => PORTWATCH.chokeWeekly[k].filter(r => r[0] >= FROM && r[0] <= TO);
  const bab = pick('bab'), cape = pick('cape');
  const weeks = bab.map(r => r[0]);
  const idx = date => { const i = weeks.findIndex(w => w >= date); return i < 0 ? null : i; };
  const months = weeks.map((w, i) => [i, w]).filter(([, w]) => w.slice(8, 10) <= '07' && ['01', '04', '07', '10'].includes(w.slice(5, 7)));
  const fmtW = w => new Date(w + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  lineChart($('ev-red'), {
    n: weeks.length, h: 200, yMax: 110, yTicks: [0, 25, 50, 75, 100], yFmt: v => String(v),
    xTicks: months.map(([i, w]) => [i, fmtW(w)]),
    marks: RED_SEA_MARKS.map(m => [idx(m.date), m.label]),
    series: [{ v: bab.map(r => r[1]), col: 'var(--c4)', w: 2.5 }, { v: cape.map(r => r[1]), col: 'var(--c3)', w: 2 }],
  });
  $('ev-red-legend').innerHTML = legend([{ col: 'var(--c4)', label: 'Bab el-Mandeb, transits a day' }, { col: 'var(--c3)', label: 'Cape of Good Hope, transits a day' }]);

  const rows = PORTWATCH.drills.map(d => {
    const ch = (a, b) => (a && b != null ? ((b / a - 1) * 100) : null);
    const s = ch(d.strait.pre28, d.strait.during), c = ch(d.calls.pre28, d.calls.during);
    const f = v => (v == null ? 'n/a' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`);
    const dates = d.start === d.end ? d.start : `${d.start} to ${d.end.slice(5)}`;
    return `<tr><th scope="row">${d.name}<small>${dates}</small></th>
      <td class="num">${d.strait.pre28} → ${d.strait.during}<small>${f(s)}</small></td>
      <td class="num">${d.calls.pre28} → ${d.calls.during}<small>${f(c)}</small></td></tr>`;
  }).join('');
  $('ev-drills').innerHTML = rows;
}
