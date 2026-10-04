// Ford Model T (1914): the American "Tin Lizzie" in its open tourer body - brass radiator and lamps, tall wooden
// artillery wheels, flat mudguards with running boards, two bench seats, the hood folded behind the rear seat
import * as THREE from 'three';
import { PI, U, mats, add, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, guard, board, glassCollector, bench, steeringWheel, lamp, foldedHood } from './carkit.js';

export default {
  key: 'fordT', name: 'Ford Model T', year: 1914,
  palette: { main: 0x262624, dark: 0x171716, engine: 0x3a3a36 },
  mg: null,
  hull: softHull({
    car: 'car', name: 'Ford Model T', weight: 0.5, speedCap: 19, eff: 0.85, accelCap: 1.6, radius: 2.1,
    seats: {
      driver: { pos: [0.3, 1.0, 0.25], eye: [0.3, 1.72, 0.3], rider: 'car' },
    },
    troops: [
      { pos: [-0.3, 1.0, 0.25], eye: [-0.3, 1.72, 0.3], ry: 0, fire: true, rider: 'side' },
      { pos: [0.32, 1.02, -0.9], eye: [0.32, 1.74, -0.85], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.32, 1.02, -0.9], eye: [-0.32, 1.74, -0.85], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { theme: 'ww1', walk: [{ x: [-0.3, 0.3], z: [-1.1, 0.3] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'Ford 2.9 л 20 л.с.', power: 20, weight: 0.08, fuelUse: 0.012 },
  fuel: { name: 'канистра 38 л', cap: 38, weight: 0.03 },

  models: {
    hull() {
      const P = mats('fordT');
      const root = new THREE.Group();
      const gl = glassCollector();
      // chassis: frame rails, axle beams, transverse springs
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.38, 0.56, 0, 0.06, 0.1, 3.1);
      add(root, U.box, P.dark, 0, 0.4, 1.25, 1.4, 0.06, 0.06);
      add(root, U.cylX, P.dark, 0, 0.38, -1.29, 1.42, 0.05, 0.05);
      add(root, U.box, P.dark, 0, 0.62, 1.25, 1.0, 0.05, 0.08);
      add(root, U.box, P.dark, 0, 0.62, -1.29, 1.0, 0.05, 0.08);
      // brass radiator, bonnet
      add(root, U.box, P.brass, 0, 1.0, 1.6, 0.54, 0.6, 0.11);
      add(root, U.box, P.black, 0, 0.98, 1.66, 0.42, 0.48, 0.02);
      add(root, U.cyl8, P.brass, 0, 1.33, 1.6, 0.04, 0.08, 0.04);                                  // filler cap
      add(root, U.box, P.main, 0, 1.0, 1.25, 0.52, 0.42, 0.62);
      add(root, U.cylZ, P.main, 0, 1.2, 1.25, 0.26, 0.06, 0.62);
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) add(root, U.box, P.black, sx * 0.262, 0.98, 1.05 + i * 0.12, 0.01, 0.18, 0.04);
      // scuttle, dash, the open tub
      add(root, U.box, P.main, 0, 1.12, 0.85, 1.06, 0.4, 0.2);
      add(root, U.box, P.dark, 0, 0.66, -0.3, 1.3, 0.05, 2.3);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 0.64, 0.95, -0.3, 0.04, 0.58, 2.3);
        add(root, U.cylZ, P.main, sx * 0.64, 1.24, -0.3, 0.03, 0.03, 2.3);
      }
      add(root, U.box, P.main, 0, 0.95, -1.44, 1.3, 0.6, 0.05);
      add(root, U.cylX, P.main, 0, 1.25, -1.42, 1.3, 0.07, 0.07);
      bench(root, P, 0, 1.0, 0.25, 1.15, P.black, 0.42);
      bench(root, P, 0, 1.02, -0.9, 1.2, P.black, 0.45);
      // windscreen: brass frame, two panes
      for (const sx of [-1, 1]) add(root, U.box, P.brass, sx * 0.53, 1.52, 0.95, 0.03, 0.62, 0.03);
      add(root, U.box, P.brass, 0, 1.82, 0.95, 1.08, 0.03, 0.03);
      add(root, U.box, P.brass, 0, 1.52, 0.95, 1.08, 0.025, 0.025);
      gl.pane(0, 1.38, 0.95, 1.02, 0.26);
      gl.pane(0, 1.67, 0.95, 1.02, 0.28);
      steeringWheel(root, P, 0.3, 1.42, 0.68, 0.2, 0.75);
      // mudguards, running boards, lamps, horn
      for (const sx of [-1, 1]) {
        guard(root, P, sx * 0.72, 0.38, 1.25, 0.47, 0.2, -1.05, 1.25, P.dark, 6);
        guard(root, P, sx * 0.72, 0.38, -1.29, 0.47, 0.2, -1.25, 1.1, P.dark, 6);
        board(root, P, sx * 0.76, 0.56, -0.85, 0.85);
        lamp(root, P, sx * 0.42, 1.02, 1.62, 0.11, P.brass);
        add(root, U.box, P.brass, sx * 0.3, 0.88, 1.6, 0.25, 0.02, 0.02);
        lamp(root, P, sx * 0.56, 1.2, 0.86, 0.06, P.brass);
      }
      add(root, U.cone, P.brass, 0.42, 1.18, 1.0, 0.06, 0.18, 0.06, -PI / 2, 0, 0);
      add(root, U.box, P.red, 0.4, 0.95, -1.48, 0.06, 0.06, 0.03);
      foldedHood(root, P, 0.62, 1.32, -1.47, P.black);
      gl.done(root);
      const wh = wheelSet(root, P, { style: 'spoke', axles: [{ z: 1.25, x: 0.71, r: 0.38, w: 0.09, steer: true }, { z: -1.29, x: 0.71, r: 0.38, w: 0.09 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.265, 1.25), 0.5, 0.58, P.main);
      bay.engineFloor = 0.62;
      return {
        root, wheels: wh.wheels, wheelR: 0.38, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.5, 0.4),
        box: new THREE.Box3(new THREE.Vector3(-0.86, 0.25, -1.62), new THREE.Vector3(0.86, 1.85, 1.72)),
        fuelAt: new THREE.Vector3(-0.78, 0.82, 0.3), fuelRot: PI / 2,
        driveAt: new THREE.Vector3(0, 1.5, 0.4), ringHole: null, mgAt: new THREE.Vector3(0, 0, 0),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.55),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 1, h: 0.44, d: 0.16, w: 0.32, rail: false }),
  },
};
