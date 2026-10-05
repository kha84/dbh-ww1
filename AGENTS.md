# DBH-WW1 Game - Agent Guidelines

## Project Overview

**DBH-WW1** is a 3D first-person game built with 3js
The game features:
- Main menu (page opened without a mode): main game (endless road, random or given seed), duel (own tank vs 1-5 chosen
  enemy tanks on an enclosed field), tank range (ramps, ditches, ponds, target hulks, repair station, village), network
  game (two players, host / join by code), loading a saved game. Saving: pause menu or F5 (road mode only, localStorage)
- Network play for two players (net.js, WebRTC): co-op on the road / in a duel / on the range; the host runs the world
- An endless road ("drive beyond horizons") through procedurally streamed terrain, with villages, towns,
  gas stations and tank repair stations along it, rivers crossing it (brooks, rivers, broad rivers; bridges: timber
  trestle / steel / stone; some shallow ones are fords); every game gets a random world seed (`?seed=N` replays one)
- Biomes change along the road every 1.3-3 km with smooth transitions: copses, dense forest, birch groves, fields
  (patchwork of crops, tree lines), steppe, swamps (pools, mud slows the tanks, a low causeway), hills; the HUD names
  the land and tells when it changes
- Railways (railways.js): lines crossing the road at level crossings (barriers come down before a train, bell), lines
  coming in from far away to run beside the road for a while and go away again, stations in villages / towns, rail
  bridges over rivers, tunnels through hills, buffer stops at the ends; trains (trains.js) of 10 locomotives (Ов, Эу,
  G 8.1, Су, ФД, BR 52, П36 - steam with tenders; ТЭ3 (two sections), М62, ТЭП70 - diesels) and 10 car types
  (two-axle / wooden bogie / all-steel / modern coaches, теплушка, two-axle gondola, flat with a load (a tank under a
  tarpaulin), tank car, bogie boxcar, bogie gondola), passenger / goods / military trains by era (the road starts with
  WW1 steam); the enemy's crew and soldiers ride in them (real infantry, firing from the windows / doors, getting off a
  stopped train); kill the crew - the train stops - take the driver's place and drive it
- Shell / bomb craters stay in the ground (a pit with a lip, deep enough to take cover in; craters.js)
- Long summer days (sunrise 4:30, sunset 20:30: 24 min of daylight, 4 min of night by default)
- Airfields beside the road (k=2 always, then ~11% of the stretches): a grass runway, hangars, tower, windsock, fuel
  dump, 3-4 parked planes of the era; 10 planes 1917-1941 (Sopwith Camel, Fokker Dr.I, SPAD XIII, Fokker D.VII, Po-2,
  I-16, Bf 109 E, Ju 87 B, Spitfire Mk I, Il-2) the player flies (take-off / landing on the gear, guns, cannons,
  bombs), bails out of (hold E) and comes down under a parachute
- Cars (Renault AG-1, Ford T, GAZ-A, GAZ-M1, Horch 901, Kubelwagen, Willys MB, GAZ-67, UAZ-469, HMMWV) and motorcycles
  (Harley J, Triumph H, BMW R12, BSA M20, Zundapp KS 750, Harley WLA, BMW R75, M-72, Ural M-62, Kawasaki M1030):
  soft-skinned "personnel carriers" driven by the player or the enemy (motorcycle patrols, staff cars), riders seen
- First-person on foot; in tanks (Renault FT, Mark V, Vickers 6-ton (twin turrets), T-26, T-28 (three turrets),
  T-35 (five turrets), Type 89, Pz.II, BT-7, Char B1 bis, Sherman, Pz.IV, T-44, IS-2, T-55, Chieftain AVRE, Leopard 2,
  Abrams) third-person / gunner-sight, or first person inside
  the crew compartment with commander / gunner / driver stations; every tank has its own interior (paint by nation /
  era, radios, racks, fuel cells, gearboxes, ball MGs, displays...)
- Armoured personnel carriers (Mark IX, Sd.Kfz. 251, BTR-152, M113, BTR-80): a machine gun instead of a main gun,
  troop seats; the enemy's ride with the tank patrols (and alone) full of infantry that dismounts when the enemy is met;
  the player drives one (E from the front) or rides in the back (E from behind) and fires his own weapon from there
- Tank types are ordered by the year they appeared (`TANK_TIERS`, same year: weaker first): the road starts with two of
  the weakest tank of all (`STARTER_TANK`, by `tankRating`), further down the road the enemy (and the spare parts at
  repair stations) follow the historical order
- Enemy infantry (roadside posts, garrisons, escorts, tank crews bailing out of burning tanks) with small arms and grenades
  and a squad AI: cover (houses, walls, sandbags, berms, wrecks, trees, terrain), peeking / hiding, stances (stand,
  crouch, prone), suppression, bounding by fire teams, flanking, grenades, dodging grenades, falling back, tank hunting
  (stalking from cover to cover while the tank looks away, crawling when watched, bundles of hand grenades / AT grenades
  thrown onto the engine deck), taking over free tanks (the player's own too, if left behind) and fighting in them
- Small arms: 10 pistols, 10 revolvers, 10 compact SMGs, 10 rifles, 10 automatics, 13 machine guns + grenades (incl. anti-tank);
  every weapon has its own model; first-person view model with hands, bob / sway / sprint pose;
  one small + one big weapon carried, cartridges by calibre; weapons / ammo can be stowed in and taken out of tanks
- Every tank has a removable machine gun on a pintle (fed from the cartridges in the tank's stowage)
- Fuel is carried only in the external fuel tanks (it travels with them); fuel cans found along the road refill them
- Sandbags heaped on a tank add armour (front / side) and weight, are visible and can be taken off / knocked off by hits;
  the bags of the infantry posts' walls can be picked up too (the wall - cover - shrinks)
- Knocked-out vehicles along the road can be looted (stowage, parts; burnt ones leave loot on the ground)
- Procedural ("vector") models for all tanks; every replaceable part is its own object
- Frankenstein tanks: engine, gun, external fuel tanks and turret drive are swapped by hand in the field, the turret
  with the crane at a repair station; performance is computed from the parts (power, weight, drive/turret match)
- Hit marks (holes / dents / scrapes) stay on the armour; welding a plate covers holes / dents with patches in the colour
  of the plate (new plates are bare steel, a plate cut out of a hull has the hull's colour, stowed plates keep theirs)
- Paint: spray cans of different colours (settlements, repair / gas stations; half of them in the paint of the tanks
  met around) repaint a whole tank (hull + turret, gun, fuel tanks, drive; patches too, scrapes vanish) or one patch
- Tank gunnery with ballistics and per-tank ammo; armour, penetration and internal systems
  (hull, engine, transmission, turret drive, gun, ammo rack, fuel tank) that degrade the tank when damaged
- Enemy tanks with simple AI: patrols along the road and ambushes in caponiers
- Crew kills, capturing crewless tanks, fires and extinguishers, inventory (repair kits, gas torch, cutter -
  both burn gas and run dry, spares are found in settlements / tanks), armour plates carried in hands for hull
  repair and stowed in tanks, shells taken out of one tank's ammo rack and loaded into another in the field
- Destructible environment: trees stop shells and break at the hit point, tanks knock them down;
  village / town houses collapse from shell hits or when rammed by a tank
- Houses can be entered: doors and real window openings (walk / look / shoot through them), furniture (stoves, beds,
  tables, wardrobes...), town houses of 2-3 storeys with stairs; loot lies on the floors too
- Tanks push each other: a tank driving into another shoves it if its tractive force (engine power, the grip of its
  weight) beats the other's hold on the ground (weight, braked or free tracks, pushed along or across them) - burnt-out
  wrecks too (e.g. off a bridge)

## Run the web game
```bash
npm install                     # once: three.js, Vite, TypeScript
npm run dev                     # Vite dev server on :8000 (hot reload + the room mailbox of the network game)
npm run build                   # production build into dist/ (NOMINIFY=1 for readable profiles)
python3 server.py 8000          # serves dist/ + the room mailbox (npm start = build + this)
npm run typecheck               # tsc --noEmit over web/js (checkJs, must stay at 0 errors)
# open http://localhost:8000/index.html
```
Stack: three.js 0.186 (WebGPU build: `three` is aliased to `three/webgpu` in vite.config.js, TSL / node materials),
WebGPURenderer - WebGPU where the browser has it, otherwise its WebGL 2 backend (`?backend=webgl` forces it).
Plain JS checked by TypeScript (JSDoc where inference needs help, ambient types in web/js/globals.d.ts).

## Web project structure
```
index.html              # page, HUD markup/CSS, main menu / pause (graphics quality) / victory overlays
web/js/game/            # parts of the game loop taken out of main.js, each `createX(ctx)` over the shared context:
                        #   render.js (renderer, quality presets, sky / sun / moon / stars / time of day, CSM, post:
                        #   GTAO + selective bloom + FXAA), grass.js, warmup.js (shader warm-up under the loading
                        #   screen), panels.js (HUD panels, prompts), stash.js (tank stowage, hold actions), menus.js
                        #   (repair kit / crane), service.js (service zones), smallarms.js, inside.js (crew
                        #   compartment), interact.js (F / looking at parts), motion.js (walking, driving, cameras),
                        #   netui.js, dom.js, flight.js (planes: enter / leave, controls, cameras, bail-out,
                        #   parachute, instruments, Plane.onEvent: crashes)
web/js/batch.js         # ChunkBatch: all chunks of a kind (terrain / forest / water / road) in one BatchedMesh
web/js/bakestatic.js    # static scenery (houses, settlement props) baked into one mesh (colour + roughness/metalness
                        #   per vertex, node material)
web/js/spin.js          # merged road wheels turned in the vertex shader (one uniform per tank)
web/js/glow.js          # materials that feed the selective bloom (MRT mask), switched with the post-processing
web/js/main.js          # orchestrator: config (mode / seed / load), input, camera modes (walk / 3rd person / gunner sight),
                        #   interactions, repair menu, service zones, HUD panels, game loop, game over / victory
web/js/menu.js          # main menu (reloads the page with ?mode=... / ?load=...)
web/js/modes.js         # game modes: world options per mode, duel / range setup, arena bounds, duel status
web/js/net.js           # network play: WebRTC link (room code via server.py or copy-paste codes), host-authoritative
                        #   world, tank ownership, snapshots / full states / events, puppets and the other player's figure
web/js/save.js          # saved games: snapshot / restore (restoreBefore runs before the world is generated), localStorage
web/js/hud.js           # tank markers over the view, minimap (railway lines, trains)
web/js/railways.js      # railway lines per rail block (3 settlement stretches, at most one line): plans (cross /
                        #   parallel), formation profile (graded, embankments / cuttings: world.height -> flatten),
                        #   stations, rail bridges, tunnels, segment grid queries (nearest, at), streaming of track
                        #   tiles / crossings / portals / buffer stops / rail bridges
web/js/trains.js        # Train (vehicles following the line on their pivots, physics, AI driver, riders, damage) +
                        #   Trains director (spawning by era, despawn, collisions, crossing barriers, network copies)
web/js/traindefs/       # ONE FILE PER LOCOMOTIVE / CAR TYPE (numbers + model); kit.js (wheels, bogies, buffers, boiler,
                        #   cab, bodies with openings, bake: body + spinning geometry), steam.js / diesel.js / cars.js
                        #   builders, index.js = registry (LOCOS, CARS, LOCO_TIERS, vehicleModel, composeTrain)
web/js/game/railway.js  # driving a train: entering the cab, controls, cameras, instruments, prompts
web/js/world.js         # endless world: road centreline roadX(z)/roadH(z), chunked terrain streamed around
                        #   the player, lakes, rivers + bridges, forest, obstacle boxes (OBB push-out + shell raycast),
                        #   arenas (opts.arena: 'duel' | 'range', features, bounds)
web/js/biomes.js        # biomes along the road: segments, blended parameters (relief, swamp, fields, trees, colours,
                        #   grass, rivers), field patchwork (fieldAt, CROPS)
web/js/rivers.js        # river plans (between settlements; brook / river / broad, width along the course), carving
web/js/settlements.js   # roadside villages / towns / gas stations / repair stations / airfields: layout, loot, service
                        #   zones (airfield: the planes' zone 'airfield' + a fuel point), parked plane spots
web/js/obstacles.js     # obstacle boxes: pushOut (circle + height), segBox / segObstacle, compound obstacles (sub)
web/js/structures/      # ONE FILE PER WORLD OBJECT: kit.js (settlement builder context K: frame / part / obstacle /
                        #   addItem, shared geometry + MAT), house.js (enterable houses), church.js, depot.js, well.js,
                        #   gasstation.js, repairstation.js, props.js (fence, crates, barrels, tyres, signs),
                        #   bridge.js, caponier.js, track.js (track tiles, buffer stops), crossing.js (level
                        #   crossing), railbridge.js, tunnel.js (portal), station.js (railway station), trees.js (Forest: baked chunk trees, broken trees, falling tops)
web/js/craters.js       # shell / bomb craters: profile, per-chunk lists, heightAt offset, the cells of the terrain mesh
                        #   under a crater replaced by a fine patch (watertight), saved
web/js/planes.js        # Plane class: flight physics, ground roll / take-off / landing, retracting gear, guns /
                        #   cannons / bombs, damage / break-up / crash, network pose, saved data
web/js/planedefs/       # ONE FILE PER PLANE TYPE (numbers, weapons, gear, hit boxes, model); index.js = registry
                        #   (PLANES, PLANE_TIERS, buildPlane), kit.js = lofted fuselages, wings, struts, props, gear,
                        #   markings, canopies
web/js/structures/airfield.js  # runway, hangars, tower, windsock, fuel dump; returns the parked plane spots
web/js/tankdefs/carkit.js  # shared pieces of the cars / motorcycles (wheels, guards, glass, motorcycle frame,
                        #   sidecar, tanks, engines, riders) and softHull (their gameplay data)
web/js/tankdefs/apckit.js  # shared pieces of the personnel carriers (wheels that steer, open troop boxes, benches,
                        #   troop seats, MG shield)
web/js/tankdefs/        # ONE FILE PER TANK TYPE: gameplay data (hull / turret / gun / engine / fuel / drive, seats,
                        #   interior layout + props) and its procedural models; index.js = registry (TANK_DEFS)
web/js/paint.js         # paint: colour names, spray can colours, recolouring baked models (paintObject), patch material
web/js/modelkit.js      # shared model toolkit: materials per palette, bake (merge), profiles / prisms, running gear,
                        #   track loops, engine deck, cupolas, breech, generic engines (ENGINE_TYPES) and fuel sets
web/js/parts.js         # part catalog assembled from tankdefs: HULLS / TURRETS / GUNS / ENGINES / FUELS / DRIVES / TANK_MG,
                        #   computeSpec(hull, parts) -> tank.def (speed from power/weight, gun stats, modules...), TANK_TIERS
web/js/models.js        # builds the parts of a tank type from its definition (hull, turret (+ second turret), gun,
                        #   engine, fuel, drive)
web/js/interiors.js     # crew compartments: shell from interior data, paint themes, typed props (PROPS builders)
web/js/tanks.js         # Tank class: composition (setPart / removeTurret / installTurret), physics, gun laying with
                        #   ballistics, twin turrets, systems damage, engine bay, interior toggle, hit marks (decals)
web/js/workshop.js      # repair-station overhead crane: turret stands 1/2, control panel options, lift animation
web/js/weapons.js       # small arms catalog (WEAPONS / GRENADES / CALIBERS), weapon meshes (cached / baked), Guns: hitscan
                        #   bullets with tracers vs tanks / infantry / player / world, thrown grenades, onShot hook
web/js/weaponmodels.js  # one procedural model builder per weapon + grenade models
web/js/viewmodel.js     # first-person weapon: hands, hip / aim pose, bob, look sway, sprint pose, landing, recoil, reload
web/js/infantry.js      # Soldier (low-poly model with knees, stances, AI) + Infantry director (squads, cover search,
                        #   line of sight, hearing / suppression, explosions, run-over)
web/js/loot.js          # difficulty along the road, tank type / weapon / loot picks by difficulty
web/js/combat.js        # shells, hit tests, armour penetration -> module/crew damage, fires, particle effects
web/js/ai.js            # EnemyDirector: encounters along the road (patrols / ambushes in caponiers, infantry posts with
                        #   sandbag walls, knocked-out vehicles with loot) + tank AI (patrol / ambush / hunt (duel))
web/js/items.js         # inventory, world pickups (laid in place with data.place), armour plate carried in hands
web/js/audio.js         # synthesized WebAudio sfx
web/js/noise.js         # perlin/fbm, hash, seeded rng
```

## Controls (web)
- On foot: WASD move, SHIFT run, C crouch, SPACE jump, 1/2/3 small weapon / big weapon / grenades (again = holster,
  3 again = next grenade type), LMB fire / throw, RMB aim, R reload (no weapon drawn: repair kit menu), G drops what is
  in the hands (or the drawn weapon), E enter/exit tank (only crewless ones),
  F pick up / tank stowage menu (kits, torches, spare plates, a box of shells; digits pick) / hold to weld a plate,
  E with a plate or a shells box in hands next to a crewless tank - stow the plate / load the shells (same calibre
  only), E with a sandbag - heap it on the tank, hold F with a fuel can next to a tank - pour the fuel, hold T cut a plate
  with the cutter, hold P - paint the tank (or the patch looked at) with the spray can in use, O - next spray can.
  Tank stowage menu (F): page "Оружие и патроны" (digit 6) stows / takes weapons, cartridges, grenades
  (0 = back). Looking at a part slot of a crewless tank: F takes the part into hands / installs the carried
  part (the MG pintle: takes the MG into the big-weapon slot / mounts a carried MG; the fuel tanks show the fuel left),
  Q (or F) opens / closes the engine bay (the engine won't run while it is open). F at the crane panel opens
  the crane menu (digits 1-4).
- Personnel carrier: E next to its front half - drive it, next to its rear half - climb into the troop compartment;
  there 1/2/3 pick the own weapon, LMB fires over the side / from the hatch / through the loophole (seats with `fire`),
  R reloads, Q stands up (then Q at a seat / 1/2/3 for commander / gunner / driver).
- Car / motorcycle: like a personnel carrier (E at the front half - drive, at the rear - ride as a passenger and
  fire your own weapon); hard knocks against trees / walls / tanks break it and hurt the men in it.
- Plane: E next to the cockpit - get in (on the ground, standing - E gets out), W/S throttle, mouse = the stick
  (pitch / bank, it re-centres slowly), arrows = stick too, A/D rudder (steers on the ground), SPACE wheel brakes,
  LMB guns + cannons, B drop a bomb, V chase / cockpit view, RMB look around, hold E in the air - bail out
  (the parachute opens by itself or SPACE; WASD steers it). Planes refuel / rearm / repair standing on an airfield.
- In tank: W/S throttle, A/D steer, SPACE brake, mouse aims (turret follows), LMB fire, RMB gunner sight, X main gun / MG
  (hold LMB for bursts),
  F fire extinguisher, R repair kit menu (digits choose the system), V third person / inside view, ESC pause
  (pause menu: resume / save / main menu), F5 quick save (road mode).
  Inside: Q stand up / sit at the nearest station, 1/2/3 commander / gunner / driver.
- Train: E beside the cab of an engine whose crew is dead - take the driver's place; W/S regulator (below zero backs),
  SPACE brake, H whistle / horn, V cab / outside view, mouse looks around, E (slow) gets off.
- Any mode: ` (Backquote) opens the spawn menu: any tank / APC / car / motorcycle (or a free plane) in front of the player, an enemy with its crew (TankAI
  'hunt', in a duel it joins the foes) or a free one without crew (`spawnVehicle`; the guest sends 'spawn' to the host). Commander = full control,
  gunner = gun only, driver = driving only; standing up = WASD moves around the compartment.

## Web debugging
Game: `?mode=road|duel|range`, `&tank=KEY` (duel / range, APC keys too), `&net=host|guest` (network play; the guest
takes what it joins from sessionStorage `dbh-ww1-net`, written by the menu), `&enemies=K1,K2,...` (duel, `random` allowed), `?load=SAVE_ID`.
Without `mode` / `load` the main menu is shown; `?seed=N` or `?start=Z` alone start the road directly.
URL params: `?notrains=1` (no enemy trains), `?norail=1` (no railways at all), `?nowater=1&noclouds=1&notrees=1&notanks=1&noenemies=1&noinfantry=1&noshadows=1&nofog=1&waterred=1&watery=N&noaa=1&logdepth=1`
`?seed=N` world seed (random without it; shown in the pause menu), `?start=Z` start further down the road,
`?biome=KEY` one biome everywhere (mixed | forest | birch | fields | steppe | swamp | hills), `?god=1`
invulnerable player, `?view=N` chunk radius.
Graphics: `?backend=webgl`, `?q=low|medium|high` (else the one chosen in the pause menu, else high on WebGPU / medium
on WebGL 2), `?tod=H` time of day, `?daylen=M` minutes per day at the daytime pace (night 3x faster; 0 = the clock stands), `?nopost=1 ?noao=1 ?nobloom=1
?bloomT=0.1 ?bloomS=0.9 ?nograss=1 ?nowarm=1`.
`window.game` exposes renderer/scene/sky/pipeline/grass/state/tanks/planes/flight/trains/rail/world/items/combat/guns/infantry; `game.frame(dt)` advances the simulation without
rendering (handy for headless tests; `game.state.noLock = true` lets small arms fire without pointer lock).

## Web notes
- Rendering / performance rules (WebGPURenderer): every InstancedMesh gets its own shader build and every object costs
  a draw with per-object uniforms - prefer merging (bakestatic.js, modelkit bake, spin.js) and batches (batch.js) over
  many small meshes; share materials (a canvas texture per object is an upload each). A material with `mrtNode` breaks
  when no MRT is bound - use glow.js. `material.clippingPlanes` does not work: clip with THREE.ClippingGroup
  (broken trees). Points are always 1 px on WebGPU (stars are instanced sprites).
- Time of day: `sky.time.tod` (hours), saved with the game, the host sends it to the guest. SUNRISE / SUNSET in
  render.js set the day arc (16 h of day), the night runs 3x faster than the day.
- Railways (railways.js): `world.rail` (null in the arenas / `?norail=1`); a line { id (block), kind 'cross' |
  'parallel', n points STEP=5 m apart: x, z, y (formation; rails at y + RAIL_TOP), len, cross { i, s, x, z, y }, station
  { k, side, off, s, name, half }, bridges [{ i0, i1 }], portals, tun / bridge flags per point, grid }. `world.height` =
  `baseHeight` (no rivers / rails) -> `rail.flatten` -> river carve; the profile is planned from `baseHeight` (never
  from `height`: recursion). `rail.nearest(x, z, maxD)`, `rail.at(L, s, out)`, `nearTrack` (trees / grass keep off).
  Rail bridges / the crossing deck live in `world.bridges` ('rb<id>:<n>' / 'rx<id>'), the station platform is a floor
  in `world.houses` (settlement `floors`).
- Trains (trains.js): `train.s` = the front along the line, `dir` = facing (+1 increasing s), `speed` along the facing;
  vehicles { def, part main | tender, flip (second ТЭ3 section), piv (local z of the pivots), ob (moving obstacle with
  `train` + `hit`) }; small arms go through the cars (`raycastObstacles(.., noTrain)`), shells hit them
  (`obstacle.hit`), blasts -> `trains.blast`. Riders: `Soldier.ride` (no move / decide; `decideRide`), placed by the
  train every frame before `infantry.update`, `Infantry.spawnRider`; pruning / saving skip them. Wheels / coupling
  rods turn in the vertex shader (attributes spinC / crank, uniform = distance run). Network: the host sends `R` rows
  in its snapshot, the guest keeps `puppet` copies (it cannot drive trains).
- Craters (craters.js): `world.addCrater(x, z, r, d)` / `world.craterAt(x, z)`; Combat.crater digs one for every
  shell / bomb burst on the ground (size from `s.crater ?? s.dmg`; `crater: 0` - none, e.g. aircraft cannons);
  `world.heightAt` adds the offset of `ch.craters`; `ch.tgeo` is the chunk's terrain geometry (its cells under a
  crater collapse, `ch.craterMesh` is the fine patch); `world.craters.onAdded` -> grass.refresh.
- Cars / motorcycles: hulls with `car: 'car' | 'moto'`, `soft`, `apc` (troop seats), `accelCap`, `lean` (solo bikes),
  `engineShown` (the motorcycle engine part is always visible); seats / troops with `rider` (pose: car / moto / side /
  gun) get low-poly riders (`Tank.updateRiders`, `tank.playerSeat`); `isApc` excludes them, `CAR_TIERS` / `MOTO_TIERS`,
  `loot.pickCarKey / pickMotoKey`; `Guns.onSoftHit`, `blastVehicles` / `softWrecked` (main.js), `Tank.knock` / `crash`.
  `interior.shell: false` - no compartment, `noSeats`, `controls: 'none'`.
- Planes (planes.js): physics constants from `mass / power / vmax / vstall`; `ctl { throttle, sx, sy, rud, brake }`;
  the nose follows the path, `sy` sets the angle of attack (trim seeks level flight), `sx` the bank. `state.mode ===
  'fly'` with `state.plane` (`state.vehicle` null); `state.para` = parachute (mode 'walk'). Guns: `guns.planes`,
  `combat.planes` (hit boxes `def.boxes`, `Plane.hitSegment`), `guns.onPlaneHit`; owner `{ player, plane }`, `dmgK` -
  one traced round for several. Bombs: `combat.launch({ bomb: kg, crater, life })`, light cannon shells `light: true`.
  Airfield planes: `s.planes` spots, ids `af{k}:{i}`, `planesGone` (taken) - not set out again; `home`, `used`.
  Network: the pose rides in the player pose (`mePose()[13]`), remote planes are puppets (`remote`, `remoteUse`),
  hits on them -> 'phit'; shells carry `b` (bomb) / `l` (light) / `c` (crater).
- Tank types live in `web/js/tankdefs/<key>.js` (data + models); add a tank = add a file and list it in
  `tankdefs/index.js`. `models.hull()` returns `hullResult(...)` (root, wheels, ring, bay, box, fuelAt...),
  `models.turret()` returns { group, gunPos, sightY, mgPos, box, second? }, `models.gun()` { group, muzzleLen },
  `models.engine(g, P, E)` returns its height, `models.fuel(g, P)` its groundY, `models.turretInterior` the turret
  compartment (poly | dome, h, cupola, props). Palettes register into modelkit `PALETTES` (riveted: rivet texture).
- Interiors: `hull.interior` { theme, x, floor, roof, z, slits, walk, ammo, controls: levers|wheel|tbar|yoke,
  seatStyle, props: [{ type, ... }] }; prop types are the PROPS builders in interiors.js (seat, driver, radio, fuelcell,
  rack (vertical|horizontal|bins|drums|charges), ballmg, sidemg, periscope, gearbox, shaft, panel, display, basket,
  ready, coax, blastdoor, ...). Props with `main: true` racks replace the default ammo rack.
- Twin turrets (Vickers 6-ton): `turret().second` { group, pos (offset from the ring in hull axes), arc, speed, box };
  it keeps its place on the hull while the main turret traverses (Tank.placeSecondTurret), turns to the MG target
  (secondYaw) and carries the machine gun; seats with `in: 'second'` sit in it (Tank.seatObject(seat)).
- Multi-turret tanks (T-28, T-35): small hull turrets are `hull.aux` [{ group, arc, speed, box }] (from
  `hullResult(..., { extra: { aux } })`); they belong to the hull, turn towards `mgTarget || aimPoint` within their arc
  (Tank.aimAux) and are hit volumes of the hull. Only the main turret is a part.
- Paint (paint.js): palette materials carry `userData.paint` ('main' | 'dark'); `bake` records the vertex ranges of the
  merged mesh (`userData.paint`) or the role of a textured mesh (`userData.paintRole`); `paintObject(root, color)`
  rewrites them (riveted textures are redrawn). `tank.paint` / `part.paint` (null = stock palette) - parts keep their
  paint (partVisual repaints a freshly built visual), `tank.hullColor`, `tank.paintTank(c)`. `tank.plates` = colours of
  the stowed plates, `items.plateColor` = the plate in hands, `items.sprays` [{ color, paint % }] / `sprayIdx`.
- Patches: `tank.patchMarks(color, at)` turns hole / dent marks into patch meshes (userData.patch, also `mark`) on the
  same host (they travel with the parts); `clearMarks` (repair station) keeps them; saved per host (`markHosts()`).
- Biomes (biomes.js): `world.biomeAt(x, z)` = a `BIOMES` entry or a cached blend of two (read only); used by
  `naturalHeight` (relief, hills, mount, wet), `roadH` (swamps: low causeway), terrain colours, trees (treeFill /
  trees / kind shares pine / birch / oak / bush, treeS), grass (tuft tint / size / share), rivers (chance, width).
  `world.fieldAt(x, z, rx, share)` -> { crop (CROPS index or -1), edge, line (a tree line on that strip) }.
  `world.going(x, z)` = vehicle speed factor (wading, swamp mud) -> `tank.goingK`. Tree kinds (trees.js `KINDS`):
  `t.g` = trunk thickness (collisions / shell hits / ramming).
  The terrain texture `assets/ground.jpg` is grass.jpg with its green taken out: the ground colour comes only from
  the vertex colours (biome colours are the colours as seen); the minimap tints the lowland by biome / crop too.
- Rivers: `world.riverPlan(k)` for the gap after settlement k (null or plan: size brook | river | broad, `w` half
  width at the road, `widthAt(p, x)` along the course, `title` for the signs), carved in `world.height`; bridges are
  built / disposed by distance (`world.bridges`), `world.bridgeAt(x, z)` gives the deck height and `heightAt` uses it
  (tanks / soldiers / shells walk on the deck); the road ribbon dips into fords.
- Arenas: `new World(scene, seed, worldOptions(mode))` - opts { arena, road, settlements, rivers, bounds, plans
  (fixed settlements), features (hill / table / ditch / bumps / pond), clear (tree-free zones), treeDensity }.
- Infantry AI (infantry.js): states idle / alert / combat / retreat / flee; `Infantry.findCover(soldier, threat, o)`
  scores obstacles / trees / wrecks / terrain spots and keeps those hidden from the threat (kind: tall / mid / low ->
  hide / peek stances); `Guns.onShot` -> `Infantry.shot` (suppression, hearing), `Infantry.noise(pos, r)` (tank gun,
  engine), squads bound by fire teams (`squad.advance`). Enemy fire doesn't hit enemy soldiers.
- Saves (save.js): tanks / soldiers / pickups / planes within 1.5 km, post walls, crane stands, ruins, broken trees,
  craters, spawned encounter stretches, garrisons, parked settlement cars, taken pickups / airfield planes, the plane
  flown / the parachute; settlements and encounters regenerate from the seed.
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
  A house is a compound obstacle: the bounding box with `sub` pieces (wall segments around the door / window openings,
  furniture; `noPush` floor slabs / roof stop rays only) - `pushOut(o, pos, r, h)` skips boxes above the head (lintels),
  `collideObstacles(pos, r, breakFn, h)` (tanks h 2.6, grenades 0.15). Walkable surfaces: `house.floors` (rects / stair
  ramps in house-local axes), `world.groundAt(x, z, y)` = the terrain or the highest floor up to `STEP_UP` above y
  (player, soldiers, grenades, dropped things; `world.houses` = standing houses). `house.spots` free floor points
  (loot inside: item `y`; `items.add(..., y)`, `items.refY` = player's feet for drops). Village houses: 1 storey,
  maybe 2 rooms, a Russian stove with the chimney; town: 1-3 storeys, switch-back flights along the back wall.
- Tools: `items.charge[tool]` is the gas left in the tool in use; `items.useTool` switches to a spare when it runs dry.
- Enemy fuel/ammo hit kills the crew (tank stops, can be captured); for the player's tank it starts a fire
  that must be put out with F before the timer runs out, otherwise game over.
- Difficulty `loot.difficultyAt(z)` = z / 9 km (clamped): tank types come from `TANK_TIERS` around the matching tier, small
  arms by era (WW1 / WW2 / post-war). Settlement loot, wrecks, soldier kits and repair-station parts all use it.
- Fuel: `tank.fuel` is a getter onto `parts.fuel.fuel` (litres); no fuel part or a destroyed one = no fuel. Engines burn
  `fuelUse` l/s at full throttle (player's tank only). Fuel cans: `items.hands === 'canister'`, `items.handCan.fuel`.
- Machine guns: `tank.mg` is a weapon object ({ key, mag }) on `tank.mgPivot` (turret `mgPos` from the tank definition, `hull.mgAt`
  when the turret is off); it aims at `tank.mgTarget || tank.aimPoint`, `tank.fireMG()` takes rounds from
  `tank.cargo.ammo[calibre]`. `tank.cargo = { weapons, ammo, grenades }` is the small-arms stowage.
- Sandbags: `tank.addSandbag()` / `removeSandbag(face)`, slots are found by raycasting the hull (front first, then fenders);
  `computeSpec(hull, parts, { front, side })` adds armour and weight. Hits on a face with bags may tear one off.
- Small arms are hitscan (`Guns.trace`): tanks (sparks only), soldiers / player (vertical capsules, head x2.2), obstacles,
  trees, terrain. Player takes 50% bullet damage. Shells and grenades call `onExplosion` -> `Infantry.explosion`.
- Soldiers are culled beyond 700 m, bodies after ~2 min; dropped loot (`drop:*` pickups) beyond 1.2 km.
- Tanks lose speed when knocking down a tree / ramming a house (`tank.bump` slows them for a moment), more for light ones.
- Tank vs tank (`Tank.collideTank`): `pushDrive(n)` = tractive force (kN) towards n (power hp*0.7355*eff / speed, at most
  0.75 * weight * g, x throttle x alignment); resistance = (mu * weight_other + 0.05 * own weight) * g, mu 0.1 along
  free tracks / 0.4 braked (crewed, not driving) / 0.45 across, + the other's own drive against. Stronger: the pair moves
  (speed <= power / resistance, momentum shared at the first contact), the pushed tank is shoved (obstacles / trees /
  deep water stop it) and turned when pushed off-centre; weaker: stopped. Only the driving tank resolves the contact.
  Network: a pushed remote tank -> `Tank.onPush` -> 'push' message to its owner.
- Personnel carriers: `hull.apc`, `hull.wheeled` (steering: turn rate grows with speed, `hull.steer` wheel pivots turn),
  `hull.troops` [{ pos, eye, ry, fire }] -> seats with roles `troop0..N` (`seat.troop`), no gun (`gun: null`,
  `canMountGun()` false), `hull.mgAmmo`, `hull.mgShield` (goes onto the MG pivot), `hull.noPost`, turret
  `mgInside` (BTR-80). `interior.open` = no roof. `tank.troops` = kits of the riding infantry (`director.dismount`),
  `APC_TIERS` / `loot.pickApcKey` by era. Mounted MGs (`WEAPONS[k].mount`) are never carried / found.
- Welded patches (`Tank.addPatch`) are built by projecting a grid onto the host's own meshes (`patchGeometry`): they
  shrink / shift to stay on one face and follow curved armour; `userData.size` is saved.
- Trees: a shot into a stump cuts it lower (`world.cutStump`, `brokenTrees` entry `y2`), the piece falls down.
- Infantry vs tanks: `Soldier.antiTank()` / `atGrenade(craft)` (two hand grenades -> `bundle`, pen 40),
  `watchedBy(tank)` (the turret looks at him), `deckPoint(tank)`; taking over tanks: `Infantry.crewable / boarding /
  climbIn` -> `infantry.onBoard` (TankAI 'hunt' with `leash`), `tank.crewKits` bail out as those men.
- AI targets: `director.think(dt, now, targets)` / `infantry.update(dt, { targets })`, `pickTarget` (nearest, sticky).
- Network play: tanks have `nid` and `netOwner` ('host' | 'guest'); a tank owned by the other machine is `remote`
  (`Tank.netStep` follows `setNetPose`, no physics). The guest runs no AI (`director.disabled`), its guns are `visual`,
  its shells `ghost`; `remoteInside`, `guns.remoteFoot / remoteExposed` let the host's enemy hit the guest.
  `combat.now` is the game time (`tank.lastHitT`).
