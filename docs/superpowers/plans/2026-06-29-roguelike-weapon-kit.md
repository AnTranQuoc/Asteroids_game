# Roguelike Weapon-Kit Power System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Roguelike flat upgrade pool with a kit of independently-firing weapons (cap 4, Lv1–3), behavioral passives (cap 4, Lv1–3), player stats (MoveSpeed/Pickup/MaxHP/Armor), and an hearts/armor health model — all drafted from a 4-card level-up screen with two weapon guardrails.

**Architecture:** Data-driven registries. `rlWeapons.js` and `rlPassives.js` are plain-object registries; `rlKit.js` owns all run-time kit/passive/stat/health state plus the tick, hook-dispatch, draw, and card-draw logic. `rl.js` builds a per-frame `ctx` bundle of callbacks (spawn projectile, kill asteroid, damage enemy, …) and drives the kit through it, so weapons/passives never import canvas/array internals. The old `rlUpgrades.js` is deleted at the end. Single-player (`index.js`) is untouched.

**Tech Stack:** Vanilla ES modules, hand-rolled Canvas 2D. No build, no bundler, no test framework.

## Global Constraints

- **No new dependencies, no build/lint/test tooling.** Everything runs by opening the page over HTTP (`npx live-server`).
- **Verification is manual in the browser** — there is no test runner. Each task ends with explicit browser steps to perform and what to observe.
- **Do not modify the single-player loop in `index.js`** or shared entity classes in `src/entities/`. Roguelike owns its behavior in `src/roguelike/`. (One additive exception: a `damage` field defaulted on `Projectile` — see Task 6 — which single-player ignores.)
- **Mode convention:** Roguelike exports `rlActive()` + `drawRL(now)`; all rl input listeners live in `rl.js`.
- **Commit message style:** present-tense summary prefixed `Roguelike:` (e.g. `Roguelike: weapon-kit firing via tickKit`).
- **Caps:** `WEAPON_CAP = 4`, `PASSIVE_CAP = 4`. Weapons/passives `maxLevel = 3`. Hearts start 1, max `1 + stats.maxHP` (maxHP caps at 2 → max 3 hearts). Armor stat adds 1 expendable armor point per level (no hard cap).
- **Draft tier weights:** `COMMON 100`, `RARE 40`, `LEGENDARY 16`, `STAT 70`.

---

## File structure

| File | Responsibility | Change type |
|------|----------------|-------------|
| `src/roguelike/rlWeapons.js` | Weapon registry: per-weapon `fire`/`cooldownMs`/`draw`/`desc` | **Create** |
| `src/roguelike/rlPassives.js` | Passive registry: per-passive `hooks`/`desc` | **Create** |
| `src/roguelike/rlKit.js` | Kit/passive/stat/health state; `tickKit`, `drawKit`, `runPassiveHook`, `drawCards`, add/upgrade/applyStat, reset | **Create** |
| `src/roguelike/rl.js` | Build per-frame `ctx`; drive kit; hearts/armor damage; upgrade-pick wiring; card click | Modify (largest) |
| `src/roguelike/rlRender.js` | Hearts/armor HUD, kit strip, 4-card + stat-card upgrade screen | Modify |
| `src/roguelike/rlState.js` | Drop `upgrades` Map + effect scratch; keep XP/level/score/wave/stage | Modify |
| `src/roguelike/rlUpgrades.js` | **Deleted** in final task | Delete |

---

## Conventions (read once, applies to all tasks)

**Weapon definition shape** (entries in `WEAPONS`):

```js
{
  id: "blaster",
  name: "Blaster",
  tier: "COMMON",
  maxLevel: 3,
  desc: (lvl) => "…",                  // text for the card showing what level `lvl` gives
  cooldownMs: (lvl) => 260,            // ms between auto-fires; return Infinity to never auto-fire
  fire(ctx, lvl) { /* push projectiles via ctx.spawnProjectile */ },
  draw(ctx, entry, now) { /* OPTIONAL: persistent visuals + own collision (orbit, mines) */ },
}
```

**Passive definition shape** (entries in `PASSIVES`):

```js
{
  id: "pierce",
  name: "Pierce",
  tier: "RARE",
  maxLevel: 3,
  desc: (lvl) => "…",
  hooks: {
    onProjectileSpawn(p, lvl) { /* stamp p.piercing etc. */ },     // OPTIONAL
    onPlayerHit(ctx, lvl) { return false; },                       // OPTIONAL; return true = damage absorbed
    onUpdate(ctx, lvl, now) { /* per-frame, e.g. shield recharge */ }, // OPTIONAL
  },
}
```

**The `ctx` bundle** (built fresh each playing frame by `_buildCtx(now)` in `rl.js`; passed to `tickKit`, `drawKit`, and every hook that takes `ctx`):

```js
{
  player, now,
  PROJECTILES, ASTEROIDS, ENEMIES,
  WORLD_W, WORLD_H,
  stats,                                   // kitState.stats (read-only use)
  runPassiveHook,                          // (name, ...args) => any
  spawnProjectile(x, y, vx, vy, radius, opts),  // creates Projectile, runs onProjectileSpawn, pushes; returns it
  spawnExplosion(coords, radius),
  destroyAsteroid(ast),                    // score + xp orb + split + explosion + remove (mirrors projectile-hit body)
  damageEnemy(e, dmg, coords),             // e.hp -= dmg; on death: score + xp orb + explosion + remove
  spawnXPOrb(coords, amount),
}
```

These callbacks centralise all scoring/XP/array mutation so weapons and passives stay free of canvas and global-array details and the kill logic is written once (DRY).

---

## Task 1: Kit state module + Blaster weapon + tickKit wired

After this task the ship auto-fires its default Blaster through the new kit/registry path (the old fixed fire loop is gone). Passives/stats/hearts come in later tasks; `runPassiveHook` already exists but loops an empty passive list.

**Files:**
- Create: `src/roguelike/rlKit.js`
- Create: `src/roguelike/rlWeapons.js`
- Modify: `src/roguelike/rl.js`

**Interfaces:**
- Produces (`rlKit.js`): `kitState` (object `{ kit, passives, stats:{moveSpeed,pickup,maxHP,armor}, hearts, armor }`), `WEAPON_CAP`, `PASSIVE_CAP`, `resetKit()`, `weaponLevel(id)`, `passiveLevel(id)`, `maxHearts()`, `runPassiveHook(name, ...args)`, `tickKit(ctx, now)`, `drawKit(ctx, now)`.
- Produces (`rlWeapons.js`): `WEAPONS` (object keyed by id), starting with `blaster`.
- Produces (`rl.js`): `_buildCtx(now)` returning the ctx bundle above.
- Consumes: `Projectile` from `entities.js`, `PROJECTILES`/`ASTEROIDS` from `constants.js`, `ENEMIES` from `rlEnemies.js`.

- [ ] **Step 1: Create `rlWeapons.js` with the Blaster**

```js
// src/roguelike/rlWeapons.js
import soundManager from "../audio/soundManager.js";

export const WEAPONS = {
  blaster: {
    id: "blaster",
    name: "Blaster",
    tier: "COMMON",
    maxLevel: 3,
    desc: (lvl) =>
      lvl >= 3 ? "Twin forward bolts" :
      lvl === 2 ? "Faster, heavier bolt" : "Forward bolt",
    cooldownMs: (lvl) => (lvl >= 3 ? 175 : lvl === 2 ? 205 : 260),
    fire(ctx, lvl) {
      const p = ctx.player;
      const rot = p.rotation;
      const speed = 26;
      const radius = 3.4 + lvl * 0.6;
      const muzzle = 45;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const laterals = lvl >= 3 ? [-7, 7] : [0];
      for (const lat of laterals) {
        const x = p.coordinates.x + cos * muzzle - sin * lat;
        const y = p.coordinates.y + sin * muzzle + cos * lat;
        ctx.spawnProjectile(x, y, cos * speed, sin * speed, radius);
      }
      soundManager.playSound("FIRE_SOUND", 0.1);
    },
  },
};
```

- [ ] **Step 2: Create `rlKit.js`**

```js
// src/roguelike/rlKit.js
import { WEAPONS } from "./rlWeapons.js";
import { PASSIVES } from "./rlPassives.js";

export const WEAPON_CAP = 4;
export const PASSIVE_CAP = 4;

// Run-time kit. Mutated in place; reset by resetKit().
export const kitState = {
  kit: [],        // [{ id, level, lastFireAt, runtime:{} }]  weapons, <= WEAPON_CAP
  passives: [],   // [{ id, level }]                          <= PASSIVE_CAP
  stats: { moveSpeed: 0, pickup: 0, maxHP: 0, armor: 0 },
  hearts: 1,
  armor: 0,
};

export function resetKit() {
  kitState.kit = [{ id: "blaster", level: 1, lastFireAt: 0, runtime: {} }];
  kitState.passives = [];
  kitState.stats = { moveSpeed: 0, pickup: 0, maxHP: 0, armor: 0 };
  kitState.hearts = 1;
  kitState.armor = 0;
}

export function maxHearts() { return 1 + kitState.stats.maxHP; }

export function weaponLevel(id) {
  const e = kitState.kit.find((w) => w.id === id);
  return e ? e.level : 0;
}
export function passiveLevel(id) {
  const e = kitState.passives.find((p) => p.id === id);
  return e ? e.level : 0;
}

// Dispatch a hook to every equipped passive. For "onPlayerHit" returns true if
// any passive absorbed the hit; otherwise returns undefined.
export function runPassiveHook(name, ...args) {
  let absorbed = false;
  for (const entry of kitState.passives) {
    const def = PASSIVES[entry.id];
    const fn = def && def.hooks && def.hooks[name];
    if (!fn) continue;
    const r = fn(...args, entry.level);
    if (r === true) absorbed = true;
  }
  return absorbed;
}

// Fire every equipped weapon whose own cooldown has elapsed.
export function tickKit(ctx, now) {
  for (const entry of kitState.kit) {
    const w = WEAPONS[entry.id];
    if (now - entry.lastFireAt >= w.cooldownMs(entry.level)) {
      w.fire(ctx, entry.level);
      entry.lastFireAt = now;
    }
  }
}

// Persistent-visual weapons (orbit, mines) + per-frame passive hooks.
export function drawKit(ctx, now) {
  for (const entry of kitState.kit) {
    const w = WEAPONS[entry.id];
    if (w.draw) w.draw(ctx, entry, now);
  }
  for (const entry of kitState.passives) {
    const def = PASSIVES[entry.id];
    if (def.hooks && def.hooks.onUpdate) def.hooks.onUpdate(ctx, entry.level, now);
  }
}
```

> Note: `rlPassives.js` is created in Task 3. To keep Task 1 runnable on its own, create a one-line stub now and flesh it out in Task 3.

- [ ] **Step 3: Create the `rlPassives.js` stub**

```js
// src/roguelike/rlPassives.js
export const PASSIVES = {};
```

- [ ] **Step 4: Wire ctx + tickKit into `rl.js` — imports**

In `rl.js`, replace the `rlUpgrades` import line (line 17) — leave it for now but add the new imports below it:

```js
import { drawThreeCards, fireIntervalMs, moveSpeedMult, bulletRadiusMult, xpMultiplier, shieldRechargeMs, pierceStacks, ricochetBounces, forkShotShards, magnetRadiusMult, magnetPullsXP, orbitRingCount, orbitRingFastSpin, novaBurstStacks, ghostShipDurationMs } from "./rlUpgrades.js";
import { kitState, resetKit, tickKit, drawKit, runPassiveHook, maxHearts, weaponLevel, passiveLevel } from "./rlKit.js";
```

- [ ] **Step 5: Add `_buildCtx` to `rl.js`**

Add near the other helpers (e.g. just above `_rlFireProjectile`, ~line 287):

```js
function _buildCtx(now) {
  return {
    player, now,
    PROJECTILES, ASTEROIDS, ENEMIES,
    WORLD_W, WORLD_H,
    stats: kitState.stats,
    runPassiveHook,
    spawnProjectile(x, y, vx, vy, radius) {
      const p = new Projectile({ coordinates: { x, y }, velocity: { x: vx, y: vy } });
      p.radius = radius;
      runPassiveHook("onProjectileSpawn", p);
      PROJECTILES.push(p);
      return p;
    },
    spawnExplosion: (coords, radius) => _spawnExplosion(coords, radius),
    destroyAsteroid: (ast) => _destroyAsteroid(ast, now),
    damageEnemy: (e, dmg, coords) => _damageEnemy(e, dmg, coords, now),
    spawnXPOrb: (coords, amount) => _spawnXPOrb(coords, amount, now),
  };
}
```

- [ ] **Step 6: Add `_destroyAsteroid` / `_damageEnemy` helpers to `rl.js`**

Add just below `_buildCtx`. These centralise the kill/score/XP logic currently inline in `_rlDetectProjectileHits` and `_rlDetectEnemyHits`:

```js
function _destroyAsteroid(ast, now) {
  const idx = ASTEROIDS.indexOf(ast);
  if (idx === -1) return;
  addScore(Math.round(15 * (1 - ast.radius / 450)));
  _spawnXPOrb({ ...ast.coordinates }, xpForRadius(ast.radius), now);
  rlState.asteroidsKilled++;
  soundManager.playSound("ASTEROID_HIT", 0.1);
  _spawnExplosion(ast.coordinates, ast.radius);
  const children = splitAsteroid(ast);
  ASTEROIDS.splice(idx, 1);
  Array.prototype.push.apply(ASTEROIDS, children);
  return children;
}

function _damageEnemy(e, dmg, coords, now) {
  e.hp -= dmg;
  soundManager.playSound("ASTEROID_HIT", 0.1);
  if (e.hp <= 0) {
    const isHunter = e.type === "hunter";
    addScore(isHunter ? 40 : 25);
    _spawnXPOrb({ x: e.x, y: e.y }, isHunter ? 20 : 12, now);
    _spawnExplosion({ x: e.x, y: e.y }, e.radius * 2.2);
    const j = ENEMIES.indexOf(e);
    if (j !== -1) ENEMIES.splice(j, 1);
    return true;
  }
  return false;
}
```

- [ ] **Step 7: Replace the fixed fire block with `tickKit`**

In `_playingFrame`, replace (lines ~922–926):

```js
  const fireInterval = fireIntervalMs(220);
  if (now - rlState.lastShotTime >= fireInterval) {
    _rlFireProjectile();
    rlState.lastShotTime = now;
  }
```

with:

```js
  tickKit(_buildCtx(now), now);
```

- [ ] **Step 8: Delete `_rlFireProjectile`**

Remove the whole `_rlFireProjectile` function (lines ~287–305). Its behavior is now `blaster.fire`.

- [ ] **Step 9: Call `resetKit` from `startRun`**

In `startRun(now)` (~line 112), add after `resetRlState(now);`:

```js
  resetKit();
```

- [ ] **Step 10: Verify in browser**

Run `npx live-server`. Open the page → Roguelike → pick Level 1.
Expected: the ship auto-fires single forward bolts continuously (cadence ~260 ms), asteroids still split and score still rises. No console errors. (Pierce/spread/etc. from old upgrades no longer apply — that is expected; they return in later tasks.)

- [ ] **Step 11: Commit**

```bash
git add src/roguelike/rlKit.js src/roguelike/rlWeapons.js src/roguelike/rlPassives.js src/roguelike/rl.js
git commit -m "Roguelike: weapon-kit state + Blaster firing via tickKit"
```

---

## Task 2: Hearts & armor health model

Replaces the current 1-hit-death (+ boolean shield/ghost) with hearts + an expendable armor buffer routed through a single damage function. Shield/phase absorption hooks are wired but no passive provides them yet (Task 3).

**Files:**
- Modify: `src/roguelike/rl.js`
- Modify: `src/roguelike/rlRender.js`

**Interfaces:**
- Produces (`rl.js`): `_applyPlayerDamage(now, coords, fxRadius)` returning `true` if the run ended.
- Produces (`rlRender.js`): `drawHearts()` — draws the heart/armor HUD row.
- Consumes: `kitState`, `maxHearts` from `rlKit.js`.

- [ ] **Step 1: Add the unified damage function to `rl.js`**

Add near the player-hit helpers (replace the existing `_playerTakeHit`, lines ~530–549):

```js
// Apply one hit to the player: passives may absorb; else lose 1 armor, else 1
// heart; 0 hearts ends the run. Grants i-frames. Returns true if run ended.
function _applyPlayerDamage(now, fromCoords, fxRadius) {
  if (runPassiveHook("onPlayerHit", _buildCtx(now))) {
    player.invulnUntil = now + 1500;
    soundManager.playSound("ASTEROID_HIT", 0.1);
    return false;
  }
  _spawnExplosion(fromCoords, fxRadius);
  soundManager.playSound("ASTEROID_HIT", 0.15);
  player.invulnUntil = now + 1500;
  if (kitState.armor > 0) {
    kitState.armor--;
    return false;
  }
  kitState.hearts--;
  if (kitState.hearts <= 0) {
    _triggerDeath(now);
    return true;
  }
  return false;
}
```

- [ ] **Step 2: Route asteroid collision through it**

In `_rlDetectPlayerHit` (lines ~430–460), replace the whole `if (player.shield) { … } else { … }` block (lines ~439–457) with:

```js
    ASTEROIDS.splice(i, 1);
    _applyPlayerDamage(now, ast.coordinates, ast.radius);
    return;
```

(The asteroid that struck the player is consumed regardless.)

- [ ] **Step 3: Route boss collision through it**

In `_rlDetectBossHits` (lines ~506–527), replace the `if (player.shield) { … } else { … }` block with:

```js
  if (boss.collidesWithPlayer(player.coordinates.x, player.coordinates.y)) {
    _applyPlayerDamage(now, { x: player.coordinates.x, y: player.coordinates.y }, 24);
  }
```

- [ ] **Step 4: Update the enemy/bullet guard and calls**

In `_rlDetectEnemyPlayerHits` (lines ~622–642): change the early-return guard line

```js
  if (now < player.invulnUntil || now < rlState.ghostUntil) return false;
```

to

```js
  if (now < player.invulnUntil) return false;
```

and change both `_playerTakeHit(...)` calls to `_applyPlayerDamage(...)` (same arguments).

- [ ] **Step 5: Add `drawHearts` to `rlRender.js`**

Add an export (place near `drawRLScore`). It reads kit state:

```js
import { kitState, maxHearts } from "./rlKit.js";

export function drawHearts() {
  const max = maxHearts();
  const x0 = 16, y = 16, size = 22, gap = 6;
  CONTEXT.save();
  CONTEXT.font = `${size}px monospace`;
  CONTEXT.textAlign = "left";
  CONTEXT.textBaseline = "top";
  for (let i = 0; i < max; i++) {
    CONTEXT.fillStyle = i < kitState.hearts ? "#ff4d6d" : "rgba(255,77,109,0.22)";
    CONTEXT.fillText("♥", x0 + i * (size + gap), y);
  }
  // Armor pips, drawn after the hearts
  const ax = x0 + max * (size + gap) + 8;
  for (let i = 0; i < kitState.armor; i++) {
    CONTEXT.fillStyle = "#8fd3ff";
    CONTEXT.fillText("◆", ax + i * (size + gap), y); // ◆
  }
  CONTEXT.restore();
}
```

- [ ] **Step 6: Call `drawHearts` from the HUD**

In `rl.js` import `drawHearts` from `rlRender.js` (add to the existing `rlRender` import block), and in `_playingFrame` add after `drawRLScore();` (~line 966):

```js
  drawHearts();
```

- [ ] **Step 7: Verify in browser**

Reload. Enter Level 1.
Expected: one red ♥ shows top-left. Fly into an asteroid → brief flash/explosion, i-frames, and the run ends (1 heart, 0 armor). No console errors. (Surviving multiple hits requires MaxHP/Armor stats — Task 4.)

- [ ] **Step 8: Commit**

```bash
git add src/roguelike/rl.js src/roguelike/rlRender.js
git commit -m "Roguelike: hearts + armor health model"
```

---

## Task 3: Passives module + hooks (pierce, ricochet, phase, shield, magnetPull)

Fills in `rlPassives.js` and the remaining hook wiring. Projectile pierce/ricochet behavior already exists in `_rlUpdateProjectiles`/`_rlDetectProjectileHits` reading `p.piercing`/`p.bouncesLeft`/`p.pierceSplit`; passives now stamp those flags via `onProjectileSpawn`. Acquisition happens in Task 4, so verification here grants a passive temporarily.

**Files:**
- Modify: `src/roguelike/rlPassives.js`
- Modify: `src/roguelike/rl.js`

**Interfaces:**
- Produces (`rlPassives.js`): `PASSIVES` with `pierce`, `ricochet`, `phase`, `shield`, `magnetPull`.
- Consumes: `passiveLevel` from `rlKit.js` (already imported in `rl.js`).
- Each passive uses only the hooks listed in the Conventions block.

- [ ] **Step 1: Write the passive registry**

Replace the stub `rlPassives.js` with:

```js
// src/roguelike/rlPassives.js
import { player } from "../entities/entities.js";

export const PASSIVES = {
  pierce: {
    id: "pierce", name: "Pierce", tier: "RARE", maxLevel: 3,
    desc: (lvl) => (lvl >= 3 ? "Shots pierce & split on exit" : "Shots pierce targets"),
    hooks: {
      onProjectileSpawn(p, lvl) {
        p.piercing = true;
        p.pierceSplit = lvl >= 3;
      },
    },
  },
  ricochet: {
    id: "ricochet", name: "Ricochet", tier: "RARE", maxLevel: 3,
    desc: (lvl) => `Shots bounce off walls ${lvl} time${lvl > 1 ? "s" : ""}`,
    hooks: {
      onProjectileSpawn(p, lvl) {
        // Only set if pierce hasn't claimed the shot (pierce takes priority).
        if (!p.piercing) p.bouncesLeft = lvl;
      },
    },
  },
  phase: {
    id: "phase", name: "Phase", tier: "LEGENDARY", maxLevel: 3,
    desc: (lvl) => (lvl >= 3 ? "Phase 12s after a hit, deflects" : `Phase ${lvl * 4}s after a hit`),
    hooks: {
      // Absorb a hit by entering a timed phase (own cooldown via player fields).
      onPlayerHit(ctx, lvl) {
        const now = ctx.now;
        if (now < (player.phaseCooldownUntil || 0)) return false;
        player.phaseUntil = now + lvl * 4000;
        player.phaseCooldownUntil = now + 20000;
        return true;
      },
    },
  },
  shield: {
    id: "shield", name: "Shield", tier: "COMMON", maxLevel: 3,
    desc: (lvl) => { const t = lvl === 1 ? 30 : lvl === 2 ? 15 : 5; return `Shield blocks a hit, recharges ${t}s`; },
    hooks: {
      onPlayerHit(ctx, lvl) {
        if (!player.shield) return false;
        player.shield = false;
        const t = (lvl === 1 ? 30 : lvl === 2 ? 15 : 5) * 1000;
        player.shieldRechargeAt = ctx.now + t;
        return true;
      },
      onUpdate(ctx, lvl, now) {
        // Grant the shield on acquire (shieldRechargeAt 0 & no shield) and recharge it.
        if (!player.shield && player.shieldRechargeAt === 0) { player.shield = true; return; }
        if (!player.shield && player.shieldRechargeAt > 0 && now >= player.shieldRechargeAt) {
          player.shield = true;
          player.shieldRechargeAt = 0;
        }
      },
    },
  },
  magnetPull: {
    id: "magnetPull", name: "Magnet", tier: "RARE", maxLevel: 3,
    desc: (lvl) => `Pulls XP orbs from ${lvl * 140}px`,
    hooks: {}, // read directly in _updateXPOrbs via passiveLevel("magnetPull")
  },
};
```

- [ ] **Step 2: Honor phase i-frames in the player-hit guards**

`phase` sets `player.phaseUntil`. In `_rlDetectPlayerHit` (~line 432) and `_rlDetectBossHits` (~line 506) and `_rlDetectEnemyPlayerHits` (~line 622), the old code checked `rlState.ghostUntil`. Replace every `now < rlState.ghostUntil` check with `now < (player.phaseUntil || 0)`. In `_rlDetectPlayerHit` line 432 specifically:

```js
  if (now < (player.phaseUntil || 0)) return;
```

- [ ] **Step 3: Rewrite magnet pull in `_updateXPOrbs`**

In `_updateXPOrbs` (lines ~182–185), replace:

```js
  const pulls = magnetPullsXP();
  const pickupR = 32 * magnetRadiusMult();
```

with (pickup radius now comes from the `pickup` stat; pull range from the passive):

```js
  const mag = passiveLevel("magnetPull");
  const pulls = mag > 0;
  const pullR = mag * 140;
  const pickupR = 32 * (1 + kitState.stats.pickup * 0.4);
```

Then change the pull condition (lines ~196–202) to only pull when within `pullR`:

```js
    if (pulls && Math.hypot(player.coordinates.x - orb.x, player.coordinates.y - orb.y) < pullR) {
      const dx = player.coordinates.x - orb.x;
      const dy = player.coordinates.y - orb.y;
      const dist = Math.hypot(dx, dy) || 1;
      orb.vx = (dx / dist) * Math.min(8, 280 / dist);
      orb.vy = (dy / dist) * Math.min(8, 280 / dist);
    }
```

(Leave the `if (!pulls) { orb.vx *= 0.96; … }` drag line; harmless when not in range.)

- [ ] **Step 4: Reset phase/shield player fields in `startRun`**

In `startRun` (~line 122) replace the `player.shield = false;` line and add the new fields:

```js
  player.shield = false;
  player.shieldRechargeAt = 0;
  player.phaseUntil = 0;
  player.phaseCooldownUntil = 0;
```

- [ ] **Step 5: Render the phase bubble from the new field**

In `_playingFrame` the ghost bubble block (lines ~943–955) checks `now < rlState.ghostUntil`. Change that condition to `now < (player.phaseUntil || 0)`.

- [ ] **Step 6: Temporary verification grant**

Temporarily, in `startRun` after `resetKit();`, add:

```js
  kitState.passives.push({ id: "pierce", level: 3 }); // TEMP — remove after verifying
```

- [ ] **Step 7: Verify in browser**

Reload, enter Level 1. Expected: bolts pass through asteroids (pierce) and, on leaving a rock, spawn small split fragments (Lv3 split). No console errors.

- [ ] **Step 8: Remove the temporary grant**

Delete the TEMP line added in Step 6.

- [ ] **Step 9: Commit**

```bash
git add src/roguelike/rlPassives.js src/roguelike/rl.js
git commit -m "Roguelike: behavioral passives + hook wiring"
```

---

## Task 4: 4-card draw + upgrade-pick UI + stats

Implements `drawCards()` (mixed pool + the two weapon guardrails), the apply functions, the stat definitions, and the rewritten upgrade screen showing 4 cards (weapons/passives/stats). After this, leveling up lets you upgrade Blaster or pick a stat; picking MaxHP grants a heart so you can survive a second hit.

**Files:**
- Modify: `src/roguelike/rlKit.js`
- Modify: `src/roguelike/rl.js`
- Modify: `src/roguelike/rlRender.js`

**Interfaces:**
- Produces (`rlKit.js`): `STAT_DEFS` (array), `addOrUpgradeWeapon(id)`, `addOrUpgradePassive(id)`, `applyStat(id)`, `drawCards()` → array of card objects.
- Card object shape (consumed by `rlRender.js` + `rl.js`): `{ kind:"weapon"|"passive"|"stat", id, name, tier, level, nextLevel, maxLevel, isUpgrade, desc }` where `desc` is a resolved string.
- Consumes: `WEAPONS`, `PASSIVES`, `kitState`, caps.

- [ ] **Step 1: Add tier weights, stat defs, and apply functions to `rlKit.js`**

Append to `rlKit.js`:

```js
const TIER_WEIGHT = { COMMON: 100, RARE: 40, LEGENDARY: 16, STAT: 70 };

export const STAT_DEFS = [
  { id: "moveSpeed", name: "Move Speed", maxLevel: Infinity, desc: (lvl) => `+${lvl * 12}% move speed` },
  { id: "pickup",    name: "Pickup",     maxLevel: Infinity, desc: (lvl) => `+${lvl * 40}% pickup radius` },
  { id: "maxHP",     name: "Max HP",     maxLevel: 2,        desc: () => "+1 max heart" },
  { id: "armor",     name: "Armor",      maxLevel: Infinity, desc: (lvl) => `+1 armor (now ${lvl})` },
];

export function addOrUpgradeWeapon(id) {
  const e = kitState.kit.find((w) => w.id === id);
  if (e) { if (e.level < WEAPONS[id].maxLevel) e.level++; }
  else if (kitState.kit.length < WEAPON_CAP) kitState.kit.push({ id, level: 1, lastFireAt: 0, runtime: {} });
}

export function addOrUpgradePassive(id) {
  const e = kitState.passives.find((p) => p.id === id);
  if (e) { if (e.level < PASSIVES[id].maxLevel) e.level++; }
  else if (kitState.passives.length < PASSIVE_CAP) kitState.passives.push({ id, level: 1 });
}

export function applyStat(id) {
  kitState.stats[id]++;
  if (id === "maxHP") kitState.hearts++;   // fill the new heart
  if (id === "armor") kitState.armor++;    // fill the new armor point
}
```

- [ ] **Step 2: Add the eligibility + card-builder helpers to `rlKit.js`**

Append:

```js
function statLevel(id) { return kitState.stats[id]; }
function statMax(id) { return STAT_DEFS.find((s) => s.id === id).maxLevel; }

// Build the full eligible candidate pool as card objects.
function _eligibleCards() {
  const cards = [];
  const slotW = kitState.kit.length < WEAPON_CAP;
  const slotP = kitState.passives.length < PASSIVE_CAP;

  for (const id in WEAPONS) {
    const lvl = weaponLevel(id);
    if ((lvl === 0 && slotW) || (lvl > 0 && lvl < WEAPONS[id].maxLevel)) {
      cards.push(_weaponCard(id));
    }
  }
  for (const id in PASSIVES) {
    const lvl = passiveLevel(id);
    if ((lvl === 0 && slotP) || (lvl > 0 && lvl < PASSIVES[id].maxLevel)) {
      cards.push(_passiveCard(id));
    }
  }
  for (const s of STAT_DEFS) {
    if (statLevel(s.id) < statMax(s.id)) cards.push(_statCard(s.id));
  }
  return cards;
}

function _weaponCard(id) {
  const w = WEAPONS[id], lvl = weaponLevel(id);
  return { kind: "weapon", id, name: w.name, tier: w.tier, level: lvl, nextLevel: lvl + 1, maxLevel: w.maxLevel, isUpgrade: lvl > 0, desc: w.desc(lvl + 1) };
}
function _passiveCard(id) {
  const p = PASSIVES[id], lvl = passiveLevel(id);
  return { kind: "passive", id, name: p.name, tier: p.tier, level: lvl, nextLevel: lvl + 1, maxLevel: p.maxLevel, isUpgrade: lvl > 0, desc: p.desc(lvl + 1) };
}
function _statCard(id) {
  const s = STAT_DEFS.find((d) => d.id === id), lvl = statLevel(id);
  return { kind: "stat", id, name: s.name, tier: "STAT", level: lvl, nextLevel: lvl + 1, maxLevel: s.maxLevel, isUpgrade: lvl > 0, desc: s.desc(lvl + 1) };
}

function _weightOf(card) { return TIER_WEIGHT[card.tier]; }

// Pull one weighted-random card out of `pool` (mutates pool), or null if empty.
function _takeWeighted(pool) {
  if (pool.length === 0) return null;
  const total = pool.reduce((s, c) => s + _weightOf(c), 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= _weightOf(pool[i]);
    if (r <= 0) return pool.splice(i, 1)[0];
  }
  return pool.splice(pool.length - 1, 1)[0];
}
```

- [ ] **Step 3: Implement `drawCards()` with the two guardrails**

Append:

```js
export function drawCards() {
  const pool = _eligibleCards();
  const picked = [];

  // G1: blaster upgrade is always card 1 unless blaster is maxed.
  const blasterIdx = pool.findIndex((c) => c.kind === "weapon" && c.id === "blaster");
  if (blasterIdx !== -1) {
    picked.push(pool.splice(blasterIdx, 1)[0]);
  } else {
    // G2: blaster maxed — force one other weapon card if any weapon is eligible.
    const wIdx = pool.findIndex((c) => c.kind === "weapon");
    if (wIdx !== -1) picked.push(pool.splice(wIdx, 1)[0]);
  }

  while (picked.length < 4) {
    const c = _takeWeighted(pool);
    if (!c) break;
    picked.push(c);
  }
  return picked;
}
```

- [ ] **Step 4: Wire the new functions into `rl.js`**

Extend the `rlKit` import in `rl.js` (Task 1's import line) to add the new names:

```js
import { kitState, resetKit, tickKit, drawKit, runPassiveHook, maxHearts, weaponLevel, passiveLevel, addOrUpgradeWeapon, addOrUpgradePassive, applyStat, drawCards } from "./rlKit.js";
```

- [ ] **Step 5: Use `drawCards()` in `_openUpgradePick`**

In `_openUpgradePick` (~line 780) replace `upgradeCards = drawThreeCards();` with:

```js
  upgradeCards = drawCards();
```

- [ ] **Step 6: Rewrite `_pickUpgrade` to take a card object**

Replace `_pickUpgrade` (~lines 796–803) with:

```js
function _pickUpgrade(card) {
  if (rlState.pauseStartedAt) {
    rlState.stageStartTime += performance.now() - rlState.pauseStartedAt;
    rlState.pauseStartedAt = 0;
  }
  if (card.kind === "weapon") addOrUpgradeWeapon(card.id);
  else if (card.kind === "passive") addOrUpgradePassive(card.id);
  else applyStat(card.id);
  rlState.screen = boss ? "boss" : "playing";
}
```

- [ ] **Step 7: Pass the card object from the click handler**

In the `mousedown` handler (~line 1026) change `_pickUpgrade(upgradeCards[i].id);` to:

```js
        _pickUpgrade(upgradeCards[i]);
```

- [ ] **Step 8: Update the upgrade overlay for 4 cards + new shape (`rlRender.js`)**

In `rlRender.js`: remove the now-unused import `import { UPGRADE_POOL } from "./rlUpgrades.js";` (line 5). Add a `STAT` tier color:

```js
const TIER_COLORS = {
  COMMON:    { accent: "126,245,170", label: "COMMON" },
  RARE:      { accent: "120,200,255", label: "RARE" },
  LEGENDARY: { accent: "255,215,80",  label: "LEGENDARY" },
  STAT:      { accent: "200,170,255", label: "STAT" },
};
```

Replace `getUpgradeCardButtons` (the `* 3` layout) so it lays out 4 cards:

```js
export function getUpgradeCardButtons(cards) {
  const n = cards.length;
  const totalW = CARD_W * n + CARD_GAP * (n - 1);
  const startX = CANVAS.width / 2 - totalW / 2;
  const startY = CANVAS.height / 2 - CARD_H / 2 + 20;
  return cards.map((card, i) => ({
    id: "upgrade",
    upgradeId: card.id,
    x: startX + i * (CARD_W + CARD_GAP),
    y: startY,
    w: CARD_W,
    h: CARD_H,
  }));
}
```

> Note: `CARD_W = 190` × 4 + gaps = 820px; the arena canvas is wider than this, so 4 cards fit. If a future canvas is narrower, reduce `CARD_W`.

- [ ] **Step 9: Update the card body render for the new card shape**

In `drawUpgradeOverlay`, the per-card block currently calls `card.desc(card.nextStacks)` and uses `card.currentStacks`/`card.nextStacks`. Replace the description line (~line 194):

```js
    const desc = card.desc(card.nextStacks);
```

with (desc is now a plain string):

```js
    const desc = card.desc;
```

And replace the "Stack dots" block (~lines 197–215) with a level-pip block that handles finite vs unbounded levels:

```js
    // Level pips (finite maxLevel) or "Lv N" text (unbounded stats)
    if (Number.isFinite(card.maxLevel)) {
      const dots = card.maxLevel;
      const dotR = 4, dotGap = 10;
      const dotsW = dots * (dotR * 2 + dotGap) - dotGap;
      let dotX = btn.x + btn.w / 2 - dotsW / 2 + dotR;
      const dotY = btn.y + CARD_H - 28;
      for (let d = 0; d < dots; d++) {
        CONTEXT.beginPath();
        CONTEXT.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        if (d < card.nextLevel) {
          CONTEXT.fillStyle = `rgb(${accent})`;
          CONTEXT.shadowColor = `rgb(${accent})`;
          CONTEXT.shadowBlur = 6;
        } else {
          CONTEXT.fillStyle = "rgba(255,255,255,0.12)";
          CONTEXT.shadowBlur = 0;
        }
        CONTEXT.fill();
        dotX += dotR * 2 + dotGap;
      }
      CONTEXT.shadowBlur = 0;
    } else {
      CONTEXT.font = "11px monospace";
      CONTEXT.fillStyle = `rgb(${accent})`;
      CONTEXT.fillText(`Lv ${card.nextLevel}`, btn.x + btn.w / 2, btn.y + CARD_H - 28);
    }
```

Also update the tier-badge text (~line 181) `card.isUpgrade ? \`${card.tier} · UPGRADE\` : card.tier` — this still works unchanged.

- [ ] **Step 10: Verify in browser**

Reload, enter Level 1. Kill rocks until level-up.
Expected: 4 cards appear. Card 1 is always **Blaster** (UPGRADE) until it reaches Lv3. Stat cards (Move Speed / Pickup / Max HP / Armor) and any passives also appear. Click **Max HP** → a second ♥ appears and you can now survive two asteroid hits. Click **Blaster** three times across level-ups → it stops being offered (maxed) and card 1 becomes another weapon/whatever is eligible. No console errors.

- [ ] **Step 11: Commit**

```bash
git add src/roguelike/rlKit.js src/roguelike/rl.js src/roguelike/rlRender.js
git commit -m "Roguelike: 4-card mixed draw, weapon guardrails, stats UI"
```

---

## Task 5: Orbit Blades weapon

A weapon that never fires projectiles (cooldown `Infinity`) but spins damaging orbs around the ship via its `draw` hook — re-homing the old `_drawOrbitRing` into the registry.

**Files:**
- Modify: `src/roguelike/rlWeapons.js`

**Interfaces:**
- Produces: `WEAPONS.orbitBlades`.
- Consumes: `ctx.destroyAsteroid`, `ctx.damageEnemy`, `CONTEXT`.

- [ ] **Step 1: Import CONTEXT in `rlWeapons.js`**

At the top of `rlWeapons.js` add:

```js
import { CONTEXT } from "../core/canvas.js";
```

- [ ] **Step 2: Add the weapon**

Add to the `WEAPONS` object:

```js
  orbitBlades: {
    id: "orbitBlades",
    name: "Orbit Blades",
    tier: "LEGENDARY",
    maxLevel: 3,
    desc: (lvl) => `${lvl * 2} orbiting blades${lvl >= 3 ? ", fast spin" : ""}`,
    cooldownMs: () => Infinity,   // never auto-fires; behaves via draw()
    fire() {},
    draw(ctx, entry, now) {
      const lvl = entry.level;
      const count = lvl * 2;
      const rt = entry.runtime;
      if (rt.angle === undefined) { rt.angle = 0; rt.cd = []; }
      rt.angle += lvl >= 3 ? 0.06 : 0.035;
      const orbitR = 58, orbR = 7;
      const px = ctx.player.coordinates.x, py = ctx.player.coordinates.y;
      for (let i = 0; i < count; i++) {
        const a = rt.angle + (Math.PI * 2 * i) / count;
        const ox = px + Math.cos(a) * orbitR;
        const oy = py + Math.sin(a) * orbitR;
        const onCd = now < (rt.cd[i] || 0);
        if (!onCd || Math.floor(now / 80) % 2 === 0) {
          CONTEXT.save();
          CONTEXT.beginPath();
          CONTEXT.arc(ox, oy, orbR, 0, Math.PI * 2);
          CONTEXT.fillStyle = onCd ? "rgba(180,180,220,0.45)" : "rgba(255,215,80,0.85)";
          CONTEXT.shadowColor = onCd ? "#8888cc" : "#ffd750";
          CONTEXT.shadowBlur = 12;
          CONTEXT.fill();
          CONTEXT.restore();
        }
        if (onCd) continue;
        for (const ast of ctx.ASTEROIDS.slice()) {
          if (Math.hypot(ox - ast.coordinates.x, oy - ast.coordinates.y) < orbR + ast.radius) {
            ctx.destroyAsteroid(ast);
            rt.cd[i] = now + 1200;
            break;
          }
        }
        if (now < (rt.cd[i] || 0)) continue;
        for (const e of ctx.ENEMIES.slice()) {
          if (Math.hypot(ox - e.x, oy - e.y) < orbR + e.radius) {
            ctx.damageEnemy(e, 1, { x: e.x, y: e.y });
            rt.cd[i] = now + 1200;
            break;
          }
        }
      }
    },
  },
```

- [ ] **Step 3: Ensure `drawKit` runs each frame**

In `rl.js` `_playingFrame`, the old `_drawOrbitRing(now)` call (~line 940) is replaced by the kit draw pass. Add (inside the camera transform, where world-space effects draw — i.e. before `CONTEXT.restore();` at ~line 957):

```js
  drawKit(_buildCtx(now), now);
```

(Leave the old `_drawOrbitRing(now)` line for now; it returns early because no upgrade stacks exist. It is deleted in Task 9.)

- [ ] **Step 4: Verify in browser**

Reload, enter Level 1, level up, and pick **Orbit Blades** (LEGENDARY — may take a few level-ups to appear; reroll by leveling). Expected: 2 golden orbs orbit the ship and destroy rocks/enemies they touch, then flicker on a short cooldown. Picking it again adds orbs / speeds the spin. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/roguelike/rlWeapons.js src/roguelike/rl.js
git commit -m "Roguelike: Orbit Blades weapon"
```

---

## Task 6: Railgun weapon + projectile damage

Adds a slow, always-piercing, high-damage long-range shot, and introduces a `damage` field on projectiles so enemies take more than 1 per hit.

**Files:**
- Modify: `src/roguelike/rl.js` (spawnProjectile default + enemy-hit refactor)
- Modify: `src/roguelike/rlWeapons.js`

**Interfaces:**
- Produces: `WEAPONS.railgun`; projectiles carry `p.damage` (default 1).
- Consumes: `_damageEnemy`.

- [ ] **Step 1: Default `damage` in `spawnProjectile`**

In `rl.js` `_buildCtx`, in the `spawnProjectile` body, after `p.radius = radius;` add:

```js
      p.damage = 1;
```

- [ ] **Step 2: Make enemy hits use `p.damage`**

Replace the body of `_rlDetectEnemyHits` (lines ~599–618) with a version that routes through `_damageEnemy` and respects damage + pierce:

```js
function _rlDetectEnemyHits(now) {
  for (let i = PROJECTILES.length - 1; i >= 0; i--) {
    const proj = PROJECTILES[i];
    for (let j = ENEMIES.length - 1; j >= 0; j--) {
      const e = ENEMIES[j];
      if (Math.hypot(proj.coordinates.x - e.x, proj.coordinates.y - e.y) >= proj.radius + e.radius) continue;
      _damageEnemy(e, proj.damage || 1, { x: e.x, y: e.y }, now);
      if (!proj.piercing) { PROJECTILES.splice(i, 1); break; }
    }
  }
}
```

- [ ] **Step 3: Add the Railgun**

Add to `WEAPONS`:

```js
  railgun: {
    id: "railgun",
    name: "Railgun",
    tier: "RARE",
    maxLevel: 3,
    desc: (lvl) => `Piercing rail bolt, ${3 + lvl} dmg`,
    cooldownMs: (lvl) => (lvl >= 3 ? 820 : lvl === 2 ? 980 : 1120),
    fire(ctx, lvl) {
      const p = ctx.player;
      const rot = p.rotation;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const proj = ctx.spawnProjectile(
        p.coordinates.x + cos * 45, p.coordinates.y + sin * 45,
        cos * 34, sin * 34, 6 + lvl
      );
      proj.piercing = true;       // always pierces, independent of Pierce passive
      proj.damage = 3 + lvl;
      proj.maxDistance = 1400;
      soundManager.playSound("FIRE_SOUND", 0.18);
    },
  },
```

- [ ] **Step 4: Verify in browser**

Reload, level up, pick **Railgun**. Expected: a fat fast bolt fires roughly once per second, passes through multiple asteroids in a line, and visibly kills hunters faster than the Blaster (≥4 damage). Both Blaster and Railgun fire on their own cadences simultaneously. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/roguelike/rl.js src/roguelike/rlWeapons.js
git commit -m "Roguelike: Railgun weapon + projectile damage field"
```

---

## Task 7: Shotgun weapon

A short-range cone of pellets.

**Files:**
- Modify: `src/roguelike/rlWeapons.js`

**Interfaces:**
- Produces: `WEAPONS.shotgun`.

- [ ] **Step 1: Add the Shotgun**

Add to `WEAPONS`:

```js
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    tier: "COMMON",
    maxLevel: 3,
    desc: (lvl) => `${3 + lvl} short-range pellets${lvl >= 3 ? ", wide" : ""}`,
    cooldownMs: (lvl) => 760 - lvl * 70,
    fire(ctx, lvl) {
      const p = ctx.player;
      const rot = p.rotation;
      const pellets = 3 + lvl;
      const arc = lvl >= 3 ? 0.9 : 0.6;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      for (let i = 0; i < pellets; i++) {
        const frac = pellets === 1 ? 0.5 : i / (pellets - 1);
        const a = rot + arc * (frac - 0.5);
        const proj = ctx.spawnProjectile(
          p.coordinates.x + cos * 40, p.coordinates.y + sin * 40,
          Math.cos(a) * 22, Math.sin(a) * 22, 3
        );
        proj.maxDistance = 230;
      }
      soundManager.playSound("FIRE_SOUND", 0.12);
    },
  },
```

- [ ] **Step 2: Verify in browser**

Reload, level up, pick **Shotgun**. Expected: a fan of 4 pellets fires at close range and dissipates after a short distance (~230px); great against clustered nearby rocks, weak at range. No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/roguelike/rlWeapons.js
git commit -m "Roguelike: Shotgun weapon"
```

---

## Task 8: Mines weapon

Drops proximity mines that arm, then detonate when a target nears, dealing area damage.

**Files:**
- Modify: `src/roguelike/rlWeapons.js`

**Interfaces:**
- Produces: `WEAPONS.mines`. Mine state lives in `entry.runtime.mines`.
- Consumes: `ctx.spawnExplosion`, `ctx.destroyAsteroid`, `ctx.damageEnemy`, `CONTEXT`.

- [ ] **Step 1: Add the Mines weapon**

Add to `WEAPONS`:

```js
  mines: {
    id: "mines",
    name: "Mines",
    tier: "RARE",
    maxLevel: 3,
    desc: (lvl) => `Proximity mines, ${60 + lvl * 25}px blast`,
    cooldownMs: () => 1500,
    fire(ctx, lvl) {
      const rt = ctx._mineEntry.runtime;
      if (!rt.mines) rt.mines = [];
      if (rt.mines.length >= 6) rt.mines.shift();
      rt.mines.push({
        x: ctx.player.coordinates.x, y: ctx.player.coordinates.y,
        armAt: ctx.now + 600, blast: 60 + lvl * 25,
      });
      soundManager.playSound("FIRE_SOUND", 0.1);
    },
    draw(ctx, entry, now) {
      const rt = entry.runtime;
      if (!rt.mines) rt.mines = [];
      ctx._mineEntry = entry; // so fire() can reach this entry's runtime
      for (let i = rt.mines.length - 1; i >= 0; i--) {
        const m = rt.mines[i];
        const armed = now >= m.armAt;
        CONTEXT.save();
        CONTEXT.beginPath();
        CONTEXT.arc(m.x, m.y, 5, 0, Math.PI * 2);
        CONTEXT.fillStyle = armed ? (Math.floor(now / 250) % 2 ? "#ff5050" : "#aa2222") : "rgba(255,120,120,0.4)";
        CONTEXT.shadowColor = "#ff5050";
        CONTEXT.shadowBlur = 8;
        CONTEXT.fill();
        CONTEXT.restore();
        if (!armed) continue;
        const near =
          ctx.ASTEROIDS.some((a) => Math.hypot(a.coordinates.x - m.x, a.coordinates.y - m.y) < a.radius + 18) ||
          ctx.ENEMIES.some((e) => Math.hypot(e.x - m.x, e.y - m.y) < e.radius + 18);
        if (!near) continue;
        ctx.spawnExplosion({ x: m.x, y: m.y }, m.blast);
        for (const a of ctx.ASTEROIDS.slice()) {
          if (Math.hypot(a.coordinates.x - m.x, a.coordinates.y - m.y) < m.blast) ctx.destroyAsteroid(a);
        }
        for (const e of ctx.ENEMIES.slice()) {
          if (Math.hypot(e.x - m.x, e.y - m.y) < m.blast) ctx.damageEnemy(e, 3, { x: e.x, y: e.y });
        }
        rt.mines.splice(i, 1);
      }
    },
  },
```

> Note: `fire()` runs from `tickKit` (no `entry` arg), so it reaches its runtime via `ctx._mineEntry`, which `draw()` sets each frame. `draw()` runs every frame for equipped weapons, so `_mineEntry` is always current before the next `fire()`.

- [ ] **Step 2: Verify in browser**

Reload, level up, pick **Mines**. Expected: a red dot drops at the ship every ~1.5s, blinks once armed, and detonates in an explosion when a rock or enemy gets close, clearing nearby targets. At most 6 mines exist at once. No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/roguelike/rlWeapons.js
git commit -m "Roguelike: Mines weapon"
```

---

## Task 9: Remove `rlUpgrades.js` and dead state

Deletes the old system and rewires the last few call sites that still read it (movement speed, magnet/pickup, ghost indicator, fork shards, nova, orbit). After this, no code imports `rlUpgrades.js` or the removed `rlState` fields.

**Files:**
- Delete: `src/roguelike/rlUpgrades.js`
- Modify: `src/roguelike/rl.js`
- Modify: `src/roguelike/rlState.js`

**Interfaces:**
- Consumes: `kitState.stats`, `passiveLevel` (already imported).

- [ ] **Step 1: Remove the `rlUpgrades` import from `rl.js`**

Delete the entire `import { drawThreeCards, fireIntervalMs, … } from "./rlUpgrades.js";` line (Task 1's line 17). Also remove `getStackCount, addUpgradeStack` from the `rlState` import (line 16) — they are no longer used.

- [ ] **Step 2: Rewrite movement speed**

In `_playingFrame` (movement, ~line 875) replace:

```js
    if (getStackCount("thruster") > 0) m *= moveSpeedMult();
```

with:

```js
    m *= 1 + kitState.stats.moveSpeed * 0.12;
```

- [ ] **Step 3: Rewrite power-up pickup radius**

In `_rlUpdatePowerUps` (~line 682) replace:

```js
  const magMult = magnetRadiusMult();
```

with:

```js
  const magMult = 1 + kitState.stats.pickup * 0.4;
```

- [ ] **Step 4: Delete the old orbit-ring function + call + state**

Remove the entire `_drawOrbitRing` function (lines ~699–748), the `_drawOrbitRing(now);` call in `_playingFrame` (~line 940), and the `const ORBIT_COOLDOWNS = [];` declaration (line 37) plus the `ORBIT_COOLDOWNS.length = 0;` line in `_clearRunState` (~line 105).

- [ ] **Step 5: Remove fork shards + xpMultiplier from projectile hits**

In `_rlDetectProjectileHits`, replace the kill body (lines ~364–377) — the `addScore` / `xpForRadius * xpMultiplier` / `_spawnXPOrb` / `splitAsteroid` / fork-shard block — with a single call to the shared helper:

```js
      const children = _destroyAsteroid(ast, now);
```

Delete the fork-shard block entirely (lines ~373–395, the `const shards = forkShotShards();` through the `if (shards > 0) { … }` loop). Keep the pierce/ricochet handling below it (lines ~397–425) unchanged — but note `children` is now the return of `_destroyAsteroid` and the asteroid is already spliced, so remove the now-duplicated `ASTEROIDS.splice(j, 1); Array.prototype.push.apply(ASTEROIDS, children);` lines (~376–377) since `_destroyAsteroid` did that.

- [ ] **Step 6: Remove the Nova block from `_checkLevelUp`**

In `_checkLevelUp` (~lines 757–775) delete the entire `const nova = novaBurstStacks(); if (nova > 0) { … }` block. (Nova is dropped from the initial roster; the `onLevelUp` hook remains available for a future passive but nothing calls it yet, so no call site is added.)

- [ ] **Step 7: Fix the ghost/phase indicator**

In `_playingFrame` (~line 970) replace:

```js
  if (getStackCount("ghostShip") > 0) _drawGhostIndicator(now);
```

with:

```js
  if (passiveLevel("phase") > 0) _drawGhostIndicator(now);
```

Then in `_drawGhostIndicator` (find it via search) replace any read of `rlState.ghostCooldownUntil` / `rlState.ghostUntil` with `player.phaseCooldownUntil` / `player.phaseUntil`.

- [ ] **Step 8: Clean `rlState.js`**

In `rlState.js` remove the upgrade machinery and effect scratch:
- Delete the `upgrades: new Map(),` field and the `// Map<upgradeId, stackCount>` comment.
- Delete the `orbitAngle`, `ghostUntil`, `ghostCooldownUntil`, `shieldRechargeAt` fields and the `// upgrade effects` comment.
- In `resetRlState`, delete the matching reset lines (`rlState.orbitAngle = 0;`, `rlState.ghostUntil = 0;`, `rlState.ghostCooldownUntil = 0;`, `rlState.shieldRechargeAt = 0;`, `rlState.upgrades = new Map();`).
- Delete the `getStackCount` and `addUpgradeStack` functions.

(Keep `upgradesPickedCount` only if still referenced; if Step 1–7 removed its last writer `addUpgradeStack`, also delete the `upgradesPickedCount` field and its reset line.)

- [ ] **Step 9: Delete the file**

```bash
git rm src/roguelike/rlUpgrades.js
```

- [ ] **Step 10: Grep for leftovers**

Run:

```bash
grep -rn "rlUpgrades\|getStackCount\|drawThreeCards\|ghostUntil\|ORBIT_COOLDOWNS\|forkShotShards\|novaBurst\|moveSpeedMult\|magnetRadiusMult" src/roguelike/
```

Expected: **no matches**. Fix any that remain.

- [ ] **Step 11: Full regression in browser**

Reload, play a full Level 1 run:
- Ship fires Blaster from the start; 1 heart shown.
- Level-ups always offer a Blaster card (until maxed) + 3 others; stats/passives/weapons all appear.
- Acquire a second weapon → two independent fire cadences.
- Acquire Pierce/Ricochet → all weapons' bolts change behavior.
- Max HP → extra hearts; Armor → armor pips consumed before hearts; Shield → blocks a hit and recharges.
- Reach the boss; defeat it → win screen. No console errors anywhere.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Roguelike: remove legacy rlUpgrades + dead state"
```

---

## Task 10: In-play kit strip HUD

Shows the equipped weapons and passives with level pips during play (spec §6), so the player can see their build. Display-only; depends only on `kitState`.

**Files:**
- Modify: `src/roguelike/rlRender.js`
- Modify: `src/roguelike/rl.js`

**Interfaces:**
- Produces (`rlRender.js`): `drawKitStrip()`.
- Consumes: `kitState` (already imported in `rlRender.js` from Task 2), `WEAPONS`, `PASSIVES`.

- [ ] **Step 1: Add `drawKitStrip` to `rlRender.js`**

Add imports at the top of `rlRender.js`:

```js
import { WEAPONS } from "./rlWeapons.js";
import { PASSIVES } from "./rlPassives.js";
```

Add the function:

```js
export function drawKitStrip() {
  const rowH = 16;
  const x = 16;
  let y = 48; // below the hearts row
  CONTEXT.save();
  CONTEXT.font = "11px monospace";
  CONTEXT.textAlign = "left";
  CONTEXT.textBaseline = "middle";

  const rows = [
    ...kitState.kit.map((e) => ({ name: WEAPONS[e.id].name, level: e.level, max: WEAPONS[e.id].maxLevel, color: "#7ef5aa" })),
    ...kitState.passives.map((e) => ({ name: PASSIVES[e.id].name, level: e.level, max: PASSIVES[e.id].maxLevel, color: "#c8aaff" })),
  ];

  for (const r of rows) {
    CONTEXT.fillStyle = r.color;
    CONTEXT.fillText(r.name, x, y);
    // level pips
    const px0 = x + 120;
    for (let d = 0; d < r.max; d++) {
      CONTEXT.beginPath();
      CONTEXT.arc(px0 + d * 10, y, 3, 0, Math.PI * 2);
      CONTEXT.fillStyle = d < r.level ? r.color : "rgba(255,255,255,0.15)";
      CONTEXT.fill();
    }
    y += rowH;
  }
  CONTEXT.restore();
}
```

- [ ] **Step 2: Call it from `_playingFrame`**

In `rl.js` add `drawKitStrip` to the `rlRender` import block, and call it in `_playingFrame` right after `drawHearts();`:

```js
  drawKitStrip();
```

- [ ] **Step 3: Verify in browser**

Reload, play, and acquire a couple of weapons/passives. Expected: under the hearts, a list shows each equipped weapon (green) and passive (purple) with filled pips equal to its level (out of its max). Pips update as you level items up. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/roguelike/rlRender.js src/roguelike/rl.js
git commit -m "Roguelike: in-play kit strip HUD"
```

---

## Notes on tuning

All numbers (cooldowns, damage, per-level deltas, draft weights, blast radii, orbit cooldown, i-frames) are starting values chosen to be playable, not balanced. Expect a tuning pass after the system is verified end-to-end. The single knob most worth revisiting first: with 1 starting heart and no regen, early survival leans entirely on the Shield/Phase passives and i-frames — adjust starting hearts or i-frame length if runs feel too swingy.
