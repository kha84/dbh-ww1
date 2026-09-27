// Tank stowage menu (kits, tools, spare plates, shells, small arms page), sandbags / plates / shells put into a tank,
// dropping what is in the hands and the hold-to-do actions (welding, cutting, pouring fuel, painting).
import * as THREE from 'three';
import { GUNS, SANDBAG, partLabel } from '../parts.js';
import { ITEM_DEFS, TOOL_USE, SHELLS_PER_BOX, CANISTER_L, SPRAY_USE, shellsLabel, ammoLabel, grenadeLabel } from '../items.js';
import { colorName, swatch } from '../paint.js';
import { WEAPONS, GRENADES, CAT_NAMES, isSmall, weaponLabel } from '../weapons.js';
import { $ } from './dom.js';

export const PLATES_MAX = 4;         // spare plates a tank can carry

export function createStash(ctx) {
  const { camera, closeCrane, closeRepair, fx, items, keys, lookDir, msg, player, sfx, state } = ctx;
  const repairEl = $('repair');       // the stowage menu uses the panel of the repair menu

  // ================== tank stowage: kits, tools, spare plates, shells ==================
  const shellKey = t => t.parts.gun ? t.parts.gun.key : t.key;

  function placeSandbag(t) {
    if (!t.addSandbag()) { msg(`На ${t.def.name} больше не уложить — ${SANDBAG.max} мешков максимум`); return; }
    items.hands = null;
    sfx.click();
    const f = t.bagCount('front'), sd = t.bagCount('side');
    msg(`Мешок с песком уложен на ${t.def.name} (${t.bags.length}/${SANDBAG.max}): лоб +${f * SANDBAG.front} мм, борт +${sd * SANDBAG.side} мм, ` +
        `масса ${t.def.weight.toFixed(1)} т`, '#c9b48a');
  }

  function stowPlate(t) {
    if (t.plates.length >= PLATES_MAX) { msg(`В ${t.def.name} больше не уложить — ${PLATES_MAX} бронелиста максимум`); return; }
    t.plates.push(items.plateColor);
    items.hands = null;
    sfx.click();
    msg(`Бронелист уложен в ${t.def.name} (${t.plates.length}/${PLATES_MAX})`, '#9fd0ff');
  }

  function loadShells(t) {
    const b = items.handShells;
    if (!t.parts.gun) { msg('В танке нет орудия — снаряды некуда заряжать'); return; }
    if (GUNS[t.parts.gun.key].caliber !== b.caliber) {
      msg(`Снаряды ${b.caliber} не подходят к орудию ${GUNS[t.parts.gun.key].caliber}`, '#ff9a7a');
      return;
    }
    const room = t.def.ammoMax - Math.floor(t.ammo);
    if (room <= 0) { msg('Боеукладка полна'); return; }
    const n = Math.min(room, b.n);
    t.ammo += n;
    b.n -= n;
    sfx.click();
    if (b.n <= 0) { items.hands = null; items.handShells = null; }
    msg(`Загружено снарядов: ${n} (${Math.floor(t.ammo)}/${t.def.ammoMax})` + (b.n > 0 ? ` — в ящике осталось ${b.n}` : ''), '#9fe07f');
  }

  const sumAmmo = o => Object.entries(o).filter(([, n]) => n > 0);
  const ammoText = o => sumAmmo(o).map(([c, n]) => `${c}×${n}`).join(', ') || 'нет';
  const grenText = o => sumAmmo(o).map(([k, n]) => `${GRENADES[k].name.split(' ')[0]}×${n}`).join(', ');

  function armsOptions(t) {
    const c = t.cargo;
    const full = c.weapons.length >= 5;
    const put = slot => {
      const w = items[slot];
      return { id: 'put', slot, label: `Положить: ${w ? WEAPONS[w.key].name : slot === 'small' ? 'малое оружие' : 'большое оружие'}`,
               ok: !!w && !full, note: !w ? 'нет' : full ? 'места нет (5)' : `${w.mag}/${WEAPONS[w.key].mag}` };
    };
    const mine = new Set([items.small, items.big].filter(Boolean).map(w => WEAPONS[w.key].cal));
    const takeable = sumAmmo(c.ammo).filter(([cal]) => mine.has(cal));
    /** @type {any[]} */
    const res = [
      put('small'), put('big'),
      { id: 'putAmmo', label: 'Выложить свои патроны и гранаты', ok: sumAmmo(items.ammo).length + sumAmmo(items.grenades).length > 0,
        note: [ammoText(items.ammo), grenText(items.grenades)].filter(x => x && x !== 'нет').join('; ') || 'нет' },
      { id: 'takeAmmo', label: 'Забрать патроны к своему оружию и гранаты', ok: takeable.some(([k, n]) => n > 1 || !t.mg || WEAPONS[t.mg.key].cal !== k) || sumAmmo(c.grenades).length > 0,
        note: [takeable.map(([k, n]) => `${k}×${n}`).join(', '), grenText(c.grenades)].filter(Boolean).join('; ') || 'нет' },
    ];
    c.weapons.forEach((w, i) => {
      const W = WEAPONS[w.key], slot = isSmall(w.key) ? 'small' : 'big';
      res.push({ id: 'take', i, label: `Взять: ${W.name}`, ok: true,
                 note: `${CAT_NAMES[W.cat].toLowerCase()}, ${w.mag}/${W.mag}` + (items[slot] ? ' — обмен' : '') });
    });
    return res;
  }

  function stashOptions(t) {
    if (state.stashPage === 'arms') return armsOptions(t);
    const kits = t.loot.repair_kit, torches = t.loot.torch || 0;
    const ammo = Math.floor(t.ammo), gun = GUNS[shellKey(t)];      // personnel carriers have no main gun
    const handsFree = !items.hands;
    const nw = t.cargo.weapons.length;
    return [
      { id: 'kits', label: 'Ремкомплекты', ok: kits > 0, note: kits > 0 ? `×${kits} — забрать` : 'нет' },
      { id: 'torch', label: 'Газовые горелки', ok: torches > 0, note: torches > 0 ? `×${torches} — забрать` : 'нет' },
      { id: 'plate', label: 'Бронелист в руки', ok: t.plates.length > 0 && handsFree,
        note: t.plates.length > 0 ? `${t.plates.map(swatch).join('')} ${t.plates.length}/${PLATES_MAX}` + (handsFree ? '' : ' — руки заняты') : 'нет' },
      gun && { id: 'shells', label: `Снаряды ${gun.caliber} в руки`, ok: ammo > 0 && handsFree,
        note: ammo > 0 ? `${ammo} шт. — ящик до ${SHELLS_PER_BOX}` + (handsFree ? '' : ', руки заняты') : 'нет' },
      { id: 'bag', label: 'Снять мешок с песком', ok: t.bags.length > 0 && handsFree,
        note: t.bags.length ? `${t.bags.length}/${SANDBAG.max}` + (handsFree ? '' : ' — руки заняты') : 'нет' },
      { id: 'arms', label: 'Оружие и патроны →', ok: true,
        note: `оружия ${nw}, патроны: ${ammoText(t.cargo.ammo)}`.slice(0, 60) },
    ].filter(Boolean);
  }

  function openStash(t) {
    closeRepair();
    closeCrane();
    state.stash = t;
    state.stashPage = 'main';
    renderStash();
  }
  function closeStash() {
    if (!state.stash) return;
    state.stash = null;
    repairEl.style.display = 'none';
  }
  function renderStash() {
    const t = state.stash;
    if (!t) return;
    const arms = state.stashPage === 'arms';
    let html = `<h3>${arms ? 'ОРУЖИЕ И ПАТРОНЫ' : 'УКЛАДКА'} — ${t.def.name}</h3>`;
    if (arms && t.mg) html += `<div class="info">Пулемёт ${WEAPONS[t.mg.key].name}: патронов ${WEAPONS[t.mg.key].cal} в укладке — <b>${t.mgAmmo}</b></div>`;
    stashOptions(t).forEach((o, i) => {
      html += `<div class="opt ${o.ok ? '' : 'off'}"><span><b>${i + 1}</b>${o.label}</span><span>${o.note}</span></div>`;
    });
    html += arms ? `<div class="foot"><b>0</b> — назад · F / ESC — закрыть · патроны калибра пулемёта питают пулемёт танка</div>`
      : `<div class="foot">Цифра — взять · F / ESC — закрыть<br>С бронелистом, ящиком снарядов или мешком с песком в руках у танка: <b>E</b> — уложить / зарядить</div>`;
    repairEl.innerHTML = html;
    repairEl.style.display = 'block';
  }
  function doArms(t, i) {
    if (i === 9) { state.stashPage = 'main'; renderStash(); return; }
    const o = armsOptions(t)[i];
    if (!o) return;
    if (!o.ok) { msg(`${o.label}: ${o.note}`); return; }
    const c = t.cargo;
    if (o.id === 'put') {
      const w = items[o.slot];
      items[o.slot] = null;
      if (items.drawn === o.slot) { items.drawn = null; state.reloadT = 0; }
      c.weapons.push(w);
      msg(`Уложено в ${t.def.name}: ${weaponLabel(w)}`, '#e8c96a');
    } else if (o.id === 'putAmmo') {
      for (const [k, n] of sumAmmo(items.ammo)) c.ammo[k] = (c.ammo[k] || 0) + n;
      for (const [k, n] of sumAmmo(items.grenades)) c.grenades[k] = (c.grenades[k] || 0) + n;
      items.ammo = {}; items.grenades = {};
      if (items.drawn === 'grenade') items.drawn = null;
      msg(`Патроны и гранаты уложены в ${t.def.name}`, '#e8c96a');
    } else if (o.id === 'takeAmmo') {
      const mine = new Set([items.small, items.big].filter(Boolean).map(w => WEAPONS[w.key].cal));
      const got = [];
      const mgCal = t.mg && WEAPONS[t.mg.key].cal;
      for (const [k, n] of sumAmmo(c.ammo)) {
        if (!mine.has(k)) continue;
        const take = k === mgCal ? Math.floor(n / 2) : n;      // half of the belts stay with the tank's machine gun
        if (take <= 0) continue;
        items.addAmmo(k, take); c.ammo[k] = n - take; got.push(ammoLabel(k, take));
      }
      for (const [k, n] of sumAmmo(c.grenades)) { items.addGrenades(k, n); c.grenades[k] = 0; got.push(grenadeLabel(k, n)); }
      msg(`Взято из ${t.def.name}: ${got.join(', ')}`, '#e8c96a');
    } else if (o.id === 'take') {
      const [w] = c.weapons.splice(o.i, 1);
      const old = items.giveWeapon(w);
      if (old) c.weapons.push(old);
      msg(`Взято: ${weaponLabel(w)}` + (old ? ` — в танк уложено ${WEAPONS[old.key].name}` : ''), '#e8c96a');
    }
    sfx.click();
    renderStash();
  }

  function doStash(i) {
    const t = state.stash;
    if (!t) return;
    if (state.stashPage === 'arms') { doArms(t, i); return; }
    const o = stashOptions(t)[i];
    if (!o) return;
    if (!o.ok) { msg(`${o.label}: ${o.note}`); return; }
    if (o.id === 'arms') { state.stashPage = 'arms'; sfx.click(); renderStash(); return; }
    if (o.id === 'bag') {
      t.removeSandbag();
      items.hands = 'sandbag';
      msg(`Мешок с песком снят с ${t.def.name} (осталось ${t.bags.length})`, '#c9b48a');
      closeStash();
      sfx.click();
      return;
    }
    if (o.id === 'kits') {
      items.give('repair_kit', t.loot.repair_kit);
      msg(`Взято из танка: ремкомплект ×${t.loot.repair_kit}`, '#e8c96a');
      t.loot.repair_kit = 0;
    } else if (o.id === 'torch') {
      items.give('torch', t.loot.torch);
      msg(`Взято из танка: газовая горелка ×${t.loot.torch}`, '#e8c96a');
      t.loot.torch = 0;
    } else if (o.id === 'plate') {
      items.plateColor = t.plates.pop();
      items.hands = 'plate';
      msg(`Бронелист (${colorName(items.plateColor)}) вынут из ${t.def.name} (осталось ${t.plates.length})`, '#9fd0ff');
      closeStash();
    } else if (o.id === 'shells') {
      const key = shellKey(t);
      const n = Math.min(SHELLS_PER_BOX, Math.floor(t.ammo));
      t.ammo -= n;
      items.hands = 'shells';
      items.handShells = { key, caliber: GUNS[key].caliber, n };
      msg(`В руках: ${shellsLabel(items.handShells)} — у своего танка нажми E`, '#e8c96a');
      closeStash();
    }
    sfx.click();
    if (state.stash) renderStash();
  }

  function dropHeld() {
    if (state.mode !== 'walk') return;
    const d = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const x = player.position.x + d.x * 1.6, z = player.position.z + d.z * 1.6;
    if (!items.hands) {
      // no load in the hands: drop the drawn weapon
      const slot = items.drawn;
      if (slot === 'small' || slot === 'big') {
        const w = items[slot];
        items[slot] = null;
        items.drawn = null;
        state.reloadT = 0;
        items.drop('weapon', x, z, w);
        msg(`Брошено: ${weaponLabel(w)}`);
      }
      return;
    }
    if (items.hands === 'canister' || items.hands === 'sandbag') {
      const type = items.hands, data = items.handCan;
      items.hands = null;
      items.handCan = null;
      items.drop(type, x, z, data);
      msg(type === 'canister' ? `Канистра поставлена (${Math.round(data.fuel)} л)` : 'Мешок с песком брошен');
    } else if (items.hands === 'plate') {
      items.hands = null;
      items.drop('plate', x, z, { color: items.plateColor });
      msg('Бронелист брошен');
    } else if (items.hands === 'shells') {
      const b = items.handShells;
      items.hands = null;
      items.handShells = null;
      items.drop('shells', x, z, b);
      msg(`Брошено: ${shellsLabel(b)}`);
    } else {
      const part = items.releasePart();
      items.drop('part', x, z, part);
      msg(`Брошено: ${partLabel(part)}`);
    }
  }

  // hold-to-do actions: welding (F + plate + torch) and cutting (T + cutter)
  function currentHoldAction() {
    if (state.mode !== 'walk') return null;
    const t = state.nearTank;
    if (!t || t.wrecked) return null;
    if (items.hands === 'canister' && keys['KeyF'] && t.parts.fuel && t.hp.fuel > 0 && t.fuel < t.fuelMax - 0.2 && items.handCan.fuel > 0)
      return { kind: 'pour', tank: t, need: 1, text: 'Заливаю топливо...' };
    if (items.hands === 'plate' && keys['KeyF'] && items.inventory.torch > 0 && t.hp.hull < 100)
      return { kind: 'weld', tank: t, need: 3.5, text: 'Привариваю бронелист...' };
    if (!items.hands && keys['KeyT'] && items.inventory.cutter > 0 && !t.crew && t.hp.hull >= 75)
      return { kind: 'cut', tank: t, need: 5, text: 'Срезаю бронелист...' };
    if (!items.hands && keys['KeyP'] && items.spray && !t.crew) {
      const job = paintJob(t);
      if (job.use > items.spray.paint + 0.01) return null;
      return { kind: 'paint', tank: t, patch: job.patch, use: job.use, need: job.patch ? 1.2 : 3 + t.def.weight * 0.08,
               text: job.patch ? 'Закрашиваю заплатку...' : `Крашу ${t.def.name}...` };
    }
    return null;
  }

  // what the spray can would paint on this tank: the patch under the crosshair or the whole tank
  function paintJob(t) {
    const patch = t.patchAt(camera.getWorldPosition(new THREE.Vector3()), lookDir(), 4.5);
    return { patch, use: patch ? SPRAY_USE.patch : SPRAY_USE.tank(t.def.weight) };
  }
  function nextSpray() {
    if (!items.sprays.length) { msg('Баллончиков с краской нет'); return; }
    const c = items.nextSpray();
    msg(`Баллончик: ${colorName(c.color)} (${Math.round(c.paint)}%)` + (items.sprays.length > 1 ? ` — ${items.sprayIdx + 1} из ${items.sprays.length}` : ''), '#d8b0ff');
  }

  function updateHold(dt) {
    const a = currentHoldAction();
    if (!a || (state.hold && (state.hold.kind !== a.kind || state.hold.tank !== a.tank))) state.hold = null;
    if (!a) { $('hold').style.display = 'none'; return; }
    if (!state.hold) state.hold = { ...a, t: 0 };
    const h = state.hold;
    h.t += dt;
    if (h.kind === 'pour') {
      const can = items.handCan, t = h.tank;
      const n = Math.min(8 * dt, can.fuel, t.fuelMax - t.fuel);
      t.fuel += n;
      can.fuel -= n;
      if (Math.random() < dt * 3) sfx.pour();
      $('hold').style.display = 'block';
      $('holdText').textContent = `Заливаю топливо: баки ${Math.round(t.fuel)} / ${t.fuelMax} л, в канистре ${can.fuel.toFixed(0)} л`;
      $('holdFill').style.width = `${Math.min(100, (1 - can.fuel / CANISTER_L) * 100)}%`;
      if (can.fuel <= 0.05) {
        items.hands = null; items.handCan = null;
        state.hold = null;
        $('hold').style.display = 'none';
        msg(`Канистра пуста — выброшена. ${t.def.name}: ${Math.round(t.fuel)} / ${t.fuelMax} л`, '#9fe07f');
      } else if (t.fuel >= t.fuelMax - 0.2) {
        state.hold = null;
        $('hold').style.display = 'none';
        msg(`Баки полны (${t.fuelMax} л), в канистре осталось ${can.fuel.toFixed(0)} л`, '#9fe07f');
      }
      return;
    }
    $('hold').style.display = 'block';
    $('holdText').textContent = h.text;
    $('holdFill').style.width = `${Math.min(100, h.t / h.need * 100)}%`;
    if (h.kind === 'paint') {
      if (Math.random() < dt * 8) {
        const at = camera.getWorldPosition(new THREE.Vector3()).addScaledVector(lookDir(), 1.2);
        fx.spawn('dust', at, new THREE.Vector3((Math.random() - 0.5), 0.3, (Math.random() - 0.5)), 0.4);
      }
      if (h.t >= h.need) {
        const c = items.spray, t = h.tank;
        if (h.patch && h.patch.parent) {
          t.paintPatch(h.patch, c.color);
          msg(`Заплатка закрашена: ${colorName(c.color)}`, '#d8b0ff');
        } else {
          t.paintTank(c.color);
          msg(`${t.def.name} перекрашен: ${colorName(c.color)}`, '#d8b0ff');
        }
        items.useSpray(h.use);
        if (!items.spray || items.spray.color !== c.color) msg('Баллончик пуст — выброшен', '#d8b0ff');
        state.hold = null;
        $('hold').style.display = 'none';
      }
      return;
    }
    const tool = h.kind === 'weld' ? 'torch' : 'cutter';
    const gas = items.useTool(tool, TOOL_USE[tool] * dt);
    if (gas === 'spare') msg(`${ITEM_DEFS[tool].name}: газ кончился — взята запасная`, '#e8c96a');
    if (gas === 'empty') {
      msg(`${ITEM_DEFS[tool].name}: газ кончился — ищи новую`, '#ff9a7a');
      state.hold = null;
      $('hold').style.display = 'none';
      return;
    }
    const sparkAt = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw))
      .multiplyScalar(1.1).add(player.position).setY(player.position.y + 1.1);
    if (Math.random() < 0.8) fx.weld(sparkAt);
    if (h.t >= h.need) {
      if (h.kind === 'weld') {
        h.tank.hp.hull = 100;
        const n = h.tank.patchMarks(items.plateColor, { point: camera.getWorldPosition(new THREE.Vector3()), dir: lookDir() });
        items.hands = null;
        msg(`Корпус ${h.tank.def.name} залатан` + (n ? ` — заплатки: ${colorName(items.plateColor)}` : ''), '#9fe07f');
      } else {
        h.tank.hp.hull = Math.max(1, h.tank.hp.hull - 40);
        const p = player.position;
        const d = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
        // the plate is cut out of the hull: it has the colour of the hull
        const color = h.tank.hullColor;
        items.drop('plate', p.x - d.x * 1.2, p.z - d.z * 1.2, { color });
        h.tank.addMark(camera.getWorldPosition(new THREE.Vector3()).addScaledVector(lookDir(), 1.0), lookDir(), 'hole');
        msg(`Бронелист (${colorName(color)}) срезан с ${h.tank.def.name} (корпус −40%)`, '#9fd0ff');
      }
      state.hold = null;
      $('hold').style.display = 'none';
    }
  }

  return { placeSandbag, stowPlate, loadShells, sumAmmo, grenText, openStash, closeStash, renderStash, doStash, dropHeld, paintJob, nextSpray, updateHold };
}
