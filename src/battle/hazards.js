// ===========================================================================
// BATTLE ROYALE — asteroid hazards
// ---------------------------------------------------------------------------
// Asteroids drift through the arena as solid, shootable obstacles that mirror
// single-player Asteroid mode: jagged rocky outlines, they split into smaller
// shards when shot, and they block (and shove) players on contact. The host
// owns and moves them; clients render only (regenerating the rocky outline
// locally from each asteroid's stable id — see br.js).
// ===========================================================================
import { WORLD_W, WORLD_H, HAZARD_COUNT } from "./config.js";

// Match single-player tuning (see src/core/constants.js / entities.js).
export const HAZARD_SPLIT_THRESHOLD = 38; // Larger rocks split when shot.
export const HAZARD_MAX = 46; // Cap so repeated splitting can't run away.

let hazardSeq = 0;

// Builds the rocky outline + tint for a rock of the given radius — identical in
// spirit to the single-player Asteroid constructor so the two modes look alike.
export function makeHazardShape() {
  const numPoints = Math.floor(Math.random() * 6) + 9;
  const offsets = [];
  for (let i = 0; i < numPoints; i++) offsets.push(0.68 + Math.random() * 0.5);
  const shade = 175 + Math.floor(Math.random() * 70);
  return { numPoints, offsets, color: `rgb(${shade}, ${shade}, ${shade + 8})` };
}

function newHazard(x, y, vx, vy, r) {
  const shape = makeHazardShape();
  return {
    id: hazardSeq++,
    x,
    y,
    vx,
    vy,
    r,
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.02,
    numPoints: shape.numPoints,
    offsets: shape.offsets,
    color: shape.color,
  };
}

export function spawnHazards() {
  hazardSeq = 0;
  const list = [];
  for (let i = 0; i < HAZARD_COUNT; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 1.6;
    const r = 34 + Math.random() * 60;
    list.push(
      newHazard(Math.random() * WORLD_W, Math.random() * WORLD_H, Math.cos(ang) * speed, Math.sin(ang) * speed, r)
    );
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

// Classic Asteroids split: a large rock breaks into two smaller, faster shards
// sent to either side of its travel direction. Small rocks just vanish.
export function splitHazard(hazard) {
  const children = [];
  if (hazard.r > HAZARD_SPLIT_THRESHOLD) {
    const childR = hazard.r * 0.56;
    const baseAngle = Math.atan2(hazard.vy, hazard.vx);
    for (let i = 0; i < 2; i++) {
      const angle = baseAngle + (i === 0 ? 1 : -1) * (0.6 + Math.random() * 0.5);
      const speed = 1.2 + Math.random() * 1.8;
      children.push(newHazard(hazard.x, hazard.y, Math.cos(angle) * speed, Math.sin(angle) * speed, childR));
    }
  }
  return children;
}
