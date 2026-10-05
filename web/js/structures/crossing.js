// Level crossing where a railway line crosses the road: the plank deck over the rails (with ramps: vehicles roll over
// it - it is walkable ground through world.bridges), striped barrier arms that come down while a train is near
// (trains.js), St. Andrew's cross signs and the crossing keeper's booth.
import * as THREE from 'three';
import { bakeStatic } from '../bakestatic.js';
import { GeoBuilder } from '../bakestatic.js';
import { RAIL_TOP } from '../railways.js';
import { ROAD_HALF } from '../world.js';

const M = (color, r = 0.85, m = 0.05) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
const MAT = { red: M(0xb3302a), white: M(0xeeeee6), post: M(0x3a3a36, 0.6, 0.4), wall: M(0xd8cfb4), roof: M(0x5a4a3c), window: M(0x2a3238, 0.3, 0.3),
  door: M(0x4f6a4a), lamp: M(0x2a2a2a, 0.5, 0.5) };
const BOX = new THREE.BoxGeometry(1, 1, 1);
const COL = { plank: new THREE.Color(0x5e4a36), gap: new THREE.Color(0x2c241c) };
const OPEN = 1.42;                    // arm angle when raised (rad)

export function buildCrossing(world, L) {
  const C = L.cross, group = new THREE.Group();
  const y = C.y, yr = y + RAIL_TOP;
  const i = C.i;
  const tdx = L.x[Math.min(L.n - 1, i + 1)] - L.x[Math.max(0, i - 1)], tdz = L.z[Math.min(L.n - 1, i + 1)] - L.z[Math.max(0, i - 1)];
  const tl = Math.hypot(tdx, tdz), tx = tdx / tl, tz = tdz / tl;           // along the track
  const hr = world.roadHeading(C.z);
  const rdx = Math.sin(hr), rdz = Math.cos(hr), rax = Math.cos(hr), raz = -Math.sin(hr);   // road: along, across (+side)
  const sinA = Math.max(0.3, Math.abs(tx * rdz - tz * rdx));              // sine of the crossing angle
  const cot = (tx * rdx + tz * rdz) / sinA;
  const roadY = world.roadH(C.z) + 0.14;
  const put = (mat, x, yy, z, sx, sy, sz, ry = 0, rz = 0, parent = group) => {
    const m = new THREE.Mesh(BOX, mat);
    m.position.set(x, yy, z); m.scale.set(sx, sy, sz);
    m.rotation.order = 'YXZ'; m.rotation.set(0, ry, rz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // the deck: planks level with the rail heads across the road, ramps down to the road on both sides of the track
  const G = new GeoBuilder();
  const Ld = (2 * ROAD_HALF + 2.5) / sinA, HW = 1.7, RW = 2.6;
  G.box(C.x, roadY - 0.1, C.z, tx, 0, tz, Ld, HW * 2, yr - 0.02 - roadY + 0.1, COL.plank, 0.95, 0, 31);
  for (const v of [-0.76, 0.76]) for (const o of [-0.1, 0.1]) {
    G.box(C.x + tz * (v + o * 1.6), yr - 0.03, C.z - tx * (v + o * 1.6), tx, 0, tz, Ld, 0.04, 0.02, COL.gap, 1, 0, 16);
  }
  for (const sd of [-1, 1]) {                                            // ramps
    const a = HW * sd, b = (HW + RW) * sd;
    const P = (u, v, h) => [C.x + tx * u + tz * v, h, C.z + tz * u - tx * v];
    G.quad(P(-Ld / 2, a, yr - 0.02), P(Ld / 2, a, yr - 0.02), P(Ld / 2, b, roadY), P(-Ld / 2, b, roadY), [0, 1, 0], COL.plank, 0.95, 0);
  }
  const deck = G.mesh(false);
  group.add(deck);
  const deckKey = `rx${L.id}`;
  world.bridges.set(deckKey, {
    cx: C.x, cz: C.z, L: Ld / 2 + 6,
    deckAt(x, z) {
      const rx = x - C.x, rz = z - C.z;
      const u = rx * tx + rz * tz, v = Math.abs(rx * tz - rz * tx);
      if (Math.abs(u) > Ld / 2 || v > HW + RW) return null;
      return v < HW ? yr - 0.02 : yr - 0.02 + (roadY - yr + 0.02) * (v - HW) / RW;
    },
    dispose() {},
  });
  // barrier arms: one on each side of the track, the post at a road edge, the arm across the whole road
  const arms = [];
  for (const sd of [-1, 1]) {
    const acr = sd * (ROAD_HALF + 0.9);
    const along = -sd * (6.5 + Math.abs(acr * cot));
    const px = C.x + rdx * along + rax * acr, pz = C.z + rdz * along + raz * acr;
    const py = world.roadH(pz) + 0.1;
    put(MAT.post, px, py + 0.55, pz, 0.22, 1.1, 0.22);
    put(MAT.post, px, py + 1.1, pz, 0.3, 0.12, 0.6, hr);
    const arm = new THREE.Group();
    arm.position.set(px, py + 1.1, pz);
    arm.rotation.order = 'YXZ';
    arm.rotation.y = sd > 0 ? hr + Math.PI : hr;                         // local +X points across the road
    const len = ROAD_HALF * 2 + 0.6;
    for (let k = 0; k < 9; k++) put(k % 2 ? MAT.white : MAT.red, (k + 0.5) * len / 9, 0, 0, len / 9 + 0.01, 0.13, 0.1, 0, 0, arm);
    put(MAT.post, -0.55, 0, 0, 0.7, 0.3, 0.3, 0, 0, arm);                 // counterweight
    arm.rotation.z = OPEN;
    group.add(arm);
    arms.push(arm);
    // St. Andrew's cross beside the post
    const sx = px + rdx * along * 0.25 + rax * sd * 1.2, sz = pz + rdz * along * 0.25 + raz * sd * 1.2;
    put(MAT.post, sx, py + 1.2, sz, 0.12, 2.4, 0.12);
    for (const a of [0.78, -0.78]) {
      put(MAT.white, sx, py + 2.35, sz, 0.06, 1.5, 0.22, hr + Math.PI / 2, a);
      put(MAT.red, sx + rdx * 0.035 * Math.sign(along || 1), py + 2.35, sz + rdz * 0.035 * Math.sign(along || 1), 0.04, 1.3, 0.08, hr + Math.PI / 2, a);
    }
    put(MAT.lamp, sx, py + 1.75, sz, 0.32, 0.32, 0.18, hr);
  }
  // the crossing keeper's booth by the road
  const obstacles = [];
  {
    const acr = (ROAD_HALF + 4.5), along = 10 + Math.abs(acr * cot);
    const bx = C.x + rdx * along + rax * acr, bz = C.z + rdz * along + raz * acr;
    const by = Math.min(world.heightAt(bx, bz), world.roadH(bz));
    put(MAT.wall, bx, by + 1.2, bz, 2.4, 2.4, 2.4, hr);
    put(MAT.roof, bx, by + 2.55, bz, 2.9, 0.3, 2.9, hr);
    put(MAT.window, bx - rax * 1.21, by + 1.5, bz - raz * 1.21, 0.04, 0.7, 0.9, hr);
    put(MAT.door, bx + rdx * 1.21, by + 1.0, bz + rdz * 1.21, 0.8, 1.9, 0.04, hr);
    obstacles.push(world.addObstacle({ x: bx, z: bz, hx: 1.25, hz: 1.25, rot: hr, y0: by, y1: by + 2.7 }));
  }
  // bake everything that does not move (the arms stay meshes of their own: they turn)
  bakeStatic(group.children.filter(o => o.isMesh && o !== deck), group);
  world.scene.add(group);
  let angle = OPEN;
  return {
    x: C.x, z: C.z, line: L, s: C.s,
    // close: the barriers come down (a train is near)
    update(dt, close) {
      const want = close ? 0 : OPEN;
      if (Math.abs(angle - want) < 1e-3) return;
      angle += Math.sign(want - angle) * Math.min(Math.abs(want - angle), dt * 0.9);
      for (const a of arms) a.rotation.z = angle;
    },
    get closed() { return angle < 0.2; },
    dispose() {
      world.scene.remove(group);
      group.traverse(o => { if (o.isMesh && o.userData.own) o.geometry.dispose(); });
      for (const o of obstacles) world.removeObstacle(o);
      world.bridges.delete(deckKey);
    },
  };
}
