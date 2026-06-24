import {
  WORLD_W,
  WORLD_H,
  MOVE_SPEED,
  DECEL,
  PLAYER_RADIUS,
  PLAYER_MAX_HP,
  PLAYER_COLORS,
  HAZARD_CONTACT_DAMAGE,
  HAZARD_KNOCKBACK,
} from "./config.js";
import { getWeapon, STARTER_WEAPON } from "./weapons.js";
import { createZone, updateZone, isOutsideZone, zoneSnapshot } from "./zone.js";
import { spawnLoot, touchingLoot, applyLoot } from "./loot.js";
import { spawnHazards, updateHazards, splitHazard, HAZARD_MAX } from "./hazards.js";

export const match = {
  active: false,
  phase: "drop", // 'drop' | 'play' | 'end'
  players: new Map(), // id -> player state
  bullets: [],
  hazards: [],
  loot: [],
  zone: null,
  feed: [], // [{ text, t }] recent kill-feed entries
  startCount: 0, // how many started (for placement)
  winner: null,
  phaseEndsAt: 0, // ms timestamp the current timed phase ends
};

function makePlayer(member, index) {
  return {
    id: member.id,
    name: member.name || "Pilot",
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    vx: 0,
    vy: 0,
    rot: 0,
    hp: PLAYER_MAX_HP,
    shieldHp: 0,
    alive: true,
    weapon: STARTER_WEAPON,
    ammo: Infinity,
    kills: 0,
    placement: 0,
    // Parachute phase: chosen landing spot (defaults to a random scatter).
    dropX: WORLD_W * (0.25 + Math.random() * 0.5),
    dropY: WORLD_H * (0.25 + Math.random() * 0.5),
    landed: false,
    lastFire: 0,
    invulnUntil: 0,
    thrusting: false,
  };
}

// Builds a fresh match from the lobby roster. Call on the host only.
export function startMatch(roster, nowMs) {
  match.players = new Map();
  roster.slice(0, 4).forEach((m, i) => match.players.set(m.id, makePlayer(m, i)));
  match.bullets = [];
  match.hazards = spawnHazards();
  match.loot = spawnLoot();
  match.zone = createZone(nowMs);
  match.feed = [];
  match.winner = null;
  match.phase = "drop";
  match.startCount = match.players.size;
  match.active = true;
  match.phaseEndsAt = nowMs; // overwritten by br.js via setDropDeadline
}

export function setDropDeadline(t) {
  match.phaseEndsAt = t;
}

// Latest input from a client (or the host's own). Stored, applied each step.
const inputs = new Map(); // id -> { rot, dx, dy, firing }
export function setInput(id, input) {
  inputs.set(id, input);
}
export function setDrop(id, x, y) {
  const p = match.players.get(id);
  if (p && match.phase === "drop") {
    p.dropX = Math.max(60, Math.min(WORLD_W - 60, x));
    p.dropY = Math.max(60, Math.min(WORLD_H - 60, y));
  }
}

function addFeed(text, nowMs) {
  match.feed.push({ text, t: nowMs });
  if (match.feed.length > 5) match.feed.shift();
}

function damagePlayer(p, amount, attackerId, nowMs) {
  if (!p.alive || nowMs < p.invulnUntil) return;
  // Shield soaks damage first.
  if (p.shieldHp > 0) {
    const absorbed = Math.min(p.shieldHp, amount);
    p.shieldHp -= absorbed;
    amount -= absorbed;
  }
  p.hp -= amount;
  if (p.hp <= 0) {
    p.hp = 0;
    // Placement = how many were alive at the moment of death (incl. self).
    let aliveNow = 0;
    for (const q of match.players.values()) if (q.alive) aliveNow++;
    p.alive = false;
    p.placement = aliveNow;
    const killer = attackerId ? match.players.get(attackerId) : null;
    if (killer && killer.id !== p.id) {
      killer.kills++;
      addFeed(`${killer.name} eliminated ${p.name}`, nowMs);
    } else {
      addFeed(`${p.name} was eliminated`, nowMs);
    }
  }
}

function fire(p, weapon, nowMs) {
  if (nowMs - p.lastFire < weapon.fireInterval) return;
  if (!weapon.infinite && p.ammo <= 0) {
    // Out of ammo: drop back to the starter pistol.
    p.weapon = STARTER_WEAPON;
    p.ammo = Infinity;
    return;
  }
  p.lastFire = nowMs;
  if (!weapon.infinite) p.ammo--;

  for (let i = 0; i < weapon.pellets; i++) {
    const spread = (Math.random() - 0.5) * weapon.spread;
    const a = p.rot + spread;
    match.bullets.push({
      x: p.x + Math.cos(p.rot) * (PLAYER_RADIUS + 6),
      y: p.y + Math.sin(p.rot) * (PLAYER_RADIUS + 6),
      vx: Math.cos(a) * weapon.bulletSpeed,
      vy: Math.sin(a) * weapon.bulletSpeed,
      owner: p.id,
      damage: weapon.damage,
      color: weapon.color,
      dist: 0,
      maxDist: weapon.bulletRange,
    });
  }
}

function aliveCount() {
  let n = 0;
  for (const p of match.players.values()) if (p.alive) n++;
  return n;
}

// Advances the simulation by one frame. Host only.
export function step(nowMs) {
  if (!match.active) return;

  if (match.phase === "drop") {
    if (nowMs >= match.phaseEndsAt) {
      // Land everyone at their chosen spot and begin the round.
      for (const p of match.players.values()) {
        p.x = p.dropX;
        p.y = p.dropY;
        p.landed = true;
      }
      match.phase = "play";
      match.zone.phaseStart = nowMs;
    }
    return; // No combat during the drop-selection phase.
  }

  if (match.phase === "end") return;

  // ----- PLAY phase -----
  const dps = updateZone(match.zone, nowMs);

  for (const p of match.players.values()) {
    if (!p.alive) continue;
    const inp = inputs.get(p.id) || { rot: p.rot, dx: 0, dy: 0, firing: false };
    p.rot = inp.rot;

    // Movement (normalised so diagonals aren't faster).
    const dx = inp.dx || 0;
    const dy = inp.dy || 0;
    p.thrusting = dx !== 0 || dy !== 0;
    if (p.thrusting) {
      const len = Math.hypot(dx, dy);
      p.vx = (dx / len) * MOVE_SPEED;
      p.vy = (dy / len) * MOVE_SPEED;
    } else {
      p.vx *= DECEL;
      p.vy *= DECEL;
    }
    p.x += p.vx;
    p.y += p.vy;
    // Keep ships inside the world bounds.
    p.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_W - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_H - PLAYER_RADIUS, p.y));

    // Firing.
    if (inp.firing) fire(p, getWeapon(p.weapon), nowMs);

    // Zone damage (applied ~once per frame at 60fps => dps/60).
    if (dps > 0 && isOutsideZone(match.zone, p.x, p.y)) {
      damagePlayer(p, dps / 60, null, nowMs);
    }

    // Loot pickup.
    for (let i = match.loot.length - 1; i >= 0; i--) {
      if (touchingLoot(p, match.loot[i])) {
        applyLoot(p, match.loot[i]);
        match.loot.splice(i, 1);
      }
    }
  }

  // Hazards drift. They are SOLID: a ship can't pass through one — it gets
  // shoved back out to the rock's surface and knocked away, taking contact
  // damage on a short cooldown.
  updateHazards(match.hazards);
  for (const p of match.players.values()) {
    if (!p.alive) continue;
    for (const a of match.hazards) {
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      const minDist = a.r + PLAYER_RADIUS;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist * minDist) {
        const dist = Math.sqrt(d2) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        p.x = a.x + nx * minDist; // push out to the surface
        p.y = a.y + ny * minDist;
        p.vx = nx * HAZARD_KNOCKBACK; // bounce away
        p.vy = ny * HAZARD_KNOCKBACK;
        if (nowMs >= p.invulnUntil) {
          damagePlayer(p, HAZARD_CONTACT_DAMAGE, null, nowMs);
          p.invulnUntil = nowMs + 900;
        }
      }
    }
  }

  // Bullets.
  for (let i = match.bullets.length - 1; i >= 0; i--) {
    const b = match.bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.dist += Math.hypot(b.vx, b.vy);
    if (
      b.dist > b.maxDist ||
      b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H
    ) {
      match.bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const p of match.players.values()) {
      if (!p.alive || p.id === b.owner) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) {
        damagePlayer(p, b.damage, b.owner, nowMs);
        hit = true;
        break;
      }
    }
    // Bullets also break asteroids (classic split into smaller, faster shards).
    if (!hit) {
      for (let h = match.hazards.length - 1; h >= 0; h--) {
        const a = match.hazards[h];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const reach = a.r + 4;
        if (dx * dx + dy * dy < reach * reach) {
          match.hazards.splice(h, 1);
          if (match.hazards.length < HAZARD_MAX) {
            for (const shard of splitHazard(a)) match.hazards.push(shard);
          }
          hit = true;
          break;
        }
      }
    }
    if (hit) match.bullets.splice(i, 1);
  }

  // Win check.
  if (match.startCount > 1 && aliveCount() <= 1) {
    match.phase = "end";
    for (const p of match.players.values()) {
      if (p.alive) {
        p.placement = 1;
        match.winner = p.id;
      }
    }
  }
}

// Compact, network-friendly snapshot of the whole match.
export function snapshot() {
  const players = [];
  for (const p of match.players.values()) {
    players.push({
      id: p.id,
      x: Math.round(p.x),
      y: Math.round(p.y),
      rot: +p.rot.toFixed(2),
      hp: Math.round(p.hp),
      sh: Math.round(p.shieldHp),
      a: p.alive ? 1 : 0,
      w: p.weapon,
      am: p.ammo === Infinity ? -1 : p.ammo,
      k: p.kills,
      pl: p.placement,
      th: p.thrusting ? 1 : 0,
      dx: Math.round(p.dropX),
      dy: Math.round(p.dropY),
    });
  }
  return {
    ph: match.phase,
    pl: players,
    b: match.bullets.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), c: b.color })),
    h: match.hazards.map((a) => ({
      id: a.id,
      x: Math.round(a.x),
      y: Math.round(a.y),
      r: Math.round(a.r),
      ro: +a.rot.toFixed(2),
    })),
    l: match.loot.map((it) => ({ id: it.id, x: it.x, y: it.y, k: it.kind })),
    z: zoneSnapshot(match.zone),
    al: aliveCount(),
    win: match.winner,
    fd: match.feed.map((f) => f.text),
    end: match.phaseEndsAt,
  };
}
