// BTR-80 (1986): Soviet eight-wheeled amphibious armoured personnel carrier - boat-shaped hull with sloped upper
// sides, small conical turret with a KPVT heavy machine gun, seven infantrymen (six seats here) who fire from the
// roof hatches / ports
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, engineDeck, ovalPlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { roadWheels } from './apckit.js';

const TROOPS = [];
for (const z of [-2.3, -1.6, -0.9]) {
  for (const sx of [1, -1]) TROOPS.push({ pos: [sx * 0.6, 1.12, z], eye: [sx * 0.62, 2.5, z + 0.1], ry: sx * PI / 2, fire: true });
}

export default {
  key: 'btr80', name: 'БТР-80', year: 1986,
  palette: { main: 0x55613f, dark: 0x3f4830, engine: 0x3c3d38 },
  mg: 'kpvt',
  hull: {
    name: 'БТР-80', weight: 13.2, speedCap: 21, eff: 1.15, turn: 0.8, radius: 3.8, ammoMax: 0, mgAmmo: 500,
    armor: { front: 10, side: 8, rear: 7, top: 7 },
    wheeled: true, apc: true,
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.25, 0.75], w: [-0.95, -0.55] },
      { id: 'transmission', u: [-0.5, 0.5], v: [0.1, 0.4], w: [-0.6, -0.45] },
      { id: 'ammo', u: [0.5, 0.85], v: [0.3, 0.6], w: [0.1, 0.35] },
    ],
    crew: [
      { u: [-0.8, 0.8], v: [0.3, 0.95], w: [0.45, 0.9] },
      { u: [-0.8, 0.8], v: [0.3, 0.95], w: [-0.45, 0.45] },
    ],
    seats: {
      driver: { pos: [0.5, 1.05, 2.0], eye: [0.5, 1.72, 2.2], style: 'padded' },
      commander: { pos: [-0.5, 1.05, 2.0], eye: [-0.5, 1.72, 2.2], style: 'padded' },
    },
    troops: TROOPS,
    interior: {
      theme: 'soviet2', x: 1.0, floor: 0.7, roof: 2.02, z: [-2.7, 2.6], controls: 'wheel', seatStyle: 'padded', dials: 6, dash: true,
      slits: [{ x: [0.2, 0.8], y: [1.66, 1.78] }, { x: [-0.8, -0.2], y: [1.66, 1.78] }],
      walk: [{ x: [-0.3, 0.3], z: [-2.5, 1.5] }],
      props: [
        { type: 'radio', at: [-0.85, 1.3, 1.4], ry: -PI / 2, box2: true },
        { type: 'crate', at: [0.85, 0.85, 1.1], size: [0.28, 0.24, 0.35] },
        { type: 'crate', at: [0.85, 0.85, 0.7], size: [0.28, 0.24, 0.35] },
        { type: 'extinguisher', at: [0.96, 1.3, 0.2], back: 0.07 },
        { type: 'firstaid', at: [-0.97, 1.5, 0.3], ry: -PI / 2 },
        { type: 'lamp', at: [0, 1.98, -1.5] },
      ],
    },
  },
  turret: {
    name: 'Башня БПУ-1 (БТР-80)', weight: 0.5, elevMin: -0.1, elevMax: 0.9,
    armor: { front: 10, side: 8, rear: 8, top: 7 },
    modules: [{ id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.6] }],
    crew: [{ u: [-0.8, 0.8], v: [0.0, 0.9], w: [-0.8, 0.6] }],
    seats: { gunner: { pos: [0, -0.55, -0.12], eye: [0.12, 0.34, 0.12], style: 'padded' } },
  },
  gun: null,
  engine: { name: 'КамАЗ-7403 260 л.с.', power: 260, weight: 0.8, fuelUse: 0.12 },
  fuel: { name: 'баки 300 л', cap: 300, weight: 0.25 },
  drive: { name: 'привод башни БПУ-1', speed: 1.3, weight: 0.05 },

  models: {
    hull() {
      const P = mats('btr80');
      const root = new THREE.Group();
      // boat hull: pointed nose (the trim vane on it), long flat roof, sloped stern
      add(root, hullProfile([[-3.6, 0.6], [2.9, 0.6], [3.75, 1.15], [3.62, 1.55], [2.65, 2.05], [-3.35, 2.05], [-3.75, 1.5]], 2.2), P.main);
      for (const sx of [-1, 1]) {
        // upper side plates leaning out over the wheels
        add(root, sizedBox(0.05, 0.75, 6.3), P.main, sx * 1.28, 1.62, -0.35, 1, 1, 1, 0, 0, -sx * 0.35);
        add(root, U.box, P.dark, sx * 1.4, 1.26, -0.35, 0.2, 0.04, 6.2);
        add(root, U.box, P.dark, sx * 1.3, 1.5, -0.05, 0.03, 0.75, 0.75, 0, 0, -sx * 0.35);                  // side door (hatch)
        for (const z of [-2.3, -1.6, -0.9]) {
          add(root, U.box, P.dark, sx * 0.6, 2.07, z, 0.52, 0.04, 0.5);                                   // roof hatches
          add(root, U.cylX, P.black, sx * 1.27, 1.62, z + 0.3, 0.05, 0.05, 0.05, 0, 0, -sx * 0.35);         // firing ports
        }
        add(root, U.cylZ, P.glass, sx * 0.8, 1.5, 3.6, 0.07, 0.07, 0.05);
        for (let i = 0; i < 3; i++) add(root, U.box, P.black, sx * (0.3 + i * 0.22), 2.07, 2.55, 0.12, 0.05, 0.03);   // periscopes
      }
      add(root, U.box, P.dark, 0, 1.45, 3.68, 2.0, 0.04, 0.35, 0.8, 0, 0);                                    // trim vane
      add(root, U.box, P.black, 0.45, 1.8, 3.1, 0.55, 0.3, 0.02, -0.9, 0, 0);                                // windscreen flaps
      add(root, U.box, P.black, -0.45, 1.8, 3.1, 0.55, 0.3, 0.02, -0.9, 0, 0);
      for (let i = 0; i < 6; i++) add(root, U.box, P.black, 0, 2.07, -2.9 + i * 0.12, 1.4, 0.01, 0.04);       // engine grilles
      for (let i = 0; i < 6; i++) add(root, U.cyl, P.dark, -0.95 + i * 0.1, 2.2, 0.9, 0.035, 0.2, 0.035);      // smoke dischargers
      add(root, U.cyl, P.dark, -0.9, 2.9, -1.2, 0.01, 1.8, 0.01);                                             // aerial
      const wh = roadWheels(root, P, { x: 1.15, zs: [2.55, 1.25, -0.9, -2.2], r: 0.56, w: 0.36, steer: 2 });
      const bay = engineDeck(root, P, new THREE.Vector3(0, 2.05, -2.6), 1.2, 1.1, P.dark);
      bay.engineTop = 2.0;
      return {
        root, wheels: wh.wheels, wheelR: 0.56, steer: wh.steer, bay,
        ring: { pos: new THREE.Vector3(0, 2.05, 0.8), r: 0.62 },
        ringHole: null,
        box: new THREE.Box3(new THREE.Vector3(-1.45, 0.4, -3.75), new THREE.Vector3(1.45, 2.08, 3.78)),
        fuelAt: new THREE.Vector3(0, 1.45, -3.82), fuelRot: 0,
        driveAt: new THREE.Vector3(0, 2.05, 0.8),
        mgAt: new THREE.Vector3(0.3, 0.02, -0.2),
      };
    },
    turret() {
      const P = mats('btr80');
      const g = new THREE.Group();
      // BPU-1: truncated cone, the KPVT with its armoured mantlet in front, sight on the roof
      add(g, new THREE.CylinderGeometry(0.42, 0.62, 0.5, 14), P.main, 0, 0.25, 0);
      add(g, U.cyl, P.dark, 0, 0.52, 0, 0.38, 0.05, 0.38);
      add(g, U.box, P.dark, 0, 0.26, 0.6, 0.36, 0.3, 0.2);
      add(g, U.cylZ, P.metal, 0, 0.26, 0.95, 0.06, 0.06, 0.5);
      add(g, U.cyl, P.dark, 0.18, 0.62, 0.05, 0.08, 0.14, 0.08);                                               // sight head
      add(g, U.box, P.dark, -0.15, 0.56, -0.2, 0.34, 0.04, 0.34);                                             // hatch
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.26, 0.6), sightY: 0.62, mgPos: new THREE.Vector3(0, 0.12, 0.62), mgInside: true,
        box: new THREE.Box3(new THREE.Vector3(-0.62, 0, -0.62), new THREE.Vector3(0.62, 0.62, 0.72)),
      };
    },
    gun: null,
    engine: ENGINE_TYPES.v12diesel,
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [-0.55, 0.55], w: 0.9, h: 0.4, d: 0.12 }),
    driveR: 0.6,
    turretInterior: {
      poly: ovalPlan(0.55, 0.55, 0.55, 12), h: 0.5,
      props: [
        { type: 'gunner', eye: [0.12, 0.34, 0.12], style: 'periscope' },
        { type: 'ready', at: [-0.4, 0.15, 0.05], ry: -PI / 2, n: 4, cal: 0.03, len: 0.3 },
      ],
    },
  },
};
