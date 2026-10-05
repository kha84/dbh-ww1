// Trains on the railway lines (railways.js): a locomotive (+ tender / second section) and cars from traindefs/,
// running along a line: traction / brakes / grades, the cars following the curves on their two pivots (bogies /
// axles), wheels and coupling rods turned in the vertex shader, steam / exhaust, sounds.
//
// The enemy's trains carry their crew in the cab and soldiers in the cars: real infantry (infantry.js) riding in
// their places (Soldier.ride) - they see and shoot from the windows / doors; when the train stops (the crew killed,
// the track blocked, a station) and they are alarmed they get off and fight. A train whose crew is dead can be
// taken over: the player drives it from the cab (game/railway.js). Shells hit the cars (the obstacle boxes moving
// with them), a destroyed engine stops the train, a burning tank car explodes. Trains push tanks / men off the track
// and smash them; the barriers of the level crossings come down before a train.
//
// TrainDirector part (Trains): one enemy train at a time on each line near the player, spawned out of sight and
// heading towards him, made up by the difficulty (era) of the place; gone when far away.
import * as THREE from 'three';
import { attribute, uniform, positionLocal, vec3, cos, sin, step, mix, vertexColor } from 'three/tsl';
import { STATIC_MAT } from './bakestatic.js';
import { LOCOS, CARS, vehicleModel, composeTrain } from './traindefs/index.js';
import { difficultyAt, soldierKit } from './loot.js';
import { STEP } from './railways.js';

const BRAKE = 1.1;                  // m/s^2 of full braking
const SPAWN_D = 1000;               // the enemy train starts this far along the line from the player
const DROP_D = 1500, DROP_PLAYER = 3200;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _p = { x: 0, y: 0, z: 0, hd: 0 }, _q = { x: 0, y: 0, z: 0, hd: 0 };

// node material of the turning parts: wheels turn about their centres (spinC.xyz, 1/radius in spinC.w), coupling rods
// (crank: their pin offset) circle with them; u = the distance run
function spinMaterial(u) {
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true });
  const rm = attribute('rm', 'vec2');
  m.roughnessNode = rm.x;
  m.metalnessNode = rm.y;
  const c = attribute('spinC', 'vec4'), k = attribute('crank', 'vec2');
  const th = u.mul(c.w), cs = cos(th), sn = sin(th);
  const p = positionLocal.sub(c.xyz);
  const rot = vec3(p.x, p.y.mul(cs).sub(p.z.mul(sn)), p.y.mul(sn).add(p.z.mul(cs))).add(c.xyz);
  const off = vec3(0, k.x.mul(cs).sub(k.y.mul(sn)).sub(k.x), k.x.mul(sn).add(k.y.mul(cs)).sub(k.y));
  m.positionNode = mix(rot, positionLocal.add(off), step(0.0001, k.x.abs().add(k.y.abs())));
  return m;
}
// burnt-out vehicles: the same vertex colours, charred
const BURNT = new THREE.MeshStandardNodeMaterial({ vertexColors: true });
BURNT.colorNode = vertexColor().mul(0.18);
BURNT.roughnessNode = attribute('rm', 'vec2').x.add(0.3).min(1);

// shader warm-up (game/warmup.js): the models baked now, a running gear and a burnt body to build their pipelines
export function warmTrains() {
  const g = new THREE.Group();
  for (const d of [...Object.values(LOCOS), ...Object.values(CARS)]) {
    vehicleModel(d);
    if (d.tender) vehicleModel(d, 'tender');
  }
  const m = vehicleModel(LOCOS.su);
  const sp = new THREE.Mesh(m.spin, spinMaterial(uniform(0)));
  const b = new THREE.Mesh(m.body, BURNT);
  b.position.x = 4;
  g.add(sp, b);
  return g;
}

let TRAIN_ID = 0;

export class Train {
  /**
   * @param {Trains} sys
   * @param {any} line  railways.js line
   * @param {{ comp: any[], passenger: boolean, military: boolean }} made  composeTrain()
   * @param {{ s: number, dir: number, speed?: number, team?: string, id?: number, puppet?: boolean }} o
   */
  constructor(sys, line, made, o) {
    this.sys = sys;
    this.id = o.id ?? ++TRAIN_ID;
    this.line = line;
    this.s = o.s;                     // the front of the train along the line
    this.dir = o.dir;                 // +1: the train faces increasing s
    this.speed = o.speed || 0;        // m/s along its facing (negative: backing)
    this.team = o.team || 'enemy';
    this.puppet = !!o.puppet;         // network guest: a copy of the host's train
    this.passenger = made.passenger;
    this.military = made.military;
    this.ctl = { throttle: 0, brake: 0 };
    this.player = false;              // the player drives it
    this.dist = 0;
    this.u = uniform(0); this.uNeg = uniform(0);
    this.group = new THREE.Group();
    this.riders = [];                 // [{ s: Soldier, v: vehicle, slot }]
    this.ai = { served: false, dwell: 0, blockedT: 0, alarm: 0, whistleT: 0 };
    this.wrecked = false;
    this.velocity = new THREE.Vector3();
    this.lastBump = 0;
    /** @type {number | undefined} network guest: where the host's train is */
    this.netS = undefined;
    this.removed = false;
    this.chuffT = 0; this.clackS = 0;
    let off = 0;
    const mats = { main: spinMaterial(this.u), neg: null };
    this.vehicles = made.comp.map((c, i) => {
      const def = c.def, tender = c.part === 'tender';
      const len = tender ? def.tender.len : def.len, mass = tender ? def.tender.mass : def.mass;
      const piv = tender ? def.tender.pivots : def.pivots;
      const model = vehicleModel(def, c.part, c.variant);
      const root = new THREE.Group();
      root.rotation.order = 'YXZ';
      const body = new THREE.Mesh(model.body, STATIC_MAT);
      body.castShadow = true; body.receiveShadow = true;
      root.add(body);
      let spinM = null;
      if (model.spin) {
        if (c.flip && !mats.neg) mats.neg = spinMaterial(this.uNeg);
        spinM = new THREE.Mesh(model.spin, c.flip ? mats.neg : mats.main);
        spinM.castShadow = true;
        root.add(spinM);
      }
      this.group.add(root);
      const bb = model.body.boundingBox;
      const v = {
        train: this, i, def, part: c.part, variant: c.variant, flip: !!c.flip, len, mass, piv, off, root, body, spinM,
        loco: def.kind === 'loco' && !tender, tender, hp: 100, alive: true, burn: 0,
        h: bb.max.y, hw: Math.max(1.3, Math.min(1.65, (bb.max.x - bb.min.x) / 2)),
        ob: null,
      };
      off += len + 0.15;
      return v;
    });
    this.len = off;
    this.loco = this.vehicles[0];
    this.def = this.loco.def;
    this.mass = this.vehicles.reduce((a, v) => a + v.mass, 0);
    this.power = this.def.power * (this.def.twin ? 2 : 1);
    this.vmax = this.def.vmax;
    sys.scene.add(this.group);
    // the cars are obstacles (they move with the train): walkers / tanks are pushed out, shells hit them
    for (const v of this.vehicles) {
      v.ob = sys.world.addObstacle({ x: 0, z: 0, hx: v.hw, hz: v.len / 2, rot: 0, y0: 0, y1: 1, train: v,
        hit: (point, dir, s) => this.shellHit(v, point, s) });
    }
    this.place();
  }

  get crewAlive() { return this.riders.some(r => r.crew && r.s.alive && r.s.ride); }
  get moving() { return Math.abs(this.speed) > 0.5; }
  // where the train is (the engine)
  get pos() { return this.loco.root.position; }

  // ------------------------------------------------ placing along the line
  lineS(v, z) { return this.s - this.dir * (v.off + v.len / 2) + this.dir * (v.flip ? -z : z); }
  place() {
    const R = this.sys.world.rail, L = this.line;
    for (const v of this.vehicles) {
      const A = R.at(L, this.lineS(v, v.piv[0]), _p), B = R.at(L, this.lineS(v, v.piv[1]), _q);
      let fx = A.x - B.x, fy = A.y - B.y, fz = A.z - B.z;
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl; fy /= fl; fz /= fl;
      const t = -v.piv[1] / (v.piv[0] - v.piv[1]);
      const x = B.x + (A.x - B.x) * t, y = B.y + (A.y - B.y) * t, z = B.z + (A.z - B.z) * t;
      let hd = Math.atan2(fx, fz);
      if (v.flip) hd += Math.PI;
      const pitch = Math.asin(Math.max(-1, Math.min(1, fy))) * (v.flip ? -1 : 1);
      v.root.position.set(x, y, z);
      v.root.rotation.set(-pitch, hd, 0);
      v.heading = hd;
      const o = v.ob;
      if (o) {
        o.x = x; o.z = z; o.rot = hd; o.cos = Math.cos(hd); o.sin = Math.sin(hd);
        o.rad = Math.hypot(o.hx, o.hz);
        o.y0 = y - 0.5; o.y1 = y + v.h;
      }
    }
    this.group.updateMatrixWorld(true);
    const lv = this.loco;
    this.velocity.set(Math.sin(lv.heading), 0, Math.cos(lv.heading)).multiplyScalar(this.speed * (lv.flip ? -1 : 1));
  }
  // world position of a point given in the axes of vehicle v
  local(v, x, y, z, out = new THREE.Vector3()) {
    return out.set(v.flip ? -x : x, y, v.flip ? -z : z).applyMatrix4(v.root.matrixWorld);
  }

  // ------------------------------------------------ physics
  step(dt) {
    if (this.puppet) {                          // network guest: follow the host's train
      const s0 = this.s;
      if (this.netS !== undefined) {
        this.netS += this.dir * this.speed * dt;
        const e = this.netS - this.s;
        this.s += Math.abs(e) > 30 ? e : e * Math.min(1, dt * 6);
      }
      this.dist += (this.s - s0) * this.dir;
      this.u.value = this.dist; this.uNeg.value = -this.dist;
      this.place();
      return;
    }
    const c = this.ctl;
    if (!this.player && !this.puppet) this.think(dt);
    const v = this.speed, M = this.mass * 1000;
    const P = this.wrecked ? 0 : this.power * 1000 * (0.35 + 0.65 * this.loco.hp / 100);
    let F = 0;
    if (c.throttle !== 0 && P > 0) F = c.throttle * (1 - c.brake) * Math.min(P / Math.max(Math.abs(v), 2.5), 0.3 * this.loco.mass * 1000 * 9.81 * (this.def.twin ? 2 : 1));
    const R = this.sys.world.rail, L = this.line;
    const s0 = this.s - this.dir * this.len / 2;
    const grade = (R.at(L, s0 + 6, _p).y - R.at(L, s0 - 6, _q).y) / 12 * this.dir;
    let nv = v + (F / M - 9.81 * grade) * dt;
    const drag = (0.012 + 0.00011 * nv * nv + c.brake * BRAKE) * dt;
    if (Math.abs(nv) <= drag && Math.abs(F / M) < 0.02 + c.brake) nv = 0;
    else if (Math.abs(nv) > drag) nv -= Math.sign(nv) * drag;
    const vmax = nv >= 0 ? this.vmax : this.vmax * 0.5;
    this.speed = Math.max(-vmax, Math.min(vmax, nv));
    // the ends of the line (buffer stops)
    let s = this.s + this.dir * this.speed * dt;
    const lo = this.dir > 0 ? this.len : 0, hi = this.dir > 0 ? L.len : L.len - this.len;
    if (s < lo || s > hi) {
      if (Math.abs(this.speed) > 2.5) this.sys.event(this, 'buffer', Math.abs(this.speed));
      s = Math.max(lo, Math.min(hi, s));
      this.speed = 0;
    }
    this.dist += (s - this.s) * this.dir;
    this.s = s;
    this.u.value = this.dist;
    this.uNeg.value = -this.dist;
    this.place();
  }

  // ------------------------------------------------ the enemy's driver
  think(dt) {
    const c = this.ctl, ai = this.ai, R = this.sys.world.rail, L = this.line;
    if (this.wrecked || !this.crewAlive) { c.throttle = 0; c.brake = 1; return; }
    if (ai.alarm > 0) ai.alarm -= dt;
    let vT = this.vmax * (ai.alarm > 0 ? 1 : this.passenger ? 0.8 : 0.62);
    const v = this.speed;
    // a stop at the station (passenger trains, some goods trains), the middle of the train at the platform
    const st = L.station;
    if (st && !ai.served && (this.passenger || this.military || (this.id % 3 === 0)) && ai.alarm <= 0) {
      const stop = st.s + this.dir * this.len / 2;
      const d = (stop - this.s) * this.dir;
      if (d > -8) {
        vT = Math.min(vT, Math.sqrt(2 * 0.45 * Math.max(0, d - 1)));
        if (d < 4 && Math.abs(v) < 0.3) { ai.served = true; ai.dwell = 25 + Math.random() * 20; this.sys.event(this, 'station'); }
      } else ai.served = true;
    }
    if (ai.dwell > 0) { ai.dwell -= dt; vT = 0; if (ai.dwell <= 0) this.sys.event(this, 'depart'); }
    // something on the track ahead (a tank, a car, another train): brake hard
    const look = v * v / (2 * BRAKE * 0.8) + 40;
    let blocked = false;
    for (const t of this.sys.tanks) {
      const tp = t.root.position;
      const q = R.nearestOn(L, tp.x, tp.z);
      if (!q || q.d > 2.4) continue;
      const ds = ((q.i + q.t) * STEP - this.s) * this.dir;
      if (ds > 0 && ds < look) { vT = Math.min(vT, Math.sqrt(2 * BRAKE * 0.8 * Math.max(0, ds - 10))); blocked = true; }
    }
    for (const o of this.sys.list) {
      if (o === this || o.line !== L) continue;
      const ends = [o.s, o.s - o.dir * o.len];
      for (const e of ends) { const ds = (e - this.s) * this.dir; if (ds > 0 && ds < look) { vT = Math.min(vT, Math.sqrt(2 * BRAKE * 0.8 * Math.max(0, ds - 15))); blocked = true; } }
    }
    if (blocked && (ai.whistleT -= dt) <= 0) { ai.whistleT = 6; this.sys.event(this, 'whistle'); }
    ai.blockedT = blocked && Math.abs(v) < 0.3 ? ai.blockedT + dt : 0;
    if (ai.blockedT > 6) ai.alarm = Math.max(ai.alarm, 30);
    // the end of the line
    const dEnd = this.dir > 0 ? L.len - this.s : this.s;
    vT = Math.min(vT, Math.sqrt(2 * 0.6 * Math.max(0, dEnd - 20)));
    c.throttle = Math.max(0, Math.min(1, (vT - v) * 0.5 + (vT > 1 ? 0.05 : 0)));
    c.brake = Math.max(0, Math.min(1, (v - vT) * 0.6));
    if (vT < 0.3 && Math.abs(v) < 1) { c.throttle = 0; c.brake = 1; }
  }

  // ------------------------------------------------ riders
  // soldiers in their places; alarmed men get off a stopped train
  updateRiders(dt) {
    let alarmed = false;
    for (const r of this.riders) {
      const s = r.s;
      if (!s.ride) continue;
      const v = r.v, sl = r.slot;
      this.local(v, sl.pos[0], sl.pos[1], sl.pos[2], s.pos);
      s.guardDir = v.heading + (sl.ry || 0);
      if (!s.alive) continue;
      if (s.state === 'combat' || s.alertReq) alarmed = true;
      if (!v.alive) s.hit(500, null, null);
    }
    this.riders = this.riders.filter(r => r.s.ride && !r.s.gone);
    if (alarmed && !this.player) this.ai.alarm = Math.max(this.ai.alarm, 20);
    if (Math.abs(this.speed) < 0.6 && (alarmed || this.ai.alarm > 0 || !this.crewAlive)) this.dismount(!this.crewAlive || this.wrecked);
  }
  // the men get off on both sides (the crew too when the engine cannot go on)
  dismount(crewToo) {
    const W = this.sys.world;
    for (const r of this.riders) {
      const s = r.s;
      if (!s.ride || !s.alive || (r.crew && !crewToo)) continue;
      const v = r.v, sl = r.slot;
      const side = sl.pos[0] >= 0 ? 1 : -1;
      const p = this.local(v, side * (v.hw + 1.1), 0, sl.pos[2], _v);
      p.y = W.groundAt(p.x, p.z);
      if (p.y < W.WATER_LEVEL - 0.3) continue;
      s.ride = null;
      s.pos.copy(p);
      s.post.copy(p);
      s.alertReq = true;
      s.setStance('crouch');
    }
  }

  // ------------------------------------------------ damage
  // a shell into vehicle v (the obstacle box was hit)
  shellHit(v, point, s) {
    const dmg = (s.dmg || 0.5) * (s.bomb ? 3 : 1);
    this.damage(v, dmg * (v.loco ? 40 : 55), s.owner, point);
    if (v.loco) for (const r of this.riders) if (r.crew && r.s.alive && Math.random() < 0.22 + 0.2 * dmg) r.s.hit(500, s.owner, null);
  }
  damage(v, amount, owner, point = null) {
    if (!v.alive || this.puppet) return;
    v.hp -= amount;
    this.ai.alarm = Math.max(this.ai.alarm, 40);
    if (v.hp > 0) return;
    v.hp = 0;
    v.alive = false;
    v.burn = 60 + Math.random() * 60;
    v.body.material = BURNT;
    if (v.spinM) v.spinM.visible = false;
    for (const r of this.riders) if (r.v === v && r.s.alive) r.s.hit(500, owner, null);
    if (v.loco || (this.def.twin && v.def.kind === 'loco')) { this.wrecked = true; this.ctl.throttle = 0; }
    this.sys.event(this, v.def.flammable ? 'tankcar' : 'destroyed', v, owner);
  }

  dispose() {
    this.sys.scene.remove(this.group);
    for (const v of this.vehicles) if (v.ob) this.sys.world.removeObstacle(v.ob);
  }
}

// ===================================================================== director
export class Trains {
  constructor(scene, world, o) {
    this.scene = scene;
    this.world = world;
    this.fx = o.fx; this.sfx = o.sfx;
    this.list = [];
    this.lines = new Map();           // line id -> { next: time the next train may come }
    this.disabled = false;            // no enemy trains (other modes, network guest)
    this.tanks = [];
    this.time = 0;
    this.scanT = 0;
    /** @type {(pos: THREE.Vector3, kit: any) => any} */
    this.spawnRider = null;           // infantry.spawnRider (main.js)
    /** @type {(train: Train, kind: string, a?: any, b?: any) => void} */
    this.onEvent = () => {};
    this.listener = new THREE.Vector3();
    this.god = false;                 // ?god=1: the player's tank is not smashed
  }

  event(t, kind, a, b) {
    const d = t.pos.distanceTo(this.listener);
    if (kind === 'whistle') this.sfx.whistle(d, t.def.whistle);
    if (kind === 'destroyed' || kind === 'tankcar') {
      const p = a.root.position.clone().setY(a.root.position.y + 2);
      this.fx.explosion(p, kind === 'tankcar' ? 3 : 1.6, false);
      this.sfx.boom(d, kind === 'tankcar' ? 1.8 : 1.1);
    }
    this.onEvent(t, kind, a, b);
  }

  // ------------------------------------------------ spawning
  /**
   * a train on line L: front at s facing dir; o: { loco, passenger, crew (enemy crew + troops), team, speed, d }
   */
  spawn(L, s, dir, o = {}) {
    const r = o.r || Math.random;
    const d = o.d ?? difficultyAt(L.z[Math.max(0, Math.min(L.n - 1, Math.round(s / STEP)))]);
    const made = o.made || composeTrain(r, d, { loco: o.loco, passenger: o.passenger });
    const t = new Train(this, L, made, { s, dir, speed: o.speed || 0, team: o.team || (o.crew ? 'enemy' : 'neutral'), id: o.id, puppet: o.puppet });
    this.list.push(t);
    if (o.crew && this.spawnRider) this.man(t, r, d, o.troops ?? true);
    return t;
  }
  // the crew in the cab, soldiers in the cars
  man(t, r, d, troops) {
    for (const sl of t.def.crew || []) {
      const s = this.spawnRider(t.local(t.loco, sl.pos[0], sl.pos[1], sl.pos[2]), { ...soldierKit(r, d, true), kind: 'rail', heading: t.loco.heading });
      if (s) { s.ride = { train: t }; t.riders.push({ s, v: t.loco, slot: sl, crew: true }); }
    }
    if (!troops) return;
    let n = 0;
    const cap = t.military ? 16 : 10;
    for (const v of t.vehicles) {
      if (v.def.kind !== 'car') continue;
      const p = v.def.cls === 'passenger' ? 0.55 : v.def.troops ? 0.85 : 0.5;
      for (const sl of v.def.riders || []) {
        if (n >= cap || r() > p) continue;
        const s = this.spawnRider(t.local(v, sl.pos[0], sl.pos[1], sl.pos[2]), { ...soldierKit(r, d), heading: v.heading + (sl.ry || 0) });
        if (!s) continue;
        s.ride = { train: t };
        s.setStance(sl.stance || 'stand');
        s.rideStance = sl.stance || 'stand';
        t.riders.push({ s, v, slot: sl });
        n++;
      }
    }
  }
  remove(t) {
    t.dispose();
    for (const r of t.riders) if (r.s.ride) { r.s.ride = null; r.s.gone = true; r.s.dispose(); }
    const i = this.list.indexOf(t);
    if (i >= 0) this.list.splice(i, 1);
    t.removed = true;
    const st = this.lines.get(t.line.id);
    if (st && st.train === t) { st.train = null; st.next = this.time + 40 + Math.random() * 80; }
  }
  // the nearest point of line L to p (scanning its points): { i, d }
  nearestPoint(L, p) {
    let bi = 0, bd = 1e18;
    for (let i = 0; i < L.n; i += 3) { const d = (L.x[i] - p.x) ** 2 + (L.z[i] - p.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    return { i: bi, d: Math.sqrt(bd) };
  }
  // an enemy train on line L heading towards p from out of sight
  spawnTowards(L, p) {
    const n = this.nearestPoint(L, p);
    const sN = n.i * STEP;
    const r = Math.random;
    for (const dir of r() < 0.5 ? [1, -1] : [-1, 1]) {
      const back = SPAWN_D + r() * 300;
      const made = composeTrain(r, difficultyAt(L.cross ? L.cross.z : p.z));
      const len = made.comp.reduce((a, c) => a + (c.part === 'tender' ? c.def.tender.len : c.def.len) + 0.15, 0);
      // as far back along the line as it reaches (the lines end in buffer stops far from the road)
      const s = dir > 0 ? Math.max(len + 5, sN - back) : Math.min(L.len - len - 5, sN + back);
      if (s - len < 2 && dir > 0 || s + len > L.len - 2 && dir < 0 || (s - sN) * dir > 0) continue;
      const i = Math.round(s / STEP);
      if (Math.hypot(L.x[i] - p.x, L.z[i] - p.z) < 450) continue;
      const v0 = LOCOS[made.comp[0].def.key].vmax * (made.passenger ? 0.75 : 0.6);
      return this.spawn(L, s, dir, { made, crew: true, speed: v0 * 0.9, d: difficultyAt(p.z) });
    }
    return null;
  }

  // ------------------------------------------------ per frame
  /**
   * @param {number} dt
   * @param {{ anchors: THREE.Vector3[], tanks: any[], soldiers: any[], foot: { pos: THREE.Vector3, active: boolean } | null,
   *   hurtPlayer: (dmg: number, text: string) => void, noTrains?: boolean }} g
   */
  update(dt, g) {
    this.time += dt;
    this.tanks = g.tanks;
    const R = this.world.rail;
    if (!R) return;
    // enemy trains come along the lines near the player
    if (!this.disabled && !g.noTrains && (this.scanT -= dt) <= 0) {
      this.scanT = 1;
      const a = g.anchors[0];
      for (const L of R.linesAround(a.z)) {
        let st = this.lines.get(L.id);
        if (!st) this.lines.set(L.id, st = { train: null, next: this.time + 3 + Math.random() * 20 });
        if (st.train && !st.train.removed) continue;
        if (this.list.some(t => t.line === L)) continue;
        if (this.time < st.next) continue;
        if (g.anchors.every(p => this.nearestPoint(L, p).d > 900)) continue;
        st.train = this.spawnTowards(L, a);
        if (!st.train) st.next = this.time + 30;
      }
      for (const t of [...this.list]) {
        if (t.puppet) continue;
        const far = t.player ? DROP_PLAYER : t.team === 'player' ? DROP_PLAYER : DROP_D;
        if (g.anchors.every(p => this.distTo(t, p) > far)) this.remove(t);
      }
    }
    for (const t of this.list) {
      t.step(dt);
      if (!t.puppet) t.updateRiders(dt);
      this.effects(t, dt);
      if (Math.abs(t.speed) > 1.2) this.collide(t, g);
    }
    // the barriers of the level crossings
    for (const site of R.crossings()) {
      let close = false;
      for (const t of this.list) {
        if (t.line !== site.line) continue;
        const ahead = (site.s - t.s) * t.dir;
        if ((ahead > -t.len - 8 && ahead < 380 && Math.abs(t.speed) > 0.5) || (ahead > -t.len - 4 && ahead < 6)) close = true;
      }
      site.update(dt, close);
      if (close && (site.bellT = (site.bellT || 0) - dt) <= 0) {
        site.bellT = 0.55;
        const d = Math.hypot(site.x - this.listener.x, site.z - this.listener.z);
        if (d < 160) this.sfx.bell(d);
      }
    }
  }
  // distance from p to the nearest end / middle of train t
  distTo(t, p) {
    const a = t.vehicles[0].root.position, b = t.vehicles[t.vehicles.length - 1].root.position, m = t.vehicles[t.vehicles.length >> 1].root.position;
    return Math.min(Math.hypot(a.x - p.x, a.z - p.z), Math.hypot(b.x - p.x, b.z - p.z), Math.hypot(m.x - p.x, m.z - p.z));
  }

  // steam / exhaust, burning cars, sounds of the running train
  effects(t, dt) {
    const L = t.line, R = this.world.rail;
    const li = Math.min(L.n - 1, Math.max(0, Math.round(t.s / STEP)));
    const inTunnel = L.tun[li];
    const d = t.pos.distanceTo(this.listener);
    if (!t.wrecked && !inTunnel && t.def.smoke && d < 900) {
      const sm = t.def.smoke, p = t.local(t.loco, sm[0], sm[1], sm[2], _w);
      const load = Math.abs(t.ctl.throttle);
      if (t.def.type === 'steam') {
        const k = 0.35 + load * 1.2 + Math.min(1, Math.abs(t.speed) / 15) * 0.5;
        if (Math.random() < k * dt * 14) this.fx.spawn('smoke', p, _v.set((Math.random() - 0.5) * 1.5, 2.5 + load * 3, (Math.random() - 0.5) * 1.5).addScaledVector(t.velocity, 0.3), 0.7 + load * 0.5);
        if (Math.random() < dt * 2) this.fx.spawn('steam', t.local(t.loco, 0, 0.6, t.loco.len / 2 - 2, _v), null, 0.5);
      } else if (load > 0.2 && Math.random() < load * dt * 10) this.fx.spawn('smoke', p, _v.set(0, 2.5, 0).addScaledVector(t.velocity, 0.3), 0.4);
    }
    for (const v of t.vehicles) {
      if (v.burn > 0) {
        v.burn -= dt;
        this.fx.burn(v.root.position.clone().setY(v.root.position.y + v.h * 0.8), v.burn > 30 ? 1 : 0.5);
      }
    }
    // the chuff of the steam engine / the clack of the rail joints / the engine of a diesel near the listener
    if (d < 260 && Math.abs(t.speed) > 0.3) {
      if (t.def.type === 'steam' && !t.wrecked) {
        const R0 = 0.8, period = (2 * Math.PI * R0) / (4 * Math.abs(t.speed));
        t.chuffT = (t.chuffT || 0) - dt;
        if (t.chuffT <= 0) { t.chuffT = Math.max(0.09, period); this.sfx.chuff(d, 0.4 + Math.abs(t.ctl.throttle) * 0.6); }
      }
      t.clackS = (t.clackS || 0) + Math.abs(t.speed) * dt;
      if (t.clackS > 12.5) { t.clackS = 0; this.sfx.clack(d); }
    }
  }

  // the train pushes / smashes what stands on the track
  collide(t, g) {
    const sp = Math.abs(t.speed);
    const hit = (v, p, r) => {
      const o = v.ob, dx = p.x - o.x, dz = p.z - o.z;
      if (dx * dx + dz * dz > (o.rad + r) ** 2) return false;
      const lx = dx * o.cos - dz * o.sin, lz = dx * o.sin + dz * o.cos;
      return Math.abs(lx) < o.hx + r && Math.abs(lz) < o.hz + r && p.y < o.y1 && p.y > o.y0 - 2;
    };
    const ends = [t.vehicles[0], t.vehicles[t.vehicles.length - 1]];
    for (const tk of g.tanks) {
      if (tk.remote) continue;
      const tp = tk.root.position;
      if (this.distTo(t, tp) > t.len + 10) continue;
      const r = tk.def.radius * 0.8;
      for (const v of t.vehicles) {
        if (!hit(v, tp, r)) continue;
        // the train runs into it (the front / rear vehicle) or brushes past it
        const head = ends.includes(v) ? 1 : 0.35;
        if ((tk.trainHitT || 0) > this.time) break;
        tk.trainHitT = this.time + 0.7;
        const dmg = sp * sp * 0.32 * head * Math.min(2, t.mass / 300);
        tk.damage('hull', dmg * (tk.soft ? 3 : 1));
        if (Math.random() < 0.5) tk.damage('transmission', dmg * 0.6);
        if (Math.random() < 0.3) tk.damage('engine', dmg * 0.5);
        if (!tk.soft && tk.hp.hull <= 0 && !tk.wrecked && !(this.god && tk.playerInside)) {     // smashed
          if (tk.crew) tk.killCrew();
          this.fx.explosion(tp.clone().setY(tp.y + 2), 2, false);
          tk.makeWreck();
        }
        this.fx.ricochet(tp.clone().setY(tp.y + 1));
        this.sfx.boom(tp.distanceTo(this.listener), 0.6 + Math.min(1, sp / 15));
        if (t.player) t.speed *= 1 - Math.min(0.5, Math.max(0.05, (tk.def.weight || 10) / t.mass * 2));
        this.onEvent(t, 'ram', tk, dmg);
        break;
      }
    }
    if (g.foot && g.foot.active) {
      for (const v of t.vehicles) if (hit(v, g.foot.pos, 0.45)) {
        if ((this.footHitT || 0) < this.time) { this.footHitT = this.time + 1; g.hurtPlayer(12 + sp * 7, 'Вас сбил поезд!'); }
        break;
      }
    }
    for (const s of g.soldiers) {
      if (!s.alive || s.ride || s.puppet) continue;
      if (this.distTo(t, s.pos) > t.len + 5) continue;
      for (const v of t.vehicles) if (hit(v, s.pos, 0.35)) { s.hit(500, t.player ? { player: true } : null, null); break; }
    }
    // trains on the same line
    for (const o of this.list) {
      if (o === t || o.line !== t.line || o.id < t.id) continue;
      const a0 = Math.min(t.s, t.s - t.dir * t.len), a1 = Math.max(t.s, t.s - t.dir * t.len);
      const b0 = Math.min(o.s, o.s - o.dir * o.len), b1 = Math.max(o.s, o.s - o.dir * o.len);
      if (a1 < b0 || b1 < a0) continue;
      const rel = Math.abs(t.speed * t.dir - o.speed * o.dir);
      if (rel > 4) {
        this.damage2(t, o, rel);
      }
      // stop both, push them apart
      const push = (Math.min(a1, b1) - Math.max(a0, b0)) / 2 + 0.05;
      const tFirst = (a0 + a1) / 2 < (b0 + b1) / 2;
      t.s += (tFirst ? -push : push); o.s += (tFirst ? push : -push);
      t.speed = 0; o.speed = 0;
      t.place(); o.place();
    }
  }
  damage2(a, b, rel) {
    for (const t of [a, b]) {
      const v = t.vehicles[0];
      t.damage(v, rel * 6, null);
      this.fx.explosion(v.root.position.clone().setY(v.root.position.y + 2), 1.2, false);
    }
    this.sfx.boom(a.pos.distanceTo(this.listener), 1.5);
  }

  // a blast (shell, grenade, bomb) next to the cars
  blast(pos, r, dmg, owner) {
    for (const t of this.list) {
      if (t.puppet || this.distTo(t, pos) > t.len + r) continue;
      for (const v of t.vehicles) {
        const o = v.ob;
        const dx = pos.x - o.x, dz = pos.z - o.z;
        const lx = dx * o.cos - dz * o.sin, lz = dx * o.sin + dz * o.cos;
        const ex = Math.max(0, Math.abs(lx) - o.hx), ez = Math.max(0, Math.abs(lz) - o.hz);
        const d = Math.hypot(ex, ez, Math.max(0, o.y0 - pos.y, pos.y - o.y1));
        if (d < r) t.damage(v, dmg * (1 - d / r) * 0.12, owner);
      }
    }
  }

  // ------------------------------------------------ network play (host -> guest)
  byId(id) { return this.list.find(t => t.id === id) || null; }
  // rows of the trains near p: [id, line, make-up, s, dir, speed, dead vehicles, passenger]
  netRows(p) {
    const res = [];
    for (const t of this.list) {
      if (this.distTo(t, p) > 2200) continue;
      res.push([t.id, t.line.id, t.vehicles.map(v => `${v.def.key}:${v.part}:${v.variant}${v.flip ? ':f' : ''}`).join(','),
        Math.round(t.s * 100) / 100, t.dir, Math.round(t.speed * 100) / 100, t.vehicles.filter(v => !v.alive).map(v => v.i), t.passenger ? 1 : 0]);
    }
    return res;
  }
  // guest: make / move / drop the copies of the host's trains
  netApply(rows) {
    const R = this.world.rail;
    if (!R) return;
    const seen = new Set();
    for (const [id, lid, mk, s, dir, speed, dead, pass] of rows) {
      seen.add(id);
      let t = this.byId(id);
      if (!t) {
        const L = R.byId(lid);
        if (!L) continue;
        const comp = mk.split(',').map(x => {
          const [key, part, variant, f] = x.split(':');
          return { def: LOCOS[key] || CARS[key], part, variant: +variant, flip: f === 'f' };
        }).filter(c => c.def);
        t = new Train(this, L, { comp, passenger: !!pass, military: false }, { s, dir, speed, id, puppet: true, team: 'enemy' });
        this.list.push(t);
      }
      t.netS = s; t.speed = speed;
      for (const i of dead) { const v = t.vehicles[i]; if (v && v.alive) { v.alive = false; v.hp = 0; v.burn = 60; v.body.material = BURNT; if (v.spinM) v.spinM.visible = false; } }
    }
    for (const t of [...this.list]) if (t.puppet && !seen.has(t.id)) { t.dispose(); this.list.splice(this.list.indexOf(t), 1); t.removed = true; }
  }
}
