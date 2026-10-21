# Zealandia App - V1 Build Plan
Prepared 2026-10-16 (America/Vancouver) - for Han's engine decision, then scaffold starts

## What Zealandia is (canon, Han 2026-10-15)
• Cauldron is the space itself, accessed through espil.online
• Zealandia is a game dungeon inside that world, set on New Zealand's hidden, sunken continent
• The app is the paid game layer: "Espil Online: Zealandia Extension pack" (Han, 2026-10-10) - TITLE SUPERSEDED (Han, 2026-10-21): the app is titled "Espil Online: A to Zealandia" (28 characters)
• The free web at espil.online stays the social and commerce hub: navigation, meeting people, chatting, shopping
• Battle comes first, housing after. Housing exists on both from the start: web is view-only except purchased appearance items, the app gets full customization

## What already exists and is checked (not starting from zero)
• The live game build: the Three.js Espil Online client (testing-full/index.html, 347K, 2026-10-12; shared deploy copy 402K, 2026-10-16) with the Vancouver map, 3D chibi characters, HUD, minimap, chat, and hotbar
• Characters: Han's own Meshy GLBs (male and female, 22 to 23 bone rigs) with walk, run, climb, and dive clips already wired and retarget-verified
• Skill system: skill tree shipped 2026-10-05 (Cauldron Slash plus 5 weapon variants, SP economy, gainExp wired). Real numbers on record: bare 8 dmg, sword 14, dagger 5x2, hammer 26 AoE, staff 12; player 100 HP / 50 MP
• Enemy pack: a full tuning brief is already prepared and waiting for Han's go-ahead (files/enemy-pack-tuning/brief.md, 2026-10-05): Strayer (chaser, 30 HP), Spitter (ranged, 45 HP), Brute (tank, 150 HP, telegraphed slam), with spawn, aggro, leash, and night-bias rules tuned to the shipped weapon numbers
• Concept art on file in the goal assets folder: Zealandia zone rising from the ocean, dungeon entrance, Cauldron portal key art, Espil character concept (Sep 2026 batch, dark-fantasy purple and teal)
• NPCs and economy are already designed: Espil (cauldron maker, Han's self-insert), Lunaris (keeper), Leo (coin maker), Leo Coin growing through knowledge sharing

## V1 scope - one dungeon, playable end to end
• Entry: from the Cauldron / Vancouver hub, a portal takes the player to the Zealandia dungeon entrance
• One dungeon zone built as a bounded area (not a second open world), reusing the game's existing movement, camera, collision, and HUD
• Combat loop: the 3 enemy tiers from the prepared brief, EXP and SP flowing into the existing skill tree, death respawns at the dungeon entrance with no penalty for v1
• Controls: the existing scheme carries over (Shift jump, Space interact, Ctrl sprint toggle, qwerasdf skills, 1234 items, I inventory, M map, K skill tree, P status), plus touch controls for mobile, which the app needs and the web build does not yet have
• Housing in v1: the existing H home-teleport placeholder stays a placeholder. Full housing customization is v1.1, after battle proves fun
• Out of scope for v1: multiplayer, bosses, loot drops, a second region, console ports

## Terrain - decided by Han 2026-10-16: the released map of the sunken land
• Han directed the dungeon location to be the old map of New Zealand, the land that sank, using released map data. The terrain package is built and sits in files/zealandia-map-data/: a 2,048 x 2,117 elevation grid (EPSG:3851, the official maps' own projection) from the GMRT Grid, cross-checked against NIWA's 250 m NZ Region Bathymetry model behind GNS Science's Te Riu-a-Maui / Zealandia maps
• The game view is the official bathymetric poster's view: the continent with the oceans drained. Plateaus become lowlands, trenches become the edge canyons, today's New Zealand stays the mountain spine. 20 named real features (Lord Howe Rise to Campbell Plateau) are sampled with their grid elevations in zealandia_meta.json as the zone list
• Known limits, stated in the data README: the full-extent source is about 6 km cells, so peaks are smoothed (Aoraki 1,778 m in-grid vs 3,333 m native) and Cook Strait is land-bridged; a detail pass for the first chosen zone comes later from the same sources
• START ZONE DECIDED (Han, 2026-10-16): Auckland, the old capital (1841-1865), chosen by Han over Wellington (the capital since 1865) for the old-map theme, superseding the Challenger Plateau / Campbell Plateau options. The Auckland detail zone is built: files/zealandia-map-data/zones/auckland/ (1024x1024 NZCS grid at 286 m/px from a fine GMRT subset, NIWA identify cross-checked; spawn at Auckland CBD). Han also ordered Auckland generated in espil.online itself; the request was sent to the Map team and the COO on 2026-10-16 with the terrain package and the standing constraints (testing first, sync-lock, no production push)
• FIRST PLAYABLE AREA NARROWED (Han, 2026-10-16): not all regions - a small area first, "such as the hottest street in Auckland". That is the Queen Street corridor (the CBD's Golden Mile, 1.7 km from Customs Street at the waterfront to the Karangahape Road ridge; corridor about 1.8 km x 2.7 km). Corridor package built: files/zealandia-map-data/zones/auckland/queen-street/ (raw OSM for the corridor - 2,252 buildings, 882 with height/levels, Queen Street itself mapped at about 2.0 km; smooth terrain surface plus NIWA-verified street gradient points; entry at the waterfront north end, hub at Aotea Square, south gate at Karangahape Road). Scope refinement relayed to the Map team and the COO the same day; their Auckland phase 1 narrows to this corridor

## Engine route - DECIDED by Han 2026-10-16: Capacitor wrap
• Han picked Option A, the Capacitor wrap of the current Three.js build. The scaffold is built at ~/workspace/zealandia-app/ (Capacitor 8.5.3, appId online.espil.zealandia): the sync script copies the shared deploy copy read-only, excludes the 338 MB character GLBs (remote assets), rewrites the Places proxy paths in the copy only, and patches the copy's PLACES_PROXY gate so Places works inside the app. Android and iOS projects are generated and synced; native compilation happens in Android Studio on Han's PC (iOS needs a Mac). The Godot port (Option B) stays the exit ramp if the wrapped build fails Han's on-phone test
• The original comparison, kept for the record:
• Option A, Capacitor wrap of the current Three.js build (recommended for v1): reuses 100 percent of the game Han has already verified on his PC, one codebase ships to Google Play and the App Store, and it is the only route that can hit the combat milestone on Monday 2026-10-26. Cost: it is still a WebView, so the performance ceiling is the web build's ceiling. Exit ramp: keep the Zealandia dungeon logic in its own module, so a later native port moves the dungeon, not the whole game
• Option B, Godot 4 native port: a real performance gain and the goal record's original recommendation, but it is a rewrite. The Vancouver map, self-built city, characters, skills, and HUD do not transfer; v1 would miss both the Oct 26 combat milestone and the December window
• Option C, PWA only: no store presence and no paid listing, which contradicts Han's paid-app decision, so it is not a real option for this product
• Recommendation: Option A for v1, judged by Han playing it on his own phone. That follows his standing rule for the app work: if the wrapped build does not satisfy him, we port the dungeon natively with the fun already proven, instead of porting unproven gameplay

## Store readiness (facts already flagged to Han, 2026-10-15)
• Google Play developer account: about $25, one time
• Apple Developer Program: $99 per year, recurring; the paid app is what covers it
• Store commission: about 15 percent at this scale (small-business tier)
• Still needed before any submission: a privacy policy page, store screenshots, an app icon set (the Espil icon assets already exist), and age/content ratings answers
• Privacy blocker to fix first: the old Cauldron character-creation flow asked for a real home address. That field must not ship in a store app. It gets removed or replaced with an in-game home location before submission

## Milestones (dates verified, all Mondays, America/Vancouver)
• 2026-10-26: combat plus skills live in the Zealandia dungeon (the standing combat milestone, 10 days out)
• 2026-11-09: NPCs (Espil, Lunaris, Leo) and the Leo Coin economy in the dungeon
• 2026-11-23: Zealandia dungeon complete, housing placeholder wired
• 2026-12-07: launch prep - store listings, privacy policy, QA on Han's phone, polish
• 2026-12-14: launch window - treat as a window, not a hard date

## Risks stated plainly
• No production deploy is touched by this work. The Vercel freeze and the single-batch espil.online deploy stay exactly as Han ordered
• Capacitor performance is the open question, and only Han playing the build on his phone settles it. The plan is built so that answer costs days, not months
• Store review timelines are outside our control; the Dec 14 window assumes submission by Dec 7

## Addendum 2026-10-20 - Zealandia world model (Han)
• In Zealandia, things are made new. The continent map is a travel layer only: moving between places by teleport/skip. It is not the playable ground
• Zealandia's buildings and environment are crafted assets: Plushy AI creates the 2D buildings, Meshy AI builds them into 3D. Real-world cities keep the old generated-building mechanism (see old-building-generation-protocol.md)
• Zealandia is an MMORPG with a proper backend. Architecture + UI/UX package: files/zealandia-architecture-uiux/ (overview, architecture, UI/UX spec, build order), prepared on Han's instruction with templates permitted
