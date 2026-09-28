// Selective bloom: materials with this MRT node write 1 into the `bloom` target of the scene pass (render.js),
// everything else 0 - only they glow (fire, flashes, sparks, tracers), not the bright sky.
import { mrt, float } from 'three/tsl';

export const GLOW = mrt({ bloom: float(1) });

// mark a material as glowing; returns it
export function glowing(mat) { mat.mrtNode = GLOW; return mat; }
