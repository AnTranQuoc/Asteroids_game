import { WORLD_W, WORLD_H, LOOT_COUNT, PLAYER_RADIUS } from "./config.js";
import { WEAPONS } from "./weapons.js";

const WEAPON_DROPS = ["smg", "rifle", "shotgun"];

let lootSeq = 0;

function spawnOne(margin) {
  const roll = Math.random();
  let kind;
  if (roll < 0.5) {
    kind = "weapon:" + WEAPON_DROPS[Math.floor(Math.random() * WEAPON_DROPS.length)];
  } else if (roll < 0.78) {
    kind = "medkit";
  } else {
    kind = "shield";
  }
  return {
    id: "L" + lootSeq++,
    x: margin + Math.random() * (WORLD_W - margin * 2),
    y: margin + Math.random() * (WORLD_H - margin * 2),
    kind,
  };
}

export function spawnLoot() {
  lootSeq = 0;
  const margin = 200;
  const items = [];
  for (let i = 0; i < LOOT_COUNT; i++) items.push(spawnOne(margin));
  return items;
}

export const LOOT_RADIUS = 16;

// Returns true if the player is touching the item.
export function touchingLoot(player, item) {
  const dx = player.x - item.x;
  const dy = player.y - item.y;
  const reach = PLAYER_RADIUS + LOOT_RADIUS;
  return dx * dx + dy * dy < reach * reach;
}

// Applies a picked-up item to a player. Mutates the player.
export function applyLoot(player, item) {
  if (item.kind.startsWith("weapon:")) {
    const id = item.kind.slice(7);
    const weapon = WEAPONS[id];
    if (weapon) {
      player.weapon = id;
      player.ammo = weapon.startAmmo;
    }
  } else if (item.kind === "medkit") {
    player.hp = Math.min(100, player.hp + 45);
  } else if (item.kind === "shield") {
    player.shieldHp = Math.min(100, player.shieldHp + 50);
  }
}
