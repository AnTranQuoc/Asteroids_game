import { WORLD_W, WORLD_H, HAZARD_COUNT } from "./config.js";

export function spawnHazards() {
  const list = [];
  for (let i = 0; i < HAZARD_COUNT; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 1.6;
    list.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: 34 + Math.random() * 70,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.02,
    });
  }
  return list;
}

export function updateHazards(hazards) {
  for (const a of hazards) {
    a.x += a.vx;
    a.y += a.vy;
    a.rot += a.spin;
    const m = a.r;
    if (a.x < -m) a.x = WORLD_W + m;
    else if (a.x > WORLD_W + m) a.x = -m;
    if (a.y < -m) a.y = WORLD_H + m;
    else if (a.y > WORLD_H + m) a.y = -m;
  }
}
