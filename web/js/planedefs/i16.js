// Polikarpov I-16 (1934; type 24 of 1939): the stubby Soviet "Ishak", the first monoplane fighter with retracting
// gear in service - a barrel fuselage behind the big radial with its cowl shutters, an open cockpit with a small
// screen, short tapered wings with two ShVAK cannons, two ShKAS over the engine
import * as THREE from 'three';
import { PI, U, add } from '../modelkit.js';
import { fuselage, wing, tailplane, fin, propeller, retractGear, tailWheel, gunBarrel, redStar, canopy, screenGeo } from './kit.js';

export default {
  key: 'i16', name: 'Поликарпов И-16', year: 1934, nation: 'su',
  palette: { main: 0x4a6338, under: 0x9ab5c8, dark: 0x26301f, accent: 0x4a6338, engine: 0x4a4a46 },
  mass: 1880, power: 900, vmax: 128, vstall: 37, roll: 3.1, fuel: 255, fuelUse: 0.12, hp: 120, retract: true,
  guns: [{ w: 'shkas', at: [0.2, 0.42, 1.95], n: 650 }, { w: 'shkas', at: [-0.2, 0.42, 1.95], n: 650 }],
  cannons: [{ at: [1.7, -0.32, 0.95], rpm: 750, pen: 18, dmg: 0.28, speed: 760, n: 150 }, { at: [-1.7, -0.32, 0.95], rpm: 750, pen: 18, dmg: 0.28, speed: 760, n: 150 }],
  gear: { main: [1.0, -1.77, 0.8], tail: [0, -0.75, -3.6] },
  span: 9.0, len: 6.1, seat: [0, 0.82, -0.25],
  boxes: [[[-0.7, -0.7, -3.95], [0.7, 0.75, 2.1]], [[-4.5, -0.55, -0.9], [4.5, -0.1, 1.05]], [[-1.7, -0.05, -3.9], [1.7, 1.05, -2.6]]],

  model(P) {
    const root = new THREE.Group();
    fuselage(root, P.main, [{ z: 2.02, w: 1.18, h: 1.18 }, { z: 1.5, w: 1.32, h: 1.32 }, { z: 0.4, w: 1.22, h: 1.22 }, { z: -1.0, w: 0.92, h: 1.0, y: 0.05 },
      { z: -2.6, w: 0.46, h: 0.58, y: 0.12 }, { z: -3.92, w: 0.1, h: 0.26, y: 0.2 }], 18);
    add(root, U.disc, P.dark, 0, 0, 2.03, 0.56, 1, 0.56, PI / 2, 0, 0);
    for (let i = 0; i < 12; i++) add(root, U.box, P.black, Math.sin(i / 12 * PI * 2) * 0.35, Math.cos(i / 12 * PI * 2) * 0.35, 2.04, 0.03, 0.4, 0.01, 0, 0, -i / 12 * PI * 2);
    for (let i = 0; i < 8; i++) add(root, U.cylZ, P.metal, Math.sin(i / 8 * PI * 2) * 0.62, Math.cos(i / 8 * PI * 2) * 0.62 - 0.05, 1.3, 0.04, 0.04, 0.2);
    gunBarrel(root, P, 0.2, 0.42, 1.7, 0.35, 0.02);
    gunBarrel(root, P, -0.2, 0.42, 1.7, 0.35, 0.02);
    // open cockpit, headrest fairing
    add(root, U.box, P.black, 0, 0.6, -0.2, 0.5, 0.06, 0.7);
    add(root, U.box, P.main, 0, 0.62, -1.0, 0.3, 0.25, 1.0, 0.12, 0, 0);
    const glass = [screenGeo(0, 0.78, 0.25, 0.5, 0.28, 0.6)];
    // wings: low, tapered, the cannons in them
    wing(root, P.main, { root: 0.5, span: 4.5, chord: [2.2, 1.2], le: 1.0, sweep: -0.1, y: -0.35, dihedral: 0.05, segs: 2 });
    wing(root, P.under, { root: 0.5, span: 4.5, chord: [2.2, 1.2], le: 1.0, sweep: -0.1, y: -0.38, dihedral: 0.05, t: 0.3, segs: 1 });
    for (const sx of [-1, 1]) gunBarrel(root, P, sx * 1.7, -0.32, 0.9, 0.35, 0.03);
    tailplane(root, P.main, { root: 0.1, span: 1.7, chord: [1.0, 0.6], le: -2.85, y: 0.15 });
    fin(root, P.main, { y0: 0.2, h: 0.85, chord: [1.0, 0.5], le: -2.95, round: true });
    for (const sx of [-1, 1]) {
      redStar(root, P, sx * 3.3, -0.38 + Math.tan(0.05) * 2.8 - 0.06, 0.35, 0.4, 'down');
      redStar(root, P, sx * 3.3, -0.3 + Math.tan(0.05) * 2.8 + 0.02, 0.35, 0.4, 'up');
    }
    redStar(root, P, 0.06, 0.6, -3.35, 0.28, 'left');
    redStar(root, P, -0.06, 0.6, -3.35, 0.28, 'right');
    canopy(root, glass);
    const gear = retractGear(root, P, { x: 1.0, y: -1.45, z: 0.8, r: 0.32, top: -0.35, legTopX: 0.95, doors: true });
    tailWheel(root, P, -3.6, -0.75, 0.1, true, -0.25);
    const prop = propeller(P, { at: [0, 0, 2.15], r: 1.4, chord: 0.2, blades: 2, spinner: [0.25, 0.4] });
    root.add(prop);
    return { root, prop, gear, bombs: [] };
  },
};
