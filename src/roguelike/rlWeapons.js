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
        for (let ai = ctx.ASTEROIDS.length - 1; ai >= 0; ai--) {
          const ast = ctx.ASTEROIDS[ai];
          if (Math.hypot(ox - ast.coordinates.x, oy - ast.coordinates.y) < orbR + ast.radius) {
            ctx.destroyAsteroid(ast);
            rt.cd[i] = now + 1200;
            break;
          }
        }
        if (now < (rt.cd[i] || 0)) continue;
        for (let ei = ctx.ENEMIES.length - 1; ei >= 0; ei--) {
          const e = ctx.ENEMIES[ei];
          if (Math.hypot(ox - e.x, oy - e.y) < orbR + e.radius) {
            ctx.damageEnemy(e, 1, { x: e.x, y: e.y });
            rt.cd[i] = now + 1200;
            break;
          }
        }
      }
    },
  },

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

  mines: {
    id: "mines",
    name: "Mines",
    tier: "RARE",
    maxLevel: 3,
    desc: (lvl) => `Proximity mines, ${60 + lvl * 25}px blast`,
    cooldownMs: () => 1500,
    fire(ctx, lvl, entry) {
      const rt = entry.runtime;
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
};
