// Roadside settlements: villages, towns, gas stations, tank repair stations
import * as THREE from 'three';
import { rng } from './noise.js';

export const SETTLEMENT_NAMES = {
  village: ['Берёзовка', 'Ивановка', 'Сосновка', 'Малиновка', 'Кривцы', 'Заречье', 'Горелово',
            'Липки', 'Дубки', 'Каменка', 'Ольховка', 'Покровка', 'Сухой Лог', 'Бобровка'],
  town:    ['Краснополье', 'Новоград', 'Верхнедонск', 'Старый Оскол', 'Приволжск', 'Белозёрск'],
  gas:     ['АЗС «Путь»', 'АЗС №17', 'Заправка «Горизонт»', 'АЗС «Дорожная»', 'Бензоколонка'],
  repair:  ['Ремпункт №3', 'Танкоремонтный пункт', 'Ремпункт «Броня»', 'ПТРМ-12', 'Мастерские'],
};

export const SETTLEMENT_LABEL = {
  village: 'Село', town: 'Город', gas: 'Заправка', repair: 'Ремпункт',
};

// ---- shared geometry / materials
const box = new THREE.BoxGeometry(1, 1, 1);
box.translate(0, 0.5, 0);                          // origin at bottom centre
const roofGeo = (() => {                           // unit gable roof, ridge along Z
  const g = new THREE.BufferGeometry();
  const v = [
    // left slope
    -0.5, 0, -0.5,  0, 1, 0.5,  0, 1, -0.5,
    -0.5, 0, -0.5, -0.5, 0, 0.5,  0, 1, 0.5,
    // right slope
    0.5, 0, -0.5,  0, 1, -0.5,  0, 1, 0.5,
    0.5, 0, -0.5,  0, 1, 0.5,  0.5, 0, 0.5,
    // gables
    -0.5, 0, 0.5,  0.5, 0, 0.5,  0, 1, 0.5,
    -0.5, 0, -0.5,  0, 1, -0.5,  0.5, 0, -0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
cyl.translate(0, 0.5, 0);
const halfCyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI);
halfCyl.rotateX(Math.PI / 2);   // axis along Z, dome up
halfCyl.rotateZ(Math.PI / 2);
const sphere = new THREE.SphereGeometry(0.5, 12, 10);

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const MAT = {
  walls: [M(0xe8e2d0), M(0xd8c9a8), M(0x9c7a52), M(0xb7c4c9), M(0xcfb58a), M(0x8f6a45)],
  roofs: [M(0x6e4a38), M(0x4f5d63), M(0x7c3b2e), M(0x5a6b4a), M(0x8a7f70)],
  window: M(0x2a3238, { roughness: 0.3, metalness: 0.3 }),
  concrete: M(0x9a9890),
  darkConcrete: M(0x77756f),
  metal: M(0x6c7378, { metalness: 0.5, roughness: 0.5 }),
  red: M(0xb3302a),
  yellow: M(0xd9b23a),
  wood: M(0x7a5a3a),
  crate: M(0x6b5a34),
  green: M(0x4d5a36),
  tire: M(0x1e1e1e),
  barrel: M(0x3f5a3a, { metalness: 0.4 }),
  gold: M(0xd8b04a, { metalness: 0.8, roughness: 0.3 }),
  white: M(0xf0efe8),
  hangar: M(0x7d8a86, { metalness: 0.4, roughness: 0.6 }),
};

function signTexture(title, sub) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ea'; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 88);
  g.fillStyle = '#111'; g.textAlign = 'center';
  g.font = 'bold 30px Arial'; g.fillText(title, 128, 50, 236);
  g.font = '18px Arial'; g.fillText(sub, 128, 78, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function numberTexture(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(240,240,232,.92)';
  g.font = 'bold 110px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(n, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSettlement(world, plan) {
  const r = rng(plan.seed);
  const group = new THREE.Group();
  const obstacles = [];
  const zones = [];
  const items = [];
  let itemN = 0;

  // local frame: along = distance along road from plan.z, side offset from centreline (+ = +X side)
  const frame = (along, off) => {
    const z = plan.z + along;
    const rx = world.roadX(z);
    const s = world.roadSlope(z);
    const l = Math.hypot(1, s);
    return { x: rx + off / l, z: z - off * s / l, rot: Math.atan2(s, 1) };
  };
  const groundMin = (x, z, rad) => Math.min(
    world.heightAt(x, z), world.heightAt(x + rad, z), world.heightAt(x - rad, z),
    world.heightAt(x, z + rad), world.heightAt(x, z - rad));

  const part = (geo, mat, x, y, z, sx, sy, sz, rot, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.y = rot;
    m.castShadow = shadow; m.receiveShadow = true;
    group.add(m);
    return m;
  };
  // put a part at local offset (lx along building X, lz along building Z) relative to f
  const at = (f, lx, lz) => ({
    x: f.x + lx * Math.cos(f.rot) + lz * Math.sin(f.rot),
    z: f.z - lx * Math.sin(f.rot) + lz * Math.cos(f.rot),
  });
  const obstacle = (f, hx, hz, y0, y1) => {
    const o = world.addObstacle({ x: f.x, z: f.z, hx, hz, rot: f.rot, y0, y1 });
    obstacles.push(o);
    return o;
  };
  const addItem = (type, x, z, extra = {}) => items.push({ id: `s${plan.k}:${itemN++}`, type, x, z, ...extra });

  // ------------------------------------------------------------ builders
  const house = (along, off, w, d, hWall, story = 1, flat = false) => {
    const f = frame(along, off);
    // face the road: long side along the road
    const y = groundMin(f.x, f.z, Math.max(w, d) / 2) - 0.3;
    const wall = r.pick(MAT.walls);
    const H = hWall * story;
    part(box, wall, f.x, y, f.z, d, H + 0.3, w, f.rot);
    // windows on the road-facing wall
    const face = off > 0 ? -1 : 1;
    const nWin = Math.max(1, Math.floor(w / 3));
    for (let s = 0; s < story; s++) {
      for (let i = 0; i < nWin; i++) {
        const lz = -w / 2 + (i + 0.5) * (w / nWin);
        const p = at(f, face * (d / 2 + 0.02), lz);
        part(box, MAT.window, p.x, y + 1.3 + s * hWall, p.z, 0.08, 1.1, 0.9, f.rot, false);
      }
    }
    if (flat) {
      part(box, MAT.darkConcrete, f.x, y + H + 0.3, f.z, d + 0.3, 0.3, w + 0.3, f.rot);
    } else {
      part(roofGeo, r.pick(MAT.roofs), f.x, y + H + 0.3, f.z, d + 0.8, Math.min(3, d * 0.45), w + 0.6, f.rot);
      if (r() < 0.6) {
        const p = at(f, d * 0.2, w * 0.25);
        part(box, MAT.darkConcrete, p.x, y + H, p.z, 0.6, 2.4, 0.6, f.rot);
      }
    }
    obstacle(f, d / 2, w / 2, y, y + H + 3);
    return f;
  };

  const fence = (along, off, len) => {
    const f = frame(along, off);
    const y = world.heightAt(f.x, f.z);
    part(box, MAT.wood, f.x, y, f.z, 0.12, 1.1, len, f.rot);
  };

  const crates = (f, n) => {
    for (let i = 0; i < n; i++) {
      const p = at(f, (r() - 0.5) * 5, (r() - 0.5) * 5);
      const s = 0.8 + r() * 0.5;
      part(box, MAT.crate, p.x, world.heightAt(p.x, p.z) + (i % 3 === 2 ? s : 0), p.z, s, s, s * 1.4, f.rot + r() * 0.3);
    }
  };

  const barrels = (f, n) => {
    for (let i = 0; i < n; i++) {
      const p = at(f, (i % 3) * 0.8, Math.floor(i / 3) * 0.8);
      part(cyl, MAT.barrel, p.x, world.heightAt(p.x, p.z), p.z, 0.65, 1.0, 0.65, 0);
    }
  };

  const sign = (along, off, title, sub, face) => {
    const f = frame(along, off);
    const y = world.heightAt(f.x, f.z);
    part(box, MAT.wood, f.x, y, f.z, 0.15, 2.4, 0.15, f.rot);
    const tex = signTexture(title, sub);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
    board.position.set(f.x, y + 2.6, f.z);
    board.rotation.y = f.rot + (face < 0 ? Math.PI : 0);
    group.add(board);
  };

  // ------------------------------------------------------------ layouts
  const typeLabel = SETTLEMENT_LABEL[plan.type];
  sign(-plan.halfLen - 8, 7, plan.name, typeLabel, -1);
  sign(plan.halfLen + 8, -7, plan.name, typeLabel, 1);

  if (plan.type === 'village' || plan.type === 'town') {
    const town = plan.type === 'town';
    const rows = town ? [[17, 26], [42, 52]] : [[15, 24]];
    const houses = [];
    for (const side of [-1, 1]) {
      for (const [o0, o1] of rows) {
        for (let a = -plan.halfLen + 10; a < plan.halfLen - 10; a += town ? 20 + r() * 8 : 22 + r() * 12) {
          if (r() < (town ? 0.2 : 0.3)) continue;
          if (town && Math.abs(a) < 22) continue;          // central square
          const w = town ? 9 + r() * 6 : 6.5 + r() * 3.5;
          const d = town ? 8 + r() * 4 : 6 + r() * 2;
          const off = side * (o0 + r() * (o1 - o0) + d / 2);
          const story = town && r() < 0.5 ? 2 : 1;
          houses.push(house(a, off, w, d, 3.1, story, town && story === 2 && r() < 0.6));
          if (!town && r() < 0.5) fence(a, off - side * (d / 2 + 4), w + 4);
        }
      }
    }
    // loot in yards
    const nKits = town ? 2 + (r() < 0.5 ? 1 : 0) : 1 + (r() < 0.35 ? 1 : 0);
    for (let i = 0; i < nKits && houses.length; i++) {
      const h = houses[Math.floor(r() * houses.length)];
      const p = at(h, (h.x > world.roadX(h.z) ? -1 : 1) * 7, (r() - 0.5) * 4);
      addItem('repair_kit', p.x, p.z);
    }
    if (plan.hasCutter && houses.length) {
      const h = houses[0];
      const p = at(h, (h.x > world.roadX(h.z) ? -1 : 1) * 7, 2);
      addItem('cutter', p.x, p.z);
    }
    if (town) {
      // church on the square
      const f = frame(0, 30);
      const y = groundMin(f.x, f.z, 6) - 0.3;
      part(box, MAT.white, f.x, y, f.z, 10, 9, 14, f.rot);
      part(roofGeo, MAT.roofs[1], f.x, y + 9, f.z, 10.5, 4, 14.5, f.rot);
      const t = at(f, 0, -9);
      part(box, MAT.white, t.x, y, t.z, 5, 17, 5, f.rot);
      part(cyl, MAT.white, t.x, y + 17, t.z, 3.6, 2.5, 3.6, 0);
      part(sphere, MAT.gold, t.x, y + 20.3, t.z, 4, 5, 4, 0);
      part(box, MAT.gold, t.x, y + 22.5, t.z, 0.2, 3, 0.2, f.rot);
      part(box, MAT.gold, t.x, y + 24, t.z, 0.2, 0.2, 1.4, f.rot);
      obstacle(f, 5, 7, y, y + 13);
      obstacle({ x: t.x, z: t.z, rot: f.rot }, 2.5, 2.5, y, y + 24);
      // ammo depot on the other side of the square
      const dep = frame(0, -24);
      const dy = world.heightAt(dep.x, dep.z);
      const tent = at(dep, -6, 0);
      part(halfCyl, MAT.green, tent.x, dy, tent.z, 3, 3, 8, dep.rot);
      obstacle({ x: tent.x, z: tent.z, rot: dep.rot }, 3, 4, dy, dy + 3);
      crates(at(dep, 2, 5), 6);
      crates(at(dep, 2, -5), 5);
      zones.push({ type: 'ammo', x: dep.x, z: dep.z, r: 14, label: 'Склад боеприпасов' });
    } else {
      // village well
      const f = frame(0, 11);
      const y = world.heightAt(f.x, f.z);
      part(cyl, MAT.darkConcrete, f.x, y, f.z, 1.6, 0.9, 1.6, 0);
      part(roofGeo, MAT.wood, f.x, y + 2.2, f.z, 2, 0.8, 2, f.rot);
      obstacle(f, 0.9, 0.9, y, y + 3);
    }
  }

  if (plan.type === 'gas') {
    const side = r() < 0.5 ? -1 : 1;
    const f = frame(0, side * 17);
    const y = world.roadH(plan.z);
    // forecourt slab
    part(box, MAT.concrete, f.x, y - 0.25, f.z, 14, 0.36, 22, f.rot, false);
    // canopy on 4 posts
    for (const [lx, lz] of [[-4.5, -7], [4.5, -7], [-4.5, 7], [4.5, 7]]) {
      const p = at(f, lx, lz);
      part(box, MAT.white, p.x, y, p.z, 0.35, 5, 0.35, f.rot);
      obstacle({ x: p.x, z: p.z, rot: f.rot }, 0.25, 0.25, y, y + 5);
    }
    part(box, MAT.red, f.x, y + 5, f.z, 11, 0.8, 18, f.rot);
    // pumps
    for (const lz of [-3.5, 3.5]) {
      const p = at(f, 0, lz);
      part(box, MAT.concrete, p.x, y, p.z, 1.2, 0.25, 2.2, f.rot);
      part(box, MAT.red, p.x, y + 0.25, p.z, 0.8, 1.7, 1.2, f.rot);
      part(box, MAT.yellow, p.x, y + 1.95, p.z, 0.85, 0.3, 1.25, f.rot);
      obstacle({ x: p.x, z: p.z, rot: f.rot }, 0.6, 1.1, y, y + 2.2);
    }
    // kiosk
    const k = frame(0, side * 31);
    const ky = groundMin(k.x, k.z, 4) - 0.3;
    part(box, MAT.walls[3], k.x, ky, k.z, 6, 3.4, 9, k.rot);
    const kw = at(k, -side * 3.02, 0);
    part(box, MAT.window, kw.x, ky + 1, kw.z, 0.08, 1.4, 6, k.rot, false);
    part(box, MAT.red, k.x, ky + 3.4, k.z, 6.4, 0.5, 9.4, k.rot);
    obstacle(k, 3, 4.5, ky, ky + 4);
    const b = at(k, 0, 7);
    barrels({ x: b.x, z: b.z, rot: k.rot }, 5);
    // tall price pole
    const pole = frame(-14, side * 9);
    const py = world.heightAt(pole.x, pole.z);
    part(box, MAT.metal, pole.x, py, pole.z, 0.3, 7, 0.3, pole.rot);
    part(box, MAT.red, pole.x, py + 6, pole.z, 0.3, 2.2, 2.6, pole.rot);
    zones.push({ type: 'fuel', x: f.x, z: f.z, r: 11, label: 'Заправка' });
    if (r() < 0.4) { const p = at(k, 0, -7); addItem('repair_kit', p.x, p.z); }
  }

  let crane = null;
  if (plan.type === 'repair') {
    const side = r() < 0.5 ? -1 : 1;
    const y = world.roadH(plan.z);
    // concrete pad between road and hangar
    const pad = frame(0, side * 16);
    part(box, MAT.concrete, pad.x, y - 0.25, pad.z, 14, 0.36, 28, pad.rot, false);
    const paint = (mat, lx, lz, sx, sz) => {
      const p = at(pad, lx, lz);
      part(box, mat, p.x, y + 0.11, p.z, sx, 0.02, sz, pad.rot, false);
    };
    // tank bay under the crane
    paint(MAT.yellow, -2.7, 0, 0.25, 8.8); paint(MAT.yellow, 2.7, 0, 0.25, 8.8);
    paint(MAT.yellow, 0, -4.4, 5.65, 0.25); paint(MAT.yellow, 0, 4.4, 5.65, 0.25);
    // two numbered turret stands
    const slots = [];
    [-9.5, 9.5].forEach((lz, i) => {
      const p = at(pad, 0, lz);
      part(box, MAT.darkConcrete, p.x, y + 0.1, p.z, 2.2, 0.25, 2.2, pad.rot);
      for (const [lx, lz2, sx, sz] of [[-2.1, 0, 0.2, 4.4], [2.1, 0, 0.2, 4.4], [0, -2.1, 4.4, 0.2], [0, 2.1, 4.4, 0.2]])
        paint(MAT.white, lx, lz + lz2, sx, sz);
      const n = at(pad, -side * 3.6, lz);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8),
        new THREE.MeshStandardMaterial({ map: numberTexture(String(i + 1)), transparent: true, roughness: 0.9 }));
      plate.rotation.set(-Math.PI / 2, 0, pad.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
      plate.position.set(n.x, y + 0.125, n.z);
      plate.receiveShadow = true;
      group.add(plate);
      slots.push({ x: p.x, z: p.z, y: y + 0.35 });
    });
    // overhead crane: posts, runway beams along the pad (bridge and trolley are animated by the workshop)
    const beamY = y + 7.2;
    for (const lz of [-12.8, 12.8]) {
      for (const lx of [-6.5, 6.5]) {
        const p = at(pad, lx, lz);
        part(box, MAT.yellow, p.x, y, p.z, 0.45, 7.2, 0.45, pad.rot);
        obstacle({ x: p.x, z: p.z, rot: pad.rot }, 0.3, 0.3, y, y + 7.2);
      }
      const p = at(pad, 0, lz);
      part(box, MAT.yellow, p.x, beamY, p.z, 13.4, 0.5, 0.5, pad.rot);
    }
    for (const lx of [-6.5, 6.5]) {
      const p = at(pad, lx, 0);
      part(box, MAT.yellow, p.x, beamY, p.z, 0.5, 0.5, 26.1, pad.rot);
    }
    // crane control panel
    const pp = at(pad, side * 8.3, -3.5);
    part(box, MAT.metal, pp.x, y, pp.z, 0.6, 1.05, 0.9, pad.rot);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5),
      new THREE.MeshStandardMaterial({ map: signTexture('КРАН', 'пульт управления'), roughness: 0.6 }));
    const sp = at(pad, side * 8.0, -3.5);
    scr.position.set(sp.x, y + 1.25, sp.z);
    scr.rotation.set(0, pad.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2), 0);
    scr.rotateX(-0.5);
    group.add(scr);
    part(box, MAT.metal, sp.x, y + 1.0, sp.z, 0.25, 0.32, 0.9, pad.rot);
    part(box, MAT.red, pp.x, y + 1.08, pp.z, 0.12, 0.08, 0.12, pad.rot);
    obstacle({ x: pp.x, z: pp.z, rot: pad.rot }, 0.35, 0.5, y, y + 1.4);
    crane = { k: plan.k, x: pad.x, z: pad.z, rot: pad.rot, y, side, beamY, slots,
              spot: at(pad, 0, 0), panel: { x: pp.x, z: pp.z } };
    // hangar
    const hf = frame(0, side * 36);
    const hy = groundMin(hf.x, hf.z, 10) - 0.3;
    part(halfCyl, MAT.hangar, hf.x, hy, hf.z, 9, 8, 24, hf.rot);
    obstacle(hf, 9, 12, hy, hy + 8);
    // workshop hut
    const w = frame(22, side * 26);
    const wy = groundMin(w.x, w.z, 4) - 0.3;
    part(box, MAT.walls[4], w.x, wy, w.z, 7, 3.2, 8, w.rot);
    part(roofGeo, MAT.roofs[0], w.x, wy + 3.2, w.z, 7.6, 2, 8.6, w.rot);
    obstacle(w, 3.5, 4, wy, wy + 5);
    // tyre stacks & barrels
    const t = frame(-20, side * 24);
    for (let i = 0; i < 4; i++) {
      const p = at(t, (i % 2) * 1.4, Math.floor(i / 2) * 1.4);
      for (let j = 0; j < 3; j++) {
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.2, 6, 12), MAT.tire);
        m.rotation.x = Math.PI / 2;
        m.position.set(p.x, world.heightAt(p.x, p.z) + 0.2 + j * 0.4, p.z);
        m.castShadow = true;
        group.add(m);
      }
    }
    barrels(frame(-22, side * 30), 6);
    crates(frame(20, side * 14), 4);
    zones.push({ type: 'repair', x: pad.x, z: pad.z, r: 12, label: 'Ремонтная площадка' });
    const nk = 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < nk; i++) { const p = at(w, -side * 5.5, -2 + i * 2); addItem('repair_kit', p.x, p.z); }
    if (plan.hasCutter) { const p = at(w, -side * 5.5, 2.5); addItem('cutter', p.x, p.z); }
    if (r() < 0.35 || plan.k === 1) { const p = at(pad, -side * 1, 16); addItem('plate', p.x, p.z); }
    // used spare parts lying by the hangar
    const nParts = plan.k === 1 ? 2 : (r() < 0.6 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
    const keys = ['t55', 'abrams', 'avre', 'markV'];
    for (let i = 0; i < nParts; i++) {
      const kind = ['engine', 'gun', 'fuel', 'drive'][Math.floor(r() * 4)];
      const key = kind === 'drive' ? keys[Math.floor(r() * 3)] : keys[Math.floor(r() * 4)];
      const p = frame(-8 - i * 4.5, side * 25.5);
      addItem('part', p.x, p.z, { kind, key, hp: Math.round(55 + r() * 45) });
    }
  }

  world.scene.add(group);
  return { plan, group, obstacles, zones, items, crane };
}
