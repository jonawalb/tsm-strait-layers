// Side panel: global overview and the per-country dossier.
import { COUNTRIES, META } from '../data/countries.js';
import { ARTICLES } from '../data/articles.js';
import { IMAGERY } from '../data/imagery.js';
import { METRICS, usd, bin, binColor, briStatus, sectorName, sectorColor, escapeHtml as h, pct } from './fmt.js';

const AIDDATA_REC = (id) => `https://china.aiddata.org/projects/${id}`;

function ranked(metric) {
  return Object.entries(COUNTRIES)
    .map(([iso, c]) => [iso, METRICS[metric].value(c)])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
}

function yearBars(vals, y0) {
  const w = 320, hh = 96, pad = 16, n = vals.length, bw = (w - 8) / n;
  const max = Math.max(...vals, 1);
  const peak = vals.indexOf(Math.max(...vals));
  const desc = vals.map((v, i) => (v > 0 ? `${y0 + i}: ${usd(v)}` : null)).filter(Boolean).join('; ');
  let s = `<svg class="bars" viewBox="0 0 ${w} ${hh}" role="img" aria-label="Amount by year, ${y0} to ${y0 + n - 1}. ${desc || 'No amounts recorded'}">`;
  vals.forEach((v, i) => {
    const bh = ((hh - pad - 12) * v) / max;
    s += `<rect x="${4 + i * bw + 1}" y="${hh - pad - bh}" width="${Math.max(1, bw - 2)}" height="${bh}"><title>${y0 + i}: ${usd(v)}</title></rect>`;
  });
  s += `<text x="4" y="${hh - 3}">${y0}</text><text x="${w - 4}" y="${hh - 3}" text-anchor="end">${y0 + n - 1}</text>`;
  if (vals[peak] > 0) s += `<text x="${Math.min(w - 60, Math.max(30, 4 + peak * bw))}" y="10" text-anchor="middle">peak ${y0 + peak}: ${usd(vals[peak])}</text>`;
  return s + '</svg>';
}

function hbars(rows, total) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return `<div class="hbars">${rows.map(([k, v]) => `<div class="row"><div class="lab" title="${h(k)}"><b style="width:${(100 * v) / max}%"></b><span>${h(k)}</span></div><span class="num">${total ? pct(v, total) + '%' : usd(v)}</span></div>`).join('')}</div>`;
}

function summary(iso, name, c) {
  const out = [];
  const ad = c?.ad, ae = c?.aei;
  if (ad) {
    const peakI = ad.yrs.indexOf(Math.max(...ad.yrs));
    out.push(`From 2000 to 2021, Chinese state lenders and donors committed <b>${usd(ad.t)}</b> to ${h(name)} across ${ad.n} projects, ${pct(ad.loan, ad.t)}% of it as loans.`);
    if (ad.sec[0]) out.push(`${h(ad.sec[0][0])} took the largest share (${pct(ad.sec[0][1], ad.t)}%), and commitments peaked in ${2000 + peakI}.`);
    if (ad.fin[0]) out.push(`The largest ${ad.fin[0][0].includes(' + ') ? 'co-financing group was' : 'lender or donor was'} ${h(ad.fin[0][0])} (${usd(ad.fin[0][1])}).`);
  }
  if (ae) {
    out.push(`AEI recorded ${usd(ae.i)} in Chinese investment and ${usd(ae.c)} in construction contracts in ${h(name)} from 2005 to 2023 (${ae.n} deals of $100 million or more)${ae.sec[0] ? `, led by ${h(ae.sec[0][0].toLowerCase())}` : ''}.`);
  }
  if (!ad && !ae) out.push(`Neither dataset records Chinese state lending or a large Chinese investment in ${h(name)}.`);
  return out.join(' ');
}

function sourceLinks(src) {
  return src.map((s) => {
    let label = s.p || (() => { try { return new URL(s.u).hostname.replace(/^www\./, ''); } catch { return 'source'; } })();
    label = label.length > 38 ? label.slice(0, 36) + '…' : label;
    const title = h(s.t || s.u);
    if (s.ok === false && s.wb) return `<a href="${h(s.wb)}" title="${title} (original link is dead; archived copy)" rel="noopener" target="_blank">${h(label)} (archived)</a>`;
    if (s.ok === false) return `<span class="dead" title="${title}: link no longer works and no archived copy was found">${h(label)}<span class="sr-only"> (dead link)</span></span>`;
    return `<a href="${h(s.u)}" title="${title}" rel="noopener" target="_blank">${h(label)}</a>`;
  }).join('');
}

function projectItem(p) {
  const bits = [p.y ?? 'year n/a', usd(p.a), p.f, p.st].filter(Boolean).map(h).join(' · ');
  return `<li data-id="${p.id}"><span class="pt-t">${h(p.ti)}</span>`
    + `<span class="meta">${bits}</span>`
    + `<span class="meta"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sectorColor(p.s)}"></i> ${h(sectorName(p.s))}${p.fa ? ' · ' + h(p.fa.split('|').map((x) => x.trim()).filter(Boolean).join(', ')) : ''}${p.ag ? '' : ' · not counted in totals'}</span>`
    + `<span class="links">${sourceLinks(p.src || [])}<a href="${AIDDATA_REC(p.id)}" rel="noopener" target="_blank">AidData record</a>${p.ll ? `<button type="button" class="linkish" data-show="${p.id}">show on map</button>` : ''}${p.ll ? `<button type="button" class="linkish" data-sat="${p.id}">${Object.hasOwn(IMAGERY, p.id) ? 'satellite view (reviewed)' : 'satellite view'}</button>` : ''}</span></li>`;
}

export function renderOverview(el, metric, { onPick, name, onSat }) {
  const r = ranked(metric);
  const signed = Object.values(COUNTRIES).filter((c) => c.bri && !c.bri.x).length;
  const m = METRICS[metric];
  el.innerHTML = `
    <div class="sec">
      <p class="eyebrow">Belt and Road Initiative Tracker</p>
      <h2 tabindex="-1">China's money abroad</h2>
      <p class="summary">Chinese state banks lent or granted <b>${usd(META.gcdfTotal * 1000)}</b> to low- and middle-income countries from 2000 to 2021, and Chinese firms put <b>${usd(META.aeiTotals.i + META.aeiTotals.c)}</b> into large investments and construction contracts worldwide from 2005 to 2023. ${signed} countries, China included, are on record as BRI signatories that have not left. Click any country for its dossier.</p>
      <div class="stats">
        <div class="stat${metric === 'ad' ? ' on' : ''}"><span class="v">${usd(META.gcdfTotal * 1000)}</span><span class="l">State lending &amp; grants, 2000–21 (AidData, 2021 USD)</span></div>
        <div class="stat${metric === 'aei' ? ' on' : ''}"><span class="v">${usd(META.aeiTotals.i + META.aeiTotals.c)}</span><span class="l">Investment ${usd(META.aeiTotals.i)} + construction ${usd(META.aeiTotals.c)}, 2005–23 (AEI)</span></div>
      </div>
    </div>
    <div class="sec">
      <h3>Largest recipients: ${h(m.label.toLowerCase())}, ${m.span}</h3>
      <ol class="rank">${r.slice(0, 15).map(([iso, v]) => `<li><button type="button" data-iso="${iso}"><span><i class="sw" style="background:${binColor(bin(v))}"></i>${h(name(iso))}</span><span class="num">${usd(v)}</span></button></li>`).join('')}</ol>
      <p class="note">${r.length} countries have a recorded amount under this measure. AEI's ranking includes rich countries such as the United States and Australia, which AidData does not cover.</p>
    </div>
    ${Object.keys(IMAGERY).length ? `<div class="sec">
      <h3>Seen from orbit</h3>
      <p class="note">Before-and-after satellite views of ${Object.keys(IMAGERY).length} large projects. The diamonds on the map open them too.</p>
      <ul class="satlist">${Object.values(IMAGERY).sort((a, b) => name(a.iso).localeCompare(name(b.iso))).map((x) => `<li><button type="button" class="linkish" data-sat="${x.id}">${h(x.site || 'Project site')}</button> <span class="meta">${h(name(x.iso))} · ${h(x.before.date.slice(0, 4))} vs ${h(x.after.date.slice(0, 4))}</span></li>`).join('')}</ul>
    </div>` : ''}`;
  el.querySelectorAll('[data-iso]').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.iso)));
  el.querySelectorAll('[data-sat]').forEach((b) => b.addEventListener('click', () => onSat(+b.dataset.sat)));
}

export function renderCountry(el, iso, metric, projects, { name, onBack, onShow, onSat }) {
  const c = COUNTRIES[iso];
  const nm = name(iso);
  if (iso === 'CHN') {
    el.innerHTML = `<div class="sec"><button type="button" class="btn back">← All countries</button><h2 tabindex="-1">China</h2><span class="badge on">Founder of the BRI, 2013</span>
      <p class="summary">China is the source of every flow on this map, so it is shaded darkest. The BRI was announced in Kazakhstan and Indonesia in the autumn of 2013. Pick another country to see what Chinese lenders, donors and companies committed there.</p></div>`;
    el.querySelector('.back').addEventListener('click', onBack);
    return;
  }
  const st = briStatus(c);
  const ad = c?.ad, ae = c?.aei;
  const rk = (m) => { const r = ranked(m); const i = r.findIndex(([x]) => x === iso); return i < 0 ? '' : `rank ${i + 1} of ${r.length}`; };
  const yrs = metric === 'aei' ? (ae ? [ae.yrs, 2005] : null) : (ad ? [ad.yrs, 2000] : null);
  const arts = Object.hasOwn(ARTICLES, iso) ? ARTICLES[iso] : [];
  const agg = (projects || []).filter((p) => p.ag && p.a > 0).sort((a, b) => b.a - a.a);
  const top = agg.slice(0, 15);
  const mapped = (projects || []).filter((p) => p.ll && p.a > 0).length;
  const sats = Object.values(IMAGERY).filter((x) => x.iso === iso);
  el.innerHTML = `
    <div class="sec">
      <button type="button" class="btn back">← All countries</button>
      <h2 tabindex="-1">${h(nm)}</h2>
      <span class="badge ${st.k}">${h(st.text)}</span>
      <p class="summary">${summary(iso, nm, c)}</p>
      <div class="stats">
        <div class="stat${metric === 'ad' ? ' on' : ''}"><span class="v">${ad ? usd(ad.t) : '–'}</span><span class="l">State lending &amp; grants, 2000–21</span><span class="d">${ad ? `${usd(ad.loan)} loans · ${usd(ad.grant)} grants<br>${ad.n} projects · ${rk('ad')}` : 'not covered or none recorded'}</span></div>
        <div class="stat${metric === 'aei' ? ' on' : ''}"><span class="v">${ae ? usd(ae.i + ae.c) : '–'}</span><span class="l">Investment &amp; construction, 2005–23</span><span class="d">${ae ? `${usd(ae.i)} invest · ${usd(ae.c)} build<br>${ae.n} deals · ${rk('aei')}` : 'no deal of $100m+ recorded'}</span></div>
      </div>
      ${ad?.distress ? `<p class="note">AidData flags ${ad.distress} of these projects as linked to financial distress (missed payments, restructuring or arrears).</p>` : ''}
    </div>
    ${sats.length ? `<div class="sec"><h3>Seen from orbit</h3><ul class="satlist">${sats.map((x) => `<li><button type="button" class="linkish" data-sat="${x.id}">${h(x.site || 'Project site')}</button> <span class="meta">${h(name(x.iso))} · ${h(x.before.date.slice(0, 4))} vs ${h(x.after.date.slice(0, 4))}</span></li>`).join('')}</ul></div>` : ''}
    ${yrs ? `<div class="sec"><h3>By year: ${h(METRICS[metric].label.toLowerCase())}</h3>${yearBars(yrs[0], yrs[1])}</div>` : ''}
    ${ad || ae ? `<div class="sec"><h3>Where the money went</h3>
      ${ad ? `<p class="note">State lending &amp; grants by sector (share of ${usd(ad.t)})</p>${hbars(ad.sec, ad.t)}` : ''}
      ${ad?.fin.length ? `<p class="note">Largest Chinese lenders and donors (names joined by + co-financed together)</p>${hbars(ad.fin)}` : ''}
      ${ae ? `<p class="note">Investment &amp; construction by sector (share of ${usd(ae.i + ae.c)})</p>${hbars(ae.sec, ae.i + ae.c)}` : ''}
    </div>` : ''}
    ${arts.length ? `<div class="sec"><h3>Recent reporting, 2022 onward</h3><ul class="arts">${arts.map((a) => `<li><a href="${h(a.url)}" rel="noopener" target="_blank">${h(a.title)}</a>${a.wayback ? ` (<a href="${h(a.wayback)}" rel="noopener" target="_blank">archived</a>)` : ''}<br><span class="meta">${h(a.publisher)} · ${h(a.date)}</span><br>${h(a.summary)}</li>`).join('')}</ul></div>` : ''}
    ${top.length ? `<div class="sec"><h3>Largest projects</h3><p class="note">${mapped} of ${projects.length} projects have a mapped location and appear as circles sized by value. Source links are the ones AidData cited.</p><ul class="projects">${top.map(projectItem).join('')}</ul>
      ${projects.length > top.length ? `<details class="allp"><summary>All ${projects.length} recorded projects</summary><input type="search" placeholder="Filter by word, sector or year" aria-label="Filter projects"><ul class="projects" id="allp-list"></ul></details>` : ''}
    </div>` : ''}`;
  el.querySelector('.back').addEventListener('click', onBack);
  const wire = (root) => {
    root.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => onShow(+b.dataset.show)));
    root.querySelectorAll('[data-sat]').forEach((b) => b.addEventListener('click', () => onSat(+b.dataset.sat)));
  };
  wire(el);
  const det = el.querySelector('.allp');
  if (det) {
    const list = det.querySelector('#allp-list');
    const all = [...projects].sort((a, b) => (b.a || 0) - (a.a || 0));
    const draw = (q) => {
      const t = q.trim().toLowerCase();
      const rows = t ? all.filter((p) => `${p.ti} ${sectorName(p.s)} ${p.y} ${p.fa} ${p.st}`.toLowerCase().includes(t)) : all;
      list.innerHTML = rows.slice(0, 300).map(projectItem).join('') + (rows.length > 300 ? `<li class="note">Showing 300 of ${rows.length}; filter to narrow.</li>` : '');
      wire(list);
    };
    det.addEventListener('toggle', () => { if (det.open && !list.childElementCount) draw(''); }, { once: false });
    det.querySelector('input').addEventListener('input', (e) => draw(e.target.value));
  }
}

export function markProject(el, id) {
  el.querySelectorAll('.projects li').forEach((li) => li.classList.toggle('sel', +li.dataset.id === id));
  const li = el.querySelector(`.projects li[data-id="${id}"]`);
  if (li) li.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
