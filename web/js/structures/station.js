// Railway station of a village / town that a parallel line runs through (railways.js plans it, settlements.js builds
// it with the rest of the settlement): the low platform along the track on the road side (walkable: a floor in
// world.houses), the two-storey station house with its name boards, benches and lamps, a water tower for the steam
// engines and home signals (semaphores) at both ends beyond the track.
import * as THREE from 'three';
import { MAT, box, cyl, roofGeo, signTexture } from './kit.js';
import { crates } from './props.js';

/** @typedef {import('./kit.js').Kit} Kit */

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const SMAT = { brick: M(0xa8553a), ochre: M(0xd8b878), trim: M(0xf0ece0), platform: M(0x8c877c), edge: M(0xd8d2c0),
  roofTin: M(0x5f6b62, { metalness: 0.35, roughness: 0.6 }), tank: M(0x4a5a4f, { metalness: 0.3, roughness: 0.7 }), black: M(0x222222) };

/**
 * @param {Kit} K
 * @param {{ side: number, off: number, half: number, name: string, line: any }} st
 * @returns {{ f: { x: number, z: number }, rad2: number, shown: boolean, inner: any[], floorAt: Function }} the platform floor
 */
export function station(K, st) {
  const { world, r } = K;
  const S = st.side, T = st.off, half = st.half;
  const town = K.plan.type === 'town';
  const yAt = (x, z) => { const q = world.rail.nearest(x, z, 30); return q ? q.y : world.heightAt(x, z); };
  // the platform: 10 m pieces following the track, top level with the rail heads
  const rects = [];
  const PW = 3.2, PO = T - 3.4;
  for (let a = -half; a < half - 1e-3; a += 10) {
    const f = K.frame(a + 5, S * PO);
    const y = yAt(f.x, f.z);
    K.part(box, SMAT.platform, f.x, y - 0.25, f.z, PW, 0.75, 10.05, f.rot);
    const e = K.at(f, S * (PW / 2 - 0.15), 0);
    K.part(box, SMAT.edge, e.x, y + 0.49, e.z, 0.3, 0.03, 10.05, f.rot, false);
    rects.push({ x: f.x, z: f.z, c: Math.cos(f.rot), s: Math.sin(f.rot), hx: PW / 2, hz: 5.03, y: y + 0.5 });
  }
  // the station house behind the platform
  const fb = K.frame(0, S * (PO - PW / 2 - 6));
  const gy = K.groundMin(fb.x, fb.z, 9) - 0.2;
  const BW = town ? 24 : 16, BD = 8, BH = town ? 7.4 : 4.2;
  const wall = town ? SMAT.brick : SMAT.ochre;
  K.part(box, MAT.plinth, fb.x, gy, fb.z, BD + 0.3, 0.8, BW + 0.3, fb.rot);
  K.part(box, wall, fb.x, gy + 0.8, fb.z, BD, BH, BW, fb.rot);
  K.part(box, SMAT.trim, fb.x, gy + 0.8 + BH, fb.z, BD + 0.4, 0.3, BW + 0.4, fb.rot);
  K.part(roofGeo, SMAT.roofTin, fb.x, gy + 1.1 + BH, fb.z, BD + 1.2, 2.6, BW + 1.2, fb.rot);
  // windows / doors on both long sides, a storey line for the town station
  const storeys = town ? 2 : 1;
  for (const face of [-1, 1]) {
    for (let k = 0; k < BW / 3 - 1; k++) {
      const lz = -BW / 2 + 2.5 + k * 3;
      for (let st2 = 0; st2 < storeys; st2++) {
        const door = st2 === 0 && face === S && (k === Math.floor((BW / 3 - 1) / 2));
        const p = K.at(fb, face * (BD / 2 + 0.03), lz);
        K.part(box, door ? MAT.trims[1] : MAT.window, p.x, gy + (door ? 0.8 : 1.8 + st2 * 3.3), p.z, 0.06, door ? 2.4 : 1.5, door ? 1.6 : 1.0, fb.rot);
        if (!door) { const q = K.at(fb, face * (BD / 2 + 0.06), lz); K.part(box, SMAT.trim, q.x, gy + 1.65 + st2 * 3.3, q.z, 0.08, 0.15, 1.3, fb.rot); }
      }
    }
    if (town) { const p = K.at(fb, face * (BD / 2 + 0.05), 0); K.part(box, SMAT.trim, p.x, gy + 4.0, p.z, 0.1, 0.2, BW, fb.rot); }
  }
  K.obstacle(fb, BD / 2 + 0.2, BW / 2 + 0.2, gy, gy + BH + 3.5);
  // name boards: on the house over the platform door and at both ends of the platform
  const tex = signTexture('ст. ' + st.name, K.plan.type === 'town' ? 'вокзал' : 'станция');
  const boardAt = (x, y, z, rot, w = 3.4) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
    b.userData.own = 'all';
    b.position.set(x, y, z);
    b.rotation.y = rot;
    K.group.add(b);
  };
  { const p = K.at(fb, S * (BD / 2 + 0.12), 0); boardAt(p.x, gy + BH + 0.2, p.z, fb.rot + Math.PI / 2, 4.2); }
  for (const a of [-half + 3, half - 3]) {
    const f = K.frame(a, S * (PO - 0.6)), y = yAt(f.x, f.z) + 0.5;
    K.part(box, MAT.metal, f.x, y, f.z, 0.1, 2.6, 0.1, f.rot);
    boardAt(f.x, y + 2.7, f.z, f.rot + Math.PI / 2, 2.2);
  }
  // benches and lamp posts on the platform
  for (let a = -half + 8; a < half - 6; a += 14) {
    const f = K.frame(a, S * (PO - 0.9)), y = yAt(f.x, f.z) + 0.5;
    K.part(box, MAT.furniture, f.x, y + 0.42, f.z, 0.45, 0.06, 1.8, f.rot);
    K.part(box, MAT.furniture, f.x, y, f.z, 0.4, 0.42, 0.1, f.rot);
    const l = K.frame(a + 7, S * (PO - 1.2));
    K.part(box, SMAT.black, l.x, y, l.z, 0.1, 3.4, 0.1, l.rot);
    K.part(box, SMAT.black, l.x, y + 3.4, l.z, 0.35, 0.3, 0.35, l.rot);
  }
  if (town) {                                                         // a canopy over the middle of the platform
    for (let a = -20; a <= 20; a += 8) {
      const f = K.frame(a, S * (PO - 0.8)), y = yAt(f.x, f.z) + 0.5;
      K.part(box, SMAT.black, f.x, y, f.z, 0.14, 3.3, 0.14, f.rot);
    }
    const f = K.frame(0, S * (PO - 0.3)), y = yAt(f.x, f.z) + 0.5;
    K.part(box, SMAT.roofTin, f.x, y + 3.3, f.z, PW + 1.4, 0.12, 44, f.rot);
  }
  // water tower beyond the track (for the steam engines)
  {
    const f = K.frame(half * 0.55, S * (T + 9));
    const y = K.groundMin(f.x, f.z, 3);
    K.part(cyl, SMAT.brick, f.x, y, f.z, 4.4, 6, 4.4, 0);
    K.part(cyl, SMAT.tank, f.x, y + 6, f.z, 5.6, 3.2, 5.6, 0);
    K.part(cyl, SMAT.roofTin, f.x, y + 9.2, f.z, 6.2, 0.4, 6.2, 0);
    K.part(roofGeo, SMAT.roofTin, f.x, y + 9.6, f.z, 4.6, 1.6, 4.6, f.rot);
    const sp = K.at(f, -S * 3.6, 0);                                  // the spout over the track
    K.part(box, SMAT.black, sp.x, y + 6.8, sp.z, 3.2, 0.3, 0.3, f.rot);
    K.obstacle(f, 2.3, 2.3, y, y + 10);
  }
  // home signals (semaphores) at both ends
  for (const a of [-half - 60, half + 60]) {
    const f = K.frame(a, S * (T + 2.6)), y = yAt(f.x, f.z);
    K.part(box, SMAT.black, f.x, y, f.z, 0.18, 6.5, 0.18, f.rot);
    const arm = K.at(f, S * 0.6, 0);
    K.part(box, MAT.red, arm.x, y + 5.8, arm.z, 1.3, 0.22, 0.06, f.rot + (a < 0 ? 0 : Math.PI) + S * 0.6);
    K.part(box, MAT.white, arm.x, y + 5.85, arm.z, 0.25, 0.12, 0.07, f.rot + (a < 0 ? 0 : Math.PI) + S * 0.6, false);
  }
  // freight lying about: crates by the house, some loot
  crates(K, K.frame(BW / 2 + 5, S * (PO - PW / 2 - 4)), 3 + Math.floor(r() * 3));
  { const p = K.frame(-BW / 2 - 4, S * (PO - PW / 2 - 3)); K.addLoot(p.x, p.z); }
  if (r() < 0.5) { const p = K.frame(BW / 2 + 3, S * (PO - PW / 2 - 6)); K.addItem('canister', p.x, p.z, { fuel: 20 }); }
  // the platform as a floor (walkers step up onto it)
  const c = K.frame(0, S * PO);
  return {
    f: { x: c.x, z: c.z }, rad2: (half + 8) ** 2, shown: true, inner: [],
    floorAt(dx, dz, lim) {
      const x = c.x + dx, z = c.z + dz;
      let best = -Infinity;
      for (const q of rects) {
        const rx = x - q.x, rz = z - q.z;
        const lx = rx * q.c - rz * q.s, lz = rx * q.s + rz * q.c;
        if (Math.abs(lx) <= q.hx && Math.abs(lz) <= q.hz && q.y <= lim && q.y > best) best = q.y;
      }
      return best;
    },
  };
}
