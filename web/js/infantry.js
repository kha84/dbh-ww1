// Infantry: enemy riflemen / machine gunners / tank crews that bailed out. Procedural low-poly soldiers,
// simple AI (guard, engage, flee from tanks, throw grenades), bullet / blast / run-over damage.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_LEVEL } from './world.js';
import { WEAPONS, GRENADES, SMALL_CATS, makeWeapon, bakedWeaponMesh, throwVelocity } from './weapons.js';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// ===================================================================== model
const UNIFORMS = {
  enemy: { cloth: 0x59604a, dark: 0x3f4535, helmet: 0x464d3a, boots: 0x2a241c },
  crew:  { cloth: 0x2e3033, dark: 0x222325, helmet: 0x18191a, boots: 0x18181a },
};
const SKIN = new THREE.Color(0xc39a7a);
const SMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05 });

// merge colored boxes / spheres into one geometry: parts = [[geo, color, x, y, z, sx, sy, sz]]
function mergeParts(parts) {
  const geos = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const [geo, color, x, y, z, sx, sy, sz, rx = 0] of parts) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    q.setFromEuler(new THREE.Euler(rx, 0, 0));
    g.applyMatrix4(m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
    geos.push(g);
  }
  return mergeGeometries(geos, false);
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(1, 10, 8);
const HEMI = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);

const geoCache = {};
function soldierGeos(kind) {
  if (geoCache[kind]) return geoCache[kind];
  const U = UNIFORMS[kind];
  geoCache[kind] = {
    // upper body: origin at the hips
    upper: mergeParts([
      [BOX, U.cloth, 0, 0.28, 0, 0.4, 0.56, 0.24],
      [BOX, U.dark, 0, 0.03, 0, 0.42, 0.08, 0.26],                   // belt
      [BOX, U.dark, 0.1, 0.36, 0.13, 0.12, 0.14, 0.05],              // pouches
      [BOX, U.dark, -0.1, 0.36, 0.13, 0.12, 0.14, 0.05],
      [BOX, SKIN, 0, 0.6, 0, 0.1, 0.08, 0.1],                        // neck
      [SPH, SKIN, 0, 0.72, 0.01, 0.105, 0.125, 0.11],                // head
      [HEMI, U.helmet, 0, 0.75, 0, 0.14, 0.12, 0.15],                // helmet
      [BOX, U.helmet, 0, 0.75, 0, 0.3, 0.015, 0.3],                  // brim
    ]),
    leg: mergeParts([
      [BOX, U.cloth, 0, -0.24, 0, 0.15, 0.5, 0.17],
      [BOX, U.cloth, 0, -0.64, 0, 0.13, 0.36, 0.15],
      [BOX, U.boots, 0, -0.86, 0.04, 0.14, 0.12, 0.26],
    ]),
    arm: mergeParts([
      [BOX, U.cloth, 0, -0.16, 0, 0.1, 0.34, 0.11],
      [BOX, U.cloth, 0, -0.44, 0, 0.09, 0.26, 0.1],
      [BOX, SKIN, 0, -0.61, 0, 0.08, 0.09, 0.09],
    ]),
  };
  return geoCache[kind];
}

function buildSoldier(kind, weaponKey) {
  const G = soldierGeos(kind);
  const root = new THREE.Group();
  const body = new THREE.Group();                 // pivots at the feet when the soldier falls
  root.add(body);
  const mk = (geo, parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const m = new THREE.Mesh(geo, SMAT);
    m.castShadow = true;
    g.add(m);
    parent.add(g);
    return g;
  };
  const legL = mk(G.leg, body, 0.1, 0.92, 0), legR = mk(G.leg, body, -0.1, 0.92, 0);
  const upper = mk(G.upper, body, 0, 0.92, 0);
  const armL = mk(G.arm, upper, 0.25, 0.52, 0), armR = mk(G.arm, upper, -0.25, 0.52, 0);
  const W = WEAPONS[weaponKey];
  const small = SMALL_CATS.includes(W.cat);
  const wm = bakedWeaponMesh(weaponKey);
  const gun = wm.group;
  if (small) { gun.position.set(-0.12, 0.38, 0.5); armR.rotation.set(-1.45, 0, 0.12); armL.rotation.set(-1.4, 0, -0.35); }
  else { gun.position.set(-0.08, 0.36, 0.26); armR.rotation.set(-1.25, 0, 0.1); armL.rotation.set(-1.45, 0, -0.55); }
  upper.add(gun);
  return { root, body, upper, legL, legR, armL, armR, gun, muzzle: wm.muzzle };
}

// ===================================================================== soldier
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
let SOLDIER_ID = 0;

export class Soldier {
  constructor(scene, pos, o) {
    this.id = ++SOLDIER_ID;
    this.scene = scene;
    this.kind = o.kind || 'enemy';
    this.team = 'enemy';
    this.weapon = makeWeapon(o.key);
    this.grenades = { ...(o.grenades || {}) };
    this.m = buildSoldier(this.kind, o.key);
    this.root = this.m.root;
    this.root.position.copy(pos);
    this.pos = this.root.position;
    this.heading = o.heading || 0;
    this.post = pos.clone();
    this.squad = o.squad || 0;
    this.mode = o.mode || 'guard';             // guard | flee
    this.fleeFrom = o.fleeFrom || null;
    this.fleeT = o.mode === 'flee' ? 4 + Math.random() * 3 : 0;
    this.skill = o.skill ?? (0.6 + Math.random() * 0.6);   // aim error multiplier (lower = better)
    this.hp = 100;
    this.alive = true;
    this.height = 1.78;
    this.alert = false;
    this.lastSeen = -1e9;
    this.lastPos = new THREE.Vector3();
    this.los = false;
    this.losT = Math.random() * 0.4;
    this.fireCd = 1 + Math.random();
    this.burst = 0;
    this.reloadT = 0;
    this.throwCd = 3 + Math.random() * 4;
    this.wander = null;
    this.wanderT = Math.random() * 5;
    this.strafe = 0;
    this.strafeT = 0;
    this.phase = Math.random() * 6;
    this.speedNow = 0;
    this.deathT = 0;
    this.pitch = 0;
    scene.add(this.root);
  }

  hit(dmg, owner, dir) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hurtT = 0.25;
    if (this.hp <= 0) { this.die(owner, dir); return; }
    this.alertReq = true;
  }

  die(owner, dir) {
    this.alive = false;
    this.hp = 0;
    this.killer = owner;
    this.fallDir = dir && Math.random() < 0.7 ? Math.atan2(dir.x, dir.z) : this.heading + Math.PI;
    if (this.onDeath) this.onDeath(this, owner);
  }

  dispose() { this.scene.remove(this.root); }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.55, this.pos.z); }
  muzzleWorld(out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.m.gun.localToWorld(out.set(0, 0.04, this.m.muzzle));
  }

  // ------------------------------------------------ AI
  think(dt, ctx) {
    if (!this.alive) { this.animateDeath(dt); return; }
    const W = WEAPONS[this.weapon.key];
    const tgt = ctx.target;
    const now = ctx.now;
    let dist = Infinity;
    if (tgt) {
      dist = Math.hypot(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
      this.losT -= dt;
      if (this.losT <= 0) {
        this.losT = 0.35 + Math.random() * 0.25;
        const range = tgt.isTank ? 230 : 150;
        const tp = _w.copy(tgt.pos); tp.y += tgt.isTank ? 1.6 : (tgt.crouch ? 0.9 : 1.4);
        this.los = dist < range && ctx.world.lineOfSight(this.eye(_v), tp, 4) &&
                   !ctx.world.raycastObstacles(this.eye(_v), tp);
      }
      if (this.alertReq || (this.los && (this.alert || dist < (tgt.isTank ? 200 : 110)))) {
        if (!this.alert) { this.fireCd = 1.2 + Math.random() * 1.6; ctx.alertSquad(this); }
        this.alert = true;
        this.lastSeen = now;
        this.lastPos.copy(tgt.pos);
      }
      this.alertReq = false;
    } else this.los = false;
    if (this.alert && now - this.lastSeen > 18) this.alert = false;

    let mvx = 0, mvz = 0, speed = 0;
    let face = null;
    if (this.mode === 'flee' && this.fleeT > 0) {
      // bailed-out crew: run away from the burning tank first
      this.fleeT -= dt;
      const f = this.fleeFrom;
      const a = f ? Math.atan2(this.pos.x - f.x, this.pos.z - f.z) : this.heading;
      mvx = Math.sin(a); mvz = Math.cos(a); speed = 5.2;
      face = a;
      if (this.fleeT <= 0) { this.mode = 'guard'; this.post.copy(this.pos); if (tgt) { this.alert = true; this.lastSeen = now; this.lastPos.copy(tgt.pos); } }
    } else if (this.alert && tgt) {
      const toT = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
      face = toT;
      const at = Object.keys(this.grenades).find(k => GRENADES[k].pen && this.grenades[k] > 0);
      const he = Object.keys(this.grenades).find(k => !GRENADES[k].pen && this.grenades[k] > 0);
      this.throwCd -= dt;
      if (tgt.isTank) {
        if (at && dist < 45) {
          // tank hunter: close in and throw the anti-tank grenade
          if (dist > 13) { mvx = Math.sin(toT); mvz = Math.cos(toT); speed = 5.4; }
          if (dist < 18 && this.throwCd <= 0 && this.los) this.throwAt(ctx, at, _v.copy(tgt.pos).setY(tgt.pos.y + 1.4));
        } else if (dist < 16) {
          const a = toT + Math.PI + (this.id % 2 ? 0.6 : -0.6);
          mvx = Math.sin(a); mvz = Math.cos(a); speed = 5.2;
          face = a;
        }
      } else {
        const want = Math.min(W.range * 0.75, 85);
        if (!this.los) {
          const lp = this.lastPos;
          if (Math.hypot(lp.x - this.pos.x, lp.z - this.pos.z) > 3) {
            const a = Math.atan2(lp.x - this.pos.x, lp.z - this.pos.z);
            mvx = Math.sin(a); mvz = Math.cos(a); speed = 4.2;
          }
        } else if (dist > want) {
          mvx = Math.sin(toT); mvz = Math.cos(toT); speed = 3.2;
        } else {
          this.strafeT -= dt;
          if (this.strafeT <= 0) { this.strafeT = 1.5 + Math.random() * 2.5; this.strafe = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
          if (this.strafe) { const a = toT + this.strafe * Math.PI / 2; mvx = Math.sin(a); mvz = Math.cos(a); speed = 2.2; }
        }
        if (he && this.los && dist > 9 && dist < 30 && this.throwCd <= 0 && Math.random() < dt * 0.25) {
          this.throwAt(ctx, he, _v.copy(tgt.pos));
        }
      }
      // shooting
      this.fireCd -= dt;
      if (this.reloadT > 0) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) this.weapon.mag = W.mag;
      } else if (this.los && this.fireCd <= 0 && Math.abs(wrap(toT - this.heading)) < 0.3 && dist < W.range * 1.8) {
        if (this.weapon.mag <= 0) this.reloadT = W.reload * 1.3;
        else this.shoot(ctx, W, tgt, dist, speed > 0);
      }
      this.pitch = Math.atan2(tgt.pos.y + (tgt.isTank ? 1.2 : 1.0) - (this.pos.y + 1.4), Math.max(1, dist));
    } else {
      // guard: loiter around the post
      this.pitch *= 0.9;
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 4 + Math.random() * 8;
        this.wander = Math.random() < 0.55 ? null
          : new THREE.Vector3(this.post.x + (Math.random() - 0.5) * 14, 0, this.post.z + (Math.random() - 0.5) * 14);
      }
      if (this.wander) {
        const dx = this.wander.x - this.pos.x, dz = this.wander.z - this.pos.z;
        if (Math.hypot(dx, dz) > 0.8) { const a = Math.atan2(dx, dz); mvx = Math.sin(a); mvz = Math.cos(a); speed = 1.4; face = a; }
        else this.wander = null;
      }
    }

    // turn & move
    if (face !== null) {
      const d = wrap(face - this.heading);
      this.heading += THREE.MathUtils.clamp(d, -5 * dt, 5 * dt);
    }
    this.move(dt, ctx, mvx * speed, mvz * speed);
    this.animate(dt);
  }

  shoot(ctx, W, tgt, dist, moving) {
    const muzzle = this.muzzleWorld(new THREE.Vector3());
    const origin = this.eye(new THREE.Vector3());
    const aim = _w.copy(tgt.pos);
    aim.y += tgt.isTank ? 1.3 + Math.random() * 0.6 : (tgt.crouch ? 0.8 : 1.15);
    // lead a moving target a little
    aim.addScaledVector(tgt.vel, Math.min(0.4, dist / 600));
    const dir = aim.sub(origin).normalize();
    const err = ((W.auto ? W.spread * 0.8 : W.aim * 2) + 0.02 + dist * 0.00022) * this.skill * (moving ? 1.8 : 1);
    dir.x += (Math.random() - 0.5) * 2 * err;
    dir.y += (Math.random() - 0.5) * 2 * err;
    dir.z += (Math.random() - 0.5) * 2 * err;
    dir.normalize();
    ctx.guns.fire(origin, dir, W, { soldier: this }, muzzle);
    this.weapon.mag--;
    if (W.auto) {
      if (this.burst <= 0) this.burst = 3 + Math.floor(Math.random() * (W.cat === 'mg' ? 8 : 4));
      this.burst--;
      this.fireCd = this.burst > 0 ? 60 / W.rpm : 0.8 + Math.random() * 1.5;
    } else this.fireCd = 60 / W.rpm + 0.7 + Math.random() * 1.2;
  }

  throwAt(ctx, key, target) {
    const from = this.eye(new THREE.Vector3());
    from.y += 0.2;
    const t = target.clone();
    t.x += (Math.random() - 0.5) * 3 * this.skill;
    t.z += (Math.random() - 0.5) * 3 * this.skill;
    ctx.guns.throwGrenade(from, throwVelocity(from, t, 15), key, { soldier: this });
    this.grenades[key]--;
    this.throwCd = 6 + Math.random() * 6;
    this.fireCd = Math.max(this.fireCd, 1);
  }

  move(dt, ctx, vx, vz) {
    const p = this.pos;
    const ox = p.x, oz = p.z;
    p.x += vx * dt; p.z += vz * dt;
    const w = ctx.world;
    if (w.heightAt(p.x, p.z) < WATER_LEVEL - 0.4) { p.x = ox; p.z = oz; }
    w.collideTrees(p, 0.3);
    w.collideObstacles(p, 0.35);
    p.y = w.heightAt(p.x, p.z);
    this.speedNow = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-4);
  }

  animate(dt) {
    const s = Math.min(1, this.speedNow / 4);
    this.phase += dt * (2 + this.speedNow * 2.2);
    const a = Math.sin(this.phase) * 0.7 * s;
    this.m.legL.rotation.x = a;
    this.m.legR.rotation.x = -a;
    this.m.upper.rotation.x = -this.pitch * 0.6;
    this.m.upper.position.y = 0.92 + Math.abs(Math.cos(this.phase)) * 0.04 * s;
    this.root.rotation.y = this.heading;
  }

  animateDeath(dt) {
    if (this.deathT > 1.2) return;
    this.deathT += dt;
    const k = Math.min(1, this.deathT * 2.4);
    this.root.rotation.y = this.fallDir + Math.PI;
    this.m.body.rotation.x = -k * k * Math.PI / 2 * 0.97;
    this.m.body.position.y = 0.05 * k;
    this.m.legL.rotation.x = 0.2 * k;
    this.m.legR.rotation.x = -0.15 * k;
    this.m.armL.rotation.set(-2.6 * k, 0, 0.3 * k);
    this.m.armR.rotation.set(-2.9 * k, 0, -0.4 * k);
  }
}

// ===================================================================== director
export class Infantry {
  constructor(scene, world, guns) {
    this.scene = scene;
    this.world = world;
    this.guns = guns;
    this.soldiers = [];
    this.squadN = 0;
    this.onDeath = () => {};
    this.kills = 0;
  }

  spawn(x, z, o) {
    const y = this.world.heightAt(x, z);
    if (y < WATER_LEVEL) return null;
    const p = new THREE.Vector3(x, y, z);
    this.world.collideObstacles(p, 0.4);
    p.y = this.world.heightAt(p.x, p.z);
    const s = new Soldier(this.scene, p, o);
    s.onDeath = (sd, owner) => this.onDeath(sd, owner);
    this.soldiers.push(s);
    return s;
  }

  // group of soldiers around (x, z); kits: [{ key, grenades }]
  spawnSquad(x, z, kits, heading = 0, r = Math.random) {
    const squad = ++this.squadN;
    const res = [];
    kits.forEach((k, i) => {
      const a = i / kits.length * Math.PI * 2 + r();
      const d = i ? 2 + r() * 4 : 0;
      const s = this.spawn(x + Math.sin(a) * d, z + Math.cos(a) * d, { ...k, squad, heading: heading + (r() - 0.5) * 1.5 });
      if (s) res.push(s);
    });
    return res;
  }

  // crew bails out of a burning tank
  spawnCrew(tank, kits) {
    const squad = ++this.squadN;
    const p = tank.root.position;
    const b = tank.vis.hullBox;
    const res = [];
    kits.forEach((k, i) => {
      const side = i % 2 ? 1 : -1;
      const off = new THREE.Vector3(side * (b.max.x + 0.8), 0, (i - 1) * 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.heading);
      const s = this.spawn(p.x + off.x, p.z + off.z, { ...k, kind: 'crew', squad, mode: 'flee', fleeFrom: p.clone(), heading: tank.heading });
      if (s) res.push(s);
    });
    return res;
  }

  alertSquad(src) {
    for (const s of this.soldiers) {
      if (s !== src && s.alive && s.squad === src.squad && !s.alert && s.pos.distanceTo(src.pos) < 90) s.alertReq = true;
    }
  }

  // blast: shells, grenades
  explosion(pos, r, dmg, owner) {
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = _v.set(s.pos.x, s.pos.y + 0.9, s.pos.z).distanceTo(pos);
      if (d < r) s.hit(dmg * (1 - d / r) + 10, owner, _w.copy(s.pos).sub(pos).setY(0).normalize());
      else if (d < r * 3) s.alertReq = true;
    }
  }

  update(dt, ctx) {
    ctx.world = this.world;
    ctx.guns = this.guns;
    ctx.alertSquad = s => this.alertSquad(s);
    for (const s of this.soldiers) s.think(dt, ctx);
    // tanks: push soldiers aside, run over those who don't get away
    for (const t of ctx.tanks) {
      const tp = t.root.position;
      const b = t.vis.hullBox;
      const c = Math.cos(t.heading), sn = Math.sin(t.heading);
      for (const s of this.soldiers) {
        if (!s.alive) continue;
        const dx = s.pos.x - tp.x, dz = s.pos.z - tp.z;
        if (dx * dx + dz * dz > 40) continue;
        const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
        const m = 0.3;
        if (lx > b.min.x - m && lx < b.max.x + m && lz > b.min.z - m && lz < b.max.z + m) {
          if (Math.abs(t.speed) > 1.2) { s.hit(500, t.playerInside ? { player: true, tank: t } : { tank: t }, null); continue; }
          // push out along the smallest overlap
          const pen = [[lx - (b.min.x - m), -1, 0], [(b.max.x + m) - lx, 1, 0], [lz - (b.min.z - m), 0, -1], [(b.max.z + m) - lz, 0, 1]]
            .sort((a, q) => a[0] - q[0])[0];
          const nlx = lx + pen[1] * pen[0], nlz = lz + pen[2] * pen[0];
          s.pos.x = tp.x + nlx * c + nlz * sn;
          s.pos.z = tp.z - nlx * sn + nlz * c;
        }
      }
    }
  }

  // forget soldiers far from the player; bodies disappear after a while
  prune(anchor, dist = 700) {
    this.soldiers = this.soldiers.filter(s => {
      const far = Math.hypot(s.pos.x - anchor.x, s.pos.z - anchor.z) > dist;
      const old = !s.alive && s.deathT > 1.2 && (s.goneT = (s.goneT || 0) + 1) > 60;
      if (far || old) { s.dispose(); return false; }
      return true;
    });
  }
}
