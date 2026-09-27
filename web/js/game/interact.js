// Interactions on foot: what the player looks at (part slots, pintle MG, crane stands, pickups) and the F key.
import * as THREE from 'three';
import { PART_NAMES, ORIGIN_NAMES, partLabel } from '../parts.js';
import { WEAPONS } from '../weapons.js';

export function createInteract(ctx) {
  const { camera, closeCrane, closeStash, items, loadShells, msg, openCrane, openStash, placeSandbag, player, sfx, state, tanks, workshop } = ctx;

  // ================== interactions (on foot) ==================
  // part slots of a tank the player can point at: [{ kind, pos (world), r }]
  function tankSlots(t) {
    const h = t.hull;
    const res = [
      { kind: 'engine', pos: t.root.localToWorld(h.bay.center.clone().setY(h.bay.center.y + 0.1)), r: 1.0 },
      { kind: 'fuel', pos: t.root.localToWorld(h.fuelAt.clone()), r: 0.85 },
    ];
    if (t.canMountGun()) res.push({ kind: 'gun', pos: t.gun.localToWorld(new THREE.Vector3(0, 0, 0.5)), r: 0.75 });
    if (!t.wrecked) res.push({ kind: 'mg', pos: t.mgPivot.localToWorld(new THREE.Vector3(0, 0, t.mg ? 0.2 : 0)), r: 0.5 });
    if (!t.turretless && !t.parts.turret) res.push({ kind: 'drive', pos: t.root.localToWorld(h.ring.pos.clone()), r: 1.1 });
    return res;
  }

  const _look = new THREE.Vector3(), _rel = new THREE.Vector3();
  // how well the view ray points at a sphere (p, r) within reach: 0 = dead centre, <1 = hit, null = miss
  function lookHit(p, r, maxD = 5.5) {
    _rel.copy(p).sub(camera.position);
    const t = _rel.dot(_look);
    if (t < 0 || t > maxD) return null;
    const k = _rel.addScaledVector(_look, -t).length() / r;
    return k < 1 ? k : null;
  }

  function updateLookTarget() {
    camera.getWorldDirection(_look);
    let best = null, bk = Infinity;
    for (const t of tanks) {
      if (t.root.position.distanceTo(player.position) > 14) continue;
      for (const sl of tankSlots(t)) {
        const k = lookHit(sl.pos, sl.r);
        if (k !== null && k < bk) { bk = k; best = { ...sl, tank: t }; }
      }
    }
    // gun slots of turrets lying on the repair-station stands
    for (const st of workshop.standGunSlots()) {
      if (st.pos.distanceTo(player.position) > 8) continue;
      const k = lookHit(st.pos, 0.75);
      if (k !== null && k < bk) { bk = k; best = { kind: 'gun', pos: st.pos, stand: st }; }
    }
    let item = null, ik = Infinity;
    if (!items.hands) {
      const c = new THREE.Vector3();
      for (const p of items.pickups.values()) {
        if (Math.hypot(p.pos.x - player.position.x, p.pos.z - player.position.z) > 4) continue;
        const k = lookHit(c.set(p.pos.x, p.pos.y + 0.4, p.pos.z), p.type === 'part' ? 1.0 : 0.7);
        if (k !== null && k < ik) { ik = k; item = p; }
      }
      if (!item && !best) item = items.nearest(player.position);
    }
    if (item && best && ik < bk) best = null;
    if (best) item = null;
    state.slot = best;
    state.nearItem = item;
  }

  const partName = (kind, key) => `${PART_NAMES[kind].toLowerCase()} ${ORIGIN_NAMES[key]}`;

  // gun of a turret lying on a crane stand
  function standGunAction(st) {
    const it = st.item;
    if (items.hands === 'part') {
      const part = items.handPart;
      if (part.kind !== 'gun') { msg('Сюда ставится только орудие'); return; }
      if (it.gun) { msg(`Место занято — сначала сними ${partName('gun', it.gun.key)}`); return; }
      items.releasePart();
      workshop.mountGun(st.crane, st.slot, part);
      sfx.click();
      msg(`Установлено: ${partLabel(part)} в башню ${ORIGIN_NAMES[it.turret.key]} на площадке ${st.slot + 1}`, '#9fe07f');
      return;
    }
    if (!it.gun) { msg(`Башня ${ORIGIN_NAMES[it.turret.key]}: орудия нет — принеси подходящее`); return; }
    const gun = workshop.takeGun(st.crane, st.slot);
    items.holdPart(gun, camera);
    sfx.click();
    msg(`В руках: ${partLabel(gun)} — ${Math.round(gun.hp)}%`, '#e8c96a');
  }

  // machine gun on the pintle: take it off (into the big-weapon slot, filled from the tank's belts) / mount one
  function mgAction(t) {
    if (!t.mg) {
      const b = items.big;
      if (!b || WEAPONS[b.key].cat !== 'mg') { msg('Пулемёта нет — поставить можно пулемёт (большое оружие), F'); return; }
      items.big = null;
      if (items.drawn === 'big') items.drawn = null;
      t.setMG(b);
      sfx.click();
      msg(`Установлен пулемёт ${WEAPONS[b.key].name} на ${t.def.name} — питание от патронов ${WEAPONS[b.key].cal} в укладке (${t.mgAmmo})`, '#9fe07f');
      return;
    }
    if (items.big && WEAPONS[items.big.key].cat !== 'mg') {
      msg(`Место для большого оружия занято (${WEAPONS[items.big.key].name}) — положи его в танк или брось (G)`);
      return;
    }
    const w = t.mg, W = WEAPONS[w.key];
    const n = Math.min(W.mag - w.mag, t.cargo.ammo[W.cal] || 0);
    w.mag += n;
    t.cargo.ammo[W.cal] = (t.cargo.ammo[W.cal] || 0) - n;
    const old = items.big;
    t.setMG(old);
    items.big = w;
    items.drawn = 'big';
    state.reloadT = 0;
    sfx.click();
    msg(`Снят пулемёт ${W.name} (${w.mag}/${W.mag})` + (old ? ` — вместо него поставлен ${WEAPONS[old.key].name}` : ''), '#e8c96a');
  }

  function slotAction(sl) {
    if (sl.stand) { standGunAction(sl.stand); return; }
    const t = sl.tank, kind = sl.kind;
    if (t.crew) { msg('В этом танке живой экипаж!', '#ff9a7a'); return; }
    if (kind === 'mg') { mgAction(t); return; }
    if (kind === 'engine' && !t.bayOpen) { t.setBay(true); sfx.click(); msg(`Моторный отсек ${t.def.hullName} открыт`); return; }
    const part = t.parts[kind];
    if (!part) { msg(`${PART_NAMES[kind]}: пусто — принеси подходящую деталь`); return; }
    if (t.craneLock) { msg('Идёт работа крана'); return; }
    t.setPart(kind, null);
    items.holdPart(part, camera);
    sfx.click();
    msg(`В руках: ${partLabel(part)} — ${Math.round(part.hp)}%`, '#e8c96a');
  }

  function installHeld() {
    const part = items.handPart;
    const sl = state.slot;
    if (sl && sl.stand) { standGunAction(sl.stand); return; }
    if (!sl || sl.kind !== part.kind) {
      msg(`Подойди к месту установки: ${PART_NAMES[part.kind].toLowerCase()}`);
      return;
    }
    const t = sl.tank;
    if (t.crew) { msg('В этом танке живой экипаж!', '#ff9a7a'); return; }
    if (t.parts[part.kind]) { msg(`Место занято — сначала сними ${partName(part.kind, t.parts[part.kind].key)}`); return; }
    if (part.kind === 'engine' && !t.bayOpen) { msg('Открой моторный отсек (Q или F)'); return; }
    items.releasePart();
    t.setPart(part.kind, part);
    sfx.click();
    let note = '';
    if (part.kind === 'drive' && t.parts.turret && !t.def.driveOk) note = ' — к башне не подходит, нужна башня ' + ORIGIN_NAMES[part.key];
    msg(`Установлено: ${partLabel(part)} в ${t.def.hullName}${note}`, note ? '#e8c96a' : '#9fe07f');
  }

  function pressF() {
    if (state.mode === 'drive') {
      const v = state.vehicle;
      if (!v.fire || v.fire.selfOut) { msg('Пожара нет'); return; }
      if (v.fire.extinguish > 0) return;
      if (v.extinguishers <= 0) { msg('Огнетушители пусты!', '#ff5a3a'); return; }
      v.extinguishers--;
      v.fire.extinguish = 1.5;
      sfx.hiss();
      msg('Огнетушитель сработал...');
      return;
    }
    if (state.crane) { closeCrane(); return; }
    if (items.hands === 'plate') return;         // welding is a hold action
    if (items.hands === 'canister') { if (!state.nearTank) msg('Подойди к танку и удерживай F — залить топливо'); return; }
    if (items.hands === 'sandbag') {
      const t = state.nearTank;
      if (t && !t.wrecked && !t.crew) placeSandbag(t); else msg('Подойди к танку, чтобы положить мешок');
      return;
    }
    if (items.hands === 'shells') {
      const t = state.nearTank;
      if (t && !t.wrecked && !t.crew) loadShells(t); else msg('Подойди к танку, чтобы зарядить снаряды');
      return;
    }
    if (items.hands === 'part') { installHeld(); return; }
    if (state.nearPanel && !state.slot) { openCrane(state.nearPanel); return; }
    const it = state.nearItem;
    if (it) {
      const name = items.take(it, camera);
      if (name) { msg(`Подобрано: ${name}`, '#e8c96a'); sfx.click(); }
      return;
    }
    if (state.slot) { slotAction(state.slot); return; }
    const t = state.nearTank;
    if (t && !t.crew) {
      if (t.wrecked) { msg('Танк сгорел — внутри ничего не уцелело'); return; }
      if (state.stash === t) closeStash(); else openStash(t);
    }
  }

  return { updateLookTarget, partName, mgAction, pressF };
}
