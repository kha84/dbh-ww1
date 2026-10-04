// Tanks: assembled from a hull and replaceable parts (see parts.js), physics, turret/gun aiming,
// internal modules (systems) and their effect on performance, hit marks, engine bay, crew compartment.
import * as THREE from 'three';
import { WATER_LEVEL } from './world.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HULLS, TURRETS, SYSTEM_PART, TANK_MG, SANDBAG, computeSpec, defaultParts } from './parts.js';
import { buildHull, buildTurret, buildGun, buildEngine, buildFuel, buildDrive,
         buildHullInterior, buildTurretInterior } from './models.js';
import { buildSecondTurretInterior } from './interiors.js';
import { WEAPONS, makeWeapon, bakedWeaponMesh } from './weapons.js';
import { PALETTES } from './modelkit.js';
import { paintObject, patchMaterial, PATCH_GEO } from './paint.js';
import { riderMesh } from './tankdefs/carkit.js';

export const G = 9.81;

export const MODULE_IDS = ['engine', 'transmission', 'turret', 'gun', 'ammo', 'fuel'];
export const SYSTEM_IDS = ['hull', ...MODULE_IDS];
export const MODULE_NAMES = {
  hull: 'Корпус', engine: 'Двигатель', transmission: 'Трансмиссия', turret: 'Поворот башни',
  gun: 'Орудие', ammo: 'Боеукладка', fuel: 'Бензобак',
};
export const TANK_KEYS = Object.keys(HULLS);

const PART_BUILDERS = { engine: buildEngine, gun: buildGun, fuel: buildFuel, drive: buildDrive, turret: buildTurret };
// lazily build the visual of a part; it stays with the part wherever it goes (in its paint, if it was repainted)
export function partVisual(part) {
  if (!part.vis) {
    part.vis = PART_BUILDERS[part.kind](part.key);
    if (part.paint != null) paintObject(part.vis.group, part.paint);
  }
  return part.vis;
}
// colour of a part / of a tank type's stock paint
export const partColor = part => part.paint ?? PALETTES[part.key].main;

const MAX_PATCHES = 60;

// ---------------------------------------------------------------- hit marks
function markTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = (stops) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  };
  if (kind === 'hole') {
    rg([[0, 'rgba(0,0,0,1)'], [0.3, 'rgba(10,8,6,1)'], [0.42, 'rgba(90,80,70,1)'], [0.55, 'rgba(40,30,20,.85)'], [1, 'rgba(20,15,10,0)']]);
    g.strokeStyle = 'rgba(150,140,130,.8)'; g.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * 7;
      g.beginPath(); g.moveTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10); g.lineTo(32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17); g.stroke();
    }
  } else if (kind === 'dent') {
    rg([[0, 'rgba(200,195,185,1)'], [0.18, 'rgba(120,115,105,1)'], [0.35, 'rgba(40,32,24,.9)'], [1, 'rgba(20,15,10,0)']]);
  } else {
    g.save(); g.translate(32, 32); g.scale(0.35, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, 'rgba(210,205,195,1)'); gr.addColorStop(0.4, 'rgba(110,100,90,.9)'); gr.addColorStop(1, 'rgba(30,25,20,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let MARK = null;
function markRes() {
  if (MARK) return MARK;
  const mk = kind => new THREE.MeshStandardMaterial({
    map: markTexture(kind), transparent: true, depthWrite: false, roughness: 0.9, metalness: 0.2,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  MARK = { geo: new THREE.PlaneGeometry(1, 1), hole: mk('hole'), dent: mk('dent'), scrape: mk('scrape') };
  return MARK;
}
const _ray = new THREE.Raycaster();
const _nm = new THREE.Matrix3(), _basis = new THREE.Matrix4(), _hq = new THREE.Quaternion();

// orientation of a flat patch lying on a surface with normal n (its +Z), kept upright (+Y towards up)
function facing(n, out) {
  const t = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  t.addScaledVector(n, -t.dot(n)).normalize();
  _basis.makeBasis(new THREE.Vector3().crossVectors(t, n), t, n);
  return out.setFromRotationMatrix(_basis);
}

function visibleChain(o, stop) {
  for (let p = o; p && p !== stop.parent; p = p.parent) if (!p.visible) return false;
  return true;
}
function isUnder(o, anc) {
  for (let p = o; p; p = p.parent) if (p === anc) return true;
  return false;
}

// ---------------------------------------------------------------- welded patches that follow the armour
// A patch is a thin plate laid onto the surface of its host: a grid of points projected onto the host's own meshes
// (not those of the parts sitting on it). It shrinks / shifts until it lies on one face of the armour (no corner
// hanging in the air over an edge), its vertices follow curved castings, and its rim is a low weld bead.
const PATCH_N = 5, PATCH_T = 0.016;
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pn = new THREE.Vector3(), _po = new THREE.Vector3();
function patchTargets(host) {
  const res = [];
  const walk = o => {
    if (!o.visible || o.userData.mark || o.userData.bag || o.userData.interior) return;
    if (o !== host && o.userData.markHost) return;
    if (o.isMesh) res.push(o);
    for (const c of o.children) walk(c);
  };
  walk(host);
  return res;
}
function patchGeometry(host, pos, quat, sx, sy) {
  const targets = patchTargets(host);
  if (!targets.length) return null;
  host.updateMatrixWorld(true);
  const hq = host.getWorldQuaternion(new THREE.Quaternion());
  const q = hq.clone().multiply(quat);
  const O = host.localToWorld(pos.clone());
  const A = new THREE.Vector3(1, 0, 0).applyQuaternion(q), B = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const Nn = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  // depth of the surface under the point (u, v) of the patch plane (null: nothing flat enough there)
  const depth = (u, v) => {
    _po.copy(O).addScaledVector(A, u).addScaledVector(B, v).addScaledVector(Nn, 0.2);
    _ray.set(_po, _pn.copy(Nn).negate());
    _ray.far = 0.36;
    const hits = _ray.intersectObjects(targets, false);
    for (const h of hits) {
      if (!h.face) continue;
      const n = _pa.copy(h.face.normal).applyMatrix3(_nm.getNormalMatrix(h.object.matrixWorld)).normalize();
      if (n.dot(Nn) < 0.55) return null;
      return 0.2 - h.distance;
    }
    return null;
  };
  const fit = (w, h, cu, cv) => {
    const d = [];
    for (let j = 0; j <= PATCH_N; j++) for (let i = 0; i <= PATCH_N; i++) {
      // corners first would be nicer, but the grid is small: bail out on the first miss
      const z = depth(cu + (i / PATCH_N - 0.5) * w, cv + (j / PATCH_N - 0.5) * h);
      if (z == null || Math.abs(z) > 0.06) return null;
      if (d.length && Math.abs(z - d[d.length - 1]) > 0.035 && i > 0) return null;     // a step in the armour
      d.push(z);
    }
    return d;
  };
  let grid = null, W = sx, H = sy, CU = 0, CV = 0;
  outer: for (let f = 1; f > 0.2; f *= 0.84) {
    const w = sx * f, h = sy * f;
    const sh = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [a, b] of sh) {
      const cu = a * (sx - w) * 0.5 + a * 0.02, cv = b * (sy - h) * 0.5 + b * 0.02;
      if (f === 1 && (a || b)) continue;
      const d = fit(w, h, cu, cv);
      if (d) { grid = d; W = w; H = h; CU = cu; CV = cv; break outer; }
    }
  }
  if (!grid) return null;
  // top surface: grid lifted above the armour; rim: down to just below the surface
  const n1 = PATCH_N + 1, P = [], UV = [], I = [];
  const vert = (i, j, lift, inset = 0) => {
    const u = CU + (i / PATCH_N - 0.5) * W * (1 - inset), v = CV + (j / PATCH_N - 0.5) * H * (1 - inset);
    P.push(u, v, grid[j * n1 + i] + lift);
    UV.push(i / PATCH_N, j / PATCH_N);
    return P.length / 3 - 1;
  };
  for (let j = 0; j <= PATCH_N; j++) for (let i = 0; i <= PATCH_N; i++) {
    const edge = i === 0 || j === 0 || i === PATCH_N || j === PATCH_N;
    vert(i, j, edge ? PATCH_T * 0.55 : PATCH_T);
  }
  for (let j = 0; j < PATCH_N; j++) for (let i = 0; i < PATCH_N; i++) {
    const a = j * n1 + i, b = a + 1, c = a + n1, e = c + 1;
    I.push(a, b, e, a, e, c);
  }
  // skirt around the rim
  const ring = [];
  for (let i = 0; i < PATCH_N; i++) ring.push([i, 0]);
  for (let j = 0; j < PATCH_N; j++) ring.push([PATCH_N, j]);
  for (let i = PATCH_N; i > 0; i--) ring.push([i, PATCH_N]);
  for (let j = PATCH_N; j > 0; j--) ring.push([0, j]);
  const low = ring.map(([i, j]) => vert(i, j, -0.006));
  for (let k = 0; k < ring.length; k++) {
    const [i0, j0] = ring[k], [i1, j1] = ring[(k + 1) % ring.length];
    const t0 = j0 * n1 + i0, t1 = j1 * n1 + i1, l0 = low[k], l1 = low[(k + 1) % ring.length];
    I.push(t0, l0, l1, t0, l1, t1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- sandbags: a pile of three bags
let BAG = null;
function bagRes() {
  if (BAG) return BAG;
  const geos = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  // pillow: a sphere pushed out towards a box
  const sph = new THREE.SphereGeometry(1, 12, 8);
  const pp = sph.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const f = v => Math.sign(v) * Math.pow(Math.abs(v), 0.45);
    pp.setXYZ(i, f(pp.getX(i)), f(pp.getY(i)) * 0.9, f(pp.getZ(i)));
  }
  sph.computeVertexNormals();
  const put = (x, y, z, ry, shade) => {
    const g = sph.clone().applyMatrix4(m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(0.24, 0.09, 0.15)));
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    const c = new THREE.Color(0x8a7650).multiplyScalar(shade);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.deleteAttribute('uv');
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
    geos.push(g);
  };
  put(-0.25, 0.08, 0.02, 0.08, 1.0);
  put(0.25, 0.08, -0.02, -0.1, 0.88);
  put(0.0, 0.08, -0.31, 0.06, 0.95);
  put(-0.02, 0.24, 0.04, 0.04, 1.1);
  BAG = { geo: mergeGeometries(geos, false), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }) };
  return BAG;
}
export function sandbagMesh() {
  const R = bagRes();
  const mesh = new THREE.Mesh(R.geo, R.mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
const PINTLE_MAT = new THREE.MeshStandardMaterial({ color: 0x2c2d2b, roughness: 0.5, metalness: 0.7 });
const PINTLE_GEO = new THREE.CylinderGeometry(0.03, 0.045, 0.3, 8).translate(0, 0.15, 0);

// =====================================================================
// Tank
// =====================================================================
let TANK_ID = 0;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);

export class Tank {
  /** @type {((t: any, dx: number, dz: number, dh: number) => void) | null} a tank driven on the other machine was pushed (net.js) */
  static onPush = null;

  constructor(scene, key, pos, heading, opts = {}) {
    this.id = ++TANK_ID;
    this.scene = scene;
    this.derelict = false;                       // a target hulk / roadside wreck (idle soldiers don't take it)
    this.caponier = null;                        // the pit of an ambush tank (Tank.sinkAt)
    this.remote = false;                         // network play: driven on the other machine
    this.craneLock = false;                      // the repair-station crane is working on it
    /** @type {THREE.Vector3 | null} */
    this.mgTarget = null;                        // what the machine guns aim at (else aimPoint)
    this.key = key;
    this.hull = buildHull(key);
    this.root = this.hull.root;
    this.paint = opts.paint ?? null;             // hull colour when repainted (null: the stock paint of the type)
    if (this.paint != null) paintObject(this.root, this.paint);
    this.turretless = !!HULLS[key].turretless;
    this.apc = !!HULLS[key].apc;                 // armoured personnel carrier: troop seats, no main gun
    this.wheeled = !!HULLS[key].wheeled;         // steers with its front wheels (can't turn on the spot)
    this.car = HULLS[key].car || null;           // 'car' | 'moto': soft-skinned, bullets go through, the men in it are seen
    this.soft = !!HULLS[key].soft;
    this.lean = 0;                               // solo motorcycles lean into the turns / onto the stand
    this.crash = 0;                              // soft vehicles: speed of the last hard knock (the game hurts the men in it)
    /** @type {string | null} */
    this.playerSeat = null;                      // where the player sits, seen from outside (riders of cars / motorcycles)
    this.remoteInside = false;                   // network play: the other player sits in it
    // yaw pivot: turret ring (or the Mark V gun mount)
    this.turret = new THREE.Group();
    this.turret.position.copy(this.turretless ? this.hull.mount : this.hull.ring.pos);
    this.root.add(this.turret);
    // gun pivot used when there is no turret body (Mark V mount / empty ring)
    this.mountPivot = new THREE.Group();
    if (!this.turretless) this.mountPivot.position.set(0, 0.4, 1.0);
    this.turret.add(this.mountPivot);
    // machine-gun pintle (on the turret roof, on the ring when the turret is gone, on the cab of the Mark V)
    this.mgMount = new THREE.Group();
    const post = new THREE.Mesh(PINTLE_GEO, PINTLE_MAT);
    post.castShadow = true;
    this.mgMount.add(post);
    this.mgPost = post;
    this.secondYaw = 0;                          // twin-turret tanks: yaw of the machine-gun turret relative to the hull
    // multi-turret tanks (T-28, T-35): small hull turrets, start turned as close to the front as their arc allows
    this.auxYaw = (this.hull.aux || []).map(a => { a.group.rotation.y = THREE.MathUtils.clamp(0, a.arc[0], a.arc[1]); return a.group.rotation.y; });
    this.mgPivot = new THREE.Group();
    this.mgPivot.position.y = 0.3;
    this.mgPivot.rotation.order = 'YXZ';
    this.mgMount.add(this.mgPivot);
    if (this.hull.mgShield) this.mgPivot.add(this.hull.mgShield);     // the gun shield turns with the gun
    this.turret.add(this.mgMount);
    this.mg = null;
    this.mgMesh = null;
    this.mgCool = 0;
    this.mgYaw = 0; this.mgPitch = 0;
    this.bags = [];                              // sandbags heaped on the hull: [{ face, mesh }]
    this.bump = 0;                               // slowed down after ramming a tree / house
    this.goingK = 1;                             // ground speed factor (world.going: water, swamp mud), eased
    this.pushT = 0;                              // pushing another tank (since the last frames)
    this.vis = { hullBox: this.hull.box, turretBox: null, muzzleLen: 1.2, sightY: 0.5,
                 wheels: this.hull.wheels, wheelR: this.hull.wheelR };
    this.root.position.copy(pos);
    this.heading = heading;
    scene.add(this.root);

    this.team = opts.team || 'neutral';          // 'player' | 'enemy' | 'neutral'
    this.crew = !!opts.crew;                    // AI crew alive
    this.crewHp = 100;
    this.playerInside = false;
    this.parts = { engine: null, gun: null, fuel: null, drive: null, turret: null };
    this.hp = { hull: 100, transmission: 100, ammo: 100 };
    for (const [sys, kind] of Object.entries(SYSTEM_PART)) {
      Object.defineProperty(this.hp, sys, {
        enumerable: true,
        get: () => this.parts[kind] ? this.parts[kind].hp : 0,
        set: v => { if (this.parts[kind]) this.parts[kind].hp = v; },
      });
    }
    const parts = opts.parts || defaultParts(key);
    for (const k of ['engine', 'fuel', 'drive', 'turret', 'gun']) if (parts[k]) this.setPart(k, parts[k], true);
    this.refresh();
    // cars / motorcycles: a figure for every seat that has one (shown while someone sits there)
    this.riders = [];
    if (this.soft) for (const s of this.seats()) if (s.rider) this.riders.push({ role: s.role, troop: s.troop ? +s.role.slice(5) : -1, seat: s, mesh: null, ally: null });

    this.ammo = opts.ammo ?? this.def.ammoMax;
    if (opts.fuelFrac !== undefined && this.parts.fuel) this.fuel = this.fuelMax * opts.fuelFrac;
    // stowage: small arms, cartridges (the machine gun feeds from here), grenades
    const mgKey = opts.mg === undefined ? TANK_MG[key] : opts.mg;
    this.cargo = { weapons: [], ammo: {}, grenades: {}, ...(opts.cargo || {}) };
    if (mgKey) {
      this.setMG(makeWeapon(mgKey));
      const cal = WEAPONS[mgKey].cal;
      if (this.cargo.ammo[cal] === undefined) this.cargo.ammo[cal] = opts.mgAmmo ?? HULLS[key].mgAmmo ?? 500;
    }
    for (let i = 0; i < (opts.bags || 0); i++) this.addSandbag();
    this.extinguishers = 3;
    // infantry riding in a personnel carrier (soldier kits: they dismount to fight)
    this.troops = opts.troops ? [...opts.troops] : [];
    this.loot = { repair_kit: opts.kits || 0, torch: opts.torches || 0 };
    // spare armour plates stowed on board: their colours (a count = plates painted like the tank)
    this.plates = Array.isArray(opts.plates) ? [...opts.plates] : new Array(opts.plates || 0).fill(this.hullColor);
    this.fire = null;                            // { t, max, source, selfOut }
    this.wrecked = false;
    this.sink = opts.sink || 0;
    this.bayOpen = false;
    this.interiorOn = false;
    this.marks = [];

    this.speed = 0;
    this.speedKmh = 0;
    this.tiltX = 0; this.tiltZ = 0;
    this.turretYaw = 0;
    this.gunElev = 0;
    this.aimPoint = null;                        // world point to lay the gun on
    this.reload = 0;
    this.controls = { throttle: 0, steer: 0, brake: 0 };
    this.velocity = new THREE.Vector3();
    this.lastHitT = -1e9;
    this.update(0, null);
  }

  get hullColor() { return this.paint ?? PALETTES[this.key].main; }
  get operated() { return !this.wrecked && (this.crew || this.playerInside); }
  // all the fuel is in the external tanks: it travels with them
  get fuel() { return this.parts.fuel ? this.parts.fuel.fuel : 0; }
  set fuel(v) { if (this.parts.fuel) this.parts.fuel.fuel = Math.max(0, Math.min(this.def ? this.def.fuelMax : 1e9, v)); }
  get mgAmmo() { return this.mg ? this.cargo.ammo[WEAPONS[this.mg.key].cal] || 0 : 0; }
  get enterable() { return !this.wrecked && !this.crew; }

  // ------------------------------------------------ composition
  gunPivot() {
    const T = this.parts.turret;
    return T ? partVisual(T).gunPivot : this.mountPivot;
  }
  canMountGun() { return !this.apc && (!!this.parts.turret || this.turretless); }

  // install / remove a part (turret body is handled by removeTurret / installTurret)
  setPart(kind, part, silent = false) {
    const old = this.parts[kind];
    if (old && old.vis && kind !== 'turret') old.vis.group.removeFromParent();
    this.parts[kind] = part;
    if (part) {
      const v = partVisual(part);
      const g = v.group;
      g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
      g.visible = true;
      const h = this.hull;
      if (kind === 'engine') {
        g.position.set(h.bay.center.x, h.bay.engineFloor ?? (h.bay.engineTop - v.h), h.bay.center.z);
        this.root.add(g);
      } else if (kind === 'fuel') {
        g.position.copy(h.fuelAt); g.rotation.y = h.fuelRot;
        this.root.add(g);
      } else if (kind === 'drive') {
        g.position.copy(h.driveAt);
        this.root.add(g);
      } else if (kind === 'gun') {
        this.gunPivot().add(g);
      } else if (kind === 'turret') {
        this.turret.add(g);
      }
      this.setInteriorFlags(g, this.interiorOn);
    }
    if (!silent) this.refresh();
    return old;
  }

  // crane: lift the turret body off together with the gun mounted in it
  removeTurret() {
    const turret = this.parts.turret;
    if (!turret) return null;
    const gun = this.parts.gun;
    this.parts.turret = null;
    this.parts.gun = null;
    turret.vis.group.removeFromParent();
    this.refresh();
    return { turret, gun };
  }
  installTurret(turret, gun) {
    this.turretYaw = 0;
    this.parts.turret = turret;
    const g = partVisual(turret).group;
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
    this.turret.add(g);
    this.parts.gun = gun || null;
    this.setInteriorFlags(g, this.interiorOn);
    this.refresh();
  }

  refresh() {
    this.def = computeSpec(this.key, this.parts, { front: this.bagCount('front'), side: this.bagCount('side') });
    const T = this.parts.turret ? partVisual(this.parts.turret) : null;
    const Gv = this.parts.gun ? partVisual(this.parts.gun) : null;
    this.vis.turretBox = T ? T.box : null;
    this.vis.muzzleLen = Gv ? Gv.muzzleLen : 1.2;
    this.vis.sightY = T ? T.sightY : 0.35;
    this.gun = this.gunPivot();
    if (this.hull.ringHole) this.hull.ringHole.visible = !T;
    if (this.parts.drive) this.parts.drive.vis.group.visible = !T && !this.turretless;
    this.updateEngineVisibility();
    const mp = T ? T.mgPos : this.hull.mgAt;
    // the machine gun sits in the second turret of twin-turret tanks (no pintle post there)
    const mgParent = T && T.second ? T.second.group : this.turret;
    if (this.mgMount.parent !== mgParent) mgParent.add(this.mgMount);
    this.mgPost.visible = !(T && (T.second || T.mgInside)) && !this.hull.noPost;
    this.mgMount.position.copy(mp);
    this.fuel = Math.min(this.fuel, this.fuelMax);
    if (this.ammo !== undefined) this.ammo = Math.min(this.ammo, this.def.ammoMax);
  }

  // crew stations available with the current composition: [{ role, space, pos, eye }]
  seats() {
    const res = [];
    for (const [role, s] of Object.entries(HULLS[this.key].seats)) res.push({ role, space: 'hull', ...s });
    (HULLS[this.key].troops || []).forEach((s, i) => res.push({ role: 'troop' + i, space: 'hull', troop: true, ...s }));
    if (this.parts.turret) {
      for (const [role, s] of Object.entries(TURRETS[this.parts.turret.key].seats)) res.push({ role, space: s.in === 'second' ? 'second' : 'turret', ...s });
    }
    return res;
  }
  // the object a seat's pos / eye are local to
  seatObject(s) {
    if (s.space === 'second') return partVisual(this.parts.turret).second.group;
    return s.space === 'turret' ? this.turret : this.root;
  }
  get secondTurret() { const T = this.parts.turret; return T && T.vis && T.vis.second ? T.vis.second : null; }

  // ------------------------------------------------ machine gun on the pintle
  setMG(weapon) {
    const old = this.mg;
    if (this.mgMesh) { this.mgMesh.removeFromParent(); this.mgMesh = null; }
    this.mg = weapon || null;
    if (weapon) {
      const v = bakedWeaponMesh(weapon.key);
      this.mgMesh = v.group;
      this.mgMesh.position.set(0, -0.03, -0.12);
      this.mgMuzzle = v.muzzle - 0.12;
      this.mgPivot.add(this.mgMesh);
    }
    this.mgYaw = this.mgPitch = 0;
    return old;
  }
  mgMuzzleWorld(out = new THREE.Vector3()) { return this.mgPivot.localToWorld(out.set(0, 0.01, this.mgMuzzle)); }
  mgDirWorld(out = new THREE.Vector3()) {
    this.mgPivot.getWorldQuaternion(_q);
    return out.set(0, 0, 1).applyQuaternion(_q);
  }
  // swing the pintle toward a world point (limited arc around the turret front)
  aimMG(dt, point) {
    let yaw = 0, pitch = 0;
    if (point) {
      this.mgMount.updateMatrixWorld(true);
      const pv = this.mgPivot.getWorldPosition(_v);
      const d = _v2.copy(point).sub(pv);
      this.mgMount.getWorldQuaternion(_q).invert();
      d.applyQuaternion(_q);
      yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -1.0, 1.0);
      pitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.35, 0.7);
    }
    const r = 2.6 * dt;
    this.mgYaw += THREE.MathUtils.clamp(yaw - this.mgYaw, -r, r);
    this.mgPitch += THREE.MathUtils.clamp(pitch - this.mgPitch, -r, r);
    this.mgPivot.rotation.set(-this.mgPitch, this.mgYaw, 0);
    this.mgAimErr = Math.abs(yaw - this.mgYaw) + Math.abs(pitch - this.mgPitch);
  }
  // one round from the pintle MG: { origin, dir, W } or null
  fireMG(spreadMul = 1) {
    if (!this.mg || !this.operated || this.mgCool > 0) return null;
    const W = WEAPONS[this.mg.key];
    if ((this.cargo.ammo[W.cal] || 0) <= 0) return null;
    this.cargo.ammo[W.cal]--;
    this.mgCool += 60 / W.rpm;                   // accumulates: several rounds per frame at high rates
    this.root.updateMatrixWorld(true);
    const dir = this.mgDirWorld(new THREE.Vector3());
    const sp = W.aim * 2.2 * spreadMul;
    dir.x += (Math.random() - 0.5) * 2 * sp; dir.y += (Math.random() - 0.5) * 2 * sp; dir.z += (Math.random() - 0.5) * 2 * sp;
    return { origin: this.mgMuzzleWorld(new THREE.Vector3()), dir: dir.normalize(), W };
  }

  // ------------------------------------------------ sandbags
  bagCount(face) { return this.bags ? this.bags.filter(b => b.face === face).length : 0; }
  // where the bags go (hull-local): front deck / glacis first, then the fenders
  computeBagSlots() {
    const b = this.vis.hullBox;
    const cx = (b.min.x + b.max.x) / 2, hx = (b.max.x - b.min.x) / 2, cz = (b.min.z + b.max.z) / 2, hz = (b.max.z - b.min.z) / 2;
    const cand = [
      ['front', cx, b.max.z - 0.55], ['front', cx + hx * 0.5, b.max.z - 0.62], ['front', cx - hx * 0.5, b.max.z - 0.62],
      ['side', b.max.x - 0.3, cz + hz * 0.15], ['side', b.min.x + 0.3, cz + hz * 0.15], ['side', b.max.x - 0.3, cz - hz * 0.35],
    ];
    this.root.updateMatrixWorld(true);
    const inv = this.root.quaternion.clone().invert();
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(this.root.quaternion);
    return cand.map(([face, x, z]) => {
      const o = this.root.localToWorld(new THREE.Vector3(x, b.max.y + 2.5, z));
      _ray.set(o, down);
      _ray.far = 6;
      const h = _ray.intersectObject(this.root, true).find(h => h.face && h.object.isMesh && !h.object.userData.mark &&
        !h.object.userData.bag && !isUnder(h.object, this.turret) && visibleChain(h.object, this.root));
      if (!h) return { face, pos: new THREE.Vector3(x, b.max.y * 0.75, z), n: new THREE.Vector3(0, 1, 0) };
      const n = h.face.normal.clone().applyMatrix3(_nm.getNormalMatrix(h.object.matrixWorld)).normalize().applyQuaternion(inv);
      if (n.y < 0.7) n.set(0, 1, 0);
      return { face, pos: this.root.worldToLocal(h.point.clone()), n };
    });
  }
  addSandbag() {
    if (this.bags.length >= SANDBAG.max) return false;
    if (!this.bagSlots) this.bagSlots = this.computeBagSlots();
    const sl = this.bagSlots[this.bags.length];
    const mesh = sandbagMesh();
    mesh.userData.bag = true;
    mesh.position.copy(sl.pos);
    mesh.quaternion.setFromUnitVectors(UP, sl.n);
    if (sl.face === 'side') mesh.rotateY(Math.PI / 2);
    this.root.add(mesh);
    this.bags.push({ face: sl.face, mesh });
    this.refresh();
    return true;
  }
  // take the last bag off (face: only from that face)
  removeSandbag(face = null) {
    let i = this.bags.length - 1;
    if (face) while (i >= 0 && this.bags[i].face !== face) i--;
    if (i < 0) return false;
    const [b] = this.bags.splice(i, 1);
    b.mesh.removeFromParent();
    // keep the remaining piles on the first slots
    this.bags.forEach((bg, k) => {
      const sl = this.bagSlots[k];
      bg.face = sl.face;
      bg.mesh.position.copy(sl.pos);
      bg.mesh.quaternion.setFromUnitVectors(UP, sl.n);
      if (sl.face === 'side') bg.mesh.rotateY(Math.PI / 2);
    });
    this.refresh();
    return true;
  }

  // ------------------------------------------------ engine bay / interior
  setBay(open) {
    this.bayOpen = open;
    this.updateEngineVisibility();
  }
  updateEngineVisibility() {
    const e = this.parts.engine;
    if (e && e.vis) e.vis.group.visible = this.bayOpen || !!this.interiorOn || !!this.hull.engineShown;
  }

  setInteriorFlags(obj, on) {
    obj.traverse(o => { if (o.userData.interior) o.visible = on; });
  }
  setInterior(on) {
    this.interiorOn = on;
    if (on) {
      if (!this.hullInterior) {
        this.hullInterior = buildHullInterior(this.key, this.hull);
        this.root.add(this.hullInterior);
      }
      const T = this.parts.turret ? partVisual(this.parts.turret) : null;
      if (T && !T.interior) {
        T.interior = buildTurretInterior(T.key);
        T.group.add(T.interior);
        if (T.second) T.second.group.add(buildSecondTurretInterior(T.key));
      }
    }
    this.setInteriorFlags(this.root, on);
    this.updateEngineVisibility();
  }

  // ------------------------------------------------ system-derived factors
  get maxSpeedEff() {
    const e = this.hp.engine, t = this.hp.transmission;
    if (e <= 0 || t <= 0 || this.bayOpen || (this.team === 'player' && this.fuel <= 0)) return 0;
    return this.def.maxSpeed * (0.3 + 0.7 * e / 100) * (0.55 + 0.45 * t / 100) * (this.bump > 0 ? 0.6 : 1);
  }
  get accelEff() {
    const e = this.hp.engine, t = this.hp.transmission;
    if (e <= 0 || t <= 0) return 0;
    return this.def.accel * (0.35 + 0.65 * e / 100) * (0.4 + 0.6 * t / 100);
  }
  get turnEff() {
    const t = this.hp.transmission;
    return t <= 0 || this.bayOpen ? 0 : this.def.turn * (0.35 + 0.65 * t / 100);
  }
  get turretRate() {
    const t = this.hp.turret;
    return t <= 0 ? 0 : this.def.turretSpeed * (0.15 + 0.85 * t / 100);
  }
  get reloadTime() {
    const g = this.hp.gun, a = this.hp.ammo;
    return this.def.reload / ((0.35 + 0.65 * g / 100) * (0.45 + 0.55 * a / 100));
  }
  get canFire() {
    return this.operated && this.hp.gun > 0 && this.ammo > 0 && this.reload <= 0;
  }
  get fuelMax() { return this.parts.fuel && this.hp.fuel > 0 ? this.def.fuelMax : 0; }

  // ------------------------------------------------ geometry helpers
  muzzleWorld(out = new THREE.Vector3()) {
    return this.gun.localToWorld(out.set(0, 0, this.vis.muzzleLen));
  }
  gunDirWorld(out = new THREE.Vector3()) {
    this.gun.getWorldQuaternion(_q);
    return out.set(0, 0, 1).applyQuaternion(_q);
  }
  // point from which the player looks through the gunner sight
  sightWorld(out = new THREE.Vector3()) {
    return this.turret.localToWorld(out.set(0, this.vis.sightY + 0.25, 0));
  }

  // ------------------------------------------------ update
  update(dt, world, others) {
    if (this.remote) { this.netStep(dt); return; }
    const p = this.root.position;
    const c = this.controls;
    if (!this.operated || this.craneLock) { c.throttle = 0; c.steer = 0; c.brake = 1; }

    if (dt > 0 && world) {
      const s0 = this.speed;
      // wading through water / swamp mud slows the tank down (eased: no sudden stop at the water's edge)
      const go = world.going ? world.going(p.x, p.z) : 1;
      this.goingK += (go - this.goingK) * Math.min(1, dt * 1.5);
      const maxS = this.maxSpeedEff * this.goingK;
      if (this.bump > 0) this.bump -= dt;
      if (c.throttle !== 0 && maxS > 0) this.speed += c.throttle * this.accelEff * (this.bump > 0 ? 0.3 : 1) * dt;
      else this.speed *= Math.pow(0.25, dt);
      if (c.brake) this.speed *= Math.pow(0.02, dt);
      this.speed = Math.max(-maxS * 0.45, Math.min(maxS, this.speed));
      if (Math.abs(this.speed) < 0.01) this.speed = 0;

      if (this.wheeled) {
        // wheels: the turn rate grows with the speed (no turning on the spot), reversing turns the other way
        const k = THREE.MathUtils.clamp(this.speed / 4, -1, 1) * (1 - Math.min(0.5, Math.abs(this.speed) / Math.max(1, this.def.maxSpeed) * 0.5));
        this.heading += c.steer * this.turnEff * k * dt;
      } else {
        // tracked vehicles can pivot in place
        const steerEff = 1 - Math.min(0.6, Math.abs(this.speed) / Math.max(1, this.def.maxSpeed) * 0.7);
        this.heading += c.steer * this.turnEff * steerEff * dt * (this.speed >= -0.1 ? 1 : -1) *
                        (0.45 + 0.55 * Math.min(1, Math.abs(this.speed) / 2.5));
      }

      const ox = p.x, oz = p.z;
      const dirX = Math.sin(this.heading), dirZ = Math.cos(this.heading);
      p.x += dirX * this.speed * dt;
      p.z += dirZ * this.speed * dt;

      if (world.heightAt(p.x, p.z) < WATER_LEVEL - 1.4) {
        p.x = ox; p.z = oz;
        this.speed *= 0.3;
      }
      const r = this.def.radius * 0.8;
      // trees give way to a moving tank, houses collapse when rammed (a car only flattens bushes: it crashes into the rest)
      const sg = this.speed >= 0 ? 1 : -1;
      const ram = { speed: this.speed, dx: dirX * sg, dz: dirZ * sg, broke: false, size: 0, light: this.soft };
      const impact = Math.abs(this.speed);
      if (world.collideTrees(p, this.soft ? r * 0.7 : r, ram)) {
        this.speed *= Math.pow(0.02, dt);
        if (this.soft) this.knock(impact);
      }
      const W = this.def.weight;
      if (ram.broke) {
        // knocking a tree down costs speed: the lighter the tank and the thicker the tree, the more
        this.speed *= 1 - THREE.MathUtils.clamp(0.3 + 0.25 * ram.size - W / 250, 0.12, 0.65);
        this.bump = Math.max(this.bump, 0.5 + ram.size * 0.4);
        this.rammedT = 0.3;
      }
      let rammed = false;
      const breakFn = this.soft ? null : o => { const b = o.house.ram(Math.abs(this.speed)); if (b) rammed = true; return b; };
      if (world.collideObstacles(p, this.soft ? r * 0.7 : r, breakFn, this.soft ? 1.6 : 2.6)) {
        this.speed *= Math.pow(0.02, dt);
        if (this.soft) this.knock(impact);
      }
      if (rammed) {
        this.speed *= 1 - THREE.MathUtils.clamp(0.85 - W / 140, 0.35, 0.8);
        this.bump = 1.4;
        this.rammedT = 0.6;
        this.damage('hull', 1);
      }
      if (others) for (const o of others) if (o !== this) this.collideTank(o, dt, world, s0);
      if (this.pushT > 0) this.pushT -= dt;
      this.velocity.set((p.x - ox) / dt, 0, (p.z - oz) / dt);

      // fuel
      if (this.team === 'player' && this.playerInside) {
        this.fuel -= this.def.fuelUse * (0.12 + 0.88 * Math.abs(c.throttle)) * dt;
        if (this.parts.fuel && this.hp.fuel < 100) this.fuel -= (100 - this.hp.fuel) * 0.0015 * dt;   // leak
        this.fuel = Math.max(0, Math.min(this.fuelMax, this.fuel));
      }
      this.speedKmh = Math.abs(this.speed) * 3.6;

      // terrain follow + tilt
      const h = world.heightAt(p.x, p.z);
      p.y = h - this.sinkAt(p);
      const d = 1.8;
      const hx = world.heightAt(p.x + d, p.z) - world.heightAt(p.x - d, p.z);
      const hz = world.heightAt(p.x, p.z + d) - world.heightAt(p.x, p.z - d);
      const sinH = Math.sin(this.heading), cosH = Math.cos(this.heading);
      const hf = hx * sinH + hz * cosH;
      const hr = -hx * cosH + hz * sinH;
      const MAX_TILT = 0.5;
      const rawPitch = Math.atan2(-hf, 2 * d);
      const rawRoll = Math.atan2(-hr, 2 * d);
      const k = Math.min(1, dt * 6);
      this.tiltX += (THREE.MathUtils.clamp(rawPitch, -MAX_TILT, MAX_TILT) - this.tiltX) * k;
      this.tiltZ += (THREE.MathUtils.clamp(rawRoll, -MAX_TILT, MAX_TILT) - this.tiltZ) * k;

      // wheel spin, steered wheels turn
      for (const w of this.vis.wheels) w.rotation.x += this.speed * dt / this.vis.wheelR;
      if (this.hull.steer) {
        const a = c.steer * 0.42;
        for (const st of this.hull.steer) st.rotation.y += (a - st.rotation.y) * Math.min(1, dt * 6);
      }
    }

    // engine deck hatch animation
    if (dt > 0) {
      const hinge = this.hull.bay.hinge;
      const target = this.bayOpen ? -1.95 : 0;
      hinge.rotation.x += (target - hinge.rotation.x) * Math.min(1, dt * 5);
      this.hull.bay.hole.visible = hinge.rotation.x < -0.05;
    }

    if (this.hull.lean && dt > 0) this.leanStep(dt);
    if (this.riders.length) this.updateRiders();
    this.root.quaternion.setFromAxisAngle(UP, this.heading)
      .multiply(_q.setFromAxisAngle(AX, this.tiltX))
      .multiply(_q2.setFromAxisAngle(AZ, this.tiltZ + this.lean));

    // turret / gun laying
    if (dt > 0 && this.aimPoint && this.operated) this.layGun(dt);
    this.turret.rotation.y = this.turretYaw;
    this.gun.rotation.x = -this.gunElev;
    if (this.secondTurret) this.placeSecondTurret(dt);
    if (this.hull.aux && dt > 0) this.aimAux(dt);
    this.root.updateMatrixWorld(true);
    if (dt > 0 && this.mg && !this.wrecked) this.aimMG(dt, this.operated ? (this.mgTarget || this.aimPoint) : null);

    if (dt > 0) {
      if (this.reload > 0) this.reload -= dt;
      if (this.mgCool > 0) this.mgCool -= dt;
      if (this.rammedT > 0) this.rammedT -= dt;
      this.updateFire(dt);
    }
  }

  // ------------------------------------------------ tanks pushing tanks
  // contact with another tank. A tank driving into another pushes it when its tractive force (engine power, at most
  // the grip of its own weight) beats the other's hold on the ground: its weight, braked tracks of a crewed tank, tracks
  // turned across the push holding harder than rolling ones (a crewless or burnt-out tank rolls on free tracks). The
  // pushed tank turns when pushed off its centre. Not driving into it (or too weak) - this tank is stopped by it.
  collideTank(o, dt, world, s0) {
    const p = this.root.position, q = o.root.position;
    const rr = (this.def.radius + o.def.radius) * 0.75;
    let nx = q.x - p.x, nz = q.z - p.z;
    const d2 = nx * nx + nz * nz;
    if (d2 >= rr * rr || d2 < 1e-6) return;
    const d = Math.sqrt(d2);
    nx /= d; nz /= d;
    const drive = this.pushDrive(nx, nz);
    if (!drive.F) {
      // the other one drives into this one: its own update does the pushing
      const into = o.remote ? (Math.sin(o.heading) * -nx + Math.cos(o.heading) * -nz) * o.speed > 0.3 : o.pushDrive(-nx, -nz).F > 0;
      if (into) return;
    } else if (!o.remote || o.net) {
      const g = 9.81, mA = this.def.weight, mB = o.def.weight;
      const a2 = (nx * Math.sin(o.heading) + nz * Math.cos(o.heading)) ** 2;     // pushed along its tracks: 1
      const held = o.operated && !o.remote && (o.controls.brake || !o.controls.throttle);
      const mu = a2 * (held ? 0.4 : 0.1) + (1 - a2) * 0.45;
      let res = (mu * mB + 0.05 * mA) * g;
      if (o.operated && !o.remote) res += o.pushDrive(-nx, -nz).F;               // it drives against this one
      if (drive.F > res) {
        // the pair moves: the speed is what the power gives against the resistance, gained with the inertia of both
        // (the first contact shares the momentum)
        const vCap = Math.min(this.maxSpeedEff, this.def.power * 0.7355 * drive.eff / res);
        let v = Math.min(Math.abs(this.speed), Math.abs(s0) + (drive.F - res) / (mA + mB) * dt, vCap);
        if (this.pushT <= 0) v = Math.min(v, Math.abs(s0) * mA / (mA + mB));
        this.speed = drive.sg * v;
        this.pushT = 0.2;
        // the other tank is shoved out of the way, turned when pushed off its centre
        const pen = rr - d;
        const fx = Math.sin(this.heading) * drive.sg, fz = Math.cos(this.heading) * drive.sg;
        const turn = -(nz * fx - nx * fz) * pen / (o.def.radius * 0.75) * 0.6;
        const ox = q.x, oz = q.z;
        q.x += nx * pen; q.z += nz * pen;
        if (!o.remote) {
          world.collideObstacles(q, o.def.radius * 0.8, null, 2.6);
          world.collideTrees(q, o.def.radius * 0.8);
          if (world.heightAt(q.x, q.z) < WATER_LEVEL - 1.4) { q.x = ox; q.z = oz; }
          else o.heading += turn;
        }
        const mx = q.x - ox, mz = q.z - oz;
        if (o.remote) {
          o.net.x += mx; o.net.z += mz;
          if (Tank.onPush) Tank.onPush(o, mx, mz, turn);
        }
        // what it could not give way (against a wall, a railing): this one stays out of it
        const ex = q.x - p.x, ez = q.z - p.z, e = Math.hypot(ex, ez);
        if (e < rr && e > 1e-6) { p.x = q.x - ex / e * rr; p.z = q.z - ez / e * rr; }
        return;
      }
    }
    p.x = q.x - nx * rr;
    p.z = q.z - nz * rr;
    if (this.soft) this.knock(Math.abs(this.speed));
    this.speed *= Math.pow(0.05, dt);
  }

  // ------------------------------------------------ cars and motorcycles
  // a soft vehicle ran into a tree / wall / tank at `impact` m/s: it stops dead, a hard knock breaks it and hurts
  // the men in it (the game reads this.crash)
  knock(impact) {
    if (impact < 5) return;
    this.speed *= 0.15;
    if (impact > 7) {
      this.crash = Math.max(this.crash, impact);
      this.damage('hull', (impact - 7) * 5);
      if (impact > 12) this.damage('engine', (impact - 12) * 6);
    }
  }
  // solo motorcycles lean into the turn (on the side stand when parked)
  leanStep(dt) {
    const moving = Math.abs(this.speed) > 0.6 || (this.operated && !this.wrecked);
    const want = moving ? -this.controls.steer * THREE.MathUtils.clamp(this.speed / 10, -1, 1) * 0.42 : -0.2;
    this.lean += (want - this.lean) * Math.min(1, dt * 4);
  }
  // the men sitting in a car / on a motorcycle: the crew (driver, sidecar gunner), riding infantry, the player
  // (seen from outside) and the other player of a network game
  updateRiders() {
    const crewOn = this.crew && !this.wrecked;
    for (const r of this.riders) {
      let on = false, ally = this.team !== 'enemy';
      if (this.playerSeat && r.role === this.playerSeat) { on = true; ally = true; }
      else if (this.remoteInside && !this.playerInside && r.role === 'driver') { on = true; ally = true; }
      else if (r.troop >= 0) on = r.troop < this.troops.length;
      else if (crewOn) on = r.role === 'driver' || (r.role === 'gunner' && !!this.mg);
      if (on && (!r.mesh || r.ally !== ally)) {
        if (r.mesh) r.mesh.removeFromParent();
        r.mesh = riderMesh(r.seat.rider, ally ? 0x7a6c48 : 0x565b4c);
        r.mesh.position.set(r.seat.pos[0], r.seat.pos[1] - 0.08, r.seat.pos[2]);
        r.mesh.rotation.y = r.seat.ry || 0;
        r.ally = ally;
        this.root.add(r.mesh);
      }
      if (r.mesh) r.mesh.visible = on;
    }
  }

  // tractive force (kN) this tank drives with towards the unit direction (nx, nz): 0 unless it is under way to it.
  // { F, sg (forward 1 / reverse -1), eff (share of the engine power left) }
  pushDrive(nx, nz) {
    const c = this.controls;
    if (!this.operated || this.remote || !c.throttle || this.maxSpeedEff <= 0) return { F: 0, sg: 1, eff: 0 };
    const sg = Math.sign(c.throttle);
    const into = (Math.sin(this.heading) * nx + Math.cos(this.heading) * nz) * sg;
    if (into < 0.3) return { F: 0, sg, eff: 0 };
    const eff = this.maxSpeedEff / Math.max(0.1, this.def.maxSpeed);
    const P = this.def.power * 0.7355 * eff;                                       // hp -> kW
    const F = Math.min(0.75 * this.def.weight * 9.81, P / Math.max(Math.abs(this.speed), 0.8)) * Math.abs(c.throttle) * into;
    return { F, sg, eff };
  }

  // ------------------------------------------------ network play
  // a tank driven on the other machine: follows the pose received over the network (see net.js) - no physics here
  netStep(dt) {
    const n = this.net;
    const p = this.root.position;
    const ox = p.x, oz = p.z;
    const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    if (n) {
      const k = n.snap ? 1 : 1 - Math.exp(-dt * 12);
      n.snap = false;
      // a little extrapolation along the last speed hides the gaps between the packets
      const age = Math.min(0.25, (performance.now() - n.at) / 1000);
      const ex = Math.sin(n.heading) * n.speed * age, ez = Math.cos(n.heading) * n.speed * age;
      p.x += (n.x + ex - p.x) * k; p.y += (n.y - p.y) * k; p.z += (n.z + ez - p.z) * k;
      this.heading = lerpA(this.heading, n.heading, k);
      this.tiltX += (n.tiltX - this.tiltX) * k; this.tiltZ += (n.tiltZ - this.tiltZ) * k;
      this.turretYaw = lerpA(this.turretYaw, n.turretYaw, k);
      this.gunElev += (n.gunElev - this.gunElev) * k;
      this.secondYaw = lerpA(this.secondYaw, n.secondYaw || 0, k);
      this.mgYaw = lerpA(this.mgYaw, n.mgYaw || 0, k); this.mgPitch += ((n.mgPitch || 0) - this.mgPitch) * k;
      this.speed = n.speed;
      this.controls.steer = n.steer || 0;
    }
    if (dt > 0) {
      this.velocity.set((p.x - ox) / dt, 0, (p.z - oz) / dt);
      this.speedKmh = Math.abs(this.speed) * 3.6;
      for (const w of this.vis.wheels) w.rotation.x += this.speed * dt / this.vis.wheelR;
      if (this.hull.steer) for (const st of this.hull.steer) st.rotation.y += (this.controls.steer * 0.42 - st.rotation.y) * Math.min(1, dt * 6);
      const hinge = this.hull.bay.hinge;
      hinge.rotation.x += ((this.bayOpen ? -1.95 : 0) - hinge.rotation.x) * Math.min(1, dt * 5);
      this.hull.bay.hole.visible = hinge.rotation.x < -0.05;
      if (this.reload > 0) this.reload -= dt;
      if (this.mgCool > 0) this.mgCool -= dt;
    }
    if (this.hull.lean && dt > 0) this.leanStep(dt);
    if (this.riders.length) this.updateRiders();
    this.root.quaternion.setFromAxisAngle(UP, this.heading)
      .multiply(_q.setFromAxisAngle(AX, this.tiltX))
      .multiply(_q2.setFromAxisAngle(AZ, this.tiltZ + this.lean));
    this.turret.rotation.y = this.turretYaw;
    this.gun.rotation.x = -this.gunElev;
    const S = this.secondTurret;
    if (S) {
      const c = Math.cos(-this.turretYaw), s = Math.sin(-this.turretYaw);
      S.group.position.set(S.pos.x * c + S.pos.z * s, S.pos.y, -S.pos.x * s + S.pos.z * c);
      S.group.rotation.y = this.secondYaw - this.turretYaw;
    }
    this.mgPivot.rotation.set(-this.mgPitch, this.mgYaw, 0);
    this.root.updateMatrixWorld(true);
  }
  // the pose sent to the other machine
  netPose() {
    const p = this.root.position, r = x => Math.round(x * 1000) / 1000;
    return [r(p.x), r(p.y), r(p.z), r(this.heading), r(this.tiltX), r(this.tiltZ), r(this.turretYaw), r(this.gunElev),
            r(this.speed), r(this.secondYaw), r(this.mgYaw), r(this.mgPitch), r(this.controls.steer || 0)];
  }
  setNetPose(a, snap = false) {
    this.net = { x: a[0], y: a[1], z: a[2], heading: a[3], tiltX: a[4], tiltZ: a[5], turretYaw: a[6], gunElev: a[7],
                 speed: a[8], secondYaw: a[9], mgYaw: a[10], mgPitch: a[11], steer: a[12], at: performance.now(), snap };
  }

  // twin turrets: the machine-gun turret keeps its place on the hull while the gun turret traverses and turns on
  // its own towards the machine-gun target (within its arc)
  placeSecondTurret(dt) {
    const S = this.secondTurret;
    const c = Math.cos(-this.turretYaw), s = Math.sin(-this.turretYaw);
    S.group.position.set(S.pos.x * c + S.pos.z * s, S.pos.y, -S.pos.x * s + S.pos.z * c);
    const tgt = this.operated && !this.wrecked ? (this.mgTarget || this.aimPoint) : null;
    if (tgt && dt > 0) {
      this.root.updateMatrixWorld(true);
      const lp = this.root.worldToLocal(_v.copy(tgt));
      const base = this.turret.position;
      const hx = base.x + S.pos.x, hz = base.z + S.pos.z;
      const want = THREE.MathUtils.clamp(Math.atan2(lp.x - hx, lp.z - hz), S.arc[0], S.arc[1]);
      const r = (S.speed || 1) * dt;
      this.secondYaw += THREE.MathUtils.clamp(want - this.secondYaw, -r, r);
    }
    S.group.rotation.y = this.secondYaw - this.turretYaw;
  }

  // auxiliary hull turrets (multi-turret tanks) turn on their own towards the target, each within its arc
  aimAux(dt) {
    const tgt = this.operated && !this.wrecked ? (this.mgTarget || this.aimPoint) : null;
    if (!tgt) return;
    this.root.updateMatrixWorld(true);
    const lp = this.root.worldToLocal(_v.copy(tgt));
    this.hull.aux.forEach((a, i) => {
      const p = a.group.position;
      const want = THREE.MathUtils.clamp(Math.atan2(lp.x - p.x, lp.z - p.z), a.arc[0], a.arc[1]);
      const r = (a.speed || 1) * dt;
      this.auxYaw[i] += THREE.MathUtils.clamp(want - this.auxYaw[i], -r, r);
      a.group.rotation.y = this.auxYaw[i];
    });
  }

  // dug in only inside the caponier pit, climbs out smoothly as it leaves
  sinkAt(p) {
    if (!this.sink) return 0;
    const cap = this.caponier;
    if (!cap) return 0;
    const d = Math.hypot(p.x - cap.x, p.z - cap.z);
    return this.sink * (1 - THREE.MathUtils.smoothstep(d, 2.5, 6));
  }

  // desired world direction (with ballistic drop) -> hull-local yaw/elevation, rotate toward it
  layGun(dt) {
    const m = this.muzzleWorld(_v);
    const tx = this.aimPoint.x - m.x, ty = this.aimPoint.y - m.y, tz = this.aimPoint.z - m.z;
    const dist = Math.hypot(tx, tz);
    const v = this.def.shellSpeed;
    let theta = Math.atan2(ty, dist);
    const disc = v ** 4 - G * (G * dist * dist + 2 * ty * v * v);
    if (disc >= 0 && dist > 1) theta = Math.atan((v * v - Math.sqrt(disc)) / (G * dist));
    const az = Math.atan2(tx, tz);
    _v2.set(Math.sin(az) * Math.cos(theta), Math.sin(theta), Math.cos(az) * Math.cos(theta));
    _q.copy(this.root.quaternion).invert();
    _v2.applyQuaternion(_q);
    let yaw = Math.atan2(_v2.x, _v2.z);
    const elev = Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z));
    const arc = this.def.turretArc;
    if (arc) yaw = THREE.MathUtils.clamp(yaw, -arc, arc);

    const rate = this.turretRate;
    let dy = yaw - this.turretYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const maxStep = rate * dt;
    this.turretYaw += THREE.MathUtils.clamp(dy, -maxStep, maxStep);
    this.turretYaw = Math.atan2(Math.sin(this.turretYaw), Math.cos(this.turretYaw));

    const eRate = this.hp.gun > 0 ? this.def.elevSpeed * (0.3 + 0.7 * this.hp.gun / 100) : 0;
    const te = THREE.MathUtils.clamp(elev, this.def.elevMin, this.def.elevMax);
    this.gunElev += THREE.MathUtils.clamp(te - this.gunElev, -eRate * dt, eRate * dt);
    this.aimError = Math.abs(dy) + Math.abs(te - this.gunElev);
  }

  // returns shell spec or null
  shoot() {
    if (!this.canFire) return null;
    this.reload = this.reloadTime;
    this.ammo--;
    const dir = this.gunDirWorld(new THREE.Vector3());
    const disp = this.def.disp * (1 + (100 - this.hp.gun) / 40) * (1 + Math.min(2, Math.abs(this.speed) / 4));
    dir.x += (Math.random() - 0.5) * 2 * disp;
    dir.y += (Math.random() - 0.5) * 2 * disp;
    dir.z += (Math.random() - 0.5) * 2 * disp;
    dir.normalize();
    // recoil
    this.gunElev = Math.min(this.def.elevMax, this.gunElev + 0.01);
    return {
      pos: this.muzzleWorld(new THREE.Vector3()),
      vel: dir.multiplyScalar(this.def.shellSpeed),
      pen: this.def.pen, dmg: this.def.dmg, owner: this,
    };
  }

  // ------------------------------------------------ damage state
  damage(id, amount) {
    if (this.wrecked) return 0;
    const before = this.hp[id];
    this.hp[id] = Math.max(0, before - amount);
    if (id === 'ammo' && this.hp.ammo <= 0 && before > 0) this.ammo = Math.floor(this.ammo * 0.4);
    if (id === 'fuel' && this.hp.fuel <= 0 && before > 0 && this.parts.fuel) this.parts.fuel.fuel = 0;   // leaked out
    return before - this.hp[id];
  }

  startFire(source, selfOut) {
    if (this.wrecked) return;
    const max = selfOut ? 7 : (source === 'ammo' ? 12 : 16);
    if (this.fire) { this.fire.t = Math.min(this.fire.t, max); return; }
    this.fire = { t: max, max, source, selfOut, extinguish: 0 };
  }

  updateFire(dt) {
    if (this.wrecked) return;
    const f = this.fire;
    if (!f) return;
    f.t -= dt;
    if (!f.selfOut) {
      // a burning tank slowly cooks its systems
      this.hp.engine = Math.max(0, this.hp.engine - 2.2 * dt);
      this.hp.hull = Math.max(1, this.hp.hull - 1.2 * dt);
      this.hp[f.source] = Math.max(0, this.hp[f.source] - 4 * dt);
    }
    if (f.t <= 0) {
      if (f.selfOut) { this.fire = null; }
      else this.burnOut = true;       // handled by the game (wreck / game over)
    }
  }

  killCrew() {
    this.crew = false;
    this.crewHp = 0;
  }

  makeWreck() {
    if (this.wrecked) return;
    this.wrecked = true;
    this.crew = false;
    this.fire = null;
    this.hp.hull = 0;
    this.speed = 0;
    this.root.traverse(o => {
      if (o.isMesh && (!o.userData.mark || o.userData.patch)) {
        o.material = o.material.clone();
        o.material.color.multiplyScalar(0.22);
      }
    });
    this.turretYaw += (Math.random() - 0.5) * 0.8;
    this.gunElev = this.def.elevMin;
    this.turret.rotation.y = this.turretYaw;
    this.gun.rotation.x = -this.gunElev;
  }

  // ------------------------------------------------ hit marks
  // kind: 'hole' (penetration), 'dent' (armour held), 'scrape' (ricochet)
  addMark(point, dir, kind) {
    const R = markRes();
    this.root.updateMatrixWorld(true);
    _ray.set(_v.copy(point).addScaledVector(dir, -3), dir);
    _ray.far = 7;
    const hits = _ray.intersectObject(this.root, true);
    const hit = hits.find(h => h.face && h.object.isMesh && !h.object.userData.mark && visibleChain(h.object, this.root));
    if (!hit) return;
    let host = hit.object;
    while (host !== this.root && !host.userData.markHost) host = host.parent;
    const n = hit.face.normal.clone().applyMatrix3(_nm.getNormalMatrix(hit.object.matrixWorld)).normalize();
    if (n.dot(dir) > 0) n.negate();
    // tangent: along the shell path for scrapes, random otherwise
    let t = dir.clone().addScaledVector(n, -dir.dot(n));
    if (kind !== 'scrape' || t.lengthSq() < 1e-4) t = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).addScaledVector(n, -0.0);
    t.addScaledVector(n, -t.dot(n)).normalize();
    const b = new THREE.Vector3().crossVectors(t, n);
    _basis.makeBasis(b, t, n);
    const m = new THREE.Mesh(R.geo, R[kind]);
    m.userData.mark = true;
    m.userData.kind = kind;
    m.renderOrder = 2;
    const s = kind === 'hole' ? 0.42 : kind === 'dent' ? 0.34 : 0.5;
    m.scale.set(s * (kind === 'scrape' ? 0.45 : 1), s * (kind === 'scrape' ? 1.6 : 1), 1);
    host.updateMatrixWorld(true);
    m.position.copy(host.worldToLocal(hit.point.clone().addScaledVector(n, 0.008)));
    m.quaternion.setFromRotationMatrix(_basis).premultiply(host.getWorldQuaternion(_hq).invert());
    host.add(m);
    this.marks.push(m);
    if (this.marks.length > 45) this.marks.shift().removeFromParent();
  }
  // the repair station makes the damage good (welded patches stay)
  clearMarks() {
    const rm = [];
    this.root.traverse(o => { if (o.userData.mark && !o.userData.patch) rm.push(o); });
    for (const o of rm) o.removeFromParent();
    this.marks = [];
  }

  // ------------------------------------------------ paint and patches
  // welded patches on the tank (they live on the hull and on the parts, and travel with the parts)
  patches() {
    const res = [];
    this.root.traverse(o => { if (o.userData.patch) res.push(o); });
    return res;
  }
  addPatch(host, pos, quat, sx, sy, color) {
    this.root.updateMatrixWorld(true);
    const m = new THREE.Mesh(patchGeometry(host, pos, quat, sx, sy) || PATCH_GEO, patchMaterial(color));
    m.userData.mark = true;
    m.userData.patch = true;
    m.userData.color = color;
    m.userData.size = [sx, sy];
    m.position.copy(pos);
    m.quaternion.copy(quat);
    if (m.geometry === PATCH_GEO) m.scale.set(sx * 0.35, sy * 0.35, 1);      // no room: a small plate
    m.castShadow = false; m.receiveShadow = true;
    host.add(m);
    return m;
  }
  // welding a plate: holes and dents are covered by patches in the colour of the plate. `at` ({ point, dir }):
  // where the welder looks, a patch goes there when there is no damage to cover
  patchMarks(color, at = null) {
    let n = 0;
    for (const m of this.marksAll()) {
      if (m.userData.kind !== 'hole' && m.userData.kind !== 'dent') continue;
      const s = m.userData.kind === 'hole' ? 0.62 : 0.5;
      const nrm = _v.set(0, 0, 1).applyQuaternion(m.quaternion);
      this.addPatch(m.parent, m.position.clone().addScaledVector(nrm, -0.004), facing(nrm, new THREE.Quaternion()),
        s * (0.9 + Math.random() * 0.3), s * (0.9 + Math.random() * 0.3), color);
      m.removeFromParent();
      n++;
    }
    this.marks = this.marks.filter(m => m.parent);
    if (!n && at) {
      const hit = this.surfaceHit(at.point, at.dir);
      if (hit) { this.addPatch(hit.host, hit.pos, hit.quat, 0.6, 0.5, color); n++; }
    }
    const all = this.patches();
    for (let i = 0; i < all.length - MAX_PATCHES; i++) {
      all[i].removeFromParent();
      if (all[i].geometry !== PATCH_GEO) all[i].geometry.dispose();
    }
    return n;
  }
  // hit marks (not patches) still on the tank
  marksAll() {
    const res = [];
    this.root.traverse(o => { if (o.userData.mark && !o.userData.patch) res.push(o); });
    return res;
  }
  // repaint the tank: hull, turret, gun, fuel tanks and turret drive; patches take the new colour, scrapes vanish
  paintTank(color) {
    this.paint = color;
    for (const k of ['turret', 'gun', 'fuel', 'drive']) if (this.parts[k]) this.parts[k].paint = color;
    const engine = this.parts.engine && this.parts.engine.vis && this.parts.engine.vis.group;
    paintObject(this.root, color, o => o === engine);           // the engine inside keeps its own colours
    for (const p of this.patches()) this.paintPatch(p, color);
    for (const m of this.marksAll()) if (m.userData.kind === 'scrape') m.removeFromParent();
    this.marks = this.marks.filter(m => m.parent);
  }
  paintPatch(p, color) {
    p.userData.color = color;
    p.material = patchMaterial(color);
  }
  // the patch the ray (world) points at, within maxD
  patchAt(origin, dir, maxD = 4) {
    const list = this.patches();
    if (!list.length) return null;
    _ray.set(origin, dir);
    _ray.far = maxD;
    const hits = _ray.intersectObjects(list, false);
    return hits.length ? hits[0].object : null;
  }
  // where a ray meets the tank's surface: { host, pos, quat } (a patch placed there faces out)
  surfaceHit(origin, dir, maxD = 5) {
    this.root.updateMatrixWorld(true);
    _ray.set(origin, dir);
    _ray.far = maxD;
    const hit = _ray.intersectObject(this.root, true).find(h => h.face && h.object.isMesh && !h.object.userData.mark &&
      !h.object.userData.bag && visibleChain(h.object, this.root));
    if (!hit) return null;
    let host = hit.object;
    while (host !== this.root && !host.userData.markHost) host = host.parent;
    const n = hit.face.normal.clone().applyMatrix3(_nm.getNormalMatrix(hit.object.matrixWorld)).normalize();
    if (n.dot(dir) > 0) n.negate();
    host.updateMatrixWorld(true);
    const pos = host.worldToLocal(hit.point.clone().addScaledVector(n, 0.004));
    const quat = facing(n.applyQuaternion(host.getWorldQuaternion(_hq).invert()), new THREE.Quaternion());
    return { host, pos, quat };
  }
  // objects patches can sit on, by id (for saves): hull, parts, the second turret, auxiliary turrets
  markHosts() {
    const res = [['hull', this.root]];
    for (const [k, p] of Object.entries(this.parts)) if (p && p.vis) res.push([k, p.vis.group]);
    if (this.secondTurret) res.push(['second', this.secondTurret.group]);
    (this.hull.aux || []).forEach((a, i) => res.push([`aux${i}`, a.group]));
    return res;
  }

  // world-space hit volumes as {part, box, obj}
  hitVolumes() {
    const v = [{ part: 'hull', box: this.vis.hullBox, obj: this.root }];
    if (this.vis.turretBox) v.push({ part: 'turret', box: this.vis.turretBox, obj: this.turret });
    const S = this.secondTurret;
    if (S) v.push({ part: 'turret', box: S.box, obj: S.group });
    if (this.hull.aux) for (const a of this.hull.aux) v.push({ part: 'hull', box: a.box, obj: a.group });
    return v;
  }

  // module box -> local AABB in its space (hull-local or turret-local)
  moduleBox(m, out = new THREE.Box3()) {
    const h = this.hull;
    if (m.ringDrive) {
      const p = h.ring.pos, r = h.ring.r * 0.85;
      out.min.set(p.x - r, p.y - 0.3, p.z - r); out.max.set(p.x + r, p.y + 0.05, p.z + r);
      return out;
    }
    if (m.gunMount) {
      const p = h.mount, s = m.small ? 0.25 : 0.4;
      out.min.set(p.x - s, p.y - s, p.z - (m.small ? 0.6 : 0.2)); out.max.set(p.x + s, p.y + s, p.z + (m.small ? 0 : 1.4));
      return out;
    }
    if (m.fuelMount) {
      const p = h.fuelAt;
      out.min.set(p.x - 1.05, p.y - 0.45, p.z - 0.4); out.max.set(p.x + 1.05, p.y + 0.45, p.z + 0.4);
      return out;
    }
    const b = m.space === 'turret' && this.vis.turretBox ? this.vis.turretBox : this.vis.hullBox;
    const cx = (b.min.x + b.max.x) / 2, hx = (b.max.x - b.min.x) / 2;
    const cz = (b.min.z + b.max.z) / 2, hz = (b.max.z - b.min.z) / 2;
    const sy = b.max.y - b.min.y;
    out.min.set(cx + m.u[0] * hx, b.min.y + m.v[0] * sy, cz + m.w[0] * hz);
    out.max.set(cx + m.u[1] * hx, b.min.y + m.v[1] * sy, cz + m.w[1] * hz);
    return out;
  }

  dispose() {
    this.scene.remove(this.root);
  }
}
