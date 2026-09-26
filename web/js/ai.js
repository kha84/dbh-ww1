// Enemy tanks: encounter spawner along the road (patrols and dug-in ambushes) + simple AI
import * as THREE from 'three';
import { hash, rng } from './noise.js';
import { Tank, sandbagMesh } from './tanks.js';
import { HULLS } from './parts.js';
import { makeWeapon } from './weapons.js';
import { difficultyAt, pickTankKey, soldierKit, lootRoll } from './loot.js';

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
export class TankAI {
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
    this.mgBurst = 0;
    this.mgPause = 1 + Math.random();
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

  update(dt, now, target, combat, guns) {
    const t = this.tank;
    const c = t.controls;
    if (!t.crew || t.wrecked) { t.aimPoint = null; t.mgTarget = null; return; }
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

      // machine gun against a man on foot
      t.mgTarget = null;
      if (!target.isTank && t.mg && t.mgAmmo > 0 && this.los && dist < 320 && guns) {
        t.mgTarget = target.pos.clone().setY(target.pos.y + 0.9).addScaledVector(this.err, 0.4);
        if (this.mgPause > 0) this.mgPause -= dt;
        else if ((t.mgAimErr ?? 1) < 0.06) {
          for (let k = 0; k < 3 && this.mgPause <= 0; k++) {
            const sh = t.fireMG(1 + dist / 160);
            if (!sh) break;
            guns.fire(sh.origin, sh.dir, sh.W, { tank: t }, sh.origin, Math.random() < 0.5);
            if (--this.mgBurst <= 0) { this.mgBurst = 4 + Math.floor(Math.random() * 9); this.mgPause = 0.7 + Math.random() * 1.6; }
          }
        }
      }

      this.fireDelay -= dt;
      const gunOk = target.isTank || dist < 90 || !t.mg;
      if (gunOk && this.los && this.fireDelay <= 0 && t.canFire && (t.aimError ?? 1) < 0.012) {
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
    t.mgTarget = null;
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
  constructor(world, scene, seed, infantry) {
    this.world = world;
    this.scene = scene;
    this.seed = seed;
    this.infantry = infantry;
    this.guns = null;
    this.spawned = new Set();
    this.ais = [];
    this.caponiers = [];
    this.props = [];                // roadside scenery of posts (sandbag walls)
    this.onLoot = () => {};         // (id, type, x, z, data): loot lying on the ground
    this.disabled = dbg.get('notanks') === '1' || dbg.get('noenemies') === '1';
    this.noInfantry = dbg.get('noinfantry') === '1' || dbg.get('noenemies') === '1';
  }

  // tank type by how far down the road we are
  pickType(r, z) { return pickTankKey(r, difficultyAt(z)); }

  // loot stowed inside a tank (captured / knocked out ones can be emptied)
  stowLoot(cargo, r, d, n) {
    let kits = 0;
    for (const it of lootRoll(r, d, n)) {
      if (it.type === 'weapon') { if (cargo.weapons.length < 5) cargo.weapons.push(makeWeapon(it.key, it.mag)); }
      else if (it.type === 'ammo') cargo.ammo[it.cal] = (cargo.ammo[it.cal] || 0) + it.n;
      else if (it.type === 'grenade') cargo.grenades[it.key] = (cargo.grenades[it.key] || 0) + it.n;
      else kits++;
    }
    return kits;
  }

  makeTank(key, pos, heading, r, opts = {}) {
    const t = new Tank(this.scene, key, pos, heading, {
      team: 'enemy', crew: true, kits: r() < 0.55 ? 1 + (r() < 0.3 ? 1 : 0) : 0,
      torches: Math.random() < 0.2 ? 1 : 0, plates: Math.random() < 0.3 ? 1 : 0,
      bags: r() < 0.25 ? 1 + Math.floor(r() * 4) : 0, ...opts,
    });
    t.loot.repair_kit += this.stowLoot(t.cargo, r, difficultyAt(pos.z), r() < 0.5 ? 1 : 2);
    return t;
  }

  squad(x, z, n, r, d, heading) {
    if (this.noInfantry || !this.infantry) return [];
    const kits = [];
    for (let i = 0; i < n; i++) kits.push(soldierKit(r, d));
    return this.infantry.spawnSquad(x, z, kits, heading, r);
  }

  // roadside post: a sandbag wall with a squad behind it and a couple of spare bags
  spawnPost(j, zc, r, d) {
    const z = zc + (r() - 0.5) * 260;
    if (this.world.settlementNear(this.world.roadX(z), z, 40)) return;
    const side = r() < 0.5 ? -1 : 1;
    const hd = this.world.roadHeading(z);
    const sx = Math.cos(hd), sz = -Math.sin(hd);
    const off = side * (9 + r() * 6);
    const x = this.world.roadX(z) + sx * off, zz = z + sz * off;
    if (this.world.heightAt(x, zz) < this.world.WATER_LEVEL + 0.8) return;
    const face = side > 0 ? hd - Math.PI / 2 : hd + Math.PI / 2;      // facing the road
    const g = new THREE.Group();
    for (let i = -2; i <= 2; i++) {
      for (let k = 0; k < 2; k++) {
        const b = sandbagMesh();
        const px = x - sx * side * 1.2 + Math.sin(hd) * i * 0.75, pz = zz - sz * side * 1.2 + Math.cos(hd) * i * 0.75;
        b.position.set(px, this.world.heightAt(px, pz) + k * 0.33, pz);
        b.rotation.y = hd + (k ? 0.3 : 0);
        g.add(b);
      }
    }
    this.scene.add(g);
    this.props.push({ group: g, z: zz });
    this.squad(x + Math.sin(hd) * 2, zz + Math.cos(hd) * 2, 3 + Math.floor(r() * 3 + d * 2), r, d, face);
    const nb = 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < nb; i++) this.onLoot(`p${j}:${i}`, 'sandbag', x + sx * side * 2.5 + i * 1.2, zz + sz * side * 2.5);
    if (r() < 0.5) this.onLoot(`p${j}:a`, 'ammo', x + sx * side * 2.2 - 1.5, zz + sz * side * 2.2, lootRoll(r, d, 1).find(l => l.type === 'ammo') || null);
  }

  // knocked-out vehicles by the road: partly broken, some burnt out; they hold loot
  spawnWreck(j, zc, r, d, created) {
    const z = zc + (r() - 0.5) * 300;
    if (this.world.settlementNear(this.world.roadX(z), z, 30)) return;
    const side = r() < 0.5 ? -1 : 1;
    const hd = this.world.roadHeading(z);
    const n = r() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const zz = z + i * 14;
      const off = side * (7 + r() * 14);
      const x = this.world.roadX(zz) + Math.cos(hd) * off, z2 = zz - Math.sin(hd) * off;
      if (this.world.heightAt(x, z2) < this.world.WATER_LEVEL + 0.6) continue;
      const key = this.pickType(r, zz);
      const heading = hd + (r() - 0.5) * 1.4 + (r() < 0.4 ? Math.PI : 0);
      const burnt = r() < 0.35;
      const t = new Tank(this.scene, key, new THREE.Vector3(x, 0, z2), heading, {
        team: 'neutral', crew: false, kits: r() < 0.4 ? 1 : 0, fuelFrac: r() * 0.35,
        mg: r() < 0.65 ? undefined : null, mgAmmo: Math.floor(r() * 250), ammo: Math.floor(HULLS[key].ammoMax * r() * 0.5),
        plates: r() < 0.25 ? 1 : 0, torches: r() < 0.12 ? 1 : 0,
      });
      t.derelict = true;
      // battle damage
      t.hp.engine = r() < 0.45 ? 0 : 15 + r() * 55;
      t.hp.transmission = r() < 0.35 ? 0 : 25 + r() * 60;
      t.hp.hull = 20 + r() * 55;
      if (t.parts.gun) t.hp.gun = r() < 0.25 ? 0 : 35 + r() * 65;
      if (t.parts.drive) t.hp.turret = 30 + r() * 70;
      if (t.parts.fuel) t.hp.fuel = 30 + r() * 70;
      t.hp.ammo = 30 + r() * 70;
      if (r() < 0.2) t.setPart('engine', null);
      else if (r() < 0.15 && t.parts.gun) t.setPart('gun', null);
      const b = t.vis.hullBox;
      const nm = 2 + Math.floor(r() * 4);
      for (let k = 0; k < nm; k++) {
        const sx = r() < 0.5 ? -1 : 1;
        const lp = new THREE.Vector3(sx * b.max.x, b.min.y + (b.max.y - b.min.y) * (0.35 + r() * 0.5), b.min.z + (b.max.z - b.min.z) * r());
        const dir = new THREE.Vector3(-sx, 0, 0).applyQuaternion(t.root.quaternion);
        t.addMark(t.root.localToWorld(lp), dir, r() < 0.7 ? 'hole' : 'dent');
      }
      t.turretYaw = (r() - 0.5) * 2;
      if (burnt) {
        t.makeWreck();
        lootRoll(r, d, 2 + Math.floor(r() * 3)).forEach((it, k) => {
          const a = r() * Math.PI * 2, rr = 4 + r() * 3;
          this.onLoot(`w${j}:${i}:${k}`, it.type, x + Math.sin(a) * rr, z2 + Math.cos(a) * rr, it);
        });
      } else {
        t.loot.repair_kit += this.stowLoot(t.cargo, r, d, 2 + Math.floor(r() * 3));
      }
      if (r() < 0.4) this.onLoot(`w${j}:${i}:c`, 'canister', x + Math.cos(hd) * side * 4, z2 - Math.sin(hd) * side * 4, { fuel: 20 });
      created.push(t);
    }
    // sometimes the wreck is watched
    if (r() < 0.35) this.squad(this.world.roadX(z) + Math.cos(hd) * side * 22, z - Math.sin(hd) * side * 22, 2 + Math.floor(r() * 2), r, d, hd);
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
      const d = difficultyAt(zc);
      // independent of the tank encounter: knocked-out vehicles and infantry posts
      const r2 = rng(Math.floor(hash(this.seed, j, 313) * 4294967296));
      if (r2() < 0.4) this.spawnWreck(j, zc, r2, d, created);
      if (r2() < 0.28 + d * 0.25) this.spawnPost(j, zc, r2, d);
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
          const t = this.makeTank(this.pickType(r, z), pos, dir > 0 ? this.world.roadHeading(z) : this.world.roadHeading(z) + Math.PI, r);
          this.ais.push(new TankAI(t, 'patrol', this.world, { z0: zc - 280, z1: zc + 280, dir, lane }));
          created.push(t);
        }
        if (r() < 0.45) this.squad(this.world.roadX(zc) + (r() < 0.5 ? -12 : 12), zc + (r() - 0.5) * 100, 2 + Math.floor(r() * 3), r, d, 0);
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
          const t = this.makeTank(this.pickType(r, z), new THREE.Vector3(x, 0, z), heading, r, { sink: 1.1 });
          t.caponier = cap;
          this.caponiers.push(cap);
          this.ais.push(new TankAI(t, 'ambush', this.world, { watchZ }));
          created.push(t);
          if (r() < 0.4) this.squad(x - Math.sin(heading) * 7, z - Math.cos(heading) * 7, 2, r, d, heading);
        }
      }
    }
    return created;
  }

  think(dt, now, target, combat) {
    for (const ai of this.ais) ai.update(dt, now, target, combat, this.guns);
  }

  // remove scenery far behind / ahead
  prune(anchor) {
    this.props = this.props.filter(p => {
      if (Math.abs(p.z - anchor.z) < 1600) return true;
      this.scene.remove(p.group);
      return false;
    });
  }

  // forget AI for tanks that were removed / captured
  release(tank) {
    this.ais = this.ais.filter(a => a.tank !== tank);
    if (tank.caponier && !tank.root.parent) { tank.caponier.dispose(); tank.caponier = null; }
  }

  isEnemyActive(tank) { return this.ais.some(a => a.tank === tank && a.alert); }
}
