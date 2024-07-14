import { CANVAS } from "./canvasUtils.js";
import { player } from "./classes/gameClasses.js";

export function enableCanvasWrap() {
  // Enables the spaceship to "wrap around" the canvas.
  if (player.coordinates.x < 0) {
    player.coordinates.x = CANVAS.width;
  } else if (player.coordinates.x > CANVAS.width) {
    player.coordinates.x = 0;
  }

  if (player.coordinates.y < 0) {
    player.coordinates.y = CANVAS.height;
  } else if (player.coordinates.y > CANVAS.height) {
    player.coordinates.y = 0;
  }
}
