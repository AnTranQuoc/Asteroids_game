import soundManager from "./javascript/classes/soundEffectsManager.js";
import * as Music from "./javascript/sfxAndMusic.js"; // Don't remove. Disables music feature if removed.
import { CANVAS, CONTEXT } from "./javascript/canvasUtils.js";
import { drawFPS, calculateFPS } from "./javascript/fpsUtils.js";
import { scoreBoard } from "./javascript/scoreUtils.js";
import { drawStartScreenInfo } from "./javascript/startScreenCanvas.js";
import { drawRestartScreenInfo } from "./javascript/restartScreenCanvas.js";
import { drawPauseMenuInfo } from "./javascript/pauseScreenCanvas.js";
import { resetScore, increaseScore } from "./javascript/scoreUtils.js";
import { controlScheme } from "./javascript/controlScheme.js";
import { enableCanvasWrap } from "./javascript/canvasWrap.js";
import { player, Projectile } from "./javascript/classes/gameClasses.js";
import { spawnAsteroids } from "./javascript/asteroidUtils.js";
import {
  renderParticles,
  updateParticles,
} from "./javascript/explosionParticles.js";
import {
  ASTEROIDS,
  MAX_FPS,
  PROJECTILES,
  EXPLOSIONS,
  PROJECTILE_SPEED,
  KEYPRESS,
  GREY,
  SPAWN_INTERVAL,
} from "./javascript/gameConstants.js";

export let gameOver = false;
export let gameStarted = false;
export let isPaused = false;
let asteroidSpawnInterval;

///// Asteroid Management /////
function updateAndDrawAsteroids() {
  // Create a new array containing filtered asteroids.
  const updatedAsteroids = ASTEROIDS.filter((asteroid) => {
    asteroid.updateAsteroid();
    if (playerCollided(asteroid, player.getVertices())) {
      gameOver = true;
    }
    return (
      asteroid.coordinates.x >= 0 &&
      asteroid.coordinates.x <= CANVAS.width &&
      asteroid.coordinates.y >= 0 &&
      asteroid.coordinates.y <= CANVAS.height
    );
  });

  // Assign the new array back to the imported ASTEROIDS array.
  ASTEROIDS.length = 0; // Clear the original array.
  Array.prototype.push.apply(ASTEROIDS, updatedAsteroids); // Copy the filtered asteroids.
  // console.log(ASTEROIDS);
}
///// End of Asteroid Management /////

///// Hit Detection /////
function detectCollisions() {
  for (let i = PROJECTILES.length - 1; i >= 0; i--) {
    const PROJECTILE = PROJECTILES[i];

    // Skip collision checks if the projectile is out of the game area.
    if (
      PROJECTILE.coordinates.x > CANVAS.width ||
      PROJECTILE.coordinates.y > CANVAS.height
    ) {
      continue;
    }

    for (let j = ASTEROIDS.length - 1; j >= 0; j--) {
      const ASTEROID = ASTEROIDS[j];
      // Calculate the distance between the projectile and asteroid.
      const distance = Math.sqrt(
        (PROJECTILE.coordinates.x - ASTEROID.coordinates.x) ** 2 +
          (PROJECTILE.coordinates.y - ASTEROID.coordinates.y) ** 2
      );

      // Check if the distance is less than the sum of the projectile radius and asteroid radius.
      if (distance < PROJECTILE.radius + ASTEROID.radius) {
        // Score is based on the radius of the asteroid. The smaller the asteroid, the higher score it has.
        const asteroidSizeMultiplier = 1 - ASTEROID.radius / 450;
        const baseScore = 15;
        const scoreIncrease = Math.round(baseScore * asteroidSizeMultiplier);
        increaseScore(scoreIncrease);

        // Remove detected projectiles and asteroids that have collided.
        PROJECTILES.splice(i, 1);
        ASTEROIDS.splice(j, 1);
        // Explosion visual effect.
        const explosion = {
          coordinates: { x: ASTEROID.coordinates.x, y: ASTEROID.coordinates.y },
          particles: [],
          maxParticles: 20,
          particleSpeed: 2,
          particleRadius: 0.75,
          explosionDuration: 30, // Duration of the explosion in frames
          frameCount: 0,
        };
        EXPLOSIONS.push(explosion);
        soundManager.playSound("ASTEROID_HIT", 0.1);
      }
    }
  }
}

function playerCollided(circle, triangle) {
// Check if the circle is colliding with any of the triangle's edges.
  for (let i = 0; i < 3; i++) {
    let start = triangle[i];
    let end = triangle[(i + 1) % 3];

    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let length = Math.sqrt(dx * dx + dy * dy);

    let dot =
      ((circle.coordinates.x - start.x) * dx +
        (circle.coordinates.y - start.y) * dy) /
      Math.pow(length, 2);

    let closestX = start.x + dot * dx;
    let closestY = start.y + dot * dy;

    if (!isPointOnLineSegment(closestX, closestY, start, end)) {
      closestX = closestX < start.x ? start.x : end.x;
      closestY = closestY < start.y ? start.y : end.y;
    }

    dx = closestX - circle.coordinates.x;
    dy = closestY - circle.coordinates.y;

    let distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= circle.radius) {
      return true;
    }
  }
  // No collision.
  return false;
}

function isPointOnLineSegment(x, y, start, end) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}
///// End of Hit Detection /////

///// Main Game Loop /////
function restartGame() {
  gameOver = false;
  resetScore();
  player.coordinates.x = CANVAS.width / 2;
  player.coordinates.y = CANVAS.height / 2;
  player.velocity.x = 0;
  player.velocity.y = 0;
  ASTEROIDS.length = 0;
  PROJECTILES.length = 0;
  CANVAS.removeEventListener("click", restartGame);
  gameLoop();
}

function resumeGame() {
  isPaused = false;
}

let lastFrameTime = 0;

function gameLoop(currentTime) {
  if (!gameStarted) {
    // Start screen.
    drawStartScreenInfo();
    CANVAS.addEventListener("click", () => {
      gameStarted = true;
      lastFrameTime = performance.now();
      clearInterval(asteroidSpawnInterval);
      requestAnimationFrame(gameLoop);
    });
    return;
  }

  if (gameOver) {
    // What do you think?
    drawRestartScreenInfo();
    CANVAS.addEventListener("click", restartGame);
    return;
  }

  /*
   I tried enabling/disabling hardware acceleration in Chrome Dev and Firefox Dev Edition. (It's enabled for me now after testing.)
   FPS is somehow halved when using 1000 in DELTA_TIME, for example, if I set the fps in gameConstants.js to 60, it's 30 in game. Weird.
   I've set it to 120fps to be 60fps in-game, for me at least. 
   My screen is at 60Hz, V-sync is off for browsers, and I've restarted my PC multiple times.
   Hmm. You wouldn't happen to know, would you? :)
  */

  if (!isPaused & !gameOver) {
    const DELTA_TIME = (currentTime - lastFrameTime) / 1000;
    const targetTimePerFrame = 1 / MAX_FPS;

    if (DELTA_TIME < targetTimePerFrame) {
      // If the time is less, wait for the remaining time
      const remainingTime = targetTimePerFrame - DELTA_TIME;
      setTimeout(() => {
        requestAnimationFrame(gameLoop);
      }, remainingTime * 1000); // Convert to milliseconds
      return;
    } else {
      lastFrameTime = currentTime;
    }

    CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
    CONTEXT.fillStyle = GREY;
    CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

    player.updatePlayer();

    // Asteroid spawning.
    asteroidSpawnInterval = setInterval(spawnAsteroids, SPAWN_INTERVAL);

    // Asteroid maintenance.
    updateAndDrawAsteroids();

    // Projectile to asteroid hit detection.
    detectCollisions();

    // Scoreboard
    scoreBoard();

    // Controls
    controlScheme();
    enableCanvasWrap();

    // Update and show explosions on projectile to asteroid impact.
    for (let i = EXPLOSIONS.length - 1; i >= 0; i--) {
      const explosion = EXPLOSIONS[i];

      if (explosion.frameCount === 0) {
        const particlesToAdd =
          explosion.maxParticles - explosion.particles.length;
        for (let j = 0; j < particlesToAdd; j++) {
          const angle = Math.random() * Math.PI * 2;
          const velocity = {
            x: Math.cos(angle) * explosion.particleSpeed,
            y: Math.sin(angle) * explosion.particleSpeed,
          };
          explosion.particles.push({
            coordinates: { ...explosion.coordinates },
            velocity,
            radius: explosion.particleRadius,
            color: explosion.particleColor,
            alpha: 1,
          });
        }
      }

      updateParticles(explosion);

      explosion.frameCount++;

      if (explosion.frameCount >= explosion.explosionDuration) {
        EXPLOSIONS.splice(i, 1);
      }
      renderParticles(explosion);
    }

    for (let i = PROJECTILES.length - 1; i >= 0; i--) {
      const projectile = PROJECTILES[i];
      projectile.updateProjectile();
    }

    // Garbage collector for projectiles that traveled past the max distance.
    if (PROJECTILES.distanceTraveled >= PROJECTILES.maxDistance) {
      PROJECTILES.splice(i, 1);
    }

    // FPS COUNTER
    calculateFPS(currentTime);
    drawFPS();
    requestAnimationFrame(gameLoop);
  } else {
    // What do you think?
    drawPauseMenuInfo();
    CANVAS.addEventListener("click", resumeGame);
    return;
  }
}
gameLoop();

///// Controls /////
function fireProjectile() {
  soundManager.playSound("FIRE_SOUND", 0.1);

  const cosRotation = Math.cos(player.rotation);
  const sinRotation = Math.sin(player.rotation);

  PROJECTILES.push(
    new Projectile({
      coordinates: {
        x: player.coordinates.x + cosRotation * 45,
        y: player.coordinates.y + sinRotation * 45,
      },
      velocity: {
        x: PROJECTILE_SPEED * cosRotation,
        y: PROJECTILE_SPEED * sinRotation,
      },
    })
  );
}

window.addEventListener("mousedown", (e) => {
  if (gameStarted && !gameOver && !isPaused && e.button === 0) {
    fireProjectile();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && gameStarted && !gameOver) {
    isPaused = !isPaused;
  } else if (gameStarted) {
    switch (e.code) {
      case "KeyW":
        KEYPRESS.w_key.pressed = true;
        break;
      case "KeyA":
        KEYPRESS.a_key.pressed = true;
        break;
      case "KeyS":
        KEYPRESS.s_key.pressed = true;
        break;
      case "KeyD":
        KEYPRESS.d_key.pressed = true;
        break;
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (gameStarted) {
    switch (e.code) {
      case "KeyW":
        KEYPRESS.w_key.pressed = false;
        break;
      case "KeyA":
        KEYPRESS.a_key.pressed = false;
        break;
      case "KeyS":
        KEYPRESS.s_key.pressed = false;
        break;
      case "KeyD":
        KEYPRESS.d_key.pressed = false;
        break;
    }
  }
});
