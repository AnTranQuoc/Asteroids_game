import { CANVAS, CONTEXT } from "./canvasUtils.js";
import { score } from "./scoreUtils.js";
import { OFF_WHITE, TRANSLUCENT } from "./gameConstants.js";
import { drawButton } from "./ui.js";

export function getPauseButtons() {
  const cx = CANVAS.width / 2;
  return [
    {
      id: "resume",
      label: "RESUME",
      x: cx - 130,
      y: CANVAS.height / 2 + 40,
      w: 260,
      h: 62,
    },
    {
      id: "restart",
      label: "RESTART",
      x: cx - 130,
      y: CANVAS.height / 2 + 115,
      w: 260,
      h: 54,
    },
    {
      id: "lobby",
      label: "BACK TO LOBBY",
      x: cx - 130,
      y: CANVAS.height / 2 + 180,
      w: 260,
      h: 54,
    },
  ];
}

export function drawPauseMenuInfo() {
  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = TRANSLUCENT;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "30px monospace";
  const pausedText = "GAME PAUSED";
  const pausedWidth = CONTEXT.measureText(pausedText).width;
  CONTEXT.fillText(pausedText, (CANVAS.width - pausedWidth) / 2, CANVAS.height / 2 - 70);

  CONTEXT.font = "20px monospace";
  const scoreText = `Your score is currently ${score}.`;
  const scoreWidth = CONTEXT.measureText(scoreText).width;
  CONTEXT.fillText(scoreText, (CANVAS.width - scoreWidth) / 2, CANVAS.height / 2 - 30);

  const controlsText = "MOUSE - Aim (auto-fires) | W/A/S/D - Move | ESC - Pause";
  const controlsWidth = CONTEXT.measureText(controlsText).width;
  CONTEXT.fillText(controlsText, (CANVAS.width - controlsWidth) / 2, CANVAS.height / 2 - 5);

  for (const btn of getPauseButtons()) {
    if (btn.id === "resume") {
      drawButton(btn, { color: "120, 230, 160", font: "26px monospace" });
    } else if (btn.id === "restart") {
      drawButton(btn, { color: "255, 170, 60", font: "22px monospace" });
    } else {
      drawButton(btn, { color: "160, 160, 175", font: "22px monospace" });
    }
  }
}
