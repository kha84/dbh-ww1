// Т-55 (1958): Soviet medium tank, 100 mm D-10T, dome turret
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, runningGear, engineDeck, hullResult, breech, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

export default {
  key: 't55', name: 'Т-55', year: 1958,
  palette: { main: 0x4d5b30, dark: 0x3b4725, engine: 0x565f4a },
  mg: 'pkt',
  hull: {
    name: 'Т-55', weight: 24, speedCap: 16, eff: 1.0, turn: 0.9, radius: 3.2, ammoMax: 43,
    armor: { front: 200, side: 80, rear: 45, top: 30 },
    modules: [
      { id: 'ammo', u: [-0.95, -0.25], v: [0.15, 0.6], w: [0.35, 0.85] },   // front right "tank-rack"
      { id: 'engine', u: [-0.75, 0.75], v: [0.15, 0.75], w: [-0.72, -0.2] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.55], w: [-1.0, -0.72] },
    ],
    crew: [
      { u: [0.25, 0.95], v: [0.1, 0.65], w: [0.45, 0.95] },                  // driver (front left)
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.15, 0.45] },                  // fighting compartment
    ],
    seats: { driver: { pos: [0.57, 0.62, 1.68], eye: [0.57, 1.3, 1.92] } },
    interior: {
      theme: 'soviet2', seatStyle: 'pan', controls: 'levers', dials: 5,
      x: 1.0, floor: 0.5, roof: 1.52, z: [-0.45, 2.25],
      slits: [{ x: [0.3, 0.85], y: [1.25, 1.37] }],
      walk: [{ x: [-0.85, 0.85], z: [-0.3, 1.6] }, { x: [0.25, 0.9], z: [1.6, 1.95] }],
      ammo: { x: [-0.95, -0.35], z: [1.5, 2.2] },
      props: [
        { type: 'fuelcell', box: [-0.98, 0.5, 0.2, -0.72, 1.25, 1.4] },
        { type: 'rack', style: 'horizontal', x: [0.55, 0.95], z: [-0.42, 0.45], y0: 0.52, h: 0.45, cal: 0.05, rows: 2 },
        { type: 'battery', at: [0.72, 0.62, 0.75] },
        { type: 'extinguisher', at: [0.92, 0.95, 0.75], back: 0.07 },
        { type: 'floorhatch', at: [0.15, 1.25], r: 0.24 },
        { type: 'watercan', at: [-0.8, 0.68, -0.3] },
        { type: 'firstaid', at: [0.96, 1.2, 1.2], ry: -PI / 2 },
        { type: 'pipe', pts: [[0.96, 1.36, 2.15], [0.96, 1.36, -0.4]], r: 0.014, mat: 'cable' },
        { type: 'pipe', pts: [[-0.97, 1.3, 2.2], [-0.97, 1.3, -0.4]], r: 0.02 },
      ],
    },
  },
  turret: {
    name: 'Башня Т-55', weight: 8.5, elevMin: -0.09, elevMax: 0.30,
    armor: { front: 230, side: 150, rear: 65, top: 35 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.75], w: [-0.3, 0.9] },
      { id: 'ammo', u: [-0.9, -0.5], v: [0.1, 0.5], w: [-0.8, -0.2] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.8], w: [-0.7, 0.3] }],
    seats: {
      gunner: { pos: [0.45, -0.3, 0.3], eye: [0.45, 0.5, 0.52] },
      commander: { pos: [0.52, 0.05, -0.38], eye: [0.52, 0.87, -0.3] },
    },
  },
  gun: { name: 'Д-10Т', caliber: '100 мм', weight: 2.3, reload: 6.5, shellSpeed: 520, pen: 230, dmg: 1.0, disp: 0.0035, elevSpeed: 0.2 },
  engine: { name: 'В-55', power: 580, weight: 1.0, fuelUse: 0.25 },
  fuel: { name: 'бочки 2×200 л', cap: 400, weight: 0.45 },
  drive: { name: 'поворотный механизм Т-55', speed: 0.55, weight: 0.3 },

  models: {
    hull() {
      const P = mats('t55');
      const root = new THREE.Group();
      add(root, hullProfile([[-3.1, 0.42], [2.75, 0.42], [3.2, 0.92], [2.0, 1.52], [-2.95, 1.52], [-3.18, 1.12]], 2.12), P.main);
      for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 1.35, 1.06, -0.08, 0.6, 0.05, 6.15);    // fenders
      const wheels = runningGear(root, P, {
        x: 1.34, w: 0.58, wheels: [2.2, 0.95, 0.05, -0.85, -1.75], wr: 0.41, wy: 0.45,
        idler: [2.85, 0.6, 0.3], sprocket: [-2.72, 0.62, 0.33],
      });
      for (const z of [-2.35, -1.45, -0.55]) add(root, U.box, P.dark, -1.35, 1.32, z, 0.5, 0.48, 0.8);  // fender tanks / bins
      add(root, U.cylX, P.wood, 0, 1.66, -2.75, 2.9, 0.13, 0.13);                                    // unditching log
      add(root, U.box, P.dark, 1.35, 1.25, -1.2, 0.5, 0.35, 1.8);                                     // stowage
      add(root, U.box, P.grille, 0, 1.53, -2.72, 1.7, 0.03, 0.35);
      add(root, U.cyl, P.glass, 0.75, 1.3, 2.62, 0.1, 0.1, 0.1, PI / 2 - 0.7, 0, 0);                  // headlight
      add(root, U.box, P.metal, 0.55, 1.56, 1.85, 0.5, 0.06, 0.4, 0.3, 0, 0);                        // driver hatch
      for (const x of [0.42, 0.68]) add(root, U.box, P.glass, x, 1.55, 2.12, 0.12, 0.05, 0.06);       // driver periscopes
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.52, -1.85), 1.6, 1.3);
      bay.engineTop = 1.62;
      return hullResult(root, P, {
        wheels, wheelR: 0.41, bay, ring: { pos: new THREE.Vector3(0, 1.52, 0.72), r: 1.1 },
        box: new THREE.Box3(new THREE.Vector3(-1.64, 0.1, -3.62), new THREE.Vector3(1.64, 1.6, 3.2)),
        fuelAt: new THREE.Vector3(0, 1.25, -3.35),
      });
    },
    turret() {
      const P = mats('t55');
      const g = new THREE.Group();
      const dome = new THREE.SphereGeometry(1.2, 30, 14, 0, PI * 2, 0, PI / 2);
      dome.scale(1.0, 0.72, 1.12);
      add(g, new THREE.CylinderGeometry(1.18, 1.22, 0.12, 30), P.dark, 0, 0.02, 0);
      add(g, dome, P.main, 0, 0.05, 0);
      add(g, U.cyl, P.main, 0.52, 0.8, -0.3, 0.34, 0.28, 0.34);          // commander cupola (left)
      add(g, U.cyl, P.glass, 0.52, 0.87, -0.3, 0.35, 0.08, 0.35);
      add(g, U.cyl, P.metal, 0.52, 0.96, -0.3, 0.3, 0.05, 0.3);
      add(g, U.cyl, P.main, -0.48, 0.78, -0.35, 0.3, 0.06, 0.3);         // loader hatch
      add(g, U.box, P.dark, 0, 0.38, -1.25, 1.4, 0.3, 0.3);              // rear stowage
      add(g, U.cylZ, P.dark, -0.55, 0.62, 0.95, 0.15, 0.15, 0.3);         // IR searchlight
      add(g, U.cylZ, P.glass, -0.55, 0.62, 1.11, 0.13, 0.13, 0.02);
      add(g, U.cyl, P.metal, 0.75, 0.6, 0.9, 0.05, 0.14, 0.05);          // gunner sight
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.42, 1.15), sightY: 1.0, mgPos: new THREE.Vector3(-0.48, 0.81, -0.35),
        box: new THREE.Box3(new THREE.Vector3(-1.2, 0, -1.4), new THREE.Vector3(1.2, 0.96, 1.35)),
      };
    },
    gun() {
      const P = mats('t55');
      const g = new THREE.Group();
      const mantlet = new THREE.SphereGeometry(0.42, 14, 10, 0, PI * 2, 0, PI);
      mantlet.scale(1.1, 0.8, 0.6);
      add(g, mantlet, P.main, 0, 0, 0.05);
      add(g, new THREE.CylinderGeometry(0.072, 0.09, 4.2, 14).rotateX(PI / 2), P.main, 0, 0, 2.3);
      add(g, U.cylZ, P.main, 0, 0, 3.55, 0.135, 0.135, 0.5);                // bore evacuator
      add(g, U.cylZ, P.metal, 0, 0, 4.36, 0.1, 0.1, 0.12);
      add(g, U.cylZ, P.metal, -0.28, 0, 0.38, 0.035, 0.035, 0.4);           // coax MG
      breech(g, P, 0.36, 0.36, 0.95);
      return { group: g, muzzleLen: 4.42 };
    },
    engine: ENGINE_TYPES.v12diesel,
    fuel: (g, P) => FUEL_TYPES.drums(g, P),
    driveR: 1.0,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'radio', at: [0.55, 0.3, -0.85], ry: 0.4, w: 0.45, h: 0.3, lead: 0.25 },
        { type: 'ready', at: [0.95, 0.15, -0.1], ry: PI / 2, n: 4, cal: 0.05, len: 0.9 },
        { type: 'coax', at: [-0.28, 0.42, 0.95], feed: 'right' },
        { type: 'fan', at: [-0.6, 0.55, -0.72], ry: 0.7, r: 0.12 },
        { type: 'basket', y: -0.98, r: 0.95, top: -0.1 },
        { type: 'rack', style: 'drums', x: [-0.95, -0.95], z: [-0.4, 0.3], y0: 0.35 },
      ], dome: { r: 1.13, sy: 0.72, sz: 1.12 }, cupola: { x: 0.52, z: -0.3, r: 0.3, y0: 0.66, band: [0.82, 0.92], top: 0.94 } },
  },
};
