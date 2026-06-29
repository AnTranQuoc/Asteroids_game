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
