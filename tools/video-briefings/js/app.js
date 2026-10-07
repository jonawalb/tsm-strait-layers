// Video Briefings: player, synced transcript with each sentence's figures, the week's data, and the archive.
import { BRIEFINGS } from '../data/briefings.js';
import { renderData } from './tables.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const SRC = { mnd: 'Taiwan MND', ccg: 'TSM CCG tracker', ex: 'TSM exercise list', tr: 'TSM transit tracker', rh: 'TSM rhetoric corpus' };
const video = $('#video');
let cur = null, urls = [], loadToken = 0;

function pick() {
  const m = location.hash.match(/w=(\d{4}-\d{2}-\d{2})/);
  return BRIEFINGS.find(b => b.id === (m && m[1])) || BRIEFINGS[0];
}

/* Files under data/ are encrypted on the published site; fetch() decrypts them (shared/js/gate.js), so
   the video, captions and poster are fetched and played from blob URLs. */
async function blobUrl(path, type) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  const u = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type }));
  urls.push(u);
  return u;
}

async function loadVideo(b) {
  const token = ++loadToken;
  urls.forEach(u => URL.revokeObjectURL(u));
  urls = [];
  video.removeAttribute('src');
  video.querySelectorAll('track').forEach(t => t.remove());
  $('#vstatus').hidden = false;
  $('#vstatus').textContent = `Loading the video (${(b.video.bytes / 1e6).toFixed(1)} MB)…`;
  try {
    const [poster, vtt] = await Promise.all([blobUrl(b.video.poster, 'image/jpeg'), blobUrl(b.video.vtt, 'text/vtt')]);
    if (token !== loadToken) return;
    video.poster = poster;
    const tr = document.createElement('track');
    Object.assign(tr, { kind: 'captions', label: 'English', srclang: 'en', src: vtt, default: true });
    video.appendChild(tr);
    const mp4 = await blobUrl(b.video.mp4, 'video/mp4');
    if (token !== loadToken) return;
    video.src = mp4;
    $('#dl-mp4').href = mp4;
    $('#dl-mp4').download = b.video.mp4.split('/').pop();
    $('#dl-vtt').href = vtt;
    $('#dl-vtt').download = b.video.vtt.split('/').pop();
    $('#vstatus').hidden = true;
  } catch (e) {
    if (token !== loadToken) return;
    $('#vstatus').textContent = 'The video could not be loaded. The transcript and data below are complete.';
    console.warn(e);
  }
}

function refText(r) {
  const v = typeof r.value === 'number' ? (Number.isInteger(r.value) ? r.value : r.value.toFixed(r.value < 1 && r.value > -1 ? 3 : 2)) : r.value;
  const isUrl = typeof r.value === 'string' && /^https?:\/\//.test(r.value);
  return `<li><span>${esc(r.label)}</span> <b class="num">${isUrl ? `<a href="${esc(r.value)}" target="_blank" rel="noopener">link</a>` : esc(v)}</b> <i>${esc(SRC[r.src] || r.src)}</i></li>`;
}

function renderTranscript(b) {
  $('#transcript').innerHTML = b.timeline.lines.map(l => `<li data-t0="${l.t0}" data-t1="${l.t1}">
    <button type="button" class="tr-line" data-seek="${l.t0}"><span class="tr-t num">${mmss(l.t0)}</span><span class="tr-x">${esc(l.text)}</span></button>
    <ul class="refs">${l.refs.map(refText).join('')}</ul></li>`).join('');
  $('#transcript').querySelectorAll('[data-seek]').forEach(btn => btn.onclick = () => {
    if (!video.src) return;
    video.currentTime = +btn.dataset.seek + 0.01;
    video.play().catch(() => {});
  });
}

function syncTranscript() {
  const t = video.currentTime;
  let active = null;
  $('#transcript').querySelectorAll(':scope > li').forEach(li => {
    const on = t >= +li.dataset.t0 - 0.2 && t < +li.dataset.t1 + 0.4;
    li.classList.toggle('on', on);
    if (on) active = li;
  });
  if (active && !video.paused) {
    const box = $('#transcript'), top = active.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 60) box.scrollTop = top - 20;
  }
}

function renderArchive() {
  $('#archive').innerHTML = BRIEFINGS.map(b => {
    const M = b.facts.metrics;
    return `<li><button type="button" class="arch-item" data-id="${b.id}" aria-current="${b === cur}">
      <span class="eyebrow">Week of ${esc(b.facts.week.start)}</span><b>${esc(b.facts.week.label)}</b>
      <span class="fine">${mmss(b.video.duration)} · ${M.air.total ?? 'n/a'} aircraft · ${M.adiz.total ?? 'n/a'} ADIZ · ${b.facts.ccg.n} CCG${b.facts.flags.some(f => f.kind === 'J') ? ' · readiness patrol' : ''}</span></button></li>`;
  }).join('');
  $('#archive').querySelectorAll('[data-id]').forEach(btn => btn.onclick = () => { location.hash = `w=${btn.dataset.id}`; });
}

function show(b) {
  cur = b;
  const F = b.facts;
  $('#vb-title').textContent = F.week.label;
  $('#vb-meta').textContent = `${mmss(b.video.duration)} · ${b.video.width}×${b.video.height} · TSM data through ${F.asOf} · rhetoric corpus through ${F.rhetoric.dataLast} · generated ${b.generated.slice(0, 10)} · voice: ${b.video.voice} (synthetic)`;
  document.querySelectorAll('.cite-week').forEach(n => { n.textContent = F.week.label; });
  document.querySelectorAll('.cite-gen').forEach(n => { n.textContent = b.generated.slice(0, 10); });
  const i = BRIEFINGS.indexOf(b);
  $('#prev').disabled = i >= BRIEFINGS.length - 1;
  $('#next').disabled = i <= 0;
  renderTranscript(b);
  renderData(F);
  renderArchive();
  loadVideo(b);
}

$('#prev').onclick = () => { const i = BRIEFINGS.indexOf(cur); if (i < BRIEFINGS.length - 1) location.hash = `w=${BRIEFINGS[i + 1].id}`; };
$('#next').onclick = () => { const i = BRIEFINGS.indexOf(cur); if (i > 0) location.hash = `w=${BRIEFINGS[i - 1].id}`; };
$('#show-refs').onchange = e => document.body.classList.toggle('hide-refs', !e.target.checked);
video.addEventListener('timeupdate', syncTranscript);
video.addEventListener('seeked', syncTranscript);
window.addEventListener('hashchange', () => { const b = pick(); if (b !== cur) show(b); });

if (BRIEFINGS.length) show(pick());
else $('#vstatus').textContent = 'No briefings have been generated yet.';
