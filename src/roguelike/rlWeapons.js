// src/roguelike/rlWeapons.js
import soundManager from "../audio/soundManager.js";
import { CONTEXT } from "../core/canvas.js";

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
};
