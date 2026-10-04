// Caponier: the pit of an ambush tank dug in by the road - earth berms (front parapet, two sides) that are obstacles;
// the tank sinks into the ground only inside it (Tank.sinkAt).
import * as THREE from 'three';

const earthMat = new THREE.MeshStandardMaterial({ color: 0x6d5a3c, roughness: 1 });
const bermGeo = (() => {
  // trapezoid cross-section (x across, y up) extruded along z, 1 m long, centred
  const s = new THREE.Shape();
  s.moveTo(-1.6, -1); s.lineTo(1.6, -1); s.lineTo(0.5, 1); s.lineTo(-0.5, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  g.computeVertexNormals();
  return g;
})();

export function buildCaponier(world, x, z, heading) {
  const group = new THREE.Group();
  const obstacles = [];
  const c = Math.cos(heading), s = Math.sin(heading);
  const place = (lx, lz, len, rotLocal, h) => {
    const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
    const gy = world.heightAt(wx, wz);
    const m = new THREE.Mesh(bermGeo, earthMat);
    m.position.set(wx, gy + h / 2 - 0.2, wz);
    m.rotation.y = heading + rotLocal;
    m.scale.set(1, h / 2, len);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    const along = Math.abs(Math.sin(rotLocal)) > 0.5;
    obstacles.push(world.addObstacle({
      x: wx, z: wz, rot: heading, hx: along ? len / 2 : 1.2, hz: along ? 1.2 : len / 2,
      y0: gy - 1, y1: gy + h - 0.3,
    }));
  };
  place(0, 5.2, 8.5, Math.PI / 2, 2.2);     // front parapet
  place(3.9, 0.6, 8, 0, 1.9);               // left
  place(-3.9, 0.6, 8, 0, 1.9);              // right
  world.scene.add(group);
  return {
    group, obstacles, x, z, heading,    // pit centre: the tank is dug in only while inside it
    dispose() {
      world.scene.remove(group);
      for (const o of obstacles) world.removeObstacle(o);
    },
  };
}
