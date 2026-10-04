// Saved games (road mode): a snapshot of the player, the inventory, the tanks and soldiers around, loot lying on
// the ground, the walls of the infantry posts, turrets on the crane stands and the destruction of the world.
// Settlements, encounters and terrain are regenerated from the world seed; what was taken or already spawned
// is remembered so it does not come back. Stored in localStorage: an index + one entry per save.
import * as THREE from 'three';
import { makePart } from './parts.js';
import { makeWeapon } from './weapons.js';
import { partVisual } from './tanks.js';
import { TankAI, buildCaponier } from './ai.js';

const INDEX = 'dbh-ww1-saves';
const ENTRY = id => `dbh-ww1-save-${id}`;
const VERSION = 1;
const MAX_SAVES = 10;

// ------------------------------------------------------------------ storage
export function listSaves() {
  try { return JSON.parse(localStorage.getItem(INDEX) || '[]'); } catch { return []; }
}
export function loadSave(id) {
  try { return JSON.parse(localStorage.getItem(ENTRY(id)) || 'null'); } catch { return null; }
}
export function deleteSave(id) {
  try {
    localStorage.removeItem(ENTRY(id));
    localStorage.setItem(INDEX, JSON.stringify(listSaves().filter(s => s.id !== id)));
  } catch { /* storage unavailable */ }
}
// returns the index entry or throws (storage full / unavailable)
export function writeSave(data, name) {
  const id = Date.now().toString(36);
  const meta = { id, name, date: new Date().toISOString(), seed: data.seed, km: data.km, kills: data.state.kills, mode: data.mode };
  localStorage.setItem(ENTRY(id), JSON.stringify(data));
  const list = [meta, ...listSaves()];
  while (list.length > MAX_SAVES) localStorage.removeItem(ENTRY(list.pop().id));
  localStorage.setItem(INDEX, JSON.stringify(list));
  return meta;
}

// ------------------------------------------------------------------ serialise
const v3 = p => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
export const partData = p => p && { kind: p.kind, key: p.key, hp: Math.round(p.hp * 10) / 10, fuel: p.fuel, paint: p.paint };
export const weaponData = w => w && { key: w.key, mag: w.mag };
export function mkPart(d) {
  if (!d) return null;
  const p = makePart(d.kind, d.key, d.hp);
  if (d.fuel !== undefined) p.fuel = d.fuel;
  if (d.paint != null) p.paint = d.paint;
  return p;
}
export const mkWeapon = d => d && makeWeapon(d.key, d.mag);

export function pickupData(p) {
  const d = p.data;
  switch (p.type) {
    case 'part': return partData(p.part);
    case 'weapon': return weaponData(d);
    case 'ammo': case 'grenade': case 'canister': case 'shells': case 'plate': case 'spray': return d ? { ...d } : null;
    case 'sandbag': return d && d.place ? { place: d.place, wall: d.wall.id, col: d.wall.cols.indexOf(d.col) } : null;
    default: return null;
  }
}

function tankData(t, director) {
  const ai = director.ais.find(a => a.tank === t);
  return {
    key: t.key, team: t.team, crew: t.crew, pos: v3(t.root.position), heading: t.heading, turretYaw: t.turretYaw,
    parts: Object.fromEntries(Object.entries(t.parts).map(([k, p]) => [k, partData(p)])),
    hp: { hull: t.hp.hull, transmission: t.hp.transmission, ammo: t.hp.ammo },
    ammo: t.ammo, cargo: { weapons: t.cargo.weapons.map(weaponData), ammo: { ...t.cargo.ammo }, grenades: { ...t.cargo.grenades } },
    mg: weaponData(t.mg), bags: t.bags.length, extinguishers: t.extinguishers, loot: { ...t.loot }, plates: [...t.plates],
    paint: t.paint, patches: patchData(t), troops: (t.troops || []).map(k => ({ key: k.key, grenades: { ...k.grenades } })),
    wrecked: t.wrecked, derelict: !!t.derelict, counted: !!t.counted, bayOpen: t.bayOpen, sink: t.sink,
    caponier: t.caponier ? { x: t.caponier.x, z: t.caponier.z, heading: t.caponier.heading } : null,
    ai: ai ? { mode: ai.mode, z0: ai.z0, z1: ai.z1, dir: ai.dir, lane: ai.lane, watchZ: ai.watchZ, leash: ai.leash } : null,
    player: !!t.playerInside,
  };
}

// welded patches: the object they sit on (hull / part / second or auxiliary turret), placement, colour
const r3 = x => Math.round(x * 1000) / 1000;
export function patchData(t) {
  const res = [];
  for (const [h, obj] of t.markHosts()) {
    for (const m of obj.children) {
      if (!m.userData.patch) continue;
      res.push({ h, p: m.position.toArray().map(r3), q: m.quaternion.toArray().map(r3), s: (m.userData.size || [m.scale.x, m.scale.y]).map(r3), c: m.userData.color });
    }
  }
  return res;
}
export function restorePatches(t, list) {
  const hosts = new Map(t.markHosts());
  for (const d of list || []) {
    const host = hosts.get(d.h);
    if (host) t.addPatch(host, new THREE.Vector3(...d.p), new THREE.Quaternion(...d.q), d.s[0], d.s[1], d.c);
  }
}

// g: { state, player, items, tanks, director, world, workshop, infantry, garrisoned, SEED, MODE }
export function snapshot(g) {
  const { state, player, items, tanks, director, world, workshop, infantry } = g;
  const anchor = state.vehicle ? state.vehicle.root.position : player.position;
  const near = p => Math.hypot(p.x - anchor.x, p.z - anchor.z) < 1500;
  const keptTanks = tanks.filter(t => near(t.root.position));
  const pickups = [...items.pickups.values()].filter(p => !/^s\d+:/.test(p.id) && near(p.pos))
    .map(p => ({ id: p.id, type: p.type, x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), data: pickupData(p) }));
  return {
    version: VERSION, mode: 'road', seed: g.SEED, km: +((state.maxZ - state.startZ) / 1000).toFixed(2),
    state: {
      hp: state.hp, mode: state.mode, yaw: state.yaw, pitch: state.pitch, aimYaw: state.aimYaw, crouch: state.crouch,
      startZ: state.startZ, maxZ: state.maxZ, kills: state.kills, infKills: state.infKills, view: state.view,
    },
    player: v3(player.position),
    vehicle: state.vehicle ? keptTanks.indexOf(state.vehicle) : -1,
    items: {
      inventory: { ...items.inventory }, charge: { ...items.charge },
      hands: items.hands, handPart: partData(items.handPart), handShells: items.handShells && { ...items.handShells },
      handCan: items.handCan && { ...items.handCan }, plateColor: items.plateColor,
      sprays: items.sprays.map(c => ({ ...c })), sprayIdx: items.sprayIdx,
      small: weaponData(items.small), big: weaponData(items.big), ammo: { ...items.ammo }, grenades: { ...items.grenades },
      drawn: items.drawn, grenadeKey: items.grenadeKey, taken: [...items.taken], dropN: items.dropN,
    },
    pickups,
    walls: director.walls.filter(w => near(w)).map(w => ({ id: w.id, x: w.x, z: w.z, cols: w.cols.map(c => ({ x: c.x, z: c.z, gy: c.gy, ids: c.ids })) })),
    tanks: keptTanks.map(t => tankData(t, director)),
    soldiers: infantry.soldiers.filter(s => s.alive && near(s.pos)).map(s => ({
      key: s.weapon.key, mag: s.weapon.mag, kind: s.kind, grenades: { ...s.grenades }, pos: v3(s.pos), heading: s.heading,
      hp: s.hp, squad: s.squad, post: v3(s.post), guardDir: s.guardDir,
    })),
    spawned: [...director.spawned],
    garrisoned: [...g.garrisoned],
    workshop: [...workshop.store.entries()].map(([k, sl]) => [k, sl.map(it => it && { turret: partData(it.turret), gun: partData(it.gun) })]),
    ruins: [...world.ruins],
    brokenTrees: [...world.brokenTrees.entries()],
  };
}

// first part of loading, before the world around is generated: what is destroyed, taken, spawned already
export function restoreBefore(g, d) {
  const { items, director, world, workshop } = g;
  for (const id of d.ruins) world.ruins.add(id);
  for (const [id, b] of d.brokenTrees) world.brokenTrees.set(id, b);
  for (const j of d.spawned) director.spawned.add(j);
  for (const k of d.garrisoned) g.garrisoned.add(k);
  for (const [k, sl] of d.workshop) {
    workshop.store.set(k, sl.map(it => {
      if (!it) return null;
      const turret = mkPart(it.turret), gun = mkPart(it.gun);
      if (gun) partVisual(turret).gunPivot.add(partVisual(gun).group);
      return { turret, gun };
    }));
  }
  for (const id of d.items.taken) items.taken.add(id);
}

// rebuild the saved game into the freshly generated world (before the first frame). Returns the tank the player
// sits in (or null).
export function restore(g, d) {
  const { state, player, items, director, world, infantry } = g;
  Object.assign(state, d.state);
  state.mode = 'walk';
  player.position.set(...d.player);
  // inventory
  const I = d.items;
  Object.assign(items.inventory, I.inventory);
  Object.assign(items.charge, I.charge);
  items.small = mkWeapon(I.small); items.big = mkWeapon(I.big);
  items.ammo = { ...I.ammo }; items.grenades = { ...I.grenades };
  items.drawn = I.drawn; items.grenadeKey = I.grenadeKey;
  if (I.plateColor != null) items.plateColor = I.plateColor;
  items.sprays = (I.sprays || []).map(c => ({ ...c }));
  items.sprayIdx = I.sprayIdx || 0;
  items.dropN = Math.max(items.dropN, I.dropN || 0);
  items.hands = null;
  if (I.hands === 'part' && I.handPart) items.holdPart(mkPart(I.handPart), g.camera);
  else if (I.hands === 'shells') { items.hands = 'shells'; items.handShells = I.handShells; }
  else if (I.hands === 'canister') { items.hands = 'canister'; items.handCan = I.handCan; }
  else if (I.hands) items.hands = I.hands;
  // walls of the infantry posts, then everything lying around
  const walls = new Map();
  for (const w of d.walls) {
    const wall = { id: w.id, x: w.x, z: w.z, cols: [] };
    for (const c of w.cols) {
      const col = { x: c.x, z: c.z, gy: c.gy, ids: [...c.ids], obstacle: null };
      if (col.ids.length) col.obstacle = world.addObstacle({ x: c.x, z: c.z, hx: 0.36, hz: 0.28, rot: world.roadHeading(c.z), y0: c.gy - 0.5, y1: c.gy + 0.35 * col.ids.length, wall: true });
      wall.cols.push(col);
    }
    director.walls.push(wall);
    walls.set(w.id, wall);
  }
  for (const p of d.pickups) {
    let data = p.data;
    if (p.type === 'part') data = mkPart(p.data);
    else if (p.type === 'weapon') data = mkWeapon(p.data);
    else if (p.type === 'sandbag' && data && data.wall) {
      const wall = walls.get(data.wall);
      data = wall ? { place: data.place, wall, col: wall.cols[data.col] } : null;
    }
    items.add(p.id, p.type, p.x, p.z, data, p.y ?? null);
  }
  // tanks
  let vehicle = null;
  d.tanks.forEach((td, i) => {
    const parts = Object.fromEntries(Object.entries(td.parts).map(([k, p]) => [k, mkPart(p)]));
    const t = g.spawnTank(td.key, td.pos[0], td.pos[2], td.heading, {
      team: td.team, crew: td.crew, parts, ammo: td.ammo, mg: td.mg ? td.mg.key : null, mgAmmo: 0,
      cargo: { weapons: td.cargo.weapons.map(mkWeapon), ammo: { ...td.cargo.ammo }, grenades: { ...td.cargo.grenades } },
      bags: td.bags, kits: td.loot.repair_kit, torches: td.loot.torch, plates: td.plates, sink: td.sink, paint: td.paint, troops: td.troops,
    });
    restorePatches(t, td.patches);
    if (t.mg && td.mg) t.mg.mag = td.mg.mag;
    Object.assign(t.hp, { hull: td.hp.hull, transmission: td.hp.transmission, ammo: td.hp.ammo });
    t.turretYaw = td.turretYaw || 0;
    t.extinguishers = td.extinguishers;
    t.derelict = td.derelict; t.counted = td.counted;
    if (td.bayOpen) t.setBay(true);
    if (td.caponier) {
      t.caponier = buildCaponier(world, td.caponier.x, td.caponier.z, td.caponier.heading);
      t.caponier.heading = td.caponier.heading;
      director.caponiers.push(t.caponier);
    }
    if (td.ai && t.crew) director.ais.push(new TankAI(t, td.ai.mode, world, td.ai));
    if (td.wrecked) t.makeWreck();
    if (i === d.vehicle) vehicle = t;
  });
  // soldiers (their squads keep together)
  let maxSquad = infantry.squadN;
  for (const sd of d.soldiers) {
    const s = infantry.spawn(sd.pos[0], sd.pos[2], { key: sd.key, kind: sd.kind, grenades: sd.grenades, squad: sd.squad, heading: sd.heading, guardDir: sd.guardDir });
    if (!s) continue;
    s.hp = sd.hp; s.weapon.mag = sd.mag;
    s.post.set(...sd.post);
    maxSquad = Math.max(maxSquad, sd.squad);
  }
  infantry.squadN = maxSquad;
  return vehicle;
}
