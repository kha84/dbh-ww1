// Registry of aeroplane types. Each file in this folder describes one plane: its flight numbers (mass, power, top /
// stall speed, roll rate, fuel), weapons (guns, cannons, bombs on their racks), landing gear, hit boxes, the pilot's
// eye and its procedural model (kit.js). To add a plane: write a file like camel.js and list it here.
//   mass kg, power hp, vmax / vstall m/s, roll rad/s, fuel l, fuelUse l/s at full throttle, hp (airframe)
//   guns: [{ w: WEAPONS key, at: muzzle [x, y, z], n: rounds }], cannons: [{ at, rpm, pen mm, dmg, speed m/s, n }]
//   bombs: [{ at, kg, dmg, pen }] (dropped from the last one), gear: { main: [x, y, z] (wheel bottom), tail },
//   retract: the gear folds up in flight, span / len (m), boxes: hit boxes [[min], [max]], seat: the pilot's eye
import { PALETTES, bake } from '../modelkit.js';
import { pmats } from './kit.js';
import camel from './camel.js';
import dr1 from './dr1.js';
import spad13 from './spad13.js';
import fokkerD7 from './fokkerD7.js';
import po2 from './po2.js';
import i16 from './i16.js';
import bf109 from './bf109.js';
import ju87 from './ju87.js';
import spitfire from './spitfire.js';
import il2 from './il2.js';

export const PLANE_DEFS = [camel, dr1, spad13, fokkerD7, po2, i16, bf109, ju87, spitfire, il2];
export const PLANES = Object.fromEntries(PLANE_DEFS.map(d => [d.key, d]));
for (const d of PLANE_DEFS) PALETTES[d.key] = d.palette;
// in the order they flew first (the airfields down the road have the later ones)
export const PLANE_TIERS = PLANE_DEFS.map(d => d.key).sort((a, b) => PLANES[a].year - PLANES[b].year);

// the model of a plane: { root (baked), prop (spin group), gear (retracting group or null), bombs: [meshes] }
export function buildPlane(key) {
  const m = PLANES[key].model(pmats(key));
  bake(m.root);
  m.root.userData.markHost = true;
  return m;
}
