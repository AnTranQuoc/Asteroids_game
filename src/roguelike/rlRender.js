// src/roguelike/rlRender.js
import { CANVAS, CONTEXT } from "../core/canvas.js";
import { OFF_WHITE } from "../core/constants.js";
import { rlState } from "./rlState.js";
import { kitState, maxHearts } from "./rlKit.js";
import { WEAPONS } from "./rlWeapons.js";
import { PASSIVES } from "./rlPassives.js";
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

// ── Hearts + armor (top left) ────────────────────────────────────────────────
export function drawHearts() {
  const max = maxHearts();
  const x0 = 16, y = 16, size = 22, gap = 6;
  CONTEXT.save();
  CONTEXT.font = `${size}px monospace`;
  CONTEXT.textAlign = "left";
  CONTEXT.textBaseline = "top";
  for (let i = 0; i < max; i++) {
    CONTEXT.fillStyle = i < kitState.hearts ? "#ff4d6d" : "rgba(255,77,109,0.22)";
    CONTEXT.fillText("♥", x0 + i * (size + gap), y);
  }
  const ax = x0 + max * (size + gap) + 8;
  for (let i = 0; i < kitState.armor; i++) {
    CONTEXT.fillStyle = "#8fd3ff";
    CONTEXT.fillText("◆", ax + i * (size + gap), y);
  }
  CONTEXT.restore();
}

// ── Kit strip (top left, below hearts) ───────────────────────────────────────
export function drawKitStrip() {
  const rowH = 16;
  const x = 16;
  let y = 48;
  CONTEXT.save();
  CONTEXT.font = "11px monospace";
  CONTEXT.textAlign = "left";
  CONTEXT.textBaseline = "middle";

  const rows = [
    ...kitState.kit.map((e) => ({ name: WEAPONS[e.id].name, level: e.level, max: WEAPONS[e.id].maxLevel, color: "#7ef5aa" })),
    ...kitState.passives.map((e) => ({ name: PASSIVES[e.id].name, level: e.level, max: PASSIVES[e.id].maxLevel, color: "#c8aaff" })),
  ];

  for (const r of rows) {
    CONTEXT.fillStyle = r.color;
    CONTEXT.fillText(r.name, x, y);
    const px0 = x + 120;
    for (let d = 0; d < r.max; d++) {
      CONTEXT.beginPath();
      CONTEXT.arc(px0 + d * 10, y, 3, 0, Math.PI * 2);
      CONTEXT.fillStyle = d < r.level ? r.color : "rgba(255,255,255,0.15)";
      CONTEXT.fill();
    }
    y += rowH;
  }
  CONTEXT.restore();
}

// ── Boss countdown (top centre, below score) ─────────────────────────────────
export function drawBossCountdown(msRemaining) {
  const secs = Math.max(0, Math.ceil(msRemaining / 1000));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");
  CONTEXT.save();
  CONTEXT.font = "13px monospace";
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "top";
  CONTEXT.fillStyle = secs <= 10 ? "#ff8050" : "rgba(255,255,255,0.7)";
  CONTEXT.fillText(`BOSS IN ${mm}:${ss}`, CANVAS.width / 2, 32);
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
  STAT:      { accent: "200,170,255", label: "STAT" },
};

const CARD_W = 190;
const CARD_H = 230;
const CARD_GAP = 20;

export function getUpgradeCardButtons(cards) {
  const n = cards.length;
  const totalW = CARD_W * n + CARD_GAP * (n - 1);
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
    CONTEXT.fillText(
      card.isUpgrade ? `${card.tier}  ·  UPGRADE` : card.tier,
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
    const desc = card.desc;
    wrapText(desc, btn.x + btn.w / 2, btn.y + 108, btn.w - 20, 16);

    // Level pips (finite maxLevel) or "Lv N" text (unbounded stats)
    if (Number.isFinite(card.maxLevel)) {
      const dots = card.maxLevel;
      const dotR = 4, dotGap = 10;
      const dotsW = dots * (dotR * 2 + dotGap) - dotGap;
      let dotX = btn.x + btn.w / 2 - dotsW / 2 + dotR;
      const dotY = btn.y + CARD_H - 28;
      for (let d = 0; d < dots; d++) {
        CONTEXT.beginPath();
        CONTEXT.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        if (d < card.nextLevel) {
          CONTEXT.fillStyle = `rgb(${accent})`;
          CONTEXT.shadowColor = `rgb(${accent})`;
          CONTEXT.shadowBlur = 6;
        } else {
          CONTEXT.fillStyle = "rgba(255,255,255,0.12)";
          CONTEXT.shadowBlur = 0;
        }
        CONTEXT.fill();
        dotX += dotR * 2 + dotGap;
      }
      CONTEXT.shadowBlur = 0;
    } else {
      CONTEXT.font = "11px monospace";
      CONTEXT.fillStyle = `rgb(${accent})`;
      CONTEXT.fillText(`Lv ${card.nextLevel}`, btn.x + btn.w / 2, btn.y + CARD_H - 28);
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

// ── Level-select screen ───────────────────────────────────────────────────────
const LVL_CARD_W = 200;
const LVL_CARD_H = 150;
const LVL_CARD_GAP = 28;

export function getRLMenuButtons() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;
  const totalW = LVL_CARD_W * 2 + LVL_CARD_GAP;
  const startX = cx - totalW / 2;
  const cardY = cy - LVL_CARD_H / 2;
  return [
    { id: "rl-level-1", label: "LEVEL 1", x: startX, y: cardY, w: LVL_CARD_W, h: LVL_CARD_H },
    { id: "rl-back", label: "BACK", x: cx - 90, y: CANVAS.height - 96, w: 180, h: 48 },
  ];
}

export function drawRLMenu() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;
  const totalW = LVL_CARD_W * 2 + LVL_CARD_GAP;
  const startX = cx - totalW / 2;
  const cardY = cy - LVL_CARD_H / 2;

  CONTEXT.fillStyle = "rgb(16,16,16)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.save();
  CONTEXT.textAlign = "center";
  CONTEXT.font = "bold 56px monospace";
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.fillText("ROGUELIKE", cx, cy - 150);
  CONTEXT.font = "14px monospace";
  CONTEXT.fillStyle = "rgb(120,140,120)";
  CONTEXT.fillText("Select a level", cx, cy - 110);
  CONTEXT.restore();

  const comingX = startX + LVL_CARD_W + LVL_CARD_GAP;
  CONTEXT.save();
  CONTEXT.fillStyle = "rgba(255,255,255,0.03)";
  CONTEXT.strokeStyle = "rgba(160,160,175,0.25)";
  CONTEXT.lineWidth = 1;
  CONTEXT.setLineDash([6, 6]);
  CONTEXT.beginPath();
  CONTEXT.rect(comingX, cardY, LVL_CARD_W, LVL_CARD_H);
  CONTEXT.fill();
  CONTEXT.stroke();
  CONTEXT.setLineDash([]);
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "middle";
  CONTEXT.font = "16px monospace";
  CONTEXT.fillStyle = "rgba(160,160,175,0.6)";
  CONTEXT.fillText("COMING SOON", comingX + LVL_CARD_W / 2, cardY + LVL_CARD_H / 2);
  CONTEXT.restore();

  for (const btn of getRLMenuButtons()) {
    drawButton(btn, {
      color: btn.id === "rl-level-1" ? "120, 230, 160" : "160, 160, 175",
      font: btn.id === "rl-level-1" ? "22px monospace" : "18px monospace",
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

  const TIER_CHIP_COLORS = { COMMON: "#7ef5aa", RARE: "#78c8ff", LEGENDARY: "#ffd750", STAT: "#c8aaff" };
  let chipX = cx - 200;
  let chipY = y;
  CONTEXT.font = "11px monospace";
  CONTEXT.textBaseline = "middle";
  const chips = [
    ...kitState.kit.map((e) => ({ label: `${WEAPONS[e.id].name} Lv${e.level}`, tier: WEAPONS[e.id].tier })),
    ...kitState.passives.map((e) => ({ label: `${PASSIVES[e.id].name} Lv${e.level}`, tier: PASSIVES[e.id].tier })),
  ];
  for (const chip of chips) {
    const w = CONTEXT.measureText(chip.label).width + 16;
    if (chipX + w > cx + 200) { chipX = cx - 200; chipY += 28; }
    CONTEXT.fillStyle = `rgba(255,255,255,0.05)`;
    CONTEXT.strokeStyle = TIER_CHIP_COLORS[chip.tier];
    CONTEXT.lineWidth = 1;
    roundRect(chipX, chipY, w, 22, 4);
    CONTEXT.fill();
    CONTEXT.stroke();
    CONTEXT.fillStyle = TIER_CHIP_COLORS[chip.tier];
    CONTEXT.textAlign = "center";
    CONTEXT.fillText(chip.label, chipX + w / 2, chipY + 11);
    chipX += w + 8;
  }
  CONTEXT.textBaseline = "alphabetic";

  CONTEXT.restore();

  for (const btn of getRLEndButtons()) {
    drawButton(btn, {
      color: btn.id === "rl-restart" ? "120, 230, 160" : "160, 160, 175",
      font: "18px monospace",
    });
  }
}

// ── Win screen ────────────────────────────────────────────────────────────────
export function getRLWinButtons() {
  const cx = CANVAS.width / 2;
  return [
    { id: "rl-restart", label: "PLAY AGAIN", x: cx - 210, y: CANVAS.height - 110, w: 190, h: 54 },
    { id: "rl-levels",  label: "LEVELS",     x: cx + 20,  y: CANVAS.height - 110, w: 190, h: 54 },
  ];
}

export function drawRLWin(bestScore, now) {
  const cx = CANVAS.width / 2;
  const isNewBest = rlState.score > (bestScore || 0);

  CONTEXT.fillStyle = "rgb(10,16,12)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.save();
  CONTEXT.textAlign = "center";

  CONTEXT.font = "bold 48px monospace";
  CONTEXT.fillStyle = "#7ef5aa";
  CONTEXT.shadowColor = "rgba(126,245,170,0.6)";
  CONTEXT.shadowBlur = 22;
  CONTEXT.fillText("VICTORY", cx, 110);
  CONTEXT.shadowBlur = 0;

  CONTEXT.font = "15px monospace";
  CONTEXT.fillStyle = "rgb(150,180,150)";
  CONTEXT.fillText("LEVEL 1 CLEARED", cx, 150);

  const stats = [
    ["SCORE",        `${rlState.score}${isNewBest ? "  ★ NEW BEST" : ""}`],
    ["LEVEL",        String(rlState.level)],
    ["ASTEROIDS",    String(rlState.asteroidsKilled)],
    ["UPGRADES",     String(rlState.upgradesPickedCount)],
    ["MONEY EARNED", `+$${Math.floor(rlState.score / 10)}`],
  ];
  CONTEXT.font = "15px monospace";
  let y = 210;
  for (const [label, value] of stats) {
    CONTEXT.textAlign = "right";
    CONTEXT.fillStyle = "#555";
    CONTEXT.fillText(label, cx - 10, y);
    CONTEXT.textAlign = "left";
    CONTEXT.fillStyle = (label === "SCORE" && isNewBest) || label === "MONEY EARNED" ? "#ffd750" : OFF_WHITE;
    CONTEXT.fillText(value, cx + 10, y);
    y += 26;
  }
  CONTEXT.restore();

  for (const btn of getRLWinButtons()) {
    drawButton(btn, {
      color: btn.id === "rl-restart" ? "120, 230, 160" : "160, 160, 175",
      font: "18px monospace",
    });
  }
}
