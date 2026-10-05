// Shared toolkit of the procedural rolling stock (traindefs/<key>.js): wheels and wheelsets, bogies, buffers and
// couplers, frames, bodies with real window / door openings (and a dark inside), roofs, boilers, chimneys, domes, cabs,
// tenders, diesel bodies - and the bake: a model becomes one body geometry (colour + roughness / metalness per vertex,
// the bakestatic material) and one geometry of the parts that turn (wheels, coupling rods) moved in the vertex shader
// (trains.js) by the distance the train has run.
// Vehicle-local axes: +Z forward, +Y up, +X left; the origin on the rail heads under the middle of the vehicle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PI = Math.PI;
export const WX = 0.76;                        // rail centre lines (half the 1524 mm gauge)

// ===================================================================== geometry / materials
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylX: new THREE.CylinderGeometry(1, 1, 1, 18).rotateZ(PI / 2),
  cylX8: new THREE.CylinderGeometry(1, 1, 1, 8).rotateZ(PI / 2),
  cylZ: new THREE.CylinderGeometry(1, 1, 1, 20).rotateX(PI / 2),
  cylY: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.CylinderGeometry(1, 0.6, 1, 14),               // widening upwards (the flared top of a funnel chimney)
  sph: new THREE.SphereGeometry(1, 14, 8),
  hemi: new THREE.SphereGeometry(1, 16, 6, 0, PI * 2, 0, PI / 2),
  arch: new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, -PI / 2, PI).rotateX(-PI / 2),  // half cylinder along Z, dome up
};
const mats = new Map();
// a material of colour c (cached: they only feed the bake)
export function mat(c, r = 0.75, m = 0.12) {
  const k = `${c}|${r}|${m}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
  return mats.get(k);
}
export const C = {
  black: 0x1d1d1c, iron: 0x2b2b2a, steel: 0x55595b, bright: 0x9a9a94, red: 0x8f2a20, buffer: 0xa3322a, white: 0xe6e2d6,
  glass: 0x24303a, inside: 0x2e2a24, insideLight: 0x5a5244, wood: 0x6b4f35, brass: 0xb08a3a, lamp: 0xf2e6b0, coal: 0x161514,
  rubber: 0x161616, yellow: 0xd8b02c, roof: 0x4a4a46, rust: 0x6e4a32,
};

// a mesh of geo (centred) at (x, y, z), scaled, rotated (order YXZ)
export function put(g, geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, o = {}) {
  const m = new THREE.Mesh(geo, typeof c === 'number' ? mat(c, o.r ?? 0.75, o.m ?? 0.12) : c);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.order = 'YXZ';
  m.rotation.set(rx, ry, rz);
  if (o.inner) m.userData.inner = true;
  g.add(m);
  return m;
}
export const box = (g, c, x, y, z, sx, sy, sz, o) => put(g, GEO.box, c, x, y, z, sx, sy, sz, 0, 0, 0, o);
// cylinders: radius r, length len along X / Y / Z
export const cylX = (g, c, x, y, z, r, len, o) => put(g, GEO.cylX, c, x, y, z, len, r, r, 0, 0, 0, o);
export const cylY = (g, c, x, y, z, r, len, o) => put(g, GEO.cylY, c, x, y, z, r, len, r, 0, 0, 0, o);
export const cylZ = (g, c, x, y, z, r, len, o) => put(g, GEO.cylZ, c, x, y, z, r, r, len, 0, 0, 0, o);
// a box seen from inside (the dark inside of a car body / cab through its openings)
export const inside = (g, c, x, y, z, sx, sy, sz) => box(g, c, x, y, z, sx, sy, sz, { inner: true, r: 1, m: 0 });

// ===================================================================== running gear
const spin = (m, cy, cz, r) => { m.userData.spin = { c: [m.position.x, cy, cz], r }; return m; };

// one wheel at (x, r, z): disc, tyre, hub; spokes / counterweight for the big steam drivers
export function wheel(g, x, z, r, o = {}) {
  const w = o.w ?? 0.14, col = o.col ?? C.iron, y = r;
  const side = Math.sign(x) || 1;
  spin(cylX(g, o.tyre ?? C.steel, x, y, z, r, w, { r: 0.5, m: 0.6 }), y, z, r);
  spin(cylX(g, col, x + side * 0.01, y, z, r * 0.86, w + 0.02), y, z, r);
  spin(cylX(g, o.hub ?? C.iron, x + side * 0.03, y, z, r * 0.24, w + 0.08), y, z, r);
  if (o.spokes) {
    const n = o.spokes, sc = o.spokeCol ?? C.black;
    for (let k = 0; k < n; k++) {
      const a = k / n * PI;
      spin(put(g, GEO.box, sc, x + side * 0.02, y, z, w + 0.03, r * 1.6, 0.05, a), y, z, r);
    }
    spin(put(g, GEO.box, o.cwCol ?? col, x + side * 0.03, y - r * 0.5, z, w + 0.05, r * 0.36, r * 0.9), y, z, r);   // counterweight
  }
  return y;
}
// two wheels on an axle at z
export function wheelset(g, z, r, o = {}) {
  for (const s of [-1, 1]) wheel(g, s * WX, z, r, o);
  spin(cylX(g, C.iron, 0, r, z, 0.08, WX * 2), r, z, r);
  if (o.boxes !== false) for (const s of [-1, 1]) box(g, o.boxCol ?? C.iron, s * (WX + 0.22), r, z, 0.22, 0.3, 0.36);   // axle boxes
}
// a two- or three-axle bogie centred at z: side frames, springs, bolster
export function bogie(g, z, o = {}) {
  const r = o.r ?? 0.47, n = o.axles ?? 2, wb = o.wb ?? (n === 3 ? 1.85 : 2.3), col = o.col ?? C.iron;
  const zs = n === 3 ? [-wb, 0, wb] : [-wb / 2, wb / 2];
  for (const dz of zs) wheelset(g, z + dz, r, { boxes: false, ...o.wheel });
  const L = (zs[zs.length - 1] - zs[0]) + r * 2 + 0.4;
  for (const s of [-1, 1]) {
    box(g, col, s * (WX + 0.24), r + 0.05, z, 0.16, 0.34, L);
    box(g, col, s * (WX + 0.24), r + 0.3, z, 0.18, 0.18, L * 0.55);
    for (const dz of zs) box(g, C.black, s * (WX + 0.24), r, z + dz, 0.26, 0.32, 0.34);
    if (o.springs !== false) for (const dz of [-0.4, 0.4]) cylY(g, C.steel, s * (WX + 0.24), r + 0.45, z + dz * (n === 3 ? 1.2 : 1), 0.1, 0.25, { m: 0.5 });
  }
  box(g, col, 0, r + 0.4, z, WX * 2 + 0.5, 0.22, 0.5);
  return r;
}
// buffers + coupler at the end z (dir +1 front / -1 rear), the buffer beam (colour beam) behind them
export function buffers(g, z, dir, o = {}) {
  const y = o.y ?? 1.06, beam = o.beam ?? C.buffer, sa = o.auto;
  box(g, beam, 0, y, z - dir * 0.12, o.w ?? 2.9, o.h ?? 0.42, 0.24);
  if (!sa) for (const s of [-1, 1]) {
    cylZ(g, C.iron, s * 0.85, y, z + dir * 0.12, 0.08, 0.3);
    cylZ(g, C.steel, s * 0.85, y, z + dir * 0.3, 0.2, 0.06, { m: 0.5, r: 0.4 });
  }
  if (!sa) box(g, C.iron, 0, y, z + dir * 0.18, 0.12, 0.12, 0.36);           // screw coupling hook
  else { box(g, C.iron, 0, y - 0.05, z + dir * 0.2, 0.3, 0.26, 0.5); box(g, C.iron, 0, y - 0.05, z + dir * 0.45, 0.42, 0.3, 0.12); }   // automatic coupler
}
// coupling rods of the drivers (zs: their axle positions, r: their radius, rc: crank radius); one per side,
// quartered (left pin up, right pin forward); they circle with the wheels in the shader
export function rods(g, zs, r, rc, o = {}) {
  const z0 = Math.min(...zs), z1 = Math.max(...zs);
  for (const s of [-1, 1]) {
    const py = s > 0 ? rc : 0, pz = s > 0 ? 0 : rc;
    const m = box(g, o.col ?? C.steel, s * (WX + 0.16), r + py, (z0 + z1) / 2 + pz, 0.06, 0.12, z1 - z0 + 0.25, { m: 0.6, r: 0.4 });
    m.userData.crank = { py, pz, r };
    for (const z of zs) {
      const p = cylX(g, C.bright, s * (WX + 0.2), r + py, z + pz, 0.06, 0.08, { m: 0.7, r: 0.3 });
      p.userData.crank = { py, pz, r };
    }
  }
}

// ===================================================================== steam engines
// boiler along Z (z0 rear .. z1 front), centre height y, radius rb: barrel with bands, smokebox with its door
export function boiler(g, o) {
  const { z0, z1, y, rb } = o, col = o.col ?? C.black, sbLen = o.smokebox ?? 1.4;
  cylZ(g, col, 0, y, (z0 + z1 - sbLen) / 2, rb, z1 - z0 - sbLen);
  for (let z = z0 + 0.8; z < z1 - sbLen - 0.2; z += o.band ?? 1.6) cylZ(g, o.bandCol ?? C.bright, 0, y, z, rb + 0.015, 0.06, { m: 0.6 });
  cylZ(g, C.black, 0, y, z1 - sbLen / 2, rb + 0.05, sbLen);
  cylZ(g, C.iron, 0, y, z1 + 0.03, rb * 0.9, 0.08);
  cylZ(g, C.steel, 0, y, z1 + 0.08, rb * 0.25, 0.06);
  if (o.saddle !== false) box(g, C.black, 0, y - rb * 0.75, z1 - sbLen / 2, rb * 1.4, rb * 0.9, sbLen * 0.8);
}
// chimney: 'stack' straight with a lip, 'funnel' tall flared (early), 'short' low (big boilers), 'cap' capped
export function chimney(g, z, yTop, o = {}) {
  const kind = o.kind ?? 'stack', r = o.r ?? 0.25, y0 = o.y0 ?? yTop - 1;
  const h = yTop - y0;
  if (kind === 'funnel') {
    cylY(g, C.black, 0, y0 + h * 0.36, z, r * 0.75, h * 0.72);
    put(g, GEO.cone, C.black, 0, yTop - h * 0.15, z, r * 1.45, h * 0.3, r * 1.45);
  } else {
    cylY(g, C.black, 0, y0 + h / 2, z, r, h);
    cylY(g, C.black, 0, yTop - 0.06, z, r + 0.06, kind === 'cap' ? 0.18 : 0.12);
  }
}
// dome on the boiler top
export const dome = (g, z, y, r, col = C.black, h = 0.5) => { cylY(g, col, 0, y + h / 2, z, r, h); put(g, GEO.hemi, col, 0, y + h, z, r, r * 0.55, r); };
// steam cylinders either side in front
export function cylinders(g, z, y, o = {}) {
  for (const s of [-1, 1]) {
    cylZ(g, o.col ?? C.black, s * (o.x ?? 1.05), y, z, o.r ?? 0.32, o.len ?? 1.1);
    box(g, o.col ?? C.black, s * ((o.x ?? 1.05) - 0.1), y + (o.r ?? 0.32) + 0.12, z, 0.5, 0.3, (o.len ?? 1.1) * 0.9);   // steam chest
    box(g, C.bright, s * ((o.x ?? 1.05) - 0.05), y, z - (o.len ?? 1.1) / 2 - 0.9, 0.06, 0.06, 1.8, { m: 0.6 });         // piston rod / slide bar
  }
}
// running boards along both sides at height y, from z0 to z1
export function runningBoards(g, z0, z1, y, w = 1.42, col = C.black) {
  for (const s of [-1, 1]) {
    box(g, col, s * w, y, (z0 + z1) / 2, 0.42, 0.05, z1 - z0);
    box(g, C.red, s * (w + 0.2), y - 0.08, (z0 + z1) / 2, 0.03, 0.14, z1 - z0);
  }
}
// cab of a steam engine: front at z1, back (open, towards the tender) at z0, floor y0, roof top y1; side openings
export function steamCab(g, o) {
  const { z0, z1, y0, y1 } = o, w = o.w ?? 3.0, col = o.col ?? C.black, L = z1 - z0;
  const winY0 = y0 + 1.15, winY1 = y1 - 0.45;
  box(g, C.wood, 0, y0, (z0 + z1) / 2, w - 0.1, 0.06, L);                                   // floor
  for (const s of [-1, 1]) {
    box(g, col, s * w / 2, (y0 + winY0) / 2, (z0 + z1) / 2, 0.06, winY0 - y0, L);            // below the openings
    box(g, col, s * w / 2, (winY0 + y1) / 2, z1 - 0.2, 0.06, y1 - winY0, 0.4);               // front pillar
    box(g, col, s * w / 2, (winY0 + y1) / 2, z0 + 0.12, 0.06, y1 - winY0, 0.24);             // rear pillar
    box(g, col, s * w / 2, (winY1 + y1) / 2, (z0 + z1) / 2, 0.06, y1 - winY1, L);            // over the openings
    box(g, C.inside, s * (w / 2 - 0.04), (y0 + winY0) / 2, (z0 + z1) / 2, 0.02, winY0 - y0 - 0.1, L - 0.1);
  }
  box(g, col, 0, (y0 + y1) / 2, z1, w, y1 - y0, 0.06);                                       // front sheet
  for (const s of [-1, 1]) box(g, C.glass, s * 0.75, winY1 - 0.35, z1 + 0.035, 0.55, 0.5, 0.02, { r: 0.2, m: 0.4 });   // spectacle glasses
  box(g, C.inside, 0, (y0 + y1) / 2, z1 - 0.05, w - 0.15, y1 - y0 - 0.1, 0.02);
  // roof (overhanging)
  put(g, GEO.arch, o.roof ?? col, 0, y1, (z0 + z1) / 2, w / 2 + 0.12, 0.28, L + 0.4);
  // the backhead: firebox door, gauges
  box(g, C.iron, 0, y0 + 1.0, z1 - 0.25, 1.4, 1.4, 0.4);
  cylZ(g, C.brass, 0.4, y0 + 1.6, z1 - 0.48, 0.08, 0.04, { m: 0.8, r: 0.3 });
  cylZ(g, C.brass, -0.4, y0 + 1.6, z1 - 0.48, 0.08, 0.04, { m: 0.8, r: 0.3 });
  box(g, C.black, 0, y0 + 0.65, z1 - 0.46, 0.5, 0.4, 0.04);
}
// engine frame plates between the wheels from z0 to z1 (top at y)
export function frames(g, z0, z1, y, h = 0.7, col = C.black) {
  for (const s of [-1, 1]) box(g, col, s * 0.6, y - h / 2, (z0 + z1) / 2, 0.08, h, z1 - z0);
}
// headlamp(s) at the front z, height y
export function lamp(g, x, y, z, r = 0.14, dir = 1) {
  cylZ(g, C.black, x, y, z, r + 0.03, 0.3);
  cylZ(g, C.lamp, x, y, z + dir * 0.16, r, 0.02, { r: 0.2, m: 0 });
}
// a tender body (water tank + coal) on its frame from z0 to z1
export function tenderBody(g, o) {
  const { z0, z1, y0, y1 } = o, w = o.w ?? 2.95, col = o.col ?? C.black, L = z1 - z0;
  box(g, C.black, 0, y0 - 0.15, (z0 + z1) / 2, w + 0.1, 0.3, L + 0.1);
  if (o.tub) {                                                                              // the Kriegslok tub tender
    put(g, GEO.cylZ, col, 0, y0 + (y1 - y0) * 0.45, (z0 + z1) / 2 - 0.3, w / 2, (y1 - y0) * 0.62, L - 0.8);
    box(g, col, 0, y0 + (y1 - y0) * 0.55, z1 - 0.4, w * 0.95, (y1 - y0) * 0.9, 0.8);
  } else box(g, col, 0, (y0 + y1) / 2, (z0 + z1) / 2, w, y1 - y0, L);
  box(g, o.trim ?? C.black, 0, y1 + 0.04, (z0 + z1) / 2, w + 0.06, 0.08, L + 0.06);
  // coal heaped in the front part, the water hatch at the back
  const cz = z1 - L * 0.32;
  put(g, GEO.arch, C.coal, 0, y1 - 0.05, cz, w / 2 - 0.15, 0.55, L * 0.55, 0, 0, 0, { r: 1, m: 0 });
  cylY(g, C.iron, 0, y1 + 0.12, z0 + 1.0, 0.35, 0.2);
  box(g, col, 0, y1 + 0.35, z1 - 0.05, w, 0.7, 0.08);                                      // coal plate
  for (const s of [-1, 1]) box(g, C.bright, s * (w / 2 + 0.04), y0 + 0.9, z0 + 0.4, 0.04, 1.1, 0.04, { m: 0.6 });    // handrails
}

// ===================================================================== car bodies
// one side wall at x from z0 to z1 between heights y0 and y1, with openings holes [{ z0, z1, y0, y1 }]
// (the openings of a row share their heights); thickness t
export function wallSide(g, c, x, z0, z1, y0, y1, holes, t = 0.06, o = {}) {
  const hs = [...holes].sort((a, b) => a.z0 - b.z0);
  if (!hs.length) { box(g, c, x, (y0 + y1) / 2, (z0 + z1) / 2, t, y1 - y0, z1 - z0, o); return; }
  const lo = Math.min(...hs.map(h => h.y0)), hi = Math.max(...hs.map(h => h.y1));
  box(g, c, x, (y0 + lo) / 2, (z0 + z1) / 2, t, lo - y0, z1 - z0, o);
  box(g, c, x, (hi + y1) / 2, (z0 + z1) / 2, t, y1 - hi, z1 - z0, o);
  let z = z0;
  for (const h of hs) {
    if (h.z0 > z) box(g, c, x, (lo + hi) / 2, (z + h.z0) / 2, t, hi - lo, h.z0 - z, o);
    if (h.y0 > lo) box(g, c, x, (lo + h.y0) / 2, (h.z0 + h.z1) / 2, t, h.y0 - lo, h.z1 - h.z0, o);   // door / lower opening
    if (h.y1 < hi) box(g, c, x, (h.y1 + hi) / 2, (h.z0 + h.z1) / 2, t, hi - h.y1, h.z1 - h.z0, o);
    z = h.z1;
  }
  if (z < z1) box(g, c, x, (lo + hi) / 2, (z + z1) / 2, t, hi - lo, z1 - z, o);
}
// window frames (thin trim) around the openings on the side x
export function frameHoles(g, c, x, holes, t = 0.05) {
  const s = Math.sign(x);
  for (const h of holes) {
    box(g, c, x + s * 0.02, h.y0 - 0.03, (h.z0 + h.z1) / 2, t, 0.06, h.z1 - h.z0 + 0.1);
    box(g, c, x + s * 0.02, h.y1 + 0.03, (h.z0 + h.z1) / 2, t, 0.06, h.z1 - h.z0 + 0.1);
  }
}
// evenly spaced window openings: n windows of width ww between z0 and z1, sill / top heights
export function windowRow(z0, z1, n, ww, sill, top) {
  const res = [], gap = (z1 - z0 - n * ww) / (n + 1);
  for (let i = 0; i < n; i++) { const a = z0 + gap + i * (ww + gap); res.push({ z0: a, z1: a + ww, y0: sill, y1: top }); }
  return res;
}
// a car body (box) from the floor yf to the eaves ye, length L, width w, with window rows on both sides, end
// walls, the roof (arch | clerestory | flat), the dark inside and benches. o: { col, roof, roofCol, holes (per side),
// endDoors, inner }
export function carBody(g, o) {
  const { L, w, yf, ye } = o, col = o.col, z0 = -L / 2, z1 = L / 2;
  box(g, C.iron, 0, yf - 0.1, 0, w - 0.1, 0.2, L);                                            // floor
  for (const s of [-1, 1]) {
    const holes = o.holes ? o.holes(s) : [];
    wallSide(g, col, s * w / 2, z0, z1, yf, ye, holes);
    if (o.frames) frameHoles(g, o.frames, s * w / 2, holes);
  }
  for (const d of [-1, 1]) {
    const ze = d > 0 ? z1 : z0;
    if (o.endDoors) {
      box(g, col, -w / 2 + (w / 2 - 0.45) / 2, (yf + ye) / 2, ze, w / 2 - 0.45, ye - yf, 0.06);
      box(g, col, w / 2 - (w / 2 - 0.45) / 2, (yf + ye) / 2, ze, w / 2 - 0.45, ye - yf, 0.06);
      box(g, col, 0, ye - 0.25, ze, 0.9, 0.5, 0.06);
      box(g, o.doorCol ?? C.wood, 0, (yf + ye - 0.5) / 2, ze + d * 0.01, 0.86, ye - yf - 0.5, 0.04);
    } else box(g, col, 0, (yf + ye) / 2, ze, w, ye - yf, 0.06);
  }
  inside(g, o.inner ?? C.inside, 0, (yf + ye) / 2, 0, w - 0.16, ye - yf - 0.04, L - 0.16);
  // roof
  const rc = o.roofCol ?? C.roof;
  if (o.roof === 'flat') box(g, rc, 0, ye + 0.06, 0, w + 0.1, 0.12, L + 0.1);
  else {
    put(g, GEO.arch, rc, 0, ye, 0, w / 2 + 0.06, o.roofH ?? 0.42, L + (o.roofOver ?? 0.1));
    if (o.roof === 'clerestory') {
      box(g, rc, 0, ye + (o.roofH ?? 0.42) * 0.7, 0, w * 0.5, 0.42, L - 1.6);
      for (let z = -L / 2 + 1.4; z < L / 2 - 1.2; z += 1.1) for (const s of [-1, 1]) box(g, C.glass, s * w * 0.251, ye + (o.roofH ?? 0.42) * 0.7 + 0.03, z, 0.02, 0.2, 0.55, { r: 0.2, m: 0.3 });
      put(g, GEO.arch, rc, 0, ye + (o.roofH ?? 0.42) * 0.7 + 0.2, 0, w * 0.27, 0.16, L - 1.5);
    }
  }
  // benches inside
  if (o.benches) for (let z = -L / 2 + 1.2; z < L / 2 - 1; z += 1.8) for (const s of [-1, 1]) box(g, o.benchCol ?? C.insideLight, s * (w / 2 - 0.45), yf + 0.45, z, 0.6, 0.9, 0.45);
}
// end platform with railings (old two-axle coaches): at the end z (dir +1 / -1) of a body of width w, floor yf
export function endPlatform(g, z, dir, w, yf, col = C.iron) {
  box(g, C.wood, 0, yf - 0.06, z + dir * 0.45, w - 0.2, 0.08, 0.9);
  for (const s of [-1, 1]) {
    box(g, col, s * (w / 2 - 0.15), yf + 0.5, z + dir * 0.85, 0.04, 1, 0.04);
    box(g, col, s * (w / 2 - 0.5), yf + 1.0, z + dir * 0.88, w / 2 - 0.4, 0.04, 0.04);
    box(g, col, s * (w / 2 - 0.12), yf - 0.4, z + dir * 0.45, 0.3, 0.04, 0.5);               // step
  }
}

// ===================================================================== bake
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
/**
 * The model `root` as two geometries: `body` (all that does not turn) and `spin` (wheels / rods; attributes spinC =
 * centre + 1/radius, crank = the pin offset of a coupling rod); colour + roughness / metalness in the vertices.
 * @param {THREE.Object3D} root
 * @returns {{ body: THREE.BufferGeometry, spin: THREE.BufferGeometry | null }}
 */
export function bakeModel(root) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const body = [], spins = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld));
    const n = g.attributes.position.count, mt = o.material;
    if (o.userData.inner) {                                       // seen from inside: reverse the faces
      const p = g.attributes.position.array, nr = g.attributes.normal.array;
      for (let i = 0; i < n; i += 3) for (let k = 0; k < 3; k++) {
        const a = (i + 1) * 3 + k, b = (i + 2) * 3 + k;
        let t = p[a]; p[a] = p[b]; p[b] = t;
        t = nr[a]; nr[a] = nr[b]; nr[b] = t;
      }
      for (let i = 0; i < nr.length; i++) nr[i] = -nr[i];
    }
    const col = new Float32Array(n * 3), rm = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      col[i * 3] = mt.color.r; col[i * 3 + 1] = mt.color.g; col[i * 3 + 2] = mt.color.b;
      rm[i * 2] = mt.roughness; rm[i * 2 + 1] = mt.metalness;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('rm', new THREE.BufferAttribute(rm, 2));
    const sp = o.userData.spin, cr = o.userData.crank;
    if (sp || cr) {
      const sc = new Float32Array(n * 4), ck = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        if (sp) { sc[i * 4] = sp.c[0]; sc[i * 4 + 1] = sp.c[1]; sc[i * 4 + 2] = sp.c[2]; sc[i * 4 + 3] = 1 / sp.r; }
        else { sc[i * 4 + 3] = 1 / cr.r; ck[i * 2] = cr.py; ck[i * 2 + 1] = cr.pz; }
      }
      g.setAttribute('spinC', new THREE.BufferAttribute(sc, 4));
      g.setAttribute('crank', new THREE.BufferAttribute(ck, 2));
      spins.push(g);
    } else body.push(g);
  });
  const b = mergeGeometries(body, false);
  b.computeBoundingBox(); b.computeBoundingSphere();
  const s = spins.length ? mergeGeometries(spins, false) : null;
  if (s) { s.computeBoundingBox(); s.computeBoundingSphere(); }
  return { body: b, spin: s };
}
