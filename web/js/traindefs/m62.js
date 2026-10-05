// М62 (1965): the export / goods diesel of the socialist countries - a boxy body with flat cab fronts at both ends,
// two windscreens and a headlight over them, green with a yellow band, three-axle bogies.
import { C, box } from './kit.js';
import { dieselEngine, dieselCrew } from './diesel.js';

const D = { L: 17.55, yf: 1.7, ye: 4.05, nose: 'flat', cabLen: 2.5 };
const GREEN = 0x2f5a3c, YELLOW = 0xd9b43a;

export default {
  key: 'm62', name: 'М62', year: 1965, kind: 'loco', type: 'diesel', role: 'freight', country: 'СССР',
  len: 17.55, mass: 116, power: 1470, vmax: 27.8,
  pivots: [4.3, -4.3], ...dieselCrew(D), smoke: [0, 4.6, -0.6], whistle: 'horn',
  build() {
    return dieselEngine({
      L: 17.55, bogies: [4.3, -4.3], yf: D.yf, ye: D.ye, col: { body: GREEN, roof: 0x5d6160, frame: C.iron, beam: C.buffer },
      stripes: [{ y: 2.15, h: 0.22, col: YELLOW }, { y: 2.42, h: 0.05, col: C.buffer }],
      cabs: [{ dir: 1, len: D.cabLen, nose: 'flat' }, { dir: -1, len: D.cabLen, nose: 'flat' }],
      grilles: [[-4.6, -2.2], [1.8, 4.2]], fans: [-3.4], exhaust: [-0.6, 0.0],
      extras(g) { for (const d of [-1, 1]) box(g, C.white, 0, 3.15, d * 8.55, 0.7, 0.18, 0.03); },
    });
  },
};
