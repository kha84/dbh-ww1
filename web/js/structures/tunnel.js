// Tunnel portal where a railway line goes into a hill (railways.js: a cutting deeper than TUNNEL_D): a stone facade
// with the arched opening across the track and the dark mouth behind it (the terrain over the tunnel is left as it
// is, the trains disappear into the darkness).
import * as THREE from 'three';
import { GeoBuilder } from '../bakestatic.js';

const COL = { stone: new THREE.Color(0x837d70), stoneDark: new THREE.Color(0x645f55), dark: new THREE.Color(0x050505), key: new THREE.Color(0x9a9384) };

// p: { i (first / last point inside), dir (+1: the tunnel goes on towards increasing i) }
export function buildPortal(world, L, p) {
  const i = p.i, j = Math.min(L.n - 1, Math.max(0, i + p.dir));
  const dx = L.x[j] - L.x[i], dz = L.z[j] - L.z[i], l = Math.hypot(dx, dz);
  const ux = dx / l, uz = dz / l, px = uz, pz = -ux;                 // into the hill, across
  const x = L.x[i], z = L.z[i], y = L.y[i];
  const G = new GeoBuilder();
  const W2 = 2.7, H = 6.2;                                            // half width / height of the opening
  // facade: piers beside the opening, the wall over it, a coping on top; the arch as stepped blocks
  for (const sd of [-1, 1]) {
    G.box(x + px * sd * (W2 + 2.5), y - 1, z + pz * sd * (W2 + 2.5), px, 0, pz, 5, 1.6, H + 4.5, COL.stone, 0.95, 0);
    G.box(x + px * sd * (W2 + 6.5), y - 1, z + pz * sd * (W2 + 6.5), px, 0, pz, 3.2, 1.4, H + 1.5, COL.stoneDark, 0.95, 0);   // wing walls
  }
  G.box(x, y + H + 1.2, z, px, 0, pz, W2 * 2 + 0.1, 1.6, 2.3, COL.stone, 0.95, 0);
  G.box(x - ux * 0.1, y + H + 3.5, z - uz * 0.1, px, 0, pz, W2 * 2 + 10.5, 1.9, 0.5, COL.stoneDark, 0.95, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k + 0.5) / 6 * Math.PI, r = W2 + 0.1;
    const v = -Math.cos(a) * r, h = H - 1.2 + Math.sin(a) * 1.3;
    G.box(x + px * v - ux * 0.05, y + h, z + pz * v - uz * 0.05, px, 0, pz, 1.05, 1.7, 2.4 - Math.sin(a) * 1.3, k === 2 || k === 3 ? COL.key : COL.stone, 0.95, 0);
  }
  // the dark mouth a little inside (hides the hill behind the opening)
  G.box(x + ux * 1.6, y - 0.5, z + uz * 1.6, px, 0, pz, W2 * 2 + 0.4, 0.3, H + 1.6, COL.dark, 1, 0);
  G.box(x + ux * 0.9, y + H + 0.1, z + uz * 0.9, px, 0, pz, W2 * 2 + 0.4, 1.6, 0.1, COL.dark, 1, 0);
  for (const sd of [-1, 1]) G.box(x + px * sd * (W2 + 0.05) + ux * 0.9, y - 0.5, z + pz * sd * (W2 + 0.05) + uz * 0.9, px, 0, pz, 0.1, 1.6, H + 1.6, COL.dark, 1, 0);
  const mesh = G.mesh(true);
  world.scene.add(mesh);
  const obstacles = [-1, 1].map(sd => world.addObstacle({ x: x + px * sd * (W2 + 4.5), z: z + pz * sd * (W2 + 4.5), hx: 4.5, hz: 0.8, rot: Math.atan2(ux, uz), y0: y - 1, y1: y + H + 3.5 }));
  return {
    x, z,
    dispose() { world.scene.remove(mesh); mesh.geometry.dispose(); for (const o of obstacles) world.removeObstacle(o); },
  };
}
