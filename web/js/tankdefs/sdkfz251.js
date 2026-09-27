// Sd.Kfz. 251/1 (1939): German half-track armoured personnel carrier - steered front wheels, tracked rear unit,
// open-topped troop compartment for ten men (eight benches here), MG 34 behind a shield over the cab
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, runningGear, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { roadWheels, fender, openBox, benches, troopSeats, mgShield, slit } from './apckit.js';

const TROOPS = troopSeats({ x: 0.6, z0: -2.45, z1: -0.55, seatY: 1.28, n: 4, eyeUp: 0.8 });

export default {
  key: 'sdkfz251', name: 'Sd.Kfz. 251', year: 1939,
  palette: { main: 0x4f534a, dark: 0x3b3e37, engine: 0x44423c },
  mg: 'mg34',
  hull: {
    name: 'Sd.Kfz. 251', weight: 8.5, speedCap: 14, eff: 1.15, turn: 0.9, radius: 3.0, ammoMax: 0, mgAmmo: 2000,
    armor: { front: 14, side: 8, rear: 8, top: 0 },
    wheeled: true, apc: true,
    turretless: true, arc: 0.6, elevMin: -0.3, elevMax: 0.6,
    modules: [
      { id: 'engine', u: [-0.45, 0.45], v: [0.2, 0.75], w: [0.5, 0.95] },
      { id: 'transmission', u: [-0.4, 0.4], v: [0.05, 0.4], w: [0.3, 0.5] },
      { id: 'ammo', u: [0.55, 0.9], v: [0.35, 0.6], w: [-0.35, 0.1] },
    ],
    crew: [
      { u: [-0.8, 0.8], v: [0.4, 1.0], w: [0.15, 0.45] },
      { u: [-0.8, 0.8], v: [0.4, 1.0], w: [-0.95, 0.15] },
    ],
    seats: {
      driver: { pos: [0.45, 1.05, 0.8], eye: [0.45, 1.66, 0.98], style: 'pan' },
      commander: { pos: [-0.45, 1.05, 0.8], eye: [-0.45, 1.66, 0.98], style: 'pan' },
      gunner: { pos: [0, 1.3, 0.2], eye: [0, 2.08, 0.5], style: 'pan' },
    },
    troops: TROOPS,
    interior: {
      theme: 'german', open: true, x: 0.9, floor: 0.88, roof: 1.75, z: [-2.85, 1.2], controls: 'wheel', seatStyle: 'pan', dials: 3,
      slits: [{ x: [0.25, 0.65], y: [1.5, 1.58] }, { x: [-0.65, -0.25], y: [1.5, 1.58] }],
      engineInside: false,
      walk: [{ x: [-0.3, 0.3], z: [-2.6, 0.55] }],
      props: [
        { type: 'radio', at: [-0.7, 1.3, 0.25], ry: -PI / 2 },
        { type: 'crate', at: [0.72, 1.0, 0.3], size: [0.28, 0.22, 0.35], mat: 'gear' },
        { type: 'crate', at: [0.0, 0.98, -2.6], size: [0.5, 0.18, 0.3], mat: 'gear' },
        { type: 'extinguisher', at: [0.84, 1.3, -0.3], back: 0.07 },
        { type: 'rifle', at: [-0.85, 1.35, -1.5], ry: -PI / 2 },
        { type: 'watercan', at: [0.72, 1.0, 0.0] },
        { type: 'lamp', at: [0, 1.7, 1.1] },
      ],
    },
  },
  turret: null,
  gun: null,
  engine: { name: 'Maybach HL 42 100 л.с.', power: 100, weight: 0.45, fuelUse: 0.07 },
  fuel: { name: 'канистры 160 л', cap: 160, weight: 0.15 },
  drive: { name: 'вертлюг MG 34', speed: 1.6, weight: 0.03, fixed: true },

  models: {
    hull() {
      const P = mats('sdkfz251');
      const root = new THREE.Group();
      // lower hull under the troop floor, the long armoured bonnet in front
      add(root, hullProfile([[-2.9, 0.45], [1.6, 0.45], [2.55, 0.58], [2.98, 0.75], [2.98, 0.98], [2.4, 1.2], [1.28, 1.4], [1.2, 0.86], [-2.9, 0.86]], 1.22), P.main);
      // troop compartment: sloped side plates, rear plate with the doors
      openBox(root, P, { x: 0.98, z0: -2.9, z1: 1.28, floor: 0.86, top: 1.75, lean: 0.16 });
      add(root, sizedBox(1.9, 0.4, 0.05), P.main, 0, 1.55, 1.24, 1, 1, 1, -0.35, 0, 0);          // front plate over the cab
      for (const sx of [0.45, -0.45]) slit(root, P, sx, 1.56, 1.29, 0.36, 0, -0.35);
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 0.34, 1.28, -2.93, 0.6, 0.78, 0.03);   // rear doors
      add(root, U.box, P.metal, 0, 1.28, -2.95, 0.04, 0.7, 0.03);
      benches(root, P, 0.6, -2.5, -0.5, 1.22);
      // fenders over the tracks with stowage bins, front wheel guards
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 0.98, 0.78, -0.75, 0.34, 0.04, 4.1);
        add(root, sizedBox(0.3, 0.26, 0.9), P.main, sx * 1.0, 0.93, -1.6);
        add(root, sizedBox(0.3, 0.26, 0.6), P.main, sx * 1.0, 0.93, 0.35);
        fender(root, P, sx * 0.9, 2.3, 0.42, 0.24);
        add(root, U.cylZ, P.glass, sx * 0.55, 1.05, 2.95, 0.07, 0.07, 0.06);                          // headlights
        add(root, U.cylZ, P.dark, sx * 0.55, 1.05, 2.92, 0.09, 0.09, 0.08);
      }
      add(root, U.box, P.dark, 0, 0.88, 2.99, 0.9, 0.18, 0.03);                                         // radiator louvres
      add(root, U.cylZ, P.rust, -0.45, 0.55, -2.95, 0.05, 0.05, 0.2);                                   // exhaust
      add(root, U.cyl, P.dark, -0.85, 2.2, -2.5, 0.01, 0.9, 0.01);                                      // aerial
      // running gear: steered front wheels + interleaved road wheels of the track unit
      const front = roadWheels(root, P, { x: 0.9, zs: [2.3], r: 0.42, w: 0.2, steer: 1 });
      const tw = runningGear(root, P, {
        x: 0.8, w: 0.3, wheels: [0.72, 0.28, -0.16, -0.6, -1.04, -1.48, -1.92], wr: 0.27, wy: 0.3,
        idler: [-2.42, 0.42, 0.25], sprocket: [1.12, 0.46, 0.28], spokes: false,
      });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.3, 1.92), 0.82, 0.9, P.dark);
      bay.engineTop = 1.24;
      const shield = mgShield(P, 0.62, 0.46);
      shield.position.set(0, -0.12, 0.12);
      return {
        root, wheels: [...front.wheels, ...tw], wheelR: 0.3, steer: front.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 1.72, 1.02),
        box: new THREE.Box3(new THREE.Vector3(-1.08, 0.05, -2.95), new THREE.Vector3(1.08, 1.78, 3.0)),
        fuelAt: new THREE.Vector3(0, 1.1, -3.12), fuelRot: 0,
        driveAt: new THREE.Vector3(0, 1.72, 1.02),
        ringHole: null,
        mgAt: new THREE.Vector3(0, 0.02, 0), mgShield: shield,
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 6, 0.72),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 4, h: 0.46, d: 0.16, w: 0.3 }),
    drive(g, P) {
      add(g, U.cyl, P.metal, 0, -0.08, 0, 0.07, 0.16, 0.07);
      add(g, U.box, P.dark, 0, -0.16, 0, 0.3, 0.04, 0.2);
    },
  },
};
