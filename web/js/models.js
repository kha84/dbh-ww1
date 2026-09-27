// Procedural tank models: builds the parts of a tank type from its definition (tankdefs/<key>.js).
// Every replaceable part is its own group so it can be moved between tanks, carried in hands,
// dropped on the ground or stored under the crane. Crew compartments: see interiors.js.
import * as THREE from 'three';
import { DEFS } from './tankdefs/index.js';
import { PI, U, mats, add, bake } from './modelkit.js';

export { buildHullInterior, buildTurretInterior, turretCeiling } from './interiors.js';
export { ovalPlan } from './modelkit.js';

const M = key => DEFS[key].models;

export function buildHull(key) {
  const h = M(key).hull();
  h.key = key;
  // machine-gun pintle left on the turret ring when the turret is lifted off (turret-yaw-pivot local)
  if (!h.mgAt) h.mgAt = new THREE.Vector3(h.ring.r * 0.62, 0.02, -0.25);
  bake(h.root);
  h.root.userData.markHost = true;
  return h;
}

export function buildTurret(key) {
  const t = M(key).turret();
  t.key = key;
  bake(t.group);
  t.group.userData.markHost = true;
  t.gunPivot = new THREE.Group();
  t.gunPivot.position.copy(t.gunPos);
  t.group.add(t.gunPivot);
  // a second, independently traversing turret (twin-turret tanks): carries the machine gun
  if (t.second) {
    const s = t.second;
    bake(s.group);
    s.group.userData.markHost = true;
    t.group.add(s.group);
    s.group.position.copy(s.pos);
  }
  t.group.userData.groundY = 0.25;
  return t;
}

// guns: origin at the trunnions, barrel +Z
export function buildGun(key) {
  const v = M(key).gun();
  v.key = key;
  bake(v.group);
  v.group.userData.markHost = true;
  v.group.userData.groundY = 0.3;
  return v;
}

// engines: origin bottom centre
export function buildEngine(key) {
  const P = mats(key);
  const g = new THREE.Group();
  const h = M(key).engine(g, P, P.engine);
  bake(g);
  g.userData = { markHost: true, groundY: 0, h };
  return { group: g, h };
}

// external fuel tanks: origin centre
export function buildFuel(key) {
  const P = mats(key);
  const g = new THREE.Group();
  const groundY = M(key).fuel(g, P) ?? 0.3;
  bake(g);
  g.userData = { markHost: true, groundY };
  return { group: g };
}

// turret drives: origin at the ring centre
export function buildDrive(key) {
  const P = mats(key);
  const g = new THREE.Group();
  const m = M(key);
  if (m.drive) m.drive(g, P);
  else {
    const r = m.driveR || 1;
    add(g, new THREE.TorusGeometry(r, 0.07, 6, 36).rotateX(PI / 2), P.steel, 0, 0.08, 0);
    add(g, new THREE.TorusGeometry(r - 0.1, 0.03, 4, 36).rotateX(PI / 2), P.brass, 0, 0.1, 0);
    add(g, U.box, P.engine, r - 0.05, 0.2, 0.3, 0.32, 0.3, 0.4);            // gearbox
    add(g, U.cylX, P.dark, r - 0.35, 0.25, 0.3, 0.3, 0.1, 0.1);            // electric motor
    add(g, new THREE.TorusGeometry(0.14, 0.02, 6, 16), P.metal, r - 0.05, 0.25, 0.55, 1, 1, 1, 0, 0, 0);   // handwheel
  }
  bake(g);
  g.userData = { markHost: true, groundY: 0.02 };
  return { group: g };
}
