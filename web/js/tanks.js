// Tanks: definitions, procedural T-55, GLB loading (with turret split), physics,
// turret/gun aiming, internal modules (systems) and their effect on performance.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WATER_LEVEL } from './world.js';

export const G = 9.81;

export const MODULE_IDS = ['engine', 'transmission', 'turret', 'gun', 'ammo', 'fuel'];
export const SYSTEM_IDS = ['hull', ...MODULE_IDS];
export const MODULE_NAMES = {
  hull: 'Корпус', engine: 'Двигатель', transmission: 'Трансмиссия', turret: 'Поворот башни',
  gun: 'Орудие', ammo: 'Боеукладка', fuel: 'Бензобак',
};

// Module boxes are given in normalised coordinates of the hull (or turret) box:
//   u: -1..1 across local X (+X is the tank's LEFT side), v: 0..1 bottom..top, w: -1..1 rear..front
// ext: lies outside the armour (external fuel tanks, gun barrel) - hit without penetration
export const TANK_DEFS = {
  t55: {
    key: 't55', name: 'Т-55', model: 'procedural',
    maxSpeed: 14, accel: 4.5, turn: 0.9, radius: 3.2,
    turretSpeed: 0.55, elevSpeed: 0.2, elevMin: -0.09, elevMax: 0.30,
    reload: 6.5, ammoMax: 43, shellSpeed: 520, pen: 230, dmg: 1.0, disp: 0.0035, caliber: '100 мм',
    fuelMax: 100, fuelUse: 0.07,
    armor: { hull: { front: 200, side: 80, rear: 45, top: 30 }, turret: { front: 230, side: 150, rear: 65, top: 35 } },
    modules: [
      { id: 'ammo', space: 'hull', u: [-0.95, -0.25], v: [0.15, 0.6], w: [0.35, 0.85] },   // front right "tank-rack"
      { id: 'engine', space: 'hull', u: [-0.75, 0.75], v: [0.15, 0.75], w: [-0.72, -0.2] },
      { id: 'transmission', space: 'hull', u: [-0.8, 0.8], v: [0.1, 0.55], w: [-1.0, -0.72] },
      { id: 'fuel', space: 'hull', u: [-1.0, -0.66], v: [0.66, 0.98], w: [-0.82, 0.05], ext: true },  // right fender tanks
      { id: 'fuel', space: 'hull', u: [-0.6, 0.6], v: [0.45, 0.95], w: [-1.0, -0.93], ext: true },    // rear drums
      { id: 'turret', space: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', space: 'turret', u: [-0.3, 0.3], v: [0.25, 0.75], w: [-0.3, 0.9] },
      { id: 'ammo', space: 'turret', u: [-0.9, -0.5], v: [0.1, 0.5], w: [-0.8, -0.2] },     // turret bustle ready rack
    ],
    crew: [
      { space: 'hull', u: [0.25, 0.95], v: [0.1, 0.65], w: [0.45, 0.95] },                    // driver (front left)
      { space: 'hull', u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.15, 0.45] },                    // fighting compartment
      { space: 'turret', u: [-0.85, 0.85], v: [0.0, 0.8], w: [-0.7, 0.3] },
    ],
  },
  abrams: {
    key: 'abrams', name: 'Abrams', model: 'glb', scale: 5.0,
    maxSpeed: 18, accel: 7, turn: 1.1, radius: 3.6,
    turretSpeed: 0.9, elevSpeed: 0.35, elevMin: -0.17, elevMax: 0.35,
    reload: 5.5, ammoMax: 40, shellSpeed: 600, pen: 400, dmg: 1.1, disp: 0.0025, caliber: '120 мм',
    fuelMax: 100, fuelUse: 0.11,
    armor: { hull: { front: 320, side: 100, rear: 55, top: 35 }, turret: { front: 380, side: 160, rear: 70, top: 40 } },
    split: { v0: 0.3, vTop: 0.62, u: 0.95, w0: -0.93, w1: 0.1, bv0: 0.33, bv1: 0.5, bu: 0.12 },
    modules: [
      { id: 'engine', space: 'hull', u: [-0.7, 0.7], v: [0.2, 0.85], w: [-0.9, -0.4] },
      { id: 'transmission', space: 'hull', u: [-0.8, 0.8], v: [0.1, 0.6], w: [-1.0, -0.88] },
      { id: 'fuel', space: 'hull', u: [0.45, 0.95], v: [0.3, 0.9], w: [0.35, 0.85] },
      { id: 'fuel', space: 'hull', u: [-0.95, -0.45], v: [0.3, 0.9], w: [0.35, 0.85] },
      { id: 'ammo', space: 'turret', u: [-0.8, 0.8], v: [0.25, 0.85], w: [-1.0, -0.6] },     // bustle
      { id: 'turret', space: 'turret', u: [-0.5, 0.5], v: [0.0, 0.2], w: [-0.4, 0.4] },
      { id: 'gun', space: 'turret', u: [-0.25, 0.25], v: [0.25, 0.8], w: [-0.2, 1.0] },
    ],
    crew: [
      { space: 'hull', u: [-0.3, 0.3], v: [0.2, 0.8], w: [0.6, 0.95] },
      { space: 'hull', u: [-0.6, 0.6], v: [0.2, 1.0], w: [-0.3, 0.3] },
      { space: 'turret', u: [-0.85, 0.85], v: [0.0, 0.9], w: [-0.55, 0.4] },
    ],
  },
  avre: {
    key: 'avre', name: 'Chieftain AVRE', model: 'glb', scale: 5.0,
    maxSpeed: 12, accel: 5, turn: 0.95, radius: 3.4,
    turretSpeed: 0.4, elevSpeed: 0.18, elevMin: -0.1, elevMax: 0.35,
    reload: 9, ammoMax: 20, shellSpeed: 380, pen: 250, dmg: 1.6, disp: 0.005, caliber: '165 мм',
    fuelMax: 100, fuelUse: 0.1,
    armor: { hull: { front: 220, side: 70, rear: 45, top: 30 }, turret: { front: 260, side: 110, rear: 60, top: 35 } },
    split: { v0: 0.53, vTop: 0.98, u: 0.8, w0: -0.35, w1: 0.52, bv0: 2, bv1: 2, bu: 0 },
    modules: [
      { id: 'ammo', space: 'hull', u: [0.2, 0.9], v: [0.15, 0.7], w: [0.3, 0.8] },
      { id: 'engine', space: 'hull', u: [-0.7, 0.7], v: [0.15, 0.85], w: [-0.85, -0.35] },
      { id: 'transmission', space: 'hull', u: [-0.8, 0.8], v: [0.1, 0.6], w: [-1.0, -0.85] },
      { id: 'fuel', space: 'hull', u: [-0.95, -0.55], v: [0.5, 1.0], w: [-0.9, -0.3], ext: true },   // external drums
      { id: 'turret', space: 'turret', u: [-0.5, 0.5], v: [0.0, 0.2], w: [-0.4, 0.4] },
      { id: 'gun', space: 'turret', u: [-0.3, 0.3], v: [0.2, 0.8], w: [-0.2, 1.0] },
    ],
    crew: [
      { space: 'hull', u: [-0.3, 0.3], v: [0.2, 0.8], w: [0.55, 0.95] },
      { space: 'hull', u: [-0.6, 0.6], v: [0.2, 1.0], w: [-0.3, 0.3] },
      { space: 'turret', u: [-0.85, 0.85], v: [0.0, 0.9], w: [-0.6, 0.4] },
    ],
  },
  markV: {
    key: 'markV', name: 'Mark V', model: 'glb', scale: 3.0,
    maxSpeed: 5, accel: 3.0, turn: 0.75, radius: 3.0,
    turretSpeed: 0.7, elevSpeed: 0.3, elevMin: -0.15, elevMax: 0.3, turretArc: 1.25,
    reload: 3.5, ammoMax: 60, shellSpeed: 330, pen: 65, dmg: 0.8, disp: 0.006, caliber: '57 мм',
    fuelMax: 100, fuelUse: 0.05,
    armor: { hull: { front: 16, side: 12, rear: 10, top: 8 }, turret: { front: 16, side: 12, rear: 10, top: 8 } },
    split: null,
    modules: [
      { id: 'engine', space: 'hull', u: [-0.45, 0.45], v: [0.2, 0.75], w: [-0.3, 0.25] },
      { id: 'transmission', space: 'hull', u: [-0.6, 0.6], v: [0.1, 0.5], w: [-0.85, -0.55] },
      { id: 'fuel', space: 'hull', u: [-0.5, 0.5], v: [0.3, 0.8], w: [-1.0, -0.85], ext: true },
      { id: 'ammo', space: 'hull', u: [0.55, 0.95], v: [0.15, 0.55], w: [-0.3, 0.4] },
      { id: 'ammo', space: 'hull', u: [-0.95, -0.55], v: [0.15, 0.55], w: [-0.3, 0.4] },
      { id: 'gun', space: 'hull', u: [0.8, 1.0], v: [0.35, 0.7], w: [0.05, 0.4], ext: true },    // sponsons
      { id: 'gun', space: 'hull', u: [-1.0, -0.8], v: [0.35, 0.7], w: [0.05, 0.4], ext: true },
      { id: 'turret', space: 'hull', u: [-0.3, 0.3], v: [0.75, 1.0], w: [0.2, 0.6] },           // gun laying gear
    ],
    crew: [
      { space: 'hull', u: [-0.5, 0.5], v: [0.2, 0.9], w: [0.3, 0.9] },
      { space: 'hull', u: [-0.8, 0.8], v: [0.2, 0.8], w: [-0.1, 0.3] },
    ],
  },
};

// =====================================================================
// Procedural T-55
// =====================================================================
let t55Cache = null;
function t55Parts() {
  if (t55Cache) return t55Cache;
  const olive = new THREE.MeshStandardMaterial({ color: 0x4d5b30, roughness: 0.85, metalness: 0.15 });
  const oliveDark = new THREE.MeshStandardMaterial({ color: 0x3b4725, roughness: 0.9, metalness: 0.1 });
  const trackM = new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 0.95, metalness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.6, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xd8e6ee, roughness: 0.1, metalness: 0.4, emissive: 0x222222 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4f33, roughness: 1 });

  // hull side profile (z, y) extruded across X
  const s = new THREE.Shape();
  s.moveTo(-3.1, 0.42);
  s.lineTo(2.75, 0.42);
  s.lineTo(3.2, 0.92);
  s.lineTo(2.0, 1.52);
  s.lineTo(-2.95, 1.52);
  s.lineTo(-3.18, 1.12);
  s.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(s, { depth: 2.12, bevelEnabled: false });
  // shape is in XY (x = z, y = y), extruded along +Z: rotate so shape-x -> world Z
  hullGeo.rotateY(-Math.PI / 2);          // shape x -> +Z, extrusion -> -X
  hullGeo.translate(1.06, 0, 0);
  hullGeo.computeVertexNormals();

  const turretGeo = new THREE.SphereGeometry(1.2, 30, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  turretGeo.scale(1.0, 0.72, 1.12);
  const ring = new THREE.CylinderGeometry(1.18, 1.22, 0.12, 30);
  const wheel = new THREE.CylinderGeometry(0.41, 0.41, 0.46, 18);
  wheel.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10);
  hub.rotateZ(Math.PI / 2);
  const sprocket = new THREE.CylinderGeometry(0.33, 0.33, 0.44, 12);
  sprocket.rotateZ(Math.PI / 2);
  const barrel = new THREE.CylinderGeometry(0.072, 0.09, 4.2, 14);
  barrel.rotateX(Math.PI / 2);
  barrel.translate(0, 0, 2.3);
  const evac = new THREE.CylinderGeometry(0.135, 0.135, 0.5, 14);
  evac.rotateX(Math.PI / 2);
  evac.translate(0, 0, 3.55);
  const muzzle = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12);
  muzzle.rotateX(Math.PI / 2);
  muzzle.translate(0, 0, 4.36);
  const mantlet = new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI);
  mantlet.scale(1.1, 0.8, 0.6);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
  const box = new THREE.BoxGeometry(1, 1, 1);
  t55Cache = { olive, oliveDark, trackM, rubber, metal, glass, wood, hullGeo, turretGeo, ring, wheel, hub, sprocket,
               barrel, evac, muzzle, mantlet, cyl, box };
  return t55Cache;
}

function buildT55() {
  const P = t55Parts();
  const root = new THREE.Group();
  const add = (parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  add(root, P.hullGeo, P.olive, 0, 0, 0);
  // fenders
  for (const sx of [-1, 1]) {
    add(root, P.box, P.oliveDark, sx * 1.35, 1.06, -0.08, 0.6, 0.05, 6.15);
    // tracks: top run, bottom run, front & rear wrap
    add(root, P.box, P.trackM, sx * 1.34, 0.9, -0.05, 0.58, 0.08, 5.9);
    add(root, P.box, P.trackM, sx * 1.34, 0.04, 0.2, 0.58, 0.08, 4.2);
    add(root, P.box, P.trackM, sx * 1.34, 0.345, 2.71, 0.58, 0.08, 1.02, -0.64, 0, 0);
    add(root, P.box, P.trackM, sx * 1.34, 0.38, -2.46, 0.58, 0.08, 1.31, 0.546, 0, 0);
  }
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const z of [2.2, 0.95, 0.05, -0.85, -1.75]) {
      const w = add(root, P.wheel, P.olive, sx * 1.34, 0.45, z);
      add(w, P.hub, P.metal, 0, 0, 0);
      add(w, P.box, P.rubber, 0, 0, 0, 0.5, 0.5, 0.12);        // spoke to show rotation
      wheels.push(w);
    }
    const idler = add(root, P.sprocket, P.oliveDark, sx * 1.34, 0.6, 2.85, 0.85, 0.85, 0.85);
    const spr = add(root, P.sprocket, P.metal, sx * 1.34, 0.62, -2.72);
    add(spr, P.box, P.oliveDark, 0, 0, 0, 0.46, 0.55, 0.12);
    wheels.push(idler, spr);
  }
  // external fuel tanks on the right fender (-X is right)
  for (const z of [-2.35, -1.45, -0.55]) add(root, P.box, P.oliveDark, -1.35, 1.32, z, 0.5, 0.48, 0.8);
  // rear drums
  for (const x of [-0.55, 0.55]) add(root, P.cyl, P.oliveDark, x, 1.25, -3.35, 0.3, 0.95, 0.3, 0, 0, Math.PI / 2);
  // unditching log, engine grilles, stowage
  add(root, P.cyl, P.wood, 0, 1.66, -2.75, 0.13, 2.9, 0.13, 0, 0, Math.PI / 2);
  add(root, P.box, P.trackM, 0, 1.53, -1.9, 1.6, 0.03, 1.3);
  add(root, P.box, P.oliveDark, 1.35, 1.25, -1.2, 0.5, 0.35, 1.8);
  add(root, P.cyl, P.glass, 0.75, 1.3, 2.62, 0.1, 0.1, 0.1, Math.PI / 2 - 0.7, 0, 0);
  add(root, P.box, P.metal, 0.55, 1.56, 1.85, 0.5, 0.06, 0.4, 0.3, 0, 0);   // driver hatch

  // turret
  const turret = new THREE.Group();
  turret.position.set(0, 1.52, 0.72);
  root.add(turret);
  add(turret, P.ring, P.oliveDark, 0, 0.02, 0);
  add(turret, P.turretGeo, P.olive, 0, 0.05, 0);
  add(turret, P.cyl, P.olive, 0.52, 0.66, -0.3, 0.34, 0.28, 0.34);          // commander cupola (left)
  add(turret, P.cyl, P.metal, 0.52, 0.82, -0.3, 0.3, 0.05, 0.3);
  add(turret, P.cyl, P.olive, -0.48, 0.72, -0.35, 0.3, 0.06, 0.3);          // loader hatch
  add(turret, P.cyl, P.metal, -0.48, 0.95, -0.35, 0.03, 0.4, 0.03);         // AA MG post
  add(turret, P.cyl, P.metal, -0.48, 1.12, -0.1, 0.03, 0.9, 0.03, Math.PI / 2, 0, 0);
  add(turret, P.box, P.oliveDark, 0, 0.38, -1.25, 1.4, 0.3, 0.3);           // rear stowage
  add(turret, P.cyl, P.oliveDark, -0.55, 0.62, 0.95, 0.15, 0.3, 0.15, Math.PI / 2, 0, 0);   // IR searchlight
  add(turret, P.cyl, P.glass, -0.55, 0.62, 1.11, 0.13, 0.02, 0.13, Math.PI / 2, 0, 0);
  add(turret, P.cyl, P.metal, 0.75, 0.55, 0.9, 0.04, 0.12, 0.04);           // gunner sight

  const gun = new THREE.Group();
  gun.position.set(0, 0.42, 1.15);
  turret.add(gun);
  add(gun, P.mantlet, P.olive, 0, 0, 0.05);
  add(gun, P.barrel, P.olive, 0, 0, 0);
  add(gun, P.evac, P.olive, 0, 0, 0);
  add(gun, P.muzzle, P.metal, 0, 0, 0);
  add(gun, P.cyl, P.metal, -0.28, 0, 0.38, 0.035, 0.4, 0.035, Math.PI / 2, 0, 0);   // coax MG

  return {
    root, turret, gun, wheels, wheelR: 0.41,
    muzzleLen: 4.42,
    hullBox: new THREE.Box3(new THREE.Vector3(-1.64, 0.1, -3.4), new THREE.Vector3(1.64, 1.6, 3.2)),
    turretBox: new THREE.Box3(new THREE.Vector3(-1.2, 0, -1.35), new THREE.Vector3(1.2, 0.88, 1.35)),
    sightY: 1.0,
  };
}

// =====================================================================
// GLB models: bake transforms, optionally split turret triangles off the hull
// =====================================================================
function splitGeometry(geo, cfg) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const hx = (bb.max.x - bb.min.x) / 2, hz = (bb.max.z - bb.min.z) / 2, sy = bb.max.y - bb.min.y;
  const names = Object.keys(g.attributes);
  const out = { hull: {}, tur: {} };
  for (const n of names) { out.hull[n] = []; out.tur[n] = []; }
  const pos = g.attributes.position;
  const triCount = pos.count / 3;
  for (let t = 0; t < triCount; t++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += pos.getX(t * 3 + k); y += pos.getY(t * 3 + k); z += pos.getZ(t * 3 + k); }
    x /= 3; y /= 3; z /= 3;
    const u = (x - cx) / hx, v = (y - bb.min.y) / sy, w = (z - cz) / hz;
    const isT = (v > cfg.v0 && Math.abs(u) < cfg.u && w > cfg.w0 && w < cfg.w1) ||
                (v > cfg.bv0 && v < cfg.bv1 && Math.abs(u) < cfg.bu && w >= cfg.w1);
    const dst = isT ? out.tur : out.hull;
    for (const n of names) {
      const a = g.attributes[n];
      for (let k = 0; k < 3; k++) for (let c = 0; c < a.itemSize; c++) dst[n].push(a.array[(t * 3 + k) * a.itemSize + c]);
    }
  }
  const mk = (src) => {
    const r = new THREE.BufferGeometry();
    for (const n of names) r.setAttribute(n, new THREE.Float32BufferAttribute(src[n], g.attributes[n].itemSize));
    return r;
  };
  const hull = mk(out.hull), tur = mk(out.tur);
  const pivot = new THREE.Vector3(cx, bb.min.y + cfg.v0 * sy, cz + (cfg.w0 + cfg.w1) / 2 * hz);
  tur.translate(-pivot.x, -pivot.y, -pivot.z);
  tur.computeBoundingBox();
  const turretBox = new THREE.Box3(
    new THREE.Vector3(-cfg.u * hx, 0, (cfg.w0 - (cfg.w0 + cfg.w1) / 2) * hz),
    new THREE.Vector3(cfg.u * hx, bb.min.y + (cfg.vTop || 1) * sy - pivot.y, (cfg.w1 - (cfg.w0 + cfg.w1) / 2) * hz));
  const hullBox = new THREE.Box3(bb.min.clone(), bb.max.clone());
  hullBox.max.y = pivot.y + 0.1 * sy;
  return { hull, tur, pivot, turretBox, hullBox, muzzleZ: tur.boundingBox.max.z, topY: tur.boundingBox.max.y };
}

export class TankFactory {
  constructor() {
    this.loader = new GLTFLoader();
    this.glb = {};    // key -> prepared shared data
  }

  load(keys, onProgress) {
    let done = 0;
    return Promise.all(keys.map(key => new Promise(resolve => {
      const def = TANK_DEFS[key];
      this.loader.load(`assets/${key}.glb`, gltf => {
        const model = gltf.scene;
        // normalise: face +Z, centre XZ, sit on ground, bake scale
        const wrapper = new THREE.Group();
        wrapper.add(model);
        model.rotation.y = Math.PI / 2;
        wrapper.updateMatrixWorld(true);
        let mesh = null;
        model.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
        const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        const c = bb.getCenter(new THREE.Vector3());
        geo.translate(-c.x, -bb.min.y, -c.z);
        geo.scale(def.scale, def.scale, def.scale);
        geo.computeBoundingBox();
        const mat = mesh.material;
        mat.side = THREE.FrontSide;
        let data;
        if (def.split) {
          const sp = splitGeometry(geo, def.split);
          data = { mat, hullGeo: sp.hull, turGeo: sp.tur, pivot: sp.pivot, hullBox: sp.hullBox, turretBox: sp.turretBox,
                   muzzleZ: sp.muzzleZ, topY: sp.topY };
        } else {
          const b = geo.boundingBox;
          const h = b.max.y - b.min.y;
          data = { mat, hullGeo: geo, turGeo: null,
                   pivot: new THREE.Vector3(0, h * 0.55, b.max.z * 0.35),
                   hullBox: b.clone(),
                   turretBox: null, muzzleZ: b.max.z * 0.65, topY: h * 0.45 };
        }
        this.glb[key] = data;
        done++;
        if (onProgress) onProgress(done / keys.length);
        resolve();
      }, undefined, err => { console.error('Failed to load', key, err); done++; resolve(); });
    })));
  }

  available(key) { return TANK_DEFS[key].model === 'procedural' || !!this.glb[key]; }

  buildVisual(key) {
    const def = TANK_DEFS[key];
    if (def.model === 'procedural') return buildT55();
    const d = this.glb[key];
    const root = new THREE.Group();
    const hull = new THREE.Mesh(d.hullGeo, d.mat);
    hull.castShadow = hull.receiveShadow = true;
    root.add(hull);
    const turret = new THREE.Group();
    turret.position.copy(d.pivot);
    root.add(turret);
    if (d.turGeo) {
      const tm = new THREE.Mesh(d.turGeo, d.mat);
      tm.castShadow = tm.receiveShadow = true;
      turret.add(tm);
    }
    const gun = new THREE.Group();
    const tb = d.turretBox;
    gun.position.set(0, tb ? (tb.max.y) * 0.45 : 0, tb ? tb.max.z * 0.6 : 0);
    turret.add(gun);
    return {
      root, turret, gun, wheels: [], wheelR: 1,
      muzzleLen: Math.max(1.5, d.muzzleZ - gun.position.z),
      hullBox: d.hullBox.clone(),
      turretBox: tb ? tb.clone() : null,
      sightY: d.topY,
    };
  }
}

// =====================================================================
// Tank
// =====================================================================
let TANK_ID = 0;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);

export class Tank {
  constructor(scene, def, vis, pos, heading, opts = {}) {
    this.id = ++TANK_ID;
    this.scene = scene;
    this.def = def;
    this.vis = vis;
    this.root = vis.root;
    this.turret = vis.turret;
    this.gun = vis.gun;
    this.root.position.copy(pos);
    this.heading = heading;
    scene.add(this.root);

    this.team = opts.team || 'neutral';          // 'player' | 'enemy' | 'neutral'
    this.crew = !!opts.crew;                    // AI crew alive
    this.crewHp = 100;
    this.playerInside = false;
    this.hp = {};
    for (const id of SYSTEM_IDS) this.hp[id] = 100;
    this.ammo = opts.ammo ?? def.ammoMax;
    this.fuel = def.fuelMax;
    this.extinguishers = 3;
    this.loot = { repair_kit: opts.kits || 0 };
    this.fire = null;                            // { t, max, source, selfOut }
    this.wrecked = false;
    this.sink = opts.sink || 0;

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

  get operated() { return !this.wrecked && (this.crew || this.playerInside); }
  get enterable() { return !this.wrecked && !this.crew; }

  // ------------------------------------------------ system-derived factors
  get maxSpeedEff() {
    const e = this.hp.engine, t = this.hp.transmission;
    if (e <= 0 || t <= 0 || (this.team === 'player' && this.fuel <= 0)) return 0;
    return this.def.maxSpeed * (0.3 + 0.7 * e / 100) * (0.55 + 0.45 * t / 100);
  }
  get accelEff() {
    const e = this.hp.engine, t = this.hp.transmission;
    if (e <= 0 || t <= 0) return 0;
    return this.def.accel * (0.35 + 0.65 * e / 100) * (0.4 + 0.6 * t / 100);
  }
  get turnEff() {
    const t = this.hp.transmission;
    return t <= 0 ? 0 : this.def.turn * (0.35 + 0.65 * t / 100);
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
  get fuelMax() { return this.def.fuelMax * (this.hp.fuel <= 0 ? 0.6 : 1); }

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
    const p = this.root.position;
    const c = this.controls;
    if (!this.operated) { c.throttle = 0; c.steer = 0; c.brake = 1; }

    if (dt > 0 && world) {
      const maxS = this.maxSpeedEff;
      if (c.throttle !== 0 && maxS > 0) this.speed += c.throttle * this.accelEff * dt;
      else this.speed *= Math.pow(0.25, dt);
      if (c.brake) this.speed *= Math.pow(0.02, dt);
      this.speed = Math.max(-maxS * 0.45, Math.min(maxS, this.speed));
      if (Math.abs(this.speed) < 0.01) this.speed = 0;

      // tracked vehicles can pivot in place
      const steerEff = 1 - Math.min(0.6, Math.abs(this.speed) / Math.max(1, this.def.maxSpeed) * 0.7);
      this.heading += c.steer * this.turnEff * steerEff * dt * (this.speed >= -0.1 ? 1 : -1) *
                      (0.45 + 0.55 * Math.min(1, Math.abs(this.speed) / 2.5));

      const ox = p.x, oz = p.z;
      const dirX = Math.sin(this.heading), dirZ = Math.cos(this.heading);
      p.x += dirX * this.speed * dt;
      p.z += dirZ * this.speed * dt;

      if (world.heightAt(p.x, p.z) < WATER_LEVEL - 1.4) {
        p.x = ox; p.z = oz;
        this.speed *= 0.3;
      }
      const r = this.def.radius * 0.8;
      if (world.collideTrees(p, r)) this.speed *= Math.pow(0.02, dt);
      if (world.collideObstacles(p, r)) this.speed *= Math.pow(0.02, dt);
      if (others) {
        for (const o of others) {
          if (o === this) continue;
          const dx = p.x - o.root.position.x, dz = p.z - o.root.position.z;
          const rr = (this.def.radius + o.def.radius) * 0.75;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            p.x = o.root.position.x + dx / d * rr;
            p.z = o.root.position.z + dz / d * rr;
            this.speed *= Math.pow(0.05, dt);
          }
        }
      }
      this.velocity.set((p.x - ox) / dt, 0, (p.z - oz) / dt);

      // fuel
      if (this.team === 'player' && this.playerInside) {
        this.fuel -= this.def.fuelUse * (0.12 + 0.88 * Math.abs(c.throttle)) * dt;
        if (this.hp.fuel < 100) this.fuel -= (100 - this.hp.fuel) * 0.0015 * dt;   // leak
        this.fuel = Math.max(0, Math.min(this.fuelMax, this.fuel));
      }
      this.speedKmh = Math.abs(this.speed) * 3.6;

      // terrain follow + tilt
      const h = world.heightAt(p.x, p.z);
      p.y = h - this.sink;
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

      // wheel spin
      for (const w of this.vis.wheels) w.rotation.x += this.speed * dt / this.vis.wheelR;
    }

    this.root.quaternion.setFromAxisAngle(UP, this.heading)
      .multiply(_q.setFromAxisAngle(AX, this.tiltX))
      .multiply(_q2.setFromAxisAngle(AZ, this.tiltZ));

    // turret / gun laying
    if (dt > 0 && this.aimPoint && this.operated) this.layGun(dt);
    this.turret.rotation.y = this.turretYaw;
    this.gun.rotation.x = -this.gunElev;
    this.root.updateMatrixWorld(true);

    if (dt > 0) {
      if (this.reload > 0) this.reload -= dt;
      this.updateFire(dt);
    }
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

    const eRate = rate > 0 ? this.def.elevSpeed * (0.3 + 0.7 * this.hp.gun / 100) : 0;
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
    if (id === 'fuel' && this.hp.fuel <= 0 && before > 0) this.fuel = Math.min(this.fuel, this.fuelMax);
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
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.color.multiplyScalar(0.22);
      }
    });
    this.turretYaw += (Math.random() - 0.5) * 0.8;
    this.gunElev = this.def.elevMin;
    this.turret.rotation.y = this.turretYaw;
    this.gun.rotation.x = -this.gunElev;
  }

  // world-space hit volumes as {part, box, inv(matrix)}
  hitVolumes() {
    const v = [{ part: 'hull', box: this.vis.hullBox, obj: this.root }];
    if (this.vis.turretBox) v.push({ part: 'turret', box: this.vis.turretBox, obj: this.turret });
    return v;
  }

  // normalised module box -> local AABB in its space
  moduleBox(m, out = new THREE.Box3()) {
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
