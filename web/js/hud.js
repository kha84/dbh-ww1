// HUD pieces with no game logic in them: the tank markers over the view and the minimap.
import * as THREE from 'three';
import { WATER_LEVEL } from './world.js';
import { CROPS } from './biomes.js';

// enemy / tank markers
export class Markers {
  constructor(el) { this.el = el; this.pool = []; this.spotT = 0; }
  // g: { tanks, vehicle, camera, world, time }
  update(dt, g) {
    const { tanks, camera, world } = g;
    const markersEl = this.el, markerPool = this.pool;
    this.spotT -= dt;
    const doSpot = this.spotT <= 0;
    if (doSpot) this.spotT = 0.35;
    let used = 0;
    const v3 = new THREE.Vector3();
    for (const t of tanks) {
      if (t === g.vehicle || t.wrecked) continue;
      const d = t.root.position.distanceTo(camera.position);
      if (doSpot) {
        const top = t.turret.localToWorld(new THREE.Vector3(0, 1.2, 0));
        if (d < 550 && world.lineOfSight(camera.position, top, 5)) t.spottedT = g.time;
      }
      const seen = (t.spottedT !== undefined && g.time - t.spottedT < 3) || d < 40;
      if (!seen || d > 600) continue;
      v3.copy(t.root.position); v3.y += t.vis.hullBox.max.y + 3;
      v3.project(camera);
      if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) continue;
      let el = markerPool[used];
      if (!el) { el = document.createElement('div'); el.className = 'mk'; markersEl.appendChild(el); markerPool.push(el); }
      used++;
      el.style.display = 'block';
      el.style.left = `${(v3.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-v3.y * 0.5 + 0.5) * innerHeight}px`;
      const cls = t.team === 'enemy' && t.crew ? 'enemy' : t.team === 'player' ? 'own' : 'dead';
      el.className = 'mk ' + cls;
      const label = cls === 'enemy' ? '' : cls === 'own' ? t.def.name : 'без экипажа';
      el.innerHTML = `${label}${label ? '<br>' : ''}${Math.round(d)} м<i></i>`;
    }
    for (let i = used; i < markerPool.length; i++) markerPool[i].style.display = 'none';
  }
}

// ================== minimap ==================
const MM_S = 180, MM_RANGE = 320;
const MM_SC = MM_S / (2 * MM_RANGE);

export class Minimap {
  constructor(canvas, world) {
    this.world = world;
    this.ctx = canvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = MM_S;
    this.baseCtx = this.base.getContext('2d');
    this.center = null;
  }

  // terrain + road around c, redrawn when the player has moved far enough
  drawBase(c) {
    const world = this.world, mmBaseCtx = this.baseCtx;
    const R = 90;               // sample resolution
    const img = mmBaseCtx.createImageData(R, R);
    const d = img.data;
    for (let py = 0; py < R; py++) {
      for (let px = 0; px < R; px++) {
        const wx = c.x - (px / R - 0.5) * 2 * MM_RANGE;
        const wz = c.z - (py / R - 0.5) * 2 * MM_RANGE;
        const h = world.heightAt(wx, wz);
        let r, g, b;
        if (h < WATER_LEVEL) { r = 45; g = 90; b = 130; }
        else if (h < 22) {
          // the land's colour (biome, fields), darker in the lowland
          const B = world.biomeAt(wx, wz);
          let col = B.grass;
          if (B.fields > 0) { const f = world.fieldAt(wx, wz, world.roadX(wz), B.fields); if (f.crop >= 0) col = CROPS[f.crop].col; }
          const t = 0.72 + 0.28 * (h - WATER_LEVEL) / 20;
          r = 255 * Math.sqrt(col[0]) * t; g = 255 * Math.sqrt(col[1]) * t; b = 255 * Math.sqrt(col[2]) * t;
        }
        else if (h < 40) { r = 120 + (h - 22) * 3; g = 115 + (h - 22) * 2.5; b = 105; }
        else { const t = Math.min(1, (h - 40) / 30); r = 175 + t * 70; g = 170 + t * 75; b = 175 + t * 70; }
        const i = (py * R + px) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = R;
    tmp.getContext('2d').putImageData(img, 0, 0);
    mmBaseCtx.imageSmoothingEnabled = true;
    mmBaseCtx.drawImage(tmp, 0, 0, MM_S, MM_S);
    // road
    mmBaseCtx.strokeStyle = '#8a7658';
    mmBaseCtx.lineWidth = 3;
    mmBaseCtx.beginPath();
    for (let z = c.z - MM_RANGE - 20, i = 0; z <= c.z + MM_RANGE + 20; z += 10, i++) {
      const x = MM_S / 2 - (world.roadX(z) - c.x) * MM_SC, y = MM_S / 2 - (z - c.z) * MM_SC;
      i ? mmBaseCtx.lineTo(x, y) : mmBaseCtx.moveTo(x, y);
    }
    mmBaseCtx.stroke();
    this.center = c.clone();
  }

  // g: { items, soldiers, tanks, vehicle, time }
  draw(anchor, heading, g) {
    const world = this.world, mmCtx = this.ctx, mmBase = this.base;
    if (!this.center || Math.hypot(anchor.x - this.center.x, anchor.z - this.center.z) > 30) this.drawBase(anchor);
    const mmCenter = this.center;
    const toMap = (wx, wz) => [MM_S / 2 - (wx - anchor.x) * MM_SC, MM_S / 2 - (wz - anchor.z) * MM_SC];
    mmCtx.fillStyle = '#222';
    mmCtx.fillRect(0, 0, MM_S, MM_S);
    mmCtx.drawImage(mmBase, (anchor.x - mmCenter.x) * MM_SC, (anchor.z - mmCenter.z) * MM_SC);
    // settlements
    mmCtx.font = '10px Arial';
    mmCtx.textAlign = 'center';
    for (const s of world.settlements.values()) {
      const [x, y] = toMap(world.roadX(s.plan.z), s.plan.z);
      mmCtx.fillStyle = 'rgba(0,0,0,.6)';
      mmCtx.fillText(s.plan.name, x + 1, y + 1);
      mmCtx.fillStyle = '#ffe9b0';
      mmCtx.fillText(s.plan.name, x, y);
      for (const z of s.zones) {
        const [zx, zy] = toMap(z.x, z.z);
        mmCtx.fillStyle = z.type === 'repair' ? '#7fb0ff' : z.type === 'fuel' ? '#ffb040' : '#ff7070';
        mmCtx.fillRect(zx - 3, zy - 3, 6, 6);
      }
    }
    // items
    for (const it of g.items.pickups.values()) {
      const [x, y] = toMap(it.pos.x, it.pos.z);
      mmCtx.fillStyle = it.type === 'plate' ? '#9fd0ff' : it.type === 'spray' ? '#d8b0ff' : '#ffe070';
      mmCtx.beginPath(); mmCtx.arc(x, y, 2, 0, 7); mmCtx.fill();
    }
    // infantry that sees us / is close
    mmCtx.fillStyle = '#ff7a5a';
    for (const sd of g.soldiers) {
      if (!sd.alive || !(sd.los || sd.pos.distanceTo(anchor) < 60)) continue;
      const [x, y] = toMap(sd.pos.x, sd.pos.z);
      mmCtx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // tanks
    for (const t of g.tanks) {
      if (t === g.vehicle) continue;
      const seen = t.spottedT !== undefined && g.time - t.spottedT < 3;
      if (t.team === 'enemy' && t.crew && !seen) continue;
      const [x, y] = toMap(t.root.position.x, t.root.position.z);
      mmCtx.fillStyle = t.wrecked ? '#333' : t.team === 'enemy' && t.crew ? '#ff4a3a' : t.team === 'player' ? '#7fe07f' : '#bbb';
      mmCtx.beginPath(); mmCtx.arc(x, y, 3.2, 0, 7); mmCtx.fill();
    }
    // player arrow
    mmCtx.save();
    mmCtx.translate(MM_S / 2, MM_S / 2);
    mmCtx.rotate(-heading + Math.PI);
    mmCtx.fillStyle = '#ff5544';
    mmCtx.strokeStyle = '#fff';
    mmCtx.lineWidth = 1.5;
    mmCtx.beginPath(); mmCtx.moveTo(0, 7); mmCtx.lineTo(5, -5); mmCtx.lineTo(0, -2); mmCtx.lineTo(-5, -5); mmCtx.closePath();
    mmCtx.fill(); mmCtx.stroke();
    mmCtx.restore();
  }
}
