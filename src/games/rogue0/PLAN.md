# rogue0 — Depth Roadmap

Goal: close the depth gap between rogue0 and *Shattered Pixel Dungeon* (SPD).
SPD gets its depth not from raw content volume but from a small number of
**systems that compose**: status effects, identification/curse risk,
terrain, equipment tiers + upgrades, enemy "signature" abilities, and a long
enough run that those systems get to interact. This plan is organised around
building those systems in dependency order.

---

## 1. Current state (accurate)

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

| SPD pillar | rogue0 today | Target |
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

These are the load-bearing systems. Most later phases assume they exist.

### G1 — Status effects (`effects.ts`, new)
A `StatusEffect` type and an `effects: StatusEffect[]` field on `Entity`.

- `effect = { id, name, iconTile, duration, apply(e,c), tick(e,c), remove(e,c) }`
- Effects tick on the entity's `refresh()` (once per turn) and apply/expire
  cleanly with a message log line.
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
- Traps: hidden until stepped on (or searched); one-shot effects (dart=poison,
  fire, frost, summon, teleport, alarm).
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

- [ ] Implement `effects.ts` and tick lifecycle.
- [ ] Implement `combat.ts` (accuracy, armour, types, crits, surprise).
- [ ] Add resistances/vulnerabilities to monsters and heroes.
- [ ] Wire burning/poison/bleed/frozen into items and a couple of monsters.
- [ ] Surprise attack: unseen attacker auto-hits with bonus + possible bleed.
- **Acceptance:** a fight can end in multiple ways (burn tick, bleed-out, crit,
  frozen skip) and the log explains what happened.

### Phase 6 — Item risk & progression
*Depends on G3, G6.*

- [ ] Identification: unknown consumables/gear; identify by use or scroll.
- [ ] Cursed gear (can't unequip, penalty) + Remove Curse.
- [ ] Scroll of Upgrade (+1 to tier/level), equipment tiers 1–5.
- [ ] Wands with charges + Recharging scroll.
- [ ] Rings (e.g. Accuracy, Evasion, Elements, Haste, Might) and 1–2 artifacts.
- **Acceptance:** deciding whether to equip an unidentified item is a real,
  tense choice with consequences in both directions.

### Phase 7 — Terrain & environment
*Depends on G4.*

- [ ] Doors (open/close/secret) + search action.
- [ ] Traps (hidden → trigger on step; search reveals; a few can be disarmed).
- [ ] Grass (burn + conceal), water (douse/freeze), chasm (fall/push).
- [ ] Elemental combos: fire spreads on grass, frost freezes water, shock arcs
      in water, poison lingers in gas clouds.
- **Acceptance:** positioning and terrain become a first-class tactical layer,
  not just walls.

### Phase 8 — Enemy & boss redesign
*Depends on G1, G2.*

- [ ] Give every monster a signature ability (SPD-style):
  - Skeleton → reanimates once unless killed by fire/magic.
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
- [ ] Talents: pick 1 of N per level-up (passive/active), replacing flat +5/+1.
- [ ] Level-up lets the player choose a stat (HP/ATK/DEF/speed/vision).
- [ ] Per-class active skill with a cooldown (charge over turns).
- **Acceptance:** two runs of the same class can diverge meaningfully by
  floor 5.

### Phase 10 — Survival & economy
*Depends on G5, G7.*

- [ ] Hunger + food (ration drops, cooking later).
- [ ] Gold drops, shop stock (Identify/Upgrade/Remove Curse, food, Ankh).
- [ ] Sell unwanted items; buy back sold items.
- [ ] Ankh (revival) + blessed Ankh (full heal on death).
- **Acceptance:** the player budgets food/gold across a region, not just HP.

### Phase 11 — Consumables & alchemy
*Depends on G3, G4 (alchemy pot tile).*

- [ ] Expand potions/scrolls to the full risk/reward set.
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

- [ ] `maxFloor` → ~25, split into themed regions (sewers → prison → caves →
      dwarven halls → demon halls), each with its own palette, enemy set,
      trap set and region boss.
- [ ] Difficulty/HP/ATK scale per region; introduce new enemies per region.
- [ ] Region-unique environmental hazards (e.g. gas vents in caves, lava in
      halls).
- **Acceptance:** a full run has a rising arc and distinct region identities.

### Phase 15 — SPD-style UI & inventory overhaul
*Depends on G6 (slots) and G8 (window system); pairs with Phase 6.*

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

---

## 6. Suggested sequencing

1. **G1 + G2 + Phase 5** — highest leverage: every later system wants status
   effects and a real combat model.
2. **G3 + G6 + G8 + Phase 6 + Phase 15** — the identification/curse/upgrade
   loop is the core of SPD's feel, and the backpack window replaces the
   sidebar inventory as soon as items exceed its space.
3. **G4 + Phase 7** — terrain makes positioning matter.
4. **Phase 8** — enemy identity makes all the above pay off.
5. **Phase 9 / 10 / 11** — build depth, survival, consumables.
6. **Phase 13 / 14** — replayability and run length, once systems are solid.
7. **Phase 12** — NPCs last; they're garnish on top of the systems.

## 7. Decisions & notes

- **Keep the existing visual style and turn engine.** These changes are
  mechanical, not presentational; the tile sprite approach already supports
  new tile/effect icons.
- **Turn manager stays poll-based** until an effect/event system requires
  otherwise; `isOver()` is already side-effect free, so this is safe.
- **Status effects tick on `refresh()`** (once per entity turn), which keeps
  the turn loop deterministic and testable.
- **Combat numbers move to `combat.ts`** so balance lives in one place and
  monster/hero classes only declare stats + resistances.
- **Unidentified items use `?potion`/`?scroll` names** in the log/inventory
  and reveal their identity on use — the core SPD risk loop.
- **`maxFloor` moves to region length (~25)**; the current `3` stays as the
  default only until Phase 14 lands.
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
