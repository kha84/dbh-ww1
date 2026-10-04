// Crew compartments, built lazily when the player first looks inside a tank.
//
// The shell (floor, walls with vision slits, roof with the turret ring, the raised cab of the Mark V) comes from
// the hull's `interior` data in its tank definition; everything else is a list of typed props:
//   hull.interior.props   = [{ type, ... }]  in hull-local coordinates
//   models.turretInterior = { poly | dome, h, cupola, props: [...] }  in turret-local coordinates
// `theme` picks the paint of the compartment (nation / era). Prop builders are in PROPS below:
// add a new kind of equipment there and list it in the tank definitions.
import * as THREE from 'three';
import { DEFS } from './tankdefs/index.js';
import { U, PI } from './modelkit.js';

// ===================================================================== paint schemes
const S = (color, r = 0.85, m = 0.15, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
const THEMES = {
  soviet:  { wall: 0xd3d8cb, floor: 0x4a4e45, fire: 0x8f978c, gear: 0x5e6a52, dark: 0x2b2d28 },
  soviet2: { wall: 0xa9bfb5, floor: 0x4f5249, fire: 0x8a948a, gear: 0x55665a, dark: 0x2a2e2b },
  german:  { wall: 0xe3d9bd, floor: 0x55534a, fire: 0x9a9280, gear: 0x5a5d58, dark: 0x2c2b28 },
  british: { wall: 0xdad7c9, floor: 0x4e4f47, fire: 0x949487, gear: 0x55604a, dark: 0x2b2c29 },
  us:      { wall: 0xe4e5df, floor: 0x55575a, fire: 0x9da0a0, gear: 0x6b6d62, dark: 0x252628 },
  nato:    { wall: 0xc9d2c2, floor: 0x4b4f4b, fire: 0x8b958b, gear: 0x4a5347, dark: 0x222522 },
  french:  { wall: 0xcfc8b3, floor: 0x514c42, fire: 0x928a78, gear: 0x5d5a4a, dark: 0x2c2a26 },
  japan:   { wall: 0xbdbca3, floor: 0x4c4b40, fire: 0x8e8d78, gear: 0x5a5b45, dark: 0x2a2a24 },
  ww1:     { wall: 0x77705f, floor: 0x3f3a31, fire: 0x5f594c, gear: 0x4d4a3e, dark: 0x24221d, riveted: true },
};
const COMMON = {
  seat: S(0x3a3026, 0.9, 0), leather: S(0x4a3322, 0.8, 0), brass: S(0xc09a45, 0.35, 0.85), steel: S(0x7b7f80, 0.45, 0.7),
  dial: new THREE.MeshBasicMaterial({ color: 0xd9e8c4 }), lamp: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }),
  red: S(0xa02a20, 0.6, 0.2), glass: S(0x9fb8c0, 0.15, 0.5, { emissive: 0x1a2a30 }),
  screen: new THREE.MeshBasicMaterial({ color: 0x3fbf5f }), screenDark: S(0x101512, 0.4, 0.3),
  cable: S(0x1c1c1c, 0.9, 0), canvas: S(0x6b6448, 1, 0), wood: S(0x6b5033, 0.9, 0), white: S(0xe8e8e2, 0.7, 0),
  olive: S(0x4f5a38, 0.8, 0.2), black: S(0x151515, 0.8, 0.3), shellHead: S(0x40443c, 0.6, 0.5),
};

function rivetWall(base) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 200; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '30,25,15' : '120,100,70'},${Math.random() * 0.1})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 12, 3 + Math.random() * 12);
  }
  g.strokeStyle = 'rgba(20,18,12,.7)'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
  for (let k = 8; k < 128; k += 12) for (const [x, y] of [[k, 6], [k, 122], [6, k], [122, k]]) {
    g.fillStyle = 'rgba(25,22,15,.9)'; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill();
    g.fillStyle = 'rgba(200,190,160,.35)'; g.beginPath(); g.arc(x - 0.6, y - 0.6, 1, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const themeCache = {};
function themeMats(name) {
  if (themeCache[name]) return themeCache[name];
  const T = THEMES[name] || THEMES.soviet;
  const ds = { side: THREE.DoubleSide };
  const m = {
    wall: S(T.wall, 0.95, 0.05, ds), floor: S(T.floor, 0.95, 0.25, ds), fire: S(T.fire, 0.8, 0.3, ds),
    gear: S(T.gear, 0.75, 0.3), dark: S(T.dark, 0.7, 0.45), ...COMMON,
  };
  if (T.riveted) {
    const tex = rivetWall('#' + T.wall.toString(16).padStart(6, '0'));
    m.wall = S(0xffffff, 0.95, 0.1, { ...ds, map: tex });
  }
  themeCache[name] = m;
  return m;
}

// ===================================================================== geometry helpers
/** @param {THREE.BufferGeometry} [geo] */
function ibox(parent, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, geo = U.box) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const icyl = (p, mat, x, y, z, r, h, rx = 0, ry = 0, rz = 0) => ibox(p, mat, x, y, z, r, h, r, rx, ry, rz, U.cyl);
const itorus = (p, mat, x, y, z, r, t, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 18), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  p.add(m);
  return m;
};
// a group placed at `at` turned by ry (props are built in their own frame: +Z = facing, +X = left)
function frame(parent, at, ry = 0) {
  const g = new THREE.Group();
  g.position.fromArray(at);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}
// thin cylinder between two points (pipes, cables, rods)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function rod(parent, mat, p0, p1, r) {
  _a.fromArray(p0); _b.fromArray(p1);
  const len = _a.distanceTo(_b);
  const m = new THREE.Mesh(U.cyl8, mat);
  m.position.copy(_a).add(_b).multiplyScalar(0.5);
  m.scale.set(r, len, r);
  m.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize());
  parent.add(m);
  return m;
}

function breaks(a, b, step, extra = []) {
  const s = new Set();
  for (let x = a; x < b - 1e-6; x += step) s.add(+x.toFixed(4));
  s.add(+b.toFixed(4));
  for (const e of extra) if (e > a && e < b) s.add(+e.toFixed(4));
  return [...s].sort((p, q) => p - q);
}

// quads on the plane o + a*u + b*v, skipping cells whose centre fails keep(u, v)
function panel(o, a, b, us, vs, keep) {
  const pos = [], nrm = [], uv = [];
  const n = new THREE.Vector3().crossVectors(a, b).normalize();
  const P = (u, v) => [o.x + a.x * u + b.x * v, o.y + a.y * u + b.y * v, o.z + a.z * u + b.z * v];
  for (let i = 0; i < us.length - 1; i++) {
    for (let j = 0; j < vs.length - 1; j++) {
      if (keep && !keep((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2, us[i], us[i + 1], vs[j], vs[j + 1])) continue;
      const p00 = P(us[i], vs[j]), p10 = P(us[i + 1], vs[j]), p11 = P(us[i + 1], vs[j + 1]), p01 = P(us[i], vs[j + 1]);
      pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      uv.push(us[i], vs[j], us[i + 1], vs[j], us[i + 1], vs[j + 1], us[i], vs[j], us[i + 1], vs[j + 1], us[i], vs[j + 1]);
      for (let k = 0; k < 6; k++) nrm.push(n.x, n.y, n.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
function addPanel(parent, geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);
const inRect = (u, v, r) => u > r.x[0] && u < r.x[1] && v > r.y[0] && v < r.y[1];

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// ===================================================================== props
// Every builder: (g, M, p, I) - parent group, materials, prop data, interior data of the hull (or turret)
const PROPS = {
  // crew seat; style: 'pan' (steel pan seat), 'padded' (modern), 'saddle' (WW1 bench), 'sling' (commander's strap)
  seat(g, M, p) {
    const s = frame(g, p.at, p.ry || 0);
    const st = p.style || 'padded';
    if (st === 'saddle') {
      ibox(s, M.wood, 0, 0, 0, 0.5, 0.06, 0.32);
      ibox(s, M.dark, 0, -0.25, 0, 0.05, 0.45, 0.05);
      return;
    }
    if (st === 'sling') {
      ibox(s, M.canvas, 0, 0, 0, 0.36, 0.03, 0.22);
      for (const x of [-0.18, 0.18]) rod(s, M.dark, [x, 0, 0], [x, 0.35, -0.05], 0.012);
      return;
    }
    const cush = st === 'pan' ? M.gear : M.seat;
    ibox(s, cush, 0, 0, 0, 0.42, st === 'pan' ? 0.04 : 0.08, 0.4);
    ibox(s, cush, 0, 0.25, -0.2, 0.42, 0.45, st === 'pan' ? 0.04 : 0.07, p.recline ? -0.45 : 0);
    ibox(s, M.dark, 0, -0.25, 0, 0.06, 0.45, 0.06);
    if (st === 'padded') for (const x of [-0.23, 0.23]) ibox(s, M.dark, x, 0.08, -0.02, 0.04, 0.14, 0.34);   // side bolsters
  },

  // driver controls; style: 'levers' (tillers), 'wheel' (steering wheel), 'tbar' (motorcycle handlebar), 'yoke'
  driver(g, M, p) {
    const [ex, ey, ez] = p.eye;
    const st = p.style || 'levers';
    if (st === 'none') return;
    const f = frame(g, [ex, ey, ez]);
    if (st === 'levers') {
      for (const dx of [-0.2, 0.2]) {
        ibox(f, M.dark, dx, -0.45, -0.08, 0.03, 0.5, 0.03, 0.5, 0, 0, U.cyl);
        ibox(f, M.red, dx, -0.22, 0.03, 0.035, 0.08, 0.035, 0, 0, 0, U.sph);
      }
      ibox(f, M.dark, 0.32, -0.55, 0.0, 0.025, 0.35, 0.025, 0.3, 0, 0, U.cyl);      // gear lever
      ibox(f, M.black, 0.32, -0.39, 0.05, 0.04, 0.04, 0.04, 0, 0, 0, U.sph);
    } else if (st === 'wheel') {
      itorus(f, M.black, 0, -0.35, 0.05, 0.2, 0.018, -0.9, 0, 0);
      rod(f, M.dark, [0, -0.35, 0.05], [0, -0.55, 0.35], 0.02);
      ibox(f, M.dark, 0.3, -0.55, 0.0, 0.025, 0.35, 0.025, 0.3, 0, 0, U.cyl);
    } else if (st === 'tbar' || st === 'yoke') {
      ibox(f, M.dark, 0, -0.42, 0.12, 0.08, 0.2, 0.08);
      ibox(f, M.black, 0, -0.32, 0.12, st === 'yoke' ? 0.42 : 0.5, 0.04, 0.04);
      for (const x of [-0.22, 0.22]) ibox(f, M.black, x, st === 'yoke' ? -0.26 : -0.32, 0.12, 0.05, st === 'yoke' ? 0.14 : 0.05, 0.05);
    }
    // dashboard
    const dash = frame(f, [0, -0.2, 0.2]);
    const modern = p.dash === 'modern';
    ibox(dash, M.dark, 0, 0, 0, 0.55, 0.16, 0.05);
    const nd = p.dials ?? 4;
    for (let i = 0; i < nd; i++) ibox(dash, M.dial, -0.2 + i * 0.4 / Math.max(1, nd - 1), 0, -0.03, 0.04, 0.04, 0.01, PI / 2, 0, 0, U.cyl);
    if (modern) {
      ibox(dash, M.screenDark, 0.36, 0.02, -0.01, 0.2, 0.14, 0.03);
      ibox(dash, M.screen, 0.36, 0.02, -0.03, 0.16, 0.1, 0.005);
    }
    for (let i = 0; i < 3; i++) ibox(dash, i === 1 ? M.red : M.lamp, -0.22 + i * 0.05, -0.06, -0.03, 0.015, 0.015, 0.01);
    for (const dx of [-0.15, 0, 0.15]) ibox(g, M.dark, ex + dx, p.floor + 0.08, ez + 0.25, 0.08, 0.03, 0.14, -0.4, 0, 0);   // pedals
  },

  // radio set: box with dials, knobs, a handset and an aerial lead up to the roof
  radio(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    const w = p.w || 0.45, h = p.h || 0.3, d = p.d || 0.22;
    const old = p.style === 'old';
    ibox(f, old ? M.wood : M.gear, 0, 0, 0, w, h, d);
    ibox(f, M.dark, 0, 0, d / 2 + 0.005, w * 0.92, h * 0.85, 0.01);
    for (let i = 0; i < 3; i++) ibox(f, M.dial, -w * 0.28 + i * w * 0.28, h * 0.15, d / 2 + 0.012, 0.035, 0.012, 0.035, PI / 2, 0, 0, U.cyl);
    for (let i = 0; i < 4; i++) ibox(f, M.black, -w * 0.33 + i * w * 0.22, -h * 0.2, d / 2 + 0.02, 0.018, 0.03, 0.018, PI / 2, 0, 0, U.cyl);
    ibox(f, M.lamp, w * 0.38, h * 0.3, d / 2 + 0.012, 0.02, 0.02, 0.01);
    ibox(f, M.black, w / 2 + 0.05, 0, 0.02, 0.05, 0.14, 0.05);                    // handset on the side
    if (p.aerial !== false) rod(f, M.cable, [0, h / 2, 0], [0, h / 2 + (p.lead || 0.3), -0.05], 0.008);
    if (p.box2) ibox(f, M.gear, 0, -h / 2 - 0.13, 0, w, 0.24, d);                 // power supply below
  },

  // internal fuel cell (box) with filler pipe
  fuelcell(g, M, p) {
    const [x0, y0, z0, x1, y1, z1] = p.box;
    ibox(g, M.gear, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
    icyl(g, M.brass, (x0 + x1) / 2, y1 + 0.03, (z0 + z1) / 2, 0.05, 0.06);
    rod(g, M.dark, [(x0 + x1) / 2, y1, z1 - 0.1], [(x0 + x1) / 2, y1 + 0.2, z1 + 0.05], 0.02);
    for (let z = z0 + 0.1; z < z1; z += 0.35) ibox(g, M.dark, (x0 + x1) / 2, (y0 + y1) / 2, z, x1 - x0 + 0.02, y1 - y0 + 0.02, 0.02);
  },

  // ammunition: style 'vertical' (rounds standing in a rack), 'horizontal' (rounds lying in clips),
  // 'bins' (floor bins with lids), 'drums' (MG drums / pans on pegs), 'charges' (separate-loading shells + cases)
  rack(g, M, p) {
    const [x0, x1] = p.x, [z0, z1] = p.z;
    const y0 = p.y0, h = p.h || 0.6, cal = p.cal || 0.05;
    const st = p.style || 'vertical';
    const step = Math.max(0.08, cal * 2.4);
    if (st === 'bins') {
      ibox(g, M.gear, (x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0);
      for (let z = z0 + 0.25; z < z1 - 0.1; z += 0.5) {
        ibox(g, M.dark, (x0 + x1) / 2, y0 + h + 0.01, z, x1 - x0 - 0.04, 0.02, 0.44);
        ibox(g, M.steel, (x0 + x1) / 2, y0 + h + 0.03, z + 0.15, 0.1, 0.02, 0.03);
      }
      return;
    }
    if (st === 'drums') {
      ibox(g, M.dark, (x0 + x1) / 2, y0, (z0 + z1) / 2, 0.03, 0.03, z1 - z0);
      for (let z = z0 + 0.12; z < z1; z += 0.26) {
        icyl(g, M.olive, (x0 + x1) / 2, y0 - 0.02, z, 0.11, 0.05, 0, 0, PI / 2);
        icyl(g, M.dark, (x0 + x1) / 2 + 0.03, y0 - 0.02, z, 0.03, 0.02, 0, 0, PI / 2);
      }
      return;
    }
    // frame
    ibox(g, M.dark, (x0 + x1) / 2, y0 + 0.02, (z0 + z1) / 2, x1 - x0, 0.04, z1 - z0);
    ibox(g, M.dark, (x0 + x1) / 2, y0 + h * 0.7, (z0 + z1) / 2, x1 - x0, 0.03, z1 - z0);
    for (let x = x0 + cal * 1.3; x < x1 - cal * 0.6; x += step) {
      for (let z = z0 + cal * 1.3; z < z1 - cal * 0.6; z += step) {
        if (st === 'vertical') {
          icyl(g, M.brass, x, y0 + h * 0.36, z, cal, h * 0.72);
          ibox(g, M.shellHead, x, y0 + h * 0.72 + h * 0.13, z, cal * 0.85, h * 0.26, cal * 0.85, 0, 0, 0, U.cone);
        } else if (st === 'charges') {
          icyl(g, M.brass, x, y0 + h * 0.3, z, cal * 1.1, h * 0.6);
          ibox(g, M.dark, x, y0 + h * 0.61, z, cal * 1.12, 0.02, cal * 1.12, 0, 0, 0, U.cyl);
        }
      }
    }
    if (st === 'horizontal') {
      const n = Math.max(1, Math.floor((p.rows || (h / step))));
      for (let r = 0; r < n; r++) for (let x = x0 + cal * 1.2; x < x1 - cal; x += step) {
        const y = y0 + 0.06 + r * step + cal;
        icyl(g, M.brass, x, y, (z0 + z1) / 2 - (z1 - z0) * 0.12, cal, (z1 - z0) * 0.72, PI / 2, 0, 0);
        ibox(g, M.shellHead, x, y, (z0 + z1) / 2 + (z1 - z0) * 0.36, cal * 0.85, (z1 - z0) * 0.22, cal * 0.85, PI / 2, 0, 0, U.cone);
      }
    }
  },

  // hull machine gun in a ball mount on the front plate (+ the bow gunner's shoulder stock)
  ballmg(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    icyl(f, M.dark, 0, 0, 0.02, 0.13, 0.08, PI / 2, 0, 0);
    ibox(f, M.dark, 0, 0, 0, 0.18, 0.18, 0.18, 0, 0, 0, U.sph);
    rod(f, M.black, [0, 0, 0], [0, -0.02, -0.55], 0.03);
    ibox(f, M.dark, 0, -0.07, -0.35, 0.05, 0.14, 0.05);                         // pistol grip
    ibox(f, M.leather, 0, -0.03, -0.62, 0.06, 0.1, 0.12);                        // shoulder pad
    if (p.drum) icyl(f, M.olive, 0, 0.08, -0.22, 0.1, 0.04);                     // DT pan / drum on top
    if (p.sight) ibox(f, M.black, 0.08, 0.06, -0.25, 0.03, 0.03, 0.2);
  },

  // side machine gun behind a flap / in a sponson (WW1)
  sidemg(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.gear, 0, 0, 0.1, 0.35, 0.3, 0.06);
    rod(f, M.black, [0, 0, 0.15], [0, 0, -0.45], 0.028);
    icyl(f, M.dark, 0, 0, -0.05, 0.05, 0.35, PI / 2, 0, 0);                     // cooling jacket
    ibox(f, M.dark, 0, -0.06, -0.4, 0.05, 0.12, 0.05);
    ibox(f, M.brass, 0.1, -0.02, -0.25, 0.12, 0.02, 0.04);                      // feed strip / belt
  },

  // a vision slit / periscope block with a brow pad
  periscope(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.dark, 0, 0, 0, p.w || 0.16, 0.12, 0.1);
    ibox(f, M.glass, 0, 0, 0.051, (p.w || 0.16) * 0.8, 0.06, 0.005);
    ibox(f, M.leather, 0, 0.09, -0.02, (p.w || 0.16) * 0.9, 0.04, 0.05);
  },

  extinguisher(g, M, p) {
    icyl(g, M.red, p.at[0], p.at[1], p.at[2], 0.06, 0.38);
    icyl(g, M.dark, p.at[0], p.at[1] + 0.22, p.at[2], 0.03, 0.06);
    ibox(g, M.dark, p.at[0], p.at[1], p.at[2] + (p.back || -0.07), 0.1, 0.03, 0.02);
  },
  firstaid(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.white, 0, 0, 0, 0.26, 0.18, 0.1);
    ibox(f, M.red, 0, 0, 0.051, 0.1, 0.03, 0.005);
    ibox(f, M.red, 0, 0, 0.051, 0.03, 0.1, 0.005);
  },
  watercan(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.olive, 0, 0, 0, 0.12, 0.34, 0.26);
    icyl(f, M.dark, 0, 0.19, 0.07, 0.025, 0.05);
  },
  mapcase(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.leather, 0, 0, 0, 0.32, 0.24, 0.04);
    ibox(f, M.white, 0, 0.13, 0, 0.28, 0.04, 0.02);
  },
  // spent case catcher bag under a breech / MG
  casebag(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.canvas, 0, 0, 0, p.w || 0.35, p.h || 0.3, p.d || 0.4, 0, 0, 0, U.sph);
  },
  // electric fan in a round housing
  fan(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    icyl(f, M.gear, 0, 0, 0, p.r || 0.12, 0.08, PI / 2, 0, 0);
    for (let i = 0; i < 4; i++) ibox(f, M.dark, 0, 0, 0.045, (p.r || 0.12) * 1.6, 0.02, 0.005, 0, 0, i * PI / 4);
  },
  // instrument / control panel; screens: modern displays
  panel(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    const w = p.w || 0.4, h = p.h || 0.25;
    ibox(f, M.dark, 0, 0, 0, w, h, 0.06);
    const n = p.dials ?? 3;
    for (let i = 0; i < n; i++) ibox(f, M.dial, -w * 0.35 + i * w * 0.7 / Math.max(1, n - 1), h * 0.2, 0.032, 0.035, 0.012, 0.035, PI / 2, 0, 0, U.cyl);
    for (let i = 0; i < (p.switches ?? 5); i++) ibox(f, M.steel, -w * 0.38 + i * 0.05, -h * 0.25, 0.035, 0.012, 0.03, 0.012);
    if (p.screens) for (let i = 0; i < p.screens; i++) {
      ibox(f, M.screenDark, w * 0.25 - i * 0.2, -h * 0.02, 0.035, 0.16, 0.12, 0.01);
      ibox(f, M.screen, w * 0.25 - i * 0.2, -h * 0.02, 0.042, 0.13, 0.09, 0.004);
    }
    if (p.lamps !== false) ibox(f, M.red, w * 0.4, h * 0.3, 0.034, 0.02, 0.02, 0.01);
  },
  // separate display / sight monitor (modern)
  display(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.screenDark, 0, 0, 0, p.w || 0.22, p.h || 0.17, 0.06);
    ibox(f, M.screen, 0, 0, 0.032, (p.w || 0.22) * 0.8, (p.h || 0.17) * 0.75, 0.004);
    for (let i = 0; i < 4; i++) ibox(f, M.steel, -(p.w || 0.22) * 0.3 + i * 0.045, -(p.h || 0.17) * 0.42, 0.03, 0.02, 0.012, 0.012);
  },
  // piping / cable runs through the given points
  pipe(g, M, p) {
    const mat = p.mat === 'cable' ? M.cable : p.mat === 'brass' ? M.brass : M.dark;
    for (let i = 0; i < p.pts.length - 1; i++) rod(g, mat, p.pts[i], p.pts[i + 1], p.r || 0.02);
  },
  // propeller shaft tunnel along the floor (engine at the rear, gearbox in front)
  shaft(g, M, p, I) {
    const [z0, z1] = p.z;
    ibox(g, M.gear, p.x || 0, I.floor + (p.h || 0.18) / 2, (z0 + z1) / 2, p.w || 0.26, p.h || 0.18, z1 - z0);
    ibox(g, M.dark, p.x || 0, I.floor + (p.h || 0.18) + 0.005, (z0 + z1) / 2, (p.w || 0.26) * 0.6, 0.01, z1 - z0);
  },
  // front gearbox / final drive housing (front-transmission tanks)
  gearbox(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    const w = p.w || 1.0, h = p.h || 0.45, d = p.d || 0.5;
    ibox(f, M.gear, 0, 0, 0, w, h, d);
    icyl(f, M.gear, 0, 0.02, -d / 2, h * 0.45, 0.12, PI / 2, 0, 0);
    for (const sx of [-1, 1]) {
      icyl(f, M.dark, sx * (w / 2 + 0.06), 0, 0.05, h * 0.38, 0.12, 0, 0, PI / 2);   // final drives / brakes
      ibox(f, M.steel, sx * w * 0.3, h / 2 + 0.01, 0, 0.12, 0.02, 0.12);
    }
    for (let i = 0; i < 6; i++) ibox(f, M.dark, -w * 0.4 + i * w * 0.16, h / 2 + 0.015, -d * 0.35, 0.025, 0.02, 0.025, 0, 0, 0, U.cyl);
  },
  // batteries
  battery(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    for (const x of [-0.14, 0.14]) {
      ibox(f, M.black, x, 0, 0, 0.26, 0.22, 0.18);
      for (const dx of [-0.07, 0.07]) icyl(f, dx < 0 ? M.red : M.steel, x + dx, 0.12, 0, 0.018, 0.03);
    }
    rod(f, M.cable, [-0.07, 0.13, 0], [0.21, 0.13, 0], 0.01);
  },
  // escape hatch in the floor
  floorhatch(g, M, p, I) {
    icyl(g, M.gear, p.at[0], I.floor + 0.02, p.at[1], p.r || 0.25, 0.03);
    ibox(g, M.steel, p.at[0], I.floor + 0.05, p.at[1], 0.2, 0.03, 0.03);
  },
  // a hatch in the roof seen from inside (hinge + handle + latch)
  hatch(g, M, p) {
    icyl(g, M.gear, p.at[0], p.at[1], p.at[2], p.r || 0.28, 0.04);
    ibox(g, M.steel, p.at[0], p.at[1] - 0.05, p.at[2], (p.r || 0.28) * 1.2, 0.025, 0.025);
    ibox(g, M.red, p.at[0] + (p.r || 0.28) * 0.6, p.at[1] - 0.04, p.at[2], 0.04, 0.04, 0.04);
  },
  // an engine seen inside the crew compartment (WW1): guard rails around the part slot
  engineguard(g, M, p) {
    const [x0, z0, x1, z1] = p.rect, y = p.y;
    for (const [a, b] of [[[x0, y, z0], [x1, y, z0]], [[x1, y, z0], [x1, y, z1]], [[x1, y, z1], [x0, y, z1]], [[x0, y, z1], [x0, y, z0]]]) rod(g, M.brass, a, b, 0.018);
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) rod(g, M.dark, [x, p.floor, z], [x, y, z], 0.02);
  },
  // gun or MG ammunition box (small) / tool box / spare parts crate
  crate(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    const [w, h, d] = p.size || [0.3, 0.2, 0.2];
    ibox(f, p.mat === 'wood' ? M.wood : M.olive, 0, 0, 0, w, h, d);
    ibox(f, M.dark, 0, h / 2 + 0.01, 0, w * 0.4, 0.02, 0.04);
  },
  // rifle / SMG in a wall clip
  rifle(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.wood, 0, 0, -0.25, 0.04, 0.07, 0.45);
    rod(f, M.black, [0, 0.02, 0], [0, 0.02, 0.55], 0.012);
    ibox(f, M.dark, 0, 0, 0.1, 0.05, 0.05, 0.03);
    ibox(f, M.dark, 0, 0, -0.2, 0.05, 0.05, 0.03);
  },
  lamp(g, M, p) {
    ibox(g, M.dark, p.at[0], p.at[1] + 0.03, p.at[2], 0.14, 0.04, 0.1);
    ibox(g, M.lamp, p.at[0], p.at[1] - 0.01, p.at[2], 0.1, 0.04, 0.06);
  },

  // ---- turret-side equipment
  // gunner's station: sight eyepiece, elevation / traverse handwheels, firing trigger
  gunner(g, M, p) {
    const [ex, ey, ez] = p.eye;
    const f = frame(g, [ex, ey, ez]);
    const st = p.style || 'wheels';
    ibox(f, M.dark, 0, -0.02, 0.24, 0.1, 0.1, 0.36);                            // sight body
    ibox(f, M.leather, 0, 0.02, 0.07, 0.12, 0.06, 0.04);                         // brow pad
    ibox(f, M.black, 0, -0.02, 0.05, 0.04, 0.04, 0.04, PI / 2, 0, 0, U.cyl);
    if (st === 'grips') {                                                       // modern: power control handles
      ibox(f, M.dark, 0, -0.3, 0.25, 0.14, 0.14, 0.12);
      for (const x of [-0.12, 0.12]) ibox(f, M.black, x, -0.26, 0.24, 0.04, 0.14, 0.05, 0.3, 0, 0);
      ibox(f, M.screenDark, 0.2, -0.05, 0.3, 0.16, 0.12, 0.03);
      ibox(f, M.screen, 0.2, -0.05, 0.285, 0.12, 0.08, 0.005);
    } else if (st === 'shoulder') {                                             // early guns laid by a shoulder pad
      ibox(f, M.leather, -0.1, -0.2, 0.1, 0.1, 0.16, 0.1);
      ibox(f, M.dark, -0.1, -0.35, 0.18, 0.04, 0.14, 0.04);
    } else {
      itorus(f, M.dark, 0.14, -0.26, 0.18, 0.1, 0.015);                         // elevation wheel
      ibox(f, M.black, 0.24, -0.26, 0.18, 0.02, 0.02, 0.07);
      itorus(f, M.dark, -0.16, -0.32, 0.22, 0.09, 0.015, PI / 2, 0, 0);          // traverse wheel
      ibox(f, M.black, -0.16, -0.31, 0.12, 0.02, 0.06, 0.02);
      ibox(f, M.red, -0.1, -0.3, 0.2, 0.03, 0.12, 0.03, 0.4, 0, 0, U.cyl);      // trigger lever
    }
  },
  // commander's station: vision blocks rest + an override handle
  commander(g, M, p) {
    const [ex, ey, ez] = p.eye;
    const f = frame(g, [ex, ey, ez]);
    ibox(f, M.dark, 0, -0.28, 0.28, 0.25, 0.04, 0.04);
    if (p.style === 'modern') {
      ibox(f, M.screenDark, 0.18, -0.2, 0.25, 0.2, 0.15, 0.04);
      ibox(f, M.screen, 0.18, -0.2, 0.228, 0.16, 0.11, 0.005);
      ibox(f, M.black, -0.12, -0.35, 0.2, 0.04, 0.12, 0.05, 0.3, 0, 0);
    } else if (p.style !== 'none') {
      ibox(f, M.black, -0.12, -0.35, 0.22, 0.03, 0.1, 0.03, 0.3, 0, 0);
    }
  },
  // coaxial machine gun beside the breech
  coax(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.black, 0, 0, -0.25, 0.08, 0.1, 0.5);
    rod(f, M.dark, [0, 0.02, 0], [0, 0.02, 0.2], 0.02);
    ibox(f, M.olive, p.feed === 'left' ? 0.12 : -0.12, -0.04, -0.2, 0.14, 0.14, 0.18);   // ammo box
    ibox(f, M.brass, p.feed === 'left' ? 0.06 : -0.06, 0.02, -0.2, 0.06, 0.012, 0.05);
  },
  // bustle blast door (modern tanks store the ready rounds behind it)
  blastdoor(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    ibox(f, M.steel, 0, 0, 0, p.w || 0.9, p.h || 0.55, 0.04);
    ibox(f, M.dark, (p.w || 0.9) * 0.35, 0, 0.03, 0.05, 0.2, 0.04);
    ibox(f, M.red, 0, (p.h || 0.55) * 0.35, 0.025, 0.12, 0.04, 0.01);
  },
  // pistol port with a plug
  pistolport(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    icyl(f, M.dark, 0, 0, 0, 0.05, 0.08, PI / 2, 0, 0);
    ibox(f, M.steel, 0, 0, -0.05, 0.08, 0.02, 0.02);
  },
  // turret basket: floor disc hanging from the ring with guard rails (turret-local)
  basket(g, M, p) {
    const y = p.y, r = p.r;
    icyl(g, M.floor, 0, y, 0, r, 0.03);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2;
      rod(g, M.dark, [Math.sin(a) * r, y, Math.cos(a) * r], [Math.sin(a) * r, p.top ?? -0.05, Math.cos(a) * r], 0.015);
    }
    itorus(g, M.dark, 0, y + 0.35, 0, r, 0.012, PI / 2, 0, 0);
  },
  // ready rounds on the turret wall: style 'clips' (horizontal clips) or 'vertical'
  ready(g, M, p) {
    const f = frame(g, p.at, p.ry || 0);
    const n = p.n || 5, cal = p.cal || 0.05, len = p.len || 0.6;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * cal * 2.4;
      if (p.style === 'vertical') {
        icyl(f, M.brass, x, 0, 0, cal, len * 0.7);
        ibox(f, M.shellHead, x, len * 0.35 + len * 0.13, 0, cal * 0.85, len * 0.26, cal * 0.85, 0, 0, 0, U.cone);
      } else {
        icyl(f, M.brass, x, 0, -len * 0.1, cal, len * 0.75, PI / 2, 0, 0);
        ibox(f, M.shellHead, x, 0, len * 0.37, cal * 0.85, len * 0.25, cal * 0.85, PI / 2, 0, 0, U.cone);
      }
    }
    ibox(f, M.dark, 0, -cal * 1.3, 0, n * cal * 2.4 + 0.04, 0.02, 0.06);
    ibox(f, M.dark, 0, -cal * 1.3, p.style === 'vertical' ? 0 : len * 0.3, n * cal * 2.4 + 0.04, 0.02, 0.06);
  },
};

// ===================================================================== hull compartment (hull-local coordinates)
export function buildHullInterior(key, hv) {
  const H = DEFS[key].hull, I = H.interior;
  const M = themeMats(I.theme);
  const g = new THREE.Group();
  g.userData.interior = true;
  const x = I.x, f = I.floor, r = I.roof - 0.04, [z0, z1] = I.z;     // stay clear of the outer skin
  const ring = hv.ring, cab = I.cab;
  // cars and motorcycles: no compartment - the vehicle itself is around the seat
  if (I.shell === false) {
    if (I.props) for (const p of I.props) PROPS[p.type](g, M, p, I);
    return g;
  }
  // floor
  addPanel(g, panel(V(0, f, 0), AX, AZ, breaks(-x, x, 0.3), breaks(z0, z1, 0.3)), M.floor);
  for (let z = z0 + 0.3; z < z1 - 0.1; z += 0.6) ibox(g, M.dark, 0, f + 0.005, z, x * 1.8, 0.01, 0.04);   // floor plate seams
  // roof with the turret ring / cab openings
  const holeR = ring ? ring.r - 0.04 : 0;
  if (!I.open) addPanel(g, panel(V(0, r, 0), AX, AZ, breaks(-x, x, 0.05, cab ? [-cab.x, cab.x] : []),
    breaks(z0, z1, 0.05, cab ? cab.z : []), (u, v) => {
      if (ring && Math.hypot(u - ring.pos.x, v - ring.pos.z) < holeR) return false;
      if (cab && Math.abs(u) < cab.x && v > cab.z[0] && v < cab.z[1]) return false;
      return true;
    }), M.wall);
  if (ring) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(holeR, 0.05, 6, 40).rotateX(PI / 2), M.dark);
    rim.position.set(ring.pos.x, r - 0.03, ring.pos.z);
    g.add(rim);
    // ring gear teeth
    const teeth = new THREE.Mesh(new THREE.TorusGeometry(holeR - 0.06, 0.02, 4, 40).rotateX(PI / 2), M.steel);
    teeth.position.set(ring.pos.x, r - 0.07, ring.pos.z);
    g.add(teeth);
  }
  // side walls (with vision / MG ports) and their stiffeners
  const ss = I.sideSlits || [];
  for (const sx of [-1, 1]) {
    const zs = breaks(z0, z1, 0.3, ss.flatMap(s => s.z)), ys = breaks(f, r, 0.3, ss.flatMap(s => s.y));
    addPanel(g, panel(V(sx * x, 0, 0), AZ, AY, zs, ys, (u, v) => !ss.some(s => u > s.z[0] && u < s.z[1] && v > s.y[0] && v < s.y[1])), M.wall);
    if (!THEMES[I.theme]?.riveted) for (let z = z0 + 0.5; z < z1 - 0.2; z += 0.9) ibox(g, M.wall, sx * (x - 0.02), (f + r) / 2, z, 0.04, r - f, 0.05);
  }
  // front wall with the driver's vision slits
  const top = cab ? cab.top : r;
  const slits = I.slits || [];
  addPanel(g, panel(V(0, 0, z1), AX, AY, breaks(-x, x, 0.2, slits.flatMap(s => s.x)), breaks(f, top, 0.2, slits.flatMap(s => s.y)),
    (u, v) => {
      if (slits.some(s => inRect(u, v, s))) return false;
      if (cab && v > r && Math.abs(u) > cab.x) return false;
      return true;
    }), M.wall);
  // rear bulkhead (engine compartment behind it) unless the engine sits inside the compartment
  if (!I.engineInside) {
    addPanel(g, panel(V(0, 0, z0), AX, AY, breaks(-x, x, 0.4), breaks(f, r, 0.4)), M.fire);
    for (let i = 0; i < 5; i++) ibox(g, M.dark, 0, f + 0.2 + i * 0.16, z0 + 0.02, x * 1.4, 0.04, 0.02);
    ibox(g, M.dark, x * 0.55, f + 0.6, z0 + 0.03, 0.3, 0.3, 0.02);                      // inspection hatch
  } else {
    addPanel(g, panel(V(0, 0, z0), AX, AY, breaks(-x, x, 0.4), breaks(f, r, 0.4)), M.wall);
  }
  if (cab) {
    // raised cab: side walls, roof, platform
    for (const sx of [-1, 1]) addPanel(g, panel(V(sx * cab.x, 0, 0), AZ, AY, breaks(cab.z[0], cab.z[1], 0.3), breaks(r, cab.top, 0.2)), M.wall);
    addPanel(g, panel(V(0, 0, cab.z[0]), AX, AY, breaks(-cab.x, cab.x, 0.3), breaks(r, cab.top, 0.2)), M.wall);
    addPanel(g, panel(V(0, cab.top, 0), AX, AZ, breaks(-cab.x, cab.x, 0.3), breaks(cab.z[0], cab.z[1], 0.3)), M.wall);
    ibox(g, M.floor, 0, cab.floor - 0.05, (cab.z[0] + cab.z[1]) / 2 + 0.05, cab.x * 2, 0.1, cab.z[1] - cab.z[0] - 0.1);
    ibox(g, M.dark, 0, (f + cab.floor) / 2, cab.z[0] + 0.1, cab.x * 2, cab.floor - f, 0.04);
    for (let k = 0; k < 4; k++) ibox(g, M.dark, 0.6, f + 0.2 + k * 0.28, cab.z[0] - 0.12, 0.35, 0.04, 0.22);   // ladder
    PROPS.lamp(g, M, { at: [0, cab.top - 0.02, (cab.z[0] + cab.z[1]) / 2] });
  }
  // main ammunition stowage (from the gameplay data)
  if (I.ammo && !I.props?.some(p => p.type === 'rack' && p.main)) {
    const rh = Math.min(0.7, r - f - 0.45);
    PROPS.rack(g, M, { x: I.ammo.x, z: I.ammo.z, y0: f + 0.05, h: rh, cal: I.ammoCal || 0.05, style: I.ammoStyle || 'vertical' });
  }
  // crew seats & driver controls
  for (const [role, s] of Object.entries(H.seats)) {
    PROPS.seat(g, M, { at: s.pos, style: s.style || I.seatStyle, recline: s.recline });
    if (role === 'driver') PROPS.driver(g, M, { eye: s.eye, floor: f, style: I.controls, dash: I.dash, dials: I.dials });
  }
  // infantry seats of the personnel carriers
  for (const s of H.troops || []) PROPS.seat(g, M, { at: s.pos, ry: s.ry || 0, style: s.style || 'pan' });
  // tank-specific equipment
  if (I.props) for (const p of I.props) PROPS[p.type](g, M, p, I);
  else {
    // generic clutter for tanks without a prop list
    ibox(g, M.gear, -x + 0.18, f + 0.35, (z0 + z1) / 2 - 0.4, 0.3, 0.6, 0.8);
    PROPS.extinguisher(g, M, { at: [x - 0.1, f + 0.5, z0 + 0.35] });
  }
  if (!I.open) PROPS.lamp(g, M, { at: [0.3, r - 0.03, z0 + 0.4] });
  if (!ring && !I.open) PROPS.lamp(g, M, { at: [-0.3, r - 0.03, (z0 + z1) / 2] });
  return g;
}

// ===================================================================== turret compartment (turret-local coordinates)
// ceiling height of a turret interior at (x, z), used for the free-walk eye height
export function turretCeiling(key, x, z) {
  const t = DEFS[key].models.turretInterior;
  if (!t) return 0;
  if (t.dome) {
    const d = t.dome;
    const rn = Math.hypot(x / d.r, z / (d.r * d.sz));
    return rn >= 1 ? 0 : 0.05 + d.r * d.sy * Math.sqrt(1 - rn * rn);
  }
  return pointInPoly(x, z, t.poly) ? t.h : 0;
}

function cupolaInterior(g, M, c) {
  const wall = (y0, y1) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, y1 - y0, 20, 1, true), M.wall);
    m.position.set(c.x, (y0 + y1) / 2, c.z);
    g.add(m);
  };
  wall(c.y0, c.band[0]);
  wall(c.band[1], c.top);
  const n = c.blocks || 6;
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2 + 0.3;
    ibox(g, M.dark, c.x + Math.sin(a) * c.r, (c.band[0] + c.band[1]) / 2, c.z + Math.cos(a) * c.r, 0.05, c.band[1] - c.band[0], 0.05);
    ibox(g, M.glass, c.x + Math.sin(a + PI / n) * c.r * 0.98, c.band[0] + 0.012, c.z + Math.cos(a + PI / n) * c.r * 0.98, 0.1, 0.012, 0.03, 0, a + PI / n, 0);
  }
  const roof = new THREE.Mesh(U.disc, M.wall);
  roof.position.set(c.x, c.top, c.z);
  roof.scale.set(c.r, 1, c.r);
  roof.rotation.x = PI;
  g.add(roof);
  itorus(g, M.dark, c.x, c.band[0] - 0.02, c.z, c.r * 0.97, 0.03, PI / 2, 0, 0);   // vision band sill
  itorus(g, M.dark, c.x, c.y0, c.z, c.r * 0.97, 0.025, PI / 2, 0, 0);
  ibox(g, M.steel, c.x, c.top - 0.04, c.z, c.r * 1.3, 0.025, 0.03);            // hatch handle
}

// walls + roof of a polygonal turret (poly in the turret plane, height h, cupola hole)
function polyShell(g, M, t) {
  const poly = t.poly, h = t.h, c = t.cupola;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const dir = V(bx - ax, 0, bz - az);
    const len = dir.length();
    dir.normalize();
    addPanel(g, panel(V(ax, 0, az), dir, AY, breaks(0, len, 0.4), breaks(t.y0 ?? -0.02, h, 0.4)), M.wall);
  }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  // a cell stays if any corner is inside: overhang goes outside the walls instead of leaving gaps
  addPanel(g, panel(V(0, h, 0), AX, AZ, breaks(x0, x1, 0.05), breaks(z0, z1, 0.05),
    (u, v, ua, ub, va, vb) => (pointInPoly(ua, va, poly) || pointInPoly(ub, va, poly) || pointInPoly(ua, vb, poly) ||
      pointInPoly(ub, vb, poly)) && (!c || Math.hypot(u - c.x, v - c.z) > c.r)), M.wall);
  return { x0, x1, z0, z1 };
}

export function buildTurretInterior(key) {
  const D = DEFS[key], T = D.turret, t = D.models.turretInterior;
  const M = themeMats(t.theme || D.hull.interior.theme);
  const g = new THREE.Group();
  g.userData.interior = true;
  const c = t.cupola;
  let zb;
  if (t.dome) {
    const d = t.dome;
    const geo = new THREE.SphereGeometry(d.r, 36, 16, 0, PI * 2, 0, PI / 2).toNonIndexed();
    geo.scale(1.0, d.sy, d.sz);
    const p = geo.attributes.position, n = geo.attributes.normal;
    const keepPos = [], keepN = [];
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      if (c && Math.hypot(cx - c.x, cz - c.z) < c.r) continue;
      for (let k = 0; k < 3; k++) { keepPos.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k)); keepN.push(n.getX(i + k), n.getY(i + k), n.getZ(i + k)); }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(keepPos, 3));
    dg.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
    const m = addPanel(g, dg, M.wall);
    m.position.y = 0.05;
    zb = -d.r * d.sz;
  } else {
    zb = polyShell(g, M, t).z0;
  }
  if (c) cupolaInterior(g, M, c);
  // seats and crew stations
  for (const [role, s] of Object.entries(T.seats)) {
    PROPS.seat(g, M, { at: s.pos, style: s.style || t.seatStyle });
    if (role === 'gunner') PROPS.gunner(g, M, { eye: s.eye, style: t.gunnerStyle });
    else if (role === 'commander') PROPS.commander(g, M, { eye: s.eye, style: t.commanderStyle });
  }
  if (t.props) for (const p of t.props) PROPS[p.type](g, M, p, t);
  else {
    // generic bustle: radio and a few ready rounds
    PROPS.radio(g, M, { at: [0.4, 0.35, zb + 0.14], ry: 0, aerial: false });
    PROPS.ready(g, M, { at: [-0.5, 0.25, zb + 0.35], ry: PI / 2, n: 5 });
  }
  PROPS.lamp(g, M, { at: [0, (t.dome ? 0.8 : t.h) - 0.03, -0.4] });
  return g;
}

// the second (machine-gun) turret of twin-turret tanks, local to that turret
export function buildSecondTurretInterior(key) {
  const D = DEFS[key], t = D.models.turretInterior.second;
  const M = themeMats(D.hull.interior.theme);
  const g = new THREE.Group();
  g.userData.interior = true;
  polyShell(g, M, t);
  if (t.props) for (const p of t.props) PROPS[p.type](g, M, p, t);
  return g;
}
