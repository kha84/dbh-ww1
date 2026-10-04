// Infantry: enemy riflemen / machine gunners / tank crews that bailed out. Low-poly soldiers with knees
// (stand / crouch / prone, walk / run / crawl, throw, reload, death) and a squad AI:
//   - idle: sentries watching the road, men sitting, short patrols, facing a noise they heard
//   - perception: sight (field of view, range, stance of the target), hearing gunfire and explosions
//   - cover: houses, walls, sandbags, berms, wrecks, trees and terrain folds hiding them from the threat;
//     low cover -> lie down / fire kneeling, high cover -> hide and step out to fire
//   - suppression from bullets passing close and blasts: they keep their heads down and shoot worse
//   - squads bound forward by fire teams, flank a target they lost, throw grenades at men in cover,
//     dodge grenades, fall back when morale breaks, hunt tanks with anti-tank grenades or hide from them
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_LEVEL, segBox } from './world.js';
import { WEAPONS, GRENADES, SMALL_CATS, BUNDLE_OF, makeWeapon, bakedWeaponMesh, throwVelocity } from './weapons.js';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const rand = (a, b) => a + Math.random() * (b - a);

export const STANCE = {
  stand:  { h: 1.78, eye: 1.6, speed: 1 },
  crouch: { h: 1.2, eye: 1.05, speed: 0.45 },
  prone:  { h: 0.55, eye: 0.38, speed: 0.14 },
};

// ===================================================================== model
const UNIFORMS = {
  enemy: { cloth: 0x59604a, dark: 0x3f4535, helmet: 0x464d3a, boots: 0x2a241c },
  crew:  { cloth: 0x2e3033, dark: 0x222325, helmet: 0x18191a, boots: 0x18181a },
  ally:  { cloth: 0x7a6a48, dark: 0x4f4430, helmet: 0x3d4a2f, boots: 0x2e241a },      // the other player (network)
};
const SKIN = new THREE.Color(0xc39a7a);
const SMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05 });

// merge colored boxes / spheres into one geometry: parts = [[geo, color, x, y, z, sx, sy, sz, rx]]
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
    upper: mergeParts([                                        // origin at the hips
      [BOX, U.cloth, 0, 0.28, 0, 0.4, 0.56, 0.24],
      [BOX, U.dark, 0, 0.03, 0, 0.42, 0.08, 0.26],             // belt
      [BOX, U.dark, 0.1, 0.36, 0.13, 0.12, 0.14, 0.05],        // pouches
      [BOX, U.dark, -0.1, 0.36, 0.13, 0.12, 0.14, 0.05],
      [BOX, U.dark, 0, 0.3, -0.15, 0.3, 0.3, 0.1],             // pack
      [BOX, SKIN, 0, 0.6, 0, 0.1, 0.08, 0.1],                  // neck
      [SPH, SKIN, 0, 0.72, 0.01, 0.105, 0.125, 0.11],          // head
      [HEMI, U.helmet, 0, 0.75, 0, 0.14, 0.12, 0.15],          // helmet
      [BOX, U.helmet, 0, 0.75, 0, 0.3, 0.015, 0.3],            // brim
    ]),
    thigh: mergeParts([[BOX, U.cloth, 0, -0.23, 0, 0.15, 0.48, 0.17]]),
    shin: mergeParts([
      [BOX, U.cloth, 0, -0.2, 0, 0.13, 0.4, 0.15],
      [BOX, U.boots, 0, -0.41, 0.04, 0.14, 0.12, 0.26],
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
  const body = new THREE.Group();                 // pivots at the feet when the soldier falls / lies down
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  body.add(hips);
  const mk = (geo, parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const m = new THREE.Mesh(geo, SMAT);
    m.castShadow = true;
    g.add(m);
    parent.add(g);
    return g;
  };
  const thighL = mk(G.thigh, hips, 0.1, 0, 0), thighR = mk(G.thigh, hips, -0.1, 0, 0);
  const shinL = mk(G.shin, thighL, 0, -0.46, 0), shinR = mk(G.shin, thighR, 0, -0.46, 0);
  const upper = mk(G.upper, hips, 0, 0, 0);
  const armL = mk(G.arm, upper, 0.25, 0.52, 0), armR = mk(G.arm, upper, -0.25, 0.52, 0);
  const W = WEAPONS[weaponKey];
  const small = SMALL_CATS.includes(W.cat);
  const wm = bakedWeaponMesh(weaponKey);
  const gunPivot = new THREE.Group();             // turns the gun between "low ready" and aimed
  gunPivot.position.set(small ? -0.12 : -0.08, small ? 0.38 : 0.36, small ? 0.5 : 0.26);
  gunPivot.add(wm.group);
  upper.add(gunPivot);
  return { root, body, hips, upper, thighL, thighR, shinL, shinR, armL, armR, gun: gunPivot, muzzle: wm.muzzle, small };
}

// ===================================================================== targets
// network play: two players - every soldier / tank crew goes for the nearest one (and sticks to it for a while)
export function pickTarget(who, targets, now) {
  if (!targets || !targets.length) return null;
  if (targets.length === 1) return targets[0];
  const p = who.pos || who.tank.root.position;
  const d = t => Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
  let best = targets[0];
  for (const t of targets) if (d(t) < d(best)) best = t;
  const cur = targets.find(t => t.id === who.tgtId);
  if (cur && cur !== best && now - (who.tgtT || 0) < 5 && d(cur) < d(best) * 1.5) return cur;
  if (!cur || cur !== best) { who.tgtId = best.id; who.tgtT = now; }
  return best;
}

// ===================================================================== soldier
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _la = new THREE.Vector3(), _lb = new THREE.Vector3(), _inv = new THREE.Matrix4();
let SOLDIER_ID = 0;

export class Soldier {
  constructor(scene, pos, o) {
    this.id = ++SOLDIER_ID;
    this.scene = scene;
    /** @type {((s: Soldier, owner: any) => void) | null} */
    this.onDeath = null;
    this.weaponKeyShown = null;                  // network play (guest): the weapon model shown
    this.kind = o.kind || 'enemy';
    this.team = 'enemy';
    this.weapon = makeWeapon(o.key);
    this.grenades = { ...(o.grenades || {}) };
    this.m = buildSoldier(this.kind, o.key);
    this.root = this.m.root;
    this.root.position.copy(pos);
    this.pos = this.root.position;
    this.heading = o.heading || 0;
    this.post = pos.clone();                   // where it stands guard
    this.guardDir = o.guardDir ?? this.heading;
    this.squad = o.squad || 0;
    this.team2 = 0;                            // fire team inside the squad (bounding)
    const W = WEAPONS[o.key];
    this.role = W.cat === 'mg' ? 'mg' : this.antiTank() ? 'at' : 'rifle';
    this.state = o.mode === 'flee' ? 'flee' : 'idle';     // idle | alert | combat | retreat | flee
    this.fleeFrom = o.fleeFrom || null;
    this.fleeT = o.mode === 'flee' ? 4 + Math.random() * 3 : 0;
    this.skill = o.skill ?? (0.6 + Math.random() * 0.6);   // aim error multiplier (lower = better)
    this.hp = 100;
    this.alive = true;
    this.stance = 'stand';
    this.height = STANCE.stand.h;
    this.alert = false;
    this.lastSeen = -1e9;
    this.lastPos = new THREE.Vector3();
    this.heard = null;                         // { pos, t } a noise to look into
    this.los = false;
    this.losT = Math.random() * 0.4;
    this.thinkT = Math.random() * 0.3;
    this.fireCd = 1 + Math.random();
    this.burst = 0;
    this.reloadT = 0;
    this.throwCd = 3 + Math.random() * 4;
    this.throwAnim = 0;
    this.cover = null;                         // { x, z, kind: 'tall'|'mid'|'low', t }
    this.coverT = 0;
    this.peek = false;
    this.peekT = rand(0.5, 1.5);
    this.peekMiss = 0;
    this.side = null;                          // step-aside point to fire past tall cover
    this.suppress = 0;
    this.morale = 0.8 + Math.random() * 0.4;
    this.dodge = null;                         // grenade to run from
    this.moveTo = null;
    this.moveSpeed = 0;
    this.detour = 0; this.detourT = 0; this.stuckT = 0;
    this.idleAct = 'watch'; this.idleT = Math.random() * 6;
    this.lookYaw = 0;
    this.patrol = o.patrol || null; this.patrolI = 0;
    this.phase = Math.random() * 6;
    this.speedNow = 0;
    this.deathT = 0;
    this.pitch = 0;
    this.aimK = 0;                             // 0 low ready .. 1 aiming
    this.pose = { hipsY: 0.92, thigh: 0, shin: 0, torso: 0, body: 0, bodyZ: 0 };
    scene.add(this.root);
  }

  hit(dmg, owner, dir) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hurtT = 0.25;
    this.morale -= 0.15;
    this.suppress = Math.min(1, this.suppress + 0.5);
    if (this.hp <= 0) { this.die(owner, dir); return; }
    this.alertReq = true;
    if (owner && owner.player && this.hitFrom === undefined) this.hitFrom = true;
  }

  die(owner, dir) {
    this.alive = false;
    this.hp = 0;
    this.killer = owner;
    this.fallDir = dir && Math.random() < 0.7 ? Math.atan2(dir.x, dir.z) : this.heading + Math.PI;
    if (this.onDeath) this.onDeath(this, owner);
  }

  dispose() { this.scene.remove(this.root); }

  eye(out = new THREE.Vector3(), stance = this.stance) { return out.set(this.pos.x, this.pos.y + STANCE[stance].eye, this.pos.z); }
  muzzleWorld(out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.m.gun.localToWorld(out.set(0, 0.04, this.m.muzzle));
  }
  setStance(s) { this.stance = s; this.height = STANCE[s].h; }
  goto(x, z, speed) {
    if (!this.moveTo) this.moveTo = new THREE.Vector3();
    this.moveTo.set(x, 0, z);
    this.moveSpeed = speed;
  }
  stop() { this.moveTo = null; this.moveSpeed = 0; }
  atGoal(r = 0.7) { return !this.moveTo || Math.hypot(this.moveTo.x - this.pos.x, this.moveTo.z - this.pos.z) < r; }

  // ------------------------------------------------ perception
  perceive(dt, ctx, tgt) {
    if (!tgt) { this.los = false; return Infinity; }
    const dist = Math.hypot(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.3 + Math.random() * 0.25;
      const tp = _w.copy(tgt.pos); tp.y += tgt.isTank ? 1.6 : (tgt.crouch ? 0.9 : 1.45);
      const range = tgt.isTank ? 260 : 170;
      this.los = dist < range && ctx.ai.clearLine(this.eye(_v), tp, tgt.isTank ? tgt.tank : null);
      // field of view: things behind the soldier are noticed only close by (or once it knows about them)
      if (this.los && !this.alert) {
        const off = Math.abs(wrap(Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z) - this.heading - this.lookYaw));
        const spot = (tgt.isTank ? 220 : 120) * (tgt.crouch ? 0.55 : 1) * (this.state === 'idle' ? 0.8 : 1.2) *
                     (Math.hypot(tgt.vel.x, tgt.vel.z) > 3 ? 1.3 : 1);
        if ((off > 1.9 && dist > 12) || dist > spot) this.los = false;
      }
    }
    if (this.alertReq || this.los) {
      if (!this.alert) { this.fireCd = 1.0 + Math.random() * 1.6; ctx.alertSquad(this); }
      this.alert = true;
      if (this.los) { this.lastSeen = ctx.now; this.lastPos.copy(tgt.pos); }
      else if (this.alertReq && ctx.now - this.lastSeen > 5) { this.lastSeen = ctx.now - 4; this.lastPos.copy(tgt.pos).add(_u.set(rand(-6, 6), 0, rand(-6, 6))); }
      if (this.state === 'idle' || this.state === 'alert') this.state = 'combat';
    }
    this.alertReq = false;
    if (this.alert && ctx.now - this.lastSeen > 30) { this.alert = false; this.state = 'alert'; this.heard = { pos: this.lastPos.clone(), t: ctx.now }; }
    return dist;
  }

  // ------------------------------------------------ AI
  think(dt, ctx) {
    if (!this.alive) { this.animateDeath(dt); return; }
    const W = WEAPONS[this.weapon.key];
    const tgt = pickTarget(this, ctx.targets, ctx.now);
    const now = ctx.now;
    const dist = this.perceive(dt, ctx, tgt);
    this.suppress = Math.max(0, this.suppress - dt * 0.25);
    this.morale = Math.min(1.2, this.morale + dt * (this.suppress < 0.2 ? 0.025 : -0.02 * this.suppress));
    this.coverT += dt;
    if (this.throwAnim > 0) this.throwAnim -= dt;

    // ---- decisions a few times a second
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.25 + Math.random() * 0.2;
      this.decide(ctx, W, tgt, dist);
    }

    // ---- facing
    let face = null;
    if (this.dodge || this.state === 'flee' || (this.moveTo && this.moveSpeed > 3)) face = null;
    else if ((this.state === 'combat' || this.state === 'retreat') && tgt) face = Math.atan2(this.lastPos.x - this.pos.x, this.lastPos.z - this.pos.z);
    else if (this.state === 'alert' && this.heard) face = Math.atan2(this.heard.pos.x - this.pos.x, this.heard.pos.z - this.pos.z);
    else if (this.state === 'idle' && !this.moveTo) face = this.idleAct === 'chat' && this.chatWith ? Math.atan2(this.chatWith.pos.x - this.pos.x, this.chatWith.pos.z - this.pos.z) : this.guardDir;
    if (face === null && this.moveTo) face = Math.atan2(this.moveTo.x - this.pos.x, this.moveTo.z - this.pos.z) + this.detour;
    if (face !== null) this.heading += clamp(wrap(face - this.heading), -5 * dt, 5 * dt);
    // idle sentries scan left and right
    this.lookYaw = this.state === 'idle' && this.idleAct === 'watch' ? Math.sin(now * 0.4 + this.id) * 0.7 : this.lookYaw * 0.9;

    // ---- shooting
    this.fireCd -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.weapon.mag = W.mag;
    } else if ((this.state === 'combat' || this.state === 'retreat') && tgt && this.los && !this.dodge && this.throwAnim <= 0) {
      const toT = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
      const moving = this.speedNow > 0.8;
      const canWhileMoving = W.auto && this.speedNow < 3.5;
      const hidden = this.cover && !this.peek && this.atCover();
      const wantFire = !hidden && (!moving || canWhileMoving) && (!tgt.isTank || this.role === 'mg' || Math.random() < 0.3) && !(tgt.isTank && this.stalk);
      if (wantFire && this.fireCd <= 0 && Math.abs(wrap(toT - this.heading)) < 0.3 && dist < W.range * 1.8) {
        if (this.weapon.mag <= 0) this.reloadT = W.reload * 1.3;
        else this.shoot(ctx, W, tgt, dist, moving);
      }
    }
    if (this.weapon.mag <= 0 && this.reloadT <= 0) this.reloadT = W.reload * 1.3;
    if (tgt && this.state !== 'idle') this.pitch = Math.atan2(tgt.pos.y + (tgt.isTank ? 1.2 : 1.0) - (this.pos.y + STANCE[this.stance].eye), Math.max(1, dist));
    else this.pitch *= 0.9;

    this.move(dt, ctx);
    this.animate(dt);
  }

  // the part of the AI that picks what to do (called a few times a second)
  decide(ctx, W, tgt, dist) {
    const now = ctx.now;
    // live grenades close by: run
    this.dodge = null;
    for (const g of ctx.guns.grenades) {
      if (g.owner && g.owner.soldier) continue;
      const d = Math.hypot(g.pos.x - this.pos.x, g.pos.z - this.pos.z);
      if (d < g.D.r + 2.5 && (g.D.fuse ? g.t < 3.2 : true)) { this.dodge = g; break; }
    }
    if (this.dodge) {
      const a = Math.atan2(this.pos.x - this.dodge.pos.x, this.pos.z - this.dodge.pos.z) + (this.id % 2 ? 0.3 : -0.3);
      this.setStance('stand');
      this.goto(this.pos.x + Math.sin(a) * 12, this.pos.z + Math.cos(a) * 12, 5.6);
      this.cover = null;
      return;
    }

    // on the way to climb into a free tank (see Infantry.boarding)
    if (this.board) {
      const t = this.board;
      if (!ctx.ai.joinable(t, this) || (this.state === 'combat' && tgt && dist < 12 && !tgt.isTank)) { this.board = null; }
      else {
        const hatch = ctx.ai.hatchPoint(t, this, _v);
        this.setStance('stand');
        this.cover = null;
        this.goto(hatch.x, hatch.z, this.alert ? 5.2 : 3.2);
        if (Math.hypot(hatch.x - this.pos.x, hatch.z - this.pos.z) < 1.3) ctx.ai.climbIn(this, t);
        return;
      }
    }

    if (this.state === 'flee') {
      // bailed-out crew: run away from the burning tank first
      this.fleeT -= 0.35;
      const f = this.fleeFrom;
      const a = f ? Math.atan2(this.pos.x - f.x, this.pos.z - f.z) : this.heading;
      this.setStance('stand');
      this.goto(this.pos.x + Math.sin(a) * 10, this.pos.z + Math.cos(a) * 10, 5.2);
      if (this.fleeT <= 0) {
        this.state = tgt ? 'combat' : 'idle';
        this.post.copy(this.pos);
        if (tgt) { this.alert = true; this.lastSeen = now; this.lastPos.copy(tgt.pos); }
      }
      return;
    }

    if (this.state === 'idle') { this.decideIdle(ctx); return; }
    if (this.state === 'alert') { this.decideAlert(ctx); return; }
    if (!tgt) { this.state = 'idle'; this.stop(); return; }

    // morale breaks -> fall back, recovers after a while
    if (this.state === 'combat' && this.morale < 0.25) { this.state = 'retreat'; this.retreatT = rand(8, 14); this.cover = null; }
    if (this.state === 'retreat') {
      this.retreatT -= 0.35;
      if (this.retreatT <= 0 && this.morale > 0.45) { this.state = 'combat'; this.cover = null; }
    }

    if (tgt.isTank) this.decideVsTank(ctx, W, tgt, dist);
    else { this.stalk = false; this.decideVsFoot(ctx, W, tgt, dist); }
  }

  decideIdle(ctx) {
    this.setStance(this.idleAct === 'sit' ? 'crouch' : 'stand');
    this.idleT -= 0.35;
    if (this.idleT <= 0) {
      this.idleT = rand(8, 20);
      const r = Math.random();
      this.idleAct = this.patrol && r < 0.45 ? 'patrol' : r < 0.55 ? 'walk' : r < 0.75 ? 'sit' : r < 0.85 ? 'chat' : 'watch';
      this.chatWith = this.idleAct === 'chat' ? ctx.ai.squadMates(this).find(s => s.pos.distanceTo(this.pos) < 12) || null : null;
      if (this.idleAct === 'walk') {
        const a = Math.random() * Math.PI * 2, d = rand(3, 8);
        this.goto(this.post.x + Math.sin(a) * d, this.post.z + Math.cos(a) * d, 1.3);
      } else if (this.idleAct !== 'patrol') this.goto(this.post.x, this.post.z, 1.3);
    }
    if (this.idleAct === 'patrol' && this.patrol && this.atGoal(1.2)) {
      this.patrolI = (this.patrolI + 1) % this.patrol.length;
      const p = this.patrol[this.patrolI];
      this.goto(p.x, p.z, 1.3);
    }
    if (this.heard && ctx.now - this.heard.t < 2) { this.state = 'alert'; this.alertT = 0; }
  }

  // heard something: take cover facing it, then carefully look into it
  decideAlert(ctx) {
    const h = this.heard;
    if (!h) { this.state = 'idle'; return; }
    this.alertT = (this.alertT || 0) + 0.35;
    if (this.alertT < 10) {
      if (!this.cover || this.coverT > 12) this.takeCover(ctx, h.pos, { pref: 30, radius: 18 });
      if (this.cover) this.gotoCover(2.5);
      this.setStance(this.atCover() ? this.hideStance() : 'crouch');
    } else if (this.alertT < 28) {
      this.cover = null;
      this.setStance('crouch');
      if (this.atGoal(3)) this.goto(h.pos.x + rand(-5, 5), h.pos.z + rand(-5, 5), 1.6);
    } else { this.state = 'idle'; this.heard = null; this.goto(this.post.x, this.post.z, 1.3); }
  }

  decideVsFoot(ctx, W, tgt, dist) {
    const now = ctx.now;
    const retreat = this.state === 'retreat';
    const sq = ctx.ai.squadOf(this);
    const unseen = now - this.lastSeen;
    let pref = retreat ? Math.min(W.range, dist + 40) : clamp(W.range * 0.55, 18, 70);
    if (sq && sq.advance === this.team2 && !retreat) pref = Math.max(14, dist - 18);
    // lost the target: flank / search its last position
    let flank = 0;
    if (!retreat && unseen > 6) { flank = this.id % 2 ? 1 : -1; pref = Math.max(12, Math.min(pref, dist * 0.7)); }
    // (re)pick cover when there is none, it was compromised, or the fire team bounds forward
    const exposed = this.cover && this.atCover() && this.los && !this.peek && this.coverExposedT > 1.2;
    if (!this.cover || exposed || (this.coverT > 14 && !this.los) || this.peekMiss >= 3 || (flank && this.coverT > 8)) {
      this.takeCover(ctx, this.lastPos, { pref, radius: retreat ? 40 : 28, flank, retreat });
      this.peekMiss = 0;
    }
    if (this.cover) {
      this.gotoCover(this.suppress > 0.5 ? 5.4 : this.los ? 4.8 : 3.4);
      if (this.atCover()) this.peekCycle(ctx, W, dist);
      else this.setStance(this.moveSpeed > 3 ? 'stand' : 'crouch');
    } else {
      // no cover around: lie down in the open (MGs deploy), or rush when far
      if (dist > pref + 25 && !this.los) { this.setStance('stand'); this.goto(this.lastPos.x, this.lastPos.z, 3.2); }
      else { this.stop(); this.setStance(this.role === 'mg' || this.suppress > 0.4 ? 'prone' : 'crouch'); }
    }
    // grenade at a man hiding near us
    const he = Object.keys(this.grenades).find(k => !GRENADES[k].pen && this.grenades[k] > 0);
    const lp = this.lastPos, lpd = Math.hypot(lp.x - this.pos.x, lp.z - this.pos.z);
    if (he && this.throwCd <= 0 && lpd > 9 && lpd < 30 && (tgt.crouch || unseen > 2) && unseen < 12 && Math.random() < 0.25) {
      this.throwAt(ctx, he, _v.copy(lp));
    }
    this.throwCd -= 0.35;
  }

  // anti-tank means: an anti-tank grenade, or enough hand grenades to tie a bundle
  antiTank() {
    const g = this.grenades;
    if (Object.keys(g).some(k => GRENADES[k].pen && g[k] > 0)) return true;
    return Object.keys(g).some(k => !GRENADES[k].pen && g[k] >= BUNDLE_OF);
  }
  // the grenade to throw at a tank (ties a bundle of hand grenades when there is no anti-tank one)
  atGrenade(craft = false) {
    const g = this.grenades;
    const at = Object.keys(g).filter(k => GRENADES[k].pen && g[k] > 0).sort((a, b) => GRENADES[b].pen - GRENADES[a].pen)[0];
    if (at || !craft) return at || null;
    const he = Object.keys(g).find(k => !GRENADES[k].pen && g[k] >= BUNDLE_OF);
    if (!he) return null;
    g[he] -= BUNDLE_OF;
    g.bundle = (g.bundle || 0) + 1;
    this.fireCd = Math.max(this.fireCd, 2.5);            // busy tying it
    return 'bundle';
  }
  // does the tank look this way (its gun / turret points at the soldier)? - its crew would see him coming
  watchedBy(tank) {
    if (!tank) return false;
    const tp = tank.root.position;
    const to = Math.atan2(this.pos.x - tp.x, this.pos.z - tp.z);
    const face = tank.heading + (tank.turretYaw || 0);
    const d = Math.hypot(this.pos.x - tp.x, this.pos.z - tp.z);
    return Math.abs(wrap(to - face)) < (d < 25 ? 0.75 : 0.45);
  }
  // where to throw at a tank: onto the engine deck behind the turret (thin roof armour)
  deckPoint(tank, out) {
    const b = tank.vis.hullBox;
    tank.root.updateMatrixWorld(true);
    return tank.root.localToWorld(out.set((b.min.x + b.max.x) / 2, b.max.y + 0.15, b.min.z + (b.max.z - b.min.z) * 0.28));
  }

  decideVsTank(ctx, W, tgt, dist) {
    const tank = tgt.tank;
    const hunter = this.antiTank() && this.morale > 0.35 && this.state !== 'retreat';
    const tp = tgt.pos;
    this.throwCd -= 0.35;
    const speed = Math.hypot(tgt.vel.x, tgt.vel.z);
    // the tank drives straight at us (or is about to run us over)
    const toMe = Math.atan2(this.pos.x - tp.x, this.pos.z - tp.z);
    const bearing = speed > 1 ? Math.abs(wrap(toMe - Math.atan2(tgt.vel.x, tgt.vel.z))) : 9;
    if (dist < 13 && (!hunter || (speed > 1.5 && bearing < 0.5))) {
      const a = toMe + (this.id % 2 ? 1.2 : -1.2);
      this.setStance('stand');
      this.goto(this.pos.x + Math.sin(a) * 10, this.pos.z + Math.cos(a) * 10, 5.4);
      this.cover = null;
      const at = hunter && this.atGrenade(true);
      if (at && dist < 16 && this.los && this.throwCd <= 0) this.throwAt(ctx, at, this.deckPoint(tank, _v), true);
      return;
    }
    if (hunter && dist < 90) {
      // tank hunter: stalks the tank from cover to cover, preferably from its side / rear, keeps his head down while
      // the gun looks his way (lies down in the open), dashes on when it looks away, then throws onto the engine deck
      const watched = this.watchedBy(tank) && this.los;
      const inCover = this.atCover();
      this.stalk = true;
      const near = dist < 17;
      const coming = speed > 1 && bearing < 0.7;                // it comes this way: wait for it in hiding
      if (!near && (!this.cover || (inCover && !watched && !coming && (this.coverT > 2.5 || dist > 22)))) {
        this.takeCover(ctx, tp, { pref: Math.max(9, Math.min(dist - 12, 14)), radius: 24, tank, side: true });
      }
      if (near) {
        // close enough: wait for the moment it looks away (or is too close to miss), then throw
        const at = this.atGrenade(true);
        if (at && this.los && this.throwCd <= 0 && (!watched || dist < 9 || Math.random() < 0.15)) {
          this.throwAt(ctx, at, this.deckPoint(tank, _v), true);
          // and run for it
          this.cover = null;
          this.takeCover(ctx, tp, { pref: 22, radius: 25, tank, retreat: true });
        } else if (!this.los && !coming) this.goto(tp.x, tp.z, watched ? 1.2 : 4.2);
        else if (this.cover) this.gotoCover(4.5);
        this.setStance(watched ? 'crouch' : this.moveSpeed > 3 ? 'stand' : 'crouch');
        return;
      }
      if (this.cover) {
        if (watched && !inCover) {
          // spotted in the open: drop and crawl to the cover
          this.setStance('prone');
          this.gotoCover(1.2);
        } else if (inCover) {
          this.setStance(this.hideStance());
          this.stop();
        } else {
          this.setStance(dist < 40 ? 'crouch' : 'stand');
          this.gotoCover(dist < 40 ? 3.6 : 5.2);
        }
      } else if (watched) { this.setStance('prone'); this.goto(tp.x, tp.z, 1.0); }     // crawl on
      else { this.setStance('crouch'); this.goto(tp.x, tp.z, 3.5); }
      return;
    }
    this.stalk = false;
    // no means against armour: hide from its guns; while a comrade stalks the tank, keep its crew busy with fire at
    // the vision slits
    const sq = ctx.ai.squadOf(this);
    const covering = sq && sq.members.some(m => m !== this && m.alive && m.stalk);
    if (!this.cover || (this.atCover() && this.los && this.coverExposedT > 1) || this.coverT > 20) {
      this.takeCover(ctx, tp, { pref: this.state === 'retreat' ? 90 : 45, radius: 35, tank });
    }
    if (this.cover) {
      this.gotoCover(5.2);
      if (this.atCover()) this.peekCycle(ctx, W, dist, covering ? 1.2 : 0.35);
      else this.setStance('stand');
    } else { this.stop(); this.setStance('prone'); }
  }

  // hide behind cover, now and then pop up / step out to fire
  peekCycle(ctx, W, dist, eager = 1) {
    this.peekT -= 0.35;
    const sq = ctx.ai.squadOf(this);
    const covering = sq && sq.advance !== null && sq.advance !== this.team2;      // the other team is bounding: fire more
    if (this.peekT <= 0) {
      this.peek = !this.peek;
      if (this.peek) {
        this.peekT = rand(1.5, 3.2) * (covering ? 1.6 : 1) * eager;
        this.side = this.cover.kind === 'tall' ? ctx.ai.sidePoint(this, this.lastPos) : null;
      } else {
        this.peekT = rand(1.2, 2.8) + this.suppress * 3 + (this.weapon.mag < WEAPONS[this.weapon.key].mag * 0.4 ? 1.5 : 0);
        this.side = null;
        if (!this.losWhilePeek) this.peekMiss++;
        this.losWhilePeek = false;
        if (this.weapon.mag < WEAPONS[this.weapon.key].mag * 0.5 && this.reloadT <= 0) this.reloadT = WEAPONS[this.weapon.key].reload * 1.3;
      }
    }
    if (this.suppress > 0.75) this.peek = false;
    if (this.peek && this.los) this.losWhilePeek = true;
    this.setStance(this.peek ? this.peekStance() : this.hideStance());
    this.coverExposedT = this.los && !this.peek ? (this.coverExposedT || 0) + 0.35 : 0;
  }

  hideStance() { const k = this.cover && this.cover.kind; return k === 'low' ? 'prone' : 'crouch'; }
  peekStance() { const k = this.cover && this.cover.kind; return k === 'low' ? 'crouch' : k === 'mid' ? 'stand' : this.role === 'mg' ? 'crouch' : 'stand'; }
  atCover() { return this.cover && Math.hypot(this.cover.x - this.pos.x, this.cover.z - this.pos.z) < 1.1; }
  gotoCover(speed) {
    const c = this.cover;
    const p = this.peek && this.side ? this.side : c;
    this.goto(p.x, p.z, this.atCover() ? 1.2 : speed);
  }
  takeCover(ctx, threat, o) {
    const c = ctx.ai.findCover(this, threat, o);
    this.cover = c;
    this.coverT = 0;
    this.peek = false;
    this.peekT = rand(0.6, 1.6);
  }

  shoot(ctx, W, tgt, dist, moving) {
    const muzzle = this.muzzleWorld(new THREE.Vector3());
    const origin = this.eye(new THREE.Vector3());
    const aim = _w.copy(tgt.pos);
    aim.y += tgt.isTank ? 1.3 + Math.random() * 0.6 : (tgt.crouch ? 0.8 : 1.15);
    aim.addScaledVector(tgt.vel, Math.min(0.4, dist / 600));          // lead a moving target a little
    const dir = aim.sub(origin).normalize();
    const stanceK = this.stance === 'prone' ? 0.6 : this.stance === 'crouch' ? 0.8 : 1;
    const err = ((W.auto ? W.spread * 0.8 : W.aim * 2) + 0.02 + dist * 0.00022) * this.skill * (moving ? 1.8 : 1) * stanceK * (1 + this.suppress * 1.5);
    dir.x += (Math.random() - 0.5) * 2 * err;
    dir.y += (Math.random() - 0.5) * 2 * err;
    dir.z += (Math.random() - 0.5) * 2 * err;
    dir.normalize();
    ctx.guns.fire(origin, dir, W, { soldier: this }, muzzle);
    this.weapon.mag--;
    this.aimK = 1;
    if (W.auto) {
      if (this.burst <= 0) this.burst = 3 + Math.floor(Math.random() * (W.cat === 'mg' ? (this.stance === 'prone' ? 12 : 8) : 4));
      this.burst--;
      this.fireCd = this.burst > 0 ? 60 / W.rpm : 0.6 + Math.random() * 1.3;
    } else this.fireCd = 60 / W.rpm + 0.6 + Math.random() * 1.1;
  }

  throwAt(ctx, key, target, atTank = false) {
    const from = this.eye(new THREE.Vector3(), 'stand');
    from.y += 0.2;
    const t = target.clone();
    const spread = (atTank ? 1.2 : 3) * this.skill;
    t.x += (Math.random() - 0.5) * spread;
    t.z += (Math.random() - 0.5) * spread;
    ctx.guns.throwGrenade(from, throwVelocity(from, t, 15), key, { soldier: this });
    this.grenades[key]--;
    this.throwCd = 7 + Math.random() * 7;
    this.fireCd = Math.max(this.fireCd, 1);
    this.throwAnim = 0.55;
    this.setStance('stand');
  }

  move(dt, ctx) {
    const p = this.pos;
    const ox = p.x, oz = p.z;
    let vx = 0, vz = 0;
    if (this.moveTo && !this.atGoal(this.moveSpeed > 3 ? 0.9 : 0.35)) {
      const sp = Math.min(this.moveSpeed, 5.6 * STANCE[this.stance].speed + (this.stance === 'stand' ? 0 : 0.4));
      let a = Math.atan2(this.moveTo.x - p.x, this.moveTo.z - p.z);
      if (this.detourT > 0) { this.detourT -= dt; a += this.detour; } else this.detour = 0;
      vx = Math.sin(a) * sp; vz = Math.cos(a) * sp;
    }
    p.x += vx * dt; p.z += vz * dt;
    const w = ctx.world;
    if (w.heightAt(p.x, p.z) < WATER_LEVEL - 0.4) { p.x = ox; p.z = oz; }
    w.collideTrees(p, 0.3);
    w.collideObstacles(p, 0.35);
    p.y = w.groundAt(p.x, p.z, p.y);
    this.speedNow = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-4);
    // stuck against something: walk around it for a moment
    const want = Math.hypot(vx, vz);
    if (want > 0.5 && this.speedNow < want * 0.3) {
      this.stuckT += dt;
      if (this.stuckT > 0.6) { this.stuckT = 0; this.detour = (Math.random() < 0.5 ? -1 : 1) * rand(0.9, 1.5); this.detourT = rand(0.8, 1.5); }
    } else this.stuckT = Math.max(0, this.stuckT - dt);
  }

  animate(dt) {
    const k = 1 - Math.exp(-dt * 8);
    const s = Math.min(1, this.speedNow / 4.5);
    const running = this.speedNow > 3;
    const st = this.stance;
    this.phase += dt * (2 + this.speedNow * (st === 'prone' ? 4 : 2.2));
    const sw = Math.sin(this.phase);
    const P = this.pose;
    // stance targets
    let hipsY = 0.92, thigh = 0, shin = 0, torso = 0, body = 0, bodyZ = 0;
    if (st === 'crouch') { hipsY = 0.55; thigh = -1.15; shin = 1.85; torso = 0.25; }
    else if (st === 'prone') { hipsY = 0.12; body = Math.PI / 2 * 0.96; bodyZ = -0.95; torso = -0.45; }
    if (running && st === 'stand') torso = 0.28;
    P.hipsY += (hipsY - P.hipsY) * k; P.thigh += (thigh - P.thigh) * k; P.shin += (shin - P.shin) * k;
    P.torso += (torso - P.torso) * k; P.body += (body - P.body) * k; P.bodyZ += (bodyZ - P.bodyZ) * k;
    const m = this.m;
    const swing = (st === 'prone' ? 0.25 : st === 'crouch' ? 0.35 : running ? 0.85 : 0.6) * s;
    m.body.rotation.x = P.body;
    m.body.position.z = P.bodyZ * Math.min(1, P.body / 1.4);
    m.hips.position.y = P.hipsY + (st === 'stand' ? Math.abs(Math.cos(this.phase)) * 0.05 * s : 0);
    m.thighL.rotation.x = P.thigh + sw * swing;
    m.thighR.rotation.x = P.thigh - sw * swing;
    m.shinL.rotation.x = P.shin + Math.max(0, -sw) * swing * 1.3;
    m.shinR.rotation.x = P.shin + Math.max(0, sw) * swing * 1.3;
    // aim: raise the gun when in combat and facing the target, lower it otherwise
    const aimT = (this.state === 'combat' || this.state === 'retreat' || this.state === 'alert') && !(running && !this.los) ? 1 : 0;
    this.aimK += (aimT - this.aimK) * (1 - Math.exp(-dt * 5));
    const pitch = -this.pitch * 0.6;
    m.upper.rotation.set(P.torso + pitch * this.aimK, this.lookYaw, 0);
    // gun: low ready <-> aimed; compensate the torso / body lean so it points at the target
    const lean = P.torso + P.body + pitch * this.aimK;
    const gx = (1 - this.aimK) * 0.75 - lean * this.aimK + (this.reloadT > 0 ? 0.5 : 0);
    m.gun.rotation.set(gx, 0, this.reloadT > 0 ? 0.5 : 0);
    const small = m.small;
    const armR0 = small ? -1.45 : -1.25, armL0 = small ? -1.4 : -1.45;
    const armLift = gx;                               // the arms follow the gun up / down
    if (this.throwAnim > 0) {
      const t = 1 - this.throwAnim / 0.55;
      m.armR.rotation.set(-2.9 + t * 2.6, 0, 0.2);
      m.armL.rotation.set(-0.8, 0, -0.3);
    } else {
      m.armR.rotation.set(armR0 + armLift * 0.9, 0, small ? 0.12 : 0.1);
      m.armL.rotation.set(armL0 + armLift * 0.9 + (this.reloadT > 0 ? Math.sin(this.phase * 3) * 0.3 : 0), 0, small ? -0.35 : -0.55);
    }
    this.root.rotation.y = this.heading;
  }

  animateDeath(dt) {
    if (this.deathT > 1.2) return;
    this.deathT += dt;
    const k = Math.min(1, this.deathT * 2.4);
    const m = this.m;
    this.root.rotation.y = this.fallDir + Math.PI;
    const b0 = this.pose.body;
    m.body.rotation.x = b0 + (-Math.PI / 2 * 0.97 - b0) * k * k;
    m.body.position.set(0, 0.05 * k, 0);
    m.hips.position.y = 0.92;
    m.thighL.rotation.x = 0.2 * k; m.thighR.rotation.x = -0.15 * k;
    m.shinL.rotation.x = 0.3 * k; m.shinR.rotation.x = 0.1 * k;
    m.upper.rotation.set(0, 0, 0);
    m.armL.rotation.set(-2.6 * k, 0, 0.3 * k);
    m.armR.rotation.set(-2.9 * k, 0, -0.4 * k);
    m.gun.rotation.set(1.2 * k, 0, 0.8 * k);
  }
}

// ===================================================================== director
export class Infantry {
  constructor(scene, world, guns) {
    this.scene = scene;
    this.world = world;
    this.guns = guns;
    this.soldiers = [];
    this.squads = new Map();          // id -> { id, members, advance: team | null, boundT, advanceT }
    this.squadN = 0;
    this.tanks = [];
    /** @type {(...a: any[]) => void} */
    this.onDeath = () => {};
    /** @type {(...a: any[]) => void} */
    this.onBoard = () => {};          // (soldier, tank): a soldier climbed into a free tank - it gets a crew
    this.kills = 0;
    this.now = 0;
    // small arms fire heard / felt by the soldiers
    guns.onShot = (origin, end, owner, W) => this.shot(origin, end, owner, W);
  }

  spawn(x, z, o) {
    const y = this.world.heightAt(x, z);
    if (y < WATER_LEVEL) return null;
    const p = new THREE.Vector3(x, y, z);
    this.world.collideObstacles(p, 0.4);
    p.y = this.world.heightAt(p.x, p.z);
    const s = new Soldier(this.scene, p, o);
    s.onDeath = (sd, owner) => this.died(sd, owner);
    this.soldiers.push(s);
    if (s.squad) {
      if (!this.squads.has(s.squad)) this.squads.set(s.squad, { id: s.squad, members: [], advance: null, boundT: rand(4, 8), advanceT: -1 });
      const sq = this.squads.get(s.squad);
      s.team2 = sq.members.length % 2;
      sq.members.push(s);
    }
    return s;
  }

  // group of soldiers around (x, z); kits: [{ key, grenades }]. o: { spots: [{x, z, dir}], patrol: [{x, z}], guardDir }
  spawnSquad(x, z, kits, heading = 0, r = Math.random, o = {}) {
    const squad = ++this.squadN;
    const res = [];
    kits.forEach((k, i) => {
      const spot = o.spots && o.spots[i % o.spots.length];
      const a = i / kits.length * Math.PI * 2 + r();
      const d = i ? 2 + r() * 4 : 0;
      const px = spot ? spot.x : x + Math.sin(a) * d, pz = spot ? spot.z : z + Math.cos(a) * d;
      const s = this.spawn(px, pz, { ...k, squad, heading: heading + (r() - 0.5) * 1.5, guardDir: spot?.dir ?? o.guardDir ?? heading,
        patrol: o.patrol && i % 3 === 1 ? o.patrol : null });
      if (s) {
        if (!spot && r() < 0.3) s.idleAct = 'sit';
        res.push(s);
      }
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
      const s = this.spawn(p.x + off.x, p.z + off.z, { ...k, kind: k.kind || 'crew', squad, mode: 'flee', fleeFrom: p.clone(), heading: tank.heading });
      if (s) res.push(s);
    });
    return res;
  }

  squadOf(s) { return s.squad ? this.squads.get(s.squad) : null; }
  squadMates(s) { const sq = this.squadOf(s); return sq ? sq.members.filter(m => m !== s && m.alive) : []; }

  alertSquad(src) {
    for (const s of this.soldiers) {
      if (s !== src && s.alive && s.squad === src.squad && !s.alert && s.pos.distanceTo(src.pos) < 90) s.alertReq = true;
    }
  }

  died(s, owner) {
    for (const o of this.soldiers) {
      if (!o.alive || o === s) continue;
      const d = o.pos.distanceTo(s.pos);
      if (d < 40) { o.morale -= o.squad === s.squad ? 0.25 : 0.1; o.alertReq = true; }
    }
    this.onDeath(s, owner);
  }

  // a noise at `pos` heard within `r` metres
  noise(pos, r) {
    for (const s of this.soldiers) {
      if (!s.alive || s.alert) continue;
      if (s.pos.distanceTo(pos) < r) s.heard = { pos: pos.clone().add(_u.set(rand(-8, 8), 0, rand(-8, 8))), t: this.now };
    }
  }

  // every round fired: soldiers near the bullet's path are suppressed, the shot is heard
  shot(origin, end, owner, W) {
    if (owner && owner.soldier) return;
    const len = origin.distanceTo(end);
    if (len < 0.1) return;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const c = _v.set(s.pos.x, s.pos.y + 1.0, s.pos.z);
      const t = clamp(_w.copy(c).sub(origin).dot(_u.copy(end).sub(origin)) / (len * len), 0, 1);
      const d = _w.copy(origin).lerp(end, t).distanceTo(c);
      if (d < 3) { s.suppress = Math.min(1, s.suppress + (3 - d) / 3 * (W.cat === 'mg' ? 0.3 : 0.2)); s.alertReq = true; }
      if (!s.alert && s.pos.distanceTo(origin) < (SMALL_CATS.includes(W.cat) ? 90 : 150)) s.heard = { pos: origin.clone(), t: this.now };
    }
  }

  // blast: shells, grenades
  explosion(pos, r, dmg, owner) {
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const lying = s.stance === 'prone' ? 0.55 : s.stance === 'crouch' ? 0.8 : 1;
      const d = _v.set(s.pos.x, s.pos.y + 0.9 * lying, s.pos.z).distanceTo(pos);
      if (d < r) s.hit((dmg * (1 - d / r) + 10) * lying, owner, _w.copy(s.pos).sub(pos).setY(0).normalize());
      else if (d < r * 3) { s.alertReq = true; s.suppress = Math.min(1, s.suppress + 0.6 * (1 - d / (r * 3))); }
      if (s.alive && !s.alert && d < 160) s.heard = { pos: pos.clone(), t: this.now };
    }
  }

  // ------------------------------------------------ cover & line of sight
  // a clear line between two points (terrain, obstacles, trees; `ignore`: tank not to count)
  clearLine(a, b, ignore = null) {
    if (!this.world.lineOfSight(a, b, 4)) return false;
    if (this.world.raycastObstacles(a, b)) return false;
    if (this.world.raycastTrees(a, b)) return false;
    for (const t of this.tanks) {
      if (t === ignore) continue;
      const tp = t.root.position;
      const mx = (a.x + b.x) / 2 - tp.x, mz = (a.z + b.z) / 2 - tp.z;
      const half = Math.hypot(b.x - a.x, b.z - a.z) / 2 + 5;
      if (mx * mx + mz * mz > half * half) continue;
      _inv.copy(t.root.matrixWorld).invert();
      const la = _la.copy(a).applyMatrix4(_inv), lb = _lb.copy(b).applyMatrix4(_inv);
      const bx = t.vis.hullBox;
      if (segBox(la.x, la.y, la.z, lb.x, lb.y, lb.z, bx.min.x, bx.min.y, bx.min.z, bx.max.x, bx.max.y, bx.max.z) !== null) return false;
    }
    return true;
  }

  // best spot near soldier s hidden from `threat`. o: { pref (distance to the threat), radius, flank (-1/1),
  // retreat, tank (threat tank), side (approach a tank from its side) }. Returns { x, z, kind } or null
  findCover(s, threat, o = {}) {
    const P = s.pos, R = o.radius || 28, W = this.world;
    const cands = [];
    const push = (x, z, q, kind) => cands.push({ x, z, q, kind });
    // obstacles: houses, walls, sandbags, berms, crane posts...
    for (const ob of W.obstacles) {
      const dx = ob.x - P.x, dz = ob.z - P.z;
      if (dx * dx + dz * dz > (R + ob.rad) ** 2) continue;
      const gy = W.heightAt(ob.x, ob.z);
      if (ob.y1 !== undefined && ob.y1 - gy < 0.55) continue;
      let tx = ob.x - threat.x, tz = ob.z - threat.z;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      for (const off of [0, 0.8, -0.8]) {
        const c = Math.cos(off), sn = Math.sin(off);
        const ux = tx * c - tz * sn, uz = tx * sn + tz * c;
        const ext = Math.abs(ux * ob.cos - uz * ob.sin) * ob.hx + Math.abs(ux * ob.sin + uz * ob.cos) * ob.hz;
        push(ob.x + ux * (ext + 0.55), ob.z + uz * (ext + 0.55), off ? 0.9 : 1, 'ob');
      }
    }
    // trees
    W.forTreesNear(P.x, P.z, t => {
      if (t.broken && t.stumpH < 0.9) return;
      if (Math.hypot(t.x - P.x, t.z - P.z) > R) return;
      let tx = t.x - threat.x, tz = t.z - threat.z;
      const tl = Math.hypot(tx, tz) || 1;
      push(t.x + tx / tl * (t.r + 0.45), t.z + tz / tl * (t.r + 0.45), t.kind === 'bush' ? 0.4 : 0.55, 'tree');
    });
    // knocked-out / abandoned tanks
    for (const t of this.tanks) {
      if (t === o.tank || (!t.wrecked && (t.crew || t.playerInside || Math.abs(t.speed) > 0.5))) continue;
      const tp = t.root.position;
      if (Math.hypot(tp.x - P.x, tp.z - P.z) > R + 4) continue;
      let tx = tp.x - threat.x, tz = tp.z - threat.z;
      const tl = Math.hypot(tx, tz) || 1;
      const b = t.vis.hullBox, ext = Math.max(b.max.x, b.max.z) * 0.75;
      push(tp.x + tx / tl * (ext + 0.6), tp.z + tz / tl * (ext + 0.6), 0.95, 'ob');
    }
    // folds of the ground
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + s.id;
      for (const r of [5, 11, 18]) push(P.x + Math.sin(a) * r, P.z + Math.cos(a) * r, 0.75, 'terrain');
    }
    // score without line tests first
    const pref = o.pref ?? 35;
    const tAng = Math.atan2(P.x - threat.x, P.z - threat.z);
    for (const c of cands) {
      const d = Math.hypot(c.x - P.x, c.z - P.z);
      const dT = Math.hypot(c.x - threat.x, c.z - threat.z);
      c.d = d; c.dT = dT;
      c.score = c.q * 2 - d * 0.05 - Math.abs(dT - pref) * 0.025;
      if (o.retreat && dT < Math.hypot(P.x - threat.x, P.z - threat.z)) c.score -= 2;
      if (o.flank) {
        const ang = wrap(Math.atan2(c.x - threat.x, c.z - threat.z) - tAng);
        c.score += clamp(ang * o.flank, -0.5, 1) * 1.2;
      }
      if (o.side && o.tank) {
        const rel = Math.abs(wrap(Math.atan2(c.x - threat.x, c.z - threat.z) - o.tank.heading));
        c.score += Math.sin(rel) * 1.2 - (rel < 0.8 ? 1 : 0);          // beside / behind the tank, not in front
      }
      if (d > R || dT < 6 || W.heightAt(c.x, c.z) < WATER_LEVEL + 0.2) c.score = -1e9;
      for (const m of this.soldiers) if (m !== s && m.alive && m.cover && Math.hypot(m.cover.x - c.x, m.cover.z - c.z) < 1.4) c.score -= 1.5;
    }
    cands.sort((a, b) => b.score - a.score);
    // line tests on the best few: hidden at crouch (mid / tall) or only lying down (low)
    const eye = _u.copy(threat); eye.y += o.tank ? 2.2 : 1.5;
    const tgtTank = o.tank || null;
    for (let i = 0, tests = 0; i < cands.length && tests < 10; i++) {
      const c = cands[i];
      if (c.score < -1e8) break;
      tests++;
      const gy = W.heightAt(c.x, c.z);
      const at = h => new THREE.Vector3(c.x, gy + h, c.z);
      let kind = null;
      if (!this.clearLine(eye, at(1.0), tgtTank)) kind = this.clearLine(eye, at(1.55), tgtTank) ? 'mid' : 'tall';
      else if (!this.clearLine(eye, at(0.35), tgtTank)) kind = 'low';
      if (kind) return { x: c.x, z: c.z, kind, src: c.kind };
    }
    return null;
  }

  // a point beside tall cover from which the threat can be seen
  sidePoint(s, threat) {
    const c = s.cover;
    const a = Math.atan2(threat.x - c.x, threat.z - c.z);
    const gy = this.world.heightAt(c.x, c.z);
    const tp = new THREE.Vector3(threat.x, threat.y + 1.2, threat.z);
    for (const sgn of [s.id % 2 ? 1 : -1, s.id % 2 ? -1 : 1]) {
      const x = c.x + Math.cos(a) * 1.0 * sgn, z = c.z - Math.sin(a) * 1.0 * sgn;
      if (this.clearLine(new THREE.Vector3(x, gy + 1.5, z), tp)) return { x, z };
    }
    return null;
  }

  update(dt, ctx) {
    this.now = ctx.now;
    this.tanks = ctx.tanks;
    ctx.world = this.world;
    ctx.guns = this.guns;
    ctx.ai = this;
    ctx.alertSquad = s => this.alertSquad(s);
    // squads bound forward by fire teams while engaged with a man on foot
    for (const sq of this.squads.values()) {
      sq.members = sq.members.filter(m => m.alive);
      if (!sq.members.length) { this.squads.delete(sq.id); continue; }
      const engaged = sq.members.filter(m => m.state === 'combat');
      const st = engaged.length ? pickTarget(engaged[0], ctx.targets, ctx.now) : null;
      if (engaged.length >= 3 && st && !st.isTank) {
        sq.boundT -= dt;
        if (sq.boundT <= 0) {
          sq.boundT = rand(6, 10);
          sq.advance = sq.advance === 0 ? 1 : 0;
          sq.advanceT = ctx.now;
          for (const m of engaged) if (m.team2 === sq.advance) m.cover = null;
        }
      } else sq.advance = null;
    }
    this.boardT = (this.boardT ?? 1) - dt;
    if (this.boardT <= 0) { this.boardT = 1; this.boarding(ctx); }
    for (const s of this.soldiers) s.think(dt, ctx);
    // soldiers who climbed into a tank are its crew now
    if (this.soldiers.some(s => s.gone)) this.soldiers = this.soldiers.filter(s => !s.gone);
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

  // ------------------------------------------------ taking over free tanks
  // a tank the soldiers can crew and fight in: whole, empty, able to shoot (main gun or machine gun)
  crewable(t) {
    if (!t || t.wrecked || t.crew || t.playerInside || t.remoteInside || t.fire || t.craneLock || t.noBoard) return false;
    if (t.hp.engine <= 0 && t.hp.transmission <= 0) return false;
    return (t.parts.gun && t.hp.gun > 0 && t.ammo > 0) || (t.mg && t.mgAmmo > 0);
  }
  // crewable, or already manned by his comrades who have room for one more
  joinable(t, s) {
    if (this.crewable(t)) return true;
    return !!t && t.crew && !t.wrecked && !t.playerInside && t.crewSquad === s.squad && (t.crewKits || []).length < 3;
  }
  // where a man climbs in: beside the hull, on his side of it
  hatchPoint(t, s, out) {
    const b = t.vis.hullBox, tp = t.root.position;
    const c = Math.cos(t.heading), sn = Math.sin(t.heading);
    const lx = (s.pos.x - tp.x) * c - (s.pos.z - tp.z) * sn;
    const side = lx >= 0 ? 1 : -1;
    const x = side > 0 ? b.max.x + 0.5 : b.min.x - 0.5, z = (b.min.z + b.max.z) / 2;
    return out.set(tp.x + x * c + z * sn, tp.y, tp.z - x * sn + z * c);
  }
  // squads near a free tank send men to crew it (alerted soldiers take any usable tank around, idle ones only
  // those standing close - e.g. a tank the player left behind)
  boarding(ctx) {
    const free = ctx.tanks.filter(t => this.crewable(t));
    for (const t of free) {
      const tp = t.root.position;
      const want = Math.min(3, (t.def.crew || []).length || 2);
      let going = this.soldiers.filter(s => s.alive && s.board === t).length;
      if (going >= want) continue;
      const cands = this.soldiers.filter(s => {
        if (!s.alive || s.board || s.state === 'flee' || s.state === 'retreat' || s.dodge) return false;
        const d = Math.hypot(s.pos.x - tp.x, s.pos.z - tp.z);
        return s.state === 'idle' ? d < 35 && !t.derelict : d < 65;
      }).sort((a, b) => a.pos.distanceTo(tp) - b.pos.distanceTo(tp));
      for (const s of cands) {
        if (going >= want) break;
        // keep the squad's MG on the ground unless it is all that is left
        if (s.role === 'mg' && cands.length > want) continue;
        s.board = t;
        going++;
      }
    }
  }
  climbIn(s, t) {
    s.board = null;
    s.gone = true;
    s.dispose();
    const first = !t.crew;
    t.crewKits = first ? [] : t.crewKits || [];
    t.crewKits.push({ key: s.weapon.key, grenades: { ...s.grenades } });
    t.crewSquad = s.squad;
    this.onBoard(s, t, first);
  }

  // forget soldiers far from the player; bodies disappear after a while
  prune(anchor, dist = 700, anchor2 = null) {
    this.soldiers = this.soldiers.filter(s => {
      const far = Math.hypot(s.pos.x - anchor.x, s.pos.z - anchor.z) > dist &&
                  (!anchor2 || Math.hypot(s.pos.x - anchor2.x, s.pos.z - anchor2.z) > dist);
      const old = !s.alive && s.deathT > 1.2 && (s.goneT = (s.goneT || 0) + 1) > 60;
      if (far || old) { s.dispose(); return false; }
      return true;
    });
  }
}
