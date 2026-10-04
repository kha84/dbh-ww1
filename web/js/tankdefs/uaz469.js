// UAZ-469 (1972): the Soviet army off-roader - a boxy body with flat sides, round lamps either side of the slotted
// grille, squared wheel arches, four doors and the canvas top over the whole cab, the spare wheel on the tailgate
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, bench, steeringWheel, lamp, spare, TINT } from './carkit.js';

export default {
  key: 'uaz469', name: 'УАЗ-469', year: 1972,
  palette: { main: 0x4b5a3a, dark: 0x3e4733, engine: 0x40423c },
  mg: null,
  hull: softHull({
    car: 'car', name: 'УАЗ-469', weight: 1.35, speedCap: 28, eff: 1.05, accelCap: 2.8, radius: 2.2,
    seats: {
      driver: { pos: [0.35, 0.9, 0.2], eye: [0.35, 1.62, 0.24], rider: 'car' },
    },
    troops: [
      { pos: [-0.35, 0.9, 0.2], eye: [-0.35, 1.62, 0.24], ry: 0, fire: true, rider: 'side' },
      { pos: [0.36, 0.9, -0.85], eye: [0.36, 1.62, -0.8], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.36, 0.9, -0.85], eye: [-0.36, 1.62, -0.8], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { walk: [{ x: [-0.3, 0.3], z: [-1.1, 0.2] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'УМЗ-451М 2.45 л 75 л.с.', power: 75, weight: 0.18, fuelUse: 0.025 },
  fuel: { name: 'канистра 20 л', cap: 20, weight: 0.02 },

  models: {
    hull() {
      const P = mats('uaz469');
      const root = new THREE.Group();
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.42, 0.58, 0, 0.08, 0.14, 3.6);
      // the boxy lower body up to the belt line, the bonnet, the canvas top over the cab
      add(root, hullProfile([[-1.95, 0.62], [1.98, 0.62], [2.02, 0.92], [1.98, 1.18], [0.92, 1.24], [0.9, 1.24], [-1.95, 1.24]], 1.66), P.main);
      add(root, U.box, P.dark, 0, 1.6, -0.5, 1.64, 0.72, 2.85);
      add(root, U.box, P.dark, 0, 1.97, -0.5, 1.6, 0.04, 2.8);
      // windscreen, windows (dark glass from outside), door lines, handles
      add(root, U.box, P.main, 0, 1.55, 0.92, 1.64, 0.64, 0.04, -0.12, 0, 0);
      add(root, U.box, TINT, 0, 1.56, 0.95, 1.5, 0.52, 0.02, -0.12, 0, 0);
      for (const sx of [-1, 1]) {
        add(root, U.box, TINT, sx * 0.825, 1.55, 0.4, 0.01, 0.42, 0.75);
        add(root, U.box, TINT, sx * 0.825, 1.55, -0.62, 0.01, 0.42, 0.75);
        add(root, U.box, TINT, sx * 0.825, 1.55, -1.5, 0.01, 0.38, 0.6);
        for (const z of [0.85, -0.12, -0.18, -1.12]) add(root, U.box, P.black, sx * 0.833, 0.93, z, 0.008, 0.6, 0.012);
        for (const z of [-0.02, -1.0]) add(root, U.box, P.black, sx * 0.84, 1.12, z, 0.02, 0.025, 0.12);
        // squared arches
        add(root, U.box, P.main, sx * 0.8, 1.02, 1.2, 0.12, 0.05, 0.95);
        add(root, U.box, P.main, sx * 0.8, 1.02, -1.2, 0.12, 0.05, 0.95);
        lamp(root, P, sx * 0.55, 1.0, 2.0, 0.1, P.steel);
      }
      add(root, U.box, TINT, 0, 1.55, -1.97, 1.2, 0.4, 0.01);
      // grille slots, bumpers, spare on the tailgate
      for (let i = 0; i < 8; i++) add(root, U.box, P.black, -0.28 + i * 0.08, 0.95, 2.025, 0.03, 0.34, 0.01);
      add(root, U.box, P.dark, 0, 0.55, 2.08, 1.7, 0.12, 0.08);
      add(root, U.box, P.dark, 0, 0.55, -2.0, 1.7, 0.12, 0.08);
      spare(root, P, -0.45, 1.05, -2.08, 0.38, 0.2, PI / 2);
      for (const sx of [-1, 1]) add(root, U.box, P.red, sx * 0.72, 0.85, -1.97, 0.07, 0.12, 0.02);
      bench(root, P, 0.35, 0.9, 0.2, 0.55, P.black, 0.5);
      bench(root, P, -0.35, 0.9, 0.2, 0.55, P.black, 0.5);
      bench(root, P, 0, 0.9, -0.85, 1.4, P.black, 0.5);
      steeringWheel(root, P, 0.35, 1.42, 0.58, 0.2, 0.8);
      const wh = wheelSet(root, P, { style: 'modern', axles: [{ z: 1.2, x: 0.72, r: 0.39, w: 0.21, steer: true }, { z: -1.2, x: 0.72, r: 0.39, w: 0.21 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.24, 1.45), 1.2, 0.95, P.main);
      bay.engineFloor = 0.62;
      return {
        root, wheels: wh.wheels, wheelR: 0.39, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.7, 0.2),
        box: new THREE.Box3(new THREE.Vector3(-0.88, 0.25, -2.1), new THREE.Vector3(0.88, 2.0, 2.1)),
        fuelAt: new THREE.Vector3(0.45, 1.05, -2.12), fuelRot: 0,
        driveAt: new THREE.Vector3(0, 1.7, 0.2), ringHole: null, mgAt: new THREE.Vector3(0, 0, 0),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.66),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 1, h: 0.46, d: 0.16, w: 0.34, rail: false }),
  },
};
