// Тип 89 «И-Го» Оцу (1934): Japanese medium tank - long riveted hull, nine small road wheels a side behind a
// skirt plate, an unditching tail, the short 57 mm Type 90 gun, air-cooled diesel
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, link, runningGear, returnRollers, engineDeck, hullResult, breech, barrel, cupola, ovalPlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

export default {
  key: 'type89', name: 'Тип 89', year: 1934,
  palette: { main: 0x6b6a45, dark: 0x4f4a30, engine: 0x55533f, riveted: true },
  mg: 'type97',
  hull: {
    name: 'Тип 89 «И-Го»', weight: 10.2, speedCap: 7.0, eff: 1.0, turn: 0.95, radius: 2.9, ammoMax: 100,
    armor: { front: 17, side: 15, rear: 15, top: 10 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.8], w: [-0.85, -0.3] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [0.8, 1.0] },
      { id: 'ammo', u: [0.35, 0.9], v: [0.15, 0.6], w: [-0.2, 0.35] },
    ],
    crew: [
      { u: [-0.8, 0.8], v: [0.15, 0.85], w: [0.4, 0.8] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.3, 0.4] },
    ],
    seats: { driver: { pos: [-0.34, 0.6, 1.42], eye: [-0.34, 1.3, 1.72], style: 'pan' } },
    interior: {
      theme: 'japan', x: 0.66, floor: 0.5, roof: 1.66, z: [-0.7, 2.0], controls: 'levers', seatStyle: 'pan',
      slits: [{ x: [-0.55, -0.14], y: [1.25, 1.37] }],
      walk: [{ x: [-0.55, 0.55], z: [-0.55, 1.1] }, { x: [-0.55, -0.1], z: [1.1, 1.45] }],
      ammo: { x: [0.36, 0.64], z: [-0.55, 0.45] }, ammoStyle: 'horizontal', ammoCal: 0.03,
      props: [
        { type: 'seat', at: [0.34, 0.6, 1.42], style: 'pan' },
        { type: 'ballmg', at: [0.34, 1.28, 1.96], drum: false, sight: true },
        { type: 'periscope', at: [0.34, 1.42, 1.93] },
        { type: 'gearbox', at: [0, 0.75, 1.82], w: 1.0, h: 0.4, d: 0.3 },
        { type: 'shaft', z: [-0.7, 1.65], x: 0, w: 0.24, h: 0.16 },
        { type: 'rack', style: 'drums', x: [0.64, 0.64], z: [0.7, 1.3], y0: 1.35 },
        { type: 'rack', style: 'horizontal', x: [-0.64, -0.36], z: [-0.55, 0.3], y0: 0.52, h: 0.35, cal: 0.03, rows: 2 },
        { type: 'extinguisher', at: [-0.6, 1.0, 0.6], back: -0.07 },
        { type: 'watercan', at: [0.52, 0.68, -0.6] },
        { type: 'pipe', pts: [[-0.64, 1.5, 1.9], [-0.64, 1.5, -0.65]], r: 0.012, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Тип 89', weight: 1.1, elevMin: -0.15, elevMax: 0.35,
    armor: { front: 17, side: 15, rear: 15, top: 10 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.5, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.8], w: [0.0, 1.0] },
      { id: 'ammo', u: [0.4, 0.85], v: [0.1, 0.5], w: [-0.6, -0.1] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.7, 0.4] }],
    seats: {
      gunner: { pos: [0.24, -0.5, 0.16], eye: [0.24, 0.4, 0.36], style: 'pan' },
      commander: { pos: [0, -0.32, -0.3], eye: [0, 0.78, -0.3], style: 'sling' },
    },
  },
  gun: { name: 'Тип 90 57 мм', caliber: '57 мм', weight: 0.25, reload: 3.4, shellSpeed: 350, pen: 22, dmg: 0.75, disp: 0.0055, elevSpeed: 0.3 },
  engine: { name: 'Mitsubishi A6120VD', power: 120, weight: 0.8, fuelUse: 0.12 },
  fuel: { name: 'кормовые баки 2×90 л', cap: 180, weight: 0.2 },
  drive: { name: 'поворотный механизм Тип 89', speed: 0.6, weight: 0.1 },

  models: {
    hull() {
      const P = mats('type89');
      const root = new THREE.Group();
      add(root, hullProfile([[-2.55, 0.45], [2.0, 0.45], [2.62, 0.95], [2.52, 1.25], [1.95, 1.34], [1.8, 1.7], [-2.2, 1.7], [-2.62, 1.38]], 1.4), P.main);
      add(root, sizedBox(2.0, 0.5, 4.0), P.main, 0, 1.45, -0.2);                                      // upper hull over the tracks
      add(root, sizedBox(1.6, 0.36, 0.12), P.main, 0, 1.52, 1.84);                                     // stepped front plate
      const wz = [1.55, 1.2, 0.85, 0.5, 0.15, -0.2, -0.55, -0.9, -1.25];
      const wheels = runningGear(root, P, {
        x: 0.9, w: 0.3, wheels: wz, wr: 0.15, wy: 0.17,
        idler: [2.45, 0.78, 0.28], sprocket: [-2.42, 0.56, 0.3],
      });
      returnRollers(root, P, 0.9, [1.3, 0.5, -0.3, -1.1, -1.9], 0.92, 0.06);
      for (const sx of [-1, 1]) {
        add(root, sizedBox(0.06, 0.46, 3.9), P.main, sx * 1.07, 0.66, -0.05);                       // skirt over the bogies
        for (let z = -1.8; z < 1.8; z += 0.4) add(root, U.cylX, P.dark, sx * 1.105, 0.66, z, 0.02, 0.07, 0.07);
        add(root, U.box, P.dark, sx * 1.0, 1.2, 1.9, 0.26, 0.04, 1.0, -0.3, 0, 0);                   // front mudguards
      }
      // tail skid, hull MG ball (left), driver's visor (right), exhaust on the rear deck
      for (const sx of [-1, 1]) link(root, P.dark, sx * 0.5, 0.08, -2.5, 1.35, -3.3, 0.55, 0.1);
      add(root, U.box, P.dark, 0, 0.55, -3.28, 1.1, 0.1, 0.12);
      add(root, U.box, P.dark, 0, 0.95, -2.95, 1.0, 0.06, 0.06);
      add(root, U.sph, P.dark, 0.34, 1.5, 1.92, 0.12, 0.12, 0.08);
      add(root, U.cylZ, P.metal, 0.34, 1.5, 2.05, 0.025, 0.025, 0.2);
      add(root, U.box, P.dark, -0.34, 1.54, 1.91, 0.36, 0.14, 0.05);
      add(root, U.box, P.black, -0.34, 1.55, 1.935, 0.24, 0.03, 0.01);
      add(root, U.cylX, P.rust, 0, 1.78, -2.0, 1.1, 0.09, 0.09);
      add(root, U.box, P.grille, 0, 1.71, -1.4, 1.2, 0.02, 0.5);
      add(root, U.cylZ, P.glass, -0.72, 1.55, 1.9, 0.08, 0.08, 0.05);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.7, -1.35), 1.2, 1.1);
      bay.engineTop = 1.62;
      return hullResult(root, P, {
        wheels, wheelR: 0.15, bay, ring: { pos: new THREE.Vector3(0, 1.7, 0.5), r: 0.6 }, holeR: 0.58,
        box: new THREE.Box3(new THREE.Vector3(-1.1, 0.1, -3.35), new THREE.Vector3(1.1, 1.78, 2.7)),
        fuelAt: new THREE.Vector3(0, 1.12, -2.72),
      });
    },
    turret() {
      const P = mats('type89');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.6, 0.62, 0.06, 20), P.dark, 0, 0.03, 0);
      add(g, new THREE.CylinderGeometry(0.52, 0.6, 0.6, 16), P.main, 0, 0.33, 0);
      add(g, U.box, P.main, 0, 0.33, 0.52, 0.44, 0.38, 0.16);                                         // gun housing
      cupola(g, P, 0, -0.3, 0.24, 0.63, [0.68, 0.78], 0.86);
      add(g, U.hemi, P.main, 0, 0.86, -0.3, 0.24, 0.12, 0.24);
      add(g, U.sph, P.dark, 0, 0.36, -0.58, 0.1, 0.1, 0.08);                                          // rear MG ball
      add(g, U.cylZ, P.metal, 0, 0.36, -0.7, 0.02, 0.02, 0.2);
      for (const a of [1.1, -1.1]) add(g, U.box, P.black, Math.sin(a) * 0.57, 0.45, Math.cos(a) * 0.57, 0.1, 0.02, 0.02, 0, a, 0);
      add(g, U.box, P.dark, 0, 0.62, 0.1, 0.3, 0.03, 0.3);                                             // roof hatch
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.33, 0.6), sightY: 0.76, mgPos: new THREE.Vector3(0.3, 0.62, -0.05),
        box: new THREE.Box3(new THREE.Vector3(-0.62, 0, -0.66), new THREE.Vector3(0.62, 0.96, 0.66)),
      };
    },
    gun() {
      const P = mats('type89');
      const g = new THREE.Group();
      add(g, U.box, P.dark, 0, 0, 0.02, 0.3, 0.28, 0.1);
      barrel(g, P.metal, 0.05, 0.85, 0.07, 0.058);
      add(g, U.cylZ, P.metal, 0, 0, 0.92, 0.066, 0.066, 0.06);
      add(g, U.cylZ, P.dark, 0, -0.1, 0.28, 0.035, 0.035, 0.36);
      breech(g, P, 0.2, 0.2, 0.45);
      return { group: g, muzzleLen: 0.95 };
    },
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 6, 0.95),
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [-0.4, 0.4], w: 0.7, h: 0.4, d: 0.28, straps: true }),
    driveR: 0.55,
    turretInterior: {
      poly: ovalPlan(0.5, 0.5, 0.5, 16), h: 0.6,
      cupola: { x: 0, z: -0.3, r: 0.21, y0: 0.6, band: [0.66, 0.78], top: 0.84 },
      props: [
        { type: 'sidemg', at: [0, 0.36, -0.42], ry: PI },
        { type: 'ready', at: [0.44, 0.2, -0.1], ry: PI / 2, n: 5, cal: 0.03, len: 0.35 },
        { type: 'ready', at: [-0.44, 0.2, 0.05], ry: -PI / 2, n: 5, cal: 0.03, len: 0.35 },
        { type: 'casebag', at: [0, -0.05, 0.22], w: 0.18, h: 0.16, d: 0.2 },
        { type: 'rack', style: 'drums', x: [-0.46, -0.46], z: [-0.35, -0.05], y0: 0.42 },
      ],
    },
  },
};
