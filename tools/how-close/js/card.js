// Result card, detail readout, distance scale, and a downloadable PNG version of the card.
import { el, fmt, escapeHtml } from '../../../shared/js/mapkit.js';
import { STRAIT_KM, JET_KMH, CLASSES, fmtHours, makeProjection, greatCircle, TAIPEI } from './geo.js';
import { LAND, CHN, TWN } from '../data/world.js';

const mi = km => fmt(km * 0.621371);

export function cardText(pt, s, pair) {
  const place = pt.custom ? pt.name : `${pt.name}, ${pt.country}`;
  let lead;
  if (pt.country === 'Taiwan' && !pt.custom) lead = `${escapeHtml(pt.name)} is in Taiwan. Pingtan Island, Fujian, the part of the PRC closest to Taiwan, is <b>${fmt(s.toPingtan)} km</b> away.`;
  else if (s.inside) lead = `${escapeHtml(place)} is inside the People's Republic of China.`;
  else lead = `The nearest point of the People's Republic of China is <b>${fmt(s.prc.km)} km</b> away${s.prcNear && s.prcNear.km < 150 ? `, near ${escapeHtml(s.prcNear.city[0])}` : ''}.`;
  const cmp = pair
    ? `At its narrowest, from Pingtan Island to Taiwan, the Taiwan Strait is about ${STRAIT_KM} km wide. That is about the distance from <b>${escapeHtml(pair.a[0])}</b> to <b>${escapeHtml(pair.b[0])}</b>${pair.a[1] !== pair.b[1] ? '' : ''} (${fmt(pair.d)} km).`
    : `At its narrowest, from Pingtan Island to Taiwan, the Taiwan Strait is about ${STRAIT_KM} km wide.`;
  return { place, lead, cmp };
}

export function renderCard(root, pt, s, pair) {
  const t = cardText(pt, s, pair);
  root.innerHTML = `
    <p class="eyebrow">How close is China?</p>
    <h2 class="hc-place">${escapeHtml(t.place)}</h2>
    <div class="hc-big"><span class="num">${fmt(s.toTaipei)}</span><small>km to Taipei</small></div>
    <p class="hc-sub num">${mi(s.toTaipei)} miles · ${fmt(s.toTaipei / 1.852)} nautical miles · great-circle distance</p>
    <p class="hc-line">${t.lead}</p>
    <p class="hc-line">${t.cmp}</p>
    <p class="hc-line">An airliner at about ${JET_KMH} km/h <span class="notional">notional</span> would need <b>${fmtHours(s.jetH)}</b> to reach Taipei. Crossing the Strait at its narrowest takes it about ${fmtHours(STRAIT_KM / JET_KMH)}.</p>`;
}

export function renderDetails(dl, pt, s) {
  const rows = [
    ['To Taipei', `${fmt(s.toTaipei)} km · ${mi(s.toTaipei)} mi`],
    ['To Pingtan (Fujian)', `${fmt(s.toPingtan)} km · ${mi(s.toPingtan)} mi`],
    ['Nearest PRC territory', s.inside ? 'inside the PRC' : `${fmt(s.prc.km)} km · ${mi(s.prc.km)} mi`],
    ['Strait widths', `${s.ratio < 10 ? s.ratio.toFixed(1) : fmt(s.ratio)} × the ${STRAIT_KM} km Strait`],
    ['By airliner*', fmtHours(s.jetH)],
    ['By ship at 14 kn*', `${(s.toTaipei / 1.852 / 14 / 24).toFixed(1)} days (straight line)`],
    ['Position', `${Math.abs(pt.lat).toFixed(2)}°${pt.lat < 0 ? 'S' : 'N'} ${Math.abs(pt.lon).toFixed(2)}°${pt.lon < 0 ? 'W' : 'E'}`],
  ];
  dl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

/** Log-scale distance strip with ballistic-missile range classes as background bands. */
export function renderScale(svg, s, pt) {
  const W = 340, H = 92, x0 = 8, x1 = W - 8, lo = Math.log10(50), hi = Math.log10(20100);
  const X = km => x0 + (Math.log10(Math.max(50, Math.min(20100, km))) - lo) / (hi - lo) * (x1 - x0);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  CLASSES.forEach((c, i) => {
    const a = X(Math.max(50, c.lo)), b = X(c.hi);
    el('rect', { x: a, y: 26, width: b - a, height: 22, class: 'hc-band hc-band-' + i }, svg);
    el('text', { x: (a + b) / 2, y: 41, class: 'hc-band-t', 'text-anchor': 'middle' }, svg, c.id);
  });
  [100, 1000, 10000].forEach(km => {
    el('line', { x1: X(km), x2: X(km), y1: 48, y2: 53, class: 'hc-tick' }, svg);
    el('text', { x: X(km), y: 63, class: 'hc-tick-t', 'text-anchor': 'middle' }, svg, fmt(km) + ' km');
  });
  const mark = (km, label, cls, up) => {
    const x = X(km);
    el('line', { x1: x, x2: x, y1: up ? 12 : 26, y2: up ? 48 : 74, class: 'hc-mark ' + cls }, svg);
    const anchor = x > W * 0.72 ? 'end' : x < W * 0.28 ? 'start' : 'middle';
    el('text', { x, y: up ? 9 : 86, class: 'hc-mark-t ' + cls, 'text-anchor': anchor }, svg, label);
  };
  mark(STRAIT_KM, `Taiwan Strait ${STRAIT_KM} km`, 'm-strait', true);
  mark(s.toTaipei, `${pt.name} to Taipei`, 'm-you', false);
}

/** Draw the card as a 1200×630 PNG and trigger a download. */
export async function downloadPNG(pt, s, pair) {
  const cv = await drawCard(pt, s, pair);
  const a = document.createElement('a');
  a.download = `how-close-${pt.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
}

export async function drawCard(pt, s, pair) {
  await document.fonts?.ready;
  const cv = document.createElement('canvas');
  cv.width = 1200; cv.height = 630;
  const g = cv.getContext('2d');
  const css = getComputedStyle(document.documentElement), tok = n => css.getPropertyValue(n).trim();
  g.fillStyle = tok('--panel'); g.fillRect(0, 0, 1200, 630);
  // Mini map on the right
  const P = makeProjection(1000), gc = greatCircle([pt.lon, pt.lat], TAIPEI).map(q => P.project(q));
  const xs = gc.map(q => q[0]), ys = gc.map(q => q[1]);
  const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
  const sx = spanX > 500 ? 0.54 : Math.min(8, 400 / Math.max(spanX, 1), 380 / Math.max(spanY, 1));
  const [cx, cy] = P.project([pt.lon, pt.lat]), [tx, ty] = P.project(TAIPEI);
  const ox = 890 - (spanX > 500 ? 500 : (Math.max(...xs) + Math.min(...xs)) / 2) * sx;
  const oy = 315 - (spanX > 500 ? 250 : (Math.max(...ys) + Math.min(...ys)) / 2) * sx;
  g.save(); g.beginPath(); g.rect(620, 40, 540, 550); g.clip();
  g.fillStyle = tok('--sea'); g.fillRect(620, 40, 540, 550);
  const draw = (rings, fill) => { g.fillStyle = fill; rings.forEach(r => { g.beginPath(); r.forEach((q, i) => { const [x, y] = P.project(q); g[i ? 'lineTo' : 'moveTo'](ox + x * sx, oy + y * sx); }); g.closePath(); g.fill(); }); };
  draw(LAND, tok('--land')); draw(CHN, tok('--prc') + '33'); draw(TWN, tok('--roc'));
  g.strokeStyle = tok('--accent'); g.lineWidth = 4; g.beginPath();
  let prev = null;
  gc.forEach(([x, y]) => { if (!prev || Math.abs(x - prev) > 500) g.moveTo(ox + x * sx, oy + y * sx); else g.lineTo(ox + x * sx, oy + y * sx); prev = x; });
  g.stroke();
  [[cx, cy, tok('--accent')], [tx, ty, tok('--roc')]].forEach(([x, y, c]) => { g.fillStyle = c; g.beginPath(); g.arc(ox + x * sx, oy + y * sx, 8, 0, 7); g.fill(); });
  g.restore();
  // Text on the left
  const t = cardText(pt, s, pair), strip = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
  g.fillStyle = tok('--accent'); g.fillRect(40, 40, 8, 550);
  g.fillStyle = tok('--muted'); g.font = '600 22px "Zilla Slab", Georgia, serif'; g.fillText('HOW CLOSE IS CHINA?', 72, 82);
  g.fillStyle = tok('--ink'); g.font = '700 40px "Zilla Slab", Georgia, serif'; wrap(g, t.place, 72, 132, 520, 44, 2);
  g.font = '700 118px "Zilla Slab", Georgia, serif'; g.fillStyle = tok('--brand-ink'); g.fillText(fmt(s.toTaipei), 72, 290);
  const w = g.measureText(fmt(s.toTaipei)).width;
  g.font = '500 30px "IBM Plex Sans", Arial, sans-serif'; g.fillStyle = tok('--muted'); g.fillText('km to Taipei', 84 + w, 290);
  g.font = '400 24px "IBM Plex Sans", Arial, sans-serif'; g.fillStyle = tok('--ink');
  let y = wrap(g, strip(t.lead), 72, 350, 520, 32, 3) + 14;
  wrap(g, strip(t.cmp), 72, y, 520, 32, 4);
  g.font = '500 18px "IBM Plex Sans", Arial, sans-serif'; g.fillStyle = tok('--muted');
  g.fillText('Taiwan Security Monitor · George Mason University', 72, 578);
  return cv;
}

function wrap(g, text, x, y, maxW, lh, maxLines) {
  const words = text.split(' ');
  let line = '', n = 0;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) {
      if (++n >= maxLines) return y;
      g.fillText(line, x, y); y += lh; line = w;
    } else line = t;
  }
  if (line) { g.fillText(line, x, y); y += lh; }
  return y;
}
