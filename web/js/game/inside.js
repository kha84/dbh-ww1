// First-person view inside the crew compartment: stations (commander / gunner / driver), standing up and walking
// around, the troop seats of the personnel carriers.
import * as THREE from 'three';
import { HULLS } from '../parts.js';
import { turretCeiling } from '../models.js';

export function createInside(ctx) {
  const { aimDir, cabinLight, camera, keys, msg, seatName, sfx, state } = ctx;

  // ================== first-person view inside the tank ==================
  function toggleView() {
    if (state.view === 'third') enterInside();
    else { leaveInside(); msg('Вид снаружи'); }
  }

  function enterInside(role = null) {
    const v = state.vehicle;
    v.setInterior(true);
    state.view = 'inside';
    state.sight = false;
    const seats = v.seats();
    const s = (role && seats.find(x => x.role === role)) || seats.find(x => x.role === 'commander') || seats.find(x => x.role === 'driver');
    sitAt(s.role, true);
    if (!role) msg('Вид изнутри: Q — встать/сесть, 1/2/3 — командир/наводчик/мехвод, V — вид снаружи', '#c9b48a');
  }

  // the rear half of a personnel carrier: from there the player climbs into the troop compartment
  function behindHalf(t, p) {
    const b = t.vis.hullBox;
    const c = Math.cos(t.heading), s = Math.sin(t.heading);
    const lz = (p.x - t.root.position.x) * s + (p.z - t.root.position.z) * c;
    return lz < (b.min.z + b.max.z) / 2;
  }

  function leaveInside() {
    const v = state.vehicle;
    if (v) v.setInterior(false);
    state.view = 'third';
    state.seat = null;
    camera.up.set(0, 1, 0);
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    cabinLight.intensity = 0;
  }

  function seatByRole(v, role) { return v.seats().find(s => s.role === role); }

  // hull-local position of a seat (turret seats rotate with the turret)
  function seatHullPos(v, s, which = 'pos') {
    const p = new THREE.Vector3(...s[which]);
    if (s.space !== 'hull') { v.seatObject(s).localToWorld(p); v.root.worldToLocal(p); }
    return p;
  }

  function sitAt(role, quiet = false) {
    const v = state.vehicle;
    const s = seatByRole(v, role);
    if (!s) { msg(role === 'driver' ? 'Нет места мехвода' : `Нет места: ${seatName(role)} — башня снята`); return; }
    state.seat = role;
    state.headYaw = 0; state.headPitch = -0.05;
    state.sight = false;
    if (role !== 'driver') { state.aimYaw = v.heading + v.turretYaw; state.aimPitch = -0.04; }
    if (!quiet) msg(`Место: ${seatName(role)}`, '#c9b48a');
  }

  function standUp() {
    const v = state.vehicle;
    const s = seatByRole(v, state.seat);
    const p = seatHullPos(v, s);
    state.inPos.set(p.x, 0, p.z);
    clampInside(v, state.inPos);
    // look the way we were looking
    if (state.seat !== 'driver') {
      const d = aimDir.clone().applyQuaternion(v.root.quaternion.clone().invert());
      state.headYaw = Math.atan2(d.x, d.z);
      state.headPitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
    }
    state.seat = null;
    state.sight = false;
    msg('Встал с места — WASD перемещение, Q у кресла — сесть', '#c9b48a');
  }

  function nearestSeat(v) {
    let best = null, bd = 0.85;
    for (const s of v.seats()) {
      const p = seatHullPos(v, s);
      const d = Math.hypot(p.x - state.inPos.x, p.z - state.inPos.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function clampInside(v, p) {
    const rects = HULLS[v.key].interior.walk;
    let best = null, bd = Infinity;
    for (const r of rects) {
      const x = Math.max(r.x[0], Math.min(r.x[1], p.x)), z = Math.max(r.z[0], Math.min(r.z[1], p.z));
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = [x, z]; }
    }
    p.x = best[0]; p.z = best[1];
  }

  // ceiling above a hull-local point (hull roof, turret dome/roof, Mark V cab)
  function ceilingAt(v, x, z) {
    const I = HULLS[v.key].interior;
    if (I.cab && Math.abs(x) < I.cab.x && z > I.cab.z[0] && z < I.cab.z[1]) return I.cab.top;
    const ring = v.hull.ring;
    if (ring && Math.hypot(x - ring.pos.x, z - ring.pos.z) < ring.r) {
      if (!v.parts.turret) return I.floor + 1.75;          // open ring: sky above
      const p = v.turret.worldToLocal(v.root.localToWorld(new THREE.Vector3(x, ring.pos.y, z)));
      const c = turretCeiling(v.parts.turret.key, p.x, p.z);
      if (c > 0) return ring.pos.y + c;
    }
    return I.roof;
  }

  function updateInsideWalk(dt) {
    const v = state.vehicle;
    let f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    let s = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    if (state.repairOpen) f = s = 0;
    const len = Math.hypot(f, s);
    if (len > 0) { f /= len; s /= len; }
    const sin = Math.sin(state.headYaw), cos = Math.cos(state.headYaw);
    state.inPos.x += (f * sin - s * cos) * 1.4 * dt;
    state.inPos.z += (f * cos + s * sin) * 1.4 * dt;
    clampInside(v, state.inPos);
  }

  function pressQ() {
    if (state.mode === 'drive') {
      if (state.view !== 'inside') { msg('Q — встать/сесть работает в виде изнутри (V)'); return; }
      if (state.seat) { standUp(); return; }
      const s = nearestSeat(state.vehicle);
      if (s) sitAt(s.role); else msg('Рядом нет свободного места');
      return;
    }
    const t = (state.slot && state.slot.tank) || state.nearTank;
    if (!t) return;
    if (t.crew) { msg('В этом танке живой экипаж!', '#ff9a7a'); return; }
    t.setBay(!t.bayOpen);
    sfx.click();
    msg(t.bayOpen ? `Моторный отсек ${t.def.hullName} открыт` : `Моторный отсек ${t.def.hullName} закрыт`);
  }

  return { toggleView, enterInside, behindHalf, leaveInside, seatByRole, sitAt, standUp, nearestSeat, ceilingAt, updateInsideWalk, pressQ };
}
