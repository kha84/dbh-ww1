// Biomes along the endless road: the land changes every 1.3-3.1 km (dense forest, birch groves, fields, steppe,
// swamps, hills, copses with fields), with a smooth transition of ~400 m between two of them. The boundaries run
// across the valley, waved by noise. A biome is a set of numbers (relief, swampiness, fields, tree density / kinds,
// ground and grass colours) - two neighbouring biomes are blended number by number, so the height, the colours and
// the forest change gradually. world.biomeAt(x, z) gives the (blended) parameters at a point.
import * as THREE from 'three';
import { smoothstep, hash, rng } from './noise.js';

export const BIOME_LEN = 2200;                 // mean length of a biome along the road (m)
const JITTER = 900;                            // boundaries move +-JITTER/2 around i * BIOME_LEN
const TRANS = 210;                             // half width of the transition between two biomes

/**
 * relief: rolling ground amplitude, hills: extra hills, mount: the mountains far from the road (x),
 * wet: swamp (ground pulled down to the water: pools, hummocks), fields: share of the field patchwork near the road,
 * trees: tree probability (x), treeFill: added to the forest noise (forest everywhere), treeS: tree size (x),
 * pine / birch / oak / bush: shares of the tree kinds, grass / grassDark / shore: ground colours as seen (the ground
 * texture is hue-neutral; low ground is grassDark, the water's edge shore), tuft: grass tuft tint, tuftN: share of the tufts kept, tuftS: tuft size,
 * rivers: chance of a river in a gap between settlements, riverW: river width (x)
 */
const DEFS = {
  mixed:  { name: 'Перелески',      relief: 1,    hills: 0,   mount: 1,   wet: 0, fields: 0.25, trees: 0.7,  treeFill: 0,    treeS: 1,
            pine: 0.6, birch: 0.35, oak: 0.08, bush: 0.12, grass: 0x6fae39, grassDark: 0x54862b, shore: 0xbdb070,
            tuft: [1, 1, 1], tuftN: 1, tuftS: 1, rivers: 0.5, riverW: 1 },
  forest: { name: 'Густой лес',     relief: 1.1,  hills: 0.25, mount: 1,  wet: 0, fields: 0,    trees: 1.4,  treeFill: 0.42, treeS: 1.12,
            pine: 0.85, birch: 0.12, oak: 0.05, bush: 0.18, grass: 0x629830, grassDark: 0x456e22, shore: 0x9d9466,
            tuft: [0.9, 0.95, 0.85], tuftN: 0.55, tuftS: 0.9, rivers: 0.45, riverW: 0.8 },
  birch:  { name: 'Берёзовые рощи', relief: 0.8,  hills: 0,   mount: 0.8, wet: 0, fields: 0.12, trees: 0.95, treeFill: 0.08, treeS: 1,
            pine: 0.1, birch: 0.9, oak: 0.05, bush: 0.2, grass: 0x7bbc3e, grassDark: 0x5d9933, shore: 0xbdb070,
            tuft: [1.05, 1.1, 0.9], tuftN: 1, tuftS: 1.15, rivers: 0.5, riverW: 0.9 },
  fields: { name: 'Поля',           relief: 0.55, hills: 0,   mount: 0.5, wet: 0, fields: 1,    trees: 0.45, treeFill: 0,    treeS: 1,
            pine: 0.2, birch: 0.35, oak: 0.45, bush: 0.35, grass: 0x79b33b, grassDark: 0x5a922e, shore: 0xb8ac74,
            tuft: [1.05, 1.05, 0.95], tuftN: 1, tuftS: 1, rivers: 0.5, riverW: 1.1 },
  steppe: { name: 'Степь',          relief: 0.3,  hills: 0.12, mount: 0.2, wet: 0, fields: 0.1, trees: 0.07, treeFill: 0,    treeS: 0.85,
            pine: 0, birch: 0.1, oak: 0.3, bush: 1, grass: 0xcbbb74, grassDark: 0xb0a560, shore: 0xd2c08a,
            tuft: [1.35, 1.12, 0.62], tuftN: 1, tuftS: 1.3, rivers: 0.3, riverW: 1.5 },
  swamp:  { name: 'Болота',         relief: 0.25, hills: 0,   mount: 0.4, wet: 1, fields: 0,    trees: 0.9,  treeFill: 0.12, treeS: 0.7,
            pine: 0.3, birch: 0.55, oak: 0, bush: 0.5, grass: 0x6f9440, grassDark: 0x627f36, shore: 0x6e6a40,
            tuft: [0.85, 0.95, 0.68], tuftN: 1, tuftS: 1.45, rivers: 0.75, riverW: 1.4 },
  hills:  { name: 'Холмы',          relief: 1.2,  hills: 1,   mount: 1.2, wet: 0, fields: 0.08, trees: 0.6,  treeFill: 0,    treeS: 1,
            pine: 0.5, birch: 0.25, oak: 0.3, bush: 0.3, grass: 0x74b13b, grassDark: 0x568a2d, shore: 0xaaa070,
            tuft: [1, 1.02, 0.95], tuftN: 1, tuftS: 1, rivers: 0.55, riverW: 0.75 },
};
const NUM = ['relief', 'hills', 'mount', 'wet', 'fields', 'trees', 'treeFill', 'treeS', 'pine', 'birch', 'oak', 'bush',
  'tuftN', 'tuftS', 'rivers', 'riverW'];
const COL = ['grass', 'grassDark', 'shore', 'tuft'];

/** @typedef {{ key: string, name: string, grass: number[], grassDark: number[], shore: number[], tuft: number[] } & Record<string, any>} Biome */
/** @type {Record<string, Biome>} */
export const BIOMES = {};
const _c = new THREE.Color();
for (const [key, d] of Object.entries(DEFS)) {
  /** @type {Biome} */
  const b = /** @type {any} */ ({ ...d, key });
  for (const k of ['grass', 'grassDark', 'shore']) b[k] = _c.set(d[k]).toArray();     // linear (as THREE.Color)
  BIOMES[key] = b;
}
// the arenas: the old copse land, no fields
BIOMES.arena = { ...BIOMES.mixed, key: 'arena', fields: 0, trees: 1 };
// a biome between A and B (w: share of B); same property order as the BIOMES entries
function mix(A, B, w) {
  const o = /** @type {Biome} */ ({ ...A });
  for (const k of NUM) o[k] = A[k] + (B[k] - A[k]) * w;
  for (const k of COL) o[k] = A[k].map((a, n) => a + (B[k][n] - a) * w);
  return o;
}
const ORDER = ['mixed', 'forest', 'birch', 'fields', 'steppe', 'swamp', 'hills'];
const WEIGHT = { mixed: 0.9, forest: 1.1, birch: 0.8, fields: 1.2, steppe: 0.9, swamp: 0.8, hills: 1 };

// crops of the field patchwork: ground colour, grass tufts on it (null: ploughed, bare), tuft size
export const CROPS = [
  { name: 'пшеница', col: _c.set(0xe8c858).toArray(), tuft: [1.6, 1.2, 0.42], tuftS: 1.55 },
  { name: 'рожь',    col: _c.set(0xd2bc78).toArray(), tuft: [1.4, 1.15, 0.65], tuftS: 1.4 },
  { name: 'пашня',   col: _c.set(0x7a5c3e).toArray(), tuft: null, tuftS: 0 },
  { name: 'всходы',  col: _c.set(0x86c04a).toArray(), tuft: [1.05, 1.2, 0.75], tuftS: 0.75 },
  { name: 'стерня',  col: _c.set(0xccb680).toArray(), tuft: [1.3, 1.08, 0.7], tuftS: 0.5 },
  { name: 'гречиха', col: _c.set(0xa88a76).toArray(), tuft: [1.25, 0.95, 0.85], tuftS: 0.9 },
];
const FIELD_W = 80, FIELD_L = 120, VERGE = 22, FARM = 460;   // field size across / along the road, from / to the road

export class Biomes {
  /** @param {number} seed  @param {(x: number, y: number) => number} noise  @param {string|null} [force] one biome everywhere */
  constructor(seed, noise, force = null) {
    this.seed = seed;
    this.noise = noise;
    this.force = force && BIOMES[force] ? force : null;
    this.types = ['mixed'];
    this.start = [];                              // bound(i) of the segments i >= -8 (index i + 8), filled in order
    this.biome = [];                              // their BIOMES entries
    this.mixes = [];                              // blends at boundary i (index (i + 8) * 2 + side) by quantized weight
    this.field = { crop: -1, edge: false, line: false };
  }

  // biome of segment i (the first one is the copses the game always started in)
  type(i) {
    if (this.force) return this.force;
    if (i <= 0) return 'mixed';
    while (this.types.length <= i) {
      const n = this.types.length;
      const r = rng(Math.floor(hash(this.seed, n, 6007) * 4294967296));
      const prev = this.types.slice(-2);
      const cand = ORDER.filter(k => !prev.includes(k));
      let sum = 0;
      for (const k of cand) sum += WEIGHT[k];
      let x = r() * sum, pick = cand[cand.length - 1];
      for (const k of cand) if ((x -= WEIGHT[k]) < 0) { pick = k; break; }
      this.types.push(pick);
    }
    return this.types[i];
  }
  // where segment i starts (along the waved z)
  bound(i) {
    if (i < -8) return i * BIOME_LEN;
    while (this.start.length <= i + 8) {
      const n = this.start.length - 8;
      this.start.push(n * BIOME_LEN + (hash(this.seed, n, 313) - 0.5) * JITTER);
      this.biome.push(BIOMES[this.type(n)]);
    }
    return this.start[i + 8];
  }

  /** parameters at (x, z): a BIOMES entry or the blend of two (shared objects: read only) */
  at(x, z) {
    if (this.force) return BIOMES[this.force];
    const zz = z + 170 * this.noise(x * 0.0021 + 5.3, z * 0.0006 + 1.1);
    if (zz < 1000) return BIOMES.mixed;           // segments <= 0 (bound(1) >= 1750)
    let i = Math.floor(zz / BIOME_LEN);
    this.bound(i + 2);                            // the table reaches i + 2
    const S = this.start;
    if (zz < S[i + 8]) i--; else if (zz >= S[i + 9]) i++;
    const d0 = zz - S[i + 8], d1 = S[i + 9] - zz;
    let j = i, w = 0;
    if (d0 < TRANS && d0 <= d1) { j = i - 1; w = 0.5 * (1 - smoothstep(0, TRANS, d0)); }
    else if (d1 < TRANS) { j = i + 1; w = 0.5 * (1 - smoothstep(0, TRANS, d1)); }
    const A = this.biome[i + 8];
    if (w <= 0) return A;
    const B = this.biome[j + 8];
    if (A === B) return A;
    // the blend is remembered per boundary and weight step (256 steps over the transition: < 0.1 m in height)
    const q = Math.round(w * 512), mi = Math.max(0, i + 8) * 2 + (j > i ? 1 : 0);
    const arr = this.mixes[mi] || (this.mixes[mi] = new Array(257).fill(null));
    return arr[q] || (arr[q] = mix(A, B, q / 512));
  }

  /**
   * the field patchwork beside the road: u = x - roadX(z) (offset across the road). Returns a shared object
   * { crop: index into CROPS or -1 (no field here), edge: on the strip between two fields, line: that strip has a
   * tree line }; `share` = biome fields (the chance that a field cell is there)
   */
  fieldAt(u, z, share) {
    const f = this.field;
    f.crop = -1; f.edge = false; f.line = false;
    const a = Math.abs(u) - VERGE;
    if (share <= 0 || a < 0 || a > FARM) return f;
    const side = u < 0 ? 1 : 2;
    const iu = Math.floor(a / FIELD_W), fu = a - iu * FIELD_W;
    const zs = z + hash(this.seed, iu, side, 41) * FIELD_L;
    const iz = Math.floor(zs / FIELD_L), fz = zs - iz * FIELD_L;
    const s = this.seed;
    if (hash(s, iu * 3 + side, iz, 97) >= share * (1 - 0.6 * smoothstep(FARM - 160, FARM, a))) return f;
    const eu = Math.min(fu, FIELD_W - fu), ez = Math.min(fz, FIELD_L - fz);
    if (Math.min(eu, ez) < 3) {
      f.edge = true;
      f.line = eu < ez ? hash(s, iu + (fu > FIELD_W / 2 ? 1 : 0), side, iz, 53) < 0.45
                       : hash(s, iu, side, iz + (fz > FIELD_L / 2 ? 1 : 0), 59) < 0.4;
      return f;
    }
    const h = hash(s, iu * 3 + side, iz, 17);
    if (h < 0.18) return f;                                   // meadow
    f.crop = Math.min(CROPS.length - 1, Math.floor((h - 0.18) / 0.82 * CROPS.length));
    return f;
  }
}
