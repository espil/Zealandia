# Espil Online: Zealandia Edition

The paid MMORPG app of Espil Online, set on Zealandia - the sunken continent under New Zealand, risen again as a crafted game world.

## The world model

• The continent map is a travel layer only: the drained Zealandia map moves the player between places (teleport / skip)
• Zealandia's places are crafted, not generated: Plushy AI creates the 2D buildings, Meshy AI builds them into 3D
• Real-world cities (Vancouver, Auckland, and the rest) run on the older generated-building mechanism, retrieved and documented in docs/old-building-generation-protocol.md
• Trading between players and the Leo Coin economy are core axes, with a proper MMORPG backend behind the app

## Repository map

• `docs/` - the v1 build plan, the architecture + UI/UX package (docs/zealandia-architecture-uiux/), the old building generation protocol, the enemy pack tuning brief, the store listing decision pack, and reference captures
• `map-data/` - the released-data terrain package: GMRT-sourced elevation grids for the whole continent, the Auckland zone, and the Queen Street corridor, with the build scripts that made them. Elevation sources and validation are documented in map-data/README.md. The NIWA TIFF exports that failed integrity checks are documented there and archived locally; they are not in this repo
• `app/` - the Capacitor app source (appId online.espil.zealandia): config, the web sync script, and the Android / iOS project scaffolds

## App payload

The playable web payload (`app/www/`, and the `public/` copies inside the native projects) is generated, not stored in git:

• `app/scripts/sync-web.mjs` assembles www from the staged Espil build sources
• The current payload is a hybrid: the current espil.online testing UI over the revived textured-facade building generation, with the first Zealandia town (Auckland region, real drained terrain) being built into it now
• Native builds compile on a developer machine: Android Studio for Android, Xcode on a Mac for iOS

## Status

• Architecture package ratified 2026-10-20 (backend unified on Fastify, Node.js + TypeScript, one identity and one session system shared with the web, api.espil.online)
• Milestones: combat + skills 2026-10-26, NPCs + Leo Coin economy 2026-11-09, Zealandia region + first dungeon 2026-11-23, launch prep 2026-12-07, launch window 2026-12-14
