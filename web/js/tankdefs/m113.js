// M113 (1960): American tracked armoured personnel carrier - aluminium box hull, rear ramp, big cargo hatch over
// the troop compartment (the men stand up in it to fire), commander's cupola with a machine gun
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, runningGear, engineDeck, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

// eleven men on two benches (six seats here); the rear pair stands in the cargo hatch and can fire
const TROOPS = [];
for (const [z, hatch] of [[-1.95, true], [-1.3, true], [-0.65, false]]) {
  for (const sx of [1, -1]) {
    TROOPS.push(hatch
      ? { pos: [sx * 0.78, 0.85, z], eye: [sx * 0.38, 2.28, z + 0.15], ry: -sx * PI / 2, fire: true }
      : { pos: [sx * 0.78, 0.85, z], eye: [sx * 0.72, 1.6, z], ry: -sx * PI / 2, fire: false });
  }
}

export default {
  key: 'm113', name: 'M113', year: 1960,
  palette: { main: 0x4d5639, dark: 0x3a412b, engine: 0x3c3d3a },
  mg: 'm2hb',
  hull: {
    name: 'M113', weight: 12.3, speedCap: 16, eff: 1.0, turn: 1.0, radius: 2.9, ammoMax: 0, mgAmmo: 2000,
    armor: { front: 38, side: 32, rear: 30, top: 20 },
    apc: true,
    turretless: true, arc: PI, elevMin: -0.2, elevMax: 0.6,
    modules: [
      { id: 'engine', u: [-0.8, -0.1], v: [0.2, 0.75], w: [0.4, 0.9] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.45], w: [0.8, 0.98] },
      { id: 'ammo', u: [0.4, 0.8], v: [0.2, 0.5], w: [-0.2, 0.1] },
    ],
    crew: [
      { u: [0.1, 0.8], v: [0.3, 0.95], w: [0.45, 0.9] },
      { u: [-0.8, 0.8], v: [0.25, 0.95], w: [-0.95, 0.4] },
    ],
    seats: {
      driver: { pos: [0.55, 0.9, 1.35], eye: [0.55, 1.62, 1.55], style: 'padded' },
      commander: { pos: [-0.1, 1.1, 0.3], eye: [-0.1, 2.2, 0.35], style: 'padded' },
      gunner: { pos: [-0.1, 1.1, 0.05], eye: [-0.1, 2.25, 0.05], style: 'pan' },
    },
    troops: TROOPS,
    interior: {
      theme: 'us', x: 1.05, floor: 0.45, roof: 1.82, z: [-2.3, 1.95], controls: 'tbar', seatStyle: 'padded', dials: 5, dash: true,
      slits: [{ x: [0.35, 0.75], y: [1.55, 1.65] }],
      walk: [{ x: [-0.35, 0.35], z: [-2.1, 0.3] }],
      props: [
        { type: 'engineguard', rect: [-1.0, 0.45, -0.15, 1.9], y: 1.5, floor: 0.45 },
        { type: 'radio', at: [-0.8, 1.35, 0.25], ry: -PI / 2, box2: true },
        { type: 'crate', at: [0.85, 0.6, 0.2], size: [0.3, 0.22, 0.3] },
        { type: 'crate', at: [0.85, 0.6, -0.15], size: [0.3, 0.22, 0.3] },
        { type: 'extinguisher', at: [0.98, 1.2, -0.3], back: 0.07 },
        { type: 'fuelcell', box: [-1.0, 0.45, -2.28, -0.55, 1.4, -1.95] },
        { type: 'watercan', at: [0.8, 0.58, -2.1] },
        { type: 'lamp', at: [0, 1.78, -1.0] },
      ],
    },
  },
  turret: null,
  gun: null,
  engine: { name: 'Chrysler 75M 209 л.с.', power: 209, weight: 0.7, fuelUse: 0.12 },
  fuel: { name: 'бак 360 л', cap: 360, weight: 0.3 },
  drive: { name: 'погон командирской башенки', speed: 1.4, weight: 0.05, fixed: true },

  models: {
    hull() {
      const P = mats('m113');
      const root = new THREE.Group();
      // box hull: high sloped nose, flat roof, square rear with the ramp
      add(root, hullProfile([[-2.35, 0.42], [1.65, 0.42], [2.45, 0.95], [2.42, 1.35], [1.75, 1.85], [-2.35, 1.85]], 2.1), P.main);
      for (const sx of [-1, 1]) {
        add(root, sizedBox(0.3, 0.05, 4.8), P.main, sx * 1.2, 0.98, 0.0);                                   // track guards
        add(root, U.box, P.dark, sx * 1.36, 0.8, 0.0, 0.02, 0.36, 4.7);                                    // skirts
      }
      add(root, U.box, P.dark, 0, 0.95, -2.37, 1.6, 1.0, 0.04);                                             // ramp
      add(root, U.box, P.dark, 0.35, 1.2, -2.4, 0.5, 0.7, 0.02);                                            // door in the ramp
      add(root, sizedBox(1.3, 0.06, 1.3), P.dark, 0, 1.88, -1.55);                                          // cargo hatch (open)
      add(root, U.box, P.dark, 0, 1.98, -2.3, 1.3, 0.05, 0.4, -0.35, 0, 0);                                  // its lid folded back
      add(root, U.box, P.dark, 0.55, 1.9, 1.4, 0.55, 0.06, 0.55);                                           // driver's hatch
      for (let i = 0; i < 4; i++) add(root, U.box, P.black, 0.35 + i * 0.12, 1.92, 1.72, 0.08, 0.05, 0.03); // periscopes
      add(root, U.box, P.dark, -0.55, 1.87, 1.1, 0.8, 0.03, 0.9);                                           // engine access / louvres
      for (let i = 0; i < 5; i++) add(root, U.box, P.black, -0.55, 1.89, 0.8 + i * 0.14, 0.7, 0.01, 0.04);
      add(root, U.box, P.dark, 0, 1.5, 2.44, 2.0, 0.04, 0.3, 0.55, 0, 0);                                    // trim vane
      for (const sx of [-1, 1]) add(root, U.cylZ, P.glass, sx * 0.85, 1.36, 2.4, 0.06, 0.06, 0.05);
      add(root, U.cylZ, P.rust, -1.02, 1.6, 1.9, 0.06, 0.06, 0.2);                                          // exhaust
      // commander's cupola: vision blocks, the gun sits on its ring
      add(root, U.cyl, P.main, -0.1, 1.98, 0.2, 0.42, 0.26, 0.42);
      for (let i = 0; i < 5; i++) add(root, U.box, P.glass, -0.1 + Math.sin(i * 1.26) * 0.4, 2.0, 0.2 + Math.cos(i * 1.26) * 0.4, 0.12, 0.06, 0.03, 0, i * 1.26, 0);
      add(root, U.cyl, P.dark, 1.0, 2.9, -2.1, 0.01, 1.8, 0.01);                                            // aerial
      const wheels = runningGear(root, P, {
        x: 1.08, w: 0.38, wheels: [1.55, 0.8, 0.05, -0.7, -1.45], wr: 0.3, wy: 0.34,
        idler: [-2.02, 0.48, 0.28], sprocket: [2.02, 0.62, 0.3],
      });
      const bay = engineDeck(root, P, new THREE.Vector3(-0.55, 1.86, 1.2), 0.75, 0.8, P.dark);
      bay.engineTop = 1.8;
      return {
        root, wheels, wheelR: 0.3, ring: null, bay,
        mount: new THREE.Vector3(-0.1, 2.12, 0.2),
        box: new THREE.Box3(new THREE.Vector3(-1.36, 0.05, -2.42), new THREE.Vector3(1.36, 1.9, 2.48)),
        fuelAt: new THREE.Vector3(0, 1.0, -2.6), fuelRot: 0,
        driveAt: new THREE.Vector3(-0.1, 2.12, 0.2),
        ringHole: null,
        mgAt: new THREE.Vector3(0, 0.0, 0.2),
      };
    },
    turret: null,
    gun: null,
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 8, 0.75),
    fuel: (g, P) => FUEL_TYPES.cans(g, P, { n: 4, h: 0.46, d: 0.16, w: 0.3 }),
    drive(g, P) {
      add(g, new THREE.TorusGeometry(0.38, 0.03, 6, 24), P.metal, 0, -0.06, 0, 1, 1, 1, PI / 2, 0, 0);
    },
  },
};
