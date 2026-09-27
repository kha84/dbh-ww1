// Mark IX (1918): the first armoured personnel carrier - a lengthened rhomboid on Mark V running gear with the
// engine moved forward so the whole middle is free for thirty infantrymen (eight seats here) who fire through
// loopholes in the sides; a Hotchkiss on the front of the cab
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, worldUV, sizedBox, engineDeck, loopTrack, ENGINE_TYPES } from '../modelkit.js';
import { troopSeats } from './apckit.js';

let HORNS = null;
function horns() {
  if (HORNS) return HORNS;
  HORNS = loopTrack(s => {
    s.moveTo(-2.8, 0.14);
    s.lineTo(1.9, 0.14);
    s.lineTo(4.25, 1.4);
    s.quadraticCurveTo(4.75, 1.72, 4.6, 2.15);
    s.quadraticCurveTo(4.42, 2.5, 3.85, 2.5);
    s.lineTo(-3.75, 2.5);
    s.quadraticCurveTo(-4.5, 2.5, -4.62, 1.9);
    s.lineTo(-4.52, 1.2);
    s.quadraticCurveTo(-4.42, 0.8, -4.0, 0.62);
    s.lineTo(-2.8, 0.14);
  }, 0.6, 0.56, 0.14);
  return HORNS;
}

// loopholes of the infantry: the men sit on benches and fire through the sides
const TROOPS = troopSeats({ x: 0.42, z0: -2.7, z1: 0.9, seatY: 0.92, n: 4, eyeUp: 0.52, eyeX: 0.68 });
const PORTS = TROOPS.filter(s => s.eye[0] > 0).map(s => ({ z: [s.eye[2] - 0.13, s.eye[2] + 0.13], y: [1.36, 1.52] }));

export default {
  key: 'markIX', name: 'Mark IX', year: 1918,
  palette: { main: 0x68653f, dark: 0x504e31, engine: 0x3d3a36, riveted: true },
  mg: 'hotchkiss',
  hull: {
    name: 'Mark IX', weight: 27, speedCap: 7, eff: 0.7, turn: 0.65, radius: 3.8, ammoMax: 0, mgAmmo: 2400,
    armor: { front: 10, side: 8, rear: 8, top: 6 },
    apc: true,
    turretless: true, arc: 0.9, elevMin: -0.25, elevMax: 0.4,
    modules: [
      { id: 'engine', u: [-0.35, 0.35], v: [0.15, 0.6], w: [0.35, 0.65] },
      { id: 'transmission', u: [-0.45, 0.45], v: [0.1, 0.45], w: [-0.9, -0.7] },
      { id: 'ammo', u: [0.3, 0.45], v: [0.15, 0.5], w: [-0.2, 0.2] },
    ],
    crew: [
      { u: [-0.4, 0.4], v: [0.4, 1.0], w: [0.65, 0.85] },
      { u: [-0.45, 0.45], v: [0.15, 0.85], w: [-0.7, 0.3] },
    ],
    seats: {
      driver: { pos: [0.35, 1.72, 3.1], eye: [0.35, 2.48, 3.35], style: 'saddle' },
      commander: { pos: [-0.35, 1.72, 3.1], eye: [-0.35, 2.48, 3.35], style: 'saddle' },
      gunner: { pos: [0, 1.72, 2.55], eye: [0, 2.55, 2.95], style: 'saddle' },
    },
    troops: TROOPS,
    interior: {
      theme: 'ww1', controls: 'levers', seatStyle: 'saddle', dials: 2,
      x: 0.72, floor: 0.45, roof: 2.2, z: [-3.4, 3.6],
      cab: { x: 0.7, z: [2.45, 3.6], top: 2.75, floor: 1.6 },
      slits: [{ x: [0.12, 0.55], y: [2.42, 2.56] }, { x: [-0.55, -0.12], y: [2.42, 2.56] }],
      sideSlits: PORTS,
      engineInside: true,
      walk: [{ x: [-0.2, 0.2], z: [-3.0, 2.3] }],
      props: [
        { type: 'engineguard', rect: [-0.5, 1.5, 0.5, 2.3], y: 1.3, floor: 0.45 },
        { type: 'sidemg', at: [0.7, 1.45, -3.1], ry: PI },
        { type: 'fuelcell', box: [0.3, 0.45, -3.38, 0.7, 1.3, -3.0] },
        { type: 'fuelcell', box: [-0.7, 0.45, -3.38, -0.3, 1.3, -3.0] },
        { type: 'gearbox', at: [0, 0.72, -2.95], w: 0.5, h: 0.45, d: 0.4 },
        { type: 'crate', at: [0, 0.57, -1.0], size: [0.3, 0.24, 0.5], mat: 'wood' },
        { type: 'crate', at: [0, 0.57, 0.3], size: [0.3, 0.24, 0.4], mat: 'wood' },
        { type: 'extinguisher', at: [0.7, 1.1, 1.3], back: 0.07 },
        { type: 'lamp', at: [0, 2.14, -1.5] },
        { type: 'lamp', at: [0, 2.14, 0.8] },
      ],
    },
  },
  turret: null,
  gun: null,
  engine: { name: 'Ricardo 150', power: 150, weight: 1.5, fuelUse: 0.2 },
  fuel: { name: 'бак 450 л', cap: 450, weight: 0.6 },
  drive: { name: 'шаровая установка Hotchkiss', speed: 1.2, weight: 0.05, fixed: true },

  models: {
    hull() {
      const P = mats('markIX');
      const H = horns();
      const root = new THREE.Group();
      for (const sx of [-1, 1]) {
        add(root, H.frame, P.main, sx > 0 ? 1.38 : -0.78, 0, 0);
        add(root, H.belt, H.beltMat, sx > 0 ? 1.36 : -0.8, 0, 0);
        add(root, sizedBox(0.06, 0.8, 0.9), P.dark, sx * 1.4, 1.2, -1.0);                             // side doors
        for (const z of [-2.7, -1.5, -0.3, 0.9]) add(root, U.box, P.black, sx * 1.39, 1.45, z, 0.02, 0.1, 0.18);   // loopholes
      }
      // body between the horns, the cab in front, the rear MG cupola
      add(root, worldUV(hullProfile([[-4.1, 0.45], [3.3, 0.45], [3.7, 1.0], [3.7, 2.2], [-4.1, 2.2]], 1.56)), P.main);
      add(root, sizedBox(1.4, 0.55, 1.2), P.main, 0, 2.47, 3.05);
      for (const x of [0.33, -0.33]) add(root, U.box, P.dark, x, 2.66, 3.66, 0.46, 0.03, 0.16, -0.5, 0, 0);   // vision flaps
      add(root, sizedBox(0.9, 0.45, 0.9), P.main, 0, 2.42, -3.4);
      add(root, U.box, P.black, 0, 2.45, -3.86, 0.3, 0.08, 0.02);
      add(root, U.cylZ, P.rust, 0.5, 2.34, 1.2, 0.07, 0.07, 2.2);                                          // exhaust along the roof
      add(root, U.cyl, P.rust, 0.5, 2.25, 2.25, 0.07, 0.2, 0.07);
      for (let z = -3; z < 3; z += 0.75) add(root, U.box, P.metal, 0, 2.23, z, 1.5, 0.02, 0.05);            // roof seams
      const bay = engineDeck(root, P, new THREE.Vector3(0, 2.2, 1.9), 0.9, 1.0, P.dark);
      bay.engineFloor = 0.45;
      return {
        root, wheels: [], wheelR: 1, ring: null, bay,
        mount: new THREE.Vector3(0, 2.45, 3.66),
        box: new THREE.Box3(new THREE.Vector3(-1.45, 0, -4.7), new THREE.Vector3(1.45, 2.78, 4.75)),
        fuelAt: new THREE.Vector3(0, 1.1, -4.3), fuelRot: 0,
        driveAt: new THREE.Vector3(0, 2.25, 3.4),
        ringHole: null,
        mgAt: new THREE.Vector3(0, -0.2, 0.05), noPost: true,
      };
    },
    turret: null,
    gun: null,
    engine: ENGINE_TYPES.ricardo,
    fuel(g, P) {
      add(g, sizedBox(1.4, 0.7, 0.6), P.main, 0, 0, 0);
      add(g, U.cyl, P.brass, 0.45, 0.38, 0, 0.08, 0.06, 0.08);
      return 0.35;
    },
    drive(g, P) {
      add(g, U.box, P.engine, 0, 0.12, 0, 0.35, 0.25, 0.3);
      add(g, new THREE.TorusGeometry(0.14, 0.022, 6, 16), P.metal, 0.22, 0.18, 0, 1, 1, 1, 0, PI / 2, 0);
    },
  },
};
