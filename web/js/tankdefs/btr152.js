// BTR-152 (1950): Soviet six-wheeled armoured personnel carrier on a ZiS-151 truck chassis - armoured bonnet,
// open-topped troop box for seventeen men (eight seats here), SGMB machine gun on a pintle at the front of the box
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { roadWheels, fender, openBox, benches, troopSeats, mgShield, slit } from './apckit.js';

const TROOPS = troopSeats({ x: 0.82, z0: -2.85, z1: -0.55, seatY: 1.58, n: 4, eyeUp: 0.8 });

export default {
  key: 'btr152', name: 'БТР-152', year: 1950,
  palette: { main: 0x4f5b38, dark: 0x3b4529, engine: 0x3f3f3a },
  mg: 'sgmb',
  hull: {
    name: 'БТР-152', weight: 8.9, speedCap: 16, eff: 1.3, turn: 0.75, radius: 3.4, ammoMax: 0, mgAmmo: 1250,
    armor: { front: 13, side: 9, rear: 9, top: 0 },
    wheeled: true, apc: true,
    turretless: true, arc: 0.7, elevMin: -0.3, elevMax: 0.6,
    modules: [
      { id: 'engine', u: [-0.4, 0.4], v: [0.3, 0.7], w: [0.5, 0.95] },
      { id: 'transmission', u: [-0.35, 0.35], v: [0.15, 0.45], w: [0.2, 0.45] },
      { id: 'ammo', u: [0.5, 0.85], v: [0.5, 0.7], w: [0.0, 0.2] },
    ],
    crew: [
      { u: [-0.8, 0.8], v: [0.5, 1.0], w: [0.2, 0.5] },
      { u: [-0.8, 0.8], v: [0.5, 1.0], w: [-0.95, 0.2] },
    ],
    seats: {
      driver: { pos: [0.5, 1.5, 0.95], eye: [0.5, 2.1, 1.15], style: 'padded' },
      commander: { pos: [-0.5, 1.5, 0.95], eye: [-0.5, 2.1, 1.15], style: 'padded' },
      gunner: { pos: [0, 1.55, 0.2], eye: [0, 2.35, 0.45], style: 'pan' },
    },
    troops: TROOPS,
    interior: {
      theme: 'soviet', open: true, x: 1.05, floor: 1.15, roof: 2.08, z: [-3.15, 1.38], controls: 'wheel', seatStyle: 'pan', dials: 4,
      slits: [{ x: [0.2, 0.8], y: [1.85, 1.95] }, { x: [-0.8, -0.2], y: [1.85, 1.95] }],
      walk: [{ x: [-0.4, 0.4], z: [-2.95, 0.6] }],
      props: [
        { type: 'radio', at: [-0.9, 1.6, 0.3], ry: -PI / 2 },
        { type: 'crate', at: [0.85, 1.27, 0.35], size: [0.3, 0.22, 0.35] },
        { type: 'crate', at: [0.0, 1.27, -3.0], size: [0.6, 0.2, 0.25], mat: 'wood' },
        { type: 'extinguisher', at: [1.0, 1.6, -0.3], back: 0.07 },
        { type: 'rifle', at: [-1.0, 1.7, -1.7], ry: -PI / 2 },
        { type: 'rifle', at: [1.0, 1.7, -1.7], ry: PI / 2 },
        { type: 'watercan', at: [0.85, 1.28, 0.0] },
      ],
    },
  },
  turret: null,
  gun: null,
  engine: { name: 'ЗиС-123 110 л.с.', power: 110, weight: 0.5, fuelUse: 0.08 },
  fuel: { name: 'баки 300 л', cap: 300, weight: 0.25 },
  drive: { name: 'вертлюг СГМБ', speed: 1.6, weight: 0.03, fixed: true },

  models: {
    hull() {
      const P = mats('btr152');
      const root = new THREE.Group();
      // truck frame + armoured bonnet with the radiator shutters
      add(root, U.box, P.dark, 0, 0.8, 0, 1.0, 0.25, 6.4);
      add(root, hullProfile([[1.3, 0.95], [2.9, 0.95], [3.35, 1.15], [3.35, 1.45], [2.7, 1.7], [1.3, 1.85]], 1.3), P.main);
      add(root, U.box, P.dark, 0, 1.28, 3.37, 0.9, 0.3, 0.03);
      for (let i = 0; i < 6; i++) add(root, U.box, P.black, 0, 1.18 + i * 0.045, 3.38, 0.86, 0.012, 0.012);
      // the troop box: floor high over the frame, sloped plates, cab front with two vision flaps
      add(root, sizedBox(2.2, 0.25, 4.6), P.main, 0, 1.03, -0.9);
      openBox(root, P, { x: 1.12, z0: -3.2, z1: 1.4, floor: 1.15, top: 2.08, lean: 0.1 });
      add(root, sizedBox(2.1, 0.5, 0.05), P.main, 0, 1.85, 1.38, 1, 1, 1, -0.4, 0, 0);
      for (const x of [0.5, -0.5]) {
        slit(root, P, x, 1.9, 1.44, 0.5, 0, -0.4);
        add(root, U.box, P.dark, x, 2.08, 1.55, 0.56, 0.03, 0.22, -1.0, 0, 0);                           // flaps open
      }
      add(root, U.box, P.dark, 0, 1.6, -3.23, 0.8, 0.8, 0.03);                                             // rear door
      benches(root, P, 0.82, -2.95, -0.45, 1.52);
      // wheels (single front, rear pairs), mudguards, spare wheel, lights
      const wh = roadWheels(root, P, { x: 0.9, zs: [2.45, -1.15, -2.45], r: 0.55, w: 0.3, steer: 1 });
      for (const sx of [-1, 1]) {
        fender(root, P, sx * 0.92, 2.45, 0.55, 0.32);
        add(root, U.box, P.main, sx * 0.95, 1.2, -1.8, 0.38, 0.04, 2.3);
        add(root, U.cylZ, P.glass, sx * 0.68, 1.62, 3.0, 0.08, 0.08, 0.05);
        add(root, U.cylZ, P.dark, sx * 0.68, 1.62, 2.96, 0.1, 0.1, 0.08);
        add(root, U.box, P.dark, sx * 1.15, 1.5, 0.2, 0.06, 0.12, 0.8);                                 // grab rails
      }
      add(root, U.cylX, P.rubber, -1.2, 1.6, -0.6, 0.2, 0.45, 0.45);                                      // spare wheel on the side
      add(root, U.cylX, P.main, -1.28, 1.6, -0.6, 0.06, 0.28, 0.28);
      add(root, U.cyl, P.dark, 1.0, 2.9, -3.0, 0.01, 1.6, 0.01);                                         // aerial
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.78, 2.0), 0.9, 1.0, P.dark);
      bay.engineTop = 1.72;
      const shield = mgShield(P, 0.6, 0.42);
      shield.position.set(0, -0.1, 0.12);
      return {
        root, wheels: wh.wheels, wheelR: 0.55, steer: wh.steer, ring: null, bay,
        mount: new THREE.Vector3(0, 2.02, 1.1),
        box: new THREE.Box3(new THREE.Vector3(-1.2, 0.3, -3.25), new THREE.Vector3(1.2, 2.1, 3.4)),
        fuelAt: new THREE.Vector3(1.2, 1.05, 0.55), fuelRot: PI / 2,
        driveAt: new THREE.Vector3(0, 2.02, 1.1),
        ringHole: null,
        mgAt: new THREE.Vector3(0, 0.02, 0), mgShield: shield,
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 6, 0.78),
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [0], w: 1.0, h: 0.34, d: 0.3, straps: true }),
    drive(g, P) {
      add(g, U.cyl, P.metal, 0, -0.08, 0, 0.07, 0.16, 0.07);
      add(g, U.box, P.dark, 0, -0.16, 0, 0.3, 0.04, 0.2);
    },
  },
};
