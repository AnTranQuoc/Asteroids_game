import { CANVAS, CONTEXT } from "../core/canvas.js";
import { OFF_WHITE, GREY } from "../core/constants.js";
import { DIFFICULTIES, DIFFICULTY_ORDER, difficultyState } from "../systems/difficulty.js";
import { getSelectedShipSkin, getSelectedGunSkin } from "../systems/skins.js";
import { getMoney } from "../systems/money.js";
import { getPlayerName } from "../cloud/leaderboard.js";
import { drawButton } from "../ui/ui.js";

// Shared layout so drawing and click hit-testing use the exact same rects.
export function getStartButtons() {
  const cx = CANVAS.width / 2;
  const bw = 150;
  const bh = 50;
  const gap = 20;
  const rowY = CANVAS.height / 2 + 52;

  const total = bw * DIFFICULTY_ORDER.length + gap * (DIFFICULTY_ORDER.length - 1);
  let x = cx - total / 2;

  const buttons = DIFFICULTY_ORDER.map((key) => {
    const btn = {
      id: "difficulty",
      key,
      label: DIFFICULTIES[key].label,
      x,
      y: rowY,
      w: bw,
      h: bh,
    };
    x += bw + gap;
    return btn;
  });

  buttons.push({
    id: "start",
    label: "START GAME",
    x: cx - 130,
    y: rowY + 90,
    w: 260,
    h: 62,
  });

  // Secondary buttons in a 2x2 grid.
  const colL = cx - 230;
  const colR = cx + 10;
  buttons.push({ id: "shop", label: "SHOP", x: colL, y: rowY + 165, w: 220, h: 50 });
  buttons.push({ id: "leaderboard", label: "WORLD RECORDS", x: colR, y: rowY + 165, w: 220, h: 50 });
  buttons.push({ id: "myrecords", label: "MY RECORDS", x: colL, y: rowY + 225, w: 220, h: 50 });
  buttons.push({ id: "name", label: "CHANGE NAME", x: colR, y: rowY + 225, w: 220, h: 50 });

  return buttons;
}

export function drawStartScreenInfo() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;

  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  // Title.
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "120px monospace";
  const titleText = "ASTEROIDS";
  CONTEXT.fillText(titleText, cx - CONTEXT.measureText(titleText).width / 2, cy - 180);

  // Money balance.
  CONTEXT.font = "20px monospace";
  CONTEXT.fillStyle = "rgb(255, 215, 80)";
  const moneyText = `MONEY: $${getMoney()}`;
  CONTEXT.fillText(moneyText, cx - CONTEXT.measureText(moneyText).width / 2, cy - 148);

  // Equipped loadout preview.
  const ship = getSelectedShipSkin();
  const gun = getSelectedGunSkin();

  CONTEXT.save();
  CONTEXT.translate(cx, cy - 92);
  CONTEXT.rotate(-Math.PI / 2); // Point the ship upward.
  CONTEXT.scale(1.6, 1.6);
  ship.draw(CONTEXT);
  CONTEXT.restore();

  CONTEXT.fillStyle = "rgb(150, 150, 160)";
  CONTEXT.font = "14px monospace";
  const equipLabel = "YOUR SHIP";
  CONTEXT.fillText(equipLabel, cx - CONTEXT.measureText(equipLabel).width / 2, cy - 42);

  CONTEXT.font = "18px monospace";
  CONTEXT.fillStyle = OFF_WHITE;
  const loadoutText = `${ship.name}  /  ${gun.name}`;
  CONTEXT.fillText(loadoutText, cx - CONTEXT.measureText(loadoutText).width / 2, cy - 22);

  // Pilot name (used on the world-records board).
  CONTEXT.font = "14px monospace";
  CONTEXT.fillStyle = "rgb(150, 150, 160)";
  const pilotText = `PILOT: ${getPlayerName() || "unnamed"}`;
  CONTEXT.fillText(pilotText, cx - CONTEXT.measureText(pilotText).width / 2, cy - 2);

  // Controls hint.
  CONTEXT.font = "18px monospace";
  CONTEXT.fillStyle = OFF_WHITE;
  const controlsText = "MOUSE - Aim (auto-fires) | W/A/S/D - Move | ESC - Pause";
  CONTEXT.fillText(controlsText, cx - CONTEXT.measureText(controlsText).width / 2, cy + 24);

  // Buttons.
  for (const btn of getStartButtons()) {
    if (btn.id === "difficulty") {
      const active = btn.key === difficultyState.current;
      drawButton(btn, {
        active,
        color: active ? "120, 230, 160" : "120, 200, 255",
      });
    } else if (btn.id === "start") {
      drawButton(btn, { color: "120, 230, 160", font: "26px monospace" });
    } else if (btn.id === "shop") {
      drawButton(btn, { color: "255, 215, 80", font: "20px monospace" });
    } else if (btn.id === "leaderboard") {
      drawButton(btn, { color: "120, 200, 255", font: "16px monospace" });
    } else if (btn.id === "myrecords") {
      drawButton(btn, { color: "190, 160, 255", font: "18px monospace" });
    } else {
      drawButton(btn, { color: "160, 160, 175", font: "18px monospace" });
    }
  }
}
