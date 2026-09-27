// Mark V (1918): British rhomboid heavy tank, the gun sits in a front mount (turretless)
import * as THREE from 'three';
import { PI, U, mats, add, hullProfile, worldUV, sizedBox, offsetPoly, engineDeck, breech, ENGINE_TYPES } from '../modelkit.js';

// rhomboid track frames ("horns") with the track running all around them
let HORNS = null;
function horns() {
  if (HORNS) return HORNS;
  const s = new THREE.Shape();
  s.moveTo(-2.1, 0.14);                              // rear ground contact
  s.lineTo(1.2, 0.14);                               // front ground contact
  s.lineTo(3.55, 1.45);                              // long rising front run
  s.quadraticCurveTo(4.05, 1.75, 3.9, 2.2);          // nose
  s.quadraticCurveTo(3.72, 2.55, 3.15, 2.55);
  s.lineTo(-3.05, 2.55);                             // top run
  s.quadraticCurveTo(-3.8, 2.55, -3.92, 1.95);       // tail
  s.lineTo(-3.82, 1.2);
  s.quadraticCurveTo(-3.72, 0.8, -3.3, 0.62);
  s.lineTo(-2.1, 0.14);
  const inner = s.getPoints(10);
  if (inner[0].distanceTo(inner[inner.length - 1]) < 1e-3) inner.pop();
  const outer = offsetPoly(inner, 0.14);
  const frameShape = new THREE.Shape(inner);
  const beltShape = new THREE.Shape(outer);
  beltShape.holes.push(new THREE.Path([...inner].reverse()));
  const frame = new THREE.ExtrudeGeometry(frameShape, { depth: 0.66, bevelEnabled: false });
  const belt = new THREE.ExtrudeGeometry(beltShape, { depth: 0.6, bevelEnabled: false, curveSegments: 4 });
  for (const g of [frame, belt]) { g.rotateY(-PI / 2); g.computeVertexNormals(); }
  // grouser texture for the belt
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g2 = c.getContext('2d');
  g2.fillStyle = '#2d2a24'; g2.fillRect(0, 0, 32, 32);
  g2.fillStyle = '#4c463a'; g2.fillRect(0, 0, 11, 32);
  g2.fillStyle = '#1a1814'; g2.fillRect(11, 0, 2, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  const beltMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.35 });
  HORNS = { frame, belt, beltMat };
  return HORNS;
}

export default {
  key: 'markV', name: 'Mark V', year: 1918,
  palette: { main: 0x66643f, dark: 0x4f4e31, engine: 0x3d3a36, riveted: true },
  mg: 'hotchkiss',
  hull: {
    name: 'Mark V', weight: 25.2, speedCap: 9, eff: 0.65, turn: 0.75, radius: 3.2, ammoMax: 60,
    armor: { front: 16, side: 12, rear: 10, top: 8 },
    turretless: true, arc: 1.25, elevMin: -0.15, elevMax: 0.3,
    modules: [
      { id: 'engine', u: [-0.3, 0.3], v: [0.15, 0.6], w: [-0.4, 0.05] },
      { id: 'transmission', u: [-0.45, 0.45], v: [0.1, 0.45], w: [-0.8, -0.55] },
      { id: 'ammo', u: [0.35, 0.47], v: [0.15, 0.55], w: [-0.3, 0.4] },
      { id: 'ammo', u: [-0.47, -0.35], v: [0.15, 0.55], w: [-0.3, 0.4] },
    ],
    crew: [
      { u: [-0.4, 0.4], v: [0.4, 1.0], w: [0.35, 0.65] },
      { u: [-0.45, 0.45], v: [0.15, 0.8], w: [-0.7, 0.35] },
    ],
    seats: {
      driver: { pos: [0.4, 1.72, 2.05], eye: [0.38, 2.5, 2.3] },
      commander: { pos: [-0.4, 1.72, 2.05], eye: [-0.38, 2.5, 2.3] },
      gunner: { pos: [0, 1.72, 1.6], eye: [0, 2.45, 1.95] },
    },
    interior: {
      theme: 'ww1', controls: 'levers', seatStyle: 'saddle', dials: 2,
      x: 0.9, floor: 0.45, roof: 2.2, z: [-3.0, 2.55],
      cab: { x: 0.78, z: [1.45, 2.55], top: 2.72, floor: 1.6 },
      slits: [{ x: [0.12, 0.62], y: [2.4, 2.56] }, { x: [-0.62, -0.12], y: [2.4, 2.56] }],
      sideSlits: [{ z: [0.1, 0.5], y: [1.45, 1.58] }, { z: [-1.9, -1.5], y: [1.45, 1.58] }],
      walk: [{ x: [-0.8, 0.8], z: [0.4, 1.35] }, { x: [0.62, 0.8], z: [-2.8, 0.4] },
             { x: [-0.8, -0.62], z: [-2.8, 0.4] }, { x: [-0.8, 0.8], z: [-2.8, -1.75] }],
      ammo: { x: [0.62, 0.88], z: [-1.4, 0.3] },
      props: [
        { type: 'engineguard', rect: [-0.55, -1.15, 0.55, 0.35], y: 1.3, floor: 0.45 },
        { type: 'sidemg', at: [0.84, 1.5, 0.3], ry: PI / 2 },
        { type: 'sidemg', at: [-0.84, 1.5, 0.3], ry: -PI / 2 },
        { type: 'seat', at: [0.55, 0.9, 0.3], ry: PI / 2, style: 'saddle' },
        { type: 'seat', at: [-0.55, 0.9, 0.3], ry: -PI / 2, style: 'saddle' },
        { type: 'pistolport', at: [0.88, 1.52, -1.7], ry: PI / 2 },
        { type: 'pistolport', at: [-0.88, 1.52, -1.7], ry: -PI / 2 },
        { type: 'rack', style: 'horizontal', x: [-0.88, -0.62], z: [-1.4, 0.3], y0: 0.47, h: 0.4, cal: 0.03, rows: 3 },
        { type: 'fuelcell', box: [0.35, 0.45, -2.98, 0.88, 1.4, -2.4] },
        { type: 'fuelcell', box: [-0.88, 0.45, -2.98, -0.35, 1.4, -2.4] },
        { type: 'gearbox', at: [0, 0.72, -2.1], w: 0.6, h: 0.45, d: 0.5 },
        { type: 'shaft', z: [-1.85, -1.1], w: 0.2, h: 0.2 },
        { type: 'fan', at: [0, 1.5, -2.96], r: 0.32 },
        { type: 'crate', at: [0.6, 0.57, 1.1], size: [0.3, 0.24, 0.35], mat: 'wood' },
        { type: 'crate', at: [-0.6, 0.57, 1.1], size: [0.3, 0.24, 0.35], mat: 'wood' },
        { type: 'extinguisher', at: [0.86, 1.1, 1.2], back: 0.07 },
        { type: 'lamp', at: [0, 2.14, -1.5] },
        { type: 'lamp', at: [0, 2.14, 0.8] },
      ],
      engineInside: true,                 // the engine sits in the middle of the crew compartment
    },
  },
  turret: null,
  gun: { name: 'QF 6-pdr', caliber: '57 мм', weight: 0.5, reload: 3.5, shellSpeed: 330, pen: 65, dmg: 0.8, disp: 0.006, elevSpeed: 0.3 },
  engine: { name: 'Ricardo 150', power: 150, weight: 1.5, fuelUse: 0.2 },
  fuel: { name: 'бак 420 л', cap: 420, weight: 0.6 },
  drive: { name: 'механизм наводки Mark V', speed: 0.7, weight: 0.2, fixed: true },

  models: {
    hull() {
      const P = mats('markV');
      const H = horns();
      const root = new THREE.Group();
      for (const sx of [-1, 1]) {
        // extrusion runs along -X from 0: shift so the horn spans x 0.93..1.59 on each side
        add(root, H.frame, P.main, sx > 0 ? 1.59 : -0.93, 0, 0);
        add(root, H.belt, H.beltMat, sx > 0 ? 1.56 : -0.96, 0, 0);
        add(root, U.box, P.metal, sx * 1.26, 2.73, 0.0, 0.12, 0.06, 6.2);                              // unditching rails
        // sponson with a machine gun
        add(root, sizedBox(0.42, 1.1, 1.3), P.main, sx * 1.8, 1.32, 0.32);
        add(root, sizedBox(0.3, 0.5, 0.5), P.dark, sx * 1.85, 1.4, 1.1, 0, sx * 0.5, 0);
        add(root, U.cylZ, P.metal, sx * 2.05, 1.42, 1.25, 0.035, 0.035, 0.6, 0, sx * 0.9, 0);
        add(root, U.cylZ, P.dark, sx * 1.98, 1.42, 1.15, 0.07, 0.07, 0.2, 0, sx * 0.9, 0);
        add(root, sizedBox(0.06, 0.8, 0.5), P.dark, sx * 2.02, 1.2, -0.1);                            // sponson door
      }
      add(root, worldUV(hullProfile([[-3.0, 0.45], [2.1, 0.45], [2.55, 1.0], [2.55, 2.2], [-3.0, 2.2]], 1.86)), P.main);   // body
      add(root, sizedBox(1.6, 0.55, 1.15), P.main, 0, 2.47, 2.02);                                       // driver's cab
      for (const x of [0.38, -0.38]) add(root, U.box, P.dark, x, 2.66, 2.66, 0.52, 0.03, 0.18, -0.5, 0, 0);   // open vision flaps
      add(root, sizedBox(1.2, 0.6, 1.0), P.main, 0, 2.5, -1.7);                                           // rear cab
      add(root, U.box, P.dark, 0, 2.81, -1.7, 0.7, 0.04, 0.6);
      add(root, U.cylZ, P.rust, 0.62, 2.34, 0.1, 0.07, 0.07, 3.0);                                        // exhaust pipe along the roof
      add(root, U.cylZ, P.rust, 0.62, 2.34, 0.1, 0.1, 0.1, 1.0);
      add(root, U.cyl, P.rust, 0.62, 2.25, 1.6, 0.07, 0.25, 0.07);
      add(root, U.box, P.dark, 0, 0.7, -3.02, 1.7, 0.4, 0.06);
      const bay = engineDeck(root, P, new THREE.Vector3(0, 2.2, -0.4), 1.0, 1.4, P.dark);
      bay.engineFloor = 0.45;
      const mount = new THREE.Vector3(0, 2.45, 2.62);
      return {
        root, wheels: [], wheelR: 1, ring: null, bay, mount,
        box: new THREE.Box3(new THREE.Vector3(-2.02, 0, -4.05), new THREE.Vector3(2.02, 2.8, 4.1)),
        fuelAt: new THREE.Vector3(0, 1.1, -3.32), fuelRot: 0,
        driveAt: new THREE.Vector3(0, 2.25, 2.3),
        ringHole: null,
        mgAt: new THREE.Vector3(0.45, 0.3, -0.5),         // on the cab roof, relative to the gun mount
      };
    },
    turret: null,
    gun() {
      const P = mats('markV');
      const g = new THREE.Group();
      add(g, U.sph, P.dark, 0, 0, 0, 0.22, 0.22, 0.22);                     // ball mount
      add(g, U.cylZ, P.dark, 0, 0, 0.12, 0.3, 0.3, 0.05);
      add(g, U.cylZ, P.metal, 0, 0, 0.8, 0.045, 0.045, 1.3);
      add(g, U.cylZ, P.metal, 0, 0, 1.42, 0.055, 0.055, 0.08);
      add(g, U.cylZ, P.dark, 0, -0.08, 0.42, 0.055, 0.055, 0.55);           // recoil cylinder
      breech(g, P, 0.18, 0.2, 0.5);
      return { group: g, muzzleLen: 1.47 };
    },
    engine: ENGINE_TYPES.ricardo,
    fuel(g, P) {
      add(g, sizedBox(1.6, 0.75, 0.66), P.main, 0, 0, 0);
      add(g, U.cyl, P.brass, 0.5, 0.4, 0, 0.08, 0.06, 0.08);
      add(g, U.box, P.dark, 0, 0, -0.34, 1.4, 0.5, 0.02);
      return 0.38;
    },
    drive(g, P) {
      add(g, U.box, P.engine, 0, 0.15, 0, 0.4, 0.3, 0.3);
      add(g, new THREE.TorusGeometry(0.16, 0.025, 6, 16), P.metal, 0.25, 0.2, 0, 1, 1, 1, 0, PI / 2, 0);
    },
  },
};
