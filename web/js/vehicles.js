// Vehicle system: loads GLB tank models, driving physics, camera, enter/exit
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const VEHICLE_DEFS = [
  { key: 'markV',  name: 'Mark V',         maxSpeed: 5,  accel: 3.5, turn: 0.75, scale: 3.0 },
  { key: 'abrams', name: 'Abrams',         maxSpeed: 16, accel: 8,   turn: 1.15, scale: 6.0 },
  { key: 'avre',   name: 'Chieftain AVRE', maxSpeed: 12, accel: 5.5, turn: 0.95, scale: 5.0 },
];

export class Vehicle {
  constructor(scene, def, model, spawn) {
    this.scene = scene;
    this.def = def;
    this.root = model;             // THREE.Group containing the model
    this.root.position.copy(spawn);
    this.scene.add(this.root);

    this.speed = 0;                // signed forward speed (m/s)
    this.heading = Math.random() * Math.PI * 2;
    this.driver = null;            // player reference when driving
    this.speedKmh = 0;
    this.tiltX = 0;                // smoothed pitch
    this.tiltZ = 0;                // smoothed roll
  }

  update(dt, terrain) {
    // terrain-follow: place hull on ground, tilt to slope
    const p = this.root.position;
    const h = terrain.heightAt(p.x, p.z);
    p.y = h;

    // sample slope for pitch/roll, projected onto tank local axes
    const d = 1.6;
    const hx = terrain.heightAt(p.x + d, p.z) - terrain.heightAt(p.x - d, p.z);
    const hz = terrain.heightAt(p.x, p.z + d) - terrain.heightAt(p.x, p.z - d);
    const sinH = Math.sin(this.heading), cosH = Math.cos(this.heading);
    const hf = hx * sinH + hz * cosH;       // height delta along forward axis
    const hr = -hx * cosH + hz * sinH;      // height delta along right axis
    // in three.js +pitch lowers the nose (forward = +Z), +roll raises the left side
    // clamp: river banks / cliffs produce huge deltas -> tank would stand on its nose
    const MAX_TILT = 0.5; // radians (~30 deg)
    const rawPitch = Math.atan2(-hf, 2 * d);
    const rawRoll = Math.atan2(-hr, 2 * d);
    this.tiltX += (THREE.MathUtils.clamp(rawPitch, -MAX_TILT, MAX_TILT) - this.tiltX) * Math.min(1, dt * 6);
    this.tiltZ += (THREE.MathUtils.clamp(rawRoll, -MAX_TILT, MAX_TILT) - this.tiltZ) * Math.min(1, dt * 6);

    // convert heading -> quaternion, then apply pitch/roll in local space
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.tiltX);
    const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.tiltZ);
    this.root.quaternion.copy(yaw).multiply(pitch).multiply(roll);

    if (this.driver) {
      // ----- driving physics -----
      const fwd = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
      const turn = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
      const brake = keys['Space'] ? 1 : 0;

      const maxS = this.def.maxSpeed;
      if (fwd !== 0) {
        this.speed += fwd * this.def.accel * dt;
      } else {
        this.speed *= Math.pow(0.25, dt); // engine braking / drag
      }
      if (brake) this.speed *= Math.pow(0.02, dt);
      this.speed = Math.max(-maxS * 0.45, Math.min(maxS, this.speed));

      // steering scales down at speed
      const steerEff = 1 - Math.min(0.65, Math.abs(this.speed) / maxS * 0.75);
      this.heading += turn * this.def.turn * steerEff * dt * (this.speed >= 0 ? 1 : -1) *
                      Math.min(1, Math.abs(this.speed) / 2.5);

      // move
      const dirX = Math.sin(this.heading);
      const dirZ = Math.cos(this.heading);
      p.x += dirX * this.speed * dt;
      p.z += dirZ * this.speed * dt;

      // deep water blocks tanks
      if (terrain.heightAt(p.x, p.z) < terrain.WATER_LEVEL - 1.4) {
        p.x -= dirX * this.speed * dt;
        p.z -= dirZ * this.speed * dt;
        this.speed *= 0.3;
      }

      // trees block tanks (push out, kill speed)
      if (terrain.trees) {
        for (const t of terrain.trees) {
          const dx = p.x - t.x, dz = p.z - t.z;
          const rr = t.r + 2.6;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            p.x = t.x + dx / d * rr;
            p.z = t.z + dz / d * rr;
            this.speed *= 0.4;
          }
        }
      }

      // keep inside world bounds
      const lim = terrain.SIZE / 2 - 12;
      p.x = Math.max(-lim, Math.min(lim, p.x));
      p.z = Math.max(-lim, Math.min(lim, p.z));

      this.speedKmh = Math.abs(this.speed) * 3.6;
    } else {
      this.speed = 0;
      this.speedKmh = 0;
    }
  }
}

// global key state shared with main.js
export const keys = {};

export class VehicleManager {
  constructor(scene) {
    this.scene = scene;
    this.vehicles = [];
    this.loader = new GLTFLoader();
  }

  loadAll(terrain) {
    const spawns = [
      new THREE.Vector3(-25, 0, 20),
      new THREE.Vector3(10, 0, 20),
      new THREE.Vector3(-20, 0, -25),
    ];

    const promises = VEHICLE_DEFS.map((def, i) => new Promise((resolve) => {
      this.loader.load(
        `assets/${def.key}.glb`,
        (gltf) => {
          const model = gltf.scene;
          model.traverse(o => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              // fix material issues from PLY-converted GLBs
              o.material.side = THREE.FrontSide;
            }
          });

          // normalize: rotate to face +Z, center XZ, sit on ground, scale
          const wrapper = new THREE.Group();
          wrapper.add(model);
          model.rotation.y = Math.PI / 2;
          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.x -= center.x;
          model.position.z -= center.z;
          model.position.y -= box.min.y;
          wrapper.scale.setScalar(def.scale);

          const v = new Vehicle(this.scene, def, wrapper, spawns[i]);
          v.heading = spawns[i].x > 0 ? Math.PI : 0;
          this.vehicles.push(v);
          resolve(v);
        },
        undefined,
        (err) => { console.error('Failed to load', def.key, err); resolve(null); }
      );
    }));

    return Promise.all(promises);
  }

  nearest(pos, maxDist = 6) {
    let best = null, bestD = maxDist;
    for (const v of this.vehicles) {
      if (!v || v.driver) continue;
      const d = v.root.position.distanceTo(pos);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }
}