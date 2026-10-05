// The forest: trees of a chunk baked into one mesh (drawn through the world's forest batch), trees broken by shells /
// knocked down by tanks (stump + a falling top, clipped copies of the tree meshes), stumps cut lower by shots, and the
// tests against trunks (shell rays, pushing things out of the trees).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash, rng, fbm } from '../noise.js';

/** @typedef {import('../world.js').World} World */

const WATER_LEVEL = 2.0;                                          // world.js constants (no import cycle)
const CHUNK = 128;
const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);     // as in world.js
const _downV = new THREE.Vector3(0, -1, 0);
const _upV = new THREE.Vector3(0, 1, 0);

// broken trees: the tree meshes go into a group clipped by world-space planes (stump below the break, the falling
// top above it); the cut shows the inside of the trunk, so the materials are double-sided copies (one per material)
// tree kinds: height of the top (x size), trunk thickness (x size: collisions, shell hits, ramming), trunk taper
// r0 -> r1 over th (the fresh cut)
const KINDS = {
  pine:  { top: 9.2, girth: 1,    r0: 0.32, r1: 0.20, th: 2.8 },
  birch: { top: 7.9, girth: 1,    r0: 0.32, r1: 0.20, th: 2.8 },
  oak:   { top: 7.9, girth: 1.35, r0: 0.42, r1: 0.26, th: 3.4 },
  bush:  { top: 2.2, girth: 0.3,  r0: 0.10, r1: 0.06, th: 0.9 },
};
// radius of the cut through the trunk of tree t at height ly above its base (0 above the trunk)
function cutRadius(t, stumpH) {
  const k = KINDS[t.kind], ly = stumpH / (t.s * t.sy);
  return ly < k.th ? (k.r0 - (k.r0 - k.r1) * ly / k.th) * t.s : 0;
}

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

export class Forest {
  /** @param {World} world */
  constructor(world) {
    this.world = world;
    this.logs = [];                  // falling tree tops being animated
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
    // oak: a thick short trunk under a wide lumpy crown; bush: a few twigs under low round leaf clumps
    const oakTrunk = new THREE.CylinderGeometry(0.26, 0.42, 3.4, 6);
    oakTrunk.translate(0, 1.7, 0);
    const oakCrown = mergeGeometries([[2.7, 1.15, 0.85, 0, 5.6, 0], [1.9, 1, 0.9, 1.3, 4.8, -0.7], [1.7, 1, 0.9, -1.1, 5.0, 0.9]]
      .map(([r, sxz, sy, x, y, z]) => new THREE.IcosahedronGeometry(r, 0).scale(sxz, sy, sxz).translate(x, y, z)));
    this.oakCrownMat = new THREE.MeshStandardMaterial({ color: 0x4d7531, roughness: 1, flatShading: true });
    const bushTrunk = new THREE.CylinderGeometry(0.06, 0.1, 0.9, 5);
    bushTrunk.translate(0, 0.45, 0);
    const bushCrown = mergeGeometries([[1.0, 1.25, 0.8, 0, 1.4, 0], [0.75, 1.2, 0.85, 0.7, 1.1, 0.4], [0.7, 1.2, 0.8, -0.5, 1.15, -0.55]]
      .map(([r, sxz, sy, x, y, z]) => new THREE.IcosahedronGeometry(r, 0).scale(sxz, sy, sxz).translate(x, y, z)));
    this.bushMat = new THREE.MeshStandardMaterial({ color: 0x557a36, roughness: 1, flatShading: true });
    this.treeParts = {
      pine: [[this.trunkGeo, this.trunkMat], [this.coneGeo, this.coneMat], [this.cone2Geo, this.cone2Mat]],
      birch: [[this.trunkGeo, this.trunkMat], [this.birchCrownGeo, this.birchCrownMat]],
      oak: [[oakTrunk, this.trunkMat], [oakCrown, this.oakCrownMat]],
      bush: [[bushTrunk, this.trunkMat], [bushCrown, this.bushMat]],
    };
    // the standing forest of a chunk is one baked mesh (vertex colours, one material for every chunk): one draw call
    // per chunk and one shader for all of them (an InstancedMesh per chunk and part cost a shader build each)
    // indexed (fewer vertices to keep in the batch), the flat-shaded crowns with their own vertices per face
    const bakedPart = (geo, mat) => {
      let g = geo.clone();
      g.deleteAttribute('uv');
      if (mat.flatShading) {
        g = g.index ? g.toNonIndexed() : g;
        g.computeVertexNormals();
      }
      const n = g.attributes.position.count;
      if (!g.index) g.setIndex([...Array(n).keys()]);
      const c = mat.color, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.toArray(col, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    /** @type {Record<string, THREE.BufferGeometry>} */
    this.treeBake = {};
    for (const [k, parts] of Object.entries(this.treeParts)) this.treeBake[k] = mergeGeometries(parts.map(([geo, mat]) => bakedPart(geo, mat)));
    this.forestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    // fresh cut of a broken trunk
    this.cutGeo = new THREE.CircleGeometry(1, 8);
    this.cutGeo.rotateX(-Math.PI / 2);
    this.cutMat = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 1, side: THREE.DoubleSide });
  }

  // the trees of a chunk: the forest noise thinned / filled by the biome (biomes.js), kinds by its shares; in the
  // fields only along some of the strips between them (tree lines) and in the copses
  buildTrees(ch) {
    const W = this.world;
    const r = rng(Math.floor(hash(W.seed, ch.cx, ch.cz, 31) * 4294967296));
    const MAX = 150;
    for (let t = 0; t < 400 && ch.trees.length < MAX; t++) {
      const x = ch.x0 + r() * CHUNK, z = ch.z0 + r() * CHUNK;
      const rx = W.roadX(z);
      const dr = Math.abs(x - rx);
      if (W.opts.road && dr < 14) continue;
      if (!W.opts.arena && Math.abs(z) < 70 && dr < 60) continue;       // spawn area clear
      if (W.opts.clear && W.opts.clear.some(c => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
      if (W.opts.arena && W.opts.treeDensity !== undefined && r() > W.opts.treeDensity) continue;
      const h = W.heightAt(x, z);
      const B = W.biomeAt(x, z);
      if (h < WATER_LEVEL + 1.2 - 0.9 * B.wet || h > 36) continue;    // swamp birches stand on the hummocks
      if (W.slopeAt(x, z) > 0.7) continue;
      if (W.settlementWeight(x, z, rx) > 0.02) continue;
      if (W.rail && W.rail.nearTrack(x, z, 9)) continue;              // the railway keeps its clearing
      const density = Math.min(1, fbm(W.nTree, x * 0.006, z * 0.006, 3) * 0.5 + 0.5 + B.treeFill);
      let p = density * density * 1.7 * B.trees;
      if (B.fields > 0) {
        const f = W.fieldAt(x, z, rx, B.fields);
        if (f.crop >= 0) continue;
        if (f.line) p = Math.max(p, 0.8);
      }
      if (r() > p) continue;
      const kr = r() * (B.pine + B.birch + B.oak + B.bush);
      const kind = kr < B.pine ? 'pine' : kr < B.pine + B.birch ? 'birch' : kr < B.pine + B.birch + B.oak ? 'oak' : 'bush';
      const K = KINDS[kind];
      const s = (kind === 'bush' ? 0.7 + r() * 0.6 : 0.75 + r() * 0.95) * (kind === 'bush' ? 1 : B.treeS);
      const item = { x, z, h, s, rot: r() * Math.PI * 2, sy: 0.85 + r() * 0.5 };
      item.kind = kind;
      item.g = s * K.girth;                        // trunk thickness
      item.r = 0.38 * item.g;                      // collision radius
      item.base = h - 0.25;
      item.top = item.base + K.top * s * item.sy;
      item.id = `${ch.cx},${ch.cz},${ch.trees.length}`;
      item.ch = ch;
      ch.trees.push(item);
    }
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const n = ch.trees.reduce((a, t) => a + this.treeBake[t.kind].attributes.position.count, 0);
    if (n) {
      // bake the trees of the chunk into one mesh: each tree keeps its vertex range (t.v0, t.nv) to be hidden
      const ni = ch.trees.reduce((a, t) => a + this.treeBake[t.kind].index.count, 0);
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Uint8Array(n * 3), idx = new Uint32Array(ni);
      const nm = new THREE.Matrix3(), v = new THREE.Vector3();
      let o = 0, oi = 0;
      for (const t of ch.trees) {
        q.setFromAxisAngle(up, t.rot);
        sc.set(t.s, t.s * t.sy, t.s);
        pv.set(t.x, t.base, t.z);
        t.mat = new THREE.Matrix4().compose(pv, q, sc);
        nm.getNormalMatrix(t.mat);
        const g = this.treeBake[t.kind], gp = g.attributes.position, gn = g.attributes.normal, gc = g.attributes.color;
        t.v0 = o; t.nv = gp.count;
        const gi = g.index.array;
        for (let i = 0; i < gi.length; i++) idx[oi++] = gi[i] + o;
        for (let i = 0; i < gp.count; i++, o++) {
          v.fromBufferAttribute(gp, i).applyMatrix4(t.mat).toArray(pos, o * 3);
          v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize().toArray(nor, o * 3);
          col[o * 3] = gc.getX(i) * 255; col[o * 3 + 1] = gc.getY(i) * 255; col[o * 3 + 2] = gc.getZ(i) * 255;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      ch.parts.forest = this.world.batch.forest.add(geo);
    }
    // trees broken earlier stay broken
    for (const t of ch.trees) {
      const b = this.world.brokenTrees.get(t.id);
      if (b) {
        this.breakTree(t, b.y, b.dx, b.dz, true);
        if (b.y2 != null) this.cutStump(t, b.y2, b.dx2, b.dz2, true);
      }
    }
  }

  // ---------------------------------------------------------- broken trees
  // take a standing tree out of the chunk's forest mesh (its triangles collapse to a point)
  hideTree(t) {
    const h = t.ch.parts.forest;
    if (!h) return;
    const v0 = this.world.batch.forest.range(h).vertexStart + t.v0;
    const p = this.world.batch.forest.attribute('position'), a = p.array;
    const x = a[v0 * 3], y = a[v0 * 3 + 1], z = a[v0 * 3 + 2];
    for (let i = v0; i < v0 + t.nv; i++) { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }
    p.addUpdateRange(v0 * 3, t.nv * 3);
    p.needsUpdate = true;
  }

  // break a tree at height y (world); the top falls towards (dx, dz)
  breakTree(t, y, dx, dz, instant = false) {
    if (!instant && this.world.onTreeBroken) this.world.onTreeBroken(t, y, dx, dz);
    if (t.broken) return instant ? undefined : this.cutStump(t, y, dx, dz);
    const ch = t.ch;
    y = Math.max(t.base + 0.3, Math.min(t.top - 1.2, y));
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    t.broken = true;
    t.stumpH = y - t.base;
    this.world.brokenTrees.set(t.id, { y, dx, dz });
    this.hideTree(t);

    const parts = this.treeParts[t.kind];
    const cutR = cutRadius(t, t.stumpH);               // fresh cut (the trunk tapers)

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
    this.world.scene.add(stump);
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
    this.world.scene.add(top);
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
    const b = this.world.brokenTrees.get(t.id);
    if (b) Object.assign(b, { y2: y, dx2: dx, dz2: dz });
    // the old stump goes, a lower one takes its place
    const old = t.stumpObj;
    this.world.scene.remove(old);
    ch.extra.splice(ch.extra.indexOf(old), 1);
    const parts = this.treeParts[t.kind];
    const cutR = cutRadius(t, t.stumpH);
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
    this.world.scene.add(stump);
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
    this.world.scene.add(top);
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
      const g = this.world.heightAt(p.x + log.dx * log.len * 0.5, p.z + log.dz * log.len * 0.5) + 0.22;
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
      if (ty < this.world.heightAt(tx, tz) + 0.35 * k + 0.2 || log.ang > Math.PI / 2 + 0.25) {
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
      const R = 0.45 * t.g;
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
    const ch = this.world.chunks.get(ckey(cx, cz));
    return ch ? ch.trees[i] || null : null;
  }

  // iterate trees around a point
  forTreesNear(x, z, fn) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const fx = x / CHUNK - cx, fz = z / CHUNK - cz;
    const xs = [cx, fx < 0.5 ? cx - 1 : cx + 1], zs = [cz, fz < 0.5 ? cz - 1 : cz + 1];
    for (const a of xs) for (const b of zs) {
      const ch = this.world.chunks.get(ckey(a, b));
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
        if (ram && Math.abs(ram.speed) > 1.2 + t.g * 1.3 && (!ram.light || t.kind === 'bush')) {
          this.breakTree(t, t.base + 0.35 + Math.random() * 0.3, ram.dx, ram.dz);
          ram.broke = true;
          ram.size = Math.max(ram.size || 0, t.g);
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

}
