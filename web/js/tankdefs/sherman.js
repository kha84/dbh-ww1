// M4A1 Sherman (1942): American medium tank with a cast rounded hull, 75 mm M3 gun, VVSS bogies (three a side,
// two wheels each, the return roller on top), front drive sprockets under the rounded transmission cover.
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, prism, runningGear, engineDeck, hullResult, breech, barrel, ovalPlan, planBox, scalePlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const PLAN = ovalPlan(0.92, 0.9, 1.15);
const TOP = 1.92;                  // hull roof

// radial engine (Continental R975): a ring of nine cylinders around the crankcase, seen from the rear
function radial(g, P, E) {
  add(g, U.cylZ, E, 0, 0.5, 0, 0.3, 0.3, 0.5);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * PI * 2;
    add(g, U.cyl, E, Math.sin(a) * 0.36, 0.5 + Math.cos(a) * 0.36, 0.05, 0.08, 0.3, 0.08, 0, 0, -a);
    add(g, U.cyl, P.brass, Math.sin(a) * 0.52, 0.5 + Math.cos(a) * 0.52, 0.05, 0.04, 0.05, 0.04, 0, 0, -a);
  }
  add(g, U.cylZ, P.metal, 0, 0.5, 0.45, 0.2, 0.2, 0.4);                  // clutch / fan housing
  add(g, U.box, P.dark, 0, 0.08, 0.1, 0.6, 0.16, 0.9);                    // bearers
  return 1.0;
}

export default {
  key: 'sherman', name: 'Sherman', year: 1942,
  palette: { main: 0x55573a, dark: 0x3f412a, engine: 0x6a6a60 },
  mg: 'm1919',
  hull: {
    name: 'M4A1 Sherman', weight: 23.4, speedCap: 10.8, eff: 1.0, turn: 0.95, radius: 3.1, ammoMax: 90,
    armor: { front: 95, side: 40, rear: 40, top: 18 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.8], w: [-0.95, -0.45] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [0.8, 1.0] },
      { id: 'ammo', u: [-0.95, -0.45], v: [0.3, 0.7], w: [-0.2, 0.3] },
    ],
    crew: [
      { u: [-0.8, -0.2], v: [0.1, 0.75], w: [0.4, 0.8] },
      { u: [0.2, 0.8], v: [0.1, 0.75], w: [0.4, 0.8] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.3, 0.4] },
    ],
    seats: { driver: { pos: [-0.5, 0.72, 1.55], eye: [-0.5, 1.55, 1.8] } },
    interior: {
      theme: 'us', seatStyle: 'pan', controls: 'levers', ammoStyle: 'vertical', ammoCal: 0.04, dials: 6,
      x: 1.05, floor: 0.6, roof: 1.86, z: [-1.3, 2.05],
      slits: [{ x: [-0.72, -0.28], y: [1.52, 1.62] }],
      walk: [{ x: [-0.9, 0.9], z: [-1.1, 1.2] }, { x: [-0.8, -0.2], z: [1.2, 1.6] }],
      ammo: { x: [-1.0, -0.55], z: [-1.2, 0.3] },
      props: [
        { type: 'gearbox', at: [0, 0.95, 1.9], w: 1.1, h: 0.5, d: 0.25 },
        { type: 'shaft', z: [-1.3, 1.75], x: 0.0, w: 0.26, h: 0.3 },
        { type: 'seat', at: [0.5, 0.72, 1.55], style: 'pan' },
        { type: 'ballmg', at: [0.5, 1.45, 2.0] },
        { type: 'rack', style: 'vertical', x: [0.6, 1.0], z: [-1.2, 0.2], y0: 0.62, h: 0.6, cal: 0.04 },
        { type: 'radio', at: [0.0, 1.35, 1.95], ry: PI, w: 0.4, h: 0.22 },
        { type: 'extinguisher', at: [1.0, 1.1, 1.1], back: 0.07 },
        { type: 'battery', at: [-0.4, 0.72, -1.1] },
        { type: 'firstaid', at: [-1.02, 1.4, 0.8], ry: PI / 2 },
        { type: 'pipe', pts: [[1.02, 1.75, 1.95], [1.02, 1.75, -1.2]], r: 0.014, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня M4', weight: 5.5, elevMin: -0.17, elevMax: 0.44,
    armor: { front: 90, side: 55, rear: 55, top: 20 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.75], w: [-0.3, 0.9] },
      { id: 'ammo', u: [-0.7, 0.7], v: [0.1, 0.5], w: [-1.0, -0.7] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.7, 0.35] }],
    seats: {
      gunner: { pos: [-0.42, -0.35, 0.25], eye: [-0.42, 0.48, 0.48] },
      commander: { pos: [-0.4, -0.05, -0.45], eye: [-0.4, 0.86, -0.42] },
    },
  },
  gun: { name: 'M3 75 мм', caliber: '75 мм', weight: 0.9, reload: 4.8, shellSpeed: 560, pen: 95, dmg: 0.85, disp: 0.003, elevSpeed: 0.3 },
  engine: { name: 'Continental R975', power: 400, weight: 0.9, fuelUse: 0.3 },
  fuel: { name: 'бочки 2×170 л', cap: 340, weight: 0.4 },
  drive: { name: 'гидропривод башни M4', speed: 0.75, weight: 0.25 },

  models: {
    hull() {
      const P = mats('sherman');
      const root = new THREE.Group();
      add(root, hullProfile([[-2.85, 0.5], [2.1, 0.5], [2.55, 0.75], [2.55, 1.15], [-2.85, 1.15]], 1.76), P.main);   // lower hull
      add(root, hullProfile([[-2.85, 1.05], [2.45, 1.05], [1.45, TOP], [-2.4, TOP], [-2.9, 1.62]], 2.6), P.main);      // upper hull
      add(root, U.cylX, P.main, 0, 0.92, 2.42, 1.78, 0.36, 0.36);                                      // transmission cover
      for (const sx of [-1, 1]) {
        add(root, U.box, P.main, sx * 0.5, TOP - 0.04, 1.62, 0.52, 0.22, 0.5, -0.4, 0, 0);            // driver / bow gunner hoods
        add(root, U.box, P.dark, sx * 0.5, TOP + 0.02, 1.35, 0.4, 0.04, 0.4);                          // hatches
        add(root, U.box, P.black, sx * 0.5, TOP - 0.02, 1.88, 0.14, 0.06, 0.03);                       // periscopes
        add(root, U.box, P.dark, sx * 1.1, 1.08, 2.25, 0.3, 0.05, 0.4);                                // front fenders
        add(root, U.box, P.dark, sx * 1.12, 1.12, -2.75, 0.3, 0.05, 0.3);
        // VVSS bogies
        for (const z of [1.55, 0.05, -1.45]) {
          add(root, U.box, P.dark, sx * 1.02, 0.44, z, 0.2, 0.34, 0.5);
          add(root, U.box, P.metal, sx * 1.12, 0.56, z, 0.06, 0.24, 0.62);
          add(root, U.cylX, P.dark, sx * 1.1, 0.88, z - 0.1, 0.2, 0.08, 0.08);                          // return roller
          add(root, U.box, P.dark, sx * 1.1, 0.76, z - 0.1, 0.08, 0.22, 0.12);
        }
      }
      const wheels = runningGear(root, P, {
        x: 1.1, w: 0.42, wheels: [1.9, 1.2, 0.4, -0.3, -1.1, -1.8], wr: 0.26, wy: 0.29,
        idler: [2.42, 0.8, 0.28], sprocket: [-2.6, 0.45, 0.28],
        topRun: [[1.45, 0.98], [-0.05, 0.98], [-1.55, 0.98]],
      });
      add(root, U.sph, P.dark, 0.5, 1.5, 2.08, 0.1, 0.1, 0.08);                                        // bow MG ball
      add(root, U.cylZ, P.metal, 0.5, 1.5, 2.28, 0.02, 0.02, 0.34);
      for (const x of [0.9, -0.9]) add(root, U.cylZ, P.glass, x, 1.28, 2.62, 0.09, 0.09, 0.05);        // headlights
      add(root, U.box, P.dark, 0, 1.2, -2.95, 2.0, 0.3, 0.12);                                        // exhaust deflector
      add(root, U.box, P.grille, 0, TOP + 0.01, -2.1, 1.5, 0.02, 0.4);
      const bay = engineDeck(root, P, new THREE.Vector3(0, TOP, -1.25), 1.5, 1.0);
      bay.engineTop = TOP;
      return hullResult(root, P, {
        wheels, wheelR: 0.26, bay, ring: { pos: new THREE.Vector3(0, TOP, 0.4), r: 0.88 }, holeR: 0.86,
        box: new THREE.Box3(new THREE.Vector3(-1.32, 0.1, -2.95), new THREE.Vector3(1.32, TOP + 0.05, 2.78)),
        fuelAt: new THREE.Vector3(0, 1.4, -3.3),
      });
    },
    turret() {
      const P = mats('sherman');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.88, 0.92, 0.08, 28), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.78, 0.8, -0.05), P.main, 0, 0.02, 0);
      const bustle = new THREE.SphereGeometry(0.62, 16, 8, 0, PI * 2, 0, PI / 2);
      bustle.scale(1.25, 0.9, 0.9);
      add(g, bustle, P.main, 0, 0.2, -0.75);                                                             // rounded bustle
      add(g, U.cyl, P.main, -0.4, 0.82, -0.35, 0.3, 0.1, 0.3);                                            // split commander's hatch
      add(g, U.box, P.dark, -0.4, 0.88, -0.35, 0.5, 0.03, 0.04);
      add(g, U.cyl, P.dark, 0.35, 0.84, 0.35, 0.07, 0.12, 0.07);                                          // periscopes
      add(g, U.cyl, P.dark, -0.4, 0.84, 0.3, 0.07, 0.12, 0.07);
      add(g, U.cyl, P.metal, 0.55, 0.9, -0.55, 0.02, 0.3, 0.02);                                          // antenna base
      add(g, U.box, P.dark, 0, 0.18, -1.18, 0.9, 0.12, 0.08);
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.36, 0.9), sightY: 0.95, mgPos: new THREE.Vector3(-0.4, 0.86, -0.35),
        box: new THREE.Box3(new THREE.Vector3(-0.95, 0, -1.25), new THREE.Vector3(0.95, 0.86, 0.92)),
      };
    },
    gun() {
      const P = mats('sherman');
      const g = new THREE.Group();
      add(g, U.box, P.main, 0, 0, 0.06, 0.92, 0.46, 0.14);                                                // M34A1 mantlet
      for (const sx of [-1, 1]) add(g, U.box, P.main, sx * 0.38, 0, 0.18, 0.16, 0.42, 0.14);              // cheeks
      add(g, U.cylZ, P.main, 0, 0, 0.26, 0.12, 0.12, 0.2);
      barrel(g, P.main, 0.34, 2.45, 0.058, 0.05);
      add(g, U.cylZ, P.metal, 0, 0, 2.82, 0.06, 0.06, 0.06);
      add(g, U.cylZ, P.metal, 0.28, 0.02, 0.24, 0.025, 0.025, 0.2);                                        // coax M1919
      breech(g, P, 0.3, 0.3, 0.75);
      return { group: g, muzzleLen: 2.85 };
    },
    engine: radial,
    fuel: (g, P) => FUEL_TYPES.drums(g, P, { r: 0.28, len: 0.9 }),
    driveR: 0.84,
    turretInterior: {
      gunnerStyle: 'wheels', theme: 'us',
      props: [
        { type: 'radio', at: [0, 0.3, -1.1], ry: 0, w: 0.7, h: 0.32, box2: true },
        { type: 'coax', at: [0.28, 0.36, 0.78], feed: 'left' },
        { type: 'ready', at: [0.72, 0.2, -0.3], ry: PI / 2, n: 5, cal: 0.04, len: 0.75 },
        { type: 'rack', style: 'drums', x: [0.72, 0.72], z: [0.1, 0.5], y0: 0.4 },
        { type: 'fan', at: [0.35, 0.66, -0.7], ry: 0.4 },
        { type: 'basket', y: -1.0, r: 0.8 },
      ], poly: scalePlan(PLAN, 0.85), h: 0.72 },
  },
};
