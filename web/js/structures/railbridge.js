// Rail bridge over a river (railways.js finds where a line needs one): plate girders on stone piers, a through truss
// for the long spans, a deck with railings; walkable ground through world.bridges (deckAt), the railings / truss
// sides are obstacles. The track itself (sleepers, rails) comes with the track tiles.
import * as THREE from 'three';
import { GeoBuilder } from '../bakestatic.js';
import { STEP } from '../railways.js';

const COL = {
  steel: new THREE.Color(0x4c5558), steelDark: new THREE.Color(0x353b3d), deck: new THREE.Color(0x5b5048),
  stone: new THREE.Color(0x8a857a), stoneDark: new THREE.Color(0x6d695f),
};
const DECK = 0.33;              // deck plate under the sleepers (above the formation level)

export function buildRailBridge(world, L, br) {
  const G = new GeoBuilder();
  const { i0, i1 } = br;
  const truss = (i1 - i0) * STEP > 35;
  const WL = world.WATER_LEVEL;
  const across = i => {
    const a = Math.max(0, i - 1), b = Math.min(L.n - 1, i + 1);
    const dx = L.x[b] - L.x[a], dz = L.z[b] - L.z[a], l = Math.hypot(dx, dz);
    return [dz / l, -dx / l];
  };
  for (let i = i0; i < i1; i++) {
    const xa = L.x[i], za = L.z[i], ya = L.y[i], xb = L.x[i + 1], zb = L.z[i + 1], yb = L.y[i + 1];
    const sl = Math.hypot(xb - xa, yb - ya, zb - za);
    const tx = (xb - xa) / sl, ty = (yb - ya) / sl, tz = (zb - za) / sl;
    const [px, pz] = across(i);
    const cx = (xa + xb) / 2, cz = (za + zb) / 2, cy = (ya + yb) / 2;
    G.box(cx, cy + DECK - 0.06, cz, tx, ty, tz, sl + 0.02, 4.8, 0.06, COL.deck, 0.95, 0);                    // deck plate
    for (const v of [-0.95, 0.95]) G.box(cx + px * v, cy + DECK - 1.36, cz + pz * v, tx, ty, tz, sl + 0.02, 0.3, 1.3, COL.steel, 0.55, 0.55);
    G.box(cx, cy + DECK - 0.5, cz, px, 0, pz, 2.2, 0.18, 0.3, COL.steelDark, 0.6, 0.5);                         // cross girder
    if (truss) {
      const H = 5.6;
      for (const v of [-2.55, 2.55]) {
        const ox = px * v, oz = pz * v;
        G.box(cx + ox, cy + DECK, cz + oz, tx, ty, tz, sl + 0.05, 0.35, 0.45, COL.steel, 0.55, 0.55);             // bottom chord
        G.box(cx + ox, cy + DECK + H, cz + oz, tx, ty, tz, sl + 0.05, 0.4, 0.4, COL.steel, 0.55, 0.55);           // top chord
        G.box(xa + ox, ya + DECK, za + oz, tx, 0, tz, 0.3, 0.3, H, COL.steel, 0.55, 0.55);                        // vertical
        const up = (i - i0) % 2 ? 1 : -1;                                                                        // diagonal
        const dl = Math.hypot(sl, H), dy = H / dl * 1, dh = sl / dl;
        G.box(cx + ox, cy + DECK + H / 2 - 0.15, cz + oz, tx * dh * up, dy, tz * dh * up, dl, 0.22, 0.3, COL.steelDark, 0.55, 0.55);
      }
      G.box(xa, ya + DECK + H, za, px, 0, pz, 5.4, 0.25, 0.3, COL.steelDark, 0.6, 0.5);                           // top bracing
    } else {
      for (const v of [-2.3, 2.3]) {                                                                               // railings
        G.box(cx + px * v, cy + DECK + 1.0, cz + pz * v, tx, ty, tz, sl + 0.02, 0.08, 0.08, COL.steel, 0.55, 0.55);
        G.box(xa + px * v, ya + DECK, za + pz * v, tx, 0, tz, 0.1, 0.1, 1.1, COL.steel, 0.55, 0.55);
      }
    }
    // piers every 20 m (not at the ends: the abutments)
    if ((i - i0) % 4 === 0 && i > i0) {
      const ground = Math.min(world.height(xa, za), WL - 0.5);
      const top = ya + DECK - 1.36, h = top - ground + 0.8;
      if (h > 0.5) {
        G.box(xa, ground - 0.8, za, px, 0, pz, 5.4, 2.4, h, COL.stoneDark, 0.95, 0);
        G.box(xa, ground - 0.8, za, px, 0, pz, 6.2, 3.2, Math.min(h, WL - ground + 1.2), COL.stone, 0.95, 0);
      }
    }
  }
  for (const i of [i0, i1]) {                                                                                     // abutments
    const [px, pz] = across(i);
    const ground = world.height(L.x[i], L.z[i]);
    const h = L.y[i] + DECK - ground + 2;
    if (h > 0.3) G.box(L.x[i], ground - 2, L.z[i], px, 0, pz, 6, 3, h, COL.stone, 0.95, 0);
  }
  const mesh = G.mesh(true);
  world.scene.add(mesh);
  // the deck as ground, the sides as obstacles (a straight chord between the ends)
  const ax = L.x[i0], az = L.z[i0], bx = L.x[i1], bz = L.z[i1];
  const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
  const cx = (ax + bx) / 2, cz = (az + bz) / 2, rot = Math.atan2(ux, uz);
  const ymid = (L.y[i0] + L.y[i1]) / 2;
  const obstacles = [];
  for (const v of truss ? [-2.75, 2.75] : [-2.45, 2.45]) {
    obstacles.push(world.addObstacle({ x: cx + uz * v, z: cz - ux * v, hx: 0.2, hz: len / 2, rot, y0: ymid - 1, y1: ymid + (truss ? 6.5 : 1.6) }));
  }
  return {
    cx, cz, L: len / 2 + 5, rail: true, mesh,
    deckAt(x, z) {
      const rx = x - ax, rz = z - az;
      const u = rx * ux + rz * uz, v = rx * uz - rz * ux;
      if (u < 0 || u > len || Math.abs(v) > 2.4) return null;
      const f = i0 + (i1 - i0) * u / len, i = Math.min(i1 - 1, Math.floor(f));
      return L.y[i] + (L.y[i + 1] - L.y[i]) * (f - i) + DECK + 0.17;
    },
    dispose() {
      world.scene.remove(mesh);
      mesh.geometry.dispose();
      for (const o of obstacles) world.removeObstacle(o);
    },
  };
}
