// HUD panels of the game: tank systems (schematic + bars), inventory, gauge, weapon, tank markers, minimap
// and the interaction prompts.
import * as THREE from 'three';
import { MODULE_NAMES, SYSTEM_IDS } from '../tanks.js';
import { SYSTEM_PART, PART_NAMES, ORIGIN_NAMES, SANDBAG, partLabel } from '../parts.js';
import { ITEM_DEFS, shellsLabel } from '../items.js';
import { colorName, swatch } from '../paint.js';
import { SETTLEMENT_LABEL } from '../settlements.js';
import { WEAPONS, GRENADES, CAT_NAMES } from '../weapons.js';
import { Markers, Minimap } from '../hud.js';
import { $ } from './dom.js';
import { PLATES_MAX } from './stash.js';

export function createPanels(ctx) {
  const { behindHalf, grenText, items, nearestSeat, paintJob, partName, player, seatName, state, sumAmmo, tankDist, troopSeat, world } = ctx;

  // ================== HUD ==================
  const invEl = $('inv'), topEl = $('topbar'), sysEl = $('systems'), gaugeEl = $('gauge');
  const gunMark = $('gunMark'), promptEl = $('prompt'), fireEl = $('fire');
  const schem = /** @type {HTMLCanvasElement} */ ($('schem')).getContext('2d');

  const hpColor = hp => hp >= 99 ? '#6fcf5f' : hp > 60 ? '#b8d34a' : hp > 30 ? '#e8a53a' : hp > 0 ? '#e0503a' : '#555';

  function drawSchematic(t) {
    const W = 92, H = 170;
    schem.clearRect(0, 0, W, H);
    const b = t.vis.hullBox;
    const lw = b.max.x - b.min.x, ll = b.max.z - b.min.z;
    const sc = Math.min((W - 10) / lw, (H - 10) / ll);
    const cx = W / 2, cy = H / 2;
    const mx = (b.min.x + b.max.x) / 2, mz = (b.min.z + b.max.z) / 2;
    const P = (lx, lz) => [cx - (lx - mx) * sc, cy - (lz - mz) * sc];
    // hull outline
    const [x0, y0] = P(b.max.x, b.max.z), [x1, y1] = P(b.min.x, b.min.z);
    schem.fillStyle = 'rgba(80,90,70,.35)';
    schem.fillRect(x0, y0, x1 - x0, y1 - y0);
    schem.strokeStyle = hpColor(t.hp.hull);
    schem.lineWidth = 2;
    schem.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // modules
    const box = new THREE.Box3();
    const tp = t.turret.position, ty = t.turretYaw;
    const tc = Math.cos(ty), ts = Math.sin(ty);
    for (const m of t.def.modules) {
      t.moduleBox(m, box);
      const corners = [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.max.x, box.max.z], [box.min.x, box.max.z]]
        .map(([x, z]) => (m.space === 'turret' && t.vis.turretBox)
          ? P(tp.x + x * tc + z * ts, tp.z - x * ts + z * tc) : P(x, z));
      schem.beginPath();
      corners.forEach(([x, y], i) => i ? schem.lineTo(x, y) : schem.moveTo(x, y));
      schem.closePath();
      const hp = t.hp[m.id];
      schem.fillStyle = hpColor(hp) + (hp >= 99 ? '88' : 'dd');
      if (t.fire && t.fire.source === m.id && Math.sin(state.time * 12) > 0) schem.fillStyle = '#ff7a1a';
      schem.fill();
      schem.strokeStyle = 'rgba(0,0,0,.6)';
      schem.lineWidth = 1;
      schem.stroke();
    }
    // turret outline + gun
    if (t.vis.turretBox) {
      const tb = t.vis.turretBox;
      const [gx, gy] = P(tp.x, tp.z);
      const [ex, ey] = P(tp.x + ts * (tb.max.z + 2.5), tp.z + tc * (tb.max.z + 2.5));
      schem.strokeStyle = 'rgba(230,230,210,.8)';
      schem.lineWidth = 2;
      schem.beginPath(); schem.arc(gx, gy, (tb.max.x - tb.min.x) / 2 * sc, 0, 7); schem.stroke();
      schem.beginPath(); schem.moveTo(gx, gy); schem.lineTo(ex, ey); schem.stroke();
    }
    // front marker
    schem.fillStyle = '#c9b48a';
    schem.font = '9px Arial';
    schem.fillText('▲', cx - 4, 8);
  }

  let sysKey = '';
  function updateSystemsPanel(t, own) {
    if (!t) { sysEl.style.display = 'none'; return; }
    sysEl.style.display = 'block';
    let status = own ? '' : t.wrecked ? ' · сгорел' : t.crew ? ' · экипаж жив' : ' · без экипажа';
    if (!own && t.team === 'enemy' && t.crew) status = ' · противник';
    $('sysTitle').innerHTML = `${t.def.name} <small>${status}</small>`;
    drawSchematic(t);
    const d = t.def;
    let rows = `<div class="spec">${d.power} л.с. · ${d.weight.toFixed(1)} т · ${d.pw.toFixed(1)} л.с./т` +
      (t.turretless ? '' : ` · башня ${t.parts.turret ? ORIGIN_NAMES[t.parts.turret.key] : '<span class="bad">нет</span>'}`) +
      `<br>топливо ${Math.round(t.fuel)}/${t.fuelMax} л · ${t.mg ? 'пулемёт ' + WEAPONS[t.mg.key].name : 'без пулемёта'}` +
      (t.bags.length ? ` · мешков ${t.bags.length}` : '') + '</div>';
    rows += SYSTEM_IDS.map(id => {
      const hp = Math.round(t.hp[id]);
      const kind = SYSTEM_PART[id];
      const part = kind && t.parts[kind];
      const origin = part && part.key !== t.key ? ` <em>${ORIGIN_NAMES[part.key]}</em>` : '';
      let st = hp <= 0 ? 'уничт.' : hp + '%';
      if (kind && !part) st = 'нет';
      else if (id === 'turret' && !d.driveOk && t.parts.turret) st = 'не подходит';
      return `<div class="srow ${hp <= 0 || st === 'не подходит' ? 'dead' : ''}"><div class="n"><span>${MODULE_NAMES[id]}${origin}</span><span>${st}</span></div>` +
             `<div class="b"><i style="width:${hp}%;background:${hpColor(hp)}"></i></div></div>`;
    }).join('');
    if (rows !== sysKey) { $('sysRows').innerHTML = rows; sysKey = rows; }
  }

  let invKey = '';
  function updateInventory() {
    const inv = items.inventory;
    let html = `<h4>ЗДОРОВЬЕ</h4><div id="hpbar"><div id="hpfill" style="width:${state.hp}%;background:${hpColor(state.hp)}"></div></div><h4>ИНВЕНТАРЬ</h4>`;
    for (const k of ['repair_kit', 'torch', 'cutter']) {
      const n = inv[k] || 0;
      let v = k === 'repair_kit' ? '×' + n : 'нет';
      if (k !== 'repair_kit' && n) v = `газ ${Math.ceil(items.charge[k])}%` + (n > 1 ? ` · ×${n}` : '');
      html += `<div class="row ${n ? '' : 'none'}"><span>${ITEM_DEFS[k].icon} ${ITEM_DEFS[k].name}</span><span>${v}</span></div>`;
    }
    if (items.sprays.length) {
      const c = items.spray;
      html += `<div class="row"><span>${ITEM_DEFS.spray.icon} ${swatch(c.color)} ${colorName(c.color)}</span><span>${Math.round(c.paint)}%` +
              (items.sprays.length > 1 ? ` · ${items.sprayIdx + 1}/${items.sprays.length} <b>O</b>` : '') + `</span></div>`;
    }
    // small arms
    html += `<h4 style="margin-top:6px">ОРУЖИЕ</h4>`;
    for (const [i, slot] of [[1, 'small'], [2, 'big']]) {
      const w = items[slot];
      const W = w && WEAPONS[w.key];
      html += `<div class="row ${w ? '' : 'none'} ${items.drawn === slot ? 'sel' : ''}"><span><b>${i}</b> ${W ? W.name : slot === 'small' ? 'малое —' : 'большое —'}</span>` +
              `<span>${W ? `${w.mag}/${W.mag} · ${items.ammo[W.cal] || 0}` : ''}</span></div>`;
    }
    const gt = items.grenadeTotal();
    html += `<div class="row ${gt ? '' : 'none'} ${items.drawn === 'grenade' ? 'sel' : ''}"><span><b>3</b> Гранаты</span><span>${gt ? grenText(items.grenades) : '—'}</span></div>`;
    const spare = sumAmmo(items.ammo).filter(([c]) => ![items.small, items.big].some(w => w && WEAPONS[w.key].cal === c));
    if (spare.length) html += `<div class="row none"><span>патроны</span><span>${spare.map(([c, n]) => `${c}×${n}`).join(' ')}</span></div>`;
    const held = !items.hands ? '—' : items.hands === 'shells' ? `${ITEM_DEFS.shells.icon} ${shellsLabel(items.handShells)}`
      : items.hands === 'part' ? `${ITEM_DEFS.part.icon} ${partLabel(items.handPart)}`
      : items.hands === 'canister' ? `${ITEM_DEFS.canister.icon} канистра, ${Math.round(items.handCan.fuel)} л`
      : items.hands === 'plate' ? `${ITEM_DEFS.plate.icon} бронелист ${swatch(items.plateColor)} ${colorName(items.plateColor)}`
      : ITEM_DEFS[items.hands].icon + ' ' + ITEM_DEFS[items.hands].name;
    html += `<div class="hands">В руках: ${held}</div>`;
    if (html !== invKey) { invEl.innerHTML = html; invKey = html; }
  }

  function updateGauge(v) {
    if (!v) { gaugeEl.style.display = 'none'; return; }
    gaugeEl.style.display = 'block';
    $('gaugeSpeed').innerHTML = `${v.speedKmh.toFixed(0)}<small> км/ч</small>`;
    $('gaugeName').textContent = v.car ? `${v.def.name} · ${v.car === 'moto' ? 'мотоцикл' : 'автомобиль'}` : v.apc ? `${v.def.name} · БТР` : `${v.def.name} · ${v.def.caliber}`;
    const view = state.view === 'inside'
      ? `<div class="gline seat"><span>Место</span><b>${state.seat ? seatName(state.seat) : 'в отделении'}</b></div>`
      : `<div class="gline seat"><span>Вид</span><b>снаружи (V — изнутри)</b></div>`;
    const rt = v.reloadTime;
    const rl = v.hp.gun <= 0 ? 0 : Math.max(0, 1 - v.reload / rt);
    const fuelP = v.fuelMax > 0 ? v.fuel / v.fuelMax * 100 : 0;
    const mgW = v.mg && WEAPONS[v.mg.key];
    const troops = v.apc ? v.seats().filter(s => s.troop).length : 0;
    $('gaugeInfo').innerHTML = view + (v.apc ? `<div class="gline"><span>${v.car ? 'Пассажиры' : 'Десант'}</span><b>${troops} мест</b></div>` :
      `<div class="gline"><span>Снаряды</span><b>${Math.floor(v.ammo)} / ${v.def.ammoMax}</b></div>` +
      `<div class="gline"><span>${!v.parts.gun ? 'Орудия нет' : v.hp.gun <= 0 ? 'Орудие уничтожено' : rl >= 1 ? 'Заряжено' : 'Перезарядка ' + Math.max(0, v.reload).toFixed(1) + ' с'}</span></div>` +
      `<div class="mbar"><i style="width:${rl * 100}%;background:${rl >= 1 ? '#7fe07f' : '#e8a53a'}"></i></div>`) +
      (mgW ? `<div class="gline ${state.wsel === 'mg' ? 'seat' : ''}"><span>${state.wsel === 'mg' ? '▶ ' : ''}Пулемёт ${mgW.name}</span><b>${v.mgAmmo}</b></div>`
           : `<div class="gline"><span>Пулемёта нет</span></div>`) +
      (v.apc ? '' : `<div class="gline"><span>${state.wsel === 'gun' ? '▶ орудие' : 'X — орудие / пулемёт'}</span></div>`) +
      `<div class="gline"><span>Топливо</span><b>${Math.round(v.fuel)} / ${v.fuelMax} л</b></div>` +
      `<div class="mbar"><i style="width:${fuelP}%;background:${fuelP < 15 ? '#e0503a' : '#c9b48a'}"></i></div>` +
      `<div class="gline"><span>Огнетушители</span><b>${v.extinguishers}</b></div>` +
      `<div class="gline"><span>Бронелисты в укладке</span><b>${v.plates.map(swatch).join('')} ${v.plates.length}</b></div>` +
      (v.bags.length ? `<div class="gline"><span>Мешки с песком</span><b>${v.bags.length}</b></div>` : '');
  }

  // weapon in hands (on foot)
  const weaponEl = $('weapon');
  function updateWeaponPanel() {
    if (state.mode !== 'walk' || !items.drawn || items.hands) { weaponEl.style.display = 'none'; return; }
    let html;
    if (items.drawn === 'grenade') {
      const k = items.grenadeKey;
      html = `<div class="wname">${k ? GRENADES[k].name : 'Гранаты'}</div><div class="wammo">${k ? items.grenades[k] || 0 : 0}</div>` +
             `<div class="wsub">ЛКМ — бросить · ПКМ — дальше · 3 — другая</div>`;
    } else {
      const { w, W } = items.drawnWeapon();
      html = `<div class="wname">${W.name}</div><div class="wammo">${w.mag}<small> / ${items.ammo[W.cal] || 0}</small></div>` +
             `<div class="wsub">${CAT_NAMES[W.cat]} · ${W.cal} · ${W.auto ? 'авто' : 'одиночный'}` +
             (state.reloadT > 0 ? ` · <b>перезарядка ${state.reloadT.toFixed(1)} с</b>` : w.mag === 0 ? ' · <b>R — перезарядить</b>' : '') + '</div>';
    }
    weaponEl.innerHTML = html;
    weaponEl.style.display = 'block';
  }

  function nextSettlementLabel(p) {
    let best = null;
    for (let k = 0; k < 400; k++) {
      const s = world.settlementPlan(Math.max(0, Math.floor((p.z - 380) / 850)) + k);
      if (s && s.z > p.z - s.halfLen) { best = s; break; }
    }
    if (!best) return 'КАРТА';
    const d = best.z - p.z;
    if (Math.abs(d) < best.halfLen) return `${SETTLEMENT_LABEL[best.type]} ${best.name}`;
    return `Впереди: ${best.name} (${SETTLEMENT_LABEL[best.type].toLowerCase()}) ${(d / 1000).toFixed(1)} км`;
  }

  const markers = new Markers($('markers'));
  const minimap = new Minimap($('minimap'), world);

  // ================== prompts ==================
  function slotPrompt(sl, lines) {
    if (sl.stand) {
      const it = sl.stand.item, where = `Башня ${ORIGIN_NAMES[it.turret.key]} на площадке ${sl.stand.slot + 1}`;
      if (items.hands === 'part') {
        if (items.handPart.kind !== 'gun') return;
        lines.push(it.gun ? `${where}: орудие уже стоит` : `<b>F</b> — установить ${partName('gun', items.handPart.key)}`);
      } else if (!items.hands) {
        lines.push(it.gun ? `<b>F</b> — снять: ${partName('gun', it.gun.key)} (${Math.round(it.gun.hp)}%)` : `${where}: орудия нет`);
      }
      return;
    }
    const t = sl.tank, kind = sl.kind;
    if (kind === 'mg') {
      if (t.crew) { lines.push(`Пулемёт · ${t.def.hullName}: в танке экипаж`); return; }
      if (items.hands) return;
      if (t.mg) lines.push(`<b>F</b> — снять пулемёт ${WEAPONS[t.mg.key].name} (${WEAPONS[t.mg.key].cal}, в укладке ${t.mgAmmo})`);
      else if (items.big && WEAPONS[items.big.key].cat === 'mg') lines.push(`<b>F</b> — установить пулемёт ${WEAPONS[items.big.key].name}`);
      else lines.push(`Турель пулемёта · ${t.def.hullName}: пусто`);
      return;
    }
    const part = t.parts[kind];
    const where = `${PART_NAMES[kind]} · ${t.def.hullName}`;
    if (kind === 'fuel' && part) lines.push(`Топливо в баках ${t.def.hullName}: <b>${Math.round(t.fuel)}</b> / ${t.fuelMax} л` + (t.hp.fuel <= 0 ? ' — баки пробиты' : ''));
    if (t.crew) { lines.push(`${where}: в танке экипаж`); return; }
    if (items.hands === 'part') {
      const held = items.handPart;
      if (held.kind !== kind) return;
      if (part) lines.push(`${where}: занято (${ORIGIN_NAMES[part.key]}) — сначала сними`);
      else if (kind === 'engine' && !t.bayOpen) lines.push('<b>Q</b> — открыть моторный отсек');
      else lines.push(`<b>F</b> — установить ${partName(held.kind, held.key)}`);
      return;
    }
    if (items.hands) return;
    if (kind === 'engine') {
      if (!t.bayOpen) { lines.push(`<b>F</b> / <b>Q</b> — открыть моторный отсек ${t.def.hullName}`); return; }
      lines.push(part ? `<b>F</b> — вынуть двигатель ${ORIGIN_NAMES[part.key]} (${Math.round(part.hp)}%)` : 'Моторный отсек пуст');
      lines.push('<b>Q</b> — закрыть моторный отсек');
      return;
    }
    if (part) lines.push(`<b>F</b> — снять: ${partName(kind, part.key)} (${Math.round(part.hp)}%)`);
    else lines.push(`${where}: пусто`);
  }

  function updatePrompt() {
    const lines = [];
    if (state.mode === 'walk' && state.para) {
      lines.push(state.para.open ? 'Парашют: <b>WASD</b> — править куполом' : 'Свободное падение — <b>ПРОБЕЛ</b>: раскрыть парашют');
    } else if (state.mode === 'walk') {
      const t = state.nearTank;
      const pl = state.nearPlane;
      if (pl && !items.hands && (!t || tankDist(t, player.position) > 1.2)) {
        lines.push(`<b>E</b> — сесть в самолёт ${pl.def.name} (топливо ${Math.round(pl.fuel)} л${pl.hp < 60 ? `, планер ${Math.round(pl.hp)}%` : ''})`);
      }
      if (state.slot) slotPrompt(state.slot, lines);
      if (items.hands === 'plate') {
        if (t && !t.wrecked && t.hp.hull < 100) {
          lines.push(items.inventory.torch > 0
            ? `Удерживай <b>F</b> — приварить бронелист ${swatch(items.plateColor)} (корпус ${Math.round(t.hp.hull)}%)`
            : 'Нет газовой горелки');
        }
        if (t && !t.wrecked && !t.crew) lines.push(`<b>E</b> — уложить бронелист в ${t.def.name} (${t.plates.length}/${PLATES_MAX})`);
        lines.push('<b>G</b> — бросить бронелист');
      } else if (items.hands === 'shells') {
        if (t && !t.wrecked && !t.crew) lines.push(`<b>E</b> — зарядить в ${t.def.name} (${Math.floor(t.ammo)}/${t.def.ammoMax})`);
        else lines.push(`В руках: ${shellsLabel(items.handShells)} — подойди к танку`);
        lines.push('<b>G</b> — бросить ящик');
      } else if (items.hands === 'part') {
        if (!state.slot) lines.push(`В руках: ${partLabel(items.handPart)} — подойди к месту установки`);
        lines.push('<b>G</b> — бросить');
      } else if (items.hands === 'canister') {
        const can = items.handCan;
        if (t && !t.wrecked && t.parts.fuel) {
          lines.push(t.hp.fuel <= 0 ? 'Баки пробиты — топливо не удержат'
            : t.fuel >= t.fuelMax - 0.2 ? `Баки ${t.def.name} полны (${t.fuelMax} л)`
            : `Удерживай <b>F</b> — залить топливо (баки ${Math.round(t.fuel)} / ${t.fuelMax} л, в канистре ${Math.round(can.fuel)} л)`);
        } else if (t && !t.wrecked) lines.push('У этого танка нет топливных баков');
        else lines.push(`В руках канистра (${Math.round(can.fuel)} л) — подойди к танку`);
        lines.push('<b>G</b> — поставить канистру');
      } else if (items.hands === 'sandbag') {
        if (t && !t.wrecked && !t.crew) lines.push(`<b>E</b> — положить мешок с песком на ${t.def.name} (${t.bags.length}/${SANDBAG.max})`);
        else lines.push('В руках мешок с песком — подойди к танку');
        lines.push('<b>G</b> — бросить мешок');
      } else if (state.nearItem) {
        lines.push(`<b>F</b> — подобрать: ${items.label(state.nearItem)}`);
      } else if (state.nearPanel && !state.slot) {
        lines.push('<b>F</b> — пульт управления краном');
      }
      if (t && !state.slot) {
        if (t.wrecked) lines.push(`${t.def.name} — сгоревший танк`);
        else if (t.crew) lines.push(`${t.def.name}: экипаж жив`);
        else {
          if (!items.hands) lines.push(t.car ? (behindHalf(t, player.position) ? `<b>E</b> — сесть пассажиром в ${t.def.name}`
            : `<b>E</b> — сесть за руль ${t.def.name} (сзади — пассажиром)`)
            : t.apc ? (behindHalf(t, player.position) ? `<b>E</b> — сесть в десантное отделение ${t.def.name}`
            : `<b>E</b> — сесть в ${t.def.name} (сзади — в десант)`) : `<b>E</b> — сесть в ${t.def.name}`);
          if (!items.hands && !state.nearItem) lines.push(`<b>F</b> — укладка танка (ремкомплекты, бронелисты, снаряды, оружие)`);
          if (!items.hands && items.inventory.cutter > 0) {
            lines.push(t.hp.hull >= 75 ? 'Удерживай <b>T</b> — срезать бронелист резаком' : 'Корпус повреждён — бронелист не срезать');
          }
          if (items.inventory.repair_kit > 0) lines.push('<b>R</b> — ремкомплект');
          if (!items.hands && items.spray) {
            const job = paintJob(t), c = items.spray;
            lines.push(job.use > c.paint + 0.01
              ? `Краски ${swatch(c.color)} мало: ${Math.round(c.paint)}% из ${Math.round(job.use)}%`
              : job.patch ? `Удерживай <b>P</b> — закрасить заплатку ${swatch(job.patch.userData.color)} → ${swatch(c.color)} ${colorName(c.color)}`
              : `Удерживай <b>P</b> — перекрасить ${t.def.name} ${swatch(t.hullColor)} → ${swatch(c.color)} ${colorName(c.color)} (${Math.round(job.use)}% краски)`);
            if (items.sprays.length > 1) lines.push('<b>O</b> — другой баллончик');
          }
        }
      }
    } else if (state.mode === 'drive') {
      const v = state.vehicle;
      const ts = troopSeat();
      if (ts) lines.push(ts.fire ? `Десант: <b>1/2/3</b> — оружие, <b>ЛКМ</b> — огонь, <b>R</b> — перезарядка, <b>Q</b> — встать`
        : 'Десант: отсюда не стрелять — <b>Q</b>, встань и пересядь к люку / бойнице');
      if (state.view === 'inside' && !state.seat) {
        const s = nearestSeat(v);
        lines.push(s ? `<b>Q</b> — сесть: ${seatName(s.role)}` : 'WASD — перемещение внутри танка');
      }
      if (v.bayOpen) lines.push('Моторный отсек открыт — двигатель не заводится');
      else if (!v.parts.engine) lines.push('Двигателя нет');
      if (v.craneLock) lines.push('Идёт работа крана');
      if (state.zoneText) lines.push(`${state.zone.label}: ${state.zoneText}`);
      else if (state.zone) lines.push(`${state.zone.label}: остановись для обслуживания`);
    }
    if (state.dead) lines.unshift(`<b>Вы погибли</b> — возрождение рядом с напарником через ${Math.ceil(state.deadT)} с`);
    if (lines.length) {
      promptEl.innerHTML = lines.join('<br>');
      promptEl.style.display = 'block';
    } else promptEl.style.display = 'none';
  }

  return { topEl, gunMark, fireEl, updateSystemsPanel, updateInventory, updateGauge, updateWeaponPanel, nextSettlementLabel, markers, minimap, updatePrompt };
}
