# Roguelike — Weapon-Kit Power System

**Date:** 2026-06-29
**Status:** Design approved, ready for plan
**Files touched:** `src/roguelike/rlWeapons.js` (new), `src/roguelike/rlPassives.js` (new), `src/roguelike/rlKit.js` (new), `src/roguelike/rlUpgrades.js` (gutted/removed), `src/roguelike/rlState.js`, `src/roguelike/rl.js`, `src/roguelike/rlRender.js`

## Problem

The current Roguelike power system (`rlUpgrades.js`) is a flat pool of 11
stackable upgrades drafted 3-at-a-time on level-up. Every upgrade is a numeric
modifier funnelled into a single fixed fire loop (`_rlFireProjectile`, one
bullet stream on a global `fireIntervalMs(220)` timer). There is exactly one
weapon; "build variety" is just which scalar multipliers you stacked. Effects
are wired through ~30 one-line helper exports, each hard-coded into a specific
rl.js site, and stack-threshold rules (`>=2`, `>=3`) are duplicated between
`desc()` strings and helper functions. Adding content means editing three files
and risks drift.

We want a real **kit**: the ship carries multiple distinct auto-firing weapons,
each with its own behavior and cooldown, plus behavioral passives and
player-body stats. Offense lives on weapons; the body has hearts.

## Goal

Replace the upgrade pool with three upgradeable categories:

- **Weapons** — auto-firing offense. Up to **4** equipped, each levels **1→3**.
  Each weapon owns its own damage, fire rate, and projectile pattern. All
  equipped weapons fire simultaneously, each on its own cooldown
  (Vampire-Survivors style). The ship starts with one **default** weapon.
- **Passives** — unique behavioral effects (pierce, ricochet, phase, …). Up to
  **4** equipped, each levels **1→3**. Passives modify weapons/player via hooks,
  they do not fire.
- **Stats** — player-body attributes: **MoveSpeed, Pickup, MaxHP, Armor**.
  Drafted as cards in the same level-up draw, but surfaced only as a **fallback**
  once weapons (then passives) are exhausted — see the draw-priority in §6.
  MaxHP caps (1→2→3 hearts); the others stack freely so a valid card always
  exists.

Evolutions / weapon-combo unlocks are explicitly **out of scope** (future
update).

Success criteria (verified in-browser):
- Ship begins a run with 1 default weapon firing automatically and 1 heart.
- On level-up: 4 cards are offered (weapons/passives, with stats as fallback);
  picking a new weapon adds a second independently-firing stream.
- Two equipped weapons visibly fire on different cadences at once.
- Equipping a passive (e.g. Pierce) changes the behavior of *all* equipped
  weapons' projectiles.
- Hearts display as ♥ icons; taking a hit removes armor first, then a heart;
  0 hearts ends the run.
- Single-player mode is unchanged.

## Design

### 1. Data model

**Weapon definitions** — `rlWeapons.js`, registry of plain objects:

```js
{
  id: "blaster",
  name: "Blaster",
  tier: "COMMON",          // draft rarity weight
  maxLevel: 3,
  cooldownMs: (lvl) => ...,           // own fire cadence per level
  fire(ctx, lvl) { /* push Projectiles into ctx.PROJECTILES */ },
  // optional, for weapons with persistent visuals/state:
  draw(ctx, entry) { ... },           // ctx = render context bundle
}
```

**Passive definitions** — `rlPassives.js`, hook-based:

```js
{
  id: "pierce",
  name: "Pierce",
  tier: "RARE",
  maxLevel: 3,
  hooks: {
    onProjectileSpawn(p, lvl, ctx) { ... },   // stamp behavior onto a new shot
    onHit(hitCtx, lvl, ctx) { ... },          // react to a kill
    onPlayerHit(ctx, lvl) { ... },            // react before heart loss; return true to absorb
    onLevelUp(ctx, lvl) { ... },              // e.g. nova
  },
}
```

A definition only declares the hooks it uses.

**Kit state** — `rlKit.js`, replaces the `rlState.upgrades` Map:

```js
kit = [{ id, level, lastFireAt, runtime: {} }]   // weapons, length <= 4
passives = [{ id, level }]                        // length <= 4
stats = { moveSpeed: 0, pickup: 0, maxHP: 0, armor: 0 }  // integer levels
hearts = 1            // current hearts; max = 1 + maxHP level
armor  = 0            // current armor points; max = armor stat level
```

`runtime` is per-weapon scratch space (mine list, beam charge, orbit angle) so
weapons keep their own state without touching `rlState`.

`rlKit.js` owns the helpers: `tickKit(ctx, now)`, `addOrUpgradeWeapon(id)`,
`addOrUpgradePassive(id)`, `applyStat(statId)`, `resetKit()`, plus the
hook-dispatch helper `runPassiveHook(name, ...args)`, the `drawCards()`
priority logic (§6), and the level/cap/eligibility queries it needs.

### 2. Firing — `tickKit`

Called once per playing frame from rl.js (replacing the fixed fire block at
`rl.js:922-926`):

```js
function tickKit(ctx, now) {
  for (const entry of kit) {
    const w = WEAPONS[entry.id];
    if (now - entry.lastFireAt >= w.cooldownMs(entry.level)) {
      w.fire(ctx, entry.level);
      entry.lastFireAt = now;
    }
  }
}
```

`ctx` is a bundle assembled by rl.js each frame: `{ player, now, PROJECTILES,
WORLD_W, WORLD_H, stats, runPassiveHook, spawnExplosion, ... }`. Weapons read
`ctx.stats` only for body stats (none affect damage — damage is weapon-owned).

### 3. Hook system

rl.js calls passive hooks at fixed, known sites instead of importing per-effect
helpers:

- **`onProjectileSpawn(p, lvl, ctx)`** — called by each weapon's `fire` (via
  `ctx.runPassiveHook`) for every projectile created, so passives stamp
  `piercing`, `bouncesLeft`, etc. onto it. This makes pierce/ricochet global
  across all weapons automatically.
- **`onHit(hitCtx, lvl, ctx)`** — called from `_rlDetectProjectileHits` /
  enemy-hit sites on a kill; `hitCtx` carries the dead target's position and the
  projectile. Fork-shards, explode-on-hit live here.
- **`onPlayerHit(ctx, lvl)`** — called from the player-hit path *before* applying
  damage; if any passive returns "absorbed" (phase active, shield consumed) the
  heart/armor loss is skipped.
- **`onLevelUp(ctx, lvl)`** — called from `_checkLevelUp` (nova burst).

`runPassiveHook(name, ...)` loops equipped passives, calls the matching hook with
the passive's current level, and (for `onPlayerHit`) returns whether any absorbed.

### 4. Roster (initial)

**Weapons (5; default = blaster):**

| id | behavior | Lv2 | Lv3 |
|----|----------|-----|-----|
| `blaster` *(default)* | single forward shot | +damage, faster | twin shot |
| `orbitBlades` | orbiting orbs dealing contact damage (from old `orbitRing`) | +1 orb | more orbs, faster spin, bigger |
| `shotgun` | short-range pellet cone | +pellets | wider cone, +damage |
| `railgun` | slow, piercing high-damage line shot | +damage | shorter charge |
| `mines` | drops proximity mines that detonate near targets | +count | +blast radius |

**Passives (5):**

| id | effect | Lv scaling |
|----|--------|-----------|
| `pierce` | all shots pass through targets | Lv3: split on exit |
| `ricochet` | shots bounce off arena walls | +bounce count per level |
| `magnetPull` | actively pulls XP orbs toward ship | +range / pull speed |
| `phase` | brief invuln after a hit (from old `ghostShip`) | +duration; Lv3 deflects bullets |
| `shield` | regenerating shield absorbs one hit before hearts | faster recharge per level |

**Stats (4; drafted as fallback cards — see §6):**

| id | effect | cap |
|----|--------|-----|
| `moveSpeed` | +ship move speed per level | stacks freely |
| `pickup` | +XP-orb pickup radius per level | stacks freely |
| `maxHP` | +1 max heart per level | **2 points** (1→2→3 hearts) |
| `armor` | +1 armor point (expendable buffer) per level | stacks (soft) |

Exact tuning numbers (cooldowns, damage, per-level deltas, draft weights) are
deferred to implementation; the planning step will pin starting values, copying
the spirit of the current tier weights (COMMON 100 / RARE 40 / LEGENDARY 16).

### 5. Hearts & armor

Replaces the current 1-hit-death + boolean shield model.

- Run starts with **1 heart**, **0 armor**.
- `maxHP` stat raises max hearts: Lv1 → 2, Lv2 → 3 (cap 3). Gaining a max heart
  also fills it.
- `armor` stat adds armor points (one per level); gaining armor fills it.
- **Damage order on a hit:** first the `shield` passive / `phase` passive get a
  chance to absorb (via `onPlayerHit`). If not absorbed: lose 1 **armor** point
  if any remain, otherwise lose 1 **heart**. Running out of armor does **not**
  kill — only reaching 0 hearts ends the run.
- A hit grants standard i-frames (`player.invulnUntil`, reuse existing 1.5 s).
- Hearts and armor do **not** regenerate during a run except via the `shield`
  passive's own recharge. This makes runs punishing by design; starting-hearts,
  i-frame length, and shield recharge are the primary balance levers and may be
  tuned in implementation.

### 6. Level-up flow

`_checkLevelUp` (rl.js:751) keeps the XP-threshold logic and `onLevelUp` hook,
then opens the pick screen:

1. **Draw 4 distinct cards** via a fallback-priority pool so the draw is never
   empty. An entry is *eligible* when it can still be taken: un-owned
   weapons/passives only if their slot type has a free slot; owned
   weapons/passives only below `maxLevel`; stats only below their cap (maxHP) or
   always (move/pickup/armor stack freely).

   The pool is chosen by which categories still have eligible entries:
   - **Weapons still available** → pool = eligible **weapons + passives**.
     **Card 1 is reserved for the `blaster` upgrade** (always present unless
     blaster is maxed; if maxed, this reservation drops and card 1 is a normal
     draw). The other 3 are weighted-random distinct.
   - **All weapons maxed / slots full** → pool = eligible **passives + stats**.
   - **Weapons and passives all exhausted** → pool = **stats only**.

   Cards are weighted by `tier`; anti-repeat is by eligibility (a maxed or
   slot-blocked item is simply not in the pool), not weight-decay. No duplicate
   card within a draw. If fewer than 4 eligible entries exist in the chosen pool,
   the draw shows however many remain (stats always backfill since they stack).
2. Player clicks a card → `addOrUpgradeWeapon` / `addOrUpgradePassive` /
   `applyStat`. There is **no separate stat-point currency or stat menu** —
   stats are ordinary cards.
3. Resume play (stage timer un-paused exactly as today via `pauseStartedAt`).

### 7. Render / HUD — `rlRender.js`

- **Hearts/armor:** ♥ icons top-left; armor shown as distinct pips ahead of
  hearts (depleted first).
- **Kit strip:** weapon icons with level pips (1–3); passive icons with level
  pips.
- **Upgrade screen:** the 4 cards (name, level "Lv2→Lv3" or "NEW", short desc).
  Stat cards render in the same card layout (no separate stat row).
- Weapons with persistent visuals (orbit blades, mines) draw via their optional
  `draw(ctx, entry)` called from a single kit-draw pass, so rl.js no longer needs
  per-effect draw calls like `_drawOrbitRing`.

### 8. Migration / cleanup

- **Remove** `rlUpgrades.js` (`UPGRADE_POOL` + all effect helpers). Its behaviors
  are re-homed: numeric fire/damage → weapon levels; pierce/ricochet/magnet-pull/
  ghost(phase)/shield → passives; thruster→`moveSpeed`, magnet-radius→`pickup`,
  heavyShot/rapidFire→absorbed into weapon levels; orbitRing→`orbitBlades`
  weapon; forkShot→shotgun weapon (+ optional fork passive later). `novaBurst`
  is **dropped from the initial roster** (the `onLevelUp` hook exists so it can
  return as a passive in a later update).
- **`rlState.js`:** drop `upgrades` Map and the scattered effect scratch
  (`orbitAngle`, `ghostUntil`, `ghostCooldownUntil`, `shieldRechargeAt`). Add
  `hearts`/`armor` or delegate to `rlKit`. Keep XP/level/score/wave/stage fields.
  Update `resetRlState` to call `resetKit`.
- **`rl.js`:** replace `_rlFireProjectile` + fixed fire block with `tickKit`;
  replace per-effect helper reads at hit/levelup/player-hit sites with
  `runPassiveHook`; rewrite player-hit path for hearts/armor.
- **Single-player loop in `index.js` is not touched** — Roguelike owns its own
  modules per the mode convention in CLAUDE.md.

## Open / deferred

- Exact tuning numbers (per-weapon cooldown/damage, per-level deltas, draft
  weights, shield recharge, i-frame length) — pinned during planning/balancing.
- Evolutions and weapon-combo unlocks — future update.
- Heart/health pickups during a run — not in scope; renewable defense is the
  `shield` passive only.
