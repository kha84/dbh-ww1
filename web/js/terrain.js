// Terrain: procedural heightmap (hills, plains, river, mountains) + forest
import * as THREE from 'three';

export const WATER_LEVEL = 2.0;

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.SIZE = 800;
    this.SEG = 180;   // 181*181 = 32761 verts < 65536 -> Uint16 indices (safer)
    this.WATER_LEVEL = WATER_LEVEL;
    this.trees = [];   // {x, z, r} collision circles
    this.rivers = [];
  }

  makeNoise(seed) {
    const perm = new Uint8Array(512);
    let s = seed;
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
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = fade(xf), v = fade(yf);
      const A = perm[X] + Y, B = perm[X + 1] + Y;
      return lerp(
        lerp(grad(perm[A], xf, yf), grad(perm[B], xf - 1, yf), u),
        lerp(grad(perm[A + 1], xf, yf - 1), grad(perm[B + 1], xf - 1, yf - 1), u),
        v
      );
    };
  }

  fbm(noise, x, y, oct) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * noise(x * f, y * f);
      norm += a;
      a *= 0.5; f *= 2.0;
    }
    return sum / norm;
  }

  distToSeg(px, pz, a, b) {
    const dx = b.x - a.x, dz = b.y - a.y;
    const len2 = dx * dx + dz * dz;
    let t = ((px - a.x) * dx + (pz - a.y) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * dx, cz = a.y + t * dz;
    return Math.hypot(px - cx, pz - cz);
  }

  generate(seed = 1337) {
    const S = this.SIZE, SEG = this.SEG;

    // river center polylines (world coords)
    const riverDefs = [
      [[-1.0, 0.30], [0.10, 0.36], [0.30, 0.24], [0.55, 0.40], [1.0, 0.48]],
      [[0.38, -1.0], [0.40, -0.35], [0.46, 0.05], [0.60, 0.50], [0.66, 1.0]],
    ];
    this.rivers = riverDefs.map(pl =>
      pl.map(([u, v]) => new THREE.Vector2((u - 0.5) * S, (v - 0.5) * S))
    );
    const riverWidth = 26;
    const riverDist = (x, z) => {
      let d = 1e9;
      for (const pl of this.rivers)
        for (let i = 0; i < pl.length - 1; i++)
          d = Math.min(d, this.distToSeg(x, z, pl[i], pl[i + 1]));
      return d;
    };

    // ---------- heightfield ----------
    const geo = new THREE.PlaneGeometry(S, S, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const count = pos.count;
    const W = SEG + 1;
    const heights = new Float32Array(count);

    const nBase = this.makeNoise(seed + 11);
    const nDetail = this.makeNoise(seed);
    const nMount = this.makeNoise(seed + 40);
    const nTree = this.makeNoise(seed + 77);

    for (let iz = 0; iz <= SEG; iz++) {
      for (let ix = 0; ix <= SEG; ix++) {
        const i = iz * W + ix;
        const x = pos.getX(i), z = pos.getZ(i);
        const nx = x / S, nz = z / S;

        // rolling hills (base +14 keeps most of the map above water)
        let h = 30.0 * this.fbm(nBase, nx * 2.2 + 100, nz * 2.2 + 100, 5) + 14.0;
        // medium bumps
        h += 18.0 * this.fbm(nDetail, nx * 7.0, nz * 7.0, 4);
        // small detail
        h += 4.0 * this.fbm(nDetail, nx * 18.0 + 7, nz * 18.0 + 7, 3);
        // flatten center plains
        const centerD = Math.sqrt(nx * nx + nz * nz);
        const plain = Math.exp(-centerD * centerD * 7);
        h *= (1 - 0.7 * plain);
        // mountains around the border
        const edge = Math.max(Math.abs(nx), Math.abs(nz));
        const mountain = smoothstep(0.60, 1.0, edge);
        h += mountain * (45 + 30 * this.fbm(nMount, nx * 5, nz * 5, 3));
        // riverbed — wider banks, shallower V
        const rd = riverDist(x, z);
        const rv = 1 - smoothstep(riverWidth * 0.15, riverWidth, rd);
        if (rv > 0) h = h * (1 - rv) + Math.min(h, WATER_LEVEL - 2.4) * rv;

        h = Math.max(h, WATER_LEVEL - 3.2);
        pos.setY(i, h);
        heights[i] = h;
      }
    }
    geo.computeVertexNormals();

    this.heights = heights;
    this.heightAt = (x, z) => {
      const u = (x / S + 0.5) * SEG;
      const v = (z / S + 0.5) * SEG;
      const ix = Math.min(SEG - 1, Math.max(0, Math.floor(u)));
      const iz = Math.min(SEG - 1, Math.max(0, Math.floor(v)));
      const fx = Math.min(1, Math.max(0, u - ix));
      const fz = Math.min(1, Math.max(0, v - iz));
      const h00 = heights[iz * W + ix];
      const h10 = heights[iz * W + ix + 1];
      const h01 = heights[(iz + 1) * W + ix];
      const h11 = heights[(iz + 1) * W + ix + 1];
      return (h00 * (1 - fx) + h10 * fx) * (1 - fz) +
             (h01 * (1 - fx) + h11 * fx) * fz;
    };

    this.slopeAt = (x, z) => {
      const d = 1.5;
      const hx = this.heightAt(x + d, z) - this.heightAt(x - d, z);
      const hz = this.heightAt(x, z + d) - this.heightAt(x, z - d);
      return Math.hypot(hx, hz) / (2 * d);
    };

    // ---------- vertex-colored material ----------
    const grassTex = new THREE.TextureLoader().load('assets/grass.jpg');
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(64, 64);
    grassTex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map: grassTex,
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0
    });

    const colors = new Float32Array(count * 3);
    const c = new THREE.Color();
    const grass = new THREE.Color(0x7aa653);
    const grassDark = new THREE.Color(0x5c8040);
    const dirt = new THREE.Color(0x8a6f47);
    const rock = new THREE.Color(0x8d8d85);
    const snow = new THREE.Color(0xe9edee);
    const sand = new THREE.Color(0xc9bb8a);
    const nTint = this.makeNoise(seed + 200);

    for (let iz = 0; iz <= SEG; iz++) {
      for (let ix = 0; ix <= SEG; ix++) {
        const i = iz * W + ix;
        const h = heights[i];
        const x = pos.getX(i), z = pos.getZ(i);
        const slope = this.slopeAt(x, z);
        const tint = 0.92 + 0.16 * (this.fbm(nTint, x * 0.02, z * 0.02, 2) * 0.5 + 0.5);

        if (h < WATER_LEVEL + 0.5) c.copy(sand);
        else if (h < 5) c.lerpColors(sand, grassDark, (h - WATER_LEVEL - 0.5) / 2.5);
        else if (h < 16) c.lerpColors(grassDark, grass, (h - 5) / 11);
        else if (h < 26) c.lerpColors(grass, rock, (h - 16) / 10);
        else c.lerpColors(rock, snow, Math.min(1, (h - 26) / 12));

        if (slope > 0.6 && h > WATER_LEVEL + 0.6) c.lerp(rock, Math.min(1, (slope - 0.6) * 2.2));
        if (riverDist(x, z) < riverWidth + 2 && h < WATER_LEVEL + 1.2) c.lerp(dirt, 0.5);

        c.multiplyScalar(tint);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this.mesh = terrain;
    this.riverDist = riverDist;
    this.riverWidth = riverWidth;

    // ---------- water: trimmed mesh only over actual water areas ----------
    // (like the original Python engine: no giant plane under the terrain)
    const sub = 2;                 // sub-quads per terrain cell (~2.2 m)
    const cell = S / SEG;
    const subSize = cell / sub;
    const wPos = [];
    const wIdx = [];
    const wUv = [];
    const hAt = (lx, lz) => {     // local bilinear height inside heights grid
      const gx = (lx / S + 0.5) * SEG;
      const gz = (lz / S + 0.5) * SEG;
      const ix0 = Math.min(SEG - 1, Math.max(0, Math.floor(gx)));
      const iz0 = Math.min(SEG - 1, Math.max(0, Math.floor(gz)));
      const fx = Math.min(1, Math.max(0, gx - ix0));
      const fz = Math.min(1, Math.max(0, gz - iz0));
      const h00 = heights[iz0 * W + ix0];
      const h10 = heights[iz0 * W + ix0 + 1];
      const h01 = heights[(iz0 + 1) * W + ix0];
      const h11 = heights[(iz0 + 1) * W + ix0 + 1];
      return (h00 * (1 - fx) + h10 * fx) * (1 - fz) +
             (h01 * (1 - fx) + h11 * fx) * fz;
    };
    for (let iz = 0; iz < SEG; iz++) {
      for (let ix = 0; ix < SEG; ix++) {
        const x0 = -S / 2 + ix * cell;
        const z0 = -S / 2 + iz * cell;
        // quick reject: cell fully above water
        if (Math.min(heights[iz * W + ix], heights[iz * W + ix + 1],
                     heights[(iz + 1) * W + ix], heights[(iz + 1) * W + ix + 1]) > WATER_LEVEL) continue;
        for (let sz = 0; sz < sub; sz++) {
          for (let sx = 0; sx < sub; sx++) {
            const lx0 = x0 + sx * subSize;
            const lz0 = z0 + sz * subSize;
            const lx1 = lx0 + subSize;
            const lz1 = lz0 + subSize;
            // keep sub-quad only if its highest corner is below the waterline
            const hh = Math.max(hAt(lx0, lz0), hAt(lx1, lz0), hAt(lx0, lz1), hAt(lx1, lz1));
            if (hh > WATER_LEVEL) continue;
            const base = wPos.length / 3;
            wPos.push(lx0, 0, lz0, lx1, 0, lz0, lx1, 0, lz1, lx0, 0, lz1);
            wUv.push(0, 0, 1, 0, 1, 1, 0, 1);
            wIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
          }
        }
      }
    }
    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wUv, 2));
    waterGeo.setIndex(wIdx);
    waterGeo.computeVertexNormals();
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3a708f, transparent: true, opacity: 0.85,
      roughness: 0.35, metalness: 0.1
    });
    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.position.y = WATER_LEVEL;
    this.water.receiveShadow = true;
    this.scene.add(this.water);

    // keep original water verts for gentle wave anim
    this.waterBase = this.water.geometry.attributes.position.array.slice();

    // ---------- forest ----------
    this.buildForest(nTree, 1000);
  }

  buildForest(nTree, maxTrees) {
    const S = this.SIZE;
    if (new URLSearchParams(location.search).get('notrees') === '1') return;
    const trunkGeo = new THREE.CylinderGeometry(0.20, 0.32, 2.8, 6);
    trunkGeo.translate(0, 1.4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4327, roughness: 1 });
    const coneGeo = new THREE.ConeGeometry(1.9, 5.0, 7);
    coneGeo.translate(0, 4.9, 0);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x2e5c2e, roughness: 1 });
    const cone2Geo = new THREE.ConeGeometry(1.35, 3.4, 7);
    cone2Geo.translate(0, 7.5, 0);
    const cone2Mat = new THREE.MeshStandardMaterial({ color: 0x376b37, roughness: 1 });

    const trunkI = new THREE.InstancedMesh(trunkGeo, trunkMat, maxTrees);
    const coneI = new THREE.InstancedMesh(coneGeo, coneMat, maxTrees);
    const cone2I = new THREE.InstancedMesh(cone2Geo, cone2Mat, maxTrees);
    trunkI.castShadow = coneI.castShadow = cone2I.castShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const posv = new THREE.Vector3();
    let n = 0;

    for (let t = 0; t < maxTrees * 8 && n < maxTrees; t++) {
      const x = (Math.random() - 0.5) * (S - 70);
      const z = (Math.random() - 0.5) * (S - 70);
      const h = this.heightAt(x, z);
      if (h < WATER_LEVEL + 1.2 || h > 17) continue;
      if (this.riverDist(x, z) < this.riverWidth + 6) continue;
      if (this.slopeAt(x, z) > 0.7) continue;
      // keep spawn area clear
      if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
      // forest clusters
      const density = this.fbm(nTree, x * 0.006, z * 0.006, 3) * 0.5 + 0.5;
      if (Math.random() > density * density * 1.6) continue;

      const s = 0.75 + Math.random() * 0.95;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
      sc.set(s, s * (0.85 + Math.random() * 0.5), s);
      posv.set(x, h - 0.25, z);
      m.compose(posv, q, sc);
      trunkI.setMatrixAt(n, m);
      coneI.setMatrixAt(n, m);
      cone2I.setMatrixAt(n, m);
      this.trees.push({ x, z, r: 0.38 * s });
      n++;
    }
    trunkI.count = coneI.count = cone2I.count = n;
    this.scene.add(trunkI, coneI, cone2I);
  }

  update(t) {
    // gentle water waves (small amplitude so crests don't flood flat shores)
    const p = this.water.geometry.attributes.position;
    const base = this.waterBase;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      p.setY(i, Math.sin(x * 0.05 + t * 1.2) * 0.05 + Math.cos(z * 0.04 + t * 0.9) * 0.05);
    }
    p.needsUpdate = true;
    this.water.geometry.computeVertexNormals();
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}