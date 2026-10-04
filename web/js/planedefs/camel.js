// Sopwith Camel (1917): the British fighter that shot down more enemy aircraft than any other of the Great War -
// a short, nose-heavy biplane with the Clerget rotary in a round cowl, the "hump" over the twin Vickers guns, a flat
// upper wing and a lower one with dihedral, wooden propeller, V-strut undercarriage, the tail on a skid
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, strut, wire, propeller, ww1Gear, tailWheel, radial, gunBarrel, roundel } from './kit.js';

export default {
  key: 'camel', name: 'Sopwith Camel', year: 1917, nation: 'uk',
  palette: { main: 0x5a5131, under: 0xcfc6a6, dark: 0x2c2a22, accent: 0x9a9a92, engine: 0x4a4a46 },
  mass: 660, power: 130, vmax: 51, vstall: 21, roll: 3.0, fuel: 136, fuelUse: 0.035, hp: 100,
  guns: [{ w: 'vickers', at: [0.13, 0.56, 1.6], n: 500 }, { w: 'vickers', at: [-0.13, 0.56, 1.6], n: 500 }],
  gear: { main: [0.75, -1.58, 0.95], tail: [0, -0.62, -3.45] },
  span: 8.5, len: 5.7, seat: [0, 0.78, 0.12],
  boxes: [[[-0.45, -0.6, -3.7], [0.45, 0.7, 2.15]], [[-4.27, -0.62, -0.55], [4.27, 1.15, 1.02]], [[-1.6, -0.1, -3.7], [1.6, 0.95, -2.8]]],

  model(P) {
    const root = new THREE.Group();
    // fuselage: round cowl, boxy body tapering to the tail
    fuselage(root, P.accent, [{ z: 2.12, w: 0.9, h: 0.9 }, { z: 1.95, w: 1.0, h: 1.0 }, { z: 1.6, w: 0.95, h: 0.98 }]);
    add(root, U.disc, P.black, 0, 0.0, 2.125, 0.38, 1, 0.38, PI / 2, 0, 0);
    radial(root, P, 2.05, 0.42, 9);
    fuselage(root, P.main, [{ z: 1.6, w: 0.86, h: 0.96, sq: 0.5 }, { z: 0.9, w: 0.8, h: 1.0, sq: 0.85 }, { z: -0.4, w: 0.72, h: 0.92, sq: 0.85, y: -0.02 },
      { z: -2.0, w: 0.46, h: 0.62, sq: 0.85, y: 0.06 }, { z: -3.65, w: 0.1, h: 0.18, sq: 0.8, y: 0.16 }]);
    fuselage(root, P.under, [{ z: 1.0, w: 0.7, h: 0.3, y: -0.38, sq: 0.9 }, { z: -2.0, w: 0.4, h: 0.15, y: -0.2, sq: 0.9 }], 10);
    // the hump over the guns, the cockpit, the pilot's head
    add(root, U.box, P.main, 0, 0.52, 1.05, 0.42, 0.14, 0.8);
    gunBarrel(root, P, 0.13, 0.56, 0.7, 0.9, 0.028, true);
    gunBarrel(root, P, -0.13, 0.56, 0.7, 0.9, 0.028, true);
    add(root, U.box, P.leather, 0, 0.5, 0.05, 0.5, 0.04, 0.62);
    add(root, U.box, P.black, 0, 0.505, 0.05, 0.42, 0.04, 0.52);
    add(root, U.box, P.main, 0, 0.6, -0.4, 0.22, 0.2, 0.5);                                            // head rest
    // wings: flat upper, lower with dihedral; ailerons on both
    wing(root, P.main, { root: 0, span: 4.27, chord: [1.37, 1.37], le: 1.02, y: 1.05, segs: 2 });
    wing(root, P.under, { root: 0, span: 4.27, chord: [1.37, 1.37], le: 1.02, y: 1.02, t: 0.3, segs: 1 });
    wing(root, P.main, { root: 0.38, span: 4.1, chord: [1.37, 1.37], le: 0.85, y: -0.45, dihedral: 0.087, segs: 2 });
    wing(root, P.under, { root: 0.38, span: 4.1, chord: [1.37, 1.37], le: 0.85, y: -0.48, dihedral: 0.087, t: 0.3, segs: 1 });
    // struts and wires
    for (const sx of [-1, 1]) {
      const x = sx * 2.65, ly = -0.45 + Math.tan(0.087) * 2.27;
      strut(root, P.wood, [x, ly, 0.68], [x, 1.07, 0.85], 0.05);
      strut(root, P.wood, [x, ly, -0.38], [x, 1.07, -0.22], 0.05);
      strut(root, P.dark, [sx * 0.28, 0.46, 0.95], [sx * 0.42, 1.06, 0.88], 0.035);
      strut(root, P.dark, [sx * 0.28, 0.46, 0.2], [sx * 0.42, 1.06, -0.1], 0.035);
      wire(root, P.dark, [x, ly, 0.68], [sx * 0.4, 1.06, 0.85]);
      wire(root, P.dark, [x, 1.07, 0.85], [sx * 0.4, -0.35, 0.7]);
      wire(root, P.dark, [x, ly, -0.38], [sx * 0.4, 1.06, -0.2]);
    }
    // tail: tailplane, fin with the rudder stripes, skid
    tailplane(root, P.main, { root: 0, span: 1.6, chord: [0.85, 0.6], le: -2.85, y: 0.12 });
    fin(root, P.main, { y0: 0.18, h: 0.72, chord: [0.75, 0.32], le: -3.0, round: true });
    for (const [mat, dz] of [[P.blue, 0.3], [P.white, 0.15], [P.red, 0]]) add(root, U.box, mat, 0, 0.45, -3.68 + dz, 0.035, 0.6, 0.15);
    // markings
    for (const sx of [-1, 1]) {
      roundel(root, [[P.blue, 1], [P.white, 0.66], [P.red, 0.33]], sx * 3.1, 1.12, 0.35, 0.55, 'up');
      roundel(root, [[P.blue, 1], [P.white, 0.66], [P.red, 0.33]], sx * 3.0, -0.52, 0.2, 0.55, 'down');
      roundel(root, [[P.blue, 1], [P.white, 0.66], [P.red, 0.33]], sx * 0.27, 0.05, -1.75, 0.28, sx > 0 ? 'left' : 'right');
    }
    ww1Gear(root, P, { x: 0.75, y: -1.25, z: 0.95, r: 0.33, top: -0.42, zf: 1.25, zr: 0.55 });
    tailWheel(root, P, -3.45, -0.62, 0.1, true, -0.1);
    const prop = propeller(P, { at: [0, 0.0, 2.2], r: 1.3, chord: 0.16, wood: true });
    root.add(prop);
    return { root, prop, gear: null, bombs: [] };
  },
};
