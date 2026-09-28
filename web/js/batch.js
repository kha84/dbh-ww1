// One draw call for all the chunks of a kind (terrain, forest, water, road): the chunk geometries (in world
// coordinates) live in a BatchedMesh, which culls them one by one against the view. Chunks come and go as the player
// moves: the room of an unloaded chunk is kept and given to the next chunk that fits into it (only that range is
// uploaded again). Compacting / growing the buffers re-uploads all of them (a long frame), so it is the last resort.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const round = (n, step) => Math.ceil(n / step) * step;

export class ChunkBatch {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Material} material
   * @param {{ instances: number, verts: number, indices?: number, castShadow?: boolean, receiveShadow?: boolean,
   *           name?: string, step?: number }} o   step: room is reserved in multiples of it (vertices)
   */
  constructor(scene, material, o) {
    this.cap = { v: o.verts, i: o.indices ?? o.verts * 2 };
    this.step = o.step || 256;
    this.mesh = new THREE.BatchedMesh(o.instances, this.cap.v, this.cap.i, material);
    this.mesh.castShadow = !!o.castShadow;
    this.mesh.receiveShadow = o.receiveShadow !== false;
    this.mesh.name = o.name || 'batch';
    this.mesh.sortObjects = !!material.transparent;
    this.mesh.frustumCulled = false;          // per instance culling does it (the whole batch spans the view)
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
    this.free = [];                           // rooms of unloaded chunks: { geoId, v, i }
    this.live = 0;
    this.stats = { reused: 0, appended: 0, compacted: 0, grown: 0 };
  }

  /** add a geometry (world coordinates); returns its handle */
  add(geo) {
    const b = this.mesh;
    const nv = geo.attributes.position.count, ni = geo.index ? geo.index.count : 0;
    let geoId = -1, room = null;
    // the smallest free room it fits in
    let best = -1;
    for (let k = 0; k < this.free.length; k++) {
      const f = this.free[k];
      if (f.v >= nv && f.i >= ni && (best < 0 || f.v < this.free[best].v)) best = k;
    }
    if (best >= 0) {
      room = this.free.splice(best, 1)[0];
      geoId = room.geoId;
      b.setGeometryAt(geoId, geo);
      this.stats.reused++;
    } else {
      const rv = round(nv * 1.1, this.step), ri = ni ? round(ni * 1.1, this.step * 3) : 0;
      if (b.unusedVertexCount < rv || b.unusedIndexCount < ri) {
        // give the free rooms back and compact; grow if that is not enough
        for (const f of this.free) b.deleteGeometry(f.geoId);
        this.free.length = 0;
        b.optimize();
        this.stats.compacted++;
        if (b.unusedVertexCount < rv || b.unusedIndexCount < ri) {
          const used = this.cap.v - b.unusedVertexCount, usedI = this.cap.i - b.unusedIndexCount;
          this.cap = { v: Math.ceil((used + rv) * 1.5), i: Math.ceil((usedI + ri) * 1.5) };
          b.setGeometrySize(this.cap.v, this.cap.i);
          this.stats.grown++;
        }
      }
      geoId = b.addGeometry(geo, rv, ni ? ri : -1);
      room = { geoId, v: rv, i: ri };
      this.stats.appended++;
    }
    if (b.instanceCount >= b.maxInstanceCount) b.setInstanceCount(Math.ceil(b.maxInstanceCount * 1.5));
    const inst = b.addInstance(geoId);
    b.setMatrixAt(inst, _m.identity());
    this.live++;
    return { geoId, inst, room };
  }

  /** take a geometry out (its chunk was unloaded): its room waits for the next chunk */
  remove(h) {
    if (!h) return;
    this.mesh.deleteInstance(h.inst);
    this.free.push(h.room);
    this.live--;
  }

  /** the vertex range of a geometry in the shared buffers (it moves when the batch is compacted) */
  range(h) { return this.mesh.getGeometryRangeAt(h.geoId); }

  /** the shared attribute of the batch (e.g. to edit the vertices of one geometry) */
  attribute(name) { return /** @type {THREE.BufferAttribute} */ (this.mesh.geometry.attributes[name]); }
}
