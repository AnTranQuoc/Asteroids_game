
// Each mode scales asteroid speed, spawn frequency, how many can be on screen,
// and how generously power-ups drop.
export const DIFFICULTIES = {
  easy: {
    label: "EASY",
    speedMult: 0.7,
    spawnInterval: 1100,
    maxAsteroids: 22,
    dropChance: 0.35,
  },
  normal: {
    label: "NORMAL",
    speedMult: 1.0,
    spawnInterval: 700,
    maxAsteroids: 35,
    dropChance: 0.24,
  },
  hard: {
    label: "HARD",
    speedMult: 1.3,
    spawnInterval: 480,
    maxAsteroids: 48,
    dropChance: 0.16,
  },
  crazy: {
    label: "CRAZY",
    speedMult: 1.6,
    spawnInterval: 300,
    maxAsteroids: 65,
    dropChance: 0.11,
  },
};

// Maps the number keys 1-4 to a difficulty.
export const DIFFICULTY_ORDER = ["easy", "normal", "hard", "crazy"];

export const difficultyState = { current: "normal" };

export function getDifficulty() {
  return DIFFICULTIES[difficultyState.current];
}

export function setDifficulty(key) {
  if (DIFFICULTIES[key]) {
    difficultyState.current = key;
  }
}

// Runtime ramp: asteroids get faster the longer the player survives.
export const SPEED_RAMP_MAX = 1.8;
export const runtime = { speedRamp: 1 };

export function updateSpeedRamp(elapsedMs) {
  // +1.5% per second, capped (reached after ~53s).
  runtime.speedRamp = Math.min(SPEED_RAMP_MAX, 1 + (elapsedMs / 1000) * 0.015);
}

export function resetSpeedRamp() {
  runtime.speedRamp = 1;
}
