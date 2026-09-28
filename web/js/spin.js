// Road wheels that turn in the vertex shader: the wheels of a running gear are merged into one mesh (a draw call
// instead of one per wheel); every vertex carries the centre of its wheel (attribute `wheelC`) and turns about the
// X axis through it by the angle of a uniform shared by the whole tank (all road wheels turn alike).
import * as THREE from 'three/webgpu';
import { attribute, uniform, positionLocal, vec3, cos, sin } from 'three/tsl';

export function spinUniform() { return uniform(0); }

function spinPosition(u) {
  const c = attribute('wheelC', 'vec3');
  const p = positionLocal.sub(c);
  const cs = cos(u), sn = sin(u);
  return vec3(p.x, p.y.mul(cs).sub(p.z.mul(sn)), p.y.mul(sn).add(p.z.mul(cs))).add(c);
}

const COPY = ['color', 'roughness', 'metalness', 'map', 'vertexColors', 'emissive', 'emissiveIntensity', 'flatShading',
  'side', 'transparent', 'opacity'];

// a node material like `src` whose vertices turn with the uniform `u` (cached per source material on the mesh)
export function spinMaterial(src, u, cache = null) {
  if (cache && cache.has(src)) return cache.get(src);
  const m = new THREE.MeshStandardNodeMaterial();
  for (const k of COPY) {
    const v = src[k];
    if (v === undefined) continue;
    if (v && v.isColor) m[k].copy(v); else m[k] = v;
  }
  m.userData = { ...src.userData };
  m.positionNode = spinPosition(u);
  if (cache) cache.set(src, m);
  return m;
}
