// src/roguelike/rl.js
import { CANVAS, CONTEXT } from "../core/canvas.js";
import { GREY, ASTEROIDS, PROJECTILES, MOUSE, KEYPRESS, ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS, ASTEROID_MAX_SPEED, ASTEROID_SPLIT_THRESHOLD } from "../core/constants.js";
import { player, Projectile, Asteroid } from "../entities/entities.js";
import { splitAsteroid } from "../entities/asteroids.js";
import { POWERUPS } from "../entities/powerUps.js";
import { renderParticles, updateParticles } from "../entities/particles.js";
import { drawStarfield } from "../core/starfield.js";
import { isInside } from "../ui/ui.js";
import { dialogOpen } from "../ui/dialog.js";
import { cloudSubmitRun, cloud } from "../cloud/cloud.js";
import { setLastEarned } from "../systems/money.js";
import { controlScheme } from "../systems/controls.js";
import soundManager from "../audio/soundManager.js";

import { rlState, resetRlState, xpRequired, gainXP, addScore, getStackCount, addUpgradeStack } from "./rlState.js";
import { drawThreeCards, fireIntervalMs, moveSpeedMult, bulletRadiusMult, xpMultiplier, shieldRechargeMs, pierceStacks, ricochetBounces, forkShotShards, magnetRadiusMult, magnetPullsXP, orbitRingCount, orbitRingFastSpin, novaBurstStacks, ghostShipDurationMs } from "./rlUpgrades.js";
import { Boss } from "./rlBoss.js";
import { ENEMIES, ENEMY_BULLETS, clearEnemies, countType, spawnChaser, spawnHunter, updateEnemies, drawEnemies } from "./rlEnemies.js";
import {
  drawXPStrip, drawLevelBadge, drawRLScore, drawBossHPBar,
  drawUpgradeOverlay, getUpgradeCardButtons,
  drawRLMenu, getRLMenuButtons,
  drawRLEnd, getRLEndButtons,
  drawBossCountdown, drawRLWin, getRLWinButtons,
} from "./rlRender.js";

// ── Module-level state ────────────────────────────────────────────────────────
let open = false;
let upgradeCards = [];
let hoveredCardIndex = -1;
let boss = null;
let runBanked = false;

const EXPLOSIONS = [];
const XPORBS = [];
const ORBIT_COOLDOWNS = [];
const RL_SPEED_RAMP_RATE = 0.012;
const RL_SPEED_RAMP_MAX = 2.2;
const RL_MOVE_SPEED_FACTOR = 0.85; // ~6 px/frame vs single-player's 7 (MOVEMENT_SPEED).

const WORLD_SCREENS = 3;
let WORLD_W = 0;
let WORLD_H = 0;
let camX = 0;
let camY = 0;

const STAGE_DURATION_MS = 240000;       // 4 min to boss
const RL_SPAWN_INTERVAL_START = 2000;
const RL_SPAWN_INTERVAL_END = 450;
const RL_MAX_ASTEROIDS_START = 6;
const RL_MAX_ASTEROIDS_END = 30;

// Enemy population caps (live count, not per-wave).
const MAX_CHASERS = 6;
const MAX_HUNTERS = 4;

// Discrete waves layered on top of the steady asteroid trickle. `at` is elapsed
// stage time in ms (uses the pause-adjusted stageStartTime). Rocks here are a
// surge that ignores the steady asteroid cap; enemy spawns respect the caps above.
const WAVES = [
  { at: 40000,  rocks: 8,  chasers: 0, hunters: 0, label: "WAVE 1" },
  { at: 80000,  rocks: 6,  chasers: 4, hunters: 0, label: "WAVE 2" },
  { at: 120000, rocks: 8,  chasers: 5, hunters: 0, label: "WAVE 3" },
  { at: 160000, rocks: 4,  chasers: 3, hunters: 3, label: "WAVE 4" },
  { at: 200000, rocks: 10, chasers: 5, hunters: 4, label: "WAVE 5" },
];

function _lerp(a, b, t) { return a + (b - a) * t; }

function _updateCamera() {
  camX = Math.max(0, Math.min(WORLD_W - CANVAS.width,  player.coordinates.x - CANVAS.width / 2));
  camY = Math.max(0, Math.min(WORLD_H - CANVAS.height, player.coordinates.y - CANVAS.height / 2));
}

function _clampPlayerToWorld() {
  player.coordinates.x = Math.max(16, Math.min(WORLD_W - 16, player.coordinates.x));
  player.coordinates.y = Math.max(16, Math.min(WORLD_H - 16, player.coordinates.y));
}

export function rlActive() { return open; }

export function openRoguelike() {
  open = true;
  rlState.screen = "menu";
}

function closeRoguelike() {
  open = false;
  rlState.screen = "menu";
  _clearRunState();
}

function _clearRunState() {
  ASTEROIDS.length = 0;
  PROJECTILES.length = 0;
  POWERUPS.length = 0;
  EXPLOSIONS.length = 0;
  XPORBS.length = 0;
  ORBIT_COOLDOWNS.length = 0;
  clearEnemies();
  boss = null;
  upgradeCards = [];
  hoveredCardIndex = -1;
}

function startRun(now) {
  _clearRunState();
  resetRlState(now);
  runBanked = false;
  WORLD_W = CANVAS.width * WORLD_SCREENS;
  WORLD_H = CANVAS.height * WORLD_SCREENS;
  player.coordinates.x = WORLD_W / 2;
  player.coordinates.y = WORLD_H / 2;
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.shield = false;
  player.rapidFireUntil = 0;
  player.spreadUntil = 0;
  player.invulnUntil = 0;
}

function bankRun() {
  if (runBanked) return;
  runBanked = true;
  const earned = Math.floor(rlState.score / 10);
  setLastEarned(earned);
  cloudSubmitRun(rlState.score, "ROGUELIKE");
}

// ── Per-frame entry point ─────────────────────────────────────────────────────
export function drawRL(now) {
  if (rlState.screen === "menu") { drawRLMenu(); return; }
  if (rlState.screen === "end")  { drawRLEnd(cloud.bestScores["ROGUELIKE"], now); return; }
  if (rlState.screen === "win")  { drawRLWin(cloud.bestScores["ROGUELIKE"], now); return; }
  if (rlState.screen === "upgrade-pick") { _drawUpgradePick(); return; }
  if (rlState.screen === "boss")    { _playingFrame(now, true); return; }
  if (rlState.screen === "playing") { _playingFrame(now, false); return; }
}

function _drawUpgradePick() {
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStarfield();

  CONTEXT.save();
  CONTEXT.translate(-camX, -camY);
  for (const a of ASTEROIDS) a.drawAsteroid();
  player.drawPlayer();
  for (const p of PROJECTILES) p.drawProjectile();
  CONTEXT.restore();

  drawXPStrip(false);
  drawLevelBadge();
  drawRLScore();
  drawUpgradeOverlay(upgradeCards, hoveredCardIndex);
}

// ── XP for asteroid size ──────────────────────────────────────────────────────
function xpForRadius(r) {
  if (r >= 60) return 25;
  if (r >= 30) return 15;
  return 8;
}

// ── XP orb pickups ────────────────────────────────────────────────────────────
function _spawnXPOrb(coords, amount, now) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 1.2 + Math.random() * 1.5;
  XPORBS.push({
    x: coords.x, y: coords.y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    amount, spawnedAt: now,
  });
}

function _updateXPOrbs(now) {
  const XP_ORB_LIFETIME = 10000;
  const pulls = magnetPullsXP();
  const pickupR = 32 * magnetRadiusMult();

  for (let i = XPORBS.length - 1; i >= 0; i--) {
    const orb = XPORBS[i];
    const elapsed = now - orb.spawnedAt;

    if (elapsed >= XP_ORB_LIFETIME) {
      XPORBS.splice(i, 1);
      continue;
    }

    if (pulls) {
      const dx = player.coordinates.x - orb.x;
      const dy = player.coordinates.y - orb.y;
      const dist = Math.hypot(dx, dy) || 1;
      orb.vx = (dx / dist) * Math.min(8, 280 / dist);
      orb.vy = (dy / dist) * Math.min(8, 280 / dist);
    }

    orb.x += orb.vx;
    orb.y += orb.vy;
    // Gentle drag so orbs slow down and settle
    if (!pulls) { orb.vx *= 0.96; orb.vy *= 0.96; }
    orb.x = Math.max(0, Math.min(WORLD_W, orb.x));
    orb.y = Math.max(0, Math.min(WORLD_H, orb.y));

    if (elapsed >= 150 && Math.hypot(player.coordinates.x - orb.x, player.coordinates.y - orb.y) < pickupR) {
      gainXP(orb.amount);
      XPORBS.splice(i, 1);
      _checkLevelUp(now);
      continue;
    }

    const alpha = elapsed > 8000 ? 1 - (elapsed - 8000) / 2000 : 1;
    const pulse = 0.7 + 0.3 * Math.sin(elapsed * 0.006);
    CONTEXT.save();
    CONTEXT.beginPath();
    CONTEXT.arc(orb.x, orb.y, 6, 0, Math.PI * 2);
    CONTEXT.fillStyle = `rgba(120, 200, 255, ${alpha * pulse})`;
    CONTEXT.shadowColor = "#78c8ff";
    CONTEXT.shadowBlur = 14;
    CONTEXT.fill();
    CONTEXT.restore();
  }
}

// ── Off-camera spawn point (just outside the view, clamped into the world) ─────
function _offCameraSpawnPoint(margin) {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0)      { x = camX - margin;                 y = camY + Math.random() * CANVAS.height; }
  else if (side === 1) { x = camX + CANVAS.width + margin;  y = camY + Math.random() * CANVAS.height; }
  else if (side === 2) { y = camY - margin;                 x = camX + Math.random() * CANVAS.width; }
  else                 { y = camY + CANVAS.height + margin; x = camX + Math.random() * CANVAS.width; }
  x = Math.max(margin, Math.min(WORLD_W - margin, x));
  y = Math.max(margin, Math.min(WORLD_H - margin, y));
  return { x, y };
}

// ── Asteroid spawning ─────────────────────────────────────────────────────────
function _spawnRLAsteroid() {
  const radius = ASTEROID_MIN_RADIUS + Math.random() * (ASTEROID_MAX_RADIUS - ASTEROID_MIN_RADIUS);

  const { x, y } = _offCameraSpawnPoint(radius + 20);

  const angle = Math.atan2(player.coordinates.y - y, player.coordinates.x - x) + (Math.random() - 0.5) * 0.8;
  const sizeFactor = Math.min(2.0, Math.max(0.7, 40 / radius));
  const speed = Math.min(ASTEROID_MAX_SPEED, (1.8 + Math.random() * 1.6) * sizeFactor * rlState.speedRamp);
  ASTEROIDS.push(new Asteroid({ coordinates: { x, y }, velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, radius }));
}

// ── RL-local asteroid step (bounces off world walls) ─────────────────────────
function _rlUpdateAsteroid(a) {
  a.drawAsteroid();
  a.coordinates.x += a.velocity.x;
  a.coordinates.y += a.velocity.y;
  a.rotation += a.rotationSpeed;

  const r = a.radius;
  if (a.coordinates.x < r)                { a.coordinates.x = r;            a.velocity.x = Math.abs(a.velocity.x); }
  else if (a.coordinates.x > WORLD_W - r) { a.coordinates.x = WORLD_W - r; a.velocity.x = -Math.abs(a.velocity.x); }
  if (a.coordinates.y < r)                { a.coordinates.y = r;            a.velocity.y = Math.abs(a.velocity.y); }
  else if (a.coordinates.y > WORLD_H - r) { a.coordinates.y = WORLD_H - r; a.velocity.y = -Math.abs(a.velocity.y); }
}

// ── Projectile firing ─────────────────────────────────────────────────────────
function _rlFireProjectile() {
  soundManager.playSound("FIRE_SOUND", 0.1);
  const baseRadius = 3 * bulletRadiusMult();
  const spread = performance.now() < player.spreadUntil;
  const offsets = spread ? [-0.18, 0, 0.18] : [0];
  for (const off of offsets) {
    const rot = player.rotation + off;
    const p = new Projectile({
      coordinates: { x: player.coordinates.x + Math.cos(rot) * 45, y: player.coordinates.y + Math.sin(rot) * 45 },
      velocity: { x: 26 * Math.cos(rot), y: 26 * Math.sin(rot) },
    });
    p.radius = baseRadius;
    p.bouncesLeft = ricochetBounces();
    p.piercing = pierceStacks() > 0;
    p.pierceSplit = pierceStacks() >= 2;
    PROJECTILES.push(p);
  }
}

// ── Projectile update (ricochet support) ──────────────────────────────────────
function _rlUpdateProjectiles() {
  for (let i = PROJECTILES.length - 1; i >= 0; i--) {
    const p = PROJECTILES[i];
    p.drawProjectile();
    // Heavy Shot: draw a glow halo proportional to the enlarged radius
    if (p.radius > 3.5) {
      CONTEXT.save();
      CONTEXT.beginPath();
      CONTEXT.arc(p.coordinates.x, p.coordinates.y, p.radius, 0, Math.PI * 2);
      CONTEXT.fillStyle = "rgba(255, 160, 40, 0.35)";
      CONTEXT.shadowColor = "#ff8822";
      CONTEXT.shadowBlur = p.radius * 3;
      CONTEXT.fill();
      CONTEXT.restore();
    }
    p.coordinates.x += p.velocity.x;
    p.coordinates.y += p.velocity.y;
    p.distanceTraveled = (p.distanceTraveled || 0) + Math.hypot(p.velocity.x, p.velocity.y);

    if (p.distanceTraveled >= (p.maxDistance || 550)) {
      PROJECTILES.splice(i, 1);
      continue;
    }

    if (p.bouncesLeft > 0) {
      let bounced = false;
      if (p.coordinates.x < 0 || p.coordinates.x > WORLD_W) {
        p.velocity.x *= -1;
        p.coordinates.x = Math.max(0, Math.min(WORLD_W, p.coordinates.x));
        bounced = true;
      }
      if (p.coordinates.y < 0 || p.coordinates.y > WORLD_H) {
        p.velocity.y *= -1;
        p.coordinates.y = Math.max(0, Math.min(WORLD_H, p.coordinates.y));
        bounced = true;
      }
      if (bounced) p.bouncesLeft--;
    } else {
      if (p.coordinates.x < 0 || p.coordinates.x > WORLD_W ||
          p.coordinates.y < 0 || p.coordinates.y > WORLD_H) {
        PROJECTILES.splice(i, 1);
        continue;
      }
    }
  }
}

// ── Projectile-asteroid collisions ────────────────────────────────────────────
function _rlDetectProjectileHits(now) {
  for (let i = PROJECTILES.length - 1; i >= 0; i--) {
    const proj = PROJECTILES[i];
    for (let j = ASTEROIDS.length - 1; j >= 0; j--) {
      const ast = ASTEROIDS[j];
      const dist = Math.hypot(proj.coordinates.x - ast.coordinates.x, proj.coordinates.y - ast.coordinates.y);
      if (dist >= proj.radius + ast.radius) continue;

      const scoreGain = Math.round(15 * (1 - ast.radius / 450));
      addScore(scoreGain);
      const xpGain = xpForRadius(ast.radius) * xpMultiplier();
      _spawnXPOrb({ ...ast.coordinates }, xpGain, now);
      rlState.asteroidsKilled++;

      soundManager.playSound("ASTEROID_HIT", 0.1);
      _spawnExplosion(ast.coordinates, ast.radius);

      const shards = forkShotShards();
      const children = splitAsteroid(ast);
      if (shards > 0) {
        const angle = Math.atan2(ast.velocity.y, ast.velocity.x);
        for (let s = 0; s < shards; s++) {
          const a = angle + (Math.PI / 4) * (s % 2 === 0 ? 1 : -1) * Math.ceil((s + 1) / 2);
          const spd = Math.min(ASTEROID_MAX_SPEED, 3.5 * rlState.speedRamp);
          children.push(new Asteroid({
            coordinates: { ...ast.coordinates },
            velocity: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
            radius: Math.max(ASTEROID_MIN_RADIUS, ast.radius * 0.45),
          }));
        }
      }

      ASTEROIDS.splice(j, 1);
      Array.prototype.push.apply(ASTEROIDS, children);

      if (proj.piercing) {
        if (proj.pierceSplit && children.length === 0) {
          for (let s = 0; s < 2; s++) {
            const a = proj.velocity ? Math.atan2(proj.velocity.y, proj.velocity.x) : 0;
            const off = s === 0 ? 0.5 : -0.5;
            ASTEROIDS.push(new Asteroid({
              coordinates: { ...ast.coordinates },
              velocity: { x: Math.cos(a + off) * 3, y: Math.sin(a + off) * 3 },
              radius: Math.max(10, ast.radius * 0.4),
            }));
          }
        }
        // XP deferred to orb pickup — no _checkLevelUp here
      } else if (proj.bouncesLeft > 0) {
        // Ricochet: reflect off the asteroid's surface normal
        const nx = proj.coordinates.x - ast.coordinates.x;
        const ny = proj.coordinates.y - ast.coordinates.y;
        const len = Math.hypot(nx, ny) || 1;
        const nnx = nx / len, nny = ny / len;
        const dot = proj.velocity.x * nnx + proj.velocity.y * nny;
        proj.velocity.x -= 2 * dot * nnx;
        proj.velocity.y -= 2 * dot * nny;
        proj.bouncesLeft--;
        break;
      } else {
        PROJECTILES.splice(i, 1);
        break;
      }
    }
  }
}

// ── Player-asteroid collision ─────────────────────────────────────────────────
function _rlDetectPlayerHit(now) {
  if (now < player.invulnUntil) return;
  if (now < rlState.ghostUntil) return;

  const verts = player.getVertices();
  for (let i = ASTEROIDS.length - 1; i >= 0; i--) {
    const ast = ASTEROIDS[i];
    if (!_circleTriangleHit(ast, verts)) continue;

    if (player.shield) {
      player.shield = false;
      player.invulnUntil = now + 1500;
      _spawnExplosion(ast.coordinates, ast.radius);
      ASTEROIDS.splice(i, 1);
      soundManager.playSound("ASTEROID_HIT", 0.15);
      if (shieldRechargeMs() < Infinity) {
        rlState.shieldRechargeAt = now + shieldRechargeMs();
      }
    } else {
      const ghostDur = ghostShipDurationMs();
      if (ghostDur > 0 && now >= rlState.ghostCooldownUntil) {
        rlState.ghostUntil = now + ghostDur;
        rlState.ghostCooldownUntil = now + 20000;
        soundManager.playSound("ASTEROID_HIT", 0.1);
        return;
      }
      _triggerDeath(now);
    }
    return;
  }
}

function _circleTriangleHit(circle, triangle) {
  for (let i = 0; i < 3; i++) {
    const s = triangle[i];
    const e = triangle[(i + 1) % 3];
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const len2 = dx * dx + dy * dy;
    const dot = ((circle.coordinates.x - s.x) * dx + (circle.coordinates.y - s.y) * dy) / len2;
    let cx = s.x + dot * dx;
    let cy = s.y + dot * dy;
    const minX = Math.min(s.x, e.x), maxX = Math.max(s.x, e.x);
    const minY = Math.min(s.y, e.y), maxY = Math.max(s.y, e.y);
    if (cx < minX || cx > maxX) cx = cx < minX ? minX : maxX;
    if (cy < minY || cy > maxY) cy = cy < minY ? minY : maxY;
    if (Math.hypot(cx - circle.coordinates.x, cy - circle.coordinates.y) <= circle.radius) return true;
  }
  return false;
}

// ── Boss collision detection ───────────────────────────────────────────────────
function _rlDetectBossHits(now) {
  if (!boss) return;
  for (let i = PROJECTILES.length - 1; i >= 0; i--) {
    const p = PROJECTILES[i];
    const minionIdx = boss.hitMinion(p.coordinates.x, p.coordinates.y, p.radius);
    if (minionIdx >= 0) {
      boss.damageMinion(minionIdx);
      if (!p.piercing) PROJECTILES.splice(i, 1);
      soundManager.playSound("ASTEROID_HIT", 0.12);
      continue;
    }
    if (boss.hitCore(p.coordinates.x, p.coordinates.y, p.radius)) {
      boss.damageCore();
      if (!p.piercing) PROJECTILES.splice(i, 1);
      soundManager.playSound("ASTEROID_HIT", 0.15);
      if (boss.hp <= 0) {
        _spawnExplosion({ x: boss.x, y: boss.y }, 60);
        soundManager.playSound("ASTEROID_HIT", 0.4);
        _onBossDefeated(now);
        return;
      }
    }
  }

  if (now < player.invulnUntil || now < rlState.ghostUntil) return;
  if (boss.collidesWithPlayer(player.coordinates.x, player.coordinates.y)) {
    if (player.shield) {
      player.shield = false;
      player.invulnUntil = now + 1500;
      if (shieldRechargeMs() < Infinity) rlState.shieldRechargeAt = now + shieldRechargeMs();
      boss.bullets = boss.bullets.filter(
        (b) => Math.hypot(b.x - player.coordinates.x, b.y - player.coordinates.y) >= 21
      );
    } else {
      const ghostDur = ghostShipDurationMs();
      if (ghostDur > 0 && now >= rlState.ghostCooldownUntil) {
        rlState.ghostUntil = now + ghostDur;
        rlState.ghostCooldownUntil = now + 20000;
        boss.bullets = boss.bullets.filter(
          (b) => Math.hypot(b.x - player.coordinates.x, b.y - player.coordinates.y) >= 21
        );
        return;
      }
      _triggerDeath(now);
    }
  }
}

// ── Player damage (shield pop / ghost phase / death) ──────────────────────────
// Returns true if the run ended.
function _playerTakeHit(now, fromCoords, fxRadius) {
  if (player.shield) {
    player.shield = false;
    player.invulnUntil = now + 1500;
    _spawnExplosion(fromCoords, fxRadius);
    soundManager.playSound("ASTEROID_HIT", 0.15);
    if (shieldRechargeMs() < Infinity) rlState.shieldRechargeAt = now + shieldRechargeMs();
    return false;
  }
  const ghostDur = ghostShipDurationMs();
  if (ghostDur > 0 && now >= rlState.ghostCooldownUntil) {
    rlState.ghostUntil = now + ghostDur;
    rlState.ghostCooldownUntil = now + 20000;
    soundManager.playSound("ASTEROID_HIT", 0.1);
    return false;
  }
  _triggerDeath(now);
  return true;
}

// ── Wave scheduling ───────────────────────────────────────────────────────────
function _fireWavesIfDue(now, elapsed) {
  if (rlState.nextWaveIndex >= WAVES.length) return;
  const w = WAVES[rlState.nextWaveIndex];
  if (elapsed < w.at) return;
  rlState.nextWaveIndex++;

  for (let i = 0; i < w.rocks; i++) _spawnRLAsteroid();
  for (let i = 0; i < w.chasers && countType("chaser") < MAX_CHASERS; i++) {
    const p = _offCameraSpawnPoint(30);
    spawnChaser(p.x, p.y);
  }
  for (let i = 0; i < w.hunters && countType("hunter") < MAX_HUNTERS; i++) {
    const p = _offCameraSpawnPoint(30);
    spawnHunter(p.x, p.y, now);
  }

  rlState.waveFlashUntil = now + 1800;
  rlState.waveFlashLabel = w.label;
  soundManager.playSound("ASTEROID_HIT", 0.2);
}

// ── Projectile-enemy collisions ───────────────────────────────────────────────
function _rlDetectEnemyHits(now) {
  for (let i = PROJECTILES.length - 1; i >= 0; i--) {
    const proj = PROJECTILES[i];
    for (let j = ENEMIES.length - 1; j >= 0; j--) {
      const e = ENEMIES[j];
      if (Math.hypot(proj.coordinates.x - e.x, proj.coordinates.y - e.y) >= proj.radius + e.radius) continue;

      e.hp--;
      soundManager.playSound("ASTEROID_HIT", 0.1);
      if (e.hp <= 0) {
        const isHunter = e.type === "hunter";
        addScore(isHunter ? 40 : 25);
        _spawnXPOrb({ x: e.x, y: e.y }, (isHunter ? 20 : 12) * xpMultiplier(), now);
        _spawnExplosion({ x: e.x, y: e.y }, e.radius * 2.2);
        ENEMIES.splice(j, 1);
      }
      if (!proj.piercing) { PROJECTILES.splice(i, 1); break; }
    }
  }
}

// ── Enemy/enemy-bullet vs player ──────────────────────────────────────────────
// Returns true if the run ended.
function _rlDetectEnemyPlayerHits(now) {
  if (now < player.invulnUntil || now < rlState.ghostUntil) return false;

  for (let i = ENEMIES.length - 1; i >= 0; i--) {
    const e = ENEMIES[i];
    if (Math.hypot(e.x - player.coordinates.x, e.y - player.coordinates.y) < e.radius + 16) {
      if (e.type === "chaser") ENEMIES.splice(i, 1); // chaser detonates on impact
      return _playerTakeHit(now, { x: e.x, y: e.y }, e.radius * 2);
    }
  }

  for (let i = ENEMY_BULLETS.length - 1; i >= 0; i--) {
    const b = ENEMY_BULLETS[i];
    if (Math.hypot(b.x - player.coordinates.x, b.y - player.coordinates.y) < 16 + 4.5) {
      ENEMY_BULLETS.splice(i, 1);
      return _playerTakeHit(now, { x: b.x, y: b.y }, 16);
    }
  }

  return false;
}

// ── Explosions ────────────────────────────────────────────────────────────────
function _spawnExplosion(coords, radius) {
  EXPLOSIONS.push({
    coordinates: { ...coords },
    particles: [],
    maxParticles: Math.min(60, Math.floor(radius * 0.8) + 14),
    particleSpeed: 2 + radius / 40,
    particleRadius: 1 + radius / 70,
    particleColor: "255, 180, 70",
    explosionDuration: 35,
    frameCount: 0,
  });
}

function _updateExplosions() {
  for (let i = EXPLOSIONS.length - 1; i >= 0; i--) {
    const ex = EXPLOSIONS[i];
    if (ex.frameCount === 0) {
      for (let j = ex.particles.length; j < ex.maxParticles; j++) {
        const a = Math.random() * Math.PI * 2;
        ex.particles.push({
          coordinates: { ...ex.coordinates },
          velocity: { x: Math.cos(a) * ex.particleSpeed, y: Math.sin(a) * ex.particleSpeed },
          radius: ex.particleRadius,
          color: ex.particleColor,
          alpha: 1,
        });
      }
    }
    updateParticles(ex);
    ex.frameCount++;
    if (ex.frameCount >= ex.explosionDuration) { EXPLOSIONS.splice(i, 1); continue; }
    renderParticles(ex);
  }
}

// ── Power-up handling ─────────────────────────────────────────────────────────
function _rlUpdatePowerUps(now) {
  const magMult = magnetRadiusMult();
  for (let i = POWERUPS.length - 1; i >= 0; i--) {
    const p = POWERUPS[i];
    p.update();
    const pickupRadius = (p.radius + 24) * magMult;
    if (Math.hypot(p.coordinates.x - player.coordinates.x, p.coordinates.y - player.coordinates.y) < pickupRadius) {
      if (p.type === "rapid") player.rapidFireUntil = now + 8000;
      else if (p.type === "spread") player.spreadUntil = now + 8000;
      else if (p.type === "shield") player.shield = true;
      POWERUPS.splice(i, 1);
      soundManager.playSound("FIRE_SOUND", 0.25);
      continue;
    }
    if (p.life <= 0) POWERUPS.splice(i, 1);
  }
}

// ── Orbit ring ────────────────────────────────────────────────────────────────
function _drawOrbitRing(now) {
  const count = orbitRingCount();
  if (count === 0) return;
  const spinSpeed = orbitRingFastSpin() ? 0.06 : 0.035;
  rlState.orbitAngle += spinSpeed;
  const orbitR = 58;
  const orbR = 7;

  for (let i = 0; i < count; i++) {
    const angle = rlState.orbitAngle + (Math.PI * 2 * i) / count;
    const ox = player.coordinates.x + Math.cos(angle) * orbitR;
    const oy = player.coordinates.y + Math.sin(angle) * orbitR;

    const cooldownExpiry = ORBIT_COOLDOWNS[i] || 0;
    const onCooldown = now < cooldownExpiry;
    // Flicker: show orb on alternating 80ms ticks while cooling down
    const visible = !onCooldown || Math.floor(now / 80) % 2 === 0;

    if (visible) {
      CONTEXT.save();
      CONTEXT.beginPath();
      CONTEXT.arc(ox, oy, orbR, 0, Math.PI * 2);
      CONTEXT.fillStyle = onCooldown ? "rgba(180,180,220,0.45)" : "rgba(255,215,80,0.85)";
      CONTEXT.shadowColor = onCooldown ? "#8888cc" : "#ffd750";
      CONTEXT.shadowBlur = 12;
      CONTEXT.fill();
      CONTEXT.restore();
    }

    if (!onCooldown) {
      for (let j = ASTEROIDS.length - 1; j >= 0; j--) {
        const ast = ASTEROIDS[j];
        if (Math.hypot(ox - ast.coordinates.x, oy - ast.coordinates.y) < orbR + ast.radius) {
          const children = splitAsteroid(ast);
          _spawnExplosion(ast.coordinates, ast.radius);
          soundManager.playSound("ASTEROID_HIT", 0.08);
          const xpGain = xpForRadius(ast.radius) * xpMultiplier();
          _spawnXPOrb({ ...ast.coordinates }, xpGain, now);
          addScore(Math.round(15 * (1 - ast.radius / 450)));
          rlState.asteroidsKilled++;
          ASTEROIDS.splice(j, 1);
          Array.prototype.push.apply(ASTEROIDS, children);
          ORBIT_COOLDOWNS[i] = now + 3000;
          break;
        }
      }
    }
  }
}

// ── Level-up logic ────────────────────────────────────────────────────────────
function _checkLevelUp(now) {
  if (rlState.xp < rlState.xpRequired) return;
  rlState.xp -= rlState.xpRequired;
  rlState.level++;
  rlState.xpRequired = xpRequired(rlState.level);

  // Nova Burst: explosion on level-up
  const nova = novaBurstStacks();
  if (nova > 0) {
    const novaRadius = nova >= 2 ? 180 : 100;
    _spawnExplosion({ x: player.coordinates.x, y: player.coordinates.y }, novaRadius);
    soundManager.playSound("ASTEROID_HIT", 0.35);
    for (let i = ASTEROIDS.length - 1; i >= 0; i--) {
      const ast = ASTEROIDS[i];
      if (Math.hypot(ast.coordinates.x - player.coordinates.x, ast.coordinates.y - player.coordinates.y) < novaRadius) {
        addScore(Math.round(15 * (1 - ast.radius / 450)));
        gainXP(xpForRadius(ast.radius) * xpMultiplier());
        rlState.asteroidsKilled++;
        ASTEROIDS.splice(i, 1);
      }
    }
    if (nova >= 2 && boss) {
      boss.lastPatternTime = now + 3000;
    }
  }

  _openUpgradePick();
}

function _openUpgradePick() {
  rlState.pauseStartedAt = performance.now();
  upgradeCards = drawThreeCards();
  hoveredCardIndex = -1;
  rlState.screen = "upgrade-pick";
}

function _triggerBoss(now) {
  rlState.bossIndex++;
  rlState.bossSpawned = true;
  const spawnX = Math.max(120, Math.min(WORLD_W - 120, player.coordinates.x));
  const spawnY = Math.max(160, Math.min(WORLD_H - 120, player.coordinates.y - 260));
  boss = new Boss(rlState.bossIndex, spawnX, spawnY, WORLD_W, WORLD_H);
  rlState.screen = "boss";
}

function _pickUpgrade(upgradeId) {
  if (rlState.pauseStartedAt) {
    rlState.stageStartTime += performance.now() - rlState.pauseStartedAt;
    rlState.pauseStartedAt = 0;
  }
  addUpgradeStack(upgradeId);
  rlState.screen = boss ? "boss" : "playing";
}

function _onBossDefeated(now) {
  rlState.bossesDefeated++;
  addScore(500 * rlState.bossIndex);
  boss = null;
  bankRun();
  rlState.screen = "win";
}

function _triggerDeath(now) {
  bankRun();
  rlState.screen = "end";
  _clearRunState();
}

// ── Ghost ship cooldown indicator ─────────────────────────────────────────────
function _drawGhostIndicator(now) {
  const active = now < rlState.ghostUntil;
  const onCooldown = !active && now < rlState.ghostCooldownUntil;
  const x = CANVAS.width - 14;
  const y = 80;

  CONTEXT.save();
  CONTEXT.textAlign = "right";
  CONTEXT.font = "13px monospace";

  if (active) {
    CONTEXT.fillStyle = `rgba(100,200,255,${0.75 + 0.25 * Math.sin(now / 90)})`;
    CONTEXT.shadowColor = "#64c8ff";
    CONTEXT.shadowBlur = 8;
    CONTEXT.fillText("GHOST ACTIVE", x, y);
  } else if (onCooldown) {
    const secs = Math.ceil((rlState.ghostCooldownUntil - now) / 1000);
    CONTEXT.fillStyle = "rgba(150,150,180,0.85)";
    CONTEXT.fillText(`GHOST ${secs}s`, x, y);
  } else {
    CONTEXT.fillStyle = "rgba(100,220,140,0.85)";
    CONTEXT.fillText("GHOST READY", x, y);
  }
  CONTEXT.restore();
}

// ── Wave banner (screen space) ────────────────────────────────────────────────
function _drawWaveFlash(now) {
  if (now >= rlState.waveFlashUntil) return;
  const alpha = Math.min(1, (rlState.waveFlashUntil - now) / 600);
  CONTEXT.save();
  CONTEXT.textAlign = "center";
  CONTEXT.font = "bold 40px monospace";
  CONTEXT.fillStyle = `rgba(255,120,80,${alpha})`;
  CONTEXT.shadowColor = "rgba(255,120,80,0.8)";
  CONTEXT.shadowBlur = 18;
  CONTEXT.fillText(rlState.waveFlashLabel, CANVAS.width / 2, CANVAS.height * 0.28);
  CONTEXT.restore();
}

// ── Main playing frame ────────────────────────────────────────────────────────
function _playingFrame(now, isBoss) {
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStarfield();

  controlScheme();
  _updateCamera();
  player.rotation = Math.atan2(
    (MOUSE.y + camY) - player.coordinates.y,
    (MOUSE.x + camX) - player.coordinates.x
  );

  if (player.thrusting) {
    let m = RL_MOVE_SPEED_FACTOR;
    if (getStackCount("thruster") > 0) m *= moveSpeedMult();
    player.velocity.x *= m;
    player.velocity.y *= m;
  } else {
    player.velocity.x = 0;
    player.velocity.y = 0;
  }

  const elapsed = now - rlState.stageStartTime;
  const t = Math.max(0, Math.min(1, elapsed / STAGE_DURATION_MS));
  rlState.speedRamp = Math.min(RL_SPEED_RAMP_MAX, 1 + (elapsed / 1000) * RL_SPEED_RAMP_RATE);

  if (!isBoss && !rlState.bossSpawned && elapsed >= STAGE_DURATION_MS) {
    _triggerBoss(now);
    return;
  }

  CONTEXT.save();
  CONTEXT.translate(-camX, -camY);

  player.updatePlayer();
  _clampPlayerToWorld();

  const spawnInterval = _lerp(RL_SPAWN_INTERVAL_START, RL_SPAWN_INTERVAL_END, t);
  const maxAsteroids = Math.round(_lerp(RL_MAX_ASTEROIDS_START, RL_MAX_ASTEROIDS_END, t));
  if (now - rlState.lastSpawnTime >= spawnInterval && ASTEROIDS.length < maxAsteroids) {
    _spawnRLAsteroid();
    rlState.lastSpawnTime = now;
  }

  for (let i = ASTEROIDS.length - 1; i >= 0; i--) {
    _rlUpdateAsteroid(ASTEROIDS[i]);
  }

  _rlDetectPlayerHit(now);
  if (rlState.screen === "end") { CONTEXT.restore(); return; }

  if (isBoss && boss) {
    boss.step(now, player.coordinates.x, player.coordinates.y);
    boss.draw();
    _rlDetectBossHits(now);
    if (rlState.screen === "end") { CONTEXT.restore(); return; }
  }

  _rlUpdateProjectiles();
  _rlDetectProjectileHits(now);

  const fireInterval = fireIntervalMs(220);
  if (now - rlState.lastShotTime >= fireInterval) {
    _rlFireProjectile();
    rlState.lastShotTime = now;
  }

  _fireWavesIfDue(now, elapsed);
  updateEnemies(now, player.coordinates.x, player.coordinates.y, rlState.speedRamp, WORLD_W, WORLD_H);
  _rlDetectEnemyHits(now);
  if (_rlDetectEnemyPlayerHits(now)) { CONTEXT.restore(); return; }
  drawEnemies(CONTEXT);

  _rlUpdatePowerUps(now);
  _updateExplosions();
  _drawOrbitRing(now);
  _updateXPOrbs(now);

  if (now < rlState.ghostUntil) {
    CONTEXT.save();
    CONTEXT.globalAlpha = 0.35 + 0.2 * Math.sin(now / 80);
    CONTEXT.translate(player.coordinates.x, player.coordinates.y);
    CONTEXT.beginPath();
    CONTEXT.arc(0, 0, 30, 0, Math.PI * 2);
    CONTEXT.fillStyle = "rgba(100,180,255,0.3)";
    CONTEXT.strokeStyle = "rgba(100,180,255,0.6)";
    CONTEXT.lineWidth = 1.5;
    CONTEXT.fill();
    CONTEXT.stroke();
    CONTEXT.restore();
  }

  CONTEXT.restore();

  if (rlState.shieldRechargeAt > 0 && now >= rlState.shieldRechargeAt) {
    player.shield = true;
    rlState.shieldRechargeAt = 0;
  }

  drawXPStrip(isBoss);
  drawLevelBadge();
  drawRLScore();
  if (!rlState.bossSpawned) drawBossCountdown((rlState.stageStartTime + STAGE_DURATION_MS) - now);
  _drawWaveFlash(now);
  if (isBoss && boss) drawBossHPBar(boss);
  if (getStackCount("ghostShip") > 0) _drawGhostIndicator(now);
}

// ── Input handlers ────────────────────────────────────────────────────────────
window.addEventListener("mousemove", (e) => {
  if (!open || rlState.screen !== "upgrade-pick") return;
  const rect = CANVAS.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const btns = getUpgradeCardButtons(upgradeCards);
  hoveredCardIndex = btns.findIndex((b) => isInside(mx, my, b));
});

window.addEventListener("mousedown", (e) => {
  if (!open || e.button !== 0 || dialogOpen()) return;
  e.stopImmediatePropagation();

  const rect = CANVAS.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const now = performance.now();

  if (rlState.screen === "menu") {
    for (const btn of getRLMenuButtons()) {
      if (!isInside(mx, my, btn)) continue;
      if (btn.id === "rl-level-1") startRun(now);
      else if (btn.id === "rl-back") closeRoguelike();
      return;
    }
    return;
  }

  if (rlState.screen === "end") {
    for (const btn of getRLEndButtons()) {
      if (!isInside(mx, my, btn)) continue;
      if (btn.id === "rl-restart") startRun(now);
      else if (btn.id === "rl-back") closeRoguelike();
      return;
    }
    return;
  }

  if (rlState.screen === "win") {
    for (const btn of getRLWinButtons()) {
      if (!isInside(mx, my, btn)) continue;
      if (btn.id === "rl-restart") startRun(now);
      else if (btn.id === "rl-levels") { rlState.screen = "menu"; _clearRunState(); }
      return;
    }
    return;
  }

  if (rlState.screen === "upgrade-pick") {
    const btns = getUpgradeCardButtons(upgradeCards);
    for (let i = 0; i < btns.length; i++) {
      if (isInside(mx, my, btns[i])) {
        _pickUpgrade(upgradeCards[i].id);
        return;
      }
    }
    return;
  }
});

window.addEventListener("keydown", (e) => {
  if (!open || dialogOpen()) return;
  if (e.code === "Escape") {
    closeRoguelike();
    return;
  }
  if (rlState.screen === "playing" || rlState.screen === "boss" || rlState.screen === "upgrade-pick") {
    switch (e.code) {
      case "KeyW": KEYPRESS.w_key.pressed = true; break;
      case "KeyA": KEYPRESS.a_key.pressed = true; break;
      case "KeyS": KEYPRESS.s_key.pressed = true; break;
      case "KeyD": KEYPRESS.d_key.pressed = true; break;
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (!open) return;
  switch (e.code) {
    case "KeyW": KEYPRESS.w_key.pressed = false; break;
    case "KeyA": KEYPRESS.a_key.pressed = false; break;
    case "KeyS": KEYPRESS.s_key.pressed = false; break;
    case "KeyD": KEYPRESS.d_key.pressed = false; break;
  }
});
