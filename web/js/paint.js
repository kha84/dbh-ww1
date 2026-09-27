// Paint: colours of tanks, armour plates and spray cans. A tank's paint is the colour of the palette surfaces of
// its models (modelkit marks them when baking: vertex ranges of the merged mesh or whole textured meshes);
// repainting rewrites those vertex colours / swaps the materials. Welded plates stay as patches of the colour
// the plate had until they are painted over.
import * as THREE from 'three';
import { PALETTES, rivetTexture } from './modelkit.js';
import { TANK_DEFS } from './tankdefs/index.js';

export const STEEL = 0x7c8083;                 // bare steel of a new armour plate
export const DARK_K = 0.72;                    // 'dark' palette surfaces: this much darker than the paint

// spray can colours found along the road (besides the paints of the tanks met there)
export const PAINTS = [
  { name: 'тёмно-зелёная', color: 0x3c4a2c },
  { name: 'хаки', color: 0x6d6a45 },
  { name: 'песочная', color: 0xb39a6b },
  { name: 'белая (зимняя)', color: 0xd8d8d0 },
  { name: 'чёрная', color: 0x242424 },
  { name: 'красная', color: 0x8a2a20 },
  { name: 'синяя', color: 0x2f4a78 },
  { name: 'коричневая', color: 0x5a4330 },
];
// the standard paint of each tank type
export const TANK_PAINTS = TANK_DEFS.map(d => ({ name: `«${d.name}»`, color: d.palette.main, key: d.key }));

export const hexCss = c => '#' + c.toString(16).padStart(6, '0');
export const swatch = c => `<i class="sw" style="background:${hexCss(c)}"></i>`;

// human name of a colour
export function colorName(c) {
  if (c === STEEL) return 'голая сталь';
  const p = PAINTS.find(x => x.color === c);
  if (p) return p.name;
  const t = TANK_PAINTS.filter(x => x.color === c);
  if (t.length) return `как у ${t.map(x => x.name).join(' / ')}`;
  return hexCss(c);
}

// a spray can for difficulty d: half of them in the paint of a tank met around there
export function sprayColor(r, tankKey) {
  if (tankKey && r() < 0.5) return PALETTES[tankKey].main;
  return PAINTS[Math.floor(r() * PAINTS.length)].color;
}

// ------------------------------------------------------------------ recolouring models
const _c = new THREE.Color(), _d = new THREE.Color();
const matCache = new Map();
// material of a palette role in a given paint (unbaked meshes with the shared palette material, riveted plates)
function paintedMaterial(src, role, color) {
  const k = `${src.uuid}:${color}`;
  if (matCache.has(k)) return matCache.get(k);
  const m = src.clone();
  m.userData = { ...src.userData, painted: true };
  const base = new THREE.Color(color);
  if (role === 'dark') base.multiplyScalar(DARK_K);
  if (src.map && src.map.image && src.map.image.tagName === 'CANVAS') {
    // riveted plates: redraw the rivet texture in the new colour
    const hex = x => '#' + x.getHexString();
    m.map = rivetTexture(hex(base), hex(base.clone().multiplyScalar(role === 'dark' ? 0.55 : 0.62)));
    m.map.repeat.copy(src.map.repeat);
    m.color.set(0xffffff);
  } else m.color.copy(base);
  matCache.set(k, m);
  return m;
}

// repaint the palette surfaces of everything under `root` (patches and hit marks are left alone; `skip(o)` stops
// the descent, e.g. at the groups of parts that keep their own paint)
export function paintObject(root, color, skip = null) {
  _c.set(color);
  _d.copy(_c).multiplyScalar(DARK_K);
  const visit = o => {
    if (o !== root && skip && skip(o)) return;
    if (o.isMesh && !o.userData.mark && !o.userData.interior) {
      const ranges = o.userData.paint;
      if (ranges) {
        const col = o.geometry.attributes.color;
        for (const [start, n, role] of ranges) {
          const c = role === 'dark' ? _d : _c;
          for (let i = start; i < start + n; i++) col.setXYZ(i, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
      } else {
        const orig = o.userData.paintSrc || o.material;
        const role = o.userData.paintRole || orig.userData.paint;
        if (role) {
          o.userData.paintSrc = orig;
          o.material = paintedMaterial(orig, role, color);
        }
      }
    }
    for (const ch of o.children) visit(ch);
  };
  visit(root);
}

// ------------------------------------------------------------------ patches (welded plates)
let PATCH_TEX = null;
function patchTexture() {
  if (PATCH_TEX) return PATCH_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 60; i++) {                          // grime / brush marks
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 10, 2 + Math.random() * 6);
  }
  g.strokeStyle = 'rgba(40,36,30,0.9)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, 59, 59);      // weld bead
  g.strokeStyle = 'rgba(200,190,170,0.5)'; g.lineWidth = 1.5; g.strokeRect(4, 4, 56, 56);
  for (const [x, y] of [[10, 10], [54, 10], [10, 54], [54, 54]]) {
    g.fillStyle = 'rgba(30,28,24,.8)'; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill();
  }
  PATCH_TEX = new THREE.CanvasTexture(c);
  PATCH_TEX.colorSpace = THREE.SRGBColorSpace;
  return PATCH_TEX;
}
const patchMats = new Map();
export function patchMaterial(color) {
  if (patchMats.has(color)) return patchMats.get(color);
  const m = new THREE.MeshStandardMaterial({
    color, map: patchTexture(), roughness: 0.8, metalness: 0.3,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  patchMats.set(color, m);
  return m;
}
export const PATCH_GEO = new THREE.BoxGeometry(1, 1, 0.025).translate(0, 0, 0.0125);
