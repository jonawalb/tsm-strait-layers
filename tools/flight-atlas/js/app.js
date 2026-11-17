// PLA Flight-Path Atlas: state, URL hash, and wiring between map, timeline, tables and panel.
import { ALL, META, SECTORS, SECTOR_INFO, aggregate, indexOf, addMonths, nice, FLAG_RANGE } from './data.js';
import { createMap } from './map.js';
import { createTimeline } from './timeline.js';
import { drawYears, drawMonths, markWindow } from './grid.js';
import { renderDay, renderDayList } from './panel.js';
import { createTour } from './tour.js';

const $ = s => document.querySelector(s);
const N = ALL.length;
const S = { from: 0, to: N - 1, sec: null, day: null, metric: 'days', jcrpOnly: false };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function preset(p) {
  const last = ALL[N - 1].d;
  const back = { month: 1, quarter: 3, year: 12 }[p];
  S.to = N - 1;
  S.from = back ? indexOf(addMonths(last, -back)) + 1 : 0;
}
preset('year');
const latestEntry = () => [...ALL].reverse().find(d => d.mask)?.i ?? null;
S.day = latestEntry();

/* Hash state */
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('from')) S.from = indexOf(h.get('from'));
  if (h.get('to')) S.to = Math.max(S.from, indexOf(h.get('to')));
  if (SECTORS.includes(h.get('sec'))) S.sec = h.get('sec');
  if (h.get('day')) S.day = indexOf(h.get('day'));
  if (h.get('m') === 'share') S.metric = 'share';
  if (h.get('jcrp') === '1') S.jcrpOnly = true;
}
function writeHash() {
  const h = new URLSearchParams({ from: ALL[S.from].d, to: ALL[S.to].d });
  if (S.sec) h.set('sec', S.sec);
  if (S.day != null) h.set('day', ALL[S.day].d);
  if (S.metric === 'share') h.set('m', 'share');
  if (S.jcrpOnly) h.set('jcrp', '1');
  history.replaceState(null, '', '#' + h.toString());
}
readHash();

/* Tooltip */
const tip = $('#tip');
function showTip(html, e) {
  if (!html) { tip.hidden = true; return; }
  tip.innerHTML = html; tip.hidden = false;
  const box = tip.parentElement.getBoundingClientRect();
  const cx = (e.clientX ?? box.left + box.width / 2) - box.left, cy = (e.clientY ?? box.top + 40) - box.top;
  const w = tip.offsetWidth;
  tip.style.left = Math.max(4, Math.min(box.width - w - 4, cx + 12)) + 'px';
  tip.style.top = Math.max(4, cy + 14) + 'px';
}

/* Components */
let agg = aggregate(S.from, S.to);
const map = createMap($('#map'), {
  onPick: s => { S.sec = S.sec === s ? null : s; render(); },
  onHover: (s, e) => {
    if (!s) return showTip(null);
    const v = agg.sec[s];
    showTip(`<b>${SECTOR_INFO[s].name} ADIZ</b><br>${v} day${v === 1 ? '' : 's'} with a reported entry${agg.entryDays ? ` (${Math.round(100 * v / agg.entryDays)}% of entry days)` : ''}.<br><span class="muted">MND count on those days, all sectors combined: ${agg.secCount[s].toLocaleString('en-US')}</span>`, e);
  },
});
const tl = createTimeline($('#tl'), {
  onWindow: ([a, b], done) => { S.from = a; S.to = b; render(!done); },
  onDay: day => { S.day = day.i; render(); },
  onHover: (day, e) => {
    const tt = $('#tltip');
    if (!day) { tt.hidden = true; return; }
    const secs = SECTORS.filter(s => day.mask & (1 << SECTORS.indexOf(s))).map(s => SECTOR_INFO[s].name);
    tt.innerHTML = `<b>${nice(day.d)}</b>${day.jcrp ? ' <span class="pill jc">JCRP</span>' : ''}<br>${day.report
      ? `${day.total ?? '?'} aircraft · ${day.entered ?? '?'} median line/ADIZ<br>${secs.length ? secs.join(', ') : 'No sector named'}`
      : (day.daily ? 'No report in MND\'s English list' : 'No report (no SW ADIZ entry reported)')}${day.notext ? '<br>MND page has no text' : ''}${day.era === 1 ? '<br>No sector wording in this period' : ''}`;
    tt.hidden = false;
    const box = tt.parentElement.getBoundingClientRect();
    const x = e.clientX - box.left;
    tt.style.left = Math.max(4, Math.min(box.width - tt.offsetWidth - 4, x + 10)) + 'px';
    tt.style.top = '4px';
  },
});
drawYears($('#years'), { onPick: y => { S.from = y.i0; S.to = y.i1; render(); } });
drawMonths($('#months'), { onPick: m => { S.from = m.i0; S.to = m.i1; render(); $('#stage').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); } });

/* Controls */
document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { stopPlay(); preset(b.dataset.preset); render(); });
document.querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { S.metric = b.dataset.metric; render(); });
$('#jcrp').onchange = e => { S.jcrpOnly = e.target.checked; render(); };
$('#clear-sec').onclick = () => { S.sec = null; render(); };
$('#copy').onclick = () => navigator.clipboard?.writeText(location.href).then(() => { $('#copy').textContent = 'Link copied'; setTimeout(() => { $('#copy').textContent = 'Copy link'; }, 1500); });

let timer = null;
function stopPlay() { clearInterval(timer); timer = null; $('#play').textContent = 'Play'; $('#play').setAttribute('aria-pressed', 'false'); }
$('#play').onclick = () => {
  if (timer) return stopPlay();
  const len = S.to - S.from;
  if (S.to >= N - 1) { S.from = 0; S.to = len; }
  $('#play').textContent = 'Pause'; $('#play').setAttribute('aria-pressed', 'true');
  timer = setInterval(() => {
    const step = Math.max(7, Math.round(len / 3));
    if (S.to >= N - 1) return stopPlay();
    S.to = Math.min(N - 1, S.to + step); S.from = S.to - len;
    render(true);
  }, reduced ? 1200 : 450);
};

/* Render */
function render(light = false) {
  agg = aggregate(S.from, S.to, { jcrpOnly: S.jcrpOnly });
  map.update(agg, { metric: S.metric, selected: S.sec, highlight: S.day != null ? SECTORS.filter(s => ALL[S.day].mask & (1 << SECTORS.indexOf(s))) : null });
  tl.set([S.from, S.to], S.day, S.sec);
  markWindow($('#months'), S.from, S.to);
  document.querySelectorAll('[data-metric]').forEach(b => b.setAttribute('aria-pressed', b.dataset.metric === S.metric));
  $('#jcrp').checked = S.jcrpOnly;
  const a = ALL[S.from].d, b = ALL[S.to].d;
  $('#win').textContent = `${nice(a)} to ${nice(b)}`;
  const flagNote = a < FLAG_RANGE[0] ? ` <span class="muted">(flags start ${nice(FLAG_RANGE[0])})</span>` : '';
  $('#readout').innerHTML = `
    <dt>Days in window</dt><dd>${agg.days.toLocaleString('en-US')}${S.jcrpOnly ? ' JCRP days' : ''}</dd>
    <dt>MND reports</dt><dd>${agg.reports.toLocaleString('en-US')}${agg.noText ? ` <span class="muted">(${agg.noText} without text)</span>` : ''}</dd>
    <dt>Days with an ADIZ entry</dt><dd>${agg.entryDays.toLocaleString('en-US')}</dd>
    <dt>Aircraft detected</dt><dd>${agg.total.toLocaleString('en-US')}</dd>
    <dt>Median line / ADIZ count</dt><dd>${agg.entered.toLocaleString('en-US')}</dd>
    <dt>JCRP days</dt><dd>${agg.jcrp}${flagNote}</dd>`;
  const max = Math.max(1, ...SECTORS.map(s => agg.sec[s]));
  $('#seclist').innerHTML = SECTORS.map(s => `<button type="button" data-s="${s}" aria-pressed="${S.sec === s}">
      <span class="nm">${SECTOR_INFO[s].name}</span><span class="bar"><i style="width:${(100 * agg.sec[s] / max).toFixed(1)}%"></i></span>
      <span class="num">${agg.sec[s]}</span></button>`).join('');
  $('#seclist').querySelectorAll('button').forEach(btn => btn.onclick = () => { S.sec = S.sec === btn.dataset.s ? null : btn.dataset.s; render(); });
  const rare = Object.entries(agg.rare).map(([k, v]) => `${META.rare[k]} ${v}×`);
  $('#rare').textContent = rare.length ? `Also named in this window, not drawn: ${rare.join(', ')}.` : '';
  $('#clear-sec').hidden = !S.sec;
  if (!light) {
    renderDayList($('#daylist'), S, day => { S.day = day.i; render(); });
    renderDay($('#day'), S.day != null ? ALL[S.day] : null, step => {
      const list = ALL.filter(d => d.report && (!S.sec || d.mask & (1 << SECTORS.indexOf(S.sec))));
      const cur = list.findIndex(d => d.i >= S.day);
      const nx = list[Math.max(0, Math.min(list.length - 1, (cur < 0 ? list.length - 1 : cur) + step))];
      if (nx) { S.day = nx.i; render(); }
    });
  }
  writeHash();
}

/* Walkthrough */
const tour = createTour($('#stage'), set => {
  stopPlay();
  if (set.preset) preset(set.preset);
  if (set.range) { S.from = indexOf(set.range[0]); S.to = set.range[1] === 'end' ? N - 1 : indexOf(set.range[1]); }
  S.sec = set.sec; S.jcrpOnly = set.jcrpOnly; S.metric = set.metric;
  S.day = set.day === 'latest' ? latestEntry() : (set.day ? indexOf(set.day) : S.day);
  render();
  if (set.scroll) document.querySelector(set.scroll)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
});
$('#tour').onclick = () => tour.start();
$('#m-first').textContent = nice(META.first);
$('#m-last').textContent = nice(META.last);
$('#m-n').textContent = META.reports.toLocaleString('en-US');
if (META.fromCache) $('#m-cache').textContent = ` (${META.fromCache} report${META.fromCache > 1 ? 's' : ''} in this build)`;
render();
