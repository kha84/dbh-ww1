// One draw call for all the chunks of a kind (terrain, forest, water, road): the chunk geometries (in world
// coordinates) live in a BatchedMesh, which culls them one by one against the view. Chunks come and go as the player
// moves: a removed geometry leaves a hole that optimize() closes when the buffers run out (and they grow if needed).
import * as THREE from 'three';

const _m = new THREE.Matrix4();

export class ChunkBatch {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Material} material
   * @param {{ instances: number, verts: number, indices?: number, castShadow?: boolean, receiveShadow?: boolean, name?: string }} o
   */
  constructor(scene, material, o) {
    this.cap = { v: o.verts, i: o.indices ?? o.verts * 2 };
    this.mesh = new THREE.BatchedMesh(o.instances, this.cap.v, this.cap.i, material);
    this.mesh.castShadow = !!o.castShadow;
    this.mesh.receiveShadow = o.receiveShadow !== false;
    this.mesh.name = o.name || 'batch';
    this.mesh.sortObjects = !!material.transparent;
    this.mesh.frustumCulled = false;          // per instance culling does it (the whole batch spans the view)
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
    this.live = 0;
  }

  /** add a geometry (world coordinates); returns its handle */
  add(geo) {
    const b = this.mesh;
    const nv = geo.attributes.position.count, ni = geo.index ? geo.index.count : 0;
    if (b.unusedVertexCount < nv || b.unusedIndexCount < ni) {
      b.optimize();
      if (b.unusedVertexCount < nv || b.unusedIndexCount < ni) {
        const used = this.cap.v - b.unusedVertexCount, usedI = this.cap.i - b.unusedIndexCount;
        this.cap = { v: Math.ceil((used + nv) * 1.5), i: Math.ceil((usedI + ni) * 1.5) };
        b.setGeometrySize(this.cap.v, this.cap.i);
      }
    }
    if (b.instanceCount >= b.maxInstanceCount) b.setInstanceCount(Math.ceil(b.maxInstanceCount * 1.5));
    const geoId = b.addGeometry(geo);
    const inst = b.addInstance(geoId);
    b.setMatrixAt(inst, _m.identity());
    this.live++;
    return { geoId, inst };
  }

  /** take a geometry out (its chunk was unloaded) */
  remove(h) {
    if (!h) return;
    this.mesh.deleteInstance(h.inst);
    this.mesh.deleteGeometry(h.geoId);
    this.live--;
  }

  /** the vertex range of a geometry in the shared buffers (it moves when the batch is optimised) */
  range(h) { return this.mesh.getGeometryRangeAt(h.geoId); }

  /** the shared attribute of the batch (e.g. to edit the vertices of one geometry) */
  attribute(name) { return /** @type {THREE.BufferAttribute} */ (this.mesh.geometry.attributes[name]); }
}
