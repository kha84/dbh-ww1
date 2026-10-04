// BMW R75 (1941): the classic German army sidecar outfit with the driven sidecar wheel - a flat twin, a
// telescopic fork, deep mudguards, panniers, the MG 34 on the sidecar and its spare wheel behind
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube } from './carkit.js';

const S = { x: -1.0, z: -0.05, y: 0.6, h: 0.42, w: 0.62, spare: true, r: 0.34 };
export default {
  key: 'bmwR75', name: 'BMW R75 с коляской', year: 1941,
  palette: { main: 0x6b6649, dark: 0x4a4733, engine: 0x56554e },
  mg: 'mg34',
  hull: softHull({
    car: 'moto', name: 'BMW R75', weight: 0.48, speedCap: 25, eff: 1.0, accelCap: 3.2, radius: 1.45, mgAmmo: 600, arc: 0.6,
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
  engine: { name: 'BMW 745 см³ 26 л.с.', power: 26, weight: 0.1, fuelUse: 0.008 },
  fuel: { name: 'бак 24 л', cap: 24, weight: 0.02 },
  drive: { name: 'кронштейн пулемёта', speed: 2, weight: 0.01, fixed: true },

  models: {
    hull() {
      const P = mats('bmwR75');
      const root = new THREE.Group();
      const o = { r: 0.34, front: 0.74, rear: -0.72, head: [0.5, 1.0], seat: [-0.2, 0.84], fork: 'tele', guards: 'big', lamp: 0.1, pillion: true, bags: true, tyre: 0.11, sidecar: S };
      const wh = motoBase(root, P, o);
      add(root, U.box, P.black, 0.0, 0.94, 0.66, 0.22, 0.04, 0.06);                                // lamp mask
      add(root, U.box, P.dark, 0.0, 1.08, 0.36, 0.3, 0.05, 0.08);                                  // air filter on the tank
      return motoResult(root, P, wh, { ...o, mount: new THREE.Vector3(S.x, S.y + 0.24, S.z + 0.42), mgAt: new THREE.Vector3(0, -0.1, 0), });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'boxer', 1.1),
    fuel: (g, P) => motoTank(g, P, 'tear', 1.08),
    drive(g, P) { add(g, U.box, P.metal, 0, 0.02, 0, 0.08, 0.05, 0.12); },
  },
};
