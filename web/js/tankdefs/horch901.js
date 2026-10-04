// Horch 901 Kfz. 15 (1937): the heavy cross-country staff car of the Wehrmacht - a long bonnet with the upright
// grille, an open four-door body with high sides, the two spare wheels standing in the flanks behind the front
// guards, big cross-country tyres, the canvas hood folded at the back, Panzer grey
import * as THREE from 'three';
import { PI, U, mats, add, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, guard, glassCollector, bench, steeringWheel, lamp, foldedHood, spare } from './carkit.js';

export default {
  key: 'horch901', name: 'Horch 901 (Kfz. 15)', year: 1937,
  palette: { main: 0x4d5357, dark: 0x363a3d, engine: 0x3e3f3c },
  mg: null,
  hull: softHull({
    car: 'car', name: 'Horch 901', weight: 2.75, speedCap: 25, eff: 1.05, accelCap: 1.8, radius: 2.6,
    seats: {
      driver: { pos: [0.36, 1.1, 0.35], eye: [0.36, 1.82, 0.4], rider: 'car' },
    },
    troops: [
      { pos: [-0.36, 1.1, 0.35], eye: [-0.36, 1.82, 0.4], ry: 0, fire: true, rider: 'side' },
      { pos: [0.4, 1.12, -0.9], eye: [0.4, 1.84, -0.85], ry: 0, fire: true, rider: 'side' },
      { pos: [0, 1.12, -0.9], eye: [0, 1.84, -0.85], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.4, 1.12, -0.9], eye: [-0.4, 1.84, -0.85], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { theme: 'german', walk: [{ x: [-0.35, 0.35], z: [-1.2, 0.4] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'Horch V8 3.5 л 81 л.с.', power: 81, weight: 0.3, fuelUse: 0.035 },
  fuel: { name: 'канистры 2×20 л', cap: 40, weight: 0.05 },

  models: {
    hull() {
      const P = mats('horch901');
      const root = new THREE.Group();
      const gl = glassCollector();
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.42, 0.62, 0, 0.08, 0.14, 4.4);
      add(root, U.box, P.dark, 0, 0.45, 1.6, 1.5, 0.08, 0.08);
      add(root, U.box, P.dark, 0, 0.45, -1.5, 1.5, 0.08, 0.08);
      // upright grille, the long bonnet
      add(root, U.box, P.main, 0, 1.15, 2.22, 0.7, 0.72, 0.08);
      add(root, U.box, P.black, 0, 1.13, 2.265, 0.58, 0.6, 0.02);
      for (let i = 0; i < 8; i++) add(root, U.box, P.dark, 0, 0.88 + i * 0.07, 2.275, 0.58, 0.02, 0.012);
      add(root, U.box, P.main, 0, 1.15, 1.6, 0.8, 0.52, 1.2);
      add(root, U.cylZ, P.main, 0, 1.41, 1.6, 0.4, 0.06, 1.2);
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) add(root, U.box, P.dark, sx * 0.402, 1.18, 1.3 + i * 0.18, 0.01, 0.26, 0.06);
      // the open body: high sides with four doors, the cowl, seats
      add(root, U.box, P.main, 0, 1.3, 0.9, 1.5, 0.42, 0.25);
      add(root, U.box, P.dark, 0, 0.76, -0.4, 1.5, 0.06, 2.6);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 0.75, 1.1, -0.4, 0.05, 0.68, 2.6);
        for (const z of [0.85, -0.25, -0.33, -1.35]) add(root, U.box, P.black, sx * 0.777, 1.1, z, 0.01, 0.62, 0.012);
        add(root, U.box, P.dark, sx * 0.79, 1.18, -0.1, 0.03, 0.03, 0.1);
      }
      add(root, U.box, P.main, 0, 1.1, -1.7, 1.5, 0.68, 0.05);
      bench(root, P, 0, 1.1, 0.35, 1.3, P.dark, 0.45);
      bench(root, P, 0, 1.12, -0.9, 1.35, P.dark, 0.48);
      for (const sx of [-1, 1]) add(root, U.box, P.main, sx * 0.62, 1.5, 1.05, 0.04, 0.6, 0.04);
      add(root, U.box, P.main, 0, 1.8, 1.05, 1.28, 0.04, 0.04);
      gl.pane(0, 1.55, 1.05, 1.2, 0.48);
      steeringWheel(root, P, 0.36, 1.5, 0.8, 0.22, 0.8);
      // big flat-topped guards, the spares in the flanks, lamps, a Notek blackout lamp, the folded hood
      for (const sx of [-1, 1]) {
        guard(root, P, sx * 0.8, 0.42, 1.6, 0.55, 0.32, -1.3, 1.4, P.main, 8);
        guard(root, P, sx * 0.8, 0.42, -1.5, 0.55, 0.32, -1.4, 1.3, P.main, 8);
        add(root, U.box, P.dark, sx * 0.8, 0.72, 0.68, 0.3, 0.04, 0.85);
        spare(root, P, sx * 0.86, 0.98, 0.65, 0.4, 0.2);
        lamp(root, P, sx * 0.62, 1.24, 2.0, 0.13);
      }
      add(root, U.box, P.black, -0.62, 1.05, 2.26, 0.14, 0.06, 0.06);                                    // Notek
      add(root, U.box, P.dark, 0, 0.58, 2.32, 1.6, 0.12, 0.08);
      foldedHood(root, P, 0.72, 1.48, -1.65, P.dark);
      gl.done(root);
      const wh = wheelSet(root, P, { style: 'modern', axles: [{ z: 1.6, x: 0.8, r: 0.42, w: 0.2, steer: true }, { z: -1.5, x: 0.8, r: 0.42, w: 0.2 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.465, 1.6), 0.6, 1.1, P.main);
      bay.engineFloor = 0.7;
      return {
        root, wheels: wh.wheels, wheelR: 0.42, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.7, 0.4),
        box: new THREE.Box3(new THREE.Vector3(-0.98, 0.3, -1.85), new THREE.Vector3(0.98, 1.85, 2.36)),
        fuelAt: new THREE.Vector3(0, 1.05, -1.9), fuelRot: 0,
        driveAt: new THREE.Vector3(0, 1.7, 0.4), ringHole: null, mgAt: new THREE.Vector3(0, 0, 0),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.aeroV12(g, P, E, 0.62),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 2, h: 0.46, d: 0.16, w: 0.34 }),
  },
};
