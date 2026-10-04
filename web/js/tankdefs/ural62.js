// Ural M-62 (1961): the Irbit sidecar outfit of the post-war Soviet army - an overhead-valve flat twin, a
// telescopic fork, a swinging-arm rear, a teardrop tank with knee pads, the sidecar with its spare wheel
import * as THREE from 'three';
import { PI, U, mats, add } from '../modelkit.js';
import { softHull, motoBase, motoResult, motoTank, motoEngine, tube } from './carkit.js';

const S = { x: -0.98, z: -0.05, y: 0.6, h: 0.42, w: 0.62, spare: true };
export default {
  key: 'ural62', name: 'Урал М-62 с коляской', year: 1961,
  palette: { main: 0x3c4a33, dark: 0x2a3324, engine: 0x5a5a55 },
  mg: null,
  hull: softHull({
    car: 'moto', name: 'Урал М-62', weight: 0.24, speedCap: 26, eff: 1.0, accelCap: 3.4, radius: 1.45,
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
  engine: { name: 'Урал 649 см³ 28 л.с.', power: 28, weight: 0.1, fuelUse: 0.008 },
  fuel: { name: 'бак 22 л', cap: 22, weight: 0.02 },

  models: {
    hull() {
      const P = mats('ural62');
      const root = new THREE.Group();
      const o = { r: 0.34, front: 0.74, rear: -0.72, head: [0.5, 1.0], seat: [-0.2, 0.84], fork: 'tele', guards: 'big', lamp: 0.11, pillion: true, sidecar: S };
      const wh = motoBase(root, P, o);
      for (const sx of [-1, 1]) add(root, U.box, P.black, sx * 0.13, 0.9, 0.08, 0.01, 0.1, 0.16);                // knee pads
      return motoResult(root, P, wh, { ...o, });
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => motoEngine(g, P, E, 'boxer', 1.1),
    fuel: (g, P) => motoTank(g, P, 'tear', 1.08),
  },
};
