import { CANVAS, CONTEXT } from "./canvasUtils.js";

// Function to store the score in localStorage.
function saveScore(score) {
  localStorage.setItem("gameScore", score);
}

// Function to retrieve the score from localStorage.
function getSavedScore() {
  return parseInt(localStorage.getItem("gameScore")) || 0;
}

// console.log(getSavedScore());

// Function to store the best score in localStorage.
function saveBestScore(bestScore) {
  localStorage.setItem("bestScore", bestScore);
}

// Function to retrieve the best score from localStorage.
function getSavedBestScore() {
  return parseInt(localStorage.getItem("bestScore")) || 0;
}

export let score = 0;
export let bestScore = getSavedBestScore(); // Retrieve the best score from localStorage.

// Reset the score (not the best score) if session has expired or if the user refreshes the page.
function resetScoreOnExpire() {
  const lastSessionStart = localStorage.getItem("sessionStart");
  const currentTime = Date.now();

  // Check if session has expired (after 24 hours).
  if (
    !lastSessionStart ||
    currentTime - lastSessionStart > 24 * 60 * 60 * 1000
  ) {
    score = 0;
    saveScore(score);
    localStorage.setItem("sessionStart", currentTime);
  }
}

export function increaseScore(points) {
  resetScoreOnExpire();
  score += points;
  if (score > bestScore) {
    bestScore = score;
    saveBestScore(bestScore);
  }
  saveScore(score);
}

export function resetScore() {
  resetScoreOnExpire();
  score = 0;
  saveScore(score);
}

export function scoreBoard() {
  CONTEXT.fillStyle = "rgb(220, 220, 220)";
  CONTEXT.font = "16px monospace";
  CONTEXT.fillText(`BEST SCORE: ${bestScore}`, CANVAS.width / 2 - 75, 25);
  CONTEXT.fillText(`YOUR SCORE: ${score}`, CANVAS.width / 2 - 75, 50);
}
