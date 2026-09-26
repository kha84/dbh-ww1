// Repair-station overhead crane: lifts a turret (with its gun) off a tank standing in the bay onto
// one of two numbered stands, or puts a stored turret onto a turretless hull. Stored turrets are
// remembered per settlement so they survive the station being unloaded.
import * as THREE from 'three';
import { partVisual } from './tanks.js';
import { ORIGIN_NAMES } from './parts.js';

const Y_MAT = new THREE.MeshStandardMaterial({ color: 0xd9b23a, roughness: 0.8 });
const D_MAT = new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.6, metalness: 0.6 });
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);

const TRAVEL = 2.2, HOIST = 1.4;      // m/s

export class Workshop {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.store = new Map();           // settlement k -> [slot0, slot1]  ({ turret, gun } | null)
    this.cranes = new Map();          // settlement k -> live crane
    this.op = null;
  }

  // ------------------------------------------------------------ settlement lifecycle
  onBuilt(s) {
    const c = s.crane;
    if (!c) return;
    c.cos = Math.cos(c.rot); c.sin = Math.sin(c.rot);
    const g = new THREE.Group();
    c.bridge = new THREE.Mesh(box, Y_MAT);
    c.bridge.scale.set(13.2, 0.55, 0.6);
    c.trolley = new THREE.Mesh(box, D_MAT);
    c.trolley.scale.set(1.0, 0.5, 1.1);
    c.cable = new THREE.Mesh(cyl, D_MAT);
    c.cable.scale.set(0.04, 1, 0.04);
    c.hook = new THREE.Group();
    const hb = new THREE.Mesh(box, Y_MAT); hb.scale.set(0.5, 0.35, 0.3); c.hook.add(hb);
    for (const dx of [-0.6, 0.6]) {
      const ch = new THREE.Mesh(cyl, D_MAT);
      ch.scale.set(0.025, 0.9, 0.025); ch.position.set(dx * 0.5, -0.45, 0); ch.rotation.z = -dx * 0.6;
      c.hook.add(ch);
    }
    for (const m of [c.bridge, c.trolley, c.cable, hb]) { m.castShadow = true; }
    g.add(c.bridge, c.trolley, c.cable, c.hook);
    this.scene.add(g);
    c.group = g;
    c.u = 0; c.s = 0; c.hy = c.beamY - 1.6;         // trolley across, bridge along, hook height
    this.placeRig(c);
    const st = this.slots(c.k);
    st.forEach((it, i) => { if (it) this.placeOnStand(c, i, it); });
    this.cranes.set(c.k, c);
  }

  onRemoved(s) {
    const c = s.crane;
    if (!c) return;
    if (this.op && this.op.crane === c) this.finishNow();
    this.scene.remove(c.group);
    for (const it of this.slots(c.k)) if (it) { it.turret.vis.group.removeFromParent(); this.clearColliders(it); }
    this.cranes.delete(c.k);
  }

  slots(k) {
    if (!this.store.has(k)) this.store.set(k, [null, null]);
    return this.store.get(k);
  }

  // ------------------------------------------------------------ geometry helpers
  toWorld(c, lx, lz, out = new THREE.Vector3()) {
    return out.set(c.x + lx * c.cos + lz * c.sin, 0, c.z - lx * c.sin + lz * c.cos);
  }
  toLocal(c, x, z) {
    const dx = x - c.x, dz = z - c.z;
    return { u: dx * c.cos - dz * c.sin, s: dx * c.sin + dz * c.cos };
  }
  standYaw(c) { return c.rot + (c.side > 0 ? Math.PI / 2 : -Math.PI / 2); }   // guns point away from the road

  placeRig(c) {
    const b = this.toWorld(c, 0, c.s);
    c.bridge.position.set(b.x, c.beamY + 0.1, b.z);
    c.bridge.rotation.y = c.rot;
    const t = this.toWorld(c, c.u, c.s);
    c.trolley.position.set(t.x, c.beamY - 0.35, t.z);
    c.trolley.rotation.y = c.rot;
    const top = c.beamY - 0.6;
    c.cable.position.set(t.x, (top + c.hy) / 2, t.z);
    c.cable.scale.y = Math.max(0.05, top - c.hy);
    c.hook.position.set(t.x, c.hy, t.z);
    c.hook.rotation.y = c.rot;
  }

  placeOnStand(c, i, it) {
    const g = partVisual(it.turret).group;
    const sl = c.slots[i];
    this.scene.add(g);
    g.position.set(sl.x, sl.y, sl.z);
    g.rotation.set(0, this.standYaw(c), 0);
    this.updateColliders(c, i, it);
  }

  // obstacles of a turret lying on a stand: its body and the barrel of the gun in it
  updateColliders(c, i, it) {
    this.clearColliders(it);
    const g = partVisual(it.turret).group;
    g.updateMatrixWorld(true);
    const b = partVisual(it.turret).box;
    const yaw = this.standYaw(c);
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const p = g.localToWorld(new THREE.Vector3(cx, 0, cz));
    it.colliders = [this.world.addObstacle({
      x: p.x, z: p.z, rot: yaw, hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2,
      y0: g.position.y + b.min.y, y1: g.position.y + b.max.y,
    })];
    if (it.gun) {
      const pivot = partVisual(it.turret).gunPivot;
      const a = pivot.localToWorld(new THREE.Vector3(0, 0, 0));
      const m = pivot.localToWorld(new THREE.Vector3(0, 0, partVisual(it.gun).muzzleLen));
      const dx = m.x - a.x, dz = m.z - a.z;
      it.colliders.push(this.world.addObstacle({
        x: (a.x + m.x) / 2, z: (a.z + m.z) / 2, rot: Math.atan2(dx, dz), hx: 0.25, hz: Math.hypot(dx, dz) / 2,
        y0: Math.min(a.y, m.y) - 0.3, y1: Math.max(a.y, m.y) + 0.3,
      }));
    }
  }
  clearColliders(it) {
    if (it.colliders) for (const o of it.colliders) this.world.removeObstacle(o);
    it.colliders = null;
  }

  // gun slots of the turrets lying on stands: [{ crane, slot, item, pos (world) }]
  standGunSlots() {
    const res = [];
    for (const c of this.cranes.values()) {
      this.slots(c.k).forEach((it, i) => {
        if (!it || (this.op && this.op.crane === c && this.op.slot === i)) return;
        const pivot = partVisual(it.turret).gunPivot;
        res.push({ crane: c, slot: i, item: it, pos: pivot.localToWorld(new THREE.Vector3(0, 0, 0.5)) });
      });
    }
    return res;
  }
  // take the gun out of a turret on a stand (returns the part) / mount a gun into it
  takeGun(c, i) {
    const it = this.slots(c.k)[i];
    const gun = it && it.gun;
    if (!gun) return null;
    gun.vis.group.removeFromParent();
    it.gun = null;
    this.updateColliders(c, i, it);
    return gun;
  }
  mountGun(c, i, gun) {
    const it = this.slots(c.k)[i];
    if (!it || it.gun) return false;
    const g = partVisual(gun).group;
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
    g.visible = true;
    g.traverse(o => { if (o.userData.interior) o.visible = false; });
    partVisual(it.turret).gunPivot.add(g);
    it.gun = gun;
    this.updateColliders(c, i, it);
    return true;
  }

  nearestPanel(pos, maxD = 2.6) {
    for (const c of this.cranes.values()) {
      if (Math.hypot(pos.x - c.panel.x, pos.z - c.panel.z) < maxD) return c;
    }
    return null;
  }

  tankOnSpot(c, tanks) {
    let best = null, bd = 3.2;
    for (const t of tanks) {
      const d = Math.hypot(t.root.position.x - c.spot.x, t.root.position.z - c.spot.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // ------------------------------------------------------------ control panel
  describe(c, tanks) {
    const t = this.tankOnSpot(c, tanks);
    const st = this.slots(c.k);
    const slotName = it => it ? `башня ${ORIGIN_NAMES[it.turret.key]}${it.gun ? ` + орудие ${ORIGIN_NAMES[it.gun.key]}` : ' (без орудия)'}` : 'пусто';
    return {
      tank: t,
      tankText: t ? `${t.def.name}${t.parts.turret ? `, башня ${ORIGIN_NAMES[t.parts.turret.key]}` : t.turretless ? ', башни нет по конструкции' : ', без башни'}` : 'нет',
      slotText: [slotName(st[0]), slotName(st[1])],
    };
  }

  options(c, tanks) {
    const t = this.tankOnSpot(c, tanks);
    const st = this.slots(c.k);
    const busy = !!this.op;
    const why = (extra) => busy ? 'кран занят' : !t ? 'нет танка на площадке' : t.crew ? 'в танке экипаж противника' :
      Math.abs(t.speed) > 0.3 ? 'танк движется' : extra;
    const res = [];
    for (let i = 0; i < 2; i++) {
      const note = why(t && t.turretless ? 'у Mark V нет башни' : t && !t.parts.turret ? 'башня уже снята' : st[i] ? `площадка ${i + 1} занята` : null);
      res.push({ label: `Снять башню → площадка ${i + 1}`, ok: !note, note: note || 'готово', op: 'remove', slot: i, tank: t });
    }
    for (let i = 0; i < 2; i++) {
      const note = why(t && t.turretless ? 'на Mark V башня не ставится' : t && t.parts.turret ? 'на танке уже есть башня' : !st[i] ? `площадка ${i + 1} пуста` : null);
      res.push({ label: `Поставить башню с площадки ${i + 1}`, ok: !note, note: note || 'готово', op: 'install', slot: i, tank: t });
    }
    return res;
  }

  // ------------------------------------------------------------ operation
  start(c, o) {
    const t = o.tank;
    const st = this.slots(c.k);
    const sl = c.slots[o.slot];
    t.craneLock = true;
    const slotL = this.toLocal(c, sl.x, sl.z);
    const tp = t.turret.getWorldPosition(new THREE.Vector3());
    const tankL = this.toLocal(c, tp.x, tp.z);
    const liftY = c.beamY - 1.8;
    const op = { crane: c, tank: t, slot: o.slot, kind: o.op, i: 0, t: 0, carry: null, attach: 1.1, yaw0: 0, yaw1: 0 };
    const travel = (u, s) => ({ type: 'travel', u, s });
    const hoist = (y) => ({ type: 'hoist', y });
    if (o.op === 'remove') {
      const box = t.vis.turretBox;
      op.attach = box.max.y + 0.15;
      op.yaw0 = t.heading + t.turretYaw;
      op.yaw1 = this.standYaw(c);
      op.phases = [
        travel(tankL.u, tankL.s), hoist(tp.y + op.attach), { type: 'wait', d: 0.6 },
        { type: 'act', run: () => {
          op.carry = t.removeTurret();
          this.scene.attach(op.carry.turret.vis.group);
        } },
        hoist(liftY), { type: 'travel', u: slotL.u, s: slotL.s, carry: true }, hoist(sl.y + op.attach), { type: 'wait', d: 0.4 },
        { type: 'act', run: () => {
          st[o.slot] = op.carry;
          this.placeOnStand(c, o.slot, op.carry);
          op.carry = null;
        } },
        hoist(c.beamY - 1.6),
      ];
    } else {
      const it = st[o.slot];
      const box = partVisual(it.turret).box;
      op.attach = box.max.y + 0.15;
      op.yaw0 = this.standYaw(c);
      op.yaw1 = t.heading;
      op.phases = [
        travel(slotL.u, slotL.s), hoist(sl.y + op.attach), { type: 'wait', d: 0.6 },
        { type: 'act', run: () => { op.carry = st[o.slot]; st[o.slot] = null; this.clearColliders(op.carry); } },
        hoist(liftY), { type: 'travel', u: tankL.u, s: tankL.s, carry: true }, hoist(tp.y + op.attach), { type: 'wait', d: 0.4 },
        { type: 'act', run: () => {
          t.installTurret(op.carry.turret, op.carry.gun);
          op.carry = null;
          op.result = t.def.driveOk ? null : 'Механизм поворота не подходит к этой башне — поставь родной';
        } },
        hoist(c.beamY - 1.6),
      ];
    }
    this.op = op;
  }

  // immediately apply the remaining actions (station unloaded mid-operation)
  finishNow() {
    const op = this.op;
    if (!op) return;
    for (; op.i < op.phases.length; op.i++) {
      const p = op.phases[op.i];
      if (p.type === 'act') p.run();
    }
    op.tank.craneLock = false;
    this.op = null;
  }

  update(dt) {
    const op = this.op;
    if (!op) return null;
    const c = op.crane;
    const p = op.phases[op.i];
    let done = false;
    if (p.type === 'travel') {
      if (p.d0 === undefined) p.d0 = Math.hypot(p.u - c.u, p.s - c.s) || 1e-6;
      const du = p.u - c.u, ds = p.s - c.s;
      const d = Math.hypot(du, ds);
      const step = TRAVEL * dt;
      if (d <= step) { c.u = p.u; c.s = p.s; done = true; }
      else { c.u += du / d * step; c.s += ds / d * step; }
      if (p.carry) op.progress = 1 - Math.max(0, d - step) / p.d0;
    } else if (p.type === 'hoist') {
      const d = p.y - c.hy;
      const step = HOIST * dt;
      if (Math.abs(d) <= step) { c.hy = p.y; done = true; } else c.hy += Math.sign(d) * step;
    } else if (p.type === 'wait') {
      op.t += dt;
      if (op.t >= p.d) { op.t = 0; done = true; }
    } else if (p.type === 'act') {
      p.run();
      done = true;
    }
    this.placeRig(c);
    if (op.carry) {
      const g = op.carry.turret.vis.group;
      const w = this.toWorld(c, c.u, c.s);
      g.position.set(w.x, c.hy - op.attach, w.z);
      const k = op.progress || 0;
      let dy = op.yaw1 - op.yaw0;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      g.rotation.set(0, op.yaw0 + dy * k, 0);
    }
    if (done) op.i++;
    if (op.i >= op.phases.length) {
      op.tank.craneLock = false;
      this.op = null;
      return { done: true, kind: op.kind, slot: op.slot, tank: op.tank, warn: op.result };
    }
    return null;
  }
}
