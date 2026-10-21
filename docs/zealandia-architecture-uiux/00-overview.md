# Zealandia MMORPG - Overview

Prepared 2026-10-20 (America/Vancouver). Package: 00 overview, 01 architecture, 02 UI/UX spec, 03 build order.
Direction: Han, 2026-10-20. This page is the one-page product shape; detail lives in 01-03.

## What Zealandia is

• Positioning (Han, 2026-10-20): Espil Online's essence is a community and a free knowledge, information and skill sharing solution; the game (MMORPG) is its form. Zealandia is that game form - copy leads with community and sharing, and game elements are described as the form
• A paid mobile MMORPG: "Espil Online: A to Zealandia" (title decided by Han, 2026-10-21) for Google Play and the App Store (Capacitor wrap, appId online.espil.zealandia, scaffold at ~/workspace/zealandia-app)
• The game layer of Espil Online. The free web at espil.online stays the social and commerce hub; the app is where the game is played
• Battle first: combat and skills land before housing. Housing is a placeholder in v1 and full customization in v1.1
• In Zealandia, things are made new (Han, 2026-10-20): the world is crafted by us, not generated from real-world data

## The world model - three layers

• Travel layer - the continent map: the whole map of sunken Zealandia exists only for moving between places, by teleport/skip. It is not playable ground; nobody walks the continent. Its base art already exists: the drained-continent render from the released bathymetry data (~/workspace/goals/zealandia-game-project/files/zealandia-map-data/processed/zealandia_risen_preview.png, with the 2,048 x 2,117 EPSG:3851 elevation grid beside it)
• Crafted places - where play happens: towns, the Auckland start area's Zealandia side, and dungeons are bounded, authored environments. Every building and environment piece in them is a crafted asset (pipeline below). A place is entered from the travel map, loads as its own scene, and is left by returning to the travel map
• Real cities - the other track: Vancouver, the Auckland Queen Street corridor, and later cities belong to the Espil Online world and keep the old generated-building mechanism (~/workspace/goals/zealandia-game-project/files/old-building-generation-protocol.md). They are not Zealandia places and do not use the crafted pipeline. The door between the two worlds is the existing portal entry from the Cauldron side; inside Zealandia, the travel map rules all movement

## Pillars

• MMORPG with a proper backend: one shared account, server-held character state, presence and chat, instanced places (01-architecture.md)
• Trading is a core axis (Han, 2026-10-19): player-to-player trade through the Gersang-style stall system - anyone opens a stall, posts seeking or selling, and trades face to face in real time. No transaction fee, ever. The economy runs on promises - the credit era - protected by a deliberately somewhat strict signup
• Leo Coin: the in-world currency, made by Leo (coin maker). Its supply grows through knowledge sharing, and Espil House 3D models trade for it in-world
• A crafted world: Plushy AI draws the buildings in 2D, Meshy AI builds them into 3D. Style anchor: MapleStory 2 blocky-cute chibi, consistent across every place
• People of the world: Espil (cauldron maker, Han's self-insert), Lunaris (keeper), Leo (coin maker)

## The Plushy-to-Meshy pipeline at a glance

• Asset production policy (Han, 2026-10-21): skill effects, footprint effects, all monsters, and buildings are produced with Plushy AI; character assets are pre-made in 2D first, then built into 3D with Meshy AI. Zealandia's monsters and buildings follow this policy (the town's current procedural monsters and buildings are placeholders under it)
• Plushy AI produces a 2D building (front 3/4 view, clean alpha, house style) from a place's art list
• Meshy AI builds the 2D art into a 3D model
• The model is cleaned and optimized to the per-building budget, exported as GLB, and published to object storage with a versioned manifest
• The app downloads a place's bundle on first entry and caches it; the travel map never waits on 3D assets
• End-to-end detail, budgets, and naming rules: 01-architecture.md, asset pipeline section

## Milestone map (all Mondays, America/Vancouver)

• 2026-10-26 - combat and skills live
• 2026-11-09 - NPCs (Espil, Lunaris, Leo) and the Leo Coin economy
• 2026-11-23 - Zealandia region plus first dungeon complete: travel map live, first crafted places open
• 2026-12-07 - launch prep: store listing, privacy, polish, Han's phone verdicts
• 2026-12-14 - launch window (a window, not a hard date)

## Decisions still open for Han

• Store listing title DECIDED (Han, 2026-10-21): "Espil Online: A to Zealandia" (28 characters); config updated
• App price point
• Enemy pack numbers go-ahead (Strayer / Spitter / Brute brief, 2026-10-05, tuned to the shipped skill numbers; player 100 HP / 50 MP)
• Full list with flagged design proposals: 03-build-order.md
