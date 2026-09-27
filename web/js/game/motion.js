// Movement and cameras: walking on foot, driving controls, the third-person / gunner-sight / inside cameras.
import * as THREE from 'three';
import { WATER_LEVEL, pushOut } from '../world.js';
import { HULLS } from '../parts.js';
import { WEAPONS, isSmall } from '../weapons.js';
import { clampToBounds } from '../modes.js';

export function createMotion(ctx) {
  const { BASE_FOV, GRAVITY, JUMP_V, PLAYER_RUN, PLAYER_SPEED, cabinLight, camera, canDrive, canGun, ceilingAt, combat, damagePlayer, guns, infantry, items, keys, msg, player, playerVel, raycast, seatByRole, sfx, standUp, state, tankDist, tankObstacle, tanks, troopShoot, world } = ctx;

  // ================== player movement ==================
  function updateWalk(dt) {
    const carrying = !!items.hands;
    const run = (keys['ShiftLeft'] || keys['ShiftRight']) && !carrying;
    let speed = state.crouch ? PLAYER_SPEED * 0.5 : (run ? PLAYER_RUN : PLAYER_SPEED);
    speed *= items.carrySpeed();

    let f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    let s = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    if (state.repairOpen || state.crane || state.dead) f = s = 0;
    const len = Math.hypot(f, s);
    if (len > 0) { f /= len; s /= len; }
    const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
    const wx = f * sin - s * cos;
    const wz = f * cos + s * sin;

    const p = player.position;
    const ox = p.x, oz = p.z;
    const ground0 = world.heightAt(p.x, p.z);
    const inWater = ground0 < WATER_LEVEL - 0.2 && p.y < WATER_LEVEL;
    const k = inWater ? 0.45 : 1;
    p.x += wx * speed * k * dt;
    p.z += wz * speed * k * dt;
    if (world.heightAt(p.x, p.z) < WATER_LEVEL - 1.6) { p.x = ox; p.z = oz; }

    world.collideTrees(p, 0.35);
    world.collideObstacles(p, 0.4);
    clampToBounds(world, p, 2);
    if (state.runOverT > 0) state.runOverT -= dt;
    for (const t of tanks) {
      const td = tankDist(t, p);
      if (td < 0.45 && Math.abs(t.speed) > 2.5 && state.runOverT <= 0) {
        state.runOverT = 1;
        damagePlayer(20 + Math.abs(t.speed) * 6);
        msg('Вас сбил танк!', '#ff9a7a');
      }
      if (td < 1.5) pushOut(tankObstacle(t), p, 0.4);
    }

    const ground = world.heightAt(p.x, p.z);
    state.velY -= GRAVITY * dt;
    p.y += state.velY * dt;
    if (p.y <= ground) { p.y = ground; state.velY = 0; state.onGround = true; }
    else state.onGround = false;
    if (keys['Space'] && state.onGround && !carrying) { state.velY = JUMP_V; state.onGround = false; }
    playerVel.set((p.x - ox) / dt, 0, (p.z - oz) / dt);

    const dw = items.drawnWeapon();
    const zoom = dw && !items.hands ? (dw.W.m.scope ? 24 : isSmall(dw.w.key) ? 60 : 52) : BASE_FOV;
    const fov = BASE_FOV + (zoom - BASE_FOV) * state.aimK;
    if (Math.abs(camera.fov - fov) > 0.01 || camera.near !== 0.05) { camera.fov = fov; camera.near = 0.05; camera.updateProjectionMatrix(); }
    const eyeY = p.y + (state.crouch ? 1.1 : 1.7);
    camera.position.set(p.x, eyeY, p.z);
    const dir = new THREE.Vector3(Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), Math.cos(state.yaw) * Math.cos(state.pitch));
    camera.lookAt(camera.position.clone().add(dir));
  }

  // ================== vehicle control / camera ==================
  const aimDir = new THREE.Vector3();
  let aimHit = null;

  function updateDriveControls() {
    const v = state.vehicle;
    const c = v.controls;
    const drive = canDrive() && !state.repairOpen;
    c.throttle = drive ? (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0) : 0;
    c.steer = drive ? (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0) : 0;
    c.brake = drive && keys['Space'] ? 1 : 0;
    if (canGun()) { if (aimHit) v.aimPoint = aimHit.point; }
    else v.aimPoint = null;
    v.mgTarget = canGun() && aimHit ? aimHit.point : null;
    if (!canGun()) state.sight = false;
    if (!v.mg && state.wsel === 'mg') state.wsel = 'gun';

    if (state.wsel === 'mg' && state.mgHeld) {
      if (!canGun()) { msg('Стрелять можно с места наводчика или командира (2 / 1)'); state.mgHeld = false; }
      else if (v.mgAmmo <= 0) { msg(`Патроны ${WEAPONS[v.mg.key].cal} к пулемёту кончились — уложи их в танк`, '#ff9a7a'); state.mgHeld = false; }
      else {
        for (let k = 0; k < 3; k++) {
          const sh = v.fireMG(state.sight ? 0.6 : 1);
          if (!sh) break;
          guns.fire(sh.origin, sh.dir, sh.W, { tank: v, player: true }, sh.origin, Math.random() < 0.6);
        }
      }
    }

    if (state.fireReq) {
      state.fireReq = false;
      if (!canGun()) msg('Стрелять можно с места наводчика или командира (2 / 1)');
      else if (!v.parts.gun) msg('Орудия нет!', '#ff9a7a');
      else if (v.hp.gun <= 0) msg('Орудие уничтожено!', '#ff9a7a');
      else if (v.ammo <= 0) msg('Снаряды кончились!', '#ff9a7a');
      else if (v.reload > 0) sfx.click();
      else if (combat.fireFrom(v)) infantry.noise(v.root.position, 280);
    }
  }

  function setNear(n) {
    if (camera.near !== n) { camera.near = n; camera.updateProjectionMatrix(); }
  }

  function updateDriveCamera(dt) {
    const v = state.vehicle;
    aimDir.set(Math.sin(state.aimYaw) * Math.cos(state.aimPitch), Math.sin(state.aimPitch), Math.cos(state.aimYaw) * Math.cos(state.aimPitch));
    const inside = state.view === 'inside';
    const dw = troopShoot() && state.aim && !items.hands ? items.drawnWeapon() : null;       // aiming from a troop seat
    const targetFov = state.sight ? 16 : dw ? (dw.W.m.scope ? 24 : 52) : inside ? 78 : BASE_FOV;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
      camera.updateProjectionMatrix();
    }
    cabinLight.intensity = 0;
    if (state.sight) {
      setNear(0.1);
      camera.up.set(0, 1, 0);
      camera.position.copy(v.sightWorld());
      camera.lookAt(camera.position.clone().add(aimDir));
    } else if (inside) {
      setNear(0.03);
      // eye point: a crew station or wherever we stand in the compartment
      let eye;
      const s = state.seat && seatByRole(v, state.seat);
      if (!s && state.seat) standUp();
      if (s) eye = v.seatObject(s).localToWorld(new THREE.Vector3(...s.eye));
      else {
        const I = HULLS[v.key].interior;
        const y = Math.min(I.floor + 1.5, ceilingAt(v, state.inPos.x, state.inPos.z) - 0.13);
        eye = v.root.localToWorld(new THREE.Vector3(state.inPos.x, y, state.inPos.z));
      }
      camera.position.copy(eye);
      camera.up.set(0, 1, 0).applyQuaternion(v.root.quaternion);
      let dir;
      if (canGun()) dir = aimDir;
      else {
        dir = new THREE.Vector3(Math.sin(state.headYaw) * Math.cos(state.headPitch), Math.sin(state.headPitch),
          Math.cos(state.headYaw) * Math.cos(state.headPitch)).applyQuaternion(v.root.quaternion);
        aimDir.copy(dir);
      }
      camera.lookAt(camera.position.clone().add(dir));
      cabinLight.position.copy(eye).addScaledVector(camera.up, 0.3).addScaledVector(dir, -0.25);
      cabinLight.intensity = 1.6;
    } else {
      setNear(0.1);
      camera.up.set(0, 1, 0);
      const pivot = v.root.position.clone();
      pivot.y += v.vis.hullBox.max.y + 2.2;
      const dist = 13 + v.vis.hullBox.max.z * 0.6;
      const cp = pivot.clone().addScaledVector(aimDir, -dist);
      cp.y += 1.5;
      const gh = world.heightAt(cp.x, cp.z) + 1.2;
      if (cp.y < gh) cp.y = gh;
      camera.position.lerp(cp, 1 - Math.pow(0.00005, dt));
      camera.lookAt(camera.position.clone().add(aimDir));
    }
    aimHit = raycast(camera.position, aimDir, 1400, v);
    // do not aim at points right behind the camera pivot / own tank
    if (aimHit.dist < 8) aimHit.point.copy(camera.position).addScaledVector(aimDir, 60);
  }

  return { updateWalk, aimDir, updateDriveControls, updateDriveCamera };
}
