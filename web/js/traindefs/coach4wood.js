// Четырёхосный деревянный пассажирский вагон (1900s-1950s): a long wooden bogie coach with a clerestory roof and
// closed vestibules - green, with yellow lettering band.
import * as THREE from 'three';
import { PI, C, box, carBody, windowRow } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'coach4wood', name: 'Четырёхосный деревянный', kind: 'car', cls: 'passenger', years: [1900, 1958],
  len: 18.8, mass: 40, pivots: [6.3, -6.3],
  riders: [{ pos: [1.0, 1.3, 4.6], ry: PI / 2 }, { pos: [-1.0, 1.3, 1.0], ry: -PI / 2 }, { pos: [1.0, 1.3, -2.6], ry: PI / 2 }, { pos: [-1.0, 1.3, -5.8], ry: -PI / 2 }],
  variants: [0x35553a, 0x6b3a2a],
  build(v = 0) {
    const g = new THREE.Group();
    const col = this.variants[v % 2];
    underframe(g, { L: 18.8, yf: 1.3, bogies: [6.3, -6.3], r: 0.5 });
    const holes = () => [...windowRow(-7.6, 7.6, 10, 0.8, 2.25, 3.05), { z0: 8.3, z1: 8.9, y0: 1.35, y1: 3.15 }, { z0: -8.9, z1: -8.3, y0: 1.35, y1: 3.15 }];
    carBody(g, { L: 18.4, w: 3.0, yf: 1.3, ye: 3.45, col, roof: 'clerestory', roofH: 0.38, endDoors: true, benches: true, holes, frames: 0xd8c89a, inner: 0x3a3026 });
    for (const s of [-1, 1]) box(g, 0xd8b44a, s * 1.53, 3.25, 0, 0.02, 0.1, 15);
    return g;
  },
};
