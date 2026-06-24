import { CANVAS, CONTEXT } from "../core/canvas.js";
import { MOUSE } from "../core/constants.js";

// Returns true if the point is inside the button rect.
export function isInside(px, py, btn) {
  return (
    px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h
  );
}

function roundRectPath(x, y, w, h, r) {
  CONTEXT.beginPath();
  CONTEXT.moveTo(x + r, y);
  CONTEXT.arcTo(x + w, y, x + w, y + h, r);
  CONTEXT.arcTo(x + w, y + h, x, y + h, r);
  CONTEXT.arcTo(x, y + h, x, y, r);
  CONTEXT.arcTo(x, y, x + w, y, r);
  CONTEXT.closePath();
}

// Draws a glowing, hover-aware button. `opts.active` highlights a selected
// button; `opts.color` is an "r, g, b" accent string. Sets the canvas cursor to
// a pointer while hovered.
export function drawButton(btn, opts = {}) {
  const accent = opts.color || "120, 200, 255";
  const hovered = isInside(MOUSE.x, MOUSE.y, btn);
  const lit = hovered || opts.active;

  if (hovered) CANVAS.style.cursor = "pointer";

  CONTEXT.save();
  roundRectPath(btn.x, btn.y, btn.w, btn.h, 8);

  CONTEXT.fillStyle = opts.active
    ? `rgba(${accent}, 0.22)`
    : hovered
    ? "rgba(255, 255, 255, 0.10)"
    : "rgba(255, 255, 255, 0.03)";
  if (lit) {
    CONTEXT.shadowColor = `rgb(${accent})`;
    CONTEXT.shadowBlur = 16;
  }
  CONTEXT.fill();

  CONTEXT.shadowBlur = 0;
  CONTEXT.lineWidth = 2;
  CONTEXT.strokeStyle = `rgb(${accent})`;
  CONTEXT.stroke();

  CONTEXT.fillStyle = lit ? `rgb(${accent})` : "rgb(205, 205, 215)";
  CONTEXT.font = opts.font || "22px monospace";
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "middle";
  CONTEXT.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);

  CONTEXT.restore();
}
