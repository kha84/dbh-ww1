// Четырёхосный полувагон (1950s-): the big steel open wagon with its vertical ribs and hatches in the floor -
// coal, ore, scrap; grey-brown.
import * as THREE from 'three';
import { PI, C, box, put, GEO } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'gondola4', name: 'Четырёхосный полувагон', kind: 'car', cls: 'freight', years: [1950, 2015],
  len: 13.9, mass: 70, pivots: [4.3, -4.3],
  riders: [{ pos: [0.8, 1.35, -5.6], ry: PI / 2 }, { pos: [-0.8, 1.35, 5.6], ry: -PI / 2 }],
  variants: [0x5a4a3c, 0x4a5246],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 2];
    underframe(g, { L: 13.9, yf: 1.3, bogies: [4.3, -4.3], r: 0.47, auto: true });
    box(g, C.iron, 0, 1.28, 0, 2.95, 0.1, 12.7);
    for (const s of [-1, 1]) {
      box(g, col, s * 1.48, 2.35, 0, 0.06, 2.1, 12.7);
      for (let z = -6.0; z <= 6.05; z += 1.0) box(g, col, s * 1.53, 2.35, z, 0.07, 2.12, 0.12);
      box(g, col, s * 1.53, 3.38, 0, 0.1, 0.08, 12.75);
      box(g, col, 0, 2.35, s * 6.35, 3.0, 2.1, 0.08);
    }
    put(g, GEO.arch, C.coal, 0, 3.1, 0, 1.4, 0.55, 11.6, 0, 0, 0, { r: 1, m: 0 });
    box(g, C.coal, 0, 2.3, 0, 2.9, 1.6, 12.6, { r: 1, m: 0 });
    return g;
  },
};
