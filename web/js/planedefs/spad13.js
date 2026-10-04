// SPAD S.XIII (1917): the fast French biplane flown by Guynemer, Fonck and Rickenbacker - the Hispano-Suiza V8
// behind a round flat radiator, two-bay wings with the intermediate bracing, twin Vickers on top, French cockades and
// the striped rudder
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, strut, wire, propeller, ww1Gear, tailWheel, gunBarrel, roundel } from './kit.js';

const COCKADE = P => [[P.red, 1], [P.white, 0.66], [P.blue, 0.33]];

export default {
  key: 'spad13', name: 'SPAD S.XIII', year: 1917, nation: 'fr',
  palette: { main: 0x6b6545, under: 0xd6cfb5, dark: 0x2c2a22, accent: 0xa8a8a0, engine: 0x4a4a46 },
  mass: 856, power: 220, vmax: 61, vstall: 25, roll: 2.2, fuel: 115, fuelUse: 0.05, hp: 110,
  guns: [{ w: 'vickers', at: [0.13, 0.56, 1.75], n: 400 }, { w: 'vickers', at: [-0.13, 0.56, 1.75], n: 400 }],
  gear: { main: [0.8, -1.55, 1.0], tail: [0, -0.65, -4.1] },
  span: 8.2, len: 6.3, seat: [0, 0.8, -0.1],
  boxes: [[[-0.45, -0.6, -4.35], [0.45, 0.68, 2.35]], [[-4.1, -0.62, -0.5], [4.1, 1.25, 1.1]], [[-1.5, -0.1, -4.35], [1.5, 0.9, -3.4]]],

  model(P) {
    const root = new THREE.Group();
    // the round radiator, the cowl over the V8, the boxy body
    fuselage(root, P.accent, [{ z: 2.32, w: 0.78, h: 0.82 }, { z: 2.2, w: 0.84, h: 0.88 }, { z: 1.3, w: 0.82, h: 0.92, sq: 0.5 }]);
    add(root, U.disc, P.black, 0, 0, 2.325, 0.34, 1, 0.34, PI / 2, 0, 0);
    for (let i = 0; i < 6; i++) add(root, U.box, P.dark, 0, -0.26 + i * 0.1, 2.33, 0.6, 0.02, 0.01);
    fuselage(root, P.main, [{ z: 1.3, w: 0.8, h: 0.92, sq: 0.7 }, { z: 0.4, w: 0.78, h: 0.96, sq: 0.85 }, { z: -0.8, w: 0.7, h: 0.88, sq: 0.85 },
      { z: -2.4, w: 0.42, h: 0.56, sq: 0.85, y: 0.05 }, { z: -4.3, w: 0.08, h: 0.18, sq: 0.8, y: 0.14 }]);
    for (const sx of [-1, 1]) add(root, U.cylZ, P.metal, sx * 0.43, -0.05, 1.5, 0.04, 0.04, 0.9);      // exhausts
    add(root, U.box, P.leather, 0, 0.48, -0.1, 0.5, 0.04, 0.62);
    add(root, U.box, P.black, 0, 0.485, -0.1, 0.42, 0.04, 0.52);
    gunBarrel(root, P, 0.13, 0.56, 0.9, 0.85, 0.028, true);
    gunBarrel(root, P, -0.13, 0.56, 0.9, 0.85, 0.028, true);
    // two-bay wings
    wing(root, P.main, { root: 0, span: 4.1, chord: [1.4, 1.4], le: 1.05, y: 1.15, segs: 2 });
    wing(root, P.under, { root: 0, span: 4.1, chord: [1.4, 1.4], le: 1.05, y: 1.12, t: 0.3, segs: 1 });
    wing(root, P.main, { root: 0.4, span: 3.95, chord: [1.2, 1.2], le: 0.8, y: -0.45, dihedral: 0.04, segs: 2 });
    for (const sx of [-1, 1]) {
      for (const x of [1.7, 3.3]) {
        const ly = -0.45 + Math.tan(0.04) * (x - 0.4);
        strut(root, P.wood, [sx * x, ly, 0.6], [sx * x, 1.17, 0.9], 0.05);
        strut(root, P.wood, [sx * x, ly, -0.25], [sx * x, 1.17, 0.0], 0.05);
        wire(root, P.dark, [sx * x, ly, 0.6], [sx * (x - 1.4), 1.17, 0.9]);
      }
      strut(root, P.dark, [sx * 0.3, 0.46, 1.1], [sx * 0.4, 1.15, 0.95], 0.035);
      strut(root, P.dark, [sx * 0.3, 0.46, 0.35], [sx * 0.4, 1.15, 0.0], 0.035);
    }
    tailplane(root, P.main, { root: 0, span: 1.5, chord: [0.9, 0.6], le: -3.55, y: 0.1 });
    fin(root, P.main, { y0: 0.12, h: 0.75, chord: [0.8, 0.4], le: -3.7, round: true });
    for (const [mat, dz] of [[P.blue, 0.3], [P.white, 0.15], [P.red, 0]]) add(root, U.box, mat, 0, 0.42, -4.28 + dz, 0.035, 0.6, 0.15);
    for (const sx of [-1, 1]) {
      roundel(root, COCKADE(P), sx * 3.2, 1.22, 0.35, 0.6, 'up');
      roundel(root, COCKADE(P), sx * 3.1, -0.52, 0.2, 0.52, 'down');
      roundel(root, COCKADE(P), sx * 0.36, 0.05, -1.8, 0.3, sx > 0 ? 'left' : 'right');
    }
    ww1Gear(root, P, { x: 0.8, y: -1.2, z: 1.0, r: 0.35, top: -0.42, zf: 1.35, zr: 0.55 });
    tailWheel(root, P, -4.1, -0.65, 0.1, true, -0.12);
    const prop = propeller(P, { at: [0, 0, 2.42], r: 1.25, chord: 0.17, wood: true });
    root.add(prop);
    return { root, prop, gear: null, bombs: [] };
  },
};
