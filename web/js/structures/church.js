// The church on a town square: nave and bell tower with a golden dome.
import { MAT, box, cyl, roofGeo, sphere } from './kit.js';

/** @typedef {import('./kit.js').Kit} Kit */

/** @param {Kit} K */
export function church(K, along, off) {
  const f = K.frame(along, off);
  const y = K.groundMin(f.x, f.z, 6) - 0.3;
  K.part(box, MAT.white, f.x, y, f.z, 10, 9, 14, f.rot);
  K.part(roofGeo, MAT.roofs[1], f.x, y + 9, f.z, 10.5, 4, 14.5, f.rot);
  const t = K.at(f, 0, -9);
  K.part(box, MAT.white, t.x, y, t.z, 5, 17, 5, f.rot);
  K.part(cyl, MAT.white, t.x, y + 17, t.z, 3.6, 2.5, 3.6, 0);
  K.part(sphere, MAT.gold, t.x, y + 20.3, t.z, 4, 5, 4, 0);
  K.part(box, MAT.gold, t.x, y + 22.5, t.z, 0.2, 3, 0.2, f.rot);
  K.part(box, MAT.gold, t.x, y + 24, t.z, 0.2, 0.2, 1.4, f.rot);
  K.obstacle(f, 5, 7, y, y + 13);
  K.obstacle({ x: t.x, z: t.z, rot: f.rot }, 2.5, 2.5, y, y + 24);
}
