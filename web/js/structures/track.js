// Railway track (railways.js plans the lines): ballast, sleepers and rails of ~150 m of a line written straight into
// one mesh (bakestatic GeoBuilder: thousands of small boxes, one draw call), and the buffer stops at the ends of a
// line (a timber frame with the buffer beam and an earth bank behind it).
import * as THREE from 'three';
import { GeoBuilder } from '../bakestatic.js';
import { RAIL_TOP, GAUGE_X, STEP } from '../railways.js';

const COL = {
  ballast: new THREE.Color(0x7a7268), ballastDark: new THREE.Color(0x5f5850), sleeper: new THREE.Color(0x3d3026),
  rail: new THREE.Color(0x6b645c), railTop: new THREE.Color(0x9a958c), beam: new THREE.Color(0xb3302a), white: new THREE.Color(0xe8e6dc),
  earth: new THREE.Color(0x6e6248), timber: new THREE.Color(0x5a4430),
};
const SLEEPER_GAP = 0.7;
const BALLAST_Y = 0.36;          // top of the ballast / bottom of the sleepers above the formation

// unit direction of the line at point i (between its neighbours) -> [dx, dz]
function dirAt(L, i) {
  const a = Math.max(0, i - 1), b = Math.min(L.n - 1, i + 1);
  const dx = L.x[b] - L.x[a], dz = L.z[b] - L.z[a], l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

// the track of points i0..i1 of line L (null when it is all inside a tunnel)
export function buildTrackTile(world, L, i0, i1) {
  const G = new GeoBuilder();
  const deep = i => L.tun[i] && L.tun[Math.max(0, i - 3)] && L.tun[Math.min(L.n - 1, i + 4)];
  const crossS = L.cross ? L.cross.s : -1e9, crossHalf = 7.5;
  for (let i = i0; i < i1; i++) {
    if (deep(i) && deep(i + 1)) continue;
    const s0 = i * STEP;
    const onBridge = L.bridge[i] && L.bridge[i + 1];
    const atCross = Math.abs(s0 + STEP / 2 - crossS) < crossHalf;
    const [ax, az] = dirAt(L, i), [bx, bz] = dirAt(L, i + 1);
    const pa = [az, -ax], pb = [bz, -bx];                    // across (horizontal) at both ends
    const xa = L.x[i], za = L.z[i], ya = L.y[i], xb = L.x[i + 1], zb = L.z[i + 1], yb = L.y[i + 1];
    // ballast: a trapezoid along the segment (none on bridges and across the road)
    if (!onBridge && !atCross) {
      const prof = [[-2.7, 0.02], [-1.65, BALLAST_Y], [1.65, BALLAST_Y], [2.7, 0.02]];
      for (let k = 0; k < 3; k++) {
        const [v0, h0] = prof[k], [v1, h1] = prof[k + 1];
        const q0 = [xa + pa[0] * v0, ya + h0, za + pa[1] * v0], q1 = [xa + pa[0] * v1, ya + h1, za + pa[1] * v1];
        const q2 = [xb + pb[0] * v1, yb + h1, zb + pb[1] * v1], q3 = [xb + pb[0] * v0, yb + h0, zb + pb[1] * v0];
        const nx = k === 1 ? 0 : (k === 0 ? -1 : 1) * pa[0] * 0.3, nz = k === 1 ? 0 : (k === 0 ? -1 : 1) * pa[1] * 0.3;
        const nl = Math.hypot(nx, 1, nz);
        G.quad(q0, q1, q2, q3, [nx / nl, 1 / nl, nz / nl], k === 1 ? COL.ballast : COL.ballastDark, 1, 0);
      }
    }
    // sleepers
    if (!atCross) {
      for (let s = Math.ceil(s0 / SLEEPER_GAP) * SLEEPER_GAP; s < s0 + STEP; s += SLEEPER_GAP) {
        const t = (s - s0) / STEP;
        const px = pa[0] + (pb[0] - pa[0]) * t, pz = pa[1] + (pb[1] - pa[1]) * t;
        G.box(xa + (xb - xa) * t, ya + (yb - ya) * t + BALLAST_Y, za + (zb - za) * t, px, 0, pz, 2.6, 0.24, 0.15, COL.sleeper, 0.95, 0, 31);
      }
    }
    // rails (top surfaces a little brighter)
    const sl = Math.hypot(xb - xa, yb - ya, zb - za);
    const tx = (xb - xa) / sl, ty = (yb - ya) / sl, tz = (zb - za) / sl;
    const pm = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
    for (const v of [-GAUGE_X, GAUGE_X]) {
      const cx = (xa + xb) / 2 + pm[0] * v, cz = (za + zb) / 2 + pm[1] * v, cy = (ya + yb) / 2 + RAIL_TOP - 0.15;
      G.box(cx, cy, cz, tx, ty, tz, sl + 0.03, 0.075, 0.13, COL.rail, 0.45, 0.6, 15);
      G.box(cx, cy + 0.13, cz, tx, ty, tz, sl + 0.03, 0.07, 0.02, COL.railTop, 0.3, 0.75, 16);
    }
  }
  return G.empty ? null : G.mesh(false);
}

// buffer stop at end e (0: the first point, 1: the last) of line L: { x, z, dispose }
export function buildBufferStop(world, L, e) {
  const i = e ? L.n - 1 : 0, j = e ? L.n - 2 : 1;
  const dx = L.x[i] - L.x[j], dz = L.z[i] - L.z[j], l = Math.hypot(dx, dz);
  const ux = dx / l, uz = dz / l, px = uz, pz = -ux;                  // outwards, across
  const G = new GeoBuilder();
  const y = L.y[i];
  const x0 = L.x[i] - ux * 1.5, z0 = L.z[i] - uz * 1.5;
  // the frame: two raking struts per rail and the buffer beam with its red and white stripes
  for (const v of [-GAUGE_X, GAUGE_X]) {
    G.box(x0 + px * v, y + BALLAST_Y, z0 + pz * v, ux, 0, uz, 2.4, 0.16, 0.9, COL.timber, 0.9, 0);
    G.box(x0 + px * v - ux * 0.6, y + BALLAST_Y + 0.9, z0 + pz * v - uz * 0.6, ux, 0, uz, 0.3, 0.3, 0.35, COL.timber, 0.9, 0);
  }
  for (let k = 0; k < 5; k++) {
    const v = -1.3 + k * 0.65;
    G.box(x0 - ux * 0.6 + px * v, y + BALLAST_Y + 0.85, z0 - uz * 0.6 + pz * v, px, 0, pz, 0.62, 0.3, 0.45, k % 2 ? COL.white : COL.beam, 0.7, 0);
  }
  // the earth bank behind
  G.box(L.x[i] + ux * 2, y, L.z[i] + uz * 2, ux, 0, uz, 4, 5.5, 1.6, COL.earth, 1, 0);
  G.box(L.x[i] + ux * 2.4, y + 1.6, L.z[i] + uz * 2.4, ux, 0, uz, 2.6, 4.5, 0.6, COL.earth, 1, 0);
  const mesh = G.mesh(true);
  world.scene.add(mesh);
  const ob = world.addObstacle({ x: x0 - ux * 0.6, z: z0 - uz * 0.6, hx: 1.6, hz: 0.5, rot: Math.atan2(ux, uz), y0: y, y1: y + 1.6 });
  return {
    x: L.x[i], z: L.z[i],
    dispose() { world.scene.remove(mesh); mesh.geometry.dispose(); world.removeObstacle(ob); },
  };
}
