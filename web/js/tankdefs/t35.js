// Т-35 (1933): Soviet five-turret heavy tank. The main turret (Т-28 type, 76 mm КТ-28) stands on a raised platform
// in the middle; two 45 mm gun turrets (front right, rear left) and two machine-gun turrets (front left, rear right)
// are hull auxiliaries that traverse on their own (hull `aux`). Eight road wheels a side under long skirts.
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, runningGear, returnRollers, engineDeck, hullResult, breech, barrel, prism, scalePlan, keep, bake, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';
import { mgTurret } from './t28.js';

const PLAN = [[0.5, 0.95], [0.9, 0.5], [0.92, -0.45], [0.78, -1.0], [-0.78, -1.0], [-0.92, -0.45], [-0.9, 0.5], [-0.5, 0.95]];
const DECK = 1.75;                 // hull roof
const PLATFORM = 2.08;             // top of the main turret platform

// 45 mm gun turret (Т-26 / БТ-5 type, without the bustle radio)
function gunTurret(P) {
  const g = keep(new THREE.Group());
  add(g, new THREE.CylinderGeometry(0.66, 0.68, 0.06, 22), P.dark, 0, 0.03, 0);
  add(g, new THREE.CylinderGeometry(0.64, 0.64, 0.54, 24), P.main, 0, 0.3, 0);
  add(g, sizedBox(0.8, 0.38, 0.36), P.main, 0, 0.28, -0.76);                                  // bustle
  add(g, U.cyl, P.dark, 0.25, 0.6, -0.15, 0.22, 0.04, 0.22);                                   // hatch
  add(g, U.box, P.main, 0, 0.3, 0.66, 0.42, 0.3, 0.12);                                        // mantlet
  barrel(g, P.main, 0.7, 1.55, 0.04, 0.034, 0.3);                                              // 20-K
  add(g, U.cylZ, P.metal, 0.16, 0.32, 0.75, 0.022, 0.022, 0.2);                                 // coax DT
  bake(g);
  g.userData.markHost = true;
  return g;
}

export default {
  key: 't35', name: 'Т-35', year: 1933,
  palette: { main: 0x4b5832, dark: 0x364025, engine: 0x585e4c },
  mg: 'dt',
  hull: {
    name: 'Т-35 (пятибашенный)', weight: 39, speedCap: 8.0, eff: 1.0, turn: 0.55, radius: 4.6, ammoMax: 96,
    armor: { front: 30, side: 23, rear: 20, top: 12 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.8], w: [-0.9, -0.5] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [-1.0, -0.9] },
      { id: 'ammo', u: [-0.9, -0.3], v: [0.15, 0.6], w: [-0.35, 0.25] },
    ],
    crew: [
      { u: [-0.3, 0.3], v: [0.1, 0.9], w: [0.6, 0.9] },
      { u: [-0.9, 0.9], v: [0.3, 1.0], w: [0.35, 0.8] },
      { u: [-0.9, 0.9], v: [0.3, 1.0], w: [-0.5, -0.1] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.1, 0.35] },
    ],
    seats: { driver: { pos: [0, 0.65, 3.4], eye: [0, 1.5, 3.85] } },
    interior: {
      theme: 'soviet', seatStyle: 'pan', controls: 'levers', ammoStyle: 'horizontal', ammoCal: 0.04, dials: 5,
      x: 1.0, floor: 0.55, roof: 1.7, z: [-2.6, 4.1],
      slits: [{ x: [-0.22, 0.22], y: [1.45, 1.57] }],
      walk: [{ x: [-0.85, 0.85], z: [-2.4, 2.9] }, { x: [-0.3, 0.3], z: [2.9, 3.45] }],
      ammo: { x: [-0.95, -0.5], z: [-0.8, 0.6] },
      props: [
        { type: 'rack', style: 'drums', x: [0.98, 0.98], z: [1.0, 2.8], y0: 1.25 },
        { type: 'rack', style: 'drums', x: [-0.98, -0.98], z: [1.0, 2.8], y0: 1.25 },
        { type: 'rack', style: 'horizontal', x: [0.55, 0.95], z: [-2.4, -1.3], y0: 0.57, h: 0.4, cal: 0.03, rows: 2 },
        { type: 'fuelcell', box: [-0.95, 0.55, -2.55, -0.6, 1.3, -1.6] },
        { type: 'radio', at: [0.9, 1.15, 0.2], ry: -PI / 2, w: 0.5, h: 0.3, box2: true },
        { type: 'battery', at: [0.3, 0.67, -2.4] },
        { type: 'extinguisher', at: [0.96, 1.05, -0.6], back: 0.07 },
        { type: 'extinguisher', at: [-0.96, 1.05, 2.9], back: -0.07 },
        { type: 'shaft', z: [-2.6, -0.8], x: 0.0, w: 0.28, h: 0.2 },
        { type: 'pipe', pts: [[0.98, 1.6, 4.0], [0.98, 1.6, -2.5]], r: 0.014, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Т-35', weight: 3.5, elevMin: -0.1, elevMax: 0.44,
    armor: { front: 20, side: 20, rear: 20, top: 10 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.5, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.8], w: [-0.1, 0.95] },
      { id: 'ammo', u: [-0.8, 0.8], v: [0.15, 0.6], w: [-1.0, -0.6] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.6, 0.4] }],
    seats: {
      gunner: { pos: [0.4, -0.35, 0.25], eye: [0.4, 0.45, 0.5] },
      commander: { pos: [-0.4, -0.3, -0.1], eye: [-0.4, 0.6, 0.1] },
    },
  },
  gun: { name: 'КТ-28 (Т-35)', caliber: '76 мм', weight: 0.7, reload: 5, shellSpeed: 381, pen: 40, dmg: 0.95, disp: 0.005, elevSpeed: 0.26 },
  engine: { name: 'М-17М', power: 500, weight: 1.3, fuelUse: 0.38 },
  fuel: { name: 'кормовые баки 2×220 л', cap: 440, weight: 0.5 },
  drive: { name: 'электропривод башни Т-35', speed: 0.5, weight: 0.2 },

  models: {
    hull() {
      const P = mats('t35');
      const root = new THREE.Group();
      add(root, hullProfile([[-4.7, 0.5], [3.95, 0.5], [4.8, 1.05], [4.75, 1.35], [4.05, DECK], [-4.55, DECK], [-4.8, 1.25]], 2.0), P.main);
      add(root, sizedBox(3.0, 0.5, 7.9), P.main, 0, DECK - 0.25, -0.6);                             // superstructure over the tracks
      add(root, sizedBox(1.9, PLATFORM - DECK, 1.9), P.main, 0, (DECK + PLATFORM) / 2, 0.6);        // main turret platform
      add(root, sizedBox(0.62, 0.36, 0.62), P.main, 0, DECK + 0.1, 3.72);                          // driver's cab
      add(root, U.box, P.dark, 0, DECK + 0.29, 3.68, 0.5, 0.04, 0.45);
      add(root, U.box, P.black, 0, DECK + 0.14, 4.04, 0.3, 0.05, 0.02);
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 1.32, 1.24, -0.2, 0.44, 0.04, 9.0);                            // fenders
        add(root, U.box, P.main, sx * 1.58, 0.86, -0.35, 0.05, 0.62, 7.9);                           // armoured skirts
        for (const z of [2.6, 1.0, -0.6, -2.2]) add(root, U.box, P.black, sx * 1.61, 0.7, z, 0.02, 0.2, 0.4);   // mud chutes
        add(root, U.box, P.dark, sx * 1.32, 1.36, -3.4, 0.34, 0.2, 1.0);                             // tool boxes
      }
      const wheels = runningGear(root, P, {
        x: 1.32, w: 0.52, wheels: [3.1, 2.45, 1.45, 0.8, -0.3, -0.95, -1.95, -2.6], wr: 0.33, wy: 0.36,
        idler: [4.1, 0.78, 0.36], sprocket: [-4.2, 0.72, 0.38],
      });
      returnRollers(root, P, 1.32, [3.0, 1.6, 0.2, -1.2, -2.6], 1.12, 0.07);
      for (const x of [0.8, -0.8]) add(root, U.cylZ, P.glass, x, 1.45, 4.45, 0.1, 0.1, 0.06);         // headlights
      add(root, U.box, P.grille, 0, DECK + 0.01, -4.0, 1.7, 0.02, 0.5);
      add(root, U.cylX, P.rust, 0, 1.2, -4.85, 1.4, 0.12, 0.12);                                     // silencer
      const bay = engineDeck(root, P, new THREE.Vector3(0, DECK, -2.9), 1.5, 1.4);
      bay.engineTop = DECK + 0.1;
      // auxiliary turrets: 45 mm front right / rear left, machine guns front left / rear right (+X = left)
      const aux = [];
      const put = (g, x, z, arc, box) => {
        g.position.set(x, DECK, z);
        root.add(g);
        aux.push({ group: g, arc, speed: 1.0, box });
      };
      const gunBox = new THREE.Box3(new THREE.Vector3(-0.66, 0, -0.95), new THREE.Vector3(0.66, 0.6, 0.72));
      const mgBox = new THREE.Box3(new THREE.Vector3(-0.38, 0, -0.38), new THREE.Vector3(0.38, 0.6, 0.4));
      put(gunTurret(P), -0.75, 2.45, [-2.7, 0.5], gunBox);
      put(mgTurret(P), 0.8, 2.2, [-0.5, 2.7], mgBox);
      put(gunTurret(P), 0.75, -1.3, [0.3, 3.1], gunBox);
      put(mgTurret(P), -0.8, -1.55, [-3.1, -0.3], mgBox);
      return hullResult(root, P, {
        wheels, wheelR: 0.33, bay, ring: { pos: new THREE.Vector3(0, PLATFORM, 0.6), r: 0.86 }, holeR: 0.84,
        box: new THREE.Box3(new THREE.Vector3(-1.62, 0.1, -4.85), new THREE.Vector3(1.62, DECK + 0.1, 4.85)),
        fuelAt: new THREE.Vector3(0, 1.25, -5.1),
        extra: { aux, mgAt: new THREE.Vector3(0.5, 0.02, -0.3) },
      });
    },
    turret() {
      const P = mats('t35');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.86, 0.9, 0.08, 28), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.72, 0.9), P.main, 0, 0.02, 0);
      add(g, sizedBox(1.2, 0.5, 0.4), P.main, 0, 0.33, -1.12);
      add(g, U.sph, P.dark, 0, 0.35, -1.33, 0.09, 0.09, 0.09);
      add(g, U.box, P.dark, 0.35, 0.76, -0.2, 0.5, 0.04, 0.55);
      add(g, U.box, P.dark, -0.35, 0.76, -0.2, 0.5, 0.04, 0.55);
      add(g, U.cyl, P.dark, 0.4, 0.82, 0.35, 0.07, 0.12, 0.07);
      add(g, new THREE.TorusGeometry(1.05, 0.012, 4, 32).rotateX(PI / 2), P.metal, 0, 0.9, -0.2);    // frame antenna
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * PI * 2 + 0.4;
        add(g, U.cyl, P.metal, Math.sin(a) * 0.95, 0.83, Math.cos(a) * 0.95 - 0.2, 0.01, 0.14, 0.01);
      }
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.36, 0.95), sightY: 0.9, mgPos: new THREE.Vector3(-0.35, 0.76, -0.2),
        box: new THREE.Box3(new THREE.Vector3(-0.92, 0, -1.34), new THREE.Vector3(0.92, 0.8, 0.96)),
      };
    },
    gun() {
      const P = mats('t35');
      const g = new THREE.Group();
      add(g, sizedBox(0.62, 0.42, 0.16), P.main, 0, 0, 0.04);
      add(g, U.cylZ, P.main, 0, 0, 0.22, 0.12, 0.12, 0.3);
      barrel(g, P.main, 0.3, 1.2, 0.07, 0.06);
      add(g, U.cylZ, P.metal, 0, 0, 1.52, 0.068, 0.068, 0.06);
      add(g, U.cylZ, P.metal, 0.22, 0.02, 0.2, 0.025, 0.025, 0.2);
      breech(g, P, 0.28, 0.28, 0.6);
      return { group: g, muzzleLen: 1.55 };
    },
    engine: (g, P, E) => ENGINE_TYPES.aeroV12(g, P, E, 1.0),
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [-0.6, 0.6], w: 1.05, h: 0.55, d: 0.36, straps: true }),
    driveR: 0.8,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'radio', at: [0.1, 0.3, -1.15], ry: 0, w: 0.6, h: 0.3, lead: 0.25 },
        { type: 'ready', at: [-0.7, 0.2, -0.2], ry: -PI / 2, n: 6, cal: 0.04, len: 0.6 },
        { type: 'coax', at: [0.22, 0.36, 0.8], feed: 'left' },
        { type: 'rack', style: 'drums', x: [0.75, 0.75], z: [-0.5, 0.2], y0: 0.36 },
      ], poly: scalePlan(PLAN, 0.88), h: 0.68 },
  },
};
