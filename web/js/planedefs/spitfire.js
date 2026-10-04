// Supermarine Spitfire Mk I (1938): the British fighter of the Battle of Britain - the Merlin V12 under a long slim
// cowl, the elliptical wing with eight Browning machine guns, a bubble canopy, the radiator under the right wing,
// dark green over sky, RAF roundels
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, propeller, retractGear, tailWheel, gunBarrel, roundel, canopy, hoodGeo, hoodFrame, screenGeo } from './kit.js';

const GUN_X = [1.9, 2.15, 2.45, 2.75];

export default {
  key: 'spitfire', name: 'Supermarine Spitfire Mk I', year: 1938, nation: 'uk',
  palette: { main: 0x4f5434, under: 0xc4c8b8, dark: 0x2a2c22, accent: 0x4f5434, engine: 0x4a4a46 },
  mass: 2690, power: 1030, vmax: 160, vstall: 37, roll: 2.1, fuel: 386, fuelUse: 0.16, hp: 125, retract: true,
  guns: GUN_X.flatMap(x => [{ w: 'br303', at: [x, -0.4, 2.0 - (x - 1.9) * 0.15], n: 300 }, { w: 'br303', at: [-x, -0.4, 2.0 - (x - 1.9) * 0.15], n: 300 }]),
  gear: { main: [0.95, -1.99, 1.6], tail: [0, -1.06, -4.0] },
  span: 11.2, len: 9.1, seat: [0, 0.86, 0.75],
  boxes: [[[-0.5, -0.65, -4.65], [0.5, 0.95, 4.45]], [[-5.6, -0.65, -0.45], [5.6, 0.0, 2.15]], [[-1.7, 0.0, -4.4], [1.7, 1.45, -3.0]]],

  model(P) {
    const root = new THREE.Group();
    fuselage(root, P.main, [{ z: 4.1, w: 0.62, h: 0.78, y: 0.12 }, { z: 3.0, w: 0.84, h: 1.02, sq: 0.25, y: 0.05 }, { z: 1.2, w: 0.86, h: 1.16, sq: 0.3 },
      { z: -1.0, w: 0.68, h: 0.96, sq: 0.25, y: 0.05 }, { z: -3.8, w: 0.18, h: 0.5, y: 0.2 }, { z: -4.62, w: 0.05, h: 0.34, y: 0.26 }], 16);
    fuselage(root, P.under, [{ z: 3.0, w: 0.5, h: 0.3, y: -0.5 }, { z: 0.0, w: 0.5, h: 0.3, y: -0.5 }], 10);
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(root, U.box, P.black, sx * 0.42, 0.18, 3.6 - i * 0.2, 0.06, 0.05, 0.1);
    // bubble canopy, windscreen, the frame
    const glass = [hoodGeo([{ z: 1.35, w: 0.56, h: 0.34, y: 0.55 }, { z: 0.85, w: 0.64, h: 0.44, y: 0.55 }, { z: 0.25, w: 0.6, h: 0.4, y: 0.55 }, { z: -0.1, w: 0.42, h: 0.24, y: 0.55 }]),
      screenGeo(0, 0.72, 1.42, 0.5, 0.3, 0.8)];
    hoodFrame(root, P, [1.35, 0.3], 0.6, 0.55, 0.42);
    add(root, U.box, P.main, 0, 0.62, -0.9, 0.3, 0.22, 1.6, 0.12, 0, 0);
    // the elliptical wing, eight guns, the radiator under the right wing
    wing(root, P.main, { root: 0.4, span: 5.6, chord: [2.5, 0.35], le: 2.15, y: -0.42, dihedral: 0.105, ell: true, segs: 8 });
    wing(root, P.under, { root: 0.4, span: 5.6, chord: [2.5, 0.35], le: 2.15, y: -0.45, dihedral: 0.105, ell: true, t: 0.3, segs: 8 });
    for (const x of GUN_X) for (const sx of [-1, 1]) gunBarrel(root, P, sx * x, -0.4 + Math.tan(0.105) * (x - 0.4), 1.95 - (x - 1.9) * 0.15, 0.08, 0.012);
    add(root, U.box, P.under, -1.3, -0.62, 0.75, 0.45, 0.2, 0.9);
    add(root, U.cylZ, P.under, 1.3, -0.58, 0.9, 0.14, 0.1, 0.6);
    for (const sx of [-1, 1]) {
      roundel(root, [[P.blue, 1], [P.red, 0.45]], sx * 3.6, -0.42 + Math.tan(0.105) * 3.2 + 0.08, 0.95, 0.6, 'up');
      roundel(root, [[P.yellow, 1], [P.blue, 0.85], [P.white, 0.58], [P.red, 0.28]], sx * 0.35, 0.1, -2.3, 0.42, sx > 0 ? 'left' : 'right');
    }
    tailplane(root, P.main, { root: 0.05, span: 1.65, chord: [1.1, 0.3], le: -3.45, y: 0.25, ell: true, segs: 6 });
    fin(root, P.main, { y0: 0.3, h: 1.1, chord: [1.2, 0.3], le: -3.6, round: true });
    for (const [mat, dz] of [[P.red, 0.3], [P.white, 0.15], [P.blue, 0]]) add(root, U.box, mat, 0, 0.75, -3.7 + dz, 0.06, 0.55, 0.15);
    canopy(root, glass);
    const gear = retractGear(root, P, { x: 0.95, y: -1.65, z: 1.6, r: 0.34, top: -0.45, legTopX: 0.8, doors: true });
    tailWheel(root, P, -4.0, -1.06, 0.1, false, -0.2);
    const prop = propeller(P, { at: [0, 0.12, 4.42], r: 1.62, chord: 0.22, blades: 3, spinner: [0.26, 0.62] });
    root.add(prop);
    return { root, prop, gear, bombs: [] };
  },
};
