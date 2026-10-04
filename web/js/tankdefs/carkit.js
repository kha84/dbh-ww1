// Shared pieces of the cars and motorcycles (tankdefs/<car>.js): spoked / disc wheels that steer, curved mudguards,
// glass (one transparent mesh per vehicle), bench seats, steering wheels, lamps, folded hoods, motorcycle frames and
// sidecars, and the low-poly riders sitting in them. Cars and motorcycles are hulls like the personnel carriers
// (`apc` + troop seats, no main gun) with `car: 'car' | 'moto'` and `soft: true` (bullets go through them).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PI, U, add, keep, bake, engineDeck } from '../modelkit.js';

// ===================================================================== wheels
// one wheel on its own spin group: r tyre radius, w width, style: 'spoke' (wooden artillery spokes), 'wire' (thin
// wire spokes: motorcycles, early cars), 'disc' (pressed steel), 'modern' (wide tyre, deep rim)
export function wheel(P, r, w, style = 'disc', hub = null) {
  const spin = keep(new THREE.Group());
  const ty = style === 'wire' || style === 'spoke' ? 0.16 : style === 'modern' ? 0.38 : 0.28;   // tyre depth / radius
  const ri = r * (1 - ty);
  add(spin, new THREE.TorusGeometry(r - r * ty / 2, r * ty / 2, 8, 20).rotateY(PI / 2), P.rubber, 0, 0, 0, w / (r * ty), 1, 1);
  if (style === 'spoke' || style === 'wire') {
    add(spin, new THREE.TorusGeometry(ri, style === 'spoke' ? 0.025 : 0.012, 4, 20).rotateY(PI / 2), style === 'spoke' ? P.wood : P.metal);
    const n = style === 'spoke' ? 10 : 16;
    for (let k = 0; k < n; k++) {
      add(spin, U.box, style === 'spoke' ? P.wood : P.steel, 0, 0, 0, style === 'spoke' ? w * 0.5 : 0.008,
        style === 'spoke' ? 0.04 : 0.008, ri * 2, k * PI / n, 0, 0);
    }
    add(spin, U.cylX, hub || P.metal, 0, 0, 0, w * 1.1, r * 0.16, r * 0.16);
  } else {
    add(spin, U.cylX, hub || P.main, 0, 0, 0, w * 0.82, ri, ri);
    add(spin, U.cylX, P.steel, 0, 0, 0, w * 0.9, ri * 0.42, ri * 0.42);
    for (let k = 0; k < 5; k++) add(spin, U.cylX, P.dark, 0, Math.sin(k * 1.26) * ri * 0.62, Math.cos(k * 1.26) * ri * 0.62, w * 0.86, 0.03, 0.03);
    if (style === 'modern') add(spin, U.cylX, P.dark, 0, 0, 0, w * 0.86, ri * 0.8, ri * 0.8);
  }
  bake(spin);
  return spin;
}

// wheels at (x, z) pairs: o { axles: [{ z, x, r, w, steer, single }], style, hub } -> { wheels, steer }
// x is the half track; single: one wheel on the centre line (motorcycles); side: only at +x (sidecar wheel)
export function wheelSet(root, P, o) {
  const wheels = [], steer = [];
  for (const a of o.axles) {
    const xs = a.single ? [0] : a.side ? [a.x] : [-a.x, a.x];
    for (const x of xs) {
      const pivot = keep(new THREE.Group());
      pivot.position.set(x, a.r, a.z);
      root.add(pivot);
      const sp = wheel(P, a.r, a.w, a.style || o.style, o.hub);
      pivot.add(sp);
      wheels.push(sp);
      if (a.steer) steer.push(pivot);
    }
  }
  return { wheels, steer };
}

// curved mudguard over a wheel: an arc of plates from angle a0 to a1 (0 = top, + forward), x centre, r radius,
// w width; skirt: the guard drops to a running board at the rear
export function guard(root, P, x, y, z, r, w, a0 = -1.2, a1 = 1.4, mat = P.main, n = 7) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / n, seg = (a1 - a0) / n * r * 1.08;
    add(root, U.box, mat, x, y + Math.cos(a) * r, z + Math.sin(a) * r, w, 0.035, seg, a, 0, 0);
  }
}

// running board along the side between the guards
export const board = (root, P, x, y, z0, z1, w = 0.22) => add(root, U.box, P.dark, x, y, (z0 + z1) / 2, w, 0.035, z1 - z0);

// ===================================================================== glass
// the panes of one vehicle are merged into one transparent mesh (it must not go into the vertex-coloured bake)
const GLASS = new THREE.MeshStandardMaterial({ color: 0x9fb4bc, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.32,
  side: THREE.DoubleSide, depthWrite: false });
export function glassCollector() {
  const geos = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  return {
    // flat pane: centre, size w x h, turned rx (rake) / ry
    pane(x, y, z, w, h, rx = 0, ry = 0, rz = 0) {
      geos.push(new THREE.PlaneGeometry(w, h).applyMatrix4(m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(1, 1, 1))));
    },
    // side pane facing +-X
    side(x, y, z, l, h, lean = 0) { this.pane(x, y, z, l, h, 0, PI / 2, -Math.sign(x) * lean); },
    done(root) {
      if (!geos.length) return null;
      const g = mergeGeometries(geos, false);
      const mesh = keep(new THREE.Mesh(g, GLASS));
      mesh.castShadow = false;
      mesh.renderOrder = 1;
      root.add(mesh);
      return mesh;
    },
  };
}

// tinted window glass of the closed cars (seen from outside; from the seats the panels are not drawn)
export const TINT = new THREE.MeshStandardMaterial({ color: 0x27323a, roughness: 0.15, metalness: 0.5 });

// white star / roundel on a panel (it keeps its colour when the vehicle is repainted): centre, radius, turned
const WHITE = new THREE.MeshStandardMaterial({ color: 0xe6e4da, roughness: 0.8 });
let STAR = null;
export function star(root, x, y, z, r, rx = -PI / 2, ry = 0) {
  if (!STAR) {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * PI * 2, rr = i % 2 ? 0.4 : 1;
      if (i) sh.lineTo(Math.sin(a) * rr, Math.cos(a) * rr); else sh.moveTo(0, 1);
    }
    STAR = new THREE.ShapeGeometry(sh);
  }
  return add(root, STAR, WHITE, x, y, z, r, r, 1, rx, ry, 0);
}

// ===================================================================== fittings
// bench seat with a back, across x (width w), at z, cushion top y
export function bench(root, P, x, y, z, w, mat = P.black, back = 0.45) {
  add(root, U.box, mat, x, y - 0.06, z, w, 0.12, 0.48);
  add(root, U.box, mat, x, y + back / 2, z - 0.27, w, back, 0.1, -0.15, 0, 0);
}
// steering wheel facing the driver: wheel centre (x, y, z), tilt (rad from upright), the column runs forward / down
export function steeringWheel(root, P, x, y, z, r = 0.19, tilt = 0.7) {
  add(root, new THREE.TorusGeometry(r, 0.016, 6, 18), P.black, x, y, z, 1, 1, 1, tilt, 0, 0);
  add(root, U.box, P.black, x, y, z, r * 1.9, 0.02, 0.02, tilt, 0, 0);
  const len = 0.55, ny = -Math.sin(tilt), nz = Math.cos(tilt);
  add(root, U.cyl8, P.dark, x, y + ny * len / 2, z + nz * len / 2, 0.025, len, 0.025, tilt + PI / 2, 0, 0);
}
// round head lamp facing +Z
export function lamp(root, P, x, y, z, r = 0.1, mat = null) {
  add(root, U.cylZ, mat || P.dark, x, y, z, r, r, r * 0.9);
  add(root, U.cylZ, P.glass, x, y, z + r * 0.46, r * 0.85, r * 0.85, 0.02);
}
// canvas hood folded down behind the rear seat (x half width, at z, top y)
export function foldedHood(root, P, x, y, z, mat) {
  add(root, U.cylX, mat, 0, y, z, x * 2, 0.11, 0.16);
  for (const sx of [-1, 1]) add(root, U.box, P.dark, sx * x, y - 0.12, z + 0.05, 0.03, 0.25, 0.03, 0.4, 0, 0);
}
// canvas top raised on bows: x half width, z0 (rear) .. z1 (front), from the belt line y0 up to y1
export function raisedHood(root, P, x, z0, z1, y0, y1, mat) {
  add(root, U.box, mat, 0, y1, (z0 + z1) / 2, x * 2 + 0.04, 0.04, z1 - z0);
  for (const sx of [-1, 1]) add(root, U.box, mat, sx * (x + 0.01), (y0 + y1) / 2 + 0.1, z0 + 0.05, 0.03, y1 - y0 - 0.2, 0.2);
  add(root, U.box, mat, 0, (y0 + y1) / 2 + 0.05, z0, x * 2, y1 - y0 - 0.1, 0.03);
  for (const sx of [-1, 1]) for (const z of [z0 + 0.1, (z0 + z1) / 2, z1 - 0.05]) add(root, U.box, P.dark, sx * x, (y0 + y1) / 2, z, 0.025, y1 - y0, 0.025);
}
// spare wheel standing upright at (x, y, z), turned ry
export function spare(root, P, x, y, z, r, w, ry = 0) {
  add(root, U.cylX, P.rubber, x, y, z, w, r, r, 0, ry, 0);
  add(root, U.cylX, P.main, x, y, z, w * 1.05, r * 0.6, r * 0.6, 0, ry, 0);
}

// ===================================================================== motorcycles
// a tube of the frame from a to b ([z, y] at x)
export function tube(root, mat, x, a, b, t = 0.04) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return add(root, U.cyl8, mat, x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, t, len, t, Math.atan2(b[0] - a[0], b[1] - a[1]), 0, 0);
}
// handlebar at (y, z), half width w, with grips
export function handlebar(root, P, y, z, w = 0.36, rise = 0.06) {
  add(root, U.cylX, P.black, 0, y, z, w * 2, 0.016, 0.016);
  for (const sx of [-1, 1]) {
    add(root, U.cylX, P.rubber, sx * (w - 0.05), y + rise, z - 0.04, 0.12, 0.022, 0.022);
    add(root, U.box, P.black, sx * w * 0.6, y + rise / 2, z - 0.02, 0.02, rise, 0.02);
  }
}
// sidecar boat on the +X side: centre x, length l, top y, nose shape, a wheel at the axle z
export function sidecar(root, P, o) {
  const { x, z, l = 1.9, w = 0.62, y = 0.62, h = 0.42 } = o;
  const body = new THREE.Group();
  root.add(body);
  // boat: a long box with a rounded, sloping nose
  add(body, U.box, P.main, x, y, z - 0.1, w, h, l * 0.62);
  add(body, U.cyl, P.main, x, y, z + l * 0.21, w / 2, h, l * 0.18, 0, 0, 0);
  add(body, U.box, P.main, x, y + h * 0.12, z + l * 0.36, w * 0.8, h * 0.7, l * 0.2, 0.55, 0, 0);
  add(body, U.box, P.dark, x, y + h / 2 + 0.01, z - 0.22, w * 0.84, 0.03, l * 0.36);           // cockpit rim
  add(body, U.box, P.black, x, y + h / 2 + 0.02, z - 0.22, w * 0.7, 0.03, l * 0.3);             // opening
  add(body, U.box, P.black, x, y + h / 2 + 0.18, z - 0.48, w * 0.6, 0.3, 0.08, -0.25, 0, 0);    // seat back
  // the chassis tubes to the bike
  for (const dz of [-0.45, 0.35]) add(root, U.cylX, P.dark, x / 2, y - h / 2 - 0.02, z + dz, Math.abs(x) - 0.1, 0.025, 0.025);
  if (o.spare) spare(root, P, x, y + 0.05, z - l * 0.43, 0.3, 0.1);
  return body;
}

// the running gear and frame of a motorcycle. o: { front, rear (axle z), r (wheel radius), rr (rear), tyre (width),
// wheel ('wire' | 'disc'), head [z, y] (steering head), seat [z, y], frame: 'cradle' | 'pressed' | 'dirt',
// fork: 'springer' | 'girder' | 'tele', guards: 'flat' | 'big' | 'high', saddle: 'sprung' | 'bench', barW, rise,
// lamp (radius), rack, bags (panniers), exhaust: side, sidecar: { x, z, l, w, y, h, r, spare } } -> { wheels, steer }
export function motoBase(root, P, o) {
  const fz = o.front ?? 0.7, rz = o.rear ?? -0.72, r = o.r ?? 0.33, rr = o.rr ?? r;
  const head = o.head || [fz - 0.22, 0.98], seat = o.seat || [-0.2, 0.8];
  const F = P.dark;
  const low = [0.12, 0.2], back = [-0.26, 0.2], under = [seat[0] + 0.06, seat[1] - 0.08];
  if (o.frame === 'pressed') {
    // pressed-steel frame (BMW R12): broad flat members
    add(root, U.box, F, 0, (head[1] + under[1]) / 2, (head[0] + under[0]) / 2, 0.07, 0.12, Math.hypot(head[0] - under[0], head[1] - under[1]), Math.atan2(head[1] - under[1], head[0] - under[0]), 0, 0);
    tube(root, F, 0, head, low, 0.05);
  } else {
    tube(root, F, 0, head, under, 0.03);
    tube(root, F, 0, head, low, 0.035);
    tube(root, F, 0, back, under, 0.03);
  }
  for (const sx of [-1, 1]) {
    tube(root, F, sx * 0.07, low, back, 0.025);
    tube(root, F, sx * 0.07, under, [rz, rr], 0.022);
    tube(root, F, sx * 0.08, back, [rz, rr], 0.022);
  }
  // front fork
  const fk = o.fork || 'tele';
  for (const sx of [-1, 1]) {
    tube(root, fk === 'tele' ? P.steel : F, sx * 0.075, [head[0] + 0.02, head[1] + 0.06], [fz, r], fk === 'tele' ? 0.032 : 0.022);
    if (fk === 'springer') tube(root, F, sx * 0.075, [head[0] + 0.1, head[1] + 0.02], [fz + 0.06, r + 0.12], 0.018);
    if (fk === 'girder') add(root, U.box, F, sx * 0.075, (head[1] + r) / 2 + 0.1, (head[0] + fz) / 2 + 0.04, 0.03, 0.06, 0.2);
  }
  if (fk === 'springer' || fk === 'girder') add(root, U.cyl8, P.steel, 0, head[1] + 0.02, head[0] + 0.08, 0.035, 0.14, 0.035);   // spring
  add(root, U.cyl8, F, 0, head[1], head[0], 0.045, 0.16, 0.045, 0.35, 0, 0);
  handlebar(root, P, head[1] + 0.12, head[0] - 0.04, o.barW ?? 0.36, o.rise ?? 0.06);
  lamp(root, P, 0, head[1] - 0.02, head[0] + 0.16, o.lamp ?? 0.09, o.lampMat || null);
  // mudguards
  const gw = o.guards === 'big' ? 0.2 : 0.13;
  if (o.guards === 'high') {
    add(root, U.box, P.main, 0, r * 2 + 0.12, fz + 0.05, 0.12, 0.02, 0.5, -0.12, 0, 0);
    add(root, U.box, P.main, 0, rr * 2 + 0.28, rz + 0.1, 0.12, 0.02, 0.6, 0.25, 0, 0);
  } else {
    guard(root, P, 0, r, fz, r + 0.05, gw, -0.55, o.guards === 'big' ? 1.9 : 1.5, P.main, 7);
    guard(root, P, 0, rr, rz, rr + 0.05, gw, -2.0, 0.45, P.main, 7);
  }
  // saddle
  if (o.saddle === 'bench') add(root, U.box, P.black, 0, seat[1], seat[0] - 0.1, 0.24, 0.09, 0.75, 0.05, 0, 0);
  else {
    add(root, U.box, P.black, 0, seat[1], seat[0], 0.25, 0.07, 0.3);
    add(root, U.box, P.black, 0, seat[1] + 0.02, seat[0] + 0.17, 0.1, 0.05, 0.12);
    for (const sx of [-1, 1]) add(root, U.cyl8, P.steel, sx * 0.08, seat[1] - 0.09, seat[0] - 0.08, 0.025, 0.12, 0.025);
  }
  if (o.pillion) add(root, U.box, P.black, 0, seat[1] + 0.02, seat[0] - 0.42, 0.22, 0.06, 0.24);
  if (o.rack) {
    add(root, U.box, F, 0, rr * 2 + 0.16, rz + 0.05, 0.26, 0.02, 0.4);
    for (const sx of [-1, 1]) tube(root, F, sx * 0.12, [rz + 0.2, rr * 2 + 0.16], [rz, rr], 0.015);
  }
  if (o.bags) for (const sx of [-1, 1]) add(root, U.box, o.bagMat || P.dark, sx * 0.2, rr + 0.32, rz + 0.12, 0.12, 0.3, 0.36);
  // exhaust down the right side
  const ex = -(o.exhaust ?? 0.16);
  tube(root, P.metal, ex, [0.12, 0.3], [-0.3, 0.26], 0.03);
  tube(root, P.metal, ex, [-0.3, 0.26], [rz - 0.15, 0.36], 0.04);
  // the chain / shaft to the rear wheel
  tube(root, P.black, 0.1, [-0.15, 0.24], [rz, rr], 0.02);
  /** @type {any[]} */
  const axles = [{ z: fz, r, w: o.tyre ?? 0.09, single: true, steer: true }, { z: rz, r: rr, w: o.tyre ?? 0.09, single: true }];
  const sc = o.sidecar;
  if (sc) {
    sidecar(root, P, { ...sc, l: sc.l ?? 1.9 });
    axles.push({ z: sc.wz ?? sc.z - 0.15, x: sc.x, r: sc.r ?? r, w: o.tyre ?? 0.09, side: true });
    guard(root, P, sc.x, sc.r ?? r, sc.wz ?? sc.z - 0.15, (sc.r ?? r) + 0.05, gw, -1.4, 1.2, P.main, 6);
  }
  return wheelSet(root, P, { style: o.wheel || 'wire', axles });
}

// the usual result of a motorcycle hull builder (the engine part sits between the wheels, the fuel tank on the frame)
export function motoResult(root, P, wh, o) {
  const bay = engineDeck(root, P, new THREE.Vector3(0, 0.6, o.engineZ ?? 0.0), 0.12, 0.2, P.dark);
  bay.engineFloor = o.engineY ?? 0.16;
  const side = o.sidecar;
  return {
    root, wheels: wh.wheels, wheelR: o.r ?? 0.33, steer: wh.steer, ring: null, bay, engineShown: true,
    mount: o.mount || new THREE.Vector3(0, 1.3, 0),
    box: new THREE.Box3(new THREE.Vector3(side ? side.x - (side.w ?? 0.62) / 2 - 0.05 : -0.36, 0.15, -1.08), new THREE.Vector3(0.36, 1.55, 1.08)),
    fuelAt: o.fuelAt || new THREE.Vector3(0, 0.92, 0.15), fuelRot: 0,
    driveAt: o.mount || new THREE.Vector3(0, 1.3, 0), ringHole: null, mgAt: o.mgAt || new THREE.Vector3(0, 0, 0),
    lean: !side,
  };
}

// a motorcycle fuel tank (the fuel part): 'tear' (rounded teardrop), 'slab' (flat-sided, between the top tubes),
// 'box' (squared with knee pads), 'dirt' (narrow, high in front); origin at its centre
export function motoTank(g, P, kind = 'tear', s = 1) {
  if (kind === 'slab') {
    add(g, U.box, P.main, 0, 0, 0, 0.2 * s, 0.2 * s, 0.56 * s);
    add(g, U.box, P.dark, 0, 0.105 * s, 0, 0.16 * s, 0.01, 0.5 * s);
  } else if (kind === 'box') {
    add(g, U.box, P.main, 0, 0, 0, 0.26 * s, 0.2 * s, 0.46 * s);
    for (const sx of [-1, 1]) add(g, U.box, P.black, sx * 0.135 * s, -0.02, -0.12 * s, 0.01, 0.1 * s, 0.14 * s);
  } else if (kind === 'dirt') {
    add(g, U.box, P.main, 0, 0.02, 0.05, 0.26 * s, 0.22 * s, 0.32 * s, 0.25, 0, 0);
  } else {
    add(g, U.sph, P.main, 0, 0, 0, 0.14 * s, 0.11 * s, 0.27 * s);
    add(g, U.box, P.main, 0, -0.04 * s, 0, 0.22 * s, 0.1 * s, 0.4 * s);
  }
  add(g, U.cyl8, P.steel, 0, 0.11 * s, 0.1 * s, 0.03, 0.03, 0.03);                                  // filler cap
  return 0.12 * s;
}

// motorcycle engines (the engine part: origin bottom centre, returns the height). kind: 'boxer' (flat twin, the
// cylinders stick out to the sides), 'vtwin' (V-twin along the frame), 'single' (one upright cylinder)
export function motoEngine(g, P, E, kind, s = 1) {
  add(g, U.box, E, 0, 0.12 * s, 0, 0.24 * s, 0.24 * s, 0.36 * s);                         // crankcase / gearbox
  add(g, U.box, E, 0, 0.1 * s, -0.24 * s, 0.2 * s, 0.18 * s, 0.2 * s);
  const fins = (x, y, z, rx, rz) => {
    for (let i = 0; i < 4; i++) add(g, U.cyl8, P.metal, x, y, z, 0.075 * s, 0.015, 0.075 * s, rx, 0, rz);
  };
  if (kind === 'boxer') {
    for (const sx of [-1, 1]) {
      add(g, U.cylX, E, sx * 0.24 * s, 0.17 * s, 0.08 * s, 0.24 * s, 0.07 * s, 0.07 * s);
      add(g, U.box, P.metal, sx * 0.38 * s, 0.17 * s, 0.08 * s, 0.07 * s, 0.13 * s, 0.13 * s);           // heads
      for (let i = 0; i < 4; i++) add(g, U.cylX, P.metal, sx * (0.16 + i * 0.045) * s, 0.17 * s, 0.08 * s, 0.012, 0.09 * s, 0.09 * s);
    }
    return 0.3 * s;
  }
  if (kind === 'vtwin') {
    for (const [dz, a] of [[0.1, 0.45], [-0.08, -0.45]]) {
      add(g, U.cyl8, E, 0, 0.36 * s, dz * s + Math.sin(a) * 0.1 * s, 0.065 * s, 0.26 * s, 0.065 * s, a, 0, 0);
      for (let i = 0; i < 4; i++) add(g, U.cyl8, P.metal, 0, (0.3 + i * 0.05) * s, (dz + Math.sin(a) * (0.05 + i * 0.05)) * s, 0.085 * s, 0.012, 0.085 * s, a, 0, 0);
    }
    fins(0, 0, 0, 0, 0);
    return 0.56 * s;
  }
  add(g, U.cyl8, E, 0, 0.36 * s, 0.03 * s, 0.07 * s, 0.26 * s, 0.07 * s, 0.15, 0, 0);
  for (let i = 0; i < 5; i++) add(g, U.cyl8, P.metal, 0, (0.28 + i * 0.045) * s, (0.02 + i * 0.008) * s, 0.095 * s, 0.012, 0.095 * s, 0.15, 0, 0);
  return 0.52 * s;
}

// gameplay data shared by the cars / motorcycles (the def adds dimensions, seats, interior...)
export function softHull(o) {
  const moto = o.car === 'moto';
  return {
    ammoMax: 0, mgAmmo: 0, armor: { front: 3, side: 2, rear: 2, top: 1 },
    wheeled: true, apc: true, soft: true, turretless: true, arc: 1.4, elevMin: -0.35, elevMax: 0.7, eff: 1, turn: moto ? 1.15 : 0.95,
    modules: moto ? [
      { id: 'engine', u: [-0.6, 0.6], v: [0.15, 0.5], w: [-0.25, 0.3] },
      { id: 'transmission', u: [-0.3, 0.3], v: [0.1, 0.4], w: [-0.6, -0.2] },
    ] : [
      { id: 'engine', u: [-0.4, 0.4], v: [0.25, 0.65], w: o.rearEngine ? [-0.95, -0.55] : [0.55, 0.95] },
      { id: 'transmission', u: [-0.3, 0.3], v: [0.1, 0.35], w: o.rearEngine ? [-0.6, -0.3] : [0.15, 0.5] },
    ],
    crew: moto ? [{ u: [-1, 1], v: [0.45, 1], w: [-0.8, 0.25] }] : [{ u: [-0.9, 0.9], v: [0.35, 1], w: [-0.7, 0.35] }],
    ...o,
    interior: { theme: 'soviet', shell: false, open: true, noSeats: true, controls: 'none', x: 0.6, floor: 0.5, roof: 1.8, z: [-1, 1],
      walk: [{ x: [-0.2, 0.2], z: [-0.5, 0.3] }], props: [], ...(o.interior || {}) },
  };
}

// ===================================================================== riders
// low-poly men sitting in / on the vehicle (enemy crews, the riding infantry, the player in third person).
// pose: 'car' (hands on the wheel), 'moto' (astride, hands on the bars), 'side' (sidecar / pillion: hands in lap),
// 'gun' (sidecar gunner: hands up on the machine gun). Origin: the seat under the hips, facing +Z.
const RIDER_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
const riderCache = new Map();
export function riderMesh(pose, color = 0x5a5f48) {
  const key = pose + color;
  if (!riderCache.has(key)) riderCache.set(key, riderGeometry(pose, color));
  const m = new THREE.Mesh(riderCache.get(key), RIDER_MAT);
  m.castShadow = true;
  m.userData.keep = true;
  m.userData.rider = true;
  return m;
}
function riderGeometry(pose, color) {
  const geos = [];
  const cloth = new THREE.Color(color), skin = new THREE.Color(0xc39a78), dark = new THREE.Color(color).multiplyScalar(0.6),
    boot = new THREE.Color(0x1e1a16);
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const put = (geo, col, pos, scale, quat = new THREE.Quaternion()) => {
    const g = geo.clone().applyMatrix4(m4.compose(pos, quat, scale));
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geos.push(g.index ? g.toNonIndexed() : g);
  };
  const box = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(1, 8, 6);
  // a limb from a to b, thickness t
  const limb = (a, b, t, col) => {
    const d = b.clone().sub(a);
    q.setFromUnitVectors(v(0, 1, 0), d.clone().normalize());
    put(box, col, a.clone().add(b).multiplyScalar(0.5), v(t, d.length() + t * 0.6, t), q.clone());
  };
  const lean = pose === 'moto' ? 0.32 : pose === 'gun' ? 0.12 : 0.05;
  const hip = v(0, 0.1, 0), neck = v(0, 0.62 * Math.cos(lean) + 0.1, 0.62 * Math.sin(lean));
  limb(hip, neck, 0.3, cloth);                                                             // torso
  put(box, cloth, v(0, 0.36 * Math.cos(lean) + 0.1, 0.36 * Math.sin(lean)), v(0.4, 0.2, 0.26), q.setFromAxisAngle(v(1, 0, 0), lean).clone());
  const head = neck.clone().add(v(0, 0.16, 0.02));
  put(sph, skin, head, v(0.11, 0.13, 0.12));
  put(sph, dark, head.clone().add(v(0, 0.06, -0.01)), v(0.135, 0.09, 0.15));             // helmet / cap
  // legs
  for (const sx of [-1, 1]) {
    const h = v(sx * 0.11, 0.08, 0.02);
    let knee, foot;
    if (pose === 'moto') { knee = v(sx * 0.2, 0.05, 0.38); foot = v(sx * 0.2, -0.38, 0.22); }
    else if (pose === 'side' || pose === 'gun') { knee = v(sx * 0.12, 0.12, 0.42); foot = v(sx * 0.12, -0.3, 0.55); }
    else { knee = v(sx * 0.12, 0.1, 0.45); foot = v(sx * 0.13, -0.35, 0.62); }
    limb(h, knee, 0.15, cloth);
    limb(knee, foot, 0.13, cloth);
    put(box, boot, foot.clone().add(v(0, -0.02, 0.06)), v(0.12, 0.1, 0.24));
  }
  // arms
  for (const sx of [-1, 1]) {
    const sh = neck.clone().add(v(sx * 0.2, -0.06, -0.02));
    let hand;
    if (pose === 'moto') hand = v(sx * 0.3, 0.4, 0.6);
    else if (pose === 'car') hand = v(sx * 0.17, 0.42, 0.5);
    else if (pose === 'gun') hand = v(sx * 0.12, 0.66, 0.5);
    else hand = v(sx * 0.14, 0.22, 0.34);
    const elbow = sh.clone().lerp(hand, 0.5).add(v(sx * 0.07, -0.12, -0.04));
    limb(sh, elbow, 0.1, cloth);
    limb(elbow, hand, 0.09, cloth);
    put(sph, skin, hand, v(0.045, 0.045, 0.045));
  }
  return mergeGeometries(geos, false);
}
