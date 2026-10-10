# rogue0 — Improvement Plan

A turn-based, tile-based roguelike (Phaser 3 + React), ported from
*Roguelike Development with JavaScript*.

## Current state

- 5 hero classes (Warrior, Dwarf, Cleric, Elf, Wizard) via a React class picker
- 6 monster types: Skeleton, Quloptsh, Archer (ranged), Ghoul (2 moves/turn),
  Brute (tanky), and the Bone Lord (floor boss)
- 15 item types: swords, axe, bow, hammer, shield, gems, scrolls, potions, shoe
- Floor 1 is the handcrafted 80×50 map; floors 2+ are procedurally generated
- `maxFloor = 3`; stairs descend, and the final floor's stairs are the exit
- Field of view / fog of war (radius 7; unseen = black, remembered = dimmed)
- Enemy AI: chase on sight, investigate last-known position, idle wander,
  ranged attacks, and multi-move support
- Inspect: hover (any turn) or the Inspect button + click/tap (any turn)
- Visual juice: hit flash, impact particles, item glow, death fade, drawn
  staircase, distinct tiles for every entity (no tint-only distinctions)
- Dark-themed React UI (picker, end screen, game wrapper) with pixel fonts

## Known issues

- `BerserkPotion.isOver()` has side effects and is called every frame by
  `turnManager._isOver()`, so its "10 turns" duration elapses almost instantly.
- All files still use `@ts-nocheck`; type safety is effectively off.
- Potion naming is confusing: `healingPotion` (full heal) vs `healthpotion`
  (heal 3–5).
- The turn manager is still poll-based, with `isOver()` side effects driving
  turn advancement (fragile; see Phase 4).
- Pathfinding grids are rebuilt per entity per turn (works, but wasteful).

## Roadmap

### Phase 0 — Quick wins & bug fixes

- [x] Fix `turnManager._refresh` entityIndex placement
- [x] Remove dead `dungeon.removeEntity`
- [ ] Fix the BerserkPotion frame-rate bug
- [ ] Rename/clarify the two healing-potion files
- [ ] Re-enable TypeScript (drop `@ts-nocheck`, fix imports)

### Phase 1 — Make it a real game

- [x] Stairs + multi-floor progression
- [x] Procedural floor generation (floors 2+)
- [x] Win state (escape at the bottom)
- [x] Class selection screen
- [x] Proper death/victory screen (floor reached + kills)
- [x] Field of view / fog of war

### Phase 2 — Combat & AI depth

- [x] Monster variety (archer, ghoul, brute, boss)
- [x] Enemy behaviors (last-known-position pursuit + idle wander)
- [x] Inspect command (hover / Inspect button)
- [ ] Enemy alert allies / flee
- [ ] XP / leveling or per-floor stat progression
- Health bars / floating damage numbers — intentionally skipped (use inspect)

### Phase 3 — Feel & presentation

- [x] Audio (steps, hits, potions, death sting, victory/game-over, stairs, equip, mute toggle)
- [x] Juice (hit flash, impact particles, item glow, death fade)
- [~] HUD overhaul (floor # + status panel + stats done; HP bar / turn count pending)
- [ ] Mobile controls (virtual D-pad + tap)

### Phase 4 — Meta & architecture

- [ ] Save/load via localStorage + high-score table
- [ ] Event-driven turn manager (remove `isOver()` side effects)
- [ ] Cache pathfinding grids

## Decisions & notes

- Floor 1 keeps the original handcrafted map; floors 2+ are procedurally
  generated (rooms + corridors).
- `maxFloor = 3` (configurable in `context.ts`).
- Stairs are drawn as narrowing steps (cyan; green on the exit floor).
- Hero selection and the end screen are React components, consistent with the
  rest of the site.
- The sidebar shows the floor #, player panel (stats + inventory), an inspect
  status panel, and the message log.
- FOV: player vision radius is 7; monsters only act with line-of-sight; ranged
  attacks require line-of-sight.
- Inspect is a UI action (mouse/touch only): hover anytime, or toggle the
  Inspect button and click/tap a tile. No keyboard inspect.
- Screen shake was removed by request; hit flash + particles remain.
- Audio is procedural (Web Audio API, no files); toggle via the Sound button.
