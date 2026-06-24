import { CANVAS, CONTEXT } from "../core/canvas.js";
import { OFF_WHITE, GREY, MOUSE } from "../core/constants.js";
import { SHIP_SKINS, GUN_SKINS, isOwned, isSelected } from "../systems/skins.js";
import { getMoney } from "../systems/money.js";
import { drawButton, isInside } from "../ui/ui.js";

// Each category is a single centred row; tile width shrinks to fit the screen.
const MARGIN = 30;
const GAP = 12;
const MAX_BW = 165;
const BH = 84;
const SHIP_TOP = 160;

function skinList(category) {
  return category === "ship" ? SHIP_SKINS : GUN_SKINS;
}

function gunTop() {
  return SHIP_TOP + BH + 60;
}

// Tile width that lets the longest row fit on screen (capped for big screens).
function tileWidth() {
  const n = Math.max(SHIP_SKINS.length, GUN_SKINS.length);
  const available = CANVAS.width - MARGIN * 2;
  return Math.min(MAX_BW, (available - (n - 1) * GAP) / n);
}

// Greedily wraps a name into at most two lines that fit `maxWidth`.
function wrapName(name, maxWidth) {
  const words = name.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (!current || CONTEXT.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function layoutCategory(skins, category, topY, bw) {
  const total = skins.length * bw + (skins.length - 1) * GAP;
  const startX = (CANVAS.width - total) / 2;
  return skins.map((s, i) => ({
    id: "skin",
    category,
    skinId: s.id,
    x: startX + i * (bw + GAP),
    y: topY,
    w: bw,
    h: BH,
  }));
}

export function getShopButtons() {
  const bw = tileWidth();
  const backY = gunTop() + BH + 30;
  return [
    ...layoutCategory(SHIP_SKINS, "ship", SHIP_TOP, bw),
    ...layoutCategory(GUN_SKINS, "gun", gunTop(), bw),
    { id: "back", label: "BACK", x: CANVAS.width / 2 - 110, y: backY, w: 220, h: 54 },
  ];
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

  const cx = btn.x + btn.w / 2;

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

  // Live preview (top, pointing up).
  CONTEXT.save();
  CONTEXT.translate(cx, btn.y + 26);
  CONTEXT.rotate(-Math.PI / 2);
  const previewScale = btn.category === "ship" ? 0.62 : 1.7;
  CONTEXT.scale(previewScale, previewScale);
  skin.draw(CONTEXT);
  CONTEXT.restore();

  // Name (centred, wraps to a second line if needed).
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "alphabetic";
  CONTEXT.fillStyle = "rgb(230, 230, 235)";
  CONTEXT.font = "12px monospace";
  const nameLines = wrapName(skin.name, btn.w - 12);
  let ny = btn.y + (nameLines.length > 1 ? 47 : 52);
  for (const line of nameLines) {
    CONTEXT.fillText(line, cx, ny);
    ny += 13;
  }

  // Status (price / OWNED / EQUIPPED).
  CONTEXT.font = "13px monospace";
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
  CONTEXT.fillText(status, cx, btn.y + 76);

  CONTEXT.restore();
}

export function drawShopScreen() {
  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  const cx = CANVAS.width / 2;

  // Title.
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "64px monospace";
  const title = "SHOP";
  CONTEXT.fillText(title, cx - CONTEXT.measureText(title).width / 2, 64);

  // Money balance.
  CONTEXT.font = "24px monospace";
  CONTEXT.fillStyle = "rgb(255, 215, 80)";
  const money = `MONEY: $${getMoney()}`;
  CONTEXT.fillText(money, cx - CONTEXT.measureText(money).width / 2, 104);

  // Section headers.
  CONTEXT.font = "20px monospace";
  CONTEXT.fillStyle = "rgb(180, 180, 190)";
  const shipHdr = "SPACESHIP SKINS";
  CONTEXT.fillText(shipHdr, cx - CONTEXT.measureText(shipHdr).width / 2, SHIP_TOP - 14);
  const gunHdr = "GUN SKINS";
  CONTEXT.fillText(gunHdr, cx - CONTEXT.measureText(gunHdr).width / 2, gunTop() - 14);

  for (const btn of getShopButtons()) {
    if (btn.id === "skin") {
      const skin = skinList(btn.category).find((s) => s.id === btn.skinId);
      drawSkinTile(btn, skin);
    } else {
      drawButton(btn, { color: "120, 200, 255" });
    }
  }
}
