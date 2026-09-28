// Endless world: a road running along +Z forever, chunked procedural terrain
// streamed around the player, lakes, forest, settlements and static obstacles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise, fbm, smoothstep, hash, rng } from './noise.js';
import { buildSettlement, SETTLEMENT_NAMES } from './settlements.js';
import { planRiver, carve, buildBridge } from './rivers.js';

export const WATER_LEVEL = 2.0;
export const CHUNK = 128;          // chunk size (m)
export const CSEG = 32;            // cells per chunk side -> 4 m cells, 33*33 verts
export const CELL = CHUNK / CSEG;
export const ROAD_HALF = 4.5;      // road half width (m)
export const SETTLE_LEN = 850;     // road stretch per potential settlement
const SETTLE_OFS = 380;

const dbg = new URLSearchParams(location.search);
const ARENA_H = WATER_LEVEL + 8;         // ground level of the arenas

// analytic terrain features of the tank range: { type, x, z, rot, ... } -> height offset at (x, z)
function feature(f, x, z) {
  const dx = x - f.x, dz = z - f.z;
  const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
  const u = dx * s + dz * c, v = dx * c - dz * s;             // u along the feature's heading, v across
  switch (f.type) {
    case 'hill': { const d = Math.hypot(dx, dz); return d < f.r ? f.h * (Math.cos(Math.PI * d / f.r) + 1) / 2 : 0; }
    case 'pond': { const d = Math.hypot(dx, dz); return d < f.r ? -f.d * (1 - (d / f.r) ** 2) : 0; }
    case 'table': {                                              // ramp up, flat top, ramp down
      if (Math.abs(v) > f.w / 2 + 2) return 0;
      const side = 1 - smoothstep(f.w / 2, f.w / 2 + 2, Math.abs(v));
      const L = f.up + f.top + f.down;
      if (u < 0 || u > L) return 0;
      const k = u < f.up ? u / f.up : u < f.up + f.top ? 1 : 1 - (u - f.up - f.top) / f.down;
      return f.h * k * side;
    }
    case 'ditch': {
      if (Math.abs(u) > f.l / 2) return 0;
      const k = Math.max(0, 1 - (v / (f.w / 2)) ** 2) * (1 - smoothstep(f.l / 2 - 3, f.l / 2, Math.abs(u)));
      return -f.d * k;
    }
    case 'bumps': {
      if (Math.abs(v) > f.w / 2 || u < 0 || u > f.l) return 0;
      return f.a * (0.5 + 0.5 * Math.sin(u * (f.k || 1.1))) * (1 - smoothstep(f.w / 2 - 1.5, f.w / 2, Math.abs(v)));
    }
    default: return 0;
  }
}
const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

const SETTLE_SIZE = {
  gas:     { halfLen: 45,  halfW: 45 },
  repair:  { halfLen: 60,  halfW: 55 },
  village: { halfLen: 120, halfW: 60 },
  town:    { halfLen: 190, halfW: 85 },
};

// broken trees: the tree meshes go into a group clipped by world-space planes (stump below the break, the falling
// top above it); the cut shows the inside of the trunk, so the materials are double-sided copies (one per material)
function clipGroup(planes) {
  const g = new THREE.ClippingGroup();
  g.clippingPlanes = planes;
  g.clipShadows = true;
  return g;
}
const CUT_MATS = new Map();
function cutMaterial(mat) {
  let m = CUT_MATS.get(mat);
  if (!m) { m = mat.clone(); m.side = THREE.DoubleSide; CUT_MATS.set(mat, m); }
  return m;
}

/**
 * @typedef {object} WorldOptions
 * @property {boolean} [rivers]      rivers + bridges (on by default)
 * @property {boolean} [settlements] roadside settlements (on by default)
 * @property {boolean} [road]        the road (on by default)
 * @property {string} [arena]      'duel' | 'range' an enclosed field instead of the endless world
 * @property {{ x0: number, x1: number, z0: number, z1: number }} [bounds]
 * @property {object[]} [plans]      fixed settlements { k, type, z }
 * @property {object[]} [features]   analytic terrain features (hill / table / ditch / bumps / pond)
 * @property {{ x: number, z: number, r: number }[]} [clear] tree-free zones
 * @property {number} [treeDensity]
 */
export class World {
  /** @param {WorldOptions} [opts] */
  constructor(scene, seed = 1337, opts = {}) {
    this.scene = scene;
    this.seed = seed;
    /** @type {WorldOptions} */
    this.opts = { rivers: true, settlements: true, road: true, ...opts };
    this.WATER_LEVEL = WATER_LEVEL;
    this.VIEW = parseInt(dbg.get('view') || '4', 10);   // chunk radius

    this.nBase = makeNoise(seed + 11);
    this.nDetail = makeNoise(seed);
    this.nMount = makeNoise(seed + 40);
    this.nTree = makeNoise(seed + 77);
    this.nTint = makeNoise(seed + 200);
    this.nRoad = makeNoise(seed + 501);
    this.nRoadH = makeNoise(seed + 777);

    this.chunks = new Map();
    this.obstacles = new Set();
    this.settlements = new Map();    // k -> built settlement
    this.settleInfo = new Map();     // k -> plan (or null)
    this.onSettlementBuilt = null;   // callback(s)
    this.onSettlementRemoved = null;
    this.onHouseRuined = null;       // callback(x, y, z, size) for effects
    this.onTreeBroken = null;        // (tree, y, dx, dz): a tree was broken / its stump cut lower (network play)
    this.onHouse = null;             // (kind 'hit' | 'ruin', house record, point, dmg): network play
    this.ruins = new Set();          // ids of destroyed houses (kept across settlement reloads)
    this.brokenTrees = new Map();    // tree id -> { y, dx, dz } (kept across chunk reloads)
    this.logs = [];                  // falling tree tops being animated
    this.riverInfo = new Map();      // gap k -> river plan (or null)
    this.bridges = new Map();        // gap k -> built bridge

    this.makeMaterials();
  }

  // ---------------------------------------------------------------- road
  roadX(z) {
    if (this.opts.arena) return 0;                     // arenas: a straight track along the Z axis
    return 130 * fbm(this.nRoad, z * 0.0011 + 0.37, 3.1, 3) + 12 * this.nRoad(z * 0.005 + 11.3, 7.7);
  }
  roadSlope(z) { return (this.roadX(z + 1) - this.roadX(z - 1)) / 2; }   // dx/dz
  roadHeading(z) { return Math.atan2(this.roadSlope(z), 1); }            // heading (0 = +Z)
  roadH(z) {
    if (this.opts.arena) return ARENA_H;
    return WATER_LEVEL + 6 + 9 * (fbm(this.nRoadH, z * 0.0016 + 2.2, 1.3, 3) + 0.6);
  }

  // ---------------------------------------------------------- settlements
  settlementPlan(k) {
    if (k < 0 || !this.opts.settlements) return null;
    if (this.settleInfo.has(k)) return this.settleInfo.get(k);
    if (this.opts.plans) {                             // arenas: a fixed list of settlements
      const p0 = this.opts.plans.find(p => p.k === k) || null;
      const plan = p0 && { ...SETTLE_SIZE[p0.type], seed: Math.floor(hash(this.seed, k, 1234) * 4294967296), hasCutter: true, hasTorch: true,
        name: SETTLEMENT_NAMES[p0.type][0], ...p0 };
      this.settleInfo.set(k, plan);
      return plan;
    }
    const r = rng(Math.floor(hash(this.seed, k, 991) * 4294967296));
    let type;
    if (k === 0) type = 'village';
    else if (k === 1) type = 'repair';
    else if (r() < 0.15) { this.settleInfo.set(k, null); return null; }
    else {
      const t = r();
      type = t < 0.3 ? 'gas' : t < 0.55 ? 'repair' : t < 0.85 ? 'village' : 'town';
    }
    const z = k * SETTLE_LEN + SETTLE_OFS + r() * 200;
    const names = SETTLEMENT_NAMES[type];
    const plan = {
      k, type, z,
      ...SETTLE_SIZE[type],
      name: names[Math.floor(hash(this.seed, k, 5) * names.length)],
      seed: Math.floor(hash(this.seed, k, 1234) * 4294967296),
      hasCutter: k === 1 || (type === 'repair' && r() < 0.25),
    };
    // spare gas torches (own hash so the rest of the plan stays the same)
    const tr = hash(this.seed, k, 4242);
    plan.hasTorch = type === 'gas' ? tr < 0.5 : type === 'repair' ? tr < 0.6 : type === 'village' ? tr < 0.3 : tr < 0.5;
    this.settleInfo.set(k, plan);
    return plan;
  }

  settlementWeight(x, z, rx) {
    const k0 = Math.floor((z - SETTLE_OFS) / SETTLE_LEN);
    let w = 0;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const s = this.settlementPlan(k);
      if (!s) continue;
      const dz = Math.abs(z - s.z);
      if (dz > s.halfLen + 50) continue;
      const dx = Math.abs(x - rx);
      w = Math.max(w, (1 - smoothstep(s.halfLen, s.halfLen + 50, dz)) *
                      (1 - smoothstep(s.halfW, s.halfW + 50, dx)));
    }
    return w;
  }

  settlementNear(x, z, pad = 0) {
    const k0 = Math.floor((z - SETTLE_OFS) / SETTLE_LEN);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const s = this.settlementPlan(k);
      if (s && Math.abs(z - s.z) < s.halfLen + pad) return s;
    }
    return null;
  }

  // --------------------------------------------------------------- rivers
  riverPlan(k) {
    if (!this.opts.rivers) return null;
    if (!this.riverInfo.has(k)) this.riverInfo.set(k, planRiver(this, k, SETTLE_LEN, SETTLE_OFS));
    return this.riverInfo.get(k);
  }
  // rivers whose channel may reach z
  riversNear(z) {
    const k0 = Math.floor((z - SETTLE_OFS) / SETTLE_LEN);
    const res = [];
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const r = this.riverPlan(k);
      if (r && z > r.zmin && z < r.zmax) res.push(r);
    }
    return res;
  }
  // deck height of a bridge at (x, z) or null
  bridgeAt(x, z) {
    for (const b of this.bridges.values()) {
      if (Math.abs(z - b.cz) > b.L + 12) continue;
      const y = b.deckAt(x, z);
      if (y !== null) return y;
    }
    return null;
  }

  // -------------------------------------------------------------- heights
  naturalHeight(x, z, dr) {
    const nx = x / 800, nz = z / 800;
    let h = 30.0 * fbm(this.nBase, nx * 2.2 + 100, nz * 2.2 + 100, 5) + 14.0;
    h += 18.0 * fbm(this.nDetail, nx * 7.0, nz * 7.0, 4);
    h += 4.0 * fbm(this.nDetail, nx * 18.0 + 7, nz * 18.0 + 7, 3);
    // valley around the road, mountains far away from it
    h *= 0.55 + 0.45 * smoothstep(0, 220, dr);
    const m = smoothstep(240, 560, dr);
    if (m > 0) h += m * (55 + 40 * fbm(this.nMount, nx * 5, nz * 5, 3));
    return Math.max(h, WATER_LEVEL - 3.2);
  }

  // arenas (duel field, tank range): rolling ground inside a rim of hills + analytic features
  arenaHeight(x, z) {
    const o = this.opts;
    let h = ARENA_H;
    if (o.arena === 'duel') {
      h += 5 * fbm(this.nBase, x / 170 + 50, z / 170 + 50, 3) + 2 * fbm(this.nDetail, x / 45, z / 45, 2);
      h += 4 * Math.max(0, 1 - Math.abs(fbm(this.nMount, x / 260 + 9, z / 260 + 9, 2)) * 5);        // ridges
    } else h += 0.5 * fbm(this.nDetail, x / 60, z / 60, 2);
    for (const f of o.features || []) h += feature(f, x, z);
    const b = o.bounds;
    if (b) {
      const ex = Math.max(b.x0 - x, x - b.x1, 0), ez = Math.max(b.z0 - z, z - b.z1, 0);
      const e = Math.hypot(ex, ez);
      if (e > 0) h += smoothstep(0, 90, e) * 55 + 10 * fbm(this.nMount, x / 90, z / 90, 3) * smoothstep(0, 60, e);
    }
    return h;
  }

  height(x, z) {
    if (this.opts.arena) {
      const n = this.arenaHeight(x, z);
      if (!this.opts.road && !this.opts.settlements) return n;
      const dr = Math.abs(x);
      let w = this.opts.road ? 1 - smoothstep(7, 30, dr) : 0;
      const sw = this.settlementWeight(x, z, 0);
      if (sw > w) w = sw;
      return w <= 0 ? n : n + (ARENA_H - n) * w;
    }
    const rx = this.roadX(z);
    const dr = Math.abs(x - rx);
    const n = this.naturalHeight(x, z, dr);
    let w = 1 - smoothstep(7, 45, dr);
    const sw = this.settlementWeight(x, z, rx);
    if (sw > w) w = sw;
    let h = w <= 0 ? n : n + (this.roadH(z) - n) * w;
    for (const r of this.riversNear(z)) h = carve(r, x, z, h, WATER_LEVEL);
    return h;
  }

  // bilinear sample of the loaded chunk grids (falls back to the analytic function)
  heightAt(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    if (this.bridges.size) { const b = this.bridgeAt(x, z); if (b !== null) return b; }
    const ch = this.chunks.get(ckey(cx, cz));
    if (!ch) return this.height(x, z);
    const G = CSEG + 3;
    const gx = (x - ch.x0) / CELL + 1, gz = (z - ch.z0) / CELL + 1;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const hg = ch.hg;
    const i = iz * G + ix;
    return (hg[i] * (1 - fx) + hg[i + 1] * fx) * (1 - fz) +
           (hg[i + G] * (1 - fx) + hg[i + G + 1] * fx) * fz;
  }

  slopeAt(x, z) {
    const d = 1.5;
    const hx = this.heightAt(x + d, z) - this.heightAt(x - d, z);
    const hz = this.heightAt(x, z + d) - this.heightAt(x, z - d);
    return Math.hypot(hx, hz) / (2 * d);
  }

  // line of sight between two points (terrain only)
  lineOfSight(a, b, step = 6) {
    const d = a.distanceTo(b);
    const n = Math.max(2, Math.ceil(d / step));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
      if (this.heightAt(x, z) > y) return false;
    }
    return true;
  }

  // ------------------------------------------------------------ materials
  makeMaterials() {
    const grassTex = new THREE.TextureLoader().load(new URL('../../assets/grass.jpg', import.meta.url).href);
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.colorSpace = THREE.SRGBColorSpace;
    this.terrainMat = new THREE.MeshStandardMaterial({
      map: grassTex, vertexColors: true, roughness: 1.0, metalness: 0.0
    });

    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x3a708f, transparent: true, opacity: 0.85, roughness: 0.25, metalness: 0.1
    });
    if (dbg.get('waterred') === '1') {
      this.waterMat.transparent = false;
      this.waterMat.color.set(0xff0000);
    }

    // packed gravel road with wheel ruts
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#6f675a';
    g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 2200; i++) {
      const v = 70 + Math.random() * 70;
      g.fillStyle = `rgba(${v},${v * 0.94},${v * 0.82},0.55)`;
      g.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    g.fillStyle = 'rgba(40,34,26,0.35)';
    g.fillRect(12, 0, 9, 256);
    g.fillRect(43, 0, 9, 256);
    const edge = g.createLinearGradient(0, 0, 64, 0);
    edge.addColorStop(0, 'rgba(70,90,40,0.6)');
    edge.addColorStop(0.08, 'rgba(70,90,40,0)');
    edge.addColorStop(0.92, 'rgba(70,90,40,0)');
    edge.addColorStop(1, 'rgba(70,90,40,0.6)');
    g.fillStyle = edge;
    g.fillRect(0, 0, 64, 256);
    const roadTex = new THREE.CanvasTexture(c);
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.colorSpace = THREE.SRGBColorSpace;
    roadTex.anisotropy = 4;
    this.roadMat = new THREE.MeshStandardMaterial({
      map: roadTex, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });

    // trees
    this.trunkGeo = new THREE.CylinderGeometry(0.20, 0.32, 2.8, 6);
    this.trunkGeo.translate(0, 1.4, 0);
    this.trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4327, roughness: 1 });
    this.coneGeo = new THREE.ConeGeometry(1.9, 5.0, 7);
    this.coneGeo.translate(0, 4.9, 0);
    this.coneMat = new THREE.MeshStandardMaterial({ color: 0x2e5c2e, roughness: 1 });
    this.cone2Geo = new THREE.ConeGeometry(1.35, 3.4, 7);
    this.cone2Geo.translate(0, 7.5, 0);
    this.cone2Mat = new THREE.MeshStandardMaterial({ color: 0x376b37, roughness: 1 });
    this.birchCrownGeo = new THREE.IcosahedronGeometry(2.1, 0);
    this.birchCrownGeo.scale(1, 1.3, 1);
    this.birchCrownGeo.translate(0, 5.2, 0);
    this.birchCrownMat = new THREE.MeshStandardMaterial({ color: 0x5f8a3a, roughness: 1, flatShading: true });
    this.treeParts = {
      pine: [[this.trunkGeo, this.trunkMat], [this.coneGeo, this.coneMat], [this.cone2Geo, this.cone2Mat]],
      birch: [[this.trunkGeo, this.trunkMat], [this.birchCrownGeo, this.birchCrownMat]],
    };
    // the standing forest of a chunk is one baked mesh (vertex colours, one material for every chunk): one draw call
    // per chunk and one shader for all of them (an InstancedMesh per chunk and part cost a shader build each)
    const bakedPart = (geo, mat) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.deleteAttribute('uv');
      if (mat.flatShading) g.computeVertexNormals();          // non-indexed: faceted like the flat-shaded crowns
      const c = mat.color.clone(), n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.toArray(col, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    this.treeBake = {
      pine: mergeGeometries(this.treeParts.pine.map(([geo, mat]) => bakedPart(geo, mat))),
      birch: mergeGeometries(this.treeParts.birch.map(([geo, mat]) => bakedPart(geo, mat))),
    };
    this.forestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    // fresh cut of a broken trunk
    this.cutGeo = new THREE.CircleGeometry(1, 8);
    this.cutGeo.rotateX(-Math.PI / 2);
    this.cutMat = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 1, side: THREE.DoubleSide });
  }

  // --------------------------------------------------------------- chunks
  update(pos, budgetMs = 6) {
    const pcx = Math.floor(pos.x / CHUNK), pcz = Math.floor(pos.z / CHUNK);
    const V = this.VIEW;
    const need = [];
    for (let dz = -V; dz <= V; dz++) {
      for (let dx = -V; dx <= V; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > (V + 0.5) * (V + 0.5)) continue;
        const cx = pcx + dx, cz = pcz + dz;
        if (!this.chunks.has(ckey(cx, cz))) need.push([d2, cx, cz]);
      }
    }
    need.sort((a, b) => a[0] - b[0]);
    const t0 = performance.now();
    for (const [, cx, cz] of need) {
      this.buildChunk(cx, cz);
      if (performance.now() - t0 > budgetMs) break;
    }
    // unload far chunks
    const lim = (V + 1.5) * (V + 1.5);
    for (const [k, ch] of this.chunks) {
      const dx = ch.cx - pcx, dz = ch.cz - pcz;
      if (dx * dx + dz * dz > lim) this.disposeChunk(k, ch);
    }

    // settlements
    const k0 = Math.floor((pos.z - SETTLE_OFS) / SETTLE_LEN);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const s = this.settlementPlan(k);
      if (s && !this.settlements.has(k) && Math.abs(pos.z - s.z) < 800) {
        const built = buildSettlement(this, s);
        this.settlements.set(k, built);
        if (this.onSettlementBuilt) this.onSettlementBuilt(built);
      }
    }
    // bridges
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const r = this.riverPlan(k);
      if (r && r.bridge && !this.bridges.has(k) && Math.abs(pos.z - r.z) < 900) this.bridges.set(k, buildBridge(this, r));
    }
    for (const [k, b] of this.bridges) if (Math.abs(pos.z - b.cz) > 1300) { b.dispose(); this.bridges.delete(k); }
    for (const [k, s] of this.settlements) {
      if (Math.abs(pos.z - s.plan.z) > 1300) {
        this.scene.remove(s.group);
        for (const o of s.obstacles) this.obstacles.delete(o);
        this.settlements.delete(k);
        if (this.onSettlementRemoved) this.onSettlementRemoved(s);
      }
    }
    return need.length;
  }

  pendingChunks(pos) {
    const pcx = Math.floor(pos.x / CHUNK), pcz = Math.floor(pos.z / CHUNK);
    const V = this.VIEW;
    let n = 0;
    for (let dz = -V; dz <= V; dz++)
      for (let dx = -V; dx <= V; dx++)
        if (dx * dx + dz * dz <= (V + 0.5) * (V + 0.5) && !this.chunks.has(ckey(pcx + dx, pcz + dz))) n++;
    return n;
  }

  disposeChunk(k, ch) {
    for (const m of ch.meshes) {
      this.scene.remove(m);
      if (m.isInstancedMesh) m.dispose();
      if (!m.userData.sharedGeo) m.geometry.dispose();
    }
    // broken trees: stumps and logs (clipping groups sharing the double-sided tree materials)
    for (const g of ch.extra) this.scene.remove(g);
    if (ch.extra.length) this.logs = this.logs.filter(l => l.ch !== ch);
    this.chunks.delete(k);
  }

  buildChunk(cx, cz) {
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const N = CSEG + 1, G = CSEG + 3;
    const hg = new Float32Array(G * G);
    for (let gz = 0; gz < G; gz++) {
      const wz = z0 + (gz - 1) * CELL;
      for (let gx = 0; gx < G; gx++) {
        hg[gz * G + gx] = this.height(x0 + (gx - 1) * CELL, wz);
      }
    }
    const ch = { cx, cz, x0, z0, hg, meshes: [], trees: [], extra: [] };

    // ---- terrain mesh
    const pos = new Float32Array(N * N * 3);
    const nrm = new Float32Array(N * N * 3);
    const col = new Float32Array(N * N * 3);
    const uv = new Float32Array(N * N * 2);
    const c = new THREE.Color();
    const grass = new THREE.Color(0x7aa653);
    const grassDark = new THREE.Color(0x5c8040);
    const dirt = new THREE.Color(0x8a6f47);
    const rock = new THREE.Color(0x8d8d85);
    const snow = new THREE.Color(0xe9edee);
    const sand = new THREE.Color(0xc9bb8a);
    let minH = 1e9;
    for (let iz = 0; iz < N; iz++) {
      const wz = z0 + iz * CELL;
      const rx = this.roadX(wz);
      for (let ix = 0; ix < N; ix++) {
        const wx = x0 + ix * CELL;
        const gi = (iz + 1) * G + ix + 1;
        const h = hg[gi];
        if (h < minH) minH = h;
        const i = iz * N + ix;
        pos[i * 3] = wx; pos[i * 3 + 1] = h; pos[i * 3 + 2] = wz;
        const hl = hg[gi - 1], hr = hg[gi + 1], hd = hg[gi - G], hu = hg[gi + G];
        let nx = hl - hr, ny = 2 * CELL, nz = hd - hu;
        const nl = Math.hypot(nx, ny, nz);
        nrm[i * 3] = nx / nl; nrm[i * 3 + 1] = ny / nl; nrm[i * 3 + 2] = nz / nl;
        uv[i * 2] = wx / 12.5; uv[i * 2 + 1] = wz / 12.5;

        const slope = Math.hypot(hr - hl, hu - hd) / (2 * CELL);
        const tint = 0.92 + 0.16 * (fbm(this.nTint, wx * 0.02, wz * 0.02, 2) * 0.5 + 0.5);
        if (h < WATER_LEVEL + 0.5) c.copy(sand);
        else if (h < 5) c.lerpColors(sand, grassDark, (h - WATER_LEVEL - 0.5) / 2.5);
        else if (h < 22) c.lerpColors(grassDark, grass, (h - 5) / 17);
        else if (h < 34) c.lerpColors(grass, rock, (h - 22) / 12);
        else c.lerpColors(rock, snow, Math.min(1, (h - 34) / 22));
        if (slope > 0.6 && h > WATER_LEVEL + 0.6) c.lerp(rock, Math.min(1, (slope - 0.6) * 2.2));
        const dr = Math.abs(wx - rx);
        if (dr < 10) c.lerp(dirt, 0.55 * (1 - dr / 10));
        const sw = this.settlementWeight(wx, wz, rx);
        if (sw > 0.2) c.lerp(dirt, 0.18 * sw);
        c.multiplyScalar(tint);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
    }
    const idx = new Uint16Array(CSEG * CSEG * 6);
    let k = 0;
    for (let iz = 0; iz < CSEG; iz++) {
      for (let ix = 0; ix < CSEG; ix++) {
        const a = iz * N + ix, b = a + 1, cc = a + N, d = cc + 1;
        idx[k++] = a; idx[k++] = cc; idx[k++] = b;
        idx[k++] = b; idx[k++] = cc; idx[k++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    ch.meshes.push(mesh);

    // ---- water: trimmed sub-quads over cells that are actually under water
    if (minH < WATER_LEVEL && dbg.get('nowater') !== '1') {
      const wPos = [], wIdx = [];
      const sub = 2, ss = CELL / sub;
      const hAt = (lx, lz) => {    // local bilinear inside this chunk grid
        const gx = lx / CELL + 1, gz = lz / CELL + 1;
        const ix = Math.min(G - 2, Math.floor(gx)), iz = Math.min(G - 2, Math.floor(gz));
        const fx = gx - ix, fz = gz - iz;
        const i = iz * G + ix;
        return (hg[i] * (1 - fx) + hg[i + 1] * fx) * (1 - fz) + (hg[i + G] * (1 - fx) + hg[i + G + 1] * fx) * fz;
      };
      for (let iz = 0; iz < CSEG; iz++) {
        for (let ix = 0; ix < CSEG; ix++) {
          const gi = (iz + 1) * G + ix + 1;
          if (Math.min(hg[gi], hg[gi + 1], hg[gi + G], hg[gi + G + 1]) > WATER_LEVEL) continue;
          for (let sz = 0; sz < sub; sz++) {
            for (let sx = 0; sx < sub; sx++) {
              const lx0 = ix * CELL + sx * ss, lz0 = iz * CELL + sz * ss;
              const lx1 = lx0 + ss, lz1 = lz0 + ss;
              if (Math.max(hAt(lx0, lz0), hAt(lx1, lz0), hAt(lx0, lz1), hAt(lx1, lz1)) > WATER_LEVEL) continue;
              const base = wPos.length / 3;
              wPos.push(x0 + lx0, 0, z0 + lz0, x0 + lx1, 0, z0 + lz0, x0 + lx1, 0, z0 + lz1, x0 + lx0, 0, z0 + lz1);
              wIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
            }
          }
        }
      }
      if (wPos.length) {
        const wg = new THREE.BufferGeometry();
        wg.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
        wg.setIndex(wIdx);
        wg.computeVertexNormals();
        const wm = new THREE.Mesh(wg, this.waterMat);
        wm.position.y = dbg.get('watery') ? parseFloat(dbg.get('watery')) : WATER_LEVEL;
        wm.receiveShadow = true;
        this.scene.add(wm);
        ch.meshes.push(wm);
      }
    }

    // ---- road ribbon: segments whose centreline starts inside this chunk
    if (this.opts.road) {
      const rp = [], ru = [], ri = [];
      const STEP = 4;
      for (let j = 0; j < CHUNK / STEP; j++) {
        const za = z0 + j * STEP;
        const rxa = this.roadX(za);
        if (rxa < x0 || rxa >= x0 + CHUNK) continue;
        const zb = za + STEP;
        const base = rp.length / 3;
        for (const z of [za, zb]) {
          const rx = this.roadX(z);
          const s = this.roadSlope(z);
          const l = Math.hypot(1, s);
          const px = 1 / l, pz = -s / l;             // perpendicular (to the +X side)
          // follows the ground down through fords, stays level over bridges
          const bridged = this.riversNear(z).some(r => r.bridge && Math.abs(z - r.z) < r.halfSpan + 4);
          const y = (bridged ? this.roadH(z) : Math.min(this.roadH(z), this.height(rx, z))) + 0.14;
          rp.push(rx + px * ROAD_HALF, y - 0.03, z + pz * ROAD_HALF,
                  rx, y, z,
                  rx - px * ROAD_HALF, y - 0.03, z - pz * ROAD_HALF);
          ru.push(0, z / 10, 0.5, z / 10, 1, z / 10);
        }
        // 2 strips x 2 triangles; verts: a0 a1 a2 (za), b0 b1 b2 (zb)
        for (let s = 0; s < 2; s++) {
          const a = base + s, b = base + 3 + s;
          ri.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      if (rp.length) {
        const rg = new THREE.BufferGeometry();
        rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
        rg.setAttribute('uv', new THREE.Float32BufferAttribute(ru, 2));
        rg.setIndex(ri);
        rg.computeVertexNormals();
        // winding may face down depending on the side; force up-facing normals
        const na = rg.attributes.normal;
        for (let i = 0; i < na.count; i++) if (na.getY(i) < 0) na.setXYZ(i, -na.getX(i), -na.getY(i), -na.getZ(i));
        const rm = new THREE.Mesh(rg, this.roadMat);
        rm.receiveShadow = true;
        this.scene.add(rm);
        ch.meshes.push(rm);
      }
    }

    // ---- forest
    if (dbg.get('notrees') !== '1') this.buildTrees(ch);

    this.chunks.set(ckey(cx, cz), ch);
    return ch;
  }

  buildTrees(ch) {
    const r = rng(Math.floor(hash(this.seed, ch.cx, ch.cz, 31) * 4294967296));
    const MAX = 90;
    const pine = [], birch = [];
    for (let t = 0; t < 260 && pine.length + birch.length < MAX; t++) {
      const x = ch.x0 + r() * CHUNK, z = ch.z0 + r() * CHUNK;
      const rx = this.roadX(z);
      const dr = Math.abs(x - rx);
      if (this.opts.road && dr < 14) continue;
      if (!this.opts.arena && Math.abs(z) < 70 && dr < 60) continue;       // spawn area clear
      if (this.opts.clear && this.opts.clear.some(c => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
      if (this.opts.arena && this.opts.treeDensity !== undefined && r() > this.opts.treeDensity) continue;
      const h = this.heightAt(x, z);
      if (h < WATER_LEVEL + 1.2 || h > 30) continue;
      if (this.slopeAt(x, z) > 0.7) continue;
      if (this.settlementWeight(x, z, rx) > 0.02) continue;
      const density = fbm(this.nTree, x * 0.006, z * 0.006, 3) * 0.5 + 0.5;
      if (r() > density * density * 1.7) continue;
      const s = 0.75 + r() * 0.95;
      const item = { x, z, h, s, rot: r() * Math.PI * 2, sy: 0.85 + r() * 0.5 };
      const list = h < 12 && r() < 0.35 ? birch : pine;
      item.kind = list === pine ? 'pine' : 'birch';
      item.r = 0.38 * s;                           // collision radius
      item.base = h - 0.25;
      item.top = item.base + (list === pine ? 9.2 : 7.9) * s * item.sy;
      item.id = `${ch.cx},${ch.cz},${ch.trees.length}`;
      item.ch = ch;
      list.push(item);
      ch.trees.push(item);
    }
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const n = ch.trees.reduce((a, t) => a + this.treeBake[t.kind].attributes.position.count, 0);
    if (n) {
      // bake the trees of the chunk into one mesh: each tree keeps its vertex range (t.v0, t.nv) to be hidden
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
      const nm = new THREE.Matrix3(), v = new THREE.Vector3();
      let o = 0;
      for (const t of ch.trees) {
        q.setFromAxisAngle(up, t.rot);
        sc.set(t.s, t.s * t.sy, t.s);
        pv.set(t.x, t.base, t.z);
        t.mat = new THREE.Matrix4().compose(pv, q, sc);
        nm.getNormalMatrix(t.mat);
        const g = this.treeBake[t.kind], gp = g.attributes.position, gn = g.attributes.normal, gc = g.attributes.color;
        t.v0 = o; t.nv = gp.count;
        for (let i = 0; i < gp.count; i++, o++) {
          v.fromBufferAttribute(gp, i).applyMatrix4(t.mat).toArray(pos, o * 3);
          v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize().toArray(nor, o * 3);
          col[o * 3] = gc.getX(i); col[o * 3 + 1] = gc.getY(i); col[o * 3 + 2] = gc.getZ(i);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      const forest = new THREE.Mesh(geo, this.forestMat);
      forest.castShadow = true;
      forest.matrixAutoUpdate = false;
      this.scene.add(forest);
      ch.meshes.push(forest);
      ch.forest = forest;
    }
    // trees broken earlier stay broken
    for (const t of ch.trees) {
      const b = this.brokenTrees.get(t.id);
      if (b) {
        this.breakTree(t, b.y, b.dx, b.dz, true);
        if (b.y2 != null) this.cutStump(t, b.y2, b.dx2, b.dz2, true);
      }
    }
  }

  // ---------------------------------------------------------- broken trees
  // take a standing tree out of the chunk's forest mesh (its triangles collapse to a point)
  hideTree(t) {
    const f = t.ch.forest;
    if (!f) return;
    const p = f.geometry.attributes.position, a = p.array;
    const x = a[t.v0 * 3], y = a[t.v0 * 3 + 1], z = a[t.v0 * 3 + 2];
    for (let i = t.v0; i < t.v0 + t.nv; i++) { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }
    p.addUpdateRange(t.v0 * 3, t.nv * 3);
    p.needsUpdate = true;
  }

  // break a tree at height y (world); the top falls towards (dx, dz)
  breakTree(t, y, dx, dz, instant = false) {
    if (!instant && this.onTreeBroken) this.onTreeBroken(t, y, dx, dz);
    if (t.broken) return instant ? undefined : this.cutStump(t, y, dx, dz);
    const ch = t.ch;
    y = Math.max(t.base + 0.3, Math.min(t.top - 1.2, y));
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    t.broken = true;
    t.stumpH = y - t.base;
    this.brokenTrees.set(t.id, { y, dx, dz });
    this.hideTree(t);

    const parts = this.treeParts[t.kind];
    // fresh cut radius (the trunk tapers 0.32 -> 0.20 over its 2.8 m)
    const ly = t.stumpH / (t.s * t.sy);
    const cutR = ly < 2.8 ? (0.32 - 0.12 * ly / 2.8) * t.s : 0;

    // stump: the whole tree clipped below y
    const stump = new THREE.Group();
    const body = clipGroup([new THREE.Plane(new THREE.Vector3(0, -1, 0), y)]);
    stump.add(body);
    for (const [geo, mat] of parts) {
      const m = new THREE.Mesh(geo, cutMaterial(mat));
      m.matrixAutoUpdate = false;
      m.matrix.copy(t.mat);
      m.castShadow = true;
      body.add(m);
    }
    if (cutR) {
      const c = new THREE.Mesh(this.cutGeo, this.cutMat);
      c.position.set(t.x, y + 0.005, t.z);
      c.scale.set(cutR, 1, cutR);
      stump.add(c);
    }
    this.scene.add(stump);
    ch.extra.push(stump);
    t.stumpObj = stump;

    // top: pivots around the break point, clipped above it (plane follows the pivot)
    const top = new THREE.Group();
    top.position.set(t.x, y, t.z);
    const inner = new THREE.Group();
    inner.position.set(-t.x, -y, -t.z);
    top.add(inner);
    const plane = new THREE.Plane();
    inner.add(clipGroup([plane]));
    for (const [geo, mat] of parts) {
      const m = new THREE.Mesh(geo, cutMaterial(mat));
      m.matrixAutoUpdate = false;
      m.matrix.copy(t.mat);
      m.castShadow = true;
      inner.children[0].add(m);
    }
    if (cutR) {
      const c = new THREE.Mesh(this.cutGeo, this.cutMat);
      c.position.y = 0.005;
      c.scale.set(cutR, 1, cutR);
      top.add(c);
    }
    this.scene.add(top);
    ch.extra.push(top);
    const log = { ch, group: top, plane, axis: new THREE.Vector3(dz, 0, -dx), dx, dz,
                  len: t.top - y, ang: 0.04, w: 0.15 };
    if (instant) {
      while (this.stepLog(log, 0.02, true)) { /* settle */ }
    } else this.logs.push(log);
    this.poseLog(log);
    return log;
  }

  // a shot into the stump of a broken tree cuts it lower: the piece between the two cuts is knocked over
  cutStump(t, y, dx, dz, instant = false) {
    const ch = t.ch, oldY = t.base + t.stumpH;
    y = Math.max(t.base + 0.12, Math.min(oldY - 0.25, y));
    if (oldY - y < 0.15 || !t.stumpObj) return null;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    t.stumpH = y - t.base;
    const b = this.brokenTrees.get(t.id);
    if (b) Object.assign(b, { y2: y, dx2: dx, dz2: dz });
    // the old stump goes, a lower one takes its place
    const old = t.stumpObj;
    this.scene.remove(old);
    ch.extra.splice(ch.extra.indexOf(old), 1);
    const parts = this.treeParts[t.kind];
    const ly = t.stumpH / (t.s * t.sy);
    const cutR = ly < 2.8 ? (0.32 - 0.12 * ly / 2.8) * t.s : 0;
    const stump = new THREE.Group();
    const body = clipGroup([new THREE.Plane(new THREE.Vector3(0, -1, 0), y)]);
    stump.add(body);
    for (const [geo, mat] of parts) {
      const m = new THREE.Mesh(geo, cutMaterial(mat));
      m.matrixAutoUpdate = false;
      m.matrix.copy(t.mat);
      m.castShadow = true;
      body.add(m);
    }
    const disc = (grp, py) => {
      if (!cutR) return;
      const c = new THREE.Mesh(this.cutGeo, this.cutMat);
      c.position.set(grp === stump ? t.x : 0, py, grp === stump ? t.z : 0);
      c.scale.set(cutR, 1, cutR);
      grp.add(c);
    };
    disc(stump, y + 0.005);
    this.scene.add(stump);
    ch.extra.push(stump);
    t.stumpObj = stump;
    // the piece that was shot out: between the two cuts, it topples over (a short piece is blown away)
    const len = oldY - y;
    if (instant || len < 0.35) return null;
    const top = new THREE.Group();
    top.position.set(t.x, y, t.z);
    const inner = new THREE.Group();
    inner.position.set(-t.x, -y, -t.z);
    top.add(inner);
    const plane = new THREE.Plane(), plane2 = new THREE.Plane();
    const piece = clipGroup([plane, plane2]);
    inner.add(piece);
    for (const [geo, mat] of parts) {
      const m = new THREE.Mesh(geo, cutMaterial(mat));
      m.matrixAutoUpdate = false;
      m.matrix.copy(t.mat);
      m.castShadow = true;
      piece.add(m);
    }
    disc(top, 0.005);
    this.scene.add(top);
    ch.extra.push(top);
    const log = { ch, group: top, plane, plane2, axis: new THREE.Vector3(dz, 0, -dx), dx, dz,
                  len, ang: 0.08, w: 0.6, drop: true };
    this.logs.push(log);
    this.poseLog(log);
    return log;
  }

  poseLog(log) {
    log.group.quaternion.setFromAxisAngle(log.axis, log.ang);
    log.group.updateMatrixWorld(true);
    log.plane.set(_upV, 0).applyMatrix4(log.group.matrixWorld);
    if (log.plane2) log.plane2.set(_downV, log.len).applyMatrix4(log.group.matrixWorld);
  }

  // advance a falling top; returns false when it lies on the ground
  stepLog(log, dt, quiet = false) {
    if (log.falling) {
      // a piece shot out of a stump: after toppling it drops off the stump onto the ground
      const p = log.group.position;
      log.vy += 9.81 * dt;
      p.y -= log.vy * dt;
      const g = this.heightAt(p.x + log.dx * log.len * 0.5, p.z + log.dz * log.len * 0.5) + 0.22;
      if (p.y <= g) { p.y = g; this.poseLog(log); return false; }
      if (!quiet) this.poseLog(log);
      return true;
    }
    log.w += 1.5 * 9.81 / Math.max(2, log.len) * Math.sin(log.ang) * dt;
    log.ang += log.w * dt;
    const p = log.group.position;
    // tip (and the middle) must stay above the ground
    for (const k of [1, 0.5]) {
      const d = log.len * k * Math.sin(log.ang);
      const tx = p.x + log.dx * d, tz = p.z + log.dz * d;
      const ty = p.y + log.len * k * Math.cos(log.ang);
      if (ty < this.heightAt(tx, tz) + 0.35 * k + 0.2 || log.ang > Math.PI / 2 + 0.25) {
        log.ang -= log.w * dt;
        if (log.drop) {
          log.drop = false;
          log.falling = true;
          log.vy = 0;
          log.ang = Math.PI / 2;
          p.x += log.dx * 0.35; p.z += log.dz * 0.35;
          return true;
        }
        return false;
      }
    }
    if (!quiet) this.poseLog(log);
    return true;
  }

  // animate falling trees
  animate(dt) {
    for (let i = this.logs.length - 1; i >= 0; i--) {
      const log = this.logs[i];
      if (!this.stepLog(log, dt)) {
        this.poseLog(log);
        this.logs.splice(i, 1);
      }
    }
  }

  // segment p0->p1 vs tree trunks (stumps when broken); returns {t, tree} of the nearest hit or null
  raycastTrees(p0, p1) {
    let best = null;
    const dx = p1.x - p0.x, dz = p1.z - p0.z;
    const a = dx * dx + dz * dz;
    if (a < 1e-9) return null;
    this.forTreesNear((p0.x + p1.x) / 2, (p0.z + p1.z) / 2, t => {
      if (t.broken && t.stumpH < 0.6) return;
      const R = 0.45 * t.s;
      const fx = p0.x - t.x, fz = p0.z - t.z;
      const b = fx * dx + fz * dz;
      const c = fx * fx + fz * fz - R * R;
      const disc = b * b - a * c;
      if (disc < 0) return;
      const tt = (-b - Math.sqrt(disc)) / a;
      if (tt < 0 || tt > 1 || (best && tt > best.t)) return;
      const y = p0.y + (p1.y - p0.y) * tt;
      const yTop = t.broken ? t.base + t.stumpH : t.base + (t.top - t.base) * 0.88;
      if (y < t.base || y > yTop) return;
      best = { t: tt, tree: t };
    });
    return best;
  }

  // a tree of a loaded chunk by its id ("cx,cz,i")
  treeById(id) {
    const [cx, cz, i] = id.split(',').map(Number);
    const ch = this.chunks.get(ckey(cx, cz));
    return ch ? ch.trees[i] || null : null;
  }

  // iterate trees around a point
  forTreesNear(x, z, fn) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const fx = x / CHUNK - cx, fz = z / CHUNK - cz;
    const xs = [cx, fx < 0.5 ? cx - 1 : cx + 1], zs = [cz, fz < 0.5 ? cz - 1 : cz + 1];
    for (const a of xs) for (const b of zs) {
      const ch = this.chunks.get(ckey(a, b));
      if (ch) for (const t of ch.trees) fn(t);
    }
  }

  // push a circle (radius r) out of trees; returns true if it touched any.
  // ram = { speed, dx, dz } for a tank: fast enough, it knocks the tree down (sets ram.broke)
  collideTrees(pos, r, ram = null) {
    let hit = false;
    this.forTreesNear(pos.x, pos.z, t => {
      if (t.broken && (ram || t.stumpH < 0.6)) return;     // tanks roll over stumps
      const dx = pos.x - t.x, dz = pos.z - t.z;
      const rr = t.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        if (ram && Math.abs(ram.speed) > 1.2 + t.s * 1.3) {
          this.breakTree(t, t.base + 0.35 + Math.random() * 0.3, ram.dx, ram.dz);
          ram.broke = true;
          ram.size = Math.max(ram.size || 0, t.s);
          return;
        }
        const d = Math.sqrt(d2);
        pos.x = t.x + dx / d * rr;
        pos.z = t.z + dz / d * rr;
        hit = true;
      }
    });
    return hit;
  }

  // ------------------------------------------------------------ obstacles
  // oriented box: centre x,z, half extents hx (local X) / hz (local Z), rotation rot (Y), y0..y1
  addObstacle(o) {
    o.cos = Math.cos(o.rot || 0);
    o.sin = Math.sin(o.rot || 0);
    o.rad = Math.hypot(o.hx, o.hz);
    this.obstacles.add(o);
    return o;
  }
  removeObstacle(o) { this.obstacles.delete(o); }

  // breakFn(o): called on contact with a breakable obstacle (o.house); returns true if it gave way
  collideObstacles(pos, r, breakFn = null) {
    let hit = false;
    for (const o of this.obstacles) {
      if (breakFn && o.house) {
        const tmp = { x: pos.x, y: pos.y, z: pos.z };
        if (pushOut(o, tmp, r) && breakFn(o)) continue;
      }
      if (pushOut(o, pos, r)) hit = true;
    }
    return hit;
  }

  // segment p0->p1 vs obstacle boxes; returns {t, obstacle} of nearest hit or null
  raycastObstacles(p0, p1) {
    let best = null;
    const mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
    const half = Math.hypot(p1.x - p0.x, p1.z - p0.z) / 2;
    for (const o of this.obstacles) {
      const dx = mx - o.x, dz = mz - o.z;
      const lim = o.rad + half;
      if (dx * dx + dz * dz > lim * lim) continue;
      const ax = p0.x - o.x, az = p0.z - o.z;
      const bx = p1.x - o.x, bz = p1.z - o.z;
      const l0x = ax * o.cos - az * o.sin, l0z = ax * o.sin + az * o.cos;
      const l1x = bx * o.cos - bz * o.sin, l1z = bx * o.sin + bz * o.cos;
      const t = segBox(l0x, p0.y, l0z, l1x, p1.y, l1z, -o.hx, o.y0, -o.hz, o.hx, o.y1, o.hz);
      if (t !== null && (!best || t < best.t)) best = { t, obstacle: o };
    }
    return best;
  }
}

const _downV = new THREE.Vector3(0, -1, 0);
const _upV = new THREE.Vector3(0, 1, 0);

// slab test: segment (a->b) vs AABB; returns entry t in [0,1] or null
export function segBox(ax, ay, az, bx, by, bz, minx, miny, minz, maxx, maxy, maxz) {
  let t0 = 0, t1 = 1;
  const d = [bx - ax, by - ay, bz - az];
  const o = [ax, ay, az];
  const mn = [minx, miny, minz], mx = [maxx, maxy, maxz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mn[i] || o[i] > mx[i]) return null;
    } else {
      let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i];
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
  }
  return t0;
}

// push a circle (pos, radius r) out of an oriented box obstacle; returns true on contact
export function pushOut(o, pos, r) {
  const dx = pos.x - o.x, dz = pos.z - o.z;
  const lim = o.rad + r;
  if (dx * dx + dz * dz > lim * lim) return false;
  if (o.y1 !== undefined && pos.y > o.y1 + 0.3) return false;
  const lx = dx * o.cos - dz * o.sin;
  const lz = dx * o.sin + dz * o.cos;
  const cx = Math.max(-o.hx, Math.min(o.hx, lx));
  const cz = Math.max(-o.hz, Math.min(o.hz, lz));
  const ddx = lx - cx, ddz = lz - cz;
  const d2 = ddx * ddx + ddz * ddz;
  let nlx, nlz;
  if (d2 === 0) {
    // centre inside: push out along the axis of least penetration
    const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
    if (px < pz) { nlx = Math.sign(lx || 1) * (o.hx + r); nlz = lz; }
    else { nlx = lx; nlz = Math.sign(lz || 1) * (o.hz + r); }
  } else if (d2 < r * r) {
    const d = Math.sqrt(d2);
    nlx = cx + ddx / d * r;
    nlz = cz + ddz / d * r;
  } else return false;
  pos.x = o.x + nlx * o.cos + nlz * o.sin;
  pos.z = o.z - nlx * o.sin + nlz * o.cos;
  return true;
}
