// DBH-WW1 Three.js — main game orchestrator
import * as THREE from 'three';
import { World, WATER_LEVEL, segBox, pushOut } from './world.js';
import { TankFactory, Tank, TANK_DEFS, MODULE_IDS, MODULE_NAMES, SYSTEM_IDS, G } from './tanks.js';
import { Combat, Effects, describeHit } from './combat.js';
import { EnemyDirector } from './ai.js';
import { Items, ITEM_DEFS, buildItemMesh } from './items.js';
import { Sfx } from './audio.js';
import { SETTLEMENT_LABEL } from './settlements.js';

// debug flags: ?nowater=1 ?noclouds=1 ?notrees=1 ?notanks=1 ?noenemies=1 ?noshadows=1 ?nofog=1
//              ?waterred=1 ?watery=N ?noaa=1 ?logdepth=1 ?seed=N ?god=1 ?start=Z ?view=N
const dbg = new URLSearchParams(location.search);
const SEED = parseInt(dbg.get('seed') || '1337', 10);

// ================== state ==================
const state = {
  mode: 'walk',          // 'walk' | 'drive'
  vehicle: null,
  paused: false,
  started: false,
  over: false,
  yaw: 0, pitch: 0,              // on-foot look
  aimYaw: 0, aimPitch: -0.04,    // in-tank look / aim
  velY: 0, onGround: false, crouch: false,
  hp: 100, lastDamageT: -1e9,
  kills: 0, startZ: 0, maxZ: 0,
  sight: false, fireReq: false,
  hold: null,
  repairOpen: false, repairTarget: null,
  nearTank: null, nearItem: null,
  zone: null,
  time: 0,
};

const PLAYER_SPEED = 6;
const PLAYER_RUN = 11;
const JUMP_V = 7.5;
const GRAVITY = 20;
const MOUSE_SENS = 0.0021;
const TANK_REACH = 3.5;        // metres from hull surface for interactions

// ================== renderer / scene ==================
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: dbg.get('noaa') !== '1',
  powerPreference: 'high-performance',
  logarithmicDepthBuffer: dbg.get('logdepth') === '1',
  preserveDrawingBuffer: dbg.get('shot') === '1',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = dbg.get('noshadows') !== '1';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec8e8);

const world = new World(scene, SEED);
const VIEW_DIST = world.VIEW * 128;
if (dbg.get('nofog') !== '1') scene.fog = new THREE.Fog(0x9ec8e8, VIEW_DIST * 0.3, VIEW_DIST * 0.95);

const BASE_FOV = 70;
const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 1500);
scene.add(camera);   // camera children (plate in hands) must render

// ================== lights & sky ==================
const hemi = new THREE.HemisphereLight(0xbdd8f0, 0x5c6b4a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d9, 2.0);
sun.castShadow = dbg.get('noshadows') !== '1';
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 600;
const shadowRange = 140;
sun.shadow.camera.left = -shadowRange;
sun.shadow.camera.right = shadowRange;
sun.shadow.camera.top = shadowRange;
sun.shadow.camera.bottom = -shadowRange;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

// clouds: a sky dome of puffs that travels with the player
const clouds = new THREE.Group();
if (dbg.get('noclouds') !== '1') {
  const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 1, fog: false });
  const MAX_CLOUDS = 240;
  const im = new THREE.InstancedMesh(cloudGeo, cloudMat, MAX_CLOUDS);
  const m = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let used = 0;
  for (let i = 0; i < 48 && used < MAX_CLOUDS; i++) {
    const cx = (Math.random() - 0.5) * 1100, cz = (Math.random() - 0.5) * 1100, cy = 110 + Math.random() * 50;
    const n = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n && used < MAX_CLOUDS; j++) {
      s.set(14 + Math.random() * 22, 6 + Math.random() * 6, 12 + Math.random() * 18);
      v.set(cx + (Math.random() - 0.5) * 46, cy + (Math.random() - 0.5) * 8, cz + (Math.random() - 0.5) * 40);
      m.compose(v, q, s);
      im.setMatrixAt(used++, m);
    }
  }
  im.count = used;
  im.frustumCulled = false;
  clouds.add(im);
  scene.add(clouds);
}

// ================== world systems ==================
const fx = new Effects(scene);
const sfx = new Sfx();
const combat = new Combat(scene, world, fx, sfx);
combat.god = dbg.get('god') === '1';
const factory = new TankFactory();
const director = new EnemyDirector(world, factory, scene, SEED);
const items = new Items(scene, world);
const tanks = [];

world.onSettlementBuilt = s => { for (const it of s.items) items.add(it.id, it.type, it.x, it.z); };
world.onSettlementRemoved = s => { for (const it of s.items) items.remove(it.id, false); };

const player = new THREE.Object3D();
const playerVel = new THREE.Vector3();
scene.add(player);

// plate carried in hands (child of the camera)
const handPlate = buildItemMesh('plate');
handPlate.remove(handPlate.userData.glow);
handPlate.position.set(0.1, -0.95, -1.0);
handPlate.rotation.set(0.25, 0.2, -0.35);
handPlate.visible = false;
handPlate.traverse(o => { if (o.isMesh) o.castShadow = false; });
camera.add(handPlate);

function spawnTank(key, x, z, heading, opts) {
  if (!factory.available(key)) return null;
  const t = new Tank(scene, TANK_DEFS[key], factory.buildVisual(key), new THREE.Vector3(x, 0, z), heading, opts);
  tanks.push(t);
  return t;
}

function removeTank(t) {
  t.dispose();
  const i = tanks.indexOf(t);
  if (i >= 0) tanks.splice(i, 1);
  director.release(t);
}

// ================== messages / HUD helpers ==================
const $ = id => document.getElementById(id);
const msgsEl = $('msgs');
function msg(text, color) {
  const d = document.createElement('div');
  d.textContent = text;
  if (color) d.style.color = color;
  msgsEl.appendChild(d);
  while (msgsEl.children.length > 7) msgsEl.firstChild.remove();
  setTimeout(() => { d.style.opacity = '0'; }, 5000);
  setTimeout(() => d.remove(), 6000);
}
let hitTextT = 0;
function showHit(text) {
  const el = $('hitText');
  el.textContent = text;
  el.style.opacity = '1';
  hitTextT = 2.2;
}
function flashDamage() {
  const el = $('dmgFlash');
  el.style.transition = 'none';
  el.style.opacity = '1';
  requestAnimationFrame(() => { el.style.transition = 'opacity .9s'; el.style.opacity = '0'; });
}

// ================== combat events ==================
combat.onEvent = res => {
  const mine = state.vehicle && res.shooter === state.vehicle;
  if (mine) showHit(describeHit(res));
  if ((res.crewKilled || res.destroyed) && res.tank.team === 'enemy' && !res.tank.counted) {
    res.tank.counted = true;
    if (mine) {
      state.kills++;
      msg(res.destroyed ? `${res.tank.def.name} противника уничтожен` : `Экипаж ${res.tank.def.name} уничтожен — танк можно захватить`, '#9fe07f');
    }
  }
  if (res.tank === state.vehicle) {
    flashDamage();
    const mods = res.modules.map(m => MODULE_NAMES[m].toLowerCase());
    if (res.ricochet) msg('Рикошет по нашему танку', '#ddd');
    else if (!res.pen && !mods.length) msg('Попадание — броня выдержала', '#ddd');
    else msg('Нас пробили' + (mods.length ? ': ' + mods.join(', ') : ''), '#ff9a7a');
    if (res.fire) msg(res.fire === 'ammo' ? 'Боеукладка горит! Туши — F!' : 'Бензобак горит! Туши — F!', '#ff5a3a');
  }
};
combat.onPlayerDamage = (amount) => damagePlayer(amount);

function damagePlayer(amount) {
  if (state.over || combat.god) return;
  state.hp -= amount;
  state.lastDamageT = state.time;
  flashDamage();
  if (state.mode === 'drive') msg(`Экипаж ранен (−${Math.round(amount)})`, '#ff9a7a');
  if (state.hp <= 0) {
    state.hp = 0;
    gameOver(state.mode === 'drive' ? 'Экипаж погиб.' : 'Вы погибли.');
  }
}

function gameOver(reason) {
  if (state.over) return;
  state.over = true;
  $('goReason').textContent = reason;
  $('goStats').textContent = `Пройдено: ${((state.maxZ - state.startZ) / 1000).toFixed(2)} км · Уничтожено танков: ${state.kills}`;
  $('gameover').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  sfx.setEngine(false, 0);
}

// ================== input ==================
const keys = {};
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.code === 'Escape') {
    if (state.repairOpen) { closeRepair(); return; }
    togglePause();
    return;
  }
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (!state.started || state.paused || state.over) return;
  sfx.resume();
  if (e.code === 'KeyE') tryToggleVehicle();
  if (e.code === 'KeyC' && state.mode === 'walk') state.crouch = !state.crouch;
  if (e.code === 'KeyF') pressF();
  if (e.code === 'KeyG') dropPlate();
  if (e.code === 'KeyR') { if (state.repairOpen) closeRepair(); else openRepair(); }
  if (state.repairOpen && /^Digit[1-9]$/.test(e.code)) doRepair(parseInt(e.code.slice(5), 10) - 1);
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('mousemove', e => {
  if (!locked || state.paused || !state.started || state.over) return;
  if (state.mode === 'walk') {
    state.yaw -= e.movementX * MOUSE_SENS;
    state.pitch -= e.movementY * MOUSE_SENS;
    state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch));
  } else {
    const k = state.sight ? 0.25 : 1;
    state.aimYaw -= e.movementX * MOUSE_SENS * k;
    state.aimPitch -= e.movementY * MOUSE_SENS * k;
    state.aimPitch = Math.max(-0.7, Math.min(0.4, state.aimPitch));
  }
});

const canvas = renderer.domElement;
let locked = false;
canvas.addEventListener('click', () => {
  if (state.started && !state.paused && !locked && !state.over) canvas.requestPointerLock()?.catch?.(() => {});
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousedown', e => {
  if (!state.started || state.paused || state.over) return;
  sfx.resume();
  if (e.button === 0 && locked && state.mode === 'drive') state.fireReq = true;
  if (e.button === 2 && state.mode === 'drive') state.sight = true;
});
document.addEventListener('mouseup', e => {
  if (e.button === 2) state.sight = false;
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && state.started && !state.paused && !state.over) setPause(true);
});

const pauseEl = $('pause');
function togglePause() {
  if (!state.started || state.over) return;
  setPause(!state.paused);
}
function setPause(v) {
  state.paused = v;
  pauseEl.classList.toggle('hidden', !v);
  if (v && locked) document.exitPointerLock();
  if (!v && !locked) canvas.requestPointerLock()?.catch?.(() => {});
}
pauseEl.addEventListener('click', () => { if (state.paused) setPause(false); });

// ================== geometry helpers ==================
// distance from a point to a tank's hull footprint (0 inside)
function tankDist(t, p) {
  const o = t.root.position;
  const c = Math.cos(t.heading), s = Math.sin(t.heading);
  const dx = p.x - o.x, dz = p.z - o.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const b = t.vis.hullBox;
  const ex = Math.max(b.min.x - lx, 0, lx - b.max.x);
  const ez = Math.max(b.min.z - lz, 0, lz - b.max.z);
  return Math.hypot(ex, ez);
}

function tankObstacle(t) {
  const b = t.vis.hullBox;
  const c = Math.cos(t.heading), s = Math.sin(t.heading);
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  const o = t.root.position;
  return {
    x: o.x + cx * c + cz * s, z: o.z - cx * s + cz * c,
    hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2,
    cos: c, sin: s, rad: Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2,
    y1: o.y + b.max.y + 2,
  };
}

const _ray0 = new THREE.Vector3(), _ray1 = new THREE.Vector3(), _inv = new THREE.Matrix4();
// raycast against tanks (hit volumes) + terrain; returns {point, tank, dist}
function raycast(origin, dir, maxD, exclude) {
  let best = maxD, hitTank = null;
  const end = _ray1.copy(origin).addScaledVector(dir, maxD);
  for (const t of tanks) {
    if (t === exclude) continue;
    const to = t.root.position;
    const rel = _ray0.copy(to).sub(origin);
    const along = rel.dot(dir);
    if (along < 0 || along > best + 10) continue;
    if (rel.addScaledVector(dir, -along).length() > 10) continue;
    for (const vol of t.hitVolumes()) {
      _inv.copy(vol.obj.matrixWorld).invert();
      const a = origin.clone().applyMatrix4(_inv), b = end.clone().applyMatrix4(_inv);
      const bx = vol.box;
      const tt = segBox(a.x, a.y, a.z, b.x, b.y, b.z, bx.min.x, bx.min.y, bx.min.z, bx.max.x, bx.max.y, bx.max.z);
      if (tt !== null && tt * maxD < best) { best = tt * maxD; hitTank = t; }
    }
  }
  let d = 1.5, prev = 0;
  while (d < best) {
    const x = origin.x + dir.x * d, y = origin.y + dir.y * d, z = origin.z + dir.z * d;
    if (y < Math.max(world.heightAt(x, z), WATER_LEVEL)) {
      let lo = prev, hi = d;
      for (let i = 0; i < 8; i++) {
        const m = (lo + hi) / 2;
        const xm = origin.x + dir.x * m, zm = origin.z + dir.z * m;
        if (origin.y + dir.y * m < Math.max(world.heightAt(xm, zm), WATER_LEVEL)) hi = m; else lo = m;
      }
      best = hi; hitTank = null;
      break;
    }
    prev = d;
    d += Math.max(1, d * 0.02);
  }
  return { point: origin.clone().addScaledVector(dir, best), tank: hitTank, dist: best };
}

// follow the shell arc from the current gun direction to where it would land
function predictImpact(v) {
  const p = v.muzzleWorld(new THREE.Vector3());
  const vel = v.gunDirWorld(new THREE.Vector3()).multiplyScalar(v.def.shellSpeed);
  const h = 0.03;
  for (let i = 0; i < 120; i++) {
    vel.y -= G * h;
    const nx = p.x + vel.x * h, ny = p.y + vel.y * h, nz = p.z + vel.z * h;
    for (const t of tanks) {
      if (t === v) continue;
      const dx = nx - t.root.position.x, dz = nz - t.root.position.z;
      if (dx * dx + dz * dz > 400) continue;
      for (const vol of t.hitVolumes()) {
        _inv.copy(vol.obj.matrixWorld).invert();
        const a = p.clone().applyMatrix4(_inv), b = new THREE.Vector3(nx, ny, nz).applyMatrix4(_inv);
        const bx = vol.box;
        const tt = segBox(a.x, a.y, a.z, b.x, b.y, b.z, bx.min.x, bx.min.y, bx.min.z, bx.max.x, bx.max.y, bx.max.z);
        if (tt !== null) return p.lerp(new THREE.Vector3(nx, ny, nz), tt);
      }
    }
    p.set(nx, ny, nz);
    if (ny < Math.max(world.heightAt(nx, nz), WATER_LEVEL)) return p;
  }
  return p;
}

// ================== vehicles: enter / exit ==================
function tryToggleVehicle() {
  if (state.mode === 'walk') {
    const v = state.nearTank;
    if (!v) return;
    if (v.wrecked) { msg('Танк сгорел — внутрь не сесть'); return; }
    if (v.crew) { msg('В этом танке живой экипаж!', '#ff9a7a'); return; }
    if (items.hands) { msg('Руки заняты бронелистом — брось его (G)'); return; }
    state.mode = 'drive';
    state.vehicle = v;
    v.playerInside = true;
    if (v.team !== 'player') {
      msg(v.team === 'enemy' ? `Захвачен ${v.def.name} противника` : `Танк ${v.def.name} ваш`, '#9fe07f');
      v.team = 'player';
      director.release(v);
    }
    state.aimYaw = v.heading + v.turretYaw;
    state.aimPitch = -0.04;
    state.crouch = false;
    $('crosshair').classList.add('driving');
    closeRepair();
  } else {
    const v = state.vehicle;
    const b = v.vis.hullBox;
    for (const side of [1, -1]) {
      const off = new THREE.Vector3(side * (b.max.x + 1.3), 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), v.heading);
      const out = v.root.position.clone().add(off);
      out.y = world.heightAt(out.x, out.z);
      if (out.y < WATER_LEVEL - 0.3) continue;
      player.position.copy(out);
      state.yaw = state.aimYaw;
      state.pitch = 0;
      state.mode = 'walk';
      v.playerInside = false;
      v.aimPoint = null;
      state.vehicle = null;
      state.velY = 0;
      state.sight = false;
      $('crosshair').classList.remove('driving');
      sfx.setEngine(false, 0);
      return;
    }
    msg('Здесь не выйти — вода');
  }
}

// ================== interactions (on foot) ==================
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
  if (items.hands) return;         // welding is a hold action
  const it = state.nearItem;
  if (it) {
    const name = items.take(it);
    if (name) { msg(`Подобрано: ${name}`, '#e8c96a'); sfx.click(); }
    return;
  }
  const t = state.nearTank;
  if (t && !t.crew) {
    const n = t.loot.repair_kit;
    if (n > 0) {
      items.inventory.repair_kit += n;
      t.loot.repair_kit = 0;
      msg(`Найдено в танке: ремкомплект ×${n}`, '#e8c96a');
      sfx.click();
    } else msg('В танке ничего полезного');
  }
}

function dropPlate() {
  if (items.hands !== 'plate' || state.mode !== 'walk') return;
  const d = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
  items.hands = null;
  items.drop('plate', player.position.x + d.x * 1.3, player.position.z + d.z * 1.3);
  msg('Бронелист брошен');
}

// hold-to-do actions: welding (F + plate + torch) and cutting (T + cutter)
function currentHoldAction() {
  if (state.mode !== 'walk') return null;
  const t = state.nearTank;
  if (!t || t.wrecked) return null;
  if (items.hands === 'plate' && keys['KeyF'] && items.inventory.torch > 0 && t.hp.hull < 100)
    return { kind: 'weld', tank: t, need: 3.5, text: 'Привариваю бронелист...' };
  if (!items.hands && keys['KeyT'] && items.inventory.cutter > 0 && !t.crew && t.hp.hull >= 75)
    return { kind: 'cut', tank: t, need: 5, text: 'Срезаю бронелист...' };
  return null;
}

function updateHold(dt) {
  const a = currentHoldAction();
  if (!a || (state.hold && (state.hold.kind !== a.kind || state.hold.tank !== a.tank))) state.hold = null;
  if (!a) { $('hold').style.display = 'none'; return; }
  if (!state.hold) state.hold = { ...a, t: 0 };
  const h = state.hold;
  h.t += dt;
  $('hold').style.display = 'block';
  $('holdText').textContent = h.text;
  $('holdFill').style.width = `${Math.min(100, h.t / h.need * 100)}%`;
  const sparkAt = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw))
    .multiplyScalar(1.1).add(player.position).setY(player.position.y + 1.1);
  if (Math.random() < 0.8) fx.weld(sparkAt);
  if (h.t >= h.need) {
    if (h.kind === 'weld') {
      h.tank.hp.hull = 100;
      items.hands = null;
      msg(`Корпус ${h.tank.def.name} залатан`, '#9fe07f');
    } else {
      h.tank.hp.hull = Math.max(1, h.tank.hp.hull - 40);
      const p = player.position;
      const d = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
      items.drop('plate', p.x - d.x * 1.2, p.z - d.z * 1.2);
      msg(`Бронелист срезан с ${h.tank.def.name} (корпус −40%)`, '#9fd0ff');
    }
    state.hold = null;
    $('hold').style.display = 'none';
  }
}

// ================== repair kit menu ==================
const repairEl = $('repair');
function openRepair() {
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
    const ok = hp > 0 && hp < 100 && kits > 0;
    const st = hp >= 100 ? 'исправен' : hp <= 0 ? 'уничтожен — только ремпункт' : `${hp}%`;
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
  if (t.hp[id] >= 100) { msg(`${MODULE_NAMES[id]}: исправен`); return; }
  if (t.hp[id] <= 0) { msg(`${MODULE_NAMES[id]} уничтожен — нужен ремпункт`, '#ff9a7a'); return; }
  t.hp[id] = 100;
  items.inventory.repair_kit--;
  msg(`${MODULE_NAMES[id]} отремонтирован`, '#9fe07f');
  sfx.click();
  closeRepair();
}

// ================== settlement service zones ==================
function currentZone(p) {
  for (const s of world.settlements.values()) {
    for (const z of s.zones) {
      if (Math.hypot(p.x - z.x, p.z - z.z) < z.r) return z;
    }
  }
  return null;
}

function serviceTank(v, zone, dt) {
  if (!zone || Math.abs(v.speed) > 1.5) return null;
  if (zone.type === 'repair') {
    let busy = false;
    for (const id of SYSTEM_IDS) {
      if (v.hp[id] < 100) { v.hp[id] = Math.min(100, v.hp[id] + 12 * dt); busy = true; }
    }
    if (v.ammo < v.def.ammoMax) { v.ammo = Math.min(v.def.ammoMax, v.ammo + 4 * dt); busy = true; }
    if (v.extinguishers < 3) { v.extinguishers = 3; busy = true; }
    if (v.fire) { v.fire = null; busy = true; }
    return busy ? 'Ремонт и пополнение боекомплекта...' : 'Танк исправен';
  }
  if (zone.type === 'fuel') {
    if (v.fuel < v.fuelMax - 0.1) { v.fuel = Math.min(v.fuelMax, v.fuel + 15 * dt); return 'Заправка...'; }
    return 'Бак полон';
  }
  if (zone.type === 'ammo') {
    if (v.ammo < v.def.ammoMax) { v.ammo = Math.min(v.def.ammoMax, v.ammo + 3 * dt); return 'Загрузка снарядов...'; }
    return 'Боекомплект полон';
  }
  return null;
}

// ================== player movement ==================
function updateWalk(dt) {
  const carrying = items.hands === 'plate';
  const run = (keys['ShiftLeft'] || keys['ShiftRight']) && !carrying;
  let speed = state.crouch ? PLAYER_SPEED * 0.5 : (run ? PLAYER_RUN : PLAYER_SPEED);
  if (carrying) speed *= 0.6;

  let f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  let s = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  if (state.repairOpen) f = s = 0;
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
  for (const t of tanks) {
    if (tankDist(t, p) < 1.5) pushOut(tankObstacle(t), p, 0.4);
  }

  const ground = world.heightAt(p.x, p.z);
  state.velY -= GRAVITY * dt;
  p.y += state.velY * dt;
  if (p.y <= ground) { p.y = ground; state.velY = 0; state.onGround = true; }
  else state.onGround = false;
  if (keys['Space'] && state.onGround && !carrying) { state.velY = JUMP_V; state.onGround = false; }
  playerVel.set((p.x - ox) / dt, 0, (p.z - oz) / dt);

  camera.fov = BASE_FOV;
  camera.updateProjectionMatrix();
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
  const blocked = state.repairOpen;
  c.throttle = blocked ? 0 : (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  c.steer = blocked ? 0 : (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
  c.brake = keys['Space'] ? 1 : 0;
  if (aimHit) v.aimPoint = aimHit.point;

  if (state.fireReq) {
    state.fireReq = false;
    if (v.hp.gun <= 0) msg('Орудие уничтожено!', '#ff9a7a');
    else if (v.ammo <= 0) msg('Снаряды кончились!', '#ff9a7a');
    else if (v.reload > 0) sfx.click();
    else combat.fireFrom(v);
  }
}

function updateDriveCamera(dt) {
  const v = state.vehicle;
  aimDir.set(Math.sin(state.aimYaw) * Math.cos(state.aimPitch), Math.sin(state.aimPitch), Math.cos(state.aimYaw) * Math.cos(state.aimPitch));
  const targetFov = state.sight ? 16 : BASE_FOV;
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();
  }
  if (state.sight) {
    camera.position.copy(v.sightWorld());
  } else {
    const pivot = v.root.position.clone();
    pivot.y += v.vis.hullBox.max.y + 2.2;
    const dist = 13 + v.vis.hullBox.max.z * 0.6;
    const cp = pivot.clone().addScaledVector(aimDir, -dist);
    cp.y += 1.5;
    const gh = world.heightAt(cp.x, cp.z) + 1.2;
    if (cp.y < gh) cp.y = gh;
    camera.position.lerp(cp, 1 - Math.pow(0.00005, dt));
  }
  camera.lookAt(camera.position.clone().add(aimDir));
  aimHit = raycast(camera.position, aimDir, 1400, v);
  // do not aim at points right behind the camera pivot / own tank
  if (aimHit.dist < 8) aimHit.point.copy(camera.position).addScaledVector(aimDir, 60);
}

// ================== HUD ==================
const invEl = $('inv'), topEl = $('topbar'), sysEl = $('systems'), gaugeEl = $('gauge');
const gunMark = $('gunMark'), promptEl = $('prompt'), fireEl = $('fire');
const schem = $('schem').getContext('2d');

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
  const rows = SYSTEM_IDS.map(id => {
    const hp = Math.round(t.hp[id]);
    return `<div class="srow ${hp <= 0 ? 'dead' : ''}"><div class="n"><span>${MODULE_NAMES[id]}</span><span>${hp <= 0 ? 'уничт.' : hp + '%'}</span></div>` +
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
    html += `<div class="row ${n ? '' : 'none'}"><span>${ITEM_DEFS[k].icon} ${ITEM_DEFS[k].name}</span><span>${k === 'repair_kit' ? '×' + n : (n ? 'есть' : 'нет')}</span></div>`;
  }
  html += `<div class="hands">В руках: ${items.hands ? ITEM_DEFS[items.hands].icon + ' ' + ITEM_DEFS[items.hands].name : '—'}</div>`;
  if (html !== invKey) { invEl.innerHTML = html; invKey = html; }
}

function updateGauge(v) {
  if (!v) { gaugeEl.style.display = 'none'; return; }
  gaugeEl.style.display = 'block';
  $('gaugeSpeed').innerHTML = `${v.speedKmh.toFixed(0)}<small> км/ч</small>`;
  $('gaugeName').textContent = `${v.def.name} · ${v.def.caliber}`;
  const rt = v.reloadTime;
  const rl = v.hp.gun <= 0 ? 0 : Math.max(0, 1 - v.reload / rt);
  const fuelP = v.fuel / v.def.fuelMax * 100;
  $('gaugeInfo').innerHTML =
    `<div class="gline"><span>Снаряды</span><b>${Math.floor(v.ammo)} / ${v.def.ammoMax}</b></div>` +
    `<div class="gline"><span>${v.hp.gun <= 0 ? 'Орудие уничтожено' : rl >= 1 ? 'Заряжено' : 'Перезарядка ' + Math.max(0, v.reload).toFixed(1) + ' с'}</span></div>` +
    `<div class="mbar"><i style="width:${rl * 100}%;background:${rl >= 1 ? '#7fe07f' : '#e8a53a'}"></i></div>` +
    `<div class="gline"><span>Топливо</span><b>${fuelP.toFixed(0)}%</b></div>` +
    `<div class="mbar"><i style="width:${fuelP}%;background:${fuelP < 15 ? '#e0503a' : '#c9b48a'}"></i></div>` +
    `<div class="gline"><span>Огнетушители</span><b>${v.extinguishers}</b></div>`;
}

// enemy / tank markers
const markersEl = $('markers');
const markerPool = [];
let spotT = 0;
function updateMarkers(dt) {
  spotT -= dt;
  const doSpot = spotT <= 0;
  if (doSpot) spotT = 0.35;
  let used = 0;
  const v3 = new THREE.Vector3();
  for (const t of tanks) {
    if (t === state.vehicle || t.wrecked) continue;
    const d = t.root.position.distanceTo(camera.position);
    if (doSpot) {
      const top = t.turret.localToWorld(new THREE.Vector3(0, 1.2, 0));
      if (d < 550 && world.lineOfSight(camera.position, top, 5)) t.spottedT = state.time;
    }
    const seen = (t.spottedT !== undefined && state.time - t.spottedT < 3) || d < 40;
    if (!seen || d > 600) continue;
    v3.copy(t.root.position); v3.y += t.vis.hullBox.max.y + 3;
    v3.project(camera);
    if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) continue;
    let el = markerPool[used];
    if (!el) { el = document.createElement('div'); el.className = 'mk'; markersEl.appendChild(el); markerPool.push(el); }
    used++;
    el.style.display = 'block';
    el.style.left = `${(v3.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v3.y * 0.5 + 0.5) * innerHeight}px`;
    const cls = t.team === 'enemy' && t.crew ? 'enemy' : t.team === 'player' ? 'own' : 'dead';
    el.className = 'mk ' + cls;
    const label = cls === 'enemy' ? '' : cls === 'own' ? t.def.name : 'без экипажа';
    el.innerHTML = `${label}${label ? '<br>' : ''}${Math.round(d)} м<i></i>`;
  }
  for (let i = used; i < markerPool.length; i++) markerPool[i].style.display = 'none';
}

// ================== minimap ==================
const mm = $('minimap');
const mmCtx = mm.getContext('2d');
const MM_S = 180, MM_RANGE = 320;
const mmBase = document.createElement('canvas');
mmBase.width = mmBase.height = MM_S;
const mmBaseCtx = mmBase.getContext('2d');
let mmCenter = null;
const MM_SC = MM_S / (2 * MM_RANGE);

function drawMinimapBase(c) {
  const R = 90;               // sample resolution
  const img = mmBaseCtx.createImageData(R, R);
  const d = img.data;
  for (let py = 0; py < R; py++) {
    for (let px = 0; px < R; px++) {
      const wx = c.x - (px / R - 0.5) * 2 * MM_RANGE;
      const wz = c.z - (py / R - 0.5) * 2 * MM_RANGE;
      const h = world.heightAt(wx, wz);
      let r, g, b;
      if (h < WATER_LEVEL) { r = 45; g = 90; b = 130; }
      else if (h < 22) { const t = (h - WATER_LEVEL) / 20; r = 60 + t * 50; g = 105 + t * 45; b = 50 + t * 25; }
      else if (h < 40) { r = 120 + (h - 22) * 3; g = 115 + (h - 22) * 2.5; b = 105; }
      else { const t = Math.min(1, (h - 40) / 30); r = 175 + t * 70; g = 170 + t * 75; b = 175 + t * 70; }
      const i = (py * R + px) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = R;
  tmp.getContext('2d').putImageData(img, 0, 0);
  mmBaseCtx.imageSmoothingEnabled = true;
  mmBaseCtx.drawImage(tmp, 0, 0, MM_S, MM_S);
  // road
  mmBaseCtx.strokeStyle = '#8a7658';
  mmBaseCtx.lineWidth = 3;
  mmBaseCtx.beginPath();
  for (let z = c.z - MM_RANGE - 20, i = 0; z <= c.z + MM_RANGE + 20; z += 10, i++) {
    const x = MM_S / 2 - (world.roadX(z) - c.x) * MM_SC, y = MM_S / 2 - (z - c.z) * MM_SC;
    i ? mmBaseCtx.lineTo(x, y) : mmBaseCtx.moveTo(x, y);
  }
  mmBaseCtx.stroke();
  mmCenter = c.clone();
}

function drawMinimap(anchor, heading) {
  if (!mmCenter || Math.hypot(anchor.x - mmCenter.x, anchor.z - mmCenter.z) > 30) drawMinimapBase(anchor);
  const toMap = (wx, wz) => [MM_S / 2 - (wx - anchor.x) * MM_SC, MM_S / 2 - (wz - anchor.z) * MM_SC];
  mmCtx.fillStyle = '#222';
  mmCtx.fillRect(0, 0, MM_S, MM_S);
  mmCtx.drawImage(mmBase, (anchor.x - mmCenter.x) * MM_SC, (anchor.z - mmCenter.z) * MM_SC);
  // settlements
  mmCtx.font = '10px Arial';
  mmCtx.textAlign = 'center';
  for (const s of world.settlements.values()) {
    const [x, y] = toMap(world.roadX(s.plan.z), s.plan.z);
    mmCtx.fillStyle = 'rgba(0,0,0,.6)';
    mmCtx.fillText(s.plan.name, x + 1, y + 1);
    mmCtx.fillStyle = '#ffe9b0';
    mmCtx.fillText(s.plan.name, x, y);
    for (const z of s.zones) {
      const [zx, zy] = toMap(z.x, z.z);
      mmCtx.fillStyle = z.type === 'repair' ? '#7fb0ff' : z.type === 'fuel' ? '#ffb040' : '#ff7070';
      mmCtx.fillRect(zx - 3, zy - 3, 6, 6);
    }
  }
  // items
  for (const it of items.pickups.values()) {
    const [x, y] = toMap(it.pos.x, it.pos.z);
    mmCtx.fillStyle = it.type === 'plate' ? '#9fd0ff' : '#ffe070';
    mmCtx.beginPath(); mmCtx.arc(x, y, 2, 0, 7); mmCtx.fill();
  }
  // tanks
  for (const t of tanks) {
    if (t === state.vehicle) continue;
    const seen = t.spottedT !== undefined && state.time - t.spottedT < 3;
    if (t.team === 'enemy' && t.crew && !seen) continue;
    const [x, y] = toMap(t.root.position.x, t.root.position.z);
    mmCtx.fillStyle = t.wrecked ? '#333' : t.team === 'enemy' && t.crew ? '#ff4a3a' : t.team === 'player' ? '#7fe07f' : '#bbb';
    mmCtx.beginPath(); mmCtx.arc(x, y, 3.2, 0, 7); mmCtx.fill();
  }
  // player arrow
  mmCtx.save();
  mmCtx.translate(MM_S / 2, MM_S / 2);
  mmCtx.rotate(-heading + Math.PI);
  mmCtx.fillStyle = '#ff5544';
  mmCtx.strokeStyle = '#fff';
  mmCtx.lineWidth = 1.5;
  mmCtx.beginPath(); mmCtx.moveTo(0, 7); mmCtx.lineTo(5, -5); mmCtx.lineTo(0, -2); mmCtx.lineTo(-5, -5); mmCtx.closePath();
  mmCtx.fill(); mmCtx.stroke();
  mmCtx.restore();
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

// ================== prompts ==================
function updatePrompt() {
  const lines = [];
  if (state.mode === 'walk') {
    const t = state.nearTank;
    if (items.hands === 'plate') {
      if (t && !t.wrecked && t.hp.hull < 100) {
        lines.push(items.inventory.torch > 0
          ? `Удерживай <b>F</b> — приварить бронелист (корпус ${Math.round(t.hp.hull)}%)`
          : 'Нет газовой горелки');
      }
      lines.push('<b>G</b> — бросить бронелист');
    } else if (state.nearItem) {
      lines.push(`<b>F</b> — подобрать: ${ITEM_DEFS[state.nearItem.type].name}`);
    }
    if (t) {
      if (t.wrecked) lines.push(`${t.def.name} — сгоревший танк`);
      else if (t.crew) lines.push(`${t.def.name}: экипаж жив`);
      else {
        if (!items.hands) lines.push(`<b>E</b> — сесть в ${t.def.name}`);
        if (t.loot.repair_kit > 0 && !items.hands && !state.nearItem) lines.push(`<b>F</b> — обыскать танк`);
        if (!items.hands && items.inventory.cutter > 0) {
          lines.push(t.hp.hull >= 75 ? 'Удерживай <b>T</b> — срезать бронелист резаком' : 'Корпус повреждён — бронелист не срезать');
        }
        if (items.inventory.repair_kit > 0) lines.push('<b>R</b> — ремкомплект');
      }
    }
  } else if (state.zoneText) {
    lines.push(`${state.zone.label}: ${state.zoneText}`);
  } else if (state.zone) {
    lines.push(`${state.zone.label}: остановись для обслуживания`);
  }
  if (lines.length) {
    promptEl.innerHTML = lines.join('<br>');
    promptEl.style.display = 'block';
  } else promptEl.style.display = 'none';
}

// ================== main loop ==================
const clock = new THREE.Clock();
let despawnT = 0, repairRenderT = 0;

function frame(dt) {
  state.time += dt;
  const walking = state.mode === 'walk';
  const v = state.vehicle;
  const anchor = walking ? player.position : v.root.position;

  world.update(anchor, 4);
  const created = director.update(anchor, tanks);
  if (created.length) tanks.push(...created);

  // AI and player control
  const target = walking
    ? { pos: player.position, vel: playerVel, isTank: false }
    : { pos: v.root.position, vel: v.velocity, isTank: true };
  director.think(dt, state.time, state.over ? null : target, combat);
  if (!walking) updateDriveControls();

  for (const t of tanks) t.update(dt, world, tanks);

  if (walking) updateWalk(dt);
  else updateDriveCamera(dt);

  // extinguishing & burning
  for (const t of [...tanks]) {
    const f = t.fire;
    if (f && f.extinguish > 0) {
      f.extinguish -= dt;
      fx.spawn('steam', t.root.localToWorld(new THREE.Vector3(0, t.vis.hullBox.max.y, t.vis.hullBox.min.z * 0.5)), null, 1);
      if (f.extinguish <= 0) { t.fire = null; if (t === v) msg('Пожар потушен', '#9fe07f'); }
    }
    if (t.fire) {
      const b = t.vis.hullBox;
      fx.burn(t.root.localToWorld(new THREE.Vector3(0, b.max.y, t.fire.source === 'ammo' ? b.max.z * 0.4 : b.min.z * 0.55)), t.fire.selfOut ? 0.7 : 1);
    } else if (t.wrecked) {
      t.smokeT = (t.smokeT || 0) + dt;
      if (t.smokeT < 90) fx.smokeTrail(t.root.localToWorld(new THREE.Vector3(0, t.vis.hullBox.max.y + 0.5, 0)), 1);
    }
    if (t.burnOut) {
      t.burnOut = false;
      if (t.playerInside) { t.makeWreck(); gameOver('Танк сгорел вместе с экипажем.'); }
      else { t.makeWreck(); msg(`${t.def.name} сгорел`); }
    }
  }
  if (v && v.wrecked && !state.over) gameOver('Танк уничтожен.');

  // combat
  combat.tanks = tanks;
  combat.foot = { pos: player.position, active: walking };
  combat.listener.copy(camera.position);
  combat.update(dt);
  fx.update(dt);
  items.update(dt);

  // interactions
  if (walking) {
    state.nearItem = items.hands ? null : items.nearest(player.position);
    let best = null, bd = TANK_REACH;
    for (const t of tanks) {
      const d = tankDist(t, player.position);
      if (d < bd) { bd = d; best = t; }
    }
    state.nearTank = best;
    updateHold(dt);
    state.zone = null; state.zoneText = null;
  } else {
    state.nearTank = null;
    state.zone = currentZone(v.root.position);
    state.zoneText = serviceTank(v, state.zone, dt);
    $('hold').style.display = 'none';
    sfx.setEngine(v.operated && v.maxSpeedEff > 0, Math.min(1, Math.abs(v.speed) / v.def.maxSpeed + Math.abs(v.controls.throttle) * 0.3));
  }
  if (state.repairOpen) {
    const rt = state.repairTarget;
    if (!rt || rt.wrecked || (walking && tankDist(rt, player.position) > TANK_REACH + 1)) closeRepair();
    else if ((repairRenderT -= dt) <= 0) { repairRenderT = 0.3; renderRepair(); }
  }

  // player health regeneration
  if (state.time - state.lastDamageT > 8 && state.hp < 100) state.hp = Math.min(100, state.hp + 2 * dt);

  // despawn far tanks
  if ((despawnT -= dt) <= 0) {
    despawnT = 2;
    for (const t of [...tanks]) {
      if (t === v) continue;
      if (t.root.position.distanceTo(anchor) > (t.team === 'player' ? 2500 : 1500)) removeTank(t);
    }
  }

  // sun & clouds follow
  sun.position.set(anchor.x + 120, anchor.y + 180, anchor.z + 60);
  sun.target.position.set(anchor.x, anchor.y, anchor.z);
  sun.target.updateMatrixWorld();
  clouds.position.set(anchor.x, 0, anchor.z);

  // progress
  state.maxZ = Math.max(state.maxZ, anchor.z);

  // ---------- HUD
  handPlate.visible = walking && items.hands === 'plate';
  $('sight').style.display = !walking && state.sight && camera.fov < 30 ? 'block' : 'none';
  $('crosshair').style.display = !walking && state.sight ? 'none' : 'block';
  if (!walking) {
    const ip = predictImpact(v).project(camera);
    if (ip.z < 1) {
      gunMark.style.display = 'block';
      gunMark.style.left = `${(ip.x * 0.5 + 0.5) * innerWidth}px`;
      gunMark.style.top = `${(-ip.y * 0.5 + 0.5) * innerHeight}px`;
      const rl = Math.max(0, 1 - v.reload / v.reloadTime);
      gunMark.className = v.hp.gun <= 0 || v.ammo <= 0 ? 'blocked' : rl >= 1 ? 'ready' : '';
      gunMark.style.setProperty('--p', `${rl * 100}%`);
    } else gunMark.style.display = 'none';
  } else gunMark.style.display = 'none';

  if (v && v.fire && !v.fire.selfOut) {
    fireEl.style.display = 'block';
    fireEl.innerHTML = `ПОЖАР: ${v.fire.source === 'ammo' ? 'БОЕУКЛАДКА' : 'БЕНЗОБАК'} — ${Math.max(0, v.fire.t).toFixed(1)} с` +
      `<small>${v.fire.extinguish > 0 ? 'тушим...' : `F — огнетушитель (осталось ${v.extinguishers})`}</small>`;
  } else fireEl.style.display = 'none';

  if (hitTextT > 0) { hitTextT -= dt; if (hitTextT <= 0) $('hitText').style.opacity = '0'; }

  updateSystemsPanel(v || state.nearTank, !!v);
  updateGauge(v);
  updateInventory();
  updateMarkers(dt);
  updatePrompt();
  topEl.innerHTML = `Пройдено: <b>${((state.maxZ - state.startZ) / 1000).toFixed(2)} км</b> &nbsp;·&nbsp; Уничтожено: <b>${state.kills}</b>`;
  const heading = walking ? state.yaw : v.heading;
  drawMinimap(anchor, heading);
  $('mmLabel').textContent = nextSettlementLabel(anchor);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  if (!state.paused && state.started && !state.over) frame(dt);
  renderer.render(scene, camera);
}

// ================== resize ==================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ================== boot ==================
const barFill = $('barFill');
const loadText = $('loadText');
const loaderEl = $('loader');

function setupStart() {
  const z0 = parseFloat(dbg.get('start') || '0');
  state.startZ = state.maxZ = z0;
  const rx = world.roadX(z0);
  const hd = world.roadHeading(z0);
  // side vector (+X side of the road)
  const sx = Math.cos(hd), sz = -Math.sin(hd);
  const fx0 = Math.sin(hd), fz0 = Math.cos(hd);
  const at = (side, along) => [rx + sx * side + fx0 * along, z0 + sz * side + fz0 * along];

  const [px, pz] = at(8, -6);
  player.position.set(px, world.heightAt(px, pz), pz);
  state.yaw = hd;

  const [tx, tz] = at(3, 10);
  spawnTank('t55', tx, tz, hd, { team: 'player' });
  // the old garage: other tanks parked across the road
  if (dbg.get('notanks') !== '1') {
    ['markV', 'abrams', 'avre'].forEach((k, i) => {
      const [x, z] = at(-15, -14 + i * 15);
      spawnTank(k, x, z, hd, { team: 'neutral' });
    });
  }
  const [ix, iz] = at(10, -2);
  items.add('start:plate', 'plate', ix, iz);
  msg('Рядом с тобой лежит бронелист, у дороги — твой Т-55.', '#e8c96a');
  msg('Дорога ведёт вперёд. Удачи, танкист!', '#e8c96a');
}

async function boot() {
  loadText.textContent = 'Генерация ландшафта...';
  const startZ = parseFloat(dbg.get('start') || '0');
  const p0 = new THREE.Vector3(world.roadX(startZ), 0, startZ);
  const total = world.pendingChunks(p0);
  while (world.pendingChunks(p0) > 0) {
    world.update(p0, 30);
    const left = world.pendingChunks(p0);
    barFill.style.width = `${(1 - left / total) * 60}%`;
    await new Promise(r => setTimeout(r, 0));
  }
  loadText.textContent = 'Загрузка техники...';
  const keysToLoad = dbg.get('notanks') === '1' ? [] : ['abrams', 'avre', 'markV'];
  await factory.load(keysToLoad, f => { barFill.style.width = `${60 + f * 40}%`; });
  setupStart();
  barFill.style.width = '100%';
  loadText.textContent = 'Готово! Нажми, чтобы играть';
  setTimeout(() => {
    loaderEl.classList.add('hidden');
    state.started = true;
  }, 300);
}

boot();
animate();

// handle for debugging / automated tests
window.game = { state, tanks, world, items, combat, director, player, camera, keys, spawnTank, fx, frame };
