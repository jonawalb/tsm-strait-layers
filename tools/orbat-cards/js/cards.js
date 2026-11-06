// Flip-card deck. Each card: front (identity, HQ, actions) and back (role, equipment, sources).
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { COUNTRY } from '../data/units.js';

// Stylized unit-type marks (loosely after map symbols; decorative, not doctrinal).
const EMB = {
  command: '<rect class="emb-frame" x="10" y="8" width="64" height="44" rx="2"/><path class="emb-mark" d="M42 16v28M30 22h24"/><circle class="emb-fill" cx="42" cy="16" r="3"/>',
  army: '<rect class="emb-frame" x="10" y="8" width="64" height="44" rx="2"/><path class="emb-mark" d="M10 8l64 44M74 8L10 52"/>',
  navy: '<rect class="emb-frame" x="10" y="8" width="64" height="44" rx="2"/><path class="emb-mark" d="M42 16v26M32 22h20M26 34c4 10 28 10 32 0"/>',
  air: '<rect class="emb-frame" x="10" y="8" width="64" height="44" rx="2"/><path class="emb-mark" d="M20 36c10-14 18-14 22 0c4-14 12-14 22 0"/>',
  missile: '<rect class="emb-frame" x="10" y="8" width="64" height="44" rx="2"/><path class="emb-mark" d="M26 42L56 18M46 18h10v10"/>',
  marines: '<rect class="emb-frame" x="10" y="8" width="64" height="44" rx="2"/><path class="emb-mark" d="M22 30h40M42 16v28M30 40c6 6 18 6 24 0"/>',
  garrison: '<rect class="emb-frame" x="10" y="8" width="64" height="44" rx="2"/><path class="emb-mark" d="M20 44l22-26l22 26z"/>',
};
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };

export function renderDeck(root, units, { onFlip, onShow, onCompare }) {
  root.innerHTML = units.map(u => `
    <article class="ocard k-${u.country}" role="listitem" data-id="${u.id}" aria-label="${escapeHtml(u.name)}">
      <div class="inner">
        <div class="face front">
          <p class="tag"><b>${COUNTRY[u.country].name}</b><span>${escapeHtml(u.type)}</span></p>
          <h3>${escapeHtml(u.name)}</h3>
          ${u.native ? `<p class="native">${escapeHtml(u.native)}</p>` : ''}
          <div class="emblem" aria-hidden="true"><svg viewBox="0 0 84 60">${EMB[u.kind] || EMB.garrison}</svg></div>
          <p class="hq">HQ city: <b>${escapeHtml(u.hq)}</b></p>
          <div class="row">
            <button type="button" class="btn" data-act="flip">Flip</button>
            <button type="button" class="btn" data-act="show">Show on map</button>
            <button type="button" class="btn" data-act="cmp" aria-pressed="false">Compare</button>
          </div>
        </div>
        <div class="face back">
          <p class="tag"><b>${escapeHtml(u.short)}</b><span>${escapeHtml(u.hq)}</span></p>
          <p class="lbl">Role</p>
          <p class="role">${escapeHtml(u.role)}</p>
          <p class="lbl">Main equipment</p>
          <ul class="eq">${u.equipment.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
          <p class="lbl">Sources</p>
          <ul class="srcs">${u.sources.map(s => `<li><a href="${s.u}" target="_blank" rel="noopener">${escapeHtml(s.t)}</a> <span class="fine">${host(s.u)}</span></li>`).join('')}</ul>
          <div class="row"><button type="button" class="btn" data-act="flip">Flip back</button>
            <button type="button" class="btn" data-act="show">Show on map</button></div>
        </div>
      </div>
    </article>`).join('');
  root.querySelectorAll('.ocard').forEach(card => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.act === 'flip') onFlip(id);
      if (b.dataset.act === 'show') onShow(id);
      if (b.dataset.act === 'cmp') onCompare(id);
    }));
  });
}

/** Sync visual state without re-rendering (keeps focus). */
export function syncDeck(root, { visible, flipped, sel, cmp }) {
  root.querySelectorAll('.ocard').forEach(card => {
    const id = card.dataset.id, isF = flipped.has(id);
    card.hidden = !visible.has(id);
    card.classList.toggle('flipped', isF);
    card.classList.toggle('sel', id === sel);
    card.classList.toggle('cmp', cmp.includes(id));
    // Hide the face that is turned away from assistive tech and the tab order.
    const [front, back] = card.querySelectorAll('.face');
    front.inert = isF; back.inert = !isF;
    front.setAttribute('aria-hidden', String(isF)); back.setAttribute('aria-hidden', String(!isF));
    const cb = card.querySelector('[data-act="cmp"]');
    if (cb) { cb.setAttribute('aria-pressed', String(cmp.includes(id))); cb.textContent = cmp.includes(id) ? 'Comparing' : 'Compare'; }
  });
}
