// Junkers Ju 87 B "Stuka" (1937): the German dive bomber - the inverted gull wing with the big fixed spatted
// undercarriage at its knees, the chin radiator under the Jumo V12, the long glazed canopy over pilot and gunner, the
// braced tailplane; a 250 kg bomb under the belly and four 50 kg ones under the wings
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, strut, propeller, tailWheel, wheel, gunBarrel, cross, canopy, hoodGeo, hoodFrame, bombMesh } from './kit.js';

const WING_BOMBS = [[3.2, -0.98, 1.35], [-3.2, -0.98, 1.35], [3.8, -0.92, 1.3], [-3.8, -0.92, 1.3]];
const BELLY = [0, -1.35, 0.8];

export default {
  key: 'ju87', name: 'Junkers Ju 87 B «Штука»', year: 1937, nation: 'de',
  palette: { main: 0x3e4a38, under: 0x9fb6c9, dark: 0x2a3027, accent: 0x3e4a38, engine: 0x4a4a46 },
  mass: 4250, power: 1200, vmax: 108, vstall: 39, roll: 1.3, fuel: 480, fuelUse: 0.18, hp: 170,
  guns: [{ w: 'mg17', at: [2.45, -1.0, 2.0], n: 500 }, { w: 'mg17', at: [-2.45, -1.0, 2.0], n: 500 }],
  bombs: [...WING_BOMBS.map(at => ({ at: [at[0], at[1] - 0.2, at[2]], kg: 50, dmg: 2.0, pen: 50 })),
    { at: [BELLY[0], BELLY[1] - 0.3, BELLY[2]], kg: 250, dmg: 4.5, pen: 80 }],
  gear: { main: [2.25, -2.67, 1.6], tail: [0, -1.0, -5.6] },
  span: 13.8, len: 11.1, seat: [0, 1.0, 1.15],
  boxes: [[[-0.6, -1.2, -6.3], [0.6, 1.15, 4.7]], [[-6.9, -1.35, -0.55], [6.9, -0.15, 2.1]], [[-2.2, 0.2, -6.0], [2.2, 2.0, -4.3]]],

  model(P) {
    const root = new THREE.Group();
    fuselage(root, P.main, [{ z: 4.4, w: 0.85, h: 1.0, sq: 0.4, y: 0.1 }, { z: 3.0, w: 1.08, h: 1.38, sq: 0.5 }, { z: 1.0, w: 1.1, h: 1.5, sq: 0.5 },
      { z: -1.5, w: 0.86, h: 1.12, sq: 0.45, y: 0.05 }, { z: -5.3, w: 0.22, h: 0.5, y: 0.25 }, { z: -6.3, w: 0.08, h: 0.3, y: 0.35 }], 16);
    fuselage(root, P.under, [{ z: 4.0, w: 0.6, h: 0.45, sq: 0.6, y: -0.6 }, { z: 3.3, w: 0.66, h: 0.55, sq: 0.6, y: -0.62 }, { z: 2.4, w: 0.5, h: 0.3, sq: 0.6, y: -0.55 }], 10);
    add(root, U.box, P.black, 0, -0.62, 4.02, 0.5, 0.36, 0.02);                                        // chin radiator
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(root, U.box, P.black, sx * 0.5, 0.05, 4.0 - i * 0.2, 0.06, 0.05, 0.11);
    // the long canopy over two seats
    const glass = [hoodGeo([{ z: 2.0, w: 0.74, h: 0.4, y: 0.72 }, { z: 1.4, w: 0.8, h: 0.5, y: 0.72 }, { z: -0.3, w: 0.8, h: 0.5, y: 0.72 }, { z: -0.9, w: 0.7, h: 0.35, y: 0.72 }])];
    hoodFrame(root, P, [2.0, 1.4, 0.8, 0.2, -0.3, -0.9], 0.8, 0.72, 0.5);
    gunBarrel(root, P, 0, 1.0, -1.1, 0.5, 0.02);
    // inverted gull wings (down to the knee, then up), the dive brakes under them
    wing(root, P.main, { root: 0.45, span: 6.9, chord: [2.6, 1.3], le: 2.05, sweep: -0.35, y: -0.75, dihedral: 0.16, gull: { x: 2.25, dy: -0.38 }, segs: 6 });
    wing(root, P.under, { root: 0.45, span: 6.9, chord: [2.6, 1.3], le: 2.05, sweep: -0.35, y: -0.79, dihedral: 0.16, gull: { x: 2.25, dy: -0.38 }, t: 0.3, segs: 6 });
    for (const sx of [-1, 1]) {
      add(root, U.box, P.dark, sx * 4.4, -1.0, 0.95, 1.8, 0.04, 0.12);
      gunBarrel(root, P, sx * 2.45, -1.0, 1.9, 0.25, 0.02);
      cross(root, P, sx * 5.0, -1.13 + Math.tan(0.16) * 2.75 + 0.1, 0.6, 0.5, 'up');
      cross(root, P, sx * 5.0, -1.13 + Math.tan(0.16) * 2.75 - 0.05, 0.6, 0.5, 'down');
      cross(root, P, sx * 0.4, 0.05, -2.6, 0.38, sx > 0 ? 'left' : 'right');
      // the fixed gear at the knee: a trousered leg and a spat
      const x = sx * 2.25;
      add(root, U.box, P.main, x, -1.6, 1.65, 0.3, 1.0, 0.75);
      add(root, U.sph, P.main, x, -2.2, 1.6, 0.18, 0.42, 0.62);
      wheel(root, P, x, -2.25, 1.6, 0.42, 0.18);
    }
    tailplane(root, P.main, { root: 0.1, span: 2.6, chord: [1.4, 0.9], le: -4.45, y: 0.62 });
    for (const sx of [-1, 1]) strut(root, P.dark, [sx * 0.2, -0.05, -4.9], [sx * 1.3, 0.58, -4.9], 0.04);
    fin(root, P.main, { y0: 0.4, h: 1.4, chord: [1.6, 0.9], le: -4.6, round: true });
    canopy(root, glass);
    // bombs: four under the wings, the big one on its crutch under the belly
    const bombs = WING_BOMBS.map(([x, y, z]) => {
      add(root, U.box, P.dark, x, y + 0.1, z, 0.05, 0.12, 0.4);
      const b = bombMesh(P, 50);
      b.position.set(x, y - 0.2, z);
      root.add(b);
      return b;
    });
    add(root, U.box, P.dark, 0, -1.0, 0.8, 0.08, 0.25, 0.5);
    const big = bombMesh(P, 250);
    big.position.set(BELLY[0], BELLY[1] - 0.3, BELLY[2]);
    root.add(big);
    bombs.push(big);
    tailWheel(root, P, -5.6, -1.0, 0.13, false, -0.4);
    const prop = propeller(P, { at: [0, 0.1, 4.75], r: 1.7, chord: 0.24, blades: 3, spinner: [0.3, 0.6] });
    root.add(prop);
    return { root, prop, gear: null, bombs };
  },
};
