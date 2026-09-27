// БТ-7 (1935): Soviet fast tank on the Christie suspension - four big rubber-tyred road wheels a side,
// an M-17T aero engine, 45 mm 20-K in a cylindrical turret with a rear bustle
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, link, runningGear, engineDeck, hullResult, breech, barrel, ovalPlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

export default {
  key: 'bt7', name: 'БТ-7', year: 1935,
  palette: { main: 0x4f5c33, dark: 0x394325, engine: 0x5a5f4d },
  mg: 'dt',
  hull: {
    name: 'БТ-7', weight: 10.8, speedCap: 14.4, eff: 1.0, turn: 1.15, radius: 2.9, ammoMax: 146,
    armor: { front: 20, side: 13, rear: 13, top: 10 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.85], w: [-0.85, -0.3] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [-1.0, -0.85] },
      { id: 'ammo', u: [0.45, 0.9], v: [0.15, 0.55], w: [-0.2, 0.35] },
    ],
    crew: [
      { u: [-0.3, 0.3], v: [0.1, 0.8], w: [0.5, 0.85] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.3, 0.45] },
    ],
    seats: { driver: { pos: [0, 0.55, 1.62], eye: [0, 1.24, 1.98], style: 'pan' } },
    interior: {
      theme: 'soviet', x: 0.66, floor: 0.45, roof: 1.58, z: [-1.0, 2.2], controls: 'levers', seatStyle: 'pan',
      slits: [{ x: [-0.22, 0.22], y: [1.18, 1.3] }],
      walk: [{ x: [-0.55, 0.55], z: [-0.85, 1.3] }, { x: [-0.3, 0.3], z: [1.3, 1.75] }],
      ammo: { x: [0.34, 0.64], z: [-0.8, 0.7] }, ammoStyle: 'horizontal', ammoCal: 0.024,
      props: [
        { type: 'rack', style: 'horizontal', x: [-0.64, -0.36], z: [-0.8, 0.4], y0: 0.5, h: 0.4, cal: 0.024, rows: 3 },
        { type: 'rack', style: 'drums', x: [0.64, 0.64], z: [0.8, 1.6], y0: 1.25 },
        { type: 'fuelcell', box: [-0.66, 0.45, 0.55, -0.4, 1.25, 1.5] },
        { type: 'fuelcell', box: [0.4, 0.45, 0.8, 0.66, 1.1, 1.5] },
        { type: 'battery', at: [0.3, 0.57, -0.75], ry: 0 },
        { type: 'extinguisher', at: [0.6, 0.95, -0.6], back: 0.07 },
        { type: 'floorhatch', at: [0, 0.95], r: 0.22 },
        { type: 'pipe', pts: [[0.62, 1.4, 1.7], [0.62, 1.4, -0.9], [0.2, 1.52, -0.95]], r: 0.012, mat: 'cable' },
        { type: 'watercan', at: [-0.5, 0.64, -0.8] },
      ],
    },
  },
  turret: {
    name: 'Башня БТ-7', weight: 1.4, elevMin: -0.1, elevMax: 0.44,
    armor: { front: 15, side: 15, rear: 15, top: 10 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.5, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.8], w: [0.0, 0.95] },
      { id: 'ammo', u: [-0.8, 0.8], v: [0.15, 0.7], w: [-1.0, -0.6] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.6, 0.4] }],
    seats: {
      gunner: { pos: [0.36, -0.44, 0.16], eye: [0.36, 0.42, 0.4], style: 'pan' },
      commander: { pos: [-0.36, -0.28, -0.24], eye: [-0.36, 0.64, -0.2], style: 'pan' },
    },
  },
  gun: { name: '20-К обр. 1934', caliber: '45 мм', weight: 0.3, reload: 3.0, shellSpeed: 760, pen: 52, dmg: 0.55, disp: 0.0038, elevSpeed: 0.32 },
  engine: { name: 'М-17Т', power: 450, weight: 0.9, fuelUse: 0.3 },
  fuel: { name: 'кормовые баки 2×110 л', cap: 220, weight: 0.3 },
  drive: { name: 'поворотный механизм БТ-7', speed: 0.8, weight: 0.1 },

  models: {
    hull() {
      const P = mats('bt7');
      const root = new THREE.Group();
      // narrow nose, vertical sides, sloped rear with the big exhausts
      add(root, hullProfile([[-2.6, 0.42], [2.05, 0.42], [2.72, 0.78], [2.62, 1.02], [1.95, 1.34], [1.62, 1.6], [-2.25, 1.6], [-2.62, 1.3], [-2.78, 0.88]], 1.38), P.main);
      add(root, U.box, P.main, 0, 1.4, -0.35, 2.12, 0.4, 3.7);                                      // upper hull over the tracks
      const wz = [1.58, 0.53, -0.53, -1.58];
      const wheels = runningGear(root, P, {
        x: 0.98, w: 0.27, wheels: wz, wr: 0.41, wy: 0.43,
        idler: [2.42, 0.56, 0.3], sprocket: [-2.44, 0.6, 0.33], spokes: false,
        topRun: wz.map(z => [z, 0.43 + 0.41 + 0.04]),
      });
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 0.99, 1.2, -0.3, 0.42, 0.04, 4.1);                            // fenders
        link(root, P.dark, sx * 0.99, 0.42, 1.75, 1.2, 2.55, 0.98, 0.04);                          // front mudguard
        for (const z of wz) add(root, U.cylX, P.dark, sx * 1.12, 0.43, z, 0.03, 0.22, 0.22);        // wheel hubs (dished discs)
        add(root, U.box, P.dark, sx * 1.07, 1.3, 0.9, 0.12, 0.18, 1.1);                             // tool boxes
      }
      add(root, U.box, P.dark, 0, 1.52, 1.75, 0.44, 0.3, 0.06, -0.6, 0, 0);                         // driver's hatch
      add(root, U.box, P.black, 0, 1.56, 1.7, 0.26, 0.03, 0.03, -0.6, 0, 0);
      for (const x of [0.52, -0.52]) add(root, U.cylZ, P.glass, x, 1.32, 2.02, 0.07, 0.07, 0.05);    // headlights
      add(root, U.box, P.grille, 0, 1.61, -1.1, 1.2, 0.02, 0.5);                                    // louvres
      for (const sx of [-1, 1]) {                                                                  // exhaust pipes
        link(root, P.rust, sx * 0.4, 0.13, -2.45, 1.05, -2.72, 1.5, 0.13);
        add(root, U.cylZ, P.rust, sx * 0.4, 1.52, -2.72, 0.08, 0.08, 0.12);
      }
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.6, -1.75), 1.2, 1.1);
      bay.engineTop = 1.66;
      return hullResult(root, P, {
        wheels, wheelR: 0.41, bay, ring: { pos: new THREE.Vector3(0, 1.6, 0.55), r: 0.74 }, holeR: 0.72,
        box: new THREE.Box3(new THREE.Vector3(-1.15, 0.1, -2.85), new THREE.Vector3(1.15, 1.66, 2.8)),
        fuelAt: new THREE.Vector3(0, 0.95, -2.78),
      });
    },
    turret() {
      const P = mats('bt7');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.8, 0.8, 0.06, 26), P.dark, 0, 0.03, 0);
      add(g, new THREE.CylinderGeometry(0.8, 0.82, 0.62, 28), P.main, 0, 0.33, 0);
      add(g, sizedBox(1.1, 0.46, 0.55), P.main, 0, 0.35, -0.98);                                      // bustle
      add(g, U.box, P.main, 0, 0.33, 0.8, 0.62, 0.42, 0.14);                                          // gun embrasure
      add(g, U.box, P.dark, 0.12, 0.66, -0.15, 0.62, 0.05, 0.62);                                     // big roof hatch
      add(g, U.cyl, P.dark, 0.42, 0.72, 0.3, 0.06, 0.14, 0.06);                                       // PT-1 periscope
      add(g, U.box, P.glass, 0.42, 0.8, 0.34, 0.09, 0.05, 0.02);
      for (const sx of [-1, 1]) add(g, U.box, P.black, sx * 0.8, 0.45, 0.15, 0.02, 0.03, 0.14, 0, sx * 0.3, 0);   // vision slits
      add(g, U.cylZ, P.dark, 0.2, 0.32, 0.86, 0.035, 0.035, 0.12);                                    // coax DT port
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.33, 0.86), sightY: 0.74, mgPos: new THREE.Vector3(-0.34, 0.64, -0.2),
        box: new THREE.Box3(new THREE.Vector3(-0.82, 0, -1.26), new THREE.Vector3(0.82, 0.72, 0.88)),
      };
    },
    gun() {
      const P = mats('bt7');
      const g = new THREE.Group();
      add(g, U.box, P.main, 0, 0, 0.04, 0.42, 0.32, 0.14);
      barrel(g, P.main, 0.1, 2.05, 0.05, 0.036);
      add(g, U.cylZ, P.metal, 0, 0, 2.18, 0.043, 0.043, 0.06);
      breech(g, P, 0.2, 0.2, 0.55);
      return { group: g, muzzleLen: 2.2 };
    },
    engine: (g, P, E) => ENGINE_TYPES.aeroV12(g, P, E, 0.95),
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [-0.36, 0.36], w: 0.62, h: 0.4, d: 0.26, straps: true }),
    driveR: 0.68,
    turretInterior: {
      poly: [...ovalPlan(0.74, 0.74, 0.74, 14).filter(p => p[1] > -0.5), [0.5, -1.22], [-0.5, -1.22]].sort((a, b) => Math.atan2(a[0], a[1]) - Math.atan2(b[0], b[1])),
      h: 0.6, gunnerStyle: 'wheels',
      props: [
        { type: 'radio', at: [0.25, 0.3, -1.08], ry: 0, w: 0.5, h: 0.28, lead: 0.2 },
        { type: 'ready', at: [-0.3, 0.2, -1.05], ry: 0, n: 7, cal: 0.024, len: 0.5, style: 'clips' },
        { type: 'coax', at: [0.2, 0.33, 0.7], feed: 'left' },
        { type: 'rack', style: 'drums', x: [0.7, 0.7], z: [-0.4, 0.2], y0: 0.4 },
        { type: 'casebag', at: [0, -0.1, 0.4], w: 0.22, h: 0.2, d: 0.26 },
        { type: 'hatch', at: [0.12, 0.62, -0.15], r: 0.26 },
        { type: 'pistolport', at: [0, 0.3, -1.25], ry: PI },
      ],
    },
  },
};
