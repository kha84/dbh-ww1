// Small arms in the player's hands: weapon choice, reload, shooting, grenades, the first-person view model.
import * as THREE from 'three';
import { WEAPONS, GRENADES } from '../weapons.js';

export function createSmallArms(ctx) {
  const { PLAYER_SPEED, camera, guns, items, keys, msg, playerVel, sfx, state, troopShoot, viewModel } = ctx;

  // ================== small arms on foot ==================
  const SLOT_NAMES = ['small', 'big', 'grenade'];
  function selectWeapon(i) {
    const slot = SLOT_NAMES[i];
    if (items.hands) { msg('Руки заняты — сначала брось или уложи ношу (G / E)'); return; }
    state.reloadT = 0;
    if (slot === 'grenade') {
      const ks = Object.keys(items.grenades).filter(k => items.grenades[k] > 0);
      if (!ks.length) { msg('Гранат нет'); return; }
      if (items.drawn === 'grenade' && ks.length > 1) items.grenadeKey = ks[(ks.indexOf(items.grenadeKey) + 1) % ks.length];
      else if (!ks.includes(items.grenadeKey)) items.grenadeKey = ks[0];
      items.drawn = 'grenade';
      msg(`Граната: ${GRENADES[items.grenadeKey].name} (${items.grenades[items.grenadeKey]})` + (ks.length > 1 ? ' — 3 ещё раз: другая' : ''), '#c9b48a');
      return;
    }
    if (!items[slot]) { msg(slot === 'small' ? 'Малого оружия нет (пистолет, револьвер, ПП)' : 'Большого оружия нет (винтовка, автомат, пулемёт)'); return; }
    items.drawn = items.drawn === slot ? null : slot;
  }

  function startReload() {
    const d = items.drawnWeapon();
    if (!d || items.hands || state.reloadT > 0) return false;
    const { w, W } = d;
    if (w.mag >= W.mag) return false;
    if (!(items.ammo[W.cal] > 0)) { msg(`Нет патронов ${W.cal}`); return false; }
    state.reloadT = W.reload;
    sfx.reload();
    return true;
  }
  function finishReload() {
    const d = items.drawnWeapon();
    if (!d) return;
    const { w, W } = d;
    const n = Math.min(W.mag - w.mag, items.ammo[W.cal] || 0);
    w.mag += n;
    items.ammo[W.cal] -= n;
  }

  function lookDir(out = new THREE.Vector3()) { return camera.getWorldDirection(out); }

  function shootWeapon(w, W) {
    state.fireLatch = true;
    state.wCool += 60 / W.rpm;
    w.mag--;
    const moving = Math.min(1, playerVel.length() / PLAYER_SPEED);
    let sp = (state.aim ? W.aim : W.spread) * (1 + moving * 1.5) * (state.crouch ? 0.7 : 1);
    const dir = lookDir();
    dir.x += (Math.random() - 0.5) * 2 * sp; dir.y += (Math.random() - 0.5) * 2 * sp; dir.z += (Math.random() - 0.5) * 2 * sp;
    dir.normalize();
    const muzzle = viewModel.muzzleWorld();
    const riding = state.mode === 'drive' ? state.vehicle : null;
    guns.fire(camera.position.clone(), dir, W, riding ? { player: true, tank: riding } : { player: true }, muzzle, W.cat !== 'rifle');
    // recoil
    const kick = W.recoil * (state.aim ? 0.55 : 1) * (0.7 + Math.random() * 0.6), side = (Math.random() - 0.5) * W.recoil * 0.5;
    if (riding) { state.headPitch = Math.min(0.9, state.headPitch + kick); state.headYaw += side; }
    else { state.pitch = Math.min(1.45, state.pitch + kick); state.yaw += side; }
    state.kick = 1;
    if (w.mag <= 0) startReload();
  }

  function throwGrenade() {
    const key = items.grenadeKey;
    if (!key || !(items.grenades[key] > 0)) { msg('Гранат нет'); items.drawn = null; return; }
    const dir = lookDir();
    const vel = dir.clone().multiplyScalar(state.aim ? 19 : 15).add(new THREE.Vector3(0, 3.5, 0))
      .add(state.mode === 'drive' ? state.vehicle.velocity : playerVel);
    guns.throwGrenade(camera.position.clone().addScaledVector(dir, 0.5), vel, key, { player: true });
    items.grenades[key]--;
    state.wCool = 0.9;
    state.kick = 1;
    if (!items.grenades[key]) {
      const ks = Object.keys(items.grenades).filter(k => items.grenades[k] > 0);
      items.grenadeKey = ks[0] || null;
      if (!ks.length) items.drawn = null;
    }
  }

  function updateWeapon(dt) {
    if (state.wCool > 0) state.wCool -= dt;
    if (state.reloadT > 0) { state.reloadT -= dt; if (state.reloadT <= 0) { state.reloadT = 0; finishReload(); } }
    const busy = !!items.hands || state.repairOpen || !!state.crane || !!state.stash || (!ctx.locked && !state.noLock);
    if (!busy && state.fireHeld && state.wCool <= 0) {
      if (items.drawn === 'grenade') { if (!state.fireLatch) { state.fireLatch = true; throwGrenade(); } }
      else {
        const d = items.drawnWeapon();
        // fast-firing guns may fire several rounds in one frame
        for (let k = 0; k < 3 && d && state.wCool <= 0 && state.reloadT <= 0 && (d.W.auto || !state.fireLatch); k++) {
          if (d.w.mag > 0) shootWeapon(d.w, d.W);
          else { if (!state.fireLatch) { state.fireLatch = true; if (!startReload()) sfx.click(); } break; }
        }
      }
    }
    if (!state.fireHeld) state.fireLatch = false;
    if (state.wCool < 0 && !state.fireHeld) state.wCool = 0;
    updateViewModel(dt);
  }

  // first-person weapon model (viewmodel.js): hip / aimed pose, recoil kick, reload dip, bob and sway
  function updateViewModel(dt) {
    const walking = state.mode === 'walk' || troopShoot();
    const d = items.drawnWeapon();
    const key = !walking || items.hands ? null : items.drawn === 'grenade' ? (items.grenadeKey ? 'g:' + items.grenadeKey : null) : d ? d.w.key : null;
    viewModel.set(key);
    state.kick *= Math.pow(0.001, dt);
    const run = (keys['ShiftLeft'] || keys['ShiftRight']) && !state.crouch;
    const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    viewModel.update(dt, {
      speed: playerVel.length(), run, crouch: state.crouch, strafe, aim: state.aim, kick: state.kick,
      reload: state.reloadT > 0, onGround: state.onGround, time: state.time,
    });
    state.aimK = viewModel.aimK;
  }

  function toggleTankWeapon() {
    const v = state.vehicle;
    if (!v.mg) { msg('На танке нет пулемёта'); state.wsel = 'gun'; return; }
    if (!v.parts.gun && !v.canMountGun()) { state.wsel = 'mg'; msg(`Только пулемёт ${WEAPONS[v.mg.key].name} (${v.mgAmmo} патр.)`, '#c9b48a'); return; }
    state.wsel = state.wsel === 'gun' ? 'mg' : 'gun';
    state.mgHeld = false;
    msg(state.wsel === 'mg' ? `Пулемёт ${WEAPONS[v.mg.key].name} (${v.mgAmmo} патр.)` : `Орудие ${v.def.caliber}`, '#c9b48a');
  }

  return { selectWeapon, startReload, lookDir, updateWeapon, updateViewModel, toggleTankWeapon };
}
