// П36 «Генерал» (1950): the last Soviet express steam engine, a 2-8-4 in a streamlined casing - green with a cream
// band, red wheels with white tyres, the smoke deflectors grown into the casing, a streamlined four-axle tender.
import { PI, C, GEO, box, put, cylZ } from './kit.js';
import { steamEngine, steamTender, steamCrew } from './steam.js';

const cab = { z0: -7.9, z1: -5.0, y0: 2.05, y1: 4.85, w: 3.1 };
const GREEN = 0x2f5a3a, CREAM = 0xd8c89a;

export default {
  key: 'p36', name: 'П36 «Генерал»', year: 1950, kind: 'loco', type: 'steam', role: 'passenger', country: 'СССР',
  len: 16.6, mass: 133, power: 1850, vmax: 34.7,
  pivots: [6.1, -4.8], ...steamCrew(cab), smoke: [0, 5.0, 6.6], whistle: 'high',
  build() {
    return steamEngine({
      L: 16.6, R: 0.925, drivers: [3.8, 1.8, -0.2, -2.2], lead: [6.8, 5.4], leadR: 0.45, trail: [-4.3, -5.5], trailR: 0.55, spokes: 16,
      boiler: { z0: -5.0, z1: 7.6, y: 3.1, rb: 0.92, smokebox: 1.6 }, chimney: { z: 6.6, top: 4.95, kind: 'short', r: 0.3 },
      domes: [], cab, boards: 2.05, frameTop: 1.6, cyl: { z: 6.1, y: 1.15, r: 0.35, len: 1.2, x: 1.12 },
      col: { body: GREEN, boiler: GREEN, wheel: C.red, frame: C.red, cab: GREEN, band: GREEN },
      deflectors: { z0: 5.9, z1: 7.9, h: 1.7 },
      extras(g) {
        // the casing over the boiler, the skirts and the cream band
        put(g, GEO.arch, GREEN, 0, 3.1, 1.3, 1.06, 1.15, 12.6);
        for (const s of [-1, 1]) {
          box(g, GREEN, s * 1.06, 2.55, 1.3, 0.06, 1.1, 12.6);
          box(g, CREAM, s * 1.1, 3.05, 1.3, 0.03, 0.16, 12.6);
          box(g, CREAM, s * 1.56, 3.05, -6.45, 0.03, 0.16, 2.9);
          box(g, CREAM, s * 1.42, 1.95, 1.3, 0.03, 0.1, 13.0);
        }
        cylZ(g, CREAM, 0, 3.1, 7.62, 0.5, 0.04);
        put(g, GEO.hemi, GREEN, 0, 3.1, 7.4, 1.0, 1.0, 0.4, PI / 2);
      },
    });
  },
  tender: {
    len: 10.0, mass: 90, pivots: [3.1, -3.1],
    build() {
      return steamTender({ L: 10.0, bogies: [-3.1, 3.1], r: 0.47, body: { y0: 1.6, y1: 3.75, w: 3.05 }, col: { body: GREEN, wheel: C.red, trim: GREEN },
        extras(g) { for (const s of [-1, 1]) box(g, CREAM, s * 1.54, 3.05, -0.1, 0.03, 0.16, 9.1); } });
    },
  },
};
