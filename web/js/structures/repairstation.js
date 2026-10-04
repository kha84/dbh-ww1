// Tank repair station: concrete pad with the tank bay under an overhead crane (posts, runway beams - the bridge and the
// trolley are animated by workshop.js), two numbered turret stands, the crane control panel, a hangar, a workshop
// hut, tyres / barrels / crates; kits, tools, plates, used spare parts, sandbags, spray cans lying about.
// Returns the crane record for the workshop.
import * as THREE from 'three';
import { MAT, box, roofGeo, halfCyl, signTexture, numberTexture } from './kit.js';
import { barrels, crates, tyres } from './props.js';
import { pickTankKey } from '../loot.js';

/** @param {import('./kit.js').Kit} K */
export function repairStation(K) {
  const { world, plan, r, d } = K;
  let crane = null;
  const side = r() < 0.5 ? -1 : 1;
  const y = world.roadH(plan.z);
  // concrete pad between road and hangar
  const pad = K.frame(0, side * 16);
  K.part(box, MAT.concrete, pad.x, y - 0.25, pad.z, 14, 0.36, 28, pad.rot, false);
  const paint = (mat, lx, lz, sx, sz) => {
    const p = K.at(pad, lx, lz);
    K.part(box, mat, p.x, y + 0.11, p.z, sx, 0.02, sz, pad.rot, false);
  };
  // tank bay under the crane
  paint(MAT.yellow, -2.7, 0, 0.25, 8.8); paint(MAT.yellow, 2.7, 0, 0.25, 8.8);
  paint(MAT.yellow, 0, -4.4, 5.65, 0.25); paint(MAT.yellow, 0, 4.4, 5.65, 0.25);
  // two numbered turret stands
  const slots = [];
  [-9.5, 9.5].forEach((lz, i) => {
    const p = K.at(pad, 0, lz);
    K.part(box, MAT.darkConcrete, p.x, y + 0.1, p.z, 2.2, 0.25, 2.2, pad.rot);
    for (const [lx, lz2, sx, sz] of [[-2.1, 0, 0.2, 4.4], [2.1, 0, 0.2, 4.4], [0, -2.1, 4.4, 0.2], [0, 2.1, 4.4, 0.2]])
      paint(MAT.white, lx, lz + lz2, sx, sz);
    const n = K.at(pad, -side * 3.6, lz);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshStandardMaterial({ map: numberTexture(String(i + 1)), transparent: true, roughness: 0.9 }));
    plate.rotation.set(-Math.PI / 2, 0, pad.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
    plate.position.set(n.x, y + 0.125, n.z);
    plate.receiveShadow = true;
    K.group.add(plate);
    slots.push({ x: p.x, z: p.z, y: y + 0.35 });
  });
  // overhead crane: posts, runway beams along the pad (bridge and trolley are animated by the workshop)
  const beamY = y + 7.2;
  for (const lz of [-12.8, 12.8]) {
    for (const lx of [-6.5, 6.5]) {
      const p = K.at(pad, lx, lz);
      K.part(box, MAT.yellow, p.x, y, p.z, 0.45, 7.2, 0.45, pad.rot);
      K.obstacle({ x: p.x, z: p.z, rot: pad.rot }, 0.3, 0.3, y, y + 7.2);
    }
    const p = K.at(pad, 0, lz);
    K.part(box, MAT.yellow, p.x, beamY, p.z, 13.4, 0.5, 0.5, pad.rot);
  }
  for (const lx of [-6.5, 6.5]) {
    const p = K.at(pad, lx, 0);
    K.part(box, MAT.yellow, p.x, beamY, p.z, 0.5, 0.5, 26.1, pad.rot);
  }
  // crane control panel
  const pp = K.at(pad, side * 8.3, -3.5);
  K.part(box, MAT.metal, pp.x, y, pp.z, 0.6, 1.05, 0.9, pad.rot);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5),
    new THREE.MeshStandardMaterial({ map: signTexture('КРАН', 'пульт управления'), roughness: 0.6 }));
  const sp = K.at(pad, side * 8.0, -3.5);
  scr.position.set(sp.x, y + 1.25, sp.z);
  scr.rotation.set(0, pad.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2), 0);
  scr.rotateX(-0.5);
  K.group.add(scr);
  K.part(box, MAT.metal, sp.x, y + 1.0, sp.z, 0.25, 0.32, 0.9, pad.rot);
  K.part(box, MAT.red, pp.x, y + 1.08, pp.z, 0.12, 0.08, 0.12, pad.rot);
  K.obstacle({ x: pp.x, z: pp.z, rot: pad.rot }, 0.35, 0.5, y, y + 1.4);
  crane = { k: plan.k, x: pad.x, z: pad.z, rot: pad.rot, y, side, beamY, slots,
            spot: K.at(pad, 0, 0), panel: { x: pp.x, z: pp.z } };
  // hangar
  const hf = K.frame(0, side * 36);
  const hy = K.groundMin(hf.x, hf.z, 10) - 0.3;
  K.part(halfCyl, MAT.hangar, hf.x, hy, hf.z, 9, 8, 24, hf.rot);
  K.obstacle(hf, 9, 12, hy, hy + 8);
  // workshop hut
  const w = K.frame(22, side * 26);
  const wy = K.groundMin(w.x, w.z, 4) - 0.3;
  K.part(box, MAT.walls[4], w.x, wy, w.z, 7, 3.2, 8, w.rot);
  K.part(roofGeo, MAT.roofs[0], w.x, wy + 3.2, w.z, 7.6, 2, 8.6, w.rot);
  K.obstacle(w, 3.5, 4, wy, wy + 5);
  // tyre stacks & barrels
  const t = K.frame(-20, side * 24);
  tyres(K, t);
  barrels(K, K.frame(-22, side * 30), 6);
  crates(K, K.frame(20, side * 14), 4);
  K.zones.push({ type: 'repair', x: pad.x, z: pad.z, r: 12, label: 'Ремонтная площадка' });
  const nk = 1 + (r() < 0.5 ? 1 : 0);
  for (let i = 0; i < nk; i++) { const p = K.at(w, -side * 5.5, -2 + i * 2); K.addItem('repair_kit', p.x, p.z); }
  if (plan.hasCutter) { const p = K.at(w, -side * 5.5, 2.5); K.addItem('cutter', p.x, p.z); }
  if (plan.hasTorch) { const p = K.at(w, -side * 5.5, 4); K.addItem('torch', p.x, p.z); }
  if (r() < 0.35 || plan.k === 1) { const p = K.at(pad, -side * 1, 16); K.addItem('plate', p.x, p.z); }
  // used spare parts lying by the hangar (of the machines met around here)
  const nParts = plan.k === 1 ? 2 : (r() < 0.6 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
  for (let i = 0; i < nParts; i++) {
    const kind = ['engine', 'gun', 'fuel', 'drive'][Math.floor(r() * 4)];
    let key = pickTankKey(r, d);
    if (kind === 'drive' && key === 'markV') key = pickTankKey(r, Math.min(1, d + 0.15));
    if (kind === 'drive' && key === 'markV') key = 't26';
    const p = K.frame(-8 - i * 4.5, side * 25.5);
    K.addItem('part', p.x, p.z, { kind, key, hp: Math.round(55 + r() * 45) });
  }
  for (let i = 0; i < 2; i++) { const p = K.at(w, -side * 5.5, -4 - i); K.addItem('sandbag', p.x, p.z); }
  const nSpray = 1 + (r() < 0.5 ? 1 : 0);
  for (let i = 0; i < nSpray; i++) { const p = K.at(w, -side * 6.5, 4 + i * 0.8); K.addSpray(p.x, p.z); }
  { const p = K.at(w, -side * 6.5, 0); K.addItem('canister', p.x, p.z, { fuel: 20 }); }
  { const p = K.at(w, -side * 6.5, 2); K.addLoot(p.x, p.z); }
  return crane;
}
