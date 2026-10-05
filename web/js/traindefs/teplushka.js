// Теплушка - двухосный крытый вагон (1890s-1960s): the plank-sided boxcar of «40 человек / 8 лошадей», the troop
// train of two world wars: sliding doors standing open, little hatches under the roof, a stove pipe.
import * as THREE from 'three';
import { PI, C, box, cylY, carBody } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'teplushka', name: 'Теплушка (крытый 2-осный)', kind: 'car', cls: 'freight', troops: true, years: [1890, 1965],
  len: 7.6, mass: 18, pivots: [2.0, -2.0],
  riders: [{ pos: [0.9, 1.2, 0.5], ry: PI / 2 }, { pos: [0.9, 1.2, -0.5], ry: PI / 2, stance: 'crouch' }, { pos: [-0.9, 1.2, 0.2], ry: -PI / 2 }],
  variants: [0x7a3b2a, 0x5a3a28, 0x4f5a42],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 3];
    underframe(g, { L: 7.6, yf: 1.2, axles: [2.0, -2.0], r: 0.5 });
    const holes = () => [{ z0: -0.95, z1: 0.95, y0: 1.22, y1: 3.0 }, { z0: 2.2, z1: 2.65, y0: 2.7, y1: 3.0 }, { z0: -2.65, z1: -2.2, y0: 2.7, y1: 3.0 }];
    carBody(g, { L: 6.4, w: 2.75, yf: 1.2, ye: 3.25, col, roofH: 0.35, roofOver: 0.3, holes, inner: 0x2e261e });
    for (const s of [-1, 1]) {
      box(g, col, s * 1.42, 2.1, 1.65, 0.05, 1.85, 2.0);                           // the door slid aside
      box(g, C.iron, s * 1.44, 3.05, 0, 0.04, 0.06, 5.0);                          // door rail
      for (const z of [-2.9, -1.2, 1.2, 2.9]) box(g, C.iron, s * 1.4, 2.2, z, 0.05, 2.0, 0.08);   // strapping
      box(g, C.iron, s * 1.4, 2.2, 0, 0.05, 0.06, 6.3);
    }
    cylY(g, C.black, 0.6, 3.75, -1.6, 0.08, 0.6);                                   // stove pipe
    box(g, C.white, 1.42, 2.5, -2.2, 0.02, 0.3, 0.7);
    return g;
  },
};
