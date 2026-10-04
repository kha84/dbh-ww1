// Shared toolkit of the settlement structures (houses, church, gas station, repair station, props): unit geometries,
// materials, sign textures and the builder context of one settlement (local frame along the road, parts, obstacles,
// items lying about). Everything built with `K.part` is baked into few meshes afterwards (bakestatic.js).
import * as THREE from 'three';
import { rng } from '../noise.js';
import { difficultyAt, pickTankKey, lootRoll } from '../loot.js';
import { sprayColor } from '../paint.js';

// ---- shared geometry / materials
export const box = new THREE.BoxGeometry(1, 1, 1);
box.translate(0, 0.5, 0);                          // origin at bottom centre
export const roofGeo = (() => {                    // unit gable roof, ridge along Z
  const g = new THREE.BufferGeometry();
  const v = [
    // left slope
    -0.5, 0, -0.5,  0, 1, 0.5,  0, 1, -0.5,
    -0.5, 0, -0.5, -0.5, 0, 0.5,  0, 1, 0.5,
    // right slope
    0.5, 0, -0.5,  0, 1, -0.5,  0, 1, 0.5,
    0.5, 0, -0.5,  0, 1, 0.5,  0.5, 0, 0.5,
    // gables
    -0.5, 0, 0.5,  0.5, 0, 0.5,  0, 1, 0.5,
    -0.5, 0, -0.5,  0, 1, -0.5,  0.5, 0, -0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
export const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
cyl.translate(0, 0.5, 0);
export const halfCyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI);
halfCyl.rotateX(Math.PI / 2);   // axis along Z, dome up
halfCyl.rotateZ(Math.PI / 2);
export const sphere = new THREE.SphereGeometry(0.5, 12, 10);

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
export const MAT = {
  walls: [M(0xe8e2d0), M(0xd8c9a8), M(0x9c7a52), M(0xb7c4c9), M(0xcfb58a), M(0x8f6a45)],
  roofs: [M(0x6e4a38), M(0x4f5d63), M(0x7c3b2e), M(0x5a6b4a), M(0x8a7f70)],
  trims: [M(0xf0efe8), M(0x3f6a8a), M(0x6a8a4a), M(0x8a3a2e)],        // window trims / shutters
  window: M(0x2a3238, { roughness: 0.3, metalness: 0.3 }),
  concrete: M(0x9a9890),
  darkConcrete: M(0x77756f),
  plinth: M(0x6f6a62),
  metal: M(0x6c7378, { metalness: 0.5, roughness: 0.5 }),
  red: M(0xb3302a),
  yellow: M(0xd9b23a),
  wood: M(0x7a5a3a),
  floor: M(0x8a6a48),
  furniture: M(0x5e4430),
  furnitureLight: M(0x9a7a52),
  cloth: [M(0x8a2f2a), M(0x3f5a7a), M(0x6a6a3a), M(0xc8c0a8)],
  whitewash: M(0xe9e6dc),
  crate: M(0x6b5a34),
  green: M(0x4d5a36),
  tire: M(0x1e1e1e),
  barrel: M(0x3f5a3a, { metalness: 0.4 }),
  gold: M(0xd8b04a, { metalness: 0.8, roughness: 0.3 }),
  white: M(0xf0efe8),
  hangar: M(0x7d8a86, { metalness: 0.4, roughness: 0.6 }),
  rubble: M(0x6f675c),
  hole: M(0x16120e, { roughness: 1 }),
  charred: M(0x2e2a26),
};

export function signTexture(title, sub) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ea'; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 88);
  g.fillStyle = '#111'; g.textAlign = 'center';
  g.font = 'bold 30px Arial'; g.fillText(title, 128, 50, 236);
  g.font = '18px Arial'; g.fillText(sub, 128, 78, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function numberTexture(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(240,240,232,.92)';
  g.font = 'bold 110px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(n, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Builder context of one settlement.
 * @typedef {{ x: number, z: number, rot: number }} Frame
 */
export function settlementKit(world, plan) {
  const r = rng(plan.seed);
  const group = new THREE.Group();
  const K = {
    world, plan, r, group,
    obstacles: [], zones: [], items: [], houses: [],
    /** @type {THREE.Mesh[] | null} meshes of the house being built (each house is baked into a mesh of its own) */
    collect: null,
    itemN: 0,
    d: difficultyAt(plan.z),
    // local frame: along = distance along road from plan.z, side offset from centreline (+ = +X side)
    /** @returns {Frame} */
    frame(along, off) {
      const z = plan.z + along;
      const rx = world.roadX(z);
      const s = world.roadSlope(z);
      const l = Math.hypot(1, s);
      return { x: rx + off / l, z: z - off * s / l, rot: Math.atan2(s, 1) };
    },
    groundMin: (x, z, rad) => Math.min(
      world.heightAt(x, z), world.heightAt(x + rad, z), world.heightAt(x - rad, z),
      world.heightAt(x, z + rad), world.heightAt(x, z - rad)),
    groundMax: (x, z, rad) => Math.max(
      world.heightAt(x, z), world.heightAt(x + rad, z), world.heightAt(x - rad, z),
      world.heightAt(x, z + rad), world.heightAt(x, z - rad)),
    // a mesh of geometry geo at world (x, y, z), scaled, turned by rot about Y
    part(geo, mat, x, y, z, sx, sy, sz, rot, shadow = true) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.y = rot;
      m.castShadow = shadow; m.receiveShadow = true;
      group.add(m);
      if (K.collect) K.collect.push(m);
      return m;
    },
    // world position of local offset (lx along the building's X, lz along its Z) in frame f
    at: (f, lx, lz) => ({
      x: f.x + lx * Math.cos(f.rot) + lz * Math.sin(f.rot),
      z: f.z - lx * Math.sin(f.rot) + lz * Math.cos(f.rot),
    }),
    obstacle(f, hx, hz, y0, y1) {
      const o = world.addObstacle({ x: f.x, z: f.z, hx, hz, rot: f.rot, y0, y1 });
      K.obstacles.push(o);
      return o;
    },
    // something lying about (picked up by the player); y: on a floor of a house
    addItem: (type, x, z, extra = {}) => K.items.push({ id: `s${plan.k}:${K.itemN++}`, type, x, z, ...extra }),
    // weapons / cartridges / grenades / kits lying about
    addLoot(x, z, extra = {}) { const it = lootRoll(r, K.d, 1)[0]; K.addItem(it.type, x, z, { ...it, ...extra }); },
    // spray can: half of them in the paint of the machines met around here
    addSpray: (x, z, extra = {}) => K.addItem('spray', x, z, { color: sprayColor(r, pickTankKey(r, K.d)), paint: Math.round(50 + r() * 50), ...extra }),
  };
  return K;
}
/** @typedef {ReturnType<typeof settlementKit>} Kit */
