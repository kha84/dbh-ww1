// Village well: a stone ring under a little roof.
import { MAT, cyl, roofGeo } from './kit.js';

/** @typedef {import('./kit.js').Kit} Kit */

/** @param {Kit} K */
export function well(K, along, off) {
  const f = K.frame(along, off);
  const y = K.world.heightAt(f.x, f.z);
  K.part(cyl, MAT.darkConcrete, f.x, y, f.z, 1.6, 0.9, 1.6, 0);
  K.part(roofGeo, MAT.wood, f.x, y + 2.2, f.z, 2, 0.8, 2, f.rot);
  K.obstacle(f, 0.9, 0.9, y, y + 3);
}
