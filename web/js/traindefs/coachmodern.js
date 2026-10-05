// Пассажирский вагон постройки 1970-х (Аммендорф): the long smooth-sided coach of the later trains - big windows,
// recessed doors, red with grey and white bands (or green / blue).
import * as THREE from 'three';
import { PI, C, box, carBody, windowRow } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'coachmodern', name: 'Купейный (Аммендорф)', kind: 'car', cls: 'passenger', years: [1965, 2015],
  len: 24.5, mass: 58, pivots: [8.7, -8.7],
  riders: [{ pos: [1.05, 1.35, 7.0], ry: PI / 2 }, { pos: [-1.05, 1.35, 3.0], ry: -PI / 2 }, { pos: [1.05, 1.35, -1.5], ry: PI / 2 }, { pos: [-1.05, 1.35, -6.5], ry: -PI / 2 }],
  variants: [0xa83a2e, 0x2f5a3c, 0x2f4f7a],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 3];
    underframe(g, { L: 24.5, yf: 1.35, bogies: [8.7, -8.7], r: 0.48, auto: true, frame: 0x2a2a2a });
    const holes = () => [...windowRow(-9.8, 9.8, 11, 1.15, 2.25, 3.3), { z0: 10.7, z1: 11.6, y0: 1.4, y1: 3.45 }, { z0: -11.6, z1: -10.7, y0: 1.4, y1: 3.45 }];
    carBody(g, { L: 24.1, w: 3.1, yf: 1.35, ye: 3.75, col, roofH: 0.5, endDoors: true, benches: true, holes, inner: 0x5a5244, roofCol: 0x6a6a66 });
    for (const s of [-1, 1]) {
      box(g, 0xb9b6ae, s * 1.565, 1.95, 0, 0.02, 0.35, 24);
      box(g, C.white, s * 1.566, 3.42, 0, 0.02, 0.05, 24);
    }
    return g;
  },
};
