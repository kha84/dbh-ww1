// Roadside settlements: villages, towns, gas stations, tank repair stations - their layout along the road and the loot
// lying about. The structures themselves are in structures/ (house, church, depot, well, gas station, repair
// station, props); kit.js is the builder context they share.
import { bakeStatic } from './bakestatic.js';
import { settlementKit } from './structures/kit.js';
import { buildHouse } from './structures/house.js';
import { church } from './structures/church.js';
import { ammoDepot } from './structures/depot.js';
import { well } from './structures/well.js';
import { gasStation } from './structures/gasstation.js';
import { repairStation } from './structures/repairstation.js';
import { fence, sign } from './structures/props.js';

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

export function buildSettlement(world, plan) {
  const K = settlementKit(world, plan);
  const { r, houses } = K;

  const typeLabel = SETTLEMENT_LABEL[plan.type];
  sign(K, -plan.halfLen - 8, 7, plan.name, typeLabel, -1);
  sign(K, plan.halfLen + 8, -7, plan.name, typeLabel, 1);

  if (plan.type === 'village' || plan.type === 'town') {
    const town = plan.type === 'town';
    const rows = town ? [[17, 26], [42, 52]] : [[15, 24]];
    for (const side of [-1, 1]) {
      for (const [o0, o1] of rows) {
        for (let a = -plan.halfLen + 10; a < plan.halfLen - 10; a += town ? 20 + r() * 8 : 22 + r() * 12) {
          if (r() < (town ? 0.2 : 0.3)) continue;
          if (town && Math.abs(a) < 22) continue;          // central square
          const w = town ? 9 + r() * 6 : 6.5 + r() * 3.5;
          const d = town ? 8 + r() * 4 : 6 + r() * 2;
          const off = side * (o0 + r() * (o1 - o0) + d / 2);
          const q = r();
          const story = town ? (q < 0.4 ? 1 : q < 0.8 ? 2 : 3) : 1;
          buildHouse(K, { along: a, off, w, d, story, flat: town && story > 1 && r() < 0.6, town });
          if (!town && r() < 0.5) fence(K, a, off - side * (d / 2 + 4), w + 4);
        }
      }
    }
    // things in the yards (behind the houses, away from the road) and inside the houses
    const hf = houses.map(h => h.f);
    const yard = (h, dist, lz) => K.at(h, (h.x > world.roadX(h.z) ? -1 : 1) * dist, lz);
    const pickHouse = () => hf[Math.floor(r() * hf.length)];
    const inside = () => {                              // a free spot on a floor of some house (or null)
      const h = houses[Math.floor(r() * houses.length)];
      if (!h || !h.spots.length) return null;
      return h.spotWorld(h.spots.splice(Math.floor(r() * h.spots.length), 1)[0]);
    };
    const nKits = town ? 2 + (r() < 0.5 ? 1 : 0) : 1 + (r() < 0.35 ? 1 : 0);
    for (let i = 0; i < nKits && hf.length; i++) {
      const p = r() < 0.5 && inside() || yard(pickHouse(), 7, (r() - 0.5) * 4);
      K.addItem('repair_kit', p.x, p.z, p.y !== undefined ? { y: p.y } : {});
    }
    if (plan.hasCutter && hf.length) { const p = yard(hf[0], 7, 2); K.addItem('cutter', p.x, p.z); }
    if (plan.hasTorch && hf.length) { const p = yard(hf[hf.length - 1], 7, -2); K.addItem('torch', p.x, p.z); }
    // weapons, cartridges, sandbags, fuel cans, spray cans in the yards and the houses
    const nSpray = (r() < 0.45 ? 1 : 0) + (town && r() < 0.5 ? 1 : 0);
    for (let i = 0; i < nSpray && hf.length; i++) { const p = yard(pickHouse(), 6.5, (r() - 0.5) * 5); K.addSpray(p.x, p.z); }
    const nLoot = town ? 4 + Math.floor(r() * 3) : 2 + Math.floor(r() * 2);
    for (let i = 0; i < nLoot && hf.length; i++) { const p = yard(pickHouse(), 6 + r() * 2, (r() - 0.5) * 6); K.addLoot(p.x, p.z); }
    const nIn = town ? 4 + Math.floor(r() * 4) : 2 + Math.floor(r() * 2);
    for (let i = 0; i < nIn && hf.length; i++) { const p = inside(); if (p) K.addLoot(p.x, p.z, { y: p.y }); }
    const nBags = town ? 3 : 2;
    for (let i = 0; i < nBags && hf.length; i++) { const p = yard(pickHouse(), 6.5, 3 + i * 0.9); K.addItem('sandbag', p.x, p.z); }
    if (hf.length && (town || r() < 0.4)) { const p = yard(pickHouse(), 6, -3.5); K.addItem('canister', p.x, p.z, { fuel: 20 }); }
    if (town) {
      church(K, 0, 30);
      ammoDepot(K, 0, -24);
    } else well(K, 0, 11);
  }

  let crane = null;
  if (plan.type === 'gas') gasStation(K);
  if (plan.type === 'repair') crane = repairStation(K);

  // houses destroyed earlier stay ruined
  for (const h of houses) if (world.ruins.has(h.id)) h.ruin(true);

  // bake the static pieces (bakestatic.js): each standing house into its own mesh (it can be shot to pieces),
  // everything else of the settlement together (signs keep their textured boards)
  const group = K.group;
  const inHouses = new Set();
  for (const h of houses) {
    if (h.ruined) continue;
    for (const m of [...h.meshes, ...h.inner]) inHouses.add(m);
    h.meshes = bakeStatic(h.meshes, group);
    h.inner = bakeStatic(h.inner, group);
    for (const m of h.inner) m.visible = false;      // world.update shows it near the house
  }
  bakeStatic(group.children.filter(o => !inHouses.has(o)), group);

  world.scene.add(group);
  return { plan, group, obstacles: K.obstacles, zones: K.zones, items: K.items, crane, houses };
}
