// Baking static scenery (settlement houses, fences, pumps, hangars...) into as few meshes as possible: the pieces
// are untextured standard materials that differ in colour, roughness and metalness, so they are merged into one
// mesh per shadow mode with the colour in the vertices and roughness / metalness in a vertex attribute (`rm`) that
// the shared node material reads. A house of a dozen boxes becomes one draw call.
import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const STATIC_MAT = new THREE.MeshStandardNodeMaterial({ vertexColors: true });
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
