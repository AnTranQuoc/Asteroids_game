// src/roguelike/rlEnemies.js
// Active enemy ships for the Roguelike stage. Two types:
//   chaser — flies straight at the player and rams (1 hp)
//   hunter — keeps a standoff distance, strafes, and fires bullets (2 hp)
// rl.js owns the collision/XP/score wiring; this module owns movement, firing,
// and rendering. Enemies use flat {x, y} coords (not entity.coordinates).
import { CONTEXT } from "../core/canvas.js";

export const ENEMIES = [];
export const ENEMY_BULLETS = [];

const HUNTER_FIRE_INTERVAL = 1500;
const HUNTER_BULLET_SPEED = 4.2;

export function clearEnemies() {
  ENEMIES.length = 0;
  ENEMY_BULLETS.length = 0;
}

export function countType(type) {
  let n = 0;
  for (const e of ENEMIES) if (e.type === type) n++;
  return n;
}

export function spawnChaser(x, y) {
  ENEMIES.push({ x, y, vx: 0, vy: 0, rot: 0, type: "chaser", radius: 18, hp: 1 });
}

export function spawnHunter(x, y, now) {
  ENEMIES.push({
    x, y, vx: 0, vy: 0, rot: 0, type: "hunter", radius: 21, hp: 2,
    lastShot: now, standoff: 250 + Math.random() * 60,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
  });
}

export function updateEnemies(now, px, py, speedRamp, worldW, worldH) {
  const ramp = 0.7 + 0.45 * Math.min(speedRamp, 2.2);

  for (const e of ENEMIES) {
    const dx = px - e.x;
    const dy = py - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.rot = Math.atan2(dy, dx);

    if (e.type === "chaser") {
      const spd = 2.4 * ramp;
      e.vx = (dx / dist) * spd;
      e.vy = (dy / dist) * spd;
    } else {
      const spd = 1.8 * ramp;
      if (dist > e.standoff + 40) {          // approach
        e.vx = (dx / dist) * spd;
        e.vy = (dy / dist) * spd;
      } else if (dist < e.standoff - 40) {   // back off
        e.vx = -(dx / dist) * spd;
        e.vy = -(dy / dist) * spd;
      } else {                                // strafe perpendicular
        e.vx = (-dy / dist) * spd * e.strafeDir;
        e.vy = (dx / dist) * spd * e.strafeDir;
      }
      if (now - e.lastShot >= HUNTER_FIRE_INTERVAL) {
        e.lastShot = now;
        const a = Math.atan2(py - e.y, px - e.x);
        ENEMY_BULLETS.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * HUNTER_BULLET_SPEED,
          vy: Math.sin(a) * HUNTER_BULLET_SPEED,
        });
      }
    }

    e.x += e.vx;
    e.y += e.vy;
    e.x = Math.max(e.radius, Math.min(worldW - e.radius, e.x));
    e.y = Math.max(e.radius, Math.min(worldH - e.radius, e.y));
  }

  for (let i = ENEMY_BULLETS.length - 1; i >= 0; i--) {
    const b = ENEMY_BULLETS[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < -30 || b.x > worldW + 30 || b.y < -30 || b.y > worldH + 30) {
      ENEMY_BULLETS.splice(i, 1);
    }
  }
}

export function drawEnemies(ctx) {
  for (const e of ENEMIES) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    // Shapes were authored for the old radii (chaser 12, hunter 14); scale up
    // so the drawing tracks the current radius.
    const s = e.radius / (e.type === "chaser" ? 12 : 14);
    ctx.scale(s, s);
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 11;
    if (e.type === "chaser") {
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -9);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,80,60,0.9)";
      ctx.strokeStyle = "#ff5040";
      ctx.shadowColor = "#ff5040";
    } else {
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(0, -11);
      ctx.lineTo(-9, 0);
      ctx.lineTo(0, 11);
      ctx.closePath();
      ctx.fillStyle = "rgba(190,110,255,0.85)";
      ctx.strokeStyle = "#c07aff";
      ctx.shadowColor = "#c07aff";
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (const b of ENEMY_BULLETS) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#c07aff";
    ctx.shadowColor = "#c07aff";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }
}
