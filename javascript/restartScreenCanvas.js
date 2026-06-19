import { CANVAS, CONTEXT } from "./canvasUtils.js";
import { score, getBestScore } from "./scoreUtils.js";
import { OFF_WHITE, TRANSLUCENT } from "./gameConstants.js";
import { DIFFICULTIES, DIFFICULTY_ORDER, difficultyState } from "./difficulty.js";
import { getMoney, getLastEarned } from "./money.js";
import { getPlayerName } from "./leaderboard.js";
import { drawButton } from "./ui.js";

export function getRestartButtons() {
  const cx = CANVAS.width / 2;
  const bw = 150;
  const bh = 50;
  const gap = 20;
  const rowY = CANVAS.height / 2 + 76;

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
    id: "restart",
    label: "PLAY AGAIN",
    x: cx - 130,
    y: rowY + 86,
    w: 260,
    h: 58,
  });

  // Same secondary features as the lobby, in a 2x2 grid.
  const colL = cx - 230;
  const colR = cx + 10;
  buttons.push({ id: "shop", label: "SHOP", x: colL, y: rowY + 156, w: 220, h: 46 });
  buttons.push({ id: "leaderboard", label: "WORLD RECORDS", x: colR, y: rowY + 156, w: 220, h: 46 });
  buttons.push({ id: "myrecords", label: "MY RECORDS", x: colL, y: rowY + 210, w: 220, h: 46 });
  buttons.push({ id: "name", label: "CHANGE NAME", x: colR, y: rowY + 210, w: 220, h: 46 });

  return buttons;
}

export function drawRestartScreenInfo() {
  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = TRANSLUCENT;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "30px monospace";
  const mainMessageText = "You have been hit by an asteroid!";
  const mainMessageWidth = CONTEXT.measureText(mainMessageText).width;
  CONTEXT.fillText(mainMessageText, (CANVAS.width - mainMessageWidth) / 2, CANVAS.height / 2 - 70);

  CONTEXT.font = "20px monospace";
  const mode = difficultyState.current;
  const bestScoreText = `${DIFFICULTIES[mode].label} best: ${getBestScore(DIFFICULTIES[mode].label)}`;
  const bestScoreWidth = CONTEXT.measureText(bestScoreText).width;
  CONTEXT.fillText(bestScoreText, (CANVAS.width - bestScoreWidth) / 2, CANVAS.height / 2 - 30);

  const scoreText = `Your score was ${score}.`;
  const scoreWidth = CONTEXT.measureText(scoreText).width;
  CONTEXT.fillText(scoreText, (CANVAS.width - scoreWidth) / 2, CANVAS.height / 2);

  // Money earned this run + total balance.
  CONTEXT.font = "22px monospace";
  CONTEXT.fillStyle = "rgb(255, 215, 80)";
  const moneyText = `Earned $${getLastEarned()}  —  Total $${getMoney()}`;
  const moneyWidth = CONTEXT.measureText(moneyText).width;
  CONTEXT.fillText(moneyText, (CANVAS.width - moneyWidth) / 2, CANVAS.height / 2 + 30);

  // Pilot name (matches the lobby).
  CONTEXT.font = "14px monospace";
  CONTEXT.fillStyle = "rgb(150, 150, 160)";
  const pilotText = `PILOT: ${getPlayerName() || "unnamed"}`;
  CONTEXT.fillText(pilotText, (CANVAS.width - CONTEXT.measureText(pilotText).width) / 2, CANVAS.height / 2 + 56);

  // Buttons.
  for (const btn of getRestartButtons()) {
    if (btn.id === "difficulty") {
      const active = btn.key === difficultyState.current;
      drawButton(btn, {
        active,
        color: active ? "120, 230, 160" : "120, 200, 255",
      });
    } else if (btn.id === "restart") {
      drawButton(btn, { color: "120, 230, 160", font: "24px monospace" });
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
