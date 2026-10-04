// Volkswagen Kübelwagen Typ 82 (1940): the light utility car of the Wehrmacht on the Beetle's rear-engined
// chassis - flat ribbed body panels, the spare wheel on the sloping front lid, cut-down doors, the canvas hood
// folded over the louvred engine lid at the back, wide balloon tyres
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, engineDeck, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, glassCollector, bench, steeringWheel, lamp, foldedHood, motoEngine } from './carkit.js';

export default {
  key: 'kubel', name: 'VW Kübelwagen', year: 1940,
  palette: { main: 0x857a56, dark: 0x625a40, engine: 0x4a4a44 },
  mg: null,
  hull: softHull({
    car: 'car', name: 'Kübelwagen', weight: 0.6, speedCap: 22, eff: 1.0, accelCap: 1.9, radius: 2.0, rearEngine: true,
    seats: {
      driver: { pos: [0.3, 0.82, 0.32], eye: [0.3, 1.52, 0.36], rider: 'car' },
    },
    troops: [
      { pos: [-0.3, 0.82, 0.32], eye: [-0.3, 1.52, 0.36], ry: 0, fire: true, rider: 'side' },
      { pos: [0.3, 0.86, -0.72], eye: [0.3, 1.56, -0.68], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.3, 0.86, -0.72], eye: [-0.3, 1.56, -0.68], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { theme: 'german', walk: [{ x: [-0.3, 0.3], z: [-0.9, 0.35] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'VW 1.13 л 25 л.с.', power: 25, weight: 0.1, fuelUse: 0.012 },
  fuel: { name: 'канистра 20 л', cap: 20, weight: 0.02 },

  models: {
    hull() {
      const P = mats('kubel');
      const root = new THREE.Group();
      const gl = glassCollector();
      add(root, U.box, P.dark, 0, 0.46, 0, 0.3, 0.12, 3.2);                                          // backbone tube
      // the front lid sloping down, the spare wheel lying on it
      add(root, hullProfile([[1.0, 0.5], [1.86, 0.5], [1.9, 0.72], [1.0, 1.06]], 1.42), P.main);
      add(root, U.cylX, P.rubber, 0, 0.98, 1.45, 0.17, 0.32, 0.32, 0, PI / 2, -1.2);
      add(root, U.cylX, P.dark, 0, 0.99, 1.45, 0.18, 0.18, 0.18, 0, PI / 2, -1.2);
      // engine lid at the back with louvres
      add(root, hullProfile([[-1.2, 0.5], [-1.2, 1.04], [-1.85, 0.84], [-1.9, 0.5]], 1.42), P.main);
      for (let i = 0; i < 6; i++) add(root, U.box, P.black, 0, 0.98 - i * 0.025, -1.32 - i * 0.08, 0.7, 0.012, 0.04, -0.3, 0, 0);
      // the open tub: flat sides with stamped ribs, cut-down doors, floor, dash
      add(root, U.box, P.dark, 0, 0.55, -0.1, 1.42, 0.05, 2.2);
      add(root, U.box, P.main, 0, 0.88, 0.98, 1.42, 0.36, 0.06);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 0.71, 0.78, -0.1, 0.04, 0.56, 2.2);
        add(root, U.box, P.main, sx * 0.71, 1.0, -0.95, 0.04, 0.12, 0.5);
        for (const y of [0.66, 0.84]) add(root, U.box, P.dark, sx * 0.735, y, -0.1, 0.012, 0.025, 2.1);
        for (const z of [0.7, -0.2, -0.3]) add(root, U.box, P.black, sx * 0.732, 0.8, z, 0.008, 0.5, 0.01);
        // flat stamped guards over the wheels
        add(root, U.box, P.main, sx * 0.72, 0.86, 1.12, 0.3, 0.04, 0.8, 0.05, 0, 0);
        add(root, U.box, P.main, sx * 0.72, 0.88, -1.28, 0.3, 0.04, 0.78, -0.05, 0, 0);
        lamp(root, P, sx * 0.62, 0.98, 1.3, 0.09);
      }
      bench(root, P, 0.3, 0.82, 0.32, 0.5, P.dark, 0.4);
      bench(root, P, -0.3, 0.82, 0.32, 0.5, P.dark, 0.4);
      bench(root, P, 0, 0.86, -0.72, 1.25, P.dark, 0.42);
      // flat windscreen
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.66, 1.33, 1.0, 0.04, 0.52, 0.04);
      add(root, U.box, P.dark, 0, 1.58, 1.0, 1.36, 0.04, 0.04);
      gl.pane(0, 1.33, 1.0, 1.28, 0.46);
      steeringWheel(root, P, 0.3, 1.18, 0.72, 0.19, 0.6);
      foldedHood(root, P, 0.68, 1.12, -1.15, P.dark);
      for (const sx of [-1, 1]) add(root, U.box, P.red, sx * 0.5, 0.75, -1.9, 0.06, 0.04, 0.03);
      gl.done(root);
      const wh = wheelSet(root, P, { style: 'disc', axles: [{ z: 1.12, x: 0.68, r: 0.34, w: 0.17, steer: true }, { z: -1.28, x: 0.68, r: 0.34, w: 0.17 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.0, -1.5), 0.6, 0.45, P.main);
      bay.engineFloor = 0.48;
      return {
        root, wheels: wh.wheels, wheelR: 0.34, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.4, 0.3),
        box: new THREE.Box3(new THREE.Vector3(-0.8, 0.22, -1.92), new THREE.Vector3(0.8, 1.6, 1.92)),
        fuelAt: new THREE.Vector3(-0.8, 0.8, -0.2), fuelRot: PI / 2,
        driveAt: new THREE.Vector3(0, 1.4, 0.3), ringHole: null, mgAt: new THREE.Vector3(0, 0, 0),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'boxer', 1.4),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 1, h: 0.46, d: 0.16, w: 0.34, rail: false }),
  },
};
