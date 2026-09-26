// Shared deterministic noise / random helpers

export function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = (seed | 0) % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => {
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  };
  return (x, y) => {
    const fx = Math.floor(x), fy = Math.floor(y);
    const X = fx & 255, Y = fy & 255;
    const xf = x - fx, yf = y - fy;
    const u = fade(xf), v = fade(yf);
    const A = perm[X] + Y, B = perm[X + 1] + Y;
    return lerp(
      lerp(grad(perm[A], xf, yf), grad(perm[B], xf - 1, yf), u),
      lerp(grad(perm[A + 1], xf, yf - 1), grad(perm[B + 1], xf - 1, yf - 1), u),
      v
    );
  };
}

export function fbm(noise, x, y, oct) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * noise(x * f, y * f);
    norm += a;
    a *= 0.5; f *= 2.0;
  }
  return sum / norm;
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// integer hash -> [0,1)
export function hash(...ints) {
  let h = 2166136261 >>> 0;
  for (const n of ints) {
    h ^= (n | 0);
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

// seeded PRNG (mulberry32)
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const r = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}
