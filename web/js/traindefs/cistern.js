// Цистерна (1900s-): a two-axle tank wagon - the black barrel on its saddles with the dome and the brakeman's
// platform with a railing at one end. Burns when shot through.
import * as THREE from 'three';
import { PI, C, box, cylZ, cylY, put, GEO } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'cistern', name: 'Цистерна', kind: 'car', cls: 'freight', flammable: true, years: [1900, 2015],
  len: 9.2, mass: 25, pivots: [2.5, -2.5],
  riders: [{ pos: [0.3, 1.25, -4.1], ry: PI }],
  variants: [0x1e1e1e, 0x5a5a56],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 2];
    underframe(g, { L: 9.2, yf: 1.2, axles: [2.5, -2.5], r: 0.5 });
    for (const z of [-2.6, 2.6]) box(g, C.iron, 0, 1.3, z, 2.3, 0.35, 0.4);
    cylZ(g, col, 0, 2.5, 0.4, 1.25, 7.4);
    for (const d of [-1, 1]) put(g, GEO.sph, col, 0, 2.5, 0.4 + d * 3.7, 1.25, 1.25, 0.35);
    cylY(g, col, 0, 3.9, 0.4, 0.5, 0.5);
    cylY(g, col, 0, 4.18, 0.4, 0.58, 0.08);
    for (const s of [-1, 1]) box(g, C.iron, s * 1.1, 2.5, 0.4, 0.05, 0.05, 7.2);
    for (const z of [-2.0, 2.8]) box(g, C.iron, 0, 2.5, z, 2.6, 2.6, 0.04);              // bands
    box(g, C.wood, 0, 1.2, -4.15, 2.6, 0.08, 0.9);                                       // brake platform
    for (const s of [-1, 1]) box(g, C.iron, s * 1.25, 1.75, -4.5, 0.04, 1.0, 0.04);
    box(g, C.iron, 0, 2.25, -4.55, 2.5, 0.04, 0.04);
    cylY(g, C.iron, -0.9, 1.9, -4.3, 0.12, 1.3);                                          // brake wheel column
    return g;
  },
};
