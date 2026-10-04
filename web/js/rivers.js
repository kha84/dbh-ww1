// Rivers crossing the road (the bridges over them: structures/bridge.js): brooks, rivers and broad rivers.
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

const BROOK_NAMES = ['Студёный', 'Гремячий', 'Ольховый', 'Песчаный', 'Холодный', 'Безымянный', 'Кривой', 'Рыбный',
  'Мельничный', 'Ключевой'];

// plan of the river in the gap after settlement k (or null). world: settlementPlan, roadX, roadH, biomeAt, WATER_LEVEL
// Three sizes: a brook (2-4 m half width, mostly a ford or a small timber bridge), a river (5-14 m) and a broad river
// (15-35 m, always bridged, deep). The biome sets how often rivers come and how wide they are (swamps and steppe:
// broad and flat-banked, hills and forest: narrower with steep banks); the width also changes along the course.
export function planRiver(world, k, SETTLE_LEN, SETTLE_OFS) {
  if (k < 0) return null;
  const r = rng(Math.floor(hash(world.seed, k, 4711) * 4294967296));
  const a = world.settlementPlan(k), b = world.settlementPlan(k + 1);
  const lo = a ? a.z + a.halfLen + 70 : k * SETTLE_LEN + SETTLE_OFS + 60;
  const hi = b ? b.z - b.halfLen - 70 : (k + 1) * SETTLE_LEN + SETTLE_OFS + 140;
  const zm = (lo + hi) / 2;
  const B = world.biomeAt(world.roadX(zm), zm);
  if (r() > B.rivers) return null;
  const cls = r();
  const size = cls < 0.3 ? 'brook' : cls < 0.8 ? 'river' : 'broad';
  let w, bank, depth;
  if (size === 'brook') { w = 1.8 + r() * 2.2; bank = 3.5 + r() * 3; depth = 0.75 + r() * 0.6; }
  else if (size === 'river') { w = 5 + r() * 9; bank = 8 + r() * 6; depth = r() < 0.3 ? 1.05 : 2.2 + r() * 1.6; }
  else { w = 15 + r() * 20; bank = 10 + r() * 10; depth = 3 + r() * 2; }
  w = Math.min(40, w * B.riverW);
  bank *= (1 + 0.8 * B.wet) * (1 - 0.35 * B.hills);           // flat swampy banks, steep ones in the hills
  if (hi - lo < 2 * (w + bank) + 30) return null;
  const z = lo + (w + bank + 15) + (hi - lo - 2 * (w + bank + 15)) * r();
  const shallow = depth < 1.4;
  const big = size === 'broad';
  const plan = {
    k, z, w, bank, depth, size,
    A: big ? 8 + r() * 18 : 18 + r() * 35, f: 1 / (110 + r() * 90), A2: big ? 2 + r() * 4 : 4 + r() * 8, f2: 1 / (30 + r() * 25),
    wv: size === 'brook' ? 0.3 : 0.12 + r() * 0.3, fw: 1 / (45 + r() * 90),       // width along the course
    x0: world.roadX(z),
    name: (size === 'brook' ? BROOK_NAMES : RIVER_NAMES)[Math.floor(hash(world.seed, k, 77) * (size === 'brook' ? BROOK_NAMES : RIVER_NAMES).length)],
    type: size === 'brook' ? 'wood' : big ? (r() < 0.2 ? 'wood' : r() < 0.5 ? 'steel' : 'stone') : BRIDGE_TYPES[Math.floor(r() * BRIDGE_TYPES.length)],
  };
  plan.title = (size === 'brook' ? 'руч. ' : 'р. ') + plan.name;
  plan.bridge = !shallow || r() < (size === 'brook' ? 0.35 : 0.5);
  plan.ford = !plan.bridge;
  // along the road: where the channel starts / ends (the crossing is at plan.z by construction)
  const s = 1 - zcSlope(plan, plan.x0) * world.roadSlope(z);
  plan.halfSpan = (w + bank * 0.75 + 2) / Math.max(0.5, Math.abs(s));
  const reach = plan.A + plan.A2 + w * (1 + plan.wv) + bank + 5;
  plan.zmin = z - reach;
  plan.zmax = z + reach;
  return plan;
}

// half width of the water at x (plan.w where the road crosses)
export function widthAt(p, x) { return p.w * (1 + p.wv * Math.sin((x - p.x0) * p.fw)); }

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
  const w = widthAt(p, x);
  if (d > w + p.bank) return h;
  const bed = WATER - p.depth;
  let c;
  if (d < w) c = bed + (d / w) ** 2 * (p.depth - 0.35);                 // bottom, shallow at the edges
  else c = (WATER - 0.35) + (h - (WATER - 0.35)) * smoothstep(w, w + p.bank, d);
  return Math.min(h, c);
}
