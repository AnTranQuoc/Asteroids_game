import { CANVAS, CONTEXT } from "./canvas.js";

const STAR_COUNT = 160;
const stars = [];

for (let i = 0; i < STAR_COUNT; i++) {
  stars.push({
    x: Math.random() * CANVAS.width,
    y: Math.random() * CANVAS.height,
    radius: Math.random() * 1.4 + 0.2,
    phase: Math.random() * Math.PI * 2, // Twinkle offset.
    speed: Math.random() * 0.05 + 0.01,
  });
}

// A subtly twinkling parallax-free starfield drawn behind the action.
export function drawStarfield() {
  CONTEXT.save();
  for (const s of stars) {
    s.phase += s.speed;
    const alpha = 0.35 + Math.sin(s.phase) * 0.35;
    CONTEXT.beginPath();
    CONTEXT.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    CONTEXT.fillStyle = `rgba(200, 210, 255, ${alpha})`;
    CONTEXT.fill();
  }
  CONTEXT.restore();
}
