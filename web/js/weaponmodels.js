// Procedural small-arms models: one builder per weapon (weapons.js keys). Shared parts (barrels, profiles,
// magazines, sights, jackets, bipods...) are small helpers; each builder composes the recognisable
// silhouette of its gun. Frame: origin at the pistol grip / trigger (right hand), barrel along +Z, sights up.
// A builder returns { muzzle (z of the muzzle), top (y of the sight line), hand2 ([x,y,z] support hand) }.
import * as THREE from 'three';

const PI = Math.PI;
const S = (color, r = 0.5, m = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
export const WMAT = {
  blued: S(0x2c3137, 0.38, 0.7), steel: S(0x5c6064, 0.4, 0.75), park: S(0x3a3c38, 0.7, 0.45), black: S(0x1c1d1f, 0.7, 0.3),
  poly: S(0x232426, 0.85, 0.1), olive: S(0x4b5030, 0.8, 0.2), tan: S(0x9a8a62, 0.85, 0.1),
  walnut: S(0x5a3a22, 0.7, 0.05), beech: S(0x8a5a30, 0.65, 0.05), birch: S(0xa06c3a, 0.6, 0.05), red: S(0x6e3422, 0.6, 0.05),
  plum: S(0x6b2e22, 0.55, 0.1), orange: S(0x9a4a22, 0.6, 0.1), bakelite: S(0x3a2418, 0.5, 0.1),
  brass: S(0xb8903a, 0.4, 0.8), glass: S(0x223344, 0.1, 0.6), chrome: S(0xa9adb0, 0.25, 0.9), alloy: S(0x55585c, 0.45, 0.6),
  dark: S(0x0c0c0c, 0.9, 0.1), canvas: S(0x6f6a4c, 1, 0), leather: S(0x5a3a22, 0.8, 0),
};
const M = WMAT;

// ===================================================================== primitives
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylZ: new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(PI / 2),
  cylZ6: new THREE.CylinderGeometry(1, 1, 1, 6).rotateX(PI / 2),
  cylX: new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(PI / 2),
  cylY: new THREE.CylinderGeometry(1, 1, 1, 14),
  sph: new THREE.SphereGeometry(1, 12, 8),
  coneZ: new THREE.CylinderGeometry(0, 1, 1, 12).rotateX(PI / 2),
};
function mesh(g, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
// box centred at (x, y, z)
const B = (g, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => mesh(g, G.box, mat, x, y, z, sx, sy, sz, rx, ry, rz);
// cylinder along Z from z0 to z1
const tube = (g, mat, z0, z1, r, y = 0, x = 0, geo = G.cylZ) => mesh(g, geo, mat, x, y, (z0 + z1) / 2, r, r, z1 - z0);
// tapered cylinder along Z
function taper(g, mat, z0, z1, r0, r1, y = 0, x = 0) {
  return mesh(g, new THREE.CylinderGeometry(r1, r0, 1, 12).rotateX(PI / 2), mat, x, y, (z0 + z1) / 2, 1, 1, z1 - z0);
}
// side profile [[z, y]...] extruded across X (width w), centred on x
function prof(g, mat, pts, w, x = 0) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.rotateY(-PI / 2);
  geo.translate(w / 2, 0, 0);
  geo.computeVertexNormals();
  return mesh(g, geo, mat, x, 0, 0, 1, 1, 1);
}
// cylinder across X (drums, wheels), along Y (pans)
const drumX = (g, mat, x, y, z, r, w) => mesh(g, G.cylX, mat, x, y, z, w, r, r);
const panY = (g, mat, x, y, z, r, h) => mesh(g, G.cylY, mat, x, y, z, r, h, r);

// ---- composite parts
// front sight post (+ optional hood) at z, height above the axis y
function fsight(g, z, y, hood = false, mat = M.blued) {
  B(g, mat, 0, y, z, 0.005, 0.02, 0.008);
  if (hood) for (const sx of [-1, 1]) B(g, mat, sx * 0.011, y + 0.004, z, 0.003, 0.026, 0.012);
}
// rear sight notch / tangent at z
function rsight(g, z, y, w = 0.02, mat = M.blued) {
  B(g, mat, 0, y, z, w, 0.012, 0.025);
  B(g, M.dark, 0, y + 0.006, z, w * 0.25, 0.006, 0.026);
}
// perforated jacket: tube + rows of dark holes
function jacket(g, z0, z1, r, y = 0, holes = 3, mat = M.blued, square = false) {
  if (square) B(g, mat, 0, y, (z0 + z1) / 2, r * 2, r * 2, z1 - z0);
  else tube(g, mat, z0, z1, r, y);
  const n = Math.max(2, Math.floor((z1 - z0) / (r * 1.3)));
  for (let i = 0; i < n; i++) {
    const z = z0 + (i + 0.5) * (z1 - z0) / n;
    for (let k = 0; k < holes; k++) {
      const a = -0.9 + k * 1.8 / Math.max(1, holes - 1);
      for (const sx of [-1, 1]) B(g, M.dark, sx * Math.cos(a) * r * 1.01, y + Math.sin(a) * r * 1.01, z, 0.004, r * 0.45, r * 0.55, 0, 0, sx * a);
    }
  }
}
// cooling fins (Hotchkiss / Lewis style)
function fins(g, z0, z1, r, y = 0, n = 10, mat = M.brass) {
  for (let i = 0; i < n; i++) tube(g, mat, z0 + i * (z1 - z0) / n, z0 + i * (z1 - z0) / n + 0.006, r, y);
}
// bipod legs folded forward / deployed down
function bipod(g, z, y, len = 0.25, deployed = true) {
  for (const sx of [-1, 1]) {
    if (deployed) B(g, M.blued, sx * 0.035, y - len / 2 * 0.9, z + 0.03, 0.009, len, 0.009, 0.25, 0, sx * 0.2);
    else B(g, M.blued, sx * 0.02, y - 0.012, z + len / 2, 0.008, 0.008, len);
  }
  B(g, M.blued, 0, y, z, 0.05, 0.02, 0.025);
}
// magazine shapes, `z` is its centre, `y0` the top where it enters the gun
// (up: the magazine sticks up out of the top of the gun - Bren, Type 97)
function magStraight(g, z, y0, len, d = 0.035, w = 0.022, mat = M.blued, rake = 0, up = false) {
  const k = up ? 1 : -1;
  return prof(g, mat, [[z - d / 2, y0], [z + d / 2, y0], [z + d / 2 + Math.sin(rake) * len, y0 + k * len], [z - d / 2 + Math.sin(rake) * len, y0 + k * len]], w);
}
function magCurved(g, z, y0, len, d = 0.045, w = 0.024, curve = 0.5, mat = M.blued, up = false) {
  const k = up ? 1 : -1, pts = [], back = [], n = 6;
  for (let i = 0; i <= n; i++) { const t = i / n, a = curve * t; pts.push([z - d / 2 + Math.sin(a) * len * 0.55 * t, y0 + k * Math.cos(a * 0.5) * len * t]); }
  for (let i = n; i >= 0; i--) { const t = i / n, a = curve * t; back.push([z + d / 2 + Math.sin(a) * len * 0.62 * t + d * 0.15 * t, y0 + k * Math.cos(a * 0.5) * len * t]); }
  return prof(g, mat, [...pts, ...back], w);
}
// wooden / polymer butt stock from the wrist at zw (top y yt) back to the butt plate at zb
function butt(g, mat, zw, zb, yt, drop = 0.03, hb = 0.12, w = 0.04, comb = 0) {
  return prof(g, mat, [[zw, yt], [zb, yt - drop + comb], [zb, yt - drop - hb], [zb + 0.05, yt - drop - hb + 0.01], [zw, yt - 0.06]], w);
}
// pistol grip hanging from (z, y) raked back by `rake`
function pgrip(g, mat, z, y, len = 0.1, d = 0.035, w = 0.03, rake = 0.25) {
  const dz = Math.sin(rake) * len;
  return prof(g, mat, [[z - d / 2, y], [z + d / 2, y], [z + d / 2 - dz, y - len], [z - d / 2 - dz - 0.005, y - len]], w);
}
function trigger(g, z = 0.012, y = -0.005, guard = true, mat = M.blued) {
  B(g, M.dark, 0, y - 0.006, z, 0.004, 0.018, 0.005, 0.3);
  if (guard) {
    B(g, mat, 0, y - 0.022, z + 0.005, 0.006, 0.004, 0.05);
    B(g, mat, 0, y - 0.01, z + 0.03, 0.006, 0.026, 0.004);
  }
}
// scope on rings
function scope(g, z, y, len = 0.26, r = 0.017, x = 0) {
  tube(g, M.blued, z - len / 2, z + len / 2, r, y, x);
  tube(g, M.blued, z + len / 2 - 0.05, z + len / 2, r * 1.35, y, x);
  tube(g, M.blued, z - len / 2, z - len / 2 + 0.04, r * 1.2, y, x);
  tube(g, M.glass, z + len / 2, z + len / 2 + 0.002, r * 1.25, y, x);
  panY(g, M.blued, x, y + r + 0.008, z, 0.008, 0.02);
  for (const dz of [-0.06, 0.06]) B(g, M.blued, x, y - r - 0.006, z + dz, 0.012, 0.014, 0.012);
}

// ===================================================================== handguns
// self-loading pistol: slide on top of a frame, grip hanging below. o: { L slide length, h slide height, w width,
// z0 slide rear, rake grip angle, gl grip length, slide mat, grip mat, openTop, hammer, ring (lanyard), bl barrel out }
function pistol(g, o) {
  const L = o.L || 0.19, h = o.h || 0.03, w = o.w || 0.026, z0 = o.z0 ?? -0.06, y = o.y ?? 0.03;
  const sm = o.slide || M.blued;
  B(g, sm, 0, y, z0 + L / 2, w, h, L);
  if (o.openTop) { B(g, M.dark, 0, y + h / 2, z0 + L * 0.72, w * 0.5, 0.004, L * 0.4); tube(g, M.steel, z0 + L * 0.52, z0 + L * 0.95, 0.008, y + h * 0.28); }
  for (let i = 0; i < 6; i++) B(g, M.dark, w / 2 + 0.0005, y, z0 + 0.012 + i * 0.006, 0.001, h * 0.7, 0.002);   // serrations
  for (let i = 0; i < 6; i++) B(g, M.dark, -w / 2 - 0.0005, y, z0 + 0.012 + i * 0.006, 0.001, h * 0.7, 0.002);
  B(g, o.frame || sm, 0, y - h / 2 - 0.01, z0 + L * 0.55, w * 0.9, 0.02, L * 0.8);                         // frame / dust cover
  if (o.bl) tube(g, M.steel, z0 + L - 0.005, z0 + L + o.bl, 0.008, y + 0.004);
  pgrip(g, o.grip || M.poly, 0, y - h / 2 - 0.005, o.gl || 0.1, o.gd || 0.036, w * 1.12, o.rake ?? 0.28);
  trigger(g, 0.018, y - h / 2 - 0.012, true, o.frame || sm);
  if (o.squareGuard) B(g, o.frame || sm, 0, y - h / 2 - 0.042, 0.03, w * 0.5, 0.004, 0.05);
  if (o.hammer !== false) B(g, M.blued, 0, y + 0.005, z0 - 0.006, 0.008, 0.016, 0.01, -0.4);
  if (o.ring) mesh(g, new THREE.TorusGeometry(0.008, 0.002, 4, 10), M.steel, 0, y - h / 2 - (o.gl || 0.1) - 0.006, -0.03, 1, 1, 1, 0, PI / 2, 0);
  B(g, M.blued, 0, y + h / 2 + 0.004, z0 + L - 0.008, 0.004, 0.006, 0.006);                                 // sights
  B(g, M.blued, 0, y + h / 2 + 0.004, z0 + 0.01, 0.014, 0.006, 0.006);
  return { muzzle: z0 + L + (o.bl || 0), top: y + h / 2 + 0.008, hand2: [0.022, -0.05, 0.0] };
}

function luger(g) {
  // long thin barrel, toggle lock on top, raked grip
  B(g, M.blued, 0, 0.022, 0.0, 0.024, 0.026, 0.11);
  tube(g, M.blued, 0.05, 0.16, 0.009, 0.028);
  tube(g, M.blued, 0.05, 0.075, 0.012, 0.028);
  for (const z of [-0.05, -0.028]) drumX(g, M.chrome, 0, 0.045, z, 0.008, 0.028);
  B(g, M.blued, 0, 0.042, -0.038, 0.02, 0.012, 0.04);
  pgrip(g, M.walnut, -0.035, 0.012, 0.1, 0.038, 0.03, 0.55);
  trigger(g, 0.01, 0.0);
  B(g, M.blued, 0, 0.042, 0.155, 0.004, 0.01, 0.006);
  return { muzzle: 0.16, top: 0.05, hand2: [0.022, -0.05, -0.02] };
}
function c96(g) {
  // broomhandle: box magazine ahead of the trigger, round grip, long barrel, tangent sight
  B(g, M.blued, 0, 0.03, 0.02, 0.026, 0.04, 0.14);
  tube(g, M.blued, 0.09, 0.2, 0.009, 0.04);
  B(g, M.blued, 0, 0.0, 0.055, 0.022, 0.07, 0.045);
  for (let i = 0; i < 5; i++) B(g, M.dark, 0.0115, -0.01 + i * 0.012, 0.055, 0.001, 0.005, 0.04);
  B(g, M.blued, 0, 0.055, 0.06, 0.012, 0.01, 0.05);
  const gr = prof(g, M.walnut, [[-0.035, 0.012], [-0.005, 0.012], [-0.02, -0.09], [-0.06, -0.09]], 0.03);
  for (let i = 0; i < 7; i++) B(g, M.bakelite, 0, -0.005 - i * 0.012, -0.025 - i * 0.003, 0.031, 0.003, 0.036);
  trigger(g, 0.012, 0.005);
  B(g, M.blued, 0, 0.018, -0.052, 0.01, 0.02, 0.012, -0.3);
  B(g, M.blued, 0, 0.05, 0.196, 0.004, 0.012, 0.006);
  return { muzzle: 0.2, top: 0.063, hand2: [0.022, -0.05, -0.02] };
}

// revolver. o: { bl barrel, cr cylinder radius, cl cylinder length, frame 'solid'|'topbreak'|'saa', lug, rib 'vent'|'plain',
// grip 'bird'|'round'|'plow'|'square', gmat, ejector, spur }
function revolver(g, o) {
  const bl = o.bl || 0.12, cr = o.cr || 0.02, cl = o.cl || 0.04, y = 0.032;
  const fz0 = -0.04, fz1 = fz0 + cl + 0.03;
  B(g, M.blued, 0, y - 0.004, (fz0 + fz1) / 2, 0.024, 0.042, fz1 - fz0);                   // frame
  tube(g, o.cmat || M.blued, fz0 + 0.015, fz0 + 0.015 + cl, cr, y);                        // cylinder
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; B(g, M.dark, Math.sin(a) * cr * 0.95, y + Math.cos(a) * cr * 0.95, fz0 + 0.015 + cl / 2, 0.004, 0.004, cl * 0.7, 0, 0, -a); }
  tube(g, M.blued, fz1, fz1 + bl, o.br || 0.0085, y + 0.006);                              // barrel
  if (o.lug) B(g, M.blued, 0, y - 0.01, fz1 + bl / 2, 0.016, 0.02, bl);
  if (o.rib === 'vent') { B(g, M.blued, 0, y + 0.02, fz1 + bl / 2, 0.008, 0.01, bl); for (let i = 0; i < 4; i++) B(g, M.dark, 0, y + 0.018, fz1 + 0.02 + i * bl / 4.5, 0.009, 0.004, 0.012); }
  else if (o.rib !== false) B(g, M.blued, 0, y + 0.016, fz1 + bl / 2, 0.005, 0.006, bl);
  if (o.ejector) { tube(g, M.blued, fz1, fz1 + bl * 0.75, 0.005, y - 0.008, o.ejector === 'side' ? -0.01 : 0); }
  if (o.frame === 'topbreak') { B(g, M.blued, 0, y + 0.024, fz0 + 0.005, 0.02, 0.012, 0.03); B(g, M.steel, 0.012, y + 0.02, fz0 + 0.01, 0.004, 0.016, 0.01); }
  if (o.frame === 'saa') B(g, M.chrome, 0, y - 0.02, fz0 + 0.02, 0.022, 0.02, 0.05);           // case-hardened frame bottom
  B(g, M.blued, 0, y + 0.012, fz0 - 0.012, 0.008, o.spur === false ? 0.014 : 0.024, 0.012, -0.5);   // hammer
  const gm = o.gmat || M.walnut;
  if (o.grip === 'bird') prof(g, gm, [[-0.045, 0.012], [-0.01, 0.012], [-0.022, -0.06], [-0.04, -0.085], [-0.07, -0.075], [-0.06, -0.02]], 0.03);
  else if (o.grip === 'plow') prof(g, gm, [[-0.045, 0.012], [-0.01, 0.012], [-0.02, -0.07], [-0.035, -0.1], [-0.068, -0.095], [-0.062, -0.03]], 0.03);
  else if (o.grip === 'square') prof(g, gm, [[-0.045, 0.012], [-0.008, 0.012], [-0.03, -0.1], [-0.075, -0.1]], 0.032);
  else prof(g, gm, [[-0.045, 0.012], [-0.008, 0.012], [-0.026, -0.085], [-0.045, -0.095], [-0.068, -0.085]], 0.031);
  trigger(g, 0.0, 0.0);
  B(g, M.blued, 0, y + 0.024, fz1 + bl - 0.01, 0.004, 0.012, 0.008);
  return { muzzle: fz1 + bl, top: y + 0.028, hand2: [0.022, -0.05, -0.02] };
}

// ===================================================================== compact SMGs
function uzi(g, s = 1, stock = true) {
  const L = 0.3 * s;
  B(g, M.park, 0, 0.03, L * 0.3, 0.05, 0.06, L);                                          // box receiver
  B(g, M.park, 0, 0.066, L * 0.3, 0.046, 0.012, L * 0.95);
  for (let i = 0; i < 5; i++) B(g, M.dark, 0.0255, 0.03, -L * 0.12 + i * L * 0.12, 0.001, 0.04, 0.008);
  tube(g, M.park, L * 0.8, L * 0.8 + 0.035, 0.016, 0.026);
  tube(g, M.steel, L * 0.8 + 0.035, L * 0.8 + 0.05, 0.009, 0.026);
  B(g, M.poly, 0, -0.005, L * 0.55, 0.046, 0.022, L * 0.35);                              // lower handguard
  pgrip(g, M.poly, 0, 0.0, 0.1 * s + 0.02, 0.04, 0.036, 0.1);
  magStraight(g, -0.005, -0.08 * s - 0.02, 0.07, 0.028, 0.02, M.park, 0.1);               // mag protrudes from the grip
  trigger(g, 0.035, -0.002);
  B(g, M.park, 0, 0.078, L * 0.78, 0.012, 0.014, 0.01);
  B(g, M.park, 0, 0.076, -L * 0.15, 0.02, 0.012, 0.012);
  if (stock) { B(g, M.park, 0.02, 0.012, -L * 0.3 - 0.08, 0.008, 0.008, 0.22); B(g, M.park, -0.02, 0.012, -L * 0.3 - 0.08, 0.008, 0.008, 0.22); B(g, M.park, 0, 0.0, -L * 0.3 - 0.19, 0.05, 0.05, 0.01); }
  return { muzzle: L * 0.8 + 0.05, top: 0.085, hand2: [0.02, -0.07, L * 0.55] };
}
function mac(g, s = 1) {
  const L = 0.26 * s;
  B(g, M.park, 0, 0.035, L * 0.25, 0.05, 0.075, L);
  B(g, M.dark, 0.026, 0.045, L * 0.3, 0.001, 0.02, L * 0.5);
  tube(g, M.steel, L * 0.75, L * 0.75 + 0.03, 0.012, 0.03);
  B(g, M.park, 0, -0.03, -0.0, 0.035, 0.1 * s + 0.02, 0.04);                             // grip = magwell
  magStraight(g, 0.0, -0.03 - (0.1 * s + 0.02) / 2 + 0.005, 0.06, 0.03, 0.022, M.park);
  trigger(g, 0.035, -0.005);
  B(g, M.steel, 0.02, 0.06, -L * 0.25 - 0.06, 0.006, 0.006, 0.14);                        // retracted wire stock
  B(g, M.steel, -0.02, 0.06, -L * 0.25 - 0.06, 0.006, 0.006, 0.14);
  B(g, M.steel, 0, 0.06, -L * 0.25 - 0.13, 0.046, 0.03, 0.006);
  B(g, M.canvas, 0, 0.08, L * 0.6, 0.02, 0.004, 0.03);                                    // strap
  return { muzzle: L * 0.75 + 0.03, top: 0.08, hand2: [0.02, 0.0, L * 0.72] };
}
function skorpion(g) {
  B(g, M.blued, 0, 0.03, 0.06, 0.03, 0.045, 0.2);
  tube(g, M.blued, 0.16, 0.19, 0.01, 0.034);
  magCurved(g, 0.055, 0.008, 0.13, 0.026, 0.018, 0.9, M.blued);
  pgrip(g, M.walnut, -0.005, 0.008, 0.1, 0.038, 0.032, 0.35);
  trigger(g, 0.02, 0.005);
  for (const sx of [-1, 1]) B(g, M.steel, sx * 0.017, 0.058, 0.02, 0.005, 0.005, 0.2);    // wire stock folded over the top
  B(g, M.steel, 0, 0.058, 0.12, 0.04, 0.005, 0.01);
  return { muzzle: 0.19, top: 0.066, hand2: [0.022, -0.05, 0.0] };
}
function mp5k(g) {
  tube(g, M.black, -0.08, 0.2, 0.026, 0.04);                                              // receiver tube
  B(g, M.black, 0, 0.02, 0.06, 0.04, 0.05, 0.26);
  tube(g, M.black, 0.2, 0.235, 0.012, 0.035);
  magCurved(g, 0.07, -0.005, 0.15, 0.028, 0.02, 0.7, M.black);
  pgrip(g, M.poly, -0.01, -0.005, 0.1, 0.038, 0.036, 0.25);
  pgrip(g, M.poly, 0.16, -0.005, 0.07, 0.026, 0.026, -0.1);                              // front vertical grip
  trigger(g, 0.012, -0.005);
  B(g, M.black, 0, 0.072, 0.02, 0.01, 0.018, 0.02);
  B(g, M.black, 0, 0.072, 0.19, 0.012, 0.018, 0.01);
  tube(g, M.black, 0.06, 0.2, 0.008, 0.07);                                               // cocking tube
  return { muzzle: 0.235, top: 0.082, hand2: [0.018, -0.07, 0.16] };
}
function tec9(g) {
  B(g, M.black, 0, 0.03, 0.05, 0.04, 0.05, 0.19);
  jacket(g, 0.14, 0.26, 0.018, 0.035, 2, M.black);
  tube(g, M.steel, 0.26, 0.27, 0.008, 0.035);
  magStraight(g, 0.06, 0.005, 0.15, 0.028, 0.02, M.black, 0.05);
  pgrip(g, M.poly, -0.02, 0.005, 0.1, 0.04, 0.034, 0.3);
  trigger(g, 0.012, 0.003);
  return { muzzle: 0.27, top: 0.06, hand2: [0.02, -0.07, 0.06] };
}
function kedr(g) {
  B(g, M.black, 0, 0.03, 0.08, 0.036, 0.05, 0.27);
  tube(g, M.steel, 0.215, 0.245, 0.01, 0.034);
  magStraight(g, 0.07, 0.005, 0.15, 0.03, 0.02, M.black);
  pgrip(g, M.poly, -0.01, 0.005, 0.1, 0.04, 0.034, 0.25);
  trigger(g, 0.012, 0.003);
  for (const sx of [-1, 1]) B(g, M.black, sx * 0.02, 0.064, 0.0, 0.006, 0.008, 0.24);      // stock folded over the top
  B(g, M.black, 0, 0.064, -0.11, 0.046, 0.02, 0.01);
  return { muzzle: 0.245, top: 0.075, hand2: [0.02, -0.05, 0.07] };
}
function mp7(g) {
  prof(g, M.poly, [[-0.06, 0.06], [0.2, 0.06], [0.22, 0.03], [0.2, 0.0], [0.08, -0.005], [0.03, 0.0], [-0.06, 0.02]], 0.042);
  B(g, M.black, 0, 0.068, 0.07, 0.02, 0.01, 0.24);                                        // rail
  tube(g, M.steel, 0.2, 0.25, 0.009, 0.03);
  pgrip(g, M.poly, 0, 0.0, 0.11, 0.04, 0.036, 0.15);
  magStraight(g, -0.006, -0.1, 0.06, 0.026, 0.02, M.poly, 0.15);
  pgrip(g, M.poly, 0.17, 0.0, 0.07, 0.024, 0.024, -0.2);                                 // folding foregrip
  trigger(g, 0.03, -0.003);
  for (const sx of [-1, 1]) B(g, M.black, sx * 0.018, 0.02, -0.09, 0.005, 0.01, 0.07);
  B(g, M.poly, 0, 0.01, -0.13, 0.042, 0.06, 0.012);
  B(g, M.black, 0, 0.085, 0.0, 0.012, 0.022, 0.02);
  return { muzzle: 0.25, top: 0.095, hand2: [0.018, -0.06, 0.17] };
}

// ===================================================================== bolt-action & self-loading rifles
// classic wooden rifle. o: { L total, bl barrel exposed, wood, stockTo (forend end z), bands [z], bolt 'straight'|'bent'|'none',
// mag 'internal'|'box', rear z of butt, peep, hood, monopod, grip 'straight'|'semi', twoPiece }
function rifle(g, o) {
  const wood = o.wood || M.walnut, br = o.br || 0.0085, by = 0.028;
  const zb = o.zb ?? -0.36, zm = o.zm ?? (o.L + zb);                                      // butt end, muzzle
  const zf = o.zf ?? zm - (o.bl || 0.08);                                                  // forend nose
  // stock: butt + wrist + forend in one profile
  const wristDrop = o.grip === 'semi' ? 0.05 : 0.035;
  prof(g, wood, [
    [zb, by - 0.02], [-0.06, by - 0.005], [0.04, by + 0.002], [zf, by + 0.002], [zf, by - 0.03], [0.12, by - 0.035],
    [0.06, by - 0.045], [0.0, by - 0.045], [-0.04, by - 0.04 - wristDrop], [-0.1, by - 0.055], [zb + 0.02, by - 0.11 - (o.drop || 0.02)], [zb, by - 0.105 - (o.drop || 0.02)],
  ], o.sw || 0.042);
  if (o.twoPiece) B(g, M.dark, 0, by - 0.02, -0.02, 0.043, 0.06, 0.004);
  B(g, M.steel, 0, by - 0.063 - (o.drop || 0.02), zb + 0.003, 0.043, 0.05, 0.006);         // butt plate
  // upper handguard
  B(g, wood, 0, by + 0.014, (o.hgFrom ?? 0.18) / 2 + zf / 2, 0.028, 0.016, zf - (o.hgFrom ?? 0.18));
  // receiver + barrel
  const rl = o.rl || 0.22;
  tube(g, M.blued, -0.06, -0.06 + rl, o.rr || 0.014, by + 0.004, 0, o.hex ? G.cylZ6 : G.cylZ);
  tube(g, M.blued, -0.06 + rl, zm, br, by + 0.004);
  if (o.muzzleBrake) { tube(g, M.blued, zm - 0.06, zm, br * 1.9, by + 0.004); for (let i = 0; i < 4; i++) B(g, M.dark, 0, by + 0.004, zm - 0.052 + i * 0.013, br * 4, 0.004, 0.005); }
  for (const z of o.bands || []) tube(g, M.steel, z, z + 0.012, 0.022, by - 0.006);
  if (o.hood) fsight(g, zm - 0.02, by + 0.02, true); else fsight(g, zm - 0.02, by + 0.018);
  if (o.peep) { B(g, M.blued, 0, by + 0.03, -0.045, 0.02, 0.02, 0.012); drumX(g, M.dark, 0, by + 0.034, -0.045, 0.004, 0.022); }
  else rsight(g, o.rsz ?? 0.12, by + 0.025);
  // bolt handle
  if (o.bolt === 'bent') { B(g, M.blued, 0.025, by - 0.005, 0.0, 0.03, 0.006, 0.006, 0, 0, -0.9); drumX(g, M.blued, 0.04, by - 0.022, 0.0, 0.01, 0.01); }
  else if (o.bolt === 'straight') { B(g, M.blued, 0.035, by + 0.004, -0.01, 0.045, 0.006, 0.006); drumX(g, M.blued, 0.06, by + 0.004, -0.01, 0.01, 0.01); }
  else if (o.bolt === 'oprod') { B(g, M.blued, 0.018, by - 0.002, 0.12, 0.008, 0.008, 0.36); B(g, M.blued, 0.022, by + 0.004, -0.02, 0.012, 0.01, 0.02); }
  if (o.mag === 'box') magStraight(g, 0.05, by - 0.03, o.magLen || 0.06, 0.07, 0.03, M.blued, 0.05);
  else B(g, M.blued, 0, by - 0.05, 0.05, 0.03, 0.02, 0.08);                               // floor plate
  trigger(g, 0.012, by - 0.045);
  if (o.monopod) B(g, M.steel, 0, by - 0.05, zf - 0.08, 0.005, 0.005, 0.18);
  if (o.cleaningRod) tube(g, M.steel, 0.3, zm - 0.03, 0.003, by - 0.012);
  return { muzzle: zm, top: by + 0.034, hand2: [0.03, by - 0.06, o.h2 ?? Math.min(0.4, zf * 0.55)] };
}

// ===================================================================== assault rifles / SMGs with stocks
// AK family. o: { wood, mag, brake 'slant'|'74'|'none', poly }
function ak(g, o = {}) {
  const wood = o.wood || M.beech, by = 0.035;
  B(g, M.blued, 0, by - 0.005, 0.08, 0.036, 0.05, 0.3);                                   // receiver
  B(g, M.blued, 0, by + 0.024, 0.07, 0.032, 0.012, 0.28);                                 // dust cover
  B(g, M.blued, 0.02, by + 0.01, 0.13, 0.02, 0.006, 0.12);                                // charging handle rail
  drumX(g, M.blued, 0.034, by + 0.01, 0.2, 0.008, 0.012);
  tube(g, M.blued, 0.22, 0.6, 0.0095, by + 0.005);
  tube(g, M.blued, 0.22, 0.47, 0.011, by + 0.036);                                        // gas tube
  B(g, wood, 0, by + 0.036, 0.3, 0.03, 0.022, 0.16);                                      // upper handguard
  prof(g, wood, [[0.23, by - 0.015], [0.46, by - 0.015], [0.46, by + 0.02], [0.23, by + 0.02]], 0.044);   // lower handguard
  B(g, M.blued, 0, by + 0.045, 0.52, 0.012, 0.03, 0.02);                                  // front sight block
  fsight(g, 0.52, by + 0.06, true);
  B(g, M.blued, 0, by + 0.044, 0.2, 0.018, 0.012, 0.05);                                  // rear sight
  if (o.brake === 'slant') tube(g, M.blued, 0.6, 0.63, 0.012, by + 0.005);
  else if (o.brake === '74') { tube(g, M.blued, 0.6, 0.68, 0.013, by + 0.005); B(g, M.dark, 0, by + 0.005, 0.64, 0.028, 0.004, 0.012); }
  magCurved(g, 0.1, by - 0.03, 0.2, 0.05, 0.026, 0.75, o.mag || M.blued);
  pgrip(g, wood === M.beech || wood === M.red ? M.bakelite : wood, 0.0, by - 0.03, 0.1, 0.035, 0.034, 0.28);
  trigger(g, 0.035, by - 0.035);
  butt(g, wood, -0.06, -0.33, by + 0.0, 0.05, 0.1, 0.042);
  B(g, M.blued, 0, by - 0.1, -0.33, 0.042, 0.1, 0.006);
  return { muzzle: o.brake === '74' ? 0.68 : o.brake === 'slant' ? 0.63 : 0.6, top: by + 0.062, hand2: [0.03, by - 0.04, 0.34] };
}
function m16(g) {
  const by = 0.04;
  B(g, M.black, 0, by - 0.01, 0.08, 0.036, 0.055, 0.28);                                  // receivers
  B(g, M.black, 0, by + 0.045, 0.07, 0.018, 0.04, 0.2);                                   // carry handle
  B(g, M.black, 0, by + 0.03, 0.07, 0.03, 0.01, 0.2);
  rsight(g, -0.02, by + 0.07);
  prof(g, M.poly, [[0.22, by - 0.03], [0.5, by - 0.022], [0.5, by + 0.026], [0.22, by + 0.034]], 0.052);   // triangular handguard
  for (let i = 0; i < 6; i++) B(g, M.dark, 0.0265, by, 0.25 + i * 0.04, 0.002, 0.03, 0.008);
  tube(g, M.black, 0.5, 0.76, 0.0085, by + 0.004);
  prof(g, M.black, [[0.56, by + 0.01], [0.6, by + 0.01], [0.585, by + 0.075], [0.575, by + 0.075]], 0.012);   // front sight tower
  jacket(g, 0.76, 0.81, 0.011, by + 0.004, 2, M.black);
  magStraight(g, 0.08, by - 0.035, 0.16, 0.05, 0.026, M.alloy, 0.12);
  pgrip(g, M.poly, 0.0, by - 0.035, 0.1, 0.034, 0.032, 0.3);
  trigger(g, 0.035, by - 0.04);
  prof(g, M.poly, [[-0.06, by + 0.02], [-0.36, by + 0.015], [-0.36, by - 0.1], [-0.06, by - 0.03]], 0.044);   // fixed stock in line
  return { muzzle: 0.81, top: by + 0.078, hand2: [0.035, by - 0.04, 0.36] };
}
function stg44(g) {
  const by = 0.035;
  prof(g, M.park, [[-0.06, by + 0.03], [0.26, by + 0.03], [0.26, by - 0.02], [0.1, by - 0.03], [-0.06, by - 0.03]], 0.036);   // stamped receiver
  tube(g, M.park, 0.26, 0.55, 0.012, by + 0.035);                                         // gas tube
  tube(g, M.blued, 0.26, 0.6, 0.0095, by);
  B(g, M.park, 0, by + 0.036, 0.5, 0.012, 0.03, 0.02);
  fsight(g, 0.5, by + 0.056, true);
  rsight(g, 0.2, by + 0.04);
  prof(g, M.poly, [[0.24, by - 0.02], [0.4, by - 0.018], [0.4, by + 0.02], [0.24, by + 0.02]], 0.04);
  magCurved(g, 0.1, by - 0.03, 0.27, 0.042, 0.022, 0.55, M.park);
  pgrip(g, M.bakelite, 0.0, by - 0.03, 0.1, 0.035, 0.033, 0.25);
  trigger(g, 0.035, by - 0.035);
  butt(g, M.beech, -0.06, -0.3, by + 0.02, 0.04, 0.1, 0.04);
  tube(g, M.blued, 0.6, 0.62, 0.012, by);
  return { muzzle: 0.62, top: by + 0.062, hand2: [0.03, by - 0.04, 0.32] };
}
function ppsh(g) {
  const by = 0.035;
  prof(g, M.birch, [[-0.36, by - 0.02], [-0.06, by + 0.01], [0.13, by + 0.012], [0.13, by - 0.03], [0.02, by - 0.045], [-0.05, by - 0.075], [-0.34, by - 0.12], [-0.36, by - 0.115]], 0.045);
  B(g, M.blued, 0, by + 0.02, 0.05, 0.036, 0.03, 0.2);                                    // receiver
  jacket(g, 0.13, 0.4, 0.022, by + 0.012, 3, M.blued);                                   // perforated barrel jacket
  prof(g, M.blued, [[0.4, by - 0.012], [0.44, by - 0.012], [0.46, by + 0.04], [0.4, by + 0.035]], 0.044);   // slanted muzzle brake
  tube(g, M.blued, 0.13, 0.44, 0.008, by + 0.012);
  drumX(g, M.blued, 0, by - 0.07, 0.1, 0.075, 0.05);                                      // 71-round drum
  drumX(g, M.steel, 0, by - 0.07, 0.1, 0.02, 0.054);
  trigger(g, 0.01, by - 0.038);
  B(g, M.blued, 0, by + 0.04, 0.07, 0.018, 0.012, 0.03);
  fsight(g, 0.43, by + 0.045, true);
  return { muzzle: 0.45, top: by + 0.05, hand2: [0.03, by - 0.05, 0.2] };
}
function mp40(g) {
  const by = 0.035;
  tube(g, M.blued, -0.08, 0.2, 0.021, by + 0.01);
  prof(g, M.bakelite, [[-0.02, by - 0.015], [0.2, by - 0.015], [0.2, by + 0.004], [-0.02, by + 0.004]], 0.04);
  B(g, M.blued, 0, by - 0.02, 0.24, 0.03, 0.05, 0.05);                                    // magazine housing
  magStraight(g, 0.24, by - 0.045, 0.2, 0.03, 0.02, M.blued);
  tube(g, M.blued, 0.2, 0.44, 0.009, by + 0.01);
  B(g, M.bakelite, 0, by - 0.004, 0.4, 0.014, 0.014, 0.05);                                // barrel rest under the barrel
  pgrip(g, M.bakelite, -0.01, by - 0.012, 0.1, 0.036, 0.034, 0.3);
  trigger(g, 0.02, by - 0.02);
  for (const sx of [-1, 1]) B(g, M.blued, sx * 0.02, by - 0.012, 0.05, 0.006, 0.01, 0.26);    // stock folded forward under the receiver
  B(g, M.blued, 0, by - 0.03, 0.18, 0.046, 0.04, 0.01);
  B(g, M.blued, 0, by - 0.005, -0.085, 0.03, 0.03, 0.02);
  fsight(g, 0.43, by + 0.032, true);
  rsight(g, 0.1, by + 0.036);
  B(g, M.blued, 0.024, by + 0.012, 0.04, 0.02, 0.008, 0.01);
  return { muzzle: 0.44, top: by + 0.043, hand2: [0.02, by - 0.08, 0.24] };
}
function thompson(g) {
  const by = 0.035;
  B(g, M.blued, 0, by + 0.005, 0.05, 0.038, 0.05, 0.22);
  tube(g, M.blued, 0.16, 0.46, 0.011, by + 0.01);
  for (let i = 0; i < 10; i++) tube(g, M.blued, 0.17 + i * 0.012, 0.176 + i * 0.012, 0.017, by + 0.01);   // cooling fins
  B(g, M.blued, 0, by + 0.012, 0.45, 0.03, 0.028, 0.05);                                  // Cutts compensator
  for (let i = 0; i < 3; i++) B(g, M.dark, 0, by + 0.027, 0.435 + i * 0.012, 0.012, 0.004, 0.005);
  pgrip(g, M.walnut, 0.24, by - 0.01, 0.075, 0.03, 0.03, -0.25);                          // vertical foregrip
  pgrip(g, M.walnut, -0.02, by - 0.02, 0.095, 0.035, 0.032, 0.3);
  magStraight(g, 0.1, by - 0.02, 0.15, 0.028, 0.022, M.blued);
  trigger(g, 0.02, by - 0.024);
  butt(g, M.walnut, -0.06, -0.33, by + 0.015, 0.04, 0.1, 0.04);
  B(g, M.blued, 0, by + 0.035, -0.02, 0.018, 0.022, 0.02);
  fsight(g, 0.425, by + 0.03);
  B(g, M.blued, 0.024, by + 0.03, 0.07, 0.012, 0.012, 0.012);
  return { muzzle: 0.475, top: by + 0.05, hand2: [0.02, by - 0.08, 0.24] };
}
function fal(g, g3 = false) {
  const by = 0.04;
  B(g, M.black, 0, by, 0.08, 0.04, 0.06, 0.3);
  if (!g3) { B(g, M.black, 0, by + 0.045, 0.13, 0.012, 0.03, 0.12); B(g, M.black, 0, by + 0.06, 0.13, 0.03, 0.006, 0.12); }   // carry handle
  else { tube(g, M.black, -0.04, 0.3, 0.012, by + 0.04); drumX(g, M.black, 0, by + 0.05, 0.0, 0.012, 0.03); }              // cocking tube / drum sight
  if (g3) tube(g, M.poly, 0.25, 0.5, 0.026, by + 0.005);                                  // round handguard
  else prof(g, M.poly, [[0.24, by - 0.02], [0.5, by - 0.012], [0.5, by + 0.03], [0.24, by + 0.03]], 0.05);
  tube(g, M.black, 0.23, 0.7, 0.0095, by + 0.005);
  tube(g, M.black, 0.5, 0.56, 0.014, by + 0.02);                                          // gas block
  jacket(g, 0.7, 0.77, 0.012, by + 0.005, 2, M.black);
  B(g, M.black, 0, by + 0.032, 0.6, 0.012, 0.03, 0.015);
  fsight(g, 0.6, by + 0.05, true, M.black);
  magStraight(g, 0.09, by - 0.03, 0.14, 0.055, 0.026, M.black, 0.06);
  pgrip(g, M.poly, 0.0, by - 0.03, 0.1, 0.035, 0.034, 0.25);
  trigger(g, 0.035, by - 0.035);
  prof(g, M.poly, [[-0.06, by + 0.025], [-0.36, by + 0.005], [-0.36, by - 0.11], [-0.06, by - 0.04]], 0.044);
  return { muzzle: 0.77, top: by + 0.068, hand2: [0.035, by - 0.04, 0.36] };
}

// ===================================================================== machine guns
function dp(g, tank = false) {
  const by = 0.035;
  B(g, M.blued, 0, by, 0.06, 0.04, 0.06, 0.28);
  jacket(g, 0.2, 0.62, 0.026, by + 0.005, 3, M.blued);
  tube(g, M.blued, 0.2, 0.7, 0.01, by + 0.005);
  taper(g, M.blued, 0.66, 0.74, 0.014, 0.024, by + 0.005);                                // conical flash hider
  panY(g, M.blued, 0, by + 0.045, 0.08, tank ? 0.12 : 0.13, tank ? 0.04 : 0.028);          // pan magazine on top
  panY(g, M.steel, 0, by + (tank ? 0.066 : 0.06), 0.08, 0.03, 0.01);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; B(g, M.dark, Math.sin(a) * 0.1, by + (tank ? 0.066 : 0.06), 0.08 + Math.cos(a) * 0.1, 0.004, 0.002, 0.03, 0, a, 0); }
  if (tank) {
    pgrip(g, M.walnut, -0.02, by - 0.03, 0.09, 0.034, 0.032, 0.2);
    B(g, M.steel, 0, by - 0.005, -0.14, 0.012, 0.012, 0.22);                                // telescopic stock
    B(g, M.steel, 0, by - 0.04, -0.26, 0.04, 0.09, 0.012);
  } else {
    prof(g, M.walnut, [[-0.08, by + 0.01], [-0.4, by - 0.02], [-0.4, by - 0.13], [-0.26, by - 0.1], [-0.12, by - 0.06], [-0.08, by - 0.035]], 0.042);
    bipod(g, 0.5, by - 0.01, 0.3, true);
  }
  trigger(g, 0.02, by - 0.035);
  fsight(g, 0.62, by + 0.045, true);
  return { muzzle: 0.74, top: by + 0.07, hand2: [0.03, by + 0.08, 0.08] };
}
function mg34(g, o = {}) {
  const by = 0.035;
  B(g, M.black, 0, by, 0.02, 0.045, 0.065, 0.3);
  B(g, M.black, 0, by + 0.04, 0.03, 0.05, 0.02, 0.16);                                    // feed cover
  if (o.square) jacket(g, 0.17, 0.6, 0.028, by + 0.004, 2, M.black, true);
  else jacket(g, 0.17, 0.6, 0.026, by + 0.004, 3, M.black);
  tube(g, M.black, 0.6, 0.7, 0.018, by + 0.004);                                          // muzzle booster
  taper(g, M.black, 0.7, 0.73, 0.018, 0.012, by + 0.004);
  if (o.drum) { drumX(g, M.olive, 0.07, by - 0.02, 0.06, 0.06, 0.06); }
  else { B(g, M.olive, 0.07, by - 0.04, 0.05, 0.08, 0.09, 0.12); B(g, M.brass, 0.03, by + 0.015, 0.05, 0.05, 0.008, 0.025); }
  pgrip(g, M.poly, -0.01, by - 0.03, 0.09, 0.034, 0.034, 0.3);
  trigger(g, 0.02, by - 0.035);
  prof(g, o.wood ? M.walnut : M.poly, [[-0.13, by + 0.015], [-0.43, by - 0.005], [-0.43, by - 0.11], [-0.33, by - 0.1], [-0.16, by - 0.05], [-0.13, by - 0.02]], 0.044);
  bipod(g, 0.55, by - 0.02, 0.28, true);
  fsight(g, 0.59, by + 0.045);
  B(g, M.black, 0, by + 0.058, 0.08, 0.02, 0.02, 0.02);
  return { muzzle: 0.73, top: by + 0.07, hand2: [0.03, by + 0.07, -0.25] };
}
function m1919(g) {
  const by = 0.04;
  B(g, M.park, 0, by, 0.0, 0.05, 0.1, 0.3);                                               // box receiver
  jacket(g, 0.15, 0.62, 0.03, by + 0.01, 3, M.park);
  tube(g, M.park, 0.62, 0.66, 0.018, by + 0.01);
  B(g, M.olive, 0.075, by - 0.03, 0.02, 0.09, 0.11, 0.16);                                // belt box
  B(g, M.brass, 0.035, by + 0.03, 0.02, 0.05, 0.008, 0.03);
  pgrip(g, M.walnut, -0.13, by - 0.05, 0.09, 0.034, 0.03, 0.3);                           // rear pistol grip (A4)
  B(g, M.park, 0, by - 0.05, -0.1, 0.01, 0.01, 0.08);
  fsight(g, 0.12, by + 0.07);
  rsight(g, -0.08, by + 0.058);
  B(g, M.park, 0, by - 0.07, 0.08, 0.04, 0.04, 0.04);                                     // tripod pintle
  return { muzzle: 0.66, top: by + 0.078, hand2: [0.03, by + 0.07, -0.05] };
}
function m240(g, pk = false) {
  const by = 0.04;
  B(g, M.black, 0, by, 0.03, 0.05, 0.075, 0.3);
  tube(g, M.black, 0.18, 0.66, 0.012, by + 0.012);
  if (pk) for (let i = 0; i < 8; i++) B(g, M.dark, 0, by + 0.012, 0.22 + i * 0.05, 0.028, 0.004, 0.012);   // fluted barrel
  tube(g, M.black, 0.18, 0.46, 0.012, by - 0.018);                                        // gas cylinder under the barrel
  jacket(g, 0.66, 0.72, 0.015, by + 0.012, 2, M.black);
  B(g, M.black, pk ? 0.03 : 0, by + 0.05, 0.2, 0.012, 0.03, 0.06);                         // carry handle
  B(g, M.olive, 0.075, by - 0.04, 0.03, 0.08, 0.1, 0.12);
  pgrip(g, M.poly, 0.0, by - 0.035, 0.09, 0.034, 0.034, 0.25);
  trigger(g, 0.025, by - 0.04);
  if (pk) {                                                                               // skeleton wooden stock (PKM)
    prof(g, M.red, [[-0.12, by + 0.02], [-0.42, by - 0.01], [-0.42, by - 0.11], [-0.38, by - 0.11], [-0.38, by - 0.03], [-0.16, by - 0.01], [-0.16, by - 0.05], [-0.38, by - 0.07], [-0.38, by - 0.11], [-0.12, by - 0.04]], 0.04);
  } else prof(g, M.poly, [[-0.12, by + 0.02], [-0.44, by - 0.005], [-0.44, by - 0.11], [-0.12, by - 0.04]], 0.046);
  bipod(g, 0.5, by - 0.02, 0.28, true);
  fsight(g, 0.64, by + 0.04, true, M.black);
  return { muzzle: 0.72, top: by + 0.07, hand2: [0.03, by + 0.07, -0.25] };
}
function bren(g) {
  const by = 0.035;
  B(g, M.park, 0, by, 0.05, 0.045, 0.065, 0.3);
  tube(g, M.park, 0.2, 0.66, 0.013, by + 0.005);
  for (let i = 0; i < 7; i++) tube(g, M.park, 0.21 + i * 0.03, 0.225 + i * 0.03, 0.02, by + 0.005);   // barrel ribs
  taper(g, M.park, 0.64, 0.72, 0.014, 0.022, by + 0.005);                                  // conical flash hider
  B(g, M.park, 0, by + 0.05, 0.3, 0.014, 0.04, 0.012);                                    // carry handle
  B(g, M.park, 0, by + 0.07, 0.34, 0.012, 0.012, 0.09);
  magCurved(g, 0.08, by + 0.03, 0.17, 0.05, 0.024, 0.5, M.park, true);                   // curved magazine on top
  pgrip(g, M.walnut, -0.01, by - 0.03, 0.09, 0.034, 0.032, 0.3);
  trigger(g, 0.02, by - 0.035);
  prof(g, M.walnut, [[-0.1, by + 0.015], [-0.43, by - 0.005], [-0.43, by - 0.11], [-0.32, by - 0.1], [-0.13, by - 0.05], [-0.1, by - 0.02]], 0.044);
  B(g, M.park, 0, by + 0.012, -0.28, 0.02, 0.012, 0.3);                                   // butt strap
  bipod(g, 0.5, by - 0.012, 0.28, true);
  B(g, M.park, -0.035, by + 0.05, 0.05, 0.012, 0.04, 0.04);                               // offset sights
  B(g, M.park, -0.035, by + 0.05, 0.58, 0.008, 0.03, 0.01);
  return { muzzle: 0.72, top: by + 0.07, hand2: [0.03, by + 0.08, -0.25] };
}
function hotchkiss(g) {
  const by = 0.04;
  B(g, M.brass, 0, by, 0.05, 0.05, 0.08, 0.3);                                            // brass receiver
  tube(g, M.steel, 0.2, 0.84, 0.013, by + 0.01);
  fins(g, 0.2, 0.45, 0.032, by + 0.01, 14, M.brass);                                       // radiator fins
  tube(g, M.steel, 0.84, 0.87, 0.018, by + 0.01);
  B(g, M.brass, 0.07, by + 0.015, 0.05, 0.1, 0.006, 0.05);                                 // feed strip from the left
  for (let i = 0; i < 6; i++) tube(g, M.brass, 0.0, 0.03, 0.004, by + 0.02, 0.04 + i * 0.012);
  pgrip(g, M.walnut, -0.02, by - 0.04, 0.09, 0.034, 0.032, 0.35);
  trigger(g, 0.02, by - 0.045);
  prof(g, M.steel, [[-0.12, by + 0.01], [-0.4, by - 0.01], [-0.4, by - 0.1], [-0.36, by - 0.1], [-0.36, by - 0.02], [-0.12, by - 0.03]], 0.036);
  fsight(g, 0.82, by + 0.03);
  rsight(g, 0.05, by + 0.05);
  return { muzzle: 0.87, top: by + 0.062, hand2: [0.03, by + 0.07, -0.1] };
}
function vickers(g) {
  const by = 0.05;
  B(g, M.blued, 0, by, 0.0, 0.07, 0.11, 0.26);                                            // receiver box
  tube(g, M.blued, 0.13, 0.62, 0.052, by + 0.012);                                        // water jacket
  for (let i = 0; i < 12; i++) tube(g, M.blued, 0.15 + i * 0.04, 0.165 + i * 0.04, 0.056, by + 0.012);   // corrugations
  taper(g, M.blued, 0.62, 0.72, 0.03, 0.02, by + 0.012);                                  // muzzle booster cone
  tube(g, M.blued, 0.72, 0.76, 0.012, by + 0.012);
  tube(g, M.brass, 0.3, 0.33, 0.012, by + 0.07);                                          // filler cap
  B(g, M.canvas, -0.08, by + 0.02, 0.02, 0.1, 0.012, 0.04);                                // canvas belt from the right
  for (const sx of [-1, 1]) {                                                              // spade grips
    B(g, M.blued, sx * 0.03, by - 0.01, -0.15, 0.012, 0.012, 0.05);
    tube(g, M.walnut, -0.2, -0.13, 0.013, by - 0.035, sx * 0.03).rotation.x = PI / 2 - 0.2;
  }
  B(g, M.blued, 0, by - 0.04, -0.14, 0.012, 0.02, 0.02);                                  // thumb trigger
  fsight(g, 0.6, by + 0.07);
  rsight(g, -0.08, by + 0.065);
  return { muzzle: 0.76, top: by + 0.078, hand2: [-0.03, by - 0.035, -0.16] };
}
function reibel(g) {
  const by = 0.035;
  B(g, M.park, 0, by, 0.03, 0.045, 0.07, 0.3);
  tube(g, M.park, 0.18, 0.62, 0.012, by + 0.008);
  tube(g, M.park, 0.18, 0.32, 0.024, by + 0.008);
  drumX(g, M.olive, -0.07, by + 0.01, 0.03, 0.1, 0.05);                                    // 150-round side drum
  drumX(g, M.steel, -0.098, by + 0.01, 0.03, 0.02, 0.01);
  pgrip(g, M.walnut, -0.02, by - 0.035, 0.09, 0.034, 0.032, 0.3);
  trigger(g, 0.02, by - 0.04);
  B(g, M.park, 0, by, -0.14, 0.03, 0.05, 0.02);                                           // back plate
  fsight(g, 0.6, by + 0.03);
  return { muzzle: 0.62, top: by + 0.05, hand2: [0.03, by + 0.07, 0.0] };
}
function type97(g) {
  const by = 0.035;
  B(g, M.blued, 0, by, 0.05, 0.045, 0.065, 0.3);
  tube(g, M.blued, 0.2, 0.72, 0.012, by + 0.005);
  fins(g, 0.2, 0.42, 0.024, by + 0.005, 12, M.blued);
  taper(g, M.blued, 0.7, 0.76, 0.013, 0.02, by + 0.005);
  magStraight(g, 0.08, by + 0.03, 0.15, 0.05, 0.024, M.blued, -0.1, true);               // top magazine
  pgrip(g, M.walnut, -0.01, by - 0.03, 0.09, 0.034, 0.032, 0.3);
  trigger(g, 0.02, by - 0.035);
  prof(g, M.walnut, [[-0.1, by + 0.015], [-0.43, by - 0.005], [-0.43, by - 0.11], [-0.32, by - 0.1], [-0.13, by - 0.05], [-0.1, by - 0.02]], 0.044);
  bipod(g, 0.5, by - 0.012, 0.28, true);
  B(g, M.blued, -0.035, by + 0.04, 0.05, 0.01, 0.03, 0.03);
  return { muzzle: 0.76, top: by + 0.06, hand2: [0.03, by + 0.08, -0.25] };
}

// ===================================================================== catalogue
const BUILD = {
  // pistols
  luger, c96,
  p38: g => pistol(g, { L: 0.2, h: 0.03, openTop: true, grip: M.bakelite, rake: 0.3 }),
  tt: g => pistol(g, { L: 0.195, h: 0.03, w: 0.024, grip: M.bakelite, rake: 0.22, hammer: true, ring: true }),
  m1911: g => pistol(g, { L: 0.21, h: 0.032, w: 0.026, grip: M.walnut, rake: 0.3, park: true, slide: M.park, frame: M.park }),
  hipower: g => pistol(g, { L: 0.2, h: 0.032, w: 0.027, grip: M.walnut, rake: 0.3, gd: 0.04 }),
  pm: g => pistol(g, { L: 0.16, h: 0.028, w: 0.024, grip: M.bakelite, rake: 0.2, gl: 0.085, ring: true }),
  glock: g => pistol(g, { L: 0.186, h: 0.03, w: 0.028, grip: M.poly, frame: M.poly, slide: M.black, rake: 0.36, hammer: false, squareGuard: true }),
  beretta92: g => pistol(g, { L: 0.217, h: 0.032, w: 0.028, openTop: true, grip: M.poly, frame: M.alloy, rake: 0.28, gd: 0.04 }),
  aps: g => { const r = pistol(g, { L: 0.225, h: 0.034, w: 0.03, grip: M.bakelite, rake: 0.22, gl: 0.11 }); B(g, M.steel, 0.018, 0.025, -0.04, 0.008, 0.008, 0.012); return r; },
  // revolvers
  nagant: g => revolver(g, { bl: 0.114, cr: 0.019, cl: 0.038, grip: 'bird', ejector: 'side', br: 0.008 }),
  webley: g => revolver(g, { bl: 0.152, cr: 0.022, cl: 0.036, frame: 'topbreak', grip: 'bird', gmat: M.bakelite, rib: 'plain' }),
  saa: g => revolver(g, { bl: 0.14, cr: 0.021, cl: 0.042, frame: 'saa', grip: 'plow', ejector: 'side', rib: false }),
  sw1917: g => revolver(g, { bl: 0.14, cr: 0.022, cl: 0.042, grip: 'round', ejector: true }),
  python: g => revolver(g, { bl: 0.152, cr: 0.021, cl: 0.04, rib: 'vent', lug: true, grip: 'square', br: 0.0095 }),
  m29: g => revolver(g, { bl: 0.16, cr: 0.024, cl: 0.044, lug: true, grip: 'square', br: 0.0105, rib: 'plain' }),
  enfield2: g => revolver(g, { bl: 0.127, cr: 0.02, cl: 0.036, frame: 'topbreak', grip: 'bird', gmat: M.bakelite, spur: false }),
  lebel92: g => revolver(g, { bl: 0.117, cr: 0.019, cl: 0.036, grip: 'round', ejector: true, cmat: M.steel }),
  reich79: g => revolver(g, { bl: 0.183, cr: 0.022, cl: 0.04, grip: 'round', rib: false, br: 0.009 }),
  newserv: g => revolver(g, { bl: 0.14, cr: 0.024, cl: 0.046, grip: 'round', ejector: true }),
  // compact SMGs
  uzi: g => uzi(g, 1, true),
  miniuzi: g => uzi(g, 0.82, true),
  microuzi: g => uzi(g, 0.62, false),
  mac10: g => mac(g, 1),
  mac11: g => mac(g, 0.85),
  skorpion, mp5k, tec9, kedr, mp7,
  // rifles
  mosin: g => rifle(g, { L: 1.23, zb: -0.36, bl: 0.07, bands: [0.45, 0.72], bolt: 'straight', hex: true, hood: true, rl: 0.2, wood: M.birch, hgFrom: 0.2 }),
  kar98k: g => rifle(g, { L: 1.11, zb: -0.35, bl: 0.07, bands: [0.4, 0.62], bolt: 'bent', hood: true, rl: 0.22, grip: 'semi', wood: M.walnut }),
  enfield4: g => rifle(g, { L: 1.13, zb: -0.34, bl: 0.13, bands: [0.5], bolt: 'bent', mag: 'box', magLen: 0.055, peep: true, twoPiece: true, wood: M.beech, grip: 'semi' }),
  garand: g => rifle(g, { L: 1.1, zb: -0.33, bl: 0.06, bands: [0.64], bolt: 'oprod', peep: true, rl: 0.24, wood: M.walnut, hood: true, grip: 'semi', twoPiece: false }),
  springf: g => rifle(g, { L: 1.1, zb: -0.35, bl: 0.06, bands: [0.42, 0.62], bolt: 'bent', peep: false, rl: 0.22, wood: M.walnut, hood: true }),
  svt40: g => rifle(g, { L: 1.22, zb: -0.36, bl: 0.22, zf: 0.52, bands: [0.5], bolt: 'none', mag: 'box', magLen: 0.08, muzzleBrake: true, cleaningRod: true, wood: M.birch, hood: true, hgFrom: 0.22 }),
  lebel86: g => rifle(g, { L: 1.3, zb: -0.37, bl: 0.09, bands: [0.46, 0.76], bolt: 'straight', twoPiece: true, rl: 0.22, wood: M.walnut, br: 0.008 }),
  arisaka: g => rifle(g, { L: 1.12, zb: -0.35, bl: 0.07, bands: [0.42, 0.63], bolt: 'straight', monopod: true, wood: M.beech, hood: true }),
  g43: g => rifle(g, { L: 1.13, zb: -0.35, bl: 0.2, zf: 0.55, bands: [0.45], bolt: 'none', mag: 'box', magLen: 0.08, wood: M.walnut, hood: true, grip: 'semi' }),
  svd: g => {
    const by = 0.03;
    prof(g, M.red, [[-0.4, by], [-0.06, by + 0.01], [-0.06, by - 0.03], [-0.14, by - 0.03], [-0.14, by - 0.075], [-0.38, by - 0.075], [-0.4, by - 0.14], [-0.36, by - 0.14], [-0.33, by - 0.09], [-0.06, by - 0.06], [0.0, by - 0.04]], 0.042);   // thumbhole stock
    B(g, M.blued, 0, by, 0.1, 0.036, 0.05, 0.3);
    prof(g, M.red, [[0.24, by - 0.022], [0.52, by - 0.018], [0.52, by + 0.03], [0.24, by + 0.03]], 0.046);
    for (let i = 0; i < 4; i++) B(g, M.dark, 0.0235, by + 0.005, 0.28 + i * 0.06, 0.002, 0.02, 0.025);
    tube(g, M.blued, 0.24, 0.8, 0.0095, by + 0.005);
    jacket(g, 0.8, 0.88, 0.012, by + 0.005, 2);
    magStraight(g, 0.1, by - 0.025, 0.1, 0.06, 0.026, M.blued, 0.08);
    trigger(g, 0.035, by - 0.03);
    scope(g, 0.1, by + 0.07, 0.3, 0.018, 0.025);
    fsight(g, 0.78, by + 0.03, true);
    return { muzzle: 0.88, top: by + 0.07, hand2: [0.035, by - 0.04, 0.36], scopeX: 0.025 };
  },
  // automatics
  ak47: g => ak(g, { wood: M.beech }),
  akm: g => ak(g, { wood: M.red, brake: 'slant' }),
  ak74: g => ak(g, { wood: M.plum, brake: '74', mag: M.orange }),
  m16, stg44, ppsh, mp40, thompson,
  fal: g => fal(g, false),
  g3: g => fal(g, true),
  // machine guns
  dp27: g => dp(g, false),
  dt: g => dp(g, true),
  mg34: g => mg34(g, { drum: true, wood: false }),
  mg42: g => mg34(g, { square: true }),
  mg3: g => mg34(g, { square: true }),
  m1919, m240,
  pkt: g => m240(g, true),
  bren, hotchkiss, vickers, reibel, type97,
};

// fallback for weapons without a dedicated builder (by category)
function generic(g, W) {
  const c = W.cat;
  if (c === 'pistol') return pistol(g, {});
  if (c === 'revolver') return revolver(g, {});
  if (c === 'smg') return uzi(g, 0.8, false);
  if (c === 'rifle') return rifle(g, { L: W.m.len || 1.1, bolt: 'bent' });
  if (c === 'auto') return ak(g, {});
  return mg34(g, {});
}

export function buildWeaponModel(key, W) {
  const g = new THREE.Group();
  const res = (BUILD[key] || (gg => generic(gg, W)))(g);
  return { group: g, muzzle: res.muzzle, top: res.top, hand2: res.hand2, scopeX: res.scopeX || 0 };
}

// ===================================================================== grenades (origin at the bottom, up +Y)
const GREN = {
  pineapple(g, mat, h = 0.1, r = 0.028) {                                                   // F-1 / Mk 2 / Mills: segmented body
    mesh(g, G.sph, mat, 0, h * 0.42, 0, r, h * 0.45, r);
    for (let i = 0; i < 4; i++) mesh(g, G.cylY, M.dark, 0, h * 0.2 + i * h * 0.13, 0, r * 1.02, 0.003, r * 1.02);
    for (let i = 0; i < 6; i++) B(g, M.dark, Math.sin(i) * r * 0.72, h * 0.42, Math.cos(i) * r * 0.72, 0.003, h * 0.7, 0.003, 0, i, 0);
  },
  fuse(g, h, lever = true) {
    mesh(g, G.cylY, M.steel, 0, h, 0, 0.009, 0.022, 0.009);
    if (lever) B(g, M.steel, 0.012, h - 0.018, 0, 0.004, 0.05, 0.011, 0, 0, -0.12);
    mesh(g, new THREE.TorusGeometry(0.008, 0.0016, 4, 10), M.steel, -0.01, h + 0.004, 0, 1, 1, 1, 0, PI / 2, 0);
  },
};
export function buildGrenadeModel(key, D) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: D.color, roughness: 0.8, metalness: 0.2 });
  if (key === 'f1' || key === 'mk2' || key === 'mills') { GREN.pineapple(g, mat, key === 'mills' ? 0.095 : 0.1); GREN.fuse(g, 0.1); }
  else if (key === 'rgd5' || key === 'm67') {
    mesh(g, G.sph, mat, 0, 0.042, 0, key === 'm67' ? 0.031 : 0.028, key === 'm67' ? 0.032 : 0.04, key === 'm67' ? 0.031 : 0.028);
    GREN.fuse(g, key === 'm67' ? 0.078 : 0.085);
  } else if (key === 'm24') {                                                                // stick grenade: can on a wooden handle
    mesh(g, G.cylY, mat, 0, 0.26, 0, 0.034, 0.075, 0.034);
    mesh(g, G.cylY, M.beech, 0, 0.12, 0, 0.013, 0.22, 0.013);
    mesh(g, G.cylY, M.steel, 0, 0.0, 0, 0.014, 0.012, 0.014);
  } else if (key === 'rgd33') {
    mesh(g, G.cylY, mat, 0, 0.2, 0, 0.026, 0.08, 0.026);
    mesh(g, G.cylY, M.blued, 0, 0.2, 0, 0.03, 0.05, 0.03);                                  // fragmentation sleeve
    mesh(g, G.cylY, M.olive, 0, 0.08, 0, 0.014, 0.16, 0.014);
  } else if (key === 'bundle') {                                                             // grenade heads tied round a stick grenade
    mesh(g, G.cylY, mat, 0, 0.26, 0, 0.034, 0.075, 0.034);
    for (const a of [0, 2.1, 4.2]) mesh(g, G.cylY, mat, Math.sin(a) * 0.066, 0.25, Math.cos(a) * 0.066, 0.032, 0.07, 0.032);
    mesh(g, G.cylY, M.canvas, 0, 0.25, 0, 0.1, 0.018, 0.1);                               // binding wire / cord
    mesh(g, G.cylY, M.beech, 0, 0.12, 0, 0.013, 0.22, 0.013);
  } else if (key === 'rpg43' || key === 'rkg3') {                                            // anti-tank: shaped charge head on a handle
    mesh(g, G.cylY, mat, 0, 0.25, 0, 0.045, 0.1, 0.045);
    mesh(g, new THREE.CylinderGeometry(0.03, 0.045, 0.05, 12), mat, 0, 0.325, 0, 1, 1, 1);
    mesh(g, G.cylY, key === 'rkg3' ? M.olive : M.beech, 0, 0.11, 0, 0.017, 0.2, 0.017);
    mesh(g, G.cylY, M.canvas, 0, 0.0, 0, 0.018, 0.02, 0.018);
  } else {
    mesh(g, G.sph, mat, 0, 0.04, 0, 0.03, 0.042, 0.03);
    GREN.fuse(g, 0.09);
  }
  return g;
}
