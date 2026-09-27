// ИС-2 (1944): Soviet heavy tank, 122 mm D-25T with separate loading
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, prism, runningGear, returnRollers, engineDeck, hullResult, breech, cupola, ovalPlan, planBox, scalePlan, ENGINE_TYPES } from '../modelkit.js';

const PLAN = ovalPlan(1.12, 1.0, 1.5);

export default {
  key: 'is2', name: 'ИС-2', year: 1944,
  palette: { main: 0x525e36, dark: 0x3c4728, engine: 0x5a6250 },
  mg: 'dt',
  hull: {
    name: 'ИС-2', weight: 31, speedCap: 10.3, eff: 1.0, turn: 0.8, radius: 3.4, ammoMax: 28,
    armor: { front: 190, side: 90, rear: 60, top: 25 },
    modules: [
      { id: 'engine', u: [-0.7, 0.7], v: [0.15, 0.8], w: [-0.8, -0.3] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.55], w: [-1.0, -0.8] },
      { id: 'ammo', u: [0.3, 0.9], v: [0.15, 0.6], w: [0.2, 0.8] },
    ],
    crew: [
      { u: [-0.3, 0.3], v: [0.2, 0.8], w: [0.55, 0.9] },
      { u: [-0.6, 0.6], v: [0.2, 1.0], w: [-0.3, 0.4] },
    ],
    seats: { driver: { pos: [0, 0.64, 1.95], eye: [0, 1.32, 2.2] } },
    interior: {
      theme: 'soviet', seatStyle: 'pan', controls: 'levers', dials: 5, ammoStyle: 'charges', ammoCal: 0.06,
      x: 1.0, floor: 0.55, roof: 1.58, z: [-1.1, 2.45],
      slits: [{ x: [-0.3, 0.3], y: [1.26, 1.38] }],
      walk: [{ x: [-0.85, 0.85], z: [-0.95, 1.35] }, { x: [-0.35, 0.35], z: [1.35, 2.0] }],
      ammo: { x: [0.45, 0.95], z: [1.4, 2.35] },
      props: [
        { type: 'rack', style: 'horizontal', x: [-0.95, -0.5], z: [-1.05, 0.2], y0: 0.57, h: 0.42, cal: 0.06, rows: 2 },
        { type: 'fuelcell', box: [-0.98, 0.55, 1.35, -0.6, 1.3, 2.4] },
        { type: 'fuelcell', box: [0.72, 0.55, -0.6, 0.98, 1.2, 0.6] },
        { type: 'battery', at: [0.4, 0.67, -0.95] },
        { type: 'extinguisher', at: [0.95, 0.95, 0.9], back: 0.07 },
        { type: 'floorhatch', at: [0.3, 1.0], r: 0.24 },
        { type: 'watercan', at: [-0.3, 0.72, -0.98] },
        { type: 'pipe', pts: [[0.97, 1.42, 2.3], [0.97, 1.42, -1.05]], r: 0.014, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня ИС-2', weight: 10, elevMin: -0.05, elevMax: 0.35,
    armor: { front: 170, side: 100, rear: 100, top: 30 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.75], w: [-0.3, 0.95] },
      { id: 'ammo', u: [-0.7, 0.7], v: [0.1, 0.55], w: [-1.0, -0.65] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.7, 0.3] }],
    seats: {
      gunner: { pos: [0.45, -0.3, 0.3], eye: [0.45, 0.52, 0.52] },
      commander: { pos: [0.5, 0.08, -0.48], eye: [0.5, 0.95, -0.45] },
    },
  },
  gun: { name: 'Д-25Т', caliber: '122 мм', weight: 2.8, reload: 12, shellSpeed: 480, pen: 175, dmg: 1.4, disp: 0.004, elevSpeed: 0.18 },
  engine: { name: 'В-2-ИС', power: 520, weight: 1.0, fuelUse: 0.28 },
  fuel: { name: 'бортовые баки 3×90 л', cap: 270, weight: 0.35 },
  drive: { name: 'поворотный механизм ИС-2', speed: 0.35, weight: 0.35 },

  models: {
    hull() {
      const P = mats('is2');
      const root = new THREE.Group();
      add(root, hullProfile([[-3.3, 0.45], [2.9, 0.45], [3.35, 0.85], [3.3, 1.05], [2.1, 1.62], [-3.2, 1.62], [-3.4, 1.2]], 2.1), P.main);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 1.3, 1.37, -0.45, 0.62, 0.5, 5.3);                               // hull sides over the tracks
        add(root, U.box, P.dark, sx * 1.32, 1.1, 0.0, 0.7, 0.05, 6.5);                                 // fenders
        add(root, U.box, P.dark, sx * 1.35, 1.72, 1.2, 0.45, 0.2, 0.9);                                // spare track / bins
      }
      const wheels = runningGear(root, P, {
        x: 1.32, w: 0.62, wheels: [2.35, 1.45, 0.55, -0.35, -1.25, -2.15], wr: 0.38, wy: 0.42,
        idler: [3.0, 0.66, 0.3], sprocket: [-3.1, 0.72, 0.35],
      });
      returnRollers(root, P, 1.32, [1.9, 0.1, -1.7], 0.95, 0.08);
      add(root, U.box, P.dark, 0, 1.52, 2.32, 0.55, 0.12, 0.2, -0.8, 0, 0);                           // driver visor
      add(root, U.box, P.glass, 0, 1.54, 2.43, 0.3, 0.04, 0.02, -0.8, 0, 0);
      for (const x of [-0.8, 0.8]) add(root, U.cyl, P.glass, x, 1.28, 2.75, 0.09, 0.09, 0.09, PI / 2 - 0.7, 0, 0);
      add(root, U.box, P.grille, 0, 1.63, -2.95, 1.7, 0.03, 0.4);
      for (const sx of [-1, 1]) add(root, U.cylZ, P.rust, sx * 0.7, 1.4, -3.3, 0.1, 0.1, 0.3);          // exhausts
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.62, -2.0), 1.7, 1.5);
      bay.engineTop = 1.72;
      return hullResult(root, P, {
        wheels, wheelR: 0.38, bay, ring: { pos: new THREE.Vector3(0, 1.62, 0.45), r: 1.06 }, holeR: 1.04,
        box: new THREE.Box3(new THREE.Vector3(-1.66, 0.1, -3.75), new THREE.Vector3(1.66, 1.7, 3.4)),
        fuelAt: new THREE.Vector3(0, 1.3, -3.62),
      });
    },
    turret() {
      const P = mats('is2');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(1.06, 1.1, 0.1, 30), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.9, 0.74), P.main, 0, 0.02, 0);
      cupola(g, P, 0.5, -0.45, 0.34, 0.86, [0.92, 1.04], 1.14);
      add(g, U.cyl, P.main, -0.5, 0.92, -0.35, 0.3, 0.05, 0.3);                                         // loader hatch
      add(g, U.cyl, P.dark, -0.2, 0.95, 0.35, 0.08, 0.12, 0.08);
      add(g, U.cylZ, P.dark, 0, 0.45, -1.52, 0.1, 0.1, 0.12);                                          // rear MG ball
      for (const sx of [-1, 1]) add(g, U.box, P.metal, sx * 0.95, 0.55, -0.4, 0.05, 0.05, 0.6);
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.42, 1.02), sightY: 1.1, mgPos: new THREE.Vector3(-0.5, 0.94, -0.35),
        box: planBox(PLAN, 0.95),
      };
    },
    gun() {
      const P = mats('is2');
      const g = new THREE.Group();
      add(g, U.box, P.main, 0, 0, 0.1, 0.95, 0.6, 0.3);                     // mantlet
      add(g, U.cylZ, P.main, 0, 0, 0.35, 0.3, 0.3, 0.3);
      add(g, new THREE.CylinderGeometry(0.075, 0.09, 4.3, 14).rotateX(PI / 2), P.main, 0, 0, 2.55);
      add(g, U.box, P.main, 0, 0, 4.72, 0.3, 0.2, 0.38);                    // muzzle brake
      for (const sx of [-1, 1]) add(g, U.box, P.black, sx * 0.151, 0, 4.72, 0.01, 0.12, 0.26);
      breech(g, P, 0.42, 0.42, 1.0);
      return { group: g, muzzleLen: 4.92 };
    },
    engine: ENGINE_TYPES.v12diesel,
    fuel(g, P) {
      for (const x of [-0.66, 0, 0.66]) {
        add(g, U.cylX, P.main, x, 0, 0, 0.6, 0.25, 0.25);
        add(g, U.cyl, P.metal, x + 0.2, 0.25, 0, 0.05, 0.04, 0.05);
      }
      add(g, U.box, P.dark, 0, -0.23, 0.12, 2.0, 0.04, 0.08);
      return 0.26;
    },
    driveR: 1.0,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'sidemg', at: [0, 0.45, -0.95], ry: PI },
        { type: 'ready', at: [0.7, 0.1, -0.3], ry: PI / 2, n: 4, cal: 0.06, len: 0.9 },
        { type: 'ready', at: [-0.7, 0.05, -0.3], ry: -PI / 2, n: 4, cal: 0.06, len: 0.6, style: 'vertical' },
        { type: 'coax', at: [-0.28, 0.42, 0.85], feed: 'right' },
        { type: 'radio', at: [0.45, 0.32, -0.8], ry: 0.5, w: 0.42, h: 0.28, lead: 0.2 },
      ], poly: scalePlan(PLAN, 0.68), h: 0.85, cupola: { x: 0.5, z: -0.45, r: 0.3, y0: 0.85, band: [0.92, 1.04], top: 1.1 } },
  },
};
