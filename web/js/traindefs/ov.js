// Ов «Овечка» (1901): the Russian 0-8-0 goods engine of the Imperial railways - small, slow, everywhere; a tall
// flared chimney, a green boiler with brass bands, a three-axle tender.
import { PI, C, box, cylZ, cylY } from './kit.js';
import { steamEngine, steamTender, steamCrew } from './steam.js';

const cab = { z0: -5.3, z1: -3.0, y0: 1.55, y1: 3.95, w: 2.9 };
const col = { body: C.black, boiler: 0x2f4a32, wheel: C.red, frame: C.red, band: C.brass, cab: 0x2f4a32 };

export default {
  key: 'ov', name: 'Ов «Овечка»', year: 1901, kind: 'loco', type: 'steam', role: 'freight', country: 'Россия',
  len: 11.0, mass: 54, power: 600, vmax: 15,
  pivots: [2.6, -1.7], ...steamCrew(cab), smoke: [0, 4.45, 3.75], whistle: 'high',
  build() {
    return steamEngine({
      L: 11.0, R: 0.6, drivers: [2.6, 1.17, -0.27, -1.7],
      boiler: { z0: -3.0, z1: 4.4, y: 2.45, rb: 0.72, smokebox: 1.3 }, chimney: { z: 3.75, top: 4.45, kind: 'funnel', r: 0.24 },
      domes: [{ z: 1.2, r: 0.38, h: 0.42, col: C.brass }, { z: -0.6, r: 0.3, h: 0.3 }],
      cab, boards: 1.6, frameTop: 1.35, cyl: { z: 3.75, y: 0.95, r: 0.3, len: 1.0 }, col,
      lamps: [[0.85, 1.45, 5.4], [-0.85, 1.45, 5.4]],
      extras(g) {
        cylZ(g, C.brass, 0, 2.45, 4.47, 0.2, 0.04, { m: 0.8, r: 0.3 });                         // number plate
        for (const s of [-1, 1]) cylZ(g, C.glass, s * 0.95, 3.35, -5.25, 0.18, 0.04, { r: 0.2, m: 0.4 });
      },
    });
  },
  tender: {
    len: 6.6, mass: 30, pivots: [1.8, -1.8],
    build() { return steamTender({ L: 6.6, axles: [-1.8, 0, 1.8], r: 0.52, body: { y0: 1.45, y1: 3.05, w: 2.8 }, col: { body: 0x2f4a32, wheel: C.red, frame: C.black } }); },
  },
};
