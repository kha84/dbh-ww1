// Main menu shown when the page is opened without a game mode: the endless road (random or given seed), a duel,
// the tank range, loading a saved game. Starting a game reloads the page with the mode in the URL.
import { HULLS, TANK_TIERS, computeSpec, defaultParts } from './parts.js';
import { DEFS } from './tankdefs/index.js';
import { listSaves, deleteSave } from './save.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const go = params => { location.search = '?' + new URLSearchParams(params).toString(); };

// tanks sorted by year for the pickers
const TANKS = [...TANK_TIERS].sort((a, b) => (DEFS[a].year || 0) - (DEFS[b].year || 0));
function tankOptions(sel, withRandom = false) {
  return (withRandom ? `<option value="random">Случайный</option>` : '') +
    TANKS.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(HULLS[k].name)} (${DEFS[k].year})</option>`).join('');
}
function tankCard(k) {
  if (!HULLS[k]) return '<div class="tcard">Тип танка выбирается случайно</div>';
  const d = computeSpec(k, defaultParts(k));
  return `<div class="tcard"><b>${esc(d.name)}</b> · ${DEFS[k].year} г.<br>` +
    `${d.weight.toFixed(1)} т · ${d.power} л.с. · до ${(d.maxSpeed * 3.6).toFixed(0)} км/ч<br>` +
    `орудие ${esc(d.caliber)}, пробитие ${d.pen} мм · броня лба ${d.armor.hull.front}/${d.armor.turret.front} мм</div>`;
}

export function showMenu(root) {
  root.classList.remove('hidden');
  const main = () => {
    root.innerHTML = `
      <h1>DBH<span>-</span>WW1</h1>
      <p class="sub">ДОРОГА В БЕСКОНЕЧНОСТЬ</p>
      <div class="mbtns">
        <button data-go="road">Основная игра<small>бесконечная дорога · случайный или заданный мир</small></button>
        <button data-go="duel">Дуэль<small>свой танк против выбранных противников</small></button>
        <button data-go="range">Танкодром<small>поездить и пострелять на полигоне</small></button>
        <button data-go="load">Загрузить игру<small>${listSaves().length ? `сохранений: ${listSaves().length}` : 'сохранений нет'}</small></button>
      </div>
      <p class="hint">В игре: ESC — пауза, управление и сохранение · F5 — быстрое сохранение</p>`;
    root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => panels[b.dataset.go]());
  };
  const back = () => `<button class="back">← Назад</button>`;
  const wireBack = () => { const b = root.querySelector('.back'); if (b) b.onclick = main; };

  const panels = {
    road() {
      root.innerHTML = `<h2>Основная игра</h2>
        <div class="mrow"><label>Номер мира (seed)</label><input id="mSeed" type="number" min="1" placeholder="случайный"></div>
        <p class="note">Каждый мир — своя дорога, сёла, реки и противники. Пусто — случайный мир.</p>
        <div class="mrow"><button class="go">Начать</button>${back()}</div>`;
      root.querySelector('.go').onclick = () => {
        const v = parseInt(root.querySelector('#mSeed').value, 10);
        go({ mode: 'road', seed: v > 0 ? v : Math.floor(Math.random() * 999999) + 1 });
      };
      wireBack();
    },
    duel() {
      let n = 1;
      const foes = ['random', 'random', 'random', 'random', 'random'];
      const draw = () => {
        const mine = root.querySelector('#mTank')?.value || 't26';
        root.innerHTML = `<h2>Дуэль</h2>
          <div class="mrow"><label>Ваш танк</label><select id="mTank">${tankOptions(mine)}</select></div>
          <div id="mCard">${tankCard(mine)}</div>
          <div class="mrow"><label>Противников</label><span class="nsel">${[1, 2, 3, 4, 5].map(i => `<button data-n="${i}" class="${i === n ? 'on' : ''}">${i}</button>`).join('')}</span></div>
          ${foes.slice(0, n).map((f, i) => `<div class="mrow"><label>Противник ${i + 1}</label><select data-f="${i}">${tankOptions(f, true)}</select></div>`).join('')}
          <div class="mrow"><button class="go">В бой</button>${back()}</div>`;
        root.querySelector('#mTank').onchange = e => { root.querySelector('#mCard').innerHTML = tankCard(e.target.value); };
        root.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { n = +b.dataset.n; draw(); });
        root.querySelectorAll('[data-f]').forEach(s => s.onchange = () => { foes[+s.dataset.f] = s.value; });
        root.querySelector('.go').onclick = () => go({ mode: 'duel', tank: root.querySelector('#mTank').value, enemies: foes.slice(0, n).join(',') });
        wireBack();
      };
      draw();
    },
    range() {
      root.innerHTML = `<h2>Танкодром</h2>
        <div class="mrow"><label>Танк</label><select id="mTank">${tankOptions('bt7')}</select></div>
        <div id="mCard">${tankCard('bt7')}</div>
        <p class="note">Трамплины, горки, ров, «гребёнка», пруды, мишени, ремпункт с краном и деревня — без противника.</p>
        <div class="mrow"><button class="go">На полигон</button>${back()}</div>`;
      root.querySelector('#mTank').onchange = e => { root.querySelector('#mCard').innerHTML = tankCard(e.target.value); };
      root.querySelector('.go').onclick = () => go({ mode: 'range', tank: root.querySelector('#mTank').value });
      wireBack();
    },
    load() {
      const saves = listSaves();
      root.innerHTML = `<h2>Загрузить игру</h2>
        ${saves.length ? `<div class="slist">${saves.map(s => `<div class="sitem">
            <span><b>${esc(s.name)}</b><br><small>${new Date(s.date).toLocaleString('ru-RU')} · мир #${s.seed} · ${s.km} км · танков ${s.kills}</small></span>
            <span><button data-load="${s.id}">Загрузить</button><button data-del="${s.id}" class="del">✕</button></span></div>`).join('')}</div>`
          : '<p class="note">Сохранённых игр нет. Сохраниться можно в основной игре: ESC → «Сохранить игру» или F5.</p>'}
        <div class="mrow">${back()}</div>`;
      root.querySelectorAll('[data-load]').forEach(b => b.onclick = () => go({ load: b.dataset.load }));
      root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { deleteSave(b.dataset.del); panels.load(); });
      wireBack();
    },
  };
  main();
}
