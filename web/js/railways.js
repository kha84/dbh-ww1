// Railways: lines that cross the road at a level crossing, and lines that come in from far away, run beside the road
// for a while (through a station in a village / town) and go away again. The track lies on its own formation (an
// embankment / a cutting graded into the terrain: world.height -> flatten), crosses rivers on rail bridges and goes
// through the hills in tunnels; it ends far from the road in buffer stops. The trains (trains.js) run along the lines.
//
// The world is cut into rail blocks of RAIL_BLOCK settlement stretches; a block has at most one line, kept inside its
// own z range (crossing lines are nearly straight across the road, parallel ones stay within the block), so the lines
// of different blocks never meet. A line is a polyline of points STEP metres apart (x, z, the formation height y),
// with a grid of its segments for the distance queries of the terrain.
import { rng, hash, smoothstep } from './noise.js';
import { carve } from './rivers.js';
import { buildTrackTile, buildBufferStop } from './structures/track.js';
import { buildCrossing } from './structures/crossing.js';
import { buildRailBridge } from './structures/railbridge.js';
import { buildPortal } from './structures/tunnel.js';

export const RAIL_TOP = 0.55;              // rail heads above the formation (line.y): where the wheels run
export const GAUGE_X = 0.76;               // half the gauge (rail centre lines)
export const STEP = 5;                     // m between the points of a line
const SETTLE_LEN = 850, SETTLE_OFS = 380;
const BLOCK_N = 3, BLOCK_LEN = BLOCK_N * SETTLE_LEN, BLOCK_OFS = 200;
const CELL = 32, INF = 40;                 // segment grid cell / reach of the embankment into the terrain
const TILE = 30;                           // points per track tile (~150 m)
const TILE_R = 700, TILE_DROP = 950;       // track tiles are built this close, dropped this far
const SITE_R = 900, SITE_DROP = 1200;      // crossings / bridges / portals / buffer stops
const EXT = 1000;                          // a crossing line reaches this far to either side of the road
const ARC_R = 420, ARC_A = 1.1, FAR = 540; // a parallel line turns away from the road (arc radius, angle) up to FAR m off it
const GRADE = 0.03 * STEP;                 // steepest grade between two points
const TUNNEL_D = 11;                       // a cutting deeper than this is a tunnel

// how far from the road a parallel line keeps when passing a settlement of each type
const CLEAR = { gas: 70, repair: 82, village: 50, town: 84, airfield: 185 };

const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

export class Railways {
  constructor(world) {
    this.world = world;
    this.plans = new Map();        // block -> line | null
    this.tiles = new Map();        // 'line:tile' -> built track tile
    this.sites = new Map();        // 'line:kind:n' -> built structure (crossing, portal, buffer stop)
    this.lastPos = null;
    this._nb = NaN; this._nl = [];
    this._q = { d: 0, i: 0, t: 0, y: 0 };
    this.onBuilt = null;           // (line, site) a level crossing was built (trains.js lowers its barriers)
  }

  blockOf(z) { return Math.floor((z + BLOCK_OFS) / BLOCK_LEN); }
  line(b) {
    if (!this.plans.has(b)) this.plans.set(b, this.plan(b));
    return this.plans.get(b);
  }
  // lines of the blocks around z (cached per block: the terrain asks for every height sample)
  near(z) {
    const b = this.blockOf(z);
    if (b !== this._nb) {
      this._nb = b;
      this._nl = [this.line(b - 1), this.line(b), this.line(b + 1)].filter(Boolean);
    }
    return this._nl;
  }
  // every planned line around a point (for the trains, the minimap)
  linesAround(z, blocks = 1) {
    const b = this.blockOf(z), res = [];
    for (let k = b - blocks; k <= b + blocks; k++) { const l = this.line(k); if (l) res.push(l); }
    return res;
  }
  byId(id) { return this.line(id); }

  // ------------------------------------------------------------------ planning
  plan(b) {
    const W = this.world;
    if (b < 0 || !W.opts.rails || W.opts.arena) return null;
    const r = rng(Math.floor(hash(W.seed, b, 6151) * 4294967296));
    const Z0 = b * BLOCK_LEN - BLOCK_OFS, Z1 = Z0 + BLOCK_LEN;
    const roll = r();
    let kind = b === 0 ? 'cross' : roll < 0.38 ? null : roll < 0.66 ? 'cross' : 'parallel';
    if (b > 0 && r() < 0.5 && this.hosts(Z0, Z1).length) kind = 'parallel';      // a station in a village / town of the block
    if (!kind) return null;
    /** @type {any} */
    let raw = kind === 'parallel' ? this.planParallel(b, r, Z0, Z1) : null;
    if (!raw) { kind = 'cross'; raw = this.planCross(b, r, Z0, Z1); }
    if (!raw) return null;
    return this.finish(b, kind, raw);
  }

  settlementsIn(z0, z1) {
    const W = this.world, res = [];
    for (let k = Math.floor((z0 - SETTLE_OFS) / SETTLE_LEN) - 1; k <= Math.floor((z1 - SETTLE_OFS) / SETTLE_LEN) + 1; k++) {
      const s = W.settlementPlan(k);
      if (s && s.z + s.halfLen > z0 && s.z - s.halfLen < z1) res.push(s);
    }
    return res;
  }
  riversIn(z0, z1) {
    const W = this.world, res = [];
    for (let k = Math.floor((z0 - SETTLE_OFS) / SETTLE_LEN) - 2; k <= Math.floor((z1 - SETTLE_OFS) / SETTLE_LEN) + 1; k++) {
      const p = W.riverPlan(k);
      if (p && p.zmax > z0 && p.zmin < z1) res.push(p);
    }
    return res;
  }

  // villages / towns of the block a parallel line can run through (room for its ramps on both sides)
  hosts(Z0, Z1) {
    const eArc = ARC_R * Math.sin(ARC_A), fArc = ARC_R * (1 - Math.cos(ARC_A)), tanA = Math.tan(ARC_A);
    return this.settlementsIn(Z0, Z1).filter(s => {
      if (s.type !== 'village' && s.type !== 'town') return false;
      const ramp = eArc + (FAR - (s.type === 'town' ? 84 : 50) - fArc) / tanA;
      return s.z - s.halfLen - 100 - ramp > Z0 + 30 && s.z + s.halfLen + 100 + ramp < Z1 - 30;
    });
  }

  // a line across the road: z = zc + skew + meanders as a function of x, the level crossing at (roadX(zc), zc)
  planCross(b, r, Z0, Z1) {
    const W = this.world;
    const sets = this.settlementsIn(Z0 - 400, Z1 + 400), rivers = this.riversIn(Z0 - 400, Z1 + 400);
    let zc = null;
    for (let i = 0; i < 40 && zc === null; i++) {
      const z = Z0 + 320 + r() * (BLOCK_LEN - 640);
      if (z < 220) continue;                                                  // the start of the road stays clear
      if (sets.some(s => Math.abs(z - s.z) < s.halfLen + 110)) continue;
      if (rivers.some(p => z > p.zmin - 60 && z < p.zmax + 60)) continue;
      zc = z;
    }
    if (zc === null) return null;
    const x0 = W.roadX(zc);
    const kx = (r() - 0.5) * 0.36, A = 4 + r() * 22, f = 1 / (180 + r() * 260), ph = r() * 6.283, A2 = r() * 6, f2 = 1 / (60 + r() * 50);
    const pts = [];
    for (let x = x0 - EXT; x <= x0 + EXT + 1e-6; x += 2) {
      const u = x - x0;
      pts.push(x, zc + kx * u + A * (Math.sin(u * f + ph) - Math.sin(ph)) + A2 * Math.sin(u * f2));
    }
    return { pts, zc, x0 };
  }

  // a line coming in from far away to run beside the road (offset T on one side) and going away again
  planParallel(b, r, Z0, Z1) {
    const W = this.world;
    const side = r() < 0.5 ? -1 : 1;
    const eArc = ARC_R * Math.sin(ARC_A), fArc = ARC_R * (1 - Math.cos(ARC_A)), tanA = Math.tan(ARC_A);
    const rampFor = T => eArc + (FAR - T - fArc) / tanA;
    const hosts = this.hosts(Z0, Z1);
    const host = hosts.length && r() < 0.85 ? hosts[Math.floor(r() * hosts.length)] : null;
    const T = host ? (host.type === 'town' ? 84 : 50) : 46 + r() * 14;
    const RAMP = rampFor(T);
    let zA, zB;
    if (host) {
      zA = host.z - host.halfLen - 100 - r() * 260;
      zB = host.z + host.halfLen + 100 + r() * 260;
    } else {
      const c = Z0 + RAMP + 250 + r() * Math.max(0, BLOCK_LEN - 2 * RAMP - 500), h = 250 + r() * 400;
      zA = c - h; zB = c + h;
    }
    zA = Math.max(zA, Z0 + RAMP + 30);
    zB = Math.min(zB, Z1 - RAMP - 30);
    if (zB - zA < 400) return null;
    if (host && (zA > host.z - host.halfLen - 60 || zB < host.z + host.halfLen + 60)) return null;
    const others = this.settlementsIn(zA - RAMP - 400, zB + RAMP + 400).filter(s => s !== host);
    const smax = (a, c) => (a + c + Math.sqrt((a - c) * (a - c) + 400)) / 2;
    const off = z => {
      const e = z < zA ? zA - z : z > zB ? z - zB : 0;
      let o = T + (e <= eArc ? ARC_R - Math.sqrt(ARC_R * ARC_R - e * e) : fArc + (e - eArc) * tanA);
      for (const s of others) {                      // keep clear of the other settlements beside the road
        const C = CLEAR[s.type] || 60, a = s.z - s.halfLen - 40, bb = s.z + s.halfLen + 40;
        const k = z < a ? 1 - smoothstep(a - 380, a, z) : z > bb ? smoothstep(bb, bb + 380, z) : 0;
        if (k < 1) o = smax(o, C * (1 - k));
      }
      return o;
    };
    const pts = [], offs = [];
    for (let z = zA - RAMP; z <= zB + RAMP + 1e-6; z += 2) {
      const o = off(z);
      pts.push(W.roadX(z) + side * o, z);
      offs.push(o);
    }
    return { pts, offs, side, T, host, zA, zB };
  }

  // resample at STEP, grade the formation, find the crossing, the station, rail bridges and tunnels, the query grid
  finish(b, kind, raw) {
    const W = this.world, WL = W.WATER_LEVEL;
    const P = raw.pts, nr = P.length / 2;
    const cum = new Float64Array(nr);
    for (let i = 1; i < nr; i++) cum[i] = cum[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
    const len0 = cum[nr - 1];
    const n = Math.floor(len0 / STEP) + 1;
    const x = new Float64Array(n), z = new Float64Array(n), y = new Float64Array(n), off = new Float64Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = i * STEP;
      while (j < nr - 2 && cum[j + 1] < s) j++;
      const t = Math.min(1, (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]));
      x[i] = P[j * 2] + (P[j * 2 + 2] - P[j * 2]) * t;
      z[i] = P[j * 2 + 1] + (P[j * 2 + 3] - P[j * 2 + 1]) * t;
      off[i] = raw.offs ? raw.offs[j] + (raw.offs[j + 1] - raw.offs[j]) * t : Math.abs(x[i] - W.roadX(z[i]));
    }
    const L = { id: b, kind, n, x, z, y, len: (n - 1) * STEP, side: raw.side || 0, cross: null, station: null, bridges: [], portals: [],
                tun: new Uint8Array(n), bridge: new Uint8Array(n), minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, grid: new Map() };
    // the formation: the terrain along the line (rivers left out) smoothed, held at the road's level at the level
    // crossing / beside the road, then graded outwards from there
    const base = new Float64Array(n), pin = new Float64Array(n), pinW = new Float64Array(n);
    for (let i = 0; i < n; i++) base[i] = Math.max(W.baseHeight(x[i], z[i]), WL + 1.8);
    let anchor = 0;
    if (kind === 'cross') {
      let best = 1e9;
      for (let i = 0; i < n; i++) { const d = Math.abs(x[i] - raw.x0) + Math.abs(z[i] - raw.zc); if (d < best) { best = d; anchor = i; } }
      const h0 = W.roadH(raw.zc);
      for (let i = 0; i < n; i++) { pin[i] = h0; pinW[i] = 1 - smoothstep(40, 260, Math.abs(i - anchor) * STEP); }
      L.cross = { i: anchor, s: anchor * STEP, x: x[anchor], z: z[anchor], y: h0 };
    } else {
      let lo = -1, hi = -1;
      for (let i = 0; i < n; i++) {
        pin[i] = W.roadH(z[i]);
        pinW[i] = 1 - smoothstep(raw.T + 10, raw.T + 90, off[i]);
        if (off[i] < raw.T + 5) { if (lo < 0) lo = i; hi = i; }
      }
      anchor = lo >= 0 ? Math.round((lo + hi) / 2) : Math.floor(n / 2);
    }
    const sm = Float64Array.from(base), tmp = new Float64Array(n), R = 24;
    for (let pass = 0; pass < 2; pass++) {
      let acc = 0, cnt = 0;
      for (let i = -R; i < n + R; i++) {
        if (i + R < n && i + R >= 0) { acc += sm[i + R]; cnt++; }
        if (i - R - 1 >= 0 && i - R - 1 < n) { acc -= sm[i - R - 1]; cnt--; }
        if (i >= 0 && i < n) tmp[i] = acc / cnt;
      }
      sm.set(tmp);
    }
    for (let i = 0; i < n; i++) y[i] = sm[i] + (pin[i] - sm[i]) * pinW[i];
    for (let i = anchor + 1; i < n; i++) y[i] = Math.min(y[i - 1] + GRADE, Math.max(y[i - 1] - GRADE, y[i]));
    for (let i = anchor - 1; i >= 0; i--) y[i] = Math.min(y[i + 1] + GRADE, Math.max(y[i + 1] - GRADE, y[i]));
    for (let i = 0; i < n; i++) y[i] = Math.max(y[i], WL + 1.8);
    if (L.cross) L.cross.y = y[anchor];
    // the station beside the road in the host village / town
    if (raw.host) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < n; i++) { const d = Math.abs(z[i] - raw.host.z); if (d < bd && off[i] < raw.T + 3) { bd = d; bi = i; } }
      L.station = { k: raw.host.k, type: raw.host.type, name: raw.host.name, side: raw.side, off: raw.T, i: bi, s: bi * STEP, half: raw.host.type === 'town' ? 75 : 55 };
    }
    // tunnels: deep cuttings (runs shorter than 40 m are cut instead)
    for (let i = 0; i < n; i++) L.tun[i] = base[i] - y[i] > TUNNEL_D ? 1 : 0;
    runs(L.tun, (a, e) => { if (e - a < 8) L.tun.fill(0, a, e + 1); });
    runs(L.tun, (a, e) => { if (a > 0) L.portals.push({ i: a, dir: 1 }); if (e < n - 1) L.portals.push({ i: e, dir: -1 }); });
    // rail bridges: where a river channel cut into the formation would leave the rails in the air
    const rivers = this.riversIn(Math.min(...z) - 50, Math.max(...z) + 50);
    for (let i = 0; i < n; i++) {
      for (const p of rivers) {
        if (z[i] < p.zmin || z[i] > p.zmax) continue;
        if (carve(p, x[i], z[i], y[i], WL) < y[i] - 0.8) { L.bridge[i] = 1; break; }
      }
    }
    const wet = L.bridge.slice();                        // one point more on either bank
    for (let i = 0; i < n; i++) if (wet[i]) { L.bridge[i] = 1; if (i > 0) L.bridge[i - 1] = 1; if (i + 1 < n) L.bridge[i + 1] = 1; }
    runs(L.bridge, (a, e) => { L.bridges.push({ i0: a, i1: e, river: rivers.find(p => z[(a + e) >> 1] > p.zmin && z[(a + e) >> 1] < p.zmax) || null }); L.tun.fill(0, a, e + 1); });
    // query grid of the segments
    for (let i = 0; i < n - 1; i++) {
      const x0 = Math.min(x[i], x[i + 1]) - INF, x1 = Math.max(x[i], x[i + 1]) + INF;
      const z0 = Math.min(z[i], z[i + 1]) - INF, z1 = Math.max(z[i], z[i + 1]) + INF;
      L.minX = Math.min(L.minX, x0); L.maxX = Math.max(L.maxX, x1); L.minZ = Math.min(L.minZ, z0); L.maxZ = Math.max(L.maxZ, z1);
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
        for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
          const k = ckey(cx, cz);
          let a = L.grid.get(k);
          if (!a) L.grid.set(k, a = []);
          a.push(i);
        }
      }
    }
    L.name = LINE_NAMES[Math.floor(hash(W.seed, b, 31) * LINE_NAMES.length)];
    return L;
  }

  // ------------------------------------------------------------------ queries
  // nearest point of line L to (x, z) within INF: { d, i (segment), t, y } (a shared object) or null
  nearestOn(L, x, z) {
    const a = L.grid.get(ckey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!a) return null;
    let bd = 1e18, bi = -1, bt = 0;
    for (const i of a) {
      const ax = L.x[i], az = L.z[i], dx = L.x[i + 1] - ax, dz = L.z[i + 1] - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      const ex = ax + dx * t - x, ez = az + dz * t - z, d2 = ex * ex + ez * ez;
      if (d2 < bd) { bd = d2; bi = i; bt = t; }
    }
    if (bi < 0) return null;
    const q = this._q;
    q.d = Math.sqrt(bd); q.i = bi; q.t = bt; q.y = L.y[bi] + (L.y[bi + 1] - L.y[bi]) * bt;
    return q;
  }
  // nearest line point to (x, z) over all the lines around: { line, d, s, y } or null
  nearest(x, z, maxD = INF) {
    let best = null;
    for (const L of this.near(z)) {
      if (x < L.minX || x > L.maxX || z < L.minZ || z > L.maxZ) continue;
      const q = this.nearestOn(L, x, z);
      if (q && q.d < maxD && (!best || q.d < best.d)) best = { line: L, d: q.d, s: (q.i + q.t) * STEP, y: q.y, i: q.i };
    }
    return best;
  }
  // terrain height h at (x, z) graded to the formation of the lines close by (not in the tunnels)
  flatten(x, z, h) {
    const ls = this.near(z);
    for (let k = 0; k < ls.length; k++) {
      const L = ls[k];
      if (x < L.minX || x > L.maxX || z < L.minZ || z > L.maxZ) continue;
      const q = this.nearestOn(L, x, z);
      if (!q || q.d >= INF) continue;
      if (L.tun[q.i] && L.tun[q.i + 1]) continue;
      const R = Math.min(INF, 5.5 + 1.6 * Math.abs(h - q.y));
      const w = 1 - smoothstep(3.6, R, q.d);
      if (w > 0) h += (q.y - h) * w;
    }
    return h;
  }
  // is (x, z) within r of a track (trees, grass keep off it)
  nearTrack(x, z, r) {
    const ls = this.near(z);
    for (let k = 0; k < ls.length; k++) {
      const L = ls[k];
      if (x < L.minX || x > L.maxX || z < L.minZ || z > L.maxZ) continue;
      const q = this.nearestOn(L, x, z);
      if (q && q.d < r && !(L.tun[q.i] && L.tun[q.i + 1])) return true;
    }
    return false;
  }
  // point of line L at distance s along it: out { x, y (rail top), z, hd (heading of increasing s) }
  at(L, s, out) {
    const sc = Math.max(0, Math.min(L.len - 1e-6, s));
    const i = Math.min(L.n - 2, Math.floor(sc / STEP)), t = sc / STEP - i;
    const dx = L.x[i + 1] - L.x[i], dz = L.z[i + 1] - L.z[i];
    out.x = L.x[i] + dx * t;
    out.z = L.z[i] + dz * t;
    out.y = L.y[i] + (L.y[i + 1] - L.y[i]) * t + RAIL_TOP;
    out.hd = Math.atan2(dx, dz);
    return out;
  }
  // the station of settlement k (a parallel line through it) or null
  stationAt(k) {
    const W = this.world;
    const s = W.settlementPlan(k);
    if (!s) return null;
    for (const L of this.linesAround(s.z)) if (L.station && L.station.k === k) return { ...L.station, line: L };
    return null;
  }

  // ------------------------------------------------------------------ streaming
  // track tiles, crossings, rail bridges, tunnel portals and buffer stops around pos
  update(pos) {
    if (this.lastPos && Math.hypot(pos.x - this.lastPos.x, pos.z - this.lastPos.z) < 12) return;
    this.lastPos = { x: pos.x, z: pos.z };
    const W = this.world;
    const lines = this.linesAround(pos.z);
    const live = new Set(lines.map(L => L.id));
    const dist = (L, i) => Math.hypot(L.x[i] - pos.x, L.z[i] - pos.z);
    for (const L of lines) {
      if (pos.x < L.minX - TILE_DROP || pos.x > L.maxX + TILE_DROP || pos.z < L.minZ - TILE_DROP || pos.z > L.maxZ + TILE_DROP) continue;
      const nt = Math.ceil((L.n - 1) / TILE);
      for (let t = 0; t < nt; t++) {
        const i0 = t * TILE, i1 = Math.min(L.n - 1, i0 + TILE), key = L.id + ':' + t;
        const d = Math.min(dist(L, i0), dist(L, i1), dist(L, (i0 + i1) >> 1));
        if (d < TILE_R && !this.tiles.has(key)) {
          const m = buildTrackTile(W, L, i0, i1);
          if (m) { W.scene.add(m); this.tiles.set(key, m); }
          else this.tiles.set(key, null);
        }
      }
      // structures
      const want = [];
      if (L.cross) want.push(['x', 0, L.cross.i, () => buildCrossing(W, L)]);
      L.portals.forEach((p, n) => want.push(['p', n, p.i, () => buildPortal(W, L, p)]));
      want.push(['e', 0, 0, () => buildBufferStop(W, L, 0)], ['e', 1, L.n - 1, () => buildBufferStop(W, L, 1)]);
      for (const [kind, n, i, build] of want) {
        const key = `${L.id}:${kind}:${n}`;
        if (!this.sites.has(key) && dist(L, i) < SITE_R) {
          const site = build();
          this.sites.set(key, site);
          if (kind === 'x' && this.onBuilt) this.onBuilt(L, site);
        }
      }
      L.bridges.forEach((br, n) => {
        const key = `rb${L.id}:${n}`;
        if (!W.bridges.has(key) && dist(L, (br.i0 + br.i1) >> 1) < SITE_R) W.bridges.set(key, buildRailBridge(W, L, br));
      });
    }
    for (const [key, m] of this.tiles) {
      const [id, t] = key.split(':').map(Number);
      const L = this.plans.get(id);
      const i0 = t * TILE, i1 = L ? Math.min(L.n - 1, i0 + TILE) : 0;
      if (!live.has(id) || !L || Math.min(dist(L, i0), dist(L, i1), dist(L, (i0 + i1) >> 1)) > TILE_DROP) {
        if (m) { W.scene.remove(m); m.geometry.dispose(); }
        this.tiles.delete(key);
      }
    }
    for (const [key, site] of this.sites) {
      const id = Number(key.split(':')[0]);
      const L = this.plans.get(id);
      if (!live.has(id) || !L || Math.hypot(site.x - pos.x, site.z - pos.z) > SITE_DROP) {
        site.dispose();
        this.sites.delete(key);
      }
    }
    for (const [key, br] of W.bridges) {
      if (typeof key !== 'string' || !key.startsWith('rb')) continue;
      if (Math.hypot(br.cx - pos.x, br.cz - pos.z) > SITE_DROP) { br.dispose(); W.bridges.delete(key); }
    }
  }
  // the level crossings built now (trains.js works their barriers)
  crossings() { const res = []; for (const [k, s] of this.sites) if (k.includes(':x:')) res.push(s); return res; }
}

// runs of non-zero values of arr: fn(first, last)
function runs(arr, fn) {
  let a = -1;
  for (let i = 0; i <= arr.length; i++) {
    const on = i < arr.length && arr[i];
    if (on && a < 0) a = i;
    else if (!on && a >= 0) { fn(a, i - 1); a = -1; }
  }
}

const LINE_NAMES = ['Брестская ж/д', 'Юго-Западная ж/д', 'Либаво-Роменская ж/д', 'Полесская ж/д', 'Московско-Курская ж/д',
  'Рязано-Уральская ж/д', 'Сызрано-Вяземская ж/д', 'Северо-Донецкая ж/д', 'Привислинская ж/д', 'Риго-Орловская ж/д'];
