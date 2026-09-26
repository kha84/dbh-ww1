// Tanks: assembled from a hull and replaceable parts (see parts.js), physics, turret/gun aiming,
// internal modules (systems) and their effect on performance, hit marks, engine bay, crew compartment.
import * as THREE from 'three';
import { WATER_LEVEL } from './world.js';
import { HULLS, TURRETS, SYSTEM_PART, computeSpec, defaultParts } from './parts.js';
import { buildHull, buildTurret, buildGun, buildEngine, buildFuel, buildDrive,
         buildHullInterior, buildTurretInterior } from './models.js';

export const G = 9.81;

export const MODULE_IDS = ['engine', 'transmission', 'turret', 'gun', 'ammo', 'fuel'];
export const SYSTEM_IDS = ['hull', ...MODULE_IDS];
export const MODULE_NAMES = {
  hull: 'Корпус', engine: 'Двигатель', transmission: 'Трансмиссия', turret: 'Поворот башни',
  gun: 'Орудие', ammo: 'Боеукладка', fuel: 'Бензобак',
};
export const TANK_KEYS = ['t55', 'abrams', 'avre', 'markV'];

const PART_BUILDERS = { engine: buildEngine, gun: buildGun, fuel: buildFuel, drive: buildDrive, turret: buildTurret };
// lazily build the visual of a part; it stays with the part wherever it goes
export function partVisual(part) {
  if (!part.vis) part.vis = PART_BUILDERS[part.kind](part.key);
  return part.vis;
}

// ---------------------------------------------------------------- hit marks
function markTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = (stops) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  };
  if (kind === 'hole') {
    rg([[0, 'rgba(0,0,0,1)'], [0.3, 'rgba(10,8,6,1)'], [0.42, 'rgba(90,80,70,1)'], [0.55, 'rgba(40,30,20,.85)'], [1, 'rgba(20,15,10,0)']]);
    g.strokeStyle = 'rgba(150,140,130,.8)'; g.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * 7;
      g.beginPath(); g.moveTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10); g.lineTo(32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17); g.stroke();
    }
  } else if (kind === 'dent') {
    rg([[0, 'rgba(200,195,185,1)'], [0.18, 'rgba(120,115,105,1)'], [0.35, 'rgba(40,32,24,.9)'], [1, 'rgba(20,15,10,0)']]);
  } else {
    g.save(); g.translate(32, 32); g.scale(0.35, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, 'rgba(210,205,195,1)'); gr.addColorStop(0.4, 'rgba(110,100,90,.9)'); gr.addColorStop(1, 'rgba(30,25,20,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let MARK = null;
function markRes() {
  if (MARK) return MARK;
  const mk = kind => new THREE.MeshStandardMaterial({
    map: markTexture(kind), transparent: true, depthWrite: false, roughness: 0.9, metalness: 0.2,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  MARK = { geo: new THREE.PlaneGeometry(1, 1), hole: mk('hole'), dent: mk('dent'), scrape: mk('scrape') };
  return MARK;
}
const _ray = new THREE.Raycaster();
const _nm = new THREE.Matrix3(), _basis = new THREE.Matrix4(), _hq = new THREE.Quaternion();

function visibleChain(o, stop) {
  for (let p = o; p && p !== stop.parent; p = p.parent) if (!p.visible) return false;
  return true;
}

// =====================================================================
// Tank
// =====================================================================
let TANK_ID = 0;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);

export class Tank {
  constructor(scene, key, pos, heading, opts = {}) {
    this.id = ++TANK_ID;
    this.scene = scene;
    this.key = key;
    this.hull = buildHull(key);
    this.root = this.hull.root;
    this.turretless = !!HULLS[key].turretless;
    // yaw pivot: turret ring (or the Mark V gun mount)
    this.turret = new THREE.Group();
    this.turret.position.copy(this.turretless ? this.hull.mount : this.hull.ring.pos);
    this.root.add(this.turret);
    // gun pivot used when there is no turret body (Mark V mount / empty ring)
    this.mountPivot = new THREE.Group();
    if (!this.turretless) this.mountPivot.position.set(0, 0.4, 1.0);
    this.turret.add(this.mountPivot);
    this.vis = { hullBox: this.hull.box, turretBox: null, muzzleLen: 1.2, sightY: 0.5,
                 wheels: this.hull.wheels, wheelR: this.hull.wheelR };
    this.root.position.copy(pos);
    this.heading = heading;
    scene.add(this.root);

    this.team = opts.team || 'neutral';          // 'player' | 'enemy' | 'neutral'
    this.crew = !!opts.crew;                    // AI crew alive
    this.crewHp = 100;
    this.playerInside = false;
    this.parts = { engine: null, gun: null, fuel: null, drive: null, turret: null };
    this.hp = { hull: 100, transmission: 100, ammo: 100 };
    for (const [sys, kind] of Object.entries(SYSTEM_PART)) {
      Object.defineProperty(this.hp, sys, {
        enumerable: true,
        get: () => this.parts[kind] ? this.parts[kind].hp : 0,
        set: v => { if (this.parts[kind]) this.parts[kind].hp = v; },
      });
    }
    const parts = opts.parts || defaultParts(key);
    for (const k of ['engine', 'fuel', 'drive', 'turret', 'gun']) if (parts[k]) this.setPart(k, parts[k], true);
    this.refresh();

    this.ammo = opts.ammo ?? this.def.ammoMax;
    this.fuel = this.fuelMax;
    this.extinguishers = 3;
    this.loot = { repair_kit: opts.kits || 0, torch: opts.torches || 0 };
    this.plates = opts.plates || 0;              // spare armour plates stowed on board
    this.fire = null;                            // { t, max, source, selfOut }
    this.wrecked = false;
    this.sink = opts.sink || 0;
    this.bayOpen = false;
    this.interiorOn = false;
    this.marks = [];

    this.speed = 0;
    this.speedKmh = 0;
    this.tiltX = 0; this.tiltZ = 0;
    this.turretYaw = 0;
    this.gunElev = 0;
    this.aimPoint = null;                        // world point to lay the gun on
    this.reload = 0;
    this.controls = { throttle: 0, steer: 0, brake: 0 };
    this.velocity = new THREE.Vector3();
    this.lastHitT = -1e9;
    this.update(0, null);
  }

  get operated() { return !this.wrecked && (this.crew || this.playerInside); }
  get enterable() { return !this.wrecked && !this.crew; }

  // ------------------------------------------------ composition
  gunPivot() {
    const T = this.parts.turret;
    return T ? partVisual(T).gunPivot : this.mountPivot;
  }
  canMountGun() { return !!this.parts.turret || this.turretless; }

  // install / remove a part (turret body is handled by removeTurret / installTurret)
  setPart(kind, part, silent = false) {
    const old = this.parts[kind];
    if (old && old.vis && kind !== 'turret') old.vis.group.removeFromParent();
    this.parts[kind] = part;
    if (part) {
      const v = partVisual(part);
      const g = v.group;
      g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
      g.visible = true;
      const h = this.hull;
      if (kind === 'engine') {
        g.position.set(h.bay.center.x, h.bay.engineFloor ?? (h.bay.engineTop - v.h), h.bay.center.z);
        this.root.add(g);
      } else if (kind === 'fuel') {
        g.position.copy(h.fuelAt); g.rotation.y = h.fuelRot;
        this.root.add(g);
      } else if (kind === 'drive') {
        g.position.copy(h.driveAt);
        this.root.add(g);
      } else if (kind === 'gun') {
        this.gunPivot().add(g);
      } else if (kind === 'turret') {
        this.turret.add(g);
      }
      this.setInteriorFlags(g, this.interiorOn);
    }
    if (!silent) this.refresh();
    return old;
  }

  // crane: lift the turret body off together with the gun mounted in it
  removeTurret() {
    const turret = this.parts.turret;
    if (!turret) return null;
    const gun = this.parts.gun;
    this.parts.turret = null;
    this.parts.gun = null;
    turret.vis.group.removeFromParent();
    this.refresh();
    return { turret, gun };
  }
  installTurret(turret, gun) {
    this.turretYaw = 0;
    this.parts.turret = turret;
    const g = partVisual(turret).group;
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
    this.turret.add(g);
    this.parts.gun = gun || null;
    this.setInteriorFlags(g, this.interiorOn);
    this.refresh();
  }

  refresh() {
    this.def = computeSpec(this.key, this.parts);
    const T = this.parts.turret ? partVisual(this.parts.turret) : null;
    const Gv = this.parts.gun ? partVisual(this.parts.gun) : null;
    this.vis.turretBox = T ? T.box : null;
    this.vis.muzzleLen = Gv ? Gv.muzzleLen : 1.2;
    this.vis.sightY = T ? T.sightY : 0.35;
    this.gun = this.gunPivot();
    if (this.hull.ringHole) this.hull.ringHole.visible = !T;
    if (this.parts.drive) this.parts.drive.vis.group.visible = !T && !this.turretless;
    this.updateEngineVisibility();
    if (this.fuel !== undefined) this.fuel = Math.min(this.fuel, this.fuelMax);
    if (this.ammo !== undefined) this.ammo = Math.min(this.ammo, this.def.ammoMax);
  }

  // crew stations available with the current composition: [{ role, space, pos, eye }]
  seats() {
    const res = [];
    for (const [role, s] of Object.entries(HULLS[this.key].seats)) res.push({ role, space: 'hull', ...s });
    if (this.parts.turret) {
      for (const [role, s] of Object.entries(TURRETS[this.parts.turret.key].seats)) res.push({ role, space: 'turret', ...s });
    }
    return res;
  }

  // ------------------------------------------------ engine bay / interior
  setBay(open) {
    this.bayOpen = open;
    this.updateEngineVisibility();
  }
  updateEngineVisibility() {
    const e = this.parts.engine;
    if (e && e.vis) e.vis.group.visible = this.bayOpen || !!this.interiorOn;
  }

  setInteriorFlags(obj, on) {
    obj.traverse(o => { if (o.userData.interior) o.visible = on; });
  }
  setInterior(on) {
    this.interiorOn = on;
    if (on) {
      if (!this.hullInterior) {
        this.hullInterior = buildHullInterior(this.key, this.hull);
        this.root.add(this.hullInterior);
      }
      const T = this.parts.turret ? partVisual(this.parts.turret) : null;
      if (T && !T.interior) {
        T.interior = buildTurretInterior(T.key);
        T.group.add(T.interior);
      }
    }
    this.setInteriorFlags(this.root, on);
    this.updateEngineVisibility();
  }

  // ------------------------------------------------ system-derived factors
  get maxSpeedEff() {
    const e = this.hp.engine, t = this.hp.transmission;
    if (e <= 0 || t <= 0 || this.bayOpen || (this.team === 'player' && this.fuel <= 0)) return 0;
    return this.def.maxSpeed * (0.3 + 0.7 * e / 100) * (0.55 + 0.45 * t / 100);
  }
  get accelEff() {
    const e = this.hp.engine, t = this.hp.transmission;
    if (e <= 0 || t <= 0) return 0;
    return this.def.accel * (0.35 + 0.65 * e / 100) * (0.4 + 0.6 * t / 100);
  }
  get turnEff() {
    const t = this.hp.transmission;
    return t <= 0 || this.bayOpen ? 0 : this.def.turn * (0.35 + 0.65 * t / 100);
  }
  get turretRate() {
    const t = this.hp.turret;
    return t <= 0 ? 0 : this.def.turretSpeed * (0.15 + 0.85 * t / 100);
  }
  get reloadTime() {
    const g = this.hp.gun, a = this.hp.ammo;
    return this.def.reload / ((0.35 + 0.65 * g / 100) * (0.45 + 0.55 * a / 100));
  }
  get canFire() {
    return this.operated && this.hp.gun > 0 && this.ammo > 0 && this.reload <= 0;
  }
  get fuelMax() { return this.def.fuelInt + (this.parts.fuel && this.hp.fuel > 0 ? this.def.fuelExt : 0); }

  // ------------------------------------------------ geometry helpers
  muzzleWorld(out = new THREE.Vector3()) {
    return this.gun.localToWorld(out.set(0, 0, this.vis.muzzleLen));
  }
  gunDirWorld(out = new THREE.Vector3()) {
    this.gun.getWorldQuaternion(_q);
    return out.set(0, 0, 1).applyQuaternion(_q);
  }
  // point from which the player looks through the gunner sight
  sightWorld(out = new THREE.Vector3()) {
    return this.turret.localToWorld(out.set(0, this.vis.sightY + 0.25, 0));
  }

  // ------------------------------------------------ update
  update(dt, world, others) {
    const p = this.root.position;
    const c = this.controls;
    if (!this.operated || this.craneLock) { c.throttle = 0; c.steer = 0; c.brake = 1; }

    if (dt > 0 && world) {
      const maxS = this.maxSpeedEff;
      if (c.throttle !== 0 && maxS > 0) this.speed += c.throttle * this.accelEff * dt;
      else this.speed *= Math.pow(0.25, dt);
      if (c.brake) this.speed *= Math.pow(0.02, dt);
      this.speed = Math.max(-maxS * 0.45, Math.min(maxS, this.speed));
      if (Math.abs(this.speed) < 0.01) this.speed = 0;

      // tracked vehicles can pivot in place
      const steerEff = 1 - Math.min(0.6, Math.abs(this.speed) / Math.max(1, this.def.maxSpeed) * 0.7);
      this.heading += c.steer * this.turnEff * steerEff * dt * (this.speed >= -0.1 ? 1 : -1) *
                      (0.45 + 0.55 * Math.min(1, Math.abs(this.speed) / 2.5));

      const ox = p.x, oz = p.z;
      const dirX = Math.sin(this.heading), dirZ = Math.cos(this.heading);
      p.x += dirX * this.speed * dt;
      p.z += dirZ * this.speed * dt;

      if (world.heightAt(p.x, p.z) < WATER_LEVEL - 1.4) {
        p.x = ox; p.z = oz;
        this.speed *= 0.3;
      }
      const r = this.def.radius * 0.8;
      // trees give way to a moving tank, houses collapse when rammed
      const sg = this.speed >= 0 ? 1 : -1;
      const ram = { speed: this.speed, dx: dirX * sg, dz: dirZ * sg, broke: false };
      if (world.collideTrees(p, r, ram)) this.speed *= Math.pow(0.02, dt);
      if (ram.broke) this.speed *= 0.8;
      let rammed = false;
      const breakFn = o => { const b = o.house.ram(Math.abs(this.speed)); if (b) rammed = true; return b; };
      if (world.collideObstacles(p, r, breakFn)) this.speed *= Math.pow(0.02, dt);
      if (rammed) { this.speed *= 0.5; this.damage('hull', 1); }
      if (others) {
        for (const o of others) {
          if (o === this) continue;
          const dx = p.x - o.root.position.x, dz = p.z - o.root.position.z;
          const rr = (this.def.radius + o.def.radius) * 0.75;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            p.x = o.root.position.x + dx / d * rr;
            p.z = o.root.position.z + dz / d * rr;
            this.speed *= Math.pow(0.05, dt);
          }
        }
      }
      this.velocity.set((p.x - ox) / dt, 0, (p.z - oz) / dt);

      // fuel
      if (this.team === 'player' && this.playerInside) {
        this.fuel -= this.def.fuelUse * (0.12 + 0.88 * Math.abs(c.throttle)) * dt;
        if (this.parts.fuel && this.hp.fuel < 100) this.fuel -= (100 - this.hp.fuel) * 0.0015 * dt;   // leak
        this.fuel = Math.max(0, Math.min(this.fuelMax, this.fuel));
      }
      this.speedKmh = Math.abs(this.speed) * 3.6;

      // terrain follow + tilt
      const h = world.heightAt(p.x, p.z);
      p.y = h - this.sinkAt(p);
      const d = 1.8;
      const hx = world.heightAt(p.x + d, p.z) - world.heightAt(p.x - d, p.z);
      const hz = world.heightAt(p.x, p.z + d) - world.heightAt(p.x, p.z - d);
      const sinH = Math.sin(this.heading), cosH = Math.cos(this.heading);
      const hf = hx * sinH + hz * cosH;
      const hr = -hx * cosH + hz * sinH;
      const MAX_TILT = 0.5;
      const rawPitch = Math.atan2(-hf, 2 * d);
      const rawRoll = Math.atan2(-hr, 2 * d);
      const k = Math.min(1, dt * 6);
      this.tiltX += (THREE.MathUtils.clamp(rawPitch, -MAX_TILT, MAX_TILT) - this.tiltX) * k;
      this.tiltZ += (THREE.MathUtils.clamp(rawRoll, -MAX_TILT, MAX_TILT) - this.tiltZ) * k;

      // wheel spin
      for (const w of this.vis.wheels) w.rotation.x += this.speed * dt / this.vis.wheelR;
    }

    // engine deck hatch animation
    if (dt > 0) {
      const hinge = this.hull.bay.hinge;
      const target = this.bayOpen ? -1.95 : 0;
      hinge.rotation.x += (target - hinge.rotation.x) * Math.min(1, dt * 5);
      this.hull.bay.hole.visible = hinge.rotation.x < -0.05;
    }

    this.root.quaternion.setFromAxisAngle(UP, this.heading)
      .multiply(_q.setFromAxisAngle(AX, this.tiltX))
      .multiply(_q2.setFromAxisAngle(AZ, this.tiltZ));

    // turret / gun laying
    if (dt > 0 && this.aimPoint && this.operated) this.layGun(dt);
    this.turret.rotation.y = this.turretYaw;
    this.gun.rotation.x = -this.gunElev;
    this.root.updateMatrixWorld(true);

    if (dt > 0) {
      if (this.reload > 0) this.reload -= dt;
      this.updateFire(dt);
    }
  }

  // dug in only inside the caponier pit, climbs out smoothly as it leaves
  sinkAt(p) {
    if (!this.sink) return 0;
    const cap = this.caponier;
    if (!cap) return 0;
    const d = Math.hypot(p.x - cap.x, p.z - cap.z);
    return this.sink * (1 - THREE.MathUtils.smoothstep(d, 2.5, 6));
  }

  // desired world direction (with ballistic drop) -> hull-local yaw/elevation, rotate toward it
  layGun(dt) {
    const m = this.muzzleWorld(_v);
    const tx = this.aimPoint.x - m.x, ty = this.aimPoint.y - m.y, tz = this.aimPoint.z - m.z;
    const dist = Math.hypot(tx, tz);
    const v = this.def.shellSpeed;
    let theta = Math.atan2(ty, dist);
    const disc = v ** 4 - G * (G * dist * dist + 2 * ty * v * v);
    if (disc >= 0 && dist > 1) theta = Math.atan((v * v - Math.sqrt(disc)) / (G * dist));
    const az = Math.atan2(tx, tz);
    _v2.set(Math.sin(az) * Math.cos(theta), Math.sin(theta), Math.cos(az) * Math.cos(theta));
    _q.copy(this.root.quaternion).invert();
    _v2.applyQuaternion(_q);
    let yaw = Math.atan2(_v2.x, _v2.z);
    const elev = Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z));
    const arc = this.def.turretArc;
    if (arc) yaw = THREE.MathUtils.clamp(yaw, -arc, arc);

    const rate = this.turretRate;
    let dy = yaw - this.turretYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const maxStep = rate * dt;
    this.turretYaw += THREE.MathUtils.clamp(dy, -maxStep, maxStep);
    this.turretYaw = Math.atan2(Math.sin(this.turretYaw), Math.cos(this.turretYaw));

    const eRate = this.hp.gun > 0 ? this.def.elevSpeed * (0.3 + 0.7 * this.hp.gun / 100) : 0;
    const te = THREE.MathUtils.clamp(elev, this.def.elevMin, this.def.elevMax);
    this.gunElev += THREE.MathUtils.clamp(te - this.gunElev, -eRate * dt, eRate * dt);
    this.aimError = Math.abs(dy) + Math.abs(te - this.gunElev);
  }

  // returns shell spec or null
  shoot() {
    if (!this.canFire) return null;
    this.reload = this.reloadTime;
    this.ammo--;
    const dir = this.gunDirWorld(new THREE.Vector3());
    const disp = this.def.disp * (1 + (100 - this.hp.gun) / 40) * (1 + Math.min(2, Math.abs(this.speed) / 4));
    dir.x += (Math.random() - 0.5) * 2 * disp;
    dir.y += (Math.random() - 0.5) * 2 * disp;
    dir.z += (Math.random() - 0.5) * 2 * disp;
    dir.normalize();
    // recoil
    this.gunElev = Math.min(this.def.elevMax, this.gunElev + 0.01);
    return {
      pos: this.muzzleWorld(new THREE.Vector3()),
      vel: dir.multiplyScalar(this.def.shellSpeed),
      pen: this.def.pen, dmg: this.def.dmg, owner: this,
    };
  }

  // ------------------------------------------------ damage state
  damage(id, amount) {
    if (this.wrecked) return 0;
    const before = this.hp[id];
    this.hp[id] = Math.max(0, before - amount);
    if (id === 'ammo' && this.hp.ammo <= 0 && before > 0) this.ammo = Math.floor(this.ammo * 0.4);
    if (id === 'fuel' && this.hp.fuel <= 0 && before > 0) this.fuel = Math.min(this.fuel, this.fuelMax);
    return before - this.hp[id];
  }

  startFire(source, selfOut) {
    if (this.wrecked) return;
    const max = selfOut ? 7 : (source === 'ammo' ? 12 : 16);
    if (this.fire) { this.fire.t = Math.min(this.fire.t, max); return; }
    this.fire = { t: max, max, source, selfOut, extinguish: 0 };
  }

  updateFire(dt) {
    if (this.wrecked) return;
    const f = this.fire;
    if (!f) return;
    f.t -= dt;
    if (!f.selfOut) {
      // a burning tank slowly cooks its systems
      this.hp.engine = Math.max(0, this.hp.engine - 2.2 * dt);
      this.hp.hull = Math.max(1, this.hp.hull - 1.2 * dt);
      this.hp[f.source] = Math.max(0, this.hp[f.source] - 4 * dt);
    }
    if (f.t <= 0) {
      if (f.selfOut) { this.fire = null; }
      else this.burnOut = true;       // handled by the game (wreck / game over)
    }
  }

  killCrew() {
    this.crew = false;
    this.crewHp = 0;
  }

  makeWreck() {
    if (this.wrecked) return;
    this.wrecked = true;
    this.crew = false;
    this.fire = null;
    this.hp.hull = 0;
    this.speed = 0;
    this.root.traverse(o => {
      if (o.isMesh && !o.userData.mark) {
        o.material = o.material.clone();
        o.material.color.multiplyScalar(0.22);
      }
    });
    this.turretYaw += (Math.random() - 0.5) * 0.8;
    this.gunElev = this.def.elevMin;
    this.turret.rotation.y = this.turretYaw;
    this.gun.rotation.x = -this.gunElev;
  }

  // ------------------------------------------------ hit marks
  // kind: 'hole' (penetration), 'dent' (armour held), 'scrape' (ricochet)
  addMark(point, dir, kind) {
    const R = markRes();
    this.root.updateMatrixWorld(true);
    _ray.set(_v.copy(point).addScaledVector(dir, -3), dir);
    _ray.far = 7;
    const hits = _ray.intersectObject(this.root, true);
    const hit = hits.find(h => h.face && h.object.isMesh && !h.object.userData.mark && visibleChain(h.object, this.root));
    if (!hit) return;
    let host = hit.object;
    while (host !== this.root && !host.userData.markHost) host = host.parent;
    const n = hit.face.normal.clone().applyMatrix3(_nm.getNormalMatrix(hit.object.matrixWorld)).normalize();
    if (n.dot(dir) > 0) n.negate();
    // tangent: along the shell path for scrapes, random otherwise
    let t = dir.clone().addScaledVector(n, -dir.dot(n));
    if (kind !== 'scrape' || t.lengthSq() < 1e-4) t = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).addScaledVector(n, -0.0);
    t.addScaledVector(n, -t.dot(n)).normalize();
    const b = new THREE.Vector3().crossVectors(t, n);
    _basis.makeBasis(b, t, n);
    const m = new THREE.Mesh(R.geo, R[kind]);
    m.userData.mark = true;
    m.renderOrder = 2;
    const s = kind === 'hole' ? 0.42 : kind === 'dent' ? 0.34 : 0.5;
    m.scale.set(s * (kind === 'scrape' ? 0.45 : 1), s * (kind === 'scrape' ? 1.6 : 1), 1);
    host.updateMatrixWorld(true);
    m.position.copy(host.worldToLocal(hit.point.clone().addScaledVector(n, 0.008)));
    m.quaternion.setFromRotationMatrix(_basis).premultiply(host.getWorldQuaternion(_hq).invert());
    host.add(m);
    this.marks.push(m);
    if (this.marks.length > 45) this.marks.shift().removeFromParent();
  }
  // a welded plate covers the damage
  clearMarks() {
    const rm = [];
    this.root.traverse(o => { if (o.userData.mark) rm.push(o); });
    for (const o of rm) o.removeFromParent();
    this.marks = [];
  }

  // world-space hit volumes as {part, box, obj}
  hitVolumes() {
    const v = [{ part: 'hull', box: this.vis.hullBox, obj: this.root }];
    if (this.vis.turretBox) v.push({ part: 'turret', box: this.vis.turretBox, obj: this.turret });
    return v;
  }

  // module box -> local AABB in its space (hull-local or turret-local)
  moduleBox(m, out = new THREE.Box3()) {
    const h = this.hull;
    if (m.ringDrive) {
      const p = h.ring.pos, r = h.ring.r * 0.85;
      out.min.set(p.x - r, p.y - 0.3, p.z - r); out.max.set(p.x + r, p.y + 0.05, p.z + r);
      return out;
    }
    if (m.gunMount) {
      const p = h.mount, s = m.small ? 0.25 : 0.4;
      out.min.set(p.x - s, p.y - s, p.z - (m.small ? 0.6 : 0.2)); out.max.set(p.x + s, p.y + s, p.z + (m.small ? 0 : 1.4));
      return out;
    }
    if (m.fuelMount) {
      const p = h.fuelAt;
      out.min.set(p.x - 1.05, p.y - 0.45, p.z - 0.4); out.max.set(p.x + 1.05, p.y + 0.45, p.z + 0.4);
      return out;
    }
    const b = m.space === 'turret' && this.vis.turretBox ? this.vis.turretBox : this.vis.hullBox;
    const cx = (b.min.x + b.max.x) / 2, hx = (b.max.x - b.min.x) / 2;
    const cz = (b.min.z + b.max.z) / 2, hz = (b.max.z - b.min.z) / 2;
    const sy = b.max.y - b.min.y;
    out.min.set(cx + m.u[0] * hx, b.min.y + m.v[0] * sy, cz + m.w[0] * hz);
    out.max.set(cx + m.u[1] * hx, b.min.y + m.v[1] * sy, cz + m.w[1] * hz);
    return out;
  }

  dispose() {
    this.scene.remove(this.root);
  }
}
