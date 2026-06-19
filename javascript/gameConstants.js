export const OFF_WHITE = "rgb(220, 220, 220)"
export const GREY = "rgb(16, 16, 16)"
export const TRANSLUCENT = "rgba(16, 16, 16, 0.75)"
export const MAX_FPS = 120;
export const MOVEMENT_SPEED = 7;
export const ROTATION_SPEED = 0.087;
export const DECELERATION_RATE = 0.93;
export const PROJECTILE_SPEED = 26;
export const MAX_ASTEROIDS = 35; // Maximum number of asteroids allowed on screen.
export const SPAWN_INTERVAL = 700; // Milliseconds between asteroid spawns.
export const ASTEROID_MIN_RADIUS = 18;
export const ASTEROID_MAX_RADIUS = 95;
export const ASTEROID_SPLIT_THRESHOLD = 38; // Asteroids larger than this split when shot.
// Hard cap on asteroid speed so bullets (PROJECTILE_SPEED) can always catch them.
export const ASTEROID_MAX_SPEED = 15;
export const ASTEROIDS = [];
export const PROJECTILES = [];
export const EXPLOSIONS = [];
export const MOUSE = {
  x: 0,
  y: 0,
};
export const KEYPRESS = {
  w_key: {
    pressed: false,
  },
  a_key: {
    pressed: false,
  },
  s_key: {
    pressed: false,
  },
  d_key: {
    pressed: false,
  },
};