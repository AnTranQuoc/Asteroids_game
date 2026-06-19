import { CANVAS, CONTEXT } from "./canvasUtils.js";
import { OFF_WHITE, GREY } from "./gameConstants.js";
import { drawButton } from "./ui.js";

export function getNameButtons() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;
  return [
    { id: "enter-name", label: "ENTER NAME", x: cx - 160, y: cy - 10, w: 320, h: 62 },
    { id: "play-unknown", label: "PLAY AS UNKNOWN", x: cx - 160, y: cy + 72, w: 320, h: 54 },
  ];
}

export function drawNameScreen() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;

  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "64px monospace";
  const title = "PILOT NAME";
  CONTEXT.fillText(title, cx - CONTEXT.measureText(title).width / 2, cy - 110);

  CONTEXT.font = "18px monospace";
  CONTEXT.fillStyle = "rgb(170, 170, 185)";
  const sub = "Your name appears on the WORLD RECORDS board.";
  CONTEXT.fillText(sub, cx - CONTEXT.measureText(sub).width / 2, cy - 60);

  for (const btn of getNameButtons()) {
    if (btn.id === "enter-name") {
      drawButton(btn, { color: "120, 230, 160", font: "26px monospace" });
    } else {
      drawButton(btn, { color: "160, 160, 175", font: "20px monospace" });
    }
  }
}
