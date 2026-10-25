# rogue0 — Depth Roadmap

Goal: close the depth gap between rogue0 and *Shattered Pixel Dungeon* (SPD).
SPD gets its depth not from raw content volume but from a small number of
**systems that compose**: status effects, identification/curse risk,
terrain, equipment tiers + upgrades, enemy "signature" abilities, and a long
enough run that those systems get to interact. This plan is organised around
building those systems in dependency order.

---

## 1. Current state (source-audited)

Status below reflects implementation, not a claim that every acceptance criterion
has been playtested. Checked boxes mean the described implementation exists.

### Implemented since the original roadmap

- Five classes now have cooldown skills: Power Strike, Shield Bash, Heal,
  Double Strike, and Nova. First-tier class talents are implemented; subclasses
  and later talent tiers remain future work.
- `effects.ts` and `combat.ts` provide timed statuses, accuracy/evasion,
  physical armour, elemental resistance/vulnerability, crits and surprise
  attacks (auto-hit, bonus damage, possible bleed).
- Item identification, cursed equipment, upgrade levels, charged wands,
  five rings, two artifacts, expanded scrolls/potions and food exist.
  Strength requirements and weapon/armor tiers 1–5 are implemented.
  Durability, enchantments/glyphs and balance playtesting remain outstanding.
- Explicit weapon/armor/two-ring/artifact slots and a 20-slot backpack replace
  active-item aggregation. Inventory is modal, with item actions and stacking.
- Terrain uses a coordinate-keyed feature overlay on the binary floor/wall
  map—not the originally proposed tile enum. Doors, searchable hidden traps,
  burning grass, water extinguishing fire, blocking chasms and searchable
  secret doors exist; advanced elemental combinations remain outstanding.
- Monster roster includes cultists, splitting swarms, mimics, three elementals
  and wraiths. Several proposed signature abilities remain unimplemented;
  the Bone Lord still lacks phases/telegraphs/arena mechanics.
- Hunger, starvation, well-fed regeneration, rations and monster gold rewards
  exist. Shops, trading and revival items do not.
- `context.ts` defaults to **25 floors**. Five floors was a testing limit.
  The Bone Lord spawns only on floor 25; its stats are unchanged.
  Five-floor equipment/supply bands exist, but themed regions do not yet.
- Bottom toolbar, hero/inspect panels, inventory modal and generated potion
  textures exist. Full HUD polish and the custom-art overhaul remain open.
- The turn engine is now a **discrete-event action-time scheduler**:
  movement speed and weapon delay are independent; hunger/regeneration tick
  with elapsed world time, effects retain their own tick phase, and skill
  cooldowns use absolute timestamps. See `README.md`, `timing.ts` and
  `turnManager.ts`; do not reintroduce per-action status/hunger ticking.
- Regression entry point: `node scripts/test-rogue0-movement.mjs`.

### Original baseline (historical, not current)

The following snapshot explains the original depth gap:

- 5 hero classes (Warrior, Dwarf, Cleric, Elf, Wizard) via a React picker.
  Classes differ only by starting stats + starting gear (no skills, no build).
- 6 monsters: Skeleton, Quloptsh, Archer (ranged), Ghoul (2 moves/turn),
  Brute (tanky), Bone Lord (boss). Boss = big stats, no mechanics.
- 15 items: swords/axe/bow/hammer/shield, gems, scrolls (fireball, lightning),
  potions (heal ×2, holy), berserk potion, shoe. Items are **auto-identified**
  and there is no tier/upgrade/cursed/charged system.
- Combat: `attacker.attack() - victim.protection()`, resolved inline in
  `dungeon.attackEntity`. No accuracy/evasion, no damage types, no status
  effects, no crits/surprise.
- XP/leveling: flat `+5 max HP, +1 ATK` per level. No choices.
- Terrain is binary: `0` floor, `1` wall. No doors/traps/water/grass/chasms.
- Floors: 1 handcrafted + procedural (rooms/corridors) for 2+. `maxFloor = 3`.
- FOV/fog, inspect, audio, juice, turn manager, AI (chase/investigate/wander).

## 2. Depth gap analysis

The middle column is the **original baseline**; consult §1 and phase status
notes for current implementation.

| SPD pillar | Original baseline | Target |
|---|---|---|
| Status effects & damage types | none (raw HP) | burning, poison, frost, bleed, cripple, blind, buffs; fire/ice/shock/poison interactions |
| Item risk (identify/curses) | items known & safe | unidentified potions/scrolls, cursed gear, identify/upgrade scrolls |
| Equipment progression | damage ranges only | tiers (1–5), upgrade levels, enchantments/glyphs, rings, artifacts, wands |
| Terrain interactivity | floor/wall | doors (open/closed/secret), traps, grass, water, chasms |
| Enemy tactical identity | mostly stat diffs | every enemy has a signature ability that changes tactics |
| Boss design | stat sponge | phases, summons, telegraphed attacks, arena hazards |
| Build depth | none | subclasses, talents, level-up choices, per-class skills |
| Survival economy | HP only | hunger/food, gold + shop, item durability/charges |
| Consumable variety | 2 scrolls, 3 potions | full scroll/potion/seed set + alchemy brewing |
| Run length & pacing | 3 floors | ~25 floors across themed regions |
| Replayability | none | seeds, challenges, bestiary, achievements, run stats, save/load |
| UI & inventory | fixed sidebar, auto-growing inline slot grid, no open/close | bottom HUD (portrait/HP/buffs) + backpack button opening a full inventory window |
| Graphics & art | 16×16 Kenney sheet, magic-number tile lookups, missing/wrong sprites | cohesive 16×16 custom set (Astra-generated), named texture keys, crisp at zoom |

## 3. Guiding principles

1. **Systems compose.** Prefer small mechanics that stack (fire × grass,
   frost × water, bleed × regeneration) over one-off content.
2. **Every item/enemy has a tactical identity.** If two items are only a
   damage roll apart, merge them.
3. **Decisions > stats.** Depth comes from "should I drink this unidentified
   potion?" not from a bigger number.
4. **Risk/reward loops.** Identification, curses, upgrades and hunger must
   create meaningful, voluntary risk.
5. **Keep runs punchy.** Target a full run of ~20–40 min, not SPD's hour+.
   Depth per minute, not total duration.

---

## 4. Architecture groundwork (build in this order)

These are the original design briefs, not a list of missing files. G1/G2,
G5/G6 and the G8 modal framework are implemented; G3/G4 are partial; G7's
special rooms/regions are outstanding. Most later phases assume these systems
exist. Current implementation details in §1 supersede outdated proposals below.

### G1 — Status effects (`effects.ts`, new)
A `StatusEffect` type and an `effects: StatusEffect[]` field on `Entity`.

- `effect = { id, name, iconTile, duration, apply(e,c), tick(e,c), remove(e,c) }`
- Effects use elapsed-world-time scheduling with independent tick phases,
  and apply/expire cleanly with message log lines. `refresh()` is not a
  once-per-action effect clock.
- Store on the entity so `onDestroy` can clean them up.
- First effects to implement: `burning`, `poisoned`, `bleeding`, `regeneration`,
  `frozen` (skip turn), `weakened` (ATK down), `crippled` (movement down).
- This unlocks ~half of the roadmap (consumables, enemies, terrain, bosses).

### G2 — Centralised combat model (`combat.ts`, new)
Replace the inline damage math in `dungeon.attackEntity` with a single
`resolveAttack(context, attacker, defender, opts)`.

- Accuracy/evasion roll; armour absorbs a flat amount; damage types
  (`physical|fire|ice|shock|poison|magic`); per-entity resistances/
  vulnerabilities; crits; **surprise attacks** (attacker unseen by defender →
  auto-hit + bonus damage + can apply bleed/knockback).
- Clamp damage to `>= 0` and log "dodged/absorbed/missed".
- `resolveAttack` also dispatches on-hit effects from G1.
- Keep `dungeon.attackEntity` for tweens/animation, but call `resolveAttack`
  for the numbers.

### G3 — Item model v2 (`entity.ts` + `items/`)
Extend the item side of `Entity` with: `tier (1..5)`, `identified`,
`cursed`, `blessed`, `level` (upgrade), `charges` (wands), `durability`.

- `identify(item)` reveals name/description; unidentified consumables show
  "?potion" style names and are dangerous/random to quaff.
- Cursed gear cannot be unequipped and applies a penalty; remove with a
  Remove Curse scroll or a well.
- Add scrolls: Identify, Upgrade, Remove Curse, Teleport, Rage, Terror,
  Recharging; potions: Healing (scaled), Strength, Invisibility, Toxic Gas,
  Liquid Flame, Frost, Levitation, Experience.
- This is the single biggest depth-per-line-of-code win.

### G4 — Terrain & tiles v2 (`tiles.ts`, `mapgen.ts`, `dungeon.ts`)
Move the map from `0|1` to a tile enum so terrain can carry behaviour.

- Tile types: `FLOOR, WALL, DOOR(open/closed), SECRET_DOOR, TRAP(hidden),
  GRASS, WATER, CHASM, ALCHEMY_POT, EXIT`.
- `dungeon.isWalkableTile`/pathfinding must respect closed doors and chasms.
- Doors: open/close (walk into to open; monsters can open). Secret doors are
  found by searching or standing adjacent.
- Traps: hidden until stepped on (or searched); effects include dart=poison,
  fire, frost, summon, teleport and alarm. Support single-use and reusable traps;
  search only reveals them, never disarms them.
- Grass: flammable (spreads fire), hides items/enemies. Water: douses fire,
  freezes. Chasms: fall damage / push target into.

### G5 — Resources (hunger) (`resources.ts` or on `BasicHero`)
A turn counter with thresholds: `full → hungry → starving`.

- Starving deals periodic damage; food resets the counter.
- Food items + ration drops; cooking/ration craft optional later.
- This is the "why do I keep moving / when do I rest" pressure that SPD uses
  to stop degenerate full-heal resting.

### G6 — Equipment slots & inventory refactor (`basicHero.ts`)
Replace the current "all `active` items aggregate" with explicit slots:

- `weapon`, `armor`, `ring1`, `ring2`, `artifact` + a backpack with capacity.
- One weapon/armor equipped at a time; rings stack as stat modifiers; artifacts
  level up through use (SPD-style).
- UI: render slots + backpack separately; numbered keys target backpack.
- The backpack is opened via a button/key in a dedicated inventory window
  (see G8), not the current auto-growing sidebar grid.
- This is prerequisite for clean upgrades/curses/enchantments.

### G7 — Map generation v2 + regions (`mapgen.ts`, `scene0.ts`)
- Room types: treasure vault (locked, trapped), garden (plants/grass), trap
  room, miniboss room, shop room.
- Guarantee one shop and one "special" room per region.
- Secret rooms occasionally behind hidden doors.
- Raise `maxFloor` to ~25 and split into themed regions (see Phase 14).

### G8 — SPD-style UI framework (`ui.ts` + new `inventoryWindow.ts`)
Replace the fixed right-hand sidebar's inline inventory grid with an SPD-style
HUD + modal window system.

- Bottom-left **HUD**: hero portrait tile, name/level, HP bar, hunger
  indicator, and buff/debuff status-effect icons (from G1) with remaining
  turns.
- **Backpack button** (bag icon) in the HUD that opens/closes the inventory
  window; also bound to a keyboard key (`i`/`b`) with `Esc` to close.
- **Modal window system** (`inventoryWindow.ts`): a reusable open/close window
  that pauses world input while open and renders above the fog layer.
- Message log moves to a bottom strip; the inspect readout stays available as
  a small tooltip/panel instead of consuming the sidebar.

---

## 5. Roadmap

### Phase 5 — Combat & status depth
*Depends on G1, G2.*

- [x] Implement `effects.ts` and tick lifecycle (elapsed world time).
- [x] Implement `combat.ts` (accuracy, armour, types, crits, surprise).
- [x] Add resistance/vulnerability fields to actors and monster-specific values.
- [x] Wire burning/poison/bleed/frozen into items and monsters.
- [x] Surprise attack: unseen/unaware defender, auto-hit + bonus + possible bleed.
- [ ] Playtest damage/status interactions and balance across all five classes.
  Deferred at user request; not a gate for the next terrain work.
- **Acceptance:** a fight can end in multiple ways (burn tick, bleed-out, crit,
  frozen skip) and the log explains what happened.

### Phase 6 — Item risk & progression
*Depends on G3, G6.*

- [x] Identification: unknown consumables/gear; identify by use or scroll.
- [x] Cursed gear (can't unequip, penalty) + Remove Curse.
- [x] Scroll of Upgrade and item upgrade-level model.
- [x] Implement SPD-style Strength, weapon/armor tiers 1–5, upgrade scaling
      and guaranteed progression supplies (specification below).
- [ ] Balance progression across all five classes over 25 floors; expand
      same-tier weapon trade-offs. Boss balancing is explicitly deferred.
- [ ] Add weapon enchantments / armor glyphs after the core progression loop.

#### SPD-style progression specification (core implemented; balance/talents pending)

Implemented foundation: heroes start at **10 Strength**; Strength potions grant
**+1 Strength**, independently of XP/attack. Existing swords, axes, hammers and
shields opt into requirements; wands/utility gear do not. Requirements are
`8 + 2 × tier`, reduced by one at upgrade levels **+1, +3, +6, +10, …**
(triangular milestones, minimum requirement 0). Each missing Strength point
multiplies weapon attack time / armor movement time by **1.2** and divides
weapon accuracy / armor evasion by **1.2**. Bonuses are computed from current
equipment, so drinking/upgrading/swapping updates them immediately. Hero UI
shows Strength; identified inventory details show tier, requirement and warnings.
Regression coverage lives in the item-upgrades and progression suites; all
12 suites pass, as does the production build. Visual verification and balance
playtesting remain deferred.

**Tier roster:** Dagger / Shortsword / Broadsword / Greatsword / Greataxe and
Cloth / Leather / Mail / Scale / Plate Armor. At tier `t`, upgrade `u`, weapon
damage is `t + u` to `5t + (t + 1)u`; base attack delays are 0.8 / 1 / 1 / 1.2 /
1.4. Armor absorbs `2t + tu` physical damage. Equipment upgrades are uncapped,
matching the existing upgrade system. Class starter equipment retains its old
stats/tier; shields and the new armor share one slot. Gems now accept all armor.
Art reuses existing sword/shield silhouettes pending Phase 16.

**25-floor supply:** each five-floor band guarantees Strength potions on its
second/fourth floors, upgrade scrolls on its first/third/fourth floors, a
current-band weapon on its first floor, and armor on its third floor. Total:
**10 Strength potions, 15 upgrade scrolls, 5 weapons and 5 armor pieces**.
Strength/upgrade scrolls are no longer in random floor loot; monster gem drops
remain an additional source of upgrades. Random equipment is usually current
band, with 20% chances of one tier lower/higher (clamped to 1–5). Saved-floor
revisits never regenerate supplies. Food remains guaranteed each floor.
Ordinary encounter density stops increasing after floor 5; later regional
monster scaling is still future work. The Bone Lord is unchanged on floor 25.

**Not yet complete:** talents, same-tier weapon variety and full-run balancing.
XP still grants +5 max HP / +1 ATK pending balance.

Keep three separate progression tracks, rather than treating all growth as ATK:

- **Hero XP/level:** combat experience advances hero level, improving survivability
  and unlocking talent points (Phase 9). Do not grant Strength automatically on
  level-up. Revisit the current flat +1 ATK per level when balancing this system.
- **Strength:** add a permanent hero Strength stat, distinct from attack damage.
  Potion of Strength now grants **+1 Strength**, not +1 ATK.
  Temporary attack buffs remain separate from permanent Strength.
- **Equipment:** weapons and armor have **tiers 1–5** and a separate upgrade
  level (`+0`, `+1`, …). Tier controls base damage/absorption, upgrade scaling
  and base Strength requirement; upgrading an item does not change its tier.
  Include actual weapon and armor options across all five tiers, not just a
  tier field. Weapons within a tier should have distinct tactical trade-offs.
- **Strength requirements:** higher-tier gear requires more Strength. Allow
  equipping gear while under-strength, with clear penalties rather than a hard
  equip lock: weapon accuracy/attack-delay penalties and armor evasion/movement
  penalties. Apply timing penalties through the existing action-time scheduler,
  never by changing effect/hunger tick rates. Initial curves are recorded above;
  they remain subject to five-class balance playtesting.
- **Upgrades:** upgrade scrolls improve damage/absorption and reduce Strength
  requirements at defined upgrade milestones, creating a choice between investing
  in early gear and saving upgrades for a higher-tier find. Specify formulas and
  caps before implementation; do not assume current generic upgrade math suffices.
- **Supply/pacing:** guarantee a bounded supply of Strength potions and upgrade
  scrolls through floor generation, rather than relying solely on random drops.
  Distribution and tier availability now span the full 25-floor run, with
  supplies reserved before optional enemy spawns.
- **UI:** show hero Strength and, for identified equipment, tier, upgrade level,
  required Strength, effective stats and under-strength warnings. Preserve
  identification secrecy in descriptions, comparisons and logs.
- **Regression coverage:** Strength potion permanence; XP/Strength independence;
  tier versus upgrade independence; requirement reductions; under-strength combat
  and fractional timing; identification secrecy; guaranteed progression supplies.
- **Acceptance:** finding stronger gear creates a real decision: use it now with
  penalties, keep it for a later Strength potion, or invest upgrades in it (or
  the lower-tier equipment already in use).

- [x] Wands with charges + Recharging scroll.
- [x] Rings (Accuracy, Evasion, Elements, Haste, Might) and two artifacts.
- [ ] Audit identification leaks and curse handling across every inventory action.
  - Stabilisation pass: all 11 regression suites pass, including scheduling and
    equipped-curse removal guards. Fixed upgrade logs revealing unidentified
    equipment names/levels (including the upgrade-cap path), with regression
    coverage. Stack drops now preserve item state like stack throws rather
    than reconstructing default items; potion/gem regressions cover upgrades,
    identification, curses, charges, independent effects/UI and action cost.
    Pickup now merges only matching consumable class, identification, level,
    tier, curse/blessing and charges; items with timed effects stay separate.
    Regressions cover differing-state pickup with full/available backpack space
    and matching stacks merging at capacity.
    Equipment regressions also verify full-backpack unequip rejection, swaps
    at capacity, preservation of unknown gear/upgrades, and free cancellation
    when a throw target item is removed or becomes equipped and cursed.
    Visual UI verification and five-class balance playtesting are deferred at
    user request, not completed.
- **Acceptance:** deciding whether to equip an unidentified item is a real,
  tense choice with consequences in both directions.

### Phase 7 — Terrain & environment
*Depends on G4.*

- [x] Doors open on entry and close behind actors; monsters traverse doors.
- [x] Search reveals adjacent hidden traps; dart/fire/frost/teleport traps trigger.
- [x] Burning actors ignite grass; stepping into water douses burning.
- [x] Chasms block ordinary movement.
- [x] Secret doors: generated hidden dead-end branches look like walls and
      block sight/pathfinding until adjacent search reveals a closed door.
      Regression coverage checks discovery range, inspect secrecy, terrain
      refresh, opening, pathfinding/FOV and restored feature state across 200
      generated maps. Visual playtesting remains deferred.
- [x] Support single-use and reusable traps. Newly generated frost/teleport
      traps are reusable; dart/fire/arrow traps remain single-use (summon/alarm
      policies below). Reusable traps
      reveal themselves on activation and remain armed indefinitely, with no
      cooldown or timer: each new entry triggers them, standing still does not.
      Search never disarms them; levitation bypasses contact. Inspect explains
      reuse only after discovery, auto-walk keeps avoiding armed traps, and
      floor snapshots preserve the policy/state. Legacy traps without a reuse
      flag remain single-use. Terrain/stair regressions cover both policies,
      all seven trap kinds, re-entry, no-op movement, search and persistence.
      Visual playtesting remains deferred.
- Search only reveals traps and secrets; it must never disarm traps.
  Item-based disarming is a possible future mechanic, not currently implemented.
- [x] Summon/alarm traps join the two-hidden-traps generation pool (no extra
      trap density). Summon is single-use: one awake Skeleton appears on an
      empty cardinally adjacent floor/grass/water tile, excluding stairs,
      doors, hazards, actors and loot. If no tile is available it fizzles and
      is still spent. New summons enter the current simulation timeline.
      Alarm is reusable: living enemies within Chebyshev radius 8 wake and
      investigate the trap coordinate, even through walls or player invisibility;
      it does not grant ongoing player awareness or free attacks. Both retain
      inspect secrecy, search-only discovery, levitation bypass and saved-floor
      state. Terrain/stair/monster suites cover activation, safe placement,
      range, investigation and persistence. Visual playtesting remains deferred.
- [x] Functional levitation: chasm traversal for keyboard/auto-walk, no ground
      trap/water/grass contact, and world-time expiry. Over a chasm, expiry
      makes the player fall to the next floor and take ceil(max HP / 3) damage,
      ignoring armour and potentially killing them. Final-floor falls are fatal,
      never a win. Falls preserve floor snapshots and resolve outside scheduler
      iteration; no safe-return or emergency-hover behaviour. Shared path grids
      remain unchanged. Covered by terrain/stair regressions; not visually playtested.
- [ ] Grass concealment and chasm pushing/voluntary jumping.
- [x] Frozen water: applying Frozen freezes water under/cardinally adjacent to
      the target (including repeat applications). Frost potions thrown onto empty
      water can create ice and are consumed on a successful terrain splash.
      Ice is walkable and transparent; grounded entry applies Crippled for two
      world-time units (half movement speed, no attack-delay change). Re-entry
      refreshes the slow; waiting on ice does not. Burning grounded actors melt
      their destination tile to water and are extinguished before ice can slow
      them. Levitation bypasses contact. Ice persists until melted, with a pale
      water tint and inspect description; snapshots preserve frozen/melted tiles.
      Terrain regressions cover frost sources/reapplication, splash bounds,
      movement costs, fractional expiry, flight, melting and persistence.
      Visual playtesting remains deferred.
- [x] Fire spreads through grass: a grounded burning actor's movement ignites
      grass underfoot/cardinally adjacent, immediately consuming every connected
      cardinal grass patch. Water, bare floor, walls and diagonal-only contact
      break the spread. Living grounded actors on burned tiles gain burning;
      levitating actors, items and corpses do not. Terrain/FOV refresh once per
      ignition; removed cover stays gone on floor revisits. Existing effect tick
      phases control subsequent damage—no extra action or terrain timer. Regression
      coverage includes offscreen actors, firebreaks, sight, persistence and large
      cyclic patches. Visual playtesting remains deferred.
- [x] Shock conducts through cardinally connected water. A successful shock
      hit dealing positive damage to a grounded target in water arcs once into
      every other living grounded actor in that pool—including the caster.
      Secondary base damage is `ceil(primary damage dealt / 2)`, reduced by each
      victim's shock resistance and increased by shock vulnerability; physical
      armor does not apply. Ice, walls, dry gaps and diagonal-only contact break
      conduction; levitation avoids it. No recursive arcs, extra crits/on-hit
      effects, charges or action costs. Lethal primary hits still conduct, and
      secondary deaths use normal removal. Normal attacks, skills, thrown weapons
      and wands share this behavior. `test-rogue0-shock-water.mjs` covers networks,
      exclusions, resistances, caster risk, deaths and all four attack paths.
      Visual and balance playtesting remain deferred.
- [x] Lingering poison clouds: Toxic Gas potions create a cardinal five-cell
      splash (clipped by walls/closed doors), whether drunk or thrown, including
      throws at empty floor. Clouds last four world-time units with independent
      fractional pulse phases. Entry and pulses sustain Poisoned for at least two
      units without resetting its damage phase; original direct potion poison
      remains four units. Levitation does not protect against airborne gas, and
      clouds can hurt the player. Overlapping cells merge and extend lifetime,
      not damage stacks. Expiry wins pulse ties. A separate overlay preserves
      ground terrain, with visible-only green shading and inspect descriptions.
      Saved floors copy cloud state and shift event clocks on restoration, so
      inactive floors pause gas. `gas.ts` plus the gas/stair suites cover geometry,
      exposure, overlap, idle frames, timing, expiry, deaths, movement and potions.
      Visual and balance playtesting remain deferred.
- **Acceptance:** positioning and terrain become a first-class tactical layer,
  not just walls.

### Phase 8 — Enemy & boss redesign
*Depends on G1, G2.*

Implemented foundations: Skeleton stays dead; Quloptsh has on-hit effects;
Ghoul has fast movement, regeneration and on-hit effects; Brute enrages;
cultists summon, swarms split on death, and elementals have typed effects.
Mimic/wraith classes exist, but that alone does not complete their intended AI.
Archer currently attacks in range rather than kiting. Door-aware pursuit exists.

- [ ] Finish every monster's intended signature ability (SPD-style):
  - Skeleton → basic brittle melee enemy; stays dead when killed (no reanimation).
  - Quloptsh → hard to see (short FOV for player) / backstabs.
  - Archer → kites, retreats when you close.
  - Ghoul → lifesteal on hit; fast but frail.
  - Brute → enrages below 50% HP (ATK up, DEF down).
  - New: swarm (splits), cultist (summons), mimic (chest trap), elemental
    (fire/ice/shock), wraith (phase through walls).
- [ ] Faction/alert: some monsters wake and call nearby allies on sight.
- [ ] AI: monsters open doors, avoid burning terrain, chase through paths.
- [ ] Bosses: multi-phase, telegraphed attack, summons, arena hazard. Each
      region boss gets a signature mechanic (not a stat sponge).
- **Acceptance:** each fight has a "correct" tactic that differs per enemy.

### Phase 9 — Character build depth
*Depends on G6.*

- [ ] Subclasses / specialisations (e.g. Warrior → Gladiator/Berserker,
      Dwarf → Vanguard/Siegebreaker, Cleric → Warden/Sun, Elf → Sniper/Ranger,
      Wizard → Pyro/Storm).
- [x] First-tier class talent points: one point at levels 2, 3 and 4; two
      class-specific talents with two ranks each. Three points cannot max both.
      Hero panel → Talents shows descriptions, ranks and available points;
      tap to spend permanently without consuming world time. Points can be saved.
- [ ] Later talent unlock bands and subclasses.
- [x] Define initial XP thresholds and level-based HP/combat scaling: retain
      `8 × current level` XP per next level (excess carries over), +5 max HP
      and +1 base ATK per level, without healing on level-up. Strength remains
      potion-only. These existing curves are retained pending balance playtests,
      not claimed balanced. No generic stat picker.

#### First-tier talent specification

Each bonus below is **per rank** (maximum 2):

| Class | Talent A | Talent B |
|---|---|---|
| Warrior | Crushing Strike: +2 Power Strike damage | Deep Fury: +1 damage at/below half HP |
| Dwarf | Hamstring: +1 world-time duration to Bash cripple | Iron Skin: +1 physical armor |
| Cleric | Greater Heal: +3 HP restored by Heal | Quick Prayer: −1 world-time Heal cooldown |
| Elf | Twin Blades: +1 damage per Double Strike hit | Light Footwork: +5 evasion before armor penalties |
| Wizard | Lingering Flame: +1 world-time Nova burn duration | Focused Nova: −1 world-time Nova cooldown |

Cooldown talents affect subsequent skill uses, not an already-running cooldown.
Duration bonuses use the existing effect clock; no per-action ticking or extra
skill actions. Other equipment, Strength and XP tracks are unchanged.
`scripts/test-rogue0-talents.mjs` covers awards (including multi-level gains),
rank/point/class guards, all ten bonuses, cooldown timing and Hero-panel actions.
Visual verification and full-run/five-class balance playtesting remain deferred.

- [x] Per-class active skill with a cooldown (elapsed-world-time timestamps).
- **Acceptance:** two runs of the same class can diverge meaningfully by
  floor 5.

### Phase 10 — Survival & economy
*Depends on G5, G7.*

- [x] Hunger, starvation, well-fed regeneration and ration drops.
- [x] Monster kills award gold.
- [ ] Shop stock (Identify/Upgrade/Remove Curse, food, Ankh); cooking later.
- [ ] Sell unwanted items; buy back sold items.
- [ ] Ankh (revival) + blessed Ankh (full heal on death).
- **Acceptance:** the player budgets food/gold across a region, not just HP.

### Phase 11 — Consumables & alchemy
*Depends on G3, G4 (alchemy pot tile).*

- [x] Add Strength, Invisibility, Toxic Gas, Liquid Flame, Frost, Levitation,
      Experience and scaled Healing potions; Teleport/Rage/Terror/Recharging scrolls.
  Strength now grants +1 permanent Strength (Phase 6). This checkbox denotes
  potion presence, not completion of tier content or guaranteed supply.
- [x] Levitation terrain integration (see Phase 7).
- [ ] Complete remaining terrain integration and audit consumable balance.
- [ ] Seeds dropped from plants; plant/grow seeds in grass.
- [ ] Alchemy pot: combine seeds + potions to brew (e.g. 3 seeds → 1 potion,
      potion + seed → exotic potion).
- **Acceptance:** consumables are a build strategy, not a panic button.

### Phase 12 — NPCs & side quests (light)
*Depends on G7.*

- [ ] 2–3 NPCs: Shopkeeper, a Sad Ghost (fetch item → reward), a Blacksmith
      (upgrade a weapon once per region).
- [ ] Each quest gives a choice of reward; skipping is viable.
- **Acceptance:** optional objectives create branching run goals.

### Phase 13 — Meta & replayability
*Independent of combat depth; pairs with the rest.*

- [ ] Save/load (localStorage) + resume.
- [ ] Daily seed + seeded runs; challenge modifiers (no healing, fog of war
      doubled, cursed start, etc.).
- [ ] Bestiary, item compendium, run statistics (damage by type, floor/time).
- [ ] Achievements + high-score table (extend the existing end screen).
- **Acceptance:** consecutive runs feel different and are comparable.

### Phase 14 — Regions & run length
*Depends on G7; the content-multiplication layer.*

- [x] Restore the intended **25-floor** run; move the existing Bone Lord from
      floor 5 to floor 25 without rebalancing it.
- [ ] Split into themed regions (sewers → prison → caves → dwarven halls →
      demon halls), each with its own palette, enemy set, trap set and region boss.
- [ ] Difficulty/HP/ATK scale per region; introduce new enemies per region.
- [ ] Region-unique environmental hazards (e.g. gas vents in caves, lava in
      halls).
- **Acceptance:** a full run has a rising arc and distinct region identities.

### Phase 15 — SPD-style UI & inventory overhaul
*Depends on G6 (slots) and G8 (window system); pairs with Phase 6.*

**Core implementation landed:** dedicated inventory window, equipped-slot row,
20-slot four-column backpack, unknown-item icons, item action dialog, throwing
and modal input gating. The window scales to the viewport rather than paging.
Item details are displayed in the dialog; a separate Inspect action is not
implemented. Remaining boxes below describe the full original UX targets,
not absence of the inventory system. Verify HUD buffs, tooltips, quick-key
coverage and small-screen readability before marking this phase complete.

- [ ] Add the **Backpack button** (bag icon) to the HUD; open/close the
      inventory window with the button or `i`/`Esc`.
- [ ] Build the **inventory window**: equipped slots row on top
      (weapon / armor / ring / ring / artifact), then the backpack as a
      scrollable or paged grid (4 columns), each cell showing the item icon
      (or a `?` placeholder if unidentified).
- [ ] Item selection → action menu: **Use / Equip / Unequip / Drop / Throw /
      Inspect** (replaces the current "toggle on pick" flow).
- [ ] Enforce a real **backpack capacity** (e.g. 20 slots) with an
      "inventory full" message + drop prompt; remove the auto-growing sidebar
      slot hack in `basicHero.createUI`.
- [ ] Numbered quick keys `1–0` act on the currently visible backpack page;
      hovering an item shows its tooltip (name, stats, status effects).
- [ ] Show **buff/debuff status icons + turn counts** under the HUD portrait
      (from G1).
- [ ] Move the **message log** to a bottom strip (SPD-style) and keep
      hover-inspect on the map.
- **Acceptance:** the player opens the inventory with a button or key, sees
  equipped + carried items clearly, and can perform any item action without
  consulting hidden slots; nothing renders off-screen.

### Phase 16 — Graphics & art overhaul (16×16, Astra-generated)
*Deferred — implement later. Replaces the Kenney sheet + magic-number lookups.*

- [x] Fix the mimic sprite: replaced the sword frame with the existing closed
      wooden chest (row 6, column 8). Implemented and visually verified in a
      mobile browser viewport using **Astra via Pi routing**.
- [ ] Choose a cohesive 16×16 palette (dark SPD-like dungeon, warm light, one
      gold accent) and keep it consistent across all sprites.
- [ ] Have **Astra** generate sprites procedurally (Python/PIL or Phaser
      Graphics), iterating with its vision: floor, wall, doors, stairs, traps,
      water, grass, chasm, the 5 hero classes, every monster, and every item
      (red heal potion, wands, rings, food, scrolls, …).
- [ ] Replace the `tile = row*49 + col` magic numbers with named `textureKey`s
      (already started for the generated potions); store art as generated
      textures or a new atlas.
- [ ] Keep `pixelArt: true` so zoomed 16×16 sprites stay crisp; pair with the
      zoomable camera (Phase 15 follow-up).
- **Acceptance:** no Kenney leftovers; every entity/item has a distinct,
  readable 16×16 sprite; nothing is ambiguous (no potion-vs-heart-vs-apple).

---

## 6. Suggested sequencing

### Next implementation priorities

1. **Phase 9 first-tier XP/talents landed:** levels 2–4 award three points for
   two rank-2 class talents, selected in the Hero panel. Separate XP, Strength
   and equipment-upgrade tracks are preserved. Later tiers/subclasses remain
   open; terrain work continues. All 15 regression suites and the production
   build pass; visual and five-class balance playtesting remain deferred.
2. **Finish Phase 7's terrain interactions** before adding more consumables.
3. **Finish Phase 8:** archer kiting and remaining signatures. The Bone Lord
   now lives on floor 25; boss balance/redesign is deferred at user request.
4. **Phase 9 choices + Phase 10 shops:** make class builds and gold meaningful.
5. **Phase 15 polish and Phase 13 save/resume**, then add region identities
   within the existing 25 floors. Keep Phase 16 deferred unless prioritised.

### Original dependency order (reference)

1. **G1 + G2 + Phase 5** — core implementation landed; validate and balance.
2. **G3 + G6 + G8 + Phase 6 + Phase 15** — the identification/curse/upgrade
   loop is the core of SPD's feel, and the backpack window replaces the
   sidebar inventory as soon as items exceed its space.
3. **G4 + Phase 7** — terrain makes positioning matter.
4. **Phase 8** — enemy identity makes all the above pay off.
5. **Phase 9 / 10 / 11** — build depth, survival, consumables.
6. **Phase 13 / 14** — replayability and run length, once systems are solid.
7. **Phase 12** — NPCs last; they're garnish on top of the systems.
8. **Phase 16** — the art overhaul is independent of mechanics and can be
   slotted in whenever the systems are stable; it has no hard dependencies.

## 7. Decisions & notes

- **Art direction is 16×16 (SPD-style), generated with Astra** (code + vision
  iteration). The current Kenney sheet + magic-number lookups are a stopgap;
  Phase 16 replaces them with named textures.
- **Keep the existing visual style and turn engine.** These changes are
  mechanical, not presentational; the tile sprite approach already supports
  new tile/effect icons.
- **Preserve the discrete-event timeline.** Render polling must not determine
  logical time; fractional movement/attack costs accumulate without rounding.
- **Status effects follow elapsed world time**, with independent tick phases;
  hunger/regeneration and cooldowns must not accelerate with faster movement.
- **Combat numbers move to `combat.ts`** so balance lives in one place and
  monster/hero classes only declare stats + resistances.
- **Unidentified items use generic category names and placeholder textures**
  and reveal their identity on use — the core SPD risk loop.
- **The run is 25 floors.** Five floors was only an initial testing limit.
  The Bone Lord is on floor 25; do not rebalance it as part of progression work.
  Region themes and additional bosses remain separate future work.
- **Cursed items are locked on** until Remove Curse/well — do not allow
  unequipping via the normal toggle path.
- **Ranged/melee and click-vs-keyboard controls stay as-is**; new systems
  (search, open/close, aim) get keyboard bindings + tap fallback.
- **Inventory moves out of the sidebar into a modal window** opened by a
  backpack button (`i`/`b`) and closed with `Esc`; the sidebar's auto-growing
  `UIItems` grid is removed.
- **Backpack capacity is explicit (e.g. 20 slots)**; exceeding it prompts a
  drop decision rather than silently overflowing off-screen.
- **Scope guard:** SPD has a decade of content. Prioritise the systems above
  over raw item/monster count; 8 well-designed enemies with abilities beat 30
  stat clones.
