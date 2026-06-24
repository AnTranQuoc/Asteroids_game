// ===========================================================================
// BATTLE ROYALE — rendering
// ---------------------------------------------------------------------------
// Pure drawing. Consumes a uniform `view` object (built by br.js from either the
// host's live match or a client's interpolated snapshot) so host and clients
// render identically. Draws in WORLD coordinates through the follow-camera,
// except the drop-in overview which fits the whole map to the screen.
// ===========================================================================
import { CANVAS, CONTEXT } from "../core/canvas.js";
import { OFF_WHITE, GREY } from "../core/constants.js";
import {
  camera,
  worldToScreenX,
  worldToScreenY,
} from "./camera.js";
import { WORLD_W, WORLD_H, PLAYER_RADIUS } from "./config.js";
import { LOOT_RADIUS } from "./loot.js";
import { getWeapon } from "./weapons.js";

function clearBg() {
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
}

// Faint world grid so motion across the large map reads clearly.
function drawGrid() {
  const step = 240;
  CONTEXT.save();
  CONTEXT.strokeStyle = "rgba(255, 255, 255, 0.05)";
  CONTEXT.lineWidth = 1;
  const startX = -((camera.x - CANVAS.width / 2) % step);
  const startY = -((camera.y - CANVAS.height / 2) % step);
  CONTEXT.beginPath();
  for (let x = startX; x < CANVAS.width; x += step) {
    CONTEXT.moveTo(x, 0);
    CONTEXT.lineTo(x, CANVAS.height);
  }
  for (let y = startY; y < CANVAS.height; y += step) {
    CONTEXT.moveTo(0, y);
    CONTEXT.lineTo(CANVAS.width, y);
  }
  CONTEXT.stroke();

  // World boundary.
  CONTEXT.strokeStyle = "rgba(120, 200, 255, 0.25)";
  CONTEXT.lineWidth = 3;
  CONTEXT.strokeRect(
    worldToScreenX(0),
    worldToScreenY(0),
    WORLD_W,
    WORLD_H
  );
  CONTEXT.restore();
}

// The blue zone: dim the danger area outside the safe circle.
function drawZone(zone) {
  if (!zone) return;
  const sx = worldToScreenX(zone.cx);
  const sy = worldToScreenY(zone.cy);

  CONTEXT.save();
  // Shade everything, then punch a hole over the safe circle.
  CONTEXT.fillStyle = "rgba(40, 90, 200, 0.18)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.globalCompositeOperation = "destination-out";
  CONTEXT.beginPath();
  CONTEXT.arc(sx, sy, Math.max(0, zone.r), 0, Math.PI * 2);
  CONTEXT.fill();
  CONTEXT.restore();

  // Safe-circle outline.
  CONTEXT.save();
  CONTEXT.beginPath();
  CONTEXT.arc(sx, sy, Math.max(0, zone.r), 0, Math.PI * 2);
  CONTEXT.strokeStyle = "rgba(120, 200, 255, 0.85)";
  CONTEXT.lineWidth = 2;
  CONTEXT.shadowColor = "rgba(120, 200, 255, 0.9)";
  CONTEXT.shadowBlur = 12;
  CONTEXT.stroke();
  CONTEXT.restore();
}

// Jagged rocky outline + neon glow, matching single-player Asteroid mode.
function drawHazard(a) {
  const sx = worldToScreenX(a.x);
  const sy = worldToScreenY(a.y);
  if (sx < -a.r || sx > CANVAS.width + a.r || sy < -a.r || sy > CANVAS.height + a.r)
    return;
  const numPoints = a.numPoints || 12;
  const offsets = a.offsets;
  const color = a.color || "rgb(190, 190, 200)";

  CONTEXT.save();
  CONTEXT.translate(sx, sy);
  CONTEXT.rotate(a.ro || 0);

  CONTEXT.beginPath();
  for (let i = 0; i <= numPoints; i++) {
    const idx = i % numPoints;
    const angle = (Math.PI * 2 * i) / numPoints;
    const r = a.r * (offsets ? offsets[idx] : 1);
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    if (i === 0) CONTEXT.moveTo(x, y);
    else CONTEXT.lineTo(x, y);
  }
  CONTEXT.closePath();

  CONTEXT.shadowColor = color;
  CONTEXT.shadowBlur = 12;
  CONTEXT.lineWidth = 2;
  CONTEXT.strokeStyle = color;
  CONTEXT.fillStyle = "rgba(45, 48, 60, 0.35)";
  CONTEXT.fill();
  CONTEXT.stroke();
  CONTEXT.restore();
}

const LOOT_COLORS = {
  medkit: "120, 230, 120",
  shield: "120, 200, 255",
};
function lootColor(kind) {
  if (kind.startsWith("weapon:")) return getWeapon(kind.slice(7)).color;
  return LOOT_COLORS[kind] || "255, 215, 80";
}
function lootGlyph(kind) {
  if (kind.startsWith("weapon:")) return "⌖";
  if (kind === "medkit") return "+";
  if (kind === "shield") return "◇";
  return "?";
}

function drawLoot(item) {
  const sx = worldToScreenX(item.x);
  const sy = worldToScreenY(item.y);
  if (sx < -20 || sx > CANVAS.width + 20 || sy < -20 || sy > CANVAS.height + 20)
    return;
  const color = lootColor(item.k);
  CONTEXT.save();
  CONTEXT.translate(sx, sy);
  CONTEXT.beginPath();
  CONTEXT.arc(0, 0, LOOT_RADIUS, 0, Math.PI * 2);
  CONTEXT.fillStyle = `rgba(${color}, 0.18)`;
  CONTEXT.strokeStyle = `rgb(${color})`;
  CONTEXT.lineWidth = 2;
  CONTEXT.shadowColor = `rgb(${color})`;
  CONTEXT.shadowBlur = 10;
  CONTEXT.fill();
  CONTEXT.stroke();
  CONTEXT.shadowBlur = 0;
  CONTEXT.fillStyle = `rgb(${color})`;
  CONTEXT.font = "bold 16px monospace";
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "middle";
  CONTEXT.fillText(lootGlyph(item.k), 0, 1);
  CONTEXT.restore();
}

function drawBullet(b) {
  const sx = worldToScreenX(b.x);
  const sy = worldToScreenY(b.y);
  CONTEXT.save();
  CONTEXT.beginPath();
  CONTEXT.arc(sx, sy, 3, 0, Math.PI * 2);
  CONTEXT.fillStyle = `rgb(${b.c})`;
  CONTEXT.shadowColor = `rgb(${b.c})`;
  CONTEXT.shadowBlur = 8;
  CONTEXT.fill();
  CONTEXT.restore();
}

// Draws one ship (neon triangle) at a world position, with name + health bar.
function drawShip(p, isSelf, nowMs) {
  if (!p.a) return; // dead ships are not drawn in the world
  const sx = worldToScreenX(p.x);
  const sy = worldToScreenY(p.y);

  CONTEXT.save();
  CONTEXT.translate(sx, sy);

  // Shield bubble.
  if (p.sh > 0) {
    CONTEXT.beginPath();
    CONTEXT.arc(0, 0, PLAYER_RADIUS + 8, 0, Math.PI * 2);
    CONTEXT.strokeStyle = "rgba(120, 200, 255, 0.7)";
    CONTEXT.lineWidth = 2;
    CONTEXT.shadowColor = "rgba(120, 200, 255, 0.9)";
    CONTEXT.shadowBlur = 10;
    CONTEXT.stroke();
    CONTEXT.shadowBlur = 0;
  }

  // Thruster flame.
  if (p.th) {
    CONTEXT.save();
    CONTEXT.rotate(p.rot);
    const flick = Math.random() * 10;
    CONTEXT.beginPath();
    CONTEXT.moveTo(-8, -5);
    CONTEXT.lineTo(-18 - flick, 0);
    CONTEXT.lineTo(-8, 5);
    CONTEXT.closePath();
    CONTEXT.fillStyle = "rgba(255, 150, 40, 0.9)";
    CONTEXT.shadowColor = "rgba(255, 120, 0, 1)";
    CONTEXT.shadowBlur = 14;
    CONTEXT.fill();
    CONTEXT.restore();
  }

  // Hull (triangle) in the player's colour.
  CONTEXT.rotate(p.rot);
  CONTEXT.beginPath();
  CONTEXT.moveTo(22, 0);
  CONTEXT.lineTo(-12, -12);
  CONTEXT.lineTo(-12, 12);
  CONTEXT.closePath();
  CONTEXT.strokeStyle = p.color;
  CONTEXT.lineWidth = 2.5;
  CONTEXT.shadowColor = p.color;
  CONTEXT.shadowBlur = isSelf ? 16 : 8;
  CONTEXT.fillStyle = "rgba(20, 22, 30, 0.6)";
  CONTEXT.fill();
  CONTEXT.stroke();
  CONTEXT.restore(); // back to translate-only

  // Name + health bar above the ship (unrotated).
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "middle";
  CONTEXT.font = "12px monospace";
  CONTEXT.fillStyle = isSelf ? "#ffffff" : "rgb(200, 200, 210)";
  CONTEXT.fillText(p.name, 0, -34);

  const bw = 44;
  const bh = 5;
  const bx = -bw / 2;
  const by = -28;
  CONTEXT.fillStyle = "rgba(255, 255, 255, 0.15)";
  CONTEXT.fillRect(bx, by, bw, bh);
  CONTEXT.fillStyle = p.hp > 30 ? "rgb(120, 230, 120)" : "rgb(240, 90, 90)";
  CONTEXT.fillRect(bx, by, (bw * Math.max(0, p.hp)) / 100, bh);
  if (p.sh > 0) {
    CONTEXT.fillStyle = "rgba(120, 200, 255, 0.9)";
    CONTEXT.fillRect(bx, by - 4, (bw * Math.min(100, p.sh)) / 100, 3);
  }

  CONTEXT.restore();
}

// ----- Public: render the live world (play phase) -----
export function drawWorld(view, selfId, nowMs) {
  clearBg();
  drawGrid();
  for (const item of view.loot) drawLoot(item);
  for (const a of view.hazards) drawHazard(a);
  drawZone(view.zone);
  for (const b of view.bullets) drawBullet(b);
  for (const p of view.players) drawShip(p, p.id === selfId, nowMs);
}

// ----- Public: heads-up display -----
export function drawHud(view, selfId, nowMs) {
  const self = view.players.find((p) => p.id === selfId);

  // Players-alive banner (top-centre).
  CONTEXT.save();
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "alphabetic";
  CONTEXT.font = "bold 22px monospace";
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.fillText(`ALIVE: ${view.alive}`, CANVAS.width / 2, 34);

  // Zone warning if shrinking damage is active and self is outside.
  if (self && view.zone && self.a) {
    const dx = self.x - view.zone.cx;
    const dy = self.y - view.zone.cy;
    if (dx * dx + dy * dy > view.zone.r * view.zone.r) {
      CONTEXT.fillStyle = "rgb(255, 120, 120)";
      CONTEXT.font = "16px monospace";
      CONTEXT.fillText("⚠ OUTSIDE THE ZONE — GET TO SAFETY", CANVAS.width / 2, 58);
    }
  }
  CONTEXT.restore();

  // Kill feed (top-right).
  CONTEXT.save();
  CONTEXT.textAlign = "right";
  CONTEXT.font = "13px monospace";
  let fy = 30;
  for (const line of view.feed.slice(-5)) {
    CONTEXT.fillStyle = "rgba(230, 230, 235, 0.85)";
    CONTEXT.fillText(line, CANVAS.width - 16, fy);
    fy += 18;
  }
  CONTEXT.restore();

  if (self) drawSelfPanel(self);
  drawMinimap(view, selfId);
}

// Bottom-left panel: health, shield, weapon, ammo, kills.
function drawSelfPanel(self) {
  CONTEXT.save();
  const x = 18;
  let y = CANVAS.height - 96;

  CONTEXT.textAlign = "left";
  CONTEXT.textBaseline = "middle";

  if (!self.a) {
    CONTEXT.fillStyle = "rgb(240, 90, 90)";
    CONTEXT.font = "bold 20px monospace";
    CONTEXT.fillText(`ELIMINATED — #${self.pl || "-"}`, x, y);
    CONTEXT.restore();
    return;
  }

  // Health bar.
  const bw = 220;
  const bh = 16;
  CONTEXT.fillStyle = "rgba(255,255,255,0.15)";
  CONTEXT.fillRect(x, y, bw, bh);
  CONTEXT.fillStyle = self.hp > 30 ? "rgb(120, 230, 120)" : "rgb(240, 90, 90)";
  CONTEXT.fillRect(x, y, (bw * Math.max(0, self.hp)) / 100, bh);
  CONTEXT.strokeStyle = "rgba(255,255,255,0.3)";
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeRect(x, y, bw, bh);
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "12px monospace";
  CONTEXT.fillText(`${Math.round(self.hp)} HP`, x + bw + 10, y + bh / 2);

  // Shield bar.
  if (self.sh > 0) {
    y += 22;
    CONTEXT.fillStyle = "rgba(255,255,255,0.15)";
    CONTEXT.fillRect(x, y, bw, 8);
    CONTEXT.fillStyle = "rgba(120, 200, 255, 0.9)";
    CONTEXT.fillRect(x, y, (bw * Math.min(100, self.sh)) / 100, 8);
  }

  // Weapon + ammo.
  y += 26;
  const w = getWeapon(self.w);
  CONTEXT.fillStyle = `rgb(${w.color})`;
  CONTEXT.font = "bold 18px monospace";
  const ammoText = self.am < 0 ? "∞" : self.am;
  CONTEXT.fillText(`${w.name}  ${ammoText}`, x, y);

  // Kills.
  CONTEXT.fillStyle = "rgb(255, 215, 80)";
  CONTEXT.font = "14px monospace";
  CONTEXT.fillText(`KILLS: ${self.k}`, x, y + 22);

  CONTEXT.restore();
}

// Minimap (bottom-right): world bounds, zone, loot, players.
function drawMinimap(view, selfId) {
  const size = 170;
  const pad = 18;
  const ox = CANVAS.width - size - pad;
  const oy = CANVAS.height - size - pad;
  const sx = size / WORLD_W;
  const sy = size / WORLD_H;

  CONTEXT.save();
  CONTEXT.fillStyle = "rgba(10, 12, 18, 0.7)";
  CONTEXT.fillRect(ox, oy, size, size);
  CONTEXT.strokeStyle = "rgba(120, 200, 255, 0.4)";
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeRect(ox, oy, size, size);

  // Zone.
  if (view.zone) {
    CONTEXT.beginPath();
    CONTEXT.arc(
      ox + view.zone.cx * sx,
      oy + view.zone.cy * sy,
      Math.max(0, view.zone.r * sx),
      0,
      Math.PI * 2
    );
    CONTEXT.strokeStyle = "rgba(120, 200, 255, 0.8)";
    CONTEXT.stroke();
  }

  // Loot (tiny dots).
  CONTEXT.fillStyle = "rgba(255, 215, 80, 0.6)";
  for (const item of view.loot) {
    CONTEXT.fillRect(ox + item.x * sx - 1, oy + item.y * sy - 1, 2, 2);
  }

  // Players.
  for (const p of view.players) {
    if (!p.a) continue;
    CONTEXT.fillStyle = p.id === selfId ? "#ffffff" : p.color;
    CONTEXT.beginPath();
    CONTEXT.arc(ox + p.x * sx, oy + p.y * sy, p.id === selfId ? 4 : 3, 0, Math.PI * 2);
    CONTEXT.fill();
  }
  CONTEXT.restore();
}

// ----- Public: parachute / drop-in overview -----
// Shows the whole map fitted to the screen; the local player moves a landing
// reticle with the mouse. `reticle` is {x, y} in world coords (or null).
export function drawDropOverview(view, selfId, reticle, chosen, nowMs) {
  clearBg();
  const margin = 60;
  const scale = Math.min(
    (CANVAS.width - margin * 2) / WORLD_W,
    (CANVAS.height - margin * 2) / WORLD_H
  );
  const ox = (CANVAS.width - WORLD_W * scale) / 2;
  const oy = (CANVAS.height - WORLD_H * scale) / 2;
  const wx = (x) => ox + x * scale;
  const wy = (y) => oy + y * scale;

  CONTEXT.save();
  // Map bounds.
  CONTEXT.strokeStyle = "rgba(120, 200, 255, 0.4)";
  CONTEXT.lineWidth = 2;
  CONTEXT.strokeRect(ox, oy, WORLD_W * scale, WORLD_H * scale);

  // Zone preview.
  if (view.zone) {
    CONTEXT.beginPath();
    CONTEXT.arc(wx(view.zone.cx), wy(view.zone.cy), view.zone.r * scale, 0, Math.PI * 2);
    CONTEXT.strokeStyle = "rgba(120, 200, 255, 0.7)";
    CONTEXT.stroke();
  }

  // Loot dots.
  CONTEXT.fillStyle = "rgba(255, 215, 80, 0.7)";
  for (const item of view.loot) {
    CONTEXT.fillRect(wx(item.x) - 1.5, wy(item.y) - 1.5, 3, 3);
  }

  // (Other players' landing choices are intentionally hidden.)

  // The spot the player has locked in.
  if (chosen) {
    CONTEXT.fillStyle = "rgb(120, 230, 160)";
    CONTEXT.beginPath();
    CONTEXT.arc(wx(chosen.x), wy(chosen.y), 6, 0, Math.PI * 2);
    CONTEXT.fill();
    CONTEXT.strokeStyle = "rgb(120, 230, 160)";
    CONTEXT.lineWidth = 2;
    CONTEXT.beginPath();
    CONTEXT.arc(wx(chosen.x), wy(chosen.y), 13, 0, Math.PI * 2);
    CONTEXT.stroke();
    CONTEXT.fillStyle = "rgb(120, 230, 160)";
    CONTEXT.font = "12px monospace";
    CONTEXT.textAlign = "center";
    CONTEXT.fillText("DROP HERE", wx(chosen.x), wy(chosen.y) - 20);
  }

  // Local landing reticle (mouse hover preview).
  if (reticle) {
    CONTEXT.strokeStyle = "rgb(120, 230, 160)";
    CONTEXT.lineWidth = 2;
    CONTEXT.shadowColor = "rgb(120, 230, 160)";
    CONTEXT.shadowBlur = 10;
    CONTEXT.beginPath();
    CONTEXT.arc(wx(reticle.x), wy(reticle.y), 10, 0, Math.PI * 2);
    CONTEXT.moveTo(wx(reticle.x) - 16, wy(reticle.y));
    CONTEXT.lineTo(wx(reticle.x) + 16, wy(reticle.y));
    CONTEXT.moveTo(wx(reticle.x), wy(reticle.y) - 16);
    CONTEXT.lineTo(wx(reticle.x), wy(reticle.y) + 16);
    CONTEXT.stroke();
    CONTEXT.shadowBlur = 0;
  }
  CONTEXT.restore();

  // Title + countdown.
  CONTEXT.save();
  CONTEXT.textAlign = "center";
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "bold 30px monospace";
  CONTEXT.fillText("CHOOSE YOUR LANDING ZONE", CANVAS.width / 2, 50);
  const secs = Math.max(0, Math.ceil((view.end - nowMs) / 1000));
  CONTEXT.font = "20px monospace";
  CONTEXT.fillStyle = "rgb(120, 230, 160)";
  CONTEXT.fillText(`Dropping in ${secs}s — click the map to mark your spot`, CANVAS.width / 2, 80);
  CONTEXT.restore();
}
