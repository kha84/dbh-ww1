// DBH-WW1 Three.js — main game orchestrator
import * as THREE from 'three';
import { Terrain, WATER_LEVEL } from './terrain.js';
import { VehicleManager, Vehicle, keys } from './vehicles.js';

// ================== state ==================
const state = {
  mode: 'walk',          // 'walk' | 'drive'
  vehicle: null,
  paused: false,
  yaw: Math.PI,          // face +Z toward the vehicles at spawn
  pitch: 0,
  camYaw: 0,
  camPitch: 0.35,
  velY: 0,
  onGround: false,
  eyeH: 1.7,
  crouch: false,
  nearVehicle: null,
  camPos: new THREE.Vector3(),
  started: false,
};

const PLAYER_SPEED = 7;
const PLAYER_RUN = 12;
const JUMP_V = 7.5;
const GRAVITY = 20;
const MOUSE_SENS = 0.0021;

// debug flags: ?nowater=1 ?noclouds=1 ?noshadows=1 ?nofog=1 ?waterred=1 ?watery=N
const dbg = new URLSearchParams(location.search);

// ================== renderer / scene ==================
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: dbg.get('noaa') !== '1',
  powerPreference: 'high-performance',
  logarithmicDepthBuffer: dbg.get('logdepth') === '1'
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
if (dbg.get('nofog') !== '1') scene.fog = new THREE.Fog(0x9ec8e8, 180, 700);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);

// ================== lights & sky ==================
const hemi = new THREE.HemisphereLight(0xbdd8f0, 0x5c6b4a, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d9, 2.0);
sun.position.set(120, 180, 60);
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

// clouds
if (dbg.get('noclouds') !== '1') {
  const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 1 });
  const MAX_CLOUDS = 240;
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, MAX_CLOUDS);
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let used = 0;
  for (let i = 0; i < 48 && used < MAX_CLOUDS; i++) {
    const cx = (Math.random() - 0.5) * 900;
    const cz = (Math.random() - 0.5) * 900;
    const cy = 110 + Math.random() * 50;
    const n = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n && used < MAX_CLOUDS; j++) {
      s.set(14 + Math.random() * 22, 6 + Math.random() * 6, 12 + Math.random() * 18);
      v.set(cx + (Math.random() - 0.5) * 46, cy + (Math.random() - 0.5) * 8, cz + (Math.random() - 0.5) * 40);
      m.compose(v, q, s);
      clouds.setMatrixAt(used++, m);
    }
  }
  clouds.count = used;
  clouds.frustumCulled = false;
  if (dbg.get('noclouds') === '1') clouds.visible = false;
  scene.add(clouds);
}

// ================== world ==================
const terrain = new Terrain(scene);
terrain.generate(1337);

if (terrain.water) {
  terrain.water.visible = dbg.get('nowater') !== '1';
  if (dbg.get('watery')) terrain.water.position.y = parseFloat(dbg.get('watery'));
  if (dbg.get('waterred') === '1') {
    terrain.water.material.transparent = false;
    terrain.water.material.color.set(0xff0000);
    terrain.water.material.opacity = 1;
  }
}

const vm = new VehicleManager(scene);
if (dbg.get('notanks') === '1') vm.loadAll = async () => {};

// player position (feet)
const player = new THREE.Object3D();
player.position.set(0, terrain.heightAt(0, 0) + 2, 0);
scene.add(player);

// ================== input ==================
document.addEventListener('keydown', e => {
  if (e.code === 'Escape') { togglePause(); return; }
  keys[e.code] = true;
  if (e.code === 'KeyE' && !state.paused && state.started) tryToggleVehicle();
  if (e.code === 'KeyC') state.crouch = !state.crouch;
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('mousemove', e => {
  if (!locked || state.paused || !state.started) return;
  if (state.mode === 'walk') {
    state.yaw -= e.movementX * MOUSE_SENS;
    state.pitch -= e.movementY * MOUSE_SENS;
    state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch));
  } else {
    state.camYaw -= e.movementX * MOUSE_SENS;
    state.camPitch = Math.max(0.05, Math.min(1.2, state.camPitch + e.movementY * MOUSE_SENS));
  }
});

// pointer lock
const canvas = renderer.domElement;
let locked = false;
canvas.addEventListener('click', () => {
  if (state.started && !state.paused && !locked) {
    canvas.requestPointerLock().catch(() => {});
  }
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && state.started && !state.paused) setPause(true);
});

// pause
const pauseEl = document.getElementById('pause');
function togglePause() {
  if (!state.started) return;
  setPause(!state.paused);
}
function setPause(v) {
  state.paused = v;
  pauseEl.classList.toggle('hidden', !v);
  if (v && locked) document.exitPointerLock();
  if (!v && locked === false) canvas.requestPointerLock().catch(() => {});
}
pauseEl.addEventListener('click', () => { if (state.paused) setPause(false); });

// ================== enter / exit vehicle ==================
const promptEl = document.getElementById('prompt');
const crossEl = document.getElementById('crosshair');

function tryToggleVehicle() {
  if (state.mode === 'walk') {
    const v = state.nearVehicle;
    if (v) {
      state.mode = 'drive';
      state.vehicle = v;
      v.driver = player;
      state.camYaw = v.heading + Math.PI;
      state.camPitch = 0.42;
      crossEl.classList.add('driving');
      document.getElementById('gauge').style.display = 'block';
      document.getElementById('gaugeName').textContent = v.def.name;
    }
  } else {
    const v = state.vehicle;
    // exit: place player beside the hull
    const side = new THREE.Vector3(4.5, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), v.heading);
    const out = v.root.position.clone().add(side);
    out.y = terrain.heightAt(out.x, out.z) + 0.1;
    // don't exit into water
    if (out.y > WATER_LEVEL - 0.2) {
      player.position.copy(out);
      state.mode = 'walk';
      v.driver = null;
      state.vehicle = null;
      state.velY = 0;
      crossEl.classList.remove('driving');
      document.getElementById('gauge').style.display = 'none';
    }
  }
}

// ================== HUD ==================
const hudEl = document.getElementById('hud');
const gaugeSpeed = document.getElementById('gaugeSpeed');
const vlistEl = document.getElementById('vlist');
const chips = [];
for (let i = 0; i < 3; i++) {
  const d = document.createElement('div');
  d.className = 'vchip';
  vlistEl.appendChild(d);
  chips.push(d);
}

// ================== minimap ==================
const mm = document.getElementById('minimap');
const mmCtx = mm.getContext('2d');
const MM_S = 170;

function drawMinimap() {
  const img = mmCtx.createImageData(MM_S, MM_S);
  const d = img.data;
  const S = terrain.SIZE;
  for (let py = 0; py < MM_S; py++) {
    for (let px = 0; px < MM_S; px++) {
      const wx = (px / MM_S - 0.5) * S;
      const wz = (py / MM_S - 0.5) * S;
      const h = terrain.heightAt(wx, wz);
      let r, g, b;
      if (h < WATER_LEVEL) { r = 45; g = 90; b = 130; }
      else if (h < 16) {
        const t = (h - WATER_LEVEL) / 16;
        r = 60 + t * 60; g = 105 + t * 55; b = 50 + t * 30;
      } else if (h < 30) { r = 120 + (h - 16) * 4; g = 115 + (h - 16) * 3; b = 105; }
      else { const t = Math.min(1, (h - 30) / 20); r = 200 + t * 55; g = 200 + t * 55; b = 205; }
      const i = (py * MM_S + px) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  mmCtx.putImageData(img, 0, 0);
}

function drawMinimapOverlay() {
  // player + vehicles markers
  const toMap = (wx, wz) => [
    (wx / terrain.SIZE + 0.5) * MM_S,
    (wz / terrain.SIZE + 0.5) * MM_S
  ];
  const p = state.mode === 'drive' ? state.vehicle.root.position : player.position;
  for (const v of vm.vehicles) {
    if (!v || v === state.vehicle) continue;
    const [mx, my] = toMap(v.root.position.x, v.root.position.z);
    mmCtx.fillStyle = '#e8c96a';
    mmCtx.beginPath(); mmCtx.arc(mx, my, 3, 0, 7); mmCtx.fill();
  }
  const [px, py] = toMap(p.x, p.z);
  mmCtx.fillStyle = '#ff5544';
  mmCtx.beginPath(); mmCtx.arc(px, py, 4, 0, 7); mmCtx.fill();
  mmCtx.strokeStyle = '#fff';
  mmCtx.lineWidth = 1.5;
  mmCtx.stroke();
}

// ================== player movement ==================
function collideTrees(pos) {
  for (const t of terrain.trees) {
    const dx = pos.x - t.x, dz = pos.z - t.z;
    const d2 = dx * dx + dz * dz;
    const rr = t.r + 0.35;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = t.x + dx / d * rr;
      pos.z = t.z + dz / d * rr;
    }
  }
}

function collideVehicles(pos) {
  for (const v of vm.vehicles) {
    if (!v || v === state.vehicle) continue;
    const dx = pos.x - v.root.position.x;
    const dz = pos.z - v.root.position.z;
    const rr = 3.4;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = v.root.position.x + dx / d * rr;
      pos.z = v.root.position.z + dz / d * rr;
    }
  }
}

function updateWalk(dt) {
  const run = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = state.crouch ? PLAYER_SPEED * 0.5 : (run ? PLAYER_RUN : PLAYER_SPEED);

  // direction in yaw space (forward/right basis, matches camera look dir)
  let f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  let s = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const len = Math.hypot(f, s);
  if (len > 0) { f /= len; s /= len; }

  const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
  const wx = f * sin - s * cos;
  const wz = f * cos + s * sin;

  player.position.x += wx * speed * dt;
  player.position.z += wz * speed * dt;

  // deep water blocks movement (rivers are crossable only at shallow spots)
  const hHere = terrain.heightAt(player.position.x, player.position.z);
  if (hHere < WATER_LEVEL - 1.6) {
    player.position.x -= wx * speed * dt;
    player.position.z -= wz * speed * dt;
  }

  collideTrees(player.position);
  collideVehicles(player.position);

  // ground follow
  const ground = terrain.heightAt(player.position.x, player.position.z);

  // jump / gravity only when noticeably above ground
  state.velY -= GRAVITY * dt;
  player.position.y += state.velY * dt;
  if (player.position.y <= ground) {
    player.position.y = ground;
    state.velY = 0;
    state.onGround = true;
  } else {
    state.onGround = false;
  }
  if (keys['Space'] && state.onGround) {
    state.velY = JUMP_V;
    state.onGround = false;
  }

  // water slows you
  const inWater = ground < WATER_LEVEL - 0.2 && player.position.y < WATER_LEVEL;
  if (inWater) {
    const eff = 0.45; // swim/slog speed factor
    player.position.x += wx * speed * eff * dt;
    player.position.z += wz * speed * eff * dt;
  }

  // camera
  const eyeY = player.position.y + (state.crouch ? 1.1 : state.eyeH);
  camera.position.set(player.position.x, eyeY, player.position.z);
  const dir = new THREE.Vector3(
    Math.sin(state.yaw) * Math.cos(state.pitch),
    Math.sin(state.pitch),
    Math.cos(state.yaw) * Math.cos(state.pitch)
  );
  camera.lookAt(camera.position.clone().add(dir));

  return inWater;
}

// ================== vehicle camera ==================
const camTarget = new THREE.Vector3();

function updateDrive(dt) {
  const v = state.vehicle;
  v.update(dt, terrain);
  camTarget.copy(v.root.position);

  const dist = 16 + Math.abs(v.speed) * 0.35;
  const cp = Math.cos(state.camPitch);
  const cx = camTarget.x + Math.sin(state.camYaw) * cp * dist;
  const cz = camTarget.z + Math.cos(state.camYaw) * cp * dist;
  const cy = camTarget.y + 6 + Math.sin(state.camPitch) * dist;

  // don't let camera go under terrain
  const gh = terrain.heightAt(cx, cz) + 1.2;
  state.camPos.set(cx, Math.max(cy, gh), cz);
  camera.position.lerp(state.camPos, 1 - Math.pow(0.0001, dt));
  camera.lookAt(camTarget.x, camTarget.y + 2.5, camTarget.z);
}

// ================== main loop ==================
const clock = new THREE.Clock();
let waterT = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  waterT += dt;

  if (!state.paused && state.started) {
    if (state.mode === 'walk') {
      updateWalk(dt);
    } else {
      updateDrive(dt);
    }

    // vehicle updates: driven one already updated in updateDrive; idle ones just stick to ground
    for (const v of vm.vehicles) {
      if (v !== state.vehicle) v.update(dt, terrain);
    }

    // proximity check
    if (state.mode === 'walk') {
      const near = vm.nearest(player.position, 7);
      state.nearVehicle = near;
      if (near) {
        promptEl.innerHTML = `Нажми <b>E</b> — сесть в ${near.def.name}`;
        promptEl.style.display = 'block';
      } else {
        promptEl.style.display = 'none';
      }
    } else {
      promptEl.style.display = 'none';
    }

    // sun follows player for crisp shadows
    const anchor = state.mode === 'drive' ? state.vehicle.root.position : player.position;
    sun.position.set(anchor.x + 120, 180, anchor.z + 60);
    sun.target.position.set(anchor.x, 0, anchor.z);
    sun.target.updateMatrixWorld();

    if (dbg.get('nowater') !== '1' && dbg.get('nowaves') !== '1') terrain.update(waterT);

    // minimap markers (redraw base each time is expensive; redraw overlay on top)
    drawMinimapOverlay();

    // vehicle chips
    vm.vehicles.forEach((v, i) => {
      if (!v) { chips[i].style.display = 'none'; return; }
      chips[i].textContent = v.def.name;
      chips[i].className = 'vchip' + (v === state.vehicle ? ' active' : (v === state.nearVehicle ? ' near' : ''));
    });

    // HUD
    const pos = state.mode === 'drive' ? state.vehicle.root.position : player.position;
    hudEl.innerHTML =
      `Режим: <b>${state.mode === 'drive' ? '🚜 ' + state.vehicle.def.name : 'Пешком'}</b><br>` +
      `Позиция: ${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)}<br>` +
      `<span class="dim">E — сесть/выйти &nbsp; ESC — пауза</span>`;
    if (state.mode === 'drive') {
      gaugeSpeed.innerHTML = `${state.vehicle.speedKmh.toFixed(0)}<small> км/ч</small>`;
    }
  }

  renderer.render(scene, camera);
}

// ================== resize ==================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ================== boot ==================
const barFill = document.getElementById('barFill');
const loadText = document.getElementById('loadText');
const loaderEl = document.getElementById('loader');

loadText.textContent = 'Генерация ландшафта...';
barFill.style.width = '15%';

drawMinimap();
barFill.style.width = '35%';
loadText.textContent = 'Загрузка техники...';

vm.loadAll(terrain).then(() => {
  barFill.style.width = '100%';
  loadText.textContent = 'Готово! Нажми, чтобы играть';
  setTimeout(() => {
    loaderEl.classList.add('hidden');
    state.started = true;
  }, 400);
});

animate();