// DBH-WW1 Three.js — main game orchestrator
import * as THREE from 'three';
import { World, WATER_LEVEL, segBox } from './world.js';
import { Tank, MODULE_NAMES, G } from './tanks.js';
import { HULLS, STARTER_TANK, makePart } from './parts.js';
import { Combat, Effects, describeHit } from './combat.js';
import { EnemyDirector, TankAI } from './ai.js';
import { Items, CANISTER_L, buildItemMesh } from './items.js';
import { STEEL } from './paint.js';
import { Workshop } from './workshop.js';
import { Sfx } from './audio.js';
import { Guns, WEAPONS, makeWeapon } from './weapons.js';
import { Infantry } from './infantry.js';
import { ViewModel } from './viewmodel.js';
import { difficultyAt, soldierKit } from './loot.js';
import { rng } from './noise.js';
import { worldOptions, setupDuel, setupRange, duelStatus, clampToBounds, MODE_NAMES } from './modes.js';
import { showMenu } from './menu.js';
import { snapshot, restore, restoreBefore, writeSave, loadSave } from './save.js';
import { Net, NET_KEY } from './net.js';
import { $ } from './game/dom.js';
import { createRenderer, createSky, createPipeline, initialQuality, backendName, BASE_FOV } from './game/render.js';
import { createPanels } from './game/panels.js';
import { createStash } from './game/stash.js';
import { createMenus } from './game/menus.js';
import { createService } from './game/service.js';
import { createSmallArms } from './game/smallarms.js';
import { createInside } from './game/inside.js';
import { createInteract } from './game/interact.js';
import { createMotion } from './game/motion.js';
import { createNetUI } from './game/netui.js';

// debug flags: ?nowater=1 ?noclouds=1 ?notrees=1 ?notanks=1 ?noenemies=1 ?noinfantry=1 ?noshadows=1 ?nofog=1
//              ?waterred=1 ?watery=N ?noaa=1 ?logdepth=1 ?seed=N ?god=1 ?start=Z ?view=N
// game: ?mode=road|duel|range (&tank=KEY &enemies=K1,K2), ?load=SAVE_ID; without a mode the main menu is shown
// (?seed / ?start alone start the road directly)
const dbg = new URLSearchParams(location.search);
const LOAD = dbg.has('load') ? loadSave(dbg.get('load')) : null;
const MODE = LOAD ? 'road' : (dbg.get('mode') || (dbg.has('seed') || dbg.has('start') ? 'road' : null));
const CFG = { mode: MODE, tank: dbg.get('tank'), enemies: (dbg.get('enemies') || '').split(',').filter(Boolean) };
// network play: ?net=host (this machine runs the world and waits for a second player) / ?net=guest (joins, see net.js)
const NET = MODE && !LOAD && ['host', 'guest'].includes(dbg.get('net')) ? dbg.get('net') : null;
let net = null;
// every game gets its own world unless a seed is given (?seed=N replays a world)
const SEED = LOAD ? LOAD.seed : dbg.has('seed') ? parseInt(dbg.get('seed'), 10) : Math.floor(Math.random() * 999999) + 1;

// ================== state ==================
const state = {
  mode: 'walk',          // 'walk' | 'drive'
  vehicle: null,
  view: 'third',         // in a tank: 'third' person or 'inside' (first person in the crew compartment)
  seat: null,            // inside: 'commander' | 'gunner' | 'driver' | null (moving around the compartment)
  inPos: new THREE.Vector3(),    // hull-local position while moving around inside
  headYaw: 0, headPitch: 0,      // inside: head relative to the hull
  slot: null,                    // on foot: tank part slot the player looks at
  lookItem: null,
  crane: null,                   // crane control panel menu open
  stash: null,                   // tank whose stowage menu is open (kits, plates, shells)
  paused: false,
  started: false,
  over: false,
  yaw: 0, pitch: 0,              // on-foot look
  aimYaw: 0, aimPitch: -0.04,    // in-tank look / aim
  velY: 0, onGround: false, crouch: false,
  hp: 100, lastDamageT: -1e9,
  kills: 0, infKills: 0, startZ: 0, maxZ: 0,
  sight: false, fireReq: false,
  wsel: 'gun',                   // in a tank: 'gun' | 'mg' (X toggles)
  mgHeld: false,
  fireHeld: false, fireLatch: false, aim: false, aimK: 0,   // on foot: small arms
  wCool: 0, reloadT: 0, kick: 0, runOverT: 0,
  stashPage: 'main',
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

// ================== renderer / scene (game/render.js) ==================
const { renderer, scene, camera } = createRenderer(dbg, document.getElementById('app'));
const world = new World(scene, SEED, worldOptions(MODE || 'road'));
const sky = createSky(scene, camera, dbg, world.VIEW * 128);
const pipeline = createPipeline(renderer, scene, camera, sky, dbg);     // quality is set once the renderer is up (boot)

// ================== world systems ==================
const fx = new Effects(scene);
const sfx = new Sfx();
const combat = new Combat(scene, world, fx, sfx);
combat.god = dbg.get('god') === '1';
const guns = new Guns(scene, world, fx, sfx);
const infantry = new Infantry(scene, world, guns);
const director = new EnemyDirector(world, scene, SEED, infantry);
director.guns = guns;
if (MODE && MODE !== 'road') { director.disabled = true; director.noInfantry = true; }
if (NET === 'guest') { director.disabled = true; director.noInfantry = true; }      // the host runs the enemy
const items = new Items(scene, world);
director.items = items;
items.onTaken = p => director.bagTaken(p);
const workshop = new Workshop(scene, world);
const tanks = [];

// data of a loot item (settlements, wrecks) -> the object the pickup carries
function itemData(it) {
  if (!it) return null;
  switch (it.type) {
    case 'part': return makePart(it.kind, it.key, it.hp);
    case 'weapon': return makeWeapon(it.key, it.mag);
    case 'ammo': return { cal: it.cal, n: it.n };
    case 'grenade': return { key: it.key, n: it.n || 1 };
    case 'canister': return { fuel: it.fuel ?? CANISTER_L };
    case 'plate': return { color: it.color ?? STEEL };
    case 'spray': return { color: it.color, paint: it.paint ?? 100 };
    case 'sandbag': return it.place ? { place: it.place, wall: it.wall, col: it.col } : null;
    default: return null;
  }
}
director.onLoot = (id, type, x, z, data) => {
  if (type === 'ammo' && !data) return;
  items.add(id, type, x, z, itemData({ ...(data || {}), type }));
};

// garrisons: some settlements further down the road are held by enemy infantry (once per game)
const garrisoned = new Set();
function garrison(s) {
  const plan = s.plan;
  if (NET === 'guest' || plan.k < 2 || garrisoned.has(plan.k) || dbg.get('noinfantry') === '1' || dbg.get('noenemies') === '1') return;
  garrisoned.add(plan.k);
  const r = rng((plan.seed ^ 0x9e3779b9) >>> 0);
  const d = difficultyAt(plan.z);
  if (r() > 0.3 + d * 0.45 || !s.houses.length) return;
  const n = plan.type === 'town' ? 4 + Math.floor(r() * 3) : plan.type === 'repair' ? 2 : 2 + Math.floor(r() * 3);
  const h = s.houses[Math.floor(r() * s.houses.length)].f;
  const kits = [];
  for (let i = 0; i < n; i++) kits.push(soldierKit(r, d));
  const side = h.x > world.roadX(h.z) ? -1 : 1;
  // they walk between the houses of the settlement
  const patrol = [];
  for (let i = 0; i < 4 && s.houses.length; i++) {
    const hf = s.houses[Math.floor(r() * s.houses.length)].f, sd = hf.x > world.roadX(hf.z) ? -1 : 1;
    patrol.push({ x: hf.x + sd * 7 * Math.cos(hf.rot), z: hf.z - sd * 7 * Math.sin(hf.rot) });
  }
  infantry.spawnSquad(h.x + side * 7 * Math.cos(h.rot), h.z - side * 7 * Math.sin(h.rot), kits, h.rot, r, { patrol, guardDir: h.rot + (side > 0 ? Math.PI / 2 : -Math.PI / 2) });
}

world.onSettlementBuilt = s => {
  for (const it of s.items) items.add(it.id, it.type, it.x, it.z, itemData(it));
  workshop.onBuilt(s);
  garrison(s);
};
world.onHouseRuined = (x, y, z, size) => {
  const p = new THREE.Vector3(x, y, z);
  for (let i = 0; i < 14; i++) {
    const q = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * size, Math.random() * 2, (Math.random() - 0.5) * size));
    fx.spawn('dust', q, new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), 1.6);
  }
  sfx.boom(p.distanceTo(camera.position), 0.8);
};
world.onSettlementRemoved = s => {
  for (const it of s.items) items.remove(it.id, false);
  workshop.onRemoved(s);
};

// warm light inside the crew compartment (always in the scene so the light count never changes)
const cabinLight = new THREE.PointLight(0xffe2b0, 0, 4.5, 2);
scene.add(cabinLight);

const player = new THREE.Object3D();
const playerVel = new THREE.Vector3();
scene.add(player);

// fuel can / sandbag carried in hands
const handCan = buildItemMesh('canister');
handCan.remove(handCan.userData.glow);
handCan.position.set(0.25, -0.75, -0.8);
handCan.rotation.set(0.1, -0.4, 0);
handCan.visible = false;
camera.add(handCan);
const handBag = buildItemMesh('sandbag');
handBag.remove(handBag.userData.glow);
handBag.position.set(0.0, -0.62, -0.9);
handBag.rotation.set(0.35, 0.2, 0);
handBag.visible = false;
camera.add(handBag);
// weapon in hands (first-person view model with hands, bob and sway)
const viewModel = new ViewModel(camera);

// plate carried in hands (child of the camera)
const handPlate = buildItemMesh('plate');
handPlate.remove(handPlate.userData.glow);
handPlate.position.set(0.1, -0.95, -1.0);
handPlate.rotation.set(0.25, 0.2, -0.35);
handPlate.visible = false;
handPlate.traverse(o => { if (o.isMesh) o.castShadow = false; });
camera.add(handPlate);
// box of shells carried in hands
const handShells = buildItemMesh('shells');
handShells.remove(handShells.userData.glow);
handShells.position.set(0.05, -0.75, -1.0);
handShells.rotation.set(0.3, 0.35, 0);
handShells.visible = false;
handShells.traverse(o => { if (o.isMesh) o.castShadow = false; });
camera.add(handShells);

function spawnTank(key, x, z, heading, opts) {
  const t = new Tank(scene, key, new THREE.Vector3(x, 0, z), heading, opts);
  tanks.push(t);
  if (net && net.host) net.register(t);
  return t;
}

function removeTank(t) {
  if (net) net.tankRemoved(t);
  t.dispose();
  const i = tanks.indexOf(t);
  if (i >= 0) tanks.splice(i, 1);
  director.release(t);
}

// ================== messages / HUD helpers ==================
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
  const mine = (state.vehicle && res.shooter === state.vehicle) || !!(res.shooter && res.shooter.player);
  if (mine) showHit(describeHit(res));
  if (res.bail) bailOut(res.tank);
  // the infantry in a personnel carrier: lost with it, or out of the back when its crew is killed
  else if (res.tank.troops && res.tank.troops.length && res.tank.team === 'enemy') {
    if (res.destroyed) res.tank.troops = [];
    else if (res.crewKilled) director.dismount(res.tank);
  }
  if ((res.crewKilled || res.destroyed || res.bail) && res.tank.team === 'enemy' && !res.tank.counted) {
    res.tank.counted = true;
    if (mine) {
      state.kills++;
      msg(res.destroyed ? `${res.tank.def.name} противника уничтожен`
        : res.bail ? `Экипаж горящего ${res.tank.def.name} выскакивает из танка!`
        : `Экипаж ${res.tank.def.name} уничтожен — танк можно захватить`, '#9fe07f');
    }
  }
  if (res.tank === state.vehicle) ownHitMsg(res);
};
function ownHitMsg(res) {
  flashDamage();
  const mods = res.modules.map(m => MODULE_NAMES[m].toLowerCase());
  if (res.ricochet) msg('Рикошет по нашему танку', '#ddd');
  else if (!res.pen && !mods.length) msg('Попадание — броня выдержала', '#ddd');
  else msg('Нас пробили' + (mods.length ? ': ' + mods.join(', ') : ''), '#ff9a7a');
  if (res.fire) msg(res.fire === 'ammo' ? 'Боеукладка горит! Туши — F!' : 'Бензобак горит! Туши — F!', '#ff5a3a');
}
combat.onPlayerDamage = (amount) => damagePlayer(amount);
combat.onExplosion = (pos, r, dmg, owner) => { infantry.explosion(pos, r, dmg, owner); if (net) net.explosion(pos, r, dmg); };

// crew of a burning enemy tank jumps out and fights on foot (soldiers who took the tank over keep their own kit)
function bailOut(t) {
  if (dbg.get('noinfantry') === '1') return;
  const d = difficultyAt(t.root.position.z);
  const n = 2 + (Math.random() < 0.5 ? 1 : 0);
  const own = !!(t.crewKits && t.crewKits.length);
  const kits = own ? t.crewKits : [];
  if (!own) for (let i = 0; i < n; i++) kits.push(soldierKit(Math.random, d, true));
  t.crewKits = null;
  // riding infantry of a personnel carrier jumps out too
  if (t.troops && t.troops.length) { kits.push(...t.troops.map(k => ({ ...k, kind: 'enemy' }))); t.troops = []; }
  infantry.spawnCrew(t, kits);
}

// enemy soldiers climbed into a free tank: it gets a crew and fights (the player's own tank too, if left behind)
infantry.onBoard = (s, t, first) => {
  if (!first) return;
  if (net) net.takeBack(t);
  const mine = t.team === 'player';
  t.crew = true;
  t.crewHp = 100;
  t.team = 'enemy';
  t.counted = false;
  t.derelict = false;
  if (t.bayOpen) t.setBay(false);
  director.release(t);
  director.ais.push(new TankAI(t, 'hunt', world, { leash: 450 }));
  if (state.stash === t) closeStash();
  const near = t.root.position.distanceTo(state.vehicle ? state.vehicle.root.position : player.position) < 400;
  if (mine) msg(`Противник захватил ваш ${t.def.name}!`, '#ff5a3a');
  else if (near) msg(`Пехота противника заняла ${t.def.name}!`, '#ff9a7a');
};

// small arms / grenades
guns.onPlayerHit = (amount) => damagePlayer(amount, true);
guns.onExplosion = (pos, r, dmg, owner) => {
  infantry.explosion(pos, r, dmg, owner);
  if (net) net.explosion(pos, r, dmg);
  if (troopShoot() && !combat.god) {
    const d = pos.distanceTo(camera.position);
    if (d < r) damagePlayer(dmg * (1 - d / r) * 0.7);
  } else if (state.mode === 'walk' && !combat.god) {
    const d = pos.distanceTo(player.position.clone().setY(player.position.y + 0.8));
    if (d < r) damagePlayer(dmg * (1 - d / r) * 0.9);
  }
};
guns.onGrenadeTank = (t, point, dir, D, owner) => {
  const vol = t.hitVolumes()[0];
  combat.hitTank(t, vol, point, dir, { pen: D.pen, dmg: 0.8, owner });
};
infantry.onDeath = (s, owner) => {
  const p = s.pos;
  const a = Math.random() * 6.28;
  items.drop('weapon', p.x + Math.sin(a) * 0.7, p.z + Math.cos(a) * 0.7, s.weapon);
  const W = WEAPONS[s.weapon.key];
  if (Math.random() < 0.8) items.drop('ammo', p.x + Math.sin(a + 2) * 0.8, p.z + Math.cos(a + 2) * 0.8, { cal: W.cal, n: Math.round(Math.max(10, W.mag) * (0.6 + Math.random())) });
  for (const [k, n] of Object.entries(s.grenades)) if (n > 0) items.drop('grenade', p.x + Math.sin(a + 4) * 0.8, p.z + Math.cos(a + 4) * 0.8, { key: k, n });
  if (net && net.infantryKilled(owner)) return;                 // the other player's kill
  if (owner && (owner.player || (owner.tank && owner.tank === state.vehicle))) {
    state.infKills++;
    showHit(owner.tank ? 'Пехотинец уничтожен' : 'Противник убит');
  }
};

function damagePlayer(amount, bullet = false) {
  if (state.over || state.dead || combat.god) return;
  if (bullet && state.mode === 'walk' && Math.random() < 0.3) msg('Вы ранены!', '#ff9a7a');
  state.hp -= amount;
  state.lastDamageT = state.time;
  flashDamage();
  if (state.mode === 'drive') msg(`Экипаж ранен (−${Math.round(amount)})`, '#ff9a7a');
  if (state.hp <= 0) {
    state.hp = 0;
    gameOver(state.mode === 'drive' ? 'Экипаж погиб.' : 'Вы погибли.');
  }
}

function victory(text = null) {
  if (state.duel) state.duel.over = true;
  state.over = true;
  const st = duelStatus(state);
  $('vStats').textContent = text || `Уничтожено танков противника: ${st.total} · время боя ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}` +
    ` · ваш танк: ${state.vehicle ? state.vehicle.def.name : '—'}`;
  if (net && net.host) net.victory($('vStats').textContent);
  $('victory').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  sfx.setEngine(false, 0);
}

function gameOver(reason) {
  if (state.over) return;
  // network play: the game goes on - back on your feet beside the other player after a while
  if (net && net.connected && !state.dead) { netDeath(reason); return; }
  state.over = true;
  $('goReason').textContent = reason;
  $('goStats').textContent = `Пройдено: ${((state.maxZ - state.startZ) / 1000).toFixed(2)} км · Уничтожено танков: ${state.kills}` +
    ` · пехоты: ${state.infKills} · мир #${SEED}`;
  $('gameover').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  sfx.setEngine(false, 0);
}

// network play: killed - back on your feet beside the other player after a while
function netDeath(reason) {
  state.dead = true;
  state.deadT = 10;
  state.hp = 0;
  msg(`${reason} Возрождение через 10 с рядом с напарником.`, '#ff9a7a');
  if (state.mode === 'drive') exitVehicle(true);
  state.fireHeld = false; state.aim = false;
}
function netRespawn() {
  const p = (net && net.partnerPos()) || player.position.clone();
  const a = Math.random() * Math.PI * 2;
  p.x += Math.sin(a) * 4; p.z += Math.cos(a) * 4;
  p.y = world.heightAt(p.x, p.z);
  player.position.copy(p);
  state.dead = false;
  state.hp = 100;
  state.velY = 0;
  msg('Снова в строю', '#9fe07f');
}

// ================== input ==================
const keys = {};
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.code === 'F5') { e.preventDefault(); if (state.started && !e.repeat) saveGame(); return; }
  if (e.code === 'Escape') {
    if (state.repairOpen) { closeRepair(); return; }
    if (state.crane) { closeCrane(); return; }
    if (state.stash) { closeStash(); return; }
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
  if (e.code === 'KeyG') dropHeld();
  if (e.code === 'KeyV' && state.mode === 'drive') toggleView();
  if (e.code === 'KeyQ') pressQ();
  if (e.code === 'KeyR') {
    if (state.repairOpen) closeRepair();
    else if ((state.mode === 'walk' || troopShoot()) && !state.crane && !state.stash && startReload()) { /* reloading */ }
    else if (state.mode === 'walk' && items.drawnWeapon() && !state.nearTank) {
      const { w, W } = items.drawnWeapon();
      if (w.mag >= W.mag) msg('Магазин полон');
    } else openRepair();
  }
  if (e.code === 'KeyX' && state.mode === 'drive') toggleTankWeapon();
  if (e.code === 'KeyO' && state.mode === 'walk') nextSpray();
  const dg = /^Digit([0-9])$/.exec(e.code);
  if (dg) {
    const n = (parseInt(dg[1], 10) + 9) % 10;          // 1..9 -> 0..8, 0 -> 9
    if (state.repairOpen) doRepair(n);
    else if (state.crane) doCrane(n);
    else if (state.stash) doStash(n);
    else if (troopSeat() && n < 3) selectWeapon(n);
    else if (state.mode === 'drive' && state.view === 'inside' && n < SEAT_KEYS.length) sitAt(SEAT_KEYS[n]);
    else if (state.mode === 'walk' && n < 3) selectWeapon(n);
  }
});

// who the player controls from the current position in the tank
const SEAT_KEYS = ['commander', 'gunner', 'driver'];
const SEAT_NAMES = { commander: 'командир', gunner: 'наводчик', driver: 'механик-водитель' };
const seatName = role => SEAT_NAMES[role] || (/^troop/.test(role) ? 'десант' : role);
const canGun = () => state.mode === 'drive' && (state.view !== 'inside' || state.seat === 'gunner' || state.seat === 'commander');
// a personnel carrier's troop seat from which the player fires his own weapon (over the side / from the hatch)
function troopSeat() {
  if (state.mode !== 'drive' || state.view !== 'inside' || !state.seat || !/^troop/.test(state.seat)) return null;
  return seatByRole(state.vehicle, state.seat) || null;
}
const troopShoot = () => { const s = troopSeat(); return !!(s && s.fire); };
const canDrive = () => state.mode === 'drive' && (state.view !== 'inside' || state.seat === 'driver' || state.seat === 'commander');
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('mousemove', e => {
  if (!locked || state.paused || !state.started || state.over) return;
  if (state.mode === 'walk') {
    state.yaw -= e.movementX * MOUSE_SENS;
    state.pitch -= e.movementY * MOUSE_SENS;
    viewModel.look(-e.movementX * MOUSE_SENS, -e.movementY * MOUSE_SENS);
    state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch));
  } else if (!canGun()) {
    // inside the tank without the gun: just turn the head
    state.headYaw -= e.movementX * MOUSE_SENS;
    state.headPitch -= e.movementY * MOUSE_SENS;
    const lim = state.seat === 'driver' ? 1.7 : Math.PI;
    if (lim < Math.PI) state.headYaw = Math.max(-lim, Math.min(lim, state.headYaw));
    else state.headYaw = Math.atan2(Math.sin(state.headYaw), Math.cos(state.headYaw));
    state.headPitch = Math.max(-1.1, Math.min(0.9, state.headPitch));
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
  if (e.button === 0 && locked && troopShoot()) state.fireHeld = true;
  else if (e.button === 0 && locked && state.mode === 'drive') { if (state.wsel === 'mg') state.mgHeld = true; else state.fireReq = true; }
  if (e.button === 2 && troopShoot()) state.aim = true;
  if (e.button === 0 && locked && state.mode === 'walk') state.fireHeld = true;
  if (e.button === 2 && canGun()) state.sight = true;
  if (e.button === 2 && state.mode === 'walk') state.aim = true;
});
document.addEventListener('mouseup', e => {
  if (e.button === 2) { state.sight = false; state.aim = false; }
  if (e.button === 0) { state.fireHeld = false; state.mgHeld = false; }
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
  if (v) for (const k in keys) keys[k] = false;       // (network play: the world goes on while paused)
  pauseEl.classList.toggle('hidden', !v);
  if (v && locked) document.exitPointerLock();
  if (!v && !locked) canvas.requestPointerLock()?.catch?.(() => {});
}
pauseEl.addEventListener('click', e => { if (state.paused && e.target === pauseEl) setPause(false); });
$('bResume').onclick = e => { e.stopPropagation(); setPause(false); };
$('bMenu').onclick = e => { e.stopPropagation(); if (confirm('Выйти в главное меню? Несохранённый прогресс пропадёт.')) location.href = location.pathname; };
$('bSave').onclick = e => { e.stopPropagation(); saveGame(); };
$('bAgain').onclick = () => {
  // the same mode again (a new world on the road unless the seed was chosen)
  if (MODE === 'road' && !dbg.has('seed')) location.search = '?mode=road';
  else if (LOAD) location.search = '?mode=road&seed=' + SEED;
  else location.reload();
};

// ================== saving ==================
function saveGame() {
  if (MODE !== 'road') { msg('Сохранение доступно только в основной игре'); return; }
  if (NET) { msg('В сетевой игре сохранение недоступно'); return; }
  if (state.over) return;
  try {
    const data = snapshot({ state, player, items, tanks, director, world, workshop, infantry, garrisoned, SEED });
    const where = nextSettlementLabel(state.vehicle ? state.vehicle.root.position : player.position).replace(/^Впереди: /, 'у ');
    const meta = writeSave(data, `Мир #${SEED}, ${data.km} км — ${where}`);
    msg(`Игра сохранена: ${meta.name}`, '#9fe07f');
    $('seedInfo').textContent = `Мир #${SEED} — сохранено ${new Date().toLocaleTimeString('ru-RU')}`;
  } catch (err) {
    console.error(err);
    msg('Не удалось сохранить игру (хранилище браузера недоступно или заполнено)', '#ff9a7a');
  }
}

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
    const np = new THREE.Vector3(nx, ny, nz);
    const ob = world.raycastObstacles(p, np), tr = world.raycastTrees(p, np);
    const tt = Math.min(ob ? ob.t : 2, tr ? tr.t : 2);
    if (tt <= 1) return p.lerp(np, tt);
    p.copy(np);
    if (ny < Math.max(world.heightAt(nx, nz), WATER_LEVEL)) return p;
  }
  return p;
}

// ================== vehicles: enter / exit ==================
let prefView = 'third';
function tryToggleVehicle(asDriver = false) {
  if (state.mode === 'walk') {
    const v = state.nearTank;
    if (!v) return;
    if (v.wrecked) { msg('Танк сгорел — внутрь не сесть'); return; }
    if (v.crew) { msg('В этом танке живой экипаж!', '#ff9a7a'); return; }
    if (items.hands === 'plate') { stowPlate(v); return; }
    if (items.hands === 'shells') { loadShells(v); return; }
    if (items.hands === 'sandbag') { placeSandbag(v); return; }
    if (items.hands === 'canister') { msg('Удерживай F у танка — залить топливо в баки'); return; }
    if (items.hands) { msg('Руки заняты — брось ношу (G)'); return; }
    let ride = false;
    if (net) {
      const c = net.claim(v);
      if (!c) return;
      ride = c === 'ride';
    }
    closeStash();
    closeCrane();
    state.mode = 'drive';
    state.vehicle = v;
    v.playerInside = true;
    state.fireHeld = false; state.aim = false; state.reloadT = 0;
    state.wsel = !v.parts.gun && v.mg ? 'mg' : 'gun';
    const passenger = ride || (v.apc && !asDriver && behindHalf(v, player.position));
    if (v.team !== 'player' && !ride) {
      msg(v.team === 'enemy' ? `Захвачен ${v.def.name} противника` : `Танк ${v.def.name} ваш`, '#9fe07f');
      v.team = 'player';
      director.release(v);
    }
    state.aimYaw = v.heading + v.turretYaw;
    state.aimPitch = -0.04;
    state.crouch = false;
    $('crosshair').classList.add('driving');
    closeRepair();
    state.view = 'third';
    if (passenger) {
      const s = v.seats().find(x => x.troop && x.fire) || v.seats().find(x => x.troop);
      enterInside(s.role);
      msg(`${v.def.name}: вы в десантном отделении. 1/2/3 — оружие, ЛКМ — огонь${s.fire ? '' : ' (отсюда не стрелять — пересядь, Q)'}, Q — встать, E — выйти`, '#c9b48a');
    } else if (prefView === 'inside') enterInside();
    if (v.bayOpen) msg('Моторный отсек открыт — двигатель не заведётся. Выйди и закрой его (Q)', '#e8c96a');
    if (!v.parts.engine) msg('В танке нет двигателя', '#ff9a7a');
    else if (v.fuel <= 0) msg(v.parts.fuel ? 'Баки пусты — нужна заправка или канистра' : 'Нет топливных баков — топливо некуда залить', '#ff9a7a');
  } else exitVehicle();
}

// out of the vehicle (force: even into water - network death)
function exitVehicle(force = false) {
  const v = state.vehicle;
  const b = v.vis.hullBox;
  for (const side of force ? [1, -1, 0] : [1, -1]) {
    const off = new THREE.Vector3(side * (b.max.x + 1.3), 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), v.heading);
    const out = v.root.position.clone().add(off);
    out.y = world.heightAt(out.x, out.z);
    if (out.y < WATER_LEVEL - 0.3 && side) continue;
    if (state.view === 'inside') { leaveInside(); prefView = 'inside'; } else prefView = 'third';
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

// ================== main loop ==================
const timer = new THREE.Timer();
const HUD_DT = 1 / 15;
let hudT = 0;
let despawnT = 0, repairRenderT = 0, craneRenderT = 0, stashRenderT = 0, engineNoiseT = 0;

function frame(dt) {
  state.time += dt;
  const walking = state.mode === 'walk';
  const v = state.vehicle;
  const anchor = walking ? player.position : v.root.position;

  world.update(anchor, 4);
  world.animate(dt);
  const created = director.update(anchor, tanks);
  // network play: the enemy turns up around the other player too
  const ra = net && net.connected && net.host ? net.remoteAnchor() : null;
  if (ra) created.push(...director.update(ra, tanks));
  if (created.length) tanks.push(...created);
  if (state.dead && (state.deadT -= dt) <= 0) netRespawn();

  // AI and player control (network play: the other player is a target too; the guest runs no AI)
  const target = walking
    ? { id: 'local', pos: player.position, vel: playerVel, isTank: false }
    : { id: 'local', pos: v.root.position, vel: v.velocity, isTank: true, tank: v };
  if (walking) target.crouch = state.crouch;
  const targets = [];
  if (!state.over && !state.dead) targets.push(target);
  if (net) { const rt = net.remoteTarget(); if (rt) targets.push(rt); }
  combat.now = state.time;
  if (!net || net.host) {
    director.think(dt, state.time, targets, combat);
    infantry.update(dt, { now: state.time, targets, tanks });
  } else net.puppets(dt);
  if (!walking) updateDriveControls();

  for (const t of tanks) t.update(dt, world, tanks);
  if (world.opts.bounds) for (const t of tanks) clampToBounds(world, t.root.position);
  if (net) net.update(dt);

  if (walking) updateWalk(dt);
  else {
    if (state.view === 'inside' && !state.seat) updateInsideWalk(dt);
    updateDriveCamera(dt);
  }
  const cr = workshop.update(dt);
  if (cr) {
    msg(cr.kind === 'remove' ? `Кран: башня снята и уложена на площадку ${cr.slot + 1}` : `Кран: башня установлена на ${cr.tank.def.hullName}`, '#9fe07f');
    if (cr.warn) msg(cr.warn, '#e8c96a');
  }

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
  if (state.duel && !state.duel.over && duelStatus(state).left === 0) victory();

  // combat
  combat.tanks = tanks;
  combat.foot = { pos: player.position, active: walking };
  combat.listener.copy(camera.position);
  combat.update(dt);
  guns.tanks = tanks;
  guns.soldiers = infantry.soldiers;
  guns.foot = { pos: player.position, active: walking, crouch: state.crouch };
  guns.exposed = troopShoot() ? { pos: camera.position } : null;
  guns.listener.copy(camera.position);
  guns.update(dt);
  if (walking || troopShoot()) updateWeapon(dt); else updateViewModel(dt);
  fx.update(dt);
  items.update(dt);

  // interactions
  if (walking) {
    updateLookTarget();
    state.nearPanel = workshop.nearestPanel(player.position);
    if (state.crane && (!state.nearPanel || state.nearPanel !== state.crane)) closeCrane();
    else if (state.crane && (craneRenderT -= dt) <= 0) { craneRenderT = 0.3; renderCrane(); }
    let best = null, bd = TANK_REACH;
    for (const t of tanks) {
      const d = tankDist(t, player.position);
      if (d < bd && (!net || net.usable(t))) { bd = d; best = t; }      // (network: not the other player's tank)
    }
    state.nearTank = best;
    updateHold(dt);
    state.zone = null; state.zoneText = null;
  } else {
    state.nearTank = null;
    state.slot = null; state.nearItem = null; state.nearPanel = null;
    state.zone = currentZone(v.root.position);
    state.zoneText = serviceTank(v, state.zone, dt);
    // soldiers around hear the engine
    if (Math.abs(v.speed) > 1 && (engineNoiseT -= dt) <= 0) { engineNoiseT = 1; infantry.noise(v.root.position, 50 + Math.abs(v.speed) * 5); }
    $('hold').style.display = 'none';
    sfx.setEngine(v.operated && v.maxSpeedEff > 0, Math.min(1, Math.abs(v.speed) / v.def.maxSpeed + Math.abs(v.controls.throttle) * 0.3));
  }
  if (state.stash) {
    if (!walking || state.stash.wrecked || state.stash.crew || tankDist(state.stash, player.position) > TANK_REACH + 1) closeStash();
    else if ((stashRenderT -= dt) <= 0) { stashRenderT = 0.3; renderStash(); }
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
      if (t === v || (net && !net.host)) continue;     // the guest's tanks come and go with the host's world
      const far = t.team === 'player' ? 2500 : 1500;
      if (t.root.position.distanceTo(anchor) > far && (!ra || t.root.position.distanceTo(ra) > far)) removeTank(t);
    }
    if (!net || net.host) infantry.prune(anchor, 700, ra);           // (the guest's soldiers come from the host)
    director.prune(anchor);
    for (const p of [...items.pickups.values()]) {
      if (p.id.startsWith('drop:') && Math.hypot(p.pos.x - anchor.x, p.pos.z - anchor.z) > 1200) items.remove(p.id, false);
    }
  }

  sky.update(dt, anchor);

  // progress
  state.maxZ = Math.max(state.maxZ, anchor.z);

  // ---------- HUD
  handPlate.visible = walking && items.hands === 'plate';
  if (handPlate.visible) handPlate.userData.plateMat.color.set(items.plateColor);
  handShells.visible = walking && items.hands === 'shells';
  handCan.visible = walking && items.hands === 'canister';
  handBag.visible = walking && items.hands === 'sandbag';
  $('sight').style.display = !walking && state.sight && camera.fov < 30 ? 'block' : 'none';
  $('crosshair').style.display = !walking && state.sight ? 'none' : 'block';
  $('crosshair').classList.toggle('driving', !walking && canGun());
  if (!walking && canGun() && v.parts.gun && state.wsel === 'gun') {
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

  markers.update(dt, { tanks, vehicle: state.vehicle, camera, world, time: state.time });
  // the panels, prompts and the minimap are redrawn 15 times a second (DOM / canvas work is not free)
  if ((hudT -= dt) > 0) return;
  hudT = HUD_DT;
  updateSystemsPanel(v || state.nearTank, !!v);
  updateGauge(v);
  updateInventory();
  updateWeaponPanel();
  updatePrompt();
  if (state.duel || state.netDuel) {
    const st = state.duel ? duelStatus(state) : { left: state.netDuel[0], total: state.netDuel[1] };
    topEl.innerHTML = `Дуэль &nbsp;·&nbsp; противников осталось: <b>${st.left} / ${st.total}</b>`;
  } else if (state.range) topEl.innerHTML = `Танкодром &nbsp;·&nbsp; мишеней поражено: <b>${tanks.filter(t => t.derelict && t.marks.length).length}</b>`;
  else topEl.innerHTML = `Пройдено: <b>${((state.maxZ - state.startZ) / 1000).toFixed(2)} км</b> &nbsp;·&nbsp; Танков: <b>${state.kills}</b>` +
    ` &nbsp;·&nbsp; Пехоты: <b>${state.infKills}</b> &nbsp;·&nbsp; ${sky.clock()}`;
  const heading = walking ? state.yaw : v.heading;
  minimap.draw(anchor, heading, { items, soldiers: infantry.soldiers, tanks, vehicle: state.vehicle, time: state.time });
  $('mmLabel').textContent = state.duel ? 'ДУЭЛЬ' : nextSettlementLabel(anchor);
}

function animate(t) {
  timer.update(t);
  const dt = Math.min(0.05, timer.getDelta());
  // network play: the world does not stop for a pause
  if (!pipeline.quality) return;                  // the renderer is still starting up (boot)
  if ((!state.paused || (net && net.connected)) && state.started && !state.over) frame(dt);
  pipeline.render();
}

// ---- game modules (web/js/game/): each gets this context; functions of the modules are reached through
// wrappers (the modules are created below, after the context)
const ctx = {
  state, keys, player, playerVel, camera, world, tanks, items, combat, guns, infantry, workshop, fx, sfx, viewModel,
  cabinLight, PLAYER_SPEED, PLAYER_RUN, JUMP_V, GRAVITY, BASE_FOV,
  get locked() { return locked; }, set locked(v) { locked = v; },
  get aimDir() { return aimDir; },
  msg, damagePlayer, raycast, tankDist, tankObstacle, troopSeat, troopShoot, seatName, canDrive, canGun,
  // motion / inside
  behindHalf: (...a) => behindHalf(...a),
  nearestSeat: (...a) => nearestSeat(...a),
  seatByRole: (...a) => seatByRole(...a),
  ceilingAt: (...a) => ceilingAt(...a),
  standUp: () => standUp(),
  // interactions / small arms
  partName: (...a) => partName(...a),
  lookDir: (...a) => lookDir(...a),
  // stowage / menus
  grenText: (...a) => grenText(...a),
  sumAmmo: (...a) => sumAmmo(...a),
  paintJob: (...a) => paintJob(...a),
  loadShells: (...a) => loadShells(...a),
  placeSandbag: (...a) => placeSandbag(...a),
  openStash: (...a) => openStash(...a),
  closeStash: () => closeStash(),
  closeRepair: () => closeRepair(),
  openCrane: (...a) => openCrane(...a),
  closeCrane: () => closeCrane(),
};
const { netUI } = createNetUI(ctx);
const { updateWalk, aimDir, updateDriveControls, updateDriveCamera } = createMotion(ctx);
const { updateLookTarget, partName, mgAction, pressF } = createInteract(ctx);
const { toggleView, enterInside, behindHalf, leaveInside, seatByRole, sitAt, standUp, nearestSeat, ceilingAt, updateInsideWalk, pressQ } = createInside(ctx);
const { selectWeapon, startReload, lookDir, updateWeapon, updateViewModel, toggleTankWeapon } = createSmallArms(ctx);
const { currentZone, serviceTank } = createService(ctx);
const { openRepair, closeRepair, renderRepair, doRepair, openCrane, closeCrane, renderCrane, doCrane } = createMenus(ctx);
const { placeSandbag, stowPlate, loadShells, sumAmmo, grenText, openStash, closeStash, renderStash, doStash, dropHeld, paintJob, nextSpray, updateHold } = createStash(ctx);
const { topEl, gunMark, fireEl, updateSystemsPanel, updateInventory, updateGauge, updateWeaponPanel, nextSettlementLabel, markers, minimap, updatePrompt } = createPanels(ctx);

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

  // the road starts with the weakest machine of all (the rest come along the road in the order they appeared
  // in the world): the player's one and a spare of the same type across the road
  const r0 = rng((SEED * 2654435761) >>> 0);
  const k1 = STARTER_TANK, k2 = STARTER_TANK;
  const [tx, tz] = at(3, 10);
  const mine = spawnTank(k1, tx, tz, hd, { team: 'player', fuelFrac: 0.8 });
  mine.cargo.weapons.push(makeWeapon(r0() < 0.5 ? 'mosin' : 'kar98k'));
  if (dbg.get('notanks') !== '1') {
    const [x, z] = at(-14, 2);
    spawnTank(k2, x, z, hd, { team: 'neutral', fuelFrac: 0.45 });
  }
  const [ix, iz] = at(10, -2);
  items.add('start:plate', 'plate', ix, iz);
  const [cx, cz] = at(9.5, 1);
  items.add('start:can', 'canister', cx, cz, { fuel: CANISTER_L });
  const [bx, bz] = at(11, 1.5);
  items.add('start:bag', 'sandbag', bx, bz);
  const [sx0, sz0] = at(10.5, -3.5);
  items.add('start:spray', 'spray', sx0, sz0, { color: mine.hullColor, paint: 60 });
  // a revolver and a few rounds in the pocket
  items.small = makeWeapon('nagant');
  items.addAmmo('7.62×38R', 14);
  msg(`Мир #${SEED}. У дороги — твой ${HULLS[k1].name}, через дорогу ещё один ${HULLS[k2].name}.`, '#e8c96a');
  msg('Рядом лежат бронелист, канистра, мешок с песком и баллончик с краской. В кармане — наган (1), в укладке танка — винтовка.', '#e8c96a');
  msg('Дорога ведёт вперёд — дальше техника противника всё сильнее. Удачи, танкист!', '#e8c96a');
  $('seedInfo').textContent = `Мир #${SEED} — повторить: ?seed=${SEED}`;
}

// modes: put the player into a tank at the start
function enterTank(t) {
  state.nearTank = t;
  tryToggleVehicle(true);
}

// continue a saved game
function restoreGame(d) {
  const v = restore({ state, player, items, director, world, workshop, infantry, garrisoned, spawnTank, camera }, d);
  if (v) enterTank(v);
  if (d.state.view === 'inside' && state.vehicle) enterInside();
  msg(`Загружена игра: мир #${SEED}, пройдено ${d.km} км`, '#e8c96a');
  $('seedInfo').textContent = `Мир #${SEED} — повторить: ?seed=${SEED}`;
}

async function boot() {
  await renderer.init();
  pipeline.set(initialQuality(dbg, renderer));
  console.info(`DBH-WW1: ${backendName(renderer)}, графика: ${pipeline.quality}`);
  if (!MODE) {
    // no game chosen: the main menu (it reloads the page with the chosen mode)
    loaderEl.classList.add('hidden');
    showMenu($('menu'));
    return;
  }
  loadText.textContent = LOAD ? 'Загрузка сохранения...' : 'Генерация ландшафта...';
  const startZ = parseFloat(dbg.get('start') || '0');
  const p0 = LOAD ? new THREE.Vector3(...LOAD.player) : MODE === 'duel' ? new THREE.Vector3(0, 0, -235)
    : MODE === 'range' ? new THREE.Vector3(6, 0, -270) : new THREE.Vector3(world.roadX(startZ), 0, startZ);
  if (LOAD) restoreBefore({ items, director, world, workshop, garrisoned }, LOAD);
  const total = world.pendingChunks(p0);
  while (world.pendingChunks(p0) > 0) {
    world.update(p0, 30);
    const left = world.pendingChunks(p0);
    barFill.style.width = `${(1 - left / total) * 60}%`;
    await new Promise(r => setTimeout(r, 0));
  }
  if (NET === 'guest') {
    // the second player: the same world from the seed, the rest comes from the host (net.js)
    $('bSave').style.display = 'none';
    $('seedInfo').textContent = `Сетевая игра (второй игрок) · ${MODE_NAMES[MODE]} · мир #${SEED}`;
    barFill.style.width = '100%';
    const join = (() => { try { return JSON.parse(sessionStorage.getItem(NET_KEY) || 'null'); } catch { return null; } })();
    net = new Net(netCtx(), 'guest');
    if (!join || !join.offer) { loadText.textContent = 'Нет данных для подключения — зайди через меню «Сетевая игра»'; return; }
    loadText.textContent = 'Подключение к хозяину игры...';
    net.join(join).catch(err => { console.error(err); loadText.textContent = 'Не удалось подключиться: ' + err.message; });
    return;
  }
  const ctx = { world, tanks, spawnTank, director, items, player, state, enterTank, msg, cfg: CFG };
  if (LOAD) restoreGame(LOAD);
  else if (MODE === 'duel') setupDuel(ctx);
  else if (MODE === 'range') setupRange(ctx);
  else setupStart();
  if (MODE !== 'road') { $('bSave').style.display = 'none'; $('seedInfo').textContent = MODE_NAMES[MODE]; }
  if (NET === 'host') {
    $('bSave').style.display = 'none';
    net = new Net(netCtx(), 'host');
    net.startHosting().catch(err => { console.error(err); netUI.status('Сеть: ошибка — ' + err.message); });
  }
  barFill.style.width = '100%';
  loadText.textContent = 'Готово! Нажми, чтобы играть';
  setTimeout(() => {
    loaderEl.classList.add('hidden');
    state.started = true;
  }, 300);
}

// ================== network play (net.js) ==================
function netCtx() {
  return {
    state, player, playerVel, camera, scene, world, tanks, items, combat, guns, infantry, director, fx, sfx, MODE, SEED, CFG,
    spawnTank, removeTank, msg, showHit, describeHit, damagePlayer, troopSeat,
    duelStatus: () => duelStatus(state),
    enterVehicle: t => enterTank(t),
    exitVehicle: () => { if (state.mode === 'drive') exitVehicle(true); },
    closeMenus: () => { closeStash(); closeRepair(); closeCrane(); },
    ownHit: res => ownHitMsg(res),
    onVictory: text => victory(text),
    onLost: text => gameOver(text),
    startGuest() {
      // the guest starts with a revolver and a few rounds (the road hands out the rest)
      if (!items.small) { items.small = makeWeapon('nagant'); items.addAmmo('7.62×38R', 14); }
      state.startZ = state.maxZ = player.position.z;
      loaderEl.classList.add('hidden');
      state.started = true;
      msg(`Сетевая игра: ${MODE_NAMES[MODE]}, мир #${SEED}. Второй игрок — в форме цвета хаки.`, '#e8c96a');
    },
    ui: netUI,
  };
}

boot();
renderer.setAnimationLoop(animate);      // (waits for the renderer to initialise)

// handle for debugging / automated tests
window.game = { renderer, scene, sky, pipeline, state, tanks, world, items, combat, director, workshop, player, camera, keys, spawnTank, fx, frame, MODE, saveGame,
  snapshot: () => snapshot({ state, player, items, tanks, director, world, workshop, infantry, garrisoned, SEED }),
  guns, infantry, SEED, selectWeapon, viewModel, startReload, placeSandbag, mgAction, toggleTankWeapon, updateDriveControls,
  openStash, doStash, stowPlate, loadShells,
  enterInside, leaveInside, sitAt, pressF, pressQ, dropHeld, tryToggleVehicle, openCrane, doCrane, get net() { return net; } };
