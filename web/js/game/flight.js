// Flying: getting into a plane and out of it (on the ground), the controls (mouse = the stick, W/S throttle, A/D
// rudder, LMB guns, B bombs, SPACE wheel brakes, V chase / cockpit view, RMB look around), the cameras, bailing out
// (hold E in the air) and coming down under the parachute, the flight instruments.
import * as THREE from 'three';
import { WATER_LEVEL } from '../world.js';
import { Plane } from '../planes.js';
import { PLANES } from '../planedefs/index.js';

const STICK_K = 0.0032;                 // stick travel per pixel of mouse movement
const BAIL_HOLD = 0.6;                  // s of E held to jump out in the air

export function createFlight(ctx) {
  const { state, keys, camera, player, world, planes, guns, combat, fx, sfx, msg, damagePlayer, infantry } = ctx;
  const $ = id => document.getElementById(id);
  const stick = { x: 0, y: 0 };
  const look = { yaw: 0, pitch: 0 };       // free look (RMB) relative to the plane
  let view = 'chase', bailT = 0, gunT = 0;
  const camPos = new THREE.Vector3(), camQ = new THREE.Quaternion();
  const owner = { player: true, plane: null };
  // shells and bombs go through Combat.onFired first (network play passes them on)
  const shooter = { launch: s => { combat.onFired(s, null); combat.launch(s); } };

  // ------------------------------------------------ on foot near a plane
  // the plane whose fuselage is within reach of the player (or null)
  function nearPlane(pos) {
    let best = null, bd = 3.2;
    for (const p of planes) {
      if (p.remote || p.wrecked) continue;
      const f = new THREE.Vector3(0, 0, 1).applyQuaternion(p.q);
      const rel = pos.clone().sub(p.root.position);
      const along = THREE.MathUtils.clamp(rel.dot(f), -p.def.len * 0.45, p.def.len * 0.35);
      const d = rel.addScaledVector(f, -along).setY(0).length();
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function enter(p) {
    if (p.wrecked) { msg('Самолёт разбит'); return false; }
    if (p.remoteUse) { msg('В этом самолёте второй игрок'); return false; }
    ctx.closeMenus();
    state.mode = 'fly';
    state.plane = p;
    p.pilot = true;
    p.used = true;
    p.ctl.brake = 0;
    p.ctl.throttle = 0;
    stick.x = stick.y = 0;
    look.yaw = look.pitch = 0;
    owner.plane = p;
    state.fireHeld = false; state.aim = false; state.crouch = false;
    camPos.copy(p.local(new THREE.Vector3(0, 4, -14)));
    camQ.copy(camera.quaternion);
    $('crosshair').classList.add('driving');
    msg(`${p.def.name}: W/S — газ, мышь — ручка (тангаж / крен), A/D — руль направления, ЛКМ — огонь` +
      `${(p.def.bombs || []).length ? ', B — бомба' : ''}, ПРОБЕЛ — тормоз, V — вид, ПКМ — осмотреться, E (держать в воздухе) — прыжок с парашютом`, '#c9b48a');
    if (p.fuel <= 0) msg('Баки пусты — нужна заправка на аэродроме', '#ff9a7a');
    return true;
  }

  // out on the ground beside the cockpit
  function leave() {
    const p = state.plane;
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(p.q).setY(0).normalize();
    const out = p.root.position.clone().addScaledVector(side, 1.6 + p.def.span * 0.08);
    out.y = world.groundAt(out.x, out.z);
    player.position.copy(out);
    finish(p);
    state.yaw = p.heading;
    state.pitch = 0;
  }
  function finish(p) {
    p.pilot = false;
    p.ctl.throttle = 0; p.ctl.sx = p.ctl.sy = p.ctl.rud = 0;
    p.ctl.brake = 1;
    state.mode = 'walk';
    state.plane = null;
    state.velY = 0;
    camera.up.set(0, 1, 0);
    $('crosshair').classList.remove('driving');
    $('flight').style.display = 'none';
    $('gunMark').style.display = 'none';
    sfx.setEngine(false, 0);
  }

  // jump: the plane flies on without the pilot (nose slowly down), the player falls and opens the parachute
  function bailOut() {
    const p = state.plane;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(p.q);
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(p.q);
    player.position.copy(p.root.position).addScaledVector(up, 1.4).addScaledVector(side, 1.2);
    const vel = p.vel.clone().multiplyScalar(0.7).addScaledVector(up, 4);
    finish(p);
    p.ctl.sy = -0.25; p.ctl.throttle = Math.min(p.ctl.throttle, 0.5); p.ctl.brake = 0;
    p.pilot = false;
    p.abandoned = true;
    state.yaw = Math.atan2(vel.x, vel.z);
    state.pitch = -0.3;
    state.para = { vel, t: 0, open: 0, canopy: null };
    msg('Прыжок! Парашют раскроется сам (или ПРОБЕЛ). WASD — управлять куполом', '#e8c96a');
  }

  function pressE() {
    const p = state.plane;
    if (!p) return;
    if (p.onGround && p.speed < 4) { leave(); msg('Вы вышли из самолёта'); }
    else if (p.onGround) msg('Остановитесь, чтобы выйти (ПРОБЕЛ — тормоз)');
  }

  // ------------------------------------------------ controls
  function mouse(dx, dy) {
    if (state.aim) {                                    // RMB: look around
      look.yaw = THREE.MathUtils.clamp(look.yaw - dx * 0.003, -2.6, 2.6);
      look.pitch = THREE.MathUtils.clamp(look.pitch - dy * 0.003, -1.2, 1.2);
      return;
    }
    stick.x = THREE.MathUtils.clamp(stick.x + dx * STICK_K, -1, 1);
    stick.y = THREE.MathUtils.clamp(stick.y - dy * STICK_K, -1, 1);
  }
  function key(code) {
    const p = state.plane;
    if (!p) return false;
    if (code === 'KeyV') { view = view === 'chase' ? 'cockpit' : 'chase'; msg(view === 'chase' ? 'Вид сзади' : 'Вид из кабины'); return true; }
    if (code === 'KeyB') {
      if (!(p.def.bombs || []).length) msg('У этого самолёта нет бомб');
      else if (p.dropBomb(shooter, owner)) { sfx.click(); msg(`Бомба сброшена (осталось ${p.bombs})`, '#e8c96a'); }
      else msg('Бомбы кончились — пополнить на аэродроме', '#ff9a7a');
      return true;
    }
    if (code === 'KeyE') { pressE(); return true; }
    return false;
  }

  function update(dt) {
    const p = state.plane;
    if (!p) return;
    player.position.copy(p.root.position);               // (saves, the partner's respawn point)
    const c = p.ctl;
    if (!state.paused && !state.spawnOpen) {
      // throttle: W / S move it; the stick re-centres slowly; arrows work as a stick too
      if (keys.KeyW) c.throttle = Math.min(1, c.throttle + dt * 0.6);
      if (keys.KeyS) c.throttle = Math.max(0, c.throttle - dt * 0.6);
      if (keys.ArrowLeft) stick.x = Math.max(-1, stick.x - dt * 2.5);
      if (keys.ArrowRight) stick.x = Math.min(1, stick.x + dt * 2.5);
      if (keys.ArrowUp) stick.y = Math.max(-1, stick.y - dt * 2);
      if (keys.ArrowDown) stick.y = Math.min(1, stick.y + dt * 2);
      stick.x *= Math.exp(-dt * 0.8);
      stick.y *= Math.exp(-dt * 0.6);
      c.sx = stick.x; c.sy = stick.y;
      c.rud = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
      c.brake = keys.Space ? 1 : 0;
      if (!state.aim) { look.yaw *= Math.exp(-dt * 4); look.pitch *= Math.exp(-dt * 4); }
      // jump: hold E in the air
      if (keys.KeyE && !p.onGround) {
        bailT += dt;
        if (bailT > BAIL_HOLD) { bailT = 0; bailOut(); return; }
      } else bailT = 0;
      // guns
      if (state.fireHeld) {
        if (p.roundsLeft + p.shellsLeft <= 0) { if ((gunT -= dt) <= 0) { gunT = 3; msg('Патроны кончились — пополнить на аэродроме', '#ff9a7a'); } }
        else if (p.fire(dt, guns, shooter, owner)) infantry.noise(p.root.position, 300);
      }
    }
    // fuel / ammunition at an airfield (its fuel zone), standing still
    if (p.onGround && p.speed < 1 && ctx.zoneAt) {
      const z = ctx.zoneAt(p.root.position);
      if (z && z.type === 'airfield') rearm(p, dt);
    }
    sfx.setEngine(p.engineOn, Math.min(1, 0.25 + c.throttle * 0.75));
  }

  let rearmMsgT = 0;
  function rearm(p, dt) {
    const d = p.def;
    let busy = false;
    if (p.fuel < d.fuel) { p.fuel = Math.min(d.fuel, p.fuel + 25 * dt); busy = true; }
    d.guns.forEach((g, i) => { if (p.ammo[i] < g.n) { p.ammo[i] = Math.min(g.n, p.ammo[i] + 200 * dt); busy = true; } });
    (d.cannons || []).forEach((cn, i) => { if (p.shells[i] < cn.n) { p.shells[i] = Math.min(cn.n, p.shells[i] + 40 * dt); busy = true; } });
    if (p.bombs < (d.bombs || []).length && (rearmMsgT -= dt) <= 0) {
      p.bombs++;
      p.bombMeshes.forEach((m, i) => { m.visible = i >= (d.bombs || []).length - p.bombs; });
      busy = true;
    }
    if (p.hp < 100) { p.hp = Math.min(100, p.hp + 10 * dt); busy = true; }
    if (p.engineHp < 100) { p.engineHp = Math.min(100, p.engineHp + 10 * dt); busy = true; }
    if (busy && rearmMsgT <= 0) { rearmMsgT = 2.5; msg('Аэродром: заправка, боекомплект, ремонт...', '#9fe07f'); }
    if (!busy) p.ammo = p.ammo.map(Math.round);
  }

  // ------------------------------------------------ cameras
  function updateCamera(dt) {
    const p = state.plane;
    if (!p) return;
    const lookQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-look.pitch, look.yaw, 0, 'YXZ'));
    if (view === 'cockpit') {
      if (camera.near !== 0.05) { camera.near = 0.05; camera.updateProjectionMatrix(); }
      camera.position.copy(p.local(new THREE.Vector3(...p.def.seat)));
      camera.quaternion.copy(p.q).multiply(lookQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      camera.up.set(0, 1, 0).applyQuaternion(p.q);
    } else {
      if (camera.near !== 0.1) { camera.near = 0.1; camera.updateProjectionMatrix(); }
      // behind and above, following the plane's attitude with a little lag
      const dist = 9 + p.def.len * 0.9;
      const k = 1 - Math.pow(0.0004, dt);
      const tq = p.q.clone().multiply(lookQ);
      camQ.slerp(tq, k);
      const want = p.root.position.clone().add(new THREE.Vector3(0, 2.2 + p.def.len * 0.12, -dist).applyQuaternion(camQ));
      const gh = Math.max(world.heightAt(want.x, want.z), WATER_LEVEL) + 1.2;
      if (want.y < gh) want.y = gh;
      camPos.lerp(want, 1 - Math.pow(0.00002, dt));
      camera.position.copy(camPos);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
      camera.up.copy(up).lerp(new THREE.Vector3(0, 1, 0), 0.35).normalize();
      const at = p.root.position.clone().add(new THREE.Vector3(0, 1.2, 25).applyQuaternion(camQ));
      camera.lookAt(at);
    }
    const fov = 72;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
  }

  // ------------------------------------------------ parachute
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xd9d3bd, roughness: 0.9, side: THREE.DoubleSide });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x3a3630 });
  function canopyMesh() {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), canopyMat);
    dome.scale.y = 0.6;
    dome.castShadow = true;
    g.add(dome);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const top = new THREE.Vector3(Math.sin(a) * 2.6, 0.6, Math.cos(a) * 2.6), bot = new THREE.Vector3(0, -5.2, 0);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, top.distanceTo(bot), 3), lineMat);
      l.position.copy(top).add(bot).multiplyScalar(0.5);
      l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
      g.add(l);
    }
    ctx.scene.add(g);
    return g;
  }
  function dropCanopy(s) {
    if (s.canopy) { ctx.scene.remove(s.canopy); s.canopy = null; }
  }
  // the fall and the descent; returns the eye position (the camera is set like on foot)
  function updatePara(dt) {
    const s = state.para, p = player.position, v = s.vel;
    s.t += dt;
    if (!s.open && (s.t > 1.6 || (keys.Space && s.t > 0.3))) { s.open = 0.01; s.canopy = canopyMesh(); sfx.click(); msg('Парашют раскрылся', '#9fe07f'); }
    if (s.open) s.open = Math.min(1, s.open + dt / 1.3);
    const sp = v.length();
    if (!s.open) {
      v.y -= 9.81 * dt;
      v.multiplyScalar(1 - Math.min(0.5, 0.0032 * sp * dt));                      // free fall: terminal ~55 m/s
    } else {
      // under the canopy: the fall slows to ~5 m/s as it opens
      const k = s.open;
      v.y -= 9.81 * dt * (1 - k);
      v.y += (-5.2 - v.y) * Math.min(1, dt * 2.5 * k);
      let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), sd = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
      const tx = (f * sin - sd * cos) * 4.5, tz = (f * cos + sd * sin) * 4.5;
      v.x += (tx - v.x) * Math.min(1, dt * 0.9 * k);
      v.z += (tz - v.z) * Math.min(1, dt * 0.9 * k);
    }
    p.addScaledVector(v, dt);
    if (s.canopy) {
      s.canopy.position.set(p.x - v.x * 0.15, p.y + 1.5 + 5.6 * s.open, p.z - v.z * 0.15);
      s.canopy.scale.setScalar(0.25 + 0.75 * s.open);
    }
    const g = Math.max(world.groundAt(p.x, p.z, p.y + 0.5), world.heightAt(p.x, p.z) < WATER_LEVEL ? WATER_LEVEL - 1.2 : -1e9);
    if (p.y <= g) {
      const impact = -v.y;
      p.y = g;
      dropCanopy(s);
      state.para = null;
      state.velY = 0;
      if (impact > 14) damagePlayer(200);
      else if (impact > 7.5) { damagePlayer((impact - 7.5) * 14); msg('Жёсткое приземление!', '#ff9a7a'); }
      else msg('Приземлились', '#9fe07f');
    }
    camera.position.set(p.x, p.y + 1.7, p.z);
    camera.up.set(0, 1, 0);
    const dir = new THREE.Vector3(Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), Math.cos(state.yaw) * Math.cos(state.pitch));
    camera.lookAt(camera.position.clone().add(dir));
    if (camera.near !== 0.05) { camera.near = 0.05; camera.updateProjectionMatrix(); }
  }

  // ------------------------------------------------ crashes, hits (Plane.onEvent)
  Plane.onEvent = (p, kind, data) => {
    if (kind === 'crash') {
      const pos = p.root.position.clone();
      fx.explosion(pos.clone().setY(pos.y + 1), data.how === 'water' ? 1 : 2.2, data.how !== 'water');
      if (data.how === 'water') fx.splash(pos);
      sfx.boom(pos.distanceTo(camera.position), 1.2);
      if (data.how !== 'water') ctx.explosion(pos, 9, 220);
      if (p === state.plane) {
        if (data.speed < 18 && data.how !== 'water') { leave(); damagePlayer(45); msg('Самолёт разбит, вы выбрались', '#ff9a7a'); }
        else { finish(p); ctx.gameOver('Самолёт разбился.'); }
      } else if (p.abandoned) msg(`${p.def.name} разбился без пилота`, '#c9b48a');
    } else if (kind === 'broken' && p === state.plane) msg('Самолёт разваливается! Прыгай — держи E!', '#ff5a3a');
    else if (kind === 'hit' && p === state.plane && Math.random() < 0.25) {
      if (Math.random() < 0.3) damagePlayer(data * 0.25, true);
      msg('Попадание в самолёт!', '#ff9a7a');
    } else if (kind === 'bump' && p === state.plane) msg('Жёсткая посадка', '#e8c96a');
  };

  // the player is killed in the plane (network play): it flies on without him
  function abandon() {
    const p = state.plane;
    if (!p) return;
    finish(p);
    p.abandoned = true;
    p.ctl.sy = -0.3; p.ctl.throttle = 0.3; p.ctl.brake = 0;
  }
  // a saved game goes on under the parachute
  function startPara(vel, open) {
    state.para = { vel, t: 2, open, canopy: open ? canopyMesh() : null };
  }
  function cutPara() {
    if (!state.para) return;
    dropCanopy(state.para);
    state.para = null;
  }

  // ------------------------------------------------ HUD
  const aimV = new THREE.Vector3();
  // every frame: the stick and the point where the guns meet
  function hudMarks() {
    const p = state.plane;
    if (!p) return;
    const sm = $('stickMark');
    sm.style.display = 'block';
    sm.style.transform = `translate(${stick.x * 40}px, ${-stick.y * 40}px)`;
    const gm = $('gunMark');
    aimV.copy(p.local(new THREE.Vector3(0, 0, 220))).project(camera);
    if (aimV.z < 1) {
      gm.style.display = 'block';
      gm.className = 'ready';
      gm.style.setProperty('--p', '100%');
      gm.style.left = `${(aimV.x * 0.5 + 0.5) * innerWidth}px`;
      gm.style.top = `${(-aimV.y * 0.5 + 0.5) * innerHeight}px`;
    } else gm.style.display = 'none';
  }
  // the instruments (15 times a second)
  function hud() {
    const p = state.plane, el = $('flight');
    if (!p) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const v = p.speed * 3.6, d = p.def;
    const stall = !p.onGround && p.speed < d.vstall * 1.05;
    const gunsTxt = d.guns.length ? `${Math.round(p.roundsLeft)}` : '—';
    el.innerHTML = `<div class="fs">${v.toFixed(0)}<small> км/ч</small></div>` +
      `<div class="fn">${d.name}</div>` +
      `<div class="gline"><span>Высота</span><b>${Math.max(0, p.alt).toFixed(0)} м</b></div>` +
      `<div class="gline"><span>Газ</span><b>${Math.round(p.ctl.throttle * 100)}%</b></div>` +
      `<div class="gline"><span>Топливо</span><b>${p.fuel.toFixed(0)} / ${d.fuel} л</b></div>` +
      `<div class="gline"><span>Патроны</span><b>${gunsTxt}${d.cannons ? ` · снаряды ${Math.round(p.shellsLeft)}` : ''}</b></div>` +
      ((d.bombs || []).length ? `<div class="gline"><span>Бомбы</span><b>${p.bombs}</b></div>` : '') +
      `<div class="gline"><span>Мотор / планер</span><b>${Math.max(0, p.engineHp).toFixed(0)}% / ${Math.max(0, p.hp).toFixed(0)}%</b></div>` +
      (d.retract ? `<div class="gline"><span>Шасси</span><b>${p.gearDown ? 'выпущено' : 'убрано'}</b></div>` : '') +
      (stall ? '<div class="warn">СВАЛИВАНИЕ — отдай ручку от себя!</div>' : '') +
      (p.burning > 0 ? '<div class="warn">ПОЖАР!</div>' : '') +
      (bailT > 0 ? '<div class="warn">прыжок...</div>' : '');
  }
  function hideHud() {
    $('flight').style.display = 'none';
    $('stickMark').style.display = 'none';
  }

  // ------------------------------------------------ spawning
  /** @param {{ id?: string, air?: boolean, quat?: number[], pos?: number[], vel?: number[], home?: number, [k: string]: any }} [opts] */
  function spawnPlane(key, x, z, heading, opts = {}) {
    if (!PLANES[key]) return null;
    const p = new Plane(ctx.scene, key, new THREE.Vector3(x, 0, z), heading, opts);
    if (!opts.air && !opts.quat) p.setGroundPose(heading, world);
    else if (opts.pos) p.root.position.fromArray(opts.pos);
    planes.push(p);
    return p;
  }
  function removePlane(p) {
    p.dispose();
    const i = planes.indexOf(p);
    if (i >= 0) planes.splice(i, 1);
  }

  return { nearPlane, enter, leave, bailOut, abandon, startPara, cutPara, pressE, mouse, key, update, updateCamera, updatePara, hud, hudMarks, hideHud,
           spawnPlane, removePlane,
           get view() { return view; }, owner };
}
