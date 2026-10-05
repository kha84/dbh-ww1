// Shared pieces of the cars (traindefs/<car>.js): the underframe with its running gear and the buffers, stakes.
import { C, box, wheelset, bogie, buffers, WX } from './kit.js';

// underframe from -L/2 to L/2 at floor height yf: axles [z] (two-axle cars, wheel radius r) or bogies [z]
export function underframe(g, o) {
  const { L, yf } = o, r = o.r ?? 0.47;
  if (o.bogies) for (const z of o.bogies) bogie(g, z, { r, col: o.gear ?? C.iron });
  else for (const z of o.axles) {
    wheelset(g, z, r, { col: C.iron });
    for (const s of [-1, 1]) {                                                    // leaf springs and axle guards
      box(g, C.iron, s * (WX + 0.22), r + 0.32, z, 0.12, 0.1, 1.4);
      box(g, C.iron, s * (WX + 0.22), r + 0.12, z, 0.16, 0.5, 0.5);
    }
  }
  for (const s of [-1, 1]) box(g, o.frame ?? C.iron, s * 0.95, yf - 0.32, 0, 0.14, 0.32, L - 0.2);   // sole bars
  box(g, o.frame ?? C.iron, 0, yf - 0.32, 0, 0.3, 0.26, L - 0.4);
  for (const d of [-1, 1]) buffers(g, d * L / 2, d, { beam: o.beam ?? C.iron, auto: o.auto });
  if (o.bogies) for (const s of [-1, 1]) box(g, C.iron, s * 0.6, yf - 0.85, 0, 0.3, 0.5, 1.6);     // brake cylinder / battery box
}
