// Accessible city search (combobox + listbox) over the bundled Natural Earth city list.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { CITIES } from '../data/cities.js';

const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const INDEX = CITIES.map(c => ({ c, n: fold(c[0]), a: fold(c[5] || c[0]), k: fold(c[1]) }));

export function findCities(q, max = 8) {
  const s = fold(q.trim());
  if (!s) return [];
  const [name, country] = s.split(',').map(t => t.trim());
  const hits = [];
  for (const o of INDEX) {
    if (country && !o.k.startsWith(country)) continue;
    let rank = -1;
    if (o.n === name || o.a === name) rank = 0;
    else if (o.n.startsWith(name) || o.a.startsWith(name)) rank = 1;
    else if (o.n.includes(' ' + name) || o.a.includes(' ' + name)) rank = 2;
    else if (!country && o.k.startsWith(name)) rank = 3;
    if (rank >= 0) hits.push({ rank, c: o.c });
  }
  hits.sort((a, b) => a.rank - b.rank || b.c[4] - a.c[4]);
  return hits.slice(0, max).map(h => h.c);
}

export function createSearch(input, list, onChoose) {
  let items = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; input.removeAttribute('aria-activedescendant'); };
  const render = () => {
    if (!items.length) {
      list.innerHTML = input.value.trim() ? '<li class="none" role="option" aria-disabled="true">No match in the city list. Try another spelling, or click the map.</li>' : '';
      list.hidden = !input.value.trim();
      input.setAttribute('aria-expanded', String(!list.hidden));
      return;
    }
    list.innerHTML = items.map((c, i) => `<li role="option" id="hc-opt-${i}" aria-selected="${i === active}" data-i="${i}">
      <b>${escapeHtml(c[0])}</b><span>${escapeHtml(c[1])}</span></li>`).join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', 'hc-opt-' + active);
  };
  const choose = i => { const c = items[i]; if (!c) return; input.value = c[0] + ', ' + c[1]; close(); onChoose(c); };
  input.addEventListener('input', () => { items = findCities(input.value); active = items.length ? 0 : -1; render(); });
  input.addEventListener('focus', () => { if (input.value) input.select(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < 0 && input.value.trim()) { items = findCities(input.value); active = items.length ? 0 : -1; }
      choose(active);
    } else if (e.key === 'Escape') close();
  });
  list.addEventListener('pointerdown', e => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); choose(Number(li.dataset.i)); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { set(text) { input.value = text; } };
}
