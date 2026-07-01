import { CANVAS, CONTEXT } from "../core/canvas.js";
import { PROJECTILES } from "../core/constants.js";
import { OFF_WHITE } from "../core/constants.js";
import { getSelectedShipSkin, getSelectedGunSkin } from "../systems/skins.js";

class Player {
    constructor({ coordinates, velocity }) {
      this.coordinates = coordinates;
      this.velocity = velocity;
      this.rotation = 0;
      this.thrusting = false;

      // Power-up state (timestamps in ms; 0/false means inactive).
      this.rapidFireUntil = 0;
      this.spreadUntil = 0;
      this.shield = false;
      this.invulnUntil = 0; // Brief grace period after a shield breaks.
    }

    drawPlayer() {
      CONTEXT.save();

      // Move into the ship's local space.
      CONTEXT.translate(this.coordinates.x, this.coordinates.y);

      // Shield bubble (drawn around the ship while a shield is held).
      if (this.shield) {
        CONTEXT.beginPath();
        CONTEXT.arc(0, 0, 34, 0, Math.PI * 2);
        CONTEXT.shadowColor = "rgba(120, 200, 255, 1)";
        CONTEXT.shadowBlur = 16;
        CONTEXT.lineWidth = 2;
        CONTEXT.strokeStyle = "rgba(120, 200, 255, 0.85)";
        CONTEXT.stroke();
      }

      // Blink the hull while briefly invulnerable after a shield break.
      const now = performance.now();
      if (now < this.invulnUntil && Math.floor(now / 120) % 2 === 0) {
        CONTEXT.globalAlpha = 0.35;
      }

      // Thruster flame trails behind the direction of travel (movement and
      // facing are independent, so this is aligned to velocity, not the nose).
      const speed = Math.hypot(this.velocity.x, this.velocity.y);
      if (this.thrusting && speed > 0.1) {
        CONTEXT.save();
        CONTEXT.rotate(Math.atan2(this.velocity.y, this.velocity.x));
        const flicker = Math.random() * 14;
        CONTEXT.beginPath();
        CONTEXT.moveTo(-8, -6);
        CONTEXT.lineTo(-22 - flicker, 0);
        CONTEXT.lineTo(-8, 6);
        CONTEXT.closePath();
        CONTEXT.shadowColor = "rgba(255, 120, 0, 1)";
        CONTEXT.shadowBlur = 20;
        CONTEXT.fillStyle = "rgba(255, 150, 40, 0.9)";
        CONTEXT.fill();
        CONTEXT.restore();
      }

      // Rotate the hull to face the mouse, then draw the equipped ship skin.
      CONTEXT.rotate(this.rotation);
      getSelectedShipSkin().draw(CONTEXT);

      CONTEXT.restore();
    }

    updatePlayer() {
      this.drawPlayer();
      this.coordinates.x += this.velocity.x;
      this.coordinates.y += this.velocity.y;
    }
  
    getVertices() {
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
  
      // Collision triangle kept a touch inside the visual hull (nose ~30, wings
      // ±15) so grazes that look like misses don't register as hits.
      return [
        {
          x: this.coordinates.x + cos * 24 - sin * 0,
          y: this.coordinates.y + sin * 24 + cos * 0,
        },
        {
          x: this.coordinates.x + cos * -6 - sin * 9,
          y: this.coordinates.y + sin * -6 + cos * 9,
        },
        {
          x: this.coordinates.x + cos * -6 - sin * -9,
          y: this.coordinates.y + sin * -6 + cos * -9,
        },
      ];
    }
  }
  
 export const player = new Player({
    coordinates: { x: CANVAS.width / 2, y: CANVAS.height / 2 },
    velocity: { x: 0, y: 0 },
  });
  
  export class Projectile {
    constructor({ coordinates, velocity }) {
      this.coordinates = coordinates;
      this.velocity = velocity;
      this.radius = 3;
      this.maxDistance = 550; // Maximum distance the projectile can travel
      this.distanceTraveled = 0; // Distance traveled by the projectile
    }
  
    drawProjectile() {
      CONTEXT.save();
      // Travel toward the velocity direction so oriented bolts point correctly.
      CONTEXT.translate(this.coordinates.x, this.coordinates.y);
      CONTEXT.rotate(Math.atan2(this.velocity.y, this.velocity.x));
      getSelectedGunSkin().draw(CONTEXT);
      CONTEXT.restore();
    }
  
    updateProjectile() {
      this.drawProjectile();
      this.coordinates.x += this.velocity.x;
      this.coordinates.y += this.velocity.y;
      this.distanceTraveled += Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
      );
  
      // Checks if the projectile has exceeded the maximum distance.
      if (this.distanceTraveled >= this.maxDistance) {
        const index = PROJECTILES.indexOf(this);
        if (index !== -1) {
          PROJECTILES.splice(index, 1);
        }
        return;
      }
  
      // Enables projectiles to "wrap around" the canvas.
      if (this.coordinates.x < 0) {
        this.coordinates.x = CANVAS.width;
      } else if (this.coordinates.x > CANVAS.width) {
        this.coordinates.x = 0;
      }
  
      if (this.coordinates.y < 0) {
        this.coordinates.y = CANVAS.height;
      } else if (this.coordinates.y > CANVAS.height) {
        this.coordinates.y = 0;
      }
    }
  }
  
export class Asteroid {
    constructor({ coordinates, velocity, radius }) {
      this.coordinates = coordinates;
      this.velocity = velocity;
      this.radius = radius ?? 90 * Math.random() + 18;
      this.numPoints = Math.floor(Math.random() * 6) + 9; // Vertex count for the rocky outline.

      // Spin: each asteroid tumbles at its own rate and direction.
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.035;

      // Pre-bake a jagged, irregular outline so the shape looks like a real rock
      // instead of a perfectly symmetric polygon (and stays stable while spinning).
      this.offsets = [];
      for (let i = 0; i < this.numPoints; i++) {
        this.offsets.push(0.68 + Math.random() * 0.5);
      }

      // Subtle per-asteroid shade for depth.
      const shade = 175 + Math.floor(Math.random() * 70);
      this.color = `rgb(${shade}, ${shade}, ${shade + 8})`;
    }

    drawAsteroid() {
      CONTEXT.save();
      CONTEXT.translate(this.coordinates.x, this.coordinates.y);
      CONTEXT.rotate(this.rotation);

      CONTEXT.beginPath();
      for (let i = 0; i <= this.numPoints; i++) {
        const idx = i % this.numPoints;
        const angle = (Math.PI * 2 * i) / this.numPoints;
        const r = this.radius * this.offsets[idx];
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (i === 0) CONTEXT.moveTo(x, y);
        else CONTEXT.lineTo(x, y);
      }
      CONTEXT.closePath();

      // Neon glow outline + faint fill.
      CONTEXT.shadowColor = this.color;
      CONTEXT.shadowBlur = 12;
      CONTEXT.lineWidth = 2;
      CONTEXT.strokeStyle = this.color;
      CONTEXT.fillStyle = "rgba(45, 48, 60, 0.35)";
      CONTEXT.fill();
      CONTEXT.stroke();

      CONTEXT.restore();
    }

    updateAsteroid() {
      this.drawAsteroid();
      this.coordinates.x += this.velocity.x;
      this.coordinates.y += this.velocity.y;
      this.rotation += this.rotationSpeed;

      // Wrap around the canvas with a margin so asteroids drift fully off one
      // edge before reappearing on the opposite side (also lets them spawn from
      // just outside the screen).
      const m = this.radius;
      if (this.coordinates.x < -m) {
        this.coordinates.x = CANVAS.width + m;
      } else if (this.coordinates.x > CANVAS.width + m) {
        this.coordinates.x = -m;
      }

      if (this.coordinates.y < -m) {
        this.coordinates.y = CANVAS.height + m;
      } else if (this.coordinates.y > CANVAS.height + m) {
        this.coordinates.y = -m;
      }
    }
  }