// Sources, verification summary and gaps under the tool.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { OPEN } from './model.js';
import { SOURCES, MISSING } from '../data/sources.js';

export function renderNotes() {
  document.getElementById('sources').innerHTML = SOURCES.map(s =>
    `<li>${s.html}${s.tag ? ` <span class="pill">${s.tag}</span>` : ''}</li>`).join('');
  document.getElementById('missing').innerHTML = MISSING.map(m => `<li>${m}</li>`).join('');
  const n = { verified: 0, tsm: 0, diff: 0 };
  OPEN.forEach(c => { n[c.verify.v]++; });
  const rows = OPEN.filter(c => c.verify.v !== 'verified').sort((a, b) => a.nD - b.nD);
  document.getElementById('verify-block').innerHTML = `
    <h2 class="mt">Verification</h2>
    <p>Each case's notification date and value were checked against an official record: the DSCA announcement, the Federal Register or the Congressional Record.
    <b>${n.verified}</b> of ${OPEN.length} open cases match exactly (<span class="badge v-verified">Notification verified</span>).
    ${n.diff ? `<b>${n.diff}</b> match with a caveat (<span class="badge v-diff">Verified, with caveat</span>), listed below.` : ''}
    ${n.tsm ? `<b>${n.tsm}</b> rest on TSM's dataset alone (<span class="badge v-tsm">TSM data</span>).` : ''}
    Milestones after notification come from the sources TSM cites and were not all re-opened; each links to its source in the case card.</p>
    ${rows.length ? `<div class="tablewrap"><table class="vtable"><thead><tr><th>Case</th><th>Result</th></tr></thead><tbody>
      ${rows.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.verify.note || '')}</td></tr>`).join('')}
    </tbody></table></div>` : ''}`;
}
