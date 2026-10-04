// Small settlement props: fences, crate piles, barrels, tyre stacks, road signs with the settlement's name.
import * as THREE from 'three';
import { MAT, box, cyl, signTexture } from './kit.js';

/** @typedef {import('./kit.js').Kit} Kit */
/** @typedef {import('./kit.js').Frame} Frame */

/** @param {Kit} K */
export function fence(K, along, off, len) {
  const f = K.frame(along, off);
  const y = K.world.heightAt(f.x, f.z);
  K.part(box, MAT.wood, f.x, y, f.z, 0.12, 1.1, len, f.rot);
}

/** @param {Kit} K @param {Frame} f */
export function crates(K, f, n) {
  const { r, world } = K;
  for (let i = 0; i < n; i++) {
    const p = K.at(f, (r() - 0.5) * 5, (r() - 0.5) * 5);
    const s = 0.8 + r() * 0.5;
    K.part(box, MAT.crate, p.x, world.heightAt(p.x, p.z) + (i % 3 === 2 ? s : 0), p.z, s, s, s * 1.4, f.rot + r() * 0.3);
  }
}

/** @param {Kit} K @param {Frame} f */
export function barrels(K, f, n) {
  for (let i = 0; i < n; i++) {
    const p = K.at(f, (i % 3) * 0.8, Math.floor(i / 3) * 0.8);
    K.part(cyl, MAT.barrel, p.x, K.world.heightAt(p.x, p.z), p.z, 0.65, 1.0, 0.65, 0);
  }
}

// four stacks of three tyres
/** @param {Kit} K @param {Frame} t */
export function tyres(K, t) {
  for (let i = 0; i < 4; i++) {
    const p = K.at(t, (i % 2) * 1.4, Math.floor(i / 2) * 1.4);
    for (let j = 0; j < 3; j++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.2, 6, 12), MAT.tire);
      m.rotation.x = Math.PI / 2;
      m.position.set(p.x, K.world.heightAt(p.x, p.z) + 0.2 + j * 0.4, p.z);
      m.castShadow = true;
      K.group.add(m);
    }
  }
}

// a post with a board (title / subtitle), facing along the road (face -1: the other way)
/** @param {Kit} K */
export function sign(K, along, off, title, sub, face) {
  const f = K.frame(along, off);
  const y = K.world.heightAt(f.x, f.z);
  K.part(box, MAT.wood, f.x, y, f.z, 0.15, 2.4, 0.15, f.rot);
  const tex = signTexture(title, sub);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  board.userData.own = 'all';                    // geometry, material and texture of its own (world.js frees them)
  board.position.set(f.x, y + 2.6, f.z);
  board.rotation.y = f.rot + (face < 0 ? Math.PI : 0);
  K.group.add(board);
}
