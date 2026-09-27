// Char B1 bis (1937): French heavy tank. The tracks run all around the tall hull under armoured skirts;
// a 75 mm howitzer sits low in the right of the hull front (laid by the driver, here only a fixture),
// the 47 mm SA35 is in the one-man APX4 turret.
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, loopTrack, engineDeck, hullResult, breech, barrel, ovalPlan, cupola, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

let TRACK = null;
const track = () => TRACK || (TRACK = loopTrack(s => {
  s.moveTo(-2.55, 0.14);
  s.lineTo(2.2, 0.14);
  s.quadraticCurveTo(2.95, 0.2, 3.12, 0.85);
  s.quadraticCurveTo(3.22, 1.5, 2.9, 1.82);
  s.quadraticCurveTo(2.7, 1.95, 2.4, 1.95);
  s.lineTo(-2.7, 1.95);
  s.quadraticCurveTo(-3.15, 1.95, -3.2, 1.45);
  s.lineTo(-3.18, 0.95);
  s.quadraticCurveTo(-3.1, 0.42, -2.55, 0.14);
}, 0.46, 0.42, 0.12));

export default {
  key: 'charb1', name: 'Char B1 bis', year: 1937,
  palette: { main: 0x6a6d4c, dark: 0x4a4c35, engine: 0x585a4c },
  mg: 'reibel',
  hull: {
    name: 'Char B1 bis', weight: 26.4, speedCap: 7.8, eff: 1.0, turn: 0.7, radius: 3.4, ammoMax: 62,
    armor: { front: 60, side: 55, rear: 55, top: 25 },
    modules: [
      { id: 'engine', u: [-0.55, 0.55], v: [0.15, 0.7], w: [-0.85, -0.3] },
      { id: 'transmission', u: [-0.6, 0.6], v: [0.1, 0.5], w: [-1.0, -0.85] },
      { id: 'ammo', u: [-0.6, -0.1], v: [0.15, 0.55], w: [0.2, 0.7] },
    ],
    crew: [
      { u: [-0.5, 0.5], v: [0.25, 0.9], w: [0.45, 0.85] },
      { u: [-0.5, 0.5], v: [0.2, 1.0], w: [-0.3, 0.45] },
    ],
    seats: { driver: { pos: [0.3, 1.0, 1.95], eye: [0.3, 1.72, 2.3], style: 'pan' } },
    interior: {
      theme: 'french', x: 0.7, floor: 0.6, roof: 2.06, z: [-0.8, 2.6], controls: 'wheel', seatStyle: 'pan', dials: 5,
      slits: [{ x: [0.12, 0.5], y: [1.66, 1.78] }],
      walk: [{ x: [-0.55, 0.55], z: [-0.65, 1.55] }],
      ammo: { x: [-0.66, -0.2], z: [1.1, 1.75] }, ammoStyle: 'vertical', ammoCal: 0.04,
      props: [
        { type: 'crate', at: [-0.32, 1.28, 2.1], size: [0.34, 0.34, 0.8] },            // 75 mm howitzer breech
        { type: 'pipe', pts: [[-0.32, 1.28, 2.5], [-0.32, 1.28, 1.7]], r: 0.06, mat: 'dark' },
        { type: 'rack', style: 'vertical', x: [-0.68, -0.3], z: [-0.6, 0.5], y0: 0.62, h: 0.55, cal: 0.04, main: true },
        { type: 'radio', at: [0.5, 1.2, -0.55], ry: -PI / 2, w: 0.5, h: 0.32, box2: true },
        { type: 'seat', at: [0.42, 0.95, -0.3], ry: -PI / 2, style: 'pan' },
        { type: 'rack', style: 'drums', x: [0.68, 0.68], z: [0.3, 1.3], y0: 1.55 },
        { type: 'fuelcell', box: [0.4, 0.6, 0.2, 0.7, 1.3, 1.1] },
        { type: 'panel', at: [0.3, 1.45, 2.54], ry: PI, w: 0.36, dials: 4 },
        { type: 'extinguisher', at: [-0.64, 1.1, 0.9], back: -0.07 },
        { type: 'battery', at: [0.0, 0.72, -0.62] },
        { type: 'pipe', pts: [[0.68, 1.9, 2.4], [0.68, 1.9, -0.7], [-0.6, 1.9, -0.75]], r: 0.014, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня APX4', weight: 2.5, elevMin: -0.3, elevMax: 0.3,
    armor: { front: 56, side: 46, rear: 46, top: 30 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.8], w: [-0.1, 1.0] },
      { id: 'ammo', u: [-0.8, -0.4], v: [0.1, 0.5], w: [-0.6, 0.0] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.7, 0.4] }],
    seats: { commander: { pos: [0, -0.62, -0.12], eye: [0, 0.5, 0.12], style: 'pan' } },
  },
  gun: { name: '47-мм SA35', caliber: '47 мм', weight: 0.4, reload: 3.6, shellSpeed: 660, pen: 62, dmg: 0.62, disp: 0.0035, elevSpeed: 0.25 },
  engine: { name: 'Renault 307 л.с.', power: 307, weight: 1.3, fuelUse: 0.28 },
  fuel: { name: 'кормовые баки 2×120 л', cap: 240, weight: 0.4 },
  drive: { name: 'электропривод башни APX4', speed: 0.45, weight: 0.2 },

  models: {
    hull() {
      const P = mats('charb1');
      const T = track();
      const root = new THREE.Group();
      add(root, hullProfile([[-3.05, 0.5], [2.35, 0.5], [3.05, 1.05], [3.02, 1.55], [2.62, 1.98], [2.2, 2.1], [-2.85, 2.1], [-3.18, 1.72], [-3.22, 0.9]], 1.52), P.main);
      for (const sx of [-1, 1]) {
        add(root, T.frame, P.dark, sx > 0 ? 1.23 : -0.77, 0, 0);
        add(root, T.belt, T.beltMat, sx > 0 ? 1.21 : -0.79, 0, 0);
        // armoured skirt over the suspension with the mud chutes
        add(root, sizedBox(0.08, 1.02, 4.7), P.main, sx * 1.25, 1.0, -0.15);
        for (let z = -2.2; z < 2.2; z += 0.62) add(root, U.box, P.black, sx * 1.3, 0.6, z, 0.02, 0.18, 0.28);
        add(root, U.box, P.dark, sx * 1.29, 1.5, -0.15, 0.02, 0.05, 4.7);
        add(root, U.box, P.main, sx * 1.02, 2.0, -0.2, 0.5, 0.06, 5.6);                              // track guards
      }
      add(root, U.box, P.grille, 0.77, 1.55, -1.6, 0.04, 0.55, 1.2);                                  // big louvre on the left side
      // 75 mm howitzer low in the right of the front, driver's visor block on the left
      add(root, U.box, P.dark, -0.36, 1.22, 2.98, 0.38, 0.4, 0.12);
      barrel(root, P.metal, 3.0, 0.62, 0.07, 0.065, 1.22, -0.36);
      add(root, U.box, P.main, 0.34, 2.08, 2.35, 0.46, 0.22, 0.45);
      add(root, U.box, P.black, 0.34, 2.1, 2.58, 0.32, 0.04, 0.02);
      add(root, U.cylZ, P.glass, -0.55, 1.62, 2.9, 0.08, 0.08, 0.05);
      add(root, U.box, P.dark, 0, 1.7, -3.05, 1.2, 0.5, 0.06);                                       // rear door
      add(root, U.cylX, P.rust, 0, 2.1, -2.8, 0.9, 0.08, 0.08);                                        // exhaust
      const bay = engineDeck(root, P, new THREE.Vector3(0, 2.1, -1.9), 1.2, 1.4);
      bay.engineTop = 1.55;
      return hullResult(root, P, {
        wheels: [], wheelR: 1, bay, ring: { pos: new THREE.Vector3(0, 2.1, 0.55), r: 0.62 }, holeR: 0.6,
        box: new THREE.Box3(new THREE.Vector3(-1.3, 0.1, -3.45), new THREE.Vector3(1.3, 2.16, 3.28)),
        fuelAt: new THREE.Vector3(0, 1.1, -3.38),
      });
    },
    turret() {
      const P = mats('charb1');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.62, 0.64, 0.06, 20), P.dark, 0, 0.03, 0);
      add(g, new THREE.CylinderGeometry(0.55, 0.64, 0.68, 8), P.main, 0, 0.37, 0);                    // cast APX4
      add(g, U.box, P.main, 0, 0.36, 0.56, 0.5, 0.42, 0.18);                                          // gun mantlet housing
      cupola(g, P, 0, -0.1, 0.24, 0.71, [0.76, 0.84], 0.92);
      add(g, U.hemi, P.main, 0, 0.92, -0.1, 0.24, 0.1, 0.24);
      add(g, U.box, P.dark, 0, 0.35, -0.62, 0.36, 0.4, 0.05);                                         // rear hatch
      for (const a of [1.3, -1.3]) add(g, U.box, P.black, Math.sin(a) * 0.6, 0.45, Math.cos(a) * 0.6, 0.12, 0.02, 0.02, 0, a, 0);
      add(g, U.cylZ, P.dark, -0.16, 0.34, 0.66, 0.03, 0.03, 0.08);                                     // coax port
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.36, 0.64), sightY: 0.8, mgPos: new THREE.Vector3(0.3, 0.72, -0.35),
        box: new THREE.Box3(new THREE.Vector3(-0.64, 0, -0.66), new THREE.Vector3(0.64, 1.0, 0.68)),
      };
    },
    gun() {
      const P = mats('charb1');
      const g = new THREE.Group();
      add(g, U.box, P.dark, 0, 0, 0.02, 0.28, 0.26, 0.12);
      barrel(g, P.metal, 0.06, 1.62, 0.05, 0.036);
      add(g, U.cylZ, P.metal, 0, 0, 1.72, 0.042, 0.042, 0.06);
      add(g, U.cylZ, P.dark, 0, -0.08, 0.3, 0.035, 0.035, 0.45);
      breech(g, P, 0.16, 0.18, 0.5);
      return { group: g, muzzleLen: 1.75 };
    },
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 6, 1.0),
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [-0.45, 0.45], w: 0.78, h: 0.44, d: 0.28, straps: true }),
    driveR: 0.56,
    turretInterior: {
      poly: ovalPlan(0.54, 0.54, 0.54, 8), h: 0.66, commanderStyle: 'none',
      cupola: { x: 0, z: -0.1, r: 0.21, y0: 0.66, band: [0.74, 0.84], top: 0.9, blocks: 6 },
      props: [
        { type: 'gunner', eye: [0, 0.5, 0.12], style: 'wheels' },
        { type: 'ready', at: [0.44, 0.22, -0.05], ry: PI / 2, n: 5, cal: 0.024, len: 0.4 },
        { type: 'ready', at: [-0.44, 0.22, -0.05], ry: -PI / 2, n: 5, cal: 0.024, len: 0.4 },
        { type: 'coax', at: [-0.16, 0.34, 0.5], feed: 'right' },
        { type: 'casebag', at: [0, -0.05, 0.25], w: 0.18, h: 0.16, d: 0.22 },
        { type: 'pistolport', at: [0, 0.35, -0.56], ry: PI },
      ],
    },
  },
};
