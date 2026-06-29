# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser Asteroids game written in **vanilla ES modules** — no build step, no
bundler, no package.json, no test framework. Everything is plain `.js` loaded
directly by the browser via `<script type="module" src="index.js">`. Rendering
is hand-rolled HTML5 Canvas 2D.

## Running / developing

ES modules don't load over `file://`, so serve the folder over HTTP:

```bash
npx live-server
```

There is **no build, lint, or test command**. "Verifying" a change means
running it in the browser. The live demo is GitHub Pages
(`https://antranquoc.github.io/Asteroids_game/`), deployed by pushing to the
published branch — the repo root is served as-is.

## Big-picture architecture

### Single render loop, mode-switched at the top

`index.js` owns one `requestAnimationFrame(gameLoop)` loop and a set of boolean
state flags (`gameStarted`, `gameOver`, `isPaused`, `shopOpen`,
`leaderboardOpen`, `needsName`, …). Each frame, `gameLoop` checks these flags
**in priority order** and early-returns into the matching screen/draw routine.
Alternate game modes hook in at the very top of `gameLoop` the same way:

```js
if (rlActive()) { drawRL(currentTime); requestAnimationFrame(gameLoop); return; }
if (brActive()) { drawBR(currentTime); requestAnimationFrame(gameLoop); return; }
```

So **a new full-screen mode is a self-contained module exporting an
`xActive()` predicate and an `xDraw(time)` function**, plus one button wired up
in the `mousedown` handler. Battle Royale (`src/battle/`) and Roguelike
(`src/roguelike/`) both follow this pattern and own their own input listeners,
state machines, and HUDs. Single-player logic stays in `index.js` and is left
untouched when adding a mode — see `docs/superpowers/specs/` for the design
spec that established this convention.

### Shared mutable state via module-level arrays

`src/core/constants.js` exports the global entity arrays (`ASTEROIDS`,
`PROJECTILES`, `EXPLOSIONS`), the `MOUSE`/`KEYPRESS` input mirrors, and all
gameplay tuning constants. These arrays are mutated in place from many modules
(`ASTEROIDS.length = 0` to clear, `.splice()` to remove, `.push()` to add) —
this is the primary cross-module communication channel for single-player.
Roguelike deliberately keeps its **own** local `EXPLOSIONS`/`XPORBS` arrays
inside `rl.js` rather than sharing.

### Entities are classes that draw themselves

`src/entities/entities.js` defines `Player`, `Projectile`, `Asteroid`. Each has
`drawX()` + `updateX()`, where `updateX()` calls `drawX()` then advances
physics — **update and render are fused**, not separate passes. The single
`player` instance is a shared export reused across all modes. Ship/gun visuals
are swappable: the player draws whatever `getSelectedShipSkin()` /
`getSelectedGunSkin()` return (`src/systems/skins.js`).

### Movement model

Aim and motion are independent: the ship rotates to face `MOUSE` while WASD
applies thrust with momentum/deceleration (`DECELERATION_RATE`). The gun fires
**automatically** on a timer (`lastShotTime` + `fireInterval`); mouse clicks
only hit on-screen buttons. Power-ups (`src/entities/powerUps.js`) are
time-windowed (`rapidFireUntil`, `spreadUntil`) or one-hit (`shield`).

### Difficulty + speed ramp

`src/systems/difficulty.js` holds per-mode tuning (`speedMult`,
`spawnInterval`, `maxAsteroids`, `dropChance`) plus a `runtime.speedRamp` that
climbs the longer a run lasts. Asteroid spawning and speed read from these
every frame.

### Cloud (Supabase) — server-authoritative

`src/cloud/cloud.js` mirrors server state into a **read-only** `cloud` object
(`money`, `owned`, `selected`, `bestScores`, `name`). The client **never writes
money or ownership directly** — it calls server RPCs (`purchase_skin`,
`submit_run`, `set_player_name`) and re-applies the returned profile. RLS
blocks direct writes. Accounts are created lazily (anonymous sign-in on first
real action) so visitors don't fill the DB. Anonymous players can play but
don't save scores/skins; a named account is required for persistence.
`bankRun()` in `index.js` pays out money once per run ($1 per 10 points).

### Battle Royale networking

`src/battle/` is host-authoritative multiplayer over **Supabase Realtime**
broadcast/presence channels (`src/battle/net.js`). The host runs
`match.step()` and broadcasts snapshots ~`SNAPSHOT_HZ`/sec; clients send input
`INPUT_HZ`/sec, interpolate remote ships between snapshots, and locally predict
their own. Room codes use an ambiguity-free alphabet (no 0/O/1/I). All BR
tuning lives in `src/battle/config.js`.

## Conventions to follow

- **No new dependencies / build tooling.** Keep everything runnable by opening
  in a browser. Third-party libs are imported from a CDN/ESM URL at runtime
  (e.g. Supabase from `esm.sh`), not installed.
- **Adding a mode:** create `src/<mode>/`, export `xActive()` + `xDraw()`,
  hook the early-return into `gameLoop`, add a start-screen button + a
  `mousedown` case. Don't modify the single-player loop body.
- **Cloud changes:** persistent values go through server RPCs; treat the
  `cloud` object as a read-only frame mirror.
- `src/audio/sfxAndMusic.js` is imported in `index.js` for its side effects —
  removing the import disables the music feature (noted inline).
