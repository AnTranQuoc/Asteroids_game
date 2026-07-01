# Roguelike Stage + Camera + Level Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Roguelike mode into a Level 1 stage — a bounded 3×3 arena with a follow-camera, enemy spawning that ramps over ~60s, then a boss whose defeat wins the level — reached through a new level-select screen.

**Architecture:** All changes stay inside `src/roguelike/` (plus reading shared modules). The camera is a single `CONTEXT.translate(-camX,-camY)` applied around world-space rendering in `rl.js`; HUD draws after `restore()` in screen space. The single-player loop in `index.js` is untouched. Asteroid wall-bounce and world bounds are handled by rl-local code because the shared `Asteroid.updateAsteroid()` wraps at canvas edges and must not change.

**Tech Stack:** Vanilla ES modules, hand-rolled Canvas 2D. No build, no bundler, no test framework.

## Global Constraints

- **No new dependencies, no build/lint/test tooling.** Everything runs by opening the page over HTTP (`npx live-server`).
- **Verification is manual in the browser** — there is no test runner. Each task ends with explicit browser steps to perform and what to observe.
- **Do not modify the single-player loop in `index.js`** or shared entity classes in `src/entities/entities.js` / `src/systems/controls.js`. Roguelike owns its own behavior in `src/roguelike/`.
- **Mode convention:** Roguelike exports `rlActive()` + `drawRL(now)`; all rl input listeners live in `rl.js`.
- Commit message style: present-tense summary prefixed `Roguelike:` to match existing history (e.g. `Roguelike: bounded arena + follow camera`).

---

## File structure

| File | Responsibility | Change type |
|------|----------------|-------------|
| `src/roguelike/rl.js` | Frame loop, camera, world bounds, spawn ramp, boss trigger, screen wiring | Modify (largest) |
| `src/roguelike/rlState.js` | Run state fields incl. stage timer + pause bookkeeping | Modify |
| `src/roguelike/rlBoss.js` | Boss spawn coords + world-bounds bullet cull | Modify |
| `src/roguelike/rlRender.js` | Level-select screen, win screen, boss countdown HUD | Modify |

No new files.

---

## Task 1: Bounded world + follow camera + player clamp + aim correction

Establishes the world transform. After this task you can fly around a 3×3 empty arena; the camera follows and stops at walls; the ship cannot leave the arena; aim tracks the cursor even when the camera is clamped at an edge. (Asteroids still misbehave — fixed in Task 2.)

**Files:**
- Modify: `src/roguelike/rl.js`

**Interfaces:**
- Produces (module-level in `rl.js`, used by later tasks): `WORLD_W`, `WORLD_H` (numbers), `camX`, `camY` (numbers, current camera top-left), `_updateCamera()` (recomputes `camX`/`camY` from `player.coordinates`).
- Consumes: `player` from `entities.js`, `MOUSE` from `constants.js` (both already imported), `CANVAS`/`CONTEXT`.

- [ ] **Step 1: Add world + camera module state**

In `rl.js`, just after the existing `const RL_MOVE_SPEED_FACTOR = 0.85;` line (~line 41), add:

```js
const WORLD_SCREENS = 3;           // arena is 3×3 viewports
let WORLD_W = 0;                   // set in startRun (depends on canvas size)
let WORLD_H = 0;
let camX = 0;                      // camera top-left in world coords
let camY = 0;

function _updateCamera() {
  camX = Math.max(0, Math.min(WORLD_W - CANVAS.width,  player.coordinates.x - CANVAS.width / 2));
  camY = Math.max(0, Math.min(WORLD_H - CANVAS.height, player.coordinates.y - CANVAS.height / 2));
}

function _clampPlayerToWorld() {
  player.coordinates.x = Math.max(16, Math.min(WORLD_W - 16, player.coordinates.x));
  player.coordinates.y = Math.max(16, Math.min(WORLD_H - 16, player.coordinates.y));
}
```

- [ ] **Step 2: Size the world and center the player in `startRun`**

In `startRun(now)` (~line 68), replace the two player-centering lines:

```js
  player.coordinates.x = CANVAS.width / 2;
  player.coordinates.y = CANVAS.height / 2;
```

with:

```js
  WORLD_W = CANVAS.width * WORLD_SCREENS;
  WORLD_H = CANVAS.height * WORLD_SCREENS;
  player.coordinates.x = WORLD_W / 2;
  player.coordinates.y = WORLD_H / 2;
```

- [ ] **Step 3: Restructure `_playingFrame` to render through the camera**

Replace the whole body of `_playingFrame(now, isBoss)` (~lines 630–709) with the version below. Changes from the original: camera is computed each frame; world-space mouse aim overrides `controlScheme`'s screen-space rotation; the entire world update/draw section is wrapped in `save()/translate(-camX,-camY)/restore()`; player is clamped to the world instead of `enableCanvasWrap()`; the ghost bubble (a world-space effect) now draws inside the transform; HUD draws after `restore()`.

```js
function _playingFrame(now, isBoss) {
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStarfield();

  controlScheme();
  _updateCamera();
  // controlScheme aimed at screen-space MOUSE; re-aim at world-space cursor.
  player.rotation = Math.atan2(
    (MOUSE.y + camY) - player.coordinates.y,
    (MOUSE.x + camX) - player.coordinates.x
  );

  if (player.thrusting) {
    let m = RL_MOVE_SPEED_FACTOR;
    if (getStackCount("thruster") > 0) m *= moveSpeedMult();
    player.velocity.x *= m;
    player.velocity.y *= m;
  } else {
    player.velocity.x = 0;
    player.velocity.y = 0;
  }

  rlState.speedRamp = Math.min(RL_SPEED_RAMP_MAX, 1 + ((now - rlState.runStartTime) / 1000) * RL_SPEED_RAMP_RATE);

  CONTEXT.save();
  CONTEXT.translate(-camX, -camY);

  player.updatePlayer();
  _clampPlayerToWorld();

  if (!isBoss && now - rlState.lastSpawnTime >= RL_SPAWN_INTERVAL) {
    _spawnRLAsteroid();
    rlState.lastSpawnTime = now;
  }

  for (let i = ASTEROIDS.length - 1; i >= 0; i--) {
    ASTEROIDS[i].updateAsteroid();
  }

  _rlDetectPlayerHit(now);
  if (rlState.screen === "end") { CONTEXT.restore(); return; }

  if (isBoss && boss) {
    boss.step(now, player.coordinates.x, player.coordinates.y);
    boss.draw();
    _rlDetectBossHits(now);
    if (rlState.screen === "end") { CONTEXT.restore(); return; }
  }

  _rlUpdateProjectiles();
  _rlDetectProjectileHits(now);

  const fireInterval = fireIntervalMs(220);
  if (now - rlState.lastShotTime >= fireInterval) {
    _rlFireProjectile();
    rlState.lastShotTime = now;
  }

  _rlUpdatePowerUps(now);
  _updateExplosions();
  _drawOrbitRing(now);
  _updateXPOrbs(now);

  if (now < rlState.ghostUntil) {
    CONTEXT.save();
    CONTEXT.globalAlpha = 0.35 + 0.2 * Math.sin(now / 80);
    CONTEXT.translate(player.coordinates.x, player.coordinates.y);
    CONTEXT.beginPath();
    CONTEXT.arc(0, 0, 30, 0, Math.PI * 2);
    CONTEXT.fillStyle = "rgba(100,180,255,0.3)";
    CONTEXT.strokeStyle = "rgba(100,180,255,0.6)";
    CONTEXT.lineWidth = 1.5;
    CONTEXT.fill();
    CONTEXT.stroke();
    CONTEXT.restore();
  }

  CONTEXT.restore();

  if (rlState.shieldRechargeAt > 0 && now >= rlState.shieldRechargeAt) {
    player.shield = true;
    rlState.shieldRechargeAt = 0;
  }

  drawXPStrip(isBoss);
  drawLevelBadge();
  drawRLScore();
  if (isBoss && boss) drawBossHPBar(boss);
  if (getStackCount("ghostShip") > 0) _drawGhostIndicator(now);
}
```

> Note: the `enableCanvasWrap()` call is intentionally dropped from this function. Leave the `import { enableCanvasWrap }` line in place for now; Task 2 removes it once nothing else uses it. (If your editor flags the unused import, ignore it until Task 2.)

- [ ] **Step 4: Render the upgrade-pick frame through the camera too**

The frozen background in `_drawUpgradePick()` (~lines 99–110) draws world entities; they must use the same transform or they'll render off-screen. Replace its body with:

```js
function _drawUpgradePick() {
  CONTEXT.fillStyle = GREY;
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStarfield();

  CONTEXT.save();
  CONTEXT.translate(-camX, -camY);
  for (const a of ASTEROIDS) a.drawAsteroid();
  player.drawPlayer();
  for (const p of PROJECTILES) p.drawProjectile();
  CONTEXT.restore();

  drawXPStrip(false);
  drawLevelBadge();
  drawRLScore();
  drawUpgradeOverlay(upgradeCards, hoveredCardIndex);
}
```

- [ ] **Step 5: Browser verification**

Run: `npx live-server` (from repo root), open the page, click **Roguelike → START RUN**.
Observe and confirm ALL of:
1. The ship starts mid-arena; using WASD you can fly far in every direction well past one screen, and the camera scrolls to follow.
2. At each edge the ship stops (cannot leave) and the camera stops scrolling (no black void beyond the wall — the view clamps).
3. Moving the mouse, the ship's nose points at the cursor correctly both when centered and when the camera is pinned at a wall (stand in a corner, sweep the mouse — aim must still track the cursor, not be offset).
4. Auto-fire bullets leave the nose in the aimed direction.

(Asteroids will cluster oddly / wrap at one-screen distances — expected, fixed next task.)

- [ ] **Step 6: Commit**

```bash
git add src/roguelike/rl.js
git commit -m "Roguelike: bounded 3x3 arena + follow camera + world-space aim"
```

---

## Task 2: Asteroids, projectiles, orbs bounce/clamp at world walls

Replaces canvas-relative wrapping with world-relative behavior so the arena actually contains the action. Asteroids bounce off walls; projectiles die at world edges (ricochet bounces off them); XP orbs settle inside the world.

**Files:**
- Modify: `src/roguelike/rl.js`

**Interfaces:**
- Consumes: `WORLD_W`, `WORLD_H` from Task 1.
- Produces: `_rlUpdateAsteroid(a)` — draws one asteroid, advances it, bounces it off world walls (replaces the per-frame `a.updateAsteroid()` call for rl).

- [ ] **Step 1: Add an rl-local asteroid step that bounces off world walls**

The shared `Asteroid.updateAsteroid()` wraps at canvas edges (`entities.js:203`), which would trap asteroids in a one-screen region. Add this helper near the other asteroid functions in `rl.js` (e.g. after `_spawnRLAsteroid`):

```js
// rl uses its own asteroid step: shared updateAsteroid() wraps at canvas edges,
// but the bounded arena needs reflection off the world walls instead.
function _rlUpdateAsteroid(a) {
  a.drawAsteroid();
  a.coordinates.x += a.velocity.x;
  a.coordinates.y += a.velocity.y;
  a.rotation += a.rotationSpeed;

  const r = a.radius;
  if (a.coordinates.x < r)            { a.coordinates.x = r;            a.velocity.x = Math.abs(a.velocity.x); }
  else if (a.coordinates.x > WORLD_W - r) { a.coordinates.x = WORLD_W - r; a.velocity.x = -Math.abs(a.velocity.x); }
  if (a.coordinates.y < r)            { a.coordinates.y = r;            a.velocity.y = Math.abs(a.velocity.y); }
  else if (a.coordinates.y > WORLD_H - r) { a.coordinates.y = WORLD_H - r; a.velocity.y = -Math.abs(a.velocity.y); }
}
```

- [ ] **Step 2: Use it in the playing frame**

In `_playingFrame` (the loop added in Task 1 Step 3), replace:

```js
  for (let i = ASTEROIDS.length - 1; i >= 0; i--) {
    ASTEROIDS[i].updateAsteroid();
  }
```

with:

```js
  for (let i = ASTEROIDS.length - 1; i >= 0; i--) {
    _rlUpdateAsteroid(ASTEROIDS[i]);
  }
```

- [ ] **Step 3: Spawn asteroids inside the world, just off-camera**

Replace `_spawnRLAsteroid()` (~lines 183–193) with a world-aware version that spawns rocks just outside the current view but inside the arena, aimed roughly across the screen:

```js
function _spawnRLAsteroid() {
  if (ASTEROIDS.length >= RL_MAX_ASTEROIDS) return;
  const radius = ASTEROID_MIN_RADIUS + Math.random() * (ASTEROID_MAX_RADIUS - ASTEROID_MIN_RADIUS);

  // Pick a point just outside one of the four view edges, clamped into the world.
  const margin = radius + 20;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0)      { x = camX - margin;                 y = camY + Math.random() * CANVAS.height; }
  else if (side === 1) { x = camX + CANVAS.width + margin;  y = camY + Math.random() * CANVAS.height; }
  else if (side === 2) { y = camY - margin;                 x = camX + Math.random() * CANVAS.width; }
  else                 { y = camY + CANVAS.height + margin; x = camX + Math.random() * CANVAS.width; }
  x = Math.max(radius, Math.min(WORLD_W - radius, x));
  y = Math.max(radius, Math.min(WORLD_H - radius, y));

  // Aim toward the player so spawns converge on the action.
  const angle = Math.atan2(player.coordinates.y - y, player.coordinates.x - x) + (Math.random() - 0.5) * 0.8;
  const sizeFactor = Math.min(2.0, Math.max(0.7, 40 / radius));
  const speed = Math.min(ASTEROID_MAX_SPEED, (1.8 + Math.random() * 1.6) * sizeFactor * rlState.speedRamp);
  ASTEROIDS.push(new Asteroid({ coordinates: { x, y }, velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, radius }));
}
```

> This drops the use of `getAsteroidSpawnData` in rl. Leave its import for now (Step 6 cleans it up).

- [ ] **Step 4: Projectiles use world bounds**

In `_rlUpdateProjectiles()` (~lines 240–258), the bounce/wrap block compares against `CANVAS.width`/`CANVAS.height`. Replace those four comparisons so they use the world:

Replace the ricochet block:
```js
      if (p.coordinates.x < 0 || p.coordinates.x > CANVAS.width) {
        p.velocity.x *= -1;
        p.coordinates.x = Math.max(0, Math.min(CANVAS.width, p.coordinates.x));
        bounced = true;
      }
      if (p.coordinates.y < 0 || p.coordinates.y > CANVAS.height) {
        p.velocity.y *= -1;
        p.coordinates.y = Math.max(0, Math.min(CANVAS.height, p.coordinates.y));
        bounced = true;
      }
```
with:
```js
      if (p.coordinates.x < 0 || p.coordinates.x > WORLD_W) {
        p.velocity.x *= -1;
        p.coordinates.x = Math.max(0, Math.min(WORLD_W, p.coordinates.x));
        bounced = true;
      }
      if (p.coordinates.y < 0 || p.coordinates.y > WORLD_H) {
        p.velocity.y *= -1;
        p.coordinates.y = Math.max(0, Math.min(WORLD_H, p.coordinates.y));
        bounced = true;
      }
```

And replace the non-ricochet wrap block:
```js
      if (p.coordinates.x < 0) p.coordinates.x = CANVAS.width;
      else if (p.coordinates.x > CANVAS.width) p.coordinates.x = 0;
      if (p.coordinates.y < 0) p.coordinates.y = CANVAS.height;
      else if (p.coordinates.y > CANVAS.height) p.coordinates.y = 0;
```
with (projectiles die at the wall instead of wrapping):
```js
      if (p.coordinates.x < 0 || p.coordinates.x > WORLD_W ||
          p.coordinates.y < 0 || p.coordinates.y > WORLD_H) {
        PROJECTILES.splice(i, 1);
        continue;
      }
```

- [ ] **Step 5: XP orbs clamp instead of wrap**

In `_updateXPOrbs()` (~lines 156–160), replace the canvas-wrap block:
```js
    if (orb.x < 0) orb.x += CANVAS.width;
    else if (orb.x > CANVAS.width) orb.x -= CANVAS.width;
    if (orb.y < 0) orb.y += CANVAS.height;
    else if (orb.y > CANVAS.height) orb.y -= CANVAS.height;
```
with:
```js
    orb.x = Math.max(0, Math.min(WORLD_W, orb.x));
    orb.y = Math.max(0, Math.min(WORLD_H, orb.y));
```

- [ ] **Step 6: Remove now-unused imports created by these changes**

`enableCanvasWrap` is no longer called (Task 1 dropped it) and `getAsteroidSpawnData` is no longer called (Step 3). Remove both:
- Delete the line `import { enableCanvasWrap } from "../core/canvasWrap.js";` (~line 14).
- In the import `import { splitAsteroid, getAsteroidSpawnData } from "../entities/asteroids.js";` (~line 5), drop `getAsteroidSpawnData` → `import { splitAsteroid } from "../entities/asteroids.js";`

(Do not remove anything else — these two are the only orphans created by this task.)

- [ ] **Step 7: Browser verification**

Run `npx live-server`, start a run. Confirm:
1. Asteroids appear from off the edges of the view and travel across the arena.
2. Asteroids bounce off the four world walls (fly to a corner and watch them ricochet) — none vanish by wrapping mid-arena.
3. Shooting asteroids splits/destroys them and XP orbs drop and can be collected; orbs near a wall stay inside it.
4. With a ricochet upgrade, bullets bounce off walls; without it, bullets disappear at the wall.

- [ ] **Step 8: Commit**

```bash
git add src/roguelike/rl.js
git commit -m "Roguelike: asteroids bounce off world walls, world-relative spawns and projectiles"
```

---

## Task 3: Stage timer, smooth spawn ramp, countdown HUD, freeze on upgrade pick

Adds the ~60s escalation: spawn rate and asteroid cap ramp with elapsed time, a countdown shows time-to-boss, and the timer freezes while picking an upgrade.

**Files:**
- Modify: `src/roguelike/rlState.js`
- Modify: `src/roguelike/rl.js`
- Modify: `src/roguelike/rlRender.js`

**Interfaces:**
- Produces (in `rlState`): `stageStartTime` (number, ms), `bossSpawned` (bool), `pauseStartedAt` (number, ms; 0 when not paused).
- Produces (in `rlRender.js`): `drawBossCountdown(msRemaining)` — draws "BOSS IN m:ss" centered under the score.
- Consumes: `STAGE_DURATION_MS` (module const in `rl.js`).

- [ ] **Step 1: Add timer fields to rlState**

In `rlState.js`, add three fields to the `rlState` object (after `speedRamp: 1.0,` ~line 16):

```js
  stageStartTime: 0,       // ms; drives the stage timer + spawn ramp (freezes during upgrade pick)
  bossSpawned: false,      // true once the timed boss has appeared
  pauseStartedAt: 0,       // ms; set while upgrade-pick is open, 0 otherwise
```

And reset them in `resetRlState(now)` (after `rlState.speedRamp = 1.0;` ~line 39):

```js
  rlState.stageStartTime = now;
  rlState.bossSpawned = false;
  rlState.pauseStartedAt = 0;
```

- [ ] **Step 2: Add the stage-duration constant and switch ramps to stage time**

In `rl.js`, near the other rl constants (~line 41), add:

```js
const STAGE_DURATION_MS = 60000;       // time to boss
const RL_SPAWN_INTERVAL_START = 2000;  // ms between spawns at t=0 (sparse)
const RL_SPAWN_INTERVAL_END = 450;     // ms between spawns at t=1 (swarm)
const RL_MAX_ASTEROIDS_START = 6;
const RL_MAX_ASTEROIDS_END = 30;
```

Add a small lerp helper near the top of the file's function section:

```js
function _lerp(a, b, t) { return a + (b - a) * t; }
```

- [ ] **Step 3: Drive spawning + speed ramp from stage time**

In `_playingFrame`, compute the normalized stage progress once and use it for both the speed ramp and spawn cadence. Replace the `rlState.speedRamp = …` line (added in Task 1 Step 3) with:

```js
  const elapsed = now - rlState.stageStartTime;
  const t = Math.max(0, Math.min(1, elapsed / STAGE_DURATION_MS));
  rlState.speedRamp = Math.min(RL_SPEED_RAMP_MAX, 1 + (elapsed / 1000) * RL_SPEED_RAMP_RATE);
```

Then replace the spawn block:
```js
  if (!isBoss && now - rlState.lastSpawnTime >= RL_SPAWN_INTERVAL) {
    _spawnRLAsteroid();
    rlState.lastSpawnTime = now;
  }
```
with the ramped version (note: the cap is now dynamic, so it is enforced here rather than relying on the constant inside `_spawnRLAsteroid`):
```js
  const spawnInterval = _lerp(RL_SPAWN_INTERVAL_START, RL_SPAWN_INTERVAL_END, t);
  const maxAsteroids = Math.round(_lerp(RL_MAX_ASTEROIDS_START, RL_MAX_ASTEROIDS_END, t));
  if (now - rlState.lastSpawnTime >= spawnInterval && ASTEROIDS.length < maxAsteroids) {
    _spawnRLAsteroid();
    rlState.lastSpawnTime = now;
  }
```

> Keep the `!isBoss` gate off here on purpose — per the spec, rocks keep spawning during the boss fight. (Boss handling comes in Task 4; until then `isBoss` is never true so behavior is unchanged.)

- [ ] **Step 4: Stop `_spawnRLAsteroid` from also capping at the old constant**

In `_spawnRLAsteroid()` (modified in Task 2 Step 3), remove the now-redundant early cap line so the dynamic cap in Step 3 is the only one:

Delete:
```js
  if (ASTEROIDS.length >= RL_MAX_ASTEROIDS) return;
```
The old constants `RL_MAX_ASTEROIDS` and `RL_SPAWN_INTERVAL` are now unused — delete their `const` declarations (~lines 37–38).

- [ ] **Step 5: Freeze the timer during upgrade pick**

When the upgrade screen opens, record the pause start; when an upgrade is chosen, shift `stageStartTime` forward by the paused duration so `elapsed` doesn't jump.

In `_openUpgradePick()` (~line 571), add at the top:
```js
  rlState.pauseStartedAt = performance.now();
```

In `_pickUpgrade(upgradeId)` (~line 584), before changing the screen, add:
```js
  if (rlState.pauseStartedAt) {
    rlState.stageStartTime += performance.now() - rlState.pauseStartedAt;
    rlState.pauseStartedAt = 0;
  }
```

- [ ] **Step 6: Add the countdown HUD renderer**

In `rlRender.js`, add a new exported function (after `drawRLScore`, ~line 50):

```js
// ── Boss countdown (top centre, below score) ─────────────────────────────────
export function drawBossCountdown(msRemaining) {
  const secs = Math.max(0, Math.ceil(msRemaining / 1000));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");
  CONTEXT.save();
  CONTEXT.font = "13px monospace";
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "top";
  CONTEXT.fillStyle = secs <= 10 ? "#ff8050" : "rgba(255,255,255,0.7)";
  CONTEXT.fillText(`BOSS IN ${mm}:${ss}`, CANVAS.width / 2, 32);
  CONTEXT.restore();
}
```

- [ ] **Step 7: Show the countdown while not in the boss phase**

In `rl.js`, import the new renderer — add `drawBossCountdown` to the existing import block from `./rlRender.js` (~lines 20–25).

In `_playingFrame`, in the HUD section (after `drawRLScore();`), add:
```js
  if (!rlState.bossSpawned) drawBossCountdown((rlState.stageStartTime + STAGE_DURATION_MS) - now);
```

- [ ] **Step 8: Browser verification**

Run `npx live-server`, start a run. Confirm:
1. The run begins with only a few asteroids; over ~60s the count and spawn rate visibly climb to a swarm.
2. "BOSS IN 0:59" counts down at top-center and turns orange in the last 10s.
3. Level up (kill rocks until the upgrade screen appears); while the cards are showing, the countdown is frozen — when you pick a card, the timer resumes from where it paused (it did not lose the paused seconds).

- [ ] **Step 9: Commit**

```bash
git add src/roguelike/rlState.js src/roguelike/rl.js src/roguelike/rlRender.js
git commit -m "Roguelike: time-paced spawn ramp + boss countdown, freeze timer on upgrade pick"
```

---

## Task 4: Boss on the timer, keep rocks, win screen

Spawns the boss at ~60s into the live arena (rocks stay and keep spawning), removes the old level-gated boss, and adds the victory screen on boss defeat.

**Files:**
- Modify: `src/roguelike/rlBoss.js`
- Modify: `src/roguelike/rl.js`
- Modify: `src/roguelike/rlRender.js`

**Interfaces:**
- Consumes: `WORLD_W`, `WORLD_H`, `STAGE_DURATION_MS`, `rlState.bossSpawned`.
- Produces: `Boss` constructor signature becomes `new Boss(bossIndex, spawnX, spawnY, worldW, worldH)`; `drawRLWin(bestScore, now)` + `getRLWinButtons()` in `rlRender.js`; `rlState.screen === "win"` handled in `drawRL` and `mousedown`.

- [ ] **Step 1: Make the boss world-aware**

In `rlBoss.js`, change the constructor signature and the hard-coded screen positions. Replace the constructor header + position lines (~lines 9–16):

```js
  constructor(bossIndex) {
    this.index = bossIndex;
    this.hp = 120 + bossIndex * 80;
    this.maxHp = this.hp;
    this.x = CANVAS.width / 2;
    this.y = -90;
    this.targetY = 130;
```
with:
```js
  constructor(bossIndex, spawnX, spawnY, worldW, worldH) {
    this.index = bossIndex;
    this.hp = 120 + bossIndex * 80;
    this.maxHp = this.hp;
    this.worldW = worldW;
    this.worldH = worldH;
    this.x = spawnX;
    this.y = spawnY - 220;        // slide in from above the spawn point
    this.targetY = spawnY;
```

In `step()`, the bullet off-screen cull (~line 97) uses canvas bounds. Replace:
```js
      if (b.x < -30 || b.x > CANVAS.width + 30 || b.y < -30 || b.y > CANVAS.height + 30) {
        this.bullets.splice(i, 1);
      }
```
with:
```js
      if (b.x < -30 || b.x > this.worldW + 30 || b.y < -30 || b.y > this.worldH + 30) {
        this.bullets.splice(i, 1);
      }
```

> `CANVAS` is still used elsewhere in `rlBoss.js`? After this change it is not referenced. Remove the now-unused `CANVAS` from the import on line 2: `import { CONTEXT } from "../core/canvas.js";`

- [ ] **Step 2: Trigger the boss from the timer, keeping rocks**

In `rl.js`, replace `_triggerBoss(now)` (~lines 577–582) so it spawns near the player and does NOT clear asteroids:

```js
function _triggerBoss(now) {
  rlState.bossIndex++;
  rlState.bossSpawned = true;
  const spawnX = Math.max(120, Math.min(WORLD_W - 120, player.coordinates.x));
  const spawnY = Math.max(160, Math.min(WORLD_H - 120, player.coordinates.y - 260));
  boss = new Boss(rlState.bossIndex, spawnX, spawnY, WORLD_W, WORLD_H);
  rlState.screen = "boss";
}
```

In `_playingFrame`, add the timed trigger. Right after the `const t = …` / `rlState.speedRamp = …` lines (Task 3 Step 3), add the block below. `_triggerBoss` sets `rlState.screen = "boss"`, so the early return hands off to the boss frame on the next `drawRL` call:

```js
  if (!isBoss && !rlState.bossSpawned && elapsed >= STAGE_DURATION_MS) {
    _triggerBoss(now);
    return;
  }
```

- [ ] **Step 3: Remove the old level-gated boss**

In `_checkLevelUp(now)` (~lines 564–568), replace:
```js
  if (rlState.level % 5 === 0) {
    _triggerBoss(now);
  } else {
    _openUpgradePick();
  }
```
with:
```js
  _openUpgradePick();
```

- [ ] **Step 4: Win on boss defeat**

In `_onBossDefeated(now)` (~lines 589–594), replace:
```js
function _onBossDefeated(now) {
  rlState.bossesDefeated++;
  addScore(500 * rlState.bossIndex);
  boss = null;
  _openUpgradePick();
}
```
with:
```js
function _onBossDefeated(now) {
  rlState.bossesDefeated++;
  addScore(500 * rlState.bossIndex);
  boss = null;
  bankRun();
  rlState.screen = "win";
}
```

- [ ] **Step 5: Add the win screen renderer**

In `rlRender.js`, add a victory screen. It mirrors `drawRLEnd` but with a green "VICTORY" header and Retry / Back buttons. Add after `drawRLEnd` (end of file):

```js
// ── Win screen ────────────────────────────────────────────────────────────────
export function getRLWinButtons() {
  const cx = CANVAS.width / 2;
  return [
    { id: "rl-restart", label: "PLAY AGAIN", x: cx - 210, y: CANVAS.height - 110, w: 190, h: 54 },
    { id: "rl-levels",  label: "LEVELS",     x: cx + 20,  y: CANVAS.height - 110, w: 190, h: 54 },
  ];
}

export function drawRLWin(bestScore, now) {
  const cx = CANVAS.width / 2;
  const isNewBest = rlState.score > (bestScore || 0);

  CONTEXT.fillStyle = "rgb(10,16,12)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.save();
  CONTEXT.textAlign = "center";

  CONTEXT.font = "bold 48px monospace";
  CONTEXT.fillStyle = "#7ef5aa";
  CONTEXT.shadowColor = "rgba(126,245,170,0.6)";
  CONTEXT.shadowBlur = 22;
  CONTEXT.fillText("VICTORY", cx, 110);
  CONTEXT.shadowBlur = 0;

  CONTEXT.font = "15px monospace";
  CONTEXT.fillStyle = "rgb(150,180,150)";
  CONTEXT.fillText("LEVEL 1 CLEARED", cx, 150);

  const stats = [
    ["SCORE",        `${rlState.score}${isNewBest ? "  ★ NEW BEST" : ""}`],
    ["LEVEL",        String(rlState.level)],
    ["ASTEROIDS",    String(rlState.asteroidsKilled)],
    ["UPGRADES",     String(rlState.upgradesPickedCount)],
    ["MONEY EARNED", `+$${Math.floor(rlState.score / 10)}`],
  ];
  CONTEXT.font = "15px monospace";
  let y = 210;
  for (const [label, value] of stats) {
    CONTEXT.textAlign = "right";
    CONTEXT.fillStyle = "#555";
    CONTEXT.fillText(label, cx - 10, y);
    CONTEXT.textAlign = "left";
    CONTEXT.fillStyle = (label === "SCORE" && isNewBest) || label === "MONEY EARNED" ? "#ffd750" : OFF_WHITE;
    CONTEXT.fillText(value, cx + 10, y);
    y += 26;
  }
  CONTEXT.restore();

  for (const btn of getRLWinButtons()) {
    drawButton(btn, {
      color: btn.id === "rl-restart" ? "120, 230, 160" : "160, 160, 175",
      font: "18px monospace",
    });
  }
}
```

- [ ] **Step 6: Route and wire the win screen in `rl.js`**

Add `drawRLWin, getRLWinButtons` to the import from `./rlRender.js`.

In `drawRL(now)` (~lines 91–97), add a branch (after the `"end"` branch):
```js
  if (rlState.screen === "win") { drawRLWin(cloud.bestScores["ROGUELIKE"], now); return; }
```

In the `mousedown` handler, add a block mirroring the end-screen one (after the `rlState.screen === "end"` block, ~line 748):
```js
  if (rlState.screen === "win") {
    for (const btn of getRLWinButtons()) {
      if (!isInside(mx, my, btn)) continue;
      if (btn.id === "rl-restart") startRun(now);
      else if (btn.id === "rl-levels") { rlState.screen = "menu"; _clearRunState(); }
      return;
    }
    return;
  }
```

- [ ] **Step 7: Browser verification**

Run `npx live-server`, start a run. Confirm:
1. At ~60s a boss slides in near the ship; asteroids are still present and new ones keep spawning during the fight.
2. The countdown disappears once the boss is up; the boss HP bar shows.
3. Destroying the boss (clear minions, then hit the core) shows the **VICTORY / LEVEL 1 CLEARED** screen with stats; PLAY AGAIN restarts a run; LEVELS returns to the level-select screen.
4. Reaching higher player levels only ever opens the upgrade picker — no boss appears from leveling up (only the timer spawns it).
5. Dying before/after the boss still shows the red end screen.

- [ ] **Step 8: Commit**

```bash
git add src/roguelike/rlBoss.js src/roguelike/rl.js src/roguelike/rlRender.js
git commit -m "Roguelike: timed boss into live arena, victory screen on defeat"
```

---

## Task 5: Level-select screen (Level 1 + Coming soon + Back)

Replaces the start menu with a level-select grid as the Roguelike entry screen.

**Files:**
- Modify: `src/roguelike/rlRender.js`
- Modify: `src/roguelike/rl.js`

**Interfaces:**
- Produces: `getRLMenuButtons()` now returns `[{id:"rl-level-1"…}, {id:"rl-back"…}]` (the "Coming soon" card is drawn but is NOT a button). `drawRLMenu()` draws the level grid.
- Consumes: existing `mousedown` menu handling in `rl.js`.

- [ ] **Step 1: Turn the menu into a level-select grid**

In `rlRender.js`, replace `getRLMenuButtons()` and `drawRLMenu()` (~lines 238–272) with:

```js
// ── Level-select screen ───────────────────────────────────────────────────────
const LVL_CARD_W = 200;
const LVL_CARD_H = 150;
const LVL_CARD_GAP = 28;

export function getRLMenuButtons() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;
  const totalW = LVL_CARD_W * 2 + LVL_CARD_GAP;
  const startX = cx - totalW / 2;
  const cardY = cy - LVL_CARD_H / 2;
  return [
    // Only Level 1 is a real button; the "coming soon" card is non-interactive.
    { id: "rl-level-1", label: "LEVEL 1", x: startX, y: cardY, w: LVL_CARD_W, h: LVL_CARD_H },
    { id: "rl-back", label: "BACK", x: cx - 90, y: CANVAS.height - 96, w: 180, h: 48 },
  ];
}

export function drawRLMenu() {
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;
  const totalW = LVL_CARD_W * 2 + LVL_CARD_GAP;
  const startX = cx - totalW / 2;
  const cardY = cy - LVL_CARD_H / 2;

  CONTEXT.fillStyle = "rgb(16,16,16)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);

  CONTEXT.save();
  CONTEXT.textAlign = "center";
  CONTEXT.font = "bold 56px monospace";
  CONTEXT.fillStyle = OFF_WHITE;
  CONTEXT.fillText("ROGUELIKE", cx, cy - 150);
  CONTEXT.font = "14px monospace";
  CONTEXT.fillStyle = "rgb(120,140,120)";
  CONTEXT.fillText("Select a level", cx, cy - 110);
  CONTEXT.restore();

  // "Coming soon" placeholder card (drawn, not clickable)
  const comingX = startX + LVL_CARD_W + LVL_CARD_GAP;
  CONTEXT.save();
  CONTEXT.fillStyle = "rgba(255,255,255,0.03)";
  CONTEXT.strokeStyle = "rgba(160,160,175,0.25)";
  CONTEXT.lineWidth = 1;
  CONTEXT.setLineDash([6, 6]);
  CONTEXT.beginPath();
  CONTEXT.rect(comingX, cardY, LVL_CARD_W, LVL_CARD_H);
  CONTEXT.fill();
  CONTEXT.stroke();
  CONTEXT.setLineDash([]);
  CONTEXT.textAlign = "center";
  CONTEXT.textBaseline = "middle";
  CONTEXT.font = "16px monospace";
  CONTEXT.fillStyle = "rgba(160,160,175,0.6)";
  CONTEXT.fillText("COMING SOON", comingX + LVL_CARD_W / 2, cardY + LVL_CARD_H / 2);
  CONTEXT.restore();

  // Level 1 card + Back button via the shared button renderer
  for (const btn of getRLMenuButtons()) {
    drawButton(btn, {
      color: btn.id === "rl-level-1" ? "120, 230, 160" : "160, 160, 175",
      font: btn.id === "rl-level-1" ? "22px monospace" : "18px monospace",
    });
  }
}
```

- [ ] **Step 2: Update the menu mousedown handler for the new button id**

In `rl.js`, the `rlState.screen === "menu"` block in `mousedown` (~lines 730–738) checks `btn.id === "rl-start"`. Replace that block so Level 1 starts the run:

```js
  if (rlState.screen === "menu") {
    for (const btn of getRLMenuButtons()) {
      if (!isInside(mx, my, btn)) continue;
      if (btn.id === "rl-level-1") startRun(now);
      else if (btn.id === "rl-back") closeRoguelike();
      return;
    }
    return;
  }
```

- [ ] **Step 3: Browser verification**

Run `npx live-server`. From the main menu click **Roguelike**. Confirm:
1. The screen shows the title "ROGUELIKE", a green **LEVEL 1** card, a dashed **COMING SOON** card, and a **BACK** button.
2. Clicking COMING SOON does nothing; clicking LEVEL 1 starts a run; clicking BACK returns to the main game's start screen.
3. After winning or dying, the LEVELS / MAIN MENU buttons land back on this level-select (LEVELS) or main menu as expected.

- [ ] **Step 4: Commit**

```bash
git add src/roguelike/rlRender.js src/roguelike/rl.js
git commit -m "Roguelike: level-select screen (Level 1 + coming soon)"
```

---

## Final verification (whole feature)

Run `npx live-server` and play one full Level 1 from the main menu:

1. Main menu → Roguelike → level select (Level 1 + Coming soon + Back).
2. Level 1 → arena is ~3× screen each way; camera follows; walls contain the ship; aim correct at walls.
3. Starts sparse, ramps to a swarm over ~60s; countdown ticks down.
4. Boss spawns at ~60s into the live arena (rocks remain); countdown hides, HP bar shows.
5. Pick an upgrade mid-stage → countdown freezes during selection, resumes after.
6. Defeat boss → VICTORY screen, run banked (money earned shown). PLAY AGAIN and LEVELS both work.
7. Die at any point → red end screen.

No console errors in DevTools throughout.
