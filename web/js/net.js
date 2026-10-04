// Network play for two players (co-op over WebRTC data channels).
//
// The HOST runs the world as in the single-player game: the enemy (AI tanks, infantry), damage, loot, destruction.
// The GUEST generates the same terrain / settlements from the seed but runs no AI: the tanks, soldiers, shells and
// grenades of the host's world come over the network, the guest's shots / shells / grenades go to the host, which
// works out the hits. Every tank has an owner that simulates it and sends its state (pose ~15 times a second, the
// full state - parts, damage, stowage, paint - when it changes): the host owns the AI tanks and everything nobody
// uses, the guest owns the tank it sits in / works on (claimed when it gets in or next to it, given back when it
// walks away). Damage to a tank the guest owns is worked out on the host and sent as a "hit" (the guest applies it).
//
// Connection: the host makes an offer (WebRTC session description), the guest answers. With server.py the two
// exchange them through a mailbox on the web server (a short room code); with any other static server the host
// gives the guest an invitation code and gets an answer code back (copy / paste in a messenger).
import * as THREE from 'three';
import { Soldier } from './infantry.js';
import { WEAPONS } from './weapons.js';
import { HULLS } from './parts.js';
import { buildCaponier } from './ai.js';
import { Tank } from './tanks.js';
import { paintObject } from './paint.js';
import { partData, weaponData, mkPart, mkWeapon, pickupData, patchData, restorePatches } from './save.js';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const SNAP_DT = 1 / 15;          // pose / snapshot rate
const STATE_DT = 0.5;            // full states of tanks checked for changes
const REL_R = 1500;              // tanks this close to the guest are sent to it
const SOLDIER_R = 700;
const STANCES = ['stand', 'crouch', 'prone'];
const r2 = x => Math.round(x * 100) / 100;
const r3 = x => Math.round(x * 1000) / 1000;
const v3 = v => [r2(v.x), r2(v.y), r2(v.z)];
export const NET_KEY = 'dbh-ww1-net';          // sessionStorage: what the guest joins (from the menu)

// ===================================================================== codes and signalling
// invitation / answer codes: JSON, deflated, base64url
export async function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let out = bytes;
  if (window.CompressionStream) {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    out = new Uint8Array(await new Response(cs).arrayBuffer());
  }
  let s = '';
  for (const b of out) s += String.fromCharCode(b);
  return (window.CompressionStream ? 'Z' : 'J') + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function unpack(str) {
  str = str.trim().replace(/\s+/g, '');
  const kind = str[0];
  const b64 = str.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  let text;
  if (kind === 'Z') {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    text = await new Response(ds).text();
  } else text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

// mailbox of server.py: /api/ping, /api/room/<code>/<slot>
export const Signal = {
  async available() {
    try {
      const r = await fetch('api/ping', { cache: 'no-store' });
      return r.ok && (await r.text()).trim() === 'dbh';
    } catch { return false; }
  },
  async put(room, slot, text) {
    const r = await fetch(`api/room/${room}/${slot}`, { method: 'POST', body: text });
    if (!r.ok) throw new Error('signal ' + r.status);
  },
  async get(room, slot) {
    try {
      const r = await fetch(`api/room/${room}/${slot}`, { cache: 'no-store' });
      return r.ok ? await r.text() : null;
    } catch { return null; }
  },
};
export const newRoom = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
export const isRoomCode = s => /^[A-Z0-9]{4,8}$/i.test(s.trim());

// ===================================================================== transport
export class Link {
  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: ICE });
    this.rel = null;                 // reliable, ordered: events, full states
    this.fast = null;                // unreliable: poses, snapshots
    this.open = false;
    /** @type {(...a: any[]) => void} */
    this.onopen = () => {};
    /** @type {(...a: any[]) => void} */
    this.onclose = () => {};
    /** @type {(...a: any[]) => void} */
    this.onmsg = () => {};
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState;
      if ((st === 'failed' || st === 'closed') && this.open) this.close();
    };
  }
  wire(ch) {
    ch.onmessage = e => { try { this.onmsg(JSON.parse(e.data)); } catch (err) { console.error('net message', err); } };
    if (ch.label === 'rel') {
      this.rel = ch;
      ch.onopen = () => { this.open = true; this.onopen(); };
      ch.onclose = () => this.close();
    } else this.fast = ch;
  }
  iceDone() {
    return new Promise(res => {
      if (this.pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, 4000);
      this.pc.addEventListener('icegatheringstatechange', () => {
        if (this.pc.iceGatheringState === 'complete') { clearTimeout(t); res(); }
      });
    });
  }
  async offer() {
    this.wire(this.pc.createDataChannel('rel', { ordered: true }));
    this.wire(this.pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.iceDone();
    return this.pc.localDescription.sdp;
  }
  async answer(sdp) {
    this.pc.ondatachannel = e => this.wire(e.channel);
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.iceDone();
    return this.pc.localDescription.sdp;
  }
  async accept(sdp) { await this.pc.setRemoteDescription({ type: 'answer', sdp }); }
  send(m, fast = false) {
    const ch = fast && this.fast && this.fast.readyState === 'open' ? this.fast : this.rel;
    if (ch && ch.readyState === 'open') ch.send(JSON.stringify(m));
  }
  close() {
    const was = this.open;
    this.open = false;
    try { this.pc.close(); } catch { /* closed */ }
    if (was) this.onclose();
  }
}

// ===================================================================== tank state
// everything but the pose: parts, damage, stowage, paint, patches, crew, fire
function tankState(t) {
  return {
    key: t.key, team: t.team, crew: t.crew, crewHp: Math.round(t.crewHp),
    parts: Object.fromEntries(Object.entries(t.parts).map(([k, p]) => [k, partData(p)])),
    hp: { hull: r2(t.hp.hull), transmission: r2(t.hp.transmission), ammo: r2(t.hp.ammo) },
    ammo: Math.floor(t.ammo),
    cargo: { weapons: t.cargo.weapons.map(weaponData), ammo: { ...t.cargo.ammo }, grenades: { ...t.cargo.grenades } },
    mg: weaponData(t.mg), bags: t.bags.length, ext: t.extinguishers, loot: { ...t.loot }, plates: [...t.plates],
    paint: t.paint, patches: patchData(t), wrecked: t.wrecked, derelict: !!t.derelict, bay: t.bayOpen, sink: t.sink,
    cap: t.caponier ? { x: t.caponier.x, z: t.caponier.z, h: t.caponier.heading } : null,
    troops: (t.troops || []).length,
    fire: t.fire ? { source: t.fire.source, selfOut: t.fire.selfOut, t: r2(t.fire.t), ext: t.fire.extinguish > 0 } : null,
  };
}

// bring a tank in line with a received state (parts are swapped only when their type differs)
function applyTankState(t, st) {
  for (const kind of ['turret', 'engine', 'fuel', 'drive', 'gun']) {
    const want = st.parts[kind], have = t.parts[kind];
    if (kind === 'turret') {
      if (!want) { if (have) t.removeTurret(); continue; }
      if (!have || have.key !== want.key) {
        if (have) t.removeTurret();
        t.installTurret(mkPart(want), null);
      }
    } else {
      if (kind === 'gun' && want && !t.canMountGun()) continue;
      if (!want) { if (have) t.setPart(kind, null, true); continue; }
      if (!have || have.key !== want.key) t.setPart(kind, mkPart(want), true);
    }
    const p = t.parts[kind];
    p.hp = want.hp;
    if (want.fuel !== undefined) p.fuel = want.fuel;
    if ((want.paint ?? null) !== (p.paint ?? null)) {
      p.paint = want.paint ?? null;
      if (p.vis && p.paint != null) paintObject(p.vis.group, p.paint);
    }
  }
  t.refresh();
  t.team = st.team;
  t.crew = st.crew;
  t.crewHp = st.crewHp;
  t.hp.hull = st.hp.hull; t.hp.transmission = st.hp.transmission; t.hp.ammo = st.hp.ammo;
  t.ammo = st.ammo;
  t.cargo.weapons = st.cargo.weapons.map(mkWeapon);
  t.cargo.ammo = { ...st.cargo.ammo };
  t.cargo.grenades = { ...st.cargo.grenades };
  if ((st.mg && st.mg.key) !== (t.mg && t.mg.key)) t.setMG(mkWeapon(st.mg));
  else if (t.mg && st.mg) t.mg.mag = st.mg.mag;
  while (t.bags.length < st.bags && t.addSandbag()) { /* heap them on */ }
  while (t.bags.length > st.bags && t.removeSandbag()) { /* take them off */ }
  t.extinguishers = st.ext;
  t.loot = { ...st.loot };
  t.plates = [...st.plates];
  t.derelict = st.derelict;
  if (st.paint != null && st.paint !== t.paint) t.paintTank(st.paint);
  const pk = JSON.stringify(st.patches);
  if (pk !== t.netPatches) {
    t.netPatches = pk;
    for (const p of t.patches()) p.removeFromParent();
    restorePatches(t, st.patches);
  }
  if (st.bay !== t.bayOpen) t.setBay(st.bay);
  t.troops = new Array(st.troops || 0).fill(null).map(() => ({ key: 'mosin', grenades: {} }));
  if (st.fire) {
    t.fire = t.fire || { max: st.fire.t, extinguish: 0 };
    Object.assign(t.fire, { source: st.fire.source, selfOut: st.fire.selfOut, t: st.fire.t, extinguish: st.fire.ext ? 1 : 0 });
  } else t.fire = null;
  if (st.wrecked && !t.wrecked) t.makeWreck();
}
const HP_KEYS = ['hull', 'transmission', 'ammo', 'engine', 'gun', 'fuel', 'turret'];
const hpOf = t => Object.fromEntries(HP_KEYS.map(k => [k, t.hp[k]]));

// ===================================================================== the game side
// G: what the game gives: { state, player, playerVel, camera, scene, world, tanks, items, combat, guns, infantry,
//   director, fx, sfx, sky, MODE, SEED, CFG, spawnTank, removeTank, msg, showHit, describeHit, damagePlayer,
//   enterVehicle(t, passengerRole), exitVehicle(), troopSeat(), startPos(), onVictory(text), onLost(text), ui }
export class Net {
  constructor(G, role) {
    this.G = G;
    this.role = role;               // 'host' | 'guest'
    this.host = role === 'host';
    this.link = null;
    this.connected = false;
    this.byNid = new Map();
    this.nid = 0;
    this.remote = null;             // the other player: last pose { pos, yaw, pitch, crouch, mode, veh, seat, weapon, eye }
    this.remoteVel = new THREE.Vector3();
    this.avatar = null;             // Soldier model of the other player
    this.puppetMap = new Map();     // guest: soldiers of the host's world
    this.shots = [];                // shots to pass on (batched)
    this.pushes = new Map();        // nid -> [dx, dz, dheading]: pushes of the other machine's tanks to pass on
    this.snapT = 0; this.stateT = 0; this.ownT = 0;
    this.applying = false;
    this.ui = G.ui;
    this.stats = { in: 0, out: 0 };
    this.hook();
  }

  get active() { return this.connected; }
  send(m, fast = false) { if (this.link && this.connected) { this.link.send(m, fast); this.stats.out++; } }

  // ------------------------------------------------ connection
  // host: make the offer and wait for the guest (room code through server.py, or invitation / answer codes)
  async startHosting() {
    const G = this.G;
    this.link = new Link();
    this.wireLink();
    this.ui.status('Сеть: готовлю приглашение...');
    const sdp = await this.link.offer();
    const offer = { mode: G.MODE, seed: G.SEED, start: G.state.startZ, tank: G.CFG.tank, enemies: G.CFG.enemies, sdp };
    const code = await pack(offer);
    if (!this.room && await Signal.available()) this.room = newRoom();
    if (this.room) {
      await Signal.put(this.room, 'answer', '');
      await Signal.put(this.room, 'offer', code);
      this.ui.hostRoom(this.room);
      this.pollAnswer(this.link);
    } else {
      this.ui.hostCode(code, async ans => {
        try { await this.link.accept((await unpack(ans)).sdp); } catch (e) { console.error(e); this.ui.status('Сеть: неверный код ответа'); }
      });
    }
  }
  async pollAnswer(link) {
    while (!this.connected && this.link === link) {
      const a = await Signal.get(this.room, 'answer');
      if (a) {
        try { await link.accept((await unpack(a)).sdp); } catch (e) { console.error(e); }
        await Signal.put(this.room, 'answer', '');
        return;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  // guest: answer the host's offer (payload from the menu: { offer, room, tank })
  async join(payload) {
    this.link = new Link();
    this.wireLink();
    this.joinTank = payload.tank;
    const sdp = await this.link.answer(payload.offer.sdp);
    const code = await pack({ sdp });
    if (payload.room) {
      await Signal.put(payload.room, 'answer', code);
      this.ui.guestWait(null);
    } else this.ui.guestWait(code);
  }
  wireLink() {
    const link = this.link;
    link.onmsg = m => { this.stats.in++; this.recv(m); };
    link.onopen = () => {
      if (this.link !== link) return;
      this.connected = true;
      this.ui.status(this.host ? 'Сеть: второй игрок подключается...' : 'Сеть: соединение установлено');
      if (!this.host) this.send({ k: 'hello', tank: this.joinTank || null });
    };
    link.onclose = () => { if (this.link === link) this.dropped(); };
  }
  dropped() {
    const G = this.G;
    this.connected = false;
    this.removeAvatar();
    if (this.host) {
      G.msg('Второй игрок отключился', '#ff9a7a');
      for (const t of G.tanks) if (t.netOwner === 'guest') { t.netOwner = 'host'; t.remote = false; t.remoteInside = false; }
      this.remote = null;
      this.ui.status('Сеть: второй игрок отключился — новое приглашение в меню паузы (ESC)');
      this.startHosting();
    } else {
      this.ui.status('Сеть: соединение потеряно');
      G.onLost('Соединение с хозяином игры потеряно.');
    }
  }

  // ------------------------------------------------ hooks into the game
  hook() {
    const G = this.G, { combat, guns, items, world } = G;
    // a tank driven on the other machine was pushed by one of ours: the pushes are summed up and sent to its owner
    Tank.onPush = (t, dx, dz, dh) => {
      if (!this.connected || !t.nid) return;
      const a = this.pushes.get(t.nid) || [0, 0, 0];
      a[0] += dx; a[1] += dz; a[2] += dh;
      this.pushes.set(t.nid, a);
    };
    // shells: the host sends the shells it fires, the guest sends its own (and flies a ghost of it)
    combat.onFired = (s, tank) => {
      if (!this.connected) return;
      if (this.host) this.send({ k: 'shell', n: tank.nid, p: v3(s.pos), v: v3(s.vel) });
      else { s.ghost = true; this.send({ k: 'fire', n: tank.nid, p: v3(s.pos), v: v3(s.vel), pen: s.pen, dmg: s.dmg }); }
    };
    if (this.host) {
      const hit0 = combat.hitTank.bind(combat);
      combat.hitTank = (tank, vol, point, dir, s) => {
        const before = hpOf(tank), bags = tank.bags.length;
        const res = hit0(tank, vol, point, dir, s);
        if (this.connected && tank.nid) this.sendHit(tank, res, before, bags, point, dir, s);
        return res;
      };
    } else guns.visual = true;
    guns.onFired = (origin, dir, W, owner, muzzle, tracer) => {
      if (!this.connected || (owner && (owner.replay || owner.remote))) return;
      const key = Object.keys(WEAPONS).find(k => WEAPONS[k] === W);
      this.shots.push([...v3(origin), r3(dir.x), r3(dir.y), r3(dir.z), key, ...v3(muzzle), tracer ? 1 : 0,
                       owner && owner.tank ? owner.tank.nid || 0 : 0]);
    };
    guns.onThrown = (pos, vel, key, owner) => {
      if (!this.connected || (owner && (owner.remote || owner.ghost))) return;
      if (!this.host) owner.ghost = true;                   // the guest's own grenade: the host throws the real one
      this.send({ k: 'gren', p: v3(pos), v: v3(vel), key });
    };
    // pickups: added (dropped) / taken on one side appear / vanish on the other
    const add0 = items.add.bind(items), rm0 = items.remove.bind(items);
    items.add = (id, type, x, z, data = null, y = null) => {
      const had = items.pickups.has(id) || items.taken.has(id);
      add0(id, type, x, z, data, y);
      if (this.connected && !this.applying && !had && items.pickups.has(id) && !/^s\d+:/.test(id)) {
        const p = items.pickups.get(id);
        this.send({ k: 'drop', id, type, x: r2(x), y: r2(p.pos.y), z: r2(z), d: pickupData(p) });
      }
    };
    items.remove = (id, taken = true) => {
      const had = items.pickups.has(id);
      rm0(id, taken);
      if (this.connected && !this.applying && had && taken) this.send({ k: 'take', id });
    };
    if (!this.host) items.dropPrefix = 'drop:g';
    // destruction of the world
    world.onTreeBroken = (t, y, dx, dz) => {
      if (this.connected && !this.applying) this.send({ k: 'tree', id: t.id, y: r3(y), dx: r3(dx), dz: r3(dz) });
    };
    world.onHouse = (kind, rec, point, dmg) => {
      if (this.connected && !this.applying) this.send({ k: 'house', id: rec.id, kind, p: point ? v3(point) : null, dmg });
    };
    // host: the other player can be shot, blasted; its kills are counted for it
    guns.onRemoteHit = dmg => this.send({ k: 'hurt', n: r2(dmg), b: 1 });
  }

  // tank ids (the host numbers every tank; the guest gets them with the tanks)
  register(t) {
    if (!t.nid) t.nid = ++this.nid;
    if (!t.netOwner) t.netOwner = 'host';
    this.byNid.set(t.nid, t);
  }
  tankRemoved(t) {
    if (!t.nid) return;
    this.byNid.delete(t.nid);
    if (this.host && t.netSent) this.send({ k: 'gone', n: t.nid });
  }

  // ------------------------------------------------ per frame
  update(dt) {
    const G = this.G;
    if (this.host) for (const t of G.tanks) if (!t.nid) this.register(t);
    this.updateAvatar(dt);
    if (!this.connected) return;
    for (const [n, a] of this.pushes) this.send({ k: 'push', n, d: [r3(a[0]), r3(a[1]), r3(a[2])] });
    this.pushes.clear();
    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = SNAP_DT;
      if (this.host) this.sendSnapshot(); else this.sendMe();
    }
    this.stateT -= dt;
    if (this.stateT <= 0) {
      this.stateT = STATE_DT;
      this.syncStates();
    }
    if (!this.host) this.guestClaims(dt);
  }

  // where the local player is and what it does
  mePose() {
    const G = this.G, s = G.state;
    const drive = s.mode === 'drive' && s.vehicle;
    const p = drive ? s.vehicle.root.position : G.player.position;
    const d = G.items.drawnWeapon && G.items.drawnWeapon();
    const ts = G.troopSeat();
    const eye = ts && ts.fire ? v3(G.camera.position) : null;
    return [...v3(p), r3(s.yaw), r3(s.pitch), s.crouch ? 1 : 0, drive ? 1 : 0, drive ? s.vehicle.nid || 0 : 0,
            s.seat || '', d && !G.items.hands ? d.w.key : (G.items.drawn === 'grenade' ? 'g' : ''), eye, s.dead ? 1 : 0, r2(s.aimK || 0)];
  }
  // the host's snapshot: its tanks (poses), soldiers, the host player, shots since the last one
  sendSnapshot() {
    const G = this.G;
    const a = this.remoteAnchor();
    const T = [];
    for (const t of G.tanks) {
      if (!t.nid || !t.netSent || t.netOwner === 'guest') continue;
      T.push([t.nid, ...t.netPose(), (t.crew ? 1 : 0) | (t.fire ? 2 : 0) | (t.wrecked ? 4 : 0)]);
    }
    const S = [];
    for (const s of G.infantry.soldiers) {
      if (a && Math.hypot(s.pos.x - a.x, s.pos.z - a.z) > SOLDIER_R) continue;
      S.push([s.id, s.weapon.key, s.kind, ...v3(s.pos), r2(s.heading), STANCES.indexOf(s.stance), r2(s.speedNow), r2(s.aimK), r2(s.pitch),
              (s.alive ? 1 : 0) | (s.reloadT > 0 ? 2 : 0) | (s.throwAnim > 0 ? 4 : 0) | (s.state === 'combat' || s.state === 'retreat' || s.state === 'alert' ? 8 : 0),
              r2(s.lookYaw || 0), r2(s.fallDir || 0)]);
    }
    const m = { k: 's', T, S, P: this.mePose(), H: r2(G.sky.time.tod) };
    if (G.state.duel) { const st = G.duelStatus(); if (st) m.D = [st.left, st.total]; }
    this.send(m, true);
    if (this.shots.length) { this.send({ k: 'sh', X: this.shots }); this.shots = []; }
  }
  sendMe() {
    const G = this.G;
    const T = [];
    for (const t of G.tanks) if (t.nid && t.netOwner === 'guest' && !t.remote) T.push([t.nid, ...t.netPose(), (t.fire ? 2 : 0) | (t.wrecked ? 4 : 0)]);
    this.send({ k: 'm', P: this.mePose(), T }, true);
    if (this.shots.length) { this.send({ k: 'sh', X: this.shots }); this.shots = []; }
  }
  // full states: host - tanks near the guest (sent when they come near / change, "gone" when they leave);
  // guest - the tanks it owns
  syncStates() {
    const G = this.G;
    if (this.host) {
      const a = this.remoteAnchor();
      if (!a) return;
      for (const t of G.tanks) {
        if (!t.nid) continue;
        const near = Math.hypot(t.root.position.x - a.x, t.root.position.z - a.z) < REL_R;
        if (!near) {
          if (t.netSent) { this.send({ k: 'gone', n: t.nid }); t.netSent = false; t.netLast = null; }
          continue;
        }
        if (t.netOwner === 'guest') continue;
        this.sendState(t);
      }
    } else {
      for (const t of G.tanks) if (t.nid && t.netOwner === 'guest' && !t.remote) this.sendState(t);
    }
  }
  sendState(t, force = false) {
    const st = tankState(t);
    const js = JSON.stringify(st);
    if (!force && js === t.netLast && t.netSent) return;
    t.netLast = js;
    t.netSent = true;
    this.send({ k: 'tank', n: t.nid, st, pose: t.netPose() });
  }
  remoteAnchor() {
    const r = this.remote;
    if (!r) return this.connected ? this.G.player.position : null;
    return r.pos;
  }

  // the other player as a target of the enemy (host)
  remoteTarget() {
    const r = this.remote;
    if (!this.host || !this.connected || !r || r.dead) return null;
    if (r.mode && r.veh) {
      const t = this.byNid.get(r.veh);
      if (t) return { id: 'remote', pos: t.root.position, vel: t.velocity, isTank: true, tank: t, remote: true };
    }
    return { id: 'remote', pos: r.pos, vel: this.remoteVel, isTank: false, crouch: r.crouch, remote: true };
  }
  partnerPos() { return this.remote ? this.remote.pos.clone() : null; }

  // ------------------------------------------------ receive
  recv(m) {
    const h = this[`on_${m.k}`];
    if (!h) return;
    this.applying = true;
    try { h.call(this, m); } catch (e) { console.error('net', m.k, e); }
    this.applying = false;
  }

  // ---- host side
  on_hello(m) {
    const G = this.G;
    // where the guest starts: beside the host; in a duel / on the range with its own tank
    const a = G.state.vehicle ? G.state.vehicle.root.position : G.player.position;
    const hd = G.state.vehicle ? G.state.vehicle.heading : G.state.yaw;
    const side = new THREE.Vector3(Math.cos(hd), 0, -Math.sin(hd));
    let tank = null;
    const sp = a.clone().addScaledVector(side, G.MODE === 'road' ? -6 : -14);
    const me = sp.clone().addScaledVector(side, G.MODE === 'road' ? 0 : 4);
    if (G.MODE !== 'road') {
      const key = m.tank && HULLS[m.tank] ? m.tank : G.CFG.tank && HULLS[G.CFG.tank] ? G.CFG.tank : 't26';
      tank = G.spawnTank(key, sp.x, sp.z, hd, { team: 'player' });
      this.register(tank);
      tank.netOwner = 'guest';
      tank.remote = true;
      tank.setNetPose(tank.netPose(), true);
    }
    const pos = [r2(me.x), r2(G.world.heightAt(me.x, me.z)), r2(me.z)];
    this.remote = { pos: new THREE.Vector3(...pos), yaw: hd, pitch: 0, crouch: false, mode: 0, veh: 0, seat: '', weapon: '', dead: false };
    // the world as it is: what is broken, taken, lying around, and the tanks around the guest
    const items = G.items;
    const near = p => Math.hypot(p.x - pos[0], p.z - pos[2]) < REL_R;
    this.send({
      k: 'world',
      taken: [...items.taken].filter(id => /^s\d+:/.test(id)),
      pickups: [...items.pickups.values()].filter(p => !/^s\d+:/.test(p.id) && near(p.pos))
        .map(p => ({ id: p.id, type: p.type, x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), d: pickupData(p) })),
      ruins: [...G.world.ruins], trees: [...G.world.brokenTrees.entries()], time: G.state.time,
    });
    for (const t of G.tanks) { this.register(t); if (near(t.root.position)) { t.netSent = false; this.sendState(t, true); } }
    this.send({ k: 'welcome', pos, yaw: hd, tank: tank ? tank.nid : 0, nid: this.nid });
    G.msg('Второй игрок в игре!', '#9fe07f');
    this.ui.status('Сеть: второй игрок в игре');
    this.ui.connected();
  }
  on_m(m) {
    const G = this.G;
    this.setRemote(m.P);
    for (const row of m.T) {
      const t = this.byNid.get(row[0]);
      if (t && t.netOwner === 'guest') t.setNetPose(row.slice(1, 14));
    }
    // where the guest sits
    for (const t of G.tanks) t.remoteInside = !!(this.remote.mode && t.nid === this.remote.veh);
    G.guns.remoteFoot = this.remote.mode || this.remote.dead ? null : { pos: this.remote.pos, active: true, crouch: this.remote.crouch };
    G.guns.remoteExposed = this.remote.eye ? { pos: this.remote.eye } : null;
  }
  on_fire(m) {
    const t = this.byNid.get(m.n);
    this.G.combat.launch({ pos: new THREE.Vector3(...m.p), vel: new THREE.Vector3(...m.v), pen: m.pen, dmg: m.dmg, owner: t || null });
    this.G.infantry.noise(new THREE.Vector3(...m.p), 280);
  }
  on_claim(m) {
    const G = this.G, t = this.byNid.get(m.n);
    if (!t) return;
    if (t === G.state.vehicle || t.crew || t.craneLock || G.state.stash === t) {
      this.send({ k: 'owner', n: t.nid, who: 'host', deny: true });
      this.sendState(t, true);
      return;
    }
    t.netOwner = 'guest';
    t.remote = true;
    t.setNetPose(t.netPose(), true);
    G.director.release(t);
    if (G.state.repairTarget === t) G.closeMenus();
    this.send({ k: 'owner', n: t.nid, who: 'guest' });
  }
  on_release(m) {
    const t = this.byNid.get(m.n);
    if (!t || t.netOwner !== 'guest') return;
    if (m.st) applyTankState(t, m.st);
    if (m.pose) { t.setNetPose(m.pose, true); t.netStep(0); }
    t.netOwner = 'host';
    t.remote = false;
    t.remoteInside = false;
    t.netLast = null;
  }

  // ---- guest side
  on_welcome(m) {
    const G = this.G;
    this.nid = m.nid;
    G.player.position.set(...m.pos);
    G.state.yaw = m.yaw;
    this.remote = this.remote || { pos: G.player.position.clone(), yaw: 0, pitch: 0, crouch: false, mode: 0, veh: 0 };
    G.startGuest();
    if (m.tank) {
      const t = this.byNid.get(m.tank);
      if (t) { t.netOwner = 'guest'; t.remote = false; G.enterVehicle(t); }
    }
    this.ui.status('Сеть: в игре');
    this.ui.connected();
  }
  on_world(m) {
    const G = this.G, { items, world } = G;
    for (const id of m.taken) { items.taken.add(id); items.remove(id, true); }
    for (const p of m.pickups) items.add(p.id, p.type, p.x, p.z, this.pickupFrom(p.type, p.d), p.y ?? null);
    for (const id of m.ruins) {
      world.ruins.add(id);
      const rec = this.houseById(id);
      if (rec && !rec.ruined) rec.ruin();
    }
    for (const [id, b] of m.trees) {
      world.brokenTrees.set(id, b);
      const t = world.treeById(id);
      if (t && !t.broken) {
        world.breakTree(t, b.y, b.dx, b.dz, true);
        if (b.y2 != null) world.cutStump(t, b.y2, b.dx2, b.dz2, true);
      }
    }
    G.state.time = m.time;
  }
  on_s(m) {
    const G = this.G;
    for (const row of m.T) {
      const t = this.byNid.get(row[0]);
      if (!t || !t.remote) continue;
      t.setNetPose(row.slice(1, 14));
      const f = row[14];
      t.crew = !!(f & 1);
      if (f & 2) { if (!t.fire) t.fire = { source: 'fuel', selfOut: true, t: 5, max: 5, extinguish: 0 }; }
      else if (t.fire && t.netOwner !== 'guest') t.fire = null;
    }
    // soldiers of the host's world
    const seen = new Set();
    for (const r of m.S) {
      seen.add(r[0]);
      let s = this.puppetMap.get(r[0]);
      if (!s) {
        s = new Soldier(G.scene, new THREE.Vector3(r[3], r[4], r[5]), { key: r[1], kind: r[2], heading: r[6] });
        s.netId = r[0];
        s.puppet = true;
        this.puppetMap.set(r[0], s);
        G.infantry.soldiers.push(s);
      }
      s.net = { x: r[3], y: r[4], z: r[5], heading: r[6] };
      s.setStance(STANCES[r[7]] || 'stand');
      s.netSpeed = r[8];
      s.aimK = r[9];
      s.pitch = r[10];
      const f = r[11];
      s.reloadT = f & 2 ? 1 : 0;
      s.throwAnim = f & 4 ? Math.max(s.throwAnim, 0.3) : 0;
      s.state = f & 8 ? 'combat' : 'idle';
      s.lookYaw = r[12];
      if (!(f & 1) && s.alive) { s.alive = false; s.fallDir = r[13]; s.hp = 0; }
    }
    for (const [id, s] of this.puppetMap) {
      if (seen.has(id)) continue;
      s.dispose();
      this.puppetMap.delete(id);
      const i = G.infantry.soldiers.indexOf(s);
      if (i >= 0) G.infantry.soldiers.splice(i, 1);
    }
    this.setRemote(m.P);
    if (m.D) G.state.netDuel = m.D;
    // the time of day runs on the host (the guest's clock only fills the gaps)
    if (m.H != null && Math.abs(m.H - G.sky.time.tod) > 0.05) G.sky.setTime(m.H);
  }
  // guest: move the soldiers of the host's world
  puppets(dt) {
    const k = 1 - Math.exp(-dt * 10);
    for (const s of this.puppetMap.values()) {
      if (!s.alive) { s.animateDeath(dt); continue; }
      const n = s.net;
      if (n) {
        s.pos.x += (n.x - s.pos.x) * k; s.pos.y += (n.y - s.pos.y) * k; s.pos.z += (n.z - s.pos.z) * k;
        s.heading += Math.atan2(Math.sin(n.heading - s.heading), Math.cos(n.heading - s.heading)) * k;
      }
      s.speedNow = s.netSpeed || 0;
      if (s.throwAnim > 0) s.throwAnim -= dt;
      s.animate(dt);
    }
  }
  on_shell(m) {
    this.G.combat.launch({ pos: new THREE.Vector3(...m.p), vel: new THREE.Vector3(...m.v), pen: 0, dmg: 0,
                           owner: this.byNid.get(m.n) || null, ghost: true });
  }
  on_owner(m) {
    const G = this.G, t = this.byNid.get(m.n);
    if (!t) return;
    if (m.who === 'guest') { t.netOwner = 'guest'; t.remote = false; return; }
    t.netOwner = 'host';
    t.remote = true;
    t.setNetPose(t.netPose(), true);
    if (G.state.vehicle === t && !G.troopSeat()) {
      G.exitVehicle();
      G.msg(m.deny ? 'Этот танк сейчас занят' : 'Танк перешёл под управление хозяина игры', '#e8c96a');
    }
    if (G.state.stash === t) G.closeMenus();
  }
  // our tank was pushed by one driven on the other machine
  on_push(m) {
    const t = this.byNid.get(m.n);
    if (!t || t.remote) return;
    t.root.position.x += m.d[0]; t.root.position.z += m.d[1];
    t.heading += m.d[2];
    this.G.world.collideObstacles(t.root.position, t.def.radius * 0.8, null, 2.6);
  }
  on_hurt(m) { this.G.damagePlayer(m.n, !!m.b); }
  on_kill(m) {
    const G = this.G;
    if (m.what === 'inf') { G.state.infKills++; G.showHit(m.tank ? 'Пехотинец уничтожен' : 'Противник убит'); }
    else { G.state.kills++; G.msg(m.text, '#9fe07f'); }
  }
  on_victory(m) { this.G.onVictory(m.text); }
  on_msg(m) { this.G.msg(m.text, m.color); }

  // ---- both sides
  on_tank(m) {
    const G = this.G;
    let t = this.byNid.get(m.n);
    const st = m.st;
    if (!t) {
      if (this.host) return;                    // the guest never makes tanks
      t = G.spawnTank(st.key, m.pose[0], m.pose[2], m.pose[3], { team: st.team, crew: st.crew, parts: {}, mg: null, bags: 0, ammo: st.ammo });
      t.nid = m.n;
      t.netOwner = 'host';
      t.remote = true;
      this.byNid.set(t.nid, t);
      if (st.cap) { t.caponier = buildCaponier(G.world, st.cap.x, st.cap.z, st.cap.h); t.caponier.heading = st.cap.h; }
      t.sink = st.sink || 0;
      t.setNetPose(m.pose, true);
    }
    // the guest's own tank is its own business; the host takes the states of the tanks the guest owns
    if (!this.host && t.netOwner === 'guest' && !t.remote) return;
    if (this.host && t.netOwner !== 'guest') return;
    applyTankState(t, st);
    if (m.pose && t.remote) t.setNetPose(m.pose);
  }
  on_gone(m) {
    const t = this.byNid.get(m.n);
    if (!t || this.host) return;
    if (this.G.state.vehicle === t) return;      // still sitting in it: keep it
    if (t.caponier) { t.caponier.dispose(); t.caponier = null; }
    this.G.removeTank(t);
    this.byNid.delete(m.n);
  }
  on_sh(m) {
    const G = this.G;
    for (const x of m.X) {
      const W = WEAPONS[x[6]];
      if (!W) continue;
      const o = new THREE.Vector3(x[0], x[1], x[2]), d = new THREE.Vector3(x[3], x[4], x[5]).normalize();
      const muzzle = new THREE.Vector3(x[7], x[8], x[9]);
      const tank = x[11] ? this.byNid.get(x[11]) : null;
      // on the host these are the guest's rounds: real ones (its kills are counted for it)
      const owner = this.host ? { player: true, remote: true, tank: tank || undefined } : { replay: true, tank: tank || undefined };
      G.guns.fire(o, d, W, owner, muzzle, !!x[10]);
    }
  }
  on_gren(m) {
    const owner = this.host ? { player: true, remote: true } : { ghost: true };
    this.G.guns.throwGrenade(new THREE.Vector3(...m.p), new THREE.Vector3(...m.v), m.key, owner);
  }
  on_drop(m) {
    if (this.G.items.pickups.has(m.id)) return;
    this.G.items.add(m.id, m.type, m.x, m.z, this.pickupFrom(m.type, m.d), m.y ?? null);
  }
  on_take(m) {
    const items = this.G.items;
    if (items.pickups.has(m.id)) items.remove(m.id, true);
    else items.taken.add(m.id);                 // not built here yet (far away): don't let it appear later
  }
  on_tree(m) {
    const w = this.G.world, t = w.treeById(m.id);
    if (t) w.breakTree(t, m.y, m.dx, m.dz);
    else if (!w.brokenTrees.has(m.id)) w.brokenTrees.set(m.id, { y: m.y, dx: m.dx, dz: m.dz });
  }
  on_house(m) {
    const rec = this.houseById(m.id);
    if (!rec) { if (m.kind === 'ruin') this.G.world.ruins.add(m.id); return; }
    if (m.kind === 'ruin') rec.ruin();
    else rec.hit(new THREE.Vector3(...m.p), null, m.dmg, true);
  }
  on_hit(m) {
    const G = this.G, t = this.byNid.get(m.n);
    if (!t) return;
    const own = !this.host && t.netOwner === 'guest' && !t.remote;
    if (m.mk) t.addMark(new THREE.Vector3(...m.mk[0]), new THREE.Vector3(...m.mk[1]), m.mk[2]);
    if (own) {
      for (const [k, d] of Object.entries(m.d)) t.damage(k, d);
      if (m.fire && !t.fire) t.startFire(m.fire, false);
      for (let i = 0; i < m.bags; i++) t.removeSandbag(m.face);
      if (m.destroyed && !t.wrecked) t.makeWreck();
    } else {
      for (const [k, d] of Object.entries(m.d)) t.damage(k, d);
      if (m.destroyed && !t.wrecked) t.makeWreck();
    }
    if (t === G.state.vehicle) {
      G.ownHit(m.res);
      if (m.crew) G.damagePlayer(m.crew);
    }
    if (m.destroyed) G.fx.explosion(t.root.position.clone().setY(t.root.position.y + 2), 2, false);
    if (m.mine) G.showHit(G.describeHit(m.res));
  }

  // ------------------------------------------------ host: hits, kills
  sendHit(tank, res, before, bags, point, dir, s) {
    const d = {};
    for (const k of HP_KEYS) {
      const dd = before[k] - tank.hp[k];
      if (dd > 0.01) d[k] = r2(dd);
    }
    const kind = res.wreckHit ? 'dent' : res.ricochet ? 'scrape' : res.pen ? 'hole' : 'dent';
    const mine = !!(s.owner && s.owner.netOwner === 'guest');
    if (!tank.netSent && !mine) return;
    this.send({
      k: 'hit', n: tank.nid, d, fire: res.fire, crew: res.remoteCrew || 0, bags: Math.max(0, bags - tank.bags.length), face: res.face,
      destroyed: res.destroyed, mk: [v3(point), [r3(dir.x), r3(dir.y), r3(dir.z)], kind], mine,
      res: { pen: res.pen, ricochet: res.ricochet, modules: res.modules, crewKilled: res.crewKilled, destroyed: res.destroyed,
             bail: res.bail, bagLost: res.bagLost, fire: res.fire, wreckHit: res.wreckHit },
    });
    if (mine && (res.crewKilled || res.destroyed || res.bail) && tank.team === 'enemy' && !tank.counted) {
      tank.counted = true;
      this.send({ k: 'kill', what: 'tank', text: res.destroyed ? `${tank.def.name} противника уничтожен` : `Экипаж ${tank.def.name} выведен из строя` });
    }
  }
  // a soldier killed by the guest
  infantryKilled(owner) {
    if (owner && (owner.remote || owner.netOwner === 'guest')) { this.send({ k: 'kill', what: 'inf', tank: !!(owner.tank || owner.netOwner) }); return true; }
    return false;
  }
  // blasts reach the other player (on foot or riding exposed)
  explosion(pos, r, dmg) {
    const rm = this.remote;
    if (!this.host || !this.connected || !rm || rm.dead) return;
    const at = rm.eye || (!rm.mode ? new THREE.Vector3(rm.pos.x, rm.pos.y + 0.8, rm.pos.z) : null);
    if (!at) return;
    const d = at.distanceTo(pos);
    if (d < r) this.send({ k: 'hurt', n: r2(dmg * (1 - d / r) * 0.9) });
  }
  // a soldier crewed a tank the guest owned: it is the host's again
  takeBack(t) {
    if (!t || t.netOwner !== 'guest') return;
    t.netOwner = 'host';
    t.remote = false;
    t.remoteInside = false;
    t.netLast = null;
    this.send({ k: 'owner', n: t.nid, who: 'host' });
  }

  // ------------------------------------------------ owning tanks
  // can the local player get at tank t (walk up to it, work on it)? Not the other player's, not one the other
  // player is working on right now (a carrier the other player drives can be ridden in)
  usable(t) {
    if (!this.connected || !t.nid) return true;
    const r = this.remote;
    const theirs = r && r.mode && r.veh === t.nid;
    if (theirs) return !!t.apc;
    const busy = r && !r.mode && Math.hypot(r.pos.x - t.root.position.x, r.pos.z - t.root.position.z) < 6;
    if (this.host) {
      if (t.netOwner !== 'guest') return true;
      if (busy) return false;
      this.takeBack(t);
      return true;
    }
    if (t.netOwner === 'guest' && !t.remote) return true;
    return !busy;
  }
  // may the local player use tank t? true (claimed / its own), 'ride' (a seat in the other player's carrier), false
  claim(t) {
    const G = this.G;
    if (!this.connected || !t.nid) return true;
    if (this.host) {
      const r = this.remote;
      if (t.netOwner === 'guest' && r && r.mode && r.veh === t.nid) {
        if (t.apc) return 'ride';
        G.msg('В этом танке второй игрок', '#e8c96a');
        return false;
      }
      this.takeBack(t);
      return true;
    }
    if (t.netOwner === 'guest' && !t.remote) return true;
    const r = this.remote;
    if (r && r.mode && r.veh === t.nid) {
      if (t.apc && t.seats().some(s => s.troop)) return 'ride';
      G.msg('В этом танке второй игрок', '#e8c96a');
      return false;
    }
    if (t.crew && !t.wrecked) return false;
    t.netOwner = 'guest';
    t.remote = false;
    this.send({ k: 'claim', n: t.nid });
    return true;
  }
  // claim what the guest works on, give back what it left behind
  guestClaims(dt) {
    const G = this.G, s = G.state;
    this.claimT = (this.claimT || 0) - dt;
    if (this.claimT > 0) return;
    this.claimT = 0.5;
    if (s.mode === 'walk' && s.nearTank && s.nearTank.remote && !s.nearTank.crew) {
      const r = this.remote;
      if (!(r && r.mode && r.veh === s.nearTank.nid)) this.claim(s.nearTank);
    }
    const me = s.mode === 'drive' && s.vehicle ? s.vehicle.root.position : G.player.position;
    for (const t of G.tanks) {
      if (t.netOwner !== 'guest' || t.remote || t === s.vehicle || t === s.stash) continue;
      if (Math.hypot(t.root.position.x - me.x, t.root.position.z - me.z) > 14) {
        t.netOwner = 'host';
        t.remote = true;
        this.send({ k: 'release', n: t.nid, st: tankState(t), pose: t.netPose() });
        t.setNetPose(t.netPose(), true);
      }
    }
  }

  // ------------------------------------------------ the other player's figure
  setRemote(P) {
    if (!P) return;
    const prev = this.remote && this.remote.pos.clone();
    const r = this.remote || (this.remote = { pos: new THREE.Vector3() });
    r.pos.set(P[0], P[1], P[2]);
    if (prev) {
      const dt = Math.max(0.03, (performance.now() - (r.at || 0)) / 1000);
      this.remoteVel.set((r.pos.x - prev.x) / dt, 0, (r.pos.z - prev.z) / dt);
      if (this.remoteVel.length() > 30) this.remoteVel.set(0, 0, 0);
    }
    r.at = performance.now();
    r.yaw = P[3]; r.pitch = P[4]; r.crouch = !!P[5]; r.mode = P[6]; r.veh = P[7]; r.seat = P[8]; r.weapon = P[9];
    r.eye = P[10] ? new THREE.Vector3(...P[10]) : null;
    r.dead = !!P[11];
    r.aimK = P[12] || 0;
  }
  removeAvatar() {
    if (this.avatar) { this.avatar.dispose(); this.avatar = null; }
  }
  updateAvatar(dt) {
    const r = this.remote;
    if (!this.connected || !r || r.dead) { this.removeAvatar(); return; }
    // on foot: a figure; riding in the open back of a carrier: crouched behind the side
    const riding = r.mode && r.eye;
    if (r.mode && !riding) { this.removeAvatar(); return; }
    const key = r.weapon && r.weapon !== 'g' && WEAPONS[r.weapon] ? r.weapon : 'mosin';
    if (this.avatar && this.avatar.weaponKeyShown !== key) this.removeAvatar();
    if (!this.avatar) {
      this.avatar = new Soldier(this.G.scene, r.pos.clone(), { key, kind: 'ally', heading: r.yaw });
      this.avatar.weaponKeyShown = key;
      this.avatar.state = 'combat';
    }
    const a = this.avatar;
    const target = riding ? r.eye.clone().setY(r.eye.y - 1.05) : r.pos;
    const k = 1 - Math.exp(-dt * 12);
    const ox = a.pos.x, oz = a.pos.z;
    a.pos.x += (target.x - a.pos.x) * k; a.pos.y += (target.y - a.pos.y) * k; a.pos.z += (target.z - a.pos.z) * k;
    a.heading = r.yaw;
    a.pitch = r.pitch;
    a.setStance(riding || r.crouch ? 'crouch' : 'stand');
    a.speedNow = riding ? 0 : Math.hypot(a.pos.x - ox, a.pos.z - oz) / Math.max(dt, 1e-3);
    a.aimK = r.weapon ? Math.max(0.3, r.aimK) : 0;
    a.animate(dt);
    a.root.rotation.y = r.yaw;
  }

  // ------------------------------------------------ helpers
  pickupFrom(type, d) {
    if (d == null) return null;
    if (type === 'part') return mkPart(d);
    if (type === 'weapon') return mkWeapon(d);
    if (type === 'sandbag') return d.place ? { place: d.place } : null;
    return { ...d };
  }
  houseById(id) {
    for (const o of this.G.world.obstacles) if (o.house && o.house.id === id) return o.house;
    return null;
  }
  victory(text) { this.send({ k: 'victory', text }); }
}
