
Implementation of the game from the book [Roguelike Development with JavaScript](https://link.springer.com/book/10.1007/978-1-4842-6059-3) 

Deployed [here](https://hidden-smoke-7075.fly.dev/games/rogue0/rogue0)

## Development boundaries

- `combat.ts` resolves attack attempts and rolls damage. `combatApplication.ts`
  owns successful-hit application: damage, invisibility, shock-water contact,
  statuses, victim reactions and death cleanup. Normal attacks and wands use
  it. Thrown objects are not attacks: only consumables splash their contents
  onto a target, and a thrown weapon, armour or tool never rolls damage.
  Presentation/curse/arc hooks remain explicit;
  this extraction does not change which attack kinds trigger weapon curses or
  physical-hit reactions. Damage overrides and bonus damage are parameters,
  not temporary replacements of hero methods/stats.
- `inventory.ts` owns pickup/stacking, equipment, dropping, removal and curse
  cleansing. It imports only types; `heroInventory.ts` supplies runtime effects,
  logging and presentation. `BasicHero` delegates through its existing methods,
  while equipment/backpack/quickslot fields stay on the hero so v1 save layout
  and reference identity are unchanged. No controller is stored in saves.
- `itemPresentation.ts` handles shared dropped/thrown-item sprites and cleanup.
  `heroViewModel.ts` formats status/health displays without Phaser or mutation.
  The active `ui.ts` HUD reads current state each frame; the uncalled legacy
  sidebar and its `createUI`/`refreshUI` machinery have been removed from heroes.
  Item changes no longer call into hero-owned UI objects.
- `heroInput.ts` routes keyboard/touch input and owns runtime subscriptions.
  Rebinding a hero is idempotent; scene shutdown detaches its handlers without
  removing other listeners. `heroNavigation.ts` owns manual/automatic movement
  policy, threat interruption, starvation checks and chasm confirmations.
  `heroTargeting.ts` owns inspect/aim modes and visible wand-target selection.
  These modules take explicit services/actors and import no Phaser runtime.
  `heroControls.ts` caches runtime wiring by run context, including its terrain
  readers, and `HeroControlHost` defines the hero facade. Queues, pursuit and
  aiming state are still reset on browser load; no controller object is saved
  and no new save ID is introduced. Projectile impact and
  terrain/scheduler execution remain outside these input modules.
- `turnManager.ts` exports a renderer-independent `TurnManager` class with
  explicit effect/logging services. Each `Scene0` owns its own scheduler clock,
  next upkeep tick and known-actor set; there is no active scheduler singleton.
  Floor travel preserves that scene's clock. Resume installs saved time/tick,
  rebuilds actor membership, then restores exact deadlines/readiness. The v1
  save fields stay unchanged; scheduler instances and services are not saved.
- `terrain.ts` owns independent active-floor overlays. `terrainFor(context)`
  associates a stable store with each run through a weak runtime-only registry;
  there is no active-run pointer or shared feature map. `tiles.ts` now contains
  only types and presentation. Floor snapshots copy feature records both ways
  and retain the v1 format, including legacy reusable teleport traps.
  Visibility helpers take an explicit optional terrain argument (omitting it
  means a bare map). AI, combat, gas, hero controls, movement and scene rendering
  use the owner's overlay; spawn selection also takes terrain explicitly.
  Dungeon maps, path grids, layers and callbacks are still singleton-owned, so
  this is not yet support for two complete rendered games side by side.
- `runPersistence.ts` owns typed floor/run snapshots, decoding, validation and
  v1 compatibility repairs. `Scene0` still owns Phaser lifecycle, checkpoint
  timing, rendering and floor transitions. Restoring actors must not rerun
  constructors or reapply status bonuses.
- `saveRegistry.ts` is an explicit table of **permanent wire IDs**. Existing
  path-looking IDs are historical constants, not computed filenames. Moving a
  class changes its import, never its ID. Keep aliases for older saves; give new
  classes semantic IDs.
- `scripts/lib/rogue0-logic-loader.mjs` is the shared compatibility harness for
  isolated suites that still inject fakes. It parses imports with TypeScript
  rather than deleting them with a regex. Compiled source is cached per process,
  but each evaluation gets fresh module state and injected dependencies; editing
  source invalidates the cache. It is not an integration test.
  New renderer-independent boundary tests import complete modules normally.
  These tests use native TypeScript imports (Node 22.18+ or Node 24+).

Run `npm run test:rogue0` for all headless suites, or
`npm run test:rogue0:combat` for the shared combat pipeline and
`npm run test:rogue0:inventory` for the inventory, item presentation and HUD view
boundaries. `npm run test:rogue0:controls` covers input lifecycle, buffering,
movement costs, pursuit, starvation/chasm safety and targeting.
`npm run test:rogue0:monsters` covers the full monster roster, and
`npm run test:rogue0:deadly-frog` covers its damage/death gas, poison immunity,
art, depth-gated spawns and save wiring.
`npm run test:rogue0:scheduler` covers interleaved runs, reset/resume deadlines,
actor membership, fractional terrain/effect events, item upkeep, pauses and the
per-frame event budget. All scheduler tests (including the legacy movement,
monster, item, gas and frost suites) now import the complete module directly.
`npm run test:rogue0:terrain-core` covers independent overlays over the same base
map, FOV/LOS, grass cover, optical overrides, grid/spawn filtering, trap policies,
and detached save snapshots. It imports complete production modules directly.
Legacy terrain/FOV fixtures also use those modules through the compatibility
adapter; the log, monster, swarm and progression suites now share its AST loader.
Test history is appended automatically.

Further incremental work: separate projectile resolution and scene rendering,
replace the remaining isolated source loaders, and move dungeon map/grid/layer
and terrain-change callbacks to run-owned state. Save
field selection also remains graph-based; changes to persisted fields still
need compatibility handling.

## Maintaining the tests

Use focused suites while editing, then the full suite before finishing:

```bash
npm run test:rogue0 -- --list                 # discover suites, no execution
npm run test:rogue0 -- movement vision        # exact suite names; no hidden dependency selection
npm run test:rogue0 -- save frost-potion      # focused run, includes startup timing
npm run test:rogue0:store                    # store group
npm run test:rogue0                          # all suites, each in its own process
npm run test:rogue0 -- --fail-fast            # optional; default reports all failures
npm run test:rogue0:history -- --summary
```

The runner discovers `scripts/test-rogue0-*.mjs`, rejects unknown names before
running anything, never retries a failure, and exits nonzero if any selected
suite fails. It logs one result per process, including syntax/import failures
before test initialization. `test-tooling` verifies selection, logging and
classification with isolated, explicitly labelled verification fixtures.

`logs/rogue0-tests.jsonl` retains suite results. New runner results include a
`runId`, `batchId` and `timingScope: "process"` (startup/imports included).
`logs/rogue0-test-batches.jsonl` records elapsed batch wall time and per-suite
results, including failures and suites not reached with `--fail-fast`. Batch
timing starts inside the runner; it excludes npm/runner startup. Existing
single-suite npm shortcuts and direct `node scripts/test-rogue0-….mjs` commands
still log in-process timings. Those and older history exclude static imports;
do not sum them to estimate command wall time. Killing the runner itself can
prevent final records from being written.

To record a diagnosed failure, use its ID from the runner output or full history:

```bash
npm run test:rogue0:history -- classify <failure-id> test-bug "Incorrect fixture; corrected its expected state."
```

Categories are `game-bug`, `test-bug`, `environment`, `intended-change`, and
`unknown`. Include evidence and the resolution, or say explicitly that it is
not yet fixed. Classifications append to
`logs/rogue0-test-classifications.jsonl`; correcting one appends another record,
with the latest annotation used for reports. The original failure is never
rewritten, removed, or converted to a pass. Older records get stable IDs without
migration. Undiagnosed history stays unclassified rather than being guessed
from exception types. All three history files are local and git-ignored.

- Keep regressions for player-visible behavior, state ownership, save compatibility
  and rendering lifecycle. A suite with no recorded failures is not automatically
  redundant; history counts executions, not unique bugs or coverage.
- Import production modules directly when they work without Phaser. The hero
  animation/status overlays, wand projectile visuals, dungeon theme and found
  upgrade rules do this; use the shared AST loader only for legacy fake-boundary
  tests. Neither those fakes nor source-text smoke checks prove browser wiring.
- Prefer rendered output and state assertions to matching source text. Inventory
  and quickslot suites check actual icon texture/frame/tint; item-upgrades owns
  floor item presentation, not duplicate UI source checks.
- For weighted choices, test exact boundaries against independently specified
  expected outcomes rather than copying production weights or sampling thousands
  of rolls. Chest rewards cover every slot; opening behavior runs once per reward
  category. Found-upgrade cases assert weapon and armor classes separately.
- Run `npm run test:rogue0` after changes. For deliberate broken-code checks, set
  `ROGUE0_TEST_PURPOSE=mutation` (or `verification`) and keep the appended history.
  Real browser reload/Continue and Phaser scene lifecycle are not covered by
  these headless suites; check those manually when changing save/resume wiring.

## Browser saves

One run is autosaved in this browser's local storage (`rogue0.run.v1`). The title
screen offers **Continue** when a save exists, or **New Game** and hero selection.
Choosing a new hero replaces the old run; cancelling the selection keeps it.
The game menu's **← back** button returns to Rogue0's own start screen (the
in-game menu, not the site home) and flushes the same checkpoint, so it then
offers **Continue**. Only the start screen's **← back to home** link leaves the
game. Death and victory clear the run.

Saves retain the hero, inventory/equipment/quickslot references, upgrades, talents,
identified consumables and shuffled appearances, active status effects, scheduler
clock/deadlines, and every visited floor (map, terrain, explored cells, enemies,
loot and gas). No time elapses while the game is closed. UI dialogs, targeting
and buffered movement are deliberately not resumed.

The scene checkpoints completed actions, checks free inventory/UI changes every
250ms, and flushes on page hide, backgrounding and navigation. If a browser is
closed mid-animation, the last complete checkpoint is used rather than a partial
attack or item drop. Save data uses versioned, permanent class IDs (retaining all historical
file/export IDs), not minified class names or executable code. Effects restore their local callbacks
without reapplying stat bonuses. Storage failures display a warning and retain
the previous save; invalid/incompatible saves offer a new-game recovery path.
Clearing site data removes the save. Saves are local, not account/cloud synced;
play a run in one tab at a time.

Regression tests: `npm run test:rogue0:save` (also in `npm run test:rogue0`).

## Treasure chests and mimics

Newly generated floors contain two real treasure chests (separate from the mimic
encounter on floors 2+). Walk into a chest using movement keys, or tap it to walk
over and open it. Opening takes one use-action turn without moving the hero;
its reward appears on the floor for normal pickup, even if the backpack is full.
Chests cannot be carried. Each chest contains gold, a ration, a healing potion,
or floor-tier equipment, rolled once when the chest is generated. Equipment is
uncommon: gold takes nine of eighteen rolls, rations four, the rare Potion of
Healing a single roll, and a weapon and armor two each.
Contents and opened state persist through travel and browser saves. Previously
visited floors are not repopulated with new chests.

## Healing potions and swarms of flies

The dungeon has exactly one healing potion. **Potion of Healing** restores 80% of
the hero's maximum health plus 14, paid out over the next ten world-time ticks,
and immediately cures non-permanent debuffs (burning, poison, bleeding, chilled,
crippled, weakened, blinded, rooted, confused, terrified). The amount is capped
to the health missing when the flask is drunk, so it never banks a delayed full
heal, and unspent healing resumes after a save/load.

Swarms of flies are its reliable source: every killed swarm has a **33%** chance
to drop one, and flies drop nothing else. Floor generation keeps the potion
rare — one weighted random-loot entry (weight 1) and one slot in eighteen for
chests — so a level almost never hands one out on its own. The two legacy
Minor Heal Potion and Full Heal Potion classes were folded into it; old saves
still load those items as the one Potion of Healing.

Mimics stay dormant until attacked or damaged. Their stats now scale across the
five dungeon regions: 32–64 HP, 14–30 damage, 1–3 protection, and 6-tile vision.
Legacy 4-HP mimics in browser saves are upgraded once while preserving existing
damage and provocation state.

## Glyph stones

Each tall-grass tile the hero tramples has a **12%** independent chance to hide a
glyph stone. The find is **not** taken automatically: it stays on the flattened
tile with a log message, and the hero picks it up by stepping off that tile and
back onto it, like any other item lying on the floor. A full backpack therefore
does not need special handling. Monsters flatten grass too, but only the hero
disturbs the hidden stones. Every glyph stone is one-use and is consumed when it
takes effect.

- **Stone of Blink** is thrown (its inventory **Use** action starts throw
targeting). On landing, the hero teleports to that exact tile. It follows the
normal thrown-item rules: the destination must be in line of sight and walls
block it. A living actor in the path stops the stone like any other thrown item;
the hero is carried to the last clear tile *before* that actor, never around or
past it. If the stone falls into a chasm, it is consumed and the hero descends
to the next floor unharmed, set down at a random walkable location (on the final
floor there is no floor below, so the stone vanishes and the hero stays put).
- **Stone of Detect Curse** uses the normal item-target picker. Choose one
unidentified carried item and the stone reports whether it is **cursed** or
**free of curse**, then is consumed. It does **not** identify the item; its
inventory description keeps a glyph-stone warning only if the item is cursed.
The inventory cell shows the known curse colour until the item is identified normally.

Glyph stones stack like other consumables and persist through browser saves.
Regression coverage is `npm run test:rogue0:glyph-stones`, also part of
`npm run test:rogue0`.

## Ground equipment and skeletal remains

Every newly generated non-boss floor has an independent **10%** chance of one
extra weapon or armor on the ground (equal chance of either). This supplements
existing weighted loot and guaranteed progression gear. Every fifth floor is
excluded from this bonus roll. Bone piles are the main equipment source, so all
armor and weapons found outside them — this bonus roll, random floor loot and
chest rewards — are a third as likely as before. Finds use the existing
depth-based tier spread, +0–+3 found-upgrade rolls and normal curse chance, and
start unidentified. The
weapon/armor type and tier are recognizable, but the upgrade level is shown as
`?` until the item is identified — by a Scroll of Identify, or by extended use
(thirty landed attacks for a weapon, thirty blows taken for armor). Equipping
reveals only the curse status: cursed gear locks onto the slot immediately,
while its named curse and upgrade level stay hidden until identification.
Unidentified artifacts show their real names and normal flavor descriptions, but
hide their upgrade level (`?`) and curse status until learned. Rings keep even
their type hidden while worn.

Each non-boss floor also contains one **Skeletal Remains** bone pile. Walk or
tap-to-walk into it to search, spending one use-action turn without moving.
Every pile holds one weapon or armor. If that find is cursed, an awake Wraith
rises from the pile as well; non-cursed finds never summon one. Loot stays on
the ground, including with a full backpack, and the Wraith guards its tile
until it moves or is defeated. Contents and haunting are rolled once at
generation and saved; searching, reloading or revisiting never rerolls them or
replenishes searched piles. Existing visited floors are not retroactively
populated.

The ground-equipment odds live in `equipmentFinds.ts`; the shared one-third
non-remains gear scale also feeds the random loot table and chest rolls.
Regression coverage:
`npm run test:rogue0:equipment-finds` and the progression suite.

## Ring upgrades

Unidentified rings apply their passive while worn but keep their type and `?`
upgrade level secret. Equipping reveals only whether the ring is cursed. Thirty
world-time ticks worn, or a Scroll of Identify, reveals the ring type and its
upgrade level. Artifacts follow the same rule.

Each ring kind draws a different coloured gem, and the ring-to-gem-colour
mapping is shuffled for every run exactly like potion colours. The gem stays
visible before and after identification, all copies of a kind share it, and the
assignment is stored with the run's consumable appearances, so saving and
resuming never reroll it. Generated artwork lives in `ringTextures.ts`; the
assignable keys are `RING_APPEARANCES` in `entity.ts`.

Ring bonuses scale with upgrade level and update immediately while equipped:

| Ring | Level 0 | Gain per upgrade |
| --- | --- | --- |
| Accuracy | +5 accuracy | +5 accuracy |
| Evasion | +5 evasion | +5 evasion |
| Elements | +2 fire/ice/shock resistance | +1 to each |
| Haste | 2× movement speed | +0.5 to the multiplier |
| Might | +1 Strength | +1 Strength |

Only equipped rings grant passives. Removing a ring removes its actual applied
bonus, not an outdated or newly upgraded amount. Haste rings multiply together
and with temporary Haste; they never accelerate attacks. Loading an older save
reconciles already-upgraded rings automatically without consuming another scroll.

## Wand identification

Wand identity is shared across the whole run, like potion and scroll knowledge.
Every copy of a wand type has the same stable gibberish label, independent of
charges, upgrades and floor location; the four wand types have distinct labels.
Identifying or thirty successful zaps of one copy reveals all existing and future
copies of that type; an unidentified wand shows `?` for its upgrade level. Other
types remain unknown, and a new run starts with no discoveries.
Browser saves retain shared knowledge. Older saves also recover knowledge from
identified wands in the backpack or on any visited floor without adding log spam.

## Wand targeting

All wands have no distance cap, including wands in older browser saves, and
wands can be aimed **past the edge of sight** (darkness, fog and an unlit room
never gate a zap). A zap only needs an in-bounds destination and a straight
path free of walls, closed doors and secret doors; tall grass and chasms do not
stop the bolt, and the first actor in the projectile path intercepts the shot.
Ordinary thrown items also have no distance cap, but still require an in-bounds,
non-wall destination in line of sight. Tapping the aiming wand again cancels
target selection instead of firing; only the target tile (or Enter) fires.
Charges and action costs are unchanged.

Hits on monsters outside sight stay audible without leaking information. A
damaging unseen hit logs **“You hear a cry of pain in the distance.”** and a
lethal one adds **“, then silence.”**; a death with no preceding hit is
**“You hear a death cry in the distance.”** Misses and absorbed hits use distant
impact cues, and an unseen victim's name, exact damage, floating damage number,
loot and death message are never shown. Tall grass concealment counts as
outside sight, and status-effect damage ticks follow the same rule.

## Throwing is not attacking

A thrown object is never a melee or ranged attack. Weapons, armour, rings,
scrolls, food and tools deal **no damage** to any monster — a thrown axe bounces
off a mimic exactly like it bounces off a goblin. No combat roll, accuracy
check, resistance, critical, on-hit effect or weapon curse applies. The target
does notice the impact (a dormant mimic wakes up), the object lands on the
impact tile, and an arrow plate under it still fires.

Only consumables act on a target: potions splash their contents (frost chills,
flame burns, gas poisons) and are used up. Wands are separate — using one starts
a zap that does roll combat damage. To hurt something with gear, equip the
weapon and attack normally.

## Wand of Blast

A utility wand found in dungeon loot and shops. Each zap spends one charge and
pushes the first hostile target up to **5 tiles, plus 1 tile per upgrade level**
(+1: 6 tiles, +2: 7 tiles, etc.), with no direct damage or accuracy roll. Displacement resolves at bolt impact, one tile at a time.
Walls, closed doors and map edges stop the push, deal **3 impact damage** (ignoring
armor), and stun for **three scheduled actions**. Other actors stop it without
damage or a stun, and rooted actors stay anchored.
Diagonal shots push diagonally. A grounded enemy crossing a chasm dies through
normal death/XP handling; its loot lands at a random safe location on the floor
below (or is lost beneath the final floor). Flight/levitation prevents falling.

Firing at an adjacent enemy also pushes the hero by the same upgrade-scaled
distance in the opposite direction, even if the enemy dies. Recoil can deal impact damage and stun against a wall or
queue the normal player chasm fall, with landing damage handled downstairs.
Stun has its own HUD icon, survives saving, and can be cured by healing.
Upgrades increase both push distance and charge capacity. Fusion increases
charge capacity but does not further multiply push distance. Stun duration
remains three actions.

## Lightning wand arcs

The Wand of Lightning arcs from a struck enemy into every living actor
adjacent to it (cardinally or diagonally), including airborne creatures and the
hero. Adjacent arc damage is **`ceil(primary damage × 1.5)`**, reduced by shock
resistance and increased by shock vulnerability; physical armor does not apply.

If the target is standing in water, shock also reaches every grounded creature
in the same cardinally connected pool, including the hero, for `ceil(primary
damage / 2)` before shock resistance/vulnerability. Dry ground, ice, walls and
separate pools break water conduction; flying/levitating avoids water damage,
but not direct adjacent arcs. Adjacent creatures receive only the stronger arc,
not an additional water hit.

Animated electrical bolts travel from the struck target to secondary victims
when the primary bolt impacts, including on a lethal primary hit. Secondary
bolts are hidden outside visible tiles. Arcs do not chain recursively, never
hit the primary target a second time, and add no extra action cost or charge use.

## Wand fusion

Throwing a Potion of Liquid Flame onto the floor immediately to the **right** of
two wands laid horizontally fuses them into one stronger wand. The pair must be
adjacent, on the floor and the same wand type; the splash does not reach through
a gap or across a diagonal. A failed attempt only shatters the flask.

The two wands may sit at different upgrade levels and different fusion powers.
Fusion power is additive, so two ordinary wands (×1) become ×2, a ×2 wand fused
with an ordinary one becomes ×3, and a ×4 fused with a ×2 becomes ×6. Upgrade
levels combine by keeping the higher one.

The surviving (right-hand) wand keeps the higher upgrade level, combines both
wands' remaining charges, and scales its damage range and maximum charges by the
new multiplier. Two full three-charge wands therefore become one six-charge
wand at ×2 damage. Its name and description show the multiplier.
The merge plays a short fire/slide/pop animation with a matching procedural
sound (fire crackle, two pitch glides meeting, then a chime as the merged wand
appears). Sound follows the visible animation, so an off-screen merge is silent.
Animation never advances world time or changes action deadlines, and it honours
the game's mute setting. Fusion power is stored in browser saves. An ordinary
single wand remains the default when loading older saves.

## Passive wand recharge

Every carried wand recovers one charge per 20 elapsed world-time units, up to
its maximum. Upgrading a wand adds +1 to both its current and maximum charges.
Wands recharge independently in the backpack; quickslot assignment
is not required. Waiting advances recharge, but idle frames, open menus and time
away from the game do not. Floor items do not recharge. Partial progress survives
floor travel, dropping/picking up and browser saves; time spent on the ground is
not counted. Full wands cannot bank progress. Scroll of Recharging still refills
immediately and clears partial recharge progress.

## Action-time scheduling

Heroes and monsters share a discrete-event timeline, inspired by Shattered Pixel
Dungeon. Each actor has a `nextActionTime`; the earliest actor acts next. Fractional
costs accumulate without rounding. Ties give the hero priority, then preserve
entity order. Waiting for player input or an animation does not advance game time.
Items are not actors. There are no movement/action-point pools.

Current Rogue0 action costs (normal action = 1 time unit):

| Action | Cost |
| --- | --- |
| Move, including pickup on the destination tile | `armorStrengthPenalty / movementSpeed` |
| Attack, hit or miss | Equipped weapon's `attackDelay × weaponStrengthPenalty` |
| Use item, throw, equip/unequip, drop, wait | 1 |
| Open a closed door (in place; step through next action) | 1 |
| Search | 2 |
| Invalid action, inspection, open backpack | 0 |

Search (`s`, the Search button, or a second press of the magnifying glass)
reveals nearby hidden traps and secret doors. It never disarms traps, including
on repeated searches. Inspecting a trap remains free. Item-based disarming is
only a possible future mechanic. Generated frost, teleport and alarm traps are
reusable; dart, fire, arrow, summon, geyser and confusion traps are single-use. Searching
never changes their activation policy. Monsters avoid revealed (armed) traps
during ordinary navigation, but confusion overrides that caution and they may
stumble onto a plate.

**Inspect** (`x`, or the magnifying glass) is free and never spends a turn.
Moving the cursor over a visible tile describes it; hidden traps still read as
"Stone floor." When a tile holds several things the dialog lists them all —
items, monsters and the terrain itself — and each entry has its own detail view,
so a scroll lying on a trap no longer hides the trap. Tiles with nothing beyond
plain floor skip the terrain entry, so a lone item still opens directly. Tapping
a row chooses it; number keys `1`–`3` choose a row on the current page.

**Chasms:** move into an adjacent chasm with a direction key or tap its tile.
An “Are you sure?” confirmation warns about the fall before committing.
Accepting drops you into the next floor, costs movement time, and deals
`ceil(max HP / 3)` damage on arrival, ignoring armor; final-floor falls are
fatal. Cancelling is free. Rooted heroes cannot step into chasms; levitating
heroes cross safely. While a boss floor's guardian still lives, the seal also
prevents entering its chasms, so the boss cannot be bypassed by falling.
Auto-walk routes still avoid chasms. There is no Jump button or `v` shortcut.

Items also fall in: a thrown item, a stack dropped in mid-air, and the loot of a
monster killed by the fall all land at a random walkable spot on the next floor
down instead of being destroyed. Falls on the final floor are still permanent.

There is **no player shove ability**. `dungeon.knockback(context, target, dx, dy)`
is an effect-level primitive for one cardinal tile of forced movement, with no
extra victim action cost. Grounded actors pushed into chasms fall; levitating
actors remain aloft. The existing floor-fall path handles player transitions
outside the scheduler; monster falls use normal death removal. Forced collisions
with walls, closed doors or map edges deal 3 impact damage to either side, once
per push, using normal death handling. Actor blockers and roots cause no damage.

**Geyser traps** are the first push-producing effect. Grounded players and
monsters activate them on entry; items and levitating actors do not. The blast
pushes one tile in the direction of entry (horizontal for diagonal entry), can
chain into another geyser, and preserves landing-terrain contacts. Blocked or
rooted victims stay on the plate, but the trap is still spent. Geysers deal no
direct damage and cost no extra action time; wall collisions deal the same 3
impact damage (without a stun), and chasm landings use normal fall rules. Generated geysers are single-use and share the existing hidden-trap
budget. Search only reveals them, and floor snapshots preserve spent state.
**Confused** lasts four elapsed world-time units. Movement attempts choose a
random cardinal neighbor without rerolling unsafe choices. Walls, closed doors
and actors block a stumble but still cost movement time; roots prevent attempts.
Chasms can cause accidental falls unless the actor is levitating. Keyboard,
auto-walk and enemy movement/fleeing use the same rule. Deliberate attacks
and aiming stay unchanged. Stumbles do not automatically pick up loot,
and player stumbles cancel auto-walk and buffered commands. Single-use confusion
traps affect grounded players and monsters and share the existing trap budget;
levitation bypasses them and search reveals without disarming.

Normal actors move at speed 1. Ghouls move at speed 2 but attack at normal speed.
Haste doubles movement speed only; cripple halves it; chilled halves both the
movement and the attack rate (each move/attack costs double time, and haste
cancels it exactly). Rooting prevents movement
but permits attacks and other actions. Frozen actors lose one scheduled action;
terrified monsters flee on their own scheduled actions, not in buff tick callbacks.
Weapons default to attack delay 1; axes take 1.25 and war hammers 1.5. These are
Rogue0 balance values, not a claim to reproduce SPD's entire item/balance table.

Frost traps are reusable and now hit twice: one skipped action (Frozen) plus
**Chilled** for 10 world-time units (roughly five slowed moves), applied even
when the frozen-recovery window blocks a second freeze. **Frost affects
monsters too**: a monster zapped by the Wand of Frost, splashed by a thrown
frost potion, or stepping onto a frost plate (including a confused stumble) is
frozen *and* chilled, so it moves and attacks at half rate through the same
action-cost path the AI uses. Frost plates stay armed after a monster triggers
them; fire, dart, teleport, summon and alarm plates remain player-only, and
levitation still bypasses all pressure plates. Re-entry refreshes the slow
rather than stacking it. Chilled shows an ice icon in the status column under
the hero portrait, is described in the character modal ("Moves and attacks at half speed"),
and covers the hero sprite in a translucent ice sheen with frost crystals —
drawn as a separate overlay so low-health red, hit-flash white and invisibility
alpha still work. The overlay follows movement, the walking bob and scaling,
and it clears on expiry, death, floor change and scene shutdown.

## Status icons

Every active effect gets a square icon directly under the hero portrait in the
top-left corner (28 px box, 24 px drawn art, 4 px gap, up to 16 slots), newest
first in effect order. Each icon shows its remaining turns in the bottom-right corner (`∞` for
curses and artifact auras that never expire) and its tooltip repeats the number
with the effect's description. Icons wrap into a second column when the stack
would reach the message strip, and only a viewport too small for one row hides
them. Every effect has its own drawn 24x24 icon in `statusIconTextures.ts`
(authored on a 12x12 grid, doubled into 2x2 blocks so it stays crisp at 1:1);
before that the HUD borrowed tilesheet glyphs, and several statuses shared the
same frame. Status names, durations and descriptions are formatted by
`statusDurationLabel`/`describeEffect`, so the icon badge, tooltip and
character modal always agree.

Hunger and regeneration tick per elapsed world-time unit. Buffs keep their own
tick phase (a two-time-unit buff applied at 0.5 expires at 2.5). Faster movement
does not accelerate hunger or poison. Floor changes preserve the clock and buff
timing.

Poison clouds add independent fractional terrain events to this same scheduler:
a Toxic Gas cloud expands one cardinal ring per unit up to a radius-3 diamond,
then expires from its outer edge inward, fading as it goes. Exposure sustains
Poisoned for at least 2 units without postponing its damage phase; expiry wins
ties with a cloud pulse. Clouds are separate from ground features, affect
levitating actors too, and pause with inactive floors. Rendering only displays
visible clouds; it never advances their lifetime.
The **Deadly Frog** (floor 4 onward) uses this system as its signature
ability: every damaging hit it survives vents a cloud on its tile, and its
death releases one final cloud. The frog is immune to poison but not to fire
or steel, so killing it from range still leaves gas where it died.
Animation durations and frame rate never determine logical action costs.

Food drops by 0.25 per world-time unit. Fed (30–100 Food) heroes naturally
recover 1 HP every 3 units, capped at maximum HP. Hungry (0 < Food < 30) heroes
neither naturally heal nor take hunger damage. Starving (0 Food) heroes lose
1 HP per unit. Eating stops starvation immediately; natural healing resumes
once Food is at least 30 (evaluated after that unit's food drain). Potions and
magical healing are unaffected. These are SPD-inspired states with Rogue0
balance values, not an exact reproduction of SPD. Entering a floor does not heal.

## Ranged monsters and melee fallback

Goblins and cultists are ranged. Goblins fire barbed arrows up to 5 tiles for
4 damage plus 3 turns of bleeding. Cultists hurl necromantic bolts up to 5
tiles for 4 damage (no bleeding) and still raise skeletons. When a target is
**adjacent** (Chebyshev distance 1, including diagonals) they cannot use their
ranged attack and switch to a sidearm: 2 damage, a normal melee lunge animation,
no arrow bleeding and no bolt. Closing the distance therefore cuts the damage
the ranged attacker deals in half and stops the goblin's typed bleeding.

The sidearm is configured per monster via `MonsterConfig.meleeDamage`. Any
monster with `range > 0` opts into the fallback automatically; when the value
is missing (e.g. an older browser save restored without the field) the melee
strike derives `max(1, round(attackDamage / 2))`. Monsters with `range = 0`
are untouched: `meleeAttack()` returns their full primary damage.

## Floor population and reinforcements

A floor is never allowed to become empty of hostile monsters. When a death
removes the last living monster (items, corpses and friendly mirror images do
not count), the scene immediately draws a small wave — two to four monsters,
weighted from the regular roster for the current depth but never the Bone Lord.
The one exception is a **boss floor** (5, 10, 15, 20, 25): it is the guardian's
arena, so it is never repopulated — killing the guardian leaves the floor empty
and the way down open. The wave joins the current action timeline and is always
placed outside the
hero's field of view, on free walkable tiles at least 8 tiles away when such
unseen space exists. Floors are far larger than the view radius, so the full
wave fits out of sight; within unseen space, distant tiles are chosen first.
Only a degenerate map with no unseen walkable tile falls back to visible tiles,
so the floor still cannot stay empty. This means the floor is repopulated in
some other part of the map rather than on top of the corpse, the stairs or the
hero's view. Reinforcements are ordinary
saved entities: descending, ascending or reloading preserves them, and a
restored floor that was already empty (for example from an older save) is
refilled on arrival.

## Chasm rooms and levitation

Some floors hide a **chasm room**: an 11-15 tile chamber whose interior is a
two-tile walkable band around a two-tile moat, with a treasure island in the
middle. The island has no land route to the band — only levitation (or flight)
crosses the moat — and it holds a treasure chest. The band carries the floor's
guaranteed **Potion of Levitation**, unidentified like any other potion, lying
beside the moat.

The early dungeon teaches the rule: a run gives its chasm room to **one** of
floors 1, 2, 3, 4, 6, 7, rolled at random when the run starts and stored in the
run save. That floor always generates the room; the floors above it never do,
and floors below it roll one only 5% of the time. Those early floors never roll
levitation as ordinary loot — the room's potion is the only one they carry.
From **floor 8** on levitation can also be found as ordinary floor loot
whether or not that floor's room spawned. Boss floors are a single arena and
never have one. Random content,
monsters, reinforcements and loot dropped from the chasm above keep out of the
room, so the island stays the chest's; the walkable band remains part of the
floor network.

While the hero is levitating, the status column under the portrait shows the
levitation icon with its remaining turns (tap it for the same number plus
"Floats over chasms and ground hazards"), the character modal lists
`Levitating (n)` under **Effects**, and an air overlay draws below the soles:
five pale downdraft streaks, a lit line under the soles and four puffs sliding
outward, on a fixed 640 ms loop. Like the fire and ice overlays it is a
separate Graphics object, so the hero's own tint and invisibility alpha are
untouched; it follows movement, the walking bob and scaling, takes no gameplay
RNG, and clears on expiry, death, floor change and scene shutdown
(`heroLevitatingVisuals.ts`).

## Run length and equipment progression

A run has **25 floors**. Floors **5, 10, 15, 20 and 25** are boss floors, each
guarded by the Bone Lord. Their stairs are sealed until that floor's guardian
dies, and slaying the floor-25 guardian ends the run in victory.

A boss floor is not a room network: map generation carves a single **arena
hall** behind a border of solid rock, with the guardian asleep at its exact
centre. Each boss floor builds its **own hall** (`bossArenas.ts`), so the five
guardians are fought in five different rooms: a 16x16 **pillared rotunda** on
floor 5 (four 2x2 pillars exactly 10 tiles apart), a 24x14 **long colonnade**
on floor 10, an 18x18 **octagonal sanctum** on floor 15, a 20x20 **cruciform
vault** on floor 20 and a 20x20 **throne hall** ringed by eight piers on floor
25. The hero always arrives at the south edge, across the hall from the
guardian, and the sealed stairs wait in the farthest eastern corner. Every
hall keeps its middle, its entrance and its exit clear. The arena is the guardian's alone: no
wandering roster (skeletons, goblins, ghouls, brutes, Quloptsh, swarms, mimics,
cultists, elementals, wraiths, frogs), no random floor loot, no cursed gem, no
chasm, no bone pile and no summon trap. What it does carry is the guardian, two
treasure chests, one ration and the hidden room's gold above the north wall;
grass, water and the
other hidden traps still dress the hall. The guardian naps until disturbed — a
wound, a noise, the hero stepping within two tiles in its line of sight, or a
long dormancy running out — so a careful approach earns the first strike. The
scaled guardian art is anchored to its tile and its 3×3 body stops the hero
outside the artwork, so nobody can stand underneath it; taps anywhere on that
art target the guardian. The floor is never repopulated after the guardian
falls. The old five-floor limit
was for testing.
Themed regions and later-region enemy scaling are still future work; ordinary
enemy counts stop growing after floor 5.

Heroes start with **10 Strength**. Strength potions permanently add one Strength,
not attack. XP still grants +5 max HP / +1 attack; talents are not implemented.
Physical equipment requires `8 + 2 × tier` Strength. Upgrades reduce that
requirement at +1, +3, +6, +10, … (minimum 0). For each missing point, weapons
multiply attack time by 1.2 and divide accuracy by 1.2; armor multiplies movement
time by 1.2 and divides evasion by 1.2. Meeting the requirement removes penalties.
Wands and utility items are exempt. Status/hunger clocks remain world-time based.

Dungeon equipment spans tiers 1–5: Dagger through Greataxe and Cloth through
Plate Armor. Tier and upgrade level are independent. Found armor, weapons and
wands may generate plain or upgraded at +1, +2 or +3 — never higher (70/20/8/2%
of finds). Scrolls of Upgrade can still push an item beyond +3.
Weapon damage at tier `t`,
upgrade `u` ranges from `t + u` to `5t + (t + 1)u`; armor absorbs `2t + tu`.
The playable hero is the **Warrior**, who starts with a basic Sword equipped;
the disabled class picker's Wizard starts with a tier-1 Dagger plus two scrolls
(Fireball, Lightning) and a Potion of Healing in the backpack; the scrolls
are weapon-slot items, so equipping one swaps it in for the dagger. Class
starting gear otherwise retains its previous stats. Armor replaces a shield in
the same slot. Upgrade scrolls support the new gear. Armor now has
distinct generated textures for each tier; weapon art remains a placeholder
using the existing sword silhouette.

Each five-floor band guarantees two Strength potions (floors 2/4 within the
band), three upgrade scrolls (1/3/4), a band-tier weapon (1), and armor (3).
The scroll layout is strictly deterministic: three per region, 15 per run, and
zero on boss floors (5/10/15/20/25) — no RNG roll can change it, and a cramped
map falls back to fixed placement instead of dropping the quota. That is
**10 Strength potions and 15 upgrade scrolls** across the run; neither appears
as extra random floor loot, and no other source upgrades gear. The hidden room
that appears once per band (floors 5, 10, 15, 20 and 25) holds gold. Random equipment normally matches its band but
can be one tier earlier
or later. Floor snapshots preserve remaining loot, so revisits do not refill it.
These are initial progression curves, not a claim of full-run balance.

Run all headless regressions with `npm run test:rogue0`; run the focused
progression checks with `node scripts/test-rogue0-progression.mjs`.

```mermaid
classDiagram

    class dungeon{
      initialize()
      isWalkableTile()
      moveEntityTo()      
    }

    class GameContext{
        Phaser.Tilemaps.Tilemap map
        Phaser.Scene scene
        PlayerCharacter player
    }

    class Scene0{
        create()
        update()
    }

    class PlayerCharacter{
        number nextActionTime
        Phaser.Types.Input.Keyboard.CursorKeys cursors 
        number x
        number y
        number tile
        boolean moving
        Phaser.GameObjects.Sprite sprite
        GameContext context
    }
    
    class Skeleton{
        number movementSpeed
        number x
        number y
        number tile
        boolean moving
        Phaser.GameObjects.Sprite sprite
        GameContext context
    }

    class turnManager{
        number time
        number nextTick
        reset()
        update()
    }
    
    class Entity{
        number movementSpeed
        number attackDelay
        number nextActionTime
        boolean actionReady
        spendTime()
        number x
        number y
        number tile
        boolean moving
        Phaser.GameObjects.Sprite sprite
        GameContext context
    }
    
    Entity <|-- PlayerCharacter
    Entity <|-- Skeleton

```
