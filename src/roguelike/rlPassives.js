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
