import { CANVAS, CONTEXT } from "../core/canvas.js";
import { getDifficulty } from "./difficulty.js";
import { cloud } from "../cloud/cloud.js";

export let score = 0;

// Best scores are per-mode and owned by the server (cloud.bestScores).
export function getBestScore(mode = getDifficulty().label) {
  return cloud.bestScores[mode] || 0;
}

export function increaseScore(points) {
  score += points;
}

export function resetScore() {
  score = 0;
}

export function scoreBoard() {
  const mode = getDifficulty().label;
  CONTEXT.save();
  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = "rgb(220, 220, 220)";
  CONTEXT.font = "16px monospace";
  CONTEXT.fillText(`BEST (${mode}): ${getBestScore(mode)}`, CANVAS.width / 2 - 90, 25);
  CONTEXT.fillText(`YOUR SCORE: ${score}`, CANVAS.width / 2 - 90, 50);
  CONTEXT.restore();
}
