// Airfield beside the road: a straight grass runway parallel to the road with its white edge markers and the landing
// "T", an apron with the parked planes (of the era met here) facing the runway, two arched hangars, a small control
// tower, the windsock, a fuel dump with barrels and a fuel bowser; its service zone refuels and rearms planes standing
// on the apron (and a fuel point for vehicles). Returns the parking spots [{ x, z, heading, key, id }].
import * as THREE from 'three';
import { MAT, box, halfCyl, cyl } from './kit.js';
import { barrels, crates } from './props.js';
import { PLANE_TIERS } from '../planedefs/index.js';

const RUNWAY_HALF = 270, RUNWAY_W = 30, RUNWAY_OFF = 95, APRON_OFF = 58;
const STRIP = new THREE.MeshStandardMaterial({ color: 0x6f774b, roughness: 1 });
const WIND = new THREE.MeshStandardMaterial({ color: 0xd8642a, roughness: 0.9 });

// the plane type for difficulty d (the one of the matching era, sometimes the one before / after)
export function pickPlaneKey(r, d) {
  const n = PLANE_TIERS.length;
  const i = Math.round(d * (n - 1) + (r() - 0.5) * 2.2);
  return PLANE_TIERS[Math.max(0, Math.min(n - 1, i))];
}

/** @param {import('./kit.js').Kit} K */
export function airfield(K) {
  const { world, plan, r, d } = K;
  const side = r() < 0.5 ? -1 : 1;
  // the runway: a straight strip between two points abreast of the road, laid on the ground
  const A = K.frame(-RUNWAY_HALF, side * RUNWAY_OFF), B = K.frame(RUNWAY_HALF, side * RUNWAY_OFF);
  const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L, px = uz, pz = -ux;          // along, across
  const rot = Math.atan2(ux, uz);
  const pos = [], idx = [];
  const n = Math.ceil(L / 4);
  for (let i = 0; i <= n; i++) {
    const t = i / n * L;
    for (const s of [-1, 0, 1]) {
      const x = A.x + ux * t + px * s * RUNWAY_W / 2, z = A.z + uz * t + pz * s * RUNWAY_W / 2;
      pos.push(x, world.heightAt(x, z) + 0.1, z);
    }
    if (i < n) for (let k = 0; k < 2; k++) { const a = i * 3 + k; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const na = g.attributes.normal;
  for (let i = 0; i < na.count; i++) if (na.getY(i) < 0) na.setXYZ(i, -na.getX(i), -na.getY(i), -na.getZ(i));
  const strip = new THREE.Mesh(g, STRIP);
  strip.receiveShadow = true;
  K.group.add(strip);
  // edge markers, the landing T at the threshold, numbers
  const mark = (t, s, w, l, rr = rot) => {
    const x = A.x + ux * t + px * s, z = A.z + uz * t + pz * s;
    K.part(box, MAT.white, x, world.heightAt(x, z) + 0.05, z, w, 0.12, l, rr, false);
  };
  for (let t = 10; t < L; t += 40) for (const s of [-1, 1]) mark(t, s * (RUNWAY_W / 2 + 0.8), 1.2, 3);
  mark(45, 0, 2.2, 14);
  mark(52, 0, 12, 2.2);
  mark(L - 45, 0, 2.2, 14);
  mark(L - 52, 0, 12, 2.2);
  // the windsock beyond the runway
  {
    const f = K.frame(0, side * (RUNWAY_OFF + 30));
    const y = world.heightAt(f.x, f.z);
    K.part(box, MAT.white, f.x, y, f.z, 0.15, 6.5, 0.15, f.rot);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.2, 2.6, 10, 1, true).rotateZ(Math.PI / 2), WIND);
    sock.position.set(f.x + 1.3, y + 6.3, f.z);
    sock.rotation.y = 0.6;
    sock.castShadow = true;
    K.group.add(sock);
  }
  // two arched hangars between the road and the apron, open to the runway
  for (const along of [70, 110]) {
    const f = K.frame(along, side * 33);
    const y = K.groundMin(f.x, f.z, 10) - 0.2;
    const W = 20, D = 18, H = 8;
    const hr = f.rot + Math.PI / 2;                              // the arch spans along the road, opens across
    const roof = K.part(halfCyl, MAT.hangar, f.x, y, f.z, D / 2, H, W / 2, f.rot);
    roof.scale.set(W / 2, H, D);
    roof.rotation.y = hr;
    K.part(box, MAT.darkConcrete, f.x, y - 0.1, f.z, W + 1, 0.2, D + 1, f.rot);
    const back = K.at(f, -side * (D / 2 - 0.2), 0);
    K.part(box, MAT.concrete, back.x, y, back.z, 0.3, H * 0.95, W, f.rot);
    const front = K.at(f, side * (D / 2 - 0.1), 0);
    K.part(box, MAT.hole, front.x, y, front.z, 0.05, H * 0.7, W * 0.8, f.rot, false);
    // walls: the back and the sides of the arch are obstacles (the front is open)
    K.obstacle({ x: back.x, z: back.z, rot: f.rot }, 0.3, W / 2, y, y + H);
    for (const s of [-1, 1]) {
      const sp = K.at(f, 0, s * (W / 2 - 0.5));
      K.obstacle({ x: sp.x, z: sp.z, rot: f.rot }, D / 2, 0.6, y, y + H * 0.6);
    }
  }
  // control tower, fuel dump, a bowser
  const tw = K.frame(-150, side * 38);
  const ty = K.groundMin(tw.x, tw.z, 4) - 0.2;
  K.part(box, MAT.walls[0], tw.x, ty, tw.z, 5, 6, 5, tw.rot);
  K.part(box, MAT.window, tw.x, ty + 6, tw.z, 4.2, 2.2, 4.2, tw.rot);
  K.part(box, MAT.roofs[1], tw.x, ty + 8.2, tw.z, 5.6, 0.3, 5.6, tw.rot);
  K.part(box, MAT.metal, tw.x, ty + 8.5, tw.z, 0.1, 3, 0.1, tw.rot);
  K.obstacle(tw, 2.6, 2.6, ty, ty + 8.5);
  const fd = K.frame(20, side * 40);
  barrels(K, fd, 9);
  crates(K, K.frame(30, side * 44), 4);
  const bw = K.frame(10, side * 47);
  const by = world.heightAt(bw.x, bw.z);
  K.part(box, MAT.green, bw.x, by + 0.4, bw.z, 2.0, 1.0, 5.5, bw.rot);
  K.part(cyl, MAT.green, bw.x, by + 1.4, bw.z - 0.0, 1.8, 1.4, 1.8, 0).scale.set(1.8, 1.3, 1.8);
  K.obstacle(bw, 1.1, 2.8, by, by + 2.5);
  // service: the apron (planes), a fuel point (vehicles)
  const ap = K.frame(-40, side * APRON_OFF);
  K.zones.push({ type: 'airfield', x: ap.x, z: ap.z, r: 120, label: 'Аэродром' });
  K.zones.push({ type: 'fuel', x: fd.x, z: fd.z, r: 9, label: 'Склад ГСМ' });
  // things lying about
  for (let i = 0; i < 3; i++) { const p = K.at(fd, 3 + i * 1.1, -3); K.addItem('canister', p.x, p.z, { fuel: 20 }); }
  { const p = K.at(tw, side * 4, 2); K.addLoot(p.x, p.z); }
  if (r() < 0.6) { const p = K.at(tw, side * 4, -2); K.addItem('repair_kit', p.x, p.z); }
  if (r() < 0.4) { const p = K.at(fd, -2, 3); K.addSpray(p.x, p.z); }
  // the parked planes: in a row on the apron, noses to the runway
  const spots = [];
  const np = 3 + (r() < 0.5 ? 1 : 0);
  for (let i = 0; i < np; i++) {
    const along = -130 + i * 26;
    const f = K.frame(along, side * APRON_OFF);
    // towards the runway: the direction across it
    const heading = Math.atan2(-px * side, -pz * side) + (r() - 0.5) * 0.3;
    spots.push({ x: f.x, z: f.z, heading, key: pickPlaneKey(r, d), id: `af${plan.k}:${i}` });
  }
  return spots;
}
