// Shared toolkit of the procedural aeroplanes (planedefs/<key>.js): lofted fuselages and cowlings, wings and tail
// surfaces skinned over airfoil sections (taper, sweep, dihedral, elliptical planform, gull bend), struts and wires,
// propellers and spinners, landing gear (fixed or retracting), radial / inline engines, canopies, guns, bombs on
// racks and the national markings. Plane-local axes like the tanks: +Z forward (the nose), +Y up, +X the left wing;
// the origin is near the centre of gravity.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PI, U, add, keep, bake, PALETTES } from '../modelkit.js';

// ===================================================================== materials
const S = (color, r = 0.8, m = 0.1, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
const cache = {};
// palette { main (upper surfaces), under (lower surfaces), dark (struts, details), accent, engine }
export function pmats(key) {
  if (cache[key]) return cache[key];
  const p = PALETTES[key];
  const m = {
    main: S(p.main), under: S(p.under ?? p.main), dark: S(p.dark, 0.85, 0.15), accent: S(p.accent ?? p.dark, 0.7, 0.1),
    engine: S(p.engine ?? 0x3a3a38, 0.55, 0.6), metal: S(0x8a8c8c, 0.45, 0.7), steel: S(0x55585a, 0.5, 0.6),
    black: S(0x161616, 0.8, 0.2), rubber: S(0x1a1a1a, 1, 0), wood: S(0x7a5532, 0.7, 0), brass: S(0xb8903a, 0.4, 0.8),
    leather: S(0x4a3020, 0.9, 0), linen: S(0xd9cfb0, 0.9, 0), glass: S(0xd8e6ee, 0.1, 0.4, { emissive: 0x222222 }),
    // markings keep their colours when the plane is repainted
    red: S(0xa8231c), white: S(0xe8e6dc), blue: S(0x1f3f8a), yellow: S(0xd6a92a), mblack: S(0x141414),
  };
  m.main.userData.paint = 'main';
  m.dark.userData.paint = 'dark';
  cache[key] = m;
  return m;
}

// ===================================================================== skinning
// a mesh through rings of points (each ring the same count, closed); caps close the first / last ring. The winding is
// fixed so the faces look outwards whatever the order of the rings / points. smooth: shared vertices (fuselages,
// cowlings), else flat faces (wings, tails)
function ringsMesh(rings, caps, smooth) {
  const n = rings[0].length, pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + (i + 1) % n, c = a + n, d = b + n;
      idx.push(a, c, b, b, c, d);
    }
  }
  // outwards? (the first quad of a middle ring against the centre of that ring)
  const jm = Math.max(0, Math.floor((rings.length - 2) / 2));
  const cen = new THREE.Vector3();
  for (const p of rings[jm]) cen.add(p);
  cen.multiplyScalar(1 / n);
  let score = 0;
  for (let i = 0; i < n; i++) {
    const A = rings[jm][i], B = rings[jm][(i + 1) % n], C = rings[Math.min(rings.length - 1, jm + 1)][i];
    const nrm = new THREE.Vector3().subVectors(C, A).cross(new THREE.Vector3().subVectors(B, A));
    score += nrm.dot(new THREE.Vector3().subVectors(A, cen));
  }
  const flip = score < 0;
  if (flip) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const body = smooth ? g : g.toNonIndexed();
  body.computeVertexNormals();
  if (!caps) return body;
  const parts = [smooth ? body.toNonIndexed() : body];
  for (const [j, f0] of /** @type {[number, boolean][]} */ ([[0, true], [rings.length - 1, false]])) {
    const r = rings[j], c = new THREE.Vector3();
    for (const p of r) c.add(p);
    c.multiplyScalar(1 / n);
    const cp = [];
    for (let i = 0; i < n; i++) {
      const a = r[i], b = r[(i + 1) % n];
      if (f0 !== flip) cp.push(c.x, c.y, c.z, a.x, a.y, a.z, b.x, b.y, b.z); else cp.push(c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.computeVertexNormals();
    parts.push(cg);
  }
  return mergeGeometries(parts, false);
}
export const skin = (rings, caps = true) => ringsMesh(rings, caps, false);
export const skinSmooth = (rings, caps = true) => ringsMesh(rings, caps, true);

// superellipse ring: centre (x0, y0) at z, width w, height h, squareness sq (0 ellipse .. 1 nearly a box),
// flat-bottom: the lower half squarer (a boxy belly)
export function ring(z, w, h, y0 = 0, sq = 0, n = 14, x0 = 0, flatBottom = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const e = 2 / (2 + (s < 0 ? sq + flatBottom : sq) * 8);
    pts.push(new THREE.Vector3(x0 + w / 2 * Math.sign(c) * Math.pow(Math.abs(c), e), y0 + h / 2 * Math.sign(s) * Math.pow(Math.abs(s), e), z));
  }
  return pts;
}
// a fuselage / cowling / nacelle through sections [{ z, w, h, y, sq, fb }] (front to back or back to front)
export function fuselage(g, mat, sections, n = 14, smooth = true) {
  const rings = sections.map(s => ring(s.z, Math.max(0.01, s.w), Math.max(0.01, s.h), s.y || 0, s.sq || 0, n, s.x || 0, s.fb || 0));
  return add(g, smooth ? skinSmooth(rings) : skin(rings), mat);
}

// airfoil section in (chord fraction 0 LE .. 1 TE, height fraction of the chord)
const AIRFOIL = [[0, 0], [0.04, 0.045], [0.15, 0.075], [0.35, 0.08], [0.65, 0.05], [1, 0.006], [1, -0.004], [0.6, -0.025], [0.25, -0.03], [0.06, -0.022]];
const SYMFOIL = [[0, 0], [0.05, 0.04], [0.3, 0.06], [1, 0.006], [1, -0.006], [0.3, -0.06], [0.05, -0.04]];
// one wing (both halves, mirrored across X): o { root: x where it starts, span (half span, x of the tip), chord
// [root, tip], le: z of the leading edge at the root, sweep (z offset of the tip LE), y (root height), dihedral (rad),
// t: thickness scale, ell: elliptical planform, gull: { x, dy } inverted / gull bend, segs, mirror: false = one side,
// side: 1 left (+X) / -1 right, tipRound }
export function wing(g, mat, o) {
  const segs = o.segs || (o.ell ? 8 : 2);
  const sides = o.mirror === false ? [o.side || 1] : [1, -1];
  const geos = [];
  for (const sx of sides) {
    const rings = [];
    for (let k = 0; k <= segs; k++) {
      const f = k / segs;
      const x = o.root + (o.span - o.root) * f;
      let chord = o.chord[0] + (o.chord[1] - o.chord[0]) * f;
      let le = o.le + (o.sweep || 0) * f;
      if (o.ell) {                                    // elliptical planform, the quarter-chord line straight
        const c0 = o.chord[0];
        chord = Math.max(o.chord[1], c0 * Math.sqrt(Math.max(0, 1 - f * f)));
        le = o.le - (c0 - chord) * 0.25;
      }
      let y = (o.y || 0) + Math.tan(o.dihedral || 0) * (x - o.root);
      if (o.gull) {
        const gx = o.gull.x;
        y = (o.y || 0) + (x < gx ? (x - o.root) / (gx - o.root) * o.gull.dy : o.gull.dy + Math.tan(o.dihedral || 0) * (x - gx));
      }
      const t = (o.t || 1) * (1 - 0.4 * f);
      rings.push(AIRFOIL.map(([u, v]) => new THREE.Vector3(sx * x, y + v * chord * t * 1.4, le - u * chord)));
    }
    geos.push(skin(rings));
  }
  return add(g, mergeGeometries(geos, false), mat);
}
// tailplane / elevator (a small wing): the same with the tail's numbers
export const tailplane = (g, mat, o) => wing(g, mat, { segs: 2, t: 0.8, ...o });
// fin + rudder: a vertical surface from y0 up to y0 + h, chord [bottom, top], le at the bottom, sweep of the top LE
export function fin(g, mat, o) {
  const segs = o.segs || 3;
  const rings = [];
  for (let k = 0; k <= segs; k++) {
    const f = k / segs;
    let chord = o.chord[0] + (o.chord[1] - o.chord[0]) * f;
    let le = o.le + (o.sweep || 0) * f;
    if (o.round) { const e = Math.sqrt(Math.max(0.05, 1 - f * f)); chord = Math.max(o.chord[1], o.chord[0] * e); le = o.le - (o.chord[0] - chord) * 0.35 + (o.sweep || 0) * f; }
    const y = o.y0 + o.h * f;
    rings.push(SYMFOIL.map(([u, v]) => new THREE.Vector3((o.x || 0) + v * chord * 1.2, y, le - u * chord)));
  }
  return add(g, skin(rings), mat);
}

// ===================================================================== small parts
// strut / wire between two points
export function strut(g, mat, a, b, t = 0.04, d = null) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = add(g, U.box, mat, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, t, len, d ?? t * 2.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
export const wire = (g, mat, a, b) => strut(g, mat, a, b, 0.008, 0.008);

// propeller on its own spin group (rotation.z): n blades of radius r; spinner: radius / length (0: none)
export function propeller(P, o) {
  const grp = keep(new THREE.Group());
  const blades = new THREE.Group();
  const n = o.blades || 2, r = o.r || 1.2, w = o.chord || 0.16;
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2;
    const b = add(blades, U.box, o.wood ? P.wood : P.black, Math.sin(a) * r / 2, Math.cos(a) * r / 2, 0, w, r, 0.04, 0, 0, -a);
    b.rotation.set(0, 0, -a);
    b.rotateY(0.35);
    if (!o.wood) add(blades, U.box, P.yellow, Math.sin(a) * (r - 0.06), Math.cos(a) * (r - 0.06), 0.005, w * 0.95, 0.1, 0.045, 0, 0, -a);
  }
  if (o.spinner) add(blades, U.cone, o.spinnerMat || P.dark, 0, 0, o.spinner[1] / 2, o.spinner[0], o.spinner[1], o.spinner[0], PI / 2, 0, 0);
  else add(blades, U.cylZ, P.metal, 0, 0, 0, 0.08, 0.08, 0.14);
  bake(blades);
  grp.add(blades);
  // the blur disc shown at speed (blades hidden)
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: 0x2a2620, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  disc.visible = false;
  grp.add(disc);
  grp.userData.blades = blades;
  grp.userData.disc = disc;
  grp.position.set(...o.at);
  return grp;
}

// a landing wheel (axis along X) at (x, y, z) - y is the axle height
export function wheel(g, P, x, y, z, r, w = 0.12, hub = null) {
  add(g, new THREE.TorusGeometry(r * 0.78, r * 0.22, 8, 18).rotateY(PI / 2), P.rubber, x, y, z, w / (r * 0.44), 1, 1);
  add(g, U.cylX, hub || P.metal, x, y, z, w * 0.8, r * 0.6, r * 0.6);
}
// WW1 style undercarriage: V-struts to an axle with two spoked wheels, often with a little "axle wing"
export function ww1Gear(g, P, o) {
  const { x, y, z, r } = o;            // x: half track, y: axle height (local), z: axle z, top: struts' top y, zf / zr
  for (const sx of [-1, 1]) {
    strut(g, P.dark, [sx * x * 0.55, o.top, o.zf], [sx * x, y, z], 0.045);
    strut(g, P.dark, [sx * x * 0.55, o.top, o.zr], [sx * x, y, z], 0.045);
    wheel(g, P, sx * x, y, z, r, 0.1, P.linen);
  }
  add(g, U.cylX, P.steel, 0, y, z, x * 2, 0.025, 0.025);
  if (o.axleWing) wing(g, P.main, { root: 0, span: x + 0.1, chord: [0.4, 0.4], le: z + 0.2, y: y, t: 1.2, segs: 1 });
}
// retracting gear: a keep group (shown on the ground, folded up in flight) with legs, wheels, doors
export function retractGear(root, P, o) {
  const grp = keep(new THREE.Group());
  const { x, y, z, r } = o;
  for (const sx of [-1, 1]) {
    strut(grp, P.steel, [sx * (o.legTopX ?? x), o.top, z + (o.rake || 0)], [sx * x, y, z], 0.06);
    wheel(grp, P, sx * x, y, z, r, 0.16);
    if (o.doors) add(grp, U.box, P.under, sx * (x + 0.12), (o.top + y) / 2, z, 0.02, (o.top - y) * 0.8, r * 1.6);
  }
  bake(grp);
  root.add(grp);
  return grp;
}
// tail wheel / skid
export function tailWheel(g, P, z, y, r = 0.1, skid = false, top = null) {
  if (skid) strut(g, P.dark, [0, top ?? y + 0.35, z + 0.4], [0, y, z], 0.05);
  else {
    strut(g, P.steel, [0, top ?? y + 0.3, z + 0.08], [0, y, z], 0.04);
    wheel(g, P, 0, y, z, r, 0.06);
  }
}
// radial engine: n cylinders round the crankcase at z, radius R
export function radial(g, P, z, R, n = 9, mat = null) {
  add(g, U.cylZ, P.engine, 0, 0, z, R * 0.35, R * 0.35, 0.25);
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2;
    add(g, U.cyl, mat || P.engine, Math.sin(a) * R * 0.62, Math.cos(a) * R * 0.62, z, R * 0.14, R * 0.65, R * 0.14, 0, 0, -a);
    for (let k = 0; k < 3; k++) add(g, U.cyl, P.metal, Math.sin(a) * R * (0.45 + k * 0.15), Math.cos(a) * R * (0.45 + k * 0.15), z, R * 0.17, 0.012, R * 0.17, 0, 0, -a);
  }
}
// machine-gun barrel(s) along +Z
export function gunBarrel(g, P, x, y, z, len, r = 0.025, jacket = false) {
  add(g, U.cylZ, jacket ? P.dark : P.black, x, y, z + len / 2, jacket ? r * 2.2 : r, jacket ? r * 2.2 : r, len);
  if (jacket) for (let i = 0; i < 4; i++) add(g, U.box, P.black, x, y + r * 2.2, z + 0.1 + i * len / 4, 0.01, 0.01, 0.05);
}
// a bomb (nose +Z) - its own mesh, hidden once it is dropped; kg sets the size
export function bombMesh(P, kg) {
  const s = Math.cbrt(kg / 100);
  const g = keep(new THREE.Group());
  add(g, U.sph, P.dark, 0, 0, 0, 0.13 * s, 0.13 * s, 0.5 * s);
  add(g, U.cone, P.dark, 0, 0, -0.55 * s, 0.1 * s, 0.25 * s, 0.1 * s, -PI / 2, 0, 0);
  for (let i = 0; i < 4; i++) add(g, U.box, P.dark, 0, 0, -0.62 * s, 0.01, 0.28 * s, 0.14 * s, 0, 0, i * PI / 4 * 2);
  add(g, U.box, P.yellow, 0, 0, 0.32 * s, 0.27 * s, 0.27 * s, 0.03);
  bake(g);
  return g;
}

// ===================================================================== markings
const discGeo = new THREE.CircleGeometry(1, 24);
// roundel / cockade on a surface: rings from outside in [[colourMat, radius fraction], ...]; facing: 'up' | 'down' |
// 'left' | 'right'
export function roundel(g, rings, x, y, z, r, facing = 'up') {
  rings.forEach(([mat, f], i) => {
    const m = add(g, discGeo, mat, 0, 0, 0, r * f, r * f, 1);
    const off = 0.004 * (i + 1);
    face(m, facing, x, y, z, off);
  });
}
function face(m, facing, x, y, z, off) {
  if (facing === 'up') { m.rotation.set(-PI / 2, 0, 0); m.position.set(x, y + off, z); }
  else if (facing === 'down') { m.rotation.set(PI / 2, 0, 0); m.position.set(x, y - off, z); }
  else if (facing === 'left') { m.rotation.set(0, PI / 2, 0); m.position.set(x + off, y, z); }
  else { m.rotation.set(0, -PI / 2, 0); m.position.set(x - off, y, z); }
}
// a cross (straight Balkenkreuz, or the WW1 cross pattee as a wide-armed cross), white-edged black
export function cross(g, P, x, y, z, r, facing = 'up', pattee = false) {
  const plate = (mat, w, l, off, rot) => {
    const m = add(g, U.box, mat, 0, 0, 0, w, l, 0.001);
    face(m, facing, x, y, z, off);
    m.rotateZ(rot);
  };
  for (const rot of [0, PI / 2]) {
    if (pattee) { plate(P.white, r * 0.9, r * 2.1, 0.004, rot); plate(P.mblack, r * 0.62, r * 1.9, 0.006, rot); }
    else { plate(P.white, r * 0.62, r * 2.1, 0.004, rot); plate(P.mblack, r * 0.34, r * 1.9, 0.006, rot); }
  }
}
// red star (Soviet), with a white rim
let STAR = null;
export function redStar(g, P, x, y, z, r, facing = 'up') {
  if (!STAR) {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * PI * 2, rr = i % 2 ? 0.4 : 1;
      if (i) sh.lineTo(Math.sin(a) * rr, Math.cos(a) * rr); else sh.moveTo(0, 1);
    }
    STAR = new THREE.ShapeGeometry(sh);
  }
  const w = add(g, STAR, P.white, 0, 0, 0, r * 1.15, r * 1.15, 1);
  face(w, facing, x, y, z, 0.004);
  const m = add(g, STAR, P.red, 0, 0, 0, r, r, 1);
  face(m, facing, x, y, z, 0.007);
}

// ===================================================================== canopy glass
const GLASS = new THREE.MeshStandardMaterial({ color: 0xa8bcc4, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3,
  side: THREE.DoubleSide, depthWrite: false });
// glass parts collected into one transparent mesh (kept out of the bake)
export function canopy(root, geos) {
  if (!geos.length) return null;
  const parts = geos.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    return n;
  });
  const m = keep(new THREE.Mesh(mergeGeometries(parts, false), GLASS));
  m.castShadow = false;
  m.renderOrder = 1;
  root.add(m);
  return m;
}
// a glazed bubble / framed hood: sections like a fuselage, upper half only
export function hoodGeo(sections, n = 12) {
  const rings = sections.map(s => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * PI;
      pts.push(new THREE.Vector3(Math.cos(a) * s.w / 2, (s.y || 0) + Math.sin(a) * s.h, s.z));
    }
    for (let i = n - 1; i > 0; i--) pts.push(new THREE.Vector3(Math.cos(i / n * PI) * s.w / 2 * 0.98, (s.y || 0) + 0.001, s.z));
    return pts;
  });
  return skinSmooth(rings);
}
// windscreen pane
export function screenGeo(x, y, z, w, h, rake = 0.5) {
  return new THREE.PlaneGeometry(w, h).rotateX(-rake).translate(x, y, z);
}
// frame bars over a hood (dark)
export function hoodFrame(g, P, zs, w, y, h) {
  for (const z of zs) add(g, new THREE.TorusGeometry(w / 2, 0.015, 4, 12, PI), P.dark, 0, y, z, 1, h / (w / 2), 1);
}
