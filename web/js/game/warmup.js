// Shader warm-up under the loading screen: one of every tank / personnel carrier / car / motorcycle (and a burnt-out
// one, a crewed car with its riders), a plane (glass, propeller disc, bombs), a crater patch, a soldier, the rolling
// stock (baked models of every locomotive / car, the running gear) and every kind
// of pickup are put in front of the camera for a few frames, so the pipelines they need are built now and
// not in the middle of a fight (a new kind of machine turning up used to stall a frame for 100+ ms).
import * as THREE from 'three';
import { Tank } from '../tanks.js';
import { TANK_DEFS } from '../tankdefs/index.js';
import { Soldier } from '../infantry.js';
import { ITEM_DEFS, buildItemMesh } from '../items.js';
import { buildPlane } from '../planedefs/index.js';
import { warmTrains } from '../trains.js';

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

/**
 * @param {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: any, at: THREE.Vector3, frames?: number }} o
 */
export async function warmUp(o) {
  const { scene, camera, world, at } = o;
  const g = new THREE.Group();
  scene.add(g);
  const y = world.heightAt(at.x, at.z);
  camera.position.set(at.x, y + 6, at.z - 6);
  camera.lookAt(at.x, y, at.z + 30);
  const place = (i, n, dist) => new THREE.Vector3(at.x + (i - (n - 1) / 2) * 7, 0, at.z + dist);
  const keys = TANK_DEFS.map(d => d.key);
  const tanks = keys.map((k, i) => new Tank(g, k, place(i % 8, 8, 25 + Math.floor(i / 8) * 12), 0, { team: 'neutral' }));
  for (const t of tanks) t.root.position.y = world.heightAt(t.root.position.x, t.root.position.z);
  tanks[0].makeWreck();
  const car = tanks.find(t => t.soft);
  if (car) { car.crew = true; car.updateRiders(); }
  const plane = buildPlane('il2');
  plane.root.position.set(at.x, y + 2, at.z + 50);
  if (plane.prop) plane.prop.userData.disc.visible = true;
  g.add(plane.root);
  // the ground of a crater (the terrain material on a mesh of its own)
  const cg = new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2);
  cg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cg.attributes.position.count * 3).fill(0.4), 3));
  const crater = new THREE.Mesh(cg, world.terrainMat);
  crater.position.set(at.x + 4, y + 0.3, at.z + 10);
  g.add(crater);
  const s = new Soldier(g, new THREE.Vector3(at.x - 3, y, at.z + 12), { key: 'mosin' });
  g.add(s.root);
  Object.keys(ITEM_DEFS).forEach((type, i) => {
    try {
      const m = buildItemMesh(type);
      m.position.set(at.x + (i - 6) * 1.2, y + 0.3, at.z + 8);
      g.add(m);
    } catch { /* some pickups need data: skip them */ }
  });
  const tr = warmTrains();                                         // rolling stock: baked models, running gear
  tr.position.set(at.x + 6, y, at.z + 30);
  g.add(tr);
  for (let i = 0; i < (o.frames || 3); i++) await nextFrame();
  scene.remove(g);
}
