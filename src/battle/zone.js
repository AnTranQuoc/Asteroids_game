import { ZONE_PHASES, ZONE_START_RADIUS, WORLD_W, WORLD_H } from "./config.js";

export function createZone(nowMs) {
  // Start centred; each phase re-targets a random circle fully inside the
  // current one, so the safe area drifts as it shrinks (like PUBG).
  return {
    cx: WORLD_W / 2,
    cy: WORLD_H / 2,
    r: ZONE_START_RADIUS,
    // The circle we're shrinking FROM and the one we're shrinking TO.
    fromCx: WORLD_W / 2,
    fromCy: WORLD_H / 2,
    fromR: ZONE_START_RADIUS,
    toCx: WORLD_W / 2,
    toCy: WORLD_H / 2,
    toR: ZONE_START_RADIUS,
    phase: 0,
    shrinking: false,
    phaseStart: nowMs,
    dps: 0,
  };
}

function pickNextCircle(zone) {
  const phase = ZONE_PHASES[zone.phase];
  const newR = zone.r * phase.radiusFactor;
  // New centre must keep the next circle inside the current one.
  const maxDrift = Math.max(0, zone.r - newR);
  const ang = Math.random() * Math.PI * 2;
  const dist = Math.random() * maxDrift;
  zone.fromCx = zone.cx;
  zone.fromCy = zone.cy;
  zone.fromR = zone.r;
  zone.toCx = zone.cx + Math.cos(ang) * dist;
  zone.toCy = zone.cy + Math.sin(ang) * dist;
  zone.toR = newR;
}

// Advances the zone. Returns the current damage-per-second for anyone outside.
export function updateZone(zone, nowMs) {
  const phase = ZONE_PHASES[zone.phase];
  if (!phase) {
    zone.dps = ZONE_PHASES[ZONE_PHASES.length - 1].dps;
    return zone.dps;
  }

  const elapsed = nowMs - zone.phaseStart;

  if (!zone.shrinking) {
    // Holding before this phase's shrink begins.
    zone.dps = zone.phase > 0 ? ZONE_PHASES[zone.phase - 1].dps : 0;
    if (elapsed >= phase.waitMs) {
      zone.shrinking = true;
      zone.phaseStart = nowMs;
      pickNextCircle(zone);
    }
  } else {
    // Interpolating from the old circle to the new one.
    const t = Math.min(1, elapsed / phase.shrinkMs);
    zone.cx = zone.fromCx + (zone.toCx - zone.fromCx) * t;
    zone.cy = zone.fromCy + (zone.toCy - zone.fromCy) * t;
    zone.r = zone.fromR + (zone.toR - zone.fromR) * t;
    zone.dps = phase.dps;
    if (t >= 1) {
      zone.shrinking = false;
      zone.phaseStart = nowMs;
      zone.phase = Math.min(zone.phase + 1, ZONE_PHASES.length); // May go past end.
    }
  }
  return zone.dps;
}

export function isOutsideZone(zone, x, y) {
  const dx = x - zone.cx;
  const dy = y - zone.cy;
  return dx * dx + dy * dy > zone.r * zone.r;
}

// Compact form for the network snapshot.
export function zoneSnapshot(zone) {
  return {
    cx: Math.round(zone.cx),
    cy: Math.round(zone.cy),
    r: Math.round(zone.r),
    dps: zone.dps,
  };
}
