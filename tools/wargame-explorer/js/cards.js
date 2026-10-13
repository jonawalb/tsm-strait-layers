// Study cards (one per published game) and the agree/disagree panel.
import { FORMATS, SCENARIOS } from '../data/games.js';
import { SOURCES } from '../data/sources.js';
import { AGREE, DISAGREE } from '../data/findings.js';
import { esc, cites, fmtDate, gameById } from './util.js';

function card(g, open) {
  const pills = [FORMATS[g.format], `${g.iterations} ${g.iterations === 1 ? 'run' : 'runs'}`, `Set in ${g.setIn}`,
    ...g.scenarios.map(s => SCENARIOS[s])].map(t => `<span class="pill">${esc(t)}</span>`).join('');
  const li = list => list.map(x => `<li>${esc(x.t)} <span class="cites">${cites(x.c)}</span></li>`).join('');
  return `<article class="gcard${open ? ' open' : ''}" id="g-${g.id}" data-game="${g.id}" tabindex="-1">
    <header>
      <p class="gk">${esc(g.sponsor)} · ${esc(fmtDate(g.date))}</p>
      <h3>${esc(g.title)}</h3>
      <p class="ga">${esc(g.authors)}</p>
      <p class="pills">${pills}<span class="pill ok" title="Every figure on this card was read in the cited source">Verified</span></p>
    </header>
    <h4>Headline outcomes</h4><ul class="gl">${li(g.outcomes)}</ul>
    <details${open ? ' open' : ''}><summary>Method and assumptions</summary>
      <ul class="gl">${li(g.method)}</ul>
      <dl class="ass">${g.assumptions.map(a => `<dt>${esc(a.k)}</dt><dd>${esc(a.v)} <span class="cites">${cites(a.c)}</span></dd>`).join('')}</dl>
      ${g.notes.length ? `<h4>Notes</h4><ul class="gl">${li(g.notes)}</ul>` : ''}
    </details>
    <footer><h4>Sources</h4><ul class="gs">${g.sources.map(k =>
      `<li><a href="${esc(SOURCES[k].url)}" target="_blank" rel="noopener">${esc(SOURCES[k].label)}</a></li>`).join('')}</ul></footer>
  </article>`;
}

export function renderCards(el, games, st, on) {
  el.innerHTML = games.length ? games.map(g => card(g, g.id === st.open)).join('') : '<p class="fine">No studies match these filters.</p>';
  el.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => {
    const id = d.closest('.gcard').dataset.game;
    if (d.open && st.open !== id) on.open(id, false);
    if (!d.open && st.open === id) on.open('', false);
  }));
}

function point(p, vis) {
  const dim = !p.games.some(id => vis.has(id));
  const tags = p.games.map(id => `<span class="gt">${esc(gameById(id).short)}</span>`).join('');
  return `<li class="${dim ? 'dim' : ''}"><b>${esc(p.h)}</b><p>${esc(p.t)}</p><p class="gts">${tags}</p><span class="cites">${cites(p.c)}</span></li>`;
}

/** Agree/disagree lists; points whose studies are all filtered out are dimmed, not hidden. */
export function renderFindings(elA, elD, visibleGames) {
  const vis = new Set(visibleGames.map(g => g.id));
  elA.innerHTML = AGREE.map(p => point(p, vis)).join('');
  elD.innerHTML = DISAGREE.map(p => point(p, vis)).join('');
}
