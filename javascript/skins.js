import { spendMoney } from "./money.js";

///// Ship hull designs (drawn in local space, nose pointing toward +x) /////
function drawClassicShip(ctx) {
  ctx.shadowColor = "rgba(120, 200, 255, 1)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "rgb(225, 225, 230)";
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(-5, -15);
  ctx.lineTo(5, 0);
  ctx.lineTo(-5, 15);
  ctx.closePath();
  ctx.fill();
}

function drawCrimsonShip(ctx) {
  // Swept-back wings.
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgb(140, 22, 22)";
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(-16, -20);
  ctx.lineTo(-6, -5);
  ctx.closePath();
  ctx.moveTo(-2, 4);
  ctx.lineTo(-16, 20);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();

  // Main fuselage.
  ctx.shadowColor = "rgba(255, 70, 70, 0.9)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgb(214, 44, 44)";
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();

  // Cockpit.
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgb(255, 205, 205)";
  ctx.beginPath();
  ctx.arc(9, 0, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEmeraldShip(ctx) {
  // Sleek hexagonal body.
  ctx.shadowColor = "rgba(120, 230, 140, 0.9)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgb(54, 200, 110)";
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(-2, -6);
  ctx.lineTo(-11, -3);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-11, 3);
  ctx.lineTo(-2, 6);
  ctx.closePath();
  ctx.fill();

  // Stinger prongs.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgb(185, 255, 205)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(2, -5);
  ctx.lineTo(12, -16);
  ctx.moveTo(2, 5);
  ctx.lineTo(12, 16);
  ctx.stroke();

  // Cockpit.
  ctx.fillStyle = "rgb(225, 255, 235)";
  ctx.beginPath();
  ctx.arc(11, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoldShip(ctx) {
  // Wide phoenix wings.
  ctx.shadowColor = "rgba(255, 215, 80, 0.95)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgb(245, 200, 60)";
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(-12, -22);
  ctx.lineTo(-2, -6);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-2, 6);
  ctx.lineTo(-12, 22);
  ctx.closePath();
  ctx.fill();

  // Bright core.
  ctx.shadowColor = "rgba(255, 255, 210, 1)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgb(255, 255, 225)";
  ctx.beginPath();
  ctx.arc(6, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawVoidShip(ctx) {
  // Dark angular stealth hull with a glowing magenta edge.
  ctx.shadowColor = "rgba(190, 130, 255, 0.9)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgb(38, 28, 58)";
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(0, -12);
  ctx.lineTo(-12, -8);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 8);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgb(200, 130, 255)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Core.
  ctx.fillStyle = "rgb(232, 182, 255)";
  ctx.beginPath();
  ctx.arc(6, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawAzureShip(ctx) {
  // Forward-swept blue interceptor.
  ctx.shadowColor = "rgba(80, 160, 255, 0.9)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgb(60, 140, 235)";
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(-6, -9);
  ctx.lineTo(4, -18);
  ctx.lineTo(-4, -6);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-4, 6);
  ctx.lineTo(4, 18);
  ctx.lineTo(-6, 9);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgb(205, 230, 255)";
  ctx.beginPath();
  ctx.arc(8, 0, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawInfernoShip(ctx) {
  // Flame-tailed dark fighter.
  ctx.shadowColor = "rgba(255, 120, 30, 0.9)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgb(255, 140, 40)";
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.lineTo(-18, -12);
  ctx.lineTo(-8, -3);
  ctx.closePath();
  ctx.moveTo(-2, 6);
  ctx.lineTo(-18, 12);
  ctx.lineTo(-8, 3);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "rgba(255, 80, 30, 0.9)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgb(62, 32, 32)";
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(-6, -11);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-6, 11);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgb(255, 140, 50)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgb(255, 210, 150)";
  ctx.beginPath();
  ctx.arc(9, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpectreShip(ctx) {
  // Thin, translucent ghost ship.
  ctx.shadowColor = "rgba(230, 240, 255, 0.9)";
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "rgb(212, 222, 238)";
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgb(180, 200, 230)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(-12, -12);
  ctx.moveTo(-4, 3);
  ctx.lineTo(-12, 12);
  ctx.stroke();
}

///// Gun bolt designs (drawn in local space, travelling toward +x) /////
function drawStandardShot(ctx) {
  ctx.shadowColor = "rgba(120, 230, 255, 1)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgb(180, 240, 255)";
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlasmaShot(ctx) {
  ctx.shadowColor = "rgba(255, 120, 255, 1)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(255, 120, 255, 0.5)";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgb(255, 215, 255)";
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawAmberShot(ctx) {
  // Elongated energy bolt.
  ctx.shadowColor = "rgba(255, 170, 60, 1)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgb(255, 190, 80)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLimeShot(ctx) {
  // Comet with a trailing tail.
  ctx.shadowColor = "rgba(170, 255, 90, 1)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(170, 255, 90, 0.4)";
  ctx.beginPath();
  ctx.moveTo(0, -2.5);
  ctx.lineTo(-9, 0);
  ctx.lineTo(0, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgb(205, 255, 145)";
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawRubyShot(ctx) {
  // Diamond shard.
  ctx.shadowColor = "rgba(255, 70, 90, 1)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgb(255, 90, 110)";
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-5, 0);
  ctx.lineTo(0, -3.5);
  ctx.closePath();
  ctx.fill();
}

function drawFrostShot(ctx) {
  // Icy crystal shard.
  ctx.shadowColor = "rgba(150, 220, 255, 1)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgb(190, 235, 255)";
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-4, 0);
  ctx.lineTo(0, -2.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(225, 245, 255, 0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(7, 0);
  ctx.moveTo(2, -3);
  ctx.lineTo(2, 3);
  ctx.stroke();
}

function drawVenomShot(ctx) {
  // Twin green orbs.
  ctx.shadowColor = "rgba(120, 255, 120, 1)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgb(140, 255, 140)";
  ctx.beginPath();
  ctx.arc(2, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120, 255, 120, 0.7)";
  ctx.beginPath();
  ctx.arc(-4, 0, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSolarShot(ctx) {
  // Radiant star.
  ctx.shadowColor = "rgba(255, 225, 80, 1)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgb(255, 230, 120)";
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgb(255, 235, 150)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 5);
  ctx.stroke();
}

// `color` is the accent used for the shop tile border/label.
export const SHIP_SKINS = [
  { id: "classic", name: "Classic", price: 0, color: "rgb(225, 225, 230)", draw: drawClassicShip },
  { id: "crimson", name: "Crimson Raptor", price: 1500, color: "rgb(214, 44, 44)", draw: drawCrimsonShip },
  { id: "emerald", name: "Emerald Wasp", price: 2000, color: "rgb(54, 200, 110)", draw: drawEmeraldShip },
  { id: "azure", name: "Azure Falcon", price: 2500, color: "rgb(60, 140, 235)", draw: drawAzureShip },
  { id: "gold", name: "Gold Phoenix", price: 3500, color: "rgb(245, 200, 60)", draw: drawGoldShip },
  { id: "inferno", name: "Inferno", price: 4500, color: "rgb(255, 140, 50)", draw: drawInfernoShip },
  { id: "void", name: "Void Stealth", price: 6000, color: "rgb(190, 130, 255)", draw: drawVoidShip },
  { id: "spectre", name: "Spectre", price: 8000, color: "rgb(212, 222, 238)", draw: drawSpectreShip },
];

export const GUN_SKINS = [
  { id: "standard", name: "Standard", price: 0, color: "rgb(180, 240, 255)", draw: drawStandardShot },
  { id: "plasma", name: "Plasma", price: 1000, color: "rgb(255, 120, 255)", draw: drawPlasmaShot },
  { id: "amber", name: "Amber Bolt", price: 1500, color: "rgb(255, 190, 80)", draw: drawAmberShot },
  { id: "frost", name: "Frost Shard", price: 2000, color: "rgb(190, 235, 255)", draw: drawFrostShot },
  { id: "lime", name: "Lime Comet", price: 2500, color: "rgb(170, 255, 90)", draw: drawLimeShot },
  { id: "venom", name: "Venom", price: 3000, color: "rgb(140, 255, 140)", draw: drawVenomShot },
  { id: "ruby", name: "Ruby Shard", price: 4000, color: "rgb(255, 90, 110)", draw: drawRubyShot },
  { id: "solar", name: "Solar Flare", price: 5000, color: "rgb(255, 230, 120)", draw: drawSolarShot },
];

const CATALOG = { ship: SHIP_SKINS, gun: GUN_SKINS };

const OWNED_KEY = "ownedSkins";
const SELECTED_KEY = "selectedSkins";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Free skins are always owned.
const owned = load(OWNED_KEY, { ship: ["classic"], gun: ["standard"] });
if (!owned.ship.includes("classic")) owned.ship.push("classic");
if (!owned.gun.includes("standard")) owned.gun.push("standard");

const selected = load(SELECTED_KEY, { ship: "classic", gun: "standard" });

function save() {
  localStorage.setItem(OWNED_KEY, JSON.stringify(owned));
  localStorage.setItem(SELECTED_KEY, JSON.stringify(selected));
}

export function isOwned(category, id) {
  return owned[category].includes(id);
}

export function isSelected(category, id) {
  return selected[category] === id;
}

export function selectSkin(category, id) {
  if (isOwned(category, id)) {
    selected[category] = id;
    save();
  }
}

// Attempts to buy a skin: returns true on success, false if unaffordable.
// Buying also equips it.
export function buySkin(category, id) {
  if (isOwned(category, id)) return true;
  const skin = CATALOG[category].find((s) => s.id === id);
  if (!skin) return false;
  if (!spendMoney(skin.price)) return false;
  owned[category].push(id);
  selected[category] = id;
  save();
  return true;
}

export function getSelectedSkin(category) {
  const id = selected[category];
  return CATALOG[category].find((s) => s.id === id) || CATALOG[category][0];
}

export function getSelectedShipSkin() {
  return getSelectedSkin("ship");
}

export function getSelectedGunSkin() {
  return getSelectedSkin("gun");
}
