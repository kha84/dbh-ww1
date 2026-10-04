// Bridges over the rivers (rivers.js plans them): timber trestle, steel girder or stone piers; the deck is walkable
// ground (world.heightAt -> bridgeAt), the railings / parapets are obstacles keeping the tanks on the deck.
import * as THREE from 'three';

const M = (color, r = 0.9, m = 0.05) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
const MAT = {
  timber: M(0x6b5238), timberDark: M(0x4a3a28), plank: M(0x7d6446), steel: M(0x4f5a5c, 0.55, 0.6), rust: M(0x6e4a32, 0.8, 0.4),
  stone: M(0x8a857a), stoneDark: M(0x6d695f), concrete: M(0x9a978d), sign: null,
};
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);

function signTexture(title, sub) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#e9ecef'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#1f4f8f'; g.fillRect(6, 6, 244, 84);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = 'bold 34px Arial'; g.fillText(title, 128, 50, 236);
  g.font = '18px Arial'; g.fillText(sub, 128, 78, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// build the bridge of river plan p: meshes, railing obstacles and the deck (for world.heightAt)
export function buildBridge(world, p) {
  const group = new THREE.Group();
  const obstacles = [];
  const WATER = world.WATER_LEVEL;
  const z0 = p.z;
  const hd = world.roadHeading(z0);
  const dx = Math.sin(hd), dz = Math.cos(hd);            // along the road
  const px = Math.cos(hd), pz = -Math.sin(hd);           // across (+X side)
  const cx = world.roadX(z0), L = p.halfSpan + 4, HW = 5.6;
  const put = (geo, mat, x, y, z, sx, sy, sz, ry = hd, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.rotation.order = 'YXZ'; m.rotation.set(rx, ry, 0);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const at = (u, v) => ({ x: cx + dx * u + px * v, z: z0 + dz * u + pz * v });
  const deckY = u => world.roadH(at(u, 0).z);
  const bed = WATER - p.depth;
  const type = p.type;
  // deck in 4 m segments following the road's grade
  const seg = 4;
  for (let u = -L; u < L - 1e-3; u += seg) {
    const u1 = Math.min(L, u + seg), um = (u + u1) / 2;
    const y0 = deckY(u), y1 = deckY(u1);
    const pitch = -Math.atan2(y1 - y0, u1 - u);
    const c = at(um, 0);
    const deckMat = type === 'wood' ? MAT.plank : type === 'stone' ? MAT.stone : MAT.concrete;
    put(BOX, deckMat, c.x, (y0 + y1) / 2 - 0.2, c.z, HW * 2, 0.4, u1 - u + 0.02, hd, pitch);
    if (type === 'wood') for (let k = 0; k < 4; k++) put(BOX, MAT.timberDark, c.x, (y0 + y1) / 2 - 0.25, c.z, HW * 2 + 0.2, 0.08, 0.15, hd, pitch).position.add(new THREE.Vector3(dx, 0, dz).multiplyScalar(-seg / 2 + k * seg / 4));
    if (type === 'steel') for (const v of [-HW + 0.3, HW - 0.3, 0]) {                        // girders under the deck
      const g = at(um, v);
      put(BOX, MAT.steel, g.x, (y0 + y1) / 2 - 0.75, g.z, 0.35, 0.8, u1 - u + 0.02, hd, pitch);
    }
  }
  // supports down to the river bed
  const spacing = type === 'wood' ? 5 : type === 'steel' ? 12 : 9;
  const nSup = Math.max(1, Math.floor((2 * L) / spacing));
  for (let i = 1; i < nSup; i++) {
    const u = -L + i * (2 * L) / nSup;
    const y = deckY(u) - 0.4;
    const ground = Math.min(world.height(at(u, 0).x, at(u, 0).z), y - 0.5);
    const h = y - Math.min(ground, bed) + 0.5;
    if (h < 0.3) continue;
    if (type === 'wood') {
      for (const v of [-HW + 0.6, -HW / 3, HW / 3, HW - 0.6]) {
        const q = at(u, v);
        put(CYL, MAT.timber, q.x, y - h / 2, q.z, 0.16, h, 0.16);
      }
      const q = at(u, 0);
      put(BOX, MAT.timberDark, q.x, y - 0.25, q.z, HW * 2, 0.3, 0.3);
      put(BOX, MAT.timberDark, q.x, y - h * 0.5, q.z, HW * 1.8, 0.14, 0.14, hd, 0).rotation.z = 0.35;   // cross brace
    } else if (type === 'steel') {
      const q = at(u, 0);
      put(BOX, MAT.concrete, q.x, y - h / 2 - 0.6, q.z, HW * 1.4, h, 1.2);
      put(BOX, MAT.concrete, q.x, y - 1.25, q.z, HW * 2.1, 0.5, 1.5);
    } else {
      const q = at(u, 0);
      put(BOX, MAT.stoneDark, q.x, y - h / 2, q.z, HW * 2 + 0.4, h, 1.6);
      put(BOX, MAT.stone, q.x, y - h + 0.3, q.z, HW * 2 + 0.9, 0.6, 2.2);                // cutwater footing
    }
  }
  // abutments at both ends
  for (const u of [-L, L]) {
    const q = at(u, 0), y = deckY(u);
    put(BOX, type === 'wood' ? MAT.timberDark : MAT.stoneDark, q.x, y - 1.6, q.z, HW * 2 + 0.6, 3.2, 1.2);
  }
  // railings / parapets (+ obstacles keeping tanks on the deck)
  for (const side of [-1, 1]) {
    const v = side * (HW - 0.12);
    for (let u = -L; u < L - 1e-3; u += seg) {
      const u1 = Math.min(L, u + seg), um = (u + u1) / 2;
      const y0 = deckY(u), y1 = deckY(u1), pitch = -Math.atan2(y1 - y0, u1 - u);
      const c = at(um, v);
      if (type === 'stone') put(BOX, MAT.stone, c.x, (y0 + y1) / 2 + 0.45, c.z, 0.35, 0.9, u1 - u + 0.02, hd, pitch);
      else {
        put(BOX, type === 'wood' ? MAT.timber : MAT.steel, c.x, (y0 + y1) / 2 + 1.0, c.z, 0.12, 0.12, u1 - u + 0.02, hd, pitch);
        put(BOX, type === 'wood' ? MAT.timber : MAT.steel, c.x, (y0 + y1) / 2 + 0.5, c.z, 0.08, 0.08, u1 - u + 0.02, hd, pitch);
        const q = at(u, v);
        put(BOX, type === 'wood' ? MAT.timberDark : MAT.steel, q.x, y0 + 0.55, q.z, 0.16, 1.1, 0.16);
        if (type === 'steel') {                                                             // truss diagonals
          const d = put(BOX, MAT.steel, c.x, (y0 + y1) / 2 + 0.75, c.z, 0.08, 0.08, Math.hypot(u1 - u, 0.9));
          d.rotation.set(Math.atan2(0.9, u1 - u) * (Math.floor((u + L) / seg) % 2 ? 1 : -1) + pitch, hd, 0);
        }
      }
    }
    const mid = at(0, side * (HW + 0.15));
    const o = world.addObstacle({ x: mid.x, z: mid.z, hx: 0.3, hz: L, rot: hd, y0: deckY(0) - 1, y1: deckY(0) + 1.2 });
    obstacles.push(o);
  }
  // name boards at both ends
  const tex = signTexture(`р. ${p.name}`, 'мост');
  for (const u of [-L - 3, L + 3]) {
    const q = at(u, HW + 1.5), y = world.roadH(q.z);
    put(BOX, MAT.timberDark, q.x, y + 1.1, q.z, 0.1, 2.2, 0.1);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
    board.position.set(q.x, y + 2.3, q.z);
    board.rotation.y = hd + (u < 0 ? Math.PI : 0);
    group.add(board);
  }
  world.scene.add(group);
  return {
    plan: p, group, obstacles, cx, cz: z0, dx, dz, px, pz, L: L + 0.5, HW,
    // deck height at (x, z) or null when off the bridge
    deckAt(x, z) {
      const rx = x - cx, rz = z - z0;
      const u = rx * dx + rz * dz, v = rx * px + rz * pz;
      if (Math.abs(u) > this.L || Math.abs(v) > HW) return null;
      return world.roadH(z0 + dz * u);
    },
    dispose() {
      world.scene.remove(group);
      for (const o of obstacles) world.removeObstacle(o);
    },
  };
}
