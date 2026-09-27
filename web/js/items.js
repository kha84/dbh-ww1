// Inventory, world pickups (repair kits, cutter, tank parts) and heavy things carried in hands
import * as THREE from 'three';
import { partVisual, sandbagMesh } from './tanks.js';
import { partLabel } from './parts.js';
import { WEAPONS, GRENADES, isSmall, bakedWeaponMesh, buildGrenadeMesh, weaponLabel } from './weapons.js';
import { STEEL, colorName } from './paint.js';

export const ITEM_DEFS = {
  repair_kit: { name: 'Ремкомплект', icon: '🧰', desc: 'чинит одну систему (не уничтоженную)' },
  torch:      { name: 'Газовая горелка', icon: '🔥', desc: 'приварить бронелист к корпусу' },
  cutter:     { name: 'Резак', icon: '🪚', desc: 'срезать бронелист с целого танка' },
  plate:      { name: 'Бронелист', icon: '🛡', desc: 'только в руках' },
  shells:     { name: 'Ящик снарядов', icon: '📦', desc: 'только в руках' },
  part:       { name: 'Деталь танка', icon: '⚙', desc: 'только в руках' },
  weapon:     { name: 'Оружие', icon: '🔫' },
  ammo:       { name: 'Патроны', icon: '▪' },
  grenade:    { name: 'Граната', icon: '●' },
  canister:   { name: 'Канистра с топливом', icon: '⛽', desc: 'только в руках' },
  sandbag:    { name: 'Мешок с песком', icon: '▰', desc: 'только в руках' },
  spray:      { name: 'Баллончик с краской', icon: '🎨', desc: 'покрасить танк или заплатку (P)' },
};
// paint used from a full spray can (%): a whole tank (by its weight) / one patch
export const SPRAY_USE = { tank: w => Math.min(90, 25 + w * 1.2), patch: 6 };
export const CANISTER_L = 20;       // litres in a full fuel can

// gas use per second of work (% of a full tool)
export const TOOL_USE = { torch: 10, cutter: 9 };
export const SHELLS_PER_BOX = 6;

// how a part is held in front of the camera
const HAND_POSE = {
  engine: { pos: [0.05, -0.95, -1.7], rot: [0.2, 0.5, 0], s: 0.55 },
  gun:    { pos: [0.4, -0.75, -1.1], rot: [0.05, -0.25, 0], s: 0.4 },
  fuel:   { pos: [0.0, -0.8, -1.4], rot: [0.25, 0.3, 0], s: 0.55 },
  drive:  { pos: [0.0, -0.85, -1.5], rot: [0.5, 0, 0], s: 0.45 },
};
export const CARRY_SPEED = { plate: 0.6, shells: 0.7, engine: 0.45, gun: 0.5, fuel: 0.7, drive: 0.6, canister: 0.8, sandbag: 0.6 };

const mats = {
  kit: new THREE.MeshStandardMaterial({ color: 0x4f6b35, roughness: 0.7 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x7a7f82, roughness: 0.45, metalness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b5a34, roughness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb8903a, roughness: 0.4, metalness: 0.8 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x4a5230, roughness: 0.75, metalness: 0.2 }),
  can: new THREE.MeshStandardMaterial({ color: 0x55602f, roughness: 0.6, metalness: 0.35 }),
};

function glowSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(2.2);
  return s;
}

export function buildItemMesh(type, data = null) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (type === 'repair_kit') {
    add(new THREE.BoxGeometry(0.7, 0.34, 0.36), mats.kit, 0, 0.17, 0);
    add(new THREE.BoxGeometry(0.2, 0.2, 0.02), mats.white, 0, 0.19, 0.185);
    add(new THREE.BoxGeometry(0.06, 0.16, 0.03), mats.red, 0, 0.19, 0.19);
    add(new THREE.BoxGeometry(0.16, 0.06, 0.03), mats.red, 0, 0.19, 0.19);
    add(new THREE.TorusGeometry(0.1, 0.02, 6, 12, Math.PI), mats.dark, 0, 0.34, 0);
  } else if (type === 'cutter') {
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 12), mats.red, -0.12, 0.45, 0);
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x3a6fb0 }), 0.16, 0.45, 0);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), mats.brass, -0.12, 0.96, 0);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), mats.dark, 0.05, 0.3, 0.3, Math.PI / 2, 0, 0.4);
    add(new THREE.CylinderGeometry(0.03, 0.02, 0.45, 8), mats.brass, 0.25, 0.08, 0.55, 0, 0, Math.PI / 2);
  } else if (type === 'torch') {
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.95, 12), mats.white, 0, 0.475, 0);
    add(new THREE.SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.white, 0, 0.95, 0);
    add(new THREE.CylinderGeometry(0.155, 0.155, 0.12, 12), mats.red, 0, 0.8, 0);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), mats.brass, 0, 1.13, 0);
    add(new THREE.TorusGeometry(0.25, 0.02, 6, 16, Math.PI * 1.3), mats.dark, 0.2, 0.9, 0, Math.PI / 2, 0, 0);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), mats.dark, 0.35, 0.06, 0.25, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.012, 0.02, 0.3, 8), mats.brass, 0.62, 0.06, 0.25, 0, 0, Math.PI / 2);
  } else if (type === 'shells') {
    add(new THREE.BoxGeometry(0.9, 0.3, 0.55), mats.wood, 0, 0.15, 0);
    for (let i = 0; i < 3; i++) {
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 10), mats.brass, 0, 0.36, -0.17 + i * 0.17, 0, 0, Math.PI / 2);
      add(new THREE.ConeGeometry(0.06, 0.18, 10), mats.dark, 0.44, 0.36, -0.17 + i * 0.17, 0, 0, -Math.PI / 2);
    }
  } else if (type === 'plate') {
    const pm = mats.steel.clone();
    pm.color.set(data && data.color != null ? data.color : STEEL);
    add(new THREE.BoxGeometry(1.5, 0.06, 1.0), pm, 0, 0.35, 0, 0, 0, 0.45);
    add(new THREE.BoxGeometry(0.12, 0.12, 1.0), mats.dark, -0.62, 0.06, 0);
    g.userData.plateMat = pm;
  } else if (type === 'spray') {
    const cm = new THREE.MeshStandardMaterial({ color: data ? data.color : 0x888888, roughness: 0.35, metalness: 0.5 });
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12), cm, 0, 0.1, 0);
    add(new THREE.CylinderGeometry(0.052, 0.05, 0.03, 12), mats.steel, 0, 0.21, 0);
    add(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 10), cm, 0, 0.245, 0);
    add(new THREE.BoxGeometry(0.018, 0.018, 0.02), mats.dark, 0, 0.26, 0.03);
    add(new THREE.BoxGeometry(0.102, 0.08, 0.102), mats.white, 0, 0.09, 0);
  } else if (type === 'ammo') {
    add(new THREE.BoxGeometry(0.34, 0.2, 0.2), mats.olive, 0, 0.1, 0);
    add(new THREE.BoxGeometry(0.12, 0.03, 0.05), mats.dark, 0, 0.215, 0);
    add(new THREE.BoxGeometry(0.2, 0.06, 0.005), mats.brass, 0, 0.12, 0.101);
  } else if (type === 'canister') {
    add(new THREE.BoxGeometry(0.17, 0.46, 0.35), mats.can, 0, 0.23, 0);
    add(new THREE.BoxGeometry(0.06, 0.05, 0.2), mats.can, 0, 0.49, -0.04);          // handles
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), mats.dark, 0, 0.49, 0.12);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.01, 0.3, 0.22), mats.olive, sx * 0.086, 0.23, 0);
  } else if (type === 'sandbag') {
    g.add(sandbagMesh());
  } else if (type === 'grenade' && data) {
    const m = buildGrenadeMesh(data.key);
    m.rotation.z = Math.PI / 2.4;
    m.position.y = 0.04;
    m.scale.setScalar(1.6);
    g.add(m);
  } else if (type === 'weapon' && data) {
    const v = bakedWeaponMesh(data.key);
    v.group.rotation.set(0, 0, Math.PI / 2);          // lying on its side
    v.group.position.y = 0.035;
    if (isSmall(data.key)) v.group.scale.setScalar(1.4);
    g.add(v.group);
  }
  const glow = glowSprite(type === 'plate' ? 'rgba(160,200,255,0.55)' : type === 'spray' ? 'rgba(220,160,255,0.55)' : type === 'weapon' || type === 'ammo' || type === 'grenade'
    ? 'rgba(255,170,90,0.55)' : 'rgba(255,220,120,0.6)');
  glow.position.y = 0.5;
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

export const shellsLabel = b => `Снаряды ${b.caliber} ×${b.n}`;
export const ammoLabel = (cal, n) => `Патроны ${cal} ×${n}`;
export const grenadeLabel = (key, n) => `Граната ${GRENADES[key].name}` + (n > 1 ? ` ×${n}` : '');

export class Items {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.pickups = new Map();
    this.taken = new Set();
    this.inventory = { repair_kit: 1, torch: 1, cutter: 0 };
    this.charge = { torch: 100, cutter: 100 };   // gas left in the tool in use (%), spares are full
    this.hands = null;             // null | 'plate' | 'part' | 'shells' | 'canister' | 'sandbag'
    this.handPart = null;          // the part carried when hands === 'part'
    this.handShells = null;        // { key, caliber, n } when hands === 'shells'
    this.handCan = null;           // { fuel } when hands === 'canister'
    this.plateColor = STEEL;       // colour of the armour plate in the hands
    this.sprays = [];              // spray cans: [{ color, paint (%) }], the one in use: sprayIdx
    this.sprayIdx = 0;
    // small arms: one small (pistol / revolver / SMG) and one big weapon (rifle / automatic / MG), cartridges by
    // calibre, grenades by type; drawn: which one is in the hands ('small' | 'big' | 'grenade' | null)
    this.small = null;
    this.big = null;
    this.ammo = {};
    this.grenades = {};
    this.drawn = null;
    this.grenadeKey = null;
    this.dropN = 0;
    this.t = 0;
    this.onTaken = () => {};       // (pickup) after something was picked up
  }

  add(id, type, x, z, part = null) {     // part: the tank part ('part'), shells box / weapon / ammo / grenade / can data
    if (this.taken.has(id) || this.pickups.has(id)) return;
    let mesh;
    if (type === 'part') {
      mesh = new THREE.Group();
      const g = partVisual(part).group;
      g.position.set(0, g.userData.groundY || 0, 0);
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(1);
      g.visible = true;
      g.traverse(o => { if (o.isMesh) o.castShadow = true; if (o.userData.interior) o.visible = false; });
      mesh.add(g);
      const glow = buildItemMesh('none').userData.glow;
      glow.position.y = 1.2;
      mesh.add(glow);
      mesh.userData.glow = glow;
    } else mesh = buildItemMesh(type, part);
    const y = this.world.heightAt(x, z);
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    // laid in place (bags of a sandbag wall)
    const place = part && part.place;
    if (place) { mesh.position.y = place.y; mesh.rotation.y = place.rot; if (mesh.userData.glow) mesh.userData.glow.visible = false; }
    this.scene.add(mesh);
    this.pickups.set(id, { id, type, mesh, pos: mesh.position, part: type === 'part' ? part : null,
                           shells: type === 'shells' ? part : null, data: part });
  }

  drop(type, x, z, part = null) {
    this.add(`drop:${this.dropN++}`, type, x, z, part);
  }

  label(p) {
    if (p.type === 'part') return partLabel(p.part);
    if (p.type === 'shells') return shellsLabel(p.shells);
    if (p.type === 'weapon') return `${weaponLabel(p.data)}, в магазине ${p.data.mag}`;
    if (p.type === 'ammo') return ammoLabel(p.data.cal, p.data.n);
    if (p.type === 'grenade') return grenadeLabel(p.data.key, p.data.n);
    if (p.type === 'canister') return `${ITEM_DEFS.canister.name} (${Math.round(p.data.fuel)} л)`;
    if (p.type === 'plate') return `${ITEM_DEFS.plate.name} (${colorName(p.data && p.data.color != null ? p.data.color : STEEL)})`;
    if (p.type === 'spray') return `${ITEM_DEFS.spray.name}: ${colorName(p.data.color)} (${Math.round(p.data.paint)}%)`;
    return ITEM_DEFS[p.type].name;
  }

  // ---- small arms
  slotOf(w) { return isSmall(w.key) ? 'small' : 'big'; }
  // put a weapon into its slot; returns the weapon it replaced (or null)
  giveWeapon(w) {
    const slot = this.slotOf(w);
    const old = this[slot];
    this[slot] = w;
    if (old && this.drawn === slot) this.drawn = slot;
    return old;
  }
  addAmmo(cal, n) { this.ammo[cal] = (this.ammo[cal] || 0) + n; }
  addGrenades(key, n) {
    this.grenades[key] = (this.grenades[key] || 0) + n;
    if (!this.grenadeKey || !this.grenades[this.grenadeKey]) this.grenadeKey = key;
  }
  grenadeTotal() { return Object.values(this.grenades).reduce((a, b) => a + b, 0); }
  // the weapon in the hands (catalog entry + object) or null
  drawnWeapon() {
    if (this.drawn !== 'small' && this.drawn !== 'big') return null;
    const w = this[this.drawn];
    return w ? { w, W: WEAPONS[w.key] } : null;
  }

  // add a tool / kit to the inventory (a new tool starts full)
  give(type, n = 1) {
    if ((type === 'torch' || type === 'cutter') && !this.inventory[type]) this.charge[type] = 100;
    this.inventory[type] = (this.inventory[type] || 0) + n;
  }
  // burn gas of a tool: 'ok' | 'spare' (the tool ran dry, a spare one is taken) | 'empty' (no more tools)
  useTool(type, amount) {
    if (!this.inventory[type]) return 'empty';
    this.charge[type] -= amount;
    if (this.charge[type] > 0) return 'ok';
    this.inventory[type]--;
    if (this.inventory[type] > 0) { this.charge[type] += 100; return 'spare'; }
    this.charge[type] = 0;
    return 'empty';
  }

  // the spray can in use (or null)
  get spray() { return this.sprays[this.sprayIdx] || null; }
  nextSpray() {
    if (this.sprays.length) this.sprayIdx = (this.sprayIdx + 1) % this.sprays.length;
    return this.spray;
  }
  // spend paint of the can in use; an empty can is thrown away
  useSpray(amount) {
    const c = this.spray;
    if (!c) return;
    c.paint -= amount;
    if (c.paint <= 0.5) {
      this.sprays.splice(this.sprayIdx, 1);
      this.sprayIdx = Math.max(0, Math.min(this.sprayIdx, this.sprays.length - 1));
    }
  }

  // put a part into the hands (child of the camera)
  holdPart(part, camera) {
    this.hands = 'part';
    this.handPart = part;
    const g = partVisual(part).group;
    const pose = HAND_POSE[part.kind];
    camera.add(g);
    g.position.set(...pose.pos);
    g.rotation.set(...pose.rot);
    g.scale.setScalar(pose.s);
    g.visible = true;
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  }
  releasePart() {
    const part = this.handPart;
    this.hands = null;
    this.handPart = null;
    if (part) part.vis.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return part;
  }
  carrySpeed() {
    if (this.hands === 'plate') return CARRY_SPEED.plate;
    if (this.hands === 'shells') return CARRY_SPEED.shells;
    if (this.hands === 'canister') return CARRY_SPEED.canister;
    if (this.hands === 'sandbag') return CARRY_SPEED.sandbag;
    if (this.hands === 'part') return CARRY_SPEED[this.handPart.kind];
    return 1;
  }

  remove(id, taken = true) {
    const p = this.pickups.get(id);
    if (!p) return;
    this.scene.remove(p.mesh);
    this.pickups.delete(id);
    if (taken) { this.taken.add(id); this.onTaken(p); }
  }

  nearest(pos, maxD = 2.6) {
    let best = null, bd = maxD;
    for (const p of this.pickups.values()) {
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bd && Math.abs(p.pos.y - pos.y) < 3) { bd = d; best = p; }
    }
    return best;
  }

  // take into inventory / hands; returns message or null
  take(p, camera) {
    if (p.type === 'plate') {
      if (this.hands) return null;
      this.hands = 'plate';
      this.plateColor = p.data && p.data.color != null ? p.data.color : STEEL;
      this.remove(p.id);
      return this.label(p);
    } else if (p.type === 'spray') {
      this.sprays.push({ ...p.data });
      this.sprayIdx = this.sprays.length - 1;
      this.remove(p.id);
      return this.label(p);
    } else if (p.type === 'part') {
      if (this.hands) return null;
      this.remove(p.id);
      this.holdPart(p.part, camera);
      return partLabel(p.part);
    } else if (p.type === 'shells') {
      if (this.hands) return null;
      this.hands = 'shells';
      this.handShells = p.shells;
      this.remove(p.id);
      return shellsLabel(p.shells);
    } else if (p.type === 'canister' || p.type === 'sandbag') {
      if (this.hands) return null;
      this.hands = p.type;
      this.handCan = p.type === 'canister' ? p.data : null;
      this.remove(p.id);
      return this.label(p);
    } else if (p.type === 'weapon') {
      const label = weaponLabel(p.data);
      const old = this.giveWeapon(p.data);
      this.remove(p.id);
      if (old) { this.drop('weapon', p.pos.x + 0.6, p.pos.z + 0.4, old); return `${label} (брошено: ${weaponLabel(old)})`; }
      return label;
    } else if (p.type === 'ammo') {
      this.addAmmo(p.data.cal, p.data.n);
      this.remove(p.id);
      return ammoLabel(p.data.cal, p.data.n);
    } else if (p.type === 'grenade') {
      this.addGrenades(p.data.key, p.data.n);
      this.remove(p.id);
      return grenadeLabel(p.data.key, p.data.n);
    } else {
      this.give(p.type);
    }
    this.remove(p.id);
    return ITEM_DEFS[p.type].name;
  }

  // drop items of settlements that were unloaded
  prune(center, radius) {
    for (const p of [...this.pickups.values()]) {
      if (Math.hypot(p.pos.x - center.x, p.pos.z - center.z) > radius && !p.id.startsWith('drop:'))
        this.remove(p.id, false);
    }
  }

  update(dt) {
    this.t += dt;
    for (const p of this.pickups.values()) {
      const g = p.mesh.userData.glow;
      if (g) g.material.opacity = 0.55 + 0.35 * Math.sin(this.t * 3 + p.pos.x);
    }
  }
}
