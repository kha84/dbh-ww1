// Inventory, world pickups (repair kits, cutter) and armour plates carried in hands
import * as THREE from 'three';

export const ITEM_DEFS = {
  repair_kit: { name: 'Ремкомплект', icon: '🧰', desc: 'чинит одну систему (не уничтоженную)' },
  torch:      { name: 'Газовая горелка', icon: '🔥', desc: 'приварить бронелист к корпусу' },
  cutter:     { name: 'Резак', icon: '🪚', desc: 'срезать бронелист с целого танка' },
  plate:      { name: 'Бронелист', icon: '🛡', desc: 'только в руках' },
};

const mats = {
  kit: new THREE.MeshStandardMaterial({ color: 0x4f6b35, roughness: 0.7 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x7a7f82, roughness: 0.45, metalness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb8903a, roughness: 0.4, metalness: 0.8 }),
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

export function buildItemMesh(type) {
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
  } else if (type === 'plate') {
    add(new THREE.BoxGeometry(1.5, 0.06, 1.0), mats.steel, 0, 0.35, 0, 0, 0, 0.45);
    add(new THREE.BoxGeometry(0.12, 0.12, 1.0), mats.dark, -0.62, 0.06, 0);
  }
  const glow = glowSprite(type === 'plate' ? 'rgba(160,200,255,0.55)' : 'rgba(255,220,120,0.6)');
  glow.position.y = 0.5;
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

export class Items {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.pickups = new Map();
    this.taken = new Set();
    this.inventory = { repair_kit: 1, torch: 1, cutter: 0 };
    this.hands = null;             // null | 'plate'
    this.dropN = 0;
    this.t = 0;
  }

  add(id, type, x, z) {
    if (this.taken.has(id) || this.pickups.has(id)) return;
    const mesh = buildItemMesh(type);
    const y = this.world.heightAt(x, z);
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    this.pickups.set(id, { id, type, mesh, pos: mesh.position });
  }

  drop(type, x, z) {
    this.add(`drop:${this.dropN++}`, type, x, z);
  }

  remove(id, taken = true) {
    const p = this.pickups.get(id);
    if (!p) return;
    this.scene.remove(p.mesh);
    this.pickups.delete(id);
    if (taken) this.taken.add(id);
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
  take(p) {
    if (p.type === 'plate') {
      if (this.hands) return null;
      this.hands = 'plate';
    } else {
      this.inventory[p.type] = (this.inventory[p.type] || 0) + 1;
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
      g.material.opacity = 0.55 + 0.35 * Math.sin(this.t * 3 + p.pos.x);
    }
  }
}
