import { CANVAS, CONTEXT } from "../core/canvas.js";
import { OFF_WHITE, GREY } from "../core/constants.js";
import { DIFFICULTY_ORDER, DIFFICULTIES } from "../systems/difficulty.js";
import { getBestScore } from "../systems/score.js";
import { getMoney } from "../systems/money.js";
import { getPlayerName } from "../cloud/leaderboard.js";
import { drawButton } from "../ui/ui.js";

const MODE_COLORS = {
  EASY: "120, 230, 160",
  NORMAL: "120, 200, 255",
  HARD: "255, 170, 60",
  CRAZY: "255, 90, 90",
};

export function getMyRecordsButtons() {
  return [
    {
      id: "mr-back",
      label: "BACK",
      x: CANVAS.width / 2 - 110,
      y: CANVAS.height - 86,
      w: 220,
      h: 54,
    },
  ];
}

export function drawMyRecordsScreen() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;

  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  // Title.
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "56px monospace";
  const title = "MY RECORDS";
  CONTEXT.fillText(title, cx - CONTEXT.measureText(title).width / 2, 96);

  // Pilot + money.
  CONTEXT.font = "20px monospace";
  CONTEXT.fillStyle = "rgb(180, 180, 190)";
  const info = `PILOT: ${getPlayerName() || "unnamed"}     MONEY: $${getMoney()}`;
  CONTEXT.fillText(info, cx - CONTEXT.measureText(info).width / 2, 140);

  // Per-mode best scores.
  const boxW = 420;
  const lx = cx - boxW / 2;
  const rx = cx + boxW / 2;
  let y = cy - 70;

  CONTEXT.font = "16px monospace";
  CONTEXT.fillStyle = "rgb(140, 140, 150)";
  CONTEXT.textAlign = "left";
  CONTEXT.fillText("MODE", lx, y);
  CONTEXT.textAlign = "right";
  CONTEXT.fillText("BEST SCORE", rx, y);
  y += 18;
  CONTEXT.strokeStyle = "rgba(255, 255, 255, 0.15)";
  CONTEXT.lineWidth = 1;
  CONTEXT.beginPath();
  CONTEXT.moveTo(lx, y);
  CONTEXT.lineTo(rx, y);
  CONTEXT.stroke();
  y += 36;

  CONTEXT.font = "26px monospace";
  DIFFICULTY_ORDER.forEach((key) => {
    const label = DIFFICULTIES[key].label;
    CONTEXT.textAlign = "left";
    CONTEXT.fillStyle = `rgb(${MODE_COLORS[label] || "200, 200, 210"})`;
    CONTEXT.fillText(label, lx, y);
    CONTEXT.textAlign = "right";
    CONTEXT.fillStyle = OFF_WHITE;
    CONTEXT.fillText(`${getBestScore(label)}`, rx, y);
    y += 48;
  });

  for (const btn of getMyRecordsButtons()) drawButton(btn, { color: "120, 200, 255" });
}
