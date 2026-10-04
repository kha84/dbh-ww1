// Polikarpov Po-2 (U-2, 1928): the Soviet trainer and liaison biplane that became the "night witches'" night bomber -
// the five-cylinder M-11 radial out in the air, two open cockpits, single-bay wings, green over light blue, red
// stars; four small bombs under the lower wing (no forward gun)
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, strut, wire, propeller, ww1Gear, tailWheel, radial, redStar, bombMesh } from './kit.js';

const BOMBS = [[1.3, -0.72, 0.55], [-1.3, -0.72, 0.55], [1.9, -0.68, 0.55], [-1.9, -0.68, 0.55]];

export default {
  key: 'po2', name: 'Поликарпов По-2', year: 1928, nation: 'su',
  palette: { main: 0x4f6a3a, under: 0x9fb7c4, dark: 0x2c3326, accent: 0x4f6a3a, engine: 0x4a4a46 },
  mass: 1100, power: 115, vmax: 42, vstall: 17, roll: 1.6, fuel: 120, fuelUse: 0.03, hp: 110,
  guns: [],
  bombs: BOMBS.map(at => ({ at: [at[0], at[1] - 0.15, at[2]], kg: 50, dmg: 2.0, pen: 50 })),
  gear: { main: [0.9, -1.58, 1.3], tail: [0, -0.65, -5.0] },
  span: 11.4, len: 8.2, seat: [0, 0.85, 0.55],
  boxes: [[[-0.45, -0.6, -5.3], [0.45, 0.7, 2.8]], [[-5.7, -0.65, -0.5], [5.7, 1.45, 1.3]], [[-1.75, -0.1, -5.3], [1.75, 1.1, -4.2]]],

  model(P) {
    const root = new THREE.Group();
    radial(root, P, 2.55, 0.55, 5);
    add(root, U.cylZ, P.metal, 0, 0, 2.45, 0.22, 0.22, 0.3);
    fuselage(root, P.main, [{ z: 2.4, w: 0.7, h: 0.75 }, { z: 1.8, w: 0.86, h: 0.98, sq: 0.6 }, { z: -0.5, w: 0.8, h: 1.0, sq: 0.85 },
      { z: -2.6, w: 0.46, h: 0.62, sq: 0.85, y: 0.05 }, { z: -5.25, w: 0.1, h: 0.22, sq: 0.8, y: 0.16 }]);
    for (const z of [0.55, -0.55]) {
      add(root, U.box, P.leather, 0, 0.5, z, 0.52, 0.04, 0.62);
      add(root, U.box, P.black, 0, 0.505, z, 0.44, 0.04, 0.52);
      add(root, U.box, P.glass, 0, 0.62, z + 0.38, 0.4, 0.2, 0.02, -0.4, 0, 0);
    }
    // single-bay wings
    wing(root, P.main, { root: 0, span: 5.7, chord: [1.65, 1.5], le: 1.3, y: 1.35, dihedral: 0.03, segs: 2 });
    wing(root, P.under, { root: 0, span: 5.7, chord: [1.65, 1.5], le: 1.3, y: 1.32, dihedral: 0.03, t: 0.3, segs: 1 });
    wing(root, P.main, { root: 0.4, span: 5.4, chord: [1.65, 1.5], le: 1.3, y: -0.5, dihedral: 0.05, segs: 2 });
    wing(root, P.under, { root: 0.4, span: 5.4, chord: [1.65, 1.5], le: 1.3, y: -0.53, dihedral: 0.05, t: 0.3, segs: 1 });
    for (const sx of [-1, 1]) {
      const x = sx * 3.2, ly = -0.5 + Math.tan(0.05) * 2.8, uy = 1.35 + Math.tan(0.03) * 3.2;
      strut(root, P.dark, [x, ly, 1.05], [x, uy, 1.05], 0.05);
      strut(root, P.dark, [x, ly, 0.0], [x, uy, 0.0], 0.05);
      wire(root, P.dark, [x, ly, 1.05], [sx * 0.4, 1.35, 1.0]);
      wire(root, P.dark, [x, uy, 0.0], [sx * 0.4, -0.4, 0.1]);
      strut(root, P.dark, [sx * 0.3, 0.48, 1.4], [sx * 0.45, 1.35, 1.2], 0.04);
      strut(root, P.dark, [sx * 0.3, 0.48, 0.25], [sx * 0.45, 1.35, 0.1], 0.04);
    }
    tailplane(root, P.main, { root: 0, span: 1.75, chord: [1.0, 0.7], le: -4.35, y: 0.12 });
    fin(root, P.main, { y0: 0.15, h: 0.95, chord: [0.9, 0.5], le: -4.55, round: true });
    for (const sx of [-1, 1]) {
      redStar(root, P, sx * 4.4, 1.43, 0.55, 0.5, 'up');
      redStar(root, P, sx * 4.2, -0.58, 0.55, 0.5, 'down');
    }
    redStar(root, P, 0.03, 0.55, -4.85, 0.3, 'left');
    redStar(root, P, -0.03, 0.55, -4.85, 0.3, 'right');
    // the bomb racks
    const bombs = BOMBS.map(([x, y, z]) => {
      add(root, U.box, P.dark, x, y + 0.12, z, 0.05, 0.12, 0.4);
      const b = bombMesh(P, 50);
      b.position.set(x, y - 0.15, z);
      root.add(b);
      return b;
    });
    ww1Gear(root, P, { x: 0.9, y: -1.2, z: 1.3, r: 0.38, top: -0.45, zf: 1.7, zr: 0.7 });
    tailWheel(root, P, -5.0, -0.65, 0.1, true, -0.15);
    const prop = propeller(P, { at: [0, 0, 2.85], r: 1.4, chord: 0.17, wood: true });
    root.add(prop);
    return { root, prop, gear: null, bombs };
  },
};
