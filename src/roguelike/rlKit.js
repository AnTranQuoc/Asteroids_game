// src/roguelike/rlKit.js
import { WEAPONS } from "./rlWeapons.js";
import { PASSIVES } from "./rlPassives.js";

export const WEAPON_CAP = 4;
export const PASSIVE_CAP = 4;

// Run-time kit. Mutated in place; reset by resetKit().
export const kitState = {
  kit: [],        // [{ id, level, lastFireAt, runtime:{} }]  weapons, <= WEAPON_CAP
  passives: [],   // [{ id, level }]                          <= PASSIVE_CAP
  stats: { moveSpeed: 0, pickup: 0, maxHP: 0, armor: 0 },
  hearts: 1,
  armor: 0,
};

export function resetKit() {
  kitState.kit = [{ id: "blaster", level: 1, lastFireAt: 0, runtime: {} }];
  kitState.passives = [];
  kitState.stats = { moveSpeed: 0, pickup: 0, maxHP: 0, armor: 0 };
  kitState.hearts = 1;
  kitState.armor = 0;
}

export function maxHearts() { return 1 + kitState.stats.maxHP; }

export function weaponLevel(id) {
  const e = kitState.kit.find((w) => w.id === id);
  return e ? e.level : 0;
}
export function passiveLevel(id) {
  const e = kitState.passives.find((p) => p.id === id);
  return e ? e.level : 0;
}

// Dispatch a hook to every equipped passive. For "onPlayerHit" returns true if
// any passive absorbed the hit; otherwise returns undefined.
export function runPassiveHook(name, ...args) {
  let absorbed = false;
  for (const entry of kitState.passives) {
    const def = PASSIVES[entry.id];
    const fn = def && def.hooks && def.hooks[name];
    if (!fn) continue;
    const r = fn(...args, entry.level);
    if (r === true) absorbed = true;
  }
  return absorbed;
}

// Fire every equipped weapon whose own cooldown has elapsed.
export function tickKit(ctx, now) {
  for (const entry of kitState.kit) {
    const w = WEAPONS[entry.id];
    if (now - entry.lastFireAt >= w.cooldownMs(entry.level)) {
      w.fire(ctx, entry.level);
      entry.lastFireAt = now;
    }
  }
}

// Persistent-visual weapons (orbit, mines) + per-frame passive hooks.
export function drawKit(ctx, now) {
  for (const entry of kitState.kit) {
    const w = WEAPONS[entry.id];
    if (w.draw) w.draw(ctx, entry, now);
  }
  for (const entry of kitState.passives) {
    const def = PASSIVES[entry.id];
    if (def.hooks && def.hooks.onUpdate) def.hooks.onUpdate(ctx, entry.level, now);
  }
}
