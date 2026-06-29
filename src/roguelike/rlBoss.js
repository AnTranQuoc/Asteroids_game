// src/roguelike/rlBoss.js
import { CANVAS, CONTEXT } from "../core/canvas.js";

const PATTERN_COUNT = 6;
// Boss index at which each pattern first unlocks (ring=0, spiral=0, aimed=1, scatter=1, cross=2, homing=3)
const PATTERN_UNLOCK = [0, 0, 1, 1, 2, 3];

export class Boss {
  constructor(bossIndex) {
    this.index = bossIndex;
    this.hp = 200 + bossIndex * 150;
    this.maxHp = this.hp;
    this.x = CANVAS.width / 2;
    this.y = -90;
    this.targetY = 130;
    this.phase = "entering"; // entering | phase1 | phase2

    const bulletSpeed = 3.5 * (1 + bossIndex * 0.1);
    this.bulletSpeed = bulletSpeed;

    // Minions
    const minionCount = Math.min(8, 2 + Math.floor(bossIndex / 2));
    this.minions = Array.from({ length: minionCount }, (_, i) => ({
      angle: (Math.PI * 2 * i) / minionCount,
      hp: 2 + Math.floor(bossIndex / 2),
      alive: true,
    }));
    this.orbitRadius = 120;
    this.orbitSpeed = 0.008 + bossIndex * 0.001;

    // Boss bullets (own array)
    this.bullets = [];
    this.lastPatternTime = 0;
    this.patternInterval = Math.max(500, 1800 - bossIndex * 80);
    this.spiralAngle = 0;
    this.crossAngle = 0;

    // Two patterns this boss uses
    this.patternA = bossIndex % PATTERN_COUNT;
    this.patternB = (bossIndex + 3) % PATTERN_COUNT;
    // Only use patterns that are unlocked
    if (PATTERN_UNLOCK[this.patternA] > bossIndex) this.patternA = 0;
    if (PATTERN_UNLOCK[this.patternB] > bossIndex) this.patternB = 1;
  }

  get shielded() {
    return this.minions.some((m) => m.alive);
  }

  step(now, playerX, playerY) {
    // Entry animation
    if (this.phase === "entering") {
      this.y = Math.min(this.targetY, this.y + 2.5);
      if (this.y >= this.targetY) {
        this.phase = this.shielded ? "phase1" : "phase2";
        this.lastPatternTime = now;
      }
      return;
    }

    // Orbit minions
    for (const m of this.minions) {
      if (m.alive) m.angle += this.orbitSpeed;
    }

    // Transition
    if (this.phase === "phase1" && !this.shielded) this.phase = "phase2";

    // Fire
    if (now - this.lastPatternTime >= this.patternInterval) {
      if (this.phase === "phase1") {
        this._fireMinionBurst(playerX, playerY);
      } else {
        this._firePattern(this.patternA, playerX, playerY);
        if (this.index >= 3) this._firePattern(this.patternB, playerX, playerY);
      }
      this.lastPatternTime = now;
    }

    // Advance bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      if (b.homing) {
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        b.vx += (dx / dist) * 0.12;
        b.vy += (dy / dist) * 0.12;
        const spd = Math.hypot(b.vx, b.vy);
        if (spd > this.bulletSpeed) {
          b.vx = (b.vx / spd) * this.bulletSpeed;
          b.vy = (b.vy / spd) * this.bulletSpeed;
        }
      }
      if (b.x < -30 || b.x > CANVAS.width + 30 || b.y < -30 || b.y > CANVAS.height + 30) {
        this.bullets.splice(i, 1);
      }
    }
  }

  _addBullet(x, y, vx, vy, color, homing, tx, ty) {
    this.bullets.push({ x, y, vx, vy, color, homing: !!homing, tx: tx || 0, ty: ty || 0 });
  }

  _firePattern(idx, px, py) {
    switch (idx % PATTERN_COUNT) {
      case 0: this._ringBurst();              break;
      case 1: this._spiral();                break;
      case 2: this._aimedBurst(px, py);      break;
      case 3: this._scatter();               break;
      case 4: this._crossSweep();            break;
      case 5: this._homingPulse(px, py);     break;
    }
  }

  _ringBurst() {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      this._addBullet(this.x, this.y, Math.cos(a) * this.bulletSpeed, Math.sin(a) * this.bulletSpeed, "#ff5050");
    }
  }

  _spiral() {
    for (let i = 0; i < 8; i++) {
      const a = this.spiralAngle + (Math.PI * 2 * i) / 8;
      this._addBullet(this.x, this.y, Math.cos(a) * this.bulletSpeed, Math.sin(a) * this.bulletSpeed, "#ff8030");
    }
    this.spiralAngle += 0.35;
  }

  _aimedBurst(px, py) {
    const base = Math.atan2(py - this.y, px - this.x);
    for (const off of [-0.22, 0, 0.22]) {
      const a = base + off;
      this._addBullet(this.x, this.y, Math.cos(a) * this.bulletSpeed * 1.3, Math.sin(a) * this.bulletSpeed * 1.3, "#ff3030");
    }
  }

  _scatter() {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = this.bulletSpeed * (0.6 + Math.random() * 0.7);
      this._addBullet(this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd, "#ff6020");
    }
  }

  _crossSweep() {
    for (let i = 0; i < 4; i++) {
      const a = this.crossAngle + (Math.PI / 2) * i;
      this._addBullet(this.x, this.y, Math.cos(a) * this.bulletSpeed, Math.sin(a) * this.bulletSpeed, "#ffd020");
    }
    this.crossAngle += 0.07;
  }

  _homingPulse(px, py) {
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5;
      this._addBullet(
        this.x, this.y,
        Math.cos(a) * this.bulletSpeed * 0.4, Math.sin(a) * this.bulletSpeed * 0.4,
        "#c07aff", true, px, py
      );
    }
  }

  _fireMinionBurst(px, py) {
    for (const m of this.minions) {
      if (!m.alive) continue;
      const mx = this.x + Math.cos(m.angle) * this.orbitRadius;
      const my = this.y + Math.sin(m.angle) * this.orbitRadius;
      const a = Math.atan2(py - my, px - mx);
      this._addBullet(mx, my, Math.cos(a) * this.bulletSpeed * 0.8, Math.sin(a) * this.bulletSpeed * 0.8, "#ff8850");
    }
  }

  // Returns minion index hit by projectile at (px,py,pr), or -1
  hitMinion(px, py, pr) {
    for (let i = 0; i < this.minions.length; i++) {
      const m = this.minions[i];
      if (!m.alive) continue;
      const mx = this.x + Math.cos(m.angle) * this.orbitRadius;
      const my = this.y + Math.sin(m.angle) * this.orbitRadius;
      if (Math.hypot(px - mx, py - my) < pr + 18) return i;
    }
    return -1;
  }

  damageMinion(i) {
    this.minions[i].hp--;
    if (this.minions[i].hp <= 0) this.minions[i].alive = false;
  }

  // Returns true if exposed core was hit by projectile at (px,py,pr)
  hitCore(px, py, pr) {
    return !this.shielded && Math.hypot(px - this.x, py - this.y) < pr + 36;
  }

  damageCore() {
    this.hp = Math.max(0, this.hp - 1);
  }

  // Returns true if any boss bullet is within playerRadius of (px,py)
  collidesWithPlayer(px, py, playerRadius = 16) {
    for (const b of this.bullets) {
      if (Math.hypot(px - b.x, py - b.y) < playerRadius + 5) return true;
    }
    return false;
  }

  draw() {
    // Minions
    for (const m of this.minions) {
      if (!m.alive) continue;
      const mx = this.x + Math.cos(m.angle) * this.orbitRadius;
      const my = this.y + Math.sin(m.angle) * this.orbitRadius;
      CONTEXT.save();
      CONTEXT.translate(mx, my);
      CONTEXT.rotate(m.angle);
      CONTEXT.beginPath();
      const pts = 8;
      for (let i = 0; i <= pts; i++) {
        const a = (Math.PI * 2 * i) / pts;
        const r = 18 * (i % 3 === 0 ? 1.0 : 0.75);
        i === 0 ? CONTEXT.moveTo(r * Math.cos(a), r * Math.sin(a))
                : CONTEXT.lineTo(r * Math.cos(a), r * Math.sin(a));
      }
      CONTEXT.closePath();
      CONTEXT.strokeStyle = "#ff8850";
      CONTEXT.lineWidth = 1.5;
      CONTEXT.shadowColor = "rgba(255,136,80,0.5)";
      CONTEXT.shadowBlur = 8;
      CONTEXT.stroke();
      CONTEXT.restore();
    }

    // Shield ring
    if (this.shielded) {
      CONTEXT.save();
      CONTEXT.beginPath();
      CONTEXT.arc(this.x, this.y, 58, 0, Math.PI * 2);
      CONTEXT.strokeStyle = "rgba(100,160,255,0.55)";
      CONTEXT.lineWidth = 2;
      CONTEXT.shadowColor = "rgba(100,160,255,0.35)";
      CONTEXT.shadowBlur = 12;
      CONTEXT.stroke();
      CONTEXT.restore();
    }

    // Core
    CONTEXT.save();
    CONTEXT.translate(this.x, this.y);
    CONTEXT.beginPath();
    const offsets = [0.9, 1.1, 0.85, 1.0, 0.95, 1.1, 0.9, 1.05, 0.8, 1.0];
    const pts = 10;
    for (let i = 0; i <= pts; i++) {
      const a = (Math.PI * 2 * i) / pts;
      const r = 36 * offsets[i % pts];
      i === 0 ? CONTEXT.moveTo(r * Math.cos(a), r * Math.sin(a))
              : CONTEXT.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    CONTEXT.closePath();
    CONTEXT.fillStyle = "rgba(70,15,15,0.92)";
    CONTEXT.strokeStyle = this.shielded ? "rgba(255,80,80,0.3)" : "#ff5050";
    CONTEXT.lineWidth = 2;
    CONTEXT.shadowColor = this.shielded ? "transparent" : "rgba(255,50,30,0.7)";
    CONTEXT.shadowBlur = this.shielded ? 0 : 22;
    CONTEXT.fill();
    CONTEXT.stroke();
    // Eye glow when exposed
    if (!this.shielded) {
      CONTEXT.beginPath();
      CONTEXT.arc(0, 0, 10, 0, Math.PI * 2);
      const g = CONTEXT.createRadialGradient(0, 0, 0, 0, 0, 10);
      g.addColorStop(0, "#ffb050");
      g.addColorStop(1, "#ff3020");
      CONTEXT.fillStyle = g;
      CONTEXT.shadowColor = "#ff5030";
      CONTEXT.shadowBlur = 18;
      CONTEXT.fill();
    }
    CONTEXT.restore();

    // Boss bullets
    for (const b of this.bullets) {
      CONTEXT.save();
      CONTEXT.beginPath();
      CONTEXT.arc(b.x, b.y, 5, 0, Math.PI * 2);
      CONTEXT.fillStyle = b.color;
      CONTEXT.shadowColor = b.color;
      CONTEXT.shadowBlur = 8;
      CONTEXT.fill();
      CONTEXT.restore();
    }
  }
}
