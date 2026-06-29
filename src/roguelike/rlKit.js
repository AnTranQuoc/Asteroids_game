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

// ── Upgrade draft ─────────────────────────────────────────────────────────────
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

function statLevel(id) { return kitState.stats[id]; }
function statMax(id) { return STAT_DEFS.find((s) => s.id === id).maxLevel; }

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

// Build the full eligible candidate pool as card objects.
function _eligibleCards() {
  const cards = [];
  const slotW = kitState.kit.length < WEAPON_CAP;
  const slotP = kitState.passives.length < PASSIVE_CAP;

  for (const id in WEAPONS) {
    const lvl = weaponLevel(id);
    if ((lvl === 0 && slotW) || (lvl > 0 && lvl < WEAPONS[id].maxLevel)) cards.push(_weaponCard(id));
  }
  for (const id in PASSIVES) {
    const lvl = passiveLevel(id);
    if ((lvl === 0 && slotP) || (lvl > 0 && lvl < PASSIVES[id].maxLevel)) cards.push(_passiveCard(id));
  }
  for (const s of STAT_DEFS) {
    if (statLevel(s.id) < statMax(s.id)) cards.push(_statCard(s.id));
  }
  return cards;
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
