// Четырёхосная платформа (1900s-): a flat wagon with low drop sides - in the military trains with a machine under
// a tarpaulin lashed on top (or a load of logs / crates).
import * as THREE from 'three';
import { PI, C, box, put, GEO, cylZ } from './kit.js';
import { underframe } from './cars.js';

export default {
  key: 'flat', name: 'Платформа с грузом', kind: 'car', cls: 'freight', years: [1900, 2015],
  len: 13.8, mass: 45, pivots: [4.8, -4.8],
  riders: [{ pos: [1.1, 1.35, 5.8], ry: PI / 2, stance: 'crouch' }, { pos: [-1.1, 1.35, -5.8], ry: -PI / 2, stance: 'crouch' }],
  variants: [0x4a4a42, 0x5a3e2c, 0x4a5240],
  build(v = 0) {
    const g = new THREE.Group();
    underframe(g, { L: 13.8, yf: 1.3, bogies: [4.8, -4.8], r: 0.47 });
    box(g, C.wood, 0, 1.25, 0, 2.85, 0.12, 13.3);
    for (const s of [-1, 1]) {
      box(g, 0x4a4036, s * 1.42, 1.45, 0, 0.06, 0.32, 13.3);
      for (let z = -6; z <= 6; z += 2) box(g, C.iron, s * 1.46, 1.55, z, 0.07, 0.5, 0.1);
    }
    const kind = v % 3;
    if (kind === 0) {                                                          // a tank under a tarpaulin
      const t = 0x4f5a3c;
      box(g, C.black, 0, 1.75, 0, 2.6, 0.75, 6.2);
      for (const s of [-1, 1]) box(g, t, s * 1.15, 2.05, 0, 0.35, 0.65, 6.0);
      box(g, t, 0, 2.55, -0.3, 2.7, 0.9, 5.6);
      put(g, GEO.arch, t, 0, 3.0, 0.3, 0.95, 0.75, 2.4);
      cylZ(g, t, 0, 3.2, 2.6, 0.13, 2.6);
      for (const z of [-2.2, 0, 2.2]) box(g, 0x9a8a6a, 0, 2.55, z, 2.75, 1.0, 0.06);           // ropes
    } else if (kind === 1) {                                                   // logs
      for (let i = 0; i < 9; i++) cylZ(g, 0x7a5a3a, -1.0 + (i % 3) * 1.0, 1.65 + Math.floor(i / 3) * 0.62, 0, 0.32, 12.6, { r: 1, m: 0 });
      for (const z of [-5, 0, 5]) for (const s of [-1, 1]) box(g, C.iron, s * 1.5, 2.4, z, 0.08, 2.2, 0.1);
    } else {                                                                   // army crates
      for (let i = 0; i < 12; i++) box(g, i % 3 ? 0x6b5a34 : 0x4f5a3c, (i % 2 - 0.5) * 1.3, 1.75 + (i % 3 === 2 ? 0.95 : 0), -5 + Math.floor(i / 2) * 1.9, 1.2, 0.9, 1.7);
    }
    return g;
  },
};
