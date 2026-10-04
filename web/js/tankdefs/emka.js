// GAZ-M1 "Emka" (1936): the Soviet staff car of the war years - a closed four-door sedan with a raked grille,
// teardrop mudguards over pressed-steel wheels, a sloping back with the spare wheel on it, black paint
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, guard, board, bench, steeringWheel, lamp, spare, TINT } from './carkit.js';

export default {
  key: 'emka', name: 'ГАЗ-М1 «Эмка»', year: 1936,
  palette: { main: 0x1e2022, dark: 0x111213, engine: 0x3a3c3c },
  mg: null,
  hull: softHull({
    car: 'car', name: 'ГАЗ-М1', weight: 1.2, speedCap: 29, eff: 1.05, accelCap: 2.4, radius: 2.4,
    seats: {
      driver: { pos: [0.32, 0.82, 0.15], eye: [0.32, 1.52, 0.2], rider: 'car' },
    },
    troops: [
      { pos: [-0.32, 0.82, 0.15], eye: [-0.32, 1.52, 0.2], ry: 0, fire: true, rider: 'side' },
      { pos: [0.33, 0.84, -0.98], eye: [0.33, 1.54, -0.94], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.33, 0.84, -0.98], eye: [-0.33, 1.54, -0.94], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { walk: [{ x: [-0.3, 0.3], z: [-1.1, 0.2] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'ГАЗ-М 3.3 л 50 л.с.', power: 50, weight: 0.15, fuelUse: 0.02 },
  fuel: { name: 'канистра 40 л', cap: 40, weight: 0.03 },

  models: {
    hull() {
      const P = mats('emka');
      const root = new THREE.Group();
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.4, 0.5, 0, 0.06, 0.1, 3.7);
      // body: bonnet and the closed cab with the sloping back (the panels are seen from outside only: from the
      // seats the world is in view)
      add(root, U.box, P.main, 0, 1.0, 1.5, 0.74, 0.44, 1.1);
      add(root, U.cylZ, P.main, 0, 1.22, 1.5, 0.37, 0.09, 1.1);
      add(root, hullProfile([[-2.2, 0.62], [0.95, 0.62], [0.95, 1.27], [0.72, 1.32], [0.32, 1.8], [-0.75, 1.84], [-1.45, 1.66],
        [-2.0, 1.15], [-2.22, 0.85]], 1.42), P.main);
      // raked grille
      add(root, U.box, P.dark, 0, 0.98, 2.08, 0.56, 0.5, 0.05, -0.28, 0, 0);
      for (let i = 0; i < 9; i++) add(root, U.box, P.steel, -0.24 + i * 0.06, 0.98, 2.1, 0.012, 0.46, 0.012, -0.28, 0, 0);
      add(root, U.box, P.steel, 0, 1.24, 2.02, 0.06, 0.04, 0.12);                                  // emblem
      for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) add(root, U.box, P.steel, sx * 0.372, 0.98, 1.2 + i * 0.12, 0.01, 0.16, 0.03);
      // windows (dark glass seen from outside), door lines, handles
      add(root, U.box, TINT, 0, 1.56, 0.55, 1.26, 0.42, 0.02, -0.82, 0, 0);
      add(root, U.box, TINT, 0, 1.4, -1.72, 0.9, 0.24, 0.02, 0.85, 0, 0);
      for (const sx of [-1, 1]) {
        add(root, U.box, TINT, sx * 0.712, 1.55, 0.02, 0.01, 0.36, 0.58);
        add(root, U.box, TINT, sx * 0.712, 1.55, -0.8, 0.01, 0.36, 0.8);
        for (const z of [0.66, -0.36, -0.42, -1.3]) add(root, U.box, P.black, sx * 0.713, 1.08, z, 0.01, 0.82, 0.012);
        for (const z of [-0.28, -0.5]) add(root, U.box, P.steel, sx * 0.72, 1.28, z, 0.02, 0.025, 0.08);
      }
      bench(root, P, 0, 0.82, 0.15, 1.2, P.black, 0.45);
      bench(root, P, 0, 0.84, -0.98, 1.25, P.black, 0.45);
      steeringWheel(root, P, 0.32, 1.24, 0.56, 0.2, 0.75);
      add(root, U.box, P.dark, 0, 1.2, 0.85, 1.3, 0.2, 0.12);                                       // dash
      // teardrop mudguards, running boards, lamps on the guards, bumpers, spare on the back
      for (const sx of [-1, 1]) {
        guard(root, P, sx * 0.72, 0.37, 1.42, 0.5, 0.3, -1.45, 1.55, P.main, 9);
        add(root, U.box, P.main, sx * 0.72, 0.9, 1.42, 0.3, 0.06, 0.6);
        guard(root, P, sx * 0.72, 0.37, -1.43, 0.5, 0.3, -1.5, 1.35, P.main, 9);
        board(root, P, sx * 0.79, 0.48, -0.9, 0.95, 0.24);
        lamp(root, P, sx * 0.55, 1.14, 1.78, 0.12, P.steel);
        add(root, U.box, P.steel, sx * 0.55, 0.98, 1.72, 0.04, 0.2, 0.04);
      }
      add(root, U.box, P.steel, 0, 0.5, 2.25, 1.6, 0.1, 0.05);
      add(root, U.box, P.steel, 0, 0.5, -2.3, 1.5, 0.1, 0.05);
      spare(root, P, 0, 1.05, -2.15, 0.36, 0.13, PI / 2);
      for (const sx of [-1, 1]) add(root, U.box, P.red, sx * 0.55, 0.82, -2.22, 0.07, 0.07, 0.03);
      const wh = wheelSet(root, P, { style: 'disc', hub: P.dark, axles: [{ z: 1.42, x: 0.72, r: 0.37, w: 0.15, steer: true }, { z: -1.43, x: 0.72, r: 0.37, w: 0.15 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.315, 1.5), 0.55, 1.0, P.main);
      bay.engineFloor = 0.6;
      return {
        root, wheels: wh.wheels, wheelR: 0.37, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.5, 0.2),
        box: new THREE.Box3(new THREE.Vector3(-0.9, 0.25, -2.32), new THREE.Vector3(0.9, 1.85, 2.27)),
        fuelAt: new THREE.Vector3(-0.85, 0.72, -0.1), fuelRot: PI / 2,
        driveAt: new THREE.Vector3(0, 1.5, 0.2), ringHole: null, mgAt: new THREE.Vector3(0, 0, 0),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.6),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 1, h: 0.46, d: 0.16, w: 0.34, rail: false }),
  },
};
