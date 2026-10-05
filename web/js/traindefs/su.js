// Су (1925): the Soviet 2-6-2 passenger engine (the «Сормовская усиленная»): tall 1850 mm drivers, a green boiler and
// cab with a red line, a four-axle bogie tender - the express engine of the twenties and thirties.
import { C, box, cylZ } from './kit.js';
import { steamEngine, steamTender, steamCrew } from './steam.js';

const cab = { z0: -6.4, z1: -3.9, y0: 1.95, y1: 4.65, w: 3.0 };
const GREEN = 0x2d4f37;

export default {
  key: 'su', name: 'Су', year: 1925, kind: 'loco', type: 'steam', role: 'passenger', country: 'СССР',
  len: 13.4, mass: 86, power: 1100, vmax: 31,
  pivots: [4.0, -3.2], ...steamCrew(cab), smoke: [0, 5.05, 5.0], whistle: 'high',
  build() {
    return steamEngine({
      L: 13.4, R: 0.925, drivers: [3.0, 1.0, -1.0], lead: [5.0], leadR: 0.45, trail: [-3.2], trailR: 0.55, spokes: 16,
      boiler: { z0: -3.9, z1: 5.7, y: 3.0, rb: 0.85, smokebox: 1.5 }, chimney: { z: 5.0, top: 5.05, kind: 'stack', r: 0.27 },
      domes: [{ z: 2.6, r: 0.42, h: 0.36, col: GREEN }, { z: 1.0, r: 0.36, h: 0.3, col: GREEN }],
      cab, boards: 2.0, frameTop: 1.6, cyl: { z: 4.9, y: 1.1, r: 0.33, len: 1.1 }, col: { body: C.black, boiler: GREEN, wheel: C.red, frame: C.red, cab: GREEN, band: C.red },
      extras(g) {
        for (const s of [-1, 1]) box(g, C.red, s * 1.51, 3.0, -5.15, 0.02, 0.06, 2.4);
        cylZ(g, C.red, 0, 3.0, 5.79, 0.32, 0.04);
      },
    });
  },
  tender: {
    len: 8.6, mass: 60, pivots: [2.6, -2.6],
    build() { return steamTender({ L: 8.6, bogies: [-2.6, 2.6], r: 0.47, body: { y0: 1.55, y1: 3.45, w: 2.95 }, col: { body: 0x2d4f37, wheel: C.red, trim: C.red } }); },
  },
};
