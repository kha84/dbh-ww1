// Triumph Model H "Trusty Triumph" (1915): the British despatch riders' single - a flat tank with the hand
// controls on it, belt drive to a big pulley in the rear wheel, a Brampton side-spring fork, a sprung saddle, a carrier
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube } from './carkit.js';

export default {
  key: 'triumphH', name: 'Triumph Model H', year: 1915,
  palette: { main: 0x5a5a3c, dark: 0x2a2a24, engine: 0x5a564c },
  mg: null,
  hull: softHull({
    car: 'moto', name: 'Triumph Model H', weight: 0.08, speedCap: 20, eff: 1.0, accelCap: 2.6, radius: 1.1,
    seats: {
      driver: { pos: [0, 0.84, -0.2], eye: [0, 1.62, -0.05], rider: 'moto' },
    },
    troops: [
      { pos: [0, 0.86, -0.62], eye: [0, 1.62, -0.55], ry: 0, fire: true, rider: 'side' },
    ],
  }),
  turret: null,
  gun: null,
  engine: { name: 'Triumph 550 см³ 4 л.с.', power: 4, weight: 0.05, fuelUse: 0.008 },
  fuel: { name: 'бак 9 л', cap: 9, weight: 0.01 },

  models: {
    hull() {
      const P = mats('triumphH');
      const root = new THREE.Group();
      const o = { r: 0.34, front: 0.7, rear: -0.7, head: [0.47, 0.95], seat: [-0.22, 0.84], fork: 'girder', guards: 'flat', rise: 0.04, lamp: 0.08, lampMat: P.brass, rack: true, bags: true, bagMat: P.wood };
      const wh = motoBase(root, P, o);
      add(root, new THREE.TorusGeometry(0.25, 0.025, 6, 20).rotateY(PI / 2), P.metal, 0.11, 0.34, -0.7);   // belt pulley
      tube(root, P.black, 0.11, [0.0, 0.3], [-0.7, 0.58], 0.015);
      tube(root, P.black, 0.11, [0.0, 0.18], [-0.7, 0.1], 0.015);
      return motoResult(root, P, wh, { ...o, });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'single', 0.95),
    fuel: (g, P) => motoTank(g, P, 'slab', 0.9),
  },
};
