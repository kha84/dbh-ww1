// Shells (ballistics, hit tests), armour penetration / module damage, visual effects
import * as THREE from 'three';
import { WATER_LEVEL, segBox } from './world.js';
import { G, MODULE_NAMES } from './tanks.js';

// ===================================================================== effects
function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.45, outer);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PTYPES = {
  fire:  { add: true,  color: 0xffa040, life: [0.5, 0.9],  size: [1.2, 3.2], rise: 3.0, alpha: 0.9 },
  flash: { add: true,  color: 0xffe0a0, life: [0.08, 0.14], size: [2.5, 5],   rise: 0,   alpha: 1.0 },
  spark: { add: true,  color: 0xffd070, life: [0.25, 0.5], size: [0.35, 0.1], rise: 0,   alpha: 1.0, grav: 1 },
  smoke: { add: false, color: 0x4a4744, life: [2.5, 4.5],  size: [1.5, 7],   rise: 2.2, alpha: 0.55 },
  dust:  { add: false, color: 0x8a7a5e, life: [1.2, 2.2],  size: [1.5, 6],   rise: 1.0, alpha: 0.6 },
  steam: { add: false, color: 0xdde6ea, life: [1.0, 1.8],  size: [1.2, 5],   rise: 2.5, alpha: 0.5 },
  weld:  { add: true,  color: 0x9fd0ff, life: [0.1, 0.25], size: [0.6, 0.2], rise: 0,   alpha: 1.0, grav: 1 },
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)');
    this.parts = [];
    this.pool = [];
    this.MAX = 700;
  }

  spawn(type, pos, vel, scale = 1) {
    const T = PTYPES[type];
    let p = this.pool.pop();
    if (!p) {
      if (this.parts.length >= this.MAX) return;
      const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false });
      p = { sprite: new THREE.Sprite(mat), vel: new THREE.Vector3() };
    }
    const m = p.sprite.material;
    m.blending = T.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.color.setHex(T.color);
    m.opacity = T.alpha;
    m.rotation = Math.random() * Math.PI * 2;
    p.type = T;
    p.life = p.max = T.life[0] + Math.random() * (T.life[1] - T.life[0]);
    p.s0 = T.size[0] * scale; p.s1 = T.size[1] * scale;
    p.sprite.position.copy(pos);
    p.vel.copy(vel || _zero);
    p.vel.y += T.rise * (0.6 + Math.random() * 0.8);
    p.sprite.scale.setScalar(p.s0);
    this.scene.add(p.sprite);
    this.parts.push(p);
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        this.pool.push(p);
        continue;
      }
      const k = 1 - p.life / p.max;
      if (p.type.grav) p.vel.y -= G * dt;
      else p.vel.multiplyScalar(Math.pow(0.4, dt));
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.scale.setScalar(p.s0 + (p.s1 - p.s0) * Math.sqrt(k));
      p.sprite.material.opacity = p.type.alpha * (1 - k) * (p.type.add ? 1 : Math.min(1, k * 6));
      if (p.type === PTYPES.fire) p.sprite.material.color.setRGB(1, 0.65 - k * 0.45, 0.25 - k * 0.2);
    }
  }

  rnd(s) { return _r.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }

  explosion(pos, scale = 1, dirt = true) {
    this.spawn('flash', pos, null, scale);
    for (let i = 0; i < 8; i++) this.spawn('fire', pos, this.rnd(8 * scale), scale * 0.8);
    for (let i = 0; i < 10; i++) this.spawn('spark', pos, this.rnd(26).add(_up.set(0, 8, 0)), 1);
    for (let i = 0; i < 5; i++) this.spawn(dirt ? 'dust' : 'smoke', pos, this.rnd(5 * scale), scale);
  }
  splash(pos) {
    for (let i = 0; i < 10; i++) this.spawn('steam', pos, this.rnd(4).add(_up.set(0, 5 + Math.random() * 6, 0)), 1);
  }
  muzzle(pos, dir) {
    this.spawn('flash', pos, null, 0.9);
    for (let i = 0; i < 4; i++) this.spawn('fire', pos, dir.clone().multiplyScalar(6 + i * 3), 0.5);
    for (let i = 0; i < 5; i++) this.spawn('smoke', pos, dir.clone().multiplyScalar(3 + Math.random() * 4).add(this.rnd(2)), 0.8);
  }
  ricochet(pos) {
    for (let i = 0; i < 12; i++) this.spawn('spark', pos, this.rnd(30), 1);
  }
  burn(pos, intensity = 1) {
    if (Math.random() < 0.9 * intensity) this.spawn('fire', pos.clone().add(this.rnd(1.6)), this.rnd(1), 0.9);
    if (Math.random() < 0.35 * intensity) this.spawn('smoke', pos.clone().add(this.rnd(1)).setY(pos.y + 1), this.rnd(1), 1.2);
  }
  smokeTrail(pos, intensity = 1) {
    if (Math.random() < 0.25 * intensity) this.spawn('smoke', pos.clone().add(this.rnd(1.5)), this.rnd(0.8), 1);
  }
  weld(pos) {
    for (let i = 0; i < 2; i++) this.spawn('weld', pos, this.rnd(10), 1);
  }
}
const _zero = new THREE.Vector3(), _r = new THREE.Vector3(), _up = new THREE.Vector3();

// ===================================================================== combat
const _inv = new THREE.Matrix4();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _box = new THREE.Box3();
const rand = (a, b) => a + Math.random() * (b - a);

export class Combat {
  constructor(scene, world, effects, sfx) {
    this.scene = scene;
    this.world = world;
    this.fx = effects;
    this.sfx = sfx;
    this.shells = [];
    this.tanks = [];                 // set by the game each frame
    this.foot = null;                // { pos, active } on-foot player target
    this.listener = new THREE.Vector3();
    this.onEvent = () => {};
    this.onPlayerDamage = () => {};
    this.god = false;
    const tg = new THREE.CylinderGeometry(0.07, 0.07, 3.0, 5);
    this.tracerGeo = tg;
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  fireFrom(tank) {
    const s = tank.shoot();
    if (!s) return false;
    const dir = s.vel.clone().normalize();
    this.fx.muzzle(s.pos, dir);
    const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    mesh.position.copy(s.pos);
    this.scene.add(mesh);
    this.shells.push({ ...s, mesh, life: 7 });
    this.sfx.shot(s.pos.distanceTo(this.listener));
    return true;
  }

  update(dt) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.life -= dt;
      let done = s.life <= 0;
      const steps = Math.max(1, Math.ceil(s.vel.length() * dt / 30));
      const h = dt / steps;
      for (let k = 0; k < steps && !done; k++) done = this.step(s, h);
      if (done) {
        this.scene.remove(s.mesh);
        this.shells.splice(i, 1);
      } else {
        s.mesh.position.copy(s.pos);
        s.mesh.quaternion.setFromUnitVectors(_up.set(0, 1, 0), _a.copy(s.vel).normalize());
      }
    }
  }

  // advance one sub-step; returns true when the shell is spent
  step(s, h) {
    const p0 = _a.copy(s.pos);
    s.vel.y -= G * h;
    const p1 = _b.copy(p0).addScaledVector(s.vel, h);
    let best = null;

    // tanks
    for (const t of this.tanks) {
      if (t === s.owner) continue;
      const tp = t.root.position;
      const mx = (p0.x + p1.x) / 2 - tp.x, mz = (p0.z + p1.z) / 2 - tp.z;
      const half = p0.distanceTo(p1) / 2 + 8;
      if (mx * mx + mz * mz > half * half) continue;
      for (const vol of t.hitVolumes()) {
        _inv.copy(vol.obj.matrixWorld).invert();
        const l0 = _c.copy(p0).applyMatrix4(_inv);
        const l0x = l0.x, l0y = l0.y, l0z = l0.z;
        const l1 = _c.copy(p1).applyMatrix4(_inv);
        const b = vol.box;
        const tt = segBox(l0x, l0y, l0z, l1.x, l1.y, l1.z, b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z);
        if (tt !== null && (!best || tt < best.t)) best = { t: tt, kind: 'tank', tank: t, vol };
      }
    }
    // static obstacles
    const ob = this.world.raycastObstacles(p0, p1);
    if (ob && (!best || ob.t < best.t)) best = { t: ob.t, kind: 'obstacle' };
    // terrain & water
    const len = p0.distanceTo(p1);
    const n = Math.max(1, Math.ceil(len / 2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (best && t > best.t) break;
      const x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t, z = p0.z + (p1.z - p0.z) * t;
      const gh = this.world.heightAt(x, z);
      const floor = Math.max(gh, WATER_LEVEL);
      if (y < floor) {
        let lo = (i - 1) / n, hi = t;
        for (let r = 0; r < 6; r++) {
          const m = (lo + hi) / 2;
          const xm = p0.x + (p1.x - p0.x) * m, zm = p0.z + (p1.z - p0.z) * m, ym = p0.y + (p1.y - p0.y) * m;
          if (ym < Math.max(this.world.heightAt(xm, zm), WATER_LEVEL)) hi = m; else lo = m;
        }
        best = { t: hi, kind: gh < WATER_LEVEL ? 'water' : 'ground' };
        break;
      }
    }
    // player on foot
    if (this.foot && this.foot.active) {
      const fp = this.foot.pos;
      _c.set(fp.x, fp.y + 0.9, fp.z);
      const d = _c.clone().sub(p0);
      const seg = p1.clone().sub(p0);
      const tt = THREE.MathUtils.clamp(d.dot(seg) / Math.max(1e-6, seg.lengthSq()), 0, 1);
      const closest = p0.clone().addScaledVector(seg, tt);
      if (closest.distanceTo(_c) < 0.7 && (!best || tt < best.t)) best = { t: tt, kind: 'foot' };
    }

    if (!best) { s.pos.copy(p1); return false; }

    const hp = p0.clone().lerp(p1, best.t);
    const dir = s.vel.clone().normalize();
    if (best.kind === 'tank') {
      this.hitTank(best.tank, best.vol, hp, dir, s);
    } else if (best.kind === 'water') {
      this.fx.splash(hp);
      this.sfx.boom(hp.distanceTo(this.listener), 0.4);
    } else {
      this.fx.explosion(hp, 1, best.kind === 'ground');
      this.sfx.boom(hp.distanceTo(this.listener), 1);
      if (best.kind === 'foot' && !this.god) this.onPlayerDamage(200, s.owner);
    }
    this.splashDamage(hp, s);
    return true;
  }

  splashDamage(p, s) {
    if (!this.foot || !this.foot.active || this.god) return;
    const d = p.distanceTo(this.foot.pos);
    if (d < 6) this.onPlayerDamage((1 - d / 6) * 110 * s.dmg, s.owner);
  }

  // sample the shell path through the tank and collect touched modules / crew zones
  pathModules(tank, start, dir, len, extOnly) {
    const res = new Set();
    let crew = false;
    const invH = new THREE.Matrix4().copy(tank.root.matrixWorld).invert();
    const invT = new THREE.Matrix4().copy(tank.turret.matrixWorld).invert();
    const hasT = !!tank.vis.turretBox;
    const pt = new THREE.Vector3(), lh = new THREE.Vector3(), lt = new THREE.Vector3();
    const mods = tank.def.modules;
    for (let d = 0; d <= len; d += 0.1) {
      pt.copy(start).addScaledVector(dir, d);
      lh.copy(pt).applyMatrix4(invH);
      if (hasT) lt.copy(pt).applyMatrix4(invT);
      for (const m of mods) {
        if (!!m.ext !== extOnly) continue;
        const lp = m.space === 'turret' && hasT ? lt : lh;
        if (tank.moduleBox(m, _box).containsPoint(lp)) res.add(m.id);
      }
      if (!extOnly && !crew) {
        for (const z of tank.def.crew) {
          const lp = z.space === 'turret' && hasT ? lt : lh;
          if (tank.moduleBox(z, _box).containsPoint(lp)) { crew = true; break; }
        }
      }
    }
    return { mods: [...res], crew };
  }

  hitTank(tank, vol, hitPoint, dir, s) {
    const res = {
      tank, shooter: s.owner, part: vol.part, face: 'side', pen: false, ricochet: false,
      modules: [], fire: null, crewKilled: false, destroyed: false, wreckHit: tank.wrecked,
    };
    this.fx.ricochet(hitPoint);
    if (tank.wrecked) {
      this.fx.explosion(hitPoint, 0.7, false);
      this.sfx.boom(hitPoint.distanceTo(this.listener), 0.7);
      this.onEvent(res);
      return res;
    }
    const inv = new THREE.Matrix4().copy(vol.obj.matrixWorld).invert();
    const lp = hitPoint.clone().applyMatrix4(inv);
    const ld = dir.clone().transformDirection(inv);
    const b = vol.box;
    const faces = [
      [Math.abs(lp.x - b.min.x), 'side', new THREE.Vector3(-1, 0, 0)],
      [Math.abs(lp.x - b.max.x), 'side', new THREE.Vector3(1, 0, 0)],
      [Math.abs(lp.z - b.min.z), 'rear', new THREE.Vector3(0, 0, -1)],
      [Math.abs(lp.z - b.max.z), 'front', new THREE.Vector3(0, 0, 1)],
      [Math.abs(lp.y - b.max.y), 'top', new THREE.Vector3(0, 1, 0)],
      [Math.abs(lp.y - b.min.y), 'rear', new THREE.Vector3(0, -1, 0)],
    ].sort((a, c) => a[0] - c[0]);
    const [, face, normal] = faces[0];
    res.face = face;
    const cos = Math.abs(ld.dot(normal));
    const armor = tank.def.armor[vol.part][face];
    const dmgMul = s.dmg;

    // external modules are hit regardless of the armour
    const ext = this.pathModules(tank, hitPoint.clone().addScaledVector(dir, -0.8), dir, 1.8, true);
    for (const id of ext.mods) {
      tank.damage(id, rand(45, 85) * dmgMul);
      res.modules.push(id);
      if (id === 'fuel' && Math.random() < 0.6) res.fire = 'fuel';
    }

    if (cos < 0.28 && Math.random() < 0.75) {
      res.ricochet = true;
      tank.damage('hull', rand(0.5, 1.5));
      this.sfx.ping(hitPoint.distanceTo(this.listener));
    } else {
      const eff = armor / Math.max(cos, 0.25);
      const pen = s.pen * rand(0.85, 1.15);
      this.fx.explosion(hitPoint, 0.8, false);
      this.sfx.boom(hitPoint.distanceTo(this.listener), 0.8);
      if (pen >= eff) {
        res.pen = true;
        tank.damage('hull', rand(9, 16) * dmgMul);
        const inside = this.pathModules(tank, hitPoint, dir, 3.2, false);
        for (const id of inside.mods) {
          tank.damage(id, rand(40, 85) * dmgMul);
          if (!res.modules.includes(id)) res.modules.push(id);
          if (id === 'ammo' && (tank.hp.ammo < 55 || Math.random() < 0.4)) res.fire = 'ammo';
          if (id === 'fuel' && Math.random() < 0.55) res.fire = res.fire || 'fuel';
        }
        if (Math.random() < 0.35) {         // spall
          const ids = ['engine', 'transmission', 'turret', 'gun'];
          const id = ids[Math.floor(Math.random() * ids.length)];
          tank.damage(id, 15 * dmgMul);
          if (!res.modules.includes(id)) res.modules.push(id);
        }
        if (inside.crew) res.crew = rand(45, 95) * dmgMul;
      } else {
        tank.damage('hull', rand(1, 3));
      }
    }
    tank.lastHitT = performance.now() / 1000;

    // consequences
    if (res.fire) {
      if (tank.team === 'player') tank.startFire(res.fire, false);
      else {
        if (tank.crew) { tank.killCrew(); res.crewKilled = true; }
        tank.startFire(res.fire, true);
      }
    }
    if (res.crew) {
      if (tank.playerInside) { if (!this.god) this.onPlayerDamage(Math.min(55, res.crew * 0.6), s.owner); }
      else if (tank.crew) {
        tank.crewHp -= res.crew;
        if (tank.crewHp <= 0) { tank.killCrew(); res.crewKilled = true; }
      }
    }
    if (tank.hp.hull <= 0 && !(this.god && tank.playerInside)) {
      if (tank.crew) res.crewKilled = true;
      res.destroyed = true;
      this.fx.explosion(tank.root.position.clone().setY(tank.root.position.y + 2), 2, false);
      tank.makeWreck();
    }
    this.onEvent(res);
    return res;
  }
}

export function describeHit(res) {
  if (res.wreckHit) return 'Попадание в обломки';
  if (res.destroyed) return 'Танк уничтожен!';
  const parts = [];
  if (res.crewKilled) parts.push('экипаж уничтожен');
  if (res.fire) parts.push(res.fire === 'ammo' ? 'детонация боеукладки' : 'пожар');
  const mods = res.modules.map(m => MODULE_NAMES[m].toLowerCase());
  if (res.ricochet) return 'Рикошет' + (mods.length ? ': ' + mods.join(', ') : '');
  if (!res.pen) return (mods.length ? 'Попадание: ' + mods.join(', ') : 'Не пробил');
  return 'Пробитие' + (mods.length ? ': ' + mods.join(', ') : '') + (parts.length ? ' — ' + parts.join(', ') : '');
}
