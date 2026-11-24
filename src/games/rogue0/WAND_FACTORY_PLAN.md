# Rogue0 — Wand Factory boss floor (floor 10)

Goal: turn floor 10 into the **Wand Factory**: a boss floor with its own
encounter, layout and win condition. It is a floor-5-sized single hall with two
animated steampunk machines, sealed until every hostile on the floor is dead,
guarded by a new enemy that throws fire potions after a three-turn telegraph.

## Agreed decisions (confirmed before writing this plan)

- Floor 10 **remains a boss floor** (`floor % 5 === 0`). Its boss encounter is
  the **Wand Factory**, not the Writhing Maw.
- Boss floors keep their shared rules: **no reinforcements**, no bone pile, no
  random loot, no cursed gem, hidden-room gold, two chests and one ration.
  (The standalone Cursed Gem has since been retired globally; its old wire ID
  now aliases to Gold so older saves still decode.)
- Boss floors will have **different boss types and different win conditions**.
  This plan introduces that abstraction and uses it for floor 10. The Writhing
  Maw is conceptually the floor-5 boss; floors 15/20/25 keep it as a legacy
  placeholder until their own encounters are designed, which is **out of
  scope** here.
- Floor 10's win condition is **"all hostiles cleared"**. The other boss floors
  keep the existing "boss slain" condition.
- The two machines are **decorative only**: no interaction, no saved
  per-machine state, no loot. They are recreated from the floor number on each
  floor setup.
- The fire-potion enemy is a **new monster type**, not a conversion of the
  goblin/cultist.
- The "potion of fire" is the existing **Potion of Liquid Flame** rule set
  (fire damage + `burning`). No new potion class or item is created.

Line references below reflect the source at the time of writing and are meant
as landmarks, not permanent line numbers.

---

## 1. Current state (source-audited)

### What "boss floor" means in code today

`isBossFloor(floor) = floor % 5 === 0` (`progression.ts:28-30`) is one boolean
that drives several unrelated behaviours:

- **Generation** — `mapgen.ts:18-20` `floorIsBossArena()` switches mapgen to a
  single hall (`1019-1103`), suppresses big chasms (`1027`) and chasm rooms
  (`87-92`), and returns its own `spawn`/`stairs`/`bossArena` overrides
  (`1467-1476`). The hidden gem branch is still carved (`1450-1465`).
- **Layout** — `bossArenas.ts:62-78` assigns floor 10 the 24×14 `LONG_HALL`;
  floor 5 is the 16×16, four-pillar `COLONNADE` (`47-60`).
- **Population** — `monsterBalance.ts:35-49` returns `{boss: 1}`;
  `scene0.ts:2080-2097` prunes bone pile, random loot and cursed gem, keeping
  only the boss, two chests, a ration and the hidden gold.
- **Reinforcements** — `scene0.ts:1245-1250` and
  `monsterReinforcements.ts:46-51` never repopulate a boss floor.
- **Seal** — `bossSealsFloor()` (`progression.ts:34-38`) is true until
  `bossesSlain.has(floor)`; gates chasm entry/falls (`dungeon.ts:44-50,680-717`)
  and descent, fall and red stairs (`scene0.ts:1096-1102,1145-1150,1405-1407,
  1914-1916`). `markBossSlain()` (`1227-1241`) records the floor and re-renders
  the stairs. `setupFloor()` has a legacy escape hatch (`1025-1031`): a boss
  floor with no `Boss` entity is instantly marked cleared.
- **Supply pacing** — `upgradeScrollsForFloor(10)` is already 0 because floor
  10 is position 5 of its band (`progression.ts:15,40-44`). No supply change.

Keeping floor 10 a boss floor therefore gives the factory hall, the sparse
loot policy, no chasm and no reinforcements **for free**. What must change is
the *boss identity*, its layout and its win condition.

### Rendering patterns already available

- Generated frame strips/atlas textures: `trapVisuals.ts:272-293`,
  `portalVisuals.ts:13-61`, `waterVisuals.ts:49-69`. Static textures:
  `Graphics.generateTexture()` via `potionTextures.ts:147-159`. All registered
  in `scene0.ts:401-420`.
- Time-driven animation: `portalFrame()` `portalVisuals.ts:7-11`,
  `waterFrame()` `waterVisuals.ts:12-16`, scrolling `TileSprite`
  `scene0.ts:1825-1850`. Presentation clocks never write
  `context.simulationTime`.
- Tile-anchored props are built/destroyed in `setupFloor()` and
  `clearFeatureSprites()` (`scene0.ts:1612-1625`) and cleared in the shutdown
  hook (`353-372`).
- `updateCursor()` (`scene0.ts:862-889`) already draws a red (`0xff6a6a`)
  bordered tile at depth 300 with FOV dimming. It is one player cursor, so the
  enemy's nine simultaneous targeted tiles need their own overlay in the same
  style.

### Enemy abilities today

- No multi-turn telegraph system exists. The closest pattern is the cultist's
  plain `summonCooldown` decremented in `turn()` (`cultist.ts:9,32-50`), which
  calls `waitWhileSleeping()` first and ends in `spendTime()`.
- `TurnManager.update()` (`turnManager.ts:39-124`) calls `actor.turn()` only on
  its scheduled action and stops if no time was spent (`121-122`). World-time
  effect ticks (`effectLifecycle.ts:24-39`) are wrong for a "three of *this
  monster's* turns" ability.
- Reusable: `potionSplash.ts:8-33`, `combat.ts:90-196`
  (`damageType: 'fire'`), `combatApplication.ts:24-51`, `effects.ts:120-132`
  (`createBurningEffect(12)`). The hero's flask-shatter loop is private
  (`basicHero.ts:851-898`).
- New monsters need wiring in `monsterBalance.ts`,
  `monsterReinforcements.ts`, `scene0.ts` and `saveRegistry.ts` (one permanent
  wire ID). Plain enumerable telegraph fields are saved by `saveCodec.ts`
  (`36-39`); no new save version.

---

## 2. Boss-encounter abstraction, layout and generation

### 2.1 Per-floor boss identity

Add a small pure module `bossEncounters.ts` (no Phaser, no scene imports):

```ts
type BossEncounterKind = 'maw' | 'wandFactory';
type BossEncounter = {
  kind: BossEncounterKind;
  layout: BossArenaLayout;
  win: 'boss-slain' | 'all-hostiles-cleared';
};

const BOSS_ENCOUNTERS: Readonly<Record<number, BossEncounter>> = {
  5:  { kind: 'maw',         layout: COLONNADE,      win: 'boss-slain' },
  10: { kind: 'wandFactory', layout: WAND_FACTORY,   win: 'all-hostiles-cleared' },
  15: { kind: 'maw',         layout: OCTAGON,        win: 'boss-slain' }, // legacy placeholder
  20: { kind: 'maw',         layout: CROSS,          win: 'boss-slain' }, // legacy placeholder
  25: { kind: 'maw',         layout: THRONE,         win: 'boss-slain' }  // legacy placeholder
};

bossEncounter(floor): BossEncounter | undefined;
isMawFloor(floor): boolean;
isWandFactoryFloor(floor): boolean;
hasLivingHostiles(context): boolean; // structural context, excludes friendly decoys
```

- `isBossFloor()` in `progression.ts` **stays `floor % 5 === 0`**. It is not
  declassified. All modules that currently ask "is this a boss floor?" keep
  asking exactly that for generation, sparse loot and reinforcements.
- `bossArenas.ts` keeps `BossArenaLayout` and the `pillarBlocks()`/`combined()`
  helpers. Replace the arithmetic `bossArenaLayoutIndex()` (`146-166`) with an
  explicit floor→layout table backed by `BOSS_ENCOUNTERS`, and add
  `WAND_FACTORY_LAYOUT` (`id: 'factory'`):
  `width 16`, `height 16`, four 2×2 pillars at hall-local `[1,1] [13,1]
  [1,13] [13,13]` — i.e. floor 5's outline and ten-tile central span. The
  unused `LONG_HALL` is removed.
- `mapgen.ts` needs **no change** to its hall/chasm/hidden-room logic: floor 10
  is still a boss arena. It only obtains its layout through
  `bossArenaLayout(floor)`, so `bossArenaRoom(80,50,10)` becomes the 16×16
  factory hall; `bossArenaSpawn()`/`bossArenaStairs()` still put the hero at
  the south edge and the stairs far east. Keep floor 10 out of floor 5's
  visible trap gauntlet (`1302-1319`).

### 2.2 Population

- `monsterBalance.ts:35-49` `floorMonsterRoster()` dispatches on
  `bossEncounter(floor)?.kind`:
  - Maw floors: unchanged `{boss: 1}` and nothing else.
  - Factory floor: a factory roster — **two** Fire Potion Throwers plus a few
    ordinary tier-2 guards (e.g. Skeletons/Goblins) for the "clear every
    enemy" win condition. Add `firePotionThrower` to `EncounterKind`,
    `MONSTER_XP`, `ScaledMonsterKind` and `PROFILES` so the XP forecast
    (`55-103`) keeps working; update its boss-floor expectations in tests.
- `scene0.ts:2080-2206`: for Maw floors keep the existing branch. For the
  factory floor: no `Boss` entity and no boss-footprint reservation; spawn the
  factory roster instead. The floor-wide sparse policy stays exactly as it is:
  `remainsCount = 0`, `itemCount = 0`, `cursedGemCount = 0`, `chestCount = 2`,
  `foodCount = 1`, hidden-room gold unchanged. Add the factory monsters to the
  `randomWalkableTiles()` budget (`2117-2127`) and to `spawnGroup()`
  (`2211-2225`).
- Machines are placed purely visually from hall-local coordinates; they do not
  become entities or terrain features and cannot be walked into or picked up.
- `setupFloor()`'s legacy escape hatch (`1025-1031`) must be narrowed from
  "boss floor with no Boss" to "**Maw** floor with no Boss". Otherwise floor 10
  (which intentionally has no `Boss`) would be marked cleared immediately. Add
  the matching factory rule: on restore, if floor 10 has no living hostiles,
  add 10 to `bossesSlain` so older/cleared saves stay open.
- Old saves: floor 10 may still contain a Writhing Maw. In `runPersistence.ts`
  hydration (`79-161`), drop a `Boss` entity located on floor 10; if that floor
  has no factory enemies, add 10 to `bossesSlain`. Already-visited floor 10
  saves keep their old long hall; the factory hall appears on freshly
  generated floors only.

---

## 3. Win condition and sealed stairs

- `progression.ts:34-38` `bossSealsFloor(context)` becomes a dispatcher over
  `bossEncounter(floor)?.win`:
  - `boss-slain`: unchanged — sealed iff `!bossesSlain.has(floor)`.
  - `all-hostiles-cleared`: sealed iff the floor is not in `bossesSlain`
    **or** `hasLivingHostiles(context)` is true. Keep both checks so a stale
    saved "cleared" flag cannot open a floor that still has enemies; once
    cleared there are no reinforcements, so the two agree in normal play.
  - Non-boss floors: false.
  - Structural context type gains optional `entities` (array of
    `{ type?, healthPoints?, friendly? }`); existing callers and the isolated
    fixtures need no change beyond the factory cases.
- `dungeon.ts:44-50` keeps its private mirror for isolated suites, extended
  with the same factory branch (defensive when a test context has no
  `entities`). It still gates chasm entry (`680-692`) and falls (`706-717`).
- `scene0.ts` keeps all existing `bossSealsFloor()` call sites
  (`1096-1102`, `1145-1150`, `1405-1407`, `1914-1916`) — only the *messages*
  become encounter-aware:
  - factory sealed stairs: "The factory's security grid is active. Clear every
    enemy to unlock the stairs."
  - factory descent/chasm denial: "The factory's security grid holds the way
    shut."
  - Maw floors keep their current wording.
- Unlocking: `handleMonsterRemoved()` (`scene0.ts:1222-1225`) branches by
  encounter:
  - Maw floors: `markBossSlain()` as today; floor 25 still wins the run.
  - Factory floor: after a real monster is removed, if
    `!hasLivingHostiles(context)`, add 10 to `bossesSlain`, log "The factory's
    security grid powers down. The way down is open.", and re-render the
    stairs. No `Boss` entity is involved.
- Reinforcements stay skipped automatically because floor 10 is still a boss
  floor — no new guard is needed, and the lock cannot become endless.
- `bossesSlain` therefore means "this boss floor's win condition is satisfied",
  not specifically "a Writhing Maw died". Update its comment in `context.ts`
  (`46-48`) and `runPersistence.ts` (`60-62`); validation already accepts any
  floor 1–25, so no save-format change.

---

## 4. The two decorative steampunk machines

New renderer-only module `wandFactoryVisuals.ts` (with pure pixel/frame helpers
so it can be tested without Phaser):

- **Flame distiller** — a riveted brass-and-copper cabinet anchored to one of
  the hall's pillar/wall cells, with pressure gauges and pipework. A glowing
  fire element feeds a copper pipe down one side; a nozzle drips liquid flame
  in a looping frame animation into an **empty** glass potion bottle on the
  other side. The bottle resets empty at the start of each loop.
- **Wand assembler** — a second riveted cabinet with gearwork and a
  steam-driven conveyor strip running to a wooden crate. A `TileSprite` belt
  scrolls via `tilePositionX` (positive offset pattern from
  `chasmVisuals.ts:26-28`); small wand sprites ride the belt and vanish into
  the crate on a fixed loop. Reuse existing wand texture keys; no new wand
  behaviour.

Integration rules:

- Generate textures in `create()`'s unconditional batch (`scene0.ts:401-420`).
- Build sprites in `setupFloor()` when `isWandFactoryFloor(floor)`; positions
  derive deterministically from hall-local coordinates. Machines are pure art:
  no map, path grid, FOV, inspect, save or gameplay-RNG changes.
- Clear them at the start of `setupFloor()` and in the shutdown hook alongside
  `clearWandFusionVisuals()`/`clearGasVisuals()`.
- Advance frames/belt offsets from a presentation clock in `update()`
  (`scene0.ts:738-805`), passing `isModalOpen(this.context)` as the pause flag
  like gas/grass visuals (`749-751`). Never write `context.simulationTime`;
  animation completion never lands an action.
- Depth below fog (world art), with FOV/visibility handled like `syncFeatures()`.

---

## 5. Fire Potion Thrower

### 5.1 Monster and state

- Add `monsters/firePotionThrower.ts` extending `Monster`, plus generated
  16×16 art in `monsters/firePotionThrowerTexture.ts` (brass-goggled factory
  worker holding a flame flask), registered in `scene0.ts:401-420`.
- `MonsterConfig` (`monster.ts:18-52`): `visionRadius` ~6, `range` ~6, normal
  movement/attack delay, XP from `MONSTER_XP`, stats from `PROFILES` (tier-2
  band). No new status effect: reuse `burning`.
- Plain enumerable fields (JSON-safe, saved automatically): `telegraphStage:
  0|1|2`, `targetX: number`, `targetY: number`, `abilityCooldown: number`. No
  Phaser objects or closures in those fields.

### 5.2 Three-turn attack (own scheduled turns only)

Override `turn()` following `cultist.ts:32-50`:

1. `waitWhileSleeping()` first — no ability while dormant/asleep.
2. **Turn 1 — centre marked.** If stage 0, cooldown 0 and the hero is visible
   within range/LOS (`ai.ts:49-80,96-106`), store the hero's tile, set stage 1,
   log a visible-only warning, `spendTime('attack')`, return.
3. **Turn 2 — ring marked.** Stage 1 → 2: keep the stored centre, add the
   eight Chebyshev neighbours (3×3 total), log the escalation,
   `spendTime('attack')`, return.
4. **Turn 3 — burst.** Stage 2 → resolve: throw liquid-flame flasks at the
   stored nine tiles; fire damage + `createBurningEffect(12)` to the hero if
   its footprint touches any of them, existing `onPotionSplash` fire overlay on
   all nine cells, and a short flask-sprite tween using the existing potion
   texture. Reset stage to 0, set a small cooldown in own turns,
   `spendTime('attack')`.
5. Otherwise fall through to `super.turn()` for normal pursuit/melee.
6. Marked tiles are **fixed at turn 1** — the hero can dodge out of the 3×3;
   losing sight mid-telegraph does not un-mark already-loosed flasks. Say so
   in the log/inspect text so the counterplay is readable.

Use `resolveAttack()` + `applyAttackResult()` with `damageType: 'fire'` so
elemental resistance (Ring of Elements) works and physical armor does not
absorb the burn; use `announceHit()`/`isEnemyVisible()`
(`combatFeedback.ts:24-64`) so unseen bursts never reveal the thrower by name.
Extract the victim/splash loop from the hero's private `shatterPotion()`
(`basicHero.ts:851-898`) into a small Phaser-free helper (e.g.
`fireSplash.ts`) shared by hero throws and this attack, rather than copying it.
Do **not** use `dungeon.igniteGrass()` — it spreads through whole grass patches
and is not the bounded potion splash. No new potion class.

### 5.3 Telegraph overlay

- New `targetTelegraphVisuals.ts`: scene-owned `Graphics` objects keyed by
  thrower entity. In `update()`, iterate throwers with an active stage and draw
  2 px `0xff6a6a` borders with a faint red fill at depth 300: centre only at
  stage 1; centre + eight neighbours at stage 2. Mirror `updateCursor()`'s FOV
  rule (`scene0.ts:881-888`) — only visible tiles, dim or skip unseen ones so
  the overlay never reveals the map.
- Clear on stage reset, monster death, floor change (`setupFloor()`) and scene
  shutdown. The overlay is derived from entity fields, so restoring a save
  mid-telegraph redraws it automatically; no new save field.

### 5.4 Registration

- `bossEncounters.ts` / `monsterBalance.ts`: new `EncounterKind`, XP, profile
  and factory roster count; `monsterReinforcements.ts`: add the kind to the
  union (it will not spawn there — factory floors are boss floors and get no
  reinforcements).
- `scene0.ts`: import the class, add generated art, add roster budget and
  `spawnGroup()`, and a `reinforcementActor()` case for completeness.
- `saveRegistry.ts:140-158`: one permanent semantic ID, e.g.
  `monster:fire-potion-thrower`. `scenario.ts` picks it up via the registry, so
  the dev panel can place one for manual testing.
- Optional: a `musicCue` entry in `musicState.ts:8-22`.

---

## 6. Work order

1. **Boss-encounter abstraction + layout** (§2.1): per-floor kind/win
   condition, factory layout, `bossArenaLayout(10)` change. Keep `boss-arena`
   and `terrain-pressure` suites green.
2. **Factory population + win condition** (§2.2, §3): roster, sparse content,
   narrowed legacy guard, seal dispatcher, unlock logging and save migration.
   Keep `progression`, `stairs`, `monster-balance`, `save` suites green.
3. **Machines + telegraph overlay** (§4, §5.3) with visual suites.
4. **New enemy + fire splash helper** (§5.1-5.2, §5.4) with monster/save suites.
5. **Docs + full verification** (§7-8).

Separate commits per step keep regressions easy to localise.

---

## 7. Tests

### New suites (runner auto-discovers `scripts/test-rogue0-*.mjs`)

- `test-rogue0-wand-factory-floor.mjs`
  - Floor 10 **is** a boss floor; `bossEncounter(10).kind === 'wandFactory'`
    and `.win === 'all-hostiles-cleared'`; floors 5/15/20/25 stay Maw
    (`boss-slain`).
  - Hall is 16×16 with floor-5's four pillars; south entry, far-east sealed
    stairs, hidden gem room; no chasm, no floor-5 trap gauntlet.
  - Roster contains the Fire Potion Throwers and no `Boss`; floor still has
    **no** bone pile, random loot or cursed gem, but keeps two chests, a ration
    and hidden gold.
  - `bossSealsFloor()` true while any hostile lives (including a sleeping one
    or dormant mimic), false after the last kill; descent/chasm fall denied
    while sealed and allowed afterward; stairs re-rendered; no reinforcements.
  - Legacy floor-10 `Boss` entity is dropped on load; save round-trip of
    `bossesSlain` containing 10.
- `test-rogue0-fire-potion-telegraph.mjs`
  - Real `TurnManager`: stage changes **only** on the monster's own turns —
    repeated `update()` without a ready actor and world-time upkeep
    (`refresh()`/`tickEffects()`) must not advance it.
  - Sleep gate; visible/LOS gate; stored centre + eight neighbours; one-shot
    burst damaging/burning the hero; dodging out of the 3×3 avoids damage;
    unseen burst logs stay generic.
  - Telegraph fields survive `encodeGraph`/`decodeGraph`; wiring audits
    (roster, spawn, registry ID, generated art).
- `test-rogue0-wand-factory-visuals.mjs`
  - Generated texture keys; machine sprite counts/positions; drip frame and
    belt `tilePosition` advance with a synthetic clock; pause under a modal;
    no `Math.random` or `simulationTime` mutation; teardown on floor change and
    shutdown; telegraph border colour/geometry and FOV clipping.

### Existing suites to update

- `boss-arena`: still five boss floors and five distinct layouts, but floor
  10's layout is now the 16×16 factory plan (`bossArenaLayout(10).id ===
  'factory'`); update its floor-10 geometry and source-wiring assertions.
- `terrain-pressure`, `floor5-traps`: floor 10 remains a boss hall; trap
  expectations unchanged, but add the factory layout case where layouts are
  iterated.
- `progression`: `bossSealsFloor(10)` now depends on live hostiles (not just
  `bossesSlain`); floor-10 content allow-list gains throwers but still excludes
  remains/loot/cursed gem; floor-10 "boss slain" case becomes "factory cleared".
- `stairs`: keep the local boss-seal mirror but add the factory-hostile case;
  verify floor 10 locks with a live thrower and unlocks on the last kill.
- `monster-balance`, `monster-behavior`, `reinforcements`, `monster-art`:
  new kind, XP/profile, factory roster, save-registry audit, generated art.
- `equipment-finds`: no change expected — floor 10 is still excluded — but run
  it to confirm the sparse policy.
- `save`, `scenario`: legacy floor-10 Maw removal and the new registry ID.
- `trap-visuals`, `chasm-visuals`: these slice `scene0.ts` from `featureVisual()`
  to `makeArrowTexture()`; if new helpers land inside that range, restructure
  their stubs. Add npm shortcuts in `package.json` for the three new suites.

### Verification commands

Per `AGENTS.md`, use focused runs during development and the full suite before
finishing:

```bash
npm run test:rogue0 -- boss-arena progression stairs monster-balance reinforcements equipment-finds save
npm run test:rogue0 -- wand-factory-floor fire-potion-telegraph wand-factory-visuals
npm run test:rogue0
npm run build
npm run lint
```

Failures are recorded with cause and resolution in the final report (game bug
vs test bug vs environment); `logs/rogue0-tests.jsonl` is never rewritten.

---

## 8. Documentation and manual check

- `README.md`: add "Wand Factory (floor 10)" and "Fire Potion Thrower"
  sections; document that boss floors now have per-floor encounter types and
  win conditions, that floor 10 is sealed until every hostile dies, and that
  the Writhing Maw is the floor-5 boss (legacy on 15/20/25 until replaced).
- `PLAN.md`: update the boss-floor section with the new encounter registry and
  the factory's telegraphed attack; keep the Maw's missing phases noted.
- Manual browser check via the dev scenario harness: floor 10, place a
  Fire Potion Thrower, confirm the sealed red stairs, watch turns 1/2/3 and
  the machine loops, kill every enemy and confirm the unlock, then save and
  reload mid-telegraph to confirm borders and stage resume.
- No new save version: gameplay state is either derived (seal, visuals,
  telegraph borders) or plain serializable monster fields plus the existing
  `bossesSlain` set.

## 9. Risks to watch

- **Legacy auto-clear guard:** `setupFloor()` must not treat the factory's lack
  of a `Boss` entity as "boss slain". Narrow it to Maw floors.
- **`bossesSlain` semantics:** it now means "boss floor cleared by its own win
  condition"; the factory check must still require zero living hostiles so a
  stale flag cannot open a live fight.
- **Old floor-10 saves:** drop the legacy Writhing Maw there, but do not
  retroactively reshape an already-visited floor.
- **World-time vs own turns:** the telegraph counter lives in `turn()`, never
  in an effect tick or animation callback.
- **Reinforcements:** keep the existing boss-floor skip — adding waves would
  make the factory's "all hostiles cleared" condition unreachable.
- **Phaser 4:** no `setMask` in WebGL; use `setCrop` or per-tile sprites and
  FOV-clip overlays rather than masking them.
