// GAZ-67B (1943): the Soviet field car "Ivan-Willys" - a narrow bonnet with side louvres behind the grille of
// upright bars, broad rounded guards over a wide track, an open tub without doors, the canvas hood folded, the spare
// wheel at the back
import * as THREE from 'three';
import { PI, U, mats, add, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, guard, glassCollector, bench, steeringWheel, lamp, foldedHood, spare } from './carkit.js';

export default {
  key: 'gaz67', name: 'ГАЗ-67Б', year: 1943,
  palette: { main: 0x4a5a35, dark: 0x384428, engine: 0x3e413a },
  mg: null,
  hull: softHull({
    car: 'car', name: 'ГАЗ-67Б', weight: 1.12, speedCap: 25, eff: 1.0, accelCap: 2.4, radius: 2.0,
    seats: {
      driver: { pos: [0.32, 0.92, 0.1], eye: [0.32, 1.62, 0.14], rider: 'car' },
    },
    troops: [
      { pos: [-0.32, 0.92, 0.1], eye: [-0.32, 1.62, 0.14], ry: 0, fire: true, rider: 'side' },
      { pos: [0.34, 0.95, -0.9], eye: [0.34, 1.65, -0.86], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.34, 0.95, -0.9], eye: [-0.34, 1.65, -0.86], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { walk: [{ x: [-0.3, 0.3], z: [-1.1, 0.15] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'ГАЗ-ММ 3.3 л 54 л.с.', power: 54, weight: 0.16, fuelUse: 0.022 },
  fuel: { name: 'канистра 20 л', cap: 20, weight: 0.02 },

  models: {
    hull() {
      const P = mats('gaz67');
      const root = new THREE.Group();
      const gl = glassCollector();
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.38, 0.55, 0.05, 0.07, 0.12, 3.2);
      add(root, U.box, P.dark, 0, 0.38, 1.05, 1.5, 0.08, 0.08);
      add(root, U.box, P.dark, 0, 0.38, -1.08, 1.5, 0.08, 0.08);
      // grille of upright bars with an arched top, the narrow bonnet with louvres
      add(root, U.box, P.main, 0, 1.0, 1.62, 0.62, 0.62, 0.06);
      add(root, U.cylZ, P.main, 0, 1.31, 1.62, 0.31, 0.1, 0.06);
      for (let i = 0; i < 8; i++) add(root, U.box, P.black, -0.21 + i * 0.06, 1.0, 1.655, 0.024, 0.5, 0.01);
      add(root, U.box, P.main, 0, 1.1, 1.18, 0.62, 0.42, 0.86);
      add(root, U.cylZ, P.main, 0, 1.31, 1.18, 0.31, 0.06, 0.86);
      for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) add(root, U.box, P.black, sx * 0.312, 1.1, 0.88 + i * 0.09, 0.01, 0.2, 0.03);
      // broad rounded guards (no running boards), the tub, scuttle, seats
      for (const sx of [-1, 1]) {
        guard(root, P, sx * 0.73, 0.37, 1.05, 0.5, 0.36, -1.15, 1.35, P.main, 8);
        guard(root, P, sx * 0.73, 0.37, -1.08, 0.5, 0.36, -1.3, 1.15, P.main, 8);
        add(root, U.box, P.main, sx * 0.55, 0.78, 1.0, 0.04, 0.42, 1.1);                            // aprons
        add(root, U.box, P.main, sx * 0.62, 0.8, -0.85, 0.04, 0.6, 1.0);
        add(root, U.box, P.main, sx * 0.62, 0.7, 0.28, 0.04, 0.4, 0.75);
        lamp(root, P, sx * 0.44, 1.18, 1.48, 0.1);
      }
      add(root, U.box, P.dark, 0, 0.56, -0.3, 1.24, 0.05, 2.3);
      add(root, U.box, P.main, 0, 1.0, 0.68, 1.24, 0.36, 0.06);
      add(root, U.box, P.main, 0, 0.84, -1.38, 1.24, 0.58, 0.05);
      bench(root, P, 0, 0.92, 0.1, 1.1, P.dark, 0.42);
      bench(root, P, 0, 0.95, -0.9, 1.15, P.dark, 0.42);
      for (const sx of [-1, 1]) add(root, U.box, P.main, sx * 0.6, 1.4, 0.7, 0.04, 0.46, 0.04);
      add(root, U.box, P.main, 0, 1.63, 0.7, 1.24, 0.04, 0.04);
      gl.pane(0, 1.41, 0.71, 1.16, 0.4);
      steeringWheel(root, P, 0.32, 1.32, 0.46, 0.2, 0.75);
      spare(root, P, 0, 0.92, -1.53, 0.37, 0.16, PI / 2);
      foldedHood(root, P, 0.6, 1.2, -1.3, P.dark);
      add(root, U.box, P.dark, 0, 0.45, 1.72, 1.2, 0.1, 0.06);
      gl.done(root);
      const wh = wheelSet(root, P, { style: 'disc', axles: [{ z: 1.05, x: 0.73, r: 0.37, w: 0.16, steer: true }, { z: -1.08, x: 0.73, r: 0.37, w: 0.16 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.375, 1.18), 0.5, 0.8, P.main);
      bay.engineFloor = 0.62;
      return {
        root, wheels: wh.wheels, wheelR: 0.37, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.5, 0.2),
        box: new THREE.Box3(new THREE.Vector3(-0.92, 0.25, -1.65), new THREE.Vector3(0.92, 1.7, 1.75)),
        fuelAt: new THREE.Vector3(0.68, 0.98, -0.3), fuelRot: PI / 2,
        driveAt: new THREE.Vector3(0, 1.5, 0.2), ringHole: null, mgAt: new THREE.Vector3(0, 0, 0),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.62),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 1, h: 0.46, d: 0.16, w: 0.34, rail: false }),
  },
};
