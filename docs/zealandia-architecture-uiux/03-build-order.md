# Zealandia MMORPG - Build Order

Prepared 2026-10-20. Companion: 00-overview.md, 01-architecture.md, 02-ui-ux.md.
All dates are Mondays, America/Vancouver. QA is Han personally throughout: work goes to testing, Han pulls it and verdicts, fixes follow his verdicts. Internal checks are never reported as a QA pass.

## Sequence at a glance

• Foundations first (auth and state on the shared backend), then combat, then people and money (NPCs + Leo Coin), then the crafted region (travel map + first dungeon), then launch prep. The asset pipeline starts before everything else finishes, because crafted places are throughput-bound, not code-bound

## By 2026-10-26 - combat and skills live

Architecture and UI pieces that land:
• Backend skeleton on the shared tenancy: per-domain endpoints on api.espil.online (Fastify template basis, 01-architecture.md), shared auth wired into the app (Google sign-in, Bearer token in the app, cookie on web - one session system), characters + character_state saving to the shared database by user_id
• Client: place loader working with one internal test place (scene module + manifest + bundle download/cache), so combat is exercised inside the real loading path, not a side demo
• Combat per the shipped skill system and the enemy pack brief - blocked on Han's go-ahead for the enemy numbers (open decision below), not on plumbing. HUD per 02-ui-ux.md: quickbar grid with in-grid HP/MP flasks, touch controls added (the web build has none yet)
• Travel map exists as a screen with the registry behind it, even though v1 play at this milestone is the start place - the map ships with one unlocked pin so the 11-23 region opens by data, not by rewrite

## By 2026-11-09 - NPCs and the Leo Coin economy

• NPC service and dialogue UI live; Espil, Lunaris, and Leo placed in the start place (Lunaris as first contact, Leo at his coin post)
• Leo Coin ledger live with double-entry discipline, idempotent operations, and the wallet screen (balance + history + explainer). Knowledge-share events recorded from day one of the ledger, so the mint history is complete even if the qualifying-share rule is finalized inside this window (proposal below)
• Inventory service live (needed by the ledger's trade partners and by drops from the combat loop)
• Housing placeholder screen wired to the houses row and the home-teleport target (full housing stays v1.1)

## By 2026-11-23 - Zealandia region and first dungeon complete

• Travel map fully live: places registry populated, unlock rules working, teleport/skip between the start place, the first town, and the first dungeon
• First crafted places shipped through the Plushy-to-Meshy pipeline: start place dressing completed, one town, one dungeon. Place bundles published to object storage with manifests; art fixes ship without store releases
• Stall system v1 live: open a stall in a place, selling and seeking listings, atomic settlement through the ledger, trade records. Direct face-to-face trade window in the same release. Pickup board follows if the errand proposal is approved in time; it is not on the critical path
• Chat and presence at design-target scale (place instances, position relay, place chat + whispers + trade channel)

## By 2026-12-07 - launch prep

• Store listing complete - blocked on Han's title and price decisions (below). Privacy policy page live (the backend already holds the data the policy describes), ratings answers, screenshots from real places
• Sign-in surface check for store review: the app ships Google sign-in under the shared multi-provider structure; confirm the current App Store sign-in requirements against the final build inside this window (process check, not a design change)
• Performance and cache pass on Han's phone: bundle sizes, cache cap behavior, loader honesty (play starts when the place is ready), his verdict drives the fix list
• Economy audit dry run: replay the ledger from genesis, verify every balance from entries alone, test trade dispute evidence from trade_records

## By 2026-12-14 - launch window

• Submission inside the window with review-buffer days kept empty on purpose; the window is a window (build plan rule), so a review bounce lands inside it, not after it
• Post-launch first patch slot reserved for Han's verdict items from real play

## Dependencies

• Han's own steps (nobody else can do these): Oracle tenancy signup and Always Free instance provisioning; Google OAuth client creation for the shared backend; store developer accounts (Play about $25 one time, Apple $99 per year - on record in the v1 build plan). Known risk from the web track: Always Free provisioning has hit out-of-capacity before and waits on a simplified retry - the 10-26 backend skeleton assumes the instance exists, so provisioning is the earliest long pole
• Architecture room review: this package is written to the four alignment fixed points (checklist in 01-architecture.md); their review flags deviations only, and any flag is resolved before the 10-26 skeleton hardens around it
• Asset pipeline throughput: each crafted building costs one Plushy 2D pass, Han's approval eye, one Meshy 3D build, one cleanup pass. Design target (labeled a target): a small place is 8-15 buildings, so the 11-23 region (start place + town + dungeon) needs roughly 30-45 approved buildings across about five weeks. If throughput runs under target, cut dressing pieces first, never the dungeon's playable set
• Real-city track runs in parallel and does not block this plan: the Map team's Auckland Queen Street corridor (real-city mechanism) and the Zealandia start place (crafted) are different content on different pipelines; the app carries both
• Enemy pack go-ahead (Han) blocks combat content sign-off only; every other 10-26 item proceeds without it

## Risks

• Capacitor performance ceiling: the wrapped web build's ceiling is the app's ceiling (build plan). Mitigation already decided: Zealandia place logic stays modular, and Han's on-phone verdict after 10-26 decides whether the exit ramp (native port of the game layer) is ever needed
• Backend capacity and the $0 rule: launch architecture fits Always Free by design (01-architecture.md, cost check). Success beyond free tiers forces a paid-shape decision - flagged there as Han's call, never an automatic upgrade
• Meshy output variance: some 2D art will build badly in 3D. The pipeline absorbs this at the approval gate (2D approved first, 3D spot-checked per building, budget cleanup last), but a bad batch week directly eats the 11-23 buffer
• Oracle provisioning capacity (above): if the instance is not up, the 10-26 milestone degrades to client combat with local state and the backend lands late against 11-09. Stated plainly so it is a managed risk, not a surprise
• Store review timing: outside our control; the 12-14 window assumes submission by 12-07 (build plan rule)
• Trading trust: the economy is promise-based by canon. The strict signup, atomic settlement, and trade records are the mitigations; a reputation layer is deliberately not in v1 scope

## Open decisions for Han (not decided in this package)

Canon decisions, still open:
• Store listing title - DECIDED (Han, 2026-10-21): "Espil Online: A to Zealandia" (28 characters); config updated
• App price point
• Enemy pack numbers go-ahead - Strayer (chaser, 30 HP, 12 EXP), Spitter (ranged, 45 HP, 25 EXP), Brute (tank, 150 HP, telegraphed slam, 60 EXP), tuned to the shipped weapons (bare 8, sword 14, dagger 5x2, hammer 26 AoE, staff 12; player 100 HP / 50 MP)

Design proposals in this package that need Han's sign-off before they are built as written:
• Travel cost: none in v1 (teleport/skip free between unlocked places). If Han wants a cost, it lands on the travel info card before confirming
• Knowledge-share mint rule: which in-game sharing actions qualify to mint Leo Coin, and their rates. The ledger and event table support any rule; the rule itself is Han's economy call
• Pickup errand mechanics: reward escrow through the trade-in-flight account, delivery confirmation by the requester, and dispute handling on trade-record evidence
• New-account trade limits: the design target in 01-architecture.md (stall selling unlocks after the start place intro) is a target, not a decided rule
