import { CANVAS, CONTEXT } from "./canvasUtils.js";
import { score, bestScore } from "./scoreUtils.js";
import { OFF_WHITE, TRANSLUCENT } from "./gameConstants.js";
import { DIFFICULTIES, DIFFICULTY_ORDER, difficultyState } from "./difficulty.js";
import { getMoney, getLastEarned } from "./money.js";
import { drawButton } from "./ui.js";

export function getRestartButtons() {
  const cx = CANVAS.width / 2;
  const bw = 150;
  const bh = 50;
  const gap = 20;
  const rowY = CANVAS.height / 2 + 50;

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
    y: rowY + 90,
    w: 260,
    h: 62,
  });

  buttons.push({
    id: "shop",
    label: "SHOP",
    x: cx - 110,
    y: rowY + 165,
    w: 220,
    h: 50,
  });

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
  const bestScoreText = `The score to beat is ${bestScore}.`;
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

  // Buttons.
  for (const btn of getRestartButtons()) {
    if (btn.id === "difficulty") {
      const active = btn.key === difficultyState.current;
      drawButton(btn, {
        active,
        color: active ? "120, 230, 160" : "120, 200, 255",
      });
    } else if (btn.id === "restart") {
      drawButton(btn, { color: "120, 230, 160", font: "26px monospace" });
    } else {
      drawButton(btn, { color: "255, 215, 80" });
    }
  }
}
