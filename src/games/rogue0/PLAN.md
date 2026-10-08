# rogue0 — Improvement Plan

A turn-based, tile-based roguelike (Phaser 3 + React), ported from
*Roguelike Development with JavaScript*.

## Current state

- 5 hero classes (Warrior, Dwarf, Cleric, Elf, Wizard)
- 2 monster types (Skeleton, Quloptsh)
- 14 item types (weapons, scrolls, potions, shield, gems, shoe)
- 1 handcrafted 80×50 floor
- Turn manager driven by per-frame polling + tween flags
- Sidebar UI listing every entity + an 8-message log

## Known bugs

- `BerserkPotion.isOver()` has side effects and is called every frame by
  `turnManager._isOver()`, so its "10 turns" duration elapses almost instantly.
- `turnManager._refresh()` sets `entityIndex = 0` inside the `forEach`.
- `dungeon.removeEntity()` duplicates `entity.removeEntity()` (dead code).
- Two near-duplicate potions: `healingPotion.ts` (full heal) and
  `healthpotion.ts` (heal 3–5).
- All files use `@ts-nocheck`; some type-only imports are non-relative.

## Roadmap

### Phase 0 — Quick wins & bug fixes

- [ ] Fix the BerserkPotion frame-rate bug
- [ ] Fix `turnManager._refresh` entityIndex placement
- [ ] Remove dead `dungeon.removeEntity`
- [ ] Consolidate the two potion files
- [ ] Re-enable TypeScript (drop `@ts-nocheck`, fix imports)

### Phase 1 — Make it a real game

- [x] Stairs + multi-floor progression
- [x] Procedural floor generation (floors 2+)
- [x] Win state (escape at the bottom)
- [x] Class selection screen
- [x] Proper death/victory screen (floor reached + kills)
- [ ] Field of view / fog of war (deferred to Phase 2)

### Phase 2 — Combat & AI depth

- [ ] Monster variety (ranged, chaser, bruiser, boss)
- [ ] Enemy behaviors (patrol, flee, alert allies)
- [ ] XP / leveling or per-floor stat progression
- [ ] Enemy health bars + floating damage numbers

### Phase 3 — Feel & presentation

- [ ] Audio (steps, hits, potions, death sting)
- [ ] Juice (hit flash, screen shake, particles, item glow)
- [ ] HUD overhaul (HP bar, floor #, turn count)
- [ ] Mobile controls (virtual D-pad + tap)

### Phase 4 — Meta & architecture

- [ ] Save/load via localStorage + high-score table
- [ ] Event-driven turn manager (remove `isOver()` side effects)
- [ ] Cache pathfinding grids instead of rebuilding per entity per turn

## Phase 1 decisions

- Floor 1 keeps the original handcrafted map; floors 2+ are procedurally
  generated (rooms + corridors).
- `maxFloor = 3` (configurable in `context.ts`). The stairs on the final floor
  are the exit.
- Stairs are rendered as a `▼` text label (green on the exit floor).
- Hero selection and the end screen are React components, consistent with the
  rest of the site.
- The sidebar now shows only the player panel + message log (no more full
  entity list).
