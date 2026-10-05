// Builders of the steam engines and their tenders (traindefs/<key>.js give the numbers and add their own details):
// frames, carrying and coupled wheels with the coupling rods, cylinders, running boards, the boiler with its
// chimney and domes, the cab with its side openings (the crew is seen through them), smoke deflectors, lamps.
import * as THREE from 'three';
import { PI, C, WX, box, cylX, cylY, cylZ, put, GEO, wheelset, rods, boiler, chimney, dome, cylinders, runningBoards,
  steamCab, frames, lamp, buffers, tenderBody, bogie } from './kit.js';

/**
 * @param {object} o
 *  L (over buffers), R (driver radius), drivers [z], lead [z] / leadR, trail [z] / trailR,
 *  boiler { z0, z1, y, rb, smokebox }, chimney { z, top, kind, r }, domes [{ z, r, h }], cab { z0, z1, y0, y1 },
 *  boards (running board height), cyl { z, y, r, len }, col { body, boiler, wheel, frame, beam, cab, roof, band },
 *  deflectors { z0, z1, h }, lamps [[x, y]], spokes
 */
export function steamEngine(o) {
  const g = new THREE.Group();
  const col = { body: C.black, wheel: C.red, frame: C.red, beam: C.buffer, ...o.col };
  const L = o.L, zf = L / 2, R = o.R;
  const zr = o.cab.z0 - 0.3;
  // frames, buffer beam, rear drawbar
  frames(g, zr, zf - 0.3, o.frameTop ?? 1.45, 0.75, col.frame);
  buffers(g, zf, 1, { beam: col.beam });
  box(g, C.black, 0, 1.0, zr, 2.4, 0.35, 0.25);
  // wheels: carrying wheels in front / behind, the coupled drivers with their rods
  const leadR = o.leadR ?? 0.45, trailR = o.trailR ?? 0.55;
  for (const z of o.lead || []) wheelset(g, z, leadR, { col: col.wheel, spokes: 8, spokeCol: C.black, boxes: true });
  for (const z of o.drivers) wheelset(g, z, R, { col: col.wheel, spokes: o.spokes ?? (R > 0.8 ? 14 : 10), spokeCol: col.wheel === C.black ? C.iron : C.black, cwCol: col.wheel });
  for (const z of o.trail || []) wheelset(g, z, trailR, { col: col.wheel, spokes: 8, spokeCol: C.black });
  rods(g, o.drivers, R, R * 0.36);
  // cylinders with the slide bars, running boards over the wheels
  cylinders(g, o.cyl.z, o.cyl.y, { r: o.cyl.r ?? 0.33, len: o.cyl.len ?? 1.1, x: o.cyl.x ?? 1.05, col: o.cyl.col ?? C.black });
  const by = o.boards ?? 1.75;
  runningBoards(g, o.cab.z1, o.boiler.z1 + 0.2, by, 1.38, col.body);
  if (o.splashers !== false && 2 * R + 0.1 > by) for (const z of o.drivers) for (const s of [-1, 1]) {
    put(g, GEO.arch, col.body, s * WX, by, z, R + 0.1, 2 * R + 0.1 - by, 0.1, 0, PI / 2);             // splashers over big wheels
  }
  // boiler, chimney, domes, safety valves, whistle, handrails, sandpipes
  const B = o.boiler;
  boiler(g, { ...B, col: col.boiler ?? col.body, bandCol: col.band ?? C.bright });
  chimney(g, o.chimney.z, o.chimney.top, { kind: o.chimney.kind, r: o.chimney.r, y0: B.y + B.rb * 0.8 });
  for (const d of o.domes || []) dome(g, d.z, B.y + B.rb * 0.85, d.r, d.col ?? col.boiler ?? col.body, d.h ?? 0.45);
  cylY(g, C.brass, 0.18, B.y + B.rb + 0.2, B.z0 + 0.6, 0.06, 0.4, { m: 0.8, r: 0.3 });
  cylY(g, C.brass, -0.18, B.y + B.rb + 0.2, B.z0 + 0.6, 0.06, 0.4, { m: 0.8, r: 0.3 });
  cylY(g, C.brass, 0, B.y + B.rb + 0.3, B.z0 + 0.25, 0.05, 0.5, { m: 0.8, r: 0.3 });
  for (const s of [-1, 1]) box(g, C.bright, s * (B.rb + 0.06), B.y + B.rb * 0.3, (B.z0 + B.z1) / 2, 0.03, 0.03, B.z1 - B.z0 - 0.4, { m: 0.6 });
  // the firebox under the cab front, the cab
  box(g, col.boiler ?? col.body, 0, (by + B.y) / 2, B.z0 + 0.6, B.rb * 1.9, B.y - by + B.rb * 0.6, 1.2);
  steamCab(g, { ...o.cab, col: col.cab ?? col.body, roof: col.roof });
  // smoke deflectors
  if (o.deflectors) for (const s of [-1, 1]) {
    const d = o.deflectors;
    box(g, col.body, s * (B.rb + 0.35), by + d.h / 2, (d.z0 + d.z1) / 2, 0.04, d.h, d.z1 - d.z0);
  }
  // lamps on the buffer beam / smokebox
  for (const [x, y, z] of o.lamps || [[0.9, 1.5, zf - 0.1], [-0.9, 1.5, zf - 0.1], [0, B.y + B.rb + 0.22, B.z1 - 0.15]]) lamp(g, x, y, z, 0.13);
  if (o.extras) o.extras(g, col);
  return g;
}

/**
 * tender: L, axles (z of the wheelsets) or bogies (z of the bogie centres, axles per bogie), r, body { y0, y1, w, tub },
 * col { body, wheel, frame }
 */
export function steamTender(o) {
  const g = new THREE.Group();
  const col = { body: C.black, wheel: C.black, frame: C.black, ...o.col };
  const L = o.L, r = o.r ?? 0.5;
  if (o.bogies) for (const z of o.bogies) bogie(g, z, { r, axles: o.axlesPer ?? 2, col: col.frame, wheel: { col: col.wheel } });
  else {
    for (const z of o.axles) wheelset(g, z, r, { col: col.wheel, spokes: 8, spokeCol: C.black });
    for (const s of [-1, 1]) box(g, col.frame, s * (WX + 0.25), r + 0.15, 0, 0.12, 0.55, L - 1.2);
  }
  box(g, col.frame, 0, (o.body.y0 - 0.25), 0, 2.6, 0.3, L - 0.6);
  tenderBody(g, { z0: -L / 2 + 0.35, z1: L / 2 - 0.45, y0: o.body.y0, y1: o.body.y1, w: o.body.w ?? 2.95, col: col.body, tub: o.body.tub, trim: col.trim });
  buffers(g, -L / 2, -1, { beam: col.beam ?? C.buffer });
  box(g, C.black, 0, 1.0, L / 2 - 0.15, 2.2, 0.3, 0.3);
  lamp(g, 0.9, o.body.y1 + 0.2, -L / 2 + 0.2, 0.12, -1);
  if (o.extras) o.extras(g, col);
  return g;
}

// a driver's eye / crew places in a steam cab (z0 rear .. z1 front, floor y0)
export function steamCrew(cab) {
  const zc = cab.z0 + (cab.z1 - cab.z0) * 0.42;
  return {
    eye: [0.85, cab.y0 + 1.62, zc],
    crew: [{ pos: [0.85, cab.y0, zc], ry: 0, role: 'driver' }, { pos: [-0.8, cab.y0, zc - 0.2], ry: 0, role: 'fireman' }],
  };
}
export { cylX, cylZ };
