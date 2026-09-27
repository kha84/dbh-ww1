// Т-28 (1933): Soviet three-turret medium tank. The main turret carries the short 76 mm КТ-28; two small
// machine-gun turrets sit on the front deck either side of the driver's cab (hull auxiliaries: they traverse
// on their own towards the target, see hull `aux`). Twelve small road wheels a side behind armoured skirts.
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, runningGear, returnRollers, engineDeck, hullResult, breech, barrel, ovalPlan, prism, planBox, scalePlan, keep, bake, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const PLAN = [[0.5, 0.95], [0.9, 0.5], [0.92, -0.45], [0.78, -1.0], [-0.78, -1.0], [-0.92, -0.45], [-0.9, 0.5], [-0.5, 0.95]];

// small machine-gun turret with a DT in a ball mount (origin: turret base centre, +Z = its front)
export function mgTurret(P, r = 0.36, h = 0.5) {
  const g = keep(new THREE.Group());
  add(g, new THREE.CylinderGeometry(r + 0.02, r + 0.04, 0.06, 18), P.dark, 0, 0.03, 0);
  add(g, new THREE.CylinderGeometry(r, r + 0.02, h, 18), P.main, 0, h / 2 + 0.03, 0);
  add(g, U.cyl, P.dark, 0, h + 0.06, -0.04, r * 0.7, 0.05, r * 0.7);                           // hatch
  add(g, U.sph, P.dark, 0, h * 0.55, r - 0.02, 0.1, 0.1, 0.1);                                 // ball mount
  add(g, U.cylZ, P.metal, 0, h * 0.55, r + 0.2, 0.025, 0.025, 0.4);                            // DT barrel
  for (const a of [1.3, -1.3]) add(g, U.box, P.black, Math.sin(a) * r, h * 0.7, Math.cos(a) * r, 0.1, 0.02, 0.02, 0, a, 0);
  bake(g);
  g.userData.markHost = true;
  return g;
}

export default {
  key: 't28', name: 'Т-28', year: 1933,
  palette: { main: 0x4d5a33, dark: 0x384226, engine: 0x585e4c },
  mg: 'dt',
  hull: {
    name: 'Т-28 (трёхбашенный)', weight: 22.5, speedCap: 10.3, eff: 1.0, turn: 0.8, radius: 3.6, ammoMax: 70,
    armor: { front: 30, side: 20, rear: 20, top: 12 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.8], w: [-0.9, -0.4] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [-1.0, -0.9] },
      { id: 'ammo', u: [-0.9, -0.4], v: [0.15, 0.6], w: [-0.3, 0.25] },
    ],
    crew: [
      { u: [-0.3, 0.3], v: [0.1, 0.9], w: [0.5, 0.85] },
      { u: [-0.9, 0.9], v: [0.3, 1.0], w: [0.55, 0.85] },
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.3, 0.35] },
    ],
    seats: { driver: { pos: [0, 0.6, 2.15], eye: [0, 1.36, 2.55] } },
    interior: {
      theme: 'soviet', seatStyle: 'pan', controls: 'levers', ammoStyle: 'horizontal', ammoCal: 0.04, dials: 4,
      x: 0.9, floor: 0.5, roof: 1.55, z: [-1.6, 2.85],
      slits: [{ x: [-0.22, 0.22], y: [1.3, 1.42] }],
      walk: [{ x: [-0.75, 0.75], z: [-1.4, 1.6] }, { x: [-0.3, 0.3], z: [1.6, 2.2] }],
      ammo: { x: [-0.88, -0.45], z: [-1.4, -0.2] },
      props: [
        { type: 'seat', at: [0.6, 0.62, 1.9], style: 'pan' },
        { type: 'seat', at: [-0.6, 0.62, 1.9], style: 'pan' },
        { type: 'ballmg', at: [0.6, 1.25, 2.5], drum: true },
        { type: 'ballmg', at: [-0.6, 1.25, 2.5], drum: true },
        { type: 'rack', style: 'drums', x: [0.88, 0.88], z: [0.4, 1.4], y0: 1.1 },
        { type: 'rack', style: 'drums', x: [-0.88, -0.88], z: [0.4, 1.4], y0: 1.1 },
        { type: 'fuelcell', box: [0.55, 0.5, -1.55, 0.88, 1.2, -0.7] },
        { type: 'radio', at: [0.8, 1.05, -0.2], ry: -PI / 2, w: 0.45, h: 0.28, box2: true },
        { type: 'battery', at: [0.4, 0.62, -1.4] },
        { type: 'extinguisher', at: [0.86, 0.95, 0.2], back: 0.07 },
        { type: 'shaft', z: [-1.6, 0.0], x: 0.0, w: 0.26, h: 0.18 },
        { type: 'pipe', pts: [[0.88, 1.45, 2.7], [0.88, 1.45, -1.5]], r: 0.014, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башня Т-28', weight: 3.5, elevMin: -0.1, elevMax: 0.44,
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
  gun: { name: 'КТ-28', caliber: '76 мм', weight: 0.7, reload: 5, shellSpeed: 381, pen: 40, dmg: 0.95, disp: 0.005, elevSpeed: 0.26 },
  engine: { name: 'М-17Т', power: 450, weight: 1.1, fuelUse: 0.3 },
  fuel: { name: 'кормовые баки 2×160 л', cap: 320, weight: 0.4 },
  drive: { name: 'электропривод башни Т-28', speed: 0.55, weight: 0.2 },

  models: {
    hull() {
      const P = mats('t28');
      const root = new THREE.Group();
      add(root, hullProfile([[-3.55, 0.45], [2.95, 0.45], [3.6, 0.95], [3.55, 1.2], [2.95, 1.45], [-3.35, 1.45], [-3.6, 1.1]], 1.9), P.main);
      add(root, sizedBox(2.72, 0.46, 5.15), P.main, 0, 1.37, -0.72);                                // superstructure over the tracks
      add(root, sizedBox(0.62, 0.36, 0.7), P.main, 0, 1.62, 2.45);                                 // driver's cab
      add(root, U.box, P.dark, 0, 1.81, 2.4, 0.5, 0.04, 0.5);                                       // cab hatch
      add(root, U.box, P.black, 0, 1.66, 2.81, 0.3, 0.05, 0.02);                                    // driver's visor
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 1.2, 1.13, 0.0, 0.5, 0.04, 6.6);                              // fenders
        add(root, U.box, P.main, sx * 1.42, 0.8, -0.1, 0.05, 0.5, 5.7);                             // armoured skirts
        for (const z of [2.0, 0.8, -0.4, -1.6]) add(root, U.box, P.black, sx * 1.45, 0.68, z, 0.02, 0.16, 0.34);   // mud chutes
        add(root, U.box, P.dark, sx * 1.2, 1.24, 1.4, 0.3, 0.18, 0.8);                               // tool boxes
      }
      const wheels = runningGear(root, P, {
        x: 1.2, w: 0.38, wheels: [2.55, 2.1, 1.65, 1.2, 0.75, 0.3, -0.15, -0.6, -1.05, -1.5, -1.95, -2.4], wr: 0.22, wy: 0.24,
        idler: [3.22, 0.66, 0.3], sprocket: [-3.25, 0.62, 0.32],
      });
      returnRollers(root, P, 1.2, [2.2, 0.9, -0.4, -1.7], 0.96, 0.06);
      for (const x of [0.75, -0.75]) add(root, U.cylZ, P.glass, x, 1.28, 3.3, 0.09, 0.09, 0.06);   // headlights
      add(root, U.box, P.grille, 0, 1.61, -2.95, 1.5, 0.02, 0.4);
      add(root, U.cylX, P.rust, 0, 1.05, -3.68, 1.2, 0.1, 0.1);                                     // silencer
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.6, -2.0), 1.4, 1.3);
      bay.engineTop = 1.7;
      // front machine-gun turrets either side of the cab
      const aux = [];
      for (const sx of [1, -1]) {
        const g = mgTurret(P);
        g.position.set(sx * 0.68, 1.45, 2.3);
        root.add(g);
        aux.push({ group: g, arc: sx > 0 ? [-0.6, 2.4] : [-2.4, 0.6], speed: 1.2,
          box: new THREE.Box3(new THREE.Vector3(-0.38, 0, -0.38), new THREE.Vector3(0.38, 0.6, 0.4)) });
      }
      return hullResult(root, P, {
        wheels, wheelR: 0.22, bay, ring: { pos: new THREE.Vector3(0, 1.6, 0.3), r: 0.86 }, holeR: 0.84,
        box: new THREE.Box3(new THREE.Vector3(-1.46, 0.1, -3.62), new THREE.Vector3(1.46, 1.62, 3.62)),
        fuelAt: new THREE.Vector3(0, 1.1, -3.9),
        extra: { aux, mgAt: new THREE.Vector3(0.5, 0.02, -0.3) },
      });
    },
    turret() {
      const P = mats('t28');
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(0.86, 0.9, 0.08, 28), P.dark, 0, 0.02, 0);
      add(g, prism(PLAN, 0.72, 0.9), P.main, 0, 0.02, 0);
      add(g, sizedBox(1.2, 0.5, 0.4), P.main, 0, 0.33, -1.12);                                        // bustle (radio, rear MG)
      add(g, U.sph, P.dark, 0, 0.35, -1.33, 0.09, 0.09, 0.09);                                       // rear ball MG
      add(g, U.box, P.dark, 0.35, 0.76, -0.2, 0.5, 0.04, 0.55);                                      // hatches
      add(g, U.box, P.dark, -0.35, 0.76, -0.2, 0.5, 0.04, 0.55);
      add(g, U.cyl, P.dark, 0.4, 0.82, 0.35, 0.07, 0.12, 0.07);                                      // ПТ-1 periscope
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
      const P = mats('t28');
      const g = new THREE.Group();
      add(g, sizedBox(0.62, 0.42, 0.16), P.main, 0, 0, 0.04);                                         // mantlet
      add(g, U.cylZ, P.main, 0, 0, 0.22, 0.12, 0.12, 0.3);                                           // recoil cylinder cover
      barrel(g, P.main, 0.3, 1.2, 0.07, 0.06);
      add(g, U.cylZ, P.metal, 0, 0, 1.52, 0.068, 0.068, 0.06);
      add(g, U.cylZ, P.metal, 0.22, 0.02, 0.2, 0.025, 0.025, 0.2);                                   // coax DT
      breech(g, P, 0.28, 0.28, 0.6);
      return { group: g, muzzleLen: 1.55 };
    },
    engine: (g, P, E) => ENGINE_TYPES.aeroV12(g, P, E, 0.95),
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [-0.55, 0.55], w: 0.95, h: 0.5, d: 0.34, straps: true }),
    driveR: 0.8,
    turretInterior: {
      gunnerStyle: 'wheels',
      props: [
        { type: 'radio', at: [0.1, 0.3, -1.15], ry: 0, w: 0.6, h: 0.3, lead: 0.25 },
        { type: 'ready', at: [-0.7, 0.2, -0.2], ry: -PI / 2, n: 6, cal: 0.04, len: 0.6 },
        { type: 'coax', at: [0.22, 0.36, 0.8], feed: 'left' },
        { type: 'rack', style: 'drums', x: [0.75, 0.75], z: [-0.5, 0.2], y0: 0.36 },
        { type: 'casebag', at: [0, -0.05, 0.4], w: 0.2, h: 0.18, d: 0.24 },
      ], poly: scalePlan(PLAN, 0.88), h: 0.68 },
  },
};
