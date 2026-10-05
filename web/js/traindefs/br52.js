// DR Baureihe 52 «Kriegslok» (1942): the German wartime 2-10-0, simplified for mass production - big Wagner smoke
// deflectors, a boxy cab with small windows, black with red wheels, the tub tender («Wannentender») on bogies.
import { C, box, cylZ } from './kit.js';
import { steamEngine, steamTender, steamCrew } from './steam.js';

const cab = { z0: -6.6, z1: -3.7, y0: 1.85, y1: 4.5, w: 3.05 };

export default {
  key: 'br52', name: 'BR 52 «Kriegslok»', year: 1942, kind: 'loco', type: 'steam', role: 'freight', country: 'Германия',
  len: 14.4, mass: 84, power: 1200, vmax: 22,
  pivots: [5.8, -2.4], ...steamCrew(cab), smoke: [0, 4.7, 5.9], whistle: 'low',
  build() {
    return steamEngine({
      L: 14.4, R: 0.7, drivers: [4.0, 2.4, 0.8, -0.8, -2.4], lead: [5.8], leadR: 0.45,
      boiler: { z0: -3.7, z1: 6.6, y: 2.95, rb: 0.85, smokebox: 1.6 }, chimney: { z: 5.9, top: 4.7, kind: 'stack', r: 0.27 },
      domes: [{ z: 2.6, r: 0.45, h: 0.32 }, { z: 1.0, r: 0.42, h: 0.3 }],
      cab, boards: 1.85, cyl: { z: 5.6, y: 1.05, r: 0.34, len: 1.15 }, col: { body: C.black, wheel: C.red, frame: C.red, cab: C.black },
      deflectors: { z0: 4.9, z1: 7.0, h: 2.25 },
      extras(g) { box(g, C.white, 0, 3.2, 6.68, 0.8, 0.2, 0.03); cylZ(g, C.black, 0, 3.6, 6.4, 0.12, 0.4); },
    });
  },
  tender: {
    len: 9.0, mass: 60, pivots: [2.6, -2.6],
    build() { return steamTender({ L: 9.0, bogies: [-2.6, 2.6], r: 0.47, body: { y0: 1.55, y1: 3.5, w: 3.0, tub: true }, col: { body: C.black, wheel: C.red } }); },
  },
};
