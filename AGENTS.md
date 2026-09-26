# DBH-WW1 Game - Agent Guidelines

## Project Overview

**DBH-WW1** is a 3D first-person game built with 3js
The game features:
- An endless road ("drive beyond horizons") through procedurally streamed terrain, with villages, towns,
  gas stations and tank repair stations along it
- First-person on foot; in tanks (T-55, Abrams, Chieftain AVRE, Mark V) third-person / gunner-sight, or first person
  inside the crew compartment with commander / gunner / driver stations
- Procedural ("vector") models for all tanks; every replaceable part is its own object
- Frankenstein tanks: engine, gun, external fuel tanks and turret drive are swapped by hand in the field, the turret
  with the crane at a repair station; performance is computed from the parts (power, weight, drive/turret match)
- Hit marks (holes / dents / scrapes) stay on the armour until a plate is welded on
- Tank gunnery with ballistics and per-tank ammo; armour, penetration and internal systems
  (hull, engine, transmission, turret drive, gun, ammo rack, fuel tank) that degrade the tank when damaged
- Enemy tanks with simple AI: patrols along the road and ambushes in caponiers
- Crew kills, capturing crewless tanks, fires and extinguishers, inventory (repair kits, gas torch, cutter -
  both burn gas and run dry, spares are found in settlements / tanks), armour plates carried in hands for hull
  repair and stowed in tanks, shells taken out of one tank's ammo rack and loaded into another in the field
- Destructible environment: trees stop shells and break at the hit point, tanks knock them down;
  village / town houses collapse from shell hits or when rammed by a tank

## Run the web game
```bash
python3 -m http.server 8000
# open http://localhost:8000/index.html
```
Server is required for ES modules (file:// won't work).

## Web project structure
```
index.html              # page, HUD markup/CSS, import map (three from unpkg CDN)
web/js/main.js          # orchestrator: input, camera modes (walk / 3rd person / gunner sight), interactions,
                        #   repair menu, service zones, HUD, minimap, game loop, game over
web/js/world.js         # endless world: road centreline roadX(z)/roadH(z), chunked terrain streamed around
                        #   the player, lakes, forest, obstacle boxes (OBB push-out + shell raycast)
web/js/settlements.js   # roadside villages / towns / gas stations / repair stations (+ items, service zones)
web/js/parts.js         # part catalog: HULLS / TURRETS / GUNS / ENGINES / FUELS / DRIVES, seats & interior layouts,
                        #   computeSpec(hull, parts) -> tank.def (speed from power/weight, gun stats, modules...)
web/js/models.js        # procedural models: hulls, turrets, guns, engines, fuel sets, drives, crew compartments;
                        #   static meshes are merged (bake) into a few vertex-coloured meshes per rigid group
web/js/tanks.js         # Tank class: composition (setPart / removeTurret / installTurret), physics, gun laying with
                        #   ballistics, systems damage, engine bay, interior toggle, hit marks (decals)
web/js/workshop.js      # repair-station overhead crane: turret stands 1/2, control panel options, lift animation
web/js/combat.js        # shells, hit tests, armour penetration -> module/crew damage, fires, particle effects
web/js/ai.js            # EnemyDirector: encounters along the road (patrols / ambushes in caponiers) + tank AI
web/js/items.js         # inventory, world pickups, armour plate carried in hands
web/js/audio.js         # synthesized WebAudio sfx
web/js/noise.js         # perlin/fbm, hash, seeded rng
```

## Controls (web)
- On foot: WASD move, SHIFT run, C crouch, SPACE jump, E enter/exit tank (only crewless ones),
  F pick up / tank stowage menu (kits, torches, spare plates, a box of shells; digits pick) / hold to weld a plate,
  E with a plate or a shells box in hands next to a crewless tank - stow the plate / load the shells (same calibre
  only), G drop what is in hands, hold T cut a plate with the cutter, R repair kit menu. Looking at a part slot of a crewless tank: F takes the part into hands / installs the carried
  part, Q (or F) opens / closes the engine bay (the engine won't run while it is open). F at the crane panel opens
  the crane menu (digits 1-4).
- In tank: W/S throttle, A/D steer, SPACE brake, mouse aims (turret follows), LMB fire, RMB gunner sight,
  F fire extinguisher, R repair kit menu (digits choose the system), V third person / inside view, ESC pause.
  Inside: Q stand up / sit at the nearest station, 1/2/3 commander / gunner / driver. Commander = full control,
  gunner = gun only, driver = driving only; standing up = WASD moves around the compartment.

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
- All tanks are procedural. Hull-local axes: +Z forward, +X is the tank's LEFT. A tank = hull + parts
  { engine, gun, fuel, drive, turret }; each part is { kind, key, hp, vis } and carries its visual group (and its hit
  marks) wherever it goes. tank.hp.engine/gun/fuel/turret are getters onto the parts (0 when missing); hull,
  transmission and ammo belong to the hull. Drives fit any hull but turn only a turret of their own type
  (def.driveOk). Mark V is turretless: its gun sits in a front mount with a limited arc (turret = gun mount pivot).
- Module/crew boxes in parts.js are normalised to the hull (or turret) box: u -1..1 across (+X = tank's left),
  v 0..1 up, w -1..1 rear..front; special boxes (ringDrive / gunMount / fuelMount) come from the hull anchors.
  `ext: true` modules are hit without penetrating armour.
- Interiors are built lazily when the player first looks inside; objects flagged userData.interior are shown only
  then (gun breeches too). Walkable areas / seats / vision slits are data in parts.js.
- Repair stations don't fix replaceable parts at 0% (replace them); hull systems (transmission, ammo rack) are fixed.
- Crane stands keep their turrets per settlement (Workshop.store) across settlement unload/reload. A turret on a stand
  has obstacles (body + barrel, `it.colliders`); its gun can be taken out / mounted by hand (F, `standGunSlots`).
- Ambush tanks are dug in (`sink`) only inside their caponier pit (`Tank.sinkAt`), they climb out when leaving it.
- Trees: `ch.trees` items carry instance index / base / top; `world.breakTree` hides the instance and adds a stump and
  a falling top (clones clipped by planes, `renderer.localClippingEnabled`); `world.raycastTrees` for shells,
  `collideTrees(pos, r, ram)` knocks trees down for a fast tank. Broken trees (`world.brokenTrees`) and ruined houses
  (`world.ruins`) persist across chunk / settlement reloads.
- Houses: obstacle.house = record with `hit(point, dir, dmg)` (hp, hole decals, collapse into rubble) and `ram(speed)`.
- Tools: `items.charge[tool]` is the gas left in the tool in use; `items.useTool` switches to a spare when it runs dry.
- Enemy fuel/ammo hit kills the crew (tank stops, can be captured); for the player's tank it starts a fire
  that must be put out with F before the timer runs out, otherwise game over.
