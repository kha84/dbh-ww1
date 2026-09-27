// Renault FT (1917): French light tank, the first with a fully rotating turret; 37 mm Puteaux SA 18,
// a two-man crew (driver in the hull, the commander loads, aims and fires the gun in the turret)
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, sizedBox, link, runningGear, engineDeck, hullResult, breech, barrel, ovalPlan, ENGINE_TYPES, FUEL_TYPES } from '../modelkit.js';

export default {
  key: 'ft', name: 'Renault FT', year: 1917,
  palette: { main: 0x6d6a45, dark: 0x4e4c33, engine: 0x46443a, riveted: true },
  mg: 'hotchkiss',
  hull: {
    name: 'Renault FT', weight: 5.6, speedCap: 4.2, eff: 0.8, turn: 1.2, radius: 2.3, ammoMax: 237,
    armor: { front: 22, side: 16, rear: 16, top: 8 },
    modules: [
      { id: 'engine', u: [-0.55, 0.55], v: [0.2, 0.8], w: [-0.75, -0.25] },
      { id: 'transmission', u: [-0.6, 0.6], v: [0.15, 0.55], w: [-0.95, -0.75] },
      { id: 'ammo', u: [-0.45, 0.45], v: [0.25, 0.55], w: [-0.2, 0.1] },
    ],
    crew: [
      { u: [-0.4, 0.4], v: [0.25, 0.85], w: [0.3, 0.75] },
      { u: [-0.45, 0.45], v: [0.25, 1.0], w: [-0.25, 0.3] },
    ],
    seats: { driver: { pos: [0, 0.72, 1.12], eye: [0, 1.36, 1.5], style: 'saddle' } },
    interior: {
      theme: 'ww1', x: 0.46, floor: 0.62, roof: 1.5, z: [-0.95, 1.75], controls: 'levers', dials: 2, seatStyle: 'saddle',
      slits: [{ x: [-0.22, 0.22], y: [1.3, 1.38] }],
      walk: [{ x: [-0.3, 0.3], z: [-0.75, 0.95] }],
      ammo: { x: [-0.42, 0.42], z: [-0.9, -0.55] }, ammoStyle: 'horizontal', ammoCal: 0.022,
      props: [
        { type: 'pipe', pts: [[0.42, 1.2, 1.6], [0.42, 1.2, -0.9]], r: 0.012, mat: 'cable' },
        { type: 'extinguisher', at: [-0.38, 0.95, 0.2], back: 0.07 },
        { type: 'crate', at: [0.33, 0.75, -0.2], size: [0.2, 0.22, 0.3], mat: 'wood' },
        { type: 'rack', style: 'drums', x: [-0.42, -0.42], z: [-0.4, 0.6], y0: 1.25 },
        { type: 'watercan', at: [0.35, 0.8, 0.45] },
        { type: 'mapcase', at: [-0.43, 1.2, 1.1], ry: PI / 2 },
      ],
    },
  },
  turret: {
    name: 'Башня Жиро (FT)', weight: 0.6, elevMin: -0.2, elevMax: 0.35,
    armor: { front: 22, side: 22, rear: 22, top: 8 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.2], w: [-0.6, 0.6] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.3, 0.75], w: [0.1, 1.0] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.9], w: [-0.8, 0.5] }],
    seats: { commander: { pos: [0, -0.62, -0.12], eye: [0, 0.38, 0.1], style: 'sling' } },
  },
  gun: { name: 'Puteaux SA 18', caliber: '37 мм', weight: 0.1, reload: 2.6, shellSpeed: 367, pen: 18, dmg: 0.45, disp: 0.006, elevSpeed: 0.3 },
  engine: { name: 'Renault 4 цил. 39 л.с.', power: 39, weight: 0.3, fuelUse: 0.06 },
  fuel: { name: 'бак 95 л', cap: 95, weight: 0.1 },
  drive: { name: 'ручной поворот башни FT', speed: 0.5, weight: 0.05 },

  models: {
    hull() {
      const P = mats('ft');
      const root = new THREE.Group();
      // narrow riveted body between the track frames, sloped front with the driver's hatch
      add(root, hullProfile([[-2.0, 0.55], [1.35, 0.55], [1.95, 0.92], [1.88, 1.15], [1.3, 1.52], [0.9, 1.55], [-0.95, 1.55], [-1.6, 1.3], [-2.05, 1.02]], 1.02), P.main);
      const wheels = runningGear(root, P, {
        x: 0.7, w: 0.32, wheels: [1.15, 0.8, 0.45, 0.1, -0.25, -0.6, -0.95, -1.3], wr: 0.13, wy: 0.17,
        idler: [1.72, 0.6, 0.46], sprocket: [-1.78, 0.54, 0.36], spokes: false,
        topRun: [[0.9, 1.1], [-0.9, 1.02]],
      });
      for (const sx of [-1, 1]) {
        // track girder with the springs on top and the big spoked front idler face
        add(root, sizedBox(0.08, 0.3, 3.1), P.dark, sx * 0.7, 0.72, -0.15);
        for (let z = -1.3; z < 1.2; z += 0.52) add(root, U.box, P.metal, sx * 0.7, 0.92, z, 0.1, 0.08, 0.42);
        for (let k = 0; k < 6; k++) add(root, U.box, P.dark, sx * 0.87, 0.6, 1.72, 0.02, 0.8, 0.06, k * PI / 6, 0, 0);
        add(root, U.cylX, P.metal, sx * 0.88, 0.6, 1.72, 0.03, 0.12, 0.12);
        add(root, U.box, P.dark, sx * 0.52, 1.0, -0.3, 0.02, 0.5, 2.8);                              // side plate seam
      }
      // driver's two-leaf front hatch + visor, tail skid, exhaust, rear engine louvres
      add(root, U.box, P.dark, 0, 1.36, 1.62, 0.62, 0.34, 0.05, -0.62, 0, 0);
      add(root, U.box, P.black, 0, 1.44, 1.56, 0.4, 0.04, 0.03, -0.62, 0, 0);
      add(root, U.box, P.dark, 0, 1.12, 1.9, 0.7, 0.3, 0.05, 0.25, 0, 0);
      for (const sx of [-1, 1]) link(root, P.dark, sx * 0.42, 0.08, -1.95, 1.05, -2.85, 0.32, 0.1);
      add(root, U.box, P.dark, 0, 0.36, -2.83, 0.92, 0.1, 0.12);
      add(root, U.box, P.dark, 0, 0.68, -2.42, 0.86, 0.06, 0.06);
      add(root, U.cylZ, P.rust, 0.45, 1.38, -1.3, 0.06, 0.06, 1.0);
      add(root, U.cylZ, P.rust, 0.45, 1.38, -1.3, 0.1, 0.1, 0.4);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 1.43, -1.25), 0.8, 0.85, P.dark);
      bay.engineTop = 1.42;
      return hullResult(root, P, {
        wheels, wheelR: 0.13, bay, ring: { pos: new THREE.Vector3(0, 1.55, 0.2), r: 0.5 }, holeR: 0.48,
        box: new THREE.Box3(new THREE.Vector3(-0.87, 0.1, -2.9), new THREE.Vector3(0.87, 1.58, 2.2)),
        fuelAt: new THREE.Vector3(0, 0.95, -2.2),
        extra: { mgAt: new THREE.Vector3(0.28, 0.02, -0.15) },
      });
    },
    turret() {
      const P = mats('ft');
      const g = new THREE.Group();
      // cast Girod turret: tapering drum, mushroom vent cupola, rear door
      add(g, new THREE.CylinderGeometry(0.44, 0.5, 0.62, 10), P.main, 0, 0.31, 0);
      add(g, new THREE.CylinderGeometry(0.46, 0.46, 0.06, 10), P.dark, 0, 0.03, 0);
      add(g, U.cyl, P.main, 0, 0.66, -0.05, 0.19, 0.1, 0.19);
      add(g, U.hemi, P.main, 0, 0.71, -0.05, 0.22, 0.12, 0.22);
      add(g, U.box, P.dark, 0, 0.3, -0.47, 0.34, 0.42, 0.05);                  // rear door
      for (const a of [0.9, -0.9, 2.3, -2.3]) add(g, U.box, P.black, Math.sin(a) * 0.47, 0.45, Math.cos(a) * 0.47, 0.12, 0.02, 0.02, 0, a, 0);   // slits
      add(g, U.sph, P.dark, 0, 0.32, 0.44, 0.17, 0.17, 0.12);                  // ball mount
      return {
        group: g, gunPos: new THREE.Vector3(0, 0.32, 0.46), sightY: 0.5, mgPos: new THREE.Vector3(0.24, 0.62, -0.18),
        box: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.52), new THREE.Vector3(0.5, 0.84, 0.56)),
      };
    },
    gun() {
      const P = mats('ft');
      const g = new THREE.Group();
      add(g, U.sph, P.dark, 0, 0, 0, 0.14, 0.14, 0.1);
      barrel(g, P.metal, 0.05, 0.62, 0.042, 0.036);
      add(g, U.cylZ, P.metal, 0, 0, 0.68, 0.045, 0.045, 0.05);
      add(g, U.cylZ, P.dark, 0, -0.07, 0.2, 0.03, 0.03, 0.3);                  // recoil cylinder
      breech(g, P, 0.1, 0.12, 0.35);
      return { group: g, muzzleLen: 0.72 };
    },
    engine: (g, P, E) => ENGINE_TYPES.petrol(g, P, E, 4, 0.72),
    fuel: (g, P) => FUEL_TYPES.boxes(g, P, { xs: [0], w: 0.7, h: 0.36, d: 0.28, straps: true }),
    driveR: 0.46,
    turretInterior: {
      poly: ovalPlan(0.43, 0.43, 0.43, 10), h: 0.6, gunnerStyle: 'shoulder', commanderStyle: 'none',
      cupola: { x: 0, z: -0.05, r: 0.17, y0: 0.6, band: [0.64, 0.7], top: 0.74, blocks: 5 },
      props: [
        { type: 'gunner', eye: [0, 0.38, 0.1], style: 'shoulder' },
        { type: 'ready', at: [0.36, 0.2, -0.05], ry: PI / 2, n: 6, cal: 0.02, len: 0.25 },
        { type: 'ready', at: [-0.36, 0.2, -0.05], ry: -PI / 2, n: 6, cal: 0.02, len: 0.25 },
        { type: 'casebag', at: [0, -0.02, 0.18], w: 0.14, h: 0.12, d: 0.16 },
        { type: 'pistolport', at: [0, 0.3, -0.42], ry: PI },
      ],
    },
  },
};
