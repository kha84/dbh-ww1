// Четырёхосный крытый вагон (1930s-): the big bogie boxcar of the later trains - steel-framed, one sliding door
// standing open (soldiers sit in it in a military train), roof hatches.
import * as THREE from 'three';
import { PI, C, box, carBody } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'box4', name: 'Четырёхосный крытый', kind: 'car', cls: 'freight', troops: true, years: [1930, 2015],
  len: 14.7, mass: 50, pivots: [5.0, -5.0],
  riders: [{ pos: [1.0, 1.3, 0.6], ry: PI / 2 }, { pos: [1.0, 1.3, -0.6], ry: PI / 2, stance: 'crouch' }, { pos: [0.2, 1.3, 2.2], ry: PI / 2 }],
  variants: [0x6a3b2a, 0x5a4a3c, 0x4a5a46],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 3];
    underframe(g, { L: 14.7, yf: 1.3, bogies: [5.0, -5.0], r: 0.47, auto: true });
    const holes = s => (s > 0 ? [{ z0: -1.0, z1: 1.0, y0: 1.32, y1: 3.4 }] : []);
    carBody(g, { L: 13.8, w: 2.9, yf: 1.3, ye: 3.75, col, roofH: 0.32, roofOver: 0.2, holes, inner: 0x2e261e });
    for (const s of [-1, 1]) {
      for (let z = -6.3; z <= 6.4; z += 1.4) if (Math.abs(z) > 1.1 || s < 0) box(g, C.iron, s * 1.48, 2.5, z, 0.05, 2.45, 0.09);
      box(g, C.iron, s * 1.49, 2.5, 0, 0.04, 0.06, 13.7);
      box(g, col, s * 1.52, 2.35, s > 0 ? 2.2 : 0, 0.06, 2.1, 2.1);                       // doors (the open one slid aside)
    }
    box(g, C.white, -1.47, 3.2, -4.6, 0.02, 0.35, 1.2);
    return g;
  },
};
