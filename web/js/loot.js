// What is met where: difficulty grows along the road; tank types, weapons and loot are picked by it
import { TANK_TIERS, APC_TIERS } from './parts.js';
import { WEAPONS, GRENADES, CALIBERS, SMALL_CATS } from './weapons.js';

export const HARD_Z = 9000;           // metres of road until the most advanced machines are common

// 0 at the start of the road .. 1 far away
export function difficultyAt(z) { return Math.max(0, Math.min(1, z / HARD_Z)); }

// tank type for difficulty d: centred on the tier matching d, spread over the neighbours
export function pickTankKey(r, d) {
  const n = TANK_TIERS.length;
  const c = d * (n - 1);
  const i = Math.round(c + (r() - 0.5) * 3);
  return TANK_TIERS[Math.max(0, Math.min(n - 1, i))];
}

// personnel carrier for difficulty d (the one of the matching era, sometimes the one before / after)
export function pickApcKey(r, d) {
  const n = APC_TIERS.length;
  const i = Math.round(d * (n - 1) + (r() - 0.5) * 1.6);
  return APC_TIERS[Math.max(0, Math.min(n - 1, i))];
}

// era weights by difficulty: WW1 guns early, post-war ones far down the road
function eraWeights(d) {
  return { 1: Math.max(0.05, 0.7 - d * 1.4), 2: 0.6 - Math.abs(d - 0.4) * 0.6, 3: Math.max(0.02, d * 1.3 - 0.2) };
}
function pickByEra(r, keys, eraOf, d) {
  const w = eraWeights(d);
  let sum = 0;
  for (const k of keys) sum += w[eraOf(k)];
  let x = r() * sum;
  for (const k of keys) { if ((x -= w[eraOf(k)]) <= 0) return k; }
  return keys[keys.length - 1];
}

const KEYS = Object.keys(WEAPONS);
// cats: array of allowed categories
export function pickWeaponKey(r, d, cats) {
  const keys = KEYS.filter(k => cats.includes(WEAPONS[k].cat) && !WEAPONS[k].mount);
  return pickByEra(r, keys, k => WEAPONS[k].era, d);
}
export function pickGrenadeKey(r, d, at = false) {
  const keys = Object.keys(GRENADES).filter(k => !!GRENADES[k].pen === at && !GRENADES[k].craft);
  return pickByEra(r, keys, k => GRENADES[k].era, d);
}

// a soldier's kit: primary weapon (rifle / automatic / MG, officers carry pistols / SMGs)
export function soldierKit(r, d, crew = false) {
  let key;
  if (crew) key = pickWeaponKey(r, d, r() < 0.6 ? ['pistol', 'revolver'] : ['smg', 'auto']);
  else {
    const x = r();
    key = pickWeaponKey(r, d, x < 0.5 ? ['rifle'] : x < 0.82 ? ['auto'] : x < 0.92 ? ['mg'] : ['pistol', 'smg', 'revolver']);
  }
  const grenades = {};
  if (r() < 0.4 + d * 0.2) grenades[pickGrenadeKey(r, d)] = 1 + (r() < 0.45 ? 1 : 0) + (r() < 0.1 ? 1 : 0);
  if (!crew && r() < 0.1 + d * 0.15) grenades[pickGrenadeKey(r, d, true)] = 1;
  return { key, grenades };
}

// random loot heap: [{ type, ...data }] for settlements / wrecks
export function lootRoll(r, d, n) {
  const res = [];
  for (let i = 0; i < n; i++) {
    const x = r();
    if (x < 0.3) {
      const key = pickWeaponKey(r, d, r() < 0.45 ? SMALL_CATS : ['rifle', 'auto', 'mg']);
      res.push({ type: 'weapon', key, mag: Math.floor(WEAPONS[key].mag * (0.3 + r() * 0.7)) });
    } else if (x < 0.7) {
      // ammo for something that is around at this difficulty
      const key = pickWeaponKey(r, d, r() < 0.4 ? SMALL_CATS : ['rifle', 'auto', 'mg']);
      const cal = WEAPONS[key].cal;
      res.push({ type: 'ammo', cal, n: Math.round(CALIBERS[cal] * (0.5 + r() * 0.8)) });
    } else if (x < 0.85) {
      res.push({ type: 'grenade', key: pickGrenadeKey(r, d, r() < 0.2), n: 1 + (r() < 0.4 ? 1 : 0) });
    } else res.push({ type: 'repair_kit' });
  }
  return res;
}
