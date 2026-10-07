// Student quiz: match a unit to its region, or a highlighted HQ city to its unit.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { COUNTRY } from '../data/units.js';

const N = 10;
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export function createQuiz(box, { pool, onHighlight, onReveal }) {
  let qs = [], i = 0, score = 0, answered = false;

  function build() {
    const units = pool();
    const regions = [...new Set(units.map(u => u.region))];
    if (units.length < 4 || regions.length < 4) return [];
    return shuffle(units).slice(0, Math.min(N, units.length)).map((u, k) => {
      if (k % 2 === 0) {
        const wrong = shuffle(regions.filter(r => r !== u.region)).slice(0, 3);
        return { u, type: 'region', prompt: `Where is the headquarters of the <b>${escapeHtml(u.name)}</b>?`, sub: `${COUNTRY[u.country].name} · ${escapeHtml(u.type)}`,
          opts: shuffle([u.region, ...wrong]), right: u.region };
      }
      const others = shuffle(units.filter(o => o.id !== u.id && o.hq !== u.hq)).slice(0, 3).map(o => o.name);
      return { u, type: 'city', prompt: 'Which formation has its headquarters in the <b>highlighted city</b> on the map?', sub: 'The orange marker. Names are hidden until you answer.',
        opts: shuffle([u.name, ...others]), right: u.name };
    });
  }

  function start() { qs = build(); i = 0; score = 0; show(); }

  function show() {
    answered = false;
    if (!qs.length) {
      onHighlight(null);
      box.innerHTML = '<p class="eyebrow">Quiz</p><p>Turn on more countries to get enough cards for a quiz (at least four units in four regions).</p>';
      return;
    }
    if (i >= qs.length) return finish();
    const q = qs[i];
    onHighlight(q.type === 'city' ? q.u.id : null);
    box.innerHTML = `
      <p class="eyebrow">Quiz · question ${i + 1} of ${qs.length}</p>
      <div class="progress" aria-hidden="true"><i style="width:${i / qs.length * 100}%"></i></div>
      <p class="quiz-q">${q.prompt}</p>
      <p class="fine">${q.sub}</p>
      <div class="quiz-opts" role="group" aria-label="Answers">${q.opts.map((o, k) => `<button type="button" data-o="${escapeHtml(o)}"><span class="num">${k + 1}</span> ${escapeHtml(o)}</button>`).join('')}</div>
      <p class="fine" id="quiz-fb" aria-live="assertive"></p>
      <div class="score"><span>Score <b>${score}</b> / ${i}</span><button type="button" class="btn" id="quiz-restart">Restart</button></div>`;
    box.querySelectorAll('[data-o]').forEach(b => b.onclick = () => answer(b));
    box.querySelector('#quiz-restart').onclick = start;
    box.querySelector('[data-o]').focus({ preventScroll: true });
  }

  function answer(btn) {
    if (answered) return;
    answered = true;
    const q = qs[i], ok = btn.dataset.o === q.right;
    if (ok) score++;
    box.querySelectorAll('[data-o]').forEach(b => {
      b.disabled = true;
      if (b.dataset.o === q.right) b.classList.add('right');
      else if (b === btn) b.classList.add('wrong');
    });
    box.querySelector('#quiz-fb').innerHTML = `<b>${ok ? 'Correct.' : 'Not quite.'}</b> The ${escapeHtml(q.u.name)} is headquartered in ${escapeHtml(q.u.hq)} (${escapeHtml(q.u.region)}). ${escapeHtml(q.u.role)}`;
    box.querySelector('.score').innerHTML = `<span>Score <b>${score}</b> / ${i + 1}</span><button type="button" class="btn solid" id="quiz-next">${i === qs.length - 1 ? 'See result' : 'Next question'}</button>`;
    const nx = box.querySelector('#quiz-next');
    nx.onclick = () => { i++; show(); };
    nx.focus({ preventScroll: true });
    onReveal(q.u.id);
  }

  function finish() {
    onHighlight(null);
    const pct = Math.round(score / qs.length * 100);
    box.innerHTML = `<p class="eyebrow">Quiz complete</p>
      <p class="quiz-q">${score} of ${qs.length} correct (${pct}%)</p>
      <p class="fine">${pct >= 80 ? 'Strong grasp of who sits where.' : 'Flip through the cards on the map, then try again. Questions are drawn at random from the countries you have switched on.'}</p>
      <button type="button" class="btn solid" id="quiz-again">Play again</button>`;
    box.querySelector('#quiz-again').onclick = start;
  }

  function key(e) {
    if (!box.isConnected || answered || !qs.length || i >= qs.length) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4 && !e.target.closest('input, select, textarea')) {
      const b = box.querySelectorAll('[data-o]')[n - 1];
      if (b) answer(b);
    }
  }
  return { start, key, active: () => qs.length > 0 };
}
