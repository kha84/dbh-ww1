// Pz.Kpfw. II (1936): German light tank, 20 mm KwK 30
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, prism, runningGear, returnRollers, engineDeck, hullResult, breech, cupola, planBox, scalePlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const PLAN = [[0.35, 0.88], [0.72, 0.55], [0.75, -0.55], [0.5, -0.82], [-0.5, -0.82], [-0.75, -0.55], [-0.72, 0.55], [-0.35, 0.88]];

export default {
  key: 'pz2', name: 'Pz.II', year: 1936,
  palette: { main: 0x5b5f5c, dark: 0x45484a, engine: 0x5b5e57 },
  mg: 'mg34',
  hull: {
    name: 'Pz.Kpfw. II', weight: 7.2, speedCap: 11, eff: 1.0, turn: 1.2, radius: 2.5, ammoMax: 180,
    armor: { front: 35, side: 20, rear: 15, top: 10 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.8], w: [-0.9, -0.3] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [0.75, 1.0] },
      { id: 'ammo', u: [-0.9, -0.4], v: [0.15, 0.6], w: [0.1, 0.6] },
    ],
    crew: [
      { u: [0.2, 0.8], v: [0.1, 0.8], w: [0.4, 0.75] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.3, 0.4] },
    ],
    seats: { driver: { pos: [0.45, 0.55, 1.02], eye: [0.45, 1.2, 1.28] } },
    interior: {
      theme: 'german', seatStyle: 'pan', controls: 'levers', ammoStyle: 'bins',
      x: 0.85, floor: 0.45, roof: 1.38, z: [-0.7, 1.45],
      slits: [{ x: [0.22, 0.68], y: [1.14, 1.26] }],
      walk: [{ x: [-0.7, 0.7], z: [-0.5, 0.8] }, { x: [0.2, 0.72], z: [0.8, 1.12] }],
      ammo: { x: [-0.8, -0.4], z: [0.6, 1.3] },
      props: [
        { type: 'gearbox', at: [0, 0.72, 1.36], w: 1.0, h: 0.42, d: 0.2 },
        { type: 'shaft', z: [-0.7, 1.2], x: -0.08, w: 0.22, h: 0.16 },
        { type: 'radio', at: [-0.66, 1.02, 0.7], ry: PI / 2, w: 0.42, h: 0.22, box2: true },
        { type: 'seat', at: [-0.3, 0.55, 0.45], style: 'pan' },
        { type: 'rack', style: 'bins', x: [0.55, 0.83], z: [-0.65, 0.3], y0: 0.45, h: 0.32 },
        { type: 'battery', at: [0.55, 0.57, 0.62] },
        { type: 'extinguisher', at: [0.8, 0.95, 0.9], back: 0.07 },
        { type: 'mapcase', at: [0.82, 1.15, -0.3], ry: -PI / 2 },
        { type: 'pipe', pts: [[0.82, 1.24, 1.4], [0.82, 1.24, -0.65]], r: 0.012, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Pz.II', weight: 1.2, elevMin: -0.16, elevMax: 0.35,
    armor: { front: 30, side: 15, rear: 15, top: 10 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.8], w: [-0.2, 0.95] },
      { id: 'ammo', u: [-0.85, -0.5], v: [0.1, 0.5], w: [-0.7, -0.3] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.7, 0.4] }],
    seats: {
      gunner: { pos: [0.3, -0.42, 0.22], eye: [0.3, 0.38, 0.45] },
      commander: { pos: [0, -0.22, -0.38], eye: [0, 0.72, -0.35] },
    },
  },
  gun: { name: 'KwK 30', caliber: '20 мм', weight: 0.1, reload: 0.9, shellSpeed: 480, pen: 40, dmg: 0.3, disp: 0.004, elevSpeed: 0.4 },
  engine: { name: 'Maybach HL 62', power: 140, weight: 0.7, fuelUse: 0.1 },
  fuel: { name: 'канистры 6×20 л', cap: 120, weight: 0.15 },
  drive: { name: 'поворотный механизм Pz.II', speed: 0.9, weight: 0.1 },

  models: {
    hull() {
      const P = mats('pz2');
      const root = new THREE.Group();
      add(root, hullProfile([[-2.3, 0.36], [1.95, 0.36], [2.4, 0.78], [2.25, 1.0], [1.55, 1.05], [1.5, 1.42], [-2.1, 1.42], [-2.35, 1.0]], 1.72), P.main);
      add(root, U.box, P.main, 0, 1.23, -0.3, 2.2, 0.38, 3.6);                                        // superstructure over the tracks
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 0.98, 1.03, 0.05, 0.38, 0.04, 4.6);                             // fenders
        add(root, U.box, P.dark, sx * 1.02, 1.12, -1.2, 0.2, 0.16, 0.9);                              // tool boxes
      }
      const wheels = runningGear(root, P, {
        x: 0.98, w: 0.3, wheels: [1.3, 0.55, -0.2, -0.95, -1.7], wr: 0.29, wy: 0.31,
        idler: [2.02, 0.6, 0.22], sprocket: [-2.2, 0.5, 0.22],
      });
      returnRollers(root, P, 0.98, [0.95, 0.2, -0.55, -1.3], 0.86);
      add(root, U.box, P.dark, 0.45, 1.26, 1.52, 0.55, 0.16, 0.06);                                   // driver visor
      add(root, U.box, P.glass, 0.45, 1.26, 1.555, 0.3, 0.03, 0.02);
      add(root, U.box, P.dark, -0.45, 1.26, 1.52, 0.4, 0.14, 0.05);                                   // hull MG plate
      add(root, U.cyl, P.glass, 0.72, 1.12, 2.1, 0.08, 0.08, 0.08, PI / 2 - 0.5, 0, 0);               // Notek light
      add(root, U.cylX, P.rust, 0, 0.78, -2.42, 0.9, 0.11, 0.11);                                     // muffler
      add(root, U.box, P.grille, 0, 1.43, -1.95, 1.0, 0.02, 0.25);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.42, -1.25), 1.2, 1.05);
      bay.engineTop = 1.5;
      return hullResult(root, P, {
        wheels, wheelR: 0.29, bay, ring: { pos: new THREE.Vector3(0, 1.42, 0.35), r: 0.72 }, holeR: 0.7,
        box: new THREE.Box3(new THREE.Vector3(-1.12, 0.1, -2.42), new THREE.Vector3(1.12, 1.48, 2.42)),
        fuelAt: new THREE.Vector3(0, 1.02, -2.56),
      });
    },
    turret() {
      const P = mats('pz2');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.72, 0.74, 0.08, 24), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.6, 0.9), P.main, 0, 0.02, 0);
      cupola(g, P, 0, -0.35, 0.25, 0.6, [0.64, 0.76], 0.86);
      for (const sx of [-1, 1]) add(g, U.box, P.dark, sx * 0.7, 0.35, 0.05, 0.05, 0.12, 0.25, 0, 0, sx * 0.1);   // vision ports
      add(g, U.box, P.dark, 0, 0.25, -0.86, 0.8, 0.22, 0.1);
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.32, 0.9), sightY: 0.72, mgPos: new THREE.Vector3(0.38, 0.62, -0.15),
        box: planBox(PLAN, 0.86),
      };
    },
    gun() {
      const P = mats('pz2');
      const g = new THREE.Group();
      add(g, U.box, P.main, 0, 0, 0.05, 0.55, 0.34, 0.18);                  // mantlet
      add(g, U.cylZ, P.dark, 0, 0, 0.2, 0.07, 0.07, 0.2);
      add(g, U.cylZ, P.metal, 0, 0, 0.85, 0.028, 0.028, 1.3);
      add(g, U.cylZ, P.dark, 0, 0, 1.46, 0.04, 0.04, 0.12);                 // flash hider
      add(g, U.cylZ, P.metal, -0.18, 0.02, 0.2, 0.025, 0.025, 0.2);         // coax MG port
      breech(g, P, 0.14, 0.16, 0.4);
      return { group: g, muzzleLen: 1.52 };
    },
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 6, 0.85),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 6, w: 0.28, h: 0.45, d: 0.15, rail: false }),
    driveR: 0.66,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'coax', at: [-0.18, 0.32, 0.7], feed: 'right' },
        { type: 'rack', style: 'drums', x: [0.55, 0.55], z: [-0.4, 0.25], y0: 0.35 },
        { type: 'casebag', at: [0, 0.05, 0.4], w: 0.14, h: 0.14, d: 0.2 },
        { type: 'pistolport', at: [0, 0.3, -0.7], ry: PI },
      ], poly: scalePlan(PLAN, 0.85), h: 0.56, cupola: { x: 0, z: -0.35, r: 0.2, y0: 0.56, band: [0.64, 0.76], top: 0.8 } },
  },
};
