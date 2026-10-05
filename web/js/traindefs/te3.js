// ТЭ3 (1953): the Soviet two-section goods diesel - each section a carbody with a rounded cab nose on two three-axle
// bogies, dark green with the yellow bands; the sections run back to back (the second one turned round).
import { C, box } from './kit.js';
import { dieselEngine, dieselCrew } from './diesel.js';

const D = { L: 17.0, yf: 1.75, ye: 4.15, nose: 'round', cabLen: 2.4 };
const GREEN = 0x2b4a34, YELLOW = 0xd8b02c;

export default {
  key: 'te3', name: 'ТЭ3', year: 1953, kind: 'loco', type: 'diesel', role: 'freight', country: 'СССР', twin: true,
  len: 17.0, mass: 126, power: 1470, vmax: 27.8,
  pivots: [4.9, -4.9], ...dieselCrew(D), smoke: [0, 4.75, -2.0], whistle: 'horn',
  build() {
    return dieselEngine({
      L: 17.0, bogies: [4.9, -4.9], yf: D.yf, ye: D.ye, col: { body: GREEN, roof: 0x55595a, frame: C.iron },
      stripes: [{ y: 2.35, h: 0.12, col: YELLOW }, { y: 2.6, h: 0.12, col: YELLOW }],
      cabs: [{ dir: 1, len: D.cabLen, nose: 'round' }], grilles: [[-7.6, -5.2], [-1.0, 1.4]], fans: [-6.5, -4.8], exhaust: [-2.0, -1.3],
      extras(g) { box(g, YELLOW, 0, 1.95, 8.24, 1.6, 0.12, 0.03); },
    });
  },
};
