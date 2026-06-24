// ===========================================================================
// BATTLE ROYALE — orchestrator ("Survival Battle Ground")
// ---------------------------------------------------------------------------
// Owns the whole mode: the menu/lobby/drop/play/end state machine, all of its
// own input listeners, the host's authoritative loop, and the client's
// snapshot interpolation + local prediction. index.js only asks brActive() and
// calls drawBR() each frame — everything else lives here so single-player is
// untouched.
//
// HOST  : runs match.step() every frame, applies its own input locally, and
//         broadcasts a snapshot SNAPSHOT_HZ times/second.
// CLIENT: sends its input INPUT_HZ times/second, interpolates between the last
//         two snapshots for remote ships, and predicts its own ship locally.
// ===========================================================================
import { CANVAS } from "../core/canvas.js";
import { MOUSE } from "../core/constants.js";
import { drawButton, isInside } from "../ui/ui.js";
import { gamePrompt, dialogOpen } from "../ui/dialog.js";
import { getPlayerName } from "../cloud/leaderboard.js";
import { getSelectedSkin } from "../systems/skins.js";
import {
  SNAPSHOT_HZ,
  INPUT_HZ,
  DROP_DURATION_MS,
  MOVE_SPEED,
  DECEL,
  PLAYER_RADIUS,
  PLAYER_COLORS,
  WORLD_W,
  WORLD_H,
} from "./config.js";
import {
  net,
  createRoom,
  joinRoom,
  leaveRoom,
  onRoster,
  onMessage,
  send,
} from "./net.js";
import {
  match,
  startMatch,
  setDropDeadline,
  setInput,
  setDrop,
  step,
  snapshot,
} from "./match.js";
import { makeHazardShape } from "./hazards.js";
import {
  followCamera,
  snapCamera,
  screenToWorldX,
  screenToWorldY,
} from "./camera.js";
import {
  drawWorld,
  drawHud,
  drawDropOverview,
} from "./render.js";

const S = {
  open: false,
  screen: "menu", // menu | lobby | drop | play | end
  error: "",
  busy: false,
  roster: [],
  rosterMap: new Map(), // id -> { name, color } (clients learn this on 'start')
  // client snapshot buffer: timestamped snapshots, rendered slightly in the past
  // so network jitter is smoothed out (see clientView/RENDER_DELAY).
  snapBuf: [],
  snapCurr: null,
  // local input
  keys: { w: false, a: false, s: false, d: false },
  firing: false,
  // local prediction of own ship (clients)
  pred: null, // { x, y, vx, vy }
  // network timers
  lastInput: 0,
  lastSnap: 0,
  // drop reticle (world coords) + the spot the player has locked in
  reticle: { x: WORLD_W / 2, y: WORLD_H / 2 },
  chosenDrop: null,
  // client-side cache of each asteroid's rocky outline, keyed by hazard id
  hazardShapes: new Map(),
  copiedAt: 0, // when the room code was last copied (for the "COPIED!" hint)
};

// How far in the past (ms) clients render remote entities. Just enough to
// usually have two snapshots (20Hz => 50ms apart) bracketing the render time so
// interpolation stays smooth, while keeping the added visible delay small.
const RENDER_DELAY = 70;

export function brActive() {
  return S.open;
}

// ----- Entry / exit ---------------------------------------------------------
export function openBattleRoyale() {
  S.open = true;
  S.screen = "menu";
  S.error = "";
}

async function closeBattleRoyale() {
  S.open = false;
  S.screen = "menu";
  stopHostTicker();
  match.active = false;
  S.snapBuf = [];
  S.snapCurr = null;
  S.pred = null;
  await leaveRoom();
}

// ----- Networking handlers (wired once a room exists) -----------------------
function wireHandlers() {
  onRoster((list) => {
    S.roster = list;
  });
  // Seed immediately too, in case the roster was already populated before this.
  S.roster = net.roster;

  if (net.isHost) {
    // Host receives client inputs and drop selections.
    onMessage("input", (p) => {
      if (p && p.id) setInput(p.id, p);
    });
    onMessage("drop", (p) => {
      if (p && p.id) setDrop(p.id, p.x, p.y);
    });
  } else {
    // Client receives the match kickoff and the stream of snapshots.
    onMessage("start", (p) => {
      S.rosterMap = new Map();
      for (const m of p.roster) S.rosterMap.set(m.id, { name: m.name, color: m.color, ship: m.ship });
      S.screen = "drop";
      S.snapBuf = [];
      S.snapCurr = null;
      S.pred = null;
      S.chosenDrop = null;
      S.hazardShapes = new Map(); // fresh rocks for the new match
    });
    onMessage("snapshot", (p) => {
      S.snapCurr = p; // latest authoritative state (for prediction + HUD)
      S.snapBuf.push({ t: performance.now(), snap: p });
      if (S.snapBuf.length > 12) S.snapBuf.shift();
      // Keep the client's screen in sync with the authoritative phase. (Drop is
      // normally entered via the 'start' message, but fall into it from a
      // snapshot too in case that one-shot message was missed.)
      if (p.ph === "drop" && S.screen === "lobby") S.screen = "drop";
      if (p.ph === "play" && S.screen !== "play") S.screen = "play";
      if (p.ph === "end") S.screen = "end";
      reconcilePrediction(p);
    });
  }
}

// ----- Lobby actions --------------------------------------------------------
async function hostRoom() {
  if (S.busy) return;
  S.busy = true;
  S.error = "";
  try {
    const code = await createRoom(getPlayerName() || "Host", getSelectedSkin("ship").id);
    wireHandlers();
    S.screen = "lobby";
    S.code = code;
  } catch (e) {
    S.error = "Couldn't create a room (are you online?)";
  } finally {
    S.busy = false;
  }
}

async function joinRoomFlow() {
  if (S.busy) return;
  const code = await gamePrompt("Enter the 5-letter room code:", "");
  if (!code || !code.trim()) return;
  S.busy = true;
  S.error = "";
  try {
    await joinRoom(code.trim(), getPlayerName() || "Pilot", getSelectedSkin("ship").id);
    wireHandlers();
    S.screen = "lobby";
    S.code = net.code;
  } catch (e) {
    S.error = e.message || "Couldn't join that room";
  } finally {
    S.busy = false;
  }
}

// Host kicks off the match for everyone.
function startMatchAsHost() {
  if (!net.isHost) return;
  if (S.roster.length < 2) {
    S.error = "Need at least 2 players to start";
    return;
  }
  const now = performance.now();
  // Assign colours by roster index so host and clients agree.
  const roster = S.roster.slice(0, 4).map((m, i) => ({
    id: m.id,
    name: m.name,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    ship: m.ship,
  }));
  startMatch(net.roster, now);
  const deadline = now + DROP_DURATION_MS;
  setDropDeadline(deadline);
  send("start", { roster, end: deadline });
  startHostTicker();
  S.screen = "drop";
  S.chosenDrop = null;
}

// Copies the room code to the clipboard (best-effort) and flashes a confirmation.
function copyCode() {
  const code = net.code || S.code || "";
  if (code && navigator.clipboard) {
    navigator.clipboard.writeText(code).catch(() => {});
  }
  S.copiedAt = performance.now();
}

// ----- Input helpers --------------------------------------------------------
function selfWorldAim(selfX, selfY) {
  const wx = screenToWorldX(MOUSE.x);
  const wy = screenToWorldY(MOUSE.y);
  return Math.atan2(wy - selfY, wx - selfX);
}

function inputVector() {
  let dx = 0;
  let dy = 0;
  if (S.keys.w) dy -= 1;
  if (S.keys.s) dy += 1;
  if (S.keys.a) dx -= 1;
  if (S.keys.d) dx += 1;
  return { dx, dy };
}

// Client-side prediction: integrate our own ship every frame so it feels
// instant, then gently correct toward the authoritative position on snapshots.
function reconcilePrediction(snap) {
  const self = snap.pl.find((p) => p.id === net.selfId);
  if (!self) return;
  if (!S.pred) {
    S.pred = { x: self.x, y: self.y, vx: 0, vy: 0 };
  } else if (self.a) {
    // The server position is delayed by the round-trip, so don't yank the local
    // ship toward it every snapshot (that reads as lag/rubber-banding). Snap only
    // on a big desync (knockback / teleport); otherwise correct very gently.
    const ex = self.x - S.pred.x;
    const ey = self.y - S.pred.y;
    if (ex * ex + ey * ey > 150 * 150) {
      S.pred.x = self.x;
      S.pred.y = self.y;
    } else {
      S.pred.x += ex * 0.06;
      S.pred.y += ey * 0.06;
    }
  } else {
    // Dead: trust the server completely.
    S.pred.x = self.x;
    S.pred.y = self.y;
  }
}

function predictLocal() {
  if (!S.pred) return;
  const { dx, dy } = inputVector();
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    S.pred.vx = (dx / len) * MOVE_SPEED;
    S.pred.vy = (dy / len) * MOVE_SPEED;
  } else {
    S.pred.vx *= DECEL;
    S.pred.vy *= DECEL;
  }
  S.pred.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_W - PLAYER_RADIUS, S.pred.x + S.pred.vx));
  S.pred.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_H - PLAYER_RADIUS, S.pred.y + S.pred.vy));

  // Asteroids are solid: mirror the host's push-out locally so the predicted
  // ship can't glide through rocks (otherwise it would until the host corrects).
  const haz = S.snapCurr && S.snapCurr.h;
  if (haz) {
    for (const a of haz) {
      const dx = S.pred.x - a.x;
      const dy = S.pred.y - a.y;
      const minDist = a.r + PLAYER_RADIUS;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist * minDist) {
        const dist = Math.sqrt(d2) || 0.001;
        S.pred.x = a.x + (dx / dist) * minDist;
        S.pred.y = a.y + (dy / dist) * minDist;
        S.pred.vx = 0;
        S.pred.vy = 0;
      }
    }
  }
}

// ----- Host simulation ticker (background-tab proof) ------------------------
// The authoritative sim must keep running even when the host's tab is not
// focused. requestAnimationFrame is throttled to ~1fps in background tabs, so
// we drive step()+broadcast from a Web Worker timer instead (worker timers are
// not throttled), leaving rAF to handle rendering only.
let hostWorker = null;

function startHostTicker() {
  if (hostWorker) return;
  const src =
    "let h=null;onmessage=(e)=>{if(e.data==='start'){h=setInterval(()=>postMessage(0),1000/60);}else if(e.data==='stop'){clearInterval(h);h=null;}};";
  const url = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
  hostWorker = new Worker(url);
  hostWorker.onmessage = hostTick;
  hostWorker.postMessage("start");
}

function stopHostTicker() {
  if (!hostWorker) return;
  hostWorker.postMessage("stop");
  hostWorker.terminate();
  hostWorker = null;
}

function hostTick() {
  if (!net.isHost || !match.active) return;
  const now = performance.now();
  // Feed the host's own input into the sim.
  const self = match.players.get(net.selfId);
  if (self && self.alive && match.phase === "play") {
    const aim = selfWorldAim(self.x, self.y);
    const { dx, dy } = inputVector();
    setInput(net.selfId, { rot: aim, dx, dy, firing: S.firing });
  }
  step(now);
  if (now - S.lastSnap >= 1000 / SNAPSHOT_HZ) {
    send("snapshot", snapshot());
    S.lastSnap = now;
  }
}

// ----- View construction ----------------------------------------------------
// The host reads its live match directly; the client interpolates snapshots.
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function hostView() {
  const players = [];
  for (const p of match.players.values()) {
    players.push({
      id: p.id, x: p.x, y: p.y, rot: p.rot, hp: p.hp, sh: p.shieldHp,
      a: p.alive, w: p.weapon, am: p.ammo === Infinity ? -1 : p.ammo,
      k: p.kills, pl: p.placement, th: p.thrusting,
      name: p.name, color: p.color, ship: p.shipSkin, dx: p.dropX, dy: p.dropY,
    });
  }
  return {
    phase: match.phase,
    players,
    bullets: match.bullets.map((b) => ({ x: b.x, y: b.y, c: b.color })),
    hazards: match.hazards.map((a) => ({
      x: a.x, y: a.y, r: a.r, ro: a.rot,
      numPoints: a.numPoints, offsets: a.offsets, color: a.color,
    })),
    loot: match.loot.map((it) => ({ id: it.id, x: it.x, y: it.y, k: it.kind })),
    zone: match.zone
      ? { cx: match.zone.cx, cy: match.zone.cy, r: match.zone.r, dps: match.zone.dps }
      : null,
    alive: players.filter((p) => p.a).length,
    winner: match.winner,
    feed: match.feed.map((f) => f.text),
    end: match.phaseEndsAt,
  };
}

function clientView(now) {
  if (!S.snapBuf.length) return null;

  // Render slightly in the past and interpolate between the two buffered
  // snapshots that bracket that render time — this is what keeps remote motion
  // smooth under relay jitter (the old code interpolated against "now" and
  // froze whenever a snapshot arrived late).
  const renderT = now - RENDER_DELAY;
  let b0 = S.snapBuf[0];
  let b1 = S.snapBuf[0];
  for (let i = 0; i < S.snapBuf.length; i++) {
    if (S.snapBuf[i].t <= renderT) {
      b0 = S.snapBuf[i];
      b1 = S.snapBuf[i + 1] || S.snapBuf[i];
    } else break;
  }
  const span = b1.t - b0.t;
  const t = span > 0 ? Math.max(0, Math.min(1, (renderT - b0.t) / span)) : 0;
  const prev = b0.snap;
  const curr = b1.snap;
  const latest = S.snapCurr || curr; // freshest values for HUD / non-positional fields

  const players = curr.pl.map((cp) => {
    const meta = S.rosterMap.get(cp.id) || { name: "Pilot", color: "#cccccc", ship: "classic" };
    let x = cp.x;
    let y = cp.y;
    let rot = cp.rot;
    if (prev) {
      const pp = prev.pl.find((q) => q.id === cp.id);
      if (pp) {
        x = lerp(pp.x, cp.x, t);
        y = lerp(pp.y, cp.y, t);
        rot = lerpAngle(pp.rot, cp.rot, t);
      }
    }
    // Override our own ship with the locally predicted transform.
    if (cp.id === net.selfId && S.pred && cp.a) {
      x = S.pred.x;
      y = S.pred.y;
      rot = selfWorldAim(S.pred.x, S.pred.y);
    }
    return {
      id: cp.id, x, y, rot, hp: cp.hp, sh: cp.sh, a: !!cp.a, w: cp.w,
      am: cp.am, k: cp.k, pl: cp.pl, th: !!cp.th,
      name: meta.name, color: meta.color, ship: meta.ship, dx: cp.dx, dy: cp.dy,
    };
  });

  // Hazards keep a stable array order from the host, so interpolate by index
  // for smooth drift — but snap (don't interpolate) across a world-edge wrap,
  // which shows up as a large jump between snapshots.
  const hazards = curr.h.map((a) => {
    // The rocky outline isn't sent over the wire — generate it once per asteroid
    // id and cache it (any rock shape looks fine; it needn't match the host's).
    let shape = S.hazardShapes.get(a.id);
    if (!shape) {
      shape = makeHazardShape();
      S.hazardShapes.set(a.id, shape);
    }
    let x = a.x;
    let y = a.y;
    const pa = prev && prev.h.find((q) => q.id === a.id);
    if (pa && Math.abs(pa.x - a.x) < 300 && Math.abs(pa.y - a.y) < 300) {
      x = lerp(pa.x, a.x, t);
      y = lerp(pa.y, a.y, t);
    }
    return {
      x, y, r: a.r, ro: a.ro,
      numPoints: shape.numPoints, offsets: shape.offsets, color: shape.color,
    };
  });

  return {
    phase: curr.ph,
    players,
    hazards,
    bullets: latest.b.map((b) => ({ x: b.x, y: b.y, c: b.c })),
    loot: latest.l.map((it) => ({ id: it.id, x: it.x, y: it.y, k: it.k })),
    zone: latest.z,
    alive: latest.al,
    winner: latest.win,
    feed: latest.fd || [],
    end: latest.end,
  };
}

// ----- Per-frame entry point (called by index.js) ---------------------------
export function drawBR(now) {
  if (S.screen === "menu") return drawMenu();
  if (S.screen === "lobby") return drawLobby();

  // ----- Host: the sim + broadcast run on the worker ticker (hostTick); here
  // we only mirror the authoritative phase into the local screen state. -----
  if (net.isHost && match.active) {
    S.screen = match.phase === "end" ? "end" : match.phase === "play" ? "play" : "drop";
  } else {
    // ----- Client: send input + predict -----
    if (S.screen === "play") predictLocal();
    if (now - S.lastInput >= 1000 / INPUT_HZ) {
      sendClientInput();
      S.lastInput = now;
    }
  }

  const view = net.isHost ? hostView() : clientView(now);
  if (!view) {
    drawWaiting();
    return;
  }

  if (view.phase === "drop") return drawDrop(view, now);
  if (view.phase === "end") return drawEnd(view);

  // PLAY: follow the local ship and render the world + HUD.
  const me = view.players.find((p) => p.id === net.selfId);
  if (me) {
    if (me.a) followCamera(me.x, me.y);
    else snapCamera(me.x, me.y);
  }
  drawWorld(view, net.selfId, now);
  drawHud(view, net.selfId, now);
}

function sendClientInput() {
  if (!S.snapCurr) return;
  const me = S.snapCurr.pl.find((p) => p.id === net.selfId);
  if (!me) return;
  const sx = S.pred ? S.pred.x : me.x;
  const sy = S.pred ? S.pred.y : me.y;
  const aim = selfWorldAim(sx, sy);
  const { dx, dy } = inputVector();
  send("input", { id: net.selfId, rot: aim, dx, dy, firing: S.firing });
}

// ----- Drawing: menu / lobby / waiting / drop / end -------------------------
import { CONTEXT } from "../core/canvas.js";
import { OFF_WHITE } from "../core/constants.js";

function title(text, y, size = 64) {
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.font = `bold ${size}px monospace`;
  CONTEXT.textAlign = "center";
  CONTEXT.fillText(text, CANVAS.width / 2, y);
}

function clear() {
  CONTEXT.fillStyle = "rgb(16, 16, 16)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
}

function menuButtons() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;
  return [
    { id: "host", label: "HOST A LOBBY", x: cx - 150, y: cy - 30, w: 300, h: 60 },
    { id: "join", label: "JOIN WITH CODE", x: cx - 150, y: cy + 50, w: 300, h: 60 },
    { id: "br-back", label: "BACK", x: cx - 150, y: cy + 130, w: 300, h: 50 },
  ];
}

function drawMenu() {
  clear();
  title("SURVIVAL BATTLE GROUND", CANVAS.height / 2 - 120, 48);
  CONTEXT.font = "18px monospace";
  CONTEXT.fillStyle = "rgb(150, 150, 160)";
  CONTEXT.textAlign = "center";
  CONTEXT.fillText("2D battle royale — up to 4 players", CANVAS.width / 2, CANVAS.height / 2 - 80);

  for (const b of menuButtons()) {
    const color = b.id === "host" ? "120, 230, 160" : b.id === "join" ? "120, 200, 255" : "160, 160, 175";
    drawButton(b, { color });
  }
  if (S.error) {
    CONTEXT.fillStyle = "rgb(240, 90, 90)";
    CONTEXT.font = "16px monospace";
    CONTEXT.fillText(S.error, CANVAS.width / 2, CANVAS.height / 2 + 215);
  }
}

function lobbyButtons() {
  const cx = CANVAS.width / 2;
  const btns = [];
  // Small COPY button just to the right of the big room code.
  CONTEXT.save();
  CONTEXT.font = "bold 64px monospace";
  const codeW = CONTEXT.measureText(S.code || net.code || "-----").width;
  CONTEXT.restore();
  btns.push({
    id: "copy",
    label: performance.now() - S.copiedAt < 1500 ? "COPIED" : "COPY",
    x: cx + codeW / 2 + 16,
    y: 197,
    w: 84,
    h: 34,
  });
  if (net.isHost) {
    btns.push({ id: "start", label: "START MATCH", x: cx - 150, y: CANVAS.height - 170, w: 300, h: 60 });
  }
  btns.push({ id: "leave", label: "LEAVE LOBBY", x: cx - 150, y: CANVAS.height - 100, w: 300, h: 50 });
  return btns;
}

function drawLobby() {
  clear();
  title("LOBBY", 120, 52);

  // Room code.
  CONTEXT.textAlign = "center";
  CONTEXT.fillStyle = "rgb(150, 150, 160)";
  CONTEXT.font = "18px monospace";
  CONTEXT.fillText("ROOM CODE — share it with friends", CANVAS.width / 2, 170);
  CONTEXT.fillStyle = "rgb(120, 230, 160)";
  CONTEXT.font = "bold 64px monospace";
  CONTEXT.fillText(S.code || net.code || "-----", CANVAS.width / 2, 235);

  // Roster.
  CONTEXT.font = "22px monospace";
  let y = 310;
  for (let i = 0; i < 4; i++) {
    const m = S.roster[i];
    CONTEXT.fillStyle = m ? PLAYER_COLORS[i] : "rgba(255,255,255,0.15)";
    const label = m ? `${m.name}${m.isHost ? "  (host)" : ""}` : "— open slot —";
    CONTEXT.fillText(`${i + 1}.  ${label}`, CANVAS.width / 2, y);
    y += 40;
  }

  CONTEXT.fillStyle = "rgb(150, 150, 160)";
  CONTEXT.font = "16px monospace";
  if (net.isHost) {
    CONTEXT.fillText(
      S.roster.length < 2 ? "Waiting for at least one more player…" : "Ready when you are, host.",
      CANVAS.width / 2,
      y + 10
    );
  } else {
    CONTEXT.fillText("Waiting for the host to start…", CANVAS.width / 2, y + 10);
  }

  for (const b of lobbyButtons()) {
    const color =
      b.id === "start" ? "120, 230, 160" : b.id === "copy" ? "120, 200, 255" : "160, 160, 175";
    drawButton(b, { color, font: b.id === "copy" ? "14px monospace" : "22px monospace" });
  }
  if (S.error) {
    CONTEXT.fillStyle = "rgb(240, 90, 90)";
    CONTEXT.font = "16px monospace";
    CONTEXT.fillText(S.error, CANVAS.width / 2, CANVAS.height - 185);
  }
}

function drawWaiting() {
  clear();
  title("CONNECTING…", CANVAS.height / 2, 36);
}

function drawDrop(view, now) {
  // Reticle follows the mouse over the fitted map; chosenDrop is the locked spot.
  S.reticle = screenToDropWorld(MOUSE.x, MOUSE.y);
  drawDropOverview(view, net.selfId, S.reticle, S.chosenDrop, now);
}

// Maps a screen point to world coords using the same fit transform as
// render.drawDropOverview (kept in sync with it).
function screenToDropWorld(mx, my) {
  const margin = 60;
  const scale = Math.min(
    (CANVAS.width - margin * 2) / WORLD_W,
    (CANVAS.height - margin * 2) / WORLD_H
  );
  const ox = (CANVAS.width - WORLD_W * scale) / 2;
  const oy = (CANVAS.height - WORLD_H * scale) / 2;
  return {
    x: Math.max(0, Math.min(WORLD_W, (mx - ox) / scale)),
    y: Math.max(0, Math.min(WORLD_H, (my - oy) / scale)),
  };
}

function endButtons() {
  const cx = CANVAS.width / 2;
  return [{ id: "leave", label: "BACK TO LOBBY MENU", x: cx - 170, y: CANVAS.height - 110, w: 340, h: 56 }];
}

function drawEnd(view) {
  clear();
  const winner = view.players.find((p) => p.id === view.winner);
  const meWon = view.winner === net.selfId;
  title(meWon ? "WINNER WINNER!" : "MATCH OVER", 150, 56);

  CONTEXT.textAlign = "center";
  CONTEXT.font = "26px monospace";
  CONTEXT.fillStyle = "rgb(255, 215, 80)";
  CONTEXT.fillText(
    winner ? `🏆  ${winner.name}` : "No survivors",
    CANVAS.width / 2,
    210
  );

  // Placement table.
  const sorted = [...view.players].sort((a, b) => (a.pl || 99) - (b.pl || 99));
  CONTEXT.font = "20px monospace";
  let y = 280;
  for (const p of sorted) {
    CONTEXT.fillStyle = p.id === net.selfId ? "#ffffff" : p.color;
    CONTEXT.fillText(`#${p.pl || "-"}   ${p.name}   —   ${p.k} kills`, CANVAS.width / 2, y);
    y += 34;
  }

  for (const b of endButtons()) drawButton(b, { color: "120, 200, 255" });
}

// ----- Event listeners (self-contained) -------------------------------------
function handleClick(mx, my) {
  if (S.screen === "menu") {
    for (const b of menuButtons()) {
      if (!isInside(mx, my, b)) continue;
      if (b.id === "host") hostRoom();
      else if (b.id === "join") joinRoomFlow();
      else if (b.id === "br-back") closeBattleRoyale();
      return;
    }
    return;
  }
  if (S.screen === "lobby") {
    for (const b of lobbyButtons()) {
      if (!isInside(mx, my, b)) continue;
      if (b.id === "start") startMatchAsHost();
      else if (b.id === "leave") closeBattleRoyale();
      else if (b.id === "copy") copyCode();
      return;
    }
    return;
  }
  if (S.screen === "drop") {
    // Lock a landing spot (and remember it so we can mark it on the map).
    const w = screenToDropWorld(mx, my);
    S.chosenDrop = w;
    if (net.isHost) setDrop(net.selfId, w.x, w.y);
    else send("drop", { id: net.selfId, x: w.x, y: w.y });
    return;
  }
  if (S.screen === "end") {
    for (const b of endButtons()) {
      if (isInside(mx, my, b) && b.id === "leave") closeBattleRoyale();
    }
    return;
  }
}

window.addEventListener("mousedown", (e) => {
  if (!S.open || e.button !== 0 || dialogOpen()) return;
  // While Battle Royale owns the screen, don't let this click also reach the
  // single-player handlers in index.js (e.g. "Back" landing on START GAME).
  e.stopImmediatePropagation();
  const rect = CANVAS.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (S.screen === "play") {
    S.firing = true; // Hold-to-fire during the match.
    return;
  }
  handleClick(mx, my);
});

window.addEventListener("mouseup", (e) => {
  if (!S.open || e.button !== 0) return;
  S.firing = false;
});

window.addEventListener("keydown", (e) => {
  if (!S.open || dialogOpen()) return;
  if (e.code === "Escape") {
    if (S.screen === "menu") closeBattleRoyale();
    return;
  }
  switch (e.code) {
    case "KeyW": S.keys.w = true; break;
    case "KeyA": S.keys.a = true; break;
    case "KeyS": S.keys.s = true; break;
    case "KeyD": S.keys.d = true; break;
  }
});

window.addEventListener("keyup", (e) => {
  if (!S.open) return;
  switch (e.code) {
    case "KeyW": S.keys.w = false; break;
    case "KeyA": S.keys.a = false; break;
    case "KeyS": S.keys.s = false; break;
    case "KeyD": S.keys.d = false; break;
  }
});
