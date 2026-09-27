// Leopard 2 (1979): West German main battle tank, 120 mm Rh-120 L/44
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, prism, runningGear, engineDeck, hullResult, breech, cupola, planBox, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const PLAN = [[0.9, 2.0], [1.9, 1.55], [1.9, -1.6], [1.65, -2.9], [-1.65, -2.9], [-1.9, -1.6], [-1.9, 1.55], [-0.9, 2.0]];

export default {
  key: 'leo2', name: 'Leopard 2', year: 1979,
  palette: { main: 0x4b5338, dark: 0x2f3327, engine: 0x77796f },
  mg: 'mg3',
  hull: {
    name: 'Leopard 2', weight: 36, speedCap: 19, eff: 1.0, turn: 1.1, radius: 3.6, ammoMax: 42,
    armor: { front: 300, side: 80, rear: 45, top: 30 },
    modules: [
      { id: 'engine', u: [-0.7, 0.7], v: [0.2, 0.85], w: [-0.9, -0.4] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.6], w: [-1.0, -0.88] },
      { id: 'ammo', u: [0.3, 0.95], v: [0.2, 0.7], w: [0.35, 0.75] },
    ],
    crew: [
      { u: [-0.8, -0.2], v: [0.2, 0.8], w: [0.6, 0.95] },
      { u: [-0.6, 0.6], v: [0.2, 1.0], w: [-0.3, 0.3] },
    ],
    seats: { driver: { pos: [-0.6, 0.64, 2.4], eye: [-0.6, 1.32, 2.65] } },
    interior: {
      theme: 'nato', controls: 'yoke', dash: 'modern', dials: 3,
      x: 1.05, floor: 0.55, roof: 1.58, z: [-1.0, 3.0],
      slits: [{ x: [-0.95, -0.25], y: [1.26, 1.38] }],
      walk: [{ x: [-0.9, 0.9], z: [-0.85, 1.4] }, { x: [-0.95, -0.25], z: [1.4, 2.55] }],
      ammo: { x: [0.45, 1.0], z: [1.6, 2.8] },
      props: [
        { type: 'display', at: [-0.3, 1.05, 2.88], ry: PI, w: 0.22, h: 0.16 },
        { type: 'panel', at: [-1.02, 1.05, 0.2], ry: PI / 2, w: 0.45, h: 0.3, screens: 1 },
        { type: 'fan', at: [-0.5, 1.2, -0.97], r: 0.14 },
        { type: 'battery', at: [0.7, 0.67, -0.8] },
        { type: 'extinguisher', at: [1.0, 0.95, -0.4], back: 0.07 },
        { type: 'extinguisher', at: [-0.95, 0.8, 2.2], back: -0.07 },
        { type: 'firstaid', at: [1.02, 1.25, 0.6], ry: -PI / 2 },
        { type: 'pipe', pts: [[1.02, 1.45, 1.4], [1.02, 1.45, -0.95]], r: 0.016, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Leopard 2', weight: 16, elevMin: -0.15, elevMax: 0.35,
    armor: { front: 360, side: 140, rear: 60, top: 40 },
    modules: [
      { id: 'ammo', u: [-0.8, 0.8], v: [0.25, 0.85], w: [-1.0, -0.6] },
      { id: 'turret', u: [-0.5, 0.5], v: [0.0, 0.2], w: [-0.4, 0.4] },
      { id: 'gun', u: [-0.25, 0.25], v: [0.25, 0.8], w: [0.2, 1.0] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.9], w: [-0.3, 0.6] }],
    seats: {
      gunner: { pos: [-0.6, -0.3, 0.55], eye: [-0.6, 0.48, 0.78] },
      commander: { pos: [-0.72, 0.1, -0.3], eye: [-0.72, 0.96, -0.28] },
    },
  },
  gun: { name: 'Rh-120 L/44', caliber: '120 мм', weight: 3.1, reload: 5.5, shellSpeed: 610, pen: 420, dmg: 1.1, disp: 0.0023, elevSpeed: 0.38 },
  engine: { name: 'MTU MB 873', power: 1500, weight: 2.5, fuelUse: 0.45 },
  fuel: { name: 'кормовые баки 2×220 л', cap: 440, weight: 0.5 },
  drive: { name: 'привод башни Leopard 2', speed: 1.0, weight: 0.3 },

  models: {
    hull() {
      const P = mats('leo2');
      const root = new THREE.Group();
      add(root, hullProfile([[-3.8, 0.45], [3.35, 0.45], [3.95, 1.0], [3.95, 1.15], [2.4, 1.62], [-3.8, 1.62], [-3.9, 0.95]], 2.3), P.main);
      const wheels = runningGear(root, P, {
        x: 1.52, w: 0.64, wheels: [2.6, 1.75, 0.9, 0.05, -0.8, -1.65, -2.5], wr: 0.34, wy: 0.38,
        idler: [3.3, 0.64, 0.3], sprocket: [-3.4, 0.72, 0.36], wheelMat: P.dark,
      });
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 1.52, 1.4, 0, 0.76, 0.05, 7.8);                                   // fender
        add(root, U.box, P.main, sx * 1.88, 0.95, -0.4, 0.06, 0.9, 6.6);                                // skirt
        add(root, U.box, P.dark, sx * 1.86, 0.96, 3.05, 0.16, 0.95, 1.5);                               // heavy front skirt
        for (let z = -3.2; z < 2.4; z += 1.1) add(root, U.box, P.dark, sx * 1.915, 0.95, z, 0.01, 0.85, 0.03);
        add(root, U.box, P.dark, sx * 1.45, 1.5, 3.75, 0.3, 0.14, 0.12);                                // light clusters
        add(root, U.box, P.glass, sx * 1.45, 1.5, 3.82, 0.22, 0.08, 0.02);
        add(root, U.box, P.red, sx * 1.4, 1.42, -3.83, 0.16, 0.1, 0.04);
        add(root, U.cylZ8, P.metal, sx * 0.9, 0.62, 3.72, 0.07, 0.07, 0.3);
      }
      add(root, U.box, P.grille, 0, 1.63, -3.3, 2.0, 0.02, 0.9);                                         // rear deck grilles
      add(root, U.box, P.grille, 0, 1.2, -3.84, 1.8, 0.45, 0.04);
      add(root, U.cyl, P.metal, -0.6, 1.63, 2.35, 0.32, 0.05, 0.32);                                    // driver hatch
      for (const x of [-0.8, -0.6, -0.4]) add(root, U.box, P.glass, x, 1.64, 2.72, 0.14, 0.05, 0.07);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.62, -2.35), 1.9, 1.5);
      bay.engineTop = 1.72;
      return hullResult(root, P, {
        wheels, wheelR: 0.34, bay, ring: { pos: new THREE.Vector3(0, 1.62, 0.35), r: 1.2 }, holeR: 1.17,
        box: new THREE.Box3(new THREE.Vector3(-1.92, 0.1, -4.3), new THREE.Vector3(1.92, 1.7, 3.96)),
        fuelAt: new THREE.Vector3(0, 1.1, -4.12),
      });
    },
    turret() {
      const P = mats('leo2');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(1.2, 1.24, 0.1, 30), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.8, 0.98), P.main, 0, 0.02, 0);
      cupola(g, P, -0.72, -0.3, 0.38, 0.8, [0.9, 1.02], 1.1);                                           // commander (right)
      add(g, U.cyl, P.main, 0.75, 0.84, -0.3, 0.34, 0.05, 0.34);                                        // loader hatch
      add(g, U.box, P.main, -0.85, 0.92, 1.2, 0.5, 0.26, 0.6);                                          // gunner's sight
      add(g, U.box, P.glass, -0.85, 0.92, 1.51, 0.4, 0.16, 0.02);
      add(g, U.cyl, P.dark, 0.25, 0.92, 0.2, 0.14, 0.24, 0.14);                                         // PERI
      add(g, U.box, P.glass, 0.25, 1.02, 0.3, 0.16, 0.08, 0.02);
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 4; i++) add(g, U.cylZ8, P.black, sx * 1.95, 0.45 + (i % 2) * 0.13, 0.7 - Math.floor(i / 2) * 0.16, 0.05, 0.05, 0.15, -0.4, sx * 0.3, 0);
        add(g, U.box, P.dark, sx * 1.93, 0.4, -1.8, 0.06, 0.4, 1.4);                                   // side stowage
      }
      add(g, U.box, P.dark, 0, 0.5, -3.05, 3.2, 0.45, 0.3);                                             // bustle basket
      add(g, U.cyl, P.metal, 1.2, 1.2, -2.3, 0.015, 0.9, 0.015);                                        // antennas
      add(g, U.cyl, P.metal, -1.2, 1.2, -2.3, 0.015, 0.9, 0.015);
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.42, 2.0), sightY: 1.08, mgPos: new THREE.Vector3(0.75, 0.87, -0.3),
        box: planBox(PLAN, 0.84),
      };
    },
    gun() {
      const P = mats('leo2');
      const g = new THREE.Group();
      add(g, U.box, P.main, 0, 0, 0.12, 1.1, 0.5, 0.36);                    // mantlet
      add(g, U.box, P.dark, 0, 0.02, 0.32, 0.55, 0.42, 0.06);
      add(g, U.cylZ, P.main, 0, 0, 2.8, 0.086, 0.086, 5.0);
      for (const z of [1.3, 2.0, 3.4, 4.2, 4.9]) add(g, U.cylZ, P.dark, 0, 0, z, 0.096, 0.096, 0.08);
      add(g, U.cylZ, P.main, 0, 0, 2.6, 0.13, 0.13, 0.7);                   // fume extractor
      add(g, U.cylZ, P.metal, 0, 0, 5.3, 0.1, 0.1, 0.1);
      breech(g, P, 0.46, 0.46, 1.05);
      return { group: g, muzzleLen: 5.35 };
    },
    engine: ENGINE_TYPES.multifuel,
    fuel: (g, P) => FUEL_TYPES.boxes(g, P),
    driveR: 1.12,
    turretInterior: {
      gunnerStyle: 'grips', commanderStyle: 'modern',
      props: [
        { type: 'blastdoor', at: [0, 0.38, -1.45], w: 1.6, h: 0.6 },
        { type: 'coax', at: [0.36, 0.45, 1.7], feed: 'left' },
        { type: 'radio', at: [-1.25, 0.36, -1.15], ry: 0.5, w: 0.5, h: 0.3, aerial: false },
        { type: 'display', at: [1.3, 0.5, 0.4], ry: -PI / 2 },
        { type: 'basket', y: -1.02, r: 1.15 },
      ],
      poly: [[0.85, 1.9], [1.8, 1.5], [1.8, -1.5], [-1.8, -1.5], [-1.8, 1.5], [-0.85, 1.9]], h: 0.76,
      cupola: { x: -0.72, z: -0.3, r: 0.32, y0: 0.78, band: [0.9, 1.02], top: 1.06 },
    },
  },
};
