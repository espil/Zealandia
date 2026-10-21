# Zealandia MMORPG - Architecture

Prepared 2026-10-20. Companion: 00-overview.md (product shape), 02-ui-ux.md (screens and flows), 03-build-order.md (sequence).
Direction: Han, 2026-10-20 (crafted world, travel-map movement, MMORPG with a proper backend; templates permitted).

## Alignment fixed points (Architecture room via COO, 2026-10-20) - settled, not options

This design complies with all four fixed points. They are stated here so the Architecture room review only has to flag deviations.

• Fixed point 1 - identity is one: complied with. Users and identities live in the shared Espil Online account system (the approved Oracle scope v2 design). This document designs no Zealandia-only account, no second user table, and no separate signup. The app's sign-in screen is a client of the shared identity service
• Fixed point 2 - sessions are one: complied with. Backend-issued opaque session tokens, stored hashed in the database, are the only session mechanism. The web carries the token by httpOnly cookie on espil.online; the app carries the same token as a Bearer header. That channel difference is the one already designed in scope v2 (30-day sliding expiry, 90-day hard cap). The app adds no session store of its own; on-device it keeps the token in the platform secure store (Capacitor secure storage), never in plain local files
• Fixed point 3 - game data attaches to the same database by user_id: complied with. Every Zealandia table below keys to the shared user_id (through the character row). Nothing game-specific forks the account data
• Fixed point 4 - one tenancy, one host: complied with. All game services run inside the same Oracle tenancy, behind api.espil.online, split into per-domain endpoints (auth, characters, travel, inventory, economy, stalls, social). This document proposes no separate backend host or tenancy for the game

## System shape

• Client: the existing Espil Online web build inside the Capacitor shell (~/workspace/zealandia-app). One codebase for web and app; the app adds touch controls, secure token storage, and the asset cache
• API: api.espil.online, per-domain REST endpoints plus one realtime channel (Socket.IO) on the same host
• Database: the shared backend database from scope v2 (SQLite at launch), holding shared account tables and the Zealandia tables in this document, keyed by user_id
• Asset store: Oracle Object Storage (Always Free allowance, S3-compatible API) serving crafted-place GLB bundles and place art, fronted by its public CDN-style URLs; the app downloads and caches per place
• No other hosts, no second backend, no game-specific cloud account

## Client

• Shell: Capacitor wraps the shipped web build. Landing, sign-in, character flow, HUD, chat, and quickbar are the existing DOM UI (02-ui-ux.md), extended - not replaced - for Zealandia
• Scene model: the client loads one place at a time. A place package is a scene module (layout, spawn points, NPC placements, collision store) plus an asset bundle (crafted GLBs and textures listed in the place manifest). Real-city scenes keep the old generated-building mechanism and their existing loading path; the place loader is shared, the scene content differs
• Asset bundles on demand: bundles are never in the app binary (the same rule the scaffold already applies to the 338 MB character GLBs). First entry to a place downloads its bundle by manifest (per-file hash and size), verifies hashes, and caches it. Later entries load from cache; a manifest version bump re-downloads only changed files
• Cache discipline: per-place bundles, a total cache cap as a design target (target: 1.5 GB, least-recently-visited places evicted first, the start place protected), and a settings toggle for download on Wi-Fi only
• Travel is a client state change, not a world walk: leaving a place unloads its scene and returns to the travel map screen (02-ui-ux.md)

## Travel map service (domain: travel)

• Places registry: a server table is the single source of truth for places - place_id, display name, type (town / dungeon / hub), pin position on the continent art (normalized x/y over the drained-continent render), unlock rule, bundle manifest reference, and open/closed flag. Adding a place is a data row plus a published bundle, not an app release
• Unlock state: per character, server-held (character_place_unlocks). A place unlocks by the rule on its registry row: start place open by default, others by first arrival from a linked place, NPC grant, or quest flag. The client only displays state; it never decides it
• Teleport/skip rules: travel is instant between unlocked places - skip is the mechanic, there is no continent walking to simulate. A travel request validates (character exists, place open, place unlocked for this character), returns the place manifest and a short-lived place join token, and records the character's current place. Cost: none in v1 - flagged as a proposal for Han in 03-build-order.md
• Auckland start: the start place is the Auckland old-capital area on the Zealandia side; its ground reference is the built Auckland detail package (~/workspace/goals/zealandia-game-project/files/zealandia-map-data/zones/auckland/, 1024 x 1024 grid at 286 m/px, spawn at Auckland CBD). The Queen Street corridor package belongs to the real-city track, not this place

## Backend services (per-domain endpoints on api.espil.online)

• Auth (shared, from scope v2 - not redesigned here): Google sign-in, multi-provider identities table, backend-issued sessions as above. The game adds no auth endpoints; the app calls the same ones the web uses. Signup strictness is the trust gate for the trading economy: Google-only at this step, one account per person enforced at the identity layer, and the character-creation flow collects no real-world address (the old Cauldron address field must not ship - already flagged in the v1 build plan)
• Players and characters (domain: characters): character CRUD under the shared user_id, character state (current place, position within place, HP/MP, level, EXP, SP, skill tree state) saved server-side at checkpoints and on place exit. The client sends intents and state deltas; the server is the record
• Inventory (domain: inventory): item definitions (item_defs) and per-character stacks/instances. Every mutation is a server transaction with an idempotency key, so a retried request cannot duplicate an item
• Leo Coin ledger (domain: economy): double-entry, server-authoritative. Rules:
  • Every coin movement is one transaction with balanced debit and credit entries in ledger_entries against ledger_accounts (character wallets, NPC accounts, the system mint account, a trade-in-flight account). Balances are the sum of entries, materialized into the account row inside the same transaction
  • No endpoint accepts a client-stated balance or a direct balance edit. Coins move only through named operations: mint (knowledge sharing), npc_trade, stall_sale, stall_seek_fulfil, direct_trade, pickup_reward
  • Mint rule: Leo Coin supply grows through knowledge sharing (canon). Mechanically, mint entries are issued only by the system mint account against recorded knowledge_share_events (a server-verified sharing action: who shared, what, when, verification state). What counts as a qualifying share is a design proposal flagged for Han in 03-build-order.md; the ledger supports any rule without schema change
  • Every economy mutation carries an idempotency key and writes an audit trail (actor, operation, entries, timestamp) that support can replay
• Trading and stalls (domain: stalls): the Gersang-style stall system
  • A player opens one stall in their current place instance, posts selling listings (item instance + Leo Coin price) and seeking listings (wanted item + offered price), and closes or edits them at will
  • A purchase is one atomic server transaction: item moves seller-to-buyer, coins move buyer-to-seller through the ledger, the listing closes. There is no fee - by construction: the trade transaction writes exactly two ledger legs and the schema has no fee account or fee field, so a fee cannot be charged by accident or added silently later
  • Face-to-face direct trade: both parties confirm the same offer set in a trade window; execution is the same atomic transaction. Until both confirm, nothing moves
  • Pickup errands: a player posts a pickup request (item, store context, offered reward); another player accepts, buys, delivers, and the reward settles through the ledger on delivery confirmation. Errand dispute handling is promise-based with the trade record as evidence - mechanics detail flagged as a proposal in 03-build-order.md
  • Espil House models are ordinary inventory items with a model asset reference, so they trade through the same stall and ledger path (canon: house models trade for Leo Coin)
• Chat and presence (domain: social): presence is ephemeral (who is in which place instance), chat is place-scoped plus whispers and a trade channel. Chat is not part of the economy record; reports attach the relevant trade_records entry
• Housing (domain: housing): v1 ships the placeholder only - a houses row per character and the existing home-teleport target, no customization endpoints. The v1.1 customization surface (house_items, placement state) is named now so v1 data does not need migration later

## Realtime model

• REST carries: auth, character reads/writes, travel, inventory, wallet and ledger reads, stall CRUD and trade execution, housing placeholder. If it changes money or items, it is REST and transactional - never a socket message
• The realtime channel (Socket.IO on api.espil.online) carries only ephemeral state: presence joins/leaves, position relay inside a place instance, chat, stall open/close beacons in the instance, NPC/event pings
• Place instances: each place runs as one or more instances; the travel service assigns the join token to an instance with room. Design targets, labeled as targets: 50 players per place instance, position relay at 5 updates per second per player, chat latency under a second on a normal connection
• Server authority split, stated honestly: the economy and inventory are fully server-authoritative. Movement is client-reported with server sanity checks (speed and bounds) at this scale; anti-cheat hardening beyond that is a post-launch item, not a launch blocker

## Data model (core tables; all game tables key to the shared user)

• users, identities, sessions - shared account tables from scope v2 (not redefined here)
• characters - id, user_id, name, gender/appearance refs, created_at; one row per character
• character_state - character_id, current_place_id, position (x/y/z + facing), hp, mp, level, exp, sp, skill_state (JSON), updated_at
• character_place_unlocks - character_id, place_id, unlocked_at, unlock_source
• places - place_id, name, type, pin_x, pin_y (normalized over the continent art), unlock_rule (JSON), manifest_ref, is_open
• item_defs - item_id, name, kind (gear / consumable / material / house_model / misc), stackable, asset_ref
• inventory_items - id, character_id, item_id, quantity or instance data (JSON), location (bag / equipped / stall / house)
• ledger_accounts - account_id, owner_type (character / npc / system), owner_id, balance (materialized), currency (LEO)
• ledger_entries - id, transaction_id, account_id, delta, operation, counterparty ref, idempotency_key, created_at
• knowledge_share_events - id, character_id, share_kind, content_ref, verified_state, minted_transaction_id, created_at
• stalls - id, character_id, place_id, instance ref, title, is_open, created_at
• stall_listings - id, stall_id, side (selling / seeking), item_id or instance ref, quantity, price_leo, state (open / fulfilled / cancelled)
• trade_records - id, kind (stall_sale / seek_fulfil / direct / pickup), parties, listing ref, ledger transaction_id, state, created_at
• pickup_requests - id, requester, item ref, reward_leo, accepter, state (open / accepted / delivered / settled / disputed)
• houses - character_id, house_place ref, model_item ref (placeholder fields for v1; placement and items land in v1.1)

## Asset pipeline, end to end (Plushy 2D to Meshy 3D to the app)

• Art list per place: the place's design sheet lists every building and environment piece with a name, role (house, shop, hall, dungeon dressing), and size class. Nothing enters the pipeline off-list
• Plushy AI 2D step: prompt and style rules - MapleStory 2 blocky-cute chibi style; 3/4 view consistent with the existing Espil facade convention; clean transparent background; no text or signage lettering baked in (signs are separate small assets); one building per image; consistent palette anchors per place (roof and trim colors from the place sheet). Output is reviewed by Han's eye before it goes further - a rejected 2D image never reaches Meshy
• Meshy AI 3D step: image-to-3D build from the approved 2D art, using the existing custom Meshy connection and Han's established character-asset workflow as the operating pattern (characters already ship as Meshy GLBs)
• Cleanup and budget (design targets, labeled as targets): per building - at most 20k triangles for a hero building, 8k for a standard building, 2k for dressing; one 1024 texture per building (512 for dressing); pivots at ground center, real-world scale in meters, collision box derived from the footprint and stored in the place's collision store. Cleanup tooling: glTF-Transform / gltfpack (open source) for decimation and packaging
• Publish: GLB plus a per-place manifest (file list, hashes, sizes, bundle version) uploaded to Oracle Object Storage; the places row points at the manifest. A bad bundle is rolled back by repointing the manifest - no app update needed for art fixes
• In-app: download on first entry, hash-verify, cache (see Client). Place art updates ship without store releases; gameplay code changes still go through the store
• Throughput is the schedule risk: every building costs one 2D pass, one 3D build, and one cleanup pass. 03-build-order.md sizes the first places so the pipeline, not the code, sets the pace

## Security and trust

• Signup is the first trade-safety control (canon: strict on purpose, because trade runs on trust): shared Google sign-in, identity-layer uniqueness, no anonymous trading - a character must be tied to a verified shared account before stalls, direct trade, or pickups unlock
• Server-authoritative economy: balances, inventory, and trade execution exist only server-side; the client is a display. Dupes are prevented by idempotency keys and single-transaction moves, not by client honesty
• Trade safety: atomic two-leg settlement, both-party confirmation for direct trades, full trade_records evidence for disputes, rate limits on stall posting and trade frequency, and new-account trade limits as a design target (target: stall selling unlocks after the first place's intro is complete)
• Session safety: hashed opaque tokens, sliding 30-day expiry with the 90-day cap, per-device session revocation from the shared account system
• Content safety: chat reporting keyed to place instance and timestamp; place chat is the only public channel at launch

## Scaling path

• Launch shape: one Oracle Always Free instance runs API plus realtime; SQLite is the database; object storage serves all heavy bytes. This is deliberately small - the milestones need correctness of economy and travel, not scale
• First scale step (no new host): move bundle and art delivery fully to object storage URLs (already the design), add HTTP caching headers, keep the instance for API only
• Second step (only if player numbers force it, and it breaks the $0 rule - flagged, needs Han's call): a larger compute shape, a managed database, and the Socket.IO Redis adapter for multi-instance realtime. Nothing in the v1 schema or endpoints blocks this move
• What does not change at any step: one identity, one session system, one database of record, one host name - the fixed points hold while the box grows

## Template basis - what is template, what is custom

• Client shell: Capacitor's own project scaffold (already generated at ~/workspace/zealandia-app) - template. The game client itself is the existing Espil Online build - custom, already shipped and verified by Han on his PC
• Backend skeleton: a Fastify (Node.js + TypeScript) modular service template as the starting file layout (per-domain route/service folders) - template basis for structure only. All domain logic in this document (ledger, stalls, travel, unlocks) is custom code written to this spec. Convergence (2026-10-20): the shared skeleton is this Fastify one for BOTH tracks - the Oracle scope v2 text named Node + uWebSockets, and that notation yields for the shared skeleton, per the Architecture room's recommendation accepted by this package, since both tracks share one skeleton and one auth module. Ratified by Han on 2026-10-20 (relayed via COO): the Fastify unification is decided, and this package enters the build order as written
• Realtime: Socket.IO - library, with its standard presence/chat patterns as the starting point; instance assignment and place rules are custom
• Auth: the approved scope v2 module - custom, shared with the web, reused as-is
• Asset tooling: Plushy AI and Meshy AI are services, not templates; glTF-Transform/gltfpack are open-source tools. The prompt/style rulebook and budgets are custom to this project
• UI kit: the existing Espil Online glass design system - custom (02-ui-ux.md). No third-party game UI kit is adopted; HUD layout conventions follow standard mobile MMORPG patterns as reference only

## Cost check against the $0-recurring rule

• Oracle Always Free: compute, database storage, and the object storage allowance cover the launch backend at $0 recurring - inside the rule
• api.espil.online runs on the same tenancy - no new hosting bill
• Meshy AI and Plushy AI: generation is usage-based spend during production sprints, not a recurring subscription. Flagged as a watch item: building volume for the 11-23 region milestone is the one place spend can creep; batch generation per place and Han approves sprint volume
• Store fees are already on record in the v1 build plan and sit outside infrastructure: Google Play about $25 one time; Apple Developer $99 per year, which the paid app exists to cover. They are named here so the exception is visible, not discovered later
• Nothing else in this architecture requires a paid tier at launch. Anything that would is marked in the scaling path as needing Han's call first
