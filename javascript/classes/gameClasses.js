import { CANVAS, CONTEXT } from "../canvasUtils.js";
import { PROJECTILES } from "../gameConstants.js";
import { OFF_WHITE } from "../gameConstants.js";

class Player {
    constructor({ coordinates, velocity }) {
      this.coordinates = coordinates;
      this.velocity = velocity;
      this.rotation = 0;
    }
  
    drawPlayer() {
      CONTEXT.save();
  
      // Enables ship to rotate freely.
      CONTEXT.translate(this.coordinates.x, this.coordinates.y);
      CONTEXT.rotate(this.rotation);
      CONTEXT.translate(-this.coordinates.x, -this.coordinates.y);
  
      // Spaceship shape.
      CONTEXT.beginPath();
      CONTEXT.moveTo(this.coordinates.x + 30, this.coordinates.y); // Top of the spaceship
      CONTEXT.lineTo(this.coordinates.x - 5, this.coordinates.y - 15); // Bottom left
      CONTEXT.lineTo(this.coordinates.x + 5, this.coordinates.y); // Middle bottom
      CONTEXT.lineTo(this.coordinates.x - 5, this.coordinates.y + 15); // Bottom right
      CONTEXT.closePath();
      
      CONTEXT.fillStyle = OFF_WHITE;
      CONTEXT.fill();
  
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
  
      return [
        {
          x: this.coordinates.x + cos * 30 - sin * 0,
          y: this.coordinates.y + sin * 30 + cos * 0,
        },
        {
          x: this.coordinates.x + cos * -10 - sin * 10,
          y: this.coordinates.y + sin * -10 + cos * 10,
        },
        {
          x: this.coordinates.x + cos * -10 - sin * -10,
          y: this.coordinates.y + sin * -10 + cos * -10,
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
      CONTEXT.beginPath();
      CONTEXT.arc(
        this.coordinates.x,
        this.coordinates.y,
        this.radius,
        0,
        Math.PI * 2,
        false
      );
      CONTEXT.closePath();
      CONTEXT.fillStyle = OFF_WHITE;
      CONTEXT.fill();
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
    constructor({ coordinates, velocity }) {
      this.coordinates = coordinates;
      this.velocity = velocity;
      this.radius = 100 * Math.random() + 5;
      this.numPoints = Math.floor(Math.random() * 4) + 5; // Random number of points for the asteroid shape.
    }
  
    drawAsteroid() {
      CONTEXT.beginPath();
      CONTEXT.moveTo(
        this.coordinates.x + this.radius * Math.cos(0),
        this.coordinates.y + this.radius * Math.sin(0)
      );
  
      for (let i = 1; i <= this.numPoints; i++) {
        const angle = (Math.PI * 2 * i) / this.numPoints;
        const x = this.coordinates.x + this.radius * Math.cos(angle);
        const y = this.coordinates.y + this.radius * Math.sin(angle);
        CONTEXT.lineTo(x, y);
      }
  
      CONTEXT.closePath();
      CONTEXT.strokeStyle = OFF_WHITE;
      CONTEXT.stroke();
    }
  
    updateAsteroid() {
      this.drawAsteroid();
      this.coordinates.x += this.velocity.x;
      this.coordinates.y += this.velocity.y;
  
      // Enables asteroids to "wrap around" the canvas.
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