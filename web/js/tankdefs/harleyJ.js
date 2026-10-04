// Harley-Davidson Model J (1915): the American V-twin of the Great War (the US Army rode them against Pancho
// Villa and in France) - a long low loop frame, the slab tank between the top tubes, a springer fork, wire wheels,
// an acetylene head lamp, the bars sweeping back
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube } from './carkit.js';

export default {
  key: 'harleyJ', name: 'Harley-Davidson Model J', year: 1915,
  palette: { main: 0x55573c, dark: 0x262620, engine: 0x55524a },
  mg: null,
  hull: softHull({
    car: 'moto', name: 'Harley-Davidson J', weight: 0.11, speedCap: 24, eff: 1.0, accelCap: 3.4, radius: 1.1,
    seats: {
      driver: { pos: [0, 0.84, -0.2], eye: [0, 1.62, -0.05], rider: 'moto' },
    },
    troops: [
      { pos: [0, 0.86, -0.62], eye: [0, 1.62, -0.55], ry: 0, fire: true, rider: 'side' },
    ],
  }),
  turret: null,
  gun: null,
  engine: { name: 'Harley-Davidson V-twin 1 л 11 л.с.', power: 11, weight: 0.06, fuelUse: 0.008 },
  fuel: { name: 'бак 11 л', cap: 11, weight: 0.01 },

  models: {
    hull() {
      const P = mats('harleyJ');
      const root = new THREE.Group();
      const o = { r: 0.36, front: 0.75, rear: -0.75, head: [0.5, 0.98], seat: [-0.22, 0.86], fork: 'springer', guards: 'flat', rise: 0.12, barW: 0.4, lamp: 0.1, lampMat: P.brass, rack: true };
      const wh = motoBase(root, P, o);
      add(root, U.box, P.brass, 0.0, 1.06, 0.66, 0.12, 0.14, 0.12);                                  // acetylene generator
      add(root, U.box, P.black, -0.18, 0.68, -0.4, 0.1, 0.14, 0.2);                                  // tool box
      return motoResult(root, P, wh, { ...o, });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'vtwin', 1),
    fuel: (g, P) => motoTank(g, P, 'slab', 1),
  },
};
