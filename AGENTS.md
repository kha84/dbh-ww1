# DBH-WW1 Game - Agent Guidelines

## Project Overview

**DBH-WW1** is a 3D first-person game built with 3js
The game features:
- An endless road ("drive beyond horizons") through procedurally streamed terrain, with villages, towns,
  gas stations and tank repair stations along it
- First-person on foot, third-person / gunner-sight in tanks (T-55, Abrams, Chieftain AVRE, Mark V)
- Tank gunnery with ballistics and per-tank ammo; armour, penetration and internal systems
  (hull, engine, transmission, turret drive, gun, ammo rack, fuel tank) that degrade the tank when damaged
- Enemy tanks with simple AI: patrols along the road and ambushes in caponiers
- Crew kills, capturing crewless tanks, fires and extinguishers, inventory (repair kits, gas torch, cutter),
  armour plates carried in hands for hull repair

## Run the web game
```bash
python3 -m http.server 8000
# open http://localhost:8000/index.html
```
Server is required for ES modules + GLB loading (file:// won't work).

## Web project structure
```
index.html              # page, HUD markup/CSS, import map (three from unpkg CDN)
web/js/main.js          # orchestrator: input, camera modes (walk / 3rd person / gunner sight), interactions,
                        #   repair menu, service zones, HUD, minimap, game loop, game over
web/js/world.js         # endless world: road centreline roadX(z)/roadH(z), chunked terrain streamed around
                        #   the player, lakes, forest, obstacle boxes (OBB push-out + shell raycast)
web/js/settlements.js   # roadside villages / towns / gas stations / repair stations (+ items, service zones)
web/js/tanks.js         # TANK_DEFS (stats, armour, module layouts), procedural T-55, GLB loading with turret
                        #   split, Tank class (physics, gun laying with ballistics, systems damage)
web/js/combat.js        # shells, hit tests, armour penetration -> module/crew damage, fires, particle effects
web/js/ai.js            # EnemyDirector: encounters along the road (patrols / ambushes in caponiers) + tank AI
web/js/items.js         # inventory, world pickups, armour plate carried in hands
web/js/audio.js         # synthesized WebAudio sfx
web/js/noise.js         # perlin/fbm, hash, seeded rng
```

## Controls (web)
- On foot: WASD move, SHIFT run, C crouch, SPACE jump, E enter/exit tank (only crewless ones),
  F pick up / loot tank / hold to weld a plate, G drop plate, hold T cut a plate with the cutter, R repair kit menu
- In tank: W/S throttle, A/D steer, SPACE brake, mouse aims (turret follows), LMB fire, RMB gunner sight,
  F fire extinguisher, R repair kit menu (digits choose the system), ESC pause

## Web debugging
URL params: `?nowater=1&noclouds=1&notrees=1&notanks=1&noenemies=1&noshadows=1&nofog=1&waterred=1&watery=N&noaa=1&logdepth=1`
`?seed=N` world seed, `?start=Z` start further down the road, `?god=1` invulnerable player, `?view=N` chunk radius.
`window.game` exposes state/tanks/world/items/combat; `game.frame(dt)` advances the simulation without rendering
(handy for headless tests).

## Web notes
- World is endless: road runs along +Z, `world.roadX(z)` is the centreline. Terrain is flattened to `roadH(z)`
  near the road and in settlements; far from the road it rises into mountains.
- Chunks are 128 m / 32 cells (33*33 verts, Uint16 indices). Each chunk stores its height grid with a 1-cell
  border; `world.heightAt(x,z)` bilinear-samples it (falls back to the analytic `world.height`). Physics,
  shells and minimap all use `heightAt`.
- Water meshes are trimmed per chunk to cells actually below WATER_LEVEL so they can't poke through terrain.
- Settlements are planned deterministically per 850 m stretch (`settlementPlan(k)`), built/unloaded by distance.
  k=0 is always a village, k=1 a repair station with the cutter.
- GLB models face -X; loader bakes a +90 deg rotation so forward = +Z at heading 0, then splits turret triangles
  off the hull using `def.split` (normalised u/v/w box) so the turret can rotate. Mark V has no turret (gun arc).
- Module/crew boxes in TANK_DEFS are normalised to the hull (or turret) box: u -1..1 across (+X = tank's left),
  v 0..1 up, w -1..1 rear..front. `ext: true` modules are hit without penetrating armour.
- Enemy fuel/ammo hit kills the crew (tank stops, can be captured); for the player's tank it starts a fire
  that must be put out with F before the timer runs out, otherwise game over.
