// Small arms: catalog (pistols, revolvers, compact SMGs, rifles, automatic rifles / SMGs, machine guns, grenades),
// procedural weapon models, hitscan bullets with tracers and thrown grenades.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_LEVEL, segBox } from './world.js';
import { buildWeaponModel, buildGrenadeModel } from './weaponmodels.js';

const GRAV = 9.81;

// ===================================================================== catalog
// cat: pistol | revolver | smg  (small: one carried)   rifle | auto | mg  (big: one carried)
// rpm: rate of fire, auto: full-auto, dmg: per hit (a man has 100 hp), spread / aim: dispersion (rad) from the hip /
// aimed, range: effective (m), reload (s), recoil (rad of kick), era: 1 WW1, 2 WW2, 3 post-war (who carries it)
// m: model { len total, bl barrel out of the body, h body height, stock: wood|metal|wire|none|poly, mag: box|curved|drum|
//            pan|top|belt|side|grip|internal|cyl, wood: wooden furniture, bipod, scope, handle }
export const CAT_NAMES = {
  pistol: 'Пистолет', revolver: 'Револьвер', smg: 'Пистолет-пулемёт', rifle: 'Винтовка', auto: 'Автомат', mg: 'Пулемёт',
};
export const SMALL_CATS = ['pistol', 'revolver', 'smg'];
export const isSmall = key => SMALL_CATS.includes(WEAPONS[key].cat);

const P = (name, cal, mag, dmg, era, o = {}) => ({ cat: 'pistol', name, cal, mag, dmg, era, rpm: 300, auto: false,
  spread: 0.022, aim: 0.01, range: 50, reload: 1.6, recoil: 0.02, ...o, m: { len: 0.21, bl: 0.02, h: 0.035, stock: 'none', mag: 'grip', ...(o.m || {}) } });
const R = (name, cal, dmg, era, o = {}) => ({ cat: 'revolver', name, cal, mag: 6, dmg, era, rpm: 170, auto: false,
  spread: 0.024, aim: 0.01, range: 50, reload: 3.2, recoil: 0.035, ...o, m: { len: 0.27, bl: 0.12, h: 0.04, stock: 'none', mag: 'cyl', ...(o.m || {}) } });
const S = (name, cal, mag, dmg, rpm, era, o = {}) => ({ cat: 'smg', name, cal, mag, dmg, era, rpm, auto: true,
  spread: 0.035, aim: 0.018, range: 70, reload: 2.2, recoil: 0.012, ...o, m: { len: 0.3, bl: 0.04, h: 0.06, stock: 'none', mag: 'grip', ...(o.m || {}) } });
const F = (name, cal, mag, dmg, rpm, era, o = {}) => ({ cat: 'rifle', name, cal, mag, dmg, era, rpm, auto: false,
  spread: 0.02, aim: 0.0025, range: 400, reload: 3.4, recoil: 0.05, ...o, m: { len: 1.15, bl: 0.35, h: 0.07, stock: 'wood', mag: 'internal', wood: true, ...(o.m || {}) } });
const A = (name, cal, mag, dmg, rpm, era, o = {}) => ({ cat: 'auto', name, cal, mag, dmg, era, rpm, auto: true,
  spread: 0.03, aim: 0.008, range: 250, reload: 2.5, recoil: 0.018, ...o, m: { len: 0.88, bl: 0.22, h: 0.08, stock: 'wood', mag: 'curved', wood: true, ...(o.m || {}) } });
const M = (name, cal, mag, dmg, rpm, era, o = {}) => ({ cat: 'mg', name, cal, mag, dmg, era, rpm, auto: true,
  spread: 0.04, aim: 0.012, range: 400, reload: 4.5, recoil: 0.014, ...o, m: { len: 1.2, bl: 0.4, h: 0.1, stock: 'wood', mag: 'belt', bipod: true, ...(o.m || {}) } });

export const WEAPONS = {
  // ---- pistols
  luger:     P('Luger P08', '9×19', 8, 28, 1, { m: { len: 0.22, bl: 0.06 } }),
  p38:       P('Walther P38', '9×19', 8, 28, 2),
  tt:        P('ТТ-33', '7.62×25', 8, 30, 2),
  m1911:     P('Colt M1911', '.45 ACP', 7, 36, 1, { recoil: 0.03 }),
  c96:       P('Mauser C96', '7.63×25', 10, 29, 1, { m: { len: 0.29, bl: 0.1, mag: 'box' } }),
  hipower:   P('Browning Hi-Power', '9×19', 13, 28, 2),
  pm:        P('ПМ Макарова', '9×18', 8, 25, 3, { m: { len: 0.16 } }),
  glock:     P('Glock 17', '9×19', 17, 28, 3),
  beretta92: P('Beretta 92', '9×19', 15, 28, 3),
  aps:       P('АПС Стечкина', '9×18', 20, 25, 3, { auto: true, rpm: 750, spread: 0.03, m: { len: 0.22 } }),
  // ---- revolvers
  nagant:    R('Наган M1895', '7.62×38R', 30, 1, { mag: 7, reload: 4.5 }),
  webley:    R('Webley Mk VI', '.455', 40, 1, { m: { len: 0.28 } }),
  saa:       R('Colt Single Action Army', '.45 Colt', 42, 1, { rpm: 110, reload: 4.5 }),
  sw1917:    R('Smith & Wesson M1917', '.45 ACP', 36, 1),
  python:    R('Colt Python', '.357', 45, 3, { recoil: 0.045 }),
  m29:       R('S&W Model 29', '.44', 55, 3, { recoil: 0.06, m: { len: 0.3, bl: 0.16 } }),
  enfield2:  R('Enfield No.2', '.38/200', 30, 2, { m: { len: 0.26, bl: 0.1 } }),
  lebel92:   R('Lebel Mle 1892', '8×27R', 26, 1),
  reich79:   R('Reichsrevolver M1879', '10.6×25R', 34, 1, { rpm: 110, reload: 5 }),
  newserv:   R('Colt New Service', '.45 Colt', 42, 1),
  // ---- compact SMGs
  uzi:       S('UZI', '9×19', 32, 27, 600, 3, { m: { len: 0.47, h: 0.08, stock: 'fold' } }),
  miniuzi:   S('Mini-Uzi', '9×19', 32, 26, 950, 3, { m: { len: 0.36, h: 0.07 } }),
  microuzi:  S('Micro-Uzi', '9×19', 20, 25, 1200, 3, { spread: 0.045 }),
  mac10:     S('MAC-10', '.45 ACP', 30, 33, 1100, 3, { spread: 0.05, m: { len: 0.3, h: 0.08 } }),
  mac11:     S('MAC-11', '9×17', 32, 22, 1200, 3, { spread: 0.05, m: { len: 0.25, h: 0.07 } }),
  skorpion:  S('Škorpion vz. 61', '.32 ACP', 20, 20, 850, 3, { m: { len: 0.27, mag: 'curved', stock: 'wire' } }),
  mp5k:      S('HK MP5K', '9×19', 30, 27, 900, 3, { m: { len: 0.33, mag: 'curved', h: 0.07 } }),
  tec9:      S('TEC-9', '9×19', 32, 26, 400, 3, { auto: false, m: { len: 0.32, mag: 'box' } }),
  kedr:      S('ПП-91 «Кедр»', '9×18', 30, 24, 900, 3, { m: { len: 0.3, mag: 'box', stock: 'wire' } }),
  mp7:       S('HK MP7', '4.6×30', 40, 26, 950, 3, { aim: 0.012, m: { len: 0.38, mag: 'grip', stock: 'poly' } }),
  // ---- rifles
  mosin:     F('Винтовка Мосина 1891/30', '7.62×54R', 5, 90, 40, 1, { m: { len: 1.23 } }),
  kar98k:    F('Mauser Kar98k', '7.92×57', 5, 92, 45, 2, { m: { len: 1.11 } }),
  enfield4:  F('Lee-Enfield No.4', '.303', 10, 88, 50, 2, { m: { len: 1.13, mag: 'box' } }),
  garand:    F('M1 Garand', '.30-06', 8, 85, 120, 2, { reload: 2.2, m: { len: 1.1 } }),
  springf:   F('Springfield M1903', '.30-06', 5, 92, 40, 1, { m: { len: 1.1 } }),
  svt40:     F('СВТ-40', '7.62×54R', 10, 82, 110, 2, { reload: 2.8, m: { len: 1.22, mag: 'box' } }),
  lebel86:   F('Lebel Mle 1886', '8×50R', 8, 85, 35, 1, { reload: 5, m: { len: 1.3 } }),
  arisaka:   F('Arisaka Type 99', '7.7×58', 5, 90, 42, 2, { m: { len: 1.12 } }),
  g43:       F('Gewehr 43', '7.92×57', 10, 88, 110, 2, { reload: 2.8, m: { len: 1.13, mag: 'box' } }),
  svd:       F('СВД', '7.62×54R', 10, 95, 90, 3, { aim: 0.0008, range: 600, reload: 2.6, m: { len: 1.22, mag: 'box', scope: true, stock: 'wood' } }),
  // ---- automatic rifles & SMGs ("автоматы")
  ak47:      A('АК-47', '7.62×39', 30, 45, 600, 3),
  akm:       A('АКМ', '7.62×39', 30, 45, 600, 3, { spread: 0.028 }),
  ak74:      A('АК-74', '5.45×39', 30, 38, 650, 3, { recoil: 0.012, m: { mag: 'curved', wood: false, stock: 'poly' } }),
  m16:       A('M16A1', '5.56×45', 20, 36, 750, 3, { recoil: 0.012, m: { len: 0.99, mag: 'box', wood: false, stock: 'poly', handle: true } }),
  stg44:     A('StG 44', '7.92×33', 30, 44, 550, 2, { m: { len: 0.94, wood: false } }),
  ppsh:      A('ППШ-41', '7.62×25', 71, 28, 1000, 2, { spread: 0.04, range: 150, reload: 3.4, m: { len: 0.84, mag: 'drum', bl: 0.12 } }),
  mp40:      A('MP 40', '9×19', 32, 27, 500, 2, { spread: 0.035, range: 120, m: { len: 0.83, mag: 'box', wood: false, stock: 'wire', bl: 0.1 } }),
  thompson:  A('Thompson M1928', '.45 ACP', 30, 33, 700, 2, { spread: 0.035, range: 120, m: { len: 0.85, mag: 'box', bl: 0.14 } }),
  fal:       A('FN FAL', '7.62×51', 20, 55, 650, 3, { recoil: 0.028, m: { len: 1.09, mag: 'box', wood: false, stock: 'poly' } }),
  g3:        A('HK G3', '7.62×51', 20, 55, 550, 3, { recoil: 0.026, m: { len: 1.02, mag: 'box', wood: false, stock: 'poly' } }),
  // ---- machine guns
  dp27:      M('ДП-27', '7.62×54R', 47, 60, 550, 2, { m: { len: 1.27, mag: 'pan' } }),
  dt:        M('ДТ-29', '7.62×54R', 63, 60, 600, 2, { m: { len: 1.14, mag: 'pan', stock: 'metal', bipod: false } }),
  mg34:      M('MG 34', '7.92×57', 50, 62, 850, 2, { m: { len: 1.22, mag: 'drum', stock: 'poly' } }),
  mg42:      M('MG 42', '7.92×57', 50, 62, 1200, 2, { spread: 0.045, m: { len: 1.22, stock: 'poly' } }),
  mg3:       M('MG3', '7.62×51', 100, 58, 1100, 3, { spread: 0.045, m: { len: 1.22, stock: 'poly' } }),
  m1919:     M('Browning M1919A4', '.30-06', 100, 60, 500, 2, { m: { len: 1.04, stock: 'none', h: 0.13 } }),
  m240:      M('M240 (FN MAG)', '7.62×51', 100, 58, 750, 3, { m: { len: 1.26, stock: 'poly' } }),
  pkt:       M('ПКТ / ПКМ', '7.62×54R', 100, 60, 750, 3, { m: { len: 1.19, stock: 'wood' } }),
  bren:      M('Bren Mk I', '.303', 30, 60, 520, 2, { reload: 3, m: { len: 1.15, mag: 'top' } }),
  hotchkiss: M('Hotchkiss M1914', '8×50R', 24, 58, 450, 1, { reload: 3.5, m: { len: 1.39, mag: 'side', stock: 'metal', h: 0.12 } }),
  vickers:   M('Vickers Mk I', '.303', 250, 60, 450, 1, { reload: 5, m: { len: 1.1, stock: 'none', h: 0.14 } }),
  reibel:    M('MAC 31 «Рейбель»', '7.5×54', 150, 58, 750, 2, { m: { len: 1.03, mag: 'drum', stock: 'none' } }),
  type97:    M('Тип 97 (танковый)', '7.7×58', 20, 60, 500, 2, { m: { len: 1.18, mag: 'top', stock: 'wood' } }),
};

// cartridge boxes found / dropped: rounds per box
export const CALIBERS = {};
for (const w of Object.values(WEAPONS)) {
  const big = !SMALL_CATS.includes(w.cat);
  const box = w.cat === 'mg' ? 100 : big ? 40 : 30;
  CALIBERS[w.cal] = Math.max(CALIBERS[w.cal] || 0, box);
}

// grenades: dmg at the centre, r lethal radius, fuse (s, 0 = impact), pen: armour penetration (anti-tank, mm)
export const GRENADES = {
  f1:     { name: 'Ф-1', dmg: 120, r: 9, fuse: 3.8, era: 2, color: 0x4b5a32 },
  rgd5:   { name: 'РГД-5', dmg: 110, r: 7, fuse: 3.5, era: 3, color: 0x4f5a3a },
  rgd33:  { name: 'РГД-33', dmg: 110, r: 8, fuse: 3.8, era: 2, color: 0x3f4a2e, stick: true },
  m24:    { name: 'M24 Stielhandgranate', dmg: 115, r: 7, fuse: 4.5, era: 2, color: 0x6f6a56, stick: true },
  mk2:    { name: 'Mk 2 «ананас»', dmg: 110, r: 8, fuse: 4.5, era: 2, color: 0x566035 },
  mills:  { name: 'Mills No.36', dmg: 110, r: 8, fuse: 4, era: 1, color: 0x5a5a3a },
  m67:    { name: 'M67', dmg: 120, r: 8, fuse: 4.5, era: 3, color: 0x4a5236 },
  rpg43:  { name: 'РПГ-43 (противотанковая)', dmg: 140, r: 4, fuse: 0, pen: 75, era: 2, color: 0x4b5a32, stick: true },
  rkg3:   { name: 'РКГ-3 (противотанковая)', dmg: 140, r: 4, fuse: 0, pen: 150, era: 3, color: 0x55603a, stick: true },
};

let WEAPON_ID = 0;
export function makeWeapon(key, mag = WEAPONS[key].mag) {
  return { id: ++WEAPON_ID, key, mag: Math.max(0, Math.min(WEAPONS[key].mag, Math.round(mag))), vis: null };
}
export const weaponLabel = w => `${WEAPONS[w.key].name} (${WEAPONS[w.key].cal})`;

// ===================================================================== models (see weaponmodels.js)
const meshCache = new Map();
// weapon model: origin at the grip / trigger, barrel along +Z, sights up (+Y). Returns { group, muzzle, top, hand2 }
export function buildWeaponMesh(key) {
  const r = buildWeaponModel(key, WEAPONS[key]);
  r.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return r;
}

// a copy of a weapon model (the catalog mesh is shared)
export function weaponMesh(key) {
  if (!meshCache.has(key)) meshCache.set(key, buildWeaponMesh(key));
  const c = meshCache.get(key);
  return { group: c.group.clone(), muzzle: c.muzzle, top: c.top, hand2: c.hand2, scopeX: c.scopeX };
}

// the whole weapon baked into one vertex-coloured mesh (soldiers, tank pintles, pickups)
const VC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.45 });
const bakedCache = new Map();
export function bakedWeaponMesh(key) {
  if (!bakedCache.has(key)) {
    const src = buildWeaponMesh(key);
    src.group.updateMatrixWorld(true);
    const geos = [];
    src.group.traverse(o => {
      if (!o.isMesh) return;
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const n = g.attributes.position.count, col = o.material.color, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
      geos.push(g);
    });
    bakedCache.set(key, { geo: mergeGeometries(geos, false), muzzle: src.muzzle, top: src.top, hand2: src.hand2 });
  }
  const c = bakedCache.get(key);
  const mesh = new THREE.Mesh(c.geo, VC_MAT);
  mesh.castShadow = true;
  return { group: mesh, muzzle: c.muzzle, top: c.top, hand2: c.hand2 };
}

export function buildGrenadeMesh(key) {
  const g = buildGrenadeModel(key, GRENADES[key]);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ===================================================================== bullets & grenades
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _inv = new THREE.Matrix4(), _c = new THREE.Vector3();

export class Guns {
  constructor(scene, world, fx, sfx) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.sfx = sfx;
    this.tanks = [];                 // set by the game
    this.soldiers = [];              // live infantry (see infantry.js)
    this.foot = null;                // { pos, active, crouch } on-foot player
    this.listener = new THREE.Vector3();
    this.onPlayerHit = () => {};
    this.onExplosion = () => {};     // (pos, radius, dmg, owner)
    this.onGrenadeTank = () => {};   // anti-tank grenade struck a tank: (tank, point, dir, def, owner)
    this.onShot = () => {};          // every round fired: (origin, hitPoint, owner, W) - infantry hears / is suppressed
    this.tracers = [];
    this.pool = [];
    this.grenades = [];
    this.tracerGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 4).rotateX(Math.PI / 2);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false });
  }

  // hitscan: returns { point, dist, kind, soldier?, tank?, head? }
  trace(origin, dir, maxD, owner) {
    let best = maxD, hit = { kind: 'none' };
    const end = _p1.copy(origin).addScaledVector(dir, maxD);
    // tanks
    for (const t of this.tanks) {
      if (owner && owner.tank === t) continue;
      const tp = t.root.position;
      const rel = _c.copy(tp).sub(origin);
      const along = rel.dot(dir);
      if (along < -8 || along > best + 8) continue;
      if (rel.addScaledVector(dir, -along).length() > 8) continue;
      for (const vol of t.hitVolumes()) {
        _inv.copy(vol.obj.matrixWorld).invert();
        const a = origin.clone().applyMatrix4(_inv), b = end.clone().applyMatrix4(_inv);
        const bx = vol.box;
        const tt = segBox(a.x, a.y, a.z, b.x, b.y, b.z, bx.min.x, bx.min.y, bx.min.z, bx.max.x, bx.max.y, bx.max.z);
        if (tt !== null && tt * maxD < best) { best = tt * maxD; hit = { kind: 'tank', tank: t }; }
      }
    }
    // infantry: vertical capsules (enemies - soldiers and enemy tanks - don't hit their own men)
    const friendly = owner && (owner.soldier || (owner.tank && owner.tank.team === 'enemy' && !owner.player));
    for (const s of this.soldiers) {
      if (!s.alive || friendly) continue;
      const r = this.capsule(origin, dir, s.pos, s.height, 0.32, best);
      if (r) { best = r.d; hit = { kind: 'soldier', soldier: s, head: r.y > s.pos.y + s.height - 0.3 }; }
    }
    // player on foot
    const f = this.foot;
    if (f && f.active && !(owner && owner.player)) {
      const r = this.capsule(origin, dir, f.pos, f.crouch ? 1.2 : 1.75, 0.35, best);
      if (r) { best = r.d; hit = { kind: 'player', head: r.y > f.pos.y + (f.crouch ? 1.0 : 1.5) }; }
    }
    // obstacles & trees
    _p0.copy(origin);
    const segEnd = _c.copy(origin).addScaledVector(dir, best);
    const ob = this.world.raycastObstacles(_p0, segEnd);
    if (ob && ob.t * best < best) { best = ob.t * best; hit = { kind: 'obstacle', obstacle: ob.obstacle }; }
    const segEnd2 = new THREE.Vector3().copy(origin).addScaledVector(dir, best);
    const tr = this.world.raycastTrees(_p0, segEnd2);
    if (tr && tr.t * best < best) { best = tr.t * best; hit = { kind: 'tree', tree: tr.tree }; }
    // terrain / water
    let d = 0.5, prev = 0;
    while (d < best) {
      const x = origin.x + dir.x * d, y = origin.y + dir.y * d, z = origin.z + dir.z * d;
      const gh = this.world.heightAt(x, z);
      if (y < Math.max(gh, WATER_LEVEL)) {
        let lo = prev, hi = d;
        for (let i = 0; i < 6; i++) {
          const mm = (lo + hi) / 2;
          if (origin.y + dir.y * mm < Math.max(this.world.heightAt(origin.x + dir.x * mm, origin.z + dir.z * mm), WATER_LEVEL)) hi = mm; else lo = mm;
        }
        best = hi;
        hit = { kind: gh < WATER_LEVEL ? 'water' : 'ground' };
        break;
      }
      prev = d;
      d += d < 60 ? 1.5 : 3;
    }
    hit.dist = best;
    hit.point = origin.clone().addScaledVector(dir, best);
    return hit;
  }

  // ray vs vertical capsule standing at base, returns { d, y } or null
  capsule(o, dir, base, h, r, maxD) {
    const cx = base.x - o.x, cz = base.z - o.z;
    const hl2 = dir.x * dir.x + dir.z * dir.z;
    if (hl2 < 1e-8) return null;
    // closest approach in the horizontal plane
    const t = (cx * dir.x + cz * dir.z) / hl2;
    if (t < 0 || t > maxD) return null;
    const dx = o.x + dir.x * t - base.x, dz = o.z + dir.z * t - base.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > r * r) return null;
    const back = Math.sqrt((r * r - d2) / hl2);
    const tt = Math.max(0, t - back);
    const y = o.y + dir.y * tt;
    if (y < base.y - 0.05 || y > base.y + h) return null;
    return { d: tt, y };
  }

  // fire one round of weapon W (catalog entry) from origin along dir (already spread); owner = { player | soldier | tank }
  fire(origin, dir, W, owner, muzzle = origin, tracer = true) {
    const hit = this.trace(origin, dir, Math.max(250, W.range * 2.2), owner);
    const dmgFall = hit.dist > W.range ? Math.max(0.35, 1 - (hit.dist - W.range) / (W.range * 1.5)) : 1;
    const dmg = W.dmg * dmgFall * (hit.head ? 2.2 : 1);
    if (hit.kind === 'soldier') {
      hit.soldier.hit(dmg, owner, dir);
      this.fx.spawn('spark', hit.point, null, 0.25);
    } else if (hit.kind === 'player') {
      this.onPlayerHit(dmg * 0.5, owner);
    } else if (hit.kind === 'tank') {
      for (let i = 0; i < 3; i++) this.fx.spawn('spark', hit.point, this.fx.rnd(10), 0.4);
      if (Math.random() < 0.25) this.sfx.ping(hit.point.distanceTo(this.listener), 0.25);
    } else if (hit.kind === 'water') {
      this.fx.spawn('steam', hit.point, null, 0.2);
    } else if (hit.kind !== 'none') {
      this.fx.spawn('dust', hit.point, null, 0.18);
      if (hit.kind === 'obstacle') this.fx.spawn('spark', hit.point, this.fx.rnd(6), 0.25);
    }
    // muzzle flash + sound + tracer
    this.fx.spawn('flash', muzzle, null, W.cat === 'mg' ? 0.28 : 0.18);
    this.sfx.gun(muzzle.distanceTo(this.listener), SMALL_CATS.includes(W.cat) ? 0.6 : W.cat === 'mg' ? 1.1 : 1);
    if (tracer) this.tracer(muzzle, hit.point);
    this.onShot(origin, hit.point, owner, W);
    return hit;
  }

  tracer(a, b) {
    let t = this.pool.pop();
    if (!t) {
      t = { mesh: new THREE.Mesh(this.tracerGeo, this.tracerMat), from: new THREE.Vector3(), to: new THREE.Vector3() };
      t.mesh.frustumCulled = false;
    }
    t.from.copy(a); t.to.copy(b);
    t.len = a.distanceTo(b);
    t.t = 0;
    t.mesh.position.copy(a);
    t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _c.copy(b).sub(a).normalize());
    t.mesh.scale.set(1, 1, Math.min(6, t.len));
    this.scene.add(t.mesh);
    this.tracers.push(t);
  }

  throwGrenade(pos, vel, key, owner) {
    const mesh = buildGrenadeMesh(key);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const D = GRENADES[key];
    this.grenades.push({ mesh, pos: mesh.position, vel: vel.clone(), key, D, owner, t: D.fuse || 8, spin: Math.random() * 10 });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t += dt * 700;
      if (t.t >= t.len) {
        this.scene.remove(t.mesh);
        this.tracers[i] = this.tracers[this.tracers.length - 1];
        this.tracers.pop();
        this.pool.push(t);
        continue;
      }
      const k = Math.min(1, (t.t + Math.min(6, t.len) / 2) / t.len);
      t.mesh.position.lerpVectors(t.from, t.to, k);
    }
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.t -= dt;
      g.vel.y -= GRAV * dt;
      const ox = g.pos.x, oz = g.pos.z;
      g.pos.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += g.spin * dt;
      let impact = false;
      // obstacles
      const tmp = { x: g.pos.x, y: g.pos.y, z: g.pos.z };
      if (this.world.collideObstacles(tmp, 0.1)) { g.pos.x = ox; g.pos.z = oz; g.vel.x *= -0.35; g.vel.z *= -0.35; impact = true; }
      // tanks
      for (const t of this.tanks) {
        const b = t.vis.hullBox;
        const lp = t.root.worldToLocal(_c.copy(g.pos));
        if (lp.x > b.min.x - 0.1 && lp.x < b.max.x + 0.1 && lp.z > b.min.z - 0.1 && lp.z < b.max.z + 0.1 && lp.y < b.max.y + (t.vis.turretBox ? 1.0 : 0.2) && lp.y > b.min.y - 0.2) {
          if (g.D.pen) {
            this.onGrenadeTank(t, g.pos.clone(), g.vel.clone().normalize(), g.D, g.owner);
            this.explode(g, i, false);
            impact = null;
            break;
          }
          g.pos.x = ox; g.pos.z = oz;
          g.vel.multiplyScalar(-0.3);
          impact = true;
        }
      }
      if (impact === null) continue;
      const gh = Math.max(this.world.heightAt(g.pos.x, g.pos.z), WATER_LEVEL);
      if (g.pos.y < gh + 0.05) {
        g.pos.y = gh + 0.05;
        if (gh <= WATER_LEVEL + 0.01 && this.world.heightAt(g.pos.x, g.pos.z) < WATER_LEVEL) { g.t = Math.min(g.t, 0.5); g.vel.set(0, 0, 0); }
        if (g.vel.y < -1) impact = true;
        g.vel.y = Math.abs(g.vel.y) * 0.3;
        g.vel.x *= 0.55; g.vel.z *= 0.55;
        g.spin *= 0.5;
      }
      if ((impact && !g.D.fuse) || g.t <= 0) this.explode(g, i, true);
    }
  }

  explode(g, i, splash) {
    this.scene.remove(g.mesh);
    this.grenades.splice(i, 1);
    this.fx.explosion(g.pos, g.D.pen ? 0.7 : 0.55, true);
    this.sfx.boom(g.pos.distanceTo(this.listener), 0.7);
    this.onExplosion(g.pos.clone(), g.D.r, g.D.dmg, g.owner);
  }
}

// grenade in flight hitting something: used by the AI to judge a throw
export function throwVelocity(from, to, speed = 15) {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
  const d = Math.hypot(dx, dz);
  // pick an angle that reaches the target with the given speed (low arc), fall back to 45°
  const v2 = speed * speed;
  const disc = v2 * v2 - GRAV * (GRAV * d * d + 2 * dy * v2);
  let th = Math.PI / 4;
  if (disc >= 0) th = Math.atan((v2 - Math.sqrt(disc)) / (GRAV * d));
  else speed = Math.sqrt(GRAV * d) * 1.05;
  const h = Math.cos(th) * speed;
  return new THREE.Vector3(dx / d * h, Math.sin(th) * speed, dz / d * h);
}
