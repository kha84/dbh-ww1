// Menus opened with a key and answered with digits: the repair kit menu (R) and the crane control panel (F).
import { MODULE_IDS, MODULE_NAMES } from '../tanks.js';
import { SYSTEM_PART } from '../parts.js';
import { $ } from './dom.js';

export function createMenus(ctx) {
  const { closeStash, items, msg, sfx, state, tanks, workshop } = ctx;

  // ================== repair kit menu ==================
  const repairEl = $('repair');
  function openRepair() {
    closeCrane();
    closeStash();
    const t = state.mode === 'drive' ? state.vehicle : state.nearTank;
    if (!t || t.wrecked) { msg('Рядом нет танка для ремонта'); return; }
    state.repairOpen = true;
    state.repairTarget = t;
    renderRepair();
  }
  function closeRepair() {
    state.repairOpen = false;
    state.repairTarget = null;
    repairEl.style.display = 'none';
  }
  function renderRepair() {
    const t = state.repairTarget;
    if (!t) return;
    const kits = items.inventory.repair_kit;
    let html = `<h3>РЕМОНТ — ${t.def.name}</h3><div style="margin-bottom:8px;color:#aaa">Ремкомплектов: <b style="color:#e8c96a">${kits}</b></div>`;
    MODULE_IDS.forEach((id, i) => {
      const hp = Math.round(t.hp[id]);
      const kind = SYSTEM_PART[id];
      const missing = kind && !t.parts[kind];
      const ok = !missing && hp > 0 && hp < 100 && kits > 0;
      const st = missing ? 'нет — нужна деталь' : hp >= 100 ? 'исправен' : hp <= 0 ? (kind ? 'уничтожен — только замена' : 'уничтожен — только ремпункт') : `${hp}%`;
      html += `<div class="opt ${ok ? '' : 'off'}"><span><b>${i + 1}</b>${MODULE_NAMES[id]}</span><span>${st}</span></div>`;
    });
    html += `<div class="opt off"><span><b>–</b>Корпус</span><span>${Math.round(t.hp.hull)}% — бронелист + горелка</span></div>`;
    html += `<div class="foot">Цифра — починить систему · R / ESC — закрыть</div>`;
    repairEl.innerHTML = html;
    repairEl.style.display = 'block';
  }
  function doRepair(i) {
    const t = state.repairTarget;
    const id = MODULE_IDS[i];
    if (!t || !id) return;
    if (items.inventory.repair_kit <= 0) { msg('Нет ремкомплектов'); return; }
    const kind = SYSTEM_PART[id];
    if (kind && !t.parts[kind]) { msg(`${MODULE_NAMES[id]}: детали нет`); return; }
    if (t.hp[id] >= 100) { msg(`${MODULE_NAMES[id]}: исправен`); return; }
    if (t.hp[id] <= 0) { msg(kind ? `${MODULE_NAMES[id]} уничтожен — только замена` : `${MODULE_NAMES[id]} уничтожен — нужен ремпункт`, '#ff9a7a'); return; }
    t.hp[id] = 100;
    items.inventory.repair_kit--;
    msg(`${MODULE_NAMES[id]} отремонтирован`, '#9fe07f');
    sfx.click();
    closeRepair();
  }

  // ================== crane control panel ==================
  function openCrane(c) {
    closeRepair();
    closeStash();
    state.crane = c;
    renderCrane();
  }
  function closeCrane() {
    if (!state.crane) return;
    state.crane = null;
    repairEl.style.display = 'none';
  }
  function renderCrane() {
    const c = state.crane;
    if (!c) return;
    const d = workshop.describe(c, tanks);
    let html = `<h3>КРАН — ПУЛЬТ УПРАВЛЕНИЯ</h3>` +
      `<div class="info">На площадке: <b>${d.tankText}</b></div>` +
      `<div class="info">Площадка 1: <b>${d.slotText[0]}</b></div>` +
      `<div class="info" style="margin-bottom:8px">Площадка 2: <b>${d.slotText[1]}</b></div>`;
    workshop.options(c, tanks).forEach((o, i) => {
      html += `<div class="opt ${o.ok ? '' : 'off'}"><span><b>${i + 1}</b>${o.label}</span><span>${o.note}</span></div>`;
    });
    html += `<div class="foot">Цифра — команда · F / ESC — закрыть<br>Поворотный механизм вынимается руками (F) после снятия башни</div>`;
    repairEl.innerHTML = html;
    repairEl.style.display = 'block';
  }
  function doCrane(i) {
    const c = state.crane;
    const o = workshop.options(c, tanks)[i];
    if (!o) return;
    if (!o.ok) { msg(`Кран: ${o.note}`); return; }
    workshop.start(c, o);
    sfx.click();
    msg(o.op === 'remove' ? 'Кран снимает башню...' : 'Кран ставит башню...', '#c9b48a');
    closeCrane();
  }

  return { openRepair, closeRepair, renderRepair, doRepair, openCrane, closeCrane, renderCrane, doCrane };
}
