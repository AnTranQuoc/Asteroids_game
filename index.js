import soundManager from "./src/audio/soundManager.js";
import * as Music from "./src/audio/sfxAndMusic.js"; // Don't remove. Disables music feature if removed.
import { CANVAS, CONTEXT } from "./src/core/canvas.js";
import { drawFPS, calculateFPS } from "./src/core/fps.js";
import { scoreBoard } from "./src/systems/score.js";
import { drawStartScreenInfo, getStartButtons } from "./src/screens/startScreen.js";
import { drawRestartScreenInfo, getRestartButtons } from "./src/screens/restartScreen.js";
import { drawPauseMenuInfo, getPauseButtons } from "./src/screens/pauseScreen.js";
import { isInside } from "./src/ui/ui.js";
import { resetScore, increaseScore, score } from "./src/systems/score.js";
import { drawShopScreen, getShopButtons } from "./src/screens/shopScreen.js";
import { buyOrEquipSkin } from "./src/systems/skins.js";
import { setLastEarned } from "./src/systems/money.js";
import { initCloud, cloudSubmitRun, cloud } from "./src/cloud/cloud.js";
import {
  drawLeaderboardScreen,
  getLeaderboardButtons,
  openLeaderboard,
} from "./src/screens/leaderboardScreen.js";
import { getPlayerName, setPlayerName } from "./src/cloud/leaderboard.js";
import { drawNameScreen, getNameButtons } from "./src/screens/nameScreen.js";
import { drawMyRecordsScreen, getMyRecordsButtons } from "./src/screens/myRecordsScreen.js";
import { gameConfirm, gamePrompt, gameAlert, dialogOpen } from "./src/ui/dialog.js";
import { controlScheme } from "./src/systems/controls.js";
import { enableCanvasWrap } from "./src/core/canvasWrap.js";
import { brActive, drawBR, openBattleRoyale } from "./src/battle/br.js";
import { rlActive, drawRL, openRoguelike } from "./src/roguelike/rl.js";
import { player, Projectile } from "./src/entities/entities.js";
import { spawnAsteroids, splitAsteroid } from "./src/entities/asteroids.js";
import { drawStarfield } from "./src/core/starfield.js";
import {
  getDifficulty,
  setDifficulty,
  DIFFICULTY_ORDER,
  runtime,
  updateSpeedRamp,
  resetSpeedRamp,
  SPEED_RAMP_MAX,
} from "./src/systems/difficulty.js";
import {
  POWERUPS,
  PowerUp,
  POWERUP_TYPES,
  POWERUP_DURATION,
  randomPowerUpType,
  drawIcon,
} from "./src/entities/powerUps.js";
import {
  renderParticles,
  updateParticles,
} from "./src/entities/particles.js";
import {
  ASTEROIDS,
  MAX_FPS,
  PROJECTILES,
  EXPLOSIONS,
  PROJECTILE_SPEED,
  KEYPRESS,
  MOUSE,
  GREY,
} from "./src/core/constants.js";

export let gameOver = false;
export let gameStarted = false;
export let isPaused = false;
let lastSpawnTime = 0;
let gameStartTime = 0; // When the current run began (for the speed ramp).
let deathTime = 0; // When the player died (for the death/fade sequence).
let shopOpen = false; // Overlay shop, reachable from start / game-over screens.
let leaderboardOpen = false; // World-records overlay.
let myRecordsOpen = false; // Personal records overlay.
let needsName = !localStorage.getItem("nameChosen"); // First-launch name gate.
let runBanked = false; // Guards against paying out the same run twice.

// Start the aim point at the centre so the ship has a sane facing before the
// first mouse movement.
MOUSE.x = CANVAS.width / 2;
MOUSE.y = CANVAS.height / 2;

///// Asteroid Management /////
// Spawns a size-scaled ember explosion at the given spot.
function spawnExplosion(coordinates, radius) {
  EXPLOSIONS.push({
    coordinates: { x: coordinates.x, y: coordinates.y },
    particles: [],
    maxParticles: Math.min(60, Math.floor(radius * 0.8) + 14),
    particleSpeed: 2 + radius / 40,
    particleRadius: 1 + radius / 70,
    particleColor: "255, 180, 70", // Warm ember tone.
    explosionDuration: 35,
    frameCount: 0,
  });
}

// Advances and renders every active explosion.
function updateAndDrawExplosions() {
  for (let i = EXPLOSIONS.length - 1; i >= 0; i--) {
    const explosion = EXPLOSIONS[i];

    if (explosion.frameCount === 0) {
      const particlesToAdd = explosion.maxParticles - explosion.particles.length;
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
}

function updateAndDrawAsteroids() {
  // Asteroids wrap around the screen (handled in updateAsteroid), so there's no
  // need to cull them by position — just update, draw, and check for a hit.
  const now = performance.now();
  for (let i = ASTEROIDS.length - 1; i >= 0; i--) {
    const asteroid = ASTEROIDS[i];
    asteroid.updateAsteroid();

    if (playerCollided(asteroid, player.getVertices())) {
      if (now < player.invulnUntil) {
        continue; // Grace period right after a shield breaks.
      }
      if (player.shield) {
        // Shield soaks the hit: pop the rock and grant brief invulnerability.
        player.shield = false;
        player.invulnUntil = now + 1500;
        spawnExplosion(asteroid.coordinates, asteroid.radius);
        soundManager.playSound("ASTEROID_HIT", 0.15);
        ASTEROIDS.splice(i, 1);
      } else if (!gameOver) {
        gameOver = true;
        bankRun();
        triggerDeath(asteroid);
      }
    }
  }
}

// Fires once when the ship is destroyed: blow up the ship at its position.
function triggerDeath() {
  deathTime = performance.now();
  EXPLOSIONS.push({
    coordinates: { x: player.coordinates.x, y: player.coordinates.y },
    particles: [],
    maxParticles: 80,
    particleSpeed: 5,
    particleRadius: 2.4,
    particleColor: "255, 160, 80",
    explosionDuration: 55,
    frameCount: 0,
  });
  soundManager.playSound("ASTEROID_HIT", 0.3);
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

        // Large asteroids break into smaller, faster shards.
        const shards = splitAsteroid(ASTEROID);
        Array.prototype.push.apply(ASTEROIDS, shards);

        // Explosion visual effect, scaled to the asteroid's size.
        spawnExplosion(ASTEROID.coordinates, ASTEROID.radius);
        soundManager.playSound("ASTEROID_HIT", 0.1);

        // Chance to drop a power-up the player can fly over to "eat".
        if (Math.random() < getDifficulty().dropChance) {
          POWERUPS.push(
            new PowerUp({
              coordinates: {
                x: ASTEROID.coordinates.x,
                y: ASTEROID.coordinates.y,
              },
              type: randomPowerUpType(),
            })
          );
        }
        break; // This projectile is gone; stop scanning asteroids for it.
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
function resetPlayerState() {
  player.coordinates.x = CANVAS.width / 2;
  player.coordinates.y = CANVAS.height / 2;
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.rapidFireUntil = 0;
  player.spreadUntil = 0;
  player.shield = false;
  player.invulnUntil = 0;
}

// Pays out money for the current run (once). Earn $1 per 10 points.
function bankRun() {
  if (runBanked) return;
  // The server grants the money and updates the best score; we just show the
  // expected payout immediately for feedback.
  setLastEarned(Math.floor(score / 10));
  cloudSubmitRun(score, getDifficulty().label);
  runBanked = true;
}

// These only flip state; the render loop runs continuously and picks it up.
function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  runBanked = false;
  lastFrameTime = performance.now();
  lastSpawnTime = performance.now();
  gameStartTime = performance.now();
  resetSpeedRamp();
}

function restartGame() {
  bankRun(); // Cash in the run being abandoned (no-op if already banked).
  gameOver = false;
  isPaused = false;
  runBanked = false;
  resetScore();
  resetPlayerState();
  ASTEROIDS.length = 0;
  PROJECTILES.length = 0;
  POWERUPS.length = 0;
  lastFrameTime = performance.now();
  lastSpawnTime = performance.now();
  gameStartTime = performance.now();
  resetSpeedRamp();
}

function togglePause() {
  if (!gameStarted || gameOver) return;
  isPaused = !isPaused;
  if (!isPaused) {
    lastFrameTime = performance.now(); // Avoid a big delta jump on resume.
  }
}

// Abandon the current run and return to the start screen (lobby).
function goToLobby() {
  bankRun(); // Cash in the run being abandoned.
  gameStarted = false;
  gameOver = false;
  isPaused = false;
  resetScore();
  resetPlayerState();
  ASTEROIDS.length = 0;
  PROJECTILES.length = 0;
  POWERUPS.length = 0;
}

function resumeGame() {
  if (isPaused) togglePause();
}

const RENAME_COST = 6000;

// Prompts for a pilot name. The first name is free; renaming an existing one
// costs money (enforced by the server). Re-asks if the name is taken.
async function enterName() {
  // Charge only if the SERVER already has a name for this account (matches what
  // the server actually does). The first real name is free.
  const paid = !!cloud.name;
  if (paid && !(await gameConfirm(`Changing your name costs $${RENAME_COST}. Continue?`))) {
    return;
  }

  let entered = await gamePrompt(
    paid ? `Enter your new name ($${RENAME_COST}):` : "Enter your pilot name:",
    getPlayerName()
  );
  while (entered !== null && entered.trim()) {
    const res = await setPlayerName(entered);
    if (res.ok) {
      localStorage.setItem("nameChosen", "1");
      needsName = false;
      return;
    }
    if (/taken|duplicate/i.test(res.error || "")) {
      entered = await gamePrompt("That name is already taken. Pick another:", entered);
      continue;
    }
    if (/insufficient|funds/i.test(res.error || "")) {
      await gameAlert(`Not enough money — you need $${RENAME_COST} to change your name.`);
      return;
    }
    // First-time naming while offline/backend-not-ready: accept locally so the
    // player isn't blocked. (Paid renames require the server, so don't.)
    if (!paid) {
      localStorage.setItem("playerName", entered.trim().slice(0, 16));
      localStorage.setItem("nameChosen", "1");
      needsName = false;
    } else {
      await gameAlert("Couldn't change your name right now. Try again later.");
    }
    return;
  }
}

// Play without a unique name (shows as "Anonymous" on the world board).
function playUnknown() {
  localStorage.removeItem("playerName");
  localStorage.setItem("nameChosen", "1");
  needsName = false;
}

// Renders the frozen battlefield with the ship's explosion, then gradually
// fades the game-over screen in on top.
function drawDeathSequence(now) {
  const elapsed = now - deathTime;

  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStarfield();

  // Asteroids stay put (drawn, not moved) while the scene settles.
  for (const asteroid of ASTEROIDS) asteroid.drawAsteroid();

  updateAndDrawExplosions();

  // Fade the game-over screen in once the blast has had a moment to play.
  const FADE_DELAY = 600;
  const FADE_DURATION = 700;
  if (elapsed > FADE_DELAY) {
    const alpha = Math.min(1, (elapsed - FADE_DELAY) / FADE_DURATION);
    CONTEXT.save();
    CONTEXT.globalAlpha = alpha;
    drawRestartScreenInfo();
    CONTEXT.restore();
  }
}

let lastFrameTime = 0;

function gameLoop(currentTime) {
  if (rlActive()) {
    drawRL(currentTime);
    requestAnimationFrame(gameLoop);
    return;
  }

  if (brActive()) {
    // Battle Royale owns the screen, input, and its own networked loop.
    drawBR(currentTime);
    requestAnimationFrame(gameLoop);
    return;
  }

  if (shopOpen) {
    // Shop overlay (reachable from the start and game-over screens).
    CANVAS.style.cursor = "default";
    drawShopScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (leaderboardOpen) {
    // World-records overlay.
    CANVAS.style.cursor = "default";
    drawLeaderboardScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (myRecordsOpen) {
    // Personal records overlay.
    CANVAS.style.cursor = "default";
    drawMyRecordsScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (needsName) {
    // First-launch: ask for a pilot name before anything else.
    CANVAS.style.cursor = "default";
    drawNameScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (!gameStarted) {
    // Start screen — keep animating so button hover updates.
    CANVAS.style.cursor = "default";
    drawStartScreenInfo();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (gameOver) {
    // Death sequence: blow up the ship, then fade in the game-over screen.
    CANVAS.style.cursor = "default";
    drawDeathSequence(performance.now());
    requestAnimationFrame(gameLoop);
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
    CANVAS.style.cursor = "crosshair";
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

    // Twinkling starfield behind the action.
    drawStarfield();

    player.updatePlayer();

    // Ramp asteroid speed up the longer this run lasts.
    updateSpeedRamp(currentTime - gameStartTime);

    // Asteroid spawning (time-based; interval set by difficulty).
    if (currentTime - lastSpawnTime >= getDifficulty().spawnInterval) {
      spawnAsteroids();
      lastSpawnTime = currentTime;
    }

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
    updateAndDrawExplosions();

    for (let i = PROJECTILES.length - 1; i >= 0; i--) {
      const projectile = PROJECTILES[i];
      projectile.updateProjectile();
    }

    // Power-ups: draw, age out, and let the player "eat" them on contact.
    updateAndCollectPowerUps(currentTime);

    // The gun fires automatically (much faster with Rapid Fire active).
    const fireInterval = currentTime < player.rapidFireUntil ? 70 : 220;
    if (currentTime - lastShotTime >= fireInterval) {
      fireProjectile();
      lastShotTime = currentTime;
    }

    // Active power-up / difficulty HUD.
    drawHud(currentTime);

    // Prominent speed gauge (centred under the score).
    drawSpeedIndicator();

    // FPS COUNTER
    calculateFPS(currentTime);
    drawFPS();
    requestAnimationFrame(gameLoop);
  } else {
    // Paused — keep animating so the Resume button hover updates.
    CANVAS.style.cursor = "default";
    drawPauseMenuInfo();
    requestAnimationFrame(gameLoop);
    return;
  }
}

// Sign in + load the cloud profile (money / skins / scores), then start.
initCloud();
gameLoop();

///// Power-ups /////
function applyPowerUp(type, now) {
  if (type === "rapid") {
    player.rapidFireUntil = now + POWERUP_DURATION;
  } else if (type === "spread") {
    player.spreadUntil = now + POWERUP_DURATION;
  } else if (type === "shield") {
    player.shield = true;
  }
}

function updateAndCollectPowerUps(now) {
  for (let i = POWERUPS.length - 1; i >= 0; i--) {
    const p = POWERUPS[i];
    p.update();

    const dx = p.coordinates.x - player.coordinates.x;
    const dy = p.coordinates.y - player.coordinates.y;
    if (Math.hypot(dx, dy) < p.radius + 24) {
      applyPowerUp(p.type, now);
      POWERUPS.splice(i, 1);
      soundManager.playSound("FIRE_SOUND", 0.25);
      continue;
    }

    if (p.life <= 0) {
      POWERUPS.splice(i, 1);
    }
  }
}

// Draws an energy gauge (icon + depleting bar) for one power-up.
function drawEnergyBar(x, y, type, fraction, color) {
  const barW = 150;
  const barH = 12;
  const iconBox = 24;
  const clamped = Math.max(0, Math.min(1, fraction));

  CONTEXT.save();

  // Icon to the left of the bar.
  CONTEXT.translate(x + iconBox / 2, y + barH / 2);
  CONTEXT.scale(0.75, 0.75);
  drawIcon(type, color);
  CONTEXT.restore();

  const bx = x + iconBox + 6;
  const by = y;

  // Track.
  CONTEXT.fillStyle = "rgba(255, 255, 255, 0.12)";
  CONTEXT.fillRect(bx, by, barW, barH);

  // Energy fill (glowing).
  CONTEXT.save();
  CONTEXT.fillStyle = color;
  CONTEXT.shadowColor = color;
  CONTEXT.shadowBlur = 8;
  CONTEXT.fillRect(bx, by, barW * clamped, barH);
  CONTEXT.restore();

  // Border.
  CONTEXT.strokeStyle = color;
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeRect(bx, by, barW, barH);
}

function drawHud(now) {
  CONTEXT.save();
  CONTEXT.textAlign = "left";
  CONTEXT.textBaseline = "alphabetic";
  CONTEXT.font = "14px monospace";

  const x = 14;
  let y = 45; // Below the FPS counter.

  CONTEXT.fillStyle = "rgb(170, 170, 185)";
  CONTEXT.fillText(`MODE: ${getDifficulty().label}`, x, y);
  y += 16;

  // Energy gauges for whatever power-ups are active.
  if (now < player.rapidFireUntil) {
    drawEnergyBar(
      x,
      y,
      "rapid",
      (player.rapidFireUntil - now) / POWERUP_DURATION,
      POWERUP_TYPES.rapid.color
    );
    y += 22;
  }
  if (now < player.spreadUntil) {
    drawEnergyBar(
      x,
      y,
      "spread",
      (player.spreadUntil - now) / POWERUP_DURATION,
      POWERUP_TYPES.spread.color
    );
    y += 22;
  }
  if (player.shield) {
    // Shield is a one-hit charge, so its gauge stays full while held.
    drawEnergyBar(x, y, "shield", 1, POWERUP_TYPES.shield.color);
  }

  CONTEXT.restore();
}

// Big, centred speed gauge so the player can see the run getting faster.
function drawSpeedIndicator() {
  const ramp = runtime.speedRamp;
  const t = Math.min(1, (ramp - 1) / (SPEED_RAMP_MAX - 1)); // 0 (start) .. 1 (max)

  // Colour shifts green -> red as speed climbs.
  const r = Math.round(120 + t * (255 - 120));
  const g = Math.round(230 + t * (80 - 230));
  const b = Math.round(160 + t * (80 - 160));
  const color = `rgb(${r}, ${g}, ${b})`;

  const cx = CANVAS.width / 2;
  const y = 84;

  CONTEXT.save();
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "alphabetic";

  CONTEXT.font = "bold 22px monospace";
  CONTEXT.fillStyle = color;
  CONTEXT.shadowColor = color;
  CONTEXT.shadowBlur = 8 * t;
  CONTEXT.fillText(`SPEED x${ramp.toFixed(2)}`, cx, y);
  CONTEXT.shadowBlur = 0;

  // Progress-to-max bar.
  const barW = 180;
  const barH = 8;
  const bx = cx - barW / 2;
  const by = y + 9;
  CONTEXT.fillStyle = "rgba(255, 255, 255, 0.12)";
  CONTEXT.fillRect(bx, by, barW, barH);
  CONTEXT.fillStyle = color;
  CONTEXT.fillRect(bx, by, barW * t, barH);
  CONTEXT.strokeStyle = "rgba(255, 255, 255, 0.25)";
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeRect(bx, by, barW, barH);

  if (t >= 1) {
    CONTEXT.fillStyle = color;
    CONTEXT.font = "12px monospace";
    CONTEXT.fillText("MAX SPEED", cx, by + barH + 14);
  }

  CONTEXT.restore();
}

///// Controls /////
let lastShotTime = 0;

function fireProjectile() {
  soundManager.playSound("FIRE_SOUND", 0.1);

  // Spread Shot fires a 3-way fan; otherwise a single bolt.
  const spread = performance.now() < player.spreadUntil;
  const angleOffsets = spread ? [-0.18, 0, 0.18] : [0];

  for (const offset of angleOffsets) {
    const rotation = player.rotation + offset;
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);

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
}

// Track the mouse so the ship can aim at it.
window.addEventListener("mousemove", (e) => {
  const rect = CANVAS.getBoundingClientRect();
  MOUSE.x = e.clientX - rect.left;
  MOUSE.y = e.clientY - rect.top;
});

// Left click only interacts with on-screen buttons (the gun is automatic).
window.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (dialogOpen()) return; // A modal dialog is handling input.
  if (brActive()) return; // Battle Royale handles its own clicks.

  const rect = CANVAS.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Overlays take priority while open.
  if (shopOpen) {
    for (const btn of getShopButtons()) {
      if (!isInside(mx, my, btn)) continue;
      if (btn.id === "back") {
        shopOpen = false;
      } else if (btn.id === "skin") {
        if (!cloud.online) {
          gameAlert("Set a pilot name (CHANGE NAME) to buy skins and save your progress.");
        } else {
          // Server buys (or equips, if owned) and validates funds.
          buyOrEquipSkin(btn.category, btn.skinId);
        }
      }
      return;
    }
    return;
  }

  if (leaderboardOpen) {
    for (const btn of getLeaderboardButtons()) {
      if (isInside(mx, my, btn) && btn.id === "lb-back") leaderboardOpen = false;
    }
    return;
  }

  if (myRecordsOpen) {
    for (const btn of getMyRecordsButtons()) {
      if (isInside(mx, my, btn) && btn.id === "mr-back") myRecordsOpen = false;
    }
    return;
  }

  if (needsName) {
    for (const btn of getNameButtons()) {
      if (!isInside(mx, my, btn)) continue;
      if (btn.id === "enter-name") {
        enterName();
      } else if (btn.id === "play-unknown") {
        playUnknown();
      }
      return;
    }
    return;
  }

  let buttons = [];
  if (!gameStarted) buttons = getStartButtons();
  else if (gameOver) buttons = getRestartButtons();
  else if (isPaused) buttons = getPauseButtons();
  else return; // Playing: clicks do nothing.

  for (const btn of buttons) {
    if (!isInside(mx, my, btn)) continue;
    if (btn.id === "difficulty") setDifficulty(btn.key);
    else if (btn.id === "start") startGame();
    else if (btn.id === "battleroyale") openBattleRoyale();
    else if (btn.id === "roguelike") openRoguelike();
    else if (btn.id === "restart") restartGame();
    else if (btn.id === "resume") resumeGame();
    else if (btn.id === "lobby") goToLobby();
    else if (btn.id === "shop") shopOpen = true;
    else if (btn.id === "leaderboard") {
      leaderboardOpen = true;
      openLeaderboard();
    } else if (btn.id === "myrecords") {
      myRecordsOpen = true;
    } else if (btn.id === "name") {
      enterName();
    }
    return;
  }
});

window.addEventListener("keydown", (e) => {
  if (dialogOpen()) return; // Let the modal dialog handle typing.
  if (brActive()) return; // Battle Royale handles its own keys.

  // Optional shortcut: pick difficulty with number keys on the menus.
  if (/^Digit[1-4]$/.test(e.code) && (!gameStarted || gameOver)) {
    setDifficulty(DIFFICULTY_ORDER[Number(e.code.slice(-1)) - 1]);
    return;
  }

  if (e.code === "Escape" && gameStarted && !gameOver) {
    togglePause();
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
  if (brActive()) return; // Battle Royale handles its own keys.
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
