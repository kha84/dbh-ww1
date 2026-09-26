// Enemy tanks: encounter spawner along the road (patrols and dug-in ambushes) + simple AI
import * as THREE from 'three';
import { hash, rng } from './noise.js';
import { Tank } from './tanks.js';

const ENC_LEN = 450;          // road stretch per potential encounter
const dbg = new URLSearchParams(location.search);

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// ------------------------------------------------------------------ caponier
const earthMat = new THREE.MeshStandardMaterial({ color: 0x6d5a3c, roughness: 1 });
const bermGeo = (() => {
  // trapezoid cross-section (x across, y up) extruded along z, 1 m long, centred
  const s = new THREE.Shape();
  s.moveTo(-1.6, -1); s.lineTo(1.6, -1); s.lineTo(0.5, 1); s.lineTo(-0.5, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  g.computeVertexNormals();
  return g;
})();

function buildCaponier(world, x, z, heading) {
  const group = new THREE.Group();
  const obstacles = [];
  const c = Math.cos(heading), s = Math.sin(heading);
  const place = (lx, lz, len, rotLocal, h) => {
    const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
    const gy = world.heightAt(wx, wz);
    const m = new THREE.Mesh(bermGeo, earthMat);
    m.position.set(wx, gy + h / 2 - 0.2, wz);
    m.rotation.y = heading + rotLocal;
    m.scale.set(1, h / 2, len);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    const along = Math.abs(Math.sin(rotLocal)) > 0.5;
    obstacles.push(world.addObstacle({
      x: wx, z: wz, rot: heading, hx: along ? len / 2 : 1.2, hz: along ? 1.2 : len / 2,
      y0: gy - 1, y1: gy + h - 0.3,
    }));
  };
  place(0, 5.2, 8.5, Math.PI / 2, 2.2);     // front parapet
  place(3.9, 0.6, 8, 0, 1.9);               // left
  place(-3.9, 0.6, 8, 0, 1.9);              // right
  world.scene.add(group);
  return {
    group, obstacles, x, z,             // pit centre: the tank is dug in only while inside it
    dispose() {
      world.scene.remove(group);
      for (const o of obstacles) world.removeObstacle(o);
    },
  };
}

// ------------------------------------------------------------------ AI brain
class TankAI {
  constructor(tank, mode, world, opts) {
    this.tank = tank;
    this.mode = mode;                  // 'patrol' | 'ambush'
    this.world = world;
    this.z0 = opts.z0; this.z1 = opts.z1;
    this.dir = opts.dir || 1;
    this.lane = opts.lane || 2.5;
    this.watchZ = opts.watchZ;
    this.alert = false;
    this.lastSeen = -1e9;
    this.lastPos = new THREE.Vector3();
    this.losT = 0;
    this.los = false;
    this.fireDelay = 0;
    this.err = new THREE.Vector3();
    this.shots = 0;
    this.idle = 0;
    this.stuck = 0;
    this.reverse = 0;
    this.scan = Math.random() * 10;
    this.newError(200);
  }

  newError(dist) {
    const e = Math.max(0.6, dist * 0.028 * Math.max(0.3, 1 - this.shots * 0.2));
    this.err.set((Math.random() - 0.5) * 2 * e, (Math.random() - 0.5) * e, (Math.random() - 0.5) * 2 * e);
  }

  driveTo(x, z, frac) {
    const t = this.tank;
    const p = t.root.position;
    const want = Math.atan2(x - p.x, z - p.z);
    const diff = wrap(want - t.heading);
    t.controls.steer = THREE.MathUtils.clamp(diff * 2.5, -1, 1);
    const target = frac * t.maxSpeedEff * (Math.abs(diff) > 1.0 ? 0.2 : 1);
    t.controls.throttle = t.speed < target ? 1 : 0;
    t.controls.brake = t.speed > target + 1 ? 1 : 0;
  }

  update(dt, now, target, combat) {
    const t = this.tank;
    const c = t.controls;
    if (!t.crew || t.wrecked) { t.aimPoint = null; return; }
    c.throttle = 0; c.steer = 0; c.brake = 0;
    const p = t.root.position;

    // ---- perception
    let dist = Infinity;
    if (target) {
      dist = p.distanceTo(target.pos);
      const range = target.isTank ? (this.mode === 'ambush' ? 280 : 330) : 90;
      this.losT -= dt;
      if (this.losT <= 0) {
        this.losT = 0.4 + Math.random() * 0.2;
        const eye = t.turret.localToWorld(new THREE.Vector3(0, 1.2, 0));
        const tp = target.pos.clone(); tp.y += target.isTank ? 1.6 : 1.2;
        this.los = dist < range && this.world.lineOfSight(eye, tp, 5);
      }
      const recentlyHit = now - t.lastHitT < 6;
      if (this.los || (recentlyHit && dist < 600)) {
        if (!this.alert) this.fireDelay = 2 + Math.random() * 2;
        this.alert = true;
        this.lastSeen = now;
        this.lastPos.copy(target.pos);
      }
    }
    if (this.alert && now - this.lastSeen > 12) { this.alert = false; this.shots = 0; }

    // ---- engaged
    if (this.alert && target) {
      const tof = dist / t.def.shellSpeed;
      const aim = target.pos.clone().addScaledVector(target.vel, tof * 0.9);
      aim.y += target.isTank ? 1.3 : 0.9;
      aim.add(this.err);
      t.aimPoint = this.los ? aim : this.lastPos.clone().setY(this.lastPos.y + 1.5);

      if (this.mode === 'patrol') {
        const hullNeedsTurn = t.def.turretArc &&
          Math.abs(wrap(Math.atan2(target.pos.x - p.x, target.pos.z - p.z) - t.heading)) > t.def.turretArc * 0.8;
        if (!this.los || dist > 200) this.driveTo(this.lastPos.x, this.lastPos.z, 0.55);
        else if (hullNeedsTurn) this.driveTo(target.pos.x, target.pos.z, 0.02);
        else c.brake = 1;
      }

      this.fireDelay -= dt;
      if (this.los && this.fireDelay <= 0 && t.canFire && (t.aimError ?? 1) < 0.012) {
        if (combat.fireFrom(t)) {
          this.shots++;
          this.newError(dist);
          this.fireDelay = 0.5 + Math.random() * 1.5;
        }
      }
      this.handleStuck(dt);
      return;
    }

    // ---- idle behaviour
    this.scan += dt;
    if (this.mode === 'ambush') {
      const wz = this.watchZ + Math.sin(this.scan * 0.15) * 60;
      t.aimPoint = new THREE.Vector3(this.world.roadX(wz), this.world.roadH(wz) + 2, wz);
      return;
    }
    // patrol: wander along the road between z0 and z1, sometimes pausing
    if (this.idle > 0) {
      this.idle -= dt;
      c.brake = 1;
      t.aimPoint = p.clone().add(new THREE.Vector3(Math.sin(this.scan * 0.3) * 40, 2, Math.cos(this.scan * 0.3) * 40));
      return;
    }
    if (p.z > this.z1) this.dir = -1;
    if (p.z < this.z0) this.dir = 1;
    if (Math.random() < dt / 40) this.idle = 4 + Math.random() * 8;
    if (Math.random() < dt / 90) this.dir *= -1;
    const az = p.z + this.dir * 25;
    const ax = this.world.roadX(az) + this.lane * this.dir;
    this.driveTo(ax, az, 0.45);
    t.aimPoint = new THREE.Vector3(ax, this.world.roadH(az) + 2.5, p.z + this.dir * 80);
    this.handleStuck(dt);
  }

  handleStuck(dt) {
    const t = this.tank;
    if (this.reverse > 0) {
      this.reverse -= dt;
      t.controls.throttle = -1;
      t.controls.steer = 0.6;
      return;
    }
    if (t.controls.throttle > 0 && Math.abs(t.speed) < 0.3 && t.maxSpeedEff > 0) {
      this.stuck += dt;
      if (this.stuck > 3) { this.stuck = 0; this.reverse = 2; }
    } else this.stuck = 0;
  }
}

// ------------------------------------------------------------------ director
export class EnemyDirector {
  constructor(world, scene, seed) {
    this.world = world;
    this.scene = scene;
    this.seed = seed;
    this.spawned = new Set();
    this.ais = [];
    this.caponiers = [];
    this.disabled = dbg.get('notanks') === '1' || dbg.get('noenemies') === '1';
  }

  pickType(r) {
    const table = [['t55', 0.42], ['markV', 0.2], ['avre', 0.2], ['abrams', 0.18]];
    const sum = table.reduce((a, [, w]) => a + w, 0);
    let x = r() * sum;
    for (const [k, w] of table) { if ((x -= w) <= 0) return k; }
    return table[0][0];
  }

  makeTank(key, pos, heading, r, opts = {}) {
    return new Tank(this.scene, key, pos, heading, {
      team: 'enemy', crew: true, kits: r() < 0.55 ? 1 + (r() < 0.3 ? 1 : 0) : 0,
      torches: Math.random() < 0.2 ? 1 : 0, plates: Math.random() < 0.3 ? 1 : 0, ...opts,
    });
  }

  // spawn encounters ahead/around the player; returns newly created tanks
  update(playerPos, tanks) {
    const created = [];
    if (this.disabled) return created;
    const j0 = Math.floor(playerPos.z / ENC_LEN);
    for (let j = j0 - 1; j <= j0 + 2; j++) {
      if (j < 1 || this.spawned.has(j)) continue;
      const zc = (j + 0.5) * ENC_LEN;
      if (Math.abs(zc - playerPos.z) > 650) continue;
      this.spawned.add(j);
      const r = rng(Math.floor(hash(this.seed, j, 77) * 4294967296));
      const difficulty = Math.min(1, j / 25);
      const roll = r();
      if (roll < 0.42 - difficulty * 0.12) continue;           // quiet stretch
      if (roll < 0.74) {
        // patrol
        const n = r() < 0.25 + difficulty * 0.3 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const z = zc + (r() - 0.5) * 200 + i * 20;
          const dir = r() < 0.5 ? 1 : -1;
          const lane = 2.5;
          const x = this.world.roadX(z) + lane * dir + i * 6;
          const pos = new THREE.Vector3(x, 0, z);
          const t = this.makeTank(this.pickType(r), pos, dir > 0 ? this.world.roadHeading(z) : this.world.roadHeading(z) + Math.PI, r);
          this.ais.push(new TankAI(t, 'patrol', this.world, { z0: zc - 280, z1: zc + 280, dir, lane }));
          created.push(t);
        }
      } else {
        // ambush in caponiers facing the road
        const n = r() < 0.3 + difficulty * 0.3 ? 2 : 1;
        const side = r() < 0.5 ? -1 : 1;
        for (let i = 0; i < n; i++) {
          const z = zc + (r() - 0.5) * 120 + i * 45;
          if (this.world.settlementNear(this.world.roadX(z), z, 40)) continue;
          const off = side * (38 + r() * 25);
          const rx = this.world.roadX(z);
          const x = rx + off;
          if (this.world.heightAt(x, z) < this.world.WATER_LEVEL + 1) continue;
          const watchZ = z - 70;
          const heading = Math.atan2(this.world.roadX(watchZ) - x, watchZ - z);
          const cap = buildCaponier(this.world, x, z, heading);
          const t = this.makeTank(this.pickType(r), new THREE.Vector3(x, 0, z), heading, r, { sink: 1.1 });
          t.caponier = cap;
          this.caponiers.push(cap);
          this.ais.push(new TankAI(t, 'ambush', this.world, { watchZ }));
          created.push(t);
        }
      }
    }
    return created;
  }

  think(dt, now, target, combat) {
    for (const ai of this.ais) ai.update(dt, now, target, combat);
  }

  // forget AI for tanks that were removed / captured
  release(tank) {
    this.ais = this.ais.filter(a => a.tank !== tank);
    if (tank.caponier && !tank.root.parent) { tank.caponier.dispose(); tank.caponier = null; }
  }

  isEnemyActive(tank) { return this.ais.some(a => a.tank === tank && a.alert); }
}
