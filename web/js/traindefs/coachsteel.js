// Цельнометаллический пассажирский вагон (1930s-1980s): the all-steel bogie coach - 24 m long, rounded roof, wide
// windows, doors at both ends; Soviet green with a yellow band.
import * as THREE from 'three';
import { PI, C, box, carBody, windowRow } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'coachsteel', name: 'Цельнометаллический', kind: 'car', cls: 'passenger', years: [1935, 1988],
  len: 23.6, mass: 55, pivots: [8.5, -8.5],
  riders: [{ pos: [1.05, 1.35, 6.5], ry: PI / 2 }, { pos: [-1.05, 1.35, 2.5], ry: -PI / 2 }, { pos: [1.05, 1.35, -1.8], ry: PI / 2 }, { pos: [-1.05, 1.35, -6.0], ry: -PI / 2 }],
  variants: [0x2f5a3c, 0x2d4a6a],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 2];
    underframe(g, { L: 23.6, yf: 1.35, bogies: [8.5, -8.5], r: 0.48, auto: true });
    const holes = () => [...windowRow(-9.6, 9.6, 10, 1.05, 2.3, 3.25), { z0: 10.4, z1: 11.2, y0: 1.4, y1: 3.4 }, { z0: -11.2, z1: -10.4, y0: 1.4, y1: 3.4 }];
    carBody(g, { L: 23.2, w: 3.1, yf: 1.35, ye: 3.7, col, roofH: 0.55, endDoors: true, benches: true, holes, frames: C.bright, inner: 0x4a4436, roofCol: 0x55595a });
    for (const s of [-1, 1]) box(g, C.yellow, s * 1.565, 2.15, 0, 0.02, 0.08, 23);
    return g;
  },
};
