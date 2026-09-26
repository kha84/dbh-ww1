// Procedural tank models: hulls, turrets, guns, engines, fuel tanks, turret drives and crew
// compartments. Every replaceable part is its own group so it can be moved between tanks,
// carried in hands, dropped on the ground or stored under the crane.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HULLS, TURRETS } from './parts.js';

const PI = Math.PI;

// ===================================================================== shared geometry / materials
const U = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cylX: new THREE.CylinderGeometry(1, 1, 1, 18).rotateZ(PI / 2),
  cylZ: new THREE.CylinderGeometry(1, 1, 1, 16).rotateX(PI / 2),
  cylZ8: new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(PI / 2),
  sph: new THREE.SphereGeometry(1, 16, 10),
  hemi: new THREE.SphereGeometry(1, 20, 8, 0, PI * 2, 0, PI / 2),
  disc: new THREE.CircleGeometry(1, 28).rotateX(-PI / 2),
};

const PAL = {
  t55:    { main: 0x4d5b30, dark: 0x3b4725, engine: 0x565f4a },
  abrams: { main: 0xb39a6b, dark: 0x8d784f, engine: 0x8c8c86 },
  avre:   { main: 0x4b5739, dark: 0x343d28, engine: 0x5a6258 },
  markV:  { main: 0x66643f, dark: 0x4a4a2e, engine: 0x3d3a36 },
};

function rivetTexture(base, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {                       // grime
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,35,20' : '120,110,80'},${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 14, 4 + Math.random() * 14);
  }
  g.strokeStyle = dark; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
  for (let k = 7; k < 128; k += 10) {
    for (const [x, y] of [[k, 6], [k, 122], [6, k], [122, k]]) {
      g.fillStyle = dark; g.beginPath(); g.arc(x + 0.6, y + 0.6, 2.2, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,250,200,.35)'; g.beginPath(); g.arc(x - 0.5, y - 0.5, 1.1, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function grilleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1c1c19'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#4a4a42';
  for (let y = 2; y < 64; y += 8) g.fillRect(0, y, 64, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const matCache = {};
export function mats(key) {
  if (matCache[key]) return matCache[key];
  const p = PAL[key];
  const S = (color, r = 0.85, m = 0.15, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
  const m = {
    main: S(p.main), dark: S(p.dark, 0.9, 0.1),
    track: S(0x2c2a26, 0.95, 0.3), rubber: S(0x1a1a1a, 1, 0), metal: S(0x3a3a38, 0.6, 0.6),
    steel: S(0x6f7274, 0.45, 0.7), glass: S(0xd8e6ee, 0.1, 0.4, { emissive: 0x222222 }),
    wood: S(0x6b4f33, 1, 0), black: S(0x151515, 0.9, 0.2), rust: S(0x7a4a2a, 0.9, 0.3),
    brass: S(0xb8903a, 0.4, 0.8), engine: S(p.engine, 0.55, 0.55), red: S(0x9a2a20, 0.6, 0.2),
    grille: S(0xffffff, 0.9, 0.3, { map: grilleTexture() }),
    hole: new THREE.MeshBasicMaterial({ color: 0x080806 }),
  };
  if (key === 'markV') {
    m.main = S(0xffffff, 0.85, 0.15, { map: rivetTexture('#66643f', '#3a3923') });
    m.dark = S(0xffffff, 0.9, 0.1, { map: rivetTexture('#4f4e31', '#2c2b1a') });
  }
  matCache[key] = m;
  return m;
}

function add(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Merge the static meshes under `node` into a few meshes: untextured pieces are baked into one
// vertex-coloured mesh, textured ones are merged per material. Children flagged userData.keep
// (moving parts, toggled pieces) and interiors are left alone.
const VC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.2 });
function bake(node) {
  node.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  const visit = (o) => {
    for (const c of o.children) {
      if (c.userData.keep || c.userData.interior) continue;
      if (c.isMesh) {
        const geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        const n = geo.attributes.position.count;
        if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
        let mat = c.material;
        if (!mat.map) {
          const col = mat.color, arr = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
          geo.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
          mat = VC_MAT;
        }
        if (!buckets.has(mat)) buckets.set(mat, []);
        buckets.get(mat).push(geo);
        victims.push(c);
      }
      visit(c);
    }
  };
  visit(node);
  for (const v of victims) {
    for (const ch of [...v.children]) if (ch.userData.keep || ch.userData.interior) node.attach(ch);
    v.removeFromParent();
  }
  for (const [mat, geos] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.castShadow = true; m.receiveShadow = true;
    node.add(m);
  }
  return node;
}
const keep = o => { o.userData.keep = true; return o; };

// box spanning two points in the ZY plane (track runs, arms)
function link(parent, mat, x, w, z1, y1, z2, y2, t = 0.08) {
  const len = Math.hypot(z2 - z1, y2 - y1);
  return add(parent, U.box, mat, x, (y1 + y2) / 2, (z1 + z2) / 2, w, t, len, -Math.atan2(y2 - y1, z2 - z1), 0, 0);
}

// side profile (z, y) extruded across X, centred
function hullProfile(pts, width) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
  g.rotateY(-PI / 2);
  g.translate(width / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

// plan polygon (x, z) extruded up by h; the top is scaled (sloped walls) and shifted along Z
function prism(plan, h, topScale = 1, topShiftZ = 0) {
  const s = new THREE.Shape();
  s.moveTo(plan[0][0], -plan[0][1]);
  for (let i = 1; i < plan.length; i++) s.lineTo(plan[i][0], -plan[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.rotateX(-PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > h - 1e-4) { p.setX(i, p.getX(i) * topScale); p.setZ(i, p.getZ(i) * topScale + topShiftZ); }
  }
  g.computeVertexNormals();
  return g;
}

// planar UVs in metres (for riveted plates on sized boxes)
function worldUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return geo;
}
const sizedBox = (w, h, d) => worldUV(new THREE.BoxGeometry(w, h, d));

// running gear: road wheels, idler, sprocket and a track made of flat runs
function runningGear(root, P, o) {
  const wheels = [];
  for (const sx of [-1, 1]) {
    const X = sx * o.x;
    const wheel = (y, z) => {
      const w = keep(new THREE.Group());
      w.position.set(X, y, z);
      root.add(w);
      wheels.push(w);
      return w;
    };
    const ww = o.w * 0.78;
    for (const z of o.wheels) {
      const w = wheel(o.wy, z);
      add(w, U.cylX, P.rubber, 0, 0, 0, ww * 0.9, o.wr, o.wr);                      // tyre
      add(w, U.cylX, o.wheelMat || P.main, 0, 0, 0, ww, o.wr * 0.84, o.wr * 0.84);   // disc
      add(w, U.cylX, P.metal, 0, 0, 0, ww * 1.1, o.wr * 0.3, o.wr * 0.3);           // hub
      add(w, U.box, P.dark, 0, 0, 0, ww * 1.06, o.wr * 1.3, o.wr * 0.18);           // spokes: show rotation
      add(w, U.box, P.dark, 0, 0, 0, ww * 1.06, o.wr * 0.18, o.wr * 1.3);
      bake(w);
    }
    const [iz, iy, ir] = o.idler, [sz, sy, sr] = o.sprocket;
    const idler = wheel(iy, iz);
    add(idler, U.cylX, P.dark, 0, 0, 0, o.w * 0.7, ir, ir);
    add(idler, U.box, P.metal, 0, 0, 0, o.w * 0.77, ir * 1.2, ir * 0.25);
    bake(idler);
    const spr = wheel(sy, sz);
    add(spr, U.cylX, P.metal, 0, 0, 0, o.w * 0.72, sr, sr);
    for (let k = 0; k < 3; k++) add(spr, U.box, P.dark, 0, 0, 0, o.w * 0.78, sr * 1.18, sr * 0.22, k * PI / 3, 0, 0);
    bake(spr);
    // track
    const t = 0.08, zf = o.wheels[0], zr = o.wheels[o.wheels.length - 1];
    link(root, P.track, X, o.w, iz, iy + ir + t / 2, sz, sy + sr + t / 2, t);                  // top run
    link(root, P.track, X, o.w, zf, 0.04, zr, 0.04, t);                                       // ground run
    link(root, P.track, X, o.w, zf, 0.04, iz + ir * 0.6, iy - ir * 0.3, t);                   // front
    link(root, P.track, X, o.w, iz + ir * 0.6, iy - ir * 0.3, iz + ir * 0.35, iy + ir, t);
    link(root, P.track, X, o.w, zr, 0.04, sz - sr * 0.6, sy - sr * 0.3, t);                   // rear
    link(root, P.track, X, o.w, sz - sr * 0.6, sy - sr * 0.3, sz - sr * 0.35, sy + sr, t);
  }
  return wheels;
}

// engine deck hatch hinged at its rear edge + dark opening shown while it is open
function engineDeck(root, P, center, w, l, mat) {
  const hinge = keep(new THREE.Group());
  hinge.position.set(center.x, center.y, center.z - l / 2);
  root.add(hinge);
  add(hinge, U.box, mat || P.grille, 0, 0.025, l / 2, w, 0.05, l);
  add(hinge, U.box, P.dark, 0, 0.055, l - 0.06, w * 0.9, 0.03, 0.06);          // handle lip
  bake(hinge);
  const hole = keep(add(root, U.box, P.hole, center.x, center.y + 0.004, center.z, w * 0.96, 0.01, l * 0.96));
  hole.castShadow = false;
  hole.visible = false;
  return { center: center.clone(), w, l, hinge, hole };
}

// dark opening + rim where a turret was lifted off
function ringHole(root, P, pos, r) {
  const g = keep(new THREE.Group());
  g.position.copy(pos);
  const d = add(g, U.disc, P.hole, 0, 0.012, 0, r * 0.98, 1, r * 0.98);
  d.castShadow = false;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 32).rotateX(PI / 2), P.metal);
  rim.position.y = 0.03;
  g.add(rim);
  g.visible = false;
  root.add(g);
  return g;
}

// ===================================================================== hulls
function hullT55() {
  const P = mats('t55');
  const root = new THREE.Group();
  add(root, hullProfile([[-3.1, 0.42], [2.75, 0.42], [3.2, 0.92], [2.0, 1.52], [-2.95, 1.52], [-3.18, 1.12]], 2.12), P.main);
  for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * 1.35, 1.06, -0.08, 0.6, 0.05, 6.15);    // fenders
  const wheels = runningGear(root, P, {
    x: 1.34, w: 0.58, wheels: [2.2, 0.95, 0.05, -0.85, -1.75], wr: 0.41, wy: 0.45,
    idler: [2.85, 0.6, 0.3], sprocket: [-2.72, 0.62, 0.33],
  });
  for (const z of [-2.35, -1.45, -0.55]) add(root, U.box, P.dark, -1.35, 1.32, z, 0.5, 0.48, 0.8);  // fender tanks / bins
  add(root, U.cylX, P.wood, 0, 1.66, -2.75, 2.9, 0.13, 0.13);                                    // unditching log
  add(root, U.box, P.dark, 1.35, 1.25, -1.2, 0.5, 0.35, 1.8);                                     // stowage
  add(root, U.box, P.grille, 0, 1.53, -2.72, 1.7, 0.03, 0.35);
  add(root, U.cyl, P.glass, 0.75, 1.3, 2.62, 0.1, 0.1, 0.1, PI / 2 - 0.7, 0, 0);                  // headlight
  add(root, U.box, P.metal, 0.55, 1.56, 1.85, 0.5, 0.06, 0.4, 0.3, 0, 0);                        // driver hatch
  for (const x of [0.42, 0.68]) add(root, U.box, P.glass, x, 1.55, 2.12, 0.12, 0.05, 0.06);       // driver periscopes
  const bay = engineDeck(root, P, new THREE.Vector3(0, 1.52, -1.85), 1.6, 1.3);
  bay.engineTop = 1.62;
  const ring = { pos: new THREE.Vector3(0, 1.52, 0.72), r: 1.1 };
  return {
    root, wheels, wheelR: 0.41, ring, bay,
    box: new THREE.Box3(new THREE.Vector3(-1.64, 0.1, -3.62), new THREE.Vector3(1.64, 1.6, 3.2)),
    fuelAt: new THREE.Vector3(0, 1.25, -3.35), fuelRot: 0,
    driveAt: ring.pos.clone(),
    ringHole: ringHole(root, P, ring.pos, 1.08),
  };
}

function hullAbrams() {
  const P = mats('abrams');
  const root = new THREE.Group();
  add(root, hullProfile([[-3.75, 0.45], [3.35, 0.45], [3.9, 0.95], [3.95, 1.12], [2.2, 1.55], [-3.85, 1.55], [-3.95, 0.9]], 2.3), P.main);
  const wheels = runningGear(root, P, {
    x: 1.5, w: 0.64, wheels: [2.5, 1.68, 0.86, 0.04, -0.78, -1.6, -2.42], wr: 0.32, wy: 0.36,
    idler: [3.2, 0.62, 0.3], sprocket: [-3.3, 0.7, 0.36], wheelMat: P.dark,
  });
  for (const sx of [-1, 1]) {
    add(root, U.box, P.main, sx * 1.5, 1.38, 0, 0.76, 0.05, 7.7);                                   // fender
    add(root, U.box, P.main, sx * 1.86, 0.93, -0.35, 0.06, 0.9, 6.8);                               // skirt
    add(root, U.box, P.main, sx * 1.83, 0.94, 3.0, 0.16, 0.95, 1.5);                                // heavy front skirt
    add(root, U.box, P.dark, sx * 1.9, 0.52, -0.35, 0.02, 0.06, 6.8);
    add(root, U.box, P.dark, sx * 1.45, 1.47, 3.72, 0.3, 0.14, 0.12);                               // light cluster
    add(root, U.box, P.glass, sx * 1.45, 1.47, 3.79, 0.22, 0.08, 0.02);
    add(root, U.box, P.red, sx * 1.4, 1.4, -3.93, 0.16, 0.1, 0.04);                                 // tail lights
    add(root, U.cylZ8, P.metal, sx * 0.9, 0.62, 3.72, 0.07, 0.07, 0.3);                             // tow hooks
  }
  add(root, U.box, P.grille, 0, 1.13, -3.95, 1.6, 0.5, 0.04);                                       // exhaust grille
  add(root, U.box, P.grille, 0, 1.565, -3.5, 1.9, 0.02, 0.5);
  add(root, U.cyl, P.metal, 0, 1.575, 1.95, 0.3, 0.05, 0.3);                                        // driver hatch
  for (const x of [-0.25, 0, 0.25]) add(root, U.box, P.glass, x, 1.58, 2.3, 0.14, 0.05, 0.07);
  const bay = engineDeck(root, P, new THREE.Vector3(0, 1.55, -2.55), 1.9, 1.7);
  bay.engineTop = 1.65;
  const ring = { pos: new THREE.Vector3(0, 1.55, 0.25), r: 1.15 };
  return {
    root, wheels, wheelR: 0.32, ring, bay,
    box: new THREE.Box3(new THREE.Vector3(-1.9, 0.1, -4.4), new THREE.Vector3(1.9, 1.62, 3.96)),
    fuelAt: new THREE.Vector3(0, 1.02, -4.18), fuelRot: 0,
    driveAt: ring.pos.clone(),
    ringHole: ringHole(root, P, ring.pos, 1.12),
  };
}

function hullAvre() {
  const P = mats('avre');
  const root = new THREE.Group();
  add(root, hullProfile([[-3.45, 0.5], [3.2, 0.5], [3.85, 0.95], [1.9, 1.62], [-3.35, 1.62], [-3.6, 1.2]], 2.2), P.main);
  const wheels = runningGear(root, P, {
    x: 1.46, w: 0.6, wheels: [2.2, 1.3, 0.4, -0.5, -1.4, -2.3], wr: 0.37, wy: 0.4,
    idler: [3.02, 0.64, 0.3], sprocket: [-3.15, 0.7, 0.35],
  });
  for (const sx of [-1, 1]) {
    add(root, U.box, P.main, sx * 1.47, 1.46, -0.1, 0.68, 0.05, 6.7);                               // track guard
    add(root, U.box, P.main, sx * 1.8, 1.2, -0.3, 0.05, 0.5, 6.1);                                  // bazooka plates
    for (let z = -3.0; z < 2.8; z += 1.02) add(root, U.box, P.dark, sx * 1.83, 1.2, z, 0.02, 0.48, 0.03);
    add(root, U.box, P.dark, sx * 1.47, 1.66, 1.4, 0.55, 0.36, 1.6);                                // stowage bins
    add(root, U.box, P.dark, sx * 1.47, 1.62, -2.5, 0.5, 0.3, 1.2);                                 // exhaust boxes
    add(root, U.box, P.grille, sx * 1.47, 1.78, -2.5, 0.42, 0.02, 1.0);
    // dozer arms
    link(root, P.dark, sx * 1.15, 0.14, 2.8, 0.75, 4.05, 0.55, 0.16);
    add(root, U.cylZ8, P.metal, sx * 1.15, 1.05, 3.55, 0.07, 0.07, 1.1, -0.45, 0, 0);               // hydraulic ram
  }
  // dozer blade
  add(root, U.box, P.main, 0, 0.62, 4.12, 3.5, 0.95, 0.1, 0.12, 0, 0);
  add(root, U.box, P.dark, 0, 1.08, 4.08, 3.5, 0.08, 0.2);
  add(root, U.box, P.metal, 0, 0.16, 4.2, 3.5, 0.06, 0.12);
  for (const x of [-1.2, -0.4, 0.4, 1.2]) add(root, U.box, P.dark, x, 0.62, 4.02, 0.08, 0.85, 0.15, 0.12, 0, 0);
  add(root, U.cyl, P.metal, 0, 1.64, 1.55, 0.3, 0.05, 0.3);                                          // driver hatch
  add(root, U.box, P.glass, 0, 1.64, 1.88, 0.3, 0.05, 0.07);
  add(root, U.box, P.grille, 0, 1.63, -3.2, 1.9, 0.02, 0.3);
  // rear stowage frame
  add(root, U.box, P.dark, 0, 1.25, -3.62, 2.0, 0.05, 0.05);
  const bay = engineDeck(root, P, new THREE.Vector3(0, 1.62, -2.05), 1.9, 1.8);
  bay.engineTop = 1.72;
  const ring = { pos: new THREE.Vector3(0, 1.62, 0.35), r: 1.1 };
  return {
    root, wheels, wheelR: 0.37, ring, bay,
    box: new THREE.Box3(new THREE.Vector3(-1.84, 0.1, -4.25), new THREE.Vector3(1.84, 1.7, 4.22)),
    fuelAt: new THREE.Vector3(0, 1.12, -3.92), fuelRot: 0,
    driveAt: ring.pos.clone(),
    ringHole: ringHole(root, P, ring.pos, 1.08),
  };
}

// Mark V: rhomboid track frames ("horns") with the track running all around them
function offsetPoly(pts, d) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  const sgn = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const e1 = new THREE.Vector2(p.x - a.x, p.y - a.y).normalize();
    const e2 = new THREE.Vector2(b.x - p.x, b.y - p.y).normalize();
    const n = new THREE.Vector2(e1.y + e2.y, -(e1.x + e2.x)).normalize().multiplyScalar(d * sgn);
    return new THREE.Vector2(p.x + n.x, p.y + n.y);
  });
}

let markVHornCache = null;
function markVHorns() {
  if (markVHornCache) return markVHornCache;
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
  markVHornCache = { frame, belt, beltMat };
  return markVHornCache;
}

function hullMarkV() {
  const P = mats('markV');
  const H = markVHorns();
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
  // body between the horns
  add(root, worldUV(hullProfile([[-3.0, 0.45], [2.1, 0.45], [2.55, 1.0], [2.55, 2.2], [-3.0, 2.2]], 1.86)), P.main);
  add(root, sizedBox(1.6, 0.55, 1.15), P.main, 0, 2.47, 2.02);                                       // driver's cab
  for (const x of [0.38, -0.38]) add(root, U.box, P.dark, x, 2.66, 2.66, 0.52, 0.03, 0.18, -0.5, 0, 0);   // open vision flaps
  add(root, sizedBox(1.2, 0.6, 1.0), P.main, 0, 2.5, -1.7);                                           // rear cab
  add(root, U.box, P.dark, 0, 2.81, -1.7, 0.7, 0.04, 0.6);
  // exhaust pipe along the roof
  add(root, U.cylZ, P.rust, 0.62, 2.34, 0.1, 0.07, 0.07, 3.0);
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
  };
}

const HULL_BUILDERS = { t55: hullT55, abrams: hullAbrams, avre: hullAvre, markV: hullMarkV };
export function buildHull(key) {
  const h = HULL_BUILDERS[key]();
  h.key = key;
  bake(h.root);
  h.root.userData.markHost = true;
  return h;
}

// ===================================================================== turrets
function turretT55() {
  const P = mats('t55');
  const g = new THREE.Group();
  const dome = new THREE.SphereGeometry(1.2, 30, 14, 0, PI * 2, 0, PI / 2);
  dome.scale(1.0, 0.72, 1.12);
  add(g, new THREE.CylinderGeometry(1.18, 1.22, 0.12, 30), P.dark, 0, 0.02, 0);
  add(g, dome, P.main, 0, 0.05, 0);
  add(g, U.cyl, P.main, 0.52, 0.8, -0.3, 0.34, 0.28, 0.34);          // commander cupola (left)
  add(g, U.cyl, P.glass, 0.52, 0.87, -0.3, 0.35, 0.08, 0.35);
  add(g, U.cyl, P.metal, 0.52, 0.96, -0.3, 0.3, 0.05, 0.3);
  add(g, U.cyl, P.main, -0.48, 0.78, -0.35, 0.3, 0.06, 0.3);         // loader hatch
  add(g, U.cyl, P.metal, -0.48, 1.0, -0.35, 0.03, 0.4, 0.03);        // AA MG
  add(g, U.cylZ, P.metal, -0.48, 1.18, -0.1, 0.03, 0.03, 0.9);
  add(g, U.box, P.dark, 0, 0.38, -1.25, 1.4, 0.3, 0.3);              // rear stowage
  add(g, U.cylZ, P.dark, -0.55, 0.62, 0.95, 0.15, 0.15, 0.3);         // IR searchlight
  add(g, U.cylZ, P.glass, -0.55, 0.62, 1.11, 0.13, 0.13, 0.02);
  add(g, U.cyl, P.metal, 0.75, 0.6, 0.9, 0.05, 0.14, 0.05);          // gunner sight
  return {
    group: g, gunPos: new THREE.Vector3(0, 0.42, 1.15), sightY: 1.0,
    box: new THREE.Box3(new THREE.Vector3(-1.2, 0, -1.4), new THREE.Vector3(1.2, 0.96, 1.35)),
  };
}

const ABRAMS_PLAN = [[0.55, 1.95], [1.8, 1.2], [1.8, -1.3], [1.55, -2.85], [-1.55, -2.85], [-1.8, -1.3], [-1.8, 1.2], [-0.55, 1.95]];
function turretAbrams() {
  const P = mats('abrams');
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(1.2, 1.24, 0.1, 30), P.dark, 0, 0.02, 0);
  add(g, prism(ABRAMS_PLAN, 0.78, 0.97, -0.03), P.main, 0, 0.02, 0);
  // commander cupola with .50 cal (right side = -X)
  add(g, U.cyl, P.main, -0.72, 0.92, -0.25, 0.37, 0.28, 0.37);
  add(g, U.cyl, P.glass, -0.72, 0.96, -0.25, 0.38, 0.07, 0.38);
  add(g, U.cyl, P.dark, -0.72, 1.08, -0.25, 0.34, 0.05, 0.34);
  add(g, U.box, P.metal, -0.72, 1.16, 0.0, 0.14, 0.14, 0.4);
  add(g, U.cylZ, P.metal, -0.72, 1.18, 0.55, 0.035, 0.035, 0.9);
  // loader hatch + M240
  add(g, U.cyl, P.main, 0.72, 0.83, -0.3, 0.32, 0.05, 0.32);
  add(g, U.cyl, P.metal, 0.95, 0.98, -0.15, 0.025, 0.3, 0.025);
  add(g, U.cylZ, P.metal, 0.95, 1.12, 0.2, 0.025, 0.025, 0.7);
  // gunner's primary sight, CITV-like head, wind sensor
  add(g, U.box, P.main, -0.72, 0.93, 1.1, 0.5, 0.3, 0.55);
  add(g, U.box, P.glass, -0.72, 0.93, 1.38, 0.4, 0.2, 0.02);
  add(g, U.cyl, P.dark, 0.35, 0.92, 0.6, 0.12, 0.25, 0.12);
  add(g, U.box, P.dark, 0.35, 1.08, 0.6, 0.28, 0.14, 0.2);
  add(g, U.cyl, P.metal, 0, 1.15, -2.4, 0.02, 0.8, 0.02);
  // bustle rack
  for (const sx of [-1, 1]) {
    add(g, U.box, P.dark, sx * 1.5, 0.5, -3.1, 0.04, 0.5, 0.55);
    add(g, U.box, P.metal, sx * 1.6, 0.55, 1.35, 0.25, 0.28, 0.4, 0, sx * 0.4, 0);     // smoke launchers
    for (const y of [0.5, 0.62]) add(g, U.cylZ8, P.black, sx * 1.66, y, 1.58, 0.05, 0.05, 0.12, -0.3, sx * 0.4, 0);
    add(g, U.box, P.dark, sx * 1.83, 0.45, -0.3, 0.1, 0.3, 1.5);                        // side stowage
  }
  add(g, U.box, P.dark, 0, 0.5, -3.37, 3.0, 0.5, 0.04);
  add(g, U.box, P.dark, 0, 0.26, -3.1, 3.0, 0.04, 0.55);
  add(g, U.box, P.wood, 0, 0.45, -3.1, 2.6, 0.36, 0.4);
  return {
    group: g, gunPos: new THREE.Vector3(0, 0.42, 1.95), sightY: 1.08,
    box: new THREE.Box3(new THREE.Vector3(-1.85, 0, -2.85), new THREE.Vector3(1.85, 0.82, 1.95)),
  };
}

const AVRE_PLAN = [[0.45, 1.75], [1.3, 1.05], [1.5, -0.2], [1.4, -1.55], [0.85, -1.9], [-0.85, -1.9], [-1.4, -1.55], [-1.5, -0.2], [-1.3, 1.05], [-0.45, 1.75]];
function turretAvre() {
  const P = mats('avre');
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(1.15, 1.2, 0.1, 30), P.dark, 0, 0.02, 0);
  add(g, prism(AVRE_PLAN, 0.85, 0.72, -0.25), P.main, 0, 0.02, 0);
  // commander cupola (right side) with MG
  add(g, U.cyl, P.main, -0.55, 0.95, -0.55, 0.36, 0.42, 0.36);
  add(g, U.cyl, P.glass, -0.55, 1.03, -0.55, 0.37, 0.08, 0.37);
  add(g, U.cyl, P.dark, -0.55, 1.18, -0.55, 0.33, 0.05, 0.33);
  add(g, U.box, P.metal, -0.3, 1.14, -0.4, 0.12, 0.14, 0.4);
  add(g, U.cylZ, P.metal, -0.3, 1.16, 0.05, 0.03, 0.03, 0.6);
  add(g, U.cyl, P.main, 0.5, 0.88, -0.55, 0.3, 0.05, 0.3);                // loader hatch
  add(g, U.box, P.main, -0.5, 0.9, 0.62, 0.3, 0.2, 0.35);                // gunner sight
  add(g, U.box, P.glass, -0.5, 0.9, 0.8, 0.22, 0.12, 0.02);
  // searchlight on the left side
  add(g, U.box, P.dark, 1.5, 0.55, 0.3, 0.38, 0.45, 0.62);
  add(g, U.box, P.glass, 1.5, 0.55, 0.62, 0.3, 0.36, 0.02);
  for (const sx of [-1, 1]) {
    add(g, U.box, P.dark, sx * 1.35, 0.4, -1.3, 0.3, 0.45, 0.8, 0, sx * 0.25, 0);     // bins
    for (const y of [0.45, 0.58]) add(g, U.cylZ8, P.black, sx * 1.05, y, 1.25, 0.05, 0.05, 0.25, -0.35, sx * 0.5, 0);
  }
  add(g, U.box, P.dark, 0, 0.45, -1.98, 1.5, 0.4, 0.2);
  add(g, U.cyl, P.metal, 0.6, 1.3, -1.2, 0.015, 1.0, 0.015);             // antenna
  return {
    group: g, gunPos: new THREE.Vector3(0, 0.4, 1.72), sightY: 1.12,
    box: new THREE.Box3(new THREE.Vector3(-1.5, 0, -1.95), new THREE.Vector3(1.5, 0.92, 1.75)),
  };
}

const TURRET_BUILDERS = { t55: turretT55, abrams: turretAbrams, avre: turretAvre };
export function buildTurret(key) {
  const t = TURRET_BUILDERS[key]();
  t.key = key;
  bake(t.group);
  t.group.userData.markHost = true;
  t.gunPivot = new THREE.Group();
  t.gunPivot.position.copy(t.gunPos);
  t.group.add(t.gunPivot);
  t.group.userData.groundY = 0.25;
  return t;
}

// ===================================================================== guns (origin at the trunnions, barrel +Z)
function interiorGroup(parent) {
  const g = new THREE.Group();
  g.userData.interior = true;
  g.visible = false;
  parent.add(g);
  return g;
}

function breech(parent, P, w, h, len) {
  const ig = interiorGroup(parent);
  const m1 = add(ig, U.box, P.steel, 0, 0, -len / 2, w, h, len);
  const m2 = add(ig, U.box, P.metal, 0, -h * 0.15, -len - 0.12, w * 1.3, h * 1.2, 0.08);   // recoil guard
  const m3 = add(ig, U.box, P.brass, 0, h * 0.6, -len * 0.4, 0.06, 0.06, len * 0.6);
  for (const m of [m1, m2, m3]) m.castShadow = false;
  return ig;
}

function gunT55() {
  const P = mats('t55');
  const g = new THREE.Group();
  const mantlet = new THREE.SphereGeometry(0.42, 14, 10, 0, PI * 2, 0, PI);
  mantlet.scale(1.1, 0.8, 0.6);
  add(g, mantlet, P.main, 0, 0, 0.05);
  add(g, new THREE.CylinderGeometry(0.072, 0.09, 4.2, 14).rotateX(PI / 2), P.main, 0, 0, 2.3);
  add(g, U.cylZ, P.main, 0, 0, 3.55, 0.135, 0.135, 0.5);                // bore evacuator
  add(g, U.cylZ, P.metal, 0, 0, 4.36, 0.1, 0.1, 0.12);
  add(g, U.cylZ, P.metal, -0.28, 0, 0.38, 0.035, 0.035, 0.4);           // coax MG
  breech(g, P, 0.36, 0.36, 0.95);
  return { group: g, muzzleLen: 4.42 };
}

function gunAbrams() {
  const P = mats('abrams');
  const g = new THREE.Group();
  add(g, U.box, P.main, 0, 0, 0.12, 1.05, 0.56, 0.42);                 // mantlet
  add(g, U.box, P.dark, 0, 0.02, 0.34, 0.5, 0.45, 0.06);
  add(g, U.cylZ, P.main, 0, 0, 2.85, 0.088, 0.088, 5.1);
  for (const z of [1.2, 1.9, 3.3, 4.0, 4.7]) add(g, U.cylZ, P.dark, 0, 0, z, 0.098, 0.098, 0.06);
  add(g, U.cylZ, P.main, 0, 0, 2.6, 0.13, 0.13, 0.75);                 // fume extractor
  add(g, U.cylZ, P.metal, 0, 0, 5.35, 0.1, 0.1, 0.1);
  add(g, U.box, P.dark, 0, 0.13, 5.2, 0.07, 0.06, 0.18);               // muzzle reference sensor
  add(g, U.cylZ, P.metal, -0.32, 0.05, 0.5, 0.035, 0.035, 0.35);
  breech(g, P, 0.46, 0.46, 1.05);
  return { group: g, muzzleLen: 5.4 };
}

function gunAvre() {
  const P = mats('avre');
  const g = new THREE.Group();
  add(g, U.sph, P.dark, 0, 0, 0.12, 0.55, 0.4, 0.34);                  // canvas mantlet cover
  add(g, U.box, P.main, 0, 0, 0.3, 0.6, 0.45, 0.2);
  add(g, new THREE.CylinderGeometry(0.14, 0.16, 2.0, 16).rotateX(PI / 2), P.main, 0, 0, 1.35);
  add(g, U.cylZ, P.metal, 0, 0, 2.38, 0.18, 0.18, 0.14);
  add(g, U.cylZ, P.dark, 0, 0, 0.55, 0.19, 0.19, 0.12);
  breech(g, P, 0.55, 0.55, 0.9);
  return { group: g, muzzleLen: 2.45 };
}

function gunMarkV() {
  const P = mats('markV');
  const g = new THREE.Group();
  add(g, U.sph, P.dark, 0, 0, 0, 0.22, 0.22, 0.22);                     // ball mount
  add(g, U.cylZ, P.dark, 0, 0, 0.12, 0.3, 0.3, 0.05);
  add(g, U.cylZ, P.metal, 0, 0, 0.8, 0.045, 0.045, 1.3);
  add(g, U.cylZ, P.metal, 0, 0, 1.42, 0.055, 0.055, 0.08);
  add(g, U.cylZ, P.dark, 0, -0.08, 0.42, 0.055, 0.055, 0.55);           // recoil cylinder
  breech(g, P, 0.18, 0.2, 0.5);
  return { group: g, muzzleLen: 1.47 };
}

const GUN_BUILDERS = { t55: gunT55, abrams: gunAbrams, avre: gunAvre, markV: gunMarkV };
export function buildGun(key) {
  const v = GUN_BUILDERS[key]();
  v.key = key;
  bake(v.group);
  v.group.userData.markHost = true;
  v.group.userData.groundY = 0.3;
  return v;
}

// ===================================================================== engines (origin: bottom centre)
function engineT55(g, P, E) {                          // V-12 diesel
  add(g, U.box, E, 0, 0.22, 0, 0.62, 0.44, 1.1);
  for (const sx of [-1, 1]) {
    add(g, U.box, E, sx * 0.24, 0.55, 0, 0.3, 0.32, 1.02, 0, 0, sx * 0.45);
    add(g, U.box, P.metal, sx * 0.32, 0.72, 0, 0.16, 0.06, 1.0, 0, 0, sx * 0.45);
    for (let i = 0; i < 6; i++) add(g, U.cylX, P.dark, sx * 0.45, 0.45, -0.42 + i * 0.17, 0.12, 0.035, 0.035);
  }
  add(g, U.cylZ, P.metal, 0, 0.72, 0.1, 0.16, 0.16, 0.5);              // air cleaner
  add(g, U.cylZ, P.dark, 0, 0.35, 0.6, 0.3, 0.3, 0.08);                 // flywheel
  return 0.82;
}
function engineAbrams(g, P, E) {                       // gas turbine
  add(g, U.cylZ, E, 0, 0.42, 0.15, 0.36, 0.36, 1.35);
  add(g, U.box, E, 0, 0.42, -0.72, 0.95, 0.8, 0.42);                    // recuperator
  add(g, U.box, P.dark, 0, 0.42, -0.95, 0.85, 0.7, 0.04);
  add(g, U.cylZ, P.brass, 0, 0.42, 0.9, 0.22, 0.22, 0.3);               // accessory gearbox
  add(g, U.cyl, P.metal, 0.25, 0.75, 0.3, 0.1, 0.25, 0.1);
  for (let i = 0; i < 4; i++) add(g, U.cylZ, P.dark, 0, 0.42, -0.3 + i * 0.3, 0.38, 0.38, 0.03);
  return 0.84;
}
function engineAvre(g, P, E) {                         // opposed-piston multifuel
  add(g, U.box, E, 0, 0.4, 0, 0.85, 0.8, 1.2);
  add(g, U.box, P.metal, 0, 0.85, 0, 0.5, 0.1, 1.15);
  for (const sx of [-1, 1]) {
    add(g, U.box, P.dark, sx * 0.46, 0.55, 0, 0.08, 0.3, 1.15);          // manifolds
    for (let i = 0; i < 6; i++) add(g, U.cyl, P.brass, sx * 0.2, 0.9, -0.5 + i * 0.2, 0.03, 0.08, 0.03);
  }
  add(g, U.cylZ, P.dark, 0, 0.45, 0.65, 0.32, 0.32, 0.1);
  return 0.95;
}
function engineMarkV(g, P, E) {                        // straight-six petrol
  add(g, U.box, E, 0, 0.2, 0, 0.55, 0.4, 1.4);
  for (let i = 0; i < 6; i++) {
    add(g, U.cyl, E, 0, 0.65, -0.55 + i * 0.22, 0.1, 0.5, 0.1);
    add(g, U.cyl, P.brass, 0, 0.93, -0.55 + i * 0.22, 0.05, 0.06, 0.05);
  }
  add(g, U.cylZ, P.metal, 0, 0.42, -0.8, 0.4, 0.4, 0.1);               // flywheel
  add(g, U.box, P.brass, 0.3, 0.55, 0.3, 0.12, 0.2, 0.2);              // magneto
  add(g, U.cylZ, P.rust, -0.2, 0.9, 0, 0.05, 0.05, 1.3);               // exhaust manifold
  return 1.0;
}
const ENGINE_BUILDERS = { t55: engineT55, abrams: engineAbrams, avre: engineAvre, markV: engineMarkV };
export function buildEngine(key) {
  const P = mats(key);
  const g = new THREE.Group();
  const h = ENGINE_BUILDERS[key](g, P, P.engine);
  bake(g);
  g.userData = { markHost: true, groundY: 0, h };
  return { group: g, h };
}

// ===================================================================== external fuel tanks (origin: centre)
export function buildFuel(key) {
  const P = mats(key);
  const g = new THREE.Group();
  let groundY = 0.3;
  if (key === 't55') {
    for (const x of [-0.55, 0.55]) {
      add(g, U.cylX, P.dark, x, 0, 0, 0.95, 0.3, 0.3);
      for (const dx of [-0.3, 0.3]) add(g, U.cylX, P.main, x + dx, 0, 0, 0.04, 0.31, 0.31);
      add(g, U.cyl, P.metal, x + 0.35, 0.3, 0, 0.05, 0.04, 0.05);
    }
    add(g, U.box, P.metal, 0, -0.28, 0.1, 2.1, 0.04, 0.08);
  } else if (key === 'abrams') {
    add(g, U.box, P.dark, 0, -0.26, 0, 1.9, 0.04, 0.46);
    add(g, U.box, P.dark, 0, 0.26, 0.2, 1.9, 0.04, 0.04);
    for (let i = 0; i < 6; i++) {
      const x = -0.8 + i * 0.32;
      add(g, U.box, P.main, x, 0, 0, 0.26, 0.48, 0.4);
      add(g, U.box, P.dark, x, 0.26, 0.1, 0.12, 0.04, 0.06);
    }
    groundY = 0.26;
  } else if (key === 'avre') {
    for (const x of [-0.55, 0.55]) {
      add(g, U.cyl, P.dark, x, 0, 0, 0.3, 0.85, 0.3);
      for (const dy of [-0.25, 0.25]) add(g, U.cyl, P.main, x, dy, 0, 0.31, 0.04, 0.31);
      add(g, U.cyl, P.metal, x + 0.12, 0.44, 0, 0.05, 0.04, 0.05);
    }
    add(g, U.box, P.metal, 0, 0.1, 0.3, 1.9, 0.08, 0.04);
    groundY = 0.43;
  } else {
    add(g, sizedBox(1.6, 0.75, 0.66), P.main, 0, 0, 0);
    add(g, U.cyl, P.brass, 0.5, 0.4, 0, 0.08, 0.06, 0.08);
    add(g, U.box, P.dark, 0, 0, -0.34, 1.4, 0.5, 0.02);
    groundY = 0.38;
  }
  bake(g);
  g.userData = { markHost: true, groundY };
  return { group: g };
}

// ===================================================================== turret drives (origin: ring centre)
const DRIVE_R = { t55: 1.0, abrams: 1.05, avre: 1.0 };
export function buildDrive(key) {
  const P = mats(key);
  const g = new THREE.Group();
  if (key === 'markV') {
    add(g, U.box, P.engine, 0, 0.15, 0, 0.4, 0.3, 0.3);
    add(g, new THREE.TorusGeometry(0.16, 0.025, 6, 16), P.metal, 0.25, 0.2, 0, 1, 1, 1, 0, PI / 2, 0);
  } else {
    const r = DRIVE_R[key];
    add(g, new THREE.TorusGeometry(r, 0.07, 6, 36).rotateX(PI / 2), P.steel, 0, 0.08, 0);
    add(g, new THREE.TorusGeometry(r - 0.1, 0.03, 4, 36).rotateX(PI / 2), P.brass, 0, 0.1, 0);
    add(g, U.box, P.engine, r - 0.05, 0.2, 0.3, 0.32, 0.3, 0.4);            // gearbox
    add(g, U.cylX, P.dark, r - 0.35, 0.25, 0.3, 0.3, 0.1, 0.1);            // electric motor
    add(g, new THREE.TorusGeometry(0.14, 0.02, 6, 16), P.metal, r - 0.05, 0.25, 0.55, 1, 1, 1, 0, 0, 0);   // handwheel
  }
  bake(g);
  g.userData = { markHost: true, groundY: 0.02 };
  return { group: g };
}

// ===================================================================== crew compartments
const IMAT = {
  wall: new THREE.MeshStandardMaterial({ color: 0xa3b39c, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide }),
  floor: new THREE.MeshStandardMaterial({ color: 0x4f5249, roughness: 0.95, metalness: 0.2, side: THREE.DoubleSide }),
  fire: new THREE.MeshStandardMaterial({ color: 0x8a948a, roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide }),
  seat: new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2b2d28, roughness: 0.7, metalness: 0.4 }),
  box: new THREE.MeshStandardMaterial({ color: 0x5e6a52, roughness: 0.8, metalness: 0.2 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc09a45, roughness: 0.35, metalness: 0.85 }),
  dial: new THREE.MeshBasicMaterial({ color: 0xd9e8c4 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }),
  red: new THREE.MeshStandardMaterial({ color: 0xa02a20, roughness: 0.6 }),
};

function ibox(parent, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, geo = U.box) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function breaks(a, b, step, extra = []) {
  const s = new Set();
  for (let x = a; x < b - 1e-6; x += step) s.add(+x.toFixed(4));
  s.add(+b.toFixed(4));
  for (const e of extra) if (e > a && e < b) s.add(+e.toFixed(4));
  return [...s].sort((p, q) => p - q);
}

// quads on the plane o + a*u + b*v, skipping cells whose centre fails keep(u, v)
function panel(o, a, b, us, vs, keep) {
  const pos = [], nrm = [];
  const n = new THREE.Vector3().crossVectors(a, b).normalize();
  const P = (u, v) => [o.x + a.x * u + b.x * v, o.y + a.y * u + b.y * v, o.z + a.z * u + b.z * v];
  for (let i = 0; i < us.length - 1; i++) {
    for (let j = 0; j < vs.length - 1; j++) {
      if (keep && !keep((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2, us[i], us[i + 1], vs[j], vs[j + 1])) continue;
      const p00 = P(us[i], vs[j]), p10 = P(us[i + 1], vs[j]), p11 = P(us[i + 1], vs[j + 1]), p01 = P(us[i], vs[j + 1]);
      pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      for (let k = 0; k < 6; k++) nrm.push(n.x, n.y, n.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}
function addPanel(parent, geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);
const inRect = (u, v, r) => u > r.x[0] && u < r.x[1] && v > r.y[0] && v < r.y[1];

function seat(parent, x, y, z, ry = 0) {
  const s = new THREE.Group();
  s.position.set(x, y, z);
  s.rotation.y = ry;
  ibox(s, IMAT.seat, 0, 0, 0, 0.42, 0.08, 0.4);
  ibox(s, IMAT.seat, 0, 0.25, -0.2, 0.42, 0.45, 0.07);
  ibox(s, IMAT.dark, 0, -0.25, 0, 0.06, 0.45, 0.06);
  parent.add(s);
  return s;
}

function lamp(parent, x, y, z) {
  ibox(parent, IMAT.dark, x, y + 0.03, z, 0.14, 0.04, 0.1);
  ibox(parent, IMAT.lamp, x, y - 0.01, z, 0.1, 0.04, 0.06);
}

function shells(parent, r, y0, h, horizontal = false) {
  const geo = U.cyl;
  for (let x = r.x[0] + 0.07; x < r.x[1] - 0.04; x += 0.13) {
    for (let z = r.z[0] + 0.07; z < r.z[1] - 0.04; z += 0.13) {
      if (horizontal) ibox(parent, IMAT.brass, x, y0, z, 0.05, h, 0.05, PI / 2, 0, 0, geo);
      else {
        ibox(parent, IMAT.brass, x, y0 + h / 2, z, 0.05, h, 0.05, 0, 0, 0, geo);
        ibox(parent, IMAT.dark, x, y0 + h + 0.1, z, 0.04, 0.2, 0.04, 0, 0, 0, geo);
      }
    }
  }
}

// hull crew compartment (hull-local coordinates)
export function buildHullInterior(key, hv) {
  const H = HULLS[key], I = H.interior;
  const g = new THREE.Group();
  g.userData.interior = true;
  const x = I.x, f = I.floor, r = I.roof - 0.04, [z0, z1] = I.z;     // stay clear of the outer skin
  const ring = hv.ring, cab = I.cab;
  // floor
  addPanel(g, panel(V(0, f, 0), AX, AZ, breaks(-x, x, 0.3), breaks(z0, z1, 0.3)), IMAT.floor);
  // roof with the turret ring / cab openings
  const holeR = ring ? ring.r - 0.04 : 0;
  addPanel(g, panel(V(0, r, 0), AX, AZ, breaks(-x, x, 0.05, cab ? [-cab.x, cab.x] : []),
    breaks(z0, z1, 0.05, cab ? cab.z : []), (u, v) => {
      if (ring && Math.hypot(u - ring.pos.x, v - ring.pos.z) < holeR) return false;
      if (cab && Math.abs(u) < cab.x && v > cab.z[0] && v < cab.z[1]) return false;
      return true;
    }), IMAT.wall);
  if (ring) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(holeR, 0.05, 6, 40).rotateX(PI / 2), IMAT.dark);
    rim.position.set(ring.pos.x, r - 0.03, ring.pos.z);
    g.add(rim);
  }
  // side walls (with vision / MG ports)
  const ss = I.sideSlits || [];
  for (const sx of [-1, 1]) {
    const zs = breaks(z0, z1, 0.3, ss.flatMap(s => s.z)), ys = breaks(f, r, 0.3, ss.flatMap(s => s.y));
    addPanel(g, panel(V(sx * x, 0, 0), AZ, AY, zs, ys, (u, v) => !ss.some(s => u > s.z[0] && u < s.z[1] && v > s.y[0] && v < s.y[1])), IMAT.wall);
  }
  // front wall with the driver's vision slits
  const top = cab ? cab.top : r;
  const slits = I.slits || [];
  addPanel(g, panel(V(0, 0, z1), AX, AY, breaks(-x, x, 0.2, slits.flatMap(s => s.x)), breaks(f, top, 0.2, slits.flatMap(s => s.y)),
    (u, v) => {
      if (slits.some(s => inRect(u, v, s))) return false;
      if (cab && v > r && Math.abs(u) > cab.x) return false;
      return true;
    }), IMAT.wall);
  // rear bulkhead (engine compartment behind it)
  addPanel(g, panel(V(0, 0, z0), AX, AY, breaks(-x, x, 0.4), breaks(f, r, 0.4)), IMAT.fire);
  for (let i = 0; i < 5; i++) ibox(g, IMAT.dark, 0, f + 0.2 + i * 0.16, z0 + 0.02, x * 1.4, 0.04, 0.02);
  if (cab) {
    // raised cab: side walls, roof, platform
    for (const sx of [-1, 1]) addPanel(g, panel(V(sx * cab.x, 0, 0), AZ, AY, breaks(cab.z[0], cab.z[1], 0.3), breaks(r, cab.top, 0.2)), IMAT.wall);
    addPanel(g, panel(V(0, 0, cab.z[0]), AX, AY, breaks(-cab.x, cab.x, 0.3), breaks(r, cab.top, 0.2)), IMAT.wall);
    addPanel(g, panel(V(0, cab.top, 0), AX, AZ, breaks(-cab.x, cab.x, 0.3), breaks(cab.z[0], cab.z[1], 0.3)), IMAT.wall);
    ibox(g, IMAT.floor, 0, cab.floor - 0.05, (cab.z[0] + cab.z[1]) / 2 + 0.05, cab.x * 2, 0.1, cab.z[1] - cab.z[0] - 0.1);
    ibox(g, IMAT.dark, 0, (f + cab.floor) / 2, cab.z[0] + 0.1, cab.x * 2, cab.floor - f, 0.04);
    for (let k = 0; k < 4; k++) ibox(g, IMAT.dark, 0.6, f + 0.2 + k * 0.28, cab.z[0] - 0.12, 0.35, 0.04, 0.22);   // ladder
    lamp(g, 0, cab.top - 0.02, (cab.z[0] + cab.z[1]) / 2);
  }
  // ammunition
  if (I.ammo) {
    const rh = Math.min(0.7, r - f - 0.45);
    ibox(g, IMAT.box, (I.ammo.x[0] + I.ammo.x[1]) / 2, f + 0.05, (I.ammo.z[0] + I.ammo.z[1]) / 2,
      I.ammo.x[1] - I.ammo.x[0], 0.1, I.ammo.z[1] - I.ammo.z[0]);
    shells(g, I.ammo, f + 0.1, rh);
  }
  // crew seats & driver controls
  for (const [role, s] of Object.entries(H.seats)) {
    seat(g, s.pos[0], s.pos[1], s.pos[2]);
    if (role === 'driver') {
      const [ex, ey, ez] = s.eye;
      for (const dx of [-0.2, 0.2]) {
        ibox(g, IMAT.dark, ex + dx, ey - 0.45, ez - 0.08, 0.03, 0.5, 0.03, 0.5, 0, 0, U.cyl);          // steering levers
        ibox(g, IMAT.red, ex + dx, ey - 0.22, ez + 0.03, 0.035, 0.08, 0.035, 0, 0, 0, U.sph);
      }
      const dash = new THREE.Group();
      dash.position.set(ex, ey - 0.2, ez + 0.2);
      ibox(dash, IMAT.dark, 0, 0, 0, 0.55, 0.16, 0.05);
      for (let i = 0; i < 4; i++) ibox(dash, IMAT.dial, -0.2 + i * 0.13, 0, -0.03, 0.04, 0.04, 0.01, PI / 2, 0, 0, U.cyl);
      g.add(dash);
      for (const dx of [-0.15, 0, 0.15]) ibox(g, IMAT.dark, ex + dx, f + 0.08, ez + 0.25, 0.08, 0.03, 0.14, -0.4, 0, 0);   // pedals
    }
  }
  // wall clutter: fuel cell, radio, extinguisher, lamps
  ibox(g, IMAT.box, -x + 0.18, f + 0.35, (z0 + z1) / 2 - 0.4, 0.3, 0.6, 0.8);
  ibox(g, IMAT.red, x - 0.1, f + 0.5, z0 + 0.35, 0.12, 0.4, 0.12, 0, 0, 0, U.cyl);
  lamp(g, 0.3, r - 0.03, z0 + 0.4);
  if (!ring) lamp(g, -0.3, r - 0.03, (z0 + z1) / 2);
  return g;
}

// ---- turret compartments (turret-local coordinates)
const TI = {
  t55: { dome: true, cupola: { x: 0.52, z: -0.3, r: 0.3, y0: 0.66, band: [0.82, 0.92], top: 0.94 } },
  abrams: {
    poly: [[0.55, 1.86], [1.72, 1.15], [1.72, -1.35], [-1.72, -1.35], [-1.72, 1.15], [-0.55, 1.86]], h: 0.76,
    cupola: { x: -0.72, z: -0.25, r: 0.31, y0: 0.76, band: [0.9, 1.02], top: 1.06 },
  },
  avre: {
    poly: [[0.42, 1.55], [1.2, 0.95], [1.38, -0.2], [1.28, -1.45], [0.8, -1.78], [-0.8, -1.78], [-1.28, -1.45], [-1.38, -0.2], [-1.2, 0.95], [-0.42, 1.55]], h: 0.82,
    cupola: { x: -0.55, z: -0.55, r: 0.3, y0: 0.8, band: [0.95, 1.08], top: 1.14 },
  },
};

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// geometry of a turret interior's ceiling height at (x, z), used for the free-walk eye height
export function turretCeiling(key, x, z) {
  const t = TI[key];
  if (!t) return 0;
  if (t.dome) {
    const rn = Math.hypot(x / 1.13, z / (1.13 * 1.12));
    return rn >= 1 ? 0 : 0.05 + 1.13 * 0.72 * Math.sqrt(1 - rn * rn);
  }
  return pointInPoly(x, z, t.poly) ? t.h : 0;
}

function cupolaInterior(g, c) {
  const wall = (y0, y1) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, y1 - y0, 20, 1, true), IMAT.wall);
    m.position.set(c.x, (y0 + y1) / 2, c.z);
    g.add(m);
  };
  wall(c.y0, c.band[0]);
  wall(c.band[1], c.top);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * PI * 2 + 0.3;
    ibox(g, IMAT.dark, c.x + Math.sin(a) * c.r, (c.band[0] + c.band[1]) / 2, c.z + Math.cos(a) * c.r, 0.05, c.band[1] - c.band[0], 0.05);
  }
  const roof = new THREE.Mesh(U.disc, IMAT.wall);
  roof.position.set(c.x, c.top, c.z);
  roof.scale.set(c.r, 1, c.r);
  g.add(roof);
  ibox(g, IMAT.dark, c.x, c.band[0] - 0.02, c.z, c.r * 2.1, 0.04, c.r * 2.1, 0, 0, 0, U.cyl);
}

export function buildTurretInterior(key) {
  const T = TURRETS[key], t = TI[key];
  const g = new THREE.Group();
  g.userData.interior = true;
  const c = t.cupola;
  if (t.dome) {
    const d = new THREE.SphereGeometry(1.13, 36, 16, 0, PI * 2, 0, PI / 2).toNonIndexed();
    d.scale(1.0, 0.72, 1.12);
    const p = d.attributes.position, n = d.attributes.normal;
    const keepPos = [], keepN = [];
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      if (Math.hypot(cx - c.x, cz - c.z) < c.r) continue;
      for (let k = 0; k < 3; k++) { keepPos.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k)); keepN.push(n.getX(i + k), n.getY(i + k), n.getZ(i + k)); }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(keepPos, 3));
    dg.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
    const m = addPanel(g, dg, IMAT.wall);
    m.position.y = 0.05;
    // radio + ready rack in the bustle
    ibox(g, IMAT.box, 0, 0.3, -1.02, 0.7, 0.3, 0.2);
    for (let i = 0; i < 4; i++) ibox(g, IMAT.dial, -0.2 + i * 0.13, 0.35, -0.91, 0.03, 0.01, 0.03, PI / 2, 0, 0, U.cyl);
    for (let i = 0; i < 5; i++) ibox(g, IMAT.brass, -0.55, 0.22 + (i % 2) * 0.11, -0.95 + i * 0.12, 0.05, 0.6, 0.05, 0, 0, PI / 2, U.cyl);
  } else {
    const poly = t.poly, h = t.h;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const dir = V(bx - ax, 0, bz - az);
      const len = dir.length();
      dir.normalize();
      addPanel(g, panel(V(ax, 0, az), dir, AY, breaks(0, len, 0.4), breaks(-0.02, h, 0.4)), IMAT.wall);
    }
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    // a cell stays if any corner is inside: overhang goes outside the walls instead of leaving gaps
    addPanel(g, panel(V(0, h, 0), AX, AZ, breaks(x0, x1, 0.05), breaks(z0, z1, 0.05),
      (u, v, ua, ub, va, vb) => (pointInPoly(ua, va, poly) || pointInPoly(ub, va, poly) || pointInPoly(ua, vb, poly) ||
        pointInPoly(ub, vb, poly)) && Math.hypot(u - c.x, v - c.z) > c.r), IMAT.wall);
    // bustle wall / radio
    const zb = Math.min(...poly.map(p => p[1]));
    ibox(g, IMAT.box, 0.4, 0.35, zb + 0.12, 0.7, 0.35, 0.2);
    for (let i = 0; i < 4; i++) ibox(g, IMAT.dial, 0.2 + i * 0.13, 0.4, zb + 0.23, 0.03, 0.01, 0.03, PI / 2, 0, 0, U.cyl);
    ibox(g, IMAT.dark, -0.5, 0.4, zb + 0.03, 0.9, 0.6, 0.03);             // blast door
    for (let i = 0; i < 6; i++) ibox(g, IMAT.brass, 0.85, 0.2 + (i % 2) * 0.11, zb + 0.3 + i * 0.12, 0.05, 0.55, 0.05, 0, 0, PI / 2, U.cyl);
  }
  cupolaInterior(g, c);
  // seats, gunner's sight eyepiece and handwheels
  for (const [role, s] of Object.entries(T.seats)) {
    seat(g, s.pos[0], s.pos[1], s.pos[2]);
    const [ex, ey, ez] = s.eye;
    if (role === 'gunner') {
      ibox(g, IMAT.dark, ex, ey - 0.26, ez + 0.38, 0.12, 0.14, 0.26);
      ibox(g, IMAT.seat, ex, ey - 0.23, ez + 0.23, 0.04, 0.05, 0.04, PI / 2, 0, 0, U.cyl);
      const hw = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 16), IMAT.dark);
      hw.position.set(ex + 0.12, ey - 0.28, ez + 0.18);
      g.add(hw);
      ibox(g, IMAT.red, ex - 0.1, ey - 0.3, ez + 0.2, 0.03, 0.12, 0.03, 0.4, 0, 0, U.cyl);
    } else {
      ibox(g, IMAT.dark, ex, ey - 0.28, ez + 0.28, 0.25, 0.04, 0.04);
    }
  }
  lamp(g, 0, (t.dome ? 0.8 : t.h) - 0.03, -0.4);
  return g;
}

// ===================================================================== plain materials for item markers etc.
export const COMMON = { U, add };
