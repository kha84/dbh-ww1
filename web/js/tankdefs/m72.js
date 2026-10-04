// M-72 (1941): the Soviet army's sidecar machine, built from the BMW R71 - a flat twin, a telescopic fork,
// a teardrop tank, the sidecar on the right with a DP machine gun on its bracket
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube } from './carkit.js';

const S = { x: -0.98, z: -0.05, y: 0.58, h: 0.42, w: 0.6 };
export default {
  key: 'm72', name: 'М-72 с коляской', year: 1941,
  palette: { main: 0x4a5634, dark: 0x343c24, engine: 0x55554f },
  mg: 'dp27',
  hull: softHull({
    car: 'moto', name: 'М-72', weight: 0.24, speedCap: 24, eff: 1.0, accelCap: 3.0, radius: 1.45, mgAmmo: 600, arc: 0.6,
    seats: {
      driver: { pos: [0, 0.84, -0.2], eye: [0, 1.62, -0.05], rider: 'moto' },
      gunner: { pos: [S.x, S.y - 0.06, S.z - 0.25], eye: [S.x, S.y + 0.72, S.z - 0.1], rider: 'gun' },
    },
    troops: [
      { pos: [0, 0.86, -0.62], eye: [0, 1.62, -0.55], ry: 0, fire: true, rider: 'side' },
    ],
  }),
  turret: null,
  gun: null,
  engine: { name: 'М-72 746 см³ 22 л.с.', power: 22, weight: 0.09, fuelUse: 0.008 },
  fuel: { name: 'бак 22 л', cap: 22, weight: 0.02 },
  drive: { name: 'кронштейн пулемёта', speed: 2, weight: 0.01, fixed: true },

  models: {
    hull() {
      const P = mats('m72');
      const root = new THREE.Group();
      const o = { r: 0.34, front: 0.73, rear: -0.7, head: [0.5, 0.99], seat: [-0.2, 0.83], fork: 'tele', guards: 'big', lamp: 0.1, pillion: true, sidecar: S };
      const wh = motoBase(root, P, o);
      add(root, U.box, P.dark, 0.2, 0.62, -0.42, 0.12, 0.14, 0.22);                                // tool box
      return motoResult(root, P, wh, { ...o, mount: new THREE.Vector3(S.x, S.y + 0.24, S.z + 0.42), mgAt: new THREE.Vector3(0, -0.1, 0), });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'boxer', 1.05),
    fuel: (g, P) => motoTank(g, P, 'tear', 1.05),
    drive(g, P) { add(g, U.box, P.metal, 0, 0.02, 0, 0.08, 0.05, 0.12); },
  },
};
