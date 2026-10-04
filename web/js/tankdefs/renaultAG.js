// Renault AG-1 (1910): the Paris taxi landaulet that carried soldiers to the Marne in 1914 - the "coal scuttle"
// bonnet sloping down to the front with the radiators behind the engine at the dash, an open seat for the driver
// (right-hand drive) and a closed cab for the passengers with a folding leather rear hood, wooden wheels, a meter
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, guard, board, glassCollector, bench, steeringWheel, lamp, spare } from './carkit.js';

export default {
  key: 'renaultAG', name: 'Renault AG-1', year: 1910,
  palette: { main: 0x5a1f1b, dark: 0x181716, engine: 0x3b3a36 },
  mg: null,
  hull: softHull({
    car: 'car', name: 'Renault AG-1', weight: 0.82, speedCap: 14, eff: 1.1, accelCap: 1.2, radius: 2.2,
    seats: {
      driver: { pos: [-0.3, 1.0, 0.55], eye: [-0.3, 1.72, 0.6], rider: 'car' },
    },
    troops: [
      { pos: [0.3, 1.0, 0.55], eye: [0.3, 1.72, 0.6], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.32, 0.98, -1.05], eye: [-0.32, 1.68, -1.0], ry: 0, fire: true, rider: 'side' },
      { pos: [0.32, 0.98, -1.05], eye: [0.32, 1.68, -1.0], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { theme: 'french', walk: [{ x: [-0.3, 0.3], z: [-1.2, 0.5] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'Renault 2 цил. 1.2 л 12 л.с.', power: 12, weight: 0.12, fuelUse: 0.01 },
  fuel: { name: 'канистра 30 л', cap: 30, weight: 0.03 },

  models: {
    hull() {
      const P = mats('renaultAG');
      const root = new THREE.Group();
      const gl = glassCollector();
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.36, 0.6, 0.05, 0.06, 0.1, 3.4);
      add(root, U.box, P.dark, 0, 0.43, 1.38, 1.3, 0.06, 0.06);
      add(root, U.cylX, P.dark, 0, 0.41, -1.25, 1.34, 0.05, 0.05);
      // the coal-scuttle bonnet, the radiators flanking the dash
      add(root, hullProfile([[2.02, 0.68], [2.02, 0.9], [1.12, 1.36], [1.12, 0.68]], 0.74), P.main);
      add(root, U.box, P.brass, 0, 0.79, 2.03, 0.62, 0.2, 0.03);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 0.48, 1.08, 1.1, 0.22, 0.62, 0.1);
        add(root, U.box, P.black, sx * 0.48, 1.08, 1.16, 0.18, 0.52, 0.02);
        for (let i = 0; i < 6; i++) add(root, U.box, P.brass, sx * 0.48, 0.84 + i * 0.09, 1.17, 0.18, 0.012, 0.01);
      }
      add(root, U.box, P.dark, 0, 1.1, 1.06, 1.25, 0.6, 0.06);                                      // dash
      // the driver's open seat
      add(root, U.box, P.dark, 0, 0.7, 0.55, 1.3, 0.05, 1.1);
      bench(root, P, 0, 1.0, 0.5, 1.2, P.black, 0.5);
      steeringWheel(root, P, -0.3, 1.45, 0.88, 0.2, 0.8);
      // passenger cab: low panels, glazed front, the folding leather hood over the back seat, roof over the driver
      add(root, U.box, P.main, 0, 1.02, -0.72, 1.36, 0.62, 1.7);
      add(root, U.box, P.dark, 0, 1.32, -0.72, 1.38, 0.04, 1.72);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 0.68, 1.62, 0.12, 0.05, 0.6, 0.06);
        add(root, U.box, P.dark, sx * 0.68, 1.62, -0.45, 0.05, 0.6, 0.06);
        add(root, U.box, P.black, sx * 0.68, 1.1, -0.3, 0.012, 0.42, 0.012);                            // door line
        add(root, U.box, P.brass, sx * 0.72, 1.55, -0.95, 0.03, 0.04, 0.32, 0, 0, 0);                  // landau iron
        gl.side(sx * 0.68, 1.62, -0.17, 0.52, 0.5);
      }
      add(root, U.box, P.dark, 0, 1.9, 0.12, 1.36, 0.06, 0.04);
      add(root, U.box, P.dark, 0, 1.62, 0.12, 0.04, 0.56, 0.04);
      gl.pane(0, 1.62, 0.13, 1.3, 0.52);
      add(root, U.box, P.black, 0, 1.62, -1.08, 1.36, 0.62, 0.95);                                   // leather hood
      add(root, U.cylX, P.black, 0, 1.9, -1.15, 1.36, 0.14, 0.45);
      add(root, U.box, P.dark, 0, 1.94, -0.18, 1.4, 0.05, 1.55);                                     // roof (over the driver too)
      add(root, U.box, P.dark, 0, 1.95, 0.7, 1.3, 0.03, 0.3);
      // mudguards, running boards, carbide lamps, the meter, a spare tyre on the side
      for (const sx of [-1, 1]) {
        guard(root, P, sx * 0.66, 0.41, 1.38, 0.5, 0.2, -1.1, 1.3, P.dark, 6);
        guard(root, P, sx * 0.66, 0.41, -1.25, 0.5, 0.2, -1.3, 1.1, P.dark, 6);
        board(root, P, sx * 0.72, 0.6, -0.7, 0.88);
        lamp(root, P, sx * 0.48, 1.18, 1.25, 0.1, P.brass);
      }
      add(root, U.box, P.dark, -0.7, 1.35, 0.95, 0.12, 0.16, 0.14);                                   // taxi meter
      add(root, U.box, P.red, -0.7, 1.5, 0.95, 0.02, 0.14, 0.1);                                      // its flag
      spare(root, P, 0.76, 0.95, 0.75, 0.38, 0.08);
      add(root, U.box, P.red, -0.45, 0.9, -1.6, 0.06, 0.06, 0.03);
      gl.done(root);
      const wh = wheelSet(root, P, { style: 'spoke', axles: [{ z: 1.38, x: 0.66, r: 0.41, w: 0.09, steer: true }, { z: -1.25, x: 0.66, r: 0.41, w: 0.09 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.17, 1.5), 0.5, 0.4, P.main);
      bay.engineFloor = 0.66;
      return {
        root, wheels: wh.wheels, wheelR: 0.41, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.5, 0.5),
        box: new THREE.Box3(new THREE.Vector3(-0.82, 0.25, -1.62), new THREE.Vector3(0.82, 1.98, 2.05)),
        fuelAt: new THREE.Vector3(-0.74, 0.86, 0.35), fuelRot: PI / 2,
        driveAt: new THREE.Vector3(0, 1.5, 0.5), ringHole: null, mgAt: new THREE.Vector3(0, 0, 0),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 2, 0.6),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 1, h: 0.4, d: 0.15, w: 0.3, rail: false }),
  },
};
