import { player } from "./classes/gameClasses.js";
import { KEYPRESS, MOUSE } from "./gameConstants.js";
import { MOVEMENT_SPEED, DECELERATION_RATE } from "./gameConstants.js";

export function controlScheme() {
  // The nose of the ship always points toward the mouse cursor.
  player.rotation = Math.atan2(
    MOUSE.y - player.coordinates.y,
    MOUSE.x - player.coordinates.x
  );

  // WASD moves the ship in absolute screen directions, independent of where the
  // ship is facing (twin-stick style).
  let dx = 0;
  let dy = 0;
  if (KEYPRESS.w_key.pressed) dy -= 1; // Up
  if (KEYPRESS.s_key.pressed) dy += 1; // Down
  if (KEYPRESS.a_key.pressed) dx -= 1; // Left
  if (KEYPRESS.d_key.pressed) dx += 1; // Right

  player.thrusting = dx !== 0 || dy !== 0;

  if (player.thrusting) {
    // Normalize the direction so diagonal movement isn't faster.
    const length = Math.sqrt(dx * dx + dy * dy);
    player.velocity.x = (dx / length) * MOVEMENT_SPEED;
    player.velocity.y = (dy / length) * MOVEMENT_SPEED;
  } else {
    // Glide to a stop when no movement keys are held.
    player.velocity.x *= DECELERATION_RATE;
    player.velocity.y *= DECELERATION_RATE;
  }
}
