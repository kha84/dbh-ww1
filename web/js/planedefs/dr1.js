// Fokker Dr.I (1917): the German triplane of the Red Baron - three short thick wings stacked over a slab-sided
// fuselage, a single I-strut on each side, the Oberursel rotary in a round cowl, two Spandau guns, the comma rudder,
// a little wing on the undercarriage axle; Richthofen's red all over, white-edged crosses
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, strut, wire, propeller, ww1Gear, tailWheel, radial, gunBarrel, cross } from './kit.js';

export default {
  key: 'dr1', name: 'Fokker Dr.I', year: 1917, nation: 'de',
  palette: { main: 0x9a2018, under: 0x8a1c15, dark: 0x2a1a14, accent: 0x9a2018, engine: 0x4a4a46 },
  mass: 586, power: 110, vmax: 46, vstall: 19, roll: 2.9, fuel: 72, fuelUse: 0.03, hp: 90,
  guns: [{ w: 'lmg08', at: [0.12, 0.5, 1.45], n: 500 }, { w: 'lmg08', at: [-0.12, 0.5, 1.45], n: 500 }],
  gear: { main: [0.7, -1.48, 0.9], tail: [0, -0.6, -3.6] },
  span: 7.2, len: 5.8, seat: [0, 0.74, -0.05],
  boxes: [[[-0.45, -0.55, -3.8], [0.45, 0.62, 2.0]], [[-3.6, -0.62, -0.3], [3.6, 1.3, 1.0]], [[-1.0, -0.1, -3.8], [1.0, 0.9, -2.9]]],

  model(P) {
    const root = new THREE.Group();
    fuselage(root, P.accent, [{ z: 1.98, w: 0.86, h: 0.84 }, { z: 1.85, w: 0.95, h: 0.92 }, { z: 1.5, w: 0.9, h: 0.9 }]);
    add(root, U.disc, P.black, 0, 0, 1.985, 0.36, 1, 0.36, PI / 2, 0, 0);
    radial(root, P, 1.9, 0.4, 9);
    fuselage(root, P.main, [{ z: 1.5, w: 0.78, h: 0.86, sq: 0.6 }, { z: 0.6, w: 0.68, h: 0.88, sq: 0.9 }, { z: -0.5, w: 0.62, h: 0.82, sq: 0.9 },
      { z: -2.0, w: 0.38, h: 0.52, sq: 0.9, y: 0.04 }, { z: -3.75, w: 0.08, h: 0.18, sq: 0.8, y: 0.12 }]);
    add(root, U.box, P.leather, 0, 0.44, -0.05, 0.46, 0.04, 0.6);
    add(root, U.box, P.black, 0, 0.445, -0.05, 0.38, 0.04, 0.5);
    gunBarrel(root, P, 0.12, 0.5, 0.75, 0.75, 0.026, true);
    gunBarrel(root, P, -0.12, 0.5, 0.75, 0.75, 0.026, true);
    // three wings, thick and short
    wing(root, P.main, { root: 0, span: 3.6, chord: [1.0, 1.0], le: 0.95, y: 1.2, t: 1.5, segs: 2 });
    wing(root, P.main, { root: 0.34, span: 3.45, chord: [1.0, 1.0], le: 0.82, y: 0.32, t: 1.5, segs: 2 });
    wing(root, P.main, { root: 0.3, span: 3.2, chord: [1.0, 1.0], le: 0.72, y: -0.5, t: 1.5, segs: 2 });
    for (const sx of [-1, 1]) {
      add(root, U.box, P.main, sx * 2.55, 0.35, 0.45, 0.06, 1.75, 0.32);                         // I-strut
      strut(root, P.dark, [sx * 0.25, 0.42, 0.85], [sx * 0.32, 1.2, 0.8], 0.035);
      strut(root, P.dark, [sx * 0.25, 0.42, 0.25], [sx * 0.32, 1.2, 0.1], 0.035);
      wire(root, P.dark, [sx * 2.55, -0.45, 0.6], [sx * 0.3, 1.2, 0.6]);
    }
    tailplane(root, P.main, { root: 0, span: 1.05, chord: [1.0, 0.35], le: -2.95, sweep: -0.35, y: 0.06 });
    fin(root, P.white, { y0: 0.08, h: 0.78, chord: [0.62, 0.38], le: -3.3, round: true });
    // the crosses on white
    for (const sx of [-1, 1]) {
      cross(root, P, sx * 2.6, 1.29, 0.45, 0.32, 'up', true);
      cross(root, P, sx * 2.4, -0.56, 0.25, 0.3, 'down', true);
      cross(root, P, sx * 0.2, 0.08, -2.3, 0.2, sx > 0 ? 'left' : 'right', true);
    }
    ww1Gear(root, P, { x: 0.7, y: -1.15, z: 0.9, r: 0.33, top: -0.38, zf: 1.2, zr: 0.5, axleWing: true });
    tailWheel(root, P, -3.6, -0.6, 0.1, true, -0.12);
    const prop = propeller(P, { at: [0, 0, 2.05], r: 1.3, chord: 0.16, wood: true });
    root.add(prop);
    return { root, prop, gear: null, bombs: [] };
  },
};
