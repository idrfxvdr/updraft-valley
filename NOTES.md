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

## True outputs (final, v2 polish)
- `node tools/shots.mjs` → SMOKE OK, 0 problems; screenshots byte-for-byte deterministic.
  - 1-cover.jpg ~112 KB (95 kn), 2-approach.jpg ~86 KB (65 kn, -500 fpm),
    3-cockpit.jpg ~103 KB (100 kn), 4-debrief.jpg ~85 KB — all 1280x720 JPEG, < 256 KiB.
  - Smoke asserts airspeed > 40 kn in shots 1-3.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` → out/{game,screenshots,dossier.json};
  dossier.json 601274 bytes (≤ 1,500,000). Dossier text ~82 KB, 14 sources in full.
- Headless flight sim: climb/descend/takeoff/land/crash/stall all correct.
- Headless mission sim: all four missions reach `complete`.

## v2 polish (this round)
- Fixed staged airspeed: shots set velocity-derived airspeed/vertical speed (was 0 KNOTS).
- Chase camera pulled back to ~3.4 wingspans, lower look; whole aircraft in lower-middle third.
- Warmer golden hour: low warm sun, warm directional/hemi/ambient light, orange horizon.
- Approach staged closer/lower so runway markings + windsock read; cockpit panel lit.

## Status: complete
Every mission works, airspeed non-zero in shots 1-3, 4 screenshots within limits, main.ts
produces the output, tree clean.