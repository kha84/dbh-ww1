// BMW R12 (1935): the Wehrmacht's first big sidecar outfit - a pressed-steel frame, the flat-twin engine with its
// cylinders out in the wind, a teardrop tank, a telescopic fork (the first on a production machine), the sidecar
// on the right
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube } from './carkit.js';

const S = { x: -0.98, z: -0.05, y: 0.58, h: 0.4, w: 0.6 };
export default {
  key: 'bmwR12', name: 'BMW R12 с коляской', year: 1935,
  palette: { main: 0x1f2021, dark: 0x141414, engine: 0x5c5c58 },
  mg: null,
  hull: softHull({
    car: 'moto', name: 'BMW R12', weight: 0.27, speedCap: 23, eff: 1.0, accelCap: 3.0, radius: 1.45,
    seats: {
      driver: { pos: [0, 0.84, -0.2], eye: [0, 1.62, -0.05], rider: 'moto' },
    },
    troops: [
      { pos: [S.x, S.y - 0.06, S.z - 0.25], eye: [S.x, S.y + 0.7, S.z - 0.1], ry: 0, fire: true, rider: 'side' },
      { pos: [0, 0.86, -0.62], eye: [0, 1.62, -0.55], ry: 0, fire: true, rider: 'side' },
    ],
  }),
  turret: null,
  gun: null,
  engine: { name: 'BMW 745 см³ 18 л.с.', power: 18, weight: 0.07, fuelUse: 0.008 },
  fuel: { name: 'бак 14 л', cap: 14, weight: 0.01 },

  models: {
    hull() {
      const P = mats('bmwR12');
      const root = new THREE.Group();
      const o = { r: 0.33, front: 0.72, rear: -0.68, head: [0.5, 0.98], seat: [-0.2, 0.82], frame: 'pressed', fork: 'tele', guards: 'big', lamp: 0.1, pillion: true, sidecar: S };
      const wh = motoBase(root, P, o);

      return motoResult(root, P, wh, { ...o, });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'boxer', 1),
    fuel: (g, P) => motoTank(g, P, 'tear', 1),
  },
};
