// Shared pieces of the armoured personnel carriers (tankdefs/<apc>.js): road wheels with tyres (the front axles
// steer), open troop compartments with benches, machine-gun shields. APCs are hulls like the tanks (turretless
// or with a small MG turret, no main gun) with `apc: { troops }` and troop seats (`hull.troops`).
import * as THREE from 'three';
import { PI, U, add, keep, bake, sizedBox } from '../modelkit.js';

// wheels on axles along Z. o: { x (half track), zs: [z..], r (tyre radius), w (tyre width), steer: number of front
// axles that steer, hubMat, dual: twin tyres on the rear axles }
// returns { wheels (spin groups), steer (steering groups, rotation.y) }
export function roadWheels(root, P, o) {
  const wheels = [], steer = [];
  o.zs.forEach((z, i) => {
    for (const sx of [-1, 1]) {
      const pivot = keep(new THREE.Group());
      pivot.position.set(sx * o.x, o.r, z);
      root.add(pivot);
      const spin = keep(new THREE.Group());
      pivot.add(spin);
      const w = o.w;
      add(spin, new THREE.CylinderGeometry(1, 1, 1, 18).rotateZ(PI / 2), P.rubber, 0, 0, 0, w, o.r, o.r);    // tyre
      add(spin, U.cylX, o.hubMat || P.main, sx * 0.01, 0, 0, w * 1.02, o.r * 0.58, o.r * 0.58);             // rim
      add(spin, U.cylX, P.metal, sx * 0.02, 0, 0, w * 1.05, o.r * 0.22, o.r * 0.22);                         // hub
      for (let k = 0; k < 3; k++) add(spin, U.box, P.dark, sx * 0.02, 0, 0, w * 1.04, o.r * 1.1, 0.04, k * PI / 3, 0, 0);   // tread lugs / bolts
      bake(spin);
      wheels.push(spin);
      if (i < (o.steer || 0)) steer.push(pivot);
    }
  });
  return { wheels, steer };
}

// fender / mudguard over a wheel
export function fender(root, P, x, z, r, w) {
  add(root, U.box, P.main, x, r * 2 + 0.06, z, w + 0.12, 0.04, r * 2.1);
  add(root, U.box, P.main, x, r * 1.6, z + r * 1.05, w + 0.12, r * 0.8, 0.04, -0.5, 0, 0);
  add(root, U.box, P.main, x, r * 1.6, z - r * 1.05, w + 0.12, r * 0.8, 0.04, 0.5, 0, 0);
}

// open-top troop box: thin armour walls around a floor (x half width, z0..z1, floor..top), sloped sides
export function openBox(root, P, o) {
  const { x, z0, z1, floor, top } = o;
  const h = top - floor, t = o.t || 0.05, lean = o.lean || 0;
  for (const sx of [-1, 1]) {
    add(root, sizedBox(t, h, z1 - z0), P.main, sx * (x - Math.sin(lean) * h / 2), floor + h / 2, (z0 + z1) / 2, 1, 1, 1, 0, 0, sx * lean);
  }
  add(root, sizedBox(x * 2 - (o.rearInset || 0), h + (o.rearDrop || 0), t), P.main, 0, floor + h / 2 - (o.rearDrop || 0) / 2, z0);
  add(root, sizedBox(x * 2, (o.floorT || 0.06), z1 - z0), P.dark, 0, floor, (z0 + z1) / 2);
}

// benches along the sides of a troop compartment (outside view: seen over the open walls)
export function benches(root, P, x, z0, z1, y) {
  for (const sx of [-1, 1]) {
    add(root, U.box, P.wood, sx * x, y, (z0 + z1) / 2, 0.36, 0.06, z1 - z0);
    add(root, U.box, P.dark, sx * (x + 0.16), y + 0.3, (z0 + z1) / 2, 0.04, 0.5, z1 - z0);
  }
}

// seats of the infantry on the benches: n per side, facing the middle (hull-local seat data for hull.troops)
// o: { x (bench), z0, z1, seatY, eyeUp (eye above the seat), eyeIn (eye towards the middle), n, fire }
export function troopSeats(o) {
  const res = [];
  for (let i = 0; i < o.n; i++) {
    const z = o.n > 1 ? o.z1 - (o.z1 - o.z0) * i / (o.n - 1) : (o.z0 + o.z1) / 2;
    for (const sx of [1, -1]) {
      const eyeX = o.eyeX != null ? sx * o.eyeX : sx * (o.x - (o.eyeIn ?? 0.05));
      res.push({ pos: [sx * o.x, o.seatY, z], eye: [eyeX, o.seatY + (o.eyeUp ?? 0.78), z], ry: -sx * PI / 2, fire: o.fire !== false, look: sx });
    }
  }
  return res;
}

// machine-gun shield (goes onto the pintle and turns with the gun): a bent plate with a slot
export function mgShield(P, w = 0.62, h = 0.5) {
  const g = new THREE.Group();
  add(g, U.box, P.main, 0, 0.02, 0.1, w * 0.46, h, 0.02);
  for (const sx of [-1, 1]) add(g, U.box, P.main, sx * w * 0.38, 0.02, 0.06, w * 0.34, h, 0.02, 0, sx * 0.35, 0);
  add(g, U.box, P.dark, 0, h / 2 + 0.02, 0.1, w * 0.46, 0.03, 0.03);
  bake(g);
  return g;
}

// vision block / slit in a plate (dark rectangle)
export const slit = (root, P, x, y, z, w, ry = 0, rx = 0) => add(root, U.box, P.black, x, y, z, w, 0.03, 0.02, rx, ry, 0);
