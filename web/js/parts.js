// Tank parts catalog. A tank is a hull plus replaceable parts (engine, gun, external fuel tanks,
// turret drive, turret body); its performance is derived from the parts it currently carries.
//
// Module / crew boxes are given in normalised coordinates of the hull (or turret) box:
//   u: -1..1 across local X (+X is the tank's LEFT side), v: 0..1 bottom..top, w: -1..1 rear..front
// or as an absolute hull-local box: { box: [minX, minY, minZ, maxX, maxY, maxZ] }.
// ext: lies outside the armour (external fuel tanks) - hit without penetration.

export const PART_KINDS = ['engine', 'gun', 'fuel', 'drive', 'turret'];
// system id (tank.hp[...]) -> part kind carrying it
export const SYSTEM_PART = { engine: 'engine', gun: 'gun', fuel: 'fuel', turret: 'drive' };
export const PART_NAMES = {
  engine: 'Двигатель', gun: 'Орудие', fuel: 'Внешние баки', drive: 'Механизм поворота башни', turret: 'Башня',
};
export const ORIGIN_NAMES = { t55: 'Т-55', abrams: 'Abrams', avre: 'Chieftain', markV: 'Mark V' };

// ------------------------------------------------------------------ hulls
export const HULLS = {
  t55: {
    name: 'Т-55', weight: 24, speedCap: 16, eff: 1.0, turn: 0.9, radius: 3.2, ammoMax: 43, fuelInt: 60,
    armor: { front: 200, side: 80, rear: 45, top: 30 },
    modules: [
      { id: 'ammo', u: [-0.95, -0.25], v: [0.15, 0.6], w: [0.35, 0.85] },   // front right "tank-rack"
      { id: 'engine', u: [-0.75, 0.75], v: [0.15, 0.75], w: [-0.72, -0.2] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.55], w: [-1.0, -0.72] },
    ],
    crew: [
      { u: [0.25, 0.95], v: [0.1, 0.65], w: [0.45, 0.95] },                  // driver (front left)
      { u: [-0.6, 0.6], v: [0.15, 1.0], w: [-0.15, 0.45] },                  // fighting compartment
    ],
    seats: { driver: { pos: [0.57, 0.62, 1.68], eye: [0.57, 1.3, 1.92] } },
    interior: {
      x: 1.0, floor: 0.5, roof: 1.52, z: [-0.45, 2.25],
      slits: [{ x: [0.3, 0.85], y: [1.25, 1.37] }],
      walk: [{ x: [-0.85, 0.85], z: [-0.3, 1.6] }, { x: [0.25, 0.9], z: [1.6, 1.95] }],
      ammo: { x: [-0.95, -0.35], z: [1.5, 2.2] },
    },
  },
  abrams: {
    name: 'Abrams', weight: 41, speedCap: 20, eff: 1.0, turn: 1.1, radius: 3.6, ammoMax: 40, fuelInt: 65,
    armor: { front: 320, side: 100, rear: 55, top: 35 },
    modules: [
      { id: 'engine', u: [-0.7, 0.7], v: [0.2, 0.85], w: [-0.9, -0.4] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.6], w: [-1.0, -0.88] },
      { id: 'ammo', u: [0.35, 0.6], v: [0.2, 0.7], w: [-0.2, 0.2] },
    ],
    crew: [
      { u: [-0.3, 0.3], v: [0.2, 0.8], w: [0.6, 0.95] },
      { u: [-0.6, 0.6], v: [0.2, 1.0], w: [-0.3, 0.3] },
    ],
    seats: { driver: { pos: [0, 0.64, 2.5], eye: [0, 1.3, 2.74] } },
    interior: {
      x: 1.05, floor: 0.55, roof: 1.55, z: [-0.95, 3.1],
      slits: [{ x: [-0.4, 0.4], y: [1.24, 1.37] }],
      walk: [{ x: [-0.9, 0.9], z: [-0.8, 1.35] }, { x: [-0.35, 0.35], z: [1.35, 2.6] }],
      ammo: { x: [0.55, 1.0], z: [-0.6, 0.5] },
    },
  },
  avre: {
    name: 'Chieftain AVRE', weight: 36, speedCap: 14, eff: 1.0, turn: 0.95, radius: 3.4, ammoMax: 20, fuelInt: 60,
    armor: { front: 220, side: 70, rear: 45, top: 30 },
    modules: [
      { id: 'ammo', u: [0.2, 0.9], v: [0.15, 0.7], w: [0.3, 0.8] },
      { id: 'engine', u: [-0.7, 0.7], v: [0.15, 0.85], w: [-0.85, -0.35] },
      { id: 'transmission', u: [-0.8, 0.8], v: [0.1, 0.6], w: [-1.0, -0.85] },
    ],
    crew: [
      { u: [-0.3, 0.3], v: [0.2, 0.8], w: [0.55, 0.95] },
      { u: [-0.6, 0.6], v: [0.2, 1.0], w: [-0.3, 0.3] },
    ],
    seats: { driver: { pos: [0, 0.62, 2.28], eye: [0, 1.26, 2.5] } },
    interior: {
      x: 1.0, floor: 0.55, roof: 1.62, z: [-0.9, 2.95],
      slits: [{ x: [-0.4, 0.4], y: [1.19, 1.32] }],
      walk: [{ x: [-0.85, 0.85], z: [-0.75, 1.45] }, { x: [-0.35, 0.35], z: [1.45, 2.3] }],
      ammo: { x: [0.4, 0.95], z: [1.6, 2.6] },
    },
  },
  markV: {
    name: 'Mark V', weight: 25.2, speedCap: 9, eff: 0.65, turn: 0.75, radius: 3.2, ammoMax: 60, fuelInt: 70,
    armor: { front: 16, side: 12, rear: 10, top: 8 },
    turretless: true, arc: 1.25, elevMin: -0.15, elevMax: 0.3,
    modules: [
      { id: 'engine', u: [-0.3, 0.3], v: [0.15, 0.6], w: [-0.4, 0.05] },
      { id: 'transmission', u: [-0.45, 0.45], v: [0.1, 0.45], w: [-0.8, -0.55] },
      { id: 'ammo', u: [0.35, 0.47], v: [0.15, 0.55], w: [-0.3, 0.4] },
      { id: 'ammo', u: [-0.47, -0.35], v: [0.15, 0.55], w: [-0.3, 0.4] },
    ],
    crew: [
      { u: [-0.4, 0.4], v: [0.4, 1.0], w: [0.35, 0.65] },
      { u: [-0.45, 0.45], v: [0.15, 0.8], w: [-0.7, 0.35] },
    ],
    seats: {
      driver: { pos: [0.4, 1.72, 2.05], eye: [0.38, 2.5, 2.3] },
      commander: { pos: [-0.4, 1.72, 2.05], eye: [-0.38, 2.5, 2.3] },
      gunner: { pos: [0, 1.72, 1.6], eye: [0, 2.45, 1.95] },
    },
    interior: {
      x: 0.9, floor: 0.45, roof: 2.2, z: [-3.0, 2.55],
      cab: { x: 0.78, z: [1.45, 2.55], top: 2.72, floor: 1.6 },
      slits: [{ x: [0.12, 0.62], y: [2.4, 2.56] }, { x: [-0.62, -0.12], y: [2.4, 2.56] }],
      sideSlits: [{ z: [0.1, 0.5], y: [1.45, 1.58] }, { z: [-1.9, -1.5], y: [1.45, 1.58] }],
      walk: [{ x: [-0.8, 0.8], z: [0.4, 1.35] }, { x: [0.62, 0.8], z: [-2.8, 0.4] },
             { x: [-0.8, -0.62], z: [-2.8, 0.4] }, { x: [-0.8, 0.8], z: [-2.8, -1.75] }],
      ammo: { x: [0.62, 0.88], z: [-1.4, 0.3] },
    },
  },
};

// ------------------------------------------------------------------ turrets
export const TURRETS = {
  t55: {
    name: 'Башня Т-55', weight: 8.5, elevMin: -0.09, elevMax: 0.30,
    armor: { front: 230, side: 150, rear: 65, top: 35 },
    modules: [
      { id: 'turret', u: [-0.6, 0.6], v: [0.0, 0.25], w: [-0.6, 0.5] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.25, 0.75], w: [-0.3, 0.9] },
      { id: 'ammo', u: [-0.9, -0.5], v: [0.1, 0.5], w: [-0.8, -0.2] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.8], w: [-0.7, 0.3] }],
    seats: {
      gunner: { pos: [0.45, -0.3, 0.3], eye: [0.45, 0.5, 0.52] },
      commander: { pos: [0.52, 0.05, -0.38], eye: [0.52, 0.87, -0.3] },
    },
  },
  abrams: {
    name: 'Башня Abrams', weight: 16, elevMin: -0.17, elevMax: 0.35,
    armor: { front: 380, side: 160, rear: 70, top: 40 },
    modules: [
      { id: 'ammo', u: [-0.8, 0.8], v: [0.25, 0.85], w: [-1.0, -0.6] },     // bustle
      { id: 'turret', u: [-0.5, 0.5], v: [0.0, 0.2], w: [-0.4, 0.4] },
      { id: 'gun', u: [-0.25, 0.25], v: [0.25, 0.8], w: [0.2, 1.0] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.9], w: [-0.3, 0.6] }],
    seats: {
      gunner: { pos: [-0.55, -0.3, 0.55], eye: [-0.55, 0.47, 0.78] },
      commander: { pos: [-0.72, 0.1, -0.3], eye: [-0.72, 0.96, -0.25] },
    },
  },
  avre: {
    name: 'Башня Chieftain', weight: 12, elevMin: -0.1, elevMax: 0.35,
    armor: { front: 260, side: 110, rear: 60, top: 35 },
    modules: [
      { id: 'turret', u: [-0.5, 0.5], v: [0.0, 0.2], w: [-0.4, 0.4] },
      { id: 'gun', u: [-0.3, 0.3], v: [0.2, 0.8], w: [-0.2, 1.0] },
      { id: 'ammo', u: [0.3, 0.8], v: [0.1, 0.5], w: [-0.8, -0.3] },
    ],
    crew: [{ u: [-0.85, 0.85], v: [0.0, 0.9], w: [-0.6, 0.4] }],
    seats: {
      gunner: { pos: [-0.5, -0.3, 0.45], eye: [-0.5, 0.47, 0.7] },
      commander: { pos: [-0.55, 0.1, -0.62], eye: [-0.55, 0.98, -0.55] },
    },
  },
};

// ------------------------------------------------------------------ guns
export const GUNS = {
  t55:    { name: 'Д-10Т', caliber: '100 мм', weight: 2.3, reload: 6.5, shellSpeed: 520, pen: 230, dmg: 1.0, disp: 0.0035, elevSpeed: 0.2 },
  abrams: { name: 'M256', caliber: '120 мм', weight: 3.2, reload: 5.5, shellSpeed: 600, pen: 400, dmg: 1.1, disp: 0.0025, elevSpeed: 0.35 },
  avre:   { name: 'L9A1', caliber: '165 мм', weight: 2.8, reload: 9, shellSpeed: 380, pen: 250, dmg: 1.6, disp: 0.005, elevSpeed: 0.18 },
  markV:  { name: 'QF 6-pdr', caliber: '57 мм', weight: 0.5, reload: 3.5, shellSpeed: 330, pen: 65, dmg: 0.8, disp: 0.006, elevSpeed: 0.3 },
};

// ------------------------------------------------------------------ engines
export const ENGINES = {
  t55:    { name: 'В-55', power: 580, weight: 1.0, fuelUse: 0.07 },
  abrams: { name: 'AGT-1500', power: 1500, weight: 1.1, fuelUse: 0.13 },
  avre:   { name: 'Leyland L60', power: 750, weight: 1.9, fuelUse: 0.1 },
  markV:  { name: 'Ricardo 150', power: 150, weight: 1.5, fuelUse: 0.05 },
};

// ------------------------------------------------------------------ external fuel tanks
export const FUELS = {
  t55:    { name: 'бочки 2×200 л', cap: 40, weight: 0.45 },
  abrams: { name: 'стеллаж канистр', cap: 30, weight: 0.35 },
  avre:   { name: 'баки 2×180 л', cap: 36, weight: 0.4 },
  markV:  { name: 'бак 420 л', cap: 45, weight: 0.6 },
};

// ------------------------------------------------------------------ turret drives (fit any hull, only their own turret)
export const DRIVES = {
  t55:    { name: 'поворотный механизм Т-55', speed: 0.55, weight: 0.3 },
  abrams: { name: 'привод башни Abrams', speed: 0.9, weight: 0.3 },
  avre:   { name: 'привод башни Chieftain', speed: 0.4, weight: 0.3 },
  markV:  { name: 'механизм наводки Mark V', speed: 0.7, weight: 0.2, fixed: true },
};

export const CATALOG = { engine: ENGINES, gun: GUNS, fuel: FUELS, drive: DRIVES, turret: TURRETS };

// default composition of each tank type
export function defaultParts(key) {
  const p = { engine: makePart('engine', key), gun: makePart('gun', key), fuel: makePart('fuel', key),
              drive: makePart('drive', key), turret: null };
  if (TURRETS[key]) p.turret = makePart('turret', key);
  return p;
}

let PART_ID = 0;
export function makePart(kind, key, hp = 100) {
  return { id: ++PART_ID, kind, key, hp, vis: null };
}

export function partLabel(part) {
  const c = CATALOG[part.kind][part.key];
  return `${PART_NAMES[part.kind]} ${ORIGIN_NAMES[part.key]}` + (part.kind === 'turret' ? '' : ` (${c.name})`);
}

// ------------------------------------------------------------------ spec
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Everything the rest of the game reads as tank.def is computed here from the hull and its parts.
export function computeSpec(hullKey, parts) {
  const H = HULLS[hullKey];
  const T = parts.turret ? TURRETS[parts.turret.key] : null;
  const Gn = parts.gun ? GUNS[parts.gun.key] : null;
  const E = parts.engine ? ENGINES[parts.engine.key] : null;
  const F = parts.fuel ? FUELS[parts.fuel.key] : null;
  const D = parts.drive ? DRIVES[parts.drive.key] : null;
  const weight = H.weight + (T?.weight || 0) + (Gn?.weight || 0) + (E?.weight || 0) + (F?.weight || 0) + (D?.weight || 0);
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
    key: hullKey,
    name: H.name + (frank ? ' (сборный)' : ''),
    hullName: H.name,
    frank, weight, power, pw, driveOk,
    maxSpeed: power > 0 ? Math.min(H.speedCap, H.eff * 3.1 * Math.pow(pw, 0.55)) : 0,
    accel: power > 0 ? Math.min(9, H.eff * (0.9 + 0.23 * pw)) : 0,
    turn: H.turn * clamp(0.7 + 0.3 * pw / 16, 0.6, 1.3),
    radius: H.radius,
    turretSpeed: driveOk ? D.speed : 0,
    elevSpeed: Gn ? Gn.elevSpeed : 0.2,
    elevMin: mount ? mount.elevMin : -0.1, elevMax: mount ? mount.elevMax : 0.3,
    turretArc: H.turretless ? H.arc : 0,
    reload: Gn ? Gn.reload : 5, shellSpeed: Gn ? Gn.shellSpeed : 500, pen: Gn ? Gn.pen : 0,
    dmg: Gn ? Gn.dmg : 0, disp: Gn ? Gn.disp : 0.005, caliber: Gn ? Gn.caliber : '—',
    ammoMax: H.ammoMax,
    fuelInt: H.fuelInt, fuelExt: F ? F.cap : 0, fuelMax: H.fuelInt + (F ? F.cap : 0),
    fuelUse: E ? E.fuelUse : 0.05,
    armor: { hull: H.armor, turret: T ? T.armor : H.armor },
    modules, crew,
  };
}
