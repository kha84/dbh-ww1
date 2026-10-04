// Tank parts catalog. A tank is a hull plus replaceable parts (engine, gun, external fuel tanks,
// turret drive, turret body); its performance is derived from the parts it currently carries.
//
// Module / crew boxes are given in normalised coordinates of the hull (or turret) box:
//   u: -1..1 across local X (+X is the tank's LEFT side), v: 0..1 bottom..top, w: -1..1 rear..front
// or as an absolute hull-local box: { box: [minX, minY, minZ, maxX, maxY, maxZ] }.
// ext: lies outside the armour (external fuel tanks) - hit without penetration.

import { TANK_DEFS } from './tankdefs/index.js';

export const PART_KINDS = ['engine', 'gun', 'fuel', 'drive', 'turret'];
// system id (tank.hp[...]) -> part kind carrying it
export const SYSTEM_PART = { engine: 'engine', gun: 'gun', fuel: 'fuel', turret: 'drive' };
export const PART_NAMES = {
  engine: 'Двигатель', gun: 'Орудие', fuel: 'Внешние баки', drive: 'Механизм поворота башни', turret: 'Башня',
};
// catalogs assembled from the tank definitions (tankdefs/<key>.js)
const pick = f => Object.fromEntries(TANK_DEFS.filter(d => d[f]).map(d => [d.key, d[f]]));
export const ORIGIN_NAMES = Object.fromEntries(TANK_DEFS.map(d => [d.key, d.name]));
export const HULLS = pick('hull');
export const TURRETS = pick('turret');
export const GUNS = pick('gun');
// fuelUse: litres per second at full throttle (idling burns 12% of it)
export const ENGINES = pick('engine');
// external fuel tanks (all the fuel is here, litres)
export const FUELS = pick('fuel');
// turret drives (fit any hull, only their own turret)
export const DRIVES = pick('drive');
// machine gun that comes mounted on each tank type (weapons.js key)
export const TANK_MG = Object.fromEntries(TANK_DEFS.map(d => [d.key, d.mg || null]));

// sandbags heaped on the hull: armour added per bag on the face it covers, weight per bag
export const SANDBAG = { max: 6, front: 20, side: 12, weight: 0.2 };

export const CATALOG = { engine: ENGINES, gun: GUNS, fuel: FUELS, drive: DRIVES, turret: TURRETS };

// default composition of each tank type
export function defaultParts(key) {
  const has = (cat, kind) => cat[key] ? makePart(kind, key) : null;
  // personnel carriers have no main gun (only the machine gun on the pintle / in the small turret)
  return { engine: has(ENGINES, 'engine'), gun: has(GUNS, 'gun'), fuel: has(FUELS, 'fuel'), drive: has(DRIVES, 'drive'),
           turret: has(TURRETS, 'turret') };
}
// armoured personnel carriers (carry infantry, armed with a machine gun); cars and motorcycles are carriers too
// (troop seats, no main gun) but soft-skinned: `car: 'car' | 'moto'`
export const isApc = key => !!(HULLS[key] && HULLS[key].apc && !HULLS[key].car);
export const isCar = key => !!(HULLS[key] && HULLS[key].car === 'car');
export const isMoto = key => !!(HULLS[key] && HULLS[key].car === 'moto');

let PART_ID = 0;
export function makePart(kind, key, hp = 100) {
  const p = { id: ++PART_ID, kind, key, hp, vis: null };
  if (kind === 'fuel') p.fuel = FUELS[key].cap;        // the fuel travels with the tanks
  return p;
}

export function partLabel(part) {
  const c = CATALOG[part.kind][part.key];
  return `${PART_NAMES[part.kind]} ${ORIGIN_NAMES[part.key]}` + (part.kind === 'turret' ? '' : ` (${c.name})`);
}

// ------------------------------------------------------------------ spec
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Everything the rest of the game reads as tank.def is computed here from the hull and its parts.
// bags: sandbags on the hull { front, side }
export function computeSpec(hullKey, parts, bags = null) {
  const H = HULLS[hullKey];
  const T = parts.turret ? TURRETS[parts.turret.key] : null;
  const Gn = parts.gun ? GUNS[parts.gun.key] : null;
  const E = parts.engine ? ENGINES[parts.engine.key] : null;
  const F = parts.fuel ? FUELS[parts.fuel.key] : null;
  const D = parts.drive ? DRIVES[parts.drive.key] : null;
  const nBags = bags ? bags.front + bags.side : 0;
  const weight = H.weight + (T?.weight || 0) + (Gn?.weight || 0) + (E?.weight || 0) + (F?.weight || 0) + (D?.weight || 0) +
                 nBags * SANDBAG.weight;
  const power = E ? E.power : 0;
  const pw = power / weight;
  // the drive must match the turret it turns (the Mark V gun mount needs its own gear)
  const driveOk = !!D && (T ? parts.drive.key === parts.turret.key : H.turretless ? parts.drive.key === hullKey : false);
  const mount = T || (H.turretless ? H : null);
  let frank = false;
  for (const k of ['engine', 'gun', 'fuel', 'drive', 'turret']) if (parts[k] && parts[k].key !== hullKey) frank = true;

  const modules = H.modules.filter(m => m.id !== 'engine' || E).map(m => ({ ...m, space: 'hull' }));
  if (T) {
    for (const m of T.modules) {
      if (m.id === 'gun' && !Gn) continue;
      if (m.id === 'turret' && !D) continue;
      modules.push({ ...m, space: 'turret' });
    }
  } else if (D && !H.turretless) {
    modules.push({ id: 'turret', space: 'hull', ringDrive: true });
  }
  if (H.turretless && Gn) modules.push({ id: 'gun', space: 'hull', gunMount: true });
  if (H.turretless && D) modules.push({ id: 'turret', space: 'hull', gunMount: true, small: true });
  if (F) modules.push({ id: 'fuel', space: 'hull', fuelMount: true, ext: true });
  const crew = H.crew.map(c => ({ ...c, space: 'hull' }));
  if (T) for (const c of T.crew) crew.push({ ...c, space: 'turret' });

  return {
    key: hullKey, apc: !!H.apc, wheeled: !!H.wheeled, car: H.car || null, soft: !!H.soft,
    name: H.name + (frank ? ' (сборный)' : ''),
    hullName: H.name,
    frank, weight, power, pw, driveOk,
    maxSpeed: power > 0 ? Math.min(H.speedCap, H.eff * 3.1 * Math.pow(pw, 0.55)) : 0,
    accel: power > 0 ? Math.min(H.accelCap || 9, H.eff * (0.9 + 0.23 * pw)) : 0,
    turn: H.turn * clamp(0.7 + 0.3 * pw / 16, 0.6, 1.3),
    radius: H.radius,
    turretSpeed: driveOk ? D.speed : 0,
    elevSpeed: Gn ? Gn.elevSpeed : 0.2,
    elevMin: mount ? mount.elevMin : -0.1, elevMax: mount ? mount.elevMax : 0.3,
    turretArc: H.turretless ? H.arc : 0,
    reload: Gn ? Gn.reload : 5, shellSpeed: Gn ? Gn.shellSpeed : 500, pen: Gn ? Gn.pen : 0,
    dmg: Gn ? Gn.dmg : 0, disp: Gn ? Gn.disp : 0.005, caliber: Gn ? Gn.caliber : '—',
    ammoMax: H.ammoMax,
    fuelMax: F ? F.cap : 0,
    fuelUse: E ? E.fuelUse : 0.05,
    armor: {
      hull: bags ? { ...H.armor, front: H.armor.front + bags.front * SANDBAG.front, side: H.armor.side + bags.side * SANDBAG.side } : H.armor,
      turret: T ? T.armor : H.armor,
    },
    modules, crew,
  };
}

// ------------------------------------------------------------------ tank ranking
// combat value of a stock tank: firepower + frontal protection + mobility
export function tankRating(key) {
  const d = computeSpec(key, defaultParts(key));
  const fire = d.pen * Math.sqrt(d.dmg) * Math.pow(6 / d.reload, 0.25);
  const prot = (d.armor.hull.front + d.armor.turret.front) / 2;
  return fire * 0.6 + prot * 0.8 + d.maxSpeed * 4;
}
const YEAR = Object.fromEntries(TANK_DEFS.map(d => [d.key, d.year || 0]));
// tank types in the order they appeared in the world (same year: the weaker one first). The road follows it:
// the oldest machines are met at the start, the newest far down the road.
export const TANK_TIERS = Object.keys(HULLS).filter(k => !HULLS[k].apc).sort((a, b) => YEAR[a] - YEAR[b] || tankRating(a) - tankRating(b));
// personnel carriers in the order they appeared
export const APC_TIERS = Object.keys(HULLS).filter(isApc).sort((a, b) => YEAR[a] - YEAR[b]);
// cars and motorcycles in the order they appeared
export const CAR_TIERS = Object.keys(HULLS).filter(isCar).sort((a, b) => YEAR[a] - YEAR[b]);
export const MOTO_TIERS = Object.keys(HULLS).filter(isMoto).sort((a, b) => YEAR[a] - YEAR[b]);
// the weakest tank of all: the player starts the road in it
export const STARTER_TANK = TANK_TIERS.reduce((a, b) => tankRating(b) < tankRating(a) ? b : a);
