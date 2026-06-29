// src/roguelike/rl.js
import { CANVAS, CONTEXT } from "../core/canvas.js";
import { GREY, ASTEROIDS, PROJECTILES, MOUSE, ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS, ASTEROID_MAX_SPEED, ASTEROID_SPLIT_THRESHOLD } from "../core/constants.js";
import { player, Projectile, Asteroid } from "../entities/entities.js";
import { splitAsteroid, getAsteroidSpawnData } from "../entities/asteroids.js";
import { POWERUPS } from "../entities/powerUps.js";
import { renderParticles, updateParticles } from "../entities/particles.js";
import { drawStarfield } from "../core/starfield.js";
import { isInside } from "../ui/ui.js";
import { dialogOpen } from "../ui/dialog.js";
import { cloudSubmitRun, cloud } from "../cloud/cloud.js";
import { setLastEarned } from "../systems/money.js";
import { controlScheme } from "../systems/controls.js";
import { enableCanvasWrap } from "../core/canvasWrap.js";
import soundManager from "../audio/soundManager.js";

import { rlState, resetRlState, xpRequired, gainXP, addScore, getStackCount, addUpgradeStack } from "./rlState.js";
import { drawThreeCards, fireIntervalMs, moveSpeedMult, bulletRadiusMult, xpMultiplier, shieldRechargeMs, pierceStacks, ricochetBounces, forkShotShards, magnetRadiusMult, orbitRingCount, orbitRingFastSpin, novaBurstStacks, ghostShipDurationMs } from "./rlUpgrades.js";
import { Boss } from "./rlBoss.js";
import {
  drawXPStrip, drawLevelBadge, drawRLScore, drawBossHPBar,
  drawUpgradeOverlay, getUpgradeCardButtons,
  drawRLMenu, getRLMenuButtons,
  drawRLEnd, getRLEndButtons,
} from "./rlRender.js";

// ── Module-level state ────────────────────────────────────────────────────────
let open = false;
let upgradeCards = [];
let hoveredCardIndex = -1;
let boss = null;
let runBanked = false;

const EXPLOSIONS = [];
const RL_MAX_ASTEROIDS = 30;
const RL_SPAWN_INTERVAL = 900;
const RL_SPEED_RAMP_RATE = 0.012;
const RL_SPEED_RAMP_MAX = 2.2;

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
  boss = null;
  upgradeCards = [];
  hoveredCardIndex = -1;
}

function startRun(now) {
  _clearRunState();
  resetRlState(now);
  runBanked = false;
  player.coordinates.x = CANVAS.width / 2;
  player.coordinates.y = CANVAS.height / 2;
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
  if (rlState.screen === "upgrade-pick") { _drawUpgradePick(); return; }
  if (rlState.screen === "boss")    { _playingFrame(now, true); return; }
  if (rlState.screen === "playing") { _playingFrame(now, false); return; }
}

function _drawUpgradePick() {
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStarfield();
  for (const a of ASTEROIDS) a.drawAsteroid();
  player.drawPlayer();
  for (const p of PROJECTILES) p.drawProjectile();
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

// ── Asteroid spawning ─────────────────────────────────────────────────────────
function _spawnRLAsteroid() {
  if (ASTEROIDS.length >= RL_MAX_ASTEROIDS) return;
  const { x, y } = getAsteroidSpawnData();
  const radius = ASTEROID_MIN_RADIUS + Math.random() * (ASTEROID_MAX_RADIUS - ASTEROID_MIN_RADIUS);
  const targetX = CANVAS.width / 2 + (Math.random() - 0.5) * CANVAS.width * 0.6;
  const targetY = CANVAS.height / 2 + (Math.random() - 0.5) * CANVAS.height * 0.6;
  const angle = Math.atan2(targetY - y, targetX - x);
  const sizeFactor = Math.min(2.0, Math.max(0.7, 40 / radius));
  const speed = Math.min(ASTEROID_MAX_SPEED, (1.8 + Math.random() * 1.6) * sizeFactor * rlState.speedRamp);
  ASTEROIDS.push(new Asteroid({ coordinates: { x, y }, velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, radius }));
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
    p.coordinates.x += p.velocity.x;
    p.coordinates.y += p.velocity.y;
    p.distanceTraveled = (p.distanceTraveled || 0) + Math.hypot(p.velocity.x, p.velocity.y);

    if (p.distanceTraveled >= (p.maxDistance || 550)) {
      PROJECTILES.splice(i, 1);
      continue;
    }

    if (p.bouncesLeft > 0) {
      let bounced = false;
      if (p.coordinates.x < 0 || p.coordinates.x > CANVAS.width) {
        p.velocity.x *= -1;
        p.coordinates.x = Math.max(0, Math.min(CANVAS.width, p.coordinates.x));
        bounced = true;
      }
      if (p.coordinates.y < 0 || p.coordinates.y > CANVAS.height) {
        p.velocity.y *= -1;
        p.coordinates.y = Math.max(0, Math.min(CANVAS.height, p.coordinates.y));
        bounced = true;
      }
      if (bounced) p.bouncesLeft--;
    } else {
      if (p.coordinates.x < 0) p.coordinates.x = CANVAS.width;
      else if (p.coordinates.x > CANVAS.width) p.coordinates.x = 0;
      if (p.coordinates.y < 0) p.coordinates.y = CANVAS.height;
      else if (p.coordinates.y > CANVAS.height) p.coordinates.y = 0;
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
      gainXP(xpGain);
      rlState.asteroidsKilled++;

      soundManager.playSound("ASTEROID_HIT", 0.1);
      _spawnExplosion(ast.coordinates, ast.radius);

      const shards = forkShotShards();
      const children = splitAsteroid(ast);
      if (shards > 0 && ast.radius > ASTEROID_SPLIT_THRESHOLD) {
        const angle = Math.atan2(ast.velocity.y, ast.velocity.x);
        for (let s = 0; s < shards; s++) {
          const a = angle + (Math.PI / 4) * (s % 2 === 0 ? 1 : -1) * Math.ceil((s + 1) / 2);
          const spd = Math.min(ASTEROID_MAX_SPEED, 3.5 * rlState.speedRamp);
          children.push(new Asteroid({
            coordinates: { ...ast.coordinates },
            velocity: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
            radius: ast.radius * 0.45,
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
      } else {
        PROJECTILES.splice(i, 1);
        break;
      }

      _checkLevelUp(now);
      break;
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
      if (ghostDur > 0) {
        rlState.ghostUntil = now + ghostDur;
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
      if (ghostDur > 0) {
        rlState.ghostUntil = now + ghostDur;
        boss.bullets = boss.bullets.filter(
          (b) => Math.hypot(b.x - player.coordinates.x, b.y - player.coordinates.y) >= 21
        );
        return;
      }
      _triggerDeath(now);
    }
  }
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

    CONTEXT.save();
    CONTEXT.beginPath();
    CONTEXT.arc(ox, oy, orbR, 0, Math.PI * 2);
    CONTEXT.fillStyle = "rgba(255,215,80,0.85)";
    CONTEXT.shadowColor = "#ffd750";
    CONTEXT.shadowBlur = 12;
    CONTEXT.fill();
    CONTEXT.restore();

    for (let j = ASTEROIDS.length - 1; j >= 0; j--) {
      const ast = ASTEROIDS[j];
      if (Math.hypot(ox - ast.coordinates.x, oy - ast.coordinates.y) < orbR + ast.radius) {
        const children = splitAsteroid(ast);
        _spawnExplosion(ast.coordinates, ast.radius);
        soundManager.playSound("ASTEROID_HIT", 0.08);
        const xpGain = xpForRadius(ast.radius) * xpMultiplier();
        gainXP(xpGain);
        addScore(Math.round(15 * (1 - ast.radius / 450)));
        rlState.asteroidsKilled++;
        ASTEROIDS.splice(j, 1);
        Array.prototype.push.apply(ASTEROIDS, children);
        _checkLevelUp(now);
        break;
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

  if (rlState.level % 5 === 0) {
    _triggerBoss(now);
  } else {
    _openUpgradePick();
  }
}

function _openUpgradePick() {
  upgradeCards = drawThreeCards();
  hoveredCardIndex = -1;
  rlState.screen = "upgrade-pick";
}

function _triggerBoss(now) {
  rlState.bossIndex++;
  boss = new Boss(rlState.bossIndex);
  ASTEROIDS.length = 0;
  rlState.screen = "boss";
}

function _pickUpgrade(upgradeId) {
  addUpgradeStack(upgradeId);
  rlState.screen = boss ? "boss" : "playing";
}

function _onBossDefeated(now) {
  rlState.bossesDefeated++;
  addScore(500 * rlState.bossIndex);
  boss = null;
  _openUpgradePick();
}

function _triggerDeath(now) {
  bankRun();
  rlState.screen = "end";
  _clearRunState();
}

// ── Main playing frame ────────────────────────────────────────────────────────
function _playingFrame(now, isBoss) {
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStarfield();

  controlScheme();
  if (getStackCount("thruster") > 0 && player.thrusting) {
    const m = moveSpeedMult();
    player.velocity.x *= m;
    player.velocity.y *= m;
  }
  player.updatePlayer();
  enableCanvasWrap();

  rlState.speedRamp = Math.min(RL_SPEED_RAMP_MAX, 1 + ((now - rlState.runStartTime) / 1000) * RL_SPEED_RAMP_RATE);

  if (!isBoss && now - rlState.lastSpawnTime >= RL_SPAWN_INTERVAL) {
    _spawnRLAsteroid();
    rlState.lastSpawnTime = now;
  }

  for (let i = ASTEROIDS.length - 1; i >= 0; i--) {
    ASTEROIDS[i].updateAsteroid();
  }

  _rlDetectPlayerHit(now);
  if (rlState.screen === "end") return;

  if (isBoss && boss) {
    boss.step(now, player.coordinates.x, player.coordinates.y);
    boss.draw();
    _rlDetectBossHits(now);
    if (rlState.screen === "end") return;
  }

  _rlUpdateProjectiles();
  _rlDetectProjectileHits(now);

  const fireInterval = fireIntervalMs(220);
  if (now - rlState.lastShotTime >= fireInterval) {
    _rlFireProjectile();
    rlState.lastShotTime = now;
  }

  _rlUpdatePowerUps(now);
  _updateExplosions();
  _drawOrbitRing(now);

  if (rlState.shieldRechargeAt > 0 && now >= rlState.shieldRechargeAt) {
    player.shield = true;
    rlState.shieldRechargeAt = 0;
  }

  drawXPStrip(isBoss);
  drawLevelBadge();
  drawRLScore();
  if (isBoss && boss) drawBossHPBar(boss);

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
      if (btn.id === "rl-start") startRun(now);
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
  if (e.code === "Escape" && rlState.screen === "menu") {
    closeRoguelike();
  }
});
