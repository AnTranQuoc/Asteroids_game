import { player } from "./classes/gameClasses.js";
import { KEYPRESS } from "./gameConstants.js";
import {
  MOVEMENT_SPEED,
  ROTATION_SPEED,
  DECELERATION_RATE,
} from "./gameConstants.js";

export function controlScheme() {
  if (KEYPRESS.w_key.pressed || KEYPRESS.s_key.pressed) {
    const movementSpeed = Math.abs(MOVEMENT_SPEED); // Use absolute value of movement speed

    if (KEYPRESS.w_key.pressed) {
      player.velocity.x = Math.cos(player.rotation) * movementSpeed;
      player.velocity.y = Math.sin(player.rotation) * movementSpeed;
    } else if (KEYPRESS.s_key.pressed) {
      player.velocity.x = -Math.cos(player.rotation) * movementSpeed;
      player.velocity.y = -Math.sin(player.rotation) * movementSpeed;
    }
  } else {
    player.velocity.x *= DECELERATION_RATE;
    player.velocity.y *= DECELERATION_RATE;
  }

  if (KEYPRESS.d_key.pressed) {
    player.rotation += ROTATION_SPEED;
  } else if (KEYPRESS.a_key.pressed) {
    player.rotation -= ROTATION_SPEED;
  }
}
