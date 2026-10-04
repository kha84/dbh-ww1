// Fokker D.VII (1918): the best German fighter of the war - the six-cylinder Mercedes behind a car-type radiator at the
// nose, thick cantilever wings with N-struts, twin Spandau guns, an axle wing, lozenge camouflage and straight crosses
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, strut, propeller, ww1Gear, tailWheel, gunBarrel, cross } from './kit.js';

export default {
  key: 'fokkerD7', name: 'Fokker D.VII', year: 1918, nation: 'de',
  palette: { main: 0x4c4a5c, under: 0x8a95a8, dark: 0x252428, accent: 0x3e5340, engine: 0x4a4a46 },
  mass: 906, power: 180, vmax: 55, vstall: 22, roll: 2.4, fuel: 90, fuelUse: 0.045, hp: 110,
  guns: [{ w: 'lmg08', at: [0.12, 0.62, 2.0], n: 500 }, { w: 'lmg08', at: [-0.12, 0.62, 2.0], n: 500 }],
  gear: { main: [0.82, -1.63, 1.1], tail: [0, -0.6, -4.5] },
  span: 8.9, len: 7.0, seat: [0, 0.86, -0.25],
  boxes: [[[-0.45, -0.6, -4.7], [0.45, 0.75, 2.75]], [[-4.45, -0.6, -0.6], [4.45, 1.4, 1.15]], [[-1.6, -0.1, -4.7], [1.6, 1.05, -3.6]]],

  model(P) {
    const root = new THREE.Group();
    // the radiator at the nose, the engine cowling, the body
    fuselage(root, P.accent, [{ z: 2.72, w: 0.6, h: 0.78, sq: 0.8, y: 0.08 }, { z: 2.0, w: 0.74, h: 0.94, sq: 0.8, y: 0.04 }, { z: 1.3, w: 0.78, h: 0.98, sq: 0.85 }]);
    add(root, U.box, P.black, 0, 0.08, 2.73, 0.5, 0.66, 0.02);
    for (let i = 0; i < 8; i++) add(root, U.box, P.dark, -0.21 + i * 0.06, 0.08, 2.74, 0.012, 0.64, 0.01);
    fuselage(root, P.main, [{ z: 1.3, w: 0.78, h: 0.98, sq: 0.85 }, { z: 0.4, w: 0.8, h: 1.0, sq: 0.9 }, { z: -1.5, w: 0.56, h: 0.74, sq: 0.9, y: 0.04 },
      { z: -4.65, w: 0.1, h: 0.24, sq: 0.8, y: 0.2 }]);
    add(root, U.cylZ, P.metal, -0.42, 0.25, 1.6, 0.05, 0.05, 1.0);                                     // exhaust stack
    for (let i = 0; i < 6; i++) add(root, U.cyl, P.metal, -0.36, 0.22, 1.25 + i * 0.13, 0.025, 0.12, 0.025, 0, 0, PI / 2);
    add(root, U.box, P.leather, 0, 0.5, -0.25, 0.5, 0.04, 0.62);
    add(root, U.box, P.black, 0, 0.505, -0.25, 0.42, 0.04, 0.52);
    gunBarrel(root, P, 0.12, 0.62, 1.15, 0.85, 0.026, true);
    gunBarrel(root, P, -0.12, 0.62, 1.15, 0.85, 0.026, true);
    // thick cantilever wings, N-struts
    wing(root, P.main, { root: 0, span: 4.45, chord: [1.6, 1.4], le: 1.15, y: 1.3, t: 1.4, segs: 2 });
    wing(root, P.under, { root: 0, span: 4.45, chord: [1.6, 1.4], le: 1.15, y: 1.25, t: 0.4, segs: 1 });
    wing(root, P.main, { root: 0.4, span: 3.6, chord: [1.3, 1.1], le: 0.95, y: -0.4, t: 1.4, segs: 2 });
    for (const sx of [-1, 1]) {
      const x = sx * 2.65;
      strut(root, P.dark, [x, -0.38, 0.75], [x, 1.3, 0.95], 0.05);
      strut(root, P.dark, [x, -0.38, 0.0], [x, 1.3, 0.1], 0.05);
      strut(root, P.dark, [x, -0.38, 0.0], [x, 1.3, 0.95], 0.04);
      strut(root, P.dark, [sx * 0.3, 0.5, 1.15], [sx * 0.5, 1.3, 0.95], 0.04);
      strut(root, P.dark, [sx * 0.3, 0.5, 0.35], [sx * 0.5, 1.3, 0.1], 0.04);
    }
    tailplane(root, P.main, { root: 0, span: 1.6, chord: [1.0, 0.7], le: -3.85, y: 0.16 });
    fin(root, P.white, { y0: 0.2, h: 0.82, chord: [0.9, 0.45], le: -4.05, round: true });
    for (const sx of [-1, 1]) {
      cross(root, P, sx * 3.5, 1.4, 0.4, 0.38, 'up');
      cross(root, P, sx * 2.9, -0.46, 0.35, 0.32, 'down');
      cross(root, P, sx * 0.24, 0.1, -2.8, 0.22, sx > 0 ? 'left' : 'right');
    }
    cross(root, P, 0.02, 0.6, -4.45, 0.22, 'left');
    cross(root, P, -0.02, 0.6, -4.45, 0.22, 'right');
    ww1Gear(root, P, { x: 0.82, y: -1.25, z: 1.1, r: 0.38, top: -0.42, zf: 1.5, zr: 0.6, axleWing: true });
    tailWheel(root, P, -4.5, -0.6, 0.1, true, -0.1);
    const prop = propeller(P, { at: [0, 0.05, 2.82], r: 1.4, chord: 0.18, wood: true });
    root.add(prop);
    return { root, prop, gear: null, bombs: [] };
  },
};
