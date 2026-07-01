# Roguelike Mode — Design Spec

**Date:** 2026-06-29  
**Status:** Approved

---

## Overview

A new self-contained game mode — "Roguelike" — added alongside the existing single-player and Battle Royale modes. The player shoots asteroids to fill an XP bar, levels up, picks permanent-for-the-run upgrades from a shared pool, and fights increasingly difficult bullet-hell bosses every 5 levels. The run continues infinitely until the player dies. No meta-progression — every run starts fresh.

---

## Architecture

### Approach

Self-contained module in `src/roguelike/`, mirroring Battle Royale's integration pattern. `index.js` changes are exactly two lines:

```js
import { rlActive, drawRL } from "./src/roguelike/rl.js";
// in gameLoop(), before the shopOpen check:
if (rlActive()) { drawRL(currentTime); requestAnimationFrame(gameLoop); return; }
```

A "ROGUELIKE" button is added to the start screen alongside "BATTLE ROYALE".

### New files

```
src/roguelike/
  rl.js          — orchestrator; exports rlActive() + drawRL(); owns the state machine
  rlState.js     — all mutable run state (XP, level, upgrades held, boss index)
  rlUpgrades.js  — upgrade pool definitions + weighted draw + 3-card picker logic
  rlBoss.js      — boss entity: core + minions, bullet pattern emitter, phase logic
  rlRender.js    — roguelike-specific HUD (XP strip, level badge, upgrade cards, end screen)
```

### Shared systems imported without modification

`asteroids.js`, `entities.js`, `particles.js`, `soundManager.js`, `controls.js`, `canvasWrap.js`, `difficulty.js` (base speed constants only — roguelike has its own ramp).

### State machine (inside `rl.js`)

```
closed → menu → playing → upgrade-pick → playing → ... → boss → playing → ... → end
                    ↑_______________________________________________|
```

- `menu` — simple entry screen with "START RUN" and "BACK" buttons; no match state yet
- `playing` — asteroid loop + XP accumulation + boss check
- `upgrade-pick` — game frozen; 3 upgrade cards shown; resumes on pick
- `boss` — no new asteroid spawns; boss entity active; XP strip turns red
- `end` — run-over screen; submits score + money to cloud; offers restart

---

## Section 1 — XP & Leveling

### XP awards per kill

| Asteroid size | XP |
|---|---|
| Large (radius ≥ 60) | +25 |
| Medium (radius 30–59) | +15 |
| Small shard (radius < 30) | +8 |

### Level threshold

```
xpRequired(level) = 200 + level × 80
```

When the XP bar fills:
1. Game freezes immediately.
2. Upgrade picker draws 3 cards and displays them.
3. Player picks one; run resumes.
4. If `level % 5 === 0` → boss fight instead of upgrade pick (upgrade pick happens after boss dies).

### HUD

A 5px-tall full-width strip along the very top edge of the canvas:
- Fills left-to-right with a `linear-gradient(90deg, #78c8ff, #7ef5aa)` glow.
- Turns `linear-gradient(90deg, #ff5050, #ff9050)` during boss fights.
- Level + XP text shown top-right: `LVL 7 · 680/900 XP` in small monospace.

---

## Section 2 — Upgrade Pool

### Infinite stacking with diminishing weight

Every upgrade can be taken any number of times. Each upgrade has a `baseWeight`. Each time the player already holds N stacks of it, the weight used in the draw is:

```
effectiveWeight = baseWeight / (2.5 ^ stacksHeld)
```

The upgrade never disappears from the pool — it just becomes increasingly unlikely. The card shows "UPGRADE" in its rarity badge when it is being offered as a second-or-more stack, and displays stack dots at the bottom.

### Upgrade definitions

**Common** (`baseWeight: 100`)

| Name | Effect per stack |
|---|---|
| Rapid Fire | Fire interval −20% per stack |
| Thruster | Move speed +15% per stack |
| Heavy Shot | Bullet radius +30% per stack; stack III also doubles XP per kill |
| Tough Shield | Shield recharges after break; recharge time: 30s → 15s → 5s per stack |

**Rare** (`baseWeight: 40`)

Stack I and II have distinct described effects below. From stack III onward, the numeric component continues scaling linearly (e.g. Ricochet III = 3 bounces, Fork Shot III = 6 shards) — the diminishing weight formula ensures these stacks are very rare in practice.

| Name | Stack I | Stack II |
|---|---|---|
| Pierce | Bullets pass through asteroids | Bullets also split the asteroid on exit |
| Ricochet | Bullets bounce off canvas edges once | Bounce twice (+1 per additional stack) |
| Fork Shot | On hit: spawn 2 side shards | Spawn 4 side shards (+2 per additional stack) |
| Magnet | Pickup radius ×3 | Radius ×6; also pulls XP orbs |

**Legendary** (`baseWeight: 16`)

Same rule — stack III+ continues scaling the numeric component.

| Name | Stack I | Stack II |
|---|---|---|
| Orbit Ring | 3 orbs orbit ship, destroy asteroids on contact | 6 orbs, faster spin (+3 orbs per additional stack) |
| Nova Burst | On level-up: explosion clears nearby asteroids | Explosion radius ×2; stuns boss |
| Ghost Ship | Phase through asteroids 4s after taking damage | Phase lasts 8s; also deflects bullets (+4s per additional stack) |

### Draw logic (`rlUpgrades.js`)

1. Compute `effectiveWeight` for all 11 upgrades.
2. Weighted-random draw without replacement — draw 3 distinct upgrades.
3. Return the 3 cards for display.

---

## Section 3 — Boss Fight

### Trigger

Every 5th level (`level % 5 === 0`). Normal asteroid spawning halts. All existing asteroids are left on screen but no new ones spawn. The boss enters from the top-centre.

### Two-phase structure

**Phase 1 — Minion Guard**
- The boss core is shielded (visually dimmer, surrounded by a blue shield ring).
- Minions orbit the core and fire synchronized bullet patterns.
- The core cannot be damaged while any minion is alive.
- Destroying all minions removes the shield and starts Phase 2.

**Phase 2 — Core Exposed**
- The core fires bullet patterns directly.
- Player chips down the core HP to zero to defeat the boss.
- On defeat: explosion + sound + upgrade pick screen.

### Infinite scaling formula

| Attribute | Formula |
|---|---|
| Core HP | `200 + bossIndex × 150` |
| Minion count | `2 + floor(bossIndex / 2)` (soft cap: 8) |
| Bullet speed | `baseBulletSpeed × (1 + bossIndex × 0.1)` |
| Simultaneous patterns | 1 pattern for boss #1–2; 2 patterns simultaneously from boss #3 onward |

`bossIndex` starts at 1 and increments each boss fight.

### Bullet pattern library

| Pattern | Description | First appears |
|---|---|---|
| Ring Burst | N bullets equally spaced in a full circle | Boss #1 |
| Spiral | Rotating burst — angle offset each volley | Boss #1 |
| Aimed Burst | 3-shot fan aimed at the player | Boss #2 |
| Scatter | 12 bullets in random directions, rapid-fire | Boss #2 |
| Cross Sweep | 4 streams rotating like clock hands | Boss #3 |
| Homing Pulse | Slow bullets that steer toward the player's position at spawn | Boss #4 |

Bosses cycle through the pattern library by index; from boss #3 onward, two patterns are active simultaneously, chosen by `(bossIndex % patternCount)` and `((bossIndex + 3) % patternCount)`.

---

## Section 4 — Run End Screen

Shown when the player dies (after the existing death explosion sequence fades).

### Stats displayed

- Score (with "NEW BEST" badge if it beats `cloud.bestScores["ROGUELIKE"]`)
- Level reached
- Bosses defeated
- Asteroids destroyed
- Upgrades taken (count)
- Run time (mm:ss)
- Upgrade chips — every upgrade held at death, with stack count (e.g. `Rapid Fire ×3`)
- Money earned: `$1 per 10 score points` — same formula as single-player

### Buttons

- **TRY AGAIN** — resets all roguelike state and restarts the mode immediately
- **MAIN MENU** — calls `closeRoguelike()` and returns to the start screen

### Cloud integration

```js
cloudSubmitRun(score, "ROGUELIKE");
```

- Reuses the existing `cloudSubmitRun` RPC — no backend changes needed.
- Best score stored under key `"ROGUELIKE"` in `cloud.bestScores`.
- The existing leaderboard and My Records screens automatically show the Roguelike mode as a new column — no UI changes required there.

---

## Scoring

Asteroid kill score is identical to single-player:

```js
scoreIncrease = round(15 × (1 − asteroid.radius / 450))
```

Boss kill bonus:

```js
scoreIncrease += 500 × bossIndex
```

---

## Out of scope (for now)

- Meta-progression (permanent unlocks across runs)
- Multiplayer roguelike
- Unique boss sprites / names
- Difficulty selector within roguelike mode (the XP ramp and boss scaling are the difficulty)
