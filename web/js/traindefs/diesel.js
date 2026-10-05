// Builder of the diesel locomotives (traindefs/te3.js, m62.js, tep70.js): a carbody on two three-axle bogies, the
// cabs at the ends (rounded / flat / sloped fronts) with side windows open to the inside (the driver is seen), radiator
// grilles, fans and the exhaust on the roof, livery stripes, the fuel tank between the bogies, automatic couplers.
import * as THREE from 'three';
import { PI, C, GEO, box, put, cylY, cylZ, bogie, buffers, wallSide, inside, lamp } from './kit.js';

/**
 * @param {object} o L, w, bogies [z], r, yf (floor), ye (eaves), roofH, col { body, roof, frame, stripe, glass },
 *  stripes [{ y, h, col }], cabs [{ dir: 1 | -1, len, nose: 'round' | 'flat' | 'slope' }], grilles [[z0, z1]], fans [z],
 *  exhaust [z]
 */
export function dieselEngine(o) {
  const g = new THREE.Group();
  const col = { body: 0x2c4a33, roof: 0x5a5e5a, frame: C.iron, ...o.col };
  const L = o.L, w = o.w ?? 3.1, yf = o.yf, ye = o.ye, r = o.r ?? 0.525, roofH = o.roofH ?? 0.45;
  for (const z of o.bogies) bogie(g, z, { r, axles: 3, wb: 1.85, col: C.iron });
  // frame, fuel tank, couplers, steps
  box(g, col.frame, 0, yf - 0.3, 0, w - 0.05, 0.4, L - 0.4);
  box(g, C.iron, 0, yf - 0.95, 0, w - 0.6, 0.9, Math.abs(o.bogies[0] - o.bogies[1]) - 4.6);
  for (const d of [-1, 1]) buffers(g, d * L / 2, d, { auto: true, beam: col.beam ?? col.frame, y: 1.06, h: 0.5 });
  // the body: engine room walls with grilles, the cabs at the ends
  const cabs = o.cabs || [{ dir: 1, len: 2.6, nose: 'flat' }];
  const cabAt = d => cabs.find(c => c.dir === d);
  const zb0 = -L / 2 + 0.25 + (cabAt(-1) ? cabAt(-1).nose === 'round' ? 1.1 : cabAt(-1).nose === 'slope' ? 0.9 : 0 : 0);
  const zb1 = L / 2 - 0.25 - (cabAt(1) ? cabAt(1).nose === 'round' ? 1.1 : cabAt(1).nose === 'slope' ? 0.9 : 0 : 0);
  const sill = ye - 1.25, top = ye - 0.35;
  for (const s of [-1, 1]) {
    const holes = [];
    for (const c of cabs) {
      const ze = c.dir > 0 ? zb1 : zb0;
      const a = ze - c.dir * (c.len - 0.3), b = ze - c.dir * 0.5;
      holes.push({ z0: Math.min(a, b), z1: Math.max(a, b), y0: sill, y1: top });
      const da = ze - c.dir * (c.len + 0.1), db = ze - c.dir * (c.len + 0.85);
      holes.push({ z0: Math.min(da, db), z1: Math.max(da, db), y0: yf + 0.1, y1: top - 0.05 });   // side door
    }
    wallSide(g, col.body, s * w / 2, zb0, zb1, yf, ye, holes);
    for (const h of holes) if (h.y0 < yf + 0.5) box(g, col.door ?? col.body, s * (w / 2 - 0.1), (h.y0 + h.y1) / 2, (h.z0 + h.z1) / 2, 0.04, h.y1 - h.y0, h.z1 - h.z0 - 0.04);
    for (const [a, b] of o.grilles || []) box(g, C.iron, s * (w / 2 + 0.02), (yf + ye) / 2 + 0.25, (a + b) / 2, 0.03, ye - yf - 1.0, b - a);
    for (const st of o.stripes || []) box(g, st.col, s * (w / 2 + 0.035), st.y, (zb0 + zb1) / 2, 0.02, st.h, zb1 - zb0 - 0.02);
  }
  // the cabs: dark inside, a bulkhead behind, front wall / nose with the windscreens
  for (const c of cabs) {
    const d = c.dir, ze = d > 0 ? zb1 : zb0;
    inside(g, C.inside, 0, (yf + ye) / 2, ze - d * c.len / 2, w - 0.14, ye - yf - 0.05, c.len - 0.1);
    box(g, C.insideLight, 0, yf + 0.5, ze - d * 0.6, w - 0.4, 0.9, 0.5);                    // control desk
    box(g, C.black, 0.7, yf + 0.5, ze - d * (c.len * 0.5), 0.5, 0.5, 0.5);                   // seats
    box(g, C.black, -0.7, yf + 0.5, ze - d * (c.len * 0.5), 0.5, 0.5, 0.5);
    if (c.nose === 'round') {
      const R = w / 2;
      put(g, GEO.cylY, col.body, 0, (yf + sill) / 2, ze, R, sill - yf, 1.1);
      put(g, GEO.hemi, col.body, 0, sill, ze, R, 0.7, 1.1);
      box(g, col.body, 0, (sill + ye) / 2, ze + d * 0.25, w, ye - sill, 0.5);
      put(g, GEO.box, C.glass, 0, sill + 0.55, ze + d * 0.62, w * 0.82, 0.75, 0.04, -d * 0.55, 0, 0, { r: 0.2, m: 0.4 });
      for (const st of o.stripes || []) put(g, GEO.cylY, st.col, 0, st.y, ze, R + 0.025, st.h, 1.12);
      lamp(g, 0, ye + 0.05, ze + d * 0.4, 0.17, d);
    } else if (c.nose === 'slope') {
      box(g, col.body, 0, (yf + sill) / 2, ze + d * 0.45, w, sill - yf, 0.9);
      put(g, GEO.box, col.body, 0, sill + 0.1, ze + d * 0.85, w, 0.25, 0.25, -d * 0.6);
      put(g, GEO.box, C.glass, 0, (sill + ye) / 2 + 0.1, ze + d * 0.45, w * 0.9, 1.15, 0.05, -d * 0.62, 0, 0, { r: 0.2, m: 0.4 });
      box(g, col.body, 0, (sill + ye) / 2, ze, w, ye - sill, 0.05);
      for (const st of o.stripes || []) if (st.y < sill) box(g, st.col, 0, st.y, ze + d * 0.91, w + 0.02, st.h, 0.02);
      for (const s of [-1, 1]) lamp(g, s * 0.95, yf + 0.6, ze + d * 0.9, 0.12, d);
      lamp(g, 0, ye + 0.08, ze + d * 0.05, 0.15, d);
    } else {
      box(g, col.body, 0, (yf + ye) / 2, ze, w, ye - yf, 0.08);
      for (const s of [-1, 1]) box(g, C.glass, s * 0.72, sill + 0.5, ze + d * 0.05, 1.1, 0.8, 0.03, { r: 0.2, m: 0.4 });
      for (const st of o.stripes || []) box(g, st.col, 0, st.y, ze + d * 0.05, w, st.h, 0.02);
      for (const s of [-1, 1]) lamp(g, s * 0.95, yf + 0.55, ze + d * 0.06, 0.12, d);
      lamp(g, 0, ye + 0.1, ze, 0.16, d);
    }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) box(g, C.bright, s * (w / 2 + 0.05), yf - 0.35 - k * 0.32, ze - d * (c.len + 0.45), 0.06, 0.04, 0.5);   // steps
  }
  // roof, fans, exhaust
  put(g, GEO.arch, col.roof, 0, ye, (zb0 + zb1) / 2, w / 2 + 0.04, roofH, zb1 - zb0 + 0.06);
  for (const z of o.fans || []) { cylY(g, C.iron, 0, ye + roofH + 0.05, z, 0.75, 0.12); cylY(g, C.black, 0, ye + roofH + 0.12, z, 0.6, 0.04); }
  for (const z of o.exhaust || []) cylY(g, C.black, 0, ye + roofH + 0.2, z, 0.18, 0.4);
  if (o.extras) o.extras(g, col, { zb0, zb1, sill, top });
  return g;
}

// crew of the cab at end dir (+1 front) of a diesel built as above
export function dieselCrew(o, dir = 1) {
  const ze = dir * (o.L / 2 - 0.25 - (o.nose === 'round' ? 1.1 : o.nose === 'slope' ? 0.9 : 0));
  const z = ze - dir * (o.cabLen * 0.5);
  return {
    eye: [0.7, o.yf + 1.55, z + dir * 0.3],
    crew: [{ pos: [0.7, o.yf, z], ry: dir > 0 ? 0 : PI, role: 'driver' }, { pos: [-0.7, o.yf, z], ry: dir > 0 ? 0 : PI, role: 'assistant' }],
  };
}
export { cylZ };
