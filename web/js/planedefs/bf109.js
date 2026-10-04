// Messerschmitt Bf 109 E (1937 B, "Emil" of 1939): the German fighter of the Battle of Britain - the slim nose of the
// inverted DB 601 V12 with its spinner, a framed canopy, square-tipped low wings with the MG FF cannons, the braced
// tailplane, narrow-track gear folding outwards; grey-green over light blue, the black crosses
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, strut, propeller, retractGear, tailWheel, gunBarrel, cross, canopy, hoodGeo, hoodFrame, screenGeo } from './kit.js';

export default {
  key: 'bf109', name: 'Messerschmitt Bf 109 E', year: 1937, nation: 'de',
  palette: { main: 0x5d6450, under: 0x9fb6c9, dark: 0x353a30, accent: 0x5d6450, engine: 0x4a4a46 },
  mass: 2610, power: 1100, vmax: 155, vstall: 41, roll: 2.1, fuel: 400, fuelUse: 0.17, hp: 130, retract: true,
  guns: [{ w: 'mg17', at: [0.16, 0.42, 2.9], n: 1000 }, { w: 'mg17', at: [-0.16, 0.42, 2.9], n: 1000 }],
  cannons: [{ at: [2.0, -0.38, 1.35], rpm: 520, pen: 18, dmg: 0.3, speed: 600, n: 60 }, { at: [-2.0, -0.38, 1.35], rpm: 520, pen: 18, dmg: 0.3, speed: 600, n: 60 }],
  gear: { main: [1.0, -1.93, 1.2], tail: [0, -1.0, -4.2] },
  span: 9.9, len: 8.6, seat: [0, 0.8, 0.3],
  boxes: [[[-0.5, -0.65, -5.0], [0.5, 0.9, 3.7]], [[-4.95, -0.6, -0.45], [4.95, -0.1, 1.65]], [[-1.65, 0.0, -4.7], [1.65, 1.3, -3.4]]],

  model(P) {
    const root = new THREE.Group();
    fuselage(root, P.main, [{ z: 3.4, w: 0.66, h: 0.74, y: 0.0 }, { z: 2.4, w: 0.88, h: 1.06, sq: 0.3 }, { z: 0.6, w: 0.9, h: 1.15, sq: 0.35 },
      { z: -1.5, w: 0.66, h: 0.86, sq: 0.3, y: 0.02 }, { z: -4.1, w: 0.16, h: 0.36, y: 0.1 }, { z: -4.95, w: 0.04, h: 0.24, y: 0.15 }], 16);
    fuselage(root, P.under, [{ z: 2.6, w: 0.5, h: 0.3, y: -0.52 }, { z: 0.0, w: 0.5, h: 0.3, y: -0.5 }], 10);
    add(root, U.box, P.dark, -0.5, 0.15, 2.2, 0.12, 0.25, 0.4);                                         // supercharger intake
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(root, U.box, P.black, sx * 0.43, -0.18, 2.95 - i * 0.18, 0.06, 0.05, 0.1);   // exhausts
    gunBarrel(root, P, 0.16, 0.42, 2.6, 0.3, 0.02);
    gunBarrel(root, P, -0.16, 0.42, 2.6, 0.3, 0.02);
    // framed canopy
    const glass = [hoodGeo([{ z: 1.15, w: 0.62, h: 0.36, y: 0.5 }, { z: 0.6, w: 0.66, h: 0.42, y: 0.5 }, { z: -0.25, w: 0.6, h: 0.36, y: 0.5 }, { z: -0.6, w: 0.44, h: 0.2, y: 0.5 }]),
      screenGeo(0, 0.68, 1.2, 0.55, 0.32, 0.9)];
    hoodFrame(root, P, [1.15, 0.6, 0.1, -0.25], 0.64, 0.5, 0.42);
    add(root, U.box, P.dark, 0, 0.92, 0.45, 0.04, 0.03, 1.4);
    // square-tipped wings with the cannons, radiators under them
    wing(root, P.main, { root: 0.35, span: 4.95, chord: [2.0, 1.05], le: 1.65, sweep: -0.35, y: -0.42, dihedral: 0.1, segs: 2 });
    wing(root, P.under, { root: 0.35, span: 4.95, chord: [2.0, 1.05], le: 1.65, sweep: -0.35, y: -0.45, dihedral: 0.1, t: 0.3, segs: 1 });
    for (const sx of [-1, 1]) {
      gunBarrel(root, P, sx * 2.0, -0.38 + Math.tan(0.1) * 1.65, 1.35, 0.25, 0.035);
      add(root, U.box, P.under, sx * 1.6, -0.55 + Math.tan(0.1) * 1.25, 0.6, 0.55, 0.15, 0.8);
      cross(root, P, sx * 3.7, -0.45 + Math.tan(0.1) * 3.35 + 0.08, 0.35, 0.42, 'up');
      cross(root, P, sx * 3.7, -0.45 + Math.tan(0.1) * 3.35 - 0.06, 0.35, 0.42, 'down');
      cross(root, P, sx * 0.3, 0.05, -2.2, 0.32, sx > 0 ? 'left' : 'right');
    }
    tailplane(root, P.main, { root: 0.05, span: 1.6, chord: [0.95, 0.55], le: -3.65, y: 0.45 });
    for (const sx of [-1, 1]) strut(root, P.dark, [sx * 0.1, -0.05, -3.95], [sx * 0.85, 0.42, -3.95], 0.035);
    fin(root, P.main, { y0: 0.25, h: 1.0, chord: [1.1, 0.55], le: -3.75, round: true });
    canopy(root, glass);
    const gear = retractGear(root, P, { x: 1.0, y: -1.6, z: 1.2, r: 0.33, top: -0.45, legTopX: 0.7, doors: true });
    tailWheel(root, P, -4.2, -1.0, 0.11, false, -0.15);
    const prop = propeller(P, { at: [0, 0, 3.55], r: 1.55, chord: 0.22, blades: 3, spinner: [0.24, 0.55] });
    root.add(prop);
    return { root, prop, gear, bombs: [] };
  },
};
