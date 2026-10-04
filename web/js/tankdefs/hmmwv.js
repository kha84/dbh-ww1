// HMMWV M1025 (1985): the American "Humvee" armament carrier - a wide, low body on big tyres, the flat bonnet with
// the slatted grille, a four-door hard-top cab with the gunner's ring on its roof and a Browning M2 in it
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, bench, steeringWheel, lamp, TINT } from './carkit.js';

export default {
  key: 'hmmwv', name: 'HMMWV M1025', year: 1985,
  palette: { main: 0x7a7155, dark: 0x5a543f, engine: 0x3f403b },
  mg: 'm2hb',
  hull: softHull({
    car: 'car', name: 'HMMWV', weight: 2.9, speedCap: 31, eff: 1.1, accelCap: 2.6, radius: 2.6, mgAmmo: 600, arc: PI,
    armor: { front: 8, side: 6, rear: 6, top: 4 },
    seats: {
      driver: { pos: [0.45, 0.8, 0.2], eye: [0.45, 1.55, 0.24], rider: 'car' },
      gunner: { pos: [0, 1.25, -0.35], eye: [0, 2.42, -0.22], rider: 'gun' },
    },
    troops: [
      { pos: [-0.45, 0.8, 0.2], eye: [-0.45, 1.55, 0.24], ry: 0, fire: true, rider: 'side' },
      { pos: [0.45, 0.8, -0.85], eye: [0.45, 1.55, -0.8], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.45, 0.8, -0.85], eye: [-0.45, 1.55, -0.8], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { theme: 'nato', walk: [{ x: [-0.3, 0.3], z: [-1.0, 0.2] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'GM 6.2 л дизель 150 л.с.', power: 150, weight: 0.3, fuelUse: 0.03 },
  fuel: { name: 'канистры 2×20 л', cap: 40, weight: 0.05 },
  drive: { name: 'кольцевая турель', speed: 1.4, weight: 0.05, fixed: true },

  models: {
    hull() {
      const P = mats('hmmwv');
      const root = new THREE.Group();
      // low wide body: the hull between the wheels, the wide bonnet over the front wheels, the cab with doors down
      // to the sills between the wheels, the rear deck over the back wheels
      add(root, hullProfile([[-2.35, 0.62], [2.3, 0.62], [2.45, 0.9], [2.32, 1.1], [-2.35, 1.1]], 1.5), P.main);
      add(root, hullProfile([[0.85, 1.0], [2.3, 1.0], [2.45, 1.06], [2.32, 1.24], [0.85, 1.32]], 2.14), P.main);
      add(root, hullProfile([[-1.25, 1.0], [0.9, 1.0], [0.9, 1.32], [0.55, 1.88], [-1.25, 1.88]], 2.06), P.main);
      add(root, hullProfile([[-2.38, 1.0], [-1.2, 1.0], [-1.2, 1.38], [-2.38, 1.38]], 2.06), P.main);
      for (let i = 0; i < 7; i++) add(root, U.box, P.black, 0, 0.82 + i * 0.05, 2.43, 0.9, 0.018, 0.03, -0.3, 0, 0);
      for (const sx of [-1, 1]) {
        lamp(root, P, sx * 0.72, 0.98, 2.42, 0.09, P.dark);
        add(root, U.box, P.main, sx * 0.9, 0.82, 0, 0.26, 0.4, 2.3);                                 // door sills
        add(root, U.box, TINT, sx * 1.032, 1.62, 0.25, 0.01, 0.36, 0.7);
        add(root, U.box, TINT, sx * 1.032, 1.62, -0.75, 0.01, 0.36, 0.7);
        for (const z of [0.82, -0.25, -0.3, -1.18]) add(root, U.box, P.black, sx * 1.035, 1.25, z, 0.008, 1.1, 0.012);
        add(root, U.box, P.dark, sx * 1.1, 1.62, 0.95, 0.12, 0.12, 0.06);                            // mirrors
      }
      add(root, U.box, TINT, 0.48, 1.6, 0.74, 0.86, 0.5, 0.02, -0.58, 0, 0);
      add(root, U.box, TINT, -0.48, 1.6, 0.74, 0.86, 0.5, 0.02, -0.58, 0, 0);
      // gunner's ring on the roof
      add(root, new THREE.TorusGeometry(0.5, 0.06, 6, 24).rotateX(PI / 2), P.dark, 0, 1.93, -0.35);
      add(root, U.cyl, P.black, 0, 1.885, -0.35, 0.45, 0.02, 0.45);
      add(root, U.box, P.dark, 0, 0.6, 2.5, 2.0, 0.14, 0.12);                                       // bumpers
      add(root, U.box, P.dark, 0, 0.62, -2.38, 2.0, 0.12, 0.08);
      for (const sx of [-1, 1]) add(root, U.box, P.red, sx * 0.9, 1.15, -2.36, 0.08, 0.12, 0.02);
      bench(root, P, 0.45, 0.8, 0.2, 0.55, P.dark, 0.5);
      bench(root, P, -0.45, 0.8, 0.2, 0.55, P.dark, 0.5);
      bench(root, P, 0, 0.8, -0.85, 1.6, P.dark, 0.5);
      steeringWheel(root, P, 0.45, 1.25, 0.55, 0.2, 0.85);
      const wh = wheelSet(root, P, { style: 'modern', axles: [{ z: 1.65, x: 0.91, r: 0.46, w: 0.32, steer: true }, { z: -1.65, x: 0.91, r: 0.46, w: 0.32 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.27, 1.55), 1.6, 1.25, P.main);
      bay.engineFloor = 0.62;
      return {
        root, wheels: wh.wheels, wheelR: 0.46, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.95, -0.35),
        box: new THREE.Box3(new THREE.Vector3(-1.12, 0.3, -2.4), new THREE.Vector3(1.12, 1.95, 2.52)),
        fuelAt: new THREE.Vector3(0, 1.62, -1.85), fuelRot: 0,
        driveAt: new THREE.Vector3(0, 1.95, -0.35), ringHole: null, mgAt: new THREE.Vector3(0, 0.0, 0.25),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.v12diesel(g, P, E),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 2, h: 0.46, d: 0.16, w: 0.34 }),
    drive(g, P) { add(g, U.box, P.dark, 0, 0.05, 0.25, 0.5, 0.35, 0.04); },
  },
};
