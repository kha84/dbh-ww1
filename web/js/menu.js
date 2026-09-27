// Main menu shown when the page is opened without a game mode: the endless road (random or given seed), a duel,
// the tank range, loading a saved game. Starting a game reloads the page with the mode in the URL.
import { HULLS, TANK_TIERS, APC_TIERS, computeSpec, defaultParts } from './parts.js';
import { WEAPONS } from './weapons.js';
import { DEFS } from './tankdefs/index.js';
import { listSaves, deleteSave } from './save.js';
import { Signal, unpack, isRoomCode, NET_KEY } from './net.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const go = params => { location.search = '?' + new URLSearchParams(params).toString(); };

// tanks in the order they appeared (TANK_TIERS is sorted by year)
const TANKS = TANK_TIERS;
function tankOptions(sel, withRandom = false) {
  const opt = k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(HULLS[k].name)} (${DEFS[k].year})</option>`;
  return (withRandom ? `<option value="random">Случайный</option>` : '') +
    `<optgroup label="Танки">${TANKS.map(opt).join('')}</optgroup>` +
    `<optgroup label="Бронетранспортёры">${APC_TIERS.map(opt).join('')}</optgroup>`;
}
function tankCard(k) {
  if (!HULLS[k]) return '<div class="tcard">Тип танка выбирается случайно</div>';
  const d = computeSpec(k, defaultParts(k));
  if (d.apc) {
    return `<div class="tcard"><b>${esc(d.name)}</b> · бронетранспортёр · ${DEFS[k].year} г.<br>` +
      `${d.weight.toFixed(1)} т · ${d.power} л.с. · до ${(d.maxSpeed * 3.6).toFixed(0)} км/ч · ${d.wheeled ? 'колёсный' : 'гусеничный'}<br>` +
      `пулемёт ${esc(WEAPONS[DEFS[k].mg].name)} · десант ${(HULLS[k].troops || []).length} мест · броня лба ${d.armor.hull.front} мм</div>`;
  }
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
        <button data-go="net">Сетевая игра<small>вдвоём в одном мире: создать игру или присоединиться по коду</small></button>
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
    net() {
      root.innerHTML = `<h2>Сетевая игра</h2>
        <p class="note">Два игрока в одном мире. Хозяин игры ведёт мир (противник, трофеи), второй присоединяется по коду.
          Игра через <b>server.py</b> — хватает короткого кода комнаты; с любым другим сервером хозяин передаёт
          код-приглашение, а второй игрок возвращает ему код ответа (например, через мессенджер).</p>
        <h3>Создать игру</h3>
        <div class="mrow"><label>Режим</label><select id="nMode">
          <option value="road">Дорога — вдвоём против всех</option><option value="duel">Дуэль — вдвоём против танков</option>
          <option value="range">Танкодром</option></select></div>
        <div class="mrow" id="nSeedRow"><label>Номер мира</label><input id="nSeed" type="number" min="1" placeholder="случайный"></div>
        <div class="mrow" id="nTankRow"><label>Ваша машина</label><select id="nTank">${tankOptions('t26')}</select></div>
        <div class="mrow" id="nFoesRow"><label>Противников</label><select id="nFoes">${[1, 2, 3, 4, 5].map(i => `<option ${i === 3 ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
        <div class="mrow"><button class="go" id="nHost">Создать</button></div>
        <h3>Присоединиться</h3>
        <div class="mrow"><label>Код</label><input id="nCode" placeholder="код комнаты или код-приглашение"></div>
        <div class="mrow"><label>Ваша машина</label><select id="nTank2">${tankOptions('bt7')}</select></div>
        <p class="note">Машина второго игрока — для дуэли и танкодрома; на дороге он садится во второй танк у старта.</p>
        <div class="mrow"><button class="go" id="nJoin">Присоединиться</button>${back()}</div>
        <p class="note" id="nMsg"></p>`;
      const q = s => root.querySelector(s);
      const sync = () => {
        const m = q('#nMode').value;
        q('#nSeedRow').style.display = m === 'road' ? '' : 'none';
        q('#nTankRow').style.display = m === 'road' ? 'none' : '';
        q('#nFoesRow').style.display = m === 'duel' ? '' : 'none';
      };
      q('#nMode').onchange = sync;
      sync();
      q('#nHost').onclick = () => {
        const m = q('#nMode').value;
        if (m === 'road') {
          const v = parseInt(q('#nSeed').value, 10);
          go({ mode: 'road', seed: v > 0 ? v : Math.floor(Math.random() * 999999) + 1, net: 'host' });
        } else {
          const foes = new Array(+q('#nFoes').value).fill('random').join(',');
          go({ mode: m, tank: q('#nTank').value, ...(m === 'duel' ? { enemies: foes } : {}), seed: Math.floor(Math.random() * 999999) + 1, net: 'host' });
        }
      };
      q('#nJoin').onclick = async () => {
        const code = q('#nCode').value.trim();
        const say = t => { q('#nMsg').textContent = t; };
        if (!code) { say('Введи код комнаты или код-приглашение'); return; }
        try {
          let offer, room = null;
          if (isRoomCode(code)) {
            room = code.toUpperCase();
            say('Ищу комнату...');
            const text = await Signal.get(room, 'offer');
            if (!text) { say('Комната не найдена (игра запущена через server.py? код верный?)'); return; }
            offer = await unpack(text);
          } else offer = await unpack(code);
          sessionStorage.setItem(NET_KEY, JSON.stringify({ offer, room, tank: q('#nTank2').value }));
          const p = { mode: offer.mode, seed: offer.seed, net: 'guest' };
          if (offer.start) p.start = offer.start;
          go(p);
        } catch (e) {
          console.error(e);
          say('Не получилось прочитать код: ' + e.message);
        }
      };
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
