// ФД «Феликс Дзержинский» (1931): the Soviet 2-10-2 heavy goods engine - a huge boiler, five coupled axles, the
// feed-water heater across the smokebox, the red star on its door, a six-axle tender on two three-axle bogies.
import { C, box, cylX, cylZ } from './kit.js';
import { steamEngine, steamTender, steamCrew } from './steam.js';

const cab = { z0: -7.6, z1: -4.6, y0: 2.0, y1: 4.8, w: 3.1 };

export default {
  key: 'fd', name: 'ФД', year: 1931, kind: 'loco', type: 'steam', role: 'freight', country: 'СССР',
  len: 16.0, mass: 133, power: 2200, vmax: 23.6,
  pivots: [6.6, -3.6], ...steamCrew(cab), smoke: [0, 5.15, 6.7], whistle: 'low',
  build() {
    return steamEngine({
      L: 16.0, R: 0.75, drivers: [4.8, 3.2, 1.6, 0.0, -1.6], lead: [6.6], leadR: 0.45, trail: [-3.6], trailR: 0.6,
      boiler: { z0: -4.6, z1: 7.5, y: 3.15, rb: 1.0, smokebox: 1.8 }, chimney: { z: 6.6, top: 5.15, kind: 'short', r: 0.3 },
      domes: [{ z: 3.8, r: 0.5, h: 0.22 }, { z: 1.8, r: 0.42, h: 0.2 }],
      cab, boards: 2.05, frameTop: 1.6, cyl: { z: 6.4, y: 1.15, r: 0.36, len: 1.2, x: 1.15 }, col: { body: C.black, wheel: C.red, frame: C.red, cab: C.black },
      extras(g) {
        cylX(g, C.black, 0, 4.35, 7.0, 0.22, 2.1);                                            // feed-water heater
        cylZ(g, C.red, 0, 3.15, 7.58, 0.3, 0.04);                                              // the star
        box(g, C.red, 0, 1.12, 7.88, 2.95, 0.42, 0.06);
      },
    });
  },
  tender: {
    len: 10.6, mass: 90, pivots: [3.3, -3.3],
    build() { return steamTender({ L: 10.6, bogies: [-3.3, 3.3], axlesPer: 3, r: 0.45, body: { y0: 1.6, y1: 3.65, w: 3.05 }, col: { body: C.black, wheel: C.black } }); },
  },
};
