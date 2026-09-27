// Chieftain AVRE (1986): British engineer tank with a dozer blade and the 165 mm demolition gun
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, prism, link, runningGear, engineDeck, hullResult, breech, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const PLAN = [[0.45, 1.75], [1.3, 1.05], [1.5, -0.2], [1.4, -1.55], [0.85, -1.9], [-0.85, -1.9], [-1.4, -1.55], [-1.5, -0.2], [-1.3, 1.05], [-0.45, 1.75]];

export default {
  key: 'avre', name: 'Chieftain', year: 1986,
  palette: { main: 0x4b5739, dark: 0x343d28, engine: 0x5a6258 },
  mg: 'm240',
  hull: {
    name: 'Chieftain AVRE', weight: 36, speedCap: 14, eff: 1.0, turn: 0.95, radius: 3.4, ammoMax: 20,
    armor: { front: 220, side: 70, rear: 45, top: 30 },
    modules: [
      { id: 'ammo', u: [0.2, 0.9], v: [0.15, 0.7], w: [0.3, 0.8] },
      { id: 'engine', u: [-0.7, 0.7], v: [0.15, 0.85], w: [-0.85, -0.35] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.6], w: [-1.0, -0.85] },
    ],
    crew: [
      { u: [-0.3, 0.3], v: [0.2, 0.8], w: [0.55, 0.95] },
      { u: [-0.6, 0.6], v: [0.2, 1.0], w: [-0.3, 0.3] },
    ],
    seats: { driver: { pos: [0, 0.62, 2.28], eye: [0, 1.26, 2.5], recline: true } },
    interior: {
      theme: 'british', controls: 'levers', dials: 5, ammoCal: 0.08,
      x: 1.0, floor: 0.55, roof: 1.62, z: [-0.9, 2.95],
      slits: [{ x: [-0.4, 0.4], y: [1.19, 1.32] }],
      walk: [{ x: [-0.85, 0.85], z: [-0.75, 1.45] }, { x: [-0.35, 0.35], z: [1.45, 2.3] }],
      ammo: { x: [0.4, 0.95], z: [1.6, 2.6] },
      props: [
        { type: 'fuelcell', box: [-0.98, 0.55, 1.4, -0.5, 1.3, 2.6] },
        { type: 'rack', style: 'charges', x: [-0.95, -0.55], z: [-0.8, 0.3], y0: 0.57, h: 0.5, cal: 0.06 },
        { type: 'battery', at: [0.72, 0.67, -0.75] },
        { type: 'extinguisher', at: [0.95, 0.95, 0.4], back: 0.07 },
        { type: 'panel', at: [0.97, 1.1, -0.2], ry: -PI / 2, w: 0.4, dials: 4 },
        { type: 'watercan', at: [0.8, 0.72, 0.9] },
        { type: 'pipe', pts: [[0.97, 1.45, 2.8], [0.97, 1.45, -0.85]], r: 0.015, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Chieftain', weight: 12, elevMin: -0.1, elevMax: 0.35,
    armor: { front: 260, side: 110, rear: 60, top: 35 },
    modules: [
      { id: 'turret', u: [-0.5, 0.5], v: [0.0, 0.2], w: [-0.4, 0.4] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.2, 0.8], w: [-0.2, 1.0] },
      { id: 'ammo', u: [0.3, 0.8], v: [0.1, 0.5], w: [-0.8, -0.3] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.9], w: [-0.6, 0.4] }],
    seats: {
      gunner: { pos: [-0.5, -0.3, 0.45], eye: [-0.5, 0.47, 0.7] },
      commander: { pos: [-0.55, 0.1, -0.62], eye: [-0.55, 0.98, -0.55] },
    },
  },
  gun: { name: 'L9A1', caliber: '165 мм', weight: 2.8, reload: 9, shellSpeed: 380, pen: 250, dmg: 1.6, disp: 0.005, elevSpeed: 0.18 },
  engine: { name: 'Leyland L60', power: 750, weight: 1.9, fuelUse: 0.3 },
  fuel: { name: 'баки 2×180 л', cap: 360, weight: 0.4 },
  drive: { name: 'привод башни Chieftain', speed: 0.4, weight: 0.3 },

  models: {
    hull() {
      const P = mats('avre');
      const root = new THREE.Group();
      add(root, hullProfile([[-3.45, 0.5], [3.2, 0.5], [3.85, 0.95], [1.9, 1.62], [-3.35, 1.62], [-3.6, 1.2]], 2.2), P.main);
      const wheels = runningGear(root, P, {
        x: 1.46, w: 0.6, wheels: [2.2, 1.3, 0.4, -0.5, -1.4, -2.3], wr: 0.37, wy: 0.4,
        idler: [3.02, 0.64, 0.3], sprocket: [-3.15, 0.7, 0.35],
      });
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 1.47, 1.46, -0.1, 0.68, 0.05, 6.7);                               // track guard
        add(root, U.box, P.main, sx * 1.8, 1.2, -0.3, 0.05, 0.5, 6.1);                                  // bazooka plates
        for (let z = -3.0; z < 2.8; z += 1.02) add(root, U.box, P.dark, sx * 1.83, 1.2, z, 0.02, 0.48, 0.03);
        add(root, U.box, P.dark, sx * 1.47, 1.66, 1.4, 0.55, 0.36, 1.6);                                // stowage bins
        add(root, U.box, P.dark, sx * 1.47, 1.62, -2.5, 0.5, 0.3, 1.2);                                 // exhaust boxes
        add(root, U.box, P.grille, sx * 1.47, 1.78, -2.5, 0.42, 0.02, 1.0);
        link(root, P.dark, sx * 1.15, 0.14, 2.8, 0.75, 4.05, 0.55, 0.16);                               // dozer arms
        add(root, U.cylZ8, P.metal, sx * 1.15, 1.05, 3.55, 0.07, 0.07, 1.1, -0.45, 0, 0);               // hydraulic ram
      }
      // dozer blade
      add(root, U.box, P.main, 0, 0.62, 4.12, 3.5, 0.95, 0.1, 0.12, 0, 0);
      add(root, U.box, P.dark, 0, 1.08, 4.08, 3.5, 0.08, 0.2);
      add(root, U.box, P.metal, 0, 0.16, 4.2, 3.5, 0.06, 0.12);
      for (const x of [-1.2, -0.4, 0.4, 1.2]) add(root, U.box, P.dark, x, 0.62, 4.02, 0.08, 0.85, 0.15, 0.12, 0, 0);
      add(root, U.cyl, P.metal, 0, 1.64, 1.55, 0.3, 0.05, 0.3);                                          // driver hatch
      add(root, U.box, P.glass, 0, 1.64, 1.88, 0.3, 0.05, 0.07);
      add(root, U.box, P.grille, 0, 1.63, -3.2, 1.9, 0.02, 0.3);
      add(root, U.box, P.dark, 0, 1.25, -3.62, 2.0, 0.05, 0.05);                                        // rear stowage frame
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.62, -2.05), 1.9, 1.8);
      bay.engineTop = 1.72;
      return hullResult(root, P, {
        wheels, wheelR: 0.37, bay, ring: { pos: new THREE.Vector3(0, 1.62, 0.35), r: 1.1 }, holeR: 1.08,
        box: new THREE.Box3(new THREE.Vector3(-1.84, 0.1, -4.25), new THREE.Vector3(1.84, 1.7, 4.22)),
        fuelAt: new THREE.Vector3(0, 1.12, -3.92),
      });
    },
    turret() {
      const P = mats('avre');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(1.15, 1.2, 0.1, 30), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.85, 0.72, -0.25), P.main, 0, 0.02, 0);
      add(g, U.cyl, P.main, -0.55, 0.95, -0.55, 0.36, 0.42, 0.36);        // commander cupola (right side)
      add(g, U.cyl, P.glass, -0.55, 1.03, -0.55, 0.37, 0.08, 0.37);
      add(g, U.cyl, P.dark, -0.55, 1.18, -0.55, 0.33, 0.05, 0.33);
      add(g, U.cyl, P.main, 0.5, 0.88, -0.55, 0.3, 0.05, 0.3);                // loader hatch
      add(g, U.box, P.main, -0.5, 0.9, 0.62, 0.3, 0.2, 0.35);                // gunner sight
      add(g, U.box, P.glass, -0.5, 0.9, 0.8, 0.22, 0.12, 0.02);
      add(g, U.box, P.dark, 1.5, 0.55, 0.3, 0.38, 0.45, 0.62);               // searchlight on the left side
      add(g, U.box, P.glass, 1.5, 0.55, 0.62, 0.3, 0.36, 0.02);
      for (const sx of [-1, 1]) {
        add(g, U.box, P.dark, sx * 1.35, 0.4, -1.3, 0.3, 0.45, 0.8, 0, sx * 0.25, 0);     // bins
        for (const y of [0.45, 0.58]) add(g, U.cylZ8, P.black, sx * 1.05, y, 1.25, 0.05, 0.05, 0.25, -0.35, sx * 0.5, 0);
      }
      add(g, U.box, P.dark, 0, 0.45, -1.98, 1.5, 0.4, 0.2);
      add(g, U.cyl, P.metal, 0.6, 1.3, -1.2, 0.015, 1.0, 0.015);             // antenna
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.4, 1.72), sightY: 1.12, mgPos: new THREE.Vector3(0.5, 0.9, -0.55),
        box: new THREE.Box3(new THREE.Vector3(-1.5, 0, -1.95), new THREE.Vector3(1.5, 0.92, 1.75)),
      };
    },
    gun() {
      const P = mats('avre');
      const g = new THREE.Group();
      add(g, U.sph, P.dark, 0, 0, 0.12, 0.55, 0.4, 0.34);                  // canvas mantlet cover
      add(g, U.box, P.main, 0, 0, 0.3, 0.6, 0.45, 0.2);
      add(g, new THREE.CylinderGeometry(0.14, 0.16, 2.0, 16).rotateX(Math.PI / 2), P.main, 0, 0, 1.35);
      add(g, U.cylZ, P.metal, 0, 0, 2.38, 0.18, 0.18, 0.14);
      add(g, U.cylZ, P.dark, 0, 0, 0.55, 0.19, 0.19, 0.12);
      breech(g, P, 0.55, 0.55, 0.9);
      return { group: g, muzzleLen: 2.45 };
    },
    engine: ENGINE_TYPES.multifuel,
    fuel: (g, P) => FUEL_TYPES.upright(g, P),
    driveR: 1.0,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'radio', at: [0.7, 0.32, -1.4], ry: 0.5, w: 0.5, h: 0.32, lead: 0.3 },
        { type: 'ready', at: [1.1, 0.2, -0.2], ry: PI / 2, n: 4, cal: 0.08, len: 0.8 },
        { type: 'coax', at: [0.35, 0.4, 1.45], feed: 'left' },
        { type: 'basket', y: -1.02, r: 1.0 },
        { type: 'fan', at: [-0.9, 0.55, -1.2], ry: 0.6 },
      ],
      poly: [[0.42, 1.55], [1.2, 0.95], [1.38, -0.2], [1.28, -1.45], [0.8, -1.78], [-0.8, -1.78], [-1.28, -1.45], [-1.38, -0.2], [-1.2, 0.95], [-0.42, 1.55]], h: 0.82,
      cupola: { x: -0.55, z: -0.55, r: 0.3, y0: 0.8, band: [0.95, 1.08], top: 1.14 },
    },
  },
};
