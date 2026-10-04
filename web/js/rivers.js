// Rivers crossing the road (the bridges over them: structures/bridge.js).
//
// A river may run between two neighbouring settlement stretches (planRiver(world, k): the gap after settlement k).
// Its centreline is z = zc(x), meandering across the valley and crossing the road at plan.z. The channel is
// carved into the terrain (world.height -> carve), the chunk water meshes fill it by themselves. Deep rivers get a
// bridge (timber trestle, steel girder or stone piers) whose deck is walkable ground (world.heightAt) with
// railings as obstacles; shallow ones may be a ford the tanks drive through.
import { rng, hash, smoothstep } from './noise.js';

export const RIVER_NAMES = ['Ольшанка', 'Быстрица', 'Сейм', 'Уша', 'Ворскла', 'Снов', 'Десна', 'Ирпень', 'Рось', 'Тетерев',
  'Лань', 'Щара', 'Молочная', 'Серебрянка', 'Каменка', 'Гнилуша'];
const BRIDGE_TYPES = ['wood', 'steel', 'stone'];

// plan of the river in the gap after settlement k (or null). world: settlementPlan, roadX, roadH, WATER_LEVEL
export function planRiver(world, k, SETTLE_LEN, SETTLE_OFS) {
  if (k < 0) return null;
  const r = rng(Math.floor(hash(world.seed, k, 4711) * 4294967296));
  if (r() > 0.5) return null;
  const a = world.settlementPlan(k), b = world.settlementPlan(k + 1);
  const lo = a ? a.z + a.halfLen + 70 : k * SETTLE_LEN + SETTLE_OFS + 60;
  const hi = b ? b.z - b.halfLen - 70 : (k + 1) * SETTLE_LEN + SETTLE_OFS + 140;
  const w = 5 + r() * 9;                              // half width of the water
  const bank = 8 + r() * 6;                           // banks sloping down to it
  if (hi - lo < 2 * (w + bank) + 30) return null;
  const z = lo + (w + bank + 15) + (hi - lo - 2 * (w + bank + 15)) * r();
  const shallow = r() < 0.3;
  const plan = {
    k, z, w, bank,
    depth: shallow ? 1.05 : 2.2 + r() * 1.6,
    A: 18 + r() * 35, f: 1 / (110 + r() * 90), A2: 4 + r() * 8, f2: 1 / (30 + r() * 25),
    x0: world.roadX(z),
    name: RIVER_NAMES[Math.floor(hash(world.seed, k, 77) * RIVER_NAMES.length)],
    type: BRIDGE_TYPES[Math.floor(r() * BRIDGE_TYPES.length)],
  };
  plan.bridge = !shallow || r() < 0.5;
  plan.ford = !plan.bridge;
  // along the road: where the channel starts / ends (the crossing is at plan.z by construction)
  const s = 1 - zcSlope(plan, plan.x0) * world.roadSlope(z);
  plan.halfSpan = (w + bank * 0.75 + 2) / Math.max(0.5, Math.abs(s));
  plan.zmin = z - plan.A - plan.A2 - w - bank - 5;
  plan.zmax = z + plan.A + plan.A2 + w + bank + 5;
  return plan;
}

export function zc(p, x) {
  const u = x - p.x0;
  return p.z + p.A * Math.sin(u * p.f) + p.A2 * Math.sin(u * p.f2);
}
function zcSlope(p, x) {
  const u = x - p.x0;
  return p.A * p.f * Math.cos(u * p.f) + p.A2 * p.f2 * Math.cos(u * p.f2);
}

// terrain height h at (x, z) with the channel of river p cut into it
export function carve(p, x, z, h, WATER) {
  if (z < p.zmin || z > p.zmax) return h;
  const s = zcSlope(p, x);
  const d = Math.abs(z - zc(p, x)) / Math.sqrt(1 + s * s);          // distance across the stream
  if (d > p.w + p.bank) return h;
  const bed = WATER - p.depth;
  let c;
  if (d < p.w) c = bed + (d / p.w) ** 2 * (p.depth - 0.35);             // bottom, shallow at the edges
  else c = (WATER - 0.35) + (h - (WATER - 0.35)) * smoothstep(p.w, p.w + p.bank, d);
  return Math.min(h, c);
}
