// Ammo depot of a town: a tent and crate piles; its service zone fills the tank's ammo rack.
import { MAT, halfCyl } from './kit.js';
import { crates } from './props.js';

/** @typedef {import('./kit.js').Kit} Kit */

/** @param {Kit} K */
export function ammoDepot(K, along, off) {
  const dep = K.frame(along, off);
  const dy = K.world.heightAt(dep.x, dep.z);
  const tent = K.at(dep, -6, 0);
  K.part(halfCyl, MAT.green, tent.x, dy, tent.z, 3, 3, 8, dep.rot);
  K.obstacle({ x: tent.x, z: tent.z, rot: dep.rot }, 3, 4, dy, dy + 3);
  crates(K, { ...K.at(dep, 2, 5), rot: dep.rot }, 6);
  crates(K, { ...K.at(dep, 2, -5), rot: dep.rot }, 5);
  K.zones.push({ type: 'ammo', x: dep.x, z: dep.z, r: 14, label: 'Склад боеприпасов' });
}
