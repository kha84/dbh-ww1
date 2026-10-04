// Harley-Davidson WLA (1940): "the Liberator" of the US Army - a flathead V-twin, a springer fork with the
// rifle scabbard on it, a big front mudguard, the white star on the tank, a rear rack with the ammunition box
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube, star } from './carkit.js';

export default {
  key: 'harleyWLA', name: 'Harley-Davidson WLA', year: 1940,
  palette: { main: 0x4a5126, dark: 0x30331c, engine: 0x4f4e47 },
  mg: null,
  hull: softHull({
    car: 'moto', name: 'Harley-Davidson WLA', weight: 0.13, speedCap: 26, eff: 1.0, accelCap: 3.8, radius: 1.1,
    seats: {
      driver: { pos: [0, 0.84, -0.2], eye: [0, 1.62, -0.05], rider: 'moto' },
    },
    troops: [
      { pos: [0, 0.86, -0.62], eye: [0, 1.62, -0.55], ry: 0, fire: true, rider: 'side' },
    ],
  }),
  turret: null,
  gun: null,
  engine: { name: 'Harley-Davidson 739 см³ 23 л.с.', power: 23, weight: 0.1, fuelUse: 0.008 },
  fuel: { name: 'бак 13 л', cap: 13, weight: 0.01 },

  models: {
    hull() {
      const P = mats('harleyWLA');
      const root = new THREE.Group();
      const o = { r: 0.35, front: 0.76, rear: -0.74, head: [0.5, 1.0], seat: [-0.22, 0.84], fork: 'springer', guards: 'big', rise: 0.1, barW: 0.4, lamp: 0.1, rack: true };
      const wh = motoBase(root, P, o);
      add(root, U.box, P.dark, 0.17, 0.78, 0.62, 0.08, 0.08, 0.75, -0.75, 0, 0);                   // rifle scabbard
      add(root, U.box, P.dark, 0.0, 0.7, -0.74, 0.2, 0.14, 0.24);                                  // ammunition box
      star(root, 0.135, 0.94, 0.15, 0.06, 0, PI / 2);
      star(root, -0.135, 0.94, 0.15, 0.06, 0, -PI / 2);
      return motoResult(root, P, wh, { ...o, });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'vtwin', 1.15),
    fuel: (g, P) => motoTank(g, P, 'tear', 1.05),
  },
};
