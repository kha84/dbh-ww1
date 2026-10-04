// Aeroplanes: flight from a few numbers per type (mass, power, top speed, stall speed, roll rate), take-off and landing
// on the gear (tail-draggers: the tail sits on the ground until the speed lifts it), retracting gear, the guns /
// cannons / bombs, damage (structure, engine, fire), crashes. The player flies them (game/flight.js); the parked ones
// stand on the airfields.
//
// The model of flight: lift, drag, thrust and gravity move the plane; its nose follows the flight path (the plane
// weathervanes into the airflow) at the angle of attack the stick asks for - hands off it keeps the angle that holds
// level flight (trim). The ailerons roll it; banked, the lift turns it. Below the stall speed the lift is lost, the
// nose drops and the speed comes back.
import * as THREE from 'three';
import { WATER_LEVEL, segBox } from './world.js';
import { PLANES, buildPlane } from './planedefs/index.js';
import { WEAPONS } from './weapons.js';

const G = 9.81;
const CLMAX = 1.35, CLA = 5.3, ALPHA_S = CLMAX / CLA;    // max lift coefficient, lift slope (per rad), stall angle
const K_IND = 0.09;                                      // induced drag factor
const N_MAX = 7;                                         // structural g limit (the stick won't pull harder)
const CONVERGE = 220;                                    // the guns are aimed to meet at this range (m)
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _l = new THREE.Vector3(), _e = new THREE.Euler();
const _inv = new THREE.Matrix4();
const _g1 = new THREE.Vector3(), _g2 = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

let PLANE_N = 0;

export class Plane {
  /** @type {((p: Plane, kind: string, data?: any) => void) | null} the game hears crashes, bombs, shots */
  static onEvent = null;
  /** @type {((p: Plane, dmg: number) => void) | null} network: a hit on the plane the other player flies */
  static onRemoteDamage = null;

  constructor(scene, key, pos, heading, opts = {}) {
    this.scene = scene;
    this.key = key;
    this.def = PLANES[key];
    this.id = opts.id || `pl${++PLANE_N}`;
    const m = buildPlane(key);
    this.root = m.root;
    this.prop = m.prop;
    this.gear = m.gear || null;
    this.bombMeshes = m.bombs || [];
    this.boxes = this.def.boxes.map(([a, b]) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b)));
    this.box = this.boxes[0];
    scene.add(this.root);
    const d = this.def;
    // physics constants from the type's numbers
    this.mass = d.mass;
    this.P = d.power * 735.5 * 0.8;                       // usable shaft power (W) through the propeller
    this.kD = this.P / Math.pow(d.vmax, 3);              // parasite drag: all the power is spent at top speed
    this.kL = this.mass * G / (CLMAX * d.vstall * d.vstall);
    this.Tmax = d.power * 0.7355 * 21;                   // static thrust (N)
    const gr = d.gear;
    this.theta0 = Math.atan2(gr.tail[1] - gr.main[1], gr.main[2] - gr.tail[2]);   // tail-down sitting angle
    // state
    this.vel = new THREE.Vector3();
    this.q = this.root.quaternion;
    this.ctl = { throttle: 0, sx: 0, sy: 0, rud: 0, brake: 1 };
    this.p = 0;                                          // roll rate (eased)
    this.onGround = true;
    this.gearDown = true;
    this.gearK = 1;                                      // 1 down .. 0 up (animation)
    this.spin = 0;                                       // propeller angle speed
    this.hp = opts.hp ?? 100;                            // airframe
    this.engineHp = opts.engineHp ?? 100;
    this.fuel = opts.fuel ?? d.fuel;
    this.ammo = opts.ammo ?? d.guns.map(g => g.n);
    this.shells = opts.shells ?? (d.cannons || []).map(c => c.n);
    this.bombs = opts.bombs ?? (d.bombs || []).length;
    for (let i = 0; i < this.bombMeshes.length; i++) this.bombMeshes[i].visible = i >= (d.bombs || []).length - this.bombs;
    this.gunCool = d.guns.map(() => Math.random() * 0.05);
    this.canCool = (d.cannons || []).map(() => 0);
    this.gunN = 0;
    this.burning = 0;                                    // fire (s left until it burns out / takes the plane)
    this.broken = false;                                 // out of control (shot to pieces): falls
    this.wrecked = false;
    this.pilot = false;                                  // the player sits in it
    this.remote = false;                                 // network: flown on the other machine
    this.used = false;                                   // was flown (stays when its airfield is unloaded)
    this.abandoned = false;                              // the pilot jumped out
    this.remoteUse = false;                              // network: the other player flies it
    /** @type {number | null} */
    this.home = opts.home ?? null;                       // the airfield (settlement k) it stands on
    this.alt = 0;                                        // height over the ground (m)
    this.airTime = 0;
    this.liftOff = false;
    this.root.position.copy(pos);
    this.setGroundPose(heading, null);
    if (opts.quat) this.q.fromArray(opts.quat);
    if (opts.vel) this.vel.fromArray(opts.vel);
    if (opts.air) { this.onGround = false; this.gearDown = false; this.gearK = 0; }
    this.updateGear(0);
  }

  // ------------------------------------------------ helpers
  get speed() { return this.vel.length(); }
  get heading() { const f = _g1.set(0, 0, 1).applyQuaternion(this.q); return Math.atan2(f.x, f.z); }
  get pitch() { return Math.asin(THREE.MathUtils.clamp(_g1.set(0, 0, 1).applyQuaternion(this.q).y, -1, 1)); }
  get bank() {
    const l = _g1.set(1, 0, 0).applyQuaternion(this.q), u = _g2.set(0, 1, 0).applyQuaternion(this.q);
    return Math.atan2(l.y, u.y);
  }
  local(v, out = new THREE.Vector3()) { return out.copy(v).applyQuaternion(this.q).add(this.root.position); }
  ground(world, x, z) {
    const h = world.heightAt(x, z);
    return Math.max(h, WATER_LEVEL);
  }
  // sit on the gear at (heading), tail down; world: settle onto the ground
  setGroundPose(heading, world, theta = this.theta0) {
    this.q.setFromEuler(_e.set(-theta, heading, 0, 'YXZ'));
    if (world) {
      const p = this.root.position;
      const gr = this.def.gear;
      p.y = this.ground(world, p.x, p.z) - (gr.main[1] * Math.cos(theta) + gr.main[2] * Math.sin(theta));
    }
  }

  // ------------------------------------------------ update
  update(dt, world) {
    if (this.remote) { this.netStep(dt); return; }
    if (this.wrecked) { this.root.updateMatrixWorld(); return; }
    if (dt <= 0) return;
    const n = Math.max(1, Math.ceil(this.speed * dt / 4));
    for (let i = 0; i < n && !this.wrecked; i++) this.step(dt / n, world);
    this.updateGear(dt);
    // propeller: idles with the engine running, spins up with the throttle; at speed a blurred disc
    const run = this.engineOn ? 18 + this.ctl.throttle * 70 : 0;
    this.spin += (run - this.spin) * Math.min(1, dt * (run > this.spin ? 1.5 : 0.5));
    if (this.prop) {
      this.prop.rotation.z += this.spin * dt;
      const fast = this.spin > 30;
      this.prop.userData.blades.visible = !fast;
      this.prop.userData.disc.visible = fast;
    }
    if (this.burning > 0) {
      this.burning -= dt;
      this.hp -= dt * 2.5;
      if (this.hp <= 0 && !this.broken) this.breakUp();
    }
    this.root.updateMatrixWorld();
  }
  get engineOn() { return !this.wrecked && this.engineHp > 0 && this.fuel > 0 && (this.pilot || this.ctl.throttle > 0); }

  step(h, world) {
    const d = this.def, c = this.ctl, p = this.root.position;
    const fwd = _f.set(0, 0, 1).applyQuaternion(this.q), up = _u.set(0, 1, 0).applyQuaternion(this.q), left = _l.set(1, 0, 0).applyQuaternion(this.q);
    const v = this.vel.length();
    _qi.copy(this.q).invert();
    const vb = _v.copy(this.vel).applyQuaternion(_qi);
    const alpha = v > 1 ? Math.atan2(-vb.y, vb.z) : 0, beta = v > 1 ? Math.atan2(vb.x, vb.z) : 0;
    // ---- forces
    const F = new THREE.Vector3(0, -this.mass * G, 0);
    let thrust = 0;
    if (this.engineOn) {
      const alt = Math.max(0, p.y - 50);
      const k = Math.exp(-alt / 9000) * (0.25 + 0.75 * this.engineHp / 100);
      thrust = Math.min(this.Tmax, this.P / Math.max(v, 8)) * c.throttle * k;
      if (this.pilot) this.fuel = Math.max(0, this.fuel - d.fuelUse * (0.15 + 0.85 * c.throttle) * h);
    }
    F.addScaledVector(fwd, thrust);
    if (v > 0.5) {
      const vh = _v2.copy(this.vel).multiplyScalar(1 / v);
      const cl = this.liftCoef(alpha);
      const qd = this.kL * v * v;
      // lift: square to the airflow, in the plane of the wings' up
      const ld = up.clone().addScaledVector(vh, -up.dot(vh));
      if (ld.lengthSq() > 1e-6) F.addScaledVector(ld.normalize(), qd * cl * (this.broken ? 0.3 : 1));
      // side force against a slip
      const sd = left.clone().addScaledVector(vh, -left.dot(vh));
      if (sd.lengthSq() > 1e-6) F.addScaledVector(sd.normalize(), -qd * 0.6 * beta);
      // drag (more with the gear down, a lot more when broken)
      const drag = this.kD * v * v * (1 + 0.12 * this.gearK + (this.broken ? 2 : 0)) + qd * cl * cl * K_IND;
      F.addScaledVector(vh, -drag);
    }
    const vbOld = vb.clone();
    this.liftOff = this.onGround && F.y > 0;              // the wings carry it: off the wheels
    this.vel.addScaledVector(F, h / this.mass);
    // ---- the ground under the wheels
    const gr = d.gear;
    if (this.onGround) {
      // rolling: grip across the wheels, rolling resistance and brakes along them
      const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
      const fh = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const along = hv.dot(fh);
      const side = hv.clone().addScaledVector(fh, -along);
      this.vel.addScaledVector(side, -Math.min(1, h * 9));
      const dec = (0.3 + (c.brake ? 4.5 : 0)) * h;
      const na = Math.abs(along) <= dec ? 0 : along - Math.sign(along) * dec;
      this.vel.addScaledVector(fh, na - along);
    }
    const vbNew = _v.copy(this.vel).applyQuaternion(_qi);
    // ---- turning: the nose follows the flight path, the stick sets the angle of attack, the ailerons roll
    const auth = THREE.MathUtils.clamp(v / d.vstall, 0.15, 1.4);
    if (!this.onGround) {
      const vs = Math.max(v, 3);
      const dUp = (vbNew.y - vbOld.y) / vs, dLeft = (vbNew.x - vbOld.x) / vs;
      // the angle of attack: hands off it holds level flight; full back stick - the stall or the g limit
      // (hands off it also seeks level flight: more lift in a dive, less in a climb)
      const gam = Math.asin(THREE.MathUtils.clamp(this.vel.y / Math.max(v, 1), -1, 1));
      const bank = this.bank;
      const cb = Math.max(0.3, Math.cos(Math.min(Math.abs(bank), 1.27)));              // a banked turn needs more lift
      const need = this.mass * G * Math.max(0.15, Math.cos(gam) - 0.8 * Math.sin(gam)) / cb / Math.max(1, this.kL * v * v);
      const trim = THREE.MathUtils.clamp(need / CLA, -0.08, ALPHA_S * 0.9);
      const pull = Math.min(ALPHA_S * 1.1, N_MAX * this.mass * G / Math.max(1, this.kL * v * v * CLA));
      let at = c.sy >= 0 ? trim + c.sy * (Math.max(pull, trim) - trim) : trim + c.sy * (trim + 0.14);
      if (this.broken) at = 0.05 + 0.25 * Math.sin(this.airTime * 2.3);
      const ka = 3.5 * THREE.MathUtils.clamp(v / d.vstall, 0.3, 1.6);
      const rx = -(dUp + ka * (at - alpha) * h);
      // yaw: the nose into the airflow, the rudder
      const ry = dLeft + 2.5 * beta * h * auth + c.rud * 0.5 * h * auth;
      // roll: the stick sets the bank (up to ~75 degrees, wings level when it is let go); pushed all the way over it
      // rolls on and on. The ailerons stiffen near top speed.
      const hs = THREE.MathUtils.clamp(1.6 - v / d.vmax, 0.5, 1);
      const rate = d.roll * Math.min(1, auth) * hs;
      let pc;
      if (Math.abs(c.sx) > 0.93) pc = Math.sign(c.sx) * rate;
      else {
        let e = c.sx * 1.35 - bank;
        e = Math.atan2(Math.sin(e), Math.cos(e));
        pc = THREE.MathUtils.clamp(e * 3, -1, 1) * rate;
      }
      if (this.broken) pc = 1.8;
      this.p += (pc - this.p) * Math.min(1, h * 5);
      _q.setFromEuler(_e.set(rx, ry, this.p * h, 'XYZ'));
      this.q.multiply(_q).normalize();
      this.airTime += h;
    } else {
      // on the wheels: the rudder / tail wheel steers, the tail lifts at speed (stick forward) or sits down
      const hd = this.heading + c.rud * Math.max(0.15, 0.8 - v / 45) * h * (v > 0.5 || this.engineOn ? 1 : 0);
      let th = this.pitch;
      const want = c.sy < -0.15 && v > d.vstall * 0.45 ? 0 : this.theta0;
      th += THREE.MathUtils.clamp(want - th, -0.5 * h, 0.5 * h);
      this.setGroundPose(hd, null, th);
    }
    // ---- move
    const ox = p.x, oy = p.y, oz = p.z;
    p.addScaledVector(this.vel, h);
    this.contact(world, ox, oy, oz, h);
  }

  liftCoef(a) {
    if (a > ALPHA_S) return Math.max(0.55 * CLMAX, CLMAX - (a - ALPHA_S) * 2.6);
    if (a < -0.22) return Math.min(-0.5, -1.15 + (a + 0.22) * -2);
    return CLA * a;
  }

  // the ground, water, trees and buildings
  contact(world, ox, oy, oz, h) {
    const p = this.root.position, d = this.def, gr = d.gear;
    const fwd = _f.set(0, 0, 1).applyQuaternion(this.q), up = _u.set(0, 1, 0).applyQuaternion(this.q);
    const gh = this.ground(world, p.x, p.z);
    const wheelY = p.y + up.y * gr.main[1] + fwd.y * gr.main[2];
    const tailY = p.y + up.y * gr.tail[1] + fwd.y * gr.tail[2];
    this.alt = Math.min(wheelY, tailY) - gh;
    // trees / buildings on the way
    if (this.speed > 6) {
      const a = new THREE.Vector3(ox, oy, oz);
      const hitT = world.raycastTrees(a, p), hitO = world.raycastObstacles(a, p);
      if ((hitT && this.alt < 30) || hitO) { this.crash(world, 'obstacle'); return; }
    } else if (this.onGround) { world.collideObstacles(p, Math.max(1.5, d.span * 0.25), null, 2); world.collideTrees(p, 1.5); }
    const water = world.heightAt(p.x, p.z) < WATER_LEVEL;
    if (this.onGround) {
      if (water) { this.crash(world, 'water'); return; }
      // stays on the wheels until the lift (more than the weight) lifts it off
      if (this.liftOff) { this.onGround = false; this.vel.y = Math.max(this.vel.y, 0.6); }
      else {
        const th = this.pitch;
        p.y = gh - (gr.main[1] * Math.cos(th) + gr.main[2] * Math.sin(th));
        if (this.vel.y < 0) this.vel.y = 0;
      }
      return;
    }
    // airborne: something touches the ground?
    const pts = /** @type {[number, number, number][]} */ ([[0, gr.main[1], gr.main[2]], [0, gr.tail[1], gr.tail[2]], [0, 0, d.len * 0.48], [d.span * 0.48, 0, 0], [-d.span * 0.48, 0, 0], [0, -0.3, -d.len * 0.45]]);
    let low = Infinity, which = -1;
    for (let i = 0; i < pts.length; i++) {
      if (i < 2 && !this.gearDown) continue;
      const w = this.local(_v.set(...pts[i]));
      const dh = w.y - this.ground(world, w.x, w.z);
      if (dh < low) { low = dh; which = i; }
    }
    if (low > 0) return;
    const vy = this.vel.y, v = this.speed;
    if (water) { this.crash(world, 'water'); return; }
    // a landing: on the wheels, wings level, not too fast nor too steep
    if (which <= 1 && vy > -5.5 && Math.abs(this.bank) < 0.4 && this.pitch > -0.12 && v < d.vstall * 2.3) {
      this.onGround = true;
      this.vel.y = 0;
      if (vy < -3) { this.hp -= (-vy - 3) * 8; Plane.onEvent && Plane.onEvent(this, 'bump', -vy); }
      const th = Math.max(Math.min(this.pitch, this.theta0), 0);
      this.setGroundPose(this.heading, world, th);
      return;
    }
    this.crash(world, which <= 1 ? 'hard' : 'ground');
  }

  // retracting gear: up in flight, down near the ground and slow
  updateGear(dt) {
    if (!this.def.retract) return;
    const v = this.speed;
    if (this.onGround) this.gearDown = true;
    else if (this.gearDown && this.alt > 15 && v > this.def.vstall * 1.15) this.gearDown = false;
    else if (!this.gearDown && this.alt < 40 && v < this.def.vstall * 1.9) this.gearDown = true;
    this.gearK += ((this.gearDown ? 1 : 0) - this.gearK) * Math.min(1, dt * 2.5);
    if (this.gear) {
      this.gear.visible = this.gearK > 0.05;
      this.gear.scale.y = Math.max(0.05, this.gearK);
    }
  }

  // ------------------------------------------------ weapons
  // fire the guns (hitscan, through the game's Guns) and cannons (shells, through Combat)
  fire(dt, guns, combat, owner) {
    const d = this.def;
    this.root.updateMatrixWorld();
    const aim = this.local(_v2.set(0, 0, CONVERGE));
    let fired = false;
    d.guns.forEach((g, i) => {
      this.gunCool[i] -= dt;
      const W = WEAPONS[g.w];
      // the fast-firing guns: one traced round stands for k of them (the hits count k times)
      const k = Math.max(1, Math.ceil(W.rpm * d.guns.length / 1400));
      while (this.gunCool[i] <= 0 && this.ammo[i] > 0) {
        this.gunCool[i] += 60 / W.rpm * k;
        this.ammo[i] = Math.max(0, this.ammo[i] - k);
        owner.dmgK = k;
        const mz = this.local(new THREE.Vector3(...g.at));
        const dir = aim.clone().sub(mz).normalize();
        const sp = 0.006;
        dir.x += (Math.random() - 0.5) * sp; dir.y += (Math.random() - 0.5) * sp; dir.z += (Math.random() - 0.5) * sp;
        guns.fire(mz, dir.normalize(), W, owner, mz, (this.gunN++ % 3) === 0);
        fired = true;
      }
      if (this.gunCool[i] < 0) this.gunCool[i] = 0;
    });
    owner.dmgK = 1;
    (d.cannons || []).forEach((cn, i) => {
      this.canCool[i] -= dt;
      while (this.canCool[i] <= 0 && this.shells[i] > 0) {
        this.canCool[i] += 60 / cn.rpm;
        this.shells[i]--;
        const mz = this.local(new THREE.Vector3(...cn.at));
        const dir = aim.clone().sub(mz).normalize();
        dir.x += (Math.random() - 0.5) * 0.008; dir.y += (Math.random() - 0.5) * 0.008;
        combat.launch({ pos: mz, vel: dir.normalize().multiplyScalar(cn.speed).add(this.vel), pen: cn.pen, dmg: cn.dmg, owner, light: true, crater: 0 });
        fired = true;
      }
      if (this.canCool[i] < 0) this.canCool[i] = 0;
    });
    return fired;
  }
  get roundsLeft() { return this.ammo.reduce((a, b) => a + b, 0); }
  get shellsLeft() { return this.shells.reduce((a, b) => a + b, 0); }
  // drop the next bomb (they go from the outside in)
  dropBomb(combat, owner) {
    const list = this.def.bombs || [];
    if (this.bombs <= 0) return false;
    const i = list.length - this.bombs;
    const b = list[i];
    this.bombs--;
    if (this.bombMeshes[i]) this.bombMeshes[i].visible = false;
    const pos = this.local(new THREE.Vector3(...b.at));
    combat.launch({ pos, vel: this.vel.clone().add(_v.set(0, -1, 0)), pen: b.pen ?? 60, dmg: b.dmg, owner, bomb: b.kg, crater: b.dmg, life: 40 });
    return true;
  }

  // ------------------------------------------------ damage
  // a hit of `dmg` (bullet ~30-100, shell x100) at a world point
  damage(dmg, point = null) {
    if (this.wrecked) return;
    if (this.remote) { if (Plane.onRemoteDamage) Plane.onRemoteDamage(this, dmg); return; }
    this.hp -= dmg * 0.09;
    const r = Math.random();
    if (r < 0.25) this.engineHp = Math.max(0, this.engineHp - dmg * 0.25);
    else if (r < 0.32) this.fuel = Math.max(0, this.fuel - dmg * 0.3);
    if (Math.random() < dmg / 900 && this.burning <= 0) this.burning = 25;
    if (this.hp <= 0 && !this.broken) this.breakUp();
    if (Plane.onEvent) Plane.onEvent(this, 'hit', dmg);
  }
  // shot to pieces: no control any more, it falls
  breakUp() {
    this.broken = true;
    this.burning = Math.max(this.burning, 30);
    if (Plane.onEvent) Plane.onEvent(this, 'broken');
  }
  crash(world, how) {
    if (this.wrecked) return;
    const p = this.root.position;
    const gh = world.heightAt(p.x, p.z);
    if (how === 'water') { p.y = WATER_LEVEL - 1.2; this.q.setFromEuler(_e.set(0.3, this.heading, this.bank * 0.5, 'YXZ')); }
    else {
      p.y = Math.max(gh, WATER_LEVEL) + 0.4;
      this.q.setFromEuler(_e.set(-0.05, this.heading, 0.25 * Math.sign(this.bank || 1), 'YXZ'));
      if (this.speed > 12) world.addCrater(p.x, p.z, 2.5, 0.9);
    }
    const fast = this.speed;
    this.makeWreck();
    this.burning = how === 'water' ? 0 : 60;
    if (Plane.onEvent) Plane.onEvent(this, 'crash', { how, speed: fast });
  }
  // the burnt-out look (also for wrecks restored from a save)
  makeWreck() {
    this.wrecked = true;
    this.onGround = true;
    this.vel.set(0, 0, 0);
    this.root.traverse(o => {
      if (o.isMesh && o.material && !o.material.transparent) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.25); }
    });
    if (this.prop) { this.prop.userData.disc.visible = false; this.prop.userData.blades.visible = true; this.prop.rotation.z = 0.4; }
    if (this.gear) this.gear.visible = false;
    this.root.updateMatrixWorld();
  }

  // world-space hit test of a segment p0 -> p1: t (0..1) or null
  hitSegment(p0, p1) {
    this.root.updateMatrixWorld();
    _inv.copy(this.root.matrixWorld).invert();
    const a = _v.copy(p0).applyMatrix4(_inv), b = _v2.copy(p1).applyMatrix4(_inv);
    let best = null;
    for (const bx of this.boxes) {
      const t = segBox(a.x, a.y, a.z, b.x, b.y, b.z, bx.min.x, bx.min.y, bx.min.z, bx.max.x, bx.max.y, bx.max.z);
      if (t !== null && (best === null || t < best)) best = t;
    }
    return best;
  }

  // ------------------------------------------------ network play (flown on the other machine)
  netPose() {
    const p = this.root.position, r = x => Math.round(x * 1000) / 1000;
    return [r(p.x), r(p.y), r(p.z), ...this.q.toArray().map(r), r(this.vel.x), r(this.vel.y), r(this.vel.z), r(this.ctl.throttle),
            this.gearDown ? 1 : 0, this.bombs];
  }
  setNetPose(a) {
    this.net = { pos: new THREE.Vector3(a[0], a[1], a[2]), q: new THREE.Quaternion(a[3], a[4], a[5], a[6]),
                 vel: new THREE.Vector3(a[7], a[8], a[9]), throttle: a[10], gear: !!a[11], bombs: a[12], at: performance.now() };
  }
  netStep(dt) {
    const n = this.net;
    if (n && !this.wrecked) {
      const age = Math.min(0.3, (performance.now() - n.at) / 1000);
      const k = 1 - Math.exp(-dt * 10);
      const tgt = n.pos.clone().addScaledVector(n.vel, age);
      this.root.position.lerp(tgt, k);
      this.q.slerp(n.q, k);
      this.vel.copy(n.vel);
      this.ctl.throttle = n.throttle;
      this.gearDown = n.gear;
      this.gearK += ((n.gear ? 1 : 0) - this.gearK) * Math.min(1, dt * 2.5);
      if (this.gear && this.def.retract) { this.gear.visible = this.gearK > 0.05; this.gear.scale.y = Math.max(0.05, this.gearK); }
      if (n.bombs < this.bombs) {
        const list = this.def.bombs || [];
        while (this.bombs > n.bombs) { const i = list.length - this.bombs; if (this.bombMeshes[i]) this.bombMeshes[i].visible = false; this.bombs--; }
      }
      this.spin += ((18 + n.throttle * 70) - this.spin) * Math.min(1, dt * 1.5);
      if (this.prop) {
        this.prop.rotation.z += this.spin * dt;
        this.prop.userData.blades.visible = this.spin <= 30;
        this.prop.userData.disc.visible = this.spin > 30;
      }
    }
    this.root.updateMatrixWorld();
  }

  // saved games
  data() {
    const p = this.root.position, r = x => Math.round(x * 1000) / 1000;
    return { key: this.key, id: this.id, pos: [r(p.x), r(p.y), r(p.z)], quat: this.q.toArray().map(r), vel: this.vel.toArray().map(r),
             hp: this.hp, engineHp: this.engineHp, fuel: this.fuel, ammo: [...this.ammo], shells: [...this.shells], bombs: this.bombs,
             air: !this.onGround, wrecked: this.wrecked, used: this.used, home: this.home || null };
  }

  dispose() { this.scene.remove(this.root); }
}
