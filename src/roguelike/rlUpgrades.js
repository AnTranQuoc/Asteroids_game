// src/roguelike/rlUpgrades.js
import { getStackCount } from "./rlState.js";

export const UPGRADE_POOL = [
  // Common (baseWeight: 100) — stackable numerically
  {
    id: "rapidFire", name: "Rapid Fire", tier: "COMMON", baseWeight: 100,
    desc: (n) => `Fire interval −${n * 20}%`,
  },
  {
    id: "thruster", name: "Thruster", tier: "COMMON", baseWeight: 100,
    desc: (n) => `Move speed +${n * 15}%`,
  },
  {
    id: "heavyShot", name: "Heavy Shot", tier: "COMMON", baseWeight: 100,
    desc: (n) => n >= 3 ? `Bullet radius +${n * 30}%, XP per kill ×2` : `Bullet radius +${n * 30}%`,
  },
  {
    id: "toughShield", name: "Tough Shield", tier: "COMMON", baseWeight: 100,
    desc: (n) => { const t = n === 1 ? 30 : n === 2 ? 15 : 5; return `Shield recharges ${t}s after break`; },
  },
  // Rare (baseWeight: 40)
  {
    id: "pierce", name: "Pierce", tier: "RARE", baseWeight: 40,
    desc: (n) => n >= 2 ? "Bullets pass through & split on exit" : "Bullets pass through asteroids",
  },
  {
    id: "ricochet", name: "Ricochet", tier: "RARE", baseWeight: 40,
    desc: (n) => `Bullets bounce off edges ${n} time${n > 1 ? "s" : ""}`,
  },
  {
    id: "forkShot", name: "Fork Shot", tier: "RARE", baseWeight: 40,
    desc: (n) => `On hit: spawn ${n * 2} side shards`,
  },
  {
    id: "magnet", name: "Magnet", tier: "RARE", baseWeight: 40,
    desc: (n) => n >= 2 ? `Pickup radius ×${n * 3}, pulls XP orbs` : `Pickup radius ×${n * 3}`,
  },
  // Legendary (baseWeight: 16)
  {
    id: "orbitRing", name: "Orbit Ring", tier: "LEGENDARY", baseWeight: 16,
    desc: (n) => `${n * 3} orbs orbit ship${n >= 2 ? ", fast spin" : ""}`,
  },
  {
    id: "novaBurst", name: "Nova Burst", tier: "LEGENDARY", baseWeight: 16,
    desc: (n) => n >= 2 ? "Explosion on level-up, radius ×2, stuns boss" : "Explosion clears asteroids on level-up",
  },
  {
    id: "ghostShip", name: "Ghost Ship", tier: "LEGENDARY", baseWeight: 16,
    desc: (n) => `Phase ${n * 4}s after hit${n >= 2 ? ", deflects bullets" : ""}`,
  },
];

export function effectiveWeight(upgradeId) {
  const stacks = getStackCount(upgradeId);
  const def = UPGRADE_POOL.find((u) => u.id === upgradeId);
  return def.baseWeight / Math.pow(2.5, stacks);
}

// Weighted-random draw of 3 distinct upgrades.
export function drawThreeCards() {
  const pickedIds = [];
  for (let i = 0; i < 3; i++) {
    const remaining = UPGRADE_POOL.filter((u) => !pickedIds.includes(u.id));
    const total = remaining.reduce((s, u) => s + effectiveWeight(u.id), 0);
    let r = Math.random() * total;
    let chosen = remaining[0];
    for (const u of remaining) {
      r -= effectiveWeight(u.id);
      if (r <= 0) { chosen = u; break; }
    }
    pickedIds.push(chosen.id);
  }
  return pickedIds.map((id) => {
    const def = UPGRADE_POOL.find((u) => u.id === id);
    const stacks = getStackCount(id);
    const nextStacks = stacks + 1;
    return { ...def, currentStacks: stacks, nextStacks, isUpgrade: stacks > 0 };
  });
}

// Effect-value helpers consumed by rl.js
export function fireIntervalMs(baseMs) {
  return baseMs * Math.pow(0.8, getStackCount("rapidFire"));
}
export function moveSpeedMult() {
  return 1 + getStackCount("thruster") * 0.15;
}
export function bulletRadiusMult() {
  return 1 + getStackCount("heavyShot") * 0.30;
}
export function xpMultiplier() {
  return getStackCount("heavyShot") >= 3 ? 2 : 1;
}
export function shieldRechargeMs() {
  const n = getStackCount("toughShield");
  if (n === 0) return Infinity;
  return (n === 1 ? 30 : n === 2 ? 15 : 5) * 1000;
}
export function pierceStacks() { return getStackCount("pierce"); }
export function ricochetBounces() { return getStackCount("ricochet"); }
export function forkShotShards() { return getStackCount("forkShot") * 2; }
export function magnetRadiusMult() {
  const n = getStackCount("magnet");
  return n === 0 ? 1 : n * 3;
}
export function magnetPullsXP() { return getStackCount("magnet") >= 2; }
export function orbitRingCount() { return getStackCount("orbitRing") * 3; }
export function orbitRingFastSpin() { return getStackCount("orbitRing") >= 2; }
export function novaBurstStacks() { return getStackCount("novaBurst"); }
export function ghostShipDurationMs() { return getStackCount("ghostShip") * 4000; }
export function ghostShipDeflects() { return getStackCount("ghostShip") >= 2; }
