// Game modes: world options and the initial setup of each mode.
//   road  - the endless road with a random (or given) world seed (setup lives in main.js: setupStart)
//   duel  - the player's chosen tank against 1..5 chosen enemy tanks on an enclosed field
//   range - a tank range: ramps, ditches, bumps, ponds, target hulks, a repair station and a village to try things
// URL parameters (the main menu builds them): ?mode=duel&tank=t55&enemies=is2,t44 · ?mode=range&tank=bt7 · ?seed=N
import * as THREE from 'three';
import { HULLS, TANK_TIERS, APC_TIERS } from './parts.js';
import { TankAI } from './ai.js';

const PI = Math.PI;

export const MODE_NAMES = { road: 'Дорога', duel: 'Дуэль', range: 'Танкодром' };

// World constructor options per mode
/** @returns {import('./world.js').WorldOptions} */
export function worldOptions(mode) {
  if (mode === 'duel') {
    return {
      arena: 'duel', road: false, settlements: false, rivers: false, treeDensity: 0.55,
      bounds: { x0: -300, x1: 300, z0: -300, z1: 300 },
      clear: [{ x: 0, z: -235, r: 30 }, { x: 0, z: 215, r: 150 }],
    };
  }
  if (mode === 'range') {
    return {
      arena: 'range', road: true, settlements: true, rivers: false, treeDensity: 0.25,
      bounds: { x0: -330, x1: 330, z0: -330, z1: 900 },
      plans: [{ k: 0, type: 'repair', z: 250 }, { k: 1, type: 'village', z: 650 }],
      clear: [{ x: 0, z: -270, r: 40 }, { x: 60, z: -240, r: 40 }, { x: -80, z: 60, r: 45 }, { x: 60, z: 80, r: 50 }],
      features: [
        { type: 'hill', x: -120, z: -120, r: 45, h: 9 },
        { type: 'hill', x: 170, z: -170, r: 60, h: 14 },
        { type: 'table', x: 55, z: -280, rot: 0, w: 8, up: 12, top: 10, down: 12, h: 3 },
        { type: 'table', x: 80, z: -280, rot: 0, w: 8, up: 6, top: 6, down: 6, h: 3.5 },
        { type: 'ditch', x: -80, z: 60, rot: PI / 2, w: 5, l: 70, d: 2.3 },
        { type: 'bumps', x: 60, z: 40, rot: 0, w: 10, l: 80, a: 0.8, k: 0.9 },
        { type: 'pond', x: -170, z: 280, r: 42, d: 11 },
        { type: 'pond', x: 140, z: 400, r: 30, d: 9.2 },
        { type: 'hill', x: -200, z: 500, r: 75, h: 26 },
      ],
    };
  }
  return {};
}

// the arena bounds keep tanks and the player inside
export function clampToBounds(world, p, margin = 4) {
  const b = world.opts.bounds;
  if (!b) return;
  p.x = Math.max(b.x0 + margin, Math.min(b.x1 - margin, p.x));
  p.z = Math.max(b.z0 + margin, Math.min(b.z1 - margin, p.z));
}

const randomTank = () => TANK_TIERS[Math.floor(Math.random() * TANK_TIERS.length)];
export const validTank = k => (HULLS[k] ? k : null);

// ctx: { world, tanks, spawnTank, director, items, player, state, enterTank(t), msg, cfg }
export function setupDuel(ctx) {
  const { world, cfg } = ctx;
  const key = validTank(cfg.tank) || 't26';
  const me = ctx.spawnTank(key, 0, -235, 0, { team: 'player' });
  ctx.player.position.set(3, world.heightAt(3, -238), -238);
  ctx.enterTank(me);
  const list = (cfg.enemies && cfg.enemies.length ? cfg.enemies : ['random']).slice(0, 5);
  const foes = [];
  list.forEach((k0, i) => {
    const k = validTank(k0) || randomTank();
    const x = (i - (list.length - 1) / 2) * 55 + (Math.random() - 0.5) * 20, z = 200 + Math.random() * 40;
    const t = ctx.director.makeTank(k, new THREE.Vector3(x, 0, z), PI + (Math.random() - 0.5) * 0.4, Math.random, { kits: 0 });
    ctx.tanks.push(t);
    ctx.director.ais.push(new TankAI(t, 'hunt', world, {}));
    foes.push(t);
  });
  ctx.state.duel = { foes, over: false };
  ctx.msg(`Дуэль: ваш ${HULLS[key].name} против ${foes.map(t => t.def.name).join(', ')}. Уничтожьте противника!`, '#e8c96a');
  ctx.msg('Противник знает, где вы, и идёт навстречу. Используйте рельеф и деревья.', '#e8c96a');
  return foes;
}

// duel: remaining enemies; calls onWin once when none are left
export function duelStatus(state) {
  const d = state.duel;
  if (!d) return null;
  const left = d.foes.filter(t => t.crew && !t.wrecked).length;
  return { left, total: d.foes.length };
}

export function setupRange(ctx) {
  const { world, cfg } = ctx;
  const key = validTank(cfg.tank) || 't26';
  const me = ctx.spawnTank(key, 6, -270, 0, { team: 'player' });
  ctx.player.position.set(12, world.heightAt(12, -272), -272);
  ctx.enterTank(me);
  // target hulks at known distances along the range
  const targets = [[-35, -120], [40, -20], [-55, 130], [65, 330], [-60, 520], [30, 760], [-110, 800], [120, 820]];
  targets.forEach(([x, z], i) => {
    const t = ctx.spawnTank(TANK_TIERS[i % TANK_TIERS.length], x, z, Math.PI + (i % 3 - 1) * 0.6, { team: 'neutral', fuelFrac: 0.2 });
    t.derelict = true;
  });
  // a personnel carrier to try (sit in the back: walk up to it from behind)
  ctx.spawnTank(APC_TIERS[Math.floor(Math.random() * APC_TIERS.length)], -14, -262, 0, { team: 'neutral', fuelFrac: 0.6 });
  // spares at the start line
  ctx.items.add('range:plate', 'plate', 18, -262);
  ctx.items.add('range:spray1', 'spray', 19.2, -262.5, { color: 0xd8d8d0, paint: 100 });
  ctx.items.add('range:spray2', 'spray', 19.6, -262.1, { color: 0xb39a6b, paint: 100 });
  ctx.items.add('range:can1', 'canister', 17, -266, { fuel: 20 });
  ctx.items.add('range:can2', 'canister', 17.8, -266, { fuel: 20 });
  ctx.items.add('range:bag1', 'sandbag', 19, -268);
  ctx.items.add('range:bag2', 'sandbag', 20, -268.5);
  ctx.items.add('range:kit', 'repair_kit', 16, -260);
  ctx.state.range = true;
  ctx.msg(`Танкодром: ${HULLS[key].name}. Трамплины и горки справа, противотанковый ров и «гребёнка» впереди,`, '#e8c96a');
  ctx.msg('пруды (один можно пройти вброд), мишени-корпуса на 150–1000 м, ремпункт с краном и деревня дальше по дороге.', '#e8c96a');
}
