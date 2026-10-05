// Эу (1912): the Russian 0-10-0 «Э» goods engine (the «у» - strengthened), the most numerous steam engine of the
// country; five coupled axles, a black boiler, red wheels, a four-axle tender on bogies.
import { C, box, cylZ } from './kit.js';
import { steamEngine, steamTender, steamCrew } from './steam.js';

const cab = { z0: -5.9, z1: -3.3, y0: 1.65, y1: 4.25, w: 3.0 };

export default {
  key: 'eu', name: 'Эу', year: 1912, kind: 'loco', type: 'steam', role: 'freight', country: 'Россия',
  len: 12.3, mass: 81, power: 900, vmax: 15.3,
  pivots: [3.3, -2.3], ...steamCrew(cab), smoke: [0, 4.95, 4.25], whistle: 'low',
  build() {
    return steamEngine({
      L: 12.3, R: 0.66, drivers: [3.3, 1.9, 0.5, -0.9, -2.3],
      boiler: { z0: -3.3, z1: 5.0, y: 2.85, rb: 0.84, smokebox: 1.45 }, chimney: { z: 4.25, top: 4.95, kind: 'stack', r: 0.26 },
      domes: [{ z: 2.3, r: 0.42, h: 0.4 }, { z: 0.6, r: 0.36, h: 0.32 }],
      cab, boards: 1.75, cyl: { z: 4.4, y: 1.0, r: 0.34, len: 1.1 }, col: { body: C.black, wheel: C.red, frame: C.red, cab: C.black },
      extras(g) { box(g, C.buffer, 0, 1.05, 5.88, 2.95, 0.44, 0.06); },
    });
  },
  tender: {
    len: 8.2, mass: 50, pivots: [2.45, -2.45],
    build() { return steamTender({ L: 8.2, bogies: [-2.45, 2.45], r: 0.47, body: { y0: 1.5, y1: 3.3, w: 2.95 }, col: { body: C.black, wheel: C.black } }); },
  },
};
