// ТЭП70 (1973): the Soviet passenger diesel - a long body with sloped streamlined cab fronts at both ends, red with the
// light grey band and white lines, three-axle bogies; fast (160 km/h).
import { C, box } from './kit.js';
import { dieselEngine, dieselCrew } from './diesel.js';

const D = { L: 21.7, yf: 1.75, ye: 4.25, nose: 'slope', cabLen: 2.6 };
const RED = 0xa8322a, GREY = 0xb9b6ae;

export default {
  key: 'tep70', name: 'ТЭП70', year: 1973, kind: 'loco', type: 'diesel', role: 'passenger', country: 'СССР',
  len: 21.7, mass: 129, power: 2940, vmax: 44,
  pivots: [6.0, -6.0], ...dieselCrew(D), smoke: [0, 4.85, -1.0], whistle: 'horn',
  build() {
    return dieselEngine({
      L: 21.7, bogies: [6.0, -6.0], yf: D.yf, ye: D.ye, col: { body: RED, roof: 0x6a6a66, frame: 0x3a3a3a, beam: 0x3a3a3a },
      stripes: [{ y: 2.4, h: 0.55, col: GREY }, { y: 2.1, h: 0.05, col: C.white }, { y: 2.73, h: 0.05, col: C.white }],
      cabs: [{ dir: 1, len: D.cabLen, nose: 'slope' }, { dir: -1, len: D.cabLen, nose: 'slope' }],
      grilles: [[-5.5, -2.5], [2.0, 5.0]], fans: [-4.0, -2.8, 3.2], exhaust: [-1.0, -0.3],
      extras(g) { for (const s of [-1, 1]) box(g, C.white, s * 1.58, 3.6, 0, 0.02, 0.35, 3.0); },
    });
  },
};
