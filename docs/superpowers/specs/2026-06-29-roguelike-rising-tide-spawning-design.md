# Roguelike Level 1 — Rising-Tide Spawning

**Date:** 2026-06-29
**Status:** Design approved, ready for plan
**Files touched:** `src/roguelike/rl.js`, `src/roguelike/rlState.js`

## Problem

Level 1 of the Roguelike stage does not get more crowded over time the way it
should. Two specific failures:

1. **Enemies never keep coming.** Chasers and hunters spawn *only* from the five
   discrete `WAVES` entries (one-time bursts at 40/80/120/160/200s). There is no
   continuous enemy spawner. Once a wave fires, any enemy killed is never
   replaced, so the live enemy count trends *down* over the stage — the opposite
   of escalating pressure. After the last wave (200s) there are no new enemies at
   all until the boss (240s).

2. **Asteroid pressure is too light**, both the steady trickle and the wave
   surges. Wave rocks also tend to arrive from only one or two sides because each
   spawned rock picks a single random off-camera edge aimed at the player.

The asteroid steady trickle already ramps correctly (interval 2000→450ms, cap
6→30 over the 4-minute stage). The fix is to (a) give enemies an equivalent
rising-tide spawner, (b) steepen the asteroid trickle, and (c) make wave rocks
both more numerous and omnidirectional.

## Goal

Once an enemy type is introduced by its wave, it keeps spawning continuously for
the rest of the stage, with the spawn rate and live-enemy cap both climbing as
the stage progresses. Discrete waves remain one-time bursts layered on top.

Success criteria (verified in-browser):
- After WAVE 2 (~80s), chasers keep reappearing as they are killed; live chaser
  count rises toward its cap as time passes.
- After WAVE 4 (~160s), hunters do the same.
- Just before the boss (~240s) the arena is visibly swarmy (heavy target).
- Wave asteroid surges arrive from all directions around the player, not one
  side, and are clearly larger than before.
- Steady asteroid density is higher throughout.

## Design

All ramps are driven by the existing stage progress value
`t = clamp(elapsed / STAGE_DURATION_MS, 0, 1)` already computed in
`_playingFrame` (`rl.js:832`). `_lerp(a, b, t)` already exists.

### 1. Continuous enemy spawner

Add a second spawn timer beside the asteroid one in `_playingFrame`, modeled on
the existing asteroid spawn block (`rl.js:846-851`).

- New state field `rlState.lastEnemySpawnTime` (reset to `now` in
  `resetRlState`).
- Each frame compute `enemyInterval = _lerp(3500, 1200, t)` (ms).
- When `now - rlState.lastEnemySpawnTime >= enemyInterval`, attempt one enemy
  spawn (see §4) and reset `lastEnemySpawnTime = now` **only if a spawn actually
  happened** (if no type is eligible, leave the timer so it retries next frame).

This runs during both `playing` and `boss` screens, same as today's asteroid
spawner (the spawner is inside `_playingFrame`, which serves both).

### 2. Per-type unlock, driven by the wave table

Add two boolean state fields, both `false` at reset:
`rlState.chaserUnlocked`, `rlState.hunterUnlocked`.

Make the wave table data-driven instead of hardcoding which wave unlocks what.
Add an optional `unlocks` key to wave entries:

```js
const WAVES = [
  { at: 40000,  rocks: 20, chasers: 0, hunters: 0, label: "WAVE 1" },
  { at: 80000,  rocks: 18, chasers: 4, hunters: 0, label: "WAVE 2", unlocks: "chaser" },
  { at: 120000, rocks: 26, chasers: 5, hunters: 0, label: "WAVE 3" },
  { at: 160000, rocks: 24, chasers: 3, hunters: 3, label: "WAVE 4", unlocks: "hunter" },
  { at: 200000, rocks: 34, chasers: 5, hunters: 4, label: "WAVE 5" },
];
```

In `_fireWavesIfDue`, when a wave fires and has `w.unlocks`, set the matching
flag: `unlocks === "chaser"` → `rlState.chaserUnlocked = true`, etc.

The wave's own `chasers`/`hunters` burst still spawns immediately (respecting
caps, see §3), so the type appears the instant its wave fires and then the
continuous spawner keeps it alive.

### 3. Ramped live-enemy caps

Replace the fixed constants:

```js
const MAX_CHASERS = 6;   // remove
const MAX_HUNTERS = 4;   // remove
```

with ramped helpers driven by `t`:

```
chaserCap(t) = round(_lerp(6, 14, t))
hunterCap(t) = round(_lerp(4, 9,  t))
```

Both the continuous spawner (§4) and the wave burst (`_fireWavesIfDue`) check
`countType("chaser") < chaserCap(t)` / `countType("hunter") < hunterCap(t)`
before spawning. `_fireWavesIfDue` already has `t`/`elapsed`; the wave loop
currently compares against the old constants and must switch to the ramped cap.

### 4. Type selection on a continuous spawn tick

Build the eligible set: a type is eligible if it is unlocked **and**
`countType(type) < cap(t)`.

- If no type is eligible → no spawn (timer not consumed, retries next frame).
- If only one is eligible → spawn it.
- If both are eligible → weighted pick: **60% chaser / 40% hunter**, so chasers
  remain the bulk of the swarm while hunters stay consistently present.

Spawn at `_offCameraSpawnPoint(30)` (the existing helper). Use `spawnChaser` /
`spawnHunter(p.x, p.y, now)` as today.

Randomness uses `Math.random()` (already used throughout this module).

### 5. Steeper steady asteroid trickle

Tune the existing constants (`rl.js:49-52`):

```
RL_SPAWN_INTERVAL_START : 2000 → 1400
RL_SPAWN_INTERVAL_END   :  450 → 300
RL_MAX_ASTEROIDS_START  :    6 → 8
RL_MAX_ASTEROIDS_END    :   30 → 42
```

No logic change — same lerp, steeper endpoints.

### 6. Wave asteroids: more rocks, all directions

Wave rock counts bumped (see the `WAVES` table in §2): 20 / 18 / 26 / 24 / 34.

Wave rocks must arrive from a full ring around the player rather than clumping on
one or two off-camera edges. Add a helper:

```js
function _spawnWaveAsteroid(bearing) { ... }
```

- `bearing` is an angle (radians) measured from the player.
- Place the rock just off-screen along that bearing: distance ≈
  `max(CANVAS.width, CANVAS.height) / 2 + margin`, position =
  `player + (cos(bearing), sin(bearing)) * distance`, then clamp into world
  bounds `[radius, WORLD_W/H - radius]` (reuse the clamp pattern from
  `_offCameraSpawnPoint`).
- Velocity points back toward the player ± small jitter (e.g. `±0.3 rad`), speed
  using the same `sizeFactor`/`speedRamp` formula as `_spawnRLAsteroid`
  (`rl.js:246-247`).

In `_fireWavesIfDue`, replace the wave-rock loop so it spreads the `rocks` count
evenly around the full circle with jitter:

```js
for (let i = 0; i < w.rocks; i++) {
  const bearing = (i / w.rocks) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
  _spawnWaveAsteroid(bearing);
}
```

Wave rocks continue to **ignore** the steady asteroid cap (they are an
intentional surge), matching current behavior.

The steady trickle (§5) keeps using `_spawnRLAsteroid` unchanged.

## State changes summary (`rlState.js`)

Add to `rlState` and to `resetRlState(now)`:

| Field | Initial (reset) |
|---|---|
| `lastEnemySpawnTime` | `now` |
| `chaserUnlocked` | `false` |
| `hunterUnlocked` | `false` |

## Edge cases

- **No eligible enemy type yet (before WAVE 2):** continuous spawner finds an
  empty eligible set and spawns nothing; timer is not consumed. No enemies before
  their unlock, as intended.
- **At cap:** continuous spawner and wave burst both skip when `countType >=
  cap(t)`. Wave bursts can still push live count to the cap but not beyond.
- **Boss phase:** `_playingFrame` runs for both `playing` and `boss`; the enemy
  spawner therefore keeps running during the boss fight. Acceptable — by 240s
  caps are at peak and this adds pressure. No special-casing.
- **Pause for upgrade pick:** `stageStartTime` is already pause-compensated
  (`_pickUpgrade`), so `t` and `elapsed` do not jump after an upgrade. The two
  spawn timers use raw `now`; a long upgrade pause means both timers fire once
  immediately on resume (one asteroid, one enemy) — negligible, matches existing
  asteroid-timer behavior.

## Out of scope

- No changes to enemy movement, firing, HP, or rendering (`rlEnemies.js` logic
  untouched except it already exposes `spawnChaser`/`spawnHunter`/`countType`).
- No changes to the boss, upgrades, XP, or scoring.
- Only Level 1 / the single existing stage; no new levels.
