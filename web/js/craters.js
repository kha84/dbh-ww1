// Shell craters: pits blown into the ground by shells and bombs, deep enough to take cover in (a man walks down
// into one, a tank dips into it). A crater is a profile (bowl + raised lip) added to the terrain:
//  - physics: world.heightAt adds the offset of the craters of the chunk to the sampled height (soldiers, the player,
//    tanks, shells, line of sight all see the pit);
//  - look: the 4 m cells of the terrain chunk under a crater are taken out of its mesh (their triangles collapse) and
//    a finer patch (SUB x SUB per cell) is drawn there with the terrain material; its edges lie exactly on the edges of
//    the cells around, so the ground stays watertight. Fresh earth darkens the pit.
// Craters stay across chunk reloads (and in saves); the oldest go when there are too many.
import * as THREE from 'three';

const SUB = 6;                       // patch vertices per cell side (4 m cells -> 0.67 m)
const MAX = 600;                     // craters kept in the world
const REACH = 1.5;                   // influence radius / crater radius (the lip)
const SOIL = new THREE.Color(0x8a7458), BURNT = new THREE.Color(0x4a4038), LIP = new THREE.Color(0x9a8462);

// height offset of one crater at distance s from its centre: bowl + lip
function profile(c, s) {
  const t = s / c.r;
  if (t >= REACH) return 0;
  let h = 0;
  if (t < 1) h = -c.d * Math.pow(1 - t * t, 1.5);
  const k = (t - 1.02) / 0.24;
  h += c.d * 0.22 * Math.exp(-k * k) * (t < 1.25 ? 1 : 1 - THREE.MathUtils.smoothstep(t, 1.25, REACH));
  return h;
}

export class Craters {
  /**
   * @param {any} world
   * @param {{ CHUNK: number, CSEG: number, CELL: number, WATER_LEVEL: number, ROAD_HALF: number, ckey: (a: number, b: number) => number }} C
   */
  constructor(world, C) {
    this.world = world;
    this.C = C;
    this.list = [];                  // { x, z, r, d }
    this.byChunk = new Map();        // chunk key -> craters reaching into it
    this.onAdded = null;             // (crater): grass / network
  }

  // height offset at (x, z) from the craters of one chunk (list)
  offset(list, x, z) {
    let h = 0;
    for (const c of list) {
      const dx = x - c.x, dz = z - c.z, R = c.r * REACH;
      if (dx * dx + dz * dz < R * R) h += profile(c, Math.sqrt(dx * dx + dz * dz));
    }
    return Math.max(h, -3);
  }
  // offset anywhere (0 where there is no crater)
  at(x, z) {
    const C = this.C;
    const list = this.byChunk.get(C.ckey(Math.floor(x / C.CHUNK), Math.floor(z / C.CHUNK)));
    return list ? this.offset(list, x, z) : 0;
  }

  // chunks a crater reaches into
  keysOf(c) {
    const C = this.C, R = c.r * REACH;
    const res = [];
    for (let cz = Math.floor((c.z - R) / C.CHUNK); cz <= Math.floor((c.z + R) / C.CHUNK); cz++) {
      for (let cx = Math.floor((c.x - R) / C.CHUNK); cx <= Math.floor((c.x + R) / C.CHUNK); cx++) res.push([C.ckey(cx, cz), cx, cz]);
    }
    return res;
  }

  /**
   * A shell / bomb burst on the ground at (x, z): radius r, depth d. Returns the crater or null (road, bridge,
   * water, too shallow there).
   */
  add(x, z, r, d, quiet = false) {
    const W = this.world, C = this.C;
    if (W.opts.road !== false && Math.abs(x - W.roadX(z)) < C.ROAD_HALF + r * 0.7) return null;    // the gravel holds
    if (W.bridges.size && W.bridgeAt(x, z) !== null) return null;
    const h0 = W.heightAt(x, z);
    d = Math.min(d, h0 - C.WATER_LEVEL - 0.15);             // the pit stays dry
    if (d < 0.25) return null;
    // a shell into an old crater digs it a little deeper instead of piling up pits
    for (const o of this.list) {
      if (Math.hypot(o.x - x, o.z - z) < o.r * 0.35 && o.r >= r * 0.8) {
        if (o.d >= 2.2) return null;
        o.d = Math.min(2.2, o.d + d * 0.15);
        this.refresh(o);
        return o;
      }
    }
    const c = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, r: Math.round(r * 100) / 100, d: Math.round(d * 100) / 100 };
    this.list.push(c);
    for (const [k] of this.keysOf(c)) {
      if (!this.byChunk.has(k)) this.byChunk.set(k, []);
      this.byChunk.get(k).push(c);
    }
    while (this.list.length > MAX) this.remove(this.list[0]);
    this.refresh(c);
    // trees standing in the pit are thrown down
    const onT = W.onTreeBroken;
    W.onTreeBroken = null;                               // (both machines of a network game dig the crater themselves)
    W.forTreesNear(x, z, t => {
      if (t.broken) return;
      const dx = t.x - x, dz = t.z - z;
      if (dx * dx + dz * dz < r * r * 0.8) W.breakTree(t, t.base + 0.4, dx || 1, dz);
    });
    W.onTreeBroken = onT;
    if (!quiet && this.onAdded) this.onAdded(c);
    return c;
  }

  remove(c) {
    const i = this.list.indexOf(c);
    if (i >= 0) this.list.splice(i, 1);
    for (const [k] of this.keysOf(c)) {
      const l = this.byChunk.get(k);
      if (!l) continue;
      const j = l.indexOf(c);
      if (j >= 0) l.splice(j, 1);
      if (!l.length) this.byChunk.delete(k);
    }
    this.refresh(c);
  }

  // rebuild the loaded chunks a crater reaches into
  refresh(c) {
    for (const [k] of this.keysOf(c)) {
      const ch = this.world.chunks.get(k);
      if (ch) this.build(ch);
    }
  }

  // a chunk was built: its craters (if any)
  chunkBuilt(ch, key) {
    const l = this.byChunk.get(key);
    ch.craters = l || null;
    if (l) this.build(ch);
  }

  // saved games
  data() { return this.list.map(c => [c.x, c.z, c.r, c.d]); }
  load(arr) {
    for (const [x, z, r, d] of arr || []) {
      const c = { x, z, r, d };
      this.list.push(c);
      for (const [k] of this.keysOf(c)) {
        if (!this.byChunk.has(k)) this.byChunk.set(k, []);
        this.byChunk.get(k).push(c);
      }
    }
  }

  // ------------------------------------------------------------------ chunk mesh
  // take the cells under the craters out of the chunk's terrain mesh and draw the fine patch there
  build(ch) {
    const W = this.world, C = this.C;
    const N = C.CSEG + 1, G = C.CSEG + 3, CELL = C.CELL;
    const list = this.byChunk.get(C.ckey(ch.cx, ch.cz)) || null;
    ch.craters = list;
    // cells reached by a crater
    const cells = new Set();
    for (const c of list || []) {
      const R = c.r * REACH;
      const i0 = Math.max(0, Math.floor((c.x - R - ch.x0) / CELL)), i1 = Math.min(C.CSEG - 1, Math.floor((c.x + R - ch.x0) / CELL));
      const j0 = Math.max(0, Math.floor((c.z - R - ch.z0) / CELL)), j1 = Math.min(C.CSEG - 1, Math.floor((c.z + R - ch.z0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells.add(j * C.CSEG + i);
    }
    // the terrain mesh without those cells (their two triangles collapse onto one vertex)
    const geo = ch.tgeo;
    const idx = geo.index.array;
    let k = 0;
    for (let iz = 0; iz < C.CSEG; iz++) {
      for (let ix = 0; ix < C.CSEG; ix++) {
        const a = iz * N + ix, b = a + 1, cc = a + N, d = cc + 1;
        if (cells.has(iz * C.CSEG + ix)) { for (let q = 0; q < 6; q++) idx[k++] = a; continue; }
        idx[k++] = a; idx[k++] = cc; idx[k++] = b;
        idx[k++] = b; idx[k++] = cc; idx[k++] = d;
      }
    }
    W.batch.terrain.mesh.setGeometryAt(ch.parts.terrain.geoId, geo);
    // the old patch goes
    if (ch.craterMesh) {
      W.scene.remove(ch.craterMesh);
      ch.craterMesh.geometry.dispose();
      ch.meshes.splice(ch.meshes.indexOf(ch.craterMesh), 1);
      ch.craterMesh = null;
    }
    if (!cells.size) return;

    const hg = ch.hg, col = geo.attributes.color.array, nrm = geo.attributes.normal.array;
    const S1 = SUB + 1, nv = cells.size * S1 * S1;
    const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), Co = new Float32Array(nv * 3), UV = new Float32Array(nv * 2);
    const I = new Uint32Array(cells.size * SUB * SUB * 6);
    const tmp = new THREE.Color();
    let v = 0, ii = 0;
    const e = 0.25;
    const off = (x, z) => this.offset(list, x, z);
    for (const cell of cells) {
      const ix = cell % C.CSEG, iz = (cell - ix) / C.CSEG;
      const g = (iz + 1) * G + ix + 1;                       // grid index of corner a (the grid has a 1-cell border)
      const ha = hg[g], hb = hg[g + 1], hc = hg[g + G], hd = hg[g + G + 1];
      const va = iz * N + ix, vb = va + 1, vc = va + N, vd = vc + 1;  // mesh vertices (colours, normals)
      const base = v;
      for (let j = 0; j <= SUB; j++) {
        for (let i = 0; i <= SUB; i++, v++) {
          const fx = i / SUB, fz = j / SUB;
          const x = ch.x0 + (ix + fx) * CELL, z = ch.z0 + (iz + fz) * CELL;
          // the plane of the terrain triangle under the point (the same split as the chunk mesh: b-c diagonal)
          const h = fx + fz <= 1 ? ha + (hb - ha) * fx + (hc - ha) * fz : hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
          const o = off(x, z);
          P[v * 3] = x; P[v * 3 + 1] = h + o; P[v * 3 + 2] = z;
          UV[v * 2] = x / 12.5; UV[v * 2 + 1] = z / 12.5;
          // normal: the smooth one of the terrain, tilted by the slope of the craters
          const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
          let nx = 0, ny = 0, nz = 0, r = 0, gg = 0, bb = 0;
          for (const [vi, w] of [[va, w00], [vb, w10], [vc, w01], [vd, w11]]) {
            nx += nrm[vi * 3] * w; ny += nrm[vi * 3 + 1] * w; nz += nrm[vi * 3 + 2] * w;
            r += col[vi * 3] * w; gg += col[vi * 3 + 1] * w; bb += col[vi * 3 + 2] * w;
          }
          const gx = (off(x + e, z) - off(x - e, z)) / (2 * e), gz = (off(x, z + e) - off(x, z - e)) / (2 * e);
          ny = Math.max(ny, 0.05);
          nx = nx / ny - gx; nz = nz / ny - gz;
          const l = Math.hypot(nx, 1, nz);
          Nn[v * 3] = nx / l; Nn[v * 3 + 1] = 1 / l; Nn[v * 3 + 2] = nz / l;
          // fresh earth in the pit, a scorched middle, thrown-up soil on the lip
          tmp.setRGB(r, gg, bb);
          if (o < 0) {
            const k1 = Math.min(1, -o / 0.35);
            tmp.lerp(SOIL, 0.8 * k1);
            let deep = 0;
            for (const c of list) { const s = Math.hypot(x - c.x, z - c.z) / c.r; if (s < 0.5) deep = Math.max(deep, 1 - s / 0.5); }
            if (deep > 0) tmp.lerp(BURNT, 0.5 * deep);
          } else if (o > 0.01) tmp.lerp(LIP, Math.min(0.6, o / Math.max(0.05, 0.22 * 0.8) * 0.6));
          Co[v * 3] = tmp.r; Co[v * 3 + 1] = tmp.g; Co[v * 3 + 2] = tmp.b;
        }
      }
      for (let j = 0; j < SUB; j++) {
        for (let i = 0; i < SUB; i++) {
          const a = base + j * S1 + i, b = a + 1, c = a + S1, d = c + 1;
          I[ii++] = a; I[ii++] = c; I[ii++] = b;
          I[ii++] = b; I[ii++] = c; I[ii++] = d;
        }
      }
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    pg.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(Co, 3));
    pg.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    pg.setIndex(new THREE.BufferAttribute(I, 1));
    pg.computeBoundingSphere();
    const m = new THREE.Mesh(pg, W.terrainMat);
    m.receiveShadow = true;
    m.name = 'craters';
    W.scene.add(m);
    ch.meshes.push(m);
    ch.craterMesh = m;
  }
}
