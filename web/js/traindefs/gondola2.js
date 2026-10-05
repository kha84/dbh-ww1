// Двухосный полувагон (1890s-1950s): a short open wagon with plank sides and drop doors, loaded with coal (or
// crates of army stores).
import * as THREE from 'three';
import { PI, C, box, put, GEO } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'gondola2', name: 'Двухосный полувагон', kind: 'car', cls: 'freight', years: [1890, 1960],
  len: 8.0, mass: 22, pivots: [2.2, -2.2],
  riders: [{ pos: [0.6, 1.25, -2.6], ry: PI / 2 }],
  variants: [0x5a3e2c, 0x3a3a36],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 2];
    underframe(g, { L: 8.0, yf: 1.2, axles: [2.2, -2.2], r: 0.5 });
    box(g, C.wood, 0, 1.15, 0, 2.7, 0.1, 6.8);
    for (const s of [-1, 1]) {
      box(g, col, s * 1.35, 1.75, 0, 0.08, 1.1, 6.8);
      for (const z of [-3.3, -1.6, 0, 1.6, 3.3]) box(g, C.iron, s * 1.4, 1.75, z, 0.06, 1.15, 0.1);
      box(g, col, 0, 1.75, s * 3.4, 2.78, 1.1, 0.08);
    }
    if (v % 2 === 0) put(g, GEO.arch, C.coal, 0, 1.9, 0.4, 1.25, 0.7, 4.8, 0, 0, 0, { r: 1, m: 0 });
    else for (let i = 0; i < 6; i++) box(g, 0x6b5a34, (i % 2 - 0.5) * 1.1, 1.6 + Math.floor(i / 4) * 0.7, -1.4 + (i % 3) * 1.4, 1.0, 0.7, 1.2);
    return g;
  },
};
