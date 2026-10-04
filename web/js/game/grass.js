// Grass: tufts of blades around the player in one instanced draw call. The ground around is cut into 32 m tiles;
// the 5 x 5 tiles around the player are filled (deterministically, from the world seed) when the player moves on to
// another tile. Every tuft carries its world position, size, turn and tint; the vertex shader places it, sways the
// blades in the wind (tips move, roots stay) and shrinks the tufts towards the edge of the grass so they fade in.
// The biome (biomes.js) tints them (yellow steppe, dark swamp sedge) and sets their size / density; on the fields
// they are the crop (ripe wheat, rye, shoots), the ploughland is bare.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, vec3, float, sin, cos, time, instanceIndex, cameraPosition, smoothstep, uniform, transformNormalToView } from 'three/tsl';
import { hash } from '../noise.js';
import { WATER_LEVEL } from '../world.js';
import { CROPS } from '../biomes.js';

const TILE = 32, SPAN = 2;                    // tiles of 32 m, 2 around the player's tile
const PER_TILE = [0, 420, 900];               // tufts per tile by level (quality: none / medium / high)

// one tuft: five thin blades leaning out a little, darker at the root
function tuftGeometry() {
  const pos = [], col = [], nrm = [];
  const root = new THREE.Color(0x5c7a3a), tip = new THREE.Color(0xa8c860);
  for (let b = 0; b < 5; b++) {
    const a = b / 5 * Math.PI * 2 + b * 0.7, r = 0.06 + (b % 2) * 0.05;
    const h = 0.45 + (b % 3) * 0.15, w = 0.045;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, lx = Math.cos(a) * 0.12, lz = Math.sin(a) * 0.12;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + lx, h, cz + lz);
    for (const c of [root, root, tip]) col.push(c.r, c.g, c.b);
    for (let k = 0; k < 3; k++) nrm.push(0, 1, 0);               // lit like the ground under it
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/**
 * @param {THREE.Scene} scene
 * @param {any} world
 */
export function createGrass(scene, world) {
  const MAX = PER_TILE[2] * (2 * SPAN + 1) ** 2;
  const geo = tuftGeometry();
  const at = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);     // x, y, z, size
  const tw = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);     // turn, tint rgb
  geo.setAttribute('tuft', at);
  geo.setAttribute('turn', tw);
  const radius = uniform(TILE * (SPAN + 0.5));

  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 1, side: THREE.DoubleSide });   // colour: colorNode
  {
    const p = attribute('tuft', 'vec4'), t = attribute('turn', 'vec4');
    const lp = positionLocal;
    // fade in: tufts shrink towards the edge of the grass around the player
    const d = cameraPosition.xz.sub(p.xz).length();
    const size = p.w.mul(smoothstep(radius, radius.mul(0.7), d));
    const c = cos(t.x), s = sin(t.x);
    const local = vec3(lp.x.mul(c).sub(lp.z.mul(s)), lp.y, lp.x.mul(s).add(lp.z.mul(c))).mul(size);
    // wind: the tips sway, each tuft a little out of step
    const k = lp.y.mul(lp.y).mul(2.2);
    const ph = time.mul(1.9).add(float(instanceIndex).mul(0.61)).add(p.x.mul(0.07));
    const sway = vec3(sin(ph).mul(0.09), float(0), cos(ph.mul(0.8)).mul(0.06)).mul(k).mul(size);
    mat.positionNode = p.xyz.add(local).add(sway);
    mat.colorNode = attribute('color', 'vec3').mul(t.yzw);
    mat.normalNode = transformNormalToView(vec3(0, 1, 0));     // both faces lit like the ground under the tuft
  }
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // every tile has its own block of tufts in the buffers (a ring over the 5 x 5 tiles): moving on refills only the
  // tiles that came into range; tufts that fall on the road, water or a settlement get size 0
  const N = 2 * SPAN + 1;
  let level = 0, tx = null, tz = null;
  const held = new Map();                          // block -> "X,Z" of the tile in it
  const mod = (a, n) => ((a % n) + n) % n;
  function fillTile(X, Z) {
    const per = PER_TILE[level], block = mod(X, N) + mod(Z, N) * N, key = X + ',' + Z;
    if (held.get(block) === key) return false;
    held.set(block, key);
    const base = block * per;
    for (let i = 0; i < per; i++) {
      const x = (X + hash(world.seed, X * 7 + i, Z, 71)) * TILE, z = (Z + hash(world.seed, X, Z * 7 + i, 73)) * TILE;
      const rx = world.roadX(z);
      const h = world.heightAt(x, z);
      const B = world.biomeAt(x, z);
      let tint = B.tuft, size = B.tuftS;
      const r = hash(world.seed, i, X * 31 + Z, 79);
      let bare = (world.opts.road && Math.abs(x - rx) < 5.5) || h < WATER_LEVEL + 0.35 - 0.25 * B.wet || h > 26 + 10 * B.hills ||
        world.settlementWeight(x, z, rx) > 0.4 || hash(world.seed, i, X, Z * 5 + 3, 89) > B.tuftN;
      if (!bare && B.fields > 0) {
        const f = world.fieldAt(x, z, rx, B.fields);
        if (f.crop >= 0) { const c = CROPS[f.crop]; tint = c.tuft; size = c.tuftS; bare = !tint; }
      }
      const v = 0.8 + 0.35 * hash(world.seed, i, Z * 17 + X, 83);
      at.setXYZW(base + i, x, h - 0.03, z, bare ? 0 : (0.45 + r * 0.5) * size);
      if (!bare) tw.setXYZW(base + i, r * 6.283, tint[0] * v, tint[1] * v, tint[2] * v);
    }
    at.addUpdateRange(base * 4, per * 4);
    tw.addUpdateRange(base * 4, per * 4);
    return true;
  }
  function fill() {
    at.clearUpdateRanges(); tw.clearUpdateRanges();
    let changed = false;
    for (let dz = -SPAN; dz <= SPAN; dz++) for (let dx = -SPAN; dx <= SPAN; dx++) changed = fillTile(tx + dx, tz + dz) || changed;
    mesh.count = PER_TILE[level] * N * N;
    if (changed) { at.needsUpdate = true; tw.needsUpdate = true; }
  }
  return {
    mesh,
    /** 0: no grass, 1: medium, 2: dense */
    setLevel(l) {
      if (l !== level) held.clear();
      level = l;
      mesh.visible = l > 0;
      tx = tz = null;
    },
    update(anchor) {
      if (!level) return;
      const X = Math.floor(anchor.x / TILE), Z = Math.floor(anchor.z / TILE);
      if (X === tx && Z === tz) return;
      tx = X; tz = Z;
      fill();
    },
  };
}
