import { CONTEXT } from "./canvasUtils.js";

export function updateParticles(explosion) {
  for (let j = explosion.particles.length - 1; j >= 0; j--) {
    const particle = explosion.particles[j];
    particle.coordinates.x += particle.velocity.x;
    particle.coordinates.y += particle.velocity.y;
    particle.alpha -= 0.02; // Reduce the opacity of the particle over time.
    if (particle.alpha <= 0) {
      explosion.particles.splice(j, 1);
    }
  }
}

export function renderParticles(explosion) {
    CONTEXT.save();
    CONTEXT.globalCompositeOperation = "lighter"; // Brighter particle colors.
    
    for (const particle of explosion.particles) {
      const { coordinates, radius, alpha } = particle;
  
      CONTEXT.beginPath();
      CONTEXT.arc(
        coordinates.x,
        coordinates.y,
        radius,
        0,
        Math.PI * 2
      );
      CONTEXT.closePath();
      CONTEXT.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      CONTEXT.fill();
    }
    
    CONTEXT.restore();
  }
  