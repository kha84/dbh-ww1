// Preußische G 8.1 (1913): the Prussian 0-8-0 superheated goods engine, built in thousands; tall capped chimney,
// a big steam dome, black with red frames and wheels, a three-axle tender.
import { C, box, cylY, cylZ } from './kit.js';
import { steamEngine, steamTender, steamCrew } from './steam.js';

const cab = { z0: -5.6, z1: -3.2, y0: 1.6, y1: 4.2, w: 2.95 };

export default {
  key: 'g8', name: 'Preußische G 8.1', year: 1913, kind: 'loco', type: 'steam', role: 'freight', country: 'Германия',
  len: 11.6, mass: 70, power: 880, vmax: 15,
  pivots: [2.7, -2.1], ...steamCrew(cab), smoke: [0, 4.75, 4.0], whistle: 'high',
  build() {
    return steamEngine({
      L: 11.6, R: 0.675, drivers: [2.7, 1.1, -0.5, -2.1],
      boiler: { z0: -3.2, z1: 4.65, y: 2.8, rb: 0.8, smokebox: 1.5 }, chimney: { z: 4.0, top: 4.75, kind: 'cap', r: 0.25 },
      domes: [{ z: 1.6, r: 0.46, h: 0.5 }, { z: 0.1, r: 0.34, h: 0.34 }],
      cab, boards: 1.7, cyl: { z: 4.0, y: 1.0, r: 0.33, len: 1.1 }, col: { body: C.black, wheel: C.red, frame: C.red, cab: C.black },
      extras(g) {
        cylZ(g, C.black, 0.62, 3.55, 3.7, 0.17, 0.9);                                        // feed-water pump
        box(g, C.white, 0, 1.5, 5.7, 0.9, 0.22, 0.03);                                       // number board
      },
    });
  },
  tender: {
    len: 7.0, mass: 38, pivots: [1.9, -1.9],
    build() { return steamTender({ L: 7.0, axles: [-1.9, 0, 1.9], r: 0.5, body: { y0: 1.5, y1: 3.25, w: 2.9 }, col: { body: C.black, wheel: C.red, frame: C.red } }); },
  },
};
