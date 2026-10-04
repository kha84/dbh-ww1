// GAZ-A (1932): the first Soviet mass-produced car, the Ford Model A built under licence in Gorky - an open
// five-seat phaeton with a tall narrow radiator shell, a long louvred bonnet, wire wheels, flowing mudguards on
// running boards, headlamps on a bar, the spare wheel at the back and the hood folded down
import * as THREE from 'three';
import { PI, U, mats, add, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, guard, board, glassCollector, bench, steeringWheel, lamp, foldedHood, spare } from './carkit.js';

export default {
  key: 'gazA', name: 'ГАЗ-А', year: 1932,
  palette: { main: 0x2f3a2c, dark: 0x1b1f1a, engine: 0x3a3c38 },
  mg: null,
  hull: softHull({
    car: 'car', name: 'ГАЗ-А', weight: 0.88, speedCap: 25, eff: 1.0, accelCap: 2.2, radius: 2.2,
    seats: {
      driver: { pos: [0.3, 0.98, 0.28], eye: [0.3, 1.7, 0.32], rider: 'car' },
    },
    troops: [
      { pos: [-0.3, 0.98, 0.28], eye: [-0.3, 1.7, 0.32], ry: 0, fire: true, rider: 'side' },
      { pos: [0.33, 1.0, -0.92], eye: [0.33, 1.72, -0.88], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.33, 1.0, -0.92], eye: [-0.33, 1.72, -0.88], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { walk: [{ x: [-0.3, 0.3], z: [-1.1, 0.3] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'ГАЗ-А 3.3 л 40 л.с.', power: 40, weight: 0.15, fuelUse: 0.018 },
  fuel: { name: 'канистра 40 л', cap: 40, weight: 0.03 },

  models: {
    hull() {
      const P = mats('gazA');
      const root = new THREE.Group();
      const gl = glassCollector();
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.38, 0.54, 0, 0.06, 0.1, 3.3);
      add(root, U.box, P.dark, 0, 0.38, 1.3, 1.36, 0.06, 0.06);
      add(root, U.cylX, P.dark, 0, 0.36, -1.33, 1.38, 0.05, 0.05);
      // tall radiator shell with the grille, the long bonnet with louvres
      add(root, U.box, P.main, 0, 1.03, 1.74, 0.5, 0.66, 0.08);
      add(root, U.cylZ, P.main, 0, 1.36, 1.74, 0.25, 0.06, 0.08);
      add(root, U.box, P.black, 0, 1.0, 1.785, 0.4, 0.56, 0.02);
      for (let i = 0; i < 7; i++) add(root, U.box, P.steel, -0.18 + i * 0.06, 1.0, 1.795, 0.012, 0.54, 0.01);
      add(root, U.cyl8, P.steel, 0, 1.42, 1.73, 0.03, 0.06, 0.03);
      add(root, U.box, P.main, 0, 1.06, 1.38, 0.56, 0.44, 0.68);
      add(root, U.cylZ, P.main, 0, 1.28, 1.38, 0.28, 0.07, 0.68);
      for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) add(root, U.box, P.black, sx * 0.282, 1.06, 1.13 + i * 0.065, 0.01, 0.2, 0.025);
      // cowl, the tub with four doors, rounded back
      add(root, U.box, P.main, 0, 1.12, 0.92, 1.12, 0.42, 0.24);
      add(root, U.box, P.dark, 0, 0.64, -0.3, 1.36, 0.05, 2.35);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 0.67, 0.95, -0.3, 0.04, 0.62, 2.35);
        add(root, U.cylZ, P.black, sx * 0.67, 1.27, -0.3, 0.035, 0.035, 2.35);
        for (const z of [0.6, -0.3, -0.42, -1.28]) add(root, U.box, P.black, sx * 0.692, 0.95, z, 0.01, 0.56, 0.012);
      }
      add(root, U.box, P.main, 0, 0.95, -1.48, 1.36, 0.62, 0.05);
      add(root, U.cylX, P.main, 0, 0.8, -1.5, 1.36, 0.22, 0.1);
      bench(root, P, 0, 0.98, 0.28, 1.15, P.black, 0.42);
      bench(root, P, 0, 1.0, -0.92, 1.2, P.black, 0.45);
      // windscreen
      for (const sx of [-1, 1]) add(root, U.box, P.steel, sx * 0.55, 1.5, 1.02, 0.03, 0.58, 0.03, -0.12, 0, 0);
      add(root, U.box, P.steel, 0, 1.78, 0.98, 1.12, 0.03, 0.03);
      gl.pane(0, 1.52, 1.0, 1.08, 0.5, -0.12);
      steeringWheel(root, P, 0.3, 1.38, 0.7, 0.2, 0.7);
      // mudguards, running boards, lamps on their bar, bumper, spare wheel, folded hood
      for (const sx of [-1, 1]) {
        guard(root, P, sx * 0.71, 0.36, 1.3, 0.46, 0.24, -1.25, 1.45, P.dark, 8);
        guard(root, P, sx * 0.71, 0.36, -1.33, 0.46, 0.24, -1.4, 1.2, P.dark, 8);
        board(root, P, sx * 0.76, 0.5, -0.88, 0.88, 0.26);
        lamp(root, P, sx * 0.42, 1.12, 1.66, 0.12);
      }
      add(root, U.box, P.dark, 0, 0.98, 1.62, 0.9, 0.03, 0.03);
      add(root, U.box, P.steel, 0, 0.52, 1.98, 1.4, 0.08, 0.04);
      add(root, U.box, P.steel, 0, 0.52, -1.72, 1.3, 0.08, 0.04);
      spare(root, P, 0, 1.0, -1.66, 0.36, 0.12, PI / 2);
      foldedHood(root, P, 0.64, 1.32, -1.38, P.dark);
      add(root, U.box, P.red, 0.5, 0.82, -1.55, 0.07, 0.07, 0.03);
      gl.done(root);
      const wh = wheelSet(root, P, { style: 'wire', axles: [{ z: 1.3, x: 0.71, r: 0.36, w: 0.12, steer: true }, { z: -1.33, x: 0.71, r: 0.36, w: 0.12 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.355, 1.38), 0.5, 0.64, P.main);
      bay.engineFloor = 0.6;
      return {
        root, wheels: wh.wheels, wheelR: 0.36, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.5, 0.4),
        box: new THREE.Box3(new THREE.Vector3(-0.88, 0.25, -1.75), new THREE.Vector3(0.88, 1.82, 2.0)),
        fuelAt: new THREE.Vector3(0.79, 0.76, 0.2), fuelRot: PI / 2,
        driveAt: new THREE.Vector3(0, 1.5, 0.4), ringHole: null, mgAt: new THREE.Vector3(0, 0, 0),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.6),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 1, h: 0.46, d: 0.16, w: 0.34, rail: false }),
  },
};
