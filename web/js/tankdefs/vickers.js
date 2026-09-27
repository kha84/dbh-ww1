// Vickers 6-ton Mk E Type A (1928): British export light tank with two turrets side by side. The left turret
// carries a water-cooled Vickers machine gun and traverses on its own; the right one here has a 37 mm gun
// (the gun-armed layout of the twin-turret T-26 built from it) so the tank can fight other tanks.
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, runningGear, returnRollers, engineDeck, hullResult, breech, barrel, ovalPlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

const TURRET_GAP = 0.92;           // the left (MG) turret stands this far to the left of the right (gun) turret

// one of the two small turrets: riveted drum with a flat front plate, a split roof hatch and vision slits
function smallTurret(g, P) {
  add(g, new THREE.CylinderGeometry(0.42, 0.45, 0.06, 18), P.dark, 0, 0.03, 0);
  add(g, new THREE.CylinderGeometry(0.4, 0.44, 0.56, 18), P.main, 0, 0.32, 0);
  add(g, sizedBox(0.52, 0.44, 0.12), P.main, 0, 0.32, 0.38);
  add(g, U.box, P.dark, 0.1, 0.61, -0.05, 0.36, 0.04, 0.4);
  add(g, U.box, P.dark, -0.12, 0.61, -0.05, 0.08, 0.05, 0.4);
  for (const a of [1.2, -1.2, 2.6]) add(g, U.box, P.black, Math.sin(a) * 0.42, 0.44, Math.cos(a) * 0.42, 0.1, 0.02, 0.02, 0, a, 0);
}

export default {
  key: 'vickers', name: 'Vickers 6-ton', year: 1928,
  palette: { main: 0x5c6440, dark: 0x40472c, engine: 0x55584a },
  mg: 'vickers',
  hull: {
    name: 'Vickers 6-ton (двухбашенный)', weight: 6.0, speedCap: 9.7, eff: 1.0, turn: 1.15, radius: 2.5, ammoMax: 94,
    armor: { front: 13, side: 13, rear: 13, top: 5 },
    modules: [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.8], w: [-0.95, -0.35] },
      { id: 'transmission', u: [-0.7, 0.7], v: [0.1, 0.5], w: [0.78, 1.0] },
      { id: 'ammo', u: [0.3, 0.9], v: [0.15, 0.6], w: [-0.1, 0.4] },
    ],
    crew: [
      { u: [-0.8, -0.2], v: [0.1, 0.8], w: [0.4, 0.78] },
      { u: [-0.7, 0.7], v: [0.15, 1.0], w: [-0.3, 0.4] },
    ],
    seats: { driver: { pos: [-0.46, 0.55, 1.05], eye: [-0.46, 1.2, 1.3], style: 'pan' } },
    interior: {
      theme: 'british', x: 0.8, floor: 0.45, roof: 1.4, z: [-0.75, 1.5], controls: 'levers', seatStyle: 'pan', dials: 3,
      slits: [{ x: [-0.68, -0.24], y: [1.14, 1.26] }],
      walk: [{ x: [-0.65, 0.65], z: [-0.55, 0.8] }, { x: [-0.72, -0.2], z: [0.8, 1.15] }],
      ammo: { x: [0.4, 0.78], z: [-0.2, 0.7] }, ammoStyle: 'horizontal', ammoCal: 0.02,
      props: [
        { type: 'gearbox', at: [0, 0.72, 1.45], w: 0.9, h: 0.42, d: 0.35 },
        { type: 'shaft', z: [-0.75, 1.28], x: 0.1, w: 0.22, h: 0.16 },
        { type: 'rack', style: 'drums', x: [0.78, 0.78], z: [0.75, 1.35], y0: 1.1 },
        { type: 'crate', at: [0.6, 0.57, -0.55], size: [0.3, 0.24, 0.3] },
        { type: 'crate', at: [0.6, 0.57, 0.95], size: [0.3, 0.24, 0.22] },
        { type: 'extinguisher', at: [-0.75, 0.9, -0.5], back: 0.07 },
        { type: 'battery', at: [-0.5, 0.57, -0.55] },
        { type: 'pipe', pts: [[-0.78, 1.25, 1.35], [-0.78, 1.25, -0.7]], r: 0.012, mat: 'cable' },
      ],
    },
  },
  turret: {
    name: 'Башни Vickers (спаренные)', weight: 0.8, elevMin: -0.15, elevMax: 0.4,
    armor: { front: 13, side: 13, rear: 13, top: 5 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.5, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.8], w: [0.0, 1.0] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.85], w: [-0.6, 0.5] }],
    seats: {
      gunner: { pos: [0, -0.42, -0.05], eye: [0, 0.4, 0.16], style: 'pan' },
      commander: { pos: [0, -0.42, -0.05], eye: [0, 0.4, 0.16], style: 'pan', in: 'second' },
    },
  },
  gun: { name: '37-мм пушка Гочкиса', caliber: '37 мм', weight: 0.1, reload: 2.6, shellSpeed: 390, pen: 26, dmg: 0.42, disp: 0.005, elevSpeed: 0.32 },
  engine: { name: 'Armstrong Siddeley Puma', power: 92, weight: 0.45, fuelUse: 0.1 },
  fuel: { name: 'кормовой бак 150 л', cap: 150, weight: 0.15 },
  drive: { name: 'поворотный механизм Vickers', speed: 0.75, weight: 0.1 },

  models: {
    hull() {
      const P = mats('vickers');
      const root = new THREE.Group();
      add(root, hullProfile([[-2.25, 0.4], [1.95, 0.4], [2.35, 0.75], [2.32, 0.96], [1.72, 1.14], [1.62, 1.42], [-2.1, 1.42], [-2.35, 1.1]], 1.62), P.main);
      add(root, U.box, P.main, 0, 1.24, -0.28, 2.3, 0.36, 3.64);                                     // superstructure over the tracks
      add(root, U.cylX, P.main, 0, 0.95, 1.95, 1.6, 0.22, 0.22);                                     // rounded transmission cover
      for (const sx of [-1, 1]) {
        add(root, U.box, P.dark, sx * 1.04, 1.04, 0.05, 0.46, 0.04, 4.6);                            // fenders
        for (const z of [1.1, -1.05]) {                                                             // bogie units with leaf springs
          add(root, U.box, P.dark, sx * 1.2, 0.36, z, 0.1, 0.22, 1.05);
          add(root, U.box, P.metal, sx * 1.22, 0.55, z, 0.08, 0.05, 0.95);
          add(root, U.box, P.metal, sx * 1.22, 0.6, z, 0.08, 0.04, 0.7);
        }
        add(root, U.box, P.dark, sx * 1.1, 1.14, -1.3, 0.2, 0.16, 0.9);                              // stowage
      }
      const wheels = runningGear(root, P, {
        x: 1.04, w: 0.28, wheels: [1.45, 1.1, 0.75, 0.4, -0.35, -0.7, -1.05, -1.4], wr: 0.17, wy: 0.19,
        idler: [2.1, 0.58, 0.27], sprocket: [-2.12, 0.55, 0.25],
      });
      returnRollers(root, P, 1.04, [1.2, 0.35, -0.5, -1.35], 0.76, 0.06);
      add(root, U.box, P.dark, -0.46, 1.43, 1.2, 0.46, 0.04, 0.42);                                   // driver hatch
      add(root, U.box, P.black, -0.46, 1.3, 1.62, 0.3, 0.03, 0.02);
      add(root, U.box, P.grille, 0, 1.43, -1.35, 1.2, 0.02, 0.6);                                     // air-cooled engine louvres
      add(root, U.cylX, P.rust, 0.6, 1.2, -2.35, 0.6, 0.1, 0.1);                                      // silencer
      for (const x of [0.55, -0.55]) add(root, U.cylZ, P.glass, x, 1.2, 2.18, 0.07, 0.07, 0.05);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.42, -1.35), 1.2, 1.0);
      bay.engineTop = 1.5;
      return hullResult(root, P, {
        wheels, wheelR: 0.17, bay, ring: { pos: new THREE.Vector3(-0.46, 1.42, 0.35), r: 0.44 }, holeR: 0.42,
        box: new THREE.Box3(new THREE.Vector3(-1.25, 0.1, -2.4), new THREE.Vector3(1.25, 1.48, 2.4)),
        fuelAt: new THREE.Vector3(0, 1.0, -2.52),
      });
    },
    turret() {
      const P = mats('vickers');
      const g = new THREE.Group();
      smallTurret(g, P);
      // the second turret: stays put while the gun turret traverses, turns towards the machine-gun target
      const sg = new THREE.Group();
      smallTurret(sg, P);
      add(sg, U.box, P.dark, 0, 0.3, 0.46, 0.2, 0.2, 0.08);                    // MG mount
      return {
        group: g, gunPos: new THREE.Vector3(0.02, 0.32, 0.45), sightY: 0.62, mgPos: new THREE.Vector3(0, 0.0, 0.42),
        box: new THREE.Box3(new THREE.Vector3(-0.45, 0, -0.45), new THREE.Vector3(0.45, 0.64, 0.46)),
        second: {
          group: sg, pos: new THREE.Vector3(TURRET_GAP, 0, 0), arc: [-0.5, 2.7], speed: 1.1,
          box: new THREE.Box3(new THREE.Vector3(-0.45, 0, -0.45), new THREE.Vector3(0.45, 0.64, 0.5)),
        },
      };
    },
    gun() {
      const P = mats('vickers');
      const g = new THREE.Group();
      add(g, U.box, P.dark, 0, 0, 0.02, 0.22, 0.22, 0.1);
      barrel(g, P.metal, 0.05, 0.62, 0.042, 0.035);
      add(g, U.cylZ, P.dark, 0, -0.07, 0.25, 0.03, 0.03, 0.34);
      breech(g, P, 0.1, 0.12, 0.35);
      return { group: g, muzzleLen: 0.68 };
    },
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.8),
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [0], w: 1.3, h: 0.4, d: 0.3, straps: true }),
    driveR: 0.4,
    turretInterior: {
      poly: ovalPlan(0.38, 0.38, 0.38, 14), h: 0.58, gunnerStyle: 'shoulder',
      props: [
        { type: 'ready', at: [0.3, 0.16, -0.1], ry: PI / 2, n: 5, cal: 0.02, len: 0.25 },
        { type: 'casebag', at: [0, -0.02, 0.16], w: 0.14, h: 0.12, d: 0.16 },
      ],
      second: {
        poly: ovalPlan(0.38, 0.38, 0.38, 14), h: 0.58,
        props: [
          { type: 'seat', at: [0, -0.42, -0.05], style: 'pan' },
          { type: 'sidemg', at: [0, 0.3, 0.3] },
          { type: 'rack', style: 'drums', x: [-0.34, -0.34], z: [-0.2, 0.15], y0: 0.2 },
          { type: 'crate', at: [0.25, -0.1, -0.15], size: [0.2, 0.16, 0.24] },
        ],
      },
    },
  },
};
