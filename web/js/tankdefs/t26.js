// Т-26 обр. 1933 (1933): Soviet light infantry tank (licensed Vickers 6-ton), 45 mm 20-K
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, runningGear, returnRollers, engineDeck, hullResult, breech, cupola, ovalPlan, ENGINE_TYPES } from '../modelkit.js';

export default {
  key: 't26', name: 'Т-26', year: 1933,
  palette: { main: 0x505b35, dark: 0x3a4426, engine: 0x575d4c },
  mg: 'dt',
  hull: {
    name: 'Т-26', weight: 8.2, speedCap: 8.6, eff: 1.0, turn: 1.1, radius: 2.5, ammoMax: 120,
    armor: { front: 15, side: 15, rear: 15, top: 6 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.8], w: [-0.95, -0.35] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [0.78, 1.0] },
      { id: 'ammo', u: [0.4, 0.9], v: [0.15, 0.6], w: [0.0, 0.5] },
    ],
    crew: [
      { u: [-0.8, -0.2], v: [0.1, 0.8], w: [0.4, 0.78] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.3, 0.4] },
    ],
    seats: { driver: { pos: [-0.45, 0.55, 1.02], eye: [-0.45, 1.2, 1.28] } },
    interior: {
      theme: 'soviet', seatStyle: 'pan', controls: 'levers', ammoStyle: 'horizontal', ammoCal: 0.024,
      x: 0.8, floor: 0.45, roof: 1.36, z: [-0.75, 1.45],
      slits: [{ x: [-0.68, -0.22], y: [1.14, 1.26] }],
      walk: [{ x: [-0.65, 0.65], z: [-0.55, 0.8] }, { x: [-0.72, -0.2], z: [0.8, 1.12] }],
      ammo: { x: [0.4, 0.78], z: [0.4, 1.3] },
      props: [
        { type: 'gearbox', at: [0, 0.72, 1.38], w: 1.0, h: 0.42, d: 0.2 },
        { type: 'shaft', z: [-0.75, 1.25], x: 0.12, w: 0.22, h: 0.16 },
        { type: 'fuelcell', box: [0.46, 0.45, -0.73, 0.78, 1.05, -0.15] },
        { type: 'rack', style: 'drums', x: [-0.78, -0.78], z: [-0.4, 0.5], y0: 1.1 },
        { type: 'battery', at: [-0.5, 0.57, -0.52] },
        { type: 'extinguisher', at: [-0.76, 0.9, 0.7], back: -0.07 },
        { type: 'watercan', at: [0.6, 0.62, 0.05] },
        { type: 'pipe', pts: [[-0.78, 1.25, 1.4], [-0.78, 1.25, -0.7]], r: 0.012, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Т-26', weight: 1.2, elevMin: -0.1, elevMax: 0.44,
    armor: { front: 15, side: 15, rear: 15, top: 8 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.5, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.8], w: [-0.1, 0.95] },
      { id: 'ammo', u: [-0.8, 0.8], v: [0.15, 0.7], w: [-1.0, -0.6] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.6, 0.4] }],
    seats: {
      gunner: { pos: [0.32, -0.42, 0.2], eye: [0.32, 0.38, 0.42] },
      commander: { pos: [-0.32, -0.25, -0.22], eye: [-0.32, 0.64, -0.25] },
    },
  },
  gun: { name: '20-К', caliber: '45 мм', weight: 0.3, reload: 3.2, shellSpeed: 430, pen: 50, dmg: 0.55, disp: 0.004, elevSpeed: 0.3 },
  engine: { name: 'ГАЗ Т-26', power: 91, weight: 0.5, fuelUse: 0.12 },
  fuel: { name: 'кормовой бак 180 л', cap: 180, weight: 0.2 },
  drive: { name: 'поворотный механизм Т-26', speed: 0.7, weight: 0.1 },

  models: {
    hull() {
      const P = mats('t26');
      const root = new THREE.Group();
      add(root, hullProfile([[-2.25, 0.4], [1.95, 0.4], [2.35, 0.75], [2.3, 0.95], [1.6, 1.1], [1.55, 1.4], [-2.05, 1.4], [-2.3, 1.08]], 1.62), P.main);
      add(root, U.box, P.main, 0, 1.22, -0.25, 2.1, 0.36, 3.6);                                       // superstructure
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 1.02, 1.01, 0.05, 0.5, 0.04, 4.7);                              // fenders
        for (const z of [1.275, 0.375, -0.525, -1.425]) add(root, U.box, P.dark, sx * 1.2, 0.36, z, 0.1, 0.24, 0.5);   // bogies
        add(root, U.box, P.dark, sx * 1.12, 1.1, 0.9, 0.22, 0.14, 0.8);                               // stowage
      }
      const wheels = runningGear(root, P, {
        x: 1.02, w: 0.28, wheels: [1.45, 1.1, 0.55, 0.2, -0.35, -0.7, -1.25, -1.6], wr: 0.19, wy: 0.21,
        idler: [2.12, 0.56, 0.25], sprocket: [-2.15, 0.55, 0.26],
      });
      returnRollers(root, P, 1.02, [1.2, 0.3, -0.6, -1.5], 0.76, 0.06);
      add(root, U.box, P.metal, -0.45, 1.41, 1.15, 0.5, 0.04, 0.45);                                   // driver hatch
      add(root, U.box, P.glass, -0.45, 1.3, 1.565, 0.3, 0.03, 0.02);
      for (const x of [0.5, -0.5]) add(root, U.cylZ, P.glass, x, 1.2, 2.15, 0.08, 0.08, 0.05);          // headlights
      add(root, U.box, P.dark, 0, 0.95, -2.35, 1.3, 0.3, 0.12);                                       // exhaust box
      add(root, U.box, P.grille, 0, 1.41, -1.95, 1.1, 0.02, 0.2);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.4, -1.25), 1.2, 1.05);
      bay.engineTop = 1.5;
      return hullResult(root, P, {
        wheels, wheelR: 0.19, bay, ring: { pos: new THREE.Vector3(-0.1, 1.4, 0.3), r: 0.74 }, holeR: 0.72,
        box: new THREE.Box3(new THREE.Vector3(-1.22, 0.1, -2.38), new THREE.Vector3(1.22, 1.46, 2.4)),
        fuelAt: new THREE.Vector3(0, 1.0, -2.55),
      });
    },
    turret() {
      const P = mats('t26');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.74, 0.76, 0.08, 24), P.dark, 0, 0.02, 0);
      add(g, new THREE.CylinderGeometry(0.72, 0.72, 0.58, 28), P.main, 0, 0.31, 0);
      add(g, sizedBox(0.9, 0.42, 0.45), P.main, 0, 0.3, -0.88);                                        // bustle
      cupola(g, P, -0.32, -0.25, 0.25, 0.58, [0.6, 0.7], 0.76);
      add(g, new THREE.TorusGeometry(0.88, 0.012, 4, 30).rotateX(PI / 2), P.metal, 0, 0.68, -0.1);   // frame antenna
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * PI * 2 + 0.5;
        add(g, U.cyl, P.metal, Math.sin(a) * 0.8, 0.64, Math.cos(a) * 0.8 - 0.1, 0.01, 0.1, 0.01);
      }
      add(g, U.cyl, P.dark, 0.3, 0.62, 0.2, 0.06, 0.1, 0.06);                                            // periscope
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.3, 0.72), sightY: 0.72, mgPos: new THREE.Vector3(0.32, 0.6, -0.12),
        box: new THREE.Box3(new THREE.Vector3(-0.74, 0, -1.13), new THREE.Vector3(0.74, 0.78, 0.74)),
      };
    },
    gun() {
      const P = mats('t26');
      const g = new THREE.Group();
      add(g, U.box, P.main, 0, 0, 0.04, 0.45, 0.34, 0.14);
      add(g, new THREE.CylinderGeometry(0.034, 0.045, 2.1, 12).rotateX(PI / 2), P.main, 0, 0, 1.12);
      add(g, U.cylZ, P.metal, 0, 0, 2.18, 0.045, 0.045, 0.06);
      add(g, U.cylZ, P.metal, 0.16, 0, 0.18, 0.025, 0.025, 0.2);
      breech(g, P, 0.2, 0.2, 0.55);
      return { group: g, muzzleLen: 2.2 };
    },
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.8),
    fuel(g, P) {
      add(g, sizedBox(1.5, 0.5, 0.4), P.main, 0, 0, 0);
      add(g, U.cyl, P.brass, 0.5, 0.27, 0, 0.07, 0.05, 0.07);
      for (const x of [-0.6, 0.6]) add(g, U.box, P.dark, x, 0, 0.21, 0.06, 0.52, 0.03);
      return 0.25;
    },
    driveR: 0.68,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'radio', at: [0.05, 0.28, -0.98], ry: 0, w: 0.5, h: 0.26, lead: 0.2 },
        { type: 'ready', at: [-0.55, 0.2, -0.1], ry: -PI / 2, n: 6, cal: 0.024, len: 0.5 },
        { type: 'coax', at: [0.16, 0.3, 0.55], feed: 'left' },
        { type: 'rack', style: 'drums', x: [0.6, 0.6], z: [-0.35, 0.25], y0: 0.36 },
        { type: 'casebag', at: [0, -0.1, 0.35], w: 0.2, h: 0.18, d: 0.24 },
        { type: 'pistolport', at: [0, 0.3, -1.1], ry: PI },
      ], poly: ovalPlan(0.66, 0.66, 0.66), h: 0.54, cupola: { x: -0.32, z: -0.25, r: 0.2, y0: 0.54, band: [0.6, 0.7], top: 0.72 } },
  },
};
