// Pz.Kpfw. IV Ausf. H (1943): German medium tank, 75 mm KwK 40 L/48, 80 mm bolted-on front plates,
// Schürzen skirts along the hull sides and around the turret, eight small road wheels a side in pairs.
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, prism, runningGear, returnRollers, engineDeck, hullResult, breech, barrel, cupola, planBox, scalePlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const PLAN = [[0.5, 0.92], [0.84, 0.5], [0.9, -0.55], [0.72, -1.0], [-0.72, -1.0], [-0.9, -0.55], [-0.84, 0.5], [-0.5, 0.92]];
const TOP = 1.86;                  // superstructure roof

export default {
  key: 'pz4', name: 'Pz.IV', year: 1943,
  palette: { main: 0x8f8456, dark: 0x6b6340, engine: 0x5d5c55 },
  mg: 'mg34',
  hull: {
    name: 'Pz.Kpfw. IV Ausf. H', weight: 17.2, speedCap: 11.2, eff: 1.0, turn: 1.0, radius: 3.1, ammoMax: 87,
    armor: { front: 110, side: 35, rear: 25, top: 15 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.75], w: [-0.95, -0.45] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [0.8, 1.0] },
      { id: 'ammo', u: [-0.95, -0.45], v: [0.15, 0.6], w: [-0.3, 0.3] },
    ],
    crew: [
      { u: [0.2, 0.8], v: [0.1, 0.75], w: [0.45, 0.8] },
      { u: [-0.8, -0.2], v: [0.1, 0.75], w: [0.45, 0.8] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.3, 0.4] },
    ],
    seats: { driver: { pos: [0.5, 0.6, 1.8], eye: [0.5, 1.42, 2.1] } },
    interior: {
      theme: 'german', seatStyle: 'pan', controls: 'levers', ammoStyle: 'bins', ammoCal: 0.04, dials: 5,
      x: 1.0, floor: 0.5, roof: 1.8, z: [-1.3, 2.3],
      slits: [{ x: [0.3, 0.72], y: [1.38, 1.48] }],
      walk: [{ x: [-0.85, 0.85], z: [-1.1, 1.3] }, { x: [0.25, 0.85], z: [1.3, 1.75] }],
      ammo: { x: [-0.95, -0.5], z: [-1.2, 0.3] },
      props: [
        { type: 'gearbox', at: [0, 0.78, 2.15], w: 0.9, h: 0.45, d: 0.25 },
        { type: 'shaft', z: [-1.3, 2.0], x: 0.0, w: 0.24, h: 0.18 },
        { type: 'seat', at: [-0.5, 0.6, 1.8], style: 'pan' },
        { type: 'ballmg', at: [-0.5, 1.42, 2.22], drum: false, sight: true },
        { type: 'radio', at: [-0.1, 1.25, 1.95], ry: PI, w: 0.5, h: 0.26, box2: true },
        { type: 'rack', style: 'bins', x: [0.55, 0.95], z: [-1.2, 0.6], y0: 0.52, h: 0.4 },
        { type: 'rack', style: 'drums', x: [-0.98, -0.98], z: [1.0, 1.9], y0: 1.2 },
        { type: 'battery', at: [0.4, 0.62, -1.15] },
        { type: 'extinguisher', at: [0.96, 1.1, 1.2], back: 0.07 },
        { type: 'mapcase', at: [0.97, 1.35, 0.9], ry: -PI / 2 },
        { type: 'pipe', pts: [[0.97, 1.7, 2.2], [0.97, 1.7, -1.2]], r: 0.014, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Pz.IV', weight: 5.0, elevMin: -0.14, elevMax: 0.35,
    armor: { front: 60, side: 35, rear: 35, top: 15 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.75], w: [-0.3, 0.9] },
      { id: 'ammo', u: [-0.8, -0.4], v: [0.1, 0.5], w: [-0.7, -0.2] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.8, 0.4] }],
    seats: {
      gunner: { pos: [0.42, -0.3, 0.3], eye: [0.42, 0.5, 0.52] },
      commander: { pos: [0, 0.0, -0.72], eye: [0, 0.88, -0.7] },
    },
  },
  gun: { name: 'KwK 40 L/48', caliber: '75 мм', weight: 1.1, reload: 5.2, shellSpeed: 640, pen: 120, dmg: 0.8, disp: 0.0028, elevSpeed: 0.24 },
  engine: { name: 'Maybach HL 120', power: 300, weight: 1.0, fuelUse: 0.24 },
  fuel: { name: 'канистры 8×20 л', cap: 160, weight: 0.2 },
  drive: { name: 'поворотный механизм Pz.IV', speed: 0.5, weight: 0.2 },

  models: {
    hull() {
      const P = mats('pz4');
      const root = new THREE.Group();
      add(root, hullProfile([[-2.9, 0.45], [2.4, 0.45], [2.95, 0.88], [2.95, 1.28], [-2.95, 1.28], [-2.95, 0.85]], 1.8), P.main);
      add(root, sizedBox(2.62, TOP - 1.2, 3.62), P.main, 0, (TOP + 1.2) / 2, 0.53);                  // superstructure
      add(root, sizedBox(2.62, 0.08, 0.12), P.main, 0, TOP + 0.02, 2.3);
      add(root, sizedBox(2.3, 0.5, 1.6), P.main, 0, 1.47, -2.1);                                     // engine deck
      add(root, U.box, P.dark, 0, 1.08, 2.98, 1.4, 0.3, 0.1);                                        // spare track on the nose
      for (let i = 0; i < 6; i++) add(root, U.box, P.track, -0.6 + i * 0.24, 1.08, 3.04, 0.2, 0.26, 0.04);
      add(root, U.box, P.dark, 0.5, 1.6, 2.36, 0.4, 0.14, 0.04);                                     // driver's visor
      add(root, U.box, P.black, 0.5, 1.6, 2.385, 0.24, 0.04, 0.02);
      add(root, U.sph, P.dark, -0.5, 1.58, 2.35, 0.12, 0.12, 0.08);                                  // hull MG ball
      add(root, U.cylZ, P.metal, -0.5, 1.58, 2.55, 0.02, 0.02, 0.35);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 1.2, 1.28, 0.0, 0.5, 0.04, 5.9);                               // fenders
        add(root, U.box, P.dark, sx * 0.72, TOP + 0.08, 2.1, 0.44, 0.06, 0.4);                       // crew hatches
        // Schürzen: five plates on hangers, a little apart from the hull
        for (let i = 0; i < 5; i++) {
          add(root, U.box, P.main, sx * 1.58, 1.18, 2.0 - i * 0.98, 0.02, 0.82, 0.95, 0, sx * 0.02, 0);
        }
        add(root, U.box, P.metal, sx * 1.45, 1.62, -0.05, 0.3, 0.03, 4.9);                           // hanger rail
      }
      const wheels = runningGear(root, P, {
        x: 1.2, w: 0.4, wheels: [1.95, 1.5, 0.92, 0.47, -0.11, -0.56, -1.14, -1.59], wr: 0.235, wy: 0.26,
        idler: [2.52, 0.7, 0.3], sprocket: [-2.58, 0.6, 0.27],
      });
      returnRollers(root, P, 1.2, [1.9, 0.9, -0.1, -1.1], 0.98, 0.07);
      add(root, U.cyl, P.glass, 0.85, 1.36, 2.8, 0.08, 0.08, 0.08, PI / 2 - 0.5, 0, 0);               // Notek light
      add(root, U.cylX, P.rust, 0.35, 0.95, -3.02, 0.9, 0.13, 0.13);                                 // muffler
      add(root, U.cylX, P.dark, -0.6, 0.95, -3.0, 0.35, 0.08, 0.08);                                 // auxiliary engine exhaust
      add(root, U.box, P.grille, 0, 1.73, -2.55, 1.6, 0.02, 0.35);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.72, -1.8), 1.4, 1.0);
      bay.engineTop = 1.72;
      return hullResult(root, P, {
        wheels, wheelR: 0.235, bay, ring: { pos: new THREE.Vector3(0, TOP, 0.2), r: 0.9 }, holeR: 0.88,
        box: new THREE.Box3(new THREE.Vector3(-1.6, 0.1, -3.0), new THREE.Vector3(1.6, TOP + 0.08, 3.0)),
        fuelAt: new THREE.Vector3(0, 1.3, -3.25),
      });
    },
    turret() {
      const P = mats('pz4');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.9, 0.94, 0.08, 28), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.72, 0.86), P.main, 0, 0.02, 0);
      cupola(g, P, 0, -0.72, 0.3, 0.7, [0.76, 0.88], 0.98);
      for (const sx of [-1, 1]) {
        add(g, U.box, P.dark, sx * 0.84, 0.38, 0.05, 0.05, 0.5, 0.45);                               // side hatches
        // turret Schürzen: side and rear plates
        add(g, U.box, P.main, sx * 1.16, 0.35, -0.35, 0.02, 0.62, 1.35);
        add(g, U.box, P.metal, sx * 1.02, 0.5, -0.1, 0.26, 0.03, 0.03);
      }
      add(g, U.box, P.main, 0, 0.35, -1.32, 2.32, 0.62, 0.02);
      add(g, U.box, P.main, 0, 0.35, -1.12, 1.2, 0.46, 0.34);                                          // stowage bin
      add(g, U.box, P.dark, 0.5, 0.75, 0.55, 0.06, 0.05, 0.06);                                        // sight port
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.36, 0.92), sightY: 0.98, mgPos: new THREE.Vector3(0.3, 0.98, -0.72),
        box: new THREE.Box3(new THREE.Vector3(-1.18, 0, -1.34), new THREE.Vector3(1.18, 0.98, 0.93)),
      };
    },
    gun() {
      const P = mats('pz4');
      const g = new THREE.Group();
      add(g, sizedBox(0.7, 0.44, 0.14), P.main, 0, 0, 0.04);                                           // mantlet
      add(g, U.cylZ, P.main, 0, 0, 0.2, 0.14, 0.14, 0.24);
      barrel(g, P.main, 0.3, 3.3, 0.055, 0.045);
      add(g, U.cylZ, P.dark, 0, 0, 3.72, 0.075, 0.075, 0.12);                                          // double-baffle muzzle brake
      add(g, U.cylZ, P.dark, 0, 0, 3.86, 0.075, 0.075, 0.1);
      add(g, U.box, P.dark, 0, 0, 3.79, 0.18, 0.06, 0.04);
      add(g, U.cylZ, P.metal, -0.22, 0.02, 0.2, 0.025, 0.025, 0.24);                                   // coax MG
      breech(g, P, 0.3, 0.3, 0.8);
      return { group: g, muzzleLen: 3.92 };
    },
    engine: (g, P, E) => ENGINE_TYPES.aeroV12(g, P, E, 0.9),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 8, w: 0.24, h: 0.46, d: 0.16, rail: true }),
    driveR: 0.86,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'coax', at: [-0.22, 0.36, 0.78], feed: 'right' },
        { type: 'ready', at: [0.7, 0.2, -0.45], ry: PI / 2, n: 5, cal: 0.04, len: 0.8 },
        { type: 'rack', style: 'drums', x: [-0.75, -0.75], z: [-0.5, 0.2], y0: 0.35 },
        { type: 'basket', y: -0.95, r: 0.78 },
        { type: 'pistolport', at: [-0.4, 0.3, -0.95], ry: PI },
      ], poly: scalePlan(PLAN, 0.85), h: 0.68, cupola: { x: 0, z: -0.72, r: 0.26, y0: 0.68, band: [0.76, 0.88], top: 0.94 } },
  },
};
