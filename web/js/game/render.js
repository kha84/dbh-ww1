// Rendering: WebGPURenderer (WebGPU where the browser has it, WebGL 2 otherwise), scene, camera, sun / sky light,
// clouds. `three` is the WebGPU build of three.js (vite.config.js aliases it), so every module shares one copy.
//   ?backend=webgl  force the WebGL 2 backend      ?noshadows=1 ?nofog=1 ?noclouds=1 ?noaa=1 ?logdepth=1
import * as THREE from 'three/webgpu';

export const SKY = 0x9ec8e8;
export const BASE_FOV = 70;

/**
 * @param {URLSearchParams} dbg
 * @param {HTMLElement} app
 */
export function createRenderer(dbg, app) {
  const renderer = new THREE.WebGPURenderer({
    antialias: dbg.get('noaa') !== '1',
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: dbg.get('logdepth') === '1',
    forceWebGL: dbg.get('backend') === 'webgl',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = dbg.get('noshadows') !== '1';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);

  const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 1500);
  scene.add(camera);   // camera children (plate in hands) must render

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { renderer, scene, camera };
}

// which backend the renderer ended up on (after init)
export function backendName(renderer) {
  return renderer.backend && renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
}

/**
 * Sun, sky light, fog and clouds. `viewDist`: how far the terrain is drawn (fog ends there).
 * @param {THREE.Scene} scene
 * @param {URLSearchParams} dbg
 * @param {number} viewDist
 */
export function createSky(scene, dbg, viewDist) {
  if (dbg.get('nofog') !== '1') scene.fog = new THREE.Fog(SKY, viewDist * 0.3, viewDist * 0.95);

  const hemi = new THREE.HemisphereLight(0xbdd8f0, 0x5c6b4a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d9, 2.0);
  sun.castShadow = dbg.get('noshadows') !== '1';
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 600;
  const shadowRange = 140;
  sun.shadow.camera.left = -shadowRange;
  sun.shadow.camera.right = shadowRange;
  sun.shadow.camera.top = shadowRange;
  sun.shadow.camera.bottom = -shadowRange;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // clouds: a sky dome of puffs that travels with the player
  const clouds = new THREE.Group();
  if (dbg.get('noclouds') !== '1') {
    const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 1, fog: false });
    const MAX_CLOUDS = 240;
    const im = new THREE.InstancedMesh(cloudGeo, cloudMat, MAX_CLOUDS);
    const m = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    let used = 0;
    for (let i = 0; i < 48 && used < MAX_CLOUDS; i++) {
      const cx = (Math.random() - 0.5) * 1100, cz = (Math.random() - 0.5) * 1100, cy = 110 + Math.random() * 50;
      const n = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < n && used < MAX_CLOUDS; j++) {
        s.set(14 + Math.random() * 22, 6 + Math.random() * 6, 12 + Math.random() * 18);
        v.set(cx + (Math.random() - 0.5) * 46, cy + (Math.random() - 0.5) * 8, cz + (Math.random() - 0.5) * 40);
        m.compose(v, q, s);
        im.setMatrixAt(used++, m);
      }
    }
    im.count = used;
    im.frustumCulled = false;
    clouds.add(im);
    scene.add(clouds);
  }

  // the sun and the clouds follow the player
  function follow(anchor) {
    sun.position.set(anchor.x + 120, anchor.y + 180, anchor.z + 60);
    sun.target.position.set(anchor.x, anchor.y, anchor.z);
    sun.target.updateMatrixWorld();
    clouds.position.set(anchor.x, 0, anchor.z);
  }
  return { sun, hemi, clouds, follow };
}
