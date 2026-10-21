# Enemy Pack Tuning Brief — Keeper of Cauldron
Prepared 2026-10-05 (PDT) · for Han's go-ahead · implements in the 스킬/map build when approved

> PARTIALLY SUPERSEDED (2026-10-21): the EXP level-up curve in this brief ("level x 100") is REPLACED by the Skill room's design v1 (~/workspace/goals/zealandia-game-project/files/zealandia-skill-tree-design-v1.md) - Han's instructed curve: L1 10, L2 50, L3 250, L4 1,225 EXP, then x5 per level to 25. The monster stat lines (Strayer 30 HP / +12 EXP, Spitter, Brute) remain in force - design v1's pacing table uses the same Strayer 12 EXP, and the first town's combat was built and probed on them.

## Why now
The skill tree landed tonight (Cauldron Slash + 5 weapon variants, T tree, 3 starter SP).
`window.__espilSkills.gainExp(n)` is wired but nothing calls it — the damage numbers,
cooldowns, and SP economy have nothing to hit. This brief gives enemies tuned to the
*actual shipped numbers* so the 스킬 chat can build them without a tuning pass later.

## Numbers this is tuned against (read from index.html 2026-10-05)
- Weapons (dmg / range / cooldown): bare 8/2.2/.45 · sword 14/2.9/.60 ·
  dagger 5×2 hits/2.4/.34 · hammer 26/2.6/1.10 (AoE 3.4) · staff 12/3.7/.70
- Real DPS: bare 17.8 · sword 23.3 · dagger 29.4 · hammer 23.6 · staff 17.1
- Masteries +12% dmg/rank (max 3 each); Swift +5% atk speed/rank (max 5);
  Long Reach +7% range/rank (max 3)
- EXP: level-up needs `level × 100` (L1→2 = 100, L2→3 = 200, …); +1 SP, +10 max HP, +5 max MP per level
- Player: 100 HP, 50 MP (regen 5/s). Full tree = 21 SP ≈ level 19.

## Roster (3 tiers — roles described, skins are Han's call)
| Tier | Role | HP | Dmg | Behavior | EXP | TTK (sword, no mastery) |
|---|---|---|---|---|---|---|
| 1 | Strayer (chaser) | 30 | 6 contact | walks at player, speed ~5 (walk 7.5 / run 12) | 12 | 3 hits ≈ 1.8s |
| 2 | Spitter (ranged) | 45 | 8 orb / 2.5s | holds ~5m, backs off when closed | 25 | ~4 hits ≈ 2.4s |
| 3 | Brute (tank) | 150 | 18 telegraphed slam (3m) | slow, wind-up flash before slam | 60 | ~11 hits ≈ 6.6s |

- **Pacing check:** L1→2 = 100 EXP ≈ 8 Strayers ≈ ~2 min of hunting. Feels right for a first session.
- **Weapon answers:** dagger melts Strayers (29.4 DPS); staff + Long Reach is the Spitter answer
  (3.7m base × 1.21 = 4.5m at reach 3); hammer AoE earns its slow cooldown vs Brute + packs.
- **Spitter distance note:** tuned to 5m hold so base staff (3.7m) must close or invest in
  Long Reach — deliberate mastery incentive, not a bug.

## Spawn & AI rules
- Spawn zones: the 2 park blocks + block alleys (already in the map); cap 6 concurrent.
- Respawn 8s after a death; despawn beyond 70m from player.
- Night bias: the map already has a real day/night cycle (moon + stars) — spawn
  interval shortens ~30% at night. Gives the sky a gameplay meaning.
- Aggro 12m, leash 25m (walk back, full heal). No enemy touches the curved ground —
  flat-plane movement like the player.

## Combat feel (hooks into existing systems)
- Damage numbers: floating text via the existing fxPool pattern (additive, fades).
- Hit feedback: 0.15s white flash on the enemy billboard + 0.6m knockback along slash dir.
- Death: poof sprite + "+12 EXP" text that flies toward the status bar, then `gainExp(n)`.
- Brute slam: red ring telegraph 0.8s before impact (reuse Forge Slam's ring effect, red).
- Player damage: subtract from `skillState.hp`, `paintStatus()` refresh; death → respawn at
  map center with full HP (no penalty for now — tune later).

## Art direction (per Han's map rules)
- Enemies are **camera-facing billboard sprites** like all other map props — NOT 3D models.
- Placeholders for testing: tinted circles with HP bars (no invented designs).
- Real sprites are Han's IP — he supplies them via the existing `setPropSprite()` path.

## Out of scope for this pack
- Bosses, loot drops, MP-cost actives (Cauldron Toss / Ember Guard stay locked for the combat update).
- Multiplayer damage/aggro (chat/voice UI is local single-player only until a server exists).

## Decision needed from Han
1. Green-light the 3-tier roster + numbers above (or retune: faster/slower leveling?).
2. Sprite style direction for enemies (his call — placeholders until then).
3. Night-spawn bias: keep, or flat spawn rate day/night?
