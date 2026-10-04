// Ilyushin Il-2 (1941, single-seat): the Soviet armoured ground-attack plane, the "Shturmovik" - the armoured nose
// over the AM-38 V12, a raised cockpit, the outer wings swept back, the gear folding back into the nacelles under the
// wings (the wheels half out), two ShVAK cannons and two ShKAS, four 100 kg bombs
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, propeller, retractGear, tailWheel, gunBarrel, redStar, canopy, hoodGeo, hoodFrame, screenGeo, bombMesh } from './kit.js';

const BOMBS = [[2.6, -0.98, 1.4], [-2.6, -0.98, 1.4], [3.2, -0.94, 1.3], [-3.2, -0.94, 1.3]];

export default {
  key: 'il2', name: 'Ильюшин Ил-2', year: 1941, nation: 'su',
  palette: { main: 0x45553a, under: 0x9fb6c9, dark: 0x23291d, accent: 0x45553a, engine: 0x4a4a46 },
  mass: 5300, power: 1600, vmax: 115, vstall: 42, roll: 1.2, fuel: 535, fuelUse: 0.22, hp: 230, retract: true,
  guns: [{ w: 'shkas', at: [2.4, -0.62, 2.2], n: 750 }, { w: 'shkas', at: [-2.4, -0.62, 2.2], n: 750 }],
  cannons: [{ at: [2.0, -0.64, 2.4], rpm: 750, pen: 20, dmg: 0.3, speed: 760, n: 210 }, { at: [-2.0, -0.64, 2.4], rpm: 750, pen: 20, dmg: 0.3, speed: 760, n: 210 }],
  bombs: BOMBS.map(at => ({ at: [at[0], at[1] - 0.2, at[2]], kg: 100, dmg: 3.0, pen: 70 })),
  gear: { main: [1.75, -2.35, 1.4], tail: [0, -1.0, -5.8] },
  span: 14.6, len: 11.6, seat: [0, 1.05, 0.95],
  boxes: [[[-0.65, -1.0, -6.4], [0.65, 1.25, 4.9]], [[-7.3, -1.0, -0.8], [7.3, -0.2, 2.1]], [[-2.1, 0.0, -6.2], [2.1, 1.8, -4.4]]],

  model(P) {
    const root = new THREE.Group();
    fuselage(root, P.main, [{ z: 4.55, w: 0.92, h: 1.02, sq: 0.5, y: 0.1 }, { z: 3.0, w: 1.14, h: 1.34, sq: 0.55 }, { z: 1.2, w: 1.14, h: 1.46, sq: 0.55, y: 0.05 },
      { z: -1.5, w: 0.9, h: 1.1, sq: 0.45, y: 0.05 }, { z: -5.2, w: 0.22, h: 0.46, y: 0.2 }, { z: -6.4, w: 0.07, h: 0.3, y: 0.3 }], 16);
    add(root, U.box, P.dark, 0, -0.5, 3.6, 0.7, 0.18, 0.5);                                            // radiator intake
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(root, U.box, P.black, sx * 0.55, 0.08, 4.1 - i * 0.22, 0.06, 0.05, 0.12);
    // the raised canopy
    const glass = [hoodGeo([{ z: 1.9, w: 0.66, h: 0.38, y: 0.72 }, { z: 1.3, w: 0.72, h: 0.48, y: 0.72 }, { z: 0.4, w: 0.7, h: 0.46, y: 0.72 }, { z: 0.0, w: 0.5, h: 0.3, y: 0.72 }]),
      screenGeo(0, 0.92, 1.98, 0.58, 0.36, 0.75)];
    hoodFrame(root, P, [1.9, 1.3, 0.8, 0.4], 0.72, 0.72, 0.48);
    add(root, U.box, P.main, 0, 0.82, -0.8, 0.4, 0.3, 1.8, 0.1, 0, 0);
    // wings: a straight centre section with the nacelles, the outer panels swept back
    wing(root, P.main, { root: 0.55, span: 2.4, chord: [2.9, 2.6], le: 2.05, y: -0.62, dihedral: 0.02, segs: 1 });
    wing(root, P.main, { root: 2.4, span: 7.3, chord: [2.6, 1.25], le: 2.0, sweep: -1.0, y: -0.58, dihedral: 0.1, segs: 2 });
    wing(root, P.under, { root: 2.4, span: 7.3, chord: [2.6, 1.25], le: 2.0, sweep: -1.0, y: -0.61, dihedral: 0.1, t: 0.3, segs: 1 });
    for (const sx of [-1, 1]) {
      fuselage(root, P.main, [{ z: 2.0, w: 0.45, h: 0.45, y: -0.88, x: sx * 1.75 }, { z: 1.2, w: 0.55, h: 0.6, y: -0.92, x: sx * 1.75 }, { z: -0.6, w: 0.25, h: 0.3, y: -0.82, x: sx * 1.75 }], 10);
      add(root, U.box, P.rubber, sx * 1.75, -1.22, 1.15, 0.16, 0.32, 0.55);                            // the wheel half out of the nacelle
      gunBarrel(root, P, sx * 2.0, -0.64, 2.05, 0.55, 0.035);
      gunBarrel(root, P, sx * 2.4, -0.62, 2.05, 0.2, 0.015);
      redStar(root, P, sx * 5.2, -0.58 + Math.tan(0.1) * 2.8 + 0.08, 0.7, 0.55, 'up');
      redStar(root, P, sx * 5.2, -0.58 + Math.tan(0.1) * 2.8 - 0.06, 0.7, 0.55, 'down');
    }
    redStar(root, P, 0.4, 0.05, -2.8, 0.35, 'left');
    redStar(root, P, -0.4, 0.05, -2.8, 0.35, 'right');
    tailplane(root, P.main, { root: 0.1, span: 2.4, chord: [1.3, 0.8], le: -4.55, y: 0.3 });
    fin(root, P.main, { y0: 0.3, h: 1.25, chord: [1.5, 0.8], le: -4.75, round: true });
    redStar(root, P, 0.04, 0.85, -5.3, 0.3, 'left');
    redStar(root, P, -0.04, 0.85, -5.3, 0.3, 'right');
    canopy(root, glass);
    const bombs = BOMBS.map(([x, y, z]) => {
      add(root, U.box, P.dark, x, y + 0.1, z, 0.05, 0.12, 0.45);
      const b = bombMesh(P, 100);
      b.position.set(x, y - 0.2, z);
      root.add(b);
      return b;
    });
    const gear = retractGear(root, P, { x: 1.75, y: -1.95, z: 1.4, r: 0.42, top: -0.9, rake: 0.25 });
    tailWheel(root, P, -5.8, -1.0, 0.13, false, -0.35);
    const prop = propeller(P, { at: [0, 0.1, 4.92], r: 1.8, chord: 0.26, blades: 3, spinner: [0.3, 0.6] });
    root.add(prop);
    return { root, prop, gear, bombs };
  },
};
