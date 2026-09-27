// Т-44 (1944): Soviet medium tank, the T-54/55 predecessor, 85 mm ZiS-S-53
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, prism, runningGear, engineDeck, hullResult, breech, cupola, ovalPlan, planBox, scalePlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const PLAN = ovalPlan(1.05, 1.1, 1.3);

export default {
  key: 't44', name: 'Т-44', year: 1944,
  palette: { main: 0x4a5a32, dark: 0x37432a, engine: 0x565f4a },
  mg: 'dt',
  hull: {
    name: 'Т-44', weight: 22, speedCap: 14, eff: 1.0, turn: 1.0, radius: 3.2, ammoMax: 58,
    armor: { front: 160, side: 75, rear: 45, top: 20 },
    modules: [
      { id: 'ammo', u: [-0.95, -0.25], v: [0.15, 0.6], w: [0.35, 0.85] },
      { id: 'engine', u: [-0.75, 0.75], v: [0.15, 0.75], w: [-0.75, -0.25] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.55], w: [-1.0, -0.75] },
    ],
    crew: [
      { u: [0.25, 0.95], v: [0.1, 0.65], w: [0.45, 0.95] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.2, 0.45] },
    ],
    seats: { driver: { pos: [0.55, 0.62, 1.58], eye: [0.55, 1.28, 1.84] } },
    interior: {
      theme: 'soviet', seatStyle: 'pan', controls: 'levers', dials: 5, ammoCal: 0.045,
      x: 1.0, floor: 0.5, roof: 1.46, z: [-0.95, 2.1],
      slits: [{ x: [0.3, 0.8], y: [1.2, 1.32] }],
      walk: [{ x: [-0.85, 0.85], z: [-0.8, 1.3] }, { x: [0.25, 0.88], z: [1.3, 1.78] }],
      ammo: { x: [-0.95, -0.35], z: [1.3, 2.0] },
      props: [
        { type: 'fuelcell', box: [-0.98, 0.5, 0.35, -0.72, 1.2, 1.25] },
        { type: 'rack', style: 'horizontal', x: [0.55, 0.95], z: [-0.9, 0.35], y0: 0.52, h: 0.45, cal: 0.045, rows: 2 },
        { type: 'radio', at: [-0.88, 1.05, -0.3], ry: PI / 2, w: 0.45, h: 0.28, box2: true },
        { type: 'battery', at: [0.35, 0.62, -0.85] },
        { type: 'extinguisher', at: [0.92, 0.95, 0.75], back: 0.07 },
        { type: 'floorhatch', at: [0.1, 1.05], r: 0.24 },
        { type: 'watercan', at: [-0.3, 0.68, -0.85] },
        { type: 'pipe', pts: [[0.96, 1.3, 2.0], [0.96, 1.3, -0.9]], r: 0.014, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Т-44', weight: 6.5, elevMin: -0.1, elevMax: 0.44,
    armor: { front: 150, side: 90, rear: 75, top: 20 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.75], w: [-0.3, 0.9] },
      { id: 'ammo', u: [-0.7, 0.7], v: [0.1, 0.5], w: [-1.0, -0.65] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.8], w: [-0.7, 0.3] }],
    seats: {
      gunner: { pos: [0.42, -0.3, 0.3], eye: [0.42, 0.5, 0.52] },
      commander: { pos: [0.45, 0.05, -0.38], eye: [0.45, 0.9, -0.35] },
    },
  },
  gun: { name: 'ЗИС-С-53', caliber: '85 мм', weight: 1.5, reload: 6, shellSpeed: 500, pen: 140, dmg: 0.85, disp: 0.003, elevSpeed: 0.22 },
  engine: { name: 'В-44', power: 520, weight: 0.9, fuelUse: 0.25 },
  fuel: { name: 'бочки 2×190 л', cap: 380, weight: 0.4 },
  drive: { name: 'поворотный механизм Т-44', speed: 0.6, weight: 0.3 },

  models: {
    hull() {
      const P = mats('t44');
      const root = new THREE.Group();
      add(root, hullProfile([[-3.0, 0.42], [2.6, 0.42], [3.08, 0.9], [1.95, 1.5], [-2.85, 1.5], [-3.05, 1.1]], 2.1), P.main);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 1.34, 1.06, -0.05, 0.62, 0.05, 6.1);                             // fenders
        add(root, U.box, P.dark, sx * 1.36, 1.25, -1.6, 0.5, 0.35, 1.2);                               // bins
      }
      const wheels = runningGear(root, P, {
        x: 1.34, w: 0.58, wheels: [2.15, 1.02, -0.12, -1.26, -2.35], wr: 0.42, wy: 0.46,
        idler: [2.82, 0.6, 0.3], sprocket: [-2.72, 0.62, 0.33],
      });
      add(root, U.box, P.metal, 0.55, 1.53, 1.62, 0.5, 0.06, 0.42, 0.28, 0, 0);                       // driver hatch
      for (const x of [0.42, 0.68]) add(root, U.box, P.glass, x, 1.52, 1.88, 0.12, 0.05, 0.06);
      add(root, U.cyl, P.glass, 0.78, 1.25, 2.55, 0.1, 0.1, 0.1, PI / 2 - 0.7, 0, 0);
      add(root, U.cylX, P.wood, 0, 1.6, -2.7, 2.7, 0.12, 0.12);                                        // unditching log
      add(root, U.box, P.grille, 0, 1.51, -2.6, 1.6, 0.03, 0.35);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.5, -1.8), 1.6, 1.3);
      bay.engineTop = 1.6;
      return hullResult(root, P, {
        wheels, wheelR: 0.42, bay, ring: { pos: new THREE.Vector3(0, 1.5, 0.35), r: 1.02 }, holeR: 1.0,
        box: new THREE.Box3(new THREE.Vector3(-1.64, 0.1, -3.5), new THREE.Vector3(1.64, 1.58, 3.1)),
        fuelAt: new THREE.Vector3(0, 1.2, -3.25),
      });
    },
    turret() {
      const P = mats('t44');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(1.02, 1.06, 0.1, 30), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.85, 0.78, -0.05), P.main, 0, 0.02, 0);
      cupola(g, P, 0.45, -0.35, 0.33, 0.8, [0.86, 0.98], 1.1);
      add(g, U.cyl, P.main, -0.45, 0.86, -0.3, 0.3, 0.05, 0.3);                                         // loader hatch
      add(g, U.cyl, P.dark, -0.3, 0.9, 0.45, 0.08, 0.12, 0.08);                                         // periscope
      for (const sx of [-1, 1]) add(g, U.box, P.dark, sx * 0.55, 0.35, -1.25, 0.5, 0.3, 0.2);          // bins
      for (const sx of [-1, 1]) add(g, U.box, P.metal, sx * 0.9, 0.5, -0.3, 0.05, 0.05, 0.5);          // hand rails
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.42, 1.12), sightY: 1.05, mgPos: new THREE.Vector3(-0.45, 0.88, -0.3),
        box: planBox(PLAN, 0.9),
      };
    },
    gun() {
      const P = mats('t44');
      const g = new THREE.Group();
      const mantlet = new THREE.SphereGeometry(0.36, 14, 10, 0, PI * 2, 0, PI);
      mantlet.scale(1.1, 0.8, 0.6);
      add(g, mantlet, P.main, 0, 0, 0.05);
      add(g, U.box, P.main, 0, 0, 0.12, 0.6, 0.42, 0.2);
      add(g, new THREE.CylinderGeometry(0.055, 0.075, 3.6, 14).rotateX(PI / 2), P.main, 0, 0, 2.0);
      add(g, U.cylZ, P.metal, 0, 0, 3.82, 0.07, 0.07, 0.1);
      breech(g, P, 0.3, 0.3, 0.85);
      return { group: g, muzzleLen: 3.87 };
    },
    engine: ENGINE_TYPES.v12diesel,
    fuel: (g, P) => FUEL_TYPES.drums(g, P, { r: 0.29, len: 0.92 }),
    driveR: 0.95,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'ready', at: [0, 0.2, -0.75], ry: PI / 2, n: 5, cal: 0.045, len: 0.9 },
        { type: 'coax', at: [-0.25, 0.42, 0.9], feed: 'right' },
        { type: 'fan', at: [0.35, 0.62, -0.8], ry: 0.4 },
        { type: 'rack', style: 'drums', x: [-0.72, -0.72], z: [-0.45, 0.2], y0: 0.35 },
      ], poly: scalePlan(PLAN, 0.72), h: 0.8, cupola: { x: 0.45, z: -0.35, r: 0.28, y0: 0.8, band: [0.86, 0.98], top: 1.04 } },
  },
};
