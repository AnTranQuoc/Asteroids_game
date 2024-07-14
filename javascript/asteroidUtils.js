import { Asteroid } from "./classes/gameClasses.js";
import { MAX_ASTEROIDS } from "./gameConstants.js";
import { gameOver, gameStarted } from "../index.js";
import { ASTEROIDS } from "./gameConstants.js";
import { CANVAS } from "./canvasUtils.js";

export function getAsteroidSpawnData() {
  // Spawn location of asteroids (outside of canvas bounds).
  const randomX = Math.random() < 0.5 ? -50 : CANVAS.width + 50;
  const randomY = Math.random() < 0.5 ? -50 : CANVAS.height + 50;
  return { x: randomX, y: randomY };
}

export function getRandomAsteroidVelocity() {
  const randomVelocityX = (Math.random() - 0.5) * 9;
  const randomVelocityY = (Math.random() - 0.5) * 9;
  return { x: randomVelocityX, y: randomVelocityY };
}

export function spawnAsteroids() {
  if (gameStarted && !gameOver && ASTEROIDS.length < MAX_ASTEROIDS) {
    const spawnLocation = getAsteroidSpawnData();
    const asteroidVelocity = getRandomAsteroidVelocity();

    ASTEROIDS.push(
      new Asteroid({
        coordinates: spawnLocation,
        velocity: asteroidVelocity,
      })
    );
  }
}
