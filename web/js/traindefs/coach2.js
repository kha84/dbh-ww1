// Двухосный пассажирский вагон (1890s-1930s): a short wooden coach on two axles with open end platforms - the
// third-class carriage of the Imperial railways (green), the second class in brown, the first in yellow.
import * as THREE from 'three';
import { PI, C, box, carBody, endPlatform, windowRow } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'coach2', name: 'Двухосный пассажирский', kind: 'car', cls: 'passenger', years: [1890, 1940],
  len: 10.4, mass: 20, pivots: [2.6, -2.6],
  riders: [{ pos: [0.95, 1.25, 1.6], ry: PI / 2 }, { pos: [-0.95, 1.25, -1.4], ry: -PI / 2 }, { pos: [0, 1.22, 4.75], ry: 0 }],
  variants: [0x3d5a3a, 0x6a4a32, 0xb8953a],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 3];
    underframe(g, { L: 10.4, yf: 1.25, axles: [2.6, -2.6], r: 0.5 });
    carBody(g, { L: 8.4, w: 2.9, yf: 1.25, ye: 3.3, col, roofH: 0.42, roofOver: 1.9, endDoors: true, benches: true,
      holes: () => windowRow(-4.0, 4.0, 5, 0.75, 2.15, 2.95), frames: C.white, inner: 0x3a3026 });
    for (const d of [-1, 1]) endPlatform(g, d * 4.2, d, 2.9, 1.25);
    box(g, C.yellow, 0, 3.28, 0, 0.05, 0.05, 0.05);
    return g;
  },
};
