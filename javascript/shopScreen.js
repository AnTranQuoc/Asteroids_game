import { CANVAS, CONTEXT } from "./canvasUtils.js";
import { OFF_WHITE, GREY, MOUSE } from "./gameConstants.js";
import { SHIP_SKINS, GUN_SKINS, isOwned, isSelected } from "./skins.js";
import { getMoney } from "./money.js";
import { drawButton, isInside } from "./ui.js";

function skinList(category) {
  return category === "ship" ? SHIP_SKINS : GUN_SKINS;
}

// Shared layout for drawing and click hit-testing.
export function getShopButtons() {
  const buttons = [];
  const cols = 5;
  const bw = 150;
  const bh = 80;
  const gap = 16;
  const totalW = bw * cols + gap * (cols - 1);
  const startX = (CANVAS.width - totalW) / 2;

  const shipY = CANVAS.height / 2 - 120;
  SHIP_SKINS.forEach((s, i) => {
    buttons.push({
      id: "skin",
      category: "ship",
      skinId: s.id,
      x: startX + i * (bw + gap),
      y: shipY,
      w: bw,
      h: bh,
    });
  });

  const gunY = CANVAS.height / 2 + 50;
  GUN_SKINS.forEach((s, i) => {
    buttons.push({
      id: "skin",
      category: "gun",
      skinId: s.id,
      x: startX + i * (bw + gap),
      y: gunY,
      w: bw,
      h: bh,
    });
  });

  buttons.push({
    id: "back",
    label: "BACK",
    x: CANVAS.width / 2 - 110,
    y: CANVAS.height / 2 + 175,
    w: 220,
    h: 54,
  });

  return buttons;
}

function drawSkinTile(btn, skin) {
  const owned = isOwned(btn.category, btn.skinId);
  const selected = isSelected(btn.category, btn.skinId);
  const affordable = getMoney() >= skin.price;
  const hover = isInside(MOUSE.x, MOUSE.y, btn);
  if (hover) CANVAS.style.cursor = "pointer";

  let accent;
  if (selected) accent = "120, 230, 160";
  else if (owned) accent = "120, 200, 255";
  else if (affordable) accent = "200, 200, 210";
  else accent = "200, 90, 90";

  CONTEXT.save();

  // Tile background + border.
  CONTEXT.fillStyle = hover ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.03)";
  if (hover || selected) {
    CONTEXT.shadowColor = `rgb(${accent})`;
    CONTEXT.shadowBlur = 14;
  }
  CONTEXT.fillRect(btn.x, btn.y, btn.w, btn.h);
  CONTEXT.shadowBlur = 0;
  CONTEXT.lineWidth = 2;
  CONTEXT.strokeStyle = `rgb(${accent})`;
  CONTEXT.strokeRect(btn.x, btn.y, btn.w, btn.h);

  // Live preview of the actual design, rotated to point upward.
  CONTEXT.save();
  CONTEXT.translate(btn.x + 30, btn.y + 42);
  CONTEXT.rotate(-Math.PI / 2);
  const previewScale = btn.category === "ship" ? 0.6 : 1.7;
  CONTEXT.scale(previewScale, previewScale);
  skin.draw(CONTEXT);
  CONTEXT.restore();

  // Name.
  CONTEXT.textAlign = "left";
  CONTEXT.textBaseline = "alphabetic";
  CONTEXT.fillStyle = "rgb(230, 230, 235)";
  CONTEXT.font = "13px monospace";
  CONTEXT.fillText(skin.name, btn.x + 54, btn.y + 28);

  // Status line.
  CONTEXT.font = "14px monospace";
  let status;
  if (selected) {
    status = "EQUIPPED";
    CONTEXT.fillStyle = "rgb(120, 230, 160)";
  } else if (owned) {
    status = "OWNED";
    CONTEXT.fillStyle = "rgb(150, 190, 230)";
  } else {
    status = `$${skin.price}`;
    CONTEXT.fillStyle = affordable ? "rgb(210, 210, 215)" : "rgb(225, 120, 120)";
  }
  CONTEXT.fillText(status, btn.x + 54, btn.y + 52);

  CONTEXT.restore();
}

export function drawShopScreen() {
  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  // Title.
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "80px monospace";
  const title = "SHOP";
  CONTEXT.fillText(title, (CANVAS.width - CONTEXT.measureText(title).width) / 2, CANVAS.height / 2 - 200);

  // Money balance.
  CONTEXT.font = "26px monospace";
  CONTEXT.fillStyle = "rgb(255, 215, 80)";
  const money = `MONEY: $${getMoney()}`;
  CONTEXT.fillText(money, (CANVAS.width - CONTEXT.measureText(money).width) / 2, CANVAS.height / 2 - 150);

  // Section labels (aligned to the left edge of the tile grid).
  const buttons = getShopButtons();
  const gridLeft = buttons[0].x;
  CONTEXT.font = "20px monospace";
  CONTEXT.fillStyle = "rgb(180, 180, 190)";
  CONTEXT.fillText("SPACESHIP SKINS", gridLeft, CANVAS.height / 2 - 132);
  CONTEXT.fillText("GUN SKINS", gridLeft, CANVAS.height / 2 + 38);

  for (const btn of buttons) {
    if (btn.id === "skin") {
      const skin = skinList(btn.category).find((s) => s.id === btn.skinId);
      drawSkinTile(btn, skin);
    } else {
      drawButton(btn, { color: "120, 200, 255" });
    }
  }
}
