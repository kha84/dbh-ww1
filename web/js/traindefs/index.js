// Registry of the rolling stock: ten locomotives (steam engines with their tenders, diesels) and ten kinds of cars
// (passenger coaches of four eras, freight cars), ONE FILE PER TYPE (traindefs/<key>.js: numbers + model); the baked
// models (traindefs/kit.js bakeModel) are cached per type / livery; trains are made up by the difficulty (era).
import { bakeModel } from './kit.js';
import ov from './ov.js';
import eu from './eu.js';
import g8 from './g8.js';
import su from './su.js';
import fd from './fd.js';
import br52 from './br52.js';
import p36 from './p36.js';
import te3 from './te3.js';
import m62 from './m62.js';
import tep70 from './tep70.js';
import coach2 from './coach2.js';
import coach4wood from './coach4wood.js';
import coachsteel from './coachsteel.js';
import coachmodern from './coachmodern.js';
import teplushka from './teplushka.js';
import gondola2 from './gondola2.js';
import flat from './flat.js';
import cistern from './cistern.js';
import box4 from './box4.js';
import gondola4 from './gondola4.js';

/** @type {Record<string, any>} */
export const LOCOS = Object.fromEntries([ov, eu, g8, su, fd, br52, p36, te3, m62, tep70].map(d => [d.key, d]));
/** @type {Record<string, any>} */
export const CARS = Object.fromEntries([coach2, coach4wood, coachsteel, coachmodern, teplushka, gondola2, flat, cistern, box4, gondola4].map(d => [d.key, d]));
// locomotives in the order they appeared (the road meets them in this order, like the tanks)
export const LOCO_TIERS = Object.values(LOCOS).sort((a, b) => a.year - b.year).map(d => d.key);

const models = new Map();
/**
 * baked geometries { body, spin } of a vehicle (cached): the locomotive, its tender, a car in livery `variant`
 * @returns {{ body: import('three').BufferGeometry, spin: import('three').BufferGeometry | null }}
 */
export function vehicleModel(def, part = 'main', variant = 0) {
  const k = `${def.key}:${part}:${variant}`;
  if (!models.has(k)) models.set(k, bakeModel(part === 'tender' ? def.tender.build() : def.build(variant)));
  return models.get(k);
}

// locomotive type for difficulty d (the one of the matching era, sometimes the one before / after)
export function pickLocoKey(r, d) {
  const n = LOCO_TIERS.length;
  const i = Math.round(d * (n - 1) + (r() - 0.5) * 2.2);
  return LOCO_TIERS[Math.max(0, Math.min(n - 1, i))];
}

/**
 * a train for difficulty d: [{ def, part: 'main' | 'tender', variant, flip }] from the front; o: { loco, passenger, n }
 * @returns {{ comp: { def: any, part: string, variant: number, flip?: boolean }[], passenger: boolean, military: boolean }}
 */
export function composeTrain(r, d, o = {}) {
  const L = LOCOS[o.loco] || LOCOS[pickLocoKey(r, d)];
  const year = L.year;
  const passenger = o.passenger ?? (L.role === 'passenger' ? r() < 0.75 : r() < 0.3);
  const comp = [{ def: L, part: 'main', variant: 0 }];
  if (L.tender) comp.push({ def: L, part: 'tender', variant: 0 });
  if (L.twin) comp.push({ def: L, part: 'main', variant: 0, flip: true });
  const fits = c => c.years[0] <= year + 6 && c.years[1] >= year - 4;
  const pool = Object.values(CARS).filter(c => fits(c) && (c.cls === 'passenger') === passenger);
  const military = !passenger && r() < 0.55;
  let n = o.n ?? (passenger ? 3 + Math.floor(r() * 5) : 4 + Math.floor(r() * 8));
  let len = comp.reduce((a, v) => a + (v.part === 'tender' ? v.def.tender.len : v.def.len), 0);
  // a passenger train is mostly coaches of one type (the newest of its time), a military one troop cars and flats
  const main = passenger ? pool.reduce((a, c) => (!a || c.years[0] > a.years[0] ? c : a), null) : null;
  const variant = passenger && main ? Math.floor(r() * main.variants.length) : 0;
  for (let i = 0; i < n && pool.length; i++) {
    let c;
    if (passenger) c = r() < 0.75 || pool.length < 2 ? main : pool[Math.floor(r() * pool.length)];
    else if (military) {
      const mil = pool.filter(p => p.troops || p.key === 'flat');
      c = mil.length && r() < 0.8 ? mil[Math.floor(r() * mil.length)] : pool[Math.floor(r() * pool.length)];
    } else c = pool[Math.floor(r() * pool.length)];
    if (len + c.len > 215) break;
    len += c.len;
    comp.push({ def: c, part: 'main', variant: c === main ? variant : military && c.key === 'flat' ? (r() < 0.7 ? 0 : 2) : Math.floor(r() * c.variants.length) });
  }
  return { comp, passenger, military };
}
