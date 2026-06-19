import { cloud } from "./cloud.js";

// Money is owned by the server now (see cloud.js). This module just exposes the
// current balance plus the "earned this run" figure for the game-over screen.
let lastEarned = 0;

export function getMoney() {
  return cloud.money;
}

export function setLastEarned(amount) {
  lastEarned = amount;
}

export function getLastEarned() {
  return lastEarned;
}
