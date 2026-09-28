// Rendering: WebGPURenderer (WebGPU where the browser has it, WebGL 2 otherwise), scene, camera, graphics quality,
// the sky (physical sky, sun / moon, stars, fog and ambient light following the time of day), cascaded shadows
// and post-processing (ambient occlusion, bloom, FXAA). `three` is the WebGPU build of three.js (vite.config.js
// aliases it), so every module shares one copy.
//   ?backend=webgl  force WebGL 2     ?q=low|medium|high  graphics quality (else the saved one / by the backend)
//   ?tod=H  start at H o'clock     ?daylen=M  minutes of a whole day (0: the time stands still)
//   ?noshadows=1 ?nofog=1 ?noclouds=1 ?noaa=1 ?nopost=1 ?noao=1 ?nobloom=1 ?bloomT=0.1 ?bloomS=0.9 ?logdepth=1
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, vec4, renderOutput, uniform, float, instancedBufferAttribute } from 'three/tsl';
import { glowing, setGlow } from '../glow.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';

export const BASE_FOV = 70;
const QUALITY_KEY = 'dbh-ww1-quality';

// graphics presets: pixel ratio cap, shadow map / cascades, post-processing, grass
export const QUALITY = {
  low:    { name: 'низкая',  pixelRatio: 1,    shadowMap: 1024, shadowRange: 90,  csm: false, post: false, ao: false, bloom: false, grass: 0 },
  medium: { name: 'средняя', pixelRatio: 1.25, shadowMap: 2048, shadowRange: 140, csm: false, post: true,  ao: false, bloom: true,  grass: 1 },
  high:   { name: 'высокая', pixelRatio: 1.75, shadowMap: 2048, shadowRange: 140, csm: true,  post: true,  ao: true,  bloom: true,  grass: 2 },
};

/**
 * @param {URLSearchParams} dbg
 * @param {HTMLElement} app
 */
export function createRenderer(dbg, app) {
  const renderer = new THREE.WebGPURenderer({
    antialias: dbg.get('noaa') !== '1',    // MSAA when drawing straight to the screen (low); FXAA in the post-processing
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: dbg.get('logdepth') === '1',
    forceWebGL: dbg.get('backend') === 'webgl',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = dbg.get('noshadows') !== '1';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec8e8);

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
export const isWebGPU = renderer => !!(renderer.backend && renderer.backend.isWebGPUBackend);
export const backendName = renderer => isWebGPU(renderer) ? 'WebGPU' : 'WebGL 2';

// the quality to start with: ?q=, the one chosen before (pause menu), else by the backend
export function initialQuality(dbg, renderer) {
  const q = dbg.get('q') || (() => { try { return localStorage.getItem(QUALITY_KEY); } catch { return null; } })();
  if (q && QUALITY[q]) return q;
  return isWebGPU(renderer) ? 'high' : 'medium';
}
export function saveQuality(q) { try { localStorage.setItem(QUALITY_KEY, q); } catch { /* private mode */ } }

// ===================================================================== sky
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const mixHex = (a, b, t, out) => out.set(a).lerp(_c2.set(b), t);

/**
 * Sun / moon, sky, stars, fog, ambient light and clouds, all following the time of day.
 * `viewDist`: how far the terrain is drawn (the fog ends there).
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {URLSearchParams} dbg
 * @param {number} viewDist
 */
export function createSky(scene, camera, dbg, viewDist) {
  const fogOn = dbg.get('nofog') !== '1';
  if (fogOn) scene.fog = new THREE.Fog(0x9ec8e8, viewDist * 0.3, viewDist * 0.95);

  const hemi = new THREE.HemisphereLight(0xbdd8f0, 0x5c6b4a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d9, 2.0);
  sun.castShadow = dbg.get('noshadows') !== '1';
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // physical sky (TSL): a box around the camera, inside the far plane
  const sky = new SkyMesh();
  sky.scale.setScalar(780);
  sky.turbidity.value = 3;
  sky.rayleigh.value = 1.2;
  sky.mieCoefficient.value = 0.004;
  sky.mieDirectionalG.value = 0.8;
  sky.cloudCoverage.value = 0.18;
  sky.cloudDensity.value = 0.3;
  sky.material.fog = false;
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // stars: instanced sprites a few pixels wide on a dome inside the sky box (its half size is 390), shown at night
  const N_STARS = 1200;
  const sp = new Float32Array(N_STARS * 3), ss = new Float32Array(N_STARS);
  for (let i = 0; i < N_STARS; i++) {
    const u = Math.random() * 0.97 + 0.03, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    sp[i * 3] = Math.cos(a) * r * 330; sp[i * 3 + 1] = u * 330; sp[i * 3 + 2] = Math.sin(a) * r * 330;
    ss[i] = 0.0025 + Math.pow(Math.random(), 4) * 0.005;
  }
  const starOpacity = uniform(0);
  const starMat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, fog: false, sizeAttenuation: false });
  starMat.positionNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(sp, 3));
  starMat.scaleNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(ss, 1));
  starMat.colorNode = vec4(1, 1, 1, starOpacity);
  glowing(starMat);
  const stars = new THREE.Sprite(starMat);
  stars.count = N_STARS;
  stars.frustumCulled = false;
  scene.add(stars);

  // clouds: low-poly puffs that travel with the player
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 1, fog: false });
  if (dbg.get('noclouds') !== '1') {
    const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
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
  clouds.renderOrder = 1;

  // time of day (hours): a whole day in `dayLen` minutes, nights pass twice as fast as days
  const dl = dbg.has('daylen') ? parseFloat(dbg.get('daylen')) : 24;
  const t = { tod: dbg.has('tod') ? parseFloat(dbg.get('tod')) % 24 : 9, dayLen: dl };
  const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
  const env = { night: 0, sunUp: 1, exposure: 1.05 };

  // sun direction for the hour: rises in the east (+X), highest at noon in the south (-Z)
  function sunDirection(h, out) {
    const a = (h - 6) / 12 * Math.PI;                       // 0 at sunrise, PI at sunset
    return out.set(Math.cos(a), Math.sin(a) * 0.78, -Math.sin(a) * 0.45 - 0.2).normalize();
  }

  function setTime(h) {
    t.tod = ((h % 24) + 24) % 24;
    sunDirection(t.tod, sunDir);
    const e = sunDir.y;                                   // sun elevation (sin)
    const day = smooth(-0.08, 0.12, e);                   // 0 night .. 1 day
    const dusk = smooth(0.35, 0.02, e) * smooth(-0.14, 0.02, e);   // low sun: warm light
    env.night = 1 - day; env.sunUp = day;
    env.exposure = 1.05 + 1.1 * (1 - day);               // the eye adapts to the dark
    sky.sunPosition.value.copy(sunDir).multiplyScalar(1000);
    sky.showSunDisc.value = e > -0.05 ? 1 : 0;
    // the light comes from the sun by day and from the moon (opposite) by night
    if (e > -0.04) lightDir.copy(sunDir);
    else lightDir.copy(sunDir).negate().setY(Math.max(0.35, -sunDir.y)).normalize();
    sun.userData.dir = lightDir;
    mixHex(0x9fb4e0, 0xfff2d9, day, sun.color);
    if (dusk > 0) sun.color.lerp(_c2.set(0xffa860), dusk * 0.7);
    // moonlight: dim and blue, but bright enough to fight in
    sun.intensity = day > 0.01 ? 0.55 + 1.45 * day : 0.6;
    hemi.intensity = 0.55 + 0.3 * day;
    mixHex(0x5a6c98, 0xbdd8f0, day, hemi.color);
    mixHex(0x252b24, 0x5c6b4a, day, hemi.groundColor);
    // fog / background: the colour of the horizon
    const fog = mixHex(0x2c3a58, 0x9ec8e8, day, _c1);
    if (dusk > 0) fog.lerp(_c2.set(0xd9a07a), dusk * 0.45);
    if (scene.fog) scene.fog.color.copy(fog);
    scene.background.copy(fog);
    starOpacity.value = Math.max(0, 1 - day * 1.6) * 0.9;
    stars.visible = starOpacity.value > 0.01;
    cloudMat.color.copy(mixHex(0x39435a, 0xffffff, day, _c2));
    if (dusk > 0) cloudMat.color.lerp(_c1.set(0xffc49a), dusk * 0.5);
  }
  setTime(t.tod);

  // every frame: the clock runs, the sun and the clouds follow the player
  function update(dt, anchor) {
    if (t.dayLen > 0) {
      const night = t.tod < 5.5 || t.tod > 18.5;
      setTime(t.tod + dt * 24 / (t.dayLen * 60) * (night ? 2 : 1));
    }
    const d = sun.userData.dir;
    sun.position.set(anchor.x + d.x * 250, anchor.y + d.y * 250, anchor.z + d.z * 250);
    sun.target.position.set(anchor.x, anchor.y, anchor.z);
    sun.target.updateMatrixWorld();
    clouds.position.set(anchor.x, 0, anchor.z);
  }
  // before drawing: the sky and the stars sit around the camera
  function place() {
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
  }
  const clock = () => {
    const h = Math.floor(t.tod), m = Math.floor((t.tod - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return { sun, hemi, sky, stars, clouds, time: t, env, setTime, update, place, clock };
}

// ===================================================================== shadows + post-processing
/**
 * Draws a frame in the chosen quality: shadows (one map around the player or cascades), and the post-processing
 * chain (scene -> ambient occlusion -> bloom -> tone mapping -> FXAA) or the plain renderer.
 */
export function createPipeline(renderer, scene, camera, sky, dbg) {
  const sun = sky.sun;
  let q = null, key = '', pipeline = null, csm = null;
  const aoStrength = uniform(0.85);

  function setShadows(Q) {
    if (Q.csm && !csm) {
      csm = new CSMShadowNode(sun, { cascades: 3, maxFar: 420, mode: 'practical', lightMargin: 120 });
      csm.fade = true;
      sun.shadow.shadowNode = csm;
    }
    if (!Q.csm && csm) { sun.shadow.shadowNode = null; csm.dispose && csm.dispose(); csm = null; }
    sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    const r = Q.shadowRange;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r });
    sun.shadow.camera.updateProjectionMatrix();
  }

  function buildPost(Q) {
    if (!Q.post || dbg.get('nopost') === '1') { setGlow(false); return null; }
    const p = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera, { samples: 0 });          // FXAA smooths the edges (GTAO needs a plain depth)
    const useAO = Q.ao && dbg.get('noao') !== '1', useBloom = Q.bloom && dbg.get('nobloom') !== '1';
    // extra targets: view normals for the ambient occlusion, the glow mask for the bloom (glow.js)
    const targets = { output };
    if (useAO) targets.normal = normalView;
    if (useBloom) targets.bloom = float(0);
    if (useAO || useBloom) scenePass.setMRT(mrt(targets));
    setGlow(useBloom);
    let color;
    if (useAO) {
      const base = scenePass.getTextureNode('output');
      const aoPass = ao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), camera);
      aoPass.resolutionScale = 0.5;
      aoPass.radius.value = 0.6;
      aoPass.samples.value = 12;
      const occl = aoPass.getTextureNode().r;
      color = vec4(base.rgb.mul(float(1).sub(aoStrength).add(occl.mul(aoStrength))), base.a);
    } else color = scenePass.getTextureNode('output');
    // bloom only for what glows (glow.js: fire, flashes, sparks, tracers), not for the bright sky
    if (useBloom) {
      const glow = scenePass.getTextureNode('output').mul(scenePass.getTextureNode('bloom').r);
      color = color.add(bloom(glow, parseFloat(dbg.get('bloomS') || '0.9'), 0.4, parseFloat(dbg.get('bloomT') || '0.1')));
    }
    p.outputColorTransform = false;
    p.outputNode = dbg.get('noaa') === '1' ? renderOutput(color) : fxaa(renderOutput(color));
    return p;
  }

  let lastFov = 0, lastAspect = 0, lastNear = 0;
  const api = {
    /** @type {((Q: any) => void) | null} called with the new preset (the game switches the grass) */
    onQuality: null,
    get quality() { return q; },
    set(name) {
      const Q = QUALITY[name] || QUALITY.medium;
      q = name;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.pixelRatio));
      if (renderer.shadowMap.enabled) setShadows(Q);
      const k = `${Q.post}${Q.ao}${Q.bloom}`;
      if (k !== key) { if (pipeline) pipeline.dispose(); pipeline = buildPost(Q); key = k; }
      if (api.onQuality) api.onQuality(Q);
    },
    render() {
      sky.place();
      renderer.toneMappingExposure = sky.env.exposure;
      // cascades follow the camera's projection (zoomed gunner sight, near plane inside the tank)
      if (csm && csm.camera && (camera.fov !== lastFov || camera.aspect !== lastAspect || camera.near !== lastNear)) {
        lastFov = camera.fov; lastAspect = camera.aspect; lastNear = camera.near;
        csm.updateFrustums();
      }
      if (pipeline) pipeline.render();
      else renderer.render(scene, camera);
    },
  };
  return api;
}
