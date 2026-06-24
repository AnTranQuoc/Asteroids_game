import { CANVAS, CONTEXT } from "../core/canvas.js";
import { OFF_WHITE, GREY } from "../core/constants.js";
import { DIFFICULTY_ORDER, DIFFICULTIES } from "../systems/difficulty.js";
import { fetchTopScoresByMode, isLeaderboardConfigured } from "../cloud/leaderboard.js";
import { drawButton } from "../ui/ui.js";

const cache = {}; // { EASY: [{name, score}], ... }
let loading = false;

const MODE_COLORS = {
  EASY: "120, 230, 160",
  NORMAL: "120, 200, 255",
  HARD: "255, 170, 60",
  CRAZY: "255, 90, 90",
};

// Kicks off a fresh fetch of every mode's top scores.
export function openLeaderboard() {
  if (!isLeaderboardConfigured()) return;
  loading = true;
  Promise.all(
    DIFFICULTY_ORDER.map(async (key) => {
      const label = DIFFICULTIES[key].label;
      cache[label] = await fetchTopScoresByMode(label, 8);
    })
  ).then(() => {
    loading = false;
  });
}

export function getLeaderboardButtons() {
  return [
    {
      id: "lb-back",
      label: "BACK",
      x: CANVAS.width / 2 - 110,
      y: CANVAS.height - 86,
      w: 220,
      h: 54,
    },
  ];
}

export function drawLeaderboardScreen() {
  CONTEXT.textAlign = "left";
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  const cx = CANVAS.width / 2;

  // Title.
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = "56px monospace";
  const title = "WORLD RECORDS";
  CONTEXT.fillText(title, cx - CONTEXT.measureText(title).width / 2, 84);

  if (!isLeaderboardConfigured()) {
    CONTEXT.textAlign = "center";
    CONTEXT.font = "18px monospace";
    CONTEXT.fillStyle = "rgb(225, 150, 150)";
    CONTEXT.fillText(
      "Couldn't reach the leaderboard service.",
      cx,
      CANVAS.height / 2 - 12
    );
    CONTEXT.fillStyle = "rgb(160, 160, 170)";
    CONTEXT.fillText(
      "Check your connection and try again.",
      cx,
      CANVAS.height / 2 + 16
    );
    for (const b of getLeaderboardButtons()) drawButton(b, { color: "120, 200, 255" });
    return;
  }

  // One column per difficulty.
  const cols = DIFFICULTY_ORDER.length;
  const colW = Math.min(280, (CANVAS.width - 80) / cols);
  const startX = cx - (colW * cols) / 2;
  const topY = 150;

  DIFFICULTY_ORDER.forEach((key, i) => {
    const label = DIFFICULTIES[key].label;
    const x = startX + i * colW;
    const colCx = x + colW / 2;

    // Column header.
    CONTEXT.textAlign = "center";
    CONTEXT.font = "bold 22px monospace";
    CONTEXT.fillStyle = `rgb(${MODE_COLORS[label] || "200, 200, 210"})`;
    CONTEXT.fillText(label, colCx, topY);

    const list = cache[label] || [];
    CONTEXT.font = "16px monospace";

    if (loading) {
      CONTEXT.fillStyle = "rgb(150, 150, 160)";
      CONTEXT.fillText("loading...", colCx, topY + 42);
      return;
    }
    if (list.length === 0) {
      CONTEXT.fillStyle = "rgb(120, 120, 135)";
      CONTEXT.fillText("no records yet", colCx, topY + 42);
      return;
    }

    let ey = topY + 40;
    list.forEach((row, r) => {
      const name = (row.name || "???").slice(0, 12);
      CONTEXT.fillStyle = r === 0 ? "rgb(255, 215, 80)" : "rgb(210, 210, 220)";
      CONTEXT.textAlign = "left";
      CONTEXT.fillText(`${r + 1}. ${name}`, x + 18, ey);
      CONTEXT.textAlign = "right";
      CONTEXT.fillText(`${row.score}`, x + colW - 18, ey);
      ey += 28;
    });
  });

  for (const b of getLeaderboardButtons()) drawButton(b, { color: "120, 200, 255" });
}
