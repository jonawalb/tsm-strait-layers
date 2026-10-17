// Month by month: Figure 1 donut and Table 1 for each monthly tracker record (March 2026 onward), with a month
// navigator, wedge-to-table filtering, change summary against the previous record, and a case card.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { MONTHS, LATEST, moIndex, fmtHouse, changeSummary, srcLink } from './mdata.js';
import { createDonut } from './donut.js';
import { renderTable } from './mtable.js';
import { byKey, fmtD } from './model.js';
import { renderDetail } from './panel.js';

const $ = id => document.getElementById(id);

export function createMonthView(S, { save, showInTimeline }) {
  if (moIndex(S.month) < 0) S.month = LATEST;
  const donut = createDonut($('mv-fig'), { onWedge: id => setWedge(S.wedge === id ? null : id, id) });
  const dlg = $('mv-card'), dlgBody = $('mv-card-body');
  let lastRow = null;

  const sel = $('mv-select');
  sel.innerHTML = [...MONTHS].reverse().map(m => `<option value="${m.mo}">${m.label}</option>`).join('');
  sel.onchange = () => go(sel.value);
  const max = Math.max(...MONTHS.map(m => m.total));
  const strip = $('mv-strip');
  strip.innerHTML = MONTHS.map((m, i) => {
    const [y, mm] = m.mo.split('-');
    return `<button type="button" tabindex="-1" data-mo="${m.mo}" aria-label="${m.label}: ${fmtHouse(m.total)}"><i style="height:${Math.round(m.total / max * 100)}%"></i>${mm === '01' || !i ? `<b>${y}</b>` : ''}</button>`;
  }).join('');
  strip.querySelectorAll('button').forEach(b => b.onclick = () => go(b.dataset.mo));
  strip.addEventListener('keydown', e => {
    const to = { ArrowLeft: moIndex(S.month) - 1, ArrowRight: moIndex(S.month) + 1, Home: 0, End: MONTHS.length - 1 }[e.key];
    if (to === undefined || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    if (to >= 0 && to < MONTHS.length) go(MONTHS[to].mo);
    strip.querySelector('[aria-current="true"]').focus();
  });
  $('mv-prev').onclick = () => step(-1);
  $('mv-next').onclick = () => step(1);

  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || dlg.open) return;
    const t = e.target;
    if (t.closest && t.closest('select, input, textarea, .mv-scroll, .mv-strip, #total')) return;
    if (t !== document.body && !$('monthview').contains(t)) return;
    e.preventDefault();
    step(e.key === 'ArrowLeft' ? -1 : 1);
  });

  function step(d) {
    const i = moIndex(S.month) + d;
    if (i < 0 || i >= MONTHS.length) return;
    go(MONTHS[i].mo);
  }
  function go(mo) { S.month = mo; S.wedge = null; render(true); }
  function setWedge(w, focusId) { S.wedge = w; render(false); if (focusId) donut.focusWedge(focusId); }

  function render(announce) {
    const i = moIndex(S.month), m = MONTHS[i];
    if (S.wedge && !m.wedges.some(w => w.id === S.wedge)) S.wedge = null;
    $('mv-month').textContent = m.label;
    $('mv-prev').disabled = i === 0;
    $('mv-next').disabled = i === MONTHS.length - 1;
    $('mv-prev').setAttribute('aria-label', i ? `Previous month: ${MONTHS[i - 1].label}` : 'Previous month (none: the tracker starts in March 2026)');
    $('mv-next').setAttribute('aria-label', i < MONTHS.length - 1 ? `Next month: ${MONTHS[i + 1].label}` : 'Next month (none yet)');
    sel.value = m.mo;
    strip.querySelectorAll('button').forEach(b => {
      const on = b.dataset.mo === m.mo;
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      b.tabIndex = on ? 0 : -1;
    });
    const sum = changeSummary(i);
    $('mv-chg').textContent = sum;
    if (announce) $('mv-live').textContent = `${m.label}. ${m.rows.filter(r => !r.out).length} open cases. ${sum}`;

    donut.set(m, S.wedge, []);
    renderTable($('mv-tablebox'), i, { wedge: S.wedge });
    $('mv-tablebox').querySelectorAll('.mv-case').forEach(b => b.onclick = () => openCard(b.dataset.k, b));
    $('mv-tablebox').querySelectorAll('tr.mv-row').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('a, button')) return;
      openCard(tr.dataset.k, tr.querySelector('.mv-case'));
    }));
    const clr = $('mv-tablebox').querySelector('[data-clear]');
    if (clr) clr.onclick = () => { setWedge(null); $('mv-fig').querySelector('path')?.focus(); };

    const other = m.other.length ? `<p><b>Other FMS contract actions naming Japan this month</b> (not tied to a notified case, so not in the total):</p>
      <ul class="mv-other">${m.other.map(o => `<li>${escapeHtml(o.t)}${srcLink(o.src)}</li>`).join('')}</ul>` : '';
    $('mv-src').innerHTML = `<p>Source: TSM Japan backlog tracker, ${escapeHtml(m.label)} record, data to ${fmtD(m.end)}. Cases and values from the verified notification list (DSCA via the Wayback Machine, the Federal Register and state.gov); each development links its own source. ${m.mo < '2026-07' ? 'This record was built retrospectively on Oct. 13, 2026 from dated sources; the status column gives each case\'s month-end status line. ' : ''}${i === 0 ? 'It is the first monthly record: no monthly Japan backlog total was published before March 2026.' : ''}</p>${other}`;
    save();
  }

  function openCard(k, from) {
    const c = byKey[k];
    if (!c) return;
    lastRow = from || null;
    const m = MONTHS[moIndex(S.month)];
    const list = m.rows.map(r => byKey[r.k]).filter(Boolean);
    renderDetail(c, list, kk => openCard(kk, lastRow), dlgBody, { open: true, month: m.mo });
    $('mv-card-tl').onclick = () => { lastRow = null; dlg.close(); showInTimeline(k); };
    if (!dlg.open) dlg.showModal();
    dlgBody.scrollTop = 0;
    dlg.querySelector('.mv-x').focus();
  }
  dlg.addEventListener('close', () => { if (lastRow && document.contains(lastRow)) lastRow.focus(); });
  dlg.querySelector('.mv-x').onclick = () => dlg.close();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  render(false);
  return { render };
}
