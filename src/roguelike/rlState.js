// src/roguelike/rlState.js

export const rlState = {
  screen: "menu",       // menu | playing | upgrade-pick | boss | end
  xp: 0,
  level: 0,
  xpRequired: 200,
  score: 0,
  bossIndex: 0,
  bossesDefeated: 0,
  asteroidsKilled: 0,
  upgradesPickedCount: 0,
  runStartTime: 0,
  lastSpawnTime: 0,
  lastShotTime: 0,
  speedRamp: 1.0,
  // upgrade effects
  orbitAngle: 0,           // base angle for orbit ring orbs
  ghostUntil: 0,           // ms timestamp until ghost ship phase ends
  ghostCooldownUntil: 0,   // ms timestamp when ghost ship can trigger again
  shieldRechargeAt: 0,     // ms timestamp when shield restores (0 = not pending)
  // Map<upgradeId, stackCount>
  upgrades: new Map(),
};

export function resetRlState(now) {
  rlState.screen = "playing";
  rlState.xp = 0;
  rlState.level = 0;
  rlState.xpRequired = xpRequired(0);
  rlState.score = 0;
  rlState.bossIndex = 0;
  rlState.bossesDefeated = 0;
  rlState.asteroidsKilled = 0;
  rlState.upgradesPickedCount = 0;
  rlState.runStartTime = now;
  rlState.lastSpawnTime = now;
  rlState.lastShotTime = now;
  rlState.speedRamp = 1.0;
  rlState.orbitAngle = 0;
  rlState.ghostUntil = 0;
  rlState.ghostCooldownUntil = 0;
  rlState.shieldRechargeAt = 0;
  rlState.upgrades = new Map();
}

export function xpRequired(level) {
  return 200 + level * 80;
}

export function getStackCount(upgradeId) {
  return rlState.upgrades.get(upgradeId) || 0;
}

export function addUpgradeStack(upgradeId) {
  rlState.upgrades.set(upgradeId, getStackCount(upgradeId) + 1);
  rlState.upgradesPickedCount++;
}

export function gainXP(amount) {
  rlState.xp += amount;
}

export function addScore(amount) {
  rlState.score += amount;
}
