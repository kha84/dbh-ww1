// Shared toolkit for the procedural tank models: unit geometries, per-tank materials, mesh helpers,
// merging static meshes ("bake"), profile / plan extrusions, running gear, engine deck, cupolas,
// generic engines and fuel tank sets. Tank-specific models live in tankdefs/<key>.js and use these.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { spinUniform, spinMaterial } from './spin.js';

export const PI = Math.PI;

// ===================================================================== shared geometry / materials
export const U = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cylX: new THREE.CylinderGeometry(1, 1, 1, 18).rotateZ(PI / 2),
  cylZ: new THREE.CylinderGeometry(1, 1, 1, 16).rotateX(PI / 2),
  cylZ8: new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(PI / 2),
  sph: new THREE.SphereGeometry(1, 16, 10),
  hemi: new THREE.SphereGeometry(1, 20, 8, 0, PI * 2, 0, PI / 2),
  disc: new THREE.CircleGeometry(1, 28).rotateX(-PI / 2),
  cone: new THREE.ConeGeometry(1, 1, 12),
};

// palettes { main, dark, engine[, riveted] } registered by the tank definitions (tankdefs/index.js)
export const PALETTES = {};

export function rivetTexture(base, dark) {
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

const hex = n => '#' + n.toString(16).padStart(6, '0');
const matCache = {};
let GRILLE = null;
// materials of a tank type (its palette + common ones)
export function mats(key) {
  if (matCache[key]) return matCache[key];
  const p = PALETTES[key];
  const S = (color, r = 0.85, m = 0.15, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
  if (!GRILLE) GRILLE = grilleTexture();
  const m = {
    main: S(p.main), dark: S(p.dark, 0.9, 0.1),
    track: S(0x2c2a26, 0.95, 0.3), rubber: S(0x1a1a1a, 1, 0), metal: S(0x3a3a38, 0.6, 0.6),
    steel: S(0x6f7274, 0.45, 0.7), glass: S(0xd8e6ee, 0.1, 0.4, { emissive: 0x222222 }),
    wood: S(0x6b4f33, 1, 0), black: S(0x151515, 0.9, 0.2), rust: S(0x7a4a2a, 0.9, 0.3),
    brass: S(0xb8903a, 0.4, 0.8), engine: S(p.engine, 0.55, 0.55), red: S(0x9a2a20, 0.6, 0.2),
    grille: S(0xffffff, 0.9, 0.3, { map: GRILLE }),
    hole: new THREE.MeshBasicMaterial({ color: 0x080806 }),
  };
  if (p.riveted) {
    const dk = new THREE.Color(p.dark).multiplyScalar(0.62).getHex();
    m.main = S(0xffffff, 0.85, 0.15, { map: rivetTexture(hex(p.main), hex(dk)) });
    m.dark = S(0xffffff, 0.9, 0.1, { map: rivetTexture(hex(p.dark), hex(new THREE.Color(p.dark).multiplyScalar(0.55).getHex())) });
  }
  // the paint of the tank: these surfaces change colour when the tank is repainted (see paint.js)
  m.main.userData.paint = 'main';
  m.dark.userData.paint = 'dark';
  matCache[key] = m;
  return m;
}

export function add(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
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
// (moving parts, toggled pieces) and interiors are left alone. Painted surfaces (materials with
// userData.paint) are remembered: vertex ranges of the coloured mesh (userData.paint = [[start, count, role]..])
// or the role of a textured mesh (userData.paintRole) - paint.js recolours them.
const VC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.2 });
export function bake(node) {
  node.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  const ranges = [];
  let vcCount = 0;
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
          if (mat.userData.paint) ranges.push([vcCount, n, mat.userData.paint]);
          vcCount += n;
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
    if (mat === VC_MAT && ranges.length) m.userData.paint = ranges;
    else if (mat.userData.paint) m.userData.paintRole = mat.userData.paint;
    node.add(m);
  }
  return node;
}
export const keep = o => { o.userData.keep = true; return o; };

// box spanning two points in the ZY plane (track runs, arms)
export function link(parent, mat, x, w, z1, y1, z2, y2, t = 0.08) {
  const len = Math.hypot(z2 - z1, y2 - y1);
  return add(parent, U.box, mat, x, (y1 + y2) / 2, (z1 + z2) / 2, w, t, len, -Math.atan2(y2 - y1, z2 - z1), 0, 0);
}

// side profile (z, y) extruded across X, centred
export function hullProfile(pts, width) {
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
export function prism(plan, h, topScale = 1, topShiftZ = 0) {
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
export function worldUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return geo;
}
export const sizedBox = (w, h, d) => worldUV(new THREE.BoxGeometry(w, h, d));

// oval plan [x, z] for cast turrets: half width rx, front zf, rear zr
export function ovalPlan(rx, zf, zr, n = 16) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * PI * 2;
    const c = Math.cos(a);
    pts.push([rx * Math.sin(a), c * (c > 0 ? zf : zr)]);
  }
  return pts;
}
export const scalePlan = (plan, k) => plan.map(([x, z]) => [x * k, z * k]);
export const planBox = (plan, h) => {
  const xs = plan.map(p => p[0]), zs = plan.map(p => p[1]);
  return new THREE.Box3(new THREE.Vector3(Math.min(...xs), 0, Math.min(...zs)), new THREE.Vector3(Math.max(...xs), h, Math.max(...zs)));
};

// polygon offset (for track belts around a frame)
export function offsetPoly(pts, d) {
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

// ===================================================================== running gear
// road wheels, idler, sprocket and a track made of flat runs.
// o: { x, w, wheels: [z..], wr, wy, idler: [z, y, r], sprocket: [z, y, r], wheelMat, spokes, topRun: [[z, y]..] }
export function runningGear(root, P, o) {
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
      if (o.spokes !== false) {
        add(w, U.box, P.dark, 0, 0, 0, ww * 1.06, o.wr * 1.3, o.wr * 0.18);         // spokes: show rotation
        add(w, U.box, P.dark, 0, 0, 0, ww * 1.06, o.wr * 0.18, o.wr * 1.3);
      }
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
    const gy = o.groundY ?? 0.04;
    if (o.topRun) {                                                                          // sagging / supported top run
      const pts = [[iz, iy + ir + t / 2], ...o.topRun, [sz, sy + sr + t / 2]];
      for (let i = 0; i < pts.length - 1; i++) link(root, P.track, X, o.w, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], t);
    } else link(root, P.track, X, o.w, iz, iy + ir + t / 2, sz, sy + sr + t / 2, t);             // top run
    link(root, P.track, X, o.w, zf, gy, zr, gy, t);                                         // ground run
    link(root, P.track, X, o.w, zf, gy, iz + ir * 0.6, iy - ir * 0.3, t);                   // front
    link(root, P.track, X, o.w, iz + ir * 0.6, iy - ir * 0.3, iz + ir * 0.35, iy + ir, t);
    link(root, P.track, X, o.w, zr, gy, sz - sr * 0.6, sy - sr * 0.3, t);                   // rear
    link(root, P.track, X, o.w, sz - sr * 0.6, sy - sr * 0.3, sz - sr * 0.35, sy + sr, t);
  }
  return [mergeWheels(root, wheels)];
}

// Merge wheel groups (each already baked) into one mesh per material that turns in the vertex shader (spin.js).
// Returns a stand-in for the wheels: its rotation.x is the angle of all of them (the tank turns it as it drives).
export function mergeWheels(root, groups) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const u = spinUniform();
  const buckets = new Map();                        // material -> [{ geo, ranges }]
  const c = new THREE.Vector3();
  for (const g of groups) {
    c.setFromMatrixPosition(g.matrixWorld).applyMatrix4(inv);
    for (const m of g.children) {
      if (!m.isMesh) continue;
      const geo = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const n = geo.attributes.position.count, cen = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.toArray(cen, i * 3);
      geo.setAttribute('wheelC', new THREE.BufferAttribute(cen, 3));
      if (!buckets.has(m.material)) buckets.set(m.material, []);
      buckets.get(m.material).push({ geo, ranges: m.userData.paint, role: m.userData.paintRole });
    }
    g.removeFromParent();
  }
  for (const [mat, list] of buckets) {
    const merged = new THREE.Mesh(mergeGeometries(list.map(e => e.geo), false), spinMaterial(mat, u));
    merged.castShadow = true; merged.receiveShadow = true;
    // painted surfaces: vertex ranges (shifted into the merged mesh) or the role of a textured material
    let off = 0;
    const ranges = [];
    for (const e of list) {
      if (e.ranges) for (const [s, n, r] of e.ranges) ranges.push([s + off, n, r]);
      off += e.geo.attributes.position.count;
    }
    if (ranges.length) merged.userData.paint = ranges;
    else if (list[0].role) merged.userData.paintRole = list[0].role;
    merged.userData.spin = u;                          // paint.js keeps the turning when it swaps the material
    keep(merged);
    root.add(merged);
  }
  const spinner = { rotation: { get x() { return u.value; }, set x(v) { u.value = v % (Math.PI * 2); } } };
  return spinner;
}

// return rollers above the wheels
export function returnRollers(root, P, x, zs, y, r = 0.07) {
  for (const sx of [-1, 1]) for (const z of zs) add(root, U.cylX, P.dark, sx * x, y, z, 0.2, r, r);
}

// engine deck hatch hinged at its rear edge + dark opening shown while it is open
export function engineDeck(root, P, center, w, l, mat) {
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
export function ringHole(root, P, pos, r) {
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

// the usual result of a hull builder with a turret ring
export function hullResult(root, P, o) {
  const ring = o.ring;
  return {
    root, wheels: o.wheels, wheelR: o.wheelR, ring, bay: o.bay,
    box: o.box, fuelAt: o.fuelAt, fuelRot: o.fuelRot || 0,
    driveAt: o.driveAt || ring.pos.clone(),
    ringHole: ringHole(root, P, ring.pos, o.holeR || ring.r - 0.02),
    ...(o.extra || {}),
  };
}

// cupola: cylinder with a vision band
export function cupola(g, P, x, z, r, y0, band, top) {
  add(g, U.cyl, P.main, x, (y0 + band[0]) / 2, z, r, band[0] - y0, r);
  add(g, U.cyl, P.glass, x, (band[0] + band[1]) / 2, z, r * 0.97, band[1] - band[0], r * 0.97);
  add(g, U.cyl, P.main, x, (band[1] + top) / 2, z, r, top - band[1], r);
  add(g, U.cyl, P.dark, x, top + 0.02, z, r * 0.9, 0.04, r * 0.9);
}

// ===================================================================== guns
export function interiorGroup(parent) {
  const g = new THREE.Group();
  g.userData.interior = true;
  g.visible = false;
  parent.add(g);
  return g;
}

// gun breech, seen only from inside
export function breech(parent, P, w, h, len) {
  const ig = interiorGroup(parent);
  const m1 = add(ig, U.box, P.steel, 0, 0, -len / 2, w, h, len);
  const m2 = add(ig, U.box, P.metal, 0, -h * 0.15, -len - 0.12, w * 1.3, h * 1.2, 0.08);   // recoil guard
  const m3 = add(ig, U.box, P.brass, 0, h * 0.6, -len * 0.4, 0.06, 0.06, len * 0.6);
  for (const m of [m1, m2, m3]) m.castShadow = false;
  return ig;
}

// tapered barrel along +Z from z0, length len, radius r0 -> r1
export function barrel(g, mat, z0, len, r0, r1 = r0, y = 0, x = 0) {
  return add(g, new THREE.CylinderGeometry(r1, r0, len, 14).rotateX(PI / 2), mat, x, y, z0 + len / 2);
}

// ===================================================================== engines (origin: bottom centre, return height)
export const ENGINE_TYPES = {
  v12diesel(g, P, E) {
    add(g, U.box, E, 0, 0.22, 0, 0.62, 0.44, 1.1);
    for (const sx of [-1, 1]) {
      add(g, U.box, E, sx * 0.24, 0.55, 0, 0.3, 0.32, 1.02, 0, 0, sx * 0.45);
      add(g, U.box, P.metal, sx * 0.32, 0.72, 0, 0.16, 0.06, 1.0, 0, 0, sx * 0.45);
      for (let i = 0; i < 6; i++) add(g, U.cylX, P.dark, sx * 0.45, 0.45, -0.42 + i * 0.17, 0.12, 0.035, 0.035);
    }
    add(g, U.cylZ, P.metal, 0, 0.72, 0.1, 0.16, 0.16, 0.5);              // air cleaner
    add(g, U.cylZ, P.dark, 0, 0.35, 0.6, 0.3, 0.3, 0.08);                 // flywheel
    return 0.82;
  },
  turbine(g, P, E) {
    add(g, U.cylZ, E, 0, 0.42, 0.15, 0.36, 0.36, 1.35);
    add(g, U.box, E, 0, 0.42, -0.72, 0.95, 0.8, 0.42);                    // recuperator
    add(g, U.box, P.dark, 0, 0.42, -0.95, 0.85, 0.7, 0.04);
    add(g, U.cylZ, P.brass, 0, 0.42, 0.9, 0.22, 0.22, 0.3);               // accessory gearbox
    add(g, U.cyl, P.metal, 0.25, 0.75, 0.3, 0.1, 0.25, 0.1);
    for (let i = 0; i < 4; i++) add(g, U.cylZ, P.dark, 0, 0.42, -0.3 + i * 0.3, 0.38, 0.38, 0.03);
    return 0.84;
  },
  multifuel(g, P, E) {                                                    // opposed-piston / big modern block
    add(g, U.box, E, 0, 0.4, 0, 0.85, 0.8, 1.2);
    add(g, U.box, P.metal, 0, 0.85, 0, 0.5, 0.1, 1.15);
    for (const sx of [-1, 1]) {
      add(g, U.box, P.dark, sx * 0.46, 0.55, 0, 0.08, 0.3, 1.15);          // manifolds
      for (let i = 0; i < 6; i++) add(g, U.cyl, P.brass, sx * 0.2, 0.9, -0.5 + i * 0.2, 0.03, 0.08, 0.03);
    }
    add(g, U.cylZ, P.dark, 0, 0.45, 0.65, 0.32, 0.32, 0.1);
    return 0.95;
  },
  ricardo(g, P, E) {                                                      // big WW1 straight-six petrol
    add(g, U.box, E, 0, 0.2, 0, 0.55, 0.4, 1.4);
    for (let i = 0; i < 6; i++) {
      add(g, U.cyl, E, 0, 0.65, -0.55 + i * 0.22, 0.1, 0.5, 0.1);
      add(g, U.cyl, P.brass, 0, 0.93, -0.55 + i * 0.22, 0.05, 0.06, 0.05);
    }
    add(g, U.cylZ, P.metal, 0, 0.42, -0.8, 0.4, 0.4, 0.1);               // flywheel
    add(g, U.box, P.brass, 0.3, 0.55, 0.3, 0.12, 0.2, 0.2);              // magneto
    add(g, U.cylZ, P.rust, -0.2, 0.9, 0, 0.05, 0.05, 1.3);               // exhaust manifold
    return 1.0;
  },
  // small inline petrol engine (n cylinders, scale s)
  petrol(g, P, E, n = 6, s = 1) {
    const len = (0.25 + n * 0.2) * s;
    add(g, U.box, E, 0, 0.2 * s, 0, 0.5 * s, 0.4 * s, len);
    for (let i = 0; i < n; i++) {
      const z = -len / 2 + (i + 0.5) * len / n;
      add(g, U.cyl, E, 0, 0.6 * s, z, 0.1 * s, 0.4 * s, 0.1 * s);
      add(g, U.cyl, P.brass, 0, 0.84 * s, z, 0.05 * s, 0.06 * s, 0.05 * s);
    }
    add(g, U.cylZ, P.metal, 0, 0.4 * s, -len / 2 - 0.05, 0.36 * s, 0.36 * s, 0.1);
    add(g, U.box, P.brass, 0.28 * s, 0.5 * s, len * 0.2, 0.12, 0.18, 0.18);
    add(g, U.cylZ, P.rust, -0.2 * s, 0.8 * s, 0, 0.05, 0.05, len * 0.9);
    return 0.9 * s;
  },
  // aero V-12 petrol (BT-7's M-17): two banks of cylinders, big carburettors
  aeroV12(g, P, E, s = 1) {
    add(g, U.box, E, 0, 0.2 * s, 0, 0.55 * s, 0.4 * s, 1.5 * s);
    for (const sx of [-1, 1]) {
      add(g, U.box, E, sx * 0.24 * s, 0.55 * s, 0, 0.26 * s, 0.34 * s, 1.4 * s, 0, 0, sx * 0.5);
      add(g, U.box, P.brass, sx * 0.34 * s, 0.73 * s, 0, 0.1 * s, 0.05 * s, 1.35 * s, 0, 0, sx * 0.5);
      for (let i = 0; i < 6; i++) add(g, U.cylX, P.rust, sx * 0.44 * s, 0.5 * s, (-0.55 + i * 0.22) * s, 0.12 * s, 0.03, 0.03);
    }
    add(g, U.cyl, P.metal, 0, 0.7 * s, 0.35 * s, 0.1 * s, 0.25 * s, 0.1 * s);   // carburettors
    add(g, U.cyl, P.metal, 0, 0.7 * s, -0.35 * s, 0.1 * s, 0.25 * s, 0.1 * s);
    add(g, U.cylZ, P.dark, 0, 0.35 * s, 0.8 * s, 0.3 * s, 0.3 * s, 0.08);
    return 0.86 * s;
  },
};

// ===================================================================== external fuel tanks (origin: centre)
// set builders return the height of the lowest point below the origin (groundY)
export const FUEL_TYPES = {
  // n horizontal drums across the rear
  drums(g, P, o = {}) {
    const r = o.r || 0.3, len = o.len || 0.95, xs = o.xs || [-0.55, 0.55];
    for (const x of xs) {
      add(g, U.cylX, P.dark, x, 0, 0, len, r, r);
      for (const dx of [-len * 0.32, len * 0.32]) add(g, U.cylX, P.main, x + dx, 0, 0, 0.04, r + 0.01, r + 0.01);
      add(g, U.cyl, P.metal, x + len * 0.37, r, 0, 0.05, 0.04, 0.05);
    }
    add(g, U.box, P.metal, 0, -r + 0.02, 0.1, (xs[xs.length - 1] - xs[0]) + len + 0.05, 0.04, 0.08);
    return r;
  },
  // rack of jerrycans
  cans(g, P, o = {}) {
    const n = o.n || 6, h = o.h || 0.48, d = o.d || 0.4, w = o.w || 0.26;
    const span = (n - 1) * (w + 0.06);
    add(g, U.box, P.dark, 0, -h / 2 - 0.02, 0, span + w + 0.1, 0.04, d + 0.06);
    if (o.rail !== false) add(g, U.box, P.dark, 0, h / 2 + 0.02, d / 2, span + w + 0.1, 0.04, 0.04);
    for (let i = 0; i < n; i++) {
      const x = -span / 2 + i * (w + 0.06);
      add(g, U.box, P.main, x, 0, 0, w, h, d);
      add(g, U.box, P.dark, x, h / 2 + 0.02, d * 0.25, w * 0.45, 0.04, 0.06);
    }
    return h / 2 + 0.02;
  },
  // upright cylinders
  upright(g, P, o = {}) {
    const r = o.r || 0.3, h = o.h || 0.85, xs = o.xs || [-0.55, 0.55];
    for (const x of xs) {
      add(g, U.cyl, P.dark, x, 0, 0, r, h, r);
      for (const dy of [-h * 0.3, h * 0.3]) add(g, U.cyl, P.main, x, dy, 0, r + 0.01, 0.04, r + 0.01);
      add(g, U.cyl, P.metal, x + r * 0.4, h / 2 + 0.02, 0, 0.05, 0.04, 0.05);
    }
    add(g, U.box, P.metal, 0, 0.1, r, (xs[xs.length - 1] - xs[0]) + 0.3, 0.08, 0.04);
    return h / 2;
  },
  // flat armoured boxes
  boxes(g, P, o = {}) {
    const w = o.w || 0.88, h = o.h || 0.5, d = o.d || 0.36, xs = o.xs || [-0.5, 0.5];
    for (const x of xs) {
      add(g, sizedBox(w, h, d), P.main, x, 0, 0);
      add(g, U.cyl, P.metal, x + w * 0.34, h / 2 + 0.02, 0, 0.05, 0.04, 0.05);
      if (o.straps) for (const dx of [-w * 0.3, w * 0.3]) add(g, U.box, P.dark, x + dx, 0, d / 2 + 0.01, 0.05, h + 0.02, 0.02);
    }
    add(g, U.box, P.dark, 0, -h / 2 - 0.01, 0, (xs[xs.length - 1] - xs[0]) + w + 0.1, 0.04, d + 0.04);
    return h / 2 + 0.01;
  },
};

// ===================================================================== track running all around a side frame
// buildShape(s): draws the inner outline of the track (z, y) into a THREE.Shape. Returns the frame (side plate)
// and the belt geometries, extruded along -X from 0 (shift them to the side), and a shared grouser material.
let BELT_MAT = null;
export function beltMaterial() {
  if (BELT_MAT) return BELT_MAT;
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
  BELT_MAT = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.35 });
  return BELT_MAT;
}
export function loopTrack(buildShape, frameDepth, beltDepth, thick = 0.12) {
  const s = new THREE.Shape();
  buildShape(s);
  const inner = s.getPoints(10);
  if (inner[0].distanceTo(inner[inner.length - 1]) < 1e-3) inner.pop();
  const outer = offsetPoly(inner, thick);
  const beltShape = new THREE.Shape(outer);
  beltShape.holes.push(new THREE.Path([...inner].reverse()));
  const frame = new THREE.ExtrudeGeometry(new THREE.Shape(inner), { depth: frameDepth, bevelEnabled: false });
  const belt = new THREE.ExtrudeGeometry(beltShape, { depth: beltDepth, bevelEnabled: false, curveSegments: 4 });
  for (const g of [frame, belt]) { g.rotateY(-PI / 2); g.computeVertexNormals(); }
  return { frame, belt, beltMat: beltMaterial() };
}
