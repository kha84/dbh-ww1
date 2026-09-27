// M1 Abrams (1980): US main battle tank, gas turbine, 120 mm M256
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, prism, runningGear, engineDeck, hullResult, breech, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const PLAN = [[0.55, 1.95], [1.8, 1.2], [1.8, -1.3], [1.55, -2.85], [-1.55, -2.85], [-1.8, -1.3], [-1.8, 1.2], [-0.55, 1.95]];

export default {
  key: 'abrams', name: 'Abrams', year: 1980,
  palette: { main: 0xb39a6b, dark: 0x8d784f, engine: 0x8c8c86 },
  mg: 'm240',
  hull: {
    name: 'Abrams', weight: 41, speedCap: 20, eff: 1.0, turn: 1.1, radius: 3.6, ammoMax: 40,
    armor: { front: 320, side: 100, rear: 55, top: 35 },
    modules: [
      { id: 'engine', u: [-0.7, 0.7], v: [0.2, 0.85], w: [-0.9, -0.4] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.6], w: [-1.0, -0.88] },
      { id: 'ammo', u: [0.35, 0.6], v: [0.2, 0.7], w: [-0.2, 0.2] },
    ],
    crew: [
      { u: [-0.3, 0.3], v: [0.2, 0.8], w: [0.6, 0.95] },
      { u: [-0.6, 0.6], v: [0.2, 1.0], w: [-0.3, 0.3] },
    ],
    seats: { driver: { pos: [0, 0.64, 2.5], eye: [0, 1.3, 2.74], recline: true } },
    interior: {
      theme: 'us', controls: 'tbar', dash: 'modern', dials: 3,
      x: 1.05, floor: 0.55, roof: 1.55, z: [-0.95, 3.1],
      slits: [{ x: [-0.4, 0.4], y: [1.24, 1.37] }],
      walk: [{ x: [-0.9, 0.9], z: [-0.8, 1.35] }, { x: [-0.35, 0.35], z: [1.35, 2.6] }],
      ammo: { x: [0.55, 1.0], z: [-0.6, 0.5] },
      props: [
        { type: 'display', at: [0.32, 1.05, 2.78], ry: PI, w: 0.22, h: 0.16 },
        { type: 'panel', at: [-1.0, 1.05, 0.3], ry: PI / 2, w: 0.45, h: 0.3, screens: 1 },
        { type: 'fan', at: [0.5, 1.2, -0.92], r: 0.14 },
        { type: 'battery', at: [-0.7, 0.67, -0.78] },
        { type: 'extinguisher', at: [-1.0, 0.95, -0.55], back: -0.07 },
        { type: 'extinguisher', at: [0.45, 0.8, 2.95], back: -0.07 },
        { type: 'firstaid', at: [1.02, 1.25, -0.6], ry: -PI / 2 },
        { type: 'watercan', at: [-0.85, 0.72, 0.9] },
        { type: 'pipe', pts: [[1.02, 1.42, 1.3], [1.02, 1.42, -0.9]], r: 0.016, mat: 'cable' },
        { type: 'pipe', pts: [[-1.02, 1.42, 1.3], [-1.02, 1.42, -0.9]], r: 0.016, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Abrams', weight: 16, elevMin: -0.17, elevMax: 0.35,
    armor: { front: 380, side: 160, rear: 70, top: 40 },
    modules: [
      { id: 'ammo', u: [-0.8, 0.8], v: [0.25, 0.85], w: [-1.0, -0.6] },     // bustle
      { id: 'turret', u: [-0.5, 0.5], v: [0.0, 0.2], w: [-0.4, 0.4] },
      { id: 'gun', u: [-0.25, 0.25], v: [0.25, 0.8], w: [0.2, 1.0] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.9], w: [-0.3, 0.6] }],
    seats: {
      gunner: { pos: [-0.55, -0.3, 0.55], eye: [-0.55, 0.47, 0.78] },
      commander: { pos: [-0.72, 0.1, -0.3], eye: [-0.72, 0.96, -0.25] },
    },
  },
  gun: { name: 'M256', caliber: '120 мм', weight: 3.2, reload: 5.5, shellSpeed: 600, pen: 400, dmg: 1.1, disp: 0.0025, elevSpeed: 0.35 },
  engine: { name: 'AGT-1500', power: 1500, weight: 1.1, fuelUse: 0.5 },
  fuel: { name: 'стеллаж канистр 12×20 л', cap: 240, weight: 0.35 },
  drive: { name: 'привод башни Abrams', speed: 0.9, weight: 0.3 },

  models: {
    hull() {
      const P = mats('abrams');
      const root = new THREE.Group();
      add(root, hullProfile([[-3.75, 0.45], [3.35, 0.45], [3.9, 0.95], [3.95, 1.12], [2.2, 1.55], [-3.85, 1.55], [-3.95, 0.9]], 2.3), P.main);
      const wheels = runningGear(root, P, {
        x: 1.5, w: 0.64, wheels: [2.5, 1.68, 0.86, 0.04, -0.78, -1.6, -2.42], wr: 0.32, wy: 0.36,
        idler: [3.2, 0.62, 0.3], sprocket: [-3.3, 0.7, 0.36], wheelMat: P.dark,
      });
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 1.5, 1.38, 0, 0.76, 0.05, 7.7);                                   // fender
        add(root, U.box, P.main, sx * 1.86, 0.93, -0.35, 0.06, 0.9, 6.8);                               // skirt
        add(root, U.box, P.main, sx * 1.83, 0.94, 3.0, 0.16, 0.95, 1.5);                                // heavy front skirt
        add(root, U.box, P.dark, sx * 1.9, 0.52, -0.35, 0.02, 0.06, 6.8);
        add(root, U.box, P.dark, sx * 1.45, 1.47, 3.72, 0.3, 0.14, 0.12);                               // light cluster
        add(root, U.box, P.glass, sx * 1.45, 1.47, 3.79, 0.22, 0.08, 0.02);
        add(root, U.box, P.red, sx * 1.4, 1.4, -3.93, 0.16, 0.1, 0.04);                                 // tail lights
        add(root, U.cylZ8, P.metal, sx * 0.9, 0.62, 3.72, 0.07, 0.07, 0.3);                             // tow hooks
      }
      add(root, U.box, P.grille, 0, 1.13, -3.95, 1.6, 0.5, 0.04);                                       // exhaust grille
      add(root, U.box, P.grille, 0, 1.565, -3.5, 1.9, 0.02, 0.5);
      add(root, U.cyl, P.metal, 0, 1.575, 1.95, 0.3, 0.05, 0.3);                                        // driver hatch
      for (const x of [-0.25, 0, 0.25]) add(root, U.box, P.glass, x, 1.58, 2.3, 0.14, 0.05, 0.07);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.55, -2.55), 1.9, 1.7);
      bay.engineTop = 1.65;
      return hullResult(root, P, {
        wheels, wheelR: 0.32, bay, ring: { pos: new THREE.Vector3(0, 1.55, 0.25), r: 1.15 }, holeR: 1.12,
        box: new THREE.Box3(new THREE.Vector3(-1.9, 0.1, -4.4), new THREE.Vector3(1.9, 1.62, 3.96)),
        fuelAt: new THREE.Vector3(0, 1.02, -4.18),
      });
    },
    turret() {
      const P = mats('abrams');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(1.2, 1.24, 0.1, 30), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.78, 0.97, -0.03), P.main, 0, 0.02, 0);
      // commander cupola with .50 cal (right side = -X)
      add(g, U.cyl, P.main, -0.72, 0.92, -0.25, 0.37, 0.28, 0.37);
      add(g, U.cyl, P.glass, -0.72, 0.96, -0.25, 0.38, 0.07, 0.38);
      add(g, U.cyl, P.dark, -0.72, 1.08, -0.25, 0.34, 0.05, 0.34);
      add(g, U.box, P.metal, -0.72, 1.16, 0.0, 0.14, 0.14, 0.4);
      add(g, U.cylZ, P.metal, -0.72, 1.18, 0.55, 0.035, 0.035, 0.9);
      add(g, U.cyl, P.main, 0.72, 0.83, -0.3, 0.32, 0.05, 0.32);                   // loader hatch (MG pintle)
      // gunner's primary sight, CITV-like head, wind sensor
      add(g, U.box, P.main, -0.72, 0.93, 1.1, 0.5, 0.3, 0.55);
      add(g, U.box, P.glass, -0.72, 0.93, 1.38, 0.4, 0.2, 0.02);
      add(g, U.cyl, P.dark, 0.35, 0.92, 0.6, 0.12, 0.25, 0.12);
      add(g, U.box, P.dark, 0.35, 1.08, 0.6, 0.28, 0.14, 0.2);
      add(g, U.cyl, P.metal, 0, 1.15, -2.4, 0.02, 0.8, 0.02);
      // bustle rack
      for (const sx of [-1, 1]) {
        add(g, U.box, P.dark, sx * 1.5, 0.5, -3.1, 0.04, 0.5, 0.55);
        add(g, U.box, P.metal, sx * 1.6, 0.55, 1.35, 0.25, 0.28, 0.4, 0, sx * 0.4, 0);     // smoke launchers
        for (const y of [0.5, 0.62]) add(g, U.cylZ8, P.black, sx * 1.66, y, 1.58, 0.05, 0.05, 0.12, -0.3, sx * 0.4, 0);
        add(g, U.box, P.dark, sx * 1.83, 0.45, -0.3, 0.1, 0.3, 1.5);                        // side stowage
      }
      add(g, U.box, P.dark, 0, 0.5, -3.37, 3.0, 0.5, 0.04);
      add(g, U.box, P.dark, 0, 0.26, -3.1, 3.0, 0.04, 0.55);
      add(g, U.box, P.wood, 0, 0.45, -3.1, 2.6, 0.36, 0.4);
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.42, 1.95), sightY: 1.08, mgPos: new THREE.Vector3(0.72, 0.85, -0.3),
        box: new THREE.Box3(new THREE.Vector3(-1.85, 0, -2.85), new THREE.Vector3(1.85, 0.82, 1.95)),
      };
    },
    gun() {
      const P = mats('abrams');
      const g = new THREE.Group();
      add(g, U.box, P.main, 0, 0, 0.12, 1.05, 0.56, 0.42);                 // mantlet
      add(g, U.box, P.dark, 0, 0.02, 0.34, 0.5, 0.45, 0.06);
      add(g, U.cylZ, P.main, 0, 0, 2.85, 0.088, 0.088, 5.1);
      for (const z of [1.2, 1.9, 3.3, 4.0, 4.7]) add(g, U.cylZ, P.dark, 0, 0, z, 0.098, 0.098, 0.06);
      add(g, U.cylZ, P.main, 0, 0, 2.6, 0.13, 0.13, 0.75);                 // fume extractor
      add(g, U.cylZ, P.metal, 0, 0, 5.35, 0.1, 0.1, 0.1);
      add(g, U.box, P.dark, 0, 0.13, 5.2, 0.07, 0.06, 0.18);               // muzzle reference sensor
      add(g, U.cylZ, P.metal, -0.32, 0.05, 0.5, 0.035, 0.035, 0.35);
      breech(g, P, 0.46, 0.46, 1.05);
      return { group: g, muzzleLen: 5.4 };
    },
    engine: ENGINE_TYPES.turbine,
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 6, w: 0.26, h: 0.48, d: 0.4 }),
    driveR: 1.05,
    turretInterior: {
      gunnerStyle: 'grips', commanderStyle: 'modern',
      props: [
        { type: 'blastdoor', at: [0, 0.38, -1.3], w: 1.7, h: 0.6 },
        { type: 'coax', at: [-0.34, 0.45, 1.65], feed: 'right' },
        { type: 'radio', at: [1.2, 0.36, -1.0], ry: -0.4, w: 0.5, h: 0.3, aerial: false },
        { type: 'display', at: [1.3, 0.5, 0.4], ry: -PI / 2 },
        { type: 'basket', y: -1.0, r: 1.1 },
        { type: 'fan', at: [0.6, 0.6, -1.3], r: 0.12 },
      ],
      poly: [[0.55, 1.86], [1.72, 1.15], [1.72, -1.35], [-1.72, -1.35], [-1.72, 1.15], [-0.55, 1.86]], h: 0.76,
      cupola: { x: -0.72, z: -0.25, r: 0.31, y0: 0.76, band: [0.9, 1.02], top: 1.06 },
    },
  },
};
