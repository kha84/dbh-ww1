// Gas station: forecourt with a canopy and two pumps (its service zone refuels), a kiosk, barrels, a price pole;
// fuel cans, sandbags and sometimes a kit / torch / spray can lying about.
import { MAT, box } from './kit.js';
import { barrels } from './props.js';

/** @param {import('./kit.js').Kit} K */
export function gasStation(K) {
  const { world, plan, r } = K;
  const side = r() < 0.5 ? -1 : 1;
  const f = K.frame(0, side * 17);
  const y = world.roadH(plan.z);
  // forecourt slab
  K.part(box, MAT.concrete, f.x, y - 0.25, f.z, 14, 0.36, 22, f.rot, false);
  // canopy on 4 posts
  for (const [lx, lz] of [[-4.5, -7], [4.5, -7], [-4.5, 7], [4.5, 7]]) {
    const p = K.at(f, lx, lz);
    K.part(box, MAT.white, p.x, y, p.z, 0.35, 5, 0.35, f.rot);
    K.obstacle({ x: p.x, z: p.z, rot: f.rot }, 0.25, 0.25, y, y + 5);
  }
  K.part(box, MAT.red, f.x, y + 5, f.z, 11, 0.8, 18, f.rot);
  // pumps
  for (const lz of [-3.5, 3.5]) {
    const p = K.at(f, 0, lz);
    K.part(box, MAT.concrete, p.x, y, p.z, 1.2, 0.25, 2.2, f.rot);
    K.part(box, MAT.red, p.x, y + 0.25, p.z, 0.8, 1.7, 1.2, f.rot);
    K.part(box, MAT.yellow, p.x, y + 1.95, p.z, 0.85, 0.3, 1.25, f.rot);
    K.obstacle({ x: p.x, z: p.z, rot: f.rot }, 0.6, 1.1, y, y + 2.2);
  }
  // kiosk
  const k = K.frame(0, side * 31);
  const ky = K.groundMin(k.x, k.z, 4) - 0.3;
  K.part(box, MAT.walls[3], k.x, ky, k.z, 6, 3.4, 9, k.rot);
  const kw = K.at(k, -side * 3.02, 0);
  K.part(box, MAT.window, kw.x, ky + 1, kw.z, 0.08, 1.4, 6, k.rot, false);
  K.part(box, MAT.red, k.x, ky + 3.4, k.z, 6.4, 0.5, 9.4, k.rot);
  K.obstacle(k, 3, 4.5, ky, ky + 4);
  const b = K.at(k, 0, 7);
  barrels(K, { x: b.x, z: b.z, rot: k.rot }, 5);
  // tall price pole
  const pole = K.frame(-14, side * 9);
  const py = world.heightAt(pole.x, pole.z);
  K.part(box, MAT.metal, pole.x, py, pole.z, 0.3, 7, 0.3, pole.rot);
  K.part(box, MAT.red, pole.x, py + 6, pole.z, 0.3, 2.2, 2.6, pole.rot);
  K.zones.push({ type: 'fuel', x: f.x, z: f.z, r: 11, label: 'Заправка' });
  const nCans = 2 + Math.floor(r() * 3);
  for (let i = 0; i < nCans; i++) { const p = K.at(k, -side * 4, -3 + i * 1.1); K.addItem('canister', p.x, p.z, { fuel: 20 }); }
  { const p = K.at(k, 2, 7.5); K.addItem('sandbag', p.x, p.z); }
  if (r() < 0.5) { const p = K.at(k, -side * 4, 3); K.addLoot(p.x, p.z); }
  if (r() < 0.4) { const p = K.at(k, 0, -7); K.addItem('repair_kit', p.x, p.z); }
  if (plan.hasTorch) { const p = K.at(k, 1.5, -7); K.addItem('torch', p.x, p.z); }
  if (r() < 0.35) { const p = K.at(k, -side * 4, 5); K.addSpray(p.x, p.z); }
}
