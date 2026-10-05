// Driving a train: taking the driver's place in the cab of an engine whose crew is gone (E beside the cab), the
// controls (W/S the regulator - below zero it backs, SPACE the brake, H the whistle / horn, V cab / outside view, mouse
// looks around, E gets off when slow), the cameras, the instruments, the prompts on foot.
import * as THREE from 'three';
import { WATER_LEVEL } from '../world.js';

const MOUSE = 0.0021;

export function createRail(ctx) {
  const { state, keys, camera, player, world, trains, msg, sfx } = ctx;
  const $ = id => document.getElementById(id);
  let view = 'cab';
  const look = { yaw: 0, pitch: -0.05 };
  const camPos = new THREE.Vector3();
  const target = new THREE.Vector3();             // where the enemy aims at the driver (his chest)
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

  // ------------------------------------------------ on foot beside an engine
  // the engine whose cab is within reach of pos: { train, side } or null
  function nearCab(pos) {
    let best = null, bd = 1e9;
    for (const t of trains.list) {
      if (t.puppet) continue;
      for (const v of t.vehicles) {
        if (!v.loco) continue;
        const eye = t.def.eye;
        const o = v.root.position;
        const dx = pos.x - o.x, dz = pos.z - o.z, c = Math.cos(v.heading), s = Math.sin(v.heading);
        let lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (v.flip) { lx = -lx; lz = -lz; }
        const ex = Math.max(0, Math.abs(lx) - (v.hw + 2.2)), ez = Math.max(0, Math.abs(lz - eye[2]) - 1.8);
        if (ex > 0 || ez > 0 || pos.y < o.y - 3 || pos.y > o.y + 3.5) continue;
        const d = Math.abs(lz - eye[2]) + Math.max(0, Math.abs(lx) - v.hw);
        if (d < bd) { bd = d; best = { train: t, v, side: lx >= 0 ? 1 : -1 }; }
      }
    }
    return best;
  }
  function prompt() {
    if (state.mode !== 'walk' || state.para) return null;
    const c = nearCab(player.position);
    if (!c) return null;
    const t = c.train;
    if (t.wrecked) return `${t.def.name}: паровоз разбит`.replace('паровоз', t.def.type === 'steam' ? 'паровоз' : 'тепловоз');
    if (t.crewAlive) return `${t.def.name}: в кабине бригада противника`;
    if (Math.abs(t.speed) > 4) return `${t.def.name}: поезд идёт слишком быстро`;
    return `<b>E</b> — занять место машиниста: ${t.def.name} (${t.def.year})`;
  }
  // E on foot: into the cab (true if it was about a train)
  function tryEnter() {
    const c = nearCab(player.position);
    if (!c) return false;
    const t = c.train;
    if (t.wrecked) { msg(`${t.def.name} разбит — не поедет`); return true; }
    if (t.crewAlive) { msg('В кабине живая бригада противника!', '#ff9a7a'); return true; }
    if (Math.abs(t.speed) > 4) { msg('Поезд идёт слишком быстро — не запрыгнуть'); return true; }
    if (ctx.net && ctx.net() && ctx.net().connected && !ctx.net().host) { msg('В сетевой игре поездами управляет хозяин игры'); return true; }
    ctx.closeMenus();
    state.mode = 'train';
    state.train = t;
    state.trainSide = c.side;
    t.player = true;
    t.team = 'player';
    t.ctl.throttle = 0;
    t.ctl.brake = 0;
    look.yaw = 0; look.pitch = -0.05;
    state.fireHeld = false; state.aim = false; state.crouch = false;
    camPos.copy(camera.position);
    $('crosshair').classList.add('driving');
    msg(`${t.def.name} (${t.def.year}): W/S — регулятор (меньше нуля — назад), ПРОБЕЛ — тормоз, H — ${t.def.type === 'steam' ? 'гудок' : 'сигнал'}, V — вид, E — сойти`, '#c9b48a');
    if (t.vehicles.length > 1) msg(`Состав: ${t.vehicles.length} ед., ${Math.round(t.len)} м, ${Math.round(t.mass)} т`, '#c9b48a');
    return true;
  }
  // off the train beside the cab (force: wherever it is)
  function leave(force = false) {
    const t = state.train;
    if (!t) return;
    if (!force && Math.abs(t.speed) > 2.5) { msg('Сначала остановите поезд (ПРОБЕЛ — тормоз)'); return; }
    const v = t.loco, eye = t.def.eye;
    for (const side of [state.trainSide || 1, -(state.trainSide || 1)]) {
      const p = t.local(v, side * (v.hw + 1.2), 0, eye[2], _v);
      p.y = world.groundAt(p.x, p.z);
      if (!force && p.y < WATER_LEVEL - 0.3) continue;
      player.position.copy(p);
      break;
    }
    t.player = false;
    t.ctl.throttle = 0;
    t.ctl.brake = 1;
    state.mode = 'walk';
    state.train = null;
    state.velY = 0;
    state.yaw = v.heading + (v.flip ? Math.PI : 0) + look.yaw;
    state.pitch = 0;
    camera.up.set(0, 1, 0);
    $('crosshair').classList.remove('driving');
    hideHud();
    sfx.setEngine(false, 0);
  }

  // ------------------------------------------------ controls
  function mouse(dx, dy) {
    look.yaw = Math.max(-2.6, Math.min(2.6, look.yaw - dx * MOUSE));
    look.pitch = Math.max(-1.0, Math.min(0.8, look.pitch - dy * MOUSE));
  }
  function key(code) {
    const t = state.train;
    if (!t) return;
    if (code === 'KeyE') leave();
    else if (code === 'KeyV') { view = view === 'cab' ? 'out' : 'cab'; msg(view === 'cab' ? 'Вид из кабины' : 'Вид снаружи'); }
    else if (code === 'KeyH') sfx.whistle(0, t.def.whistle, 1.6);
  }
  function update(dt) {
    const t = state.train;
    if (!t) return;
    if (t.removed) { state.train = null; state.mode = 'walk'; return; }
    const c = t.ctl;
    if (!state.paused && !state.spawnOpen) {
      if (keys.KeyW) c.throttle = Math.min(1, c.throttle + dt * 0.45);
      if (keys.KeyS) c.throttle = Math.max(-1, c.throttle - dt * 0.45);
      if (Math.abs(c.throttle) < 0.03 && !keys.KeyW && !keys.KeyS) c.throttle = 0;
      c.brake = keys.Space ? 1 : 0;
    }
    if (t.wrecked) c.throttle = 0;
    // the driver's place: saves, the partner's respawn point, the enemy's aim
    const v = t.loco, eye = t.def.eye;
    t.local(v, eye[0], eye[1] - 1.55, eye[2], player.position);
    target.copy(player.position).setY(player.position.y + 0.2);
    sfx.setEngine(t.def.type === 'diesel' && !t.wrecked, Math.min(1, 0.2 + Math.abs(c.throttle) * 0.8));
  }
  // the eye in the cab (world)
  function eyePos(out) { const t = state.train, e = t.def.eye; return t.local(t.loco, e[0], e[1], e[2], out); }

  // ------------------------------------------------ cameras
  function updateCamera(dt) {
    const t = state.train;
    if (!t) return;
    const v = t.loco;
    const hd = v.heading;
    if (view === 'cab') {
      if (camera.near !== 0.05) { camera.near = 0.05; camera.updateProjectionMatrix(); }
      eyePos(camera.position);
      v.root.getWorldQuaternion(_q);
      _e.set(-look.pitch, look.yaw, 0, 'YXZ');
      camera.quaternion.copy(_q).multiply(new THREE.Quaternion().setFromEuler(_e)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      camera.up.set(0, 1, 0);
    } else {
      if (camera.near !== 0.1) { camera.near = 0.1; camera.updateProjectionMatrix(); }
      const a = hd + Math.PI + look.yaw * 1.2;
      const dist = 16 + Math.min(10, Math.abs(t.speed) * 0.3);
      const p = v.root.position;
      const want = _v.set(p.x + Math.sin(a) * dist, p.y + 6 + look.pitch * -8, p.z + Math.cos(a) * dist);
      const gh = Math.max(world.heightAt(want.x, want.z), WATER_LEVEL) + 1.5;
      if (want.y < gh) want.y = gh;
      camPos.lerp(want, 1 - Math.pow(0.0005, dt));
      camera.position.copy(camPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(p.x + Math.sin(hd) * 10, p.y + 2.5, p.z + Math.cos(hd) * 10);
    }
    const fov = 70;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
  }

  // ------------------------------------------------ instruments
  function hud() {
    const t = state.train, el = $('trainHud');
    if (!t) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const c = t.ctl, kmh = Math.abs(t.speed) * 3.6;
    const dirTxt = t.speed < -0.2 ? 'назад' : t.speed > 0.2 ? 'вперёд' : 'стоим';
    const L = t.line, st = L.station;
    let next = '';
    if (st) {
      const d = (st.s - t.s) * t.dir;
      if (d > -t.len && d < 3000) next = `<div class="gline"><span>ст. ${st.name}</span><b>${d > 0 ? Math.round(d) + ' м' : 'у платформы'}</b></div>`;
    }
    const end = t.dir * Math.sign(t.speed || 1) > 0 ? L.len - t.s : t.s - t.len;
    el.innerHTML = `<div class="fs">${kmh.toFixed(0)}<small> км/ч</small></div>` +
      `<div class="fn">${t.def.name} · ${L.name}</div>` +
      `<div class="gline"><span>Регулятор</span><b>${c.throttle < 0 ? 'назад ' : ''}${Math.round(Math.abs(c.throttle) * 100)}%</b></div>` +
      `<div class="gline"><span>Тормоз</span><b>${c.brake > 0 ? 'ТОРМОЗИМ' : 'отпущен'}</b></div>` +
      `<div class="gline"><span>Ход</span><b>${dirTxt}</b></div>` +
      `<div class="gline"><span>Состав</span><b>${t.vehicles.length} ед. · ${Math.round(t.mass)} т</b></div>` +
      `<div class="gline"><span>${t.def.type === 'steam' ? 'Паровоз' : 'Тепловоз'}</span><b>${Math.round(t.loco.hp)}%</b></div>` + next +
      (end < 400 ? `<div class="warn">Тупик через ${Math.max(0, Math.round(end))} м!</div>` : '') +
      (t.wrecked ? '<div class="warn">Локомотив разбит</div>' : '');
  }
  function hideHud() { $('trainHud').style.display = 'none'; }

  return { nearCab, prompt, tryEnter, leave, mouse, key, update, updateCamera, hud, hideHud, eyePos,
           get target() { return target; }, get view() { return view; } };
}
