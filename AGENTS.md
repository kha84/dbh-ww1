# DBH-WW1 Game - Agent Guidelines

## Project Overview

**DBH-WW1** is a 3D first-person game built with 3js
The game features:
- First-person movement on a heightmap-based terrain
- Player controls: WASD (movement), Mouse (look), SHIFT (run), C (crouch), Space (jump)
- 3D objects: cubes, cylinders, pyramids that can be placed on the map
- Collision detection with terrain and objects

## Run the web game
```bash
python3 -m http.server 8000
# open http://localhost:8000/index.html
```
Server is required for ES modules + GLB loading (file:// won't work).

## Web project structure
```
index.html            # page, HUD, import map (three from unpkg CDN)
web/js/main.js        # renderer, input, camera modes, HUD, minimap, game loop
web/js/terrain.js     # procedural terrain (hills/plains/rivers/mountains), forest, water
web/js/vehicles.js    # GLB loading, tank physics (enter/exit, drive), vehicle defs
```

## Controls (web)
- WASD move, SHIFT run, C crouch, SPACE jump (on foot)
- E enter/exit vehicle, ESC pause
- In vehicle: W/S throttle, A/D steer, SPACE brake, mouse orbits camera (third person)

## Web debugging
URL params: `?nowater=1&noclouds=1&notrees=1&notanks=1&noshadows=1&nofog=1&nowaves=1&waterred=1&watery=N&noaa=1&logdepth=1`

## Web notes
- GLB models face -X; `vehicles.js` rotates them +90 deg (rotation.y = PI/2) so forward = +Z at heading 0
- Terrain heights are computed once into a grid; `terrain.heightAt(x,z)` bilinear-samples it (shared by physics + minimap)
- Water mesh is trimmed to actual water cells (not a full map plane) so it can't poke through terrain
- Terrain grid 180x180 keeps vertex count under 65536 (Uint16 indices)
