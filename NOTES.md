# Updraft Valley — build notes

An original flight game for the make.fun "best flight game" bounty. A small propeller bush
plane over a green river valley with snow-capped ridges, a lake, pine forests, a town and two
airstrips. Three.js r180 vendored (minified). Static files under `game/`, no network.

## Done
- Repo skeleton: `main.ts`, `serve.ts`, `vendor/makefun-game.ts`, `LICENSE` copied unchanged
  from the starter; `game/vendor/three.module.min.js` + `three.core.min.js` vendored.
- Game modules under `game/src/` (one job each):
  - `noise.js` seeded value noise + fbm
  - `terrain.js` height field, water, instanced pines, town, two runways + windsocks, rings,
    supply clearing; exposes `heightAt(x,z)`
  - `sky.js` gradient dome, sun + light, fog, clouds
  - `aircraft.js` primitive bush plane (fuselage, high wing, tail, struts, spinning prop, gear,
    livery)
  - `flight.js` force-based model: thrust, lift from airspeed/AoA, drag, gravity, stall < ~55 kn,
    ground contact with gentle-landing vs crash test, fuel burn, damage
  - `camera.js` smooth chase + cockpit (C)
  - `input.js` keys + pointer-lock mouse steering, edge actions
  - `audio.js` WebAudio engine hum, wind, stall horn (M mute)
  - `missions.js` Ring Run, Supply Drop, Ridge Crossing, Free Flight (goal + score)
  - `hud.js` heading tape, airspeed/alt/vsi, throttle/fuel/hull bars, minimap, stall, status
  - `panel.js` lit cockpit instrument panel (6 gauges)
  - `state.js` title/briefing/flying/paused/debrief machine
  - `main.js` wires it, loop, screen flow, `?shot=` staging, `window.__game` smoke hooks
- `tools/shots.mjs` Playwright script: serves `game/`, 1280x720, 4 JPEGs into `screenshots/`
  (quality stepped down to fit 256 KiB), prints byte sizes, smoke-tests (no console errors,
  title loads, each mission starts, 3 s throttle flight changes alt/speed).

## True outputs (final)
- `node tools/shots.mjs` → SMOKE OK, 0 console errors; screenshots byte-for-byte deterministic.
  - 1-cover.jpg 123074 B, 2-approach.jpg 95655 B, 3-cockpit.jpg 100407 B, 4-debrief.jpg 85179 B
    (all 1280x720 JPEG, well under 256 KiB; quality 92)
- `MAKEFUN_OUTPUT_DIR=out node main.ts` → out/{game,screenshots,dossier.json};
  dossier.json 624651 bytes (≤ 1,500,000). Dossier text ~82 KB, 14 sources shown in full.
- Headless flight sim: full throttle climbs+accelerates, idle descends+decelerates, takeoff+climb
  works, gentle landing grades A/B, hard/bank landing crashes, stall warning fires.
- Headless mission sim: all four missions reach `complete` (rings 10/10, supply drop→land,
  ridge pass→land far, free land).

## Status: complete
Every mission works, 4 screenshots exist within limits, main.ts produces the output, tree clean.