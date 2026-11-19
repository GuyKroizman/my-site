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

- Throwing is not attacking. A thrown weapon, armour, ring, scroll, food or
  tool deals no damage to any monster (mimic included): no combat roll,
  accuracy check, resistance, crit, on-hit effect or curse. The object lands on
  the impact tile and the target only notices the blow (a dormant mimic wakes).
  Consumables still splash their potion contents and are used up; wands keep
  their roll-based zap damage. This deliberately replaces the earlier
  thrown-weapon damage path; `test-rogue0-thrown-items.mjs` covers weapons,
  legacy damage-bearing non-weapons, consumables and the landing/trap path.
- Five classes share one innate passive each; per-class active skills were
  removed. First-tier (passive) class talents are implemented as a single
  two-rank talent per class, shown in a small tab of the Hero panel; subclasses
  and later talent tiers remain future work. Replacing that tab with a
  fullscreen, point-spendable **talent tree** is planned (Phase 18).
- `effects.ts` and `combat.ts` provide timed statuses, accuracy/evasion,
  physical armour, elemental resistance/vulnerability, crits and surprise
  attacks (auto-hit, bonus damage, possible bleed).
- Item identification, upgrade levels, charged wands, five rings, two
  artifacts, expanded scrolls/potions and food exist. SPD-style named curses
  are implemented across weapons, armor, rings, wands and artifacts
  (generation, per-slot procs/passives, lock-on guards,
  `removeCurse()`/Scroll of Remove Curse, a mirror-image decoy and a
  `charmed` effect). Strength requirements and weapon/armor tiers 1–5 are
  implemented. Weapons now have Fire/Frost/Luck/Reach/Push glyphs and armor
  has Thorns/Push, with one visible glyph per item. Fresh gear has a 25% glyph
  chance; a rare Stone of Infusion adds one to chosen unmarked physical gear.
  Durability and balance playtesting remain outstanding.
- Explicit weapon/armor/two-ring/artifact slots and a 20-slot backpack replace
  active-item aggregation. Inventory is modal, with item actions and stacking.
- Terrain uses a coordinate-keyed feature overlay on the binary floor/wall
  map—not the originally proposed tile enum. Doors, searchable hidden traps,
  burning grass, water extinguishing fire, blocking chasms and searchable
  secret doors exist; advanced elemental combinations remain outstanding.
  Trampling tall grass has a small chance to uncover a **glyph stone**: the
  Stone of Blink teleports the hero to its landing tile when thrown (or pulls
  them unharmed to the next floor if thrown into a chasm), and the Stone of
  Detect Curse reveals one unidentified item's curse status without identifying
  its type. The Stone of Infusion enchants one chosen unmarked weapon or armor;
  its grass drop chance is 0.24%, versus 5.88% each for Blink and Detect Curse.
  All three are one-use consumables.
- Monster roster includes cultists, splitting swarms, mimics, three elementals,
  goblin archers, wraiths and poison-gas Deadly Frogs. The goblin archer fires
  bleeding arrows at range
  5 and switches to a weaker melee sidearm when adjacent; wraiths deal magic
  damage with physical resistance. The Deadly Frog vents gas on every damage
  event and on death, and is immune to poison. The Bone Lord fights in its own
  arena hall but still lacks phases/telegraphs.
- Monsters start **asleep** for 8–24 world-time units and wake on damage, noise,
  or a visible hero within 2 tiles; sleepers spend time waiting and show a
  visual sleep marker. Awareness/membership is rebuilt from saves without
  rerolling sleep.
- A floor-population guard (`monsterReinforcements.ts`) tops up a floor when its
  last living monster dies: a small wave spawns at least 8 tiles away and
  outside the hero's field of view, scaling with floor depth. Boss floors
  (every fifth) are exempt: they are guardian-only arenas and stay empty once
  the guardian falls (`floorAllowsReinforcements`).
- Boss floors are one arena hall (`bossArenaRoom`), not a room network, and
  every boss floor has its own plan (`bossArenas.ts`: rotunda, long colonnade,
  octagonal sanctum, cruciform vault, throne hall), centred in the old
  footprint: the hero enters at the south edge, the guardian sleeps at the
  exact centre, and the stairs sit at the farthest open eastern tile. Floor 5's
  16x16 rotunda keeps four 2x2 pillars 10 walkable tiles apart; the other halls
  stand their own rocks, all clear of the middle and both approaches. The guardian is the only monster,
  and no random floor loot, cursed gem, chasm, summon trap or Skeletal Remains
  pile appears. They keep their two treasure chests, one ration and the hidden
  room's gold.
- The Bone Lord is rendered with generated 24x24 art (`bossTexture.ts`): a fat
  green blob with one great eye and a maw of interlocking fangs, scaled up past
  the 16px monsters. Its body is a 3x3 footprint (`bodyRadius = 1`): movement,
  AI and melee reach all use the body, so the hero cannot stand underneath the
  scaled art and attacks it from the body's edge. It starts with a long dormancy (`BOSS_ARENA_DORMANCY`) and
  wakes on damage, noise, a visible hero within 2 tiles, or when the dormancy
  runs out.
- Hunger, starvation, well-fed regeneration, rations and monster gold rewards
  exist. Portal stores (buy/sell, persistent stock on floors 6/11/16/21) exist;
  revival items do not yet. Boots are planned as the revival item (see Phase 10).
- `context.ts` defaults to **25 floors**. Five floors was a testing limit.
  The Bone Lord guards floors 5/10/15/20/25; its stats are unchanged.
  Five-floor equipment/supply bands exist. Themed regions are visual-only so
  far (crypt → sandstone → crystal → volcanic palettes); per-region enemy,
  trap and boss scaling is future work.
- Browser autosave/resume (localStorage) exists; leaving the dungeon (the game
  menu's **← back** button, which returns to the Rogue0 start screen) and
  death/victory flush or clear the run. Saves retain hero,
  gear, effects, the scheduler clock and every visited floor.
- Wand identity is shared across a run; zaps have no distance cap and carried
  wands recharge one charge per 20 world-time units. Upgrade scrolls, gems and
  the Scroll of Remove Curse let the player choose a target.
- Equipped ring bonuses scale with upgrade level; treasure chests generate two
  per floor and mimics scale across the five region bands.
- Bottom HUD with portrait, HP, hunger, four assignable quickslots, backpack
  button (`i`/`b`) and a message strip whose history opens a paginated log
  window. HUD status icons show remaining duration and a tooltip. Inventory
  modal, confirmation dialogs and hover tooltips all pause or gate world input.
- Presentation layer: hero idle/walk animation and facing, burning and chilled
  overlays, water animation, grass-fire flames/smoke, wall decals, projectile
  and wand-zap art, monster sleep markers, surprise markers and floating damage
  text. Potions, scrolls, goblin, wraith, elementals and chests use generated
  textures. The full custom-art overhaul (Phase 16) is still open.
- `combatApplication.ts` applies successful hits (damage, invisibility,
  shock-water contact, statuses, reactions, death) and is shared by normal
  attacks, skills and wands; `combat.ts` only resolves the roll. Thrown objects
  are not attacks — a thrown weapon/armour/tool deals no damage and only wakes
  the target, while potions still splash their contents
  (`test-rogue0-thrown-items.mjs`).
- The turn engine is now a **discrete-event action-time scheduler**:
  movement speed and weapon delay are independent; hunger/regeneration tick
  with elapsed world time, effects retain their own tick phase, and skill
  cooldowns use absolute timestamps. See `README.md`, `timing.ts` and
  `turnManager.ts`; do not reintroduce per-action status/hunger ticking.
- Regression: `npm run test:rogue0` runs the headless suites, including save
  serialization and restoration tests. Browser save/resume wiring is checked
  manually. Results append to `logs/rogue0-tests.jsonl`; query with
  `npm run test:rogue0:history`.
- **Local scenario harness (Phase 17, dev only):** a dev-gated title-screen panel
  authors a start state (floor, class/level/HP/hunger/gold/talents, exact
  inventory, explicit monster set) that `scenario.ts` applies to the first
  floor. Nothing in the shipped flow sets it.

### Original baseline (historical, not current)

The following snapshot explains the original depth gap:

- 5 hero classes (Warrior, Dwarf, Cleric, Elf, Wizard) via a React picker.
  Classes differ only by starting stats + starting gear (no skills, no build).
- 6 monsters: Skeleton, Quloptsh, Archer (ranged), Ghoul (2 moves/turn),
  Brute (tanky), Bone Lord (boss). Boss = big stats, no mechanics.
- 15 items: swords/axe/bow/hammer/shield, gems, scrolls (fireball, lightning),
  potions (heal ×2, holy), berserk potion, boot. Items are **auto-identified**
  and there is no tier/upgrade/cursed/charged system.
- Combat: `attacker.attack() - victim.protection()`, resolved inline in
  `dungeon.attackEntity`. No accuracy/evasion, no damage types, no status
  effects, no crits/surprise.
- XP/leveling: flat `+5 max HP, +1 ATK` per level. No choices.
- Terrain is binary: `0` floor, `1` wall. No doors/traps/water/grass/chasms.
- Floors: 1 handcrafted + procedural (rooms/corridors) for 2+. `maxFloor = 3`.
- FOV/fog, inspect, audio, juice, turn manager, AI (chase/investigate/wander).

## 2. Depth gap analysis

For each pillar below, the first value is the **original baseline**; consult §1
and phase status notes for current implementation.

- **Status effects & damage types**
  - Original baseline: none (raw HP)
  - Target: burning, poison, frost, bleed, cripple, blind, buffs; fire/ice/shock/poison interactions
- **Item risk (identify/curses)**
  - Original baseline: items known & safe
  - Target: unidentified potions/scrolls, cursed gear, identify/upgrade scrolls
- **Equipment progression**
  - Original baseline: damage ranges only
  - Target: tiers (1–5), upgrade levels, enchantments/glyphs, rings, artifacts, wands
- **Terrain interactivity**
  - Original baseline: floor/wall
  - Target: doors (open/closed/secret), traps, grass, water, chasms
- **Enemy tactical identity**
  - Original baseline: mostly stat diffs
  - Target: every enemy has a signature ability that changes tactics
- **Boss design**
  - Original baseline: stat sponge
  - Target: phases, summons, telegraphed attacks, arena hazards
- **Build depth**
  - Original baseline: none
  - Target: subclasses, talents, level-up choices, per-class skills
- **Survival economy**
  - Original baseline: HP only
  - Target: hunger/food, gold + shop, item durability/charges
- **Consumable variety**
  - Original baseline: 2 scrolls, 3 potions
  - Target: full scroll/potion/seed set + alchemy brewing
- **Run length & pacing**
  - Original baseline: 3 floors
  - Target: ~25 floors across themed regions
- **Replayability**
  - Original baseline: none
  - Target: seeds, challenges, bestiary, achievements, run stats, save/load
- **UI & inventory**
  - Original baseline: fixed sidebar, auto-growing inline slot grid, no open/close
  - Target: bottom HUD (portrait/HP/buffs) + backpack button opening a full inventory window
- **Graphics & art**
  - Original baseline: 16×16 Kenney sheet, magic-number tile lookups, missing/wrong sprites
  - Target: cohesive 16×16 custom set (generated), named texture keys, crisp at zoom

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

- `effect = { id, name, duration, apply(e,c), tick(e,c), remove(e,c) }` (the HUD
  icon is looked up by `id` in `statusIconTextures.ts`, not stored on the effect)
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
- [x] Cursed-gear machinery (lock-on guards, `removeCurse()`, Scroll of Remove Curse, Cursed Gem). Random curse generation + per-slot penalties
      are planned below, not implemented yet.
- [x] Scroll of Upgrade and item upgrade-level model; upgrade scrolls, gems and
      the Scroll of Remove Curse let the player choose a target.
- [x] Implement SPD-style Strength, weapon/armor tiers 1–5, upgrade scaling
      and guaranteed progression supplies (specification below).
- [ ] Balance progression across all five classes over 25 floors; expand
      same-tier weapon trade-offs. Boss balancing is explicitly deferred.
- [x] Add weapon enchantments / armor glyphs after the core progression loop.
      Fire burns for 9 ticks; Frost freezes one action and chills; Luck rerolls
      empty monster item drops and doubles gold fallback odds; Reach hits at
      distance 2. Push moves one cardinal tile (horizontal on diagonal contact).
      Armor Thorns returns 25% of melee damage (rounded, minimum 1); Push
      repels melee attackers. Glyphs persist, coexist with curses, and are
      visible before identification. Infusion only accepts unmarked gear.
      Each successful physical weapon/armor upgrade independently rolls to
      cleanse its curse and erase its glyph: 10% at resulting level +1, 20% at
      +2, increasing by 10 percentage points per level to 100% at +10 and above.
      Found upgrades count too. Either, both or neither may be removed; the
      +1 level is always retained. Capped
      upgrades do not roll, and rings/wands/artifacts/scroll weapons are exempt.
      Removal is logged without identifying the gear; Scroll of Upgrade warns
      of both chances. Coverage: `upgrade-marks`.

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
Regression coverage lives in the item-upgrades and progression suites (part of
the 41 headless suites); all pass, as does the production build. Visual
verification and balance playtesting remain deferred.

**Tier roster:** Dagger / Shortsword / Broadsword / Greatsword / Greataxe and
Cloth / Leather / Mail / Scale / Plate Armor. At tier `t`, upgrade `u`, weapon
damage is `t + u` to `5t + (t + 1)u`; base attack delays are 0.8 / 1 / 1 / 1.2 /
1.4. Armor absorbs `2t + tu` physical damage. Freshly found armor, weapons and
wands spawn at +0 (most common), +1, +2 or +3 — never higher; Scroll-of-Upgrade
upgrades remain uncapped afterwards, matching the existing system.
Class starter equipment retains its old
stats/tier; shields and the new armor share one slot. Gems now accept all armor.
Art reuses existing sword/shield silhouettes pending Phase 16.

**25-floor supply:** each five-floor band guarantees Strength potions on its
second/fourth floors, upgrade scrolls on its first/third/fourth floors, a
current-band weapon on its first floor, and armor on its third floor. Total:
**10 Strength potions, 15 upgrade scrolls, 5 weapons and 5 armor pieces**.
The upgrade-scroll layout is a fixed floor lookup (no RNG roll): exactly three
per region and never on boss floors 5/10/15/20/25. If a map is too cramped for
its full encounter roster, a deterministic fallback still places the scroll
quota before optional content. Strength/upgrade scrolls are no longer in random
floor loot, and regular Gems were retired so the scroll budget is the only
upgrade source. Random
equipment is usually current band, with 20% chances of one tier lower/higher
(clamped to 1–5). Saved-floor revisits never regenerate supplies. Food remains
guaranteed each floor.
Ordinary encounter density stops increasing after floor 5; later regional
monster scaling is still future work. The Bone Lord's stats are unchanged.

**Not yet complete:** later talent tiers/subclasses, same-tier weapon variety
and full-run balancing. First-tier talents *are* implemented (Phase 9).
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

- [x] Wands with charges + Recharging scroll; wand identity is shared per run,
      zaps have no distance cap, and carried wands passively recharge one charge
      per 20 world-time units.
- [x] Rings (Accuracy, Evasion, Elements, Haste, Might) and two artifacts; ring
      bonuses now scale with upgrade level and update immediately when equipped.
- [ ] Audit identification leaks and curse handling across every inventory action.
  - Stabilisation pass: all 41 headless regression suites pass, including
    scheduling and
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
#### SPD-style cursed items (planned — named SPD curses)

SPD's core risk loop is a gamble on every unidentified equipment find: a
fraction of gear is cursed, applies a specific thematic curse while equipped, and
stays locked on until the curse is lifted. rogue0 already has the machinery —
the `cursed` flag, the equip/unequip/drop/throw lock-on guards,
`removeCurse()` and the Scroll of Remove Curse — but today the **only** cursed
item is the bespoke Cursed Gem. Weapons, armor and rings are never generated
cursed, so the loop never fires in normal play.

**Landed:** `curseId` assignment, 25% curse generation for weapons/armor/rings,
all seven weapon curses, all eight armor curses, inverted ring passives, the
mirror-image decoy, the `charmed` effect, enemy decoy targeting, player-attack
guards, and `scripts/test-rogue0-cursed-items.mjs`.

- [x] **Generation.** Random equipment — `LOOT_TABLE` weapon/armor/ring draws and
      chest weapon/armor — has a per-item chance to be cursed (start at **25%**,
      kept in one config constant). The guaranteed progression supplies (band
      weapon/armor, Strength potions, upgrade scrolls, rations) are **never**
      cursed. Cursed items stay unidentified on the floor and in the backpack,
      exactly like clean ones. Route the curse roll through a small helper so
      tests can force the outcome deterministically.
- [x] **Named curses, not flat penalties.** Each cursed item rolls one
      specific curse from its slot's SPD-style table and stores a `curseId`.
      One cursed item = one curse. Every curse reuses rogue0's existing systems
      (effects, terrain, `gas.ts`, teleport, alarm) instead of inventing new
      stats, and its name is revealed when the item is identified (combat use,
      Scroll of Identify or Remove Curse) in the item description — matching SPD's
      named curses.

  *Weapon curses (SPD → rogue0):*

  - **Wayward**
    - SPD: attacks often miss
    - rogue0 mapping: equipped weapon halves `effectiveAccuracy` — **implemented**
  - **Sacrificial**
    - SPD: you pay for each hit
    - rogue0 mapping: hero takes ~25% of the damage dealt — **implemented**
  - **Displacing**
    - SPD: struck enemy is flung away
    - rogue0 mapping: teleport the victim via `randomWalkableTile` (reuse the teleport-trap helper) — **implemented**
  - **Annoying**
    - SPD: strikes draw enemies
    - rogue0 mapping: wake living enemies within 8 tiles to investigate (reuse the alarm-trap helper) — **implemented**
  - **Polarized**
    - SPD: wildly random damage
    - rogue0 mapping: damage ×0.5–×1.5 each hit — **implemented**
  - **Exhausting**
    - SPD: you tire yourself
    - rogue0 mapping: chance to apply `crippled` to the hero — **implemented**

  Friendly was removed: its enemy-only charm helped the player. Existing saved items with this curse are cleansed on load.

  *Armor curses (SPD → rogue0):*

  - **Multiplicity**
    - SPD: hit → an image of you appears
    - rogue0 mapping: spawn a friendly mirror-image decoy that enemies may target (new decoy entity) — **implemented**
  - **Displacement**
    - SPD: hit → you teleport
    - rogue0 mapping: teleport the hero via `randomWalkableTile` (reuse the teleport-trap helper) — **implemented**
  - **Anti-entropy**
    - SPD: thermal chaos
    - rogue0 mapping: chance to ignite the hero and freeze cardinally adjacent enemies — **implemented**
  - **Corrosion**
    - SPD: caustic gas on hit
    - rogue0 mapping: splash the wearer with caustic ooze (`poisoned`) — **implemented**
  - **Stench**
    - SPD: toxic gas on hit
    - rogue0 mapping: emit the existing toxic-gas cloud (reuse `gas.ts` as-is) — **implemented**
  - **Overgrowth**
    - SPD: grass sprouts around you
    - rogue0 mapping: grow grass on the hero's tile and cardinal neighbours — **implemented**
  - **Metabolism**
    - SPD: you hunger faster
    - rogue0 mapping: double hunger drain while worn — **implemented**
  - **Bulk**
    - SPD: you are slowed
    - rogue0 mapping: apply the existing movement slow while worn — **implemented**

  *Ring curses (SPD):* cursed rings **invert** their passive — Might →
  `-Strength`, Haste → slower movement, Accuracy → `-accuracy`, Evasion →
  `-evasion`, Elements → fire/ice/shock vulnerability — **implemented**. This is
  the one faithful flat-inversion case; rings reuse their existing
  `applyPassive()` with a sign flip, and uncursing re-applies the positive form.

  *Wand/artifact curses:* landed. Cursed wands roll the **Backfiring** curse:
  a zap may redirect the wand's own effect onto the caster instead of the
  target (a cursed Firebolt ignites you), still spending the charge. Cursed
  artifacts roll the **Corrupted** curse, interpreted per artifact: the
  Chalice of Blood drains health instead of regenerating, and the Fang of the
  Beast inverts its damage bonus into a penalty. Artifacts use the existing
  lock-on guards; wands remain backpack tools and are never locked on.
- [x] **Lock-on & reveal.** Keep the existing unequip/drop/throw guards for
      equipped cursed items. Equipping always reveals curse status through the
      shared `onEquip` path, so a cursed weapon/armor/ring/artifact locks on and
      says so immediately. Equipping never identifies the upgrade level (shown
      as `?`) or the true type of a ring. Artifacts show their real name and
      normal flavor, but keep their level and curse status hidden until learned.
      Hidden properties are revealed by a
      Scroll of Identify or extended use: thirty landed attacks (weapon), thirty
      blows taken (armor), thirty world-time ticks worn (ring/artifact), or
      thirty charged zaps (wand). The Scroll of Remove Curse lifts one chosen curse
      (clearing `curseId`) and re-enable removal, without identifying the item.
- [x] **Detection.** Once identified (or scanned by a glyph stone), reuse the
      existing red glow / "(cursed)" inventory label and named curse description.
      Equipping an unknown item reveals only cursed/uncursed; the specific curse
      name and upgrade level stay hidden until identification.
- [x] **Regression.** New `scripts/test-rogue0-cursed-items.mjs` (added to
      `npm run test:rogue0`): curse chance and guaranteed supplies stay clean;
      each named curse's proc/penalty applies while equipped and clears on
      unequip/uncursing (weapon procs, armor procs, ring inversion); lock-on
      guards; Remove Curse scroll lifting without identification; and
      save/load preserving `curseId` + curse state.
- **Acceptance:** equipping an unidentified weapon/armor/ring is a real gamble
  — you may get a named curse with an observable signature (a teleport on hit,
  a decoy of yourself, self-damage, a gas cloud) plus a locked slot, with
  the Scroll of Remove Curse as the scarce way out, matching the SPD tension.

- **Acceptance:** deciding whether to equip an unidentified item is a real,
  tense choice with consequences in both directions.

### Phase 7 — Terrain & environment
*Depends on G4.*

- [x] Doors open as their own 1-turn action (SPD-style: the actor stays in
      place, then steps through next action) and close behind actors; monsters
      traverse doors the same way.
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
- [x] Chasm room: an 11-15 tile chamber ringed by a walkable band around a
      two-tile moat, with a treasure island that only levitation can reach (a
      chest on the island holding a Stone of Infusion and a large purse; the
      floor's guaranteed Potion of Levitation now lies at a random walkable
      floor position, unidentified like any other potion). Each run gives
      the room to one randomly rolled floor out of 1, 2, 3, 4, 6, 7; the floors
      above it never have one, floors below it roll 5%, and only floors 8+ may
      also find levitation as ordinary loot. The choice rides in the run save.
      Boss arenas never carry one.
      Corridors route around the moat, the island is excluded from the floor's
      connectivity rule and from random content/reinforcements.
- [x] Functional levitation: chasm traversal for keyboard/auto-walk, no ground
      trap/water/grass contact, and world-time expiry. Over a chasm, expiry
      makes the player fall to the next floor and take ceil(max HP / 3) damage,
      ignoring armour and potentially killing them. Final-floor falls are fatal,
      never a win. Falls preserve floor snapshots and resolve outside scheduler
      iteration; no safe-return or emergency-hover behaviour. Shared path grids
      remain unchanged. Covered by terrain/stair regressions; not visually playtested.
- [x] Grass concealment: grass tiles remain visible, but occupants (actors and
      loot) are hidden beyond Chebyshev distance 1, including while levitating.
      Adjacent observers reveal them; enemy awareness, player inspection,
      automatic skill targeting and click attacks respect cover. Mind Vision
      still marks hidden enemies without enabling optical targeting; Magical
      Sight reveals terrain but does not bypass grass concealment. Tile-aimed
      throws can still hit concealed actors. Sight never passes a grass tile:
      floors, walls and closed doors behind it stay hidden, and an occupant
      standing in grass sees only the adjacent ring (Magical Sight excepted).
      Attacks never clear the attacker's grass, but walking onto a grass tile
      tramples it into bare floor (flying actors do not), which is how an
      ordinary move spends cover; burning actors ignite it instead. Enemies
      that lose sight path to the last tile they saw, and striking a defender
      that does not currently see the attacker still lands as a surprise hit.
      Vision regressions cover detection, trampling, ambush geometry, targeting
      and inspect secrecy. Visual/balance playtesting remains deferred.
- [x] Voluntary chasm drops: step into a cardinally adjacent chasm with a
      direction key or tap its tile, then confirm the fall in an in-game
      "Are you sure?" dialog (no Jump button or `v` shortcut). Committing costs
      movement time and descends one floor; cancelling is free. Rooted heroes
      cannot step into chasms; levitating heroes cross safely. Falls deal
      ceil(max HP / 3) damage, potentially fatal; final-floor falls are fatal.
      Auto-walk routes still avoid chasms.
- [x] Effect-level knockback groundwork: a cardinal one-tile displacement can
      move either player or monster, preserving terrain contacts and victim
      scheduling. Walls/closed doors, occupied destinations and rooted victims
      block it. Grounded chasm victims fall (monsters die through normal removal;
      players queue the existing floor transition); levitating victims stay aloft.
      There is deliberately **no player shove ability**. Terrain/movement/stair
      regressions cover the primitives, targeting and fall rules. Visual and
      balance playtesting remain deferred.
- [x] Geyser traps provide an actual involuntary push source. They join the
      existing two-hidden-traps generation pool (no density increase), single-use
      by default. Entry by a grounded player or monster reveals/spends the trap
      and pushes that actor one tile in the entry direction; diagonal entry uses
      the horizontal component. Walls, closed doors, occupied destinations and
      roots stop displacement, but still spend the trap. No direct damage or
      extra victim action cost. Levitation/items bypass activation; standing still
      never triggers it. Landings retain terrain contacts and can chain geysers
      or cause chasm falls using the existing player/monster fall paths. Search
      reveals without disarming; spent state survives floor snapshots. Terrain
      regressions cover both actor types, flight, blockers, directions, chaining,
      timing, discovery and persistence. Visual/balance playtesting is deferred.
- [x] Confusion-driven missteps: Confused lasts four world-time units. Each
      movement attempt chooses one random cardinal direction without safety
      rerolls; walls, closed doors and actors block it but still cost movement
      time. Rooted actors cannot attempt a stumble. Chasm entry causes the normal
      fall unless levitating. Keyboard movement, auto-walk and enemy movement
      (including fleeing) share the helper; deliberate attacks/aiming are not
      scrambled, and landing items are not automatically picked up. Auto-walk and
      buffered commands clear on a player stumble. Single-use confusion traps
      join the existing hidden-trap pool and affect grounded players/monsters;
      levitation bypasses them, and search only reveals them. Effect phases,
      fractional movement costs, blockers, falls, keyboard/auto-walk and AI
      behavior have terrain regression coverage. Visual/balance playtesting
      remains deferred.
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
- [x] Frost traps chill as well as freeze: the single skipped action is
      situational in an empty room, so the trap also applies Chilled for 10
      world-time units. Chilled doubles the time cost of moves and attacks
      (halving both rates) and cancels haste exactly; waiting, searching, item
      use and other actions keep their normal cost, and cripple stacks with it.
      It is applied independently of Frozen, so the one-action freeze-recovery
      window never blocks the slow; re-entry refreshes it to full duration and
      it never stacks. The hero gets a translucent ice sheen with frost crystals
      drawn in a separate overlay (health tint, hit flash and invisibility alpha
      stay untouched), the top-left status row shows its icon, and the character
      modal describes it. Regression coverage: cost math and cancellations,
      trap application/refresh/single-use behaviour, and overlay geometry,
      pulse, movement/bob/scale tracking, expiry, death and cleanup. Balance
      playtesting remains deferred.
- [x] Frost reaches monsters: the Wand of Frost zap now applies Frozen *and*
      Chilled (`wandEffects()` returns both; `wandEffect()` still yields the
      freeze for single-effect callers), thrown frost potion splashes chill as
      well, and frost plates are no longer player-only — a monster (confused or
      not) that enters one is frozen and slowed, so its `actionCost` doubles for
      moves and attacks and it takes half as many turns. Fire, dart, teleport,
      summon and alarm plates stay player-only; levitation still skips plates;
      a monster's re-entry refreshes the slow without stacking. Ice-elemental
      touch is left as freeze-only on purpose. Regression coverage: wand effect
      lists per wand type, chilled monster tempo through the real scheduler,
      monster/player trap parity, player-only hazards, levitation, refresh and
      potion splash effects.
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
      secondary deaths use normal removal. Normal attacks, skills and wands
      share this behavior. `test-rogue0-shock-water.mjs` covers networks,
      exclusions, resistances, caster risk, deaths and all four attack paths.
      Visual and balance playtesting remain deferred.
- [x] Lightning wand arcs into adjacent actors. A successful lightning-wand zap
      dealing positive shock damage to an enemy arcs once into every living
      actor adjacent to that target (cardinally or diagonally), even airborne—
      including the hero. Secondary arc damage is now
      `ceil(primary damage dealt * 1.5)`, reduced by shock resistance and
      increased by shock vulnerability; physical armor does not apply. No
      recursive arcs, extra crits/on-hit effects, charges or action costs; the
      primary target is never hit twice and secondary deaths use normal removal.
      The fire/ice wands never arc. `test-rogue0-lightning-arc.mjs` covers
      adjacency, diagonals, resistances, caster risk, deaths and wand dispatch.
      Connected water extends the splash at 50% damage, without double-hitting
      adjacent actors. Animated secondary bolts originate at the struck target
      after primary impact; projectile tests cover callback-enqueued arcs,
      travel, fog, modal pause and cleanup. Visual/balance playtesting remains
      deferred.
- [x] Lingering poison clouds: Toxic Gas potions release a cloud that expands
      one cardinal ring per world-time unit (clipped by walls/closed doors) up to
      a radius-3 diamond, whether drunk or thrown, including throws at empty
      floor. Each ring then expires from the outer edge inward so the cloud
      gradually shrinks and fades instead of vanishing all at once. Entry and
      pulses sustain Poisoned for at least two units without resetting its damage
      phase; original direct potion poison remains four units. Levitation does not
      protect against airborne gas, and clouds can hurt the player. Overlapping
      cells merge and extend lifetime, not damage stacks. Expiry wins pulse ties.
      A separate overlay preserves ground terrain, with visible-only green shading
      that fades over each cell's remaining lifetime and inspect descriptions.
      Saved floors copy cloud state and shift event clocks on restoration, so
      inactive floors pause gas. `gas.ts` plus the gas/stair suites cover geometry,
      expansion, exposure, overlap, idle frames, timing, expiry, deaths, movement
      and potions. Visual and balance playtesting remain deferred.
- **Acceptance:** positioning and terrain become a first-class tactical layer,
  not just walls.

### Phase 8 — Enemy & boss redesign
*Depends on G1, G2.*

Implemented foundations: Skeleton stays dead; Quloptsh has on-hit effects;
Ghoul has fast movement, regeneration and on-hit effects; Brute enrages;
cultists summon and snipe with necromantic bolts, swarms split on death, and
elementals have typed effects.
Goblin archers fire bleeding arrows at range 5 and switch to a weaker melee
sidearm when adjacent. Wraiths deal magic damage with physical resistance.
Door-aware pursuit exists and monsters can open doors, but nothing avoids
burning terrain.
Two treasure chests generate per floor (separate from the mimic encounter);
opening them is a use action and rewards scale to floor tier. Mimics stay
dormant until damaged and scale across the five region bands.

Signature-ability status: Skeleton ✅, Quloptsh ⚠️ (evasion + weakened, no
short-FOV/backstab), Ghoul ⚠️ (regeneration + bleed, no lifesteal), Brute ✅,
swarm ✅, cultist ✅, mimic ✅, elemental ✅, archer ✅, wraith ✅, Deadly Frog ✅.

- [ ] Finish every monster's intended signature ability (SPD-style):
  - [x] Skeleton → basic brittle melee enemy; stays dead when killed (no reanimation).
  - [ ] Quloptsh → hard to see (short FOV for player) / backstabs.
        Partial: high evasion (40) and on-hit `weakened` only; no concealment or
        backstab bonus.
  - [x] Archer → goblin archer: fires bleeding arrows at range 5 and switches
        to a weaker melee sidearm when adjacent.
  - [ ] Ghoul → lifesteal on hit; fast but frail.
        Partial: movement speed 2, self-applied `regeneration`, on-hit bleeding
        and fire vulnerability; hits do **not** heal it.
  - [x] Brute → enrages below 50% HP (ATK up, DEF down).
  - [x] New: swarm (splits), cultist (summons), mimic (chest trap), elemental
        (fire/ice/shock).
  - [x] Deadly Frog → vents poison gas when damaged and again on death; immune
        to poison. Appears from floor 4.
  - [x] Wraith → magic damage with physical resistance; ordinary movement.
- [x] AI: monsters open doors and chase through paths.
- [ ] AI: avoid burning terrain and other self-damaging hazards.
- [ ] Bosses: multi-phase, telegraphed attack, summons, arena hazard. Each
      region boss gets a signature mechanic (not a stat sponge).
- **Acceptance:** each fight has a "correct" tactic that differs per enemy.

### Phase 9 — Character build depth
*Depends on G6.*

- [ ] Subclasses / specialisations (e.g. Warrior → Gladiator/Berserker,
      Dwarf → Vanguard/Siegebreaker, Cleric → Warden/Sun, Elf → Sniper/Ranger,
      Wizard → Pyro/Storm).
- [x] First-tier class talent roots remain (one per class, two ranks). Phase 18
      replaced the old `min(2, level - 1)` cap with one point per level and a
      fullscreen tree; see Phase 18 for current behaviour.
- [ ] Subclasses only. Phase 18 delivered the later unlock bands and the
      three-branch tree; subclasses remain future work.
- [x] Define initial XP thresholds and level-based HP/combat scaling: retain
      `8 × current level` XP per next level (excess carries over), +5 max HP
      and +1 base ATK per level, without healing on level-up. Strength remains
      potion-only. These existing curves are retained pending balance playtests,
      not claimed balanced. No generic stat picker.

#### First-tier talent specification

Each bonus below is **per rank** (maximum 2):

- **Warrior** — Deep Fury: +1 damage at/below half HP
- **Dwarf** — Iron Skin: +1 physical armor
- **Cleric** — Greater Mending: +1 HP regenerated each turn
- **Elf** — Light Footwork: +5 evasion before armor penalties
- **Wizard** — Focused Mastery: +1 fire/shock/magic damage

Talent capacity currently equals the number of ranks available to the class,
so points never pile up unspendable. Other equipment, Strength and XP tracks are
unchanged. `scripts/test-rogue0-talents.mjs` covers awards (including
multi-level gains), rank/point/class guards, each passive bonus and Hero-panel
actions. These five nodes are the **tier-1 roots** of the Phase 18 tree; keep
their ids (`fury`, `armor`, `mending`, `grace`, `mastery`) as stable wire ids.
Visual verification and full-run/five-class balance playtesting remain deferred.

- [ ] Per-class active skill with a cooldown — removed from the game (see
  "Current state"); the toolbar special-action button and `f` binding are gone.
- **Acceptance:** two runs of the same class can diverge meaningfully by
  floor 5.

### Phase 10 — Survival & economy
*Depends on G5, G7.*

- [x] Hunger, starvation, well-fed regeneration and ration drops.
- [x] Monster kills award gold (kills and chests drop piles; the wallet is
      displayed in the HUD).
- [x] Portal stores (not shop rooms) with stock, buy/sell and persistent
      inventory on floors 6/11/16/21 (Identify/Upgrade/Remove Curse, food,
      tools, gear). Cooking later.
- [x] Sell unwanted items; buy back sold items.
- [ ] Boot revival (in progress): normal Boot (store-only, stocked in every
      store) and Blessed Boot (ritual-only, never sold), plus a floor-7 mural
      hint depicting the ritual. See specification below.

#### Boot revival specification (planned)

**Items and carry rules**

- Repurpose the existing junk shoe item (`items/Shoe.ts`, keep its save-registry
  wire ID/file compatibility) as the normal revival **Boot**: `identified: true`,
  not cursed, not manually usable, **not equipable**, `count: 1`, carried in
  the **backpack only**. Revival triggers **only from a backpack boot**.
- Add **Blessed Boot** as a distinct item/class with a permanent semantic wire
  ID and distinct generated art/name/description. It follows the same
  carry/trigger constraints and is **never sold in stores**.
- **No monster drops:** remove the revival boot from all monster loot, the
  global loot table and any other drop source. The normal Boot is
  **store-only** and is **stocked in every store** (never the Blessed Boot).

**Trigger and priority**

- Automatic when the hero would die (HP <= 0) on any audited lethal path
  (combat, starvation, falls/terrain/chasm or other direct lethal damage).
  Intercept **before** hero removal, `player-died`, `endGame(false)` and run-save
  clear. A successful revive means no end and no save clear; autosave after a
  consistent state.
- Consume exactly one triggering boot (remove/destroy it and clear references
  such as quickslots). If both types are present, consume a **Blessed Boot with
  greater priority**.

**Common revive outcome**

- `healthPoints = maxHealthPoints`, `hunger = maxHunger` (full satiété).
- Relocate the hero to a **random safe, passable, unoccupied** tile on the
  **same floor** (not blocked/chasm/occupied by rules), with a deterministic
  fallback so revival cannot fail.
- Clear lethal/transient state as needed and harmful timed effects
  (burning, poison, frozen, stun/crippled/chilled/bleed, etc.) without breaking
  permanent passives (talents and passives from items that remain valid). Floor,
  layout/terrain/entities, XP/level/stats, gold and kills remain.

**Normal Boot outcome**

- **Kept on hero:** equipped **weapon and armor only**, kept equipped with
  their existing state/curses/glyphs/upgrades intact.
- **Dropped at the death tile:** the **entire backpack** and the other equipped
  items — **`ring1`, `ring2`, `artifact`**.
  - Backpack contents become a **single recoverable container** on the death
    tile. The rings/artifact are **separate loose floor items on the same tile,
    beneath that container**, ready to pick up.
  - Walking into the container stows its contents directly into the inventory
    (stacking/capacity rules still apply) and opens the inventory window so the
    recovered items are visible. The loose rings/artifact are left on the floor.
    Anything that no longer fits stays on the tile.
  - If the death tile cannot hold the container/items, fall back to the
    **nearest valid tile** for those drops (the hero still revives elsewhere).
  - Dropped items remain on the floor/in `context.entities`, are
    pickable/interactable, persist in the floor save, and lose quickslot/carried
    references.
- **Memory:** forget this floor’s map memory — reset explored/`seen` state to
  unknown, restore fog of war, recompute FOV from the revive position, and
  persist the reset in the active floor snapshot/save.

**Blessed Boot outcome**

- **Kept:** backpack and all carried/equipped state retained.
- **Dropped:** nothing.
- **Memory:** retained (no seen/fog reset).

**Blessing ritual (Blessed Boot source; never in stores)**

- **Pattern (strictly cardinal, axis-aligned, all five on valid floor tiles):**
  a **Boot** on the center tile; a **Potion of Berserk** (`BerserkPotion`) on
  the tile **left** of the boot; a **Potion of Berserk** on the tile **right**;
  a **Potion of Healing** (`PotionOfHealing`) on the tile **above**; a
  **Potion of Healing** on the tile **below**.
- **Trigger:** when the **last required item is dropped/placed onto the floor**
  into a valid cross. The Boot may be **thrown** into position; thrown potions
  shatter and therefore cannot complete the ritual.
- **Result:** play an animation and **transform** the floor Boot into a
  **Blessed Boot** at the same tile; **consume/remove all four potions**. The
  transformed item and removed reagents persist/save normally.
- **Discoverability:** a **mural on floor 7** depicts the boot blessing ritual
  (boot at center, Berserk potions left/right, Healing potions above/below) as
  an in-world hint. On revive, play a death cue then revival sound and light.
- **Regression:** headless coverage for normal/blessed revive (including
  starvation and other lethal paths), priority, backpack-only trigger,
  relocation/drop/memory behavior, death-tile fallback, save/load round-trips,
  ritual detection/transform/consumption, absence from monster loot, and
  store-only normal Boot stock in every store. Visual/animation and balance
  playtesting remain required.
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

- [x] Save/load (localStorage) + resume: one run autosaves per browser, with
      Continue on the title screen, and leaving the game flushes a checkpoint. The remaining
      meta features below are still open.
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
      Partial: five visual palettes (stone/crypt/sandstone/crystal/volcanic) are
      already wired by floor; enemy/trap/boss regional scaling remains open.
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
implemented. The HUD backpack button, `i`/`b`/`Esc` keys, HUD status icons with
durations, hover tooltips and the bottom message strip are also in place. What
remains is quick-key paging over the backpack, a true per-item Inspect action,
and small-screen/visual verification of the whole HUD.

- [x] Add the **Backpack button** (bag icon) to the HUD; open/close the
      inventory window with the button or `i`/`Esc`.
- [x] Build the **inventory window**: equipped slots row on top
      (weapon / armor / ring / ring / artifact), then the backpack as a
      4-column grid, each cell showing the item icon (or a `?` placeholder if
      unidentified). It scales to the viewport instead of paging.
- [x] Item selection → action menu: **Use / Equip / Unequip / Drop /
      Throw** (replaces the old "toggle on pick" flow).
      **Inspect** as a separate action remains open — details live in the action
      dialog and hover tooltips.
- [x] Enforce a real **backpack capacity** (20 slots) with an "inventory full"
      message + drop prompt; the auto-growing sidebar slot grid is gone.
- [ ] Numbered quick keys `1–0` act on the currently visible backpack page;
      hovering an item shows its tooltip (name, stats, status effects).
      Hover tooltips exist; instead of `1–0` paging there is a **four-slot
      assignable quickslot pane** beside the backpack (hold a slot, then pick an
      item; assignment costs no world time). Decide whether to keep that or add
      page-wide number keys.
- [x] Show **buff/debuff status icons + remaining duration** in the HUD, with a
      hover tooltip describing the effect (from G1).
- [x] Move the **message log** to a bottom strip (SPD-style) and keep
      hover-inspect on the map; the strip opens a paginated log window that
      pauses input while open.
- **Acceptance:** the player opens the inventory with a button or key, sees
  equipped + carried items clearly, and can perform any item action without
  consulting hidden slots; nothing renders off-screen.

### Phase 16 — Graphics & art overhaul (16px grid)
*In progress. Replaces the Kenney artwork and magic-number lookups.*

Progress so far: the Kenney sprite sheet is gone. `public/colored.png`, the
`tiles` spritesheet, the `foreground-tiles` atlas, `spriteFrames.ts` and every
`tile = row * 49 + col` lookup were deleted together, after each entity got its
own art. Floors/walls use five compact theme strips; monsters are checked-in
PNGs (cultist, goblin, ghoul, brute, Quloptsh and skeleton); every other item,
projectile and terrain feature is a generated texture. Old saves that still
carry an atlas frame number decode fine — the number is carried but ignored.

Still open: the five hero classes share one portrait/sprite instead of having
class-specific art, and the palette needs a deliberate pass across all sprites.

- [x] Fix the mimic sprite: replaced the sword frame with the existing closed
      wooden chest (row 6, column 8). Implemented and visually verified in a
      mobile browser viewport using **Astra via Pi routing**.
- [x] Give chests and mimics dedicated art instead of the flat two-colour
      tilesheet chest: `chestTextures.ts` generates a banded chest (iron straps,
      gold clasp) plus an open-jawed mimic. A dormant mimic wears the chest
      texture exactly and swaps to the fanged frame when provoked; old saves are
      remapped in `runPersistence.ts`.
- [ ] Choose a cohesive 16×16 palette (dark SPD-like dungeon, warm light, one
      gold accent) and keep it consistent across all sprites.
      Partial: the five region palettes and the generated monster/item art move
      in this direction; no third-party sprites remain to clash with them.
- [ ] Give the five hero classes their own sprites instead of one shared
      portrait.
      Landed: floors/walls (5 regions), tall grass, every monster, every item,
      every projectile bolt, doors, traps, water, ice, chasm, decals. Existing
      saves migrate the new sprites without rerolling combat state.
- [x] Replace the `tile = row*49 + col` magic numbers, then delete the
      mechanism: named frames first (`spriteFrames.ts`), then dedicated art per
      entity, then removal of the frame field, the sheet and `public/colored.png`.
- [x] Keep `pixelArt: true` so sprites stay crisp; the camera supports
      wheel/key zoom and touch pinch zoom.
- **Acceptance:** ~~no Kenney leftovers~~ (done); every entity/item has a
  distinct, readable sprite; nothing is ambiguous (no potion-vs-heart-vs-apple).

---

### Phase 17 — Local scenario harness (dev tooling)
*Implemented. Local-only: `GameContext.scenario` is written solely by the
`isLocalViteDev()`-gated React panel; the shipped flow never sets it.*

Problem it removes: hand-testing anything floor-specific or loadout-specific
currently means either grinding 25 floors or editing source. Manual testing
should start from an authored state in one click: any floor, any monster set,
any inventory.

**Scenario object** (new `src/games/rogue0/scenario.ts`; the scene reads it off
`context.scenario` and every branch is dev-gated):

```ts
{ floor: number,                       // 1..maxFloor
  hero: { class?, level?, healthPoints?, hunger?, gold?, talents? },
  inventory?: Array<{ id: string, count?: number, equip?: boolean,
                      cursed?: boolean, tier?: number, upgrade?: number,
                      identified?: boolean }>,   // undefined = keep class gear
  monsters?: { mode?: 'replace' | 'append',  // default 'replace'
               list: Array<{ kind: string, count?: number,
                             near?: boolean, awake?: boolean }> } }
```

- [x] `GameContext.scenario?: Scenario` (type-only import, so `context.ts` stays
      Phaser-free). No autosave switch and no second storage key: an active
      scenario overwrites the run save, by decision.
- [x] **Ids reuse `saveRegistry`**, reversed once in `scenarioCatalog()`. The id
      is the class name (`PotionOfFrost`, `Goblin`, `TieredWeapon`), which the
      scenario suite verifies is unique across the registry; the elemental
      aliases collapse onto one entry. Unknown ids are reported by
      `normalizeScenario`, never skipped.
- [x] **Start floor.** `create()` sets `context.floor` from the scenario *before*
      `generateLevel(floor)` / `dungeon.initialize`, and passes it to
      `setupFloor`. Ascending stays unavailable below a generated floor 1
      (already logs “The entrance is sealed”). `scenario` is cleared once the
      first floor exists, so descending builds a normal floor.
- [x] **Floor population.** `'replace'` skips `spawnFloorContent` and spawns the
      listed set only; `'append'` builds the normal floor and adds the list.
      Nothing is ever deleted, so no loot roll and no reinforcement wave runs.
      `near` is a ring search 2–6 tiles from the spawn (a random sample of a
      whole floor never lands that close); `awake` clears the 8–24 tick dormancy
      and sets `awareOfPlayer`.
- [x] **Population guard suppressed.** `context.onMonsterRemoved` is left unset
      in scenario mode, so an authored floor stays exactly as authored.
- [x] **Hero loadout.** Level goes through `gainXp` (the only path that also
      applies +5 HP/+1 ATK and talent points); then HP/hunger/gold/talents.
      `inventory` replaces the class's starting gear exactly (unequip hooks run
      first, so ring/armor passives unwind); `equip: true` uses `equipItem`,
      `cursed` is opt-in, and `identified` defaults to true (identify registers
      potion/scroll/wand knowledge) with `false` available for the unknown flow.
- [x] **Finish like a load does.** `finishScenarioInventory` reuses
      `rememberIdentifiedWandTypes`, `Wand.reconcileChargeScaling` and
      `Ring.onUpgrade`.
- [x] **React panel** (`src/components/rogue0/ScenarioSetupPanel.tsx`, reached
      from a “Scenario (dev)” button beside Help on the title screen): floor
      slider with the band/secret-room/dark-floor/boss notes it implies, class +
      level + HP + food + gold, talent ranks, a filterable item picker with
      count/tier/upgrade/equip/cursed toggles, and a monster list with
      count/near/awake and a replace-vs-append choice. No new Phaser window.
- [x] The last scenario persists in `localStorage['rogue0.scenario.v1']`, and a
      collapsible JSON box can fill from the form or load a pasted scenario.
- [x] Suite `scripts/test-rogue0-scenario.mjs` (`npm run test:rogue0:scenario`,
      part of `npm run test:rogue0`): source audit of registry ids, then
      normalisation, monster expansion, level/loadout application, gear
      replacement, container/unknown reporting, post-load fixups and a guard
      that “replace” never calls `removeEntity`. Verified in a real browser:
      floor 12 · Wizard level 5 · four monsters · three frost potions.
- **Accepted trade-offs:** autosave overwrites the previous run (and ends
      clear it) — no separate key or autosave switch. Floors, monsters and
      inventory are pinned; **map layout is not** (see the determinism note in
      §7). Ascending from a mid-run start is out of scope.
- **Acceptance:** from a cold page load, one click and a few form fields
      produce e.g. "floor 12, Dwarf, level 5, two Potions of Frost, 4 goblins,
      nothing else" and the run plays normally from there; clearing the floor
      does not spawn a reinforcement wave; the same scenario can be re-run
      after a reload.

### Phase 18 — Fullscreen talent tree
*Depends on Phase 9's talent data and the modal conventions from G8/Phase 15; planned, not implemented.*

**Problem.** Talents are currently a 320×360 tab inside the Hero modal, with one
two-rank talent per class and a point total derived from level (`min(2, level -
1) - spent`). That is a single decision, capped by level 3, not a tree; the
"Talent point earned!" log at levels 2–4 even promises more points than the
formula can spend. The store already establishes the right pattern for a screen
that genuinely stops the run: its own scene, the dungeon scene paused, and the
HUD scene asleep.

**Current state (source-audited; no code changes in this phase yet).**

- `src/games/rogue0/ui.ts` builds the Hero modal (`buildHeroModal`,
  `toggleHeroModal`, `updateHeroModal`): a `showingTalents` tab, exactly two
  hard-coded `talentRows`, viewport scaling via `heroScale`, and a backdrop. It
  gates input through `isModalOpen()`; it does **not** stop scene 0's update or
  sleep the HUD. The portrait button in `buildToolbar` is the only entry.
- `classes/basicHero.ts` holds `CLASS_TALENTS` (five classes × one node),
  `MAX_TALENT_RANK = 2`, `talentRanks`, the derived `talentPoints` getter and
  `learnTalent()`; `gainXp()` logs point awards at levels ≤ 4. Bonuses are read
  back through `attack()`, `protection()`, `effectiveEvasion` and `refresh()`.
- `context.ts` has `heroModalOpen` and `isModalOpen()`, but no talent-scene
  flag. `config.ts` registers only `Scene0` and `StoreScene`.
- `scene0.ts` `tryStoreDoor()` is the pause template: save checkpoint, clear
  input/cursor state, set the flag, `scene.sleep('ui-scene')`,
  `scene.launch(...)`, `scene.bringToTop(...)`, `scene.pause()`. `StoreScene`
  reverses it on exit and clears the flag in its `shutdown` handler;
  `Rogue0.tsx` hides the DOM game menu while `storeOpen` is set.
- `store/storeLayout.ts` plus `scripts/test-rogue0-store-layout.mjs` show the
  tested responsive pattern: one pure layout function, an aspect-ratio mode
  switch, contain-never-cover scaling, screen-space buttons and inverse hit
  tests. `STORE.md` documents the scene stack.
- `scenario.ts` authors ranks by calling `learnTalent()`; saves carry
  `talentRanks` in the hero object graph (no separate field today).

**Goals.** (1) A fullscreen talent screen opened from existing UI, with the same
hard pause as the store. (2) A real per-class tree with branches, prerequisites
and meaningful point scarcity. (3) A point source that is explicit, saveable
and extensible. (4) Readable, reachable on both desktop and a phone in portrait
or landscape. **Non-goals:** respecing/refunds, subclasses, new art, new combat
systems, and auto-opening the screen on level-up.

**Decisions locked at planning time:** the screen is **Phaser-rendered**, not a
React DOM page (React only hides the DOM game menu); points come **only from
XP/level**, one per level from level 2, through `awardTalentPoint()`; entry is
the **Hero-panel button plus the `t` hotkey**, with no new HUD button and no
auto-open. The tree shape is fixed at three branches × three tiers with 2/2/2
ranks per branch; node names and numbers stay provisional pending balance
playtesting. These are decisions, not remaining options — implementation should
not re-litigate them.

#### 1. Scene stack and pause semantics

- [x] New scene `talent-scene` in
      `src/games/rogue0/talents/TalentScene.ts`, registered with
      `active: false` in `config.ts` beside `StoreScene`. It owns its own
      camera, an opaque background and all input; it never builds a tilemap or
      touches the dungeon. **Decision:** the whole screen is drawn in Phaser —
      panels, connector lines, rank pips, text, buttons and icons. No React
      page or DOM overlay renders talent UI.
- [x] Add `talentTreeOpen?: boolean` and
      `onTalentTreeOpenChange?: (open: boolean) => void` to `GameContext`, and
      include the flag in `isModalOpen()`. `Rogue0.tsx` mirrors `storeOpen`:
      hide the DOM game menu while the tree is open.
- [x] Entry paths: the Hero modal's **Talents** tab becomes an **Open talent
      tree (n)** button (close the Hero modal first), and a `t` hotkey opens it
      directly from play (`t` is currently unused by hero input). Reject entry
      when another modal is open, the hero is dead, a fall/trap-arrow is
      pending, or an actor is moving — the same guards as `tryStoreDoor()`.
      Spending a rank must never call `spendTurn()`. **Locked:** these two entry
      points only — no extra HUD button (the mobile HUD is already tight) and no
      additional keybind.
- [x] Open exactly like the store: `saveNow()`, clear `inputBuffer`/`walkPath`
      and cursor/throw modes, set the flag, sleep `ui-scene`, launch +
      `bringToTop('talent-scene')`, then `scene.pause()` scene 0. This is the
      "stop the game" requirement: no scheduler ticks, hunger, regeneration,
      effect durations, monster moves, autosaves or animations advance. Input
      gating alone (`isModalOpen`) is *not* sufficient.
- [x] Close with `Escape`, a large **Close** button, or a tap outside the tree
      panel: `saveNow()`, clear the flag, wake `ui-scene`, resume scene 0, stop
      the scene. Its `shutdown` handler clears `context.talentTreeOpen` and
      calls `onTalentTreeOpenChange(false)` so a destroyed game cannot leave a
      stale modal flag. The Hero modal stays closed on return.
- [x] Both scenes' keyboard listeners check their own open flag and call
      `preventDefault()`, so HUD/map hotkeys cannot fire underneath the tree.

#### 2. Data model and point economy

- [x] New pure module `talents/talentTree.ts` (no Phaser): `TalentNode = {
      id, name, description, maxRank, tier, requires: string[], minLevel }`,
      `TALENT_TREE: Record<HeroClassName, TalentNode[]>` and lookup helpers
      (`nodeById`, `prerequisitesFor`, `isUnlocked`, `rankCost`). Node ids are
      stable wire ids; the five existing ids (`fury`, `armor`, `mending`,
      `grace`, `mastery`) stay as tier-1 roots, and `CLASS_TALENTS` becomes a
      compatibility view of those roots so current callers keep working.
- [x] Store ranks in the existing `talentRanks: Record<string, number>`. Add an
      explicit `talentPointsEarned: number` on `BasicHero`; spendable points are
      `talentPointsEarned - sum(ranks)`. `learnTalent(id)` additionally checks
      `isUnlocked` (prerequisites and tier gate), and re-computes derived stats
      through the existing getters — no direct mutation of attack/armor/evasion.
- [x] Replace the derived point getter with a single `awardTalentPoint(source)`
      path called from `gainXp()`. Log the source ("Talent point earned! …")
      once per award, and update the stale level-2–4 wording.

  - **XP / level** — **v1 source:** 1 point per level, earned from level 2 (`earned = level - 1`). Predictable, rewards the core loop, and tracks the 25-floor arc (expected levels 1/5/9/12/16/19 at floors 1/5/10/15/20/25 → ~0/4/8/11/15/18 points).
  - **Region milestones (floors 6/11/16/21)** — **Rejected for v1.** Would need a per-milestone save flag; the level curve already tracks floor depth.
  - **Phase 12 quest rewards** — **Rejected for v1.** Depends on an unbuilt phase; revisit only as a separate change.
  - **Gold / consumables / store** — **Rejected.** Buying build power would turn progression into a resource purchase and undermine the XP track.

  **Locked:** XP/level is the only point source in v1; the alternatives above are
  out of scope, not pending choices. The `awardTalentPoint(source)` seam remains
  so a future change could add a source without touching the tree or the UI.
- [x] Save compatibility: old saves have ranks but no earned counter. On load,
      `talentPointsEarned = max(sum(talentRanks), level - 1)` so ranks are kept
      and the new entitlement is granted without double-counting; new saves
      persist the counter. Retire unknown/removed node ids on load the same way
      retired curse ids are cleansed, instead of letting them inflate `spent`.
- [x] Scenario harness: authored ranks must bypass the point gate (set the
      earned counter to at least the authored rank sum) so a level-1 scenario
      can still carry a ranked tree, matching today's `applyScenarioHero`.
- [x] Balance guard: with one point per level, total tree capacity (~18 ranks,
      below) exceeds a typical mid-run budget, so points are scarce for most of
      the run; leftover points at the final level are acceptable. If maxing
      everything proves too strong, tune point cadence or node ranks — not the
      prerequisite structure — in a later balance pass.

#### 3. Tree content (structure locked, numbers provisional)

- [x] Shape: three branches per class, each with tier 1 (level 2), tier 2
      (level 5, requires ≥1 rank in its tier-1 parent) and tier 3 (level 9,
      requires ≥1 rank in its tier-2 parent). Ranks 2/2/2 per branch → 18 ranks
      per class. Partial ranks unlock the next tier so points can spread; no
      prerequisite ever needs a maxed parent. Branches are independent: a node
      only requires its own parent, so the player can acquire just part of the
      tree, and the pane draws a line from each parent to the children it opens.
- [x] v1 bonuses stick to hooks that already exist: `maxHealthPoints`,
      `protection()`, `effectiveEvasion`, `refresh()` regeneration, the
      Warrior/Wizard low-HP and typed-damage additions in `attack()`,
      Strength-deficit and hunger math. Bonuses needing new hooks (wand
      recharge rate, hunger-drain multiplier, crit chance) are deferred so the
      tree does not also become a combat refactor.
- [x] Keep the five current nodes as the tier-1 roots of their class. Branch
      themes for the first tree:

  - **Warrior**
    - Branch A (root): Fury — Deep Fury
    - Branch B: Guard — HP / armor / low-HP regen
    - Branch C: Momentum — attack speed / push resistance
  - **Dwarf**
    - Branch A (root): Fortress — Iron Skin
    - Branch B: Demolition — weapon damage / tier penalties
    - Branch C: Thrift — hunger / upgrade value
  - **Cleric**
    - Branch A (root): Mending — Greater Mending
    - Branch B: Light — magic damage / blind resistance
    - Branch C: Ward — elemental resistance / blessing
  - **Elf**
    - Branch A (root): Footwork — Light Footwork
    - Branch B: Marksman — accuracy / ranged damage
    - Branch C: Wilderness — evasion in grass / poison resistance
  - **Wizard**
    - Branch A (root): Mastery — Focused Mastery
    - Branch B: Arcana — wand damage / charges
    - Branch C: Control — freeze / teleport utility

- [x] Worked example (Warrior; illustrates the locked data shape — other classes
      follow the same structure):

  - **Fury**
    - Tier 1 · level 2: Deep Fury (existing): +1 damage at ≤½ HP / rank, max 2
    - Tier 2 · level 5: Bloodletter: +1 damage at ≤½ HP / rank, max 2
    - Tier 3 · level 9: Sustained Rage: +1 HP regen per turn / rank, max 2
  - **Guard**
    - Tier 1 · level 2: Iron Resolve: +3 max HP / rank, max 2
    - Tier 2 · level 5: Bulwark: +1 physical armor / rank, max 2
    - Tier 3 · level 9: Second Wind: +2 HP regen per turn while hungry / rank, max 2
  - **Momentum**
    - Tier 1 · level 2: Quickstep: +2 evasion / rank, max 2
    - Tier 2 · level 5: Relentless: −10% weapon delay / rank, max 2
    - Tier 3 · level 9: Unyielding: +1 physical armor / rank, max 2

  The three-branch / three-tier / 2-2-2 structure is locked; the names and
  numbers above are provisional, not balance-tested facts. The acceptance
  criterion is that two runs of one class diverge, not that these exact values
  are final.

#### 4. Layout — computer and phone

- [x] Pure `talents/talentTreeLayout.ts`: invalid viewport throws `RangeError`;
      `mode = wide` when `viewW / viewH >= 1.2`, otherwise `narrow`. The tree is
      laid out on a canvas deliberately **larger than the pane in both axes**,
      so it pans horizontally and vertically; exported helpers give content
      bounds, circular node boxes, scroll limits and two-axis hit testing,
      all testable in node without Phaser.
- [x] **Desktop / landscape (wide):** a large tree pane fills almost the whole
      screen. On the oversized canvas, each branch's tier-1 root sits near the
      top and its tier-2/tier-3 children fan outward, so the connector lines
      form three branching trees rather than a grid. Nodes are **circles** with
      an icon, name and rank — descriptions are **not** drawn on the tree;
      parent→child lines brighten once the parent has a rank. Drag/wheel pans
      in any direction; hover selects, arrows move, Enter/Space opens the detail
      modal, Escape closes the modal (or the scene).
- [x] **Phone portrait (narrow):** the tree uses nearly the whole screen. The
      same fan-shaped circular tree is drawn on a canvas wider and taller than
      the pane, so it pans by touch drag in both axes. Overflow is hidden by
      opaque cover rectangles, not WebGL masks (Phaser 4's `setMask` is a
      no-op), and off-pane nodes are not tappable.
- [x] **Floating detail modal:** clicking/tapping a node (or pressing Enter)
      opens a modal centred over the pane with that talent's icon, name, rank,
      full description, unlock requirement and **Rank up** button. Tapping the
      backdrop, its × button or Escape dismisses it. Nothing descriptive is
      shown permanently on the tree.
- [x] Test viewport matrix (mirroring `test-rogue0-store-layout.mjs`):
      `[1920,1080], [1280,720], [800,400], [390,844], [360,640], [320,240]`.
      Assert every node and both buttons stay inside the viewport, narrow-mode
      touch targets meet the minimum, and inverse hit testing maps each node's
      centre back to its id.
- [x] Every node has its own icon drawn as shapes keyed by its bonus type
      (heart = HP, shield = armor, chevrons = evasion/haste, cross = regen,
      blade = low-HP damage, bolt = typed damage), on the circular node and
      again in the floating detail modal. No new art assets are needed; a
      dedicated pixel-art pass is optional and separate.

#### 5. Feedback, saves and docs

- [x] Locked nodes are visibly dimmed and name their requirement
      ("Requires Deep Fury 1" / "Unlocks at level 5"); capped nodes show maxed
      pips; unavailable Rank up shows why (no points, locked, maxed).
- [x] Do **not** auto-open on level-up: it would interrupt combat and force a
      stop mid-fight. Instead keep the level-up log line, add a point badge to
      the Hero portrait/tab when points are unspent, and let the player open
      the tree when safe. This is a deliberate choice, not an omission.
- [x] Learning a rank logs `Learned <name> (r/max)` as today and saves; no
      confirmation dialog is needed for a reversible-in-spirit UI action, but
      respecing stays out of scope and must not be implied by the copy.
- [x] Update the stale docs during implementation: the **Talents** help page in
      `src/pages/Rogue0.tsx` (currently "Blood Fury … one passive talent") and
      the `README.md` line saying talents are not implemented, plus this
      PLAN.md's Phase 9 checkboxes once the tree replaces the tab.

#### 6. Tests and acceptance

- [x] **Keep tests minimal.** One small headless suite
      (`scripts/test-rogue0-talent-tree.mjs`) covering only what can regress
      silently: unique node ids/acyclic prerequisites, award/spend with no world
      time consumed, old-save migration and scenario ranks, plus layout
      containment on the viewport matrix. No exhaustive per-node or per-viewport
      snapshots, and no source audits of scene wiring — verify the scene, pause
      behaviour and visuals with the dev scenario harness and a quick browser
      pass instead. Adjust existing assertions in `scripts/test-rogue0-talents.mjs`
      only where the new point economy invalidates them; keep its bonus coverage.
- [x] Follow the test-reporting rules in `AGENTS.md`: focused runs while
      developing, a full `npm run test:rogue0` before completion, and record
      any failure's cause/resolution in the history (game bug vs test bug vs
      environment) instead of hiding it.

- **Acceptance:** tapping the portrait → **Open talent tree** (or `t`) shows a
  fullscreen tree on desktop and phone; the dungeon, monsters, hunger, effects
  and scheduler are frozen while it is open (verified by unchanged
  `simulationTime` across frames), and closing returns to the identical state
  without spending a turn. Points come from levels through one central award
  path, ranks obey prerequisites and caps, saves/scenarios preserve them, and
  two runs of the same class can diverge meaningfully by floor 5.

**Implementation status:** code and the minimal headless suite landed; a quick browser pass on desktop and phone is the only manual check still outstanding.

---

## 6. Suggested sequencing

### Next implementation priorities

State at this update: 41 headless suites (`npm run test:rogue0`) and the
production build pass; visual and five-class balance playtesting stay deferred
at user request.

0. **Local scenario harness (Phase 17) — landed.** Dev-only title-screen panel
(`src/components/rogue0/ScenarioSetupPanel.tsx`) plus `scenario.ts` and the
scene apply step: floor, hero loadout, exact inventory and monster set in one
click. Use it to hand-test every priority below instead of grinding to a floor.
1. **Fullscreen talent tree (Phase 18) — planned.** Replace the Hero panel's
   Talents tab with a dedicated fullscreen scene that pauses the dungeon like
   the store, and grow the single rankable talent per class into a three-branch
   tree with prerequisites. Points come from levels through one explicit award
   path; layout must work on desktop and phone. Full specification in Phase 18.
2. **Shoe revival and the remaining gold sink (Phase 10).** Portal stores are
implemented on floors **6, 11, 16, and 21** with buy/sell, persistent stock and
floor-scaled gear (see **`STORE.md`**); gold now has a sink, but revival does
not yet exist. Replace the planned Ankh with **Shoe** revival (planned, see
Phase 10 spec): the normal **Shoe** is a **store-only** item that appears
**once at any store** in a run (never dropped by monsters), carried in the
backpack and auto-triggered on death with **greater-priority Blessed Shoe**
consumption. A normal Shoe revives on the same floor at a random safe tile with
full HP/hunger but keeps only equipped weapon and armor, drops the backpack as a
recoverable container plus `ring1`/`ring2`/`artifact` beneath it at the death
tile (or nearest valid tile), and forgets that floor's map memory/fog. A
**Blessed Shoe** (never sold) is created by the floor ritual — place a Shoe with
a Potion of Berserk left/right and a Potion of Healing above/below, triggering
on the last dropped placement (thrown potions shatter) with an animation that
transforms the Shoe and consumes the four potions — and revives with backpack
and memory retained. Concrete store price/rarity/row and the dropped-container
entity/UX remain implementation details to finalize against the spec.
3. **Finish Phase 8 signatures.** Remaining: monsters avoiding burning terrain,
   then Quloptsh concealment/backstab and ghoul lifesteal. Boss redesign
   (multi-phase Bone Lord) stays deferred.
4. **Phase 9 build breadth after Phase 18:** the tree supplies later unlock
   bands; subclasses remain a separate, later step. First-tier talents already
   give a real level-up choice.
5. **Phase 14 region identity:** per-region enemy/trap sets and scaling on top
of the five existing palettes. Today difficulty scales by floor number, not by
region, so floors 5→6 and 10→11 feel the same apart from colour.
6. **Phase 13 meta** (seeds, challenges, bestiary, run stats, achievements) and
the remaining Phase 15 polish (backpack quick-key paging, Inspect action,
small-screen verification).
7. **Phase 12 NPCs** last. Phase 16's atlas removal is done; what remains there
is class-specific hero art and a palette pass, neither of which affects depth.

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

- **Art direction is 16px (SPD-style), generated or hand-placed.** Every sprite
  now comes from a generated texture or a checked-in PNG; the Kenney sheet and
  the `row * 49 + col` lookups it required are gone.
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
- **No freely available player shove ability.** Involuntary chasm falls should
  come from confusion or displacement effects/traps, affecting either side.
  Explicit voluntary jumping is separate.
- **Ranged/melee and click-vs-keyboard controls stay as-is**; new systems
  (search, open/close, aim) get keyboard bindings + tap fallback.
- **Inventory moves out of the sidebar into a modal window** opened by a
  backpack button (`i`/`b`) and closed with `Esc`; the sidebar's auto-growing
  `UIItems` grid is removed.
- **Backpack capacity is explicit (20 slots)**; exceeding it prompts a drop
  decision rather than silently overflowing off-screen.
- **Quick access is four assignable quickslots**, not `1–0` acting on the
  backpack page. Assignment costs no world time. Changing this is a deliberate
  UX decision, not a leftover bug.
- **Monsters are dormant at spawn**, not permanently awake: they wait 8–24
  world-time units and wake on damage, noise or a visible hero within 2 tiles.
  Do not reroll sleep when restoring a saved floor.
- **Scope guard:** SPD has a decade of content. Prioritise the systems above
  over raw item/monster count; 8 well-designed enemies with abilities beat 30
  stat clones.
- **The scenario harness (Phase 17) is local-only dev tooling.** Rules for it:
  the panel and its button are gated on `isLocalViteDev()` and it is the only
  writer of `GameContext.scenario` (the scene branches just read it); achieve
  “replace” by *skipping* the default spawner, never by deleting entities;
  leave `onMonsterRemoved` unset while a scenario is active; reuse
  `saveRegistry` ids and `restoreRunState`'s item fixups rather than
  duplicating them. Overwriting the autosave is accepted, so no second storage
  key and no autosave switch.
- **Scenario determinism is deliberately out of scope (v1).** `generateMap`,
  feature placement and `randomWalkableTiles` all use raw `Math.random()`, so a
  scenario pins *what* is on the floor but not *where*. Combat, item and effect
  bugs do not need layout stability. If a layout-dependent bug appears, add an
  optional `map` + `features` override (paste the arrays from a save) rather
  than plumbing a seeded RNG through mapgen.
- **Scenario items are explicit, not rolled.** Defaults are not equipped, not
  cursed, upgrade 0, and tier from `floorProgression(floor).tier` (the band
  base, not `lootTier`'s random ±1 roll); `equip` goes through `equipItem` (so
  `onEquip` and capacity rules still apply) and `cursed` is opt-in. Purpose:
  reproduce one situation, not sample the loot table.
- **The talent tree is a fullscreen Phaser scene that stops the run (Phase 18).**
  Copy the store's scene stack — pause scene 0, sleep `ui-scene`, own the input,
  clear the flag on shutdown — rather than layering another modal over the HUD.
  Everything in the tree is drawn in Phaser; React only hides the DOM game
  menu. Entry is the Hero-panel button or `t`, with no new HUD button. The Hero
  panel keeps stats and links into the tree; it no longer owns talent selection.
- **Talent points come only from XP/level**, one per level from level 2, via a
  single `awardTalentPoint(source)` path and an explicit saved counter. Region
  milestones, quest rewards, gold/store and consumable purchases are all
  rejected for v1, not pending choices. Do not reintroduce the old derived
  `min(2, level - 1)` cap once the tree exists.
- **Talent tree layout is checked on desktop and phone before implementation is
  called done.** One pure layout function with wide/narrow modes, ≥44px touch
  targets on phones, `setCrop` instead of WebGL masks, and a small containment
  test over the store's viewport matrix; the visual check is a quick browser
  pass, not an expansive snapshot suite. Do not auto-open on level-up: the
  player opens the tree when it is safe, and the stop is real once they do.
- **Test footprint is deliberately minimal for Phase 18.** One small logic
  suite plus the existing game suites; no per-node balance tests, no scene
  source audits, no new browser test framework. Gameplay/visual behaviour is
  verified manually with the dev scenario harness.
- **The talent pane shows a branching tree, not a grid or a list.** Nodes are
  circles with their own icon, fanned outward by tier so parent→child lines
  read as branches. The canvas is intentionally larger than the pane in both
  axes, so it pans horizontally and vertically to reach every node. Branches
  stay independent so a player can specialise in only part of the tree — no
  "spend everything" requirement and no cross-branch prerequisites.
- **Out of scope by decision:** goblin archers do **not** kite/retreat, wraiths
  do **not** phase through walls, and monsters do **not** call allies. Do not
  re-propose these or implement them as extras.
