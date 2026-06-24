import { Asteroid } from "./entities.js";
import { gameOver, gameStarted } from "../../index.js";
import { CANVAS } from "../core/canvas.js";
import { getDifficulty, runtime } from "../systems/difficulty.js";
import {
  ASTEROIDS,
  ASTEROID_MIN_RADIUS,
  ASTEROID_MAX_RADIUS,
  ASTEROID_SPLIT_THRESHOLD,
  ASTEROID_MAX_SPEED,
} from "../core/constants.js";

export function getAsteroidSpawnData() {
  // Spawn location of asteroids (just outside the canvas bounds).
  const randomX = Math.random() < 0.5 ? -60 : CANVAS.width + 60;
  const randomY = Math.random() < 0.5 ? -60 : CANVAS.height + 60;
  return { x: randomX, y: randomY };
}

// Aim each asteroid at a random point roughly around the centre so it actually
// crosses the screen, and scale speed by size (smaller rocks fly faster).
export function getAimedAsteroidVelocity(spawn, radius) {
  const targetX = CANVAS.width / 2 + (Math.random() - 0.5) * CANVAS.width * 0.6;
  const targetY = CANVAS.height / 2 + (Math.random() - 0.5) * CANVAS.height * 0.6;

  const angle = Math.atan2(targetY - spawn.y, targetX - spawn.x);
  const sizeFactor = Math.min(2.0, Math.max(0.7, 40 / radius));
  const speed = Math.min(
    ASTEROID_MAX_SPEED,
    (1.8 + Math.random() * 1.6) *
      sizeFactor *
      getDifficulty().speedMult *
      runtime.speedRamp
  );

  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

export function spawnAsteroids() {
  if (gameStarted && !gameOver && ASTEROIDS.length < getDifficulty().maxAsteroids) {
    const spawnLocation = getAsteroidSpawnData();
    const radius =
      ASTEROID_MIN_RADIUS +
      Math.random() * (ASTEROID_MAX_RADIUS - ASTEROID_MIN_RADIUS);
    const asteroidVelocity = getAimedAsteroidVelocity(spawnLocation, radius);

    ASTEROIDS.push(
      new Asteroid({
        coordinates: spawnLocation,
        velocity: asteroidVelocity,
        radius,
      })
    );
  }
}

// Classic Asteroids mechanic: a large rock breaks into smaller, faster shards
// when shot. Small rocks are simply destroyed (returns an empty array).
export function splitAsteroid(asteroid) {
  const children = [];
  if (asteroid.radius > ASTEROID_SPLIT_THRESHOLD) {
    const childRadius = asteroid.radius * 0.56;
    const baseAngle = Math.atan2(asteroid.velocity.y, asteroid.velocity.x);

    for (let i = 0; i < 2; i++) {
      // Send shards out to either side of the parent's travel direction.
      const angle = baseAngle + (i === 0 ? 1 : -1) * (0.6 + Math.random() * 0.5);
      const speed = Math.min(
        ASTEROID_MAX_SPEED,
        (2.5 + Math.random() * 2.5) * getDifficulty().speedMult * runtime.speedRamp
      );
      children.push(
        new Asteroid({
          coordinates: { x: asteroid.coordinates.x, y: asteroid.coordinates.y },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          radius: childRadius,
        })
      );
    }
  }
  return children;
}
