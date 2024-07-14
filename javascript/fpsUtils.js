import { CONTEXT } from "./canvasUtils.js";

let fps = 0;
let frameCount = 0;
let startTime = performance.now();

export function calculateFPS() {
  frameCount++;
  const currentTime = performance.now();
  const elapsedTime = currentTime - startTime;

  if (elapsedTime > 1000) {
    fps = Math.round((frameCount * 1000) / elapsedTime);
    frameCount = 0;
    startTime = currentTime;
  }
}

export function drawFPS() {
  CONTEXT.fillStyle = "rgb(220, 220, 220)";
  CONTEXT.font = "16px monospace";
  CONTEXT.fillText(`FPS: ${fps}`, 10, 20);
}