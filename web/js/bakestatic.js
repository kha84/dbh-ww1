// Baking static scenery (settlement houses, fences, pumps, hangars...) into as few meshes as possible: the pieces
// are untextured standard materials that differ in colour, roughness and metalness, so they are merged into one
// mesh per shadow mode with the colour in the vertices and roughness / metalness in a vertex attribute (`rm`) that
// the shared node material reads. A house of a dozen boxes becomes one draw call.
import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const STATIC_MAT = new THREE.MeshStandardNodeMaterial({ vertexColors: true });
{
  const rm = attribute('rm', 'vec2');
  STATIC_MAT.roughnessNode = rm.x;
  STATIC_MAT.metalnessNode = rm.y;
}

// can this mesh go into a bake? (untextured single-material standard mesh)
export const bakeable = o => o.isMesh && o.material !== STATIC_MAT && !Array.isArray(o.material) && o.material.isMeshStandardMaterial &&
  !o.material.map && !o.material.transparent && !o.isInstancedMesh && !o.isBatchedMesh;

/**
 * Merge `meshes` (children of `parent`, possibly nested) into up to two meshes added to `parent` (shadow casting and
 * not); the originals are removed. Returns the new meshes.
 * @param {THREE.Object3D[]} meshes
 * @param {THREE.Object3D} parent
 */
export function bakeStatic(meshes, parent) {
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const lists = { cast: [], still: [] };
  for (const o of meshes) {
    if (!bakeable(o)) continue;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    const n = g.attributes.position.count, mat = o.material;
    const col = new Float32Array(n * 3), rm = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      col[i * 3] = mat.color.r; col[i * 3 + 1] = mat.color.g; col[i * 3 + 2] = mat.color.b;
      rm[i * 2] = mat.roughness; rm[i * 2 + 1] = mat.metalness;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('rm', new THREE.BufferAttribute(rm, 2));
    (o.castShadow ? lists.cast : lists.still).push(g);
    o.removeFromParent();
  }
  const out = [];
  for (const [k, geos] of Object.entries(lists)) {
    if (!geos.length) continue;
    const merged = new THREE.Mesh(mergeGeometries(geos, false), STATIC_MAT);
    merged.castShadow = k === 'cast';
    merged.receiveShadow = true;
    merged.matrixAutoUpdate = false;
    merged.userData.own = true;                    // its geometry is its own: dispose it with the scenery
    parent.add(merged);
    out.push(merged);
  }
  return out;
}

/**
 * Geometry written straight into the arrays of a STATIC_MAT mesh (colour + roughness / metalness per vertex): boxes
 * along any direction and quads, for things made of very many small pieces (railway track: sleepers, rails, ballast).
 */
export class GeoBuilder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.rm = []; }
  // quad p0..p3 (arrays [x, y, z]) facing n; colour c (THREE.Color), roughness r, metalness m
  quad(p0, p1, p2, p3, n, c, r = 0.9, m = 0) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    const flip = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0;
    const tri = flip ? [p0, p2, p1, p0, p3, p2] : [p0, p1, p2, p0, p2, p3];
    for (const p of tri) {
      this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]);
      this.col.push(c.r, c.g, c.b); this.rm.push(r, m);
    }
  }
  // box standing on (x, y, z): along the unit vector a (3D), across the horizontal perpendicular, la x lb x h
  box(x, y, z, ax, ay, az, la, lb, h, c, r = 0.9, m = 0, faces = 63) {
    const hl = Math.hypot(ax, az) || 1;
    const bx = az / hl, bz = -ax / hl;                         // across (horizontal)
    const ux = ay * bz, uy = az * bx - ax * bz, uz = -ay * bx;  // up = a x b
    const P = (sa, sb, su) => [x + ax * sa * la / 2 + bx * sb * lb / 2 + ux * su * h, y + ay * sa * la / 2 + uy * su * h, z + az * sa * la / 2 + bz * sb * lb / 2 + uz * su * h];
    const A = [ax, ay, az], B = [bx, 0, bz], Uv = [ux, uy, uz];
    const neg = v => [-v[0], -v[1], -v[2]];
    if (faces & 1) this.quad(P(1, -1, 0), P(1, 1, 0), P(1, 1, 1), P(1, -1, 1), A, c, r, m);
    if (faces & 2) this.quad(P(-1, -1, 0), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, 0), neg(A), c, r, m);
    if (faces & 4) this.quad(P(-1, 1, 0), P(-1, 1, 1), P(1, 1, 1), P(1, 1, 0), B, c, r, m);
    if (faces & 8) this.quad(P(-1, -1, 0), P(1, -1, 0), P(1, -1, 1), P(-1, -1, 1), neg(B), c, r, m);
    if (faces & 16) this.quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), Uv, c, r, m);
    if (faces & 32) this.quad(P(-1, -1, 0), P(-1, 1, 0), P(1, 1, 0), P(1, -1, 0), neg(Uv), c, r, m);
  }
  get empty() { return !this.pos.length; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('rm', new THREE.Float32BufferAttribute(this.rm, 2));
    g.computeBoundingSphere();
    return g;
  }
  mesh(cast = false) {
    const m = new THREE.Mesh(this.geometry(), STATIC_MAT);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.userData.own = true;
    return m;
  }
}
