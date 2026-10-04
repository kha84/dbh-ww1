// Static obstacles of the world: oriented boxes (centre x,z, half extents hx (local X) / hz (local Z), rotation rot
// about Y, heights y0..y1). Things walk / drive against them (pushOut) and shots stop at them (segBox).
//
// Compound obstacles (houses): the box bounds the whole building and `sub` lists its pieces (wall segments between
// the door / window openings, furniture, floor slabs). Movement and rays go through the openings: only the pieces
// count, the bounding box just rejects what is far away. A piece with `noPush` (floor slab) stops rays only.

// precompute what the tests need (cos / sin of the rotation, bounding radius); also for the pieces of a compound
export function prepObstacle(o) {
  o.cos = Math.cos(o.rot || 0);
  o.sin = Math.sin(o.rot || 0);
  o.rad = Math.hypot(o.hx, o.hz);
  if (o.sub) for (const s of o.sub) prepObstacle(s);
  return o;
}

// slab test: segment (a->b) vs AABB; returns entry t in [0,1] or null
export function segBox(ax, ay, az, bx, by, bz, minx, miny, minz, maxx, maxy, maxz) {
  let t0 = 0, t1 = 1;
  const d = [bx - ax, by - ay, bz - az];
  const o = [ax, ay, az];
  const mn = [minx, miny, minz], mx = [maxx, maxy, maxz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mn[i] || o[i] > mx[i]) return null;
    } else {
      let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i];
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
  }
  return t0;
}

// segment p0->p1 vs one oriented box; entry t or null
export function segObstacle(o, p0, p1) {
  const ax = p0.x - o.x, az = p0.z - o.z;
  const bx = p1.x - o.x, bz = p1.z - o.z;
  const l0x = ax * o.cos - az * o.sin, l0z = ax * o.sin + az * o.cos;
  const l1x = bx * o.cos - bz * o.sin, l1z = bx * o.sin + bz * o.cos;
  return segBox(l0x, p0.y, l0z, l1x, p1.y, l1z, -o.hx, o.y0, -o.hz, o.hx, o.y1, o.hz);
}

// push a circle (pos = feet, radius r, height h) out of an oriented box obstacle; returns true on contact.
// Boxes below the feet (stepped over) or above the head (a lintel over a doorway) don't count.
export function pushOut(o, pos, r, h = 1.8) {
  const dx = pos.x - o.x, dz = pos.z - o.z;
  const lim = o.rad + r;
  if (dx * dx + dz * dz > lim * lim) return false;
  if (o.y1 !== undefined && pos.y > o.y1 + Math.min(0.3, h)) return false;
  if (o.y0 !== undefined && pos.y !== undefined && pos.y + h < o.y0) return false;
  if (o.sub) {
    let hit = false;
    for (const s of o.sub) if (!s.noPush && pushOut(s, pos, r, h)) hit = true;
    return hit;
  }
  const lx = dx * o.cos - dz * o.sin;
  const lz = dx * o.sin + dz * o.cos;
  const cx = Math.max(-o.hx, Math.min(o.hx, lx));
  const cz = Math.max(-o.hz, Math.min(o.hz, lz));
  const ddx = lx - cx, ddz = lz - cz;
  const d2 = ddx * ddx + ddz * ddz;
  let nlx, nlz;
  if (d2 === 0) {
    // centre inside: push out along the axis of least penetration
    const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
    if (px < pz) { nlx = Math.sign(lx || 1) * (o.hx + r); nlz = lz; }
    else { nlx = lx; nlz = Math.sign(lz || 1) * (o.hz + r); }
  } else if (d2 < r * r) {
    const d = Math.sqrt(d2);
    nlx = cx + ddx / d * r;
    nlz = cz + ddz / d * r;
  } else return false;
  pos.x = o.x + nlx * o.cos + nlz * o.sin;
  pos.z = o.z - nlx * o.sin + nlz * o.cos;
  return true;
}
