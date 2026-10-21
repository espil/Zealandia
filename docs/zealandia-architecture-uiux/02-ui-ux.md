# Zealandia MMORPG - UI/UX Spec

Prepared 2026-10-20. Companion: 00-overview.md (world model), 01-architecture.md (services behind these screens), 03-build-order.md (when each screen lands).
The rule for this spec: Zealandia extends the shipped Espil Online interface. It does not introduce a second design language.

## Design language

• Glass: the current game's glass design system carries over unchanged - dark translucent glass panels, soft borders, liquid glass potion flasks, the glass loader sequence on transitions. New Zealandia screens are built from the same components
• Landscape first: the app opens and plays in landscape on mobile (current Espil Online rule). Portrait is supported only where the store and system force it (sign-in web view), never for play screens
• Color anchors, from the current game: HP red and MP blue (flasks and bars), Espil neon green as the brand/signage accent, gold for Leo Coin amounts, glass-white text on dark glass. Locked or inactive states go grey, following the production city-reel convention
• Typography: the current build's display face for place names and titles; Manrope for body, lists, and chat. Numbers in the wallet and ledger views use tabular figures
• Motion: transitions reuse the glass loading sequence; the place-name card shows once, large and front-center, on entry and then dismisses (current production rule). No new transition vocabulary

## Screen inventory (each screen, one purpose)

• Splash / loading - the glass loader while the app, session, and the current place's bundle prepare. Never a blank screen, never a percentage-with-text readout (current loader standard: glass and liquid only)
• Sign-in - one shared Espil Online account (Google active; the provider row is structured for Apple and Facebook later, per scope v2). States clearly that one account covers web and app
• Character select - pick a character or go to create. Shows name, level, current place
• Character create - name, male/female choice (the current build's kept choice), starting appearance from the existing character system. No real-world address field anywhere in this flow (store blocker already flagged in the v1 build plan); "home" means the in-game home location only
• Travel map - the Zealandia continent: place pins, unlock states, place info card, travel action. The movement hub of the game
• Place (in-world) - the playable screen: 3D place, HUD, chat, other players, NPCs, stalls. Combat happens here, not on a separate screen
• NPC dialogue - bottom glass sheet: portrait, name, text, choices. Used by Espil, Lunaris, and Leo, and by quest and shop NPCs later
• Inventory - bag grid, equipped slots, item detail card, Leo Coin balance pinned in the header
• Skill tree - the shipped tree UI (K on web), adapted to touch; SP and EXP shown as in the current build
• Wallet - Leo Coin balance, recent ledger history (named operations, counterparty, amount), and the knowledge-sharing explainer with the player's share record
• Stall browse - listings of open stalls in the current place: selling and seeking tabs, item, price, seller, distance order
• My stall - open/close the player's stall, post or cancel selling and seeking listings, completed trade record
• Trade window - face-to-face direct trade: both offer sets, both confirm states, execute only on double confirm
• Pickup board - open pickup requests, accept, delivery state, reward. (Mechanics detail is a flagged proposal in 03-build-order.md)
• Housing - v1 placeholder: the player's home summary and the home-teleport target, marked as coming with v1.1 customization. No dead buttons - the placeholder explains itself
• Settings - account/session (devices, sign out), downloads (Wi-Fi only, cache size, clear cache), audio (BGM, SFX), display (text size, reduce motion), support links

## Key flows, step by step

### First launch
• 1. Splash with the glass loader while the session check runs
• 2a. Valid shared session: straight to character select. 2b. No session: sign-in (Google). Copy states the strictness plainly: one verified account, because trading runs on trust
• 3. Character select; a new player goes to character create (name, male/female, appearance), then a short intro that teaches movement, the quickbar, and the travel map in the start place
• 4. The player lands in the Auckland start place with the place-name card shown once. Lunaris is the first NPC met; Espil and Leo are placed in the start place for the 11-09 milestone
• 5. The travel map is taught on first open: the whole continent, one unlocked pin (here), the rest locked with their unlock hints

### Teleport / skip
• 1. Open the travel map (M on web; map button on touch) from any place
• 2. Tap a pin: the info card shows name, type, a one-line description, unlock state, and - if unlocked - the Travel button. Locked pins show the unlock condition instead ("Opens after: ...")
• 3. Tap Travel: short glass loader, bundle check (download first if this place is uncached, with size shown before downloading on mobile data), then the place loads and the name card shows once
• 4. There is no walking between places and no travel mini-game. Skip is instant by design - the map is for moving, places are for playing

### Entering a place (what the player feels)
• Loader until the place is actually ready (scene + bundle + presence join), then control is handed over - the load gate follows the current build's rule that play starts when everything has spawned
• Place-name card, large, front-center, dismisses on its own. Spawn at the place's arrival point; other players, NPCs, and open stalls are already visible

### Combat
• Combat is in-place on the Place screen: target appears in-world, the quickbar is the control surface (skills on the letter slots, items on 1-4), HP/MP flasks drain in the grid
• Enemy intent is readable in-world (the Brute's telegraphed slam is the pattern from the enemy brief). Death returns the player to the place entrance (v1 rule from the build plan: no death penalty in v1)
• EXP/SP gains surface as the current build's gain feedback, flowing into the existing skill tree

### Stall trading - buy
• 1. Walk up to an open stall (or open Stall browse for the current place) and open it
• 2. Selling tab: item, price in Leo Coin, quantity. Tap Buy, confirm once on the summary card (item, price, seller, resulting balance shown before confirming)
• 3. Settlement is instant and server-side (01-architecture.md). The item is in the bag and the wallet history shows the entry before the player closes the stall

### Stall trading - sell and seek
• 1. My stall: Open stall (one per place), Post listing: pick a bag item, set a Leo Coin price, post. Or post a seeking listing: name the wanted item, set the offered price
• 2. Listings stay live while the stall is open in that place; closing the stall or leaving the place suspends them
• 3. A fulfilled listing notifies in chat and lands in the trade record and wallet history. There is no fee line anywhere in any of these screens - by design, there is nothing to show

### Leo Coin wallet
• Open from the inventory header or the HUD coin chip: balance, then history (newest first: operation name in plain words - Knowledge share, Stall sale, Pickup reward - counterparty, amount, time)
• The explainer card states the canon in one breath: Leo makes the coin, its supply grows when knowledge is shared, and sharing through the game's knowledge actions is how new coin enters the world

### Housing (placeholder)
• The housing screen shows the home summary, the Espil House model items the player owns (from inventory), and the home-teleport target. A single honest line marks full customization as v1.1. Nothing on this screen pretends to work yet

## HUD spec (Place screen)

• Quickbar grid, bottom-right (chat sits bottom-left), the current build's standing layout as set by Han's 2026-10-17 re-review: the grid is the control and status surface in one. HP and MP are glass potion flasks inside the grid (red HP, blue MP, both round orbs; the liquid height is the value, with no numeric readout) - the retired big bottom-center flask pair does not come back
• Grid layout follows the shipped scheme: skill slots on Q W E R / A S D F, item slots on 1 2 3 4, skill icons with cooldown sweep, locked slots shown locked (as in the current build)
• Leo Coin chip: small, beside the quickbar - coin icon, balance, tap opens the Wallet
• Chat: bottom-left glass window, place channel by default, tabs for place / whisper / trade; on touch it collapses to a single line with an expand tap. Speech bubbles appear over characters for place chat, per the current build's direction. Intentional Zealandia difference, flagged for Han: the web build's chat is structured channel / neighbourhood / party, while Zealandia runs place / whisper / trade - whisper exists for one-to-one trade negotiation and trade is the stall and market channel, because trading is a core axis here. If Han prefers one structure everywhere, this collapses back to the web build's three without design loss
• Minimap: top-right, in places it renders the current place (crafted place art as the base, player arrow center, NPC and stall markers). On the travel map screen the continent itself is the map; places do not show a continent minimap
• Place context: music toggle and EXIT sit top-right beside the minimap (production configuration), EXP/level indicator follows the current build, and the place-name card appears once per entry only
• Touch controls (app), matching the current mobile build: virtual joystick on the right at low opacity (0.1), the jump and interact controls at the left-centre of the screen, just right of the chat window, camera by drag. Design targets: every touch target at least 44 px, no required control under a thumb-rest zone, the quickbar stays reachable without covering the action cluster. Keyboard scheme remains the web control set (Shift jump, Space interact, Ctrl sprint, K skills, M map, I inventory)

## Travel map UX

• Base art: the drained Zealandia continent render from the terrain package (oceans drained, plateaus as lowlands, trenches as edge canyons, today's New Zealand as the mountain spine). The map is art the player reads, not a data grid
• Pins: towns read as warm settlement markers, dungeons as dark gate markers, the hub as the cauldron mark. The player's current place pin carries a "You are here" ring
• Pin states: unlocked (full color, name under the pin), locked (greyed, small lock, name hidden or shown as ??? until its unlock hint is earned - default: name shown, condition on tap), current (ringed). Locked styling follows the production convention: grey means inactive, never broken
• Info card (glass, bottom sheet on the map): name, type chip, one-line description, bestiary/level band when relevant (design target: shown as a band, not exact numbers), bundle size if uncached, Travel button or the unlock condition
• Rules the UX enforces: travel only between unlocked places; travel is instant; the map is reachable from any place and is the only way places connect. Cost: none in v1 - proposal flagged for Han in 03-build-order.md (if a cost is ever added, it appears on the info card before confirming, never after)
• Orientation aids: the spine of today's New Zealand is the recognition anchor; place names use the real feature names from the terrain package's sampled list (Lord Howe Rise, Chatham Rise, Campbell Plateau, Challenger Plateau) so the fantasy map stays tied to the real sunken continent

## Wireframe descriptions (layout zones, elements, states)

• Travel map: full-screen continent art; top-left glass chip with game title and wallet chip; pins layer center; bottom glass info sheet (appears on pin tap, dismisses on map tap); top-right settings and close. States: no pin selected (sheet hidden), pin selected, locked pin selected (condition replaces Travel), downloading (progress shown in the loader style: glass liquid fill only, never a numeric percentage, per the loader standard)
• Place screen: 3D viewport full-screen; top-right minimap with music and EXIT beside it; bottom-right quickbar grid with in-grid flasks and the coin chip; bottom-left chat (expanded or one-line); touch controls in the current mobile layout (joystick right at low opacity, jump and interact at the left-centre of the screen, just right of the chat window; app only); center name card only on entry. States: normal, in-dialogue (dialogue sheet replaces quickbar focus), stall open nearby (interact prompt over the stall), combat (target frame top-center, flasks animate on change)
• Stall screen (as an overlay sheet on the Place screen): left column - stall title, owner, open state; center - listings grid with Selling / Seeking tabs; right - selected item card with price and Buy/Fulfil button; footer - My stall shortcut and close. States: browsing, confirming purchase (summary card modal), completed (success line + wallet delta), empty stall (honest empty state)
• Wallet: header balance in gold with coin mark; explainer card; history list (operation, counterparty, signed amount, time); empty state explains how coin is earned. No charts, no exchange or cash-out language anywhere - Leo Coin is an in-world currency, full stop
• Sign-in / character: centered glass card on the brand backdrop; sign-in shows the one-account copy and the Google button (provider row below, inert entries greyed per scope v2); character select shows character cards; create shows name field, male/female choice, appearance preview. Error states are plain-language (session expired, name taken) with one clear next action each

## Mobile touch rules

• Landscape lock for play screens; safe-area insets respected on all HUD elements
• One-thumb travel: map pins are large targets, the Travel button sits in the bottom sheet's thumb zone
• No hover-dependent interactions anywhere in app screens; every web hover pattern gets a tap equivalent
• Downloads ask before using mobile data over a bundle size threshold (design target: 25 MB), show size on the place info card, and default to the Wi-Fi-only setting being respected

## Accessibility and settings

• Text size setting applies to chat, dialogue, and cards; place-name card and HUD numerals stay legible at the smallest size
• HP/MP are never color-only: the two round orbs sit in fixed grid positions with HP and MP labels, and the value reads from liquid height (the orbs carry no digits), per the current flask design
• Reduce-motion setting calms the loader liquid and name-card animation; flashing effects in skills respect it
• Volume sliders for BGM and SFX separately (current build behavior), mute on the music toggle
• Color-safe states: locked/unlocked never rely on color alone - locks carry the lock glyph, grey, and a text condition

## Template basis for the UI kit

• Custom, not a template: the kit is the shipped Espil Online glass design system - components (glass panel, quickbar grid, flasks, loader, chat window, name card) already exist in the web build and are reused. Zealandia adds exactly four new components: travel map pins and info sheet, stall listing rows, wallet history rows, NPC dialogue sheet - all drawn in the same glass language
• Placement follows the shipped Espil Online layout (quickbar bottom-right, chat bottom-left, joystick right, jump and interact at the left-centre of the screen, just right of the chat window) rather than generic mobile MMORPG conventions; no third-party UI kit, theme, or template pack is adopted, so the app and web can never drift into two looks

Revision 2026-10-20 (UI room cross-check applied): quickbar corrected to bottom-right with chat bottom-left; touch layout corrected to the current mobile build (joystick right at 0.1 opacity, jump and interact at the left-centre of the screen, just right of the chat window); flasks corrected to round orbs with liquid-height values and no digits; body typeface corrected to Manrope; travel download progress tied to the loader standard (liquid fill, no numeric percentage); chat channel composition (place / whisper / trade) kept as an explicitly intentional Zealandia difference, flagged for Han.
