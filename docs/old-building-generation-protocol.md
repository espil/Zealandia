# Old building generation protocol - the textured-facade mechanism

Retrieved 2026-10-20 at Han's direction ("refer back to the older ver. to retrieve the protocol"), for use in the Espil Online: Zealandia app payload and the real-world cities.

## Source build identified

• File: `~/workspace/espil-online-deploy/index.html.bak-2026-10-14` - 360,759 bytes, modified 2026-10-14 18:04 UTC. It is the backup of the shared deploy copy's own index.html, i.e. the production-lineage build, and its full asset tree is the deploy tree around it.
• Why this build: it is the newest complete build on disk whose building generation is the textured-facade mechanism (see below). The two near rivals are distinguishable, not equivalent:
  • `~/workspace/map-rebuild/index.html` (2026-10-14 18:03, one minute older) is an index-only working file with no asset tree, and uses a variant (single material per archetype plus an occlusion-fade shader).
  • `~/workspace/testing-full/index.html` (2026-10-13) is a complete tree but older, and uses the earlier canvas-generated archetype textures that the PNG pass superseded.
• Evidence tying it to Han's 2026-10-20 screenshot: the screenshot's left tower (grey-blue stone, mullioned windows, brown door at ground level) and right brick building with a CAFE sign over the ground-floor shopfront are the exact texture files this build assigns - `assets/props/facades/081_modern.png` and `assets/props/facades/091_shop_terrace.png`, both viewed directly from the deploy tree during retrieval. Era HUD markers in the build also match the screenshot: KEEPER panel with HP/MP bars, SKILL TREE and SIGN IN buttons, quickbar (Q PUNCH / W KICK / E THROW / R DEFENSE, locked A TOSS / S GUARD), black city panel with the "Downtown Vancouver" pill and RETURN TO EARTH button, and no flask quickbar (that came later).

All line numbers below are in `index.html.bak-2026-10-14`.

## The mechanism in one paragraph

Buildings are generated in code from data records into real Three.js meshes with illustrated facade textures - never map tiles, never flat single-color extrusions. There are two generation paths that share one record philosophy: an authored downtown core placed by a deterministic layout generator, and a data-driven OSM district city. In both paths the same building record that draws the mesh also registers its collider and its `mapBuildings` entry, so what you see is what collides.

## Path A - authored downtown core (`buildWalkMapOnce`, line 2845)

• Layout: a block grid (`blockC`); each block gets 2x2 lots, about 30 percent of lots stay empty, park blocks (`parkBlocks`, line 3449) stay green, and a Canada Place waterfront plaza rectangle is kept clear.
• Determinism: a seeded LCG (`seed=1234567`, line ~3463) makes the downtown identical on every load - no per-session random city.
• Massing: lot buildings are 7-12 m wide/deep; height is `9 + rnd*13` plus a centre boost of up to +16 m within 110 m of the middle, so the core is taller toward the centre; some buildings get a small flat rooftop unit box (`boxAt`).
• Placement call: `buildingAt(w,h,d,x,.04+h/2,z,color)` (line 3485), which creates one `THREE.BoxGeometry` mesh per building (function at line 2994), castShadow and receiveShadow on.

## Facade assignment - the "Han's real facades" set (lines 2964-2992)

• Weighted-random pick per building, `pickFacade()` (line 2970) over `facadeFiles` (line 2965):
  • `081_modern.png` weight 30, `082_modern.png` weight 30 (modern stone, window grids, ground-floor door)
  • `031_art_deco.png` weight 15, `032_art_deco.png` weight 10
  • `091_shop_terrace.png` weight 15 (brick terrace with the CAFE shopfront)
• `facadeMats(file, roofColor)` (line 2976) builds a 6-material box array, cached per file+roof: the facade texture (`assets/props/facades/<file>`, `THREE.TextureLoader`) on the four sides (+x, -x, +z, -z), and a plain curved roof material (`curvedMat(roofColor)`) on top and bottom (+y, -y).
• Material: `THREE.MeshLambertMaterial` with the facade as map; the same texture is also the emissiveMap with emissive `0x3a4552` at intensity 0.8, so buildings stay visible at night (Han, 2026-10-09, pending real window lights at the time).

## Path B - OSM district city (`buildOsmCity`, line 3791)

• Input data: `loadOsmChunks()` (line 3760) fetches `assets/osm/vancouver_chunks.json`; each chunk carries compact building records `b = [x, z, w, d, h]` (centre, width, depth, height in metres) plus road records. Real positions, real heights, 2 km radius (`RADIUS=2000`).
• Filters: skip records beyond the radius, in water (`isWaterAt`, line 2075), or smaller than 3 m in width or depth (sheds).
• Per record it registers the walk collider and the proximity record at the same moment it queues the visual item (lines ~3822-3827), then the facade pass draws them.

## District facade pass (lines 3829-3896, added 2026-10-11)

• Archetype classification, `archOf(h,w,d)` (line 3835): height 60 m or more = tower; 25 m or more = midrise; 12 m or more = lowrise; footprint 300 m2 or more = warehouse; otherwise house.
• One `THREE.InstancedMesh` per archetype (five draw calls total): unit `BoxGeometry(1,1,1)` translated so the base sits at y=0, per-instance matrix composed from the record's position and (w, h, d) scale, no rotation.
• Textures: `loadFacadeTex(arch)` (line 3847) loads `assets/sprites/city/facade_<arch>.png?v=2` with sRGB encoding, RepeatWrapping, anisotropy 4. Material array puts the facade on the four sides and a plain grey roof material (`0x8f8f8f`) on top and bottom. A missing texture falls back to a sandy Lambert color (`0xd9b678`), so the pipeline runs before final sprites land - note the copies of these PNGs in the current deploy tree are the placeholder grids, which is why district buildings of that era read simpler than the core's illustrated facades.
• Per-instance tint variation (about 0.92-1.06, deterministic by index) keeps the district from looking cloned; instances cast and receive shadows.
• After the pass: street trees (`buildOsmTrees`) and road traffic (`buildOsmTraffic`) are built over the same chunk data.

## Ground, roads, lighting, curvature

• Ground: a 640x640 m segmented plane (`PlaneGeometry(640,640,64,64)`) in a muted green (`curvedMat(0xa7b198)`), plus textured road tiles (`roadTexture`, `assets/props/ground/road_lane.png` / `road_4lane.png` / `road_plain.png`, repeat 22 with MirroredRepeatWrapping) and grass/cobble ground textures for park and patch areas.
• Lighting: one directional sun at (70,110,40), 2048px shadow map over a plus/minus 130 m ortho box, PCFSoft shadows (lines 2955-2963).
• World curvature: `curvePatch(mat)` (line 2228) patches materials with the world-bend shader; facade, roof and ground materials all go through it, which is why the ground plane is segmented.

## Collision - record-based, visible equals collision

• Core path: every placed building calls `addCollider(x0,x1,z0,z1,bottom,top)` (line 2842) with its own footprint and height, and pushes a `mapBuildings` record.
• District path: every OSM record pushes a `walkColliders` entry `{x0,x1,z0,z1,bottom:0,top:h}` and a `mapBuildings` entry `{x,z,w,d,h,name:null,osm:true}`.
• There is no separate invisible collision geometry in this mechanism: the collider store is written from the same records, at the same moment, as the meshes.

## What later versions changed (so the difference is explicit)

• Variants inside the same family came first: the 2026-10-12 build (snapshot in `testing-full/`) generated archetype facades procedurally on a canvas (`facadeTexture()` - per-archetype base color, window grid, lit windows, a shop floor band for lowrise); the 2026-10-13/14 map-room build (`map-rebuild/`) kept the PNG archetypes and added an occlusion-fade shader (buildings between camera and player fade to 0.1).
• 2026-10-15: the district facade pass was RETIRED (the retirement note is preserved in the later index.html). Under production's CURVE_CHUNK settings the instance matrices never applied, so the instanced layer collapsed at the origin; reviving it would also have contradicted the Google-tiles-only building-visuals ruling of the time and double-rendered over the chunk pass. The data work (items, colliders, mapBuildings registration) stayed; only mesh creation stopped. The visible district became flat chunk-pass geometry and the materials of the shipped build carried no maps.
• 2026-10-16/17: Mapbox became the main line - the game renders as a Mapbox custom layer (ESPIL_P1) with fill-extrusion building display and a prebuilt collision store, and the Three.js city layers were later set to opacity 0 for the Mapbox stage-1 execution. That is the current web build, and it is what the Zealandia app wrapped before this retrieval.
• HUD also moved on after this build (glass potion flasks into the quickbar, city name shown once front-centre, guest-only entry), which is another way to date the screenshot to this era.

## Scope note - cities versus Zealandia (Han, 2026-10-20)

• This generated-building mechanism is the mechanism for the real-world CITIES in the app (Vancouver, Auckland, and the rest of the city line), and it is the payload mechanism for the regenerated Zealandia app build.
• Zealandia itself is different by design: the sunken-continent map is a TRAVEL layer only, for moving between places (including teleport/skip). Zealandia's buildings and environment are CRAFTED assets, not generated from map data - Plushy AI creates the 2D buildings and Meshy AI builds them into 3D. Nothing in this protocol should be read as Zealandia's building pipeline.
