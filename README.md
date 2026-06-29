# Asteroids

A modern take on the classic Asteroids arcade game, built from scratch in vanilla JavaScript with the HTML5 Canvas — no frameworks, no build step.

## ▶ Play it now

**[Click here to play in your browser →](https://antranquoc.github.io/Asteroids_game/)**

[![Play on GitHub Pages](https://img.shields.io/badge/▶_Play_Now-GitHub_Pages-2ea44f?style=for-the-badge)](https://antranquoc.github.io/Asteroids_game/)

No install required — the demo is hosted on GitHub Pages and runs entirely in the browser.

## Features

- **Twin-stick controls** — aim with the mouse, move with WASD, fly and shoot in any direction.
- **Skins shop** — earn money from your runs and spend it on ship skins.
- **Difficulty levels** — pick your challenge before each run.
- **Power-ups** — grab drops mid-run for temporary boosts.
- **Online leaderboard** — set a pilot name and compete for world-record scores.
- **Personal records** — track your own best runs.
- **Battle Royale** — a multiplayer mode where you create or join a lobby and fight it out.
- **Music & sound effects** — with an in-game volume control and music toggle.

## Controls

| Action | Input |
| --- | --- |
| Aim | Move the mouse |
| Move | `W` `A` `S` `D` |
| Shoot | Left mouse button |
| Pause | `Esc` |
| Select difficulty (on start / game-over screen) | `1` – `4` |

## Run locally

The game uses ES modules, so it needs to be served over HTTP (opening `index.html` directly via `file://` will not work). From the project root:

```bash
# Python 3
python -m http.server 8000

# or, with Node.js
npx serve
```

Then open `http://localhost:8000` in your browser.

## Project structure

```
index.html        Entry point
index.js          Main game loop and input handling
styles.css        Page and canvas styling
assets/           Favicon, music, and sound effects
src/
  audio/          Sound manager, music, and SFX
  battle/         Battle Royale multiplayer mode
  cloud/          Online leaderboard and cloud sync
  core/           Canvas, constants, starfield, FPS
  entities/       Player, asteroids, projectiles, particles, power-ups
  screens/        Start, pause, restart, shop, leaderboard, name screens
  systems/        Controls, difficulty, money, score, skins
  ui/             UI helpers and dialogs
```

## Credits

I used this [tutorial](https://www.youtube.com/playlist?list=PL4cUxeGkcC9iO8ai6LU0s6aHAaWP4RAkF) as a foundation/reference when first building the game.
