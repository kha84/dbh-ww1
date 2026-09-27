// First-person weapon view model: the drawn weapon (or grenade) with the player's hands, hip / aimed pose,
// walking bob, sway lagging behind the mouse, sprint pose, strafe tilt, landing dip, breathing, recoil kick
// and the reload dip.
import * as THREE from 'three';
import { weaponMesh, buildGrenadeMesh, isSmall } from './weapons.js';

const SKIN = new THREE.MeshStandardMaterial({ color: 0xc39a7a, roughness: 0.85, metalness: 0 });
const SLEEVE = new THREE.MeshStandardMaterial({ color: 0x46492f, roughness: 0.95, metalness: 0 });
const CUFF = new THREE.MeshStandardMaterial({ color: 0x35372a, roughness: 0.95, metalness: 0 });
const BOX = new THREE.BoxGeometry(1, 1, 1);
const ARM = new THREE.CylinderGeometry(1, 0.8, 1, 8);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// shoulders in weapon-local coordinates (the weapon is turned 180° inside the view model at the hip pose)
const SHOULDER_R = new THREE.Vector3(-0.04, -0.2, -0.6), SHOULDER_L = new THREE.Vector3(0.42, -0.2, -0.6);

function limb(parent, mat, p0, p1, r0, r1) {
  _a.copy(p0); _b.copy(p1);
  const len = _a.distanceTo(_b);
  const m = new THREE.Mesh(ARM, mat);
  m.position.copy(_a).add(_b).multiplyScalar(0.5);
  m.scale.set(r0, len, r0 * (r1 / r0));
  m.quaternion.setFromUnitVectors(_up, _b.clone().sub(_a).normalize());
  m.castShadow = false;
  parent.add(m);
  return m;
}

// hand at `p` gripping along the weapon, forearm and upper arm reaching back to the shoulder
function arm(parent, p, shoulder, grip = 'pistol') {
  const g = new THREE.Group();
  const hand = new THREE.Mesh(BOX, SKIN);
  hand.position.copy(p);
  if (grip === 'pistol') { hand.scale.set(0.05, 0.085, 0.07); hand.rotation.x = 0.3; }
  else { hand.scale.set(0.055, 0.05, 0.09); }
  g.add(hand);
  const thumb = new THREE.Mesh(BOX, SKIN);
  thumb.scale.set(0.018, 0.018, 0.045);
  thumb.position.set(p.x + (shoulder.x < p.x ? -0.03 : 0.03), p.y + 0.03, p.z + 0.01);
  g.add(thumb);
  const wrist = new THREE.Vector3(p.x, p.y - (grip === 'pistol' ? 0.05 : 0.02), p.z - 0.05);
  const dir = shoulder.clone().sub(wrist);
  const d = dir.length();
  dir.normalize();
  const elbow = wrist.clone().addScaledVector(dir, Math.min(0.3, d * 0.5)).add(new THREE.Vector3(0, -0.07, 0));
  limb(g, CUFF, wrist, wrist.clone().addScaledVector(dir, 0.04), 0.034, 0.034);
  limb(g, SLEEVE, wrist.clone().addScaledVector(dir, 0.03), elbow, 0.036, 0.042);
  limb(g, SLEEVE, elbow, shoulder, 0.045, 0.05);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  parent.add(g);
  return g;
}

export class ViewModel {
  constructor(camera) {
    this.root = new THREE.Group();          // pose offsets (camera space)
    this.pivot = new THREE.Group();         // the weapon turned towards -Z, + hands
    this.root.add(this.pivot);
    camera.add(this.root);
    this.key = null;
    this.muzzle = 0.3; this.top = 0.05; this.scopeX = 0;
    this.small = false; this.grenade = false;
    // smoothed pose state
    this.aimK = 0; this.runK = 0; this.reloadK = 0; this.crouchK = 0;
    this.bobT = 0; this.bobAmp = 0;
    this.lagX = 0; this.lagY = 0; this.lookX = 0; this.lookY = 0;
    this.land = 0; this.wasGround = true; this.air = 0;
    this.strafeK = 0;
  }

  get visible() { return this.root.visible; }

  // key: weapon key, 'g:<grenade>' or null
  set(key) {
    if (key === this.key) return;
    this.pivot.clear();
    this.key = key;
    this.grenade = !!key && key.startsWith('g:');
    this.small = !!key && !this.grenade && isSmall(key);
    if (!key) return;
    let hand2 = null, grip = new THREE.Vector3(0, -0.035, -0.005);
    if (this.grenade) {
      const g = buildGrenadeMesh(key.slice(2));
      g.scale.setScalar(1.1);
      g.position.set(0, -0.02, 0);
      this.pivot.add(g);
      this.muzzle = 0.05; this.top = 0.1; this.scopeX = 0;
      grip = new THREE.Vector3(0, 0.0, -0.01);
    } else {
      const v = weaponMesh(key);
      v.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
      this.pivot.add(v.group);
      this.muzzle = v.muzzle; this.top = v.top; this.scopeX = v.scopeX || 0;
      hand2 = v.hand2 ? new THREE.Vector3(...v.hand2) : null;
    }
    arm(this.pivot, grip, SHOULDER_R, 'pistol');
    if (hand2) arm(this.pivot, hand2, SHOULDER_L, this.small ? 'pistol' : 'fore');
  }

  // mouse movement (radians of look this frame)
  look(dx, dy) { this.lookX += dx; this.lookY += dy; }

  // s: { speed, run, crouch, strafe, aim (bool), kick 0..1, reload (bool), onGround, time }
  update(dt, s) {
    this.root.visible = !!this.key;
    if (!this.key) return;
    const k = t => 1 - Math.exp(-dt * t);
    const aimT = s.aim && !this.grenade && !s.reload ? 1 : 0;
    this.aimK += (aimT - this.aimK) * k(14);
    const runT = s.run && s.speed > 7.5 && !s.aim && !s.reload ? 1 : 0;
    this.runK += (runT - this.runK) * k(8);
    this.reloadK += ((s.reload ? 1 : 0) - this.reloadK) * k(9);
    this.crouchK += ((s.crouch ? 1 : 0) - this.crouchK) * k(8);
    this.strafeK += ((s.strafe || 0) - this.strafeK) * k(6);
    // look lag: the weapon trails the view, then springs back
    this.lagX += (-this.lookX * 0.9 - this.lagX) * k(9);
    this.lagY += (-this.lookY * 0.9 - this.lagY) * k(9);
    this.lookX = 0; this.lookY = 0;
    const lim = 0.08;
    const lx = THREE.MathUtils.clamp(this.lagX * 12, -lim, lim) * (1 - this.aimK * 0.75);
    const ly = THREE.MathUtils.clamp(this.lagY * 12, -lim, lim) * (1 - this.aimK * 0.75);
    // walking bob: a figure-eight, faster and bigger when running, damped while aiming
    const amp = Math.min(1, s.speed / 6) * (1 + this.runK * 0.8) * (1 - this.aimK * 0.85) * (s.onGround ? 1 : 0.2);
    this.bobAmp += (amp - this.bobAmp) * k(8);
    this.bobT += dt * (s.speed > 0.3 ? 7 + s.speed * 0.55 : 0);
    const bx = Math.sin(this.bobT) * 0.016 * this.bobAmp;
    const by = -Math.abs(Math.cos(this.bobT)) * 0.016 * this.bobAmp;
    const broll = Math.sin(this.bobT) * 0.035 * this.bobAmp;
    // landing dip / hang in the air
    if (s.onGround && !this.wasGround && this.air > 0.25) this.land = Math.min(1, this.air);
    this.air = s.onGround ? 0 : this.air + dt;
    this.wasGround = s.onGround;
    this.land *= Math.exp(-dt * 7);
    const breath = Math.sin(s.time * 1.7) * 0.0022 * (1 - this.aimK * 0.7);

    const A = this.aimK, R = this.runK, L = this.reloadK;
    const hip = this.grenade ? [0.2, -0.22, -0.36] : this.small ? [0.15, -0.15, -0.42] : [0.19, -0.19, -0.47];
    const aimP = [this.scopeX, -this.top - (this.small ? 0.012 : 0.02), this.small ? -0.44 : -0.42];
    this.root.position.set(
      hip[0] + (aimP[0] - hip[0]) * A + bx - lx * 0.25 - R * 0.06 + this.strafeK * 0.008,
      hip[1] + (aimP[1] - hip[1]) * A + by + breath - R * 0.045 - L * 0.1 - this.land * 0.05 - this.crouchK * 0.012 + (s.onGround ? 0 : 0.012),
      hip[2] + (aimP[2] - hip[2]) * A + s.kick * (this.small ? 0.035 : 0.05) + R * 0.03);
    this.root.rotation.set(
      s.kick * (this.small ? 0.2 : 0.12) - L * 0.55 + ly - R * 0.22 + breath * 2 - this.land * 0.1,
      lx + R * 0.75,
      broll + L * 0.35 - this.strafeK * 0.05 + R * 0.25);
    // hip: muzzle a little in towards the crosshair
    this.pivot.rotation.set(0.02 * (1 - A), Math.PI + 0.09 * (1 - A) * (1 - R), 0);
  }

  // muzzle in world space (for tracers / flashes)
  muzzleWorld(out = new THREE.Vector3()) {
    this.pivot.updateMatrixWorld(true);
    return this.pivot.localToWorld(out.set(0, this.top - 0.02, this.muzzle));
  }
}
