// Willys MB (1941): the American "jeep" - the slotted steel grille with the lamps set in it, the flat bonnet with
// the white star, flat guards, a tub without doors, the folding windscreen, the spare wheel and a jerrycan at the
// back and a Browning M1919 on a pedestal between the seats
import * as THREE from 'three';
import { PI, U, mats, add, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { softHull, wheelSet, glassCollector, bench, steeringWheel, lamp, foldedHood, spare, star } from './carkit.js';

export default {
  key: 'willys', name: 'Willys MB', year: 1941,
  palette: { main: 0x4a5124, dark: 0x363b1b, engine: 0x40423a },
  mg: 'm1919',
  hull: softHull({
    car: 'car', name: 'Willys MB', weight: 0.82, speedCap: 29, eff: 1.05, accelCap: 3.0, radius: 1.9, mgAmmo: 500, arc: PI,
    seats: {
      driver: { pos: [0.3, 0.86, 0.12], eye: [0.3, 1.55, 0.16], rider: 'car' },
      gunner: { pos: [0, 0.95, -0.75], eye: [0, 1.9, -0.58], rider: 'gun' },
    },
    troops: [
      { pos: [-0.3, 0.86, 0.12], eye: [-0.3, 1.55, 0.16], ry: 0, fire: true, rider: 'side' },
      { pos: [0.32, 0.9, -0.85], eye: [0.32, 1.6, -0.8], ry: 0, fire: true, rider: 'side' },
      { pos: [-0.32, 0.9, -0.85], eye: [-0.32, 1.6, -0.8], ry: 0, fire: true, rider: 'side' },
    ],
    interior: { theme: 'us', walk: [{ x: [-0.3, 0.3], z: [-1.05, 0.15] }] },
  }),
  turret: null,
  gun: null,
  engine: { name: 'Willys «Go Devil» 2.2 л 60 л.с.', power: 60, weight: 0.15, fuelUse: 0.02 },
  fuel: { name: 'канистра 20 л', cap: 20, weight: 0.02 },
  drive: { name: 'стойка M1919', speed: 2.2, weight: 0.02, fixed: true },

  models: {
    hull() {
      const P = mats('willys');
      const root = new THREE.Group();
      const gl = glassCollector();
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.36, 0.5, 0.05, 0.06, 0.12, 3.1);
      add(root, U.box, P.dark, 0, 0.36, 1.0, 1.2, 0.08, 0.08);
      add(root, U.box, P.dark, 0, 0.36, -1.03, 1.2, 0.08, 0.08);
      // the slotted grille with the lamps in it, the flat bonnet with the star
      add(root, U.box, P.main, 0, 0.93, 1.55, 0.78, 0.66, 0.05);
      for (let i = 0; i < 9; i++) add(root, U.box, P.black, -0.2 + i * 0.05, 0.98, 1.578, 0.026, 0.4, 0.01);
      for (const sx of [-1, 1]) lamp(root, P, sx * 0.3, 1.0, 1.56, 0.085);
      add(root, U.box, P.main, 0, 1.12, 1.15, 0.8, 0.32, 0.8);
      star(root, 0, 1.285, 1.15, 0.24);
      // flat front guards on their aprons, the tub without doors (the sides cut out at the front seats)
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 0.6, 0.94, 1.15, 0.32, 0.04, 0.78);
        add(root, U.box, P.main, sx * 0.6, 0.88, 1.53, 0.32, 0.12, 0.04, -0.4, 0, 0);
        add(root, U.box, P.main, sx * 0.7, 0.8, -0.72, 0.04, 0.58, 1.1);
        add(root, U.box, P.main, sx * 0.7, 0.66, 0.35, 0.04, 0.3, 0.8);
        add(root, U.box, P.main, sx * 0.72, 0.84, -1.03, 0.22, 0.04, 0.8);                         // rear guard tops
      }
      add(root, U.box, P.dark, 0, 0.52, -0.3, 1.4, 0.05, 2.4);
      add(root, U.box, P.main, 0, 0.94, 0.75, 1.36, 0.3, 0.06);                                     // scuttle / dash
      add(root, U.box, P.main, 0, 0.8, -1.3, 1.4, 0.58, 0.05);
      bench(root, P, 0.3, 0.86, 0.12, 0.48, P.black, 0.4);
      bench(root, P, -0.3, 0.86, 0.12, 0.48, P.black, 0.4);
      bench(root, P, 0, 0.9, -0.85, 1.2, P.black, 0.42);
      // windscreen in its frame
      for (const sx of [-1, 1]) add(root, U.box, P.main, sx * 0.64, 1.3, 0.78, 0.04, 0.46, 0.04);
      add(root, U.box, P.main, 0, 1.53, 0.78, 1.32, 0.05, 0.04);
      add(root, U.box, P.main, 0, 1.09, 0.78, 1.32, 0.04, 0.04);
      gl.pane(0, 1.31, 0.79, 1.24, 0.4);
      steeringWheel(root, P, 0.3, 1.24, 0.5, 0.2, 0.75);
      // spare wheel and jerrycan at the back, the hood folded, the MG pedestal
      spare(root, P, 0.25, 0.85, -1.45, 0.36, 0.17, PI / 2);
      foldedHood(root, P, 0.68, 1.12, -1.25, P.dark);
      add(root, U.cyl8, P.dark, 0, 1.0, -0.35, 0.04, 0.95, 0.04);
      add(root, U.box, P.dark, 0, 0.54, -0.35, 0.3, 0.04, 0.3);
      add(root, U.box, P.steel, 0, 0.42, 1.65, 1.36, 0.08, 0.06);
      gl.done(root);
      const wh = wheelSet(root, P, { style: 'disc', axles: [{ z: 1.0, x: 0.62, r: 0.36, w: 0.17, steer: true }, { z: -1.03, x: 0.62, r: 0.36, w: 0.17 }] });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.285, 1.15), 0.7, 0.74, P.main);
      bay.engineFloor = 0.6;
      return {
        root, wheels: wh.wheels, wheelR: 0.36, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.47, -0.35),
        box: new THREE.Box3(new THREE.Vector3(-0.82, 0.22, -1.55), new THREE.Vector3(0.82, 1.62, 1.66)),
        fuelAt: new THREE.Vector3(-0.3, 0.75, -1.45), fuelRot: 0,
        driveAt: new THREE.Vector3(0, 1.47, -0.35), ringHole: null, mgAt: new THREE.Vector3(0, -0.05, 0), noPost: true,
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.6),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 1, h: 0.46, d: 0.16, w: 0.34, rail: false }),
    drive(g, P) { add(g, U.cyl8, P.metal, 0, 0.02, 0, 0.06, 0.1, 0.06); },
  },
};
