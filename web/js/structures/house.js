// Houses of the villages and towns: walls built of pieces around real door / window openings (one can walk in, look
// and shoot through the windows), floors with stairs between the storeys (stairwells with parapets), furniture
// (a stove, beds, tables, wardrobes...), shell holes, collapse into rubble when shot up or rammed by a tank.
//
// A house is one compound obstacle (obstacles.js): the bounding box with the pieces in `sub` (wall segments,
// furniture; floor slabs and the roof stop rays only). Its walkable surfaces (`rec.floors`: flat rectangles and the
// stair ramps, in the house's local axes) are what world.groundAt stands the walkers on.
//
// Local axes of a house (frame f): X across the road (depth d, the road-facing wall at x = face * d / 2), Z along it
// (width w).
import { rng } from '../noise.js';
import { MAT, box, roofGeo } from './kit.js';

const T = 0.3;                 // wall thickness
const STOREY = 3.1;            // floor to floor
const SLAB = 0.22;             // floor slab
const WIN = { w: 1.0, y0: 0.9, y1: 2.15 };           // window opening (heights above the storey floor)
const DOOR = { w: 1.1, y1: 2.2 };
const STAIR = { w: 1.05, run: 4.3, steps: 14, start: 0.15, landing: 1.4, entry: 1.15 };

/**
 * @param {import('./kit.js').Kit} K
 * @param {{ along: number, off: number, w: number, d: number, story: number, flat?: boolean, town?: boolean }} o
 */
export function buildHouse(K, o) {
  const { world, r } = K;
  const { w, d, story } = o;
  const f = K.frame(o.along, o.off);
  const rad = Math.max(w, d) / 2;
  const y = K.groundMin(f.x, f.z, rad) - 0.3;          // foundation bottom
  const fy = K.groundMax(f.x, f.z, rad) + 0.25;        // ground floor
  const H = STOREY * story;
  const wall = r.pick(MAT.walls);
  const trim = r.pick(MAT.trims);
  const shutters = !o.town && r() < 0.6;
  const face = o.off > 0 ? -1 : 1;                     // local X of the road-facing wall
  const rh = o.flat ? 0.3 : Math.min(3, d * 0.45);     // roof height
  const flY = s => fy + s * STOREY;
  const cosR = Math.cos(f.rot), sinR = Math.sin(f.rot);

  const n = K.houses.length;
  const rec = {
    id: `${K.plan.k}:${n}`, n, f, y, fy, w, d, H, story, wall,
    hp: story > 2 ? 190 : story > 1 ? 140 : 80,
    rad2: (rad + 1) ** 2,
    /** @type {any[]} */ floors: [],                    // walkable surfaces (local)
    /** @type {any[]} */ sub: [],                       // obstacle pieces
    /** @type {{ lx: number, lz: number, y: number }[]} */ spots: [],   // free floor spots (loot)
    /** @type {any[]} */ meshes: [],                    // the shell (+ hole marks)
    /** @type {any[]} */ inner: [],                     // floors, stairs, furniture (shown near the house)
    obstacle: null, ruined: false,
    hit: null, ram: null, ruin: null, floorAt: null,
  };
  // the shell (walls, windows, roof) and the inside (floors, stairs, furniture: drawn only near the house) are baked
  // into separate meshes
  const outside = K.collect = [], inside = [];
  const indoors = fn => { K.collect = inside; fn(); K.collect = outside; };

  // ---- helpers in local coordinates (box origin: bottom centre)
  const P = (mat, lx, y0, lz, sx, sy, sz, shadow = true, rot = 0) => {
    const p = K.at(f, lx, lz);
    return K.part(box, mat, p.x, y0, p.z, sx, sy, sz, f.rot + rot, shadow);
  };
  const sub = (lx, lz, hx, hz, y0, y1, extra = {}, rot = 0) => {
    const p = K.at(f, lx, lz);
    rec.sub.push({ x: p.x, z: p.z, hx, hz, rot: f.rot + rot, y0, y1, house: rec, ...extra });
  };
  const solid = (mat, lx, y0, lz, sx, sy, sz, shadow = true) => {
    P(mat, lx, y0, lz, sx, sy, sz, shadow);
    sub(lx, lz, sx / 2, sz / 2, y0, y0 + sy);
  };
  const rect = (x0, x1, z0, z1) => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
  const overlap = (a, b, m = 0) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
  const inner = rect(-d / 2 + T, d / 2 - T, -w / 2 + T, w / 2 - T);
  // rectangle a minus the hole b (b inside a): up to 4 rectangles
  const minus = (a, b) => [
    rect(a.x0, b.x0, a.z0, a.z1), rect(b.x1, a.x1, a.z0, a.z1),
    rect(b.x0, b.x1, a.z0, b.z0), rect(b.x0, b.x1, b.z1, a.z1),
  ].filter(q => q.x1 - q.x0 > 0.01 && q.z1 - q.z0 > 0.01);

  // ---- stairs (several storeys): straight flights along the back wall, switching back lane by lane
  // u: from the inner face of the back wall towards the front, v: from the inner face of the stair-end wall
  const sEnd = r() < 0.5 ? -1 : 1;
  const xb = -face * (d / 2 - T), zb = sEnd * (w / 2 - T);
  const UV = (u, v) => ({ x: xb + face * u, z: zb - sEnd * v });
  const uvRect = (u0, u1, v0, v1) => { const a = UV(u0, v0), b = UV(u1, v1); return rect(a.x, b.x, a.z, b.z); };
  const SW = STAIR.w, v1 = STAIR.start + STAIR.run;
  const stairs = story > 1;
  const reserved = [];                                   // [storey, rect]: kept free of furniture
  const stairZone = stairs ? uvRect(0, 2 * SW + 0.4, 0, v1 + STAIR.landing) : null;
  const stairZ = stairs ? rect(0, 0, UV(0, -0.3).z, UV(0, v1 + 0.3).z) : null;

  // ---- openings: front door + windows (front, back, ends), back door sometimes; a partition in a village house
  const slots = (len, step) => {
    const k = Math.max(2, Math.round(len / step));
    return [...Array(k)].map((_, i) => -len / 2 + (i + 0.5) * len / k);
  };
  const partZ = !o.town && story === 1 && w >= 8.5 ? (r() < 0.5 ? -1 : 1) * (w * 0.12 + r() * 0.6) : null;
  const front = slots(w, 2.7), back = slots(w, 3.4);
  const free = c => partZ === null || Math.abs(c - partZ) > 1.3;
  const doorC = front.filter(free).sort((a, b) => Math.abs(a) - Math.abs(b))[0] ?? 0;
  const backDoor = r() < 0.45 ? back.find(c => free(c) && !(stairs && c > stairZ.z0 - 0.8 && c < stairZ.z1 + 0.8)) : undefined;
  // walls: { axis ('z': runs along Z at x = pos | 'x': along X at z = pos), pos, a0, a1, out (outward sign), open[s] }
  const walls = [
    { axis: 'z', pos: face * (d / 2 - T / 2), a0: -w / 2, a1: w / 2, out: face, open: [] },
    { axis: 'z', pos: -face * (d / 2 - T / 2), a0: -w / 2, a1: w / 2, out: -face, open: [] },
    { axis: 'x', pos: -(w / 2 - T / 2), a0: -d / 2 + T, a1: d / 2 - T, out: -1, open: [] },
    { axis: 'x', pos: w / 2 - T / 2, a0: -d / 2 + T, a1: d / 2 - T, out: 1, open: [] },
  ];
  for (let s = 0; s < story; s++) {
    walls[0].open[s] = front.map(c => s === 0 && c === doorC ? { c, w: DOOR.w, y0: 0, y1: DOOR.y1, door: true } : { c, w: WIN.w, y0: WIN.y0, y1: WIN.y1 })
      .filter(q => q.door || free(q.c));
    walls[1].open[s] = back.filter(c => !(stairs && c > stairZ.z0 - 0.6 && c < stairZ.z1 + 0.6) && (c !== backDoor || s === 0) && free(c))
      .map(c => s === 0 && c === backDoor ? { c, w: DOOR.w, y0: 0, y1: DOOR.y1, door: true } : { c, w: WIN.w, y0: WIN.y0, y1: WIN.y1 });
    for (const e of [walls[2], walls[3]]) e.open[s] = d >= 5.5 && r() < (o.town ? 0.8 : 0.6) ? [{ c: 0, w: WIN.w, y0: WIN.y0, y1: WIN.y1 }] : [];
  }

  // ---- foundation, ground floor, walls
  P(MAT.plinth, 0, y, 0, d, fy - 0.05 - y, w);
  indoors(() => P(MAT.floor, 0, fy - 0.05, 0, inner.x1 - inner.x0, 0.05, inner.z1 - inner.z0, false));
  rec.floors.push({ ...inner, y: fy });

  const wallPiece = (W, b0, b1, y0, y1) => {
    if (b1 - b0 < 0.02 || y1 - y0 < 0.02) return;
    const c = (b0 + b1) / 2, L = b1 - b0;
    if (W.axis === 'z') solid(wall, W.pos, y0, c, T, y1 - y0, L);
    else solid(wall, c, y0, W.pos, L, y1 - y0, T);
  };
  // local position of a point on wall W: along a, offset off from its centre line (+ = outwards)
  const onWall = (W, a, off) => W.axis === 'z' ? { x: W.pos + W.out * off, z: a } : { x: a, z: W.pos + W.out * off };
  const wallBox = (W, mat, a, off, y0, sa, sy, st, shadow = true) => {
    const p = onWall(W, a, off);
    if (W.axis === 'z') P(mat, p.x, y0, p.z, st, sy, sa, shadow);
    else P(mat, p.x, y0, p.z, sa, sy, st, shadow);
  };
  const doorways = [];
  for (const W of walls) {
    for (let s = 0; s < story; s++) {
      const fl = flY(s), top = fl + STOREY, base = s === 0 ? fl - 0.05 : fl;
      let a = W.a0;
      for (const q of W.open[s].sort((p, q2) => p.c - q2.c)) {
        const q0 = q.c - q.w / 2, q1 = q.c + q.w / 2;
        wallPiece(W, a, q0, base, top);
        if (q.y0 > 0) wallPiece(W, q0, q1, base, fl + q.y0);
        wallPiece(W, q0, q1, fl + q.y1, top);
        a = q1;
        const hh = q.y1 - q.y0;
        if (q.door) {
          // frame, the leaf standing open against the inner face, a threshold, a step in front
          wallBox(W, trim, q.c, T / 2 + 0.02, fl + q.y1, q.w + 0.3, 0.14, 0.06);
          for (const sd of [-1, 1]) wallBox(W, trim, q.c + sd * (q.w / 2 + 0.06), T / 2 + 0.02, fl, 0.12, q.y1, 0.06);
          indoors(() => wallBox(W, MAT.wood, q.c + q.w, -T / 2 - 0.04, fl, q.w - 0.05, q.y1 - 0.05, 0.05, false));
          const th = onWall(W, q.c, 0);
          rec.floors.push({ ...(W.axis === 'z' ? rect(th.x - T / 2 - 0.05, th.x + T / 2 + 0.05, q0, q1) : rect(q0, q1, th.z - T / 2 - 0.05, th.z + T / 2 + 0.05)), y: fl });
          const sp = onWall(W, q.c, T / 2 + 0.45), gp = K.at(f, sp.x, sp.z);
          const g = world.heightAt(gp.x, gp.z);
          if (fl - g > 0.22) {
            const sy = (fl + g) / 2;
            wallBox(W, MAT.plinth, q.c, T / 2 + 0.45, y, q.w + 0.5, sy - y, 0.9);
            const st = onWall(W, q.c, T / 2 + 0.45);
            rec.floors.push({ ...(W.axis === 'z' ? rect(st.x - 0.45, st.x + 0.45, q0 - 0.25, q1 + 0.25) : rect(q0 - 0.25, q1 + 0.25, st.z - 0.45, st.z + 0.45)), y: sy });
          }
          const ins = onWall(W, q.c, -T / 2 - 0.9);
          reserved.push([s, W.axis === 'z' ? rect(ins.x - 0.9, ins.x + 0.9, q0 - 0.5, q1 + 0.5) : rect(q0 - 0.5, q1 + 0.5, ins.z - 0.9, ins.z + 0.9)]);
          doorways.push(q);
        } else {
          // window: trims (or shutters) outside, a sill, the cross of the frame in the opening
          wallBox(W, trim, q.c, T / 2 + 0.02, fl + q.y1, q.w + 0.24, 0.12, 0.06);
          wallBox(W, trim, q.c, T / 2 + 0.03, fl + q.y0 - 0.08, q.w + 0.2, 0.08, 0.16);
          for (const sd of [-1, 1]) {
            if (shutters) wallBox(W, trim, q.c + sd * (q.w * 0.75 + 0.02), T / 2 + 0.03, fl + q.y0, q.w / 2, hh, 0.04);
            else wallBox(W, trim, q.c + sd * (q.w / 2 + 0.05), T / 2 + 0.02, fl + q.y0, 0.1, hh, 0.06);
          }
          wallBox(W, MAT.furnitureLight, q.c, 0, fl + q.y0, 0.06, hh, 0.07);
          wallBox(W, MAT.furnitureLight, q.c, 0, fl + q.y0 + hh * 0.62, q.w, 0.06, 0.07);
        }
      }
      wallPiece(W, a, W.a1, base, top);
    }
  }

  // ---- partition with a doorway (village house: two rooms)
  K.collect = inside;
  if (partZ !== null) {
    const dx0 = -0.48, dx1 = 0.48;
    for (const [a, b] of [[inner.x0, dx0], [dx1, inner.x1]]) solid(wall, (a + b) / 2, fy - 0.05, partZ, b - a, STOREY + 0.05, 0.16, false);
    solid(wall, 0, fy + 2.1, partZ, dx1 - dx0, STOREY - 2.1, 0.16, false);
    rec.floors.push({ ...rect(dx0, dx1, partZ - 0.1, partZ + 0.1), y: fy });
    reserved.push([0, rect(-1, 1, partZ - 1, partZ + 1)]);
  }

  // ---- upper floors with stairwells, the flights, parapets
  for (let s = 1; s <= story; s++) {
    const fl = flY(s);
    const top = s === story;
    const hole = !top ? uvRect((s - 1) % 2 * SW, ((s - 1) % 2 + 1) * SW, 0, v1) : null;
    const pieces = hole ? minus(inner, hole) : [inner];
    for (const q of pieces) {
      // whitewashed ceiling under the floor boards
      P(MAT.whitewash, (q.x0 + q.x1) / 2, fl - SLAB, (q.z0 + q.z1) / 2, q.x1 - q.x0, SLAB - (top ? 0 : 0.05), q.z1 - q.z0, false);
      if (!top) P(MAT.floor, (q.x0 + q.x1) / 2, fl - 0.05, (q.z0 + q.z1) / 2, q.x1 - q.x0, 0.05, q.z1 - q.z0, false);
      sub((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, (q.x1 - q.x0) / 2, (q.z1 - q.z0) / 2, fl - SLAB, fl, { noPush: true });
      if (!top) rec.floors.push({ ...q, y: fl });
    }
  }
  if (stairs) {
    for (let s = 0; s < story - 1; s++) {
      const L = s % 2, fl = flY(s), fl2 = flY(s + 1);
      const vLo = L ? v1 : STAIR.start, vHi = L ? STAIR.start : v1;
      const N = STAIR.steps, rise = STOREY / N, tread = (vHi - vLo) / N;
      for (let i = 0; i < N; i++) {
        const q = uvRect(L * SW, (L + 1) * SW, vLo + i * tread, vLo + (i + 1) * tread);
        P(i % 2 ? MAT.wood : MAT.furnitureLight, (q.x0 + q.x1) / 2, fl, (q.z0 + q.z1) / 2, q.x1 - q.x0, (i + 1) * rise, q.z1 - q.z0, false);
      }
      const ramp = uvRect(L * SW, (L + 1) * SW, Math.min(vLo, vHi), Math.max(vLo, vHi));
      rec.floors.push({ ...ramp, ramp: true, za: UV(0, vLo).z, ya: fl, zb: UV(0, vHi).z, yb: fl2 });
      // the wall of the flight on its open side (from this floor up to a parapet on the next one), its entry left open
      const uS = (L + 1) * SW;
      const vA = L ? 0 : STAIR.start + STAIR.entry, vB = L ? v1 - STAIR.entry : v1;
      const sw = uvRect(uS - 0.06, uS + 0.06, vA, vB);
      solid(MAT.furnitureLight, (sw.x0 + sw.x1) / 2, fl, (sw.z0 + sw.z1) / 2, sw.x1 - sw.x0, fl2 + 1.0 - fl, sw.z1 - sw.z0, false);
      if (L) {
        // the stairwell of a flight in the second lane: parapets on the next floor beside it (its top left open)
        // and across its foot
        const pa = uvRect(SW - 0.05, SW + 0.05, 1.1, v1);
        solid(MAT.furnitureLight, (pa.x0 + pa.x1) / 2, fl2, (pa.z0 + pa.z1) / 2, pa.x1 - pa.x0, 1.0, pa.z1 - pa.z0, false);
        const pc = uvRect(SW, 2 * SW, v1 - 0.05, v1 + 0.05);
        solid(MAT.furnitureLight, (pc.x0 + pc.x1) / 2, fl2, (pc.z0 + pc.z1) / 2, pc.x1 - pc.x0, 1.0, pc.z1 - pc.z0, false);
      }
    }
    for (let s = 0; s < story; s++) reserved.push([s, stairZone]);
  }
  K.collect = outside;

  // ---- roof
  if (o.flat) P(MAT.darkConcrete, 0, fy + H, 0, d + 0.3, 0.3, w + 0.3);
  else K.part(roofGeo, r.pick(MAT.roofs), f.x, fy + H, f.z, d + 0.8, rh, w + 0.6, f.rot);
  // roof and attic floor stop rays (not walkers)
  sub(0, 0, (d + 0.8) / 2, (w + 0.6) / 2, fy + H - SLAB, fy + H + rh * 0.5, { noPush: true });
  if (!o.flat) sub(0, 0, (d + 0.8) / 4, (w + 0.6) / 2, fy + H + rh * 0.5, fy + H + rh, { noPush: true });

  // ---- furniture
  K.collect = inside;
  const placed = [];
  const rooms = [];
  for (let s = 0; s < story; s++) {
    if (partZ !== null && s === 0) {
      rooms.push({ s, q: rect(inner.x0, inner.x1, inner.z0, partZ - 0.08) }, { s, q: rect(inner.x0, inner.x1, partZ + 0.08, inner.z1) });
    } else rooms.push({ s, q: inner });
  }
  const openingsOn = (s, side, q) => {
    // window / door openings on the wall a piece stands against (side: 0 x0, 1 x1, 2 z0, 3 z1)
    const W = side < 2 ? walls.find(W2 => W2.axis === 'z' && Math.sign(W2.pos) === (side ? 1 : -1))
                       : walls.find(W2 => W2.axis === 'x' && Math.sign(W2.pos) === (side === 3 ? 1 : -1));
    if (!W) return [];
    return W.open[s].filter(op => side < 2 ? op.c + op.w / 2 > q.z0 && op.c - op.w / 2 < q.z1 : op.c + op.w / 2 > q.x0 && op.c - op.w / 2 < q.x1);
  };
  // try to stand a piece (sx along the wall, sz deep) against a wall of room R; returns its frame or null
  const placeAgainst = (R, sx, sz, h) => {
    for (let k = 0; k < 14; k++) {
      const side = Math.floor(r() * 4);
      const q = R.q;
      const along = side < 2 ? q.z1 - q.z0 : q.x1 - q.x0;
      if (along < sx + 0.2) continue;
      const a = (side < 2 ? q.z0 : q.x0) + 0.1 + sx / 2 + r() * (along - sx - 0.2);
      let cx, cz, rot, fr;
      if (side < 2) {
        const xw = side ? q.x1 : q.x0;
        cx = xw + (side ? -1 : 1) * (sz / 2 + 0.02); cz = a; rot = side ? -Math.PI / 2 : Math.PI / 2;
        fr = rect(cx - sz / 2, cx + sz / 2, a - sx / 2, a + sx / 2);
      } else {
        const zw = side === 3 ? q.z1 : q.z0;
        cz = zw + (side === 3 ? -1 : 1) * (sz / 2 + 0.02); cx = a; rot = side === 3 ? Math.PI : 0;
        fr = rect(a - sx / 2, a + sx / 2, cz - sz / 2, cz + sz / 2);
      }
      if (fr.x0 < q.x0 - 0.01 || fr.x1 > q.x1 + 0.01 || fr.z0 < q.z0 - 0.01 || fr.z1 > q.z1 + 0.01) continue;
      if (reserved.some(([s, z]) => s === R.s && overlap(fr, z))) continue;
      if (placed.some(([s, z]) => s === R.s && overlap(fr, z, 0.45))) continue;
      if (h > WIN.y0 - 0.05 && openingsOn(R.s, side, fr).length) continue;
      placed.push([R.s, fr]);
      return { cx, cz, rot, fl: flY(R.s), fr };
    }
    return null;
  };
  // a piece in furniture axes (x along the wall, z out of it into the room) at frame F
  const FP = (F, mat, fx, y0, fz, sx, sy, sz, ob = false) => {
    const c = Math.cos(F.rot), s = Math.sin(F.rot);
    const lx = F.cx + fx * c + fz * s, lz = F.cz - fx * s + fz * c;
    P(mat, lx, F.fl + y0, lz, sx, sy, sz, false, F.rot);
    if (ob) sub(lx, lz, sx / 2, sz / 2, F.fl + y0, F.fl + y0 + sy, {}, F.rot);
  };
  const FURN = {
    stove(F) {                                          // Russian stove, its chimney up through the roof
      FP(F, MAT.whitewash, 0, 0, 0, 1.5, 1.75, 1.7, true);
      FP(F, MAT.whitewash, 0.25, 1.75, -0.2, 0.9, 0.35, 1.2);
      FP(F, MAT.charred, 0, 0.75, 0.84, 0.55, 0.45, 0.05);
      const c = Math.cos(F.rot), s = Math.sin(F.rot);
      const lx = F.cx + 0.25 * c - 0.3 * s;
      const top = o.flat ? fy + H + 1 : fy + H + rh * Math.max(0, 1 - Math.abs(lx) / ((d + 0.8) / 2)) + 0.7;
      K.collect = outside;                              // the chimney is seen from afar
      FP(F, MAT.whitewash, 0.25, 2.1, -0.3, 0.45, top - F.fl - 2.1, 0.45);
      K.collect = inside;
    },
    bed(F) {
      FP(F, MAT.furniture, 0, 0, 0, 2.0, 0.45, 0.9, true);
      FP(F, r.pick(MAT.cloth), 0.1, 0.45, 0, 1.75, 0.14, 0.86);
      FP(F, MAT.whitewash, -0.82, 0.45, 0, 0.32, 0.18, 0.7);
      FP(F, MAT.furniture, -0.98, 0, 0, 0.06, 0.95, 0.9);
    },
    wardrobe(F) {
      FP(F, MAT.furniture, 0, 0, 0, 1.1, 1.95, 0.55, true);
      FP(F, MAT.furnitureLight, 0, 0.1, 0.28, 0.02, 1.7, 0.01);
    },
    chest(F) {
      FP(F, MAT.furniture, 0, 0, 0, 1.0, 0.5, 0.55, true);
      FP(F, MAT.metal, 0, 0.36, 0.28, 0.9, 0.05, 0.02);
    },
    shelf(F) {
      FP(F, MAT.furnitureLight, 0, 0, 0, 1.2, 1.8, 0.35, true);
      for (let i = 0; i < 4; i++) FP(F, r() < 0.5 ? MAT.crate : r.pick(MAT.cloth), (r() - 0.5) * 0.5, 0.3 + i * 0.42, 0.02, 0.6, 0.22, 0.25);
    },
    table(F) {                                          // a table with a bench (village) / two chairs (town)
      FP(F, MAT.furnitureLight, 0, 0.72, 0.1, 1.4, 0.05, 0.8);
      for (const [lx, lz] of [[-0.62, -0.22], [0.62, -0.22], [-0.62, 0.42], [0.62, 0.42]]) FP(F, MAT.furniture, lx, 0, lz, 0.06, 0.72, 0.06);
      const c = Math.cos(F.rot), s = Math.sin(F.rot);
      sub(F.cx + 0.1 * s, F.cz + 0.1 * c, 0.7, 0.4, F.fl, F.fl + 0.77, {}, F.rot);
      if (o.town) for (const lx of [-0.4, 0.4]) { FP(F, MAT.furniture, lx, 0, 0.75, 0.42, 0.45, 0.42); FP(F, MAT.furniture, lx, 0.45, 0.94, 0.42, 0.5, 0.05); }
      else FP(F, MAT.furniture, 0, 0, 0.78, 1.3, 0.45, 0.32);
    },
    desk(F) {
      FP(F, MAT.furniture, 0, 0, 0, 1.2, 0.76, 0.6, true);
      FP(F, MAT.furniture, 0, 0, 0.6, 0.42, 0.45, 0.42);
      FP(F, MAT.whitewash, 0.2, 0.76, 0, 0.3, 0.02, 0.22);
    },
    crates(F) {
      FP(F, MAT.crate, -0.35, 0, 0, 0.7, 0.6, 0.6, true);
      FP(F, MAT.crate, 0.4, 0, 0, 0.6, 0.6, 0.6, true);
      FP(F, MAT.crate, -0.2, 0.6, 0, 0.55, 0.5, 0.5);
    },
  };
  const SIZE = { stove: [1.7, 1.9, 1.75], bed: [2.0, 0.95, 0.95], wardrobe: [1.1, 0.6, 1.95], chest: [1.0, 0.6, 0.5],
                 shelf: [1.2, 0.4, 1.8], table: [1.4, 1.45, 0.77], desk: [1.2, 1.1, 0.76], crates: [1.5, 0.7, 1.1] };
  const put = (R, kind) => {
    const [sx, sz, h] = SIZE[kind];
    const F = placeAgainst(R, sx, sz, h);
    if (F) FURN[kind](F);
    return F;
  };
  rooms.forEach((R, i) => {
    let list;
    if (!o.town) list = i === 0 ? ['stove', 'table', 'chest'] : ['bed', 'wardrobe', 'shelf'];
    else if (R.s === 0) list = ['table', 'shelf', 'wardrobe', r() < 0.4 ? 'crates' : 'chest'];
    else list = ['bed', 'wardrobe', r() < 0.5 ? 'desk' : 'table', 'chest'];
    if (partZ === null && !o.town) list = ['stove', 'table', 'bed', 'chest'];
    for (const k of list) put(R, k);
    // free spots on the floor (things lying about)
    for (let k = 0, n2 = 0; k < 20 && n2 < 3; k++) {
      const lx = R.q.x0 + 0.6 + r() * (R.q.x1 - R.q.x0 - 1.2), lz = R.q.z0 + 0.6 + r() * (R.q.z1 - R.q.z0 - 1.2);
      const pt = rect(lx - 0.3, lx + 0.3, lz - 0.3, lz + 0.3);
      if (reserved.some(([s, z]) => s === R.s && overlap(pt, z)) || placed.some(([s, z]) => s === R.s && overlap(pt, z, 0.1))) continue;
      rec.spots.push({ lx, lz, y: flY(R.s) });
      n2++;
    }
  });
  K.collect = outside;

  // chimney of a town house (village houses have the stove's)
  if (o.town && !o.flat && r() < 0.6) {
    const lx = d * 0.2;
    P(MAT.darkConcrete, lx, fy + H, w * 0.25, 0.6, rh * (1 - lx / ((d + 0.8) / 2)) + 0.8, 0.6);
  }

  // ---- obstacle, surfaces
  rec.obstacle = world.addObstacle({ x: f.x, z: f.z, hx: d / 2 + 0.4, hz: w / 2 + 0.3, rot: f.rot, y0: y, y1: fy + H + rh,
                                     house: rec, sub: rec.sub });
  K.obstacles.push(rec.obstacle);
  rec.meshes = outside;
  rec.inner = inside;
  K.collect = null;

  // highest surface at local offset (dx, dz) from the centre (world axes) not above lim; -Infinity if none
  rec.floorAt = (dx, dz, lim) => {
    const lx = dx * cosR - dz * sinR, lz = dx * sinR + dz * cosR;
    let best = -Infinity;
    for (const q of rec.floors) {
      if (lx < q.x0 || lx > q.x1 || lz < q.z0 || lz > q.z1) continue;
      let h = q.y;
      if (q.ramp) h = q.ya + (q.yb - q.ya) * Math.max(0, Math.min(1, (lz - q.za) / (q.zb - q.za)));
      if (h <= lim && h > best) best = h;
    }
    return best;
  };
  // world position of a free floor spot
  rec.spotWorld = sp => ({ ...K.at(f, sp.lx, sp.lz), y: sp.y });

  rec.hit = (point, dir, dmg, remote = false) => {
    if (!remote && world.onHouse) world.onHouse('hit', rec, point, dmg);
    hitHouse(K, rec, point, dmg);
  };
  rec.ram = speed => {
    if (rec.ruined || speed < (rec.story > 1 ? 4 : 2.5)) return false;
    if (world.onHouse) world.onHouse('ruin', rec);
    ruinHouse(K, rec);
    return true;
  };
  rec.ruin = (instant = false) => ruinHouse(K, rec, instant);
  K.houses.push(rec);
  world.houses.add(rec);
  return rec;
}

// shell hit: a hole in the wall, the house collapses when its hp runs out
function hitHouse(K, rec, p, dmg) {
  if (rec.ruined) return;
  rec.hp -= 45 * dmg;
  if (rec.hp <= 0) { ruinHouse(K, rec); return; }
  const o = rec.obstacle;
  if (p.y > rec.fy + rec.H + 0.2) return;           // hit the roof
  const dx = p.x - o.x, dz = p.z - o.z;
  let lx = dx * o.cos - dz * o.sin, lz = dx * o.sin + dz * o.cos;
  const hx = rec.d / 2, hz = rec.w / 2;
  if (Math.abs(lx) < hx - 0.7 && Math.abs(lz) < hz - 0.7) return;   // furniture / floor inside
  const s = 0.7 + Math.random() * 0.6;
  let sx = s, sz = s;
  if (Math.abs(lx) / hx > Math.abs(lz) / hz) { lx = Math.sign(lx) * hx; sx = 0.14; }
  else { lz = Math.sign(lz) * hz; sz = 0.14; }
  const x = o.x + lx * o.cos + lz * o.sin, z = o.z - lx * o.sin + lz * o.cos;
  const y = Math.max(rec.y + 0.4, p.y - s / 2);
  K.collect = rec.meshes;
  K.part(box, MAT.hole, x, y, z, sx, s, sz, o.rot, false);
  K.collect = null;
}

// collapse: the house is replaced by a heap of rubble with wall stumps and charred beams
function ruinHouse(K, rec, instant = false) {
  if (rec.ruined) return;
  const { world } = K;
  rec.ruined = true;
  world.ruins.add(rec.id);
  world.houses.delete(rec);
  for (const m of rec.meshes) m.removeFromParent();
  for (const m of rec.inner) m.removeFromParent();
  world.removeObstacle(rec.obstacle);
  const rr = rng((K.plan.seed ^ Math.imul(rec.n + 1, 2654435761)) >>> 0);
  const { f, y, w, d, H, wall } = rec;
  const g = world.heightAt(f.x, f.z);
  const part = (geo, mat, lx, py, lz, sx, sy, sz, rot) => {
    const p = K.at(f, lx, lz);
    return K.part(geo, mat, p.x, py, p.z, sx, sy, sz, rot);
  };
  part(box, MAT.rubble, 0, y, 0, d * 0.8, Math.max(0.6, g - y + 0.5 + H * 0.12), w * 0.8, f.rot + (rr() - 0.5) * 0.1);
  // stumps of the walls along the perimeter
  for (const [ax, az, len, alongZ] of [[-d / 2, 0, w, true], [d / 2, 0, w, true], [0, -w / 2, d, false], [0, w / 2, d, false]]) {
    const nSeg = 1 + Math.floor(rr() * 2);
    for (let i = 0; i < nSeg; i++) {
      if (rr() < 0.25) continue;
      const sl = len * (0.2 + rr() * 0.3);
      const c = (rr() - 0.5) * (len - sl);
      const h = 0.5 + rr() * Math.min(2.2, H * 0.55);
      part(box, rr() < 0.3 ? MAT.charred : wall, alongZ ? ax : c, y, alongZ ? c : az, alongZ ? 0.3 : sl, h + 0.3, alongZ ? sl : 0.3, f.rot);
    }
  }
  // broken beams and a slab of the roof lying on the heap
  for (let i = 0; i < 3; i++) {
    const m = part(box, rr() < 0.5 ? MAT.charred : MAT.wood, (rr() - 0.5) * d * 0.7, g + 0.4 + rr() * 0.5, (rr() - 0.5) * w * 0.7,
      0.22, 0.22, 2.5 + rr() * 2.5, f.rot + (rr() - 0.5) * 1.5);
    m.rotation.x = (rr() - 0.5) * 0.7;
  }
  const slab = part(box, MAT.roofs[rec.n % MAT.roofs.length], (rr() - 0.5) * d * 0.3, g + 0.6, (rr() - 0.5) * w * 0.3,
    d * 0.55, 0.15, w * 0.45, f.rot + (rr() - 0.5) * 0.4);
  slab.rotation.z = (rr() - 0.5) * 0.6;
  if (!instant && world.onHouseRuined) world.onHouseRuined(f.x, g + 1, f.z, Math.max(w, d));
}
