import { CANVAS } from "../core/canvas.js";
import { WORLD_W, WORLD_H } from "./config.js";

export const camera = { x: WORLD_W / 2, y: WORLD_H / 2 };

// Smoothly follow a world point (the local ship).
export function followCamera(wx, wy) {
  camera.x += (wx - camera.x) * 0.18;
  camera.y += (wy - camera.y) * 0.18;
}

export function snapCamera(wx, wy) {
  camera.x = wx;
  camera.y = wy;
}

export function worldToScreenX(wx) {
  return wx - camera.x + CANVAS.width / 2;
}
export function worldToScreenY(wy) {
  return wy - camera.y + CANVAS.height / 2;
}
export function screenToWorldX(sx) {
  return sx + camera.x - CANVAS.width / 2;
}
export function screenToWorldY(sy) {
  return sy + camera.y - CANVAS.height / 2;
}
