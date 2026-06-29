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
  lastEnemySpawnTime: 0,   // last continuous enemy spawn
  lastShotTime: 0,
  speedRamp: 1.0,
  stageStartTime: 0,
  bossSpawned: false,
  pauseStartedAt: 0,
  nextWaveIndex: 0,        // index of the next wave to fire
  chaserUnlocked: false,   // continuous chaser spawn on after its wave fires
  hunterUnlocked: false,   // continuous hunter spawn on after its wave fires
  waveFlashUntil: 0,       // ms until the "WAVE N" banner fades out
  waveFlashLabel: "",      // label shown by the wave banner
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
  rlState.lastEnemySpawnTime = now;
  rlState.lastShotTime = now;
  rlState.speedRamp = 1.0;
  rlState.stageStartTime = now;
  rlState.bossSpawned = false;
  rlState.pauseStartedAt = 0;
  rlState.nextWaveIndex = 0;
  rlState.chaserUnlocked = false;
  rlState.hunterUnlocked = false;
  rlState.waveFlashUntil = 0;
  rlState.waveFlashLabel = "";
  rlState.orbitAngle = 0;
  rlState.ghostUntil = 0;
  rlState.ghostCooldownUntil = 0;
  rlState.shieldRechargeAt = 0;
  rlState.upgrades = new Map();
}

export function xpRequired(level) {
  // Quadratic curve: first level-up is cheap (~2 orbs), then the per-level cost
  // climbs by a growing increment (+10 each level) so the slope keeps rising.
  return 30 + level * 15 + level * level * 5;
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
