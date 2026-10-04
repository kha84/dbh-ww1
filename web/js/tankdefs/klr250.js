// Kawasaki KLR250 / M1030 (1985): the US Marines' dirt bike - a tall trail machine with long-travel forks, high
// mudguards, a narrow tank, a long flat seat, a water-cooled single, knobbly tyres
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube } from './carkit.js';

export default {
  key: 'klr250', name: 'Kawasaki KLR250 (M1030)', year: 1985,
  palette: { main: 0x4c4f37, dark: 0x1e1f1b, engine: 0x3c3c3a },
  mg: null,
  hull: softHull({
    car: 'moto', name: 'Kawasaki M1030', weight: 0.07, speedCap: 30, eff: 1.0, accelCap: 4.5, radius: 1.1,
    seats: {
      driver: { pos: [0, 0.84, -0.2], eye: [0, 1.62, -0.05], rider: 'moto' },
    },
    troops: [
      { pos: [0, 0.86, -0.62], eye: [0, 1.62, -0.55], ry: 0, fire: true, rider: 'side' },
    ],
  }),
  turret: null,
  gun: null,
  engine: { name: 'Kawasaki 249 см³ 21 л.с.', power: 21, weight: 0.05, fuelUse: 0.008 },
  fuel: { name: 'бак 11 л', cap: 11, weight: 0.01 },

  models: {
    hull() {
      const P = mats('klr250');
      const root = new THREE.Group();
      const o = { r: 0.36, rr: 0.34, front: 0.78, rear: -0.7, head: [0.52, 1.08], seat: [-0.18, 0.92], frame: 'dirt', fork: 'tele', guards: 'high', saddle: 'bench', rise: 0.1, barW: 0.42, lamp: 0.08, rack: true, tyre: 0.1 };
      const wh = motoBase(root, P, o);
      add(root, U.box, P.black, 0.0, 1.0, 0.62, 0.22, 0.2, 0.05, -0.3, 0, 0);                        // number plate / lamp cowl
      add(root, U.box, P.dark, 0.0, 0.56, 0.24, 0.24, 0.18, 0.08);                                  // radiator
      return motoResult(root, P, wh, { ...o, });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'single', 0.95),
    fuel: (g, P) => motoTank(g, P, 'dirt', 1),
  },
};
