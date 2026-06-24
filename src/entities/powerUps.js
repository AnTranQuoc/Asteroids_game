import { CONTEXT } from "../core/canvas.js";

export const POWERUPS = [];

// How long the timed power-ups last, in milliseconds.
export const POWERUP_DURATION = 8000;

// The three pickups the player can "eat" for more power.
export const POWERUP_TYPES = {
  rapid: { color: "rgb(255, 90, 90)" }, // Faster fire rate.
  spread: { color: "rgb(120, 230, 120)" }, // 3-way spread shot.
  shield: { color: "rgb(120, 200, 255)" }, // Absorbs one hit.
};

// Draws a small vector icon (centred at the origin) for each power-up type.
export function drawIcon(type, color) {
  CONTEXT.strokeStyle = color;
  CONTEXT.fillStyle = color;
  CONTEXT.lineWidth = 2;
  CONTEXT.lineJoin = "round";
  CONTEXT.lineCap = "round";

  if (type === "rapid") {
    // Lightning bolt.
    CONTEXT.beginPath();
    CONTEXT.moveTo(2, -8);
    CONTEXT.lineTo(-4, 1);
    CONTEXT.lineTo(0, 1);
    CONTEXT.lineTo(-2, 8);
    CONTEXT.lineTo(5, -2);
    CONTEXT.lineTo(1, -2);
    CONTEXT.closePath();
    CONTEXT.fill();
  } else if (type === "spread") {
    // Three diverging shots.
    for (const a of [-0.5, 0, 0.5]) {
      CONTEXT.beginPath();
      CONTEXT.moveTo(0, 7);
      CONTEXT.lineTo(Math.sin(a) * 9, 7 - Math.cos(a) * 14);
      CONTEXT.stroke();
    }
  } else if (type === "shield") {
    // Shield crest.
    CONTEXT.beginPath();
    CONTEXT.moveTo(0, -8);
    CONTEXT.lineTo(7, -5);
    CONTEXT.lineTo(7, 1);
    CONTEXT.quadraticCurveTo(7, 7, 0, 9);
    CONTEXT.quadraticCurveTo(-7, 7, -7, 1);
    CONTEXT.lineTo(-7, -5);
    CONTEXT.closePath();
    CONTEXT.stroke();
  }
}

const TYPE_KEYS = Object.keys(POWERUP_TYPES);

export function randomPowerUpType() {
  return TYPE_KEYS[Math.floor(Math.random() * TYPE_KEYS.length)];
}

export class PowerUp {
  constructor({ coordinates, type }) {
    this.coordinates = coordinates;
    this.type = type;
    this.radius = 14;
    this.bob = Math.random() * Math.PI * 2;
    this.life = 660; // Frames before it fades away (~11s at 60fps).
  }

  draw() {
    const meta = POWERUP_TYPES[this.type];
    this.bob += 0.1;
    const r = this.radius + Math.sin(this.bob) * 2;

    CONTEXT.save();
    CONTEXT.translate(this.coordinates.x, this.coordinates.y);

    // Fade out over the last second of its life.
    CONTEXT.globalAlpha = this.life < 60 ? this.life / 60 : 1;

    // Pulsing glowing ring.
    CONTEXT.beginPath();
    CONTEXT.arc(0, 0, r, 0, Math.PI * 2);
    CONTEXT.shadowColor = meta.color;
    CONTEXT.shadowBlur = 18;
    CONTEXT.lineWidth = 2;
    CONTEXT.strokeStyle = meta.color;
    CONTEXT.stroke();

    // Icon marking the power-up type.
    drawIcon(this.type, meta.color);

    CONTEXT.restore();
  }

  update() {
    this.draw();
    this.life--;
  }
}
