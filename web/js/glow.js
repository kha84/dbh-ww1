// Selective bloom: glowing materials write 1 into the `bloom` target of the scene pass (render.js), everything
// else 0 - only they glow (fire, flashes, sparks, tracers, stars), not the bright sky. The MRT node is set only
// while the post-processing has that target (a material with an MRT node and no MRT to write to breaks the shader).
import { mrt, float } from 'three/tsl';

const GLOW = mrt({ bloom: float(1) });
const MATS = new Set();
let on = false;

// mark a material as glowing; returns it
export function glowing(mat) {
  MATS.add(mat);
  mat.mrtNode = on ? GLOW : null;
  return mat;
}

// the post-processing turned the bloom target on / off
export function setGlow(enabled) {
  if (enabled === on) return;
  on = enabled;
  for (const m of MATS) { m.mrtNode = on ? GLOW : null; m.needsUpdate = true; }
}
