// BSA M20 (1937): the British Army's commonest motorcycle of the Second World War - a side-valve single in a
// cradle frame, a girder fork, a squared tank with knee pads, canvas panniers on the carrier, khaki all over
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube } from './carkit.js';

export default {
  key: 'bsaM20', name: 'BSA M20', year: 1937,
  palette: { main: 0x5f5b3c, dark: 0x3d3b28, engine: 0x5a574e },
  mg: null,
  hull: softHull({
    car: 'moto', name: 'BSA M20', weight: 0.11, speedCap: 24, eff: 1.0, accelCap: 3.4, radius: 1.1,
    seats: {
      driver: { pos: [0, 0.84, -0.2], eye: [0, 1.62, -0.05], rider: 'moto' },
    },
    troops: [
      { pos: [0, 0.86, -0.62], eye: [0, 1.62, -0.55], ry: 0, fire: true, rider: 'side' },
    ],
  }),
  turret: null,
  gun: null,
  engine: { name: 'BSA 496 см³ 13 л.с.', power: 13, weight: 0.07, fuelUse: 0.008 },
  fuel: { name: 'бак 14 л', cap: 14, weight: 0.01 },

  models: {
    hull() {
      const P = mats('bsaM20');
      const root = new THREE.Group();
      const o = { r: 0.33, front: 0.72, rear: -0.7, head: [0.48, 0.97], seat: [-0.2, 0.82], fork: 'girder', guards: 'big', lamp: 0.09, rack: true, bags: true, pillion: true };
      const wh = motoBase(root, P, o);
      add(root, U.box, P.black, 0.0, 0.92, 0.62, 0.22, 0.04, 0.06);                                // lamp mask
      return motoResult(root, P, wh, { ...o, });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'single', 1.05),
    fuel: (g, P) => motoTank(g, P, 'box', 1),
  },
};
