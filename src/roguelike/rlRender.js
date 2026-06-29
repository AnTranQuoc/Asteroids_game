// src/roguelike/rlRender.js
import { CANVAS, CONTEXT } from "../core/canvas.js";
import { OFF_WHITE } from "../core/constants.js";
import { rlState } from "./rlState.js";
import { UPGRADE_POOL } from "./rlUpgrades.js";
import { drawButton } from "../ui/ui.js";

// ── XP strip (top edge, 5px tall) ────────────────────────────────────────────
export function drawXPStrip(inBossPhase) {
  const t = rlState.xp / rlState.xpRequired;
  const fillColor = inBossPhase ? "#ff5050" : "#78c8ff";
  const glowColor = inBossPhase ? "rgba(255,80,80,0.7)" : "rgba(120,200,255,0.6)";

  // Track
  CONTEXT.fillStyle = "rgba(255,255,255,0.05)";
  CONTEXT.fillRect(0, 0, CANVAS.width, 5);

  // Fill
  CONTEXT.save();
  CONTEXT.fillStyle = fillColor;
  CONTEXT.shadowColor = glowColor;
  CONTEXT.shadowBlur = 6;
  CONTEXT.fillRect(0, 0, CANVAS.width * Math.min(1, t), 5);
  CONTEXT.restore();
}

// ── Level + XP text (top right) ──────────────────────────────────────────────
export function drawLevelBadge() {
  CONTEXT.save();
  CONTEXT.font = "11px monospace";
  CONTEXT.textAlign = "right";
  CONTEXT.textBaseline = "top";
  CONTEXT.fillStyle = "rgba(120,200,255,0.8)";
  CONTEXT.fillText(
    `LVL ${rlState.level}  ·  ${rlState.xp} / ${rlState.xpRequired} XP`,
    CANVAS.width - 12, 8
  );
  CONTEXT.restore();
}

// ── Score line (top centre, below the XP strip) ──────────────────────────────
export function drawRLScore() {
  CONTEXT.save();
  CONTEXT.font = "15px monospace";
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "top";
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.fillText(`SCORE  ${rlState.score}`, CANVAS.width / 2, 10);
  CONTEXT.restore();
}

// ── Boss HP bar (centred, below score) ───────────────────────────────────────
export function drawBossHPBar(boss) {
  const barW = 260;
  const barH = 10;
  const bx = CANVAS.width / 2 - barW / 2;
  const by = 30;
  const t = boss.hp / boss.maxHp;

  CONTEXT.save();

  // Label
  CONTEXT.font = "10px monospace";
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "bottom";
  CONTEXT.fillStyle = "#ff5050";
  CONTEXT.letterSpacing = "2px";
  CONTEXT.fillText(`BOSS #${boss.index}  ${boss.shielded ? "SHIELDED" : "EXPOSED"}`, CANVAS.width / 2, by - 2);

  // Track
  CONTEXT.fillStyle = "rgba(255,255,255,0.07)";
  CONTEXT.fillRect(bx, by, barW, barH);

  // Fill
  CONTEXT.fillStyle = "#ff5050";
  CONTEXT.shadowColor = "rgba(255,60,60,0.6)";
  CONTEXT.shadowBlur = 8;
  CONTEXT.fillRect(bx, by, barW * t, barH);

  // Border
  CONTEXT.shadowBlur = 0;
  CONTEXT.strokeStyle = "rgba(255,80,80,0.4)";
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeRect(bx, by, barW, barH);

  CONTEXT.restore();
}

// ── Upgrade card overlay ──────────────────────────────────────────────────────
const TIER_COLORS = {
  COMMON:    { accent: "126,245,170", label: "COMMON" },
  RARE:      { accent: "120,200,255", label: "RARE" },
  LEGENDARY: { accent: "255,215,80",  label: "LEGENDARY" },
};

const CARD_W = 190;
const CARD_H = 230;
const CARD_GAP = 20;

export function getUpgradeCardButtons(cards) {
  const totalW = CARD_W * 3 + CARD_GAP * 2;
  const startX = CANVAS.width / 2 - totalW / 2;
  const startY = CANVAS.height / 2 - CARD_H / 2 + 20;
  return cards.map((card, i) => ({
    id: "upgrade",
    upgradeId: card.id,
    x: startX + i * (CARD_W + CARD_GAP),
    y: startY,
    w: CARD_W,
    h: CARD_H,
  }));
}

export function drawUpgradeOverlay(cards, hoveredIndex) {
  const cx = CANVAS.width / 2;

  // Dim background
  CONTEXT.save();
  CONTEXT.fillStyle = "rgba(0,0,0,0.7)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.restore();

  // Title
  CONTEXT.save();
  CONTEXT.font = "bold 28px monospace";
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "middle";
  CONTEXT.fillStyle = "#7ef5aa";
  CONTEXT.shadowColor = "rgba(126,245,170,0.7)";
  CONTEXT.shadowBlur = 16;
  CONTEXT.fillText("LEVEL UP!", cx, CANVAS.height / 2 - CARD_H / 2 - 30);
  CONTEXT.shadowBlur = 0;
  CONTEXT.font = "12px monospace";
  CONTEXT.fillStyle = "#666";
  CONTEXT.fillText(`CHOOSE AN UPGRADE  —  LEVEL ${rlState.level}`, cx, CANVAS.height / 2 - CARD_H / 2 - 6);
  CONTEXT.restore();

  const buttons = getUpgradeCardButtons(cards);

  cards.forEach((card, i) => {
    const btn = buttons[i];
    const { accent } = TIER_COLORS[card.tier];
    const hovered = hoveredIndex === i;

    CONTEXT.save();

    // Card background
    CONTEXT.fillStyle = `rgba(${accent}, ${hovered ? 0.14 : 0.07})`;
    CONTEXT.strokeStyle = `rgba(${accent}, ${hovered ? 0.8 : 0.35})`;
    CONTEXT.lineWidth = hovered ? 2 : 1;
    if (hovered) {
      CONTEXT.shadowColor = `rgb(${accent})`;
      CONTEXT.shadowBlur = 18;
    }
    roundRect(btn.x, btn.y, btn.w, btn.h, 10);
    CONTEXT.fill();
    CONTEXT.stroke();
    CONTEXT.shadowBlur = 0;

    // Tier badge
    CONTEXT.font = "9px monospace";
    CONTEXT.textAlign = "center";
    CONTEXT.textBaseline = "top";
    CONTEXT.fillStyle = `rgba(${accent}, 0.8)`;
    CONTEXT.letterSpacing = "2px";
    CONTEXT.fillText(
      card.isUpgrade ? `${card.tier} · UPGRADE` : card.tier,
      btn.x + btn.w / 2, btn.y + 10
    );

    // Upgrade name
    CONTEXT.font = "bold 14px monospace";
    CONTEXT.textBaseline = "middle";
    CONTEXT.fillStyle = `rgb(${accent})`;
    CONTEXT.fillText(card.name, btn.x + btn.w / 2, btn.y + 80);

    // Description (next stack)
    CONTEXT.font = "11px monospace";
    CONTEXT.fillStyle = "rgba(200,200,210,0.85)";
    const desc = card.desc(card.nextStacks);
    wrapText(desc, btn.x + btn.w / 2, btn.y + 108, btn.w - 20, 16);

    // Stack dots
    const maxDots = Math.min(card.nextStacks + 1, 6);
    const dotR = 4;
    const dotGap = 10;
    const dotsW = maxDots * (dotR * 2 + dotGap) - dotGap;
    let dotX = btn.x + btn.w / 2 - dotsW / 2 + dotR;
    const dotY = btn.y + CARD_H - 28;
    for (let d = 0; d < maxDots; d++) {
      CONTEXT.beginPath();
      CONTEXT.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      if (d < card.currentStacks) {
        CONTEXT.fillStyle = `rgb(${accent})`;
        CONTEXT.shadowColor = `rgb(${accent})`;
        CONTEXT.shadowBlur = 6;
      } else {
        CONTEXT.fillStyle = "rgba(255,255,255,0.12)";
        CONTEXT.shadowBlur = 0;
      }
      CONTEXT.fill();
      CONTEXT.shadowBlur = 0;
      dotX += dotR * 2 + dotGap;
    }

    CONTEXT.restore();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roundRect(x, y, w, h, r) {
  CONTEXT.beginPath();
  CONTEXT.moveTo(x + r, y);
  CONTEXT.arcTo(x + w, y, x + w, y + h, r);
  CONTEXT.arcTo(x + w, y + h, x, y + h, r);
  CONTEXT.arcTo(x, y + h, x, y, r);
  CONTEXT.arcTo(x, y, x + w, y, r);
  CONTEXT.closePath();
}

function wrapText(text, cx, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (CONTEXT.measureText(test).width > maxW && line) {
      CONTEXT.fillText(line, cx, y);
      line = word;
      y += lineH;
    } else {
      line = test;
    }
  }
  if (line) CONTEXT.fillText(line, cx, y);
}

// ── Menu screen ───────────────────────────────────────────────────────────────
export function getRLMenuButtons() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;
  return [
    { id: "rl-start", label: "START RUN", x: cx - 130, y: cy - 10, w: 260, h: 62 },
    { id: "rl-back",  label: "BACK",      x: cx - 130, y: cy + 70, w: 260, h: 50 },
  ];
}

export function drawRLMenu() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;

  CONTEXT.fillStyle = "rgb(16,16,16)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.save();
  CONTEXT.textAlign = "center";

  CONTEXT.font = "bold 64px monospace";
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.fillText("ROGUELIKE", cx, cy - 100);

  CONTEXT.font = "15px monospace";
  CONTEXT.fillStyle = "rgb(120,140,120)";
  CONTEXT.fillText("Kill asteroids · Level up · Pick upgrades · Survive bosses", cx, cy - 56);
  CONTEXT.restore();

  for (const btn of getRLMenuButtons()) {
    drawButton(btn, {
      color: btn.id === "rl-start" ? "120, 230, 160" : "160, 160, 175",
      font: btn.id === "rl-start" ? "24px monospace" : "20px monospace",
    });
  }
}

// ── End screen ────────────────────────────────────────────────────────────────
export function getRLEndButtons() {
  const cx = CANVAS.width / 2;
  return [
    { id: "rl-restart", label: "TRY AGAIN",   x: cx - 210, y: CANVAS.height - 110, w: 190, h: 54 },
    { id: "rl-back",    label: "MAIN MENU",   x: cx + 20,  y: CANVAS.height - 110, w: 190, h: 54 },
  ];
}

export function drawRLEnd(bestScore, now) {
  const cx = CANVAS.width / 2;
  const elapsedMs = now - rlState.runStartTime;
  const secs = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const isNewBest = rlState.score > (bestScore || 0);

  CONTEXT.fillStyle = "rgb(10,12,20)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.save();
  CONTEXT.textAlign = "center";

  // Title
  CONTEXT.font = "bold 44px monospace";
  CONTEXT.fillStyle = "#ff5050";
  CONTEXT.shadowColor = "rgba(255,60,60,0.5)";
  CONTEXT.shadowBlur = 20;
  CONTEXT.fillText("YOU DIED", cx, 100);
  CONTEXT.shadowBlur = 0;

  // Stats
  const stats = [
    ["SCORE",       `${rlState.score}${isNewBest ? "  ★ NEW BEST" : ""}`],
    ["LEVEL",       String(rlState.level)],
    ["BOSSES",      String(rlState.bossesDefeated)],
    ["ASTEROIDS",   String(rlState.asteroidsKilled)],
    ["UPGRADES",    String(rlState.upgradesPickedCount)],
    ["TIME",        `${mm}:${ss}`],
    ["MONEY EARNED", `+$${Math.floor(rlState.score / 10)}`],
  ];

  CONTEXT.font = "15px monospace";
  let y = 170;
  for (const [label, value] of stats) {
    CONTEXT.textAlign = "right";
    CONTEXT.fillStyle = "#555";
    CONTEXT.fillText(label, cx - 10, y);
    CONTEXT.textAlign = "left";
    CONTEXT.fillStyle = label === "SCORE" && isNewBest ? "#ffd750" :
                        label === "MONEY EARNED"       ? "#ffd750" : OFF_WHITE;
    CONTEXT.fillText(value, cx + 10, y);
    y += 26;
  }

  // Upgrade chips
  y += 8;
  CONTEXT.textAlign = "center";
  CONTEXT.font = "11px monospace";
  CONTEXT.fillStyle = "#555";
  CONTEXT.fillText("UPGRADES THIS RUN", cx, y);
  y += 18;

  const TIER_CHIP_COLORS = { COMMON: "#7ef5aa", RARE: "#78c8ff", LEGENDARY: "#ffd750" };
  let chipX = cx - 200;
  const chipY = y;
  for (const [id, stacks] of rlState.upgrades) {
    if (stacks === 0) continue;
    const def = UPGRADE_POOL.find((u) => u.id === id);
    if (!def) continue;
    const label = `${def.name} ×${stacks}`;
    CONTEXT.font = "11px monospace";
    const w = CONTEXT.measureText(label).width + 16;
    CONTEXT.fillStyle = `rgba(255,255,255,0.05)`;
    CONTEXT.strokeStyle = TIER_CHIP_COLORS[def.tier];
    CONTEXT.lineWidth = 1;
    roundRect(chipX, chipY, w, 22, 4);
    CONTEXT.fill();
    CONTEXT.stroke();
    CONTEXT.fillStyle = TIER_CHIP_COLORS[def.tier];
    CONTEXT.textAlign = "center";
    CONTEXT.fillText(label, chipX + w / 2, chipY + 11);
    chipX += w + 8;
    if (chipX > cx + 200) { chipX = cx - 200; y += 28; }
  }

  CONTEXT.restore();

  for (const btn of getRLEndButtons()) {
    drawButton(btn, {
      color: btn.id === "rl-restart" ? "120, 230, 160" : "160, 160, 175",
      font: "18px monospace",
    });
  }
}
