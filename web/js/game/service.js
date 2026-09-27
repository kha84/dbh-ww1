// Service zones of the settlements: repair pad, gas station, ammo depot (the vehicle has to stand still).
import { MODULE_NAMES, SYSTEM_IDS } from '../tanks.js';
import { SYSTEM_PART } from '../parts.js';
import { WEAPONS } from '../weapons.js';

export function createService(ctx) {
  const { world } = ctx;

  // ================== settlement service zones ==================
  function currentZone(p) {
    for (const s of world.settlements.values()) {
      for (const z of s.zones) {
        if (Math.hypot(p.x - z.x, p.z - z.z) < z.r) return z;
      }
    }
    return null;
  }

  // belts for the pintle machine gun (up to MG_BELTS rounds)
  const MG_BELTS = 600;
  function refillMG(v, dt) {
    if (!v.mg) return false;
    const cal = WEAPONS[v.mg.key].cal;
    const n = v.cargo.ammo[cal] || 0;
    if (n >= MG_BELTS) return false;
    v.cargo.ammo[cal] = Math.min(MG_BELTS, n + Math.ceil(60 * dt));
    return true;
  }

  function serviceTank(v, zone, dt) {
    if (!zone || Math.abs(v.speed) > 1.5) return null;
    if (zone.type === 'repair') {
      let busy = false;
      const dead = [];
      for (const id of SYSTEM_IDS) {
        const kind = SYSTEM_PART[id];
        if (kind && !v.parts[kind]) continue;                         // missing: nothing to repair
        // a replaceable part broken to 0% can't be fixed - only swapped for another one
        if (kind && v.hp[id] <= 0) { dead.push(MODULE_NAMES[id].toLowerCase()); continue; }
        if (v.hp[id] < 100) {
          v.hp[id] = Math.min(100, v.hp[id] + 12 * dt);
          busy = true;
          if (id === 'hull' && v.hp.hull >= 100) v.clearMarks();
        }
      }
      if (v.ammo < v.def.ammoMax) { v.ammo = Math.min(v.def.ammoMax, v.ammo + 4 * dt); busy = true; }
      if (refillMG(v, dt)) busy = true;
      if (v.extinguishers < 3) { v.extinguishers = 3; busy = true; }
      if (v.fire) { v.fire = null; busy = true; }
      if (!busy && v.hp.hull >= 100 && v.marks.length) v.clearMarks();
      if (busy) return 'Ремонт и пополнение боекомплекта...';
      return dead.length ? `Уничтожено — только замена: ${dead.join(', ')}` : 'Танк исправен';
    }
    if (zone.type === 'fuel') {
      if (v.fuel < v.fuelMax - 0.1) { v.fuel = Math.min(v.fuelMax, v.fuel + 15 * dt); return 'Заправка...'; }
      return 'Бак полон';
    }
    if (zone.type === 'ammo') {
      const mg = refillMG(v, dt);
      if (v.ammo < v.def.ammoMax) { v.ammo = Math.min(v.def.ammoMax, v.ammo + 3 * dt); return 'Загрузка снарядов...'; }
      if (mg) return 'Набивка пулемётных лент...';
      return 'Боекомплект полон';
    }
    return null;
  }

  return { currentZone, serviceTank };
}
