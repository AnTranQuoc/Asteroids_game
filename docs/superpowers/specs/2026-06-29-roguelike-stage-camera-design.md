# Roguelike: Time-Paced Stage, Big Arena + Camera, Level Select

**Date:** 2026-06-29
**Status:** Design approved, pending spec review
**Scope:** Reshape the Roguelike mode (`src/roguelike/`) from an endless single-screen
run into a Level 1 stage: a bounded 3×3 arena with a follow-camera, time-paced
enemy spawning that ramps for ~1 minute, then a boss whose defeat wins the level.
Adds a level-select screen ahead of play.

---

## Motivation

The current Roguelike mode is not a roguelike *stage* experience:

- The world is a single canvas-sized, wrap-around screen — no room to maneuver.
- Difficulty is governed by XP level (boss every 5 player-levels) and an endless
  run with no win condition.
- Pacing is flat: asteroids spawn on a fixed 900ms interval from the start.

Target experience for **Level 1**: start calm with few enemies, escalate smoothly
over ~1 minute, then a boss appears; defeat it to **win the level**. The arena is
several screens large with a camera that follows the ship.

---

## Flow change

```
Main menu → [Roguelike] → Level select → [Level 1] → play → win / death
```

- Entering Roguelike now lands on a **level-select** screen (the screen formerly
  used as the start menu).
- Level select shows a **Level 1** tile (playable) plus a **"Coming soon"**
  placeholder card, and a **Back** button returning to the main menu.
- Pressing Level 1 starts the run (today's `startRun`).

---

## A. World & camera

### World bounds
- At run start, compute `WORLD_W = CANVAS.width * 3`, `WORLD_H = CANVAS.height * 3`,
  stored module-level in `rl.js` (recomputed each `startRun`).
- Player is **clamped** to `[0, WORLD_W] × [0, WORLD_H]` — walls stop the ship.
  This replaces `enableCanvasWrap()` for Roguelike (single-player still wraps).
- **Asteroids bounce** off world walls (reflect the relevant velocity component,
  clamp position inside) so they stay in play instead of drifting away forever.
- **Projectiles** die at world edges; the ricochet upgrade bounces off world
  walls (same logic as today, with `CANVAS.width/height` → `WORLD_W/WORLD_H`).
- **XP orbs / power-ups** clamp/settle inside world bounds (replace their current
  canvas-wrap with clamp).

### Camera
- Each playing/boss frame, compute a player-centered camera:
  - `camX = clamp(player.x - CANVAS.width/2,  0, WORLD_W - CANVAS.width)`
  - `camY = clamp(player.y - CANVAS.height/2, 0, WORLD_H - CANVAS.height)`
- Render with a single transform:
  1. Fill background + draw starfield in **screen space** (static; parallax is
     noted as later polish, not in scope).
  2. `CONTEXT.save(); CONTEXT.translate(-camX, -camY);`
  3. Draw all world entities in **world coordinates, unchanged** (asteroids,
     player, projectiles, boss, orbs, explosions, orbit ring).
  4. `CONTEXT.restore();`
  5. Draw HUD (XP strip, level badge, score, boss HP, countdown, ghost
     indicator) in **screen space**.

### Aim correction
The ship rotates to face `MOUSE`, which is in screen space. Under the camera the
ship is no longer guaranteed screen-centered (it isn't when clamped at a wall), so
aim must use **world-space mouse**:

`worldMouseX = MOUSE.x + camX`, `worldMouseY = MOUSE.y + camY`.

`rl.js` sets the player's aim from world mouse each frame before
`player.updatePlayer()` (rather than letting the player read raw `MOUSE`).
Implementation detail for the plan: confirm how `player` currently derives
rotation from `MOUSE` and feed it the corrected world-space target without
breaking single-player (e.g. set rotation directly in the rl frame, or write a
temporary world-adjusted mouse). The single-player loop must remain untouched.

---

## B. Stage timer & smooth spawn ramp

### Timer
- New `rlState` fields: `stageStartTime`, `bossSpawned` (bool), and pause
  bookkeeping (`pauseStartedAt`) so the timer freezes while the upgrade-pick
  screen is open.
- `STAGE_DURATION_MS = 60000` (module constant, tunable).
- `elapsed = now - rlState.stageStartTime`; `t = clamp(elapsed / STAGE_DURATION_MS, 0, 1)`.
- **Pause handling:** when opening upgrade-pick, record `pauseStartedAt = now`;
  on resume, add `(now - pauseStartedAt)` to `stageStartTime`. The boss timer and
  spawn ramp therefore do not advance during card selection. `speedRamp` already
  derives from `runStartTime`; switch it to derive from the same paused
  `stageStartTime` so it freezes consistently.

### Spawn ramp (smooth)
- Spawn interval lerps from a slow start to a fast end:
  `spawnInterval = lerp(2000ms, 450ms, t)` (start sparse → end rapid).
- Asteroid cap lerps: `maxAsteroids = round(lerp(6, 30, t))`.
- `_spawnRLAsteroid()` reads these instead of the fixed `RL_SPAWN_INTERVAL` /
  `RL_MAX_ASTEROIDS` constants. Spawn positions are world-space, placed just
  outside the current camera view but inside world bounds, so rocks enter from
  off-screen rather than popping in.
- `speedRamp` keeps its current climb.

(Exact lerp endpoints are tunable; values above are the starting point.)

---

## C. Boss trigger & win condition

- When `elapsed >= STAGE_DURATION_MS` and `!bossSpawned`: set `bossSpawned`,
  spawn the boss, switch `screen` to `"boss"`. **Rocks are kept and keep
  spawning** during the fight (no `ASTEROIDS.length = 0`).
- Boss spawns at a **world position** near/above the player (within world bounds),
  not the hard-coded screen center.
  - `rlBoss.js`: `Boss` constructor takes spawn `(x, y)` (and entry target) in
    world coords instead of `CANVAS.width/2` / `y = -90`.
  - Boss bullet off-screen culling bounds change from `CANVAS.width/height` to
    `WORLD_W/WORLD_H` (pass world bounds in, or import them).
- **Win:** when the boss is defeated, set `screen = "win"`, bank the run, show a
  **victory** screen ("VICTORY", final score, Retry / Back-to-levels buttons).
- **Death:** unchanged — `_triggerDeath` → end screen.
- `bossIndex` / `bossesDefeated` remain (single boss for Level 1).

---

## D. Upgrade decoupling

- Remove the `rlState.level % 5 === 0 → _triggerBoss` branch in `_checkLevelUp`.
  XP level-ups **always** open the upgrade pick. The upgrade system itself is
  unchanged.
- The boss is now purely timer-driven (section C).
- Upgrade-pick screen still freezes the world; it additionally freezes the stage
  timer via the pause bookkeeping in section B.

---

## E. Level select & win screens (`rlRender.js`)

- Repurpose the existing menu screen as **level select**:
  - **Level 1** tile → starts the run.
  - **"Coming soon"** placeholder card (non-interactive, greyed).
  - **Back** button → `closeRoguelike()` (returns to main menu).
  - `getRLMenuButtons()` → returns these buttons; `drawRLMenu()` → draws the grid.
    (Rename to level-select naming if it reads more clearly; keep the existing
    `mousedown` wiring pattern in `rl.js`.)
- New **win** screen: `drawRLWin(...)` + `getRLWinButtons(...)` mirroring the end
  screen, header "VICTORY", final score + best, **Retry** (→ `startRun`) and
  **Back** (→ level select). Wired in `drawRL` and the `mousedown` handler beside
  the existing end-screen case.
- New HUD element: **countdown** "BOSS IN m:ss" shown during the playing phase
  (hidden once the boss has spawned; boss HP bar already shows then).

---

## Files touched

| File | Change |
|------|--------|
| `src/roguelike/rl.js` | Camera transform, world bounds + clamping/bounce, aim correction, stage timer + pause, smooth spawn ramp, boss-on-timer + keep-rocks, win screen wiring, level-select wiring |
| `src/roguelike/rlState.js` | `stageStartTime`, `bossSpawned`, pause fields; `speedRamp` derives from `stageStartTime`; reset logic |
| `src/roguelike/rlBoss.js` | Constructor takes world spawn coords; bullet cull uses world bounds |
| `src/roguelike/rlRender.js` | Level-select screen, win screen, countdown HUD |

- No new dependencies, no build tooling.
- **Single-player loop in `index.js` is untouched** (mode convention).
- `enableCanvasWrap` stays for single-player; Roguelike stops using it.

---

## Out of scope / later polish

- Additional levels (2+) beyond the "Coming soon" placeholder.
- Starfield parallax with the camera.
- Minimap / off-screen enemy indicators.
- Per-level distinct tuning, bosses, or themes.

---

## Success criteria

Verified by running in the browser (no test framework):

1. Roguelike entry shows level select (Level 1 + Coming soon + Back); Back
   returns to main menu; Level 1 starts a run.
2. Arena is ~3× the screen each way; camera follows the ship and stops at walls;
   the ship cannot leave the arena; aim tracks the cursor correctly even when the
   camera is clamped at an edge.
3. Run starts with few asteroids and visibly escalates over ~60s.
4. A boss appears at ~60s while rocks remain; defeating it shows the VICTORY
   screen and banks the run; dying shows the end screen.
5. Picking an upgrade freezes the boss countdown (timer does not advance during
   card selection).
