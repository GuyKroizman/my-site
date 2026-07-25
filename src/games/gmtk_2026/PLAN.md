# GMTK 2026 — Game Plan

> **Working Title:** *Seasons of Life* (tentative)  
> **Engine:** Phaser 3 (Arcade Physics)  
> **Genre:** Narrative Side-Scrolling Action / Metaphorical Platformer  
> **Platform:** Desktop (mouse + keyboard)  
> **Jam:** GMTK Game Jam 2026

---

## 1. Elevator Pitch

A single-player side-scroller where the protagonist ages in one direction only: forward. As you move right through the world, you physically grow older—your sprite, tileset, abilities, and companions all change. You begin as a child shielded by parents, lose their protection, life's challenges on the way right and finally reach the end of the road where you fight your last battle before resting.

The background music weaves together excerpts from Vivaldi's *The Four Seasons*, shifting as you age.

---

## 2. Core Loop

1. **Move right** to progress through life (the world scrolls left as you advance).
2. **Combat / Survive** enemies that appear in each life stage.
3. **Reach aging thresholds** at specific world-X coordinates to advance to the next life stage (new tileset, new abilities, new music segment).
4. **Go left** freely (explore, retreat from danger), but **you never get younger**.
5. **Reach the final screen** as the oldest version of yourself, fight until defeated, and fall into the grave—this is the intended ending.

---

## 3. Aging System (One-Way)

Aging is tied to **world X-position** and is strictly irreversible.

| Stage | Approx. X Range | Age Name | Tileset | Companions | Combat Ability |
|-------|-----------------|----------|---------|------------|----------------|
| 1 | 0 – 1,200 | Childhood | child-tiles | Parents (fight for you) | None—only move & jump |
| 2 | 1,200 – 3,000 | Youth | teen-tiles | None | Basic attack (melee) |
| 3 | 3,000 – 5,500 | Adulthood | adult-tiles | To be designed | Ranged attack + dodge |
| 4 | 5,500 – 7,500 | Middle Age | middle-tiles | To be designed | Stronger melee, slower |
| 5 | 7,500 – 9,000 | Elderly | elder-tiles | None | Fragile, but wisdom-based mechanic? |
| 6 | 9,000+ (final screen) | Twilight | elder-tiles | None | Final stand—no healing |

- **Trigger:** Crossing an X-threshold instantly swaps the player's sprite/tileset and unlocks the next stage's mechanics.
- **Visual Transition:** A brief dissolve / flash / particle effect to signal the passage of time.
- **Going Left:** Allowed for tactical retreat, but the stage never reverts. Enemies behind you may despawn to save performance.

---

## 4. The "Parents" Introduction

- At **X = 0 to ~1,000**, the player is a small child.
- Two parent NPCs flank the player.
- **Player can only:** move left/right.
- **Parents automatically:** attack nearby enemies.

### The Departure (First Narrative Beat)

- At **X ≈ 1,000–1,200**, a scripted event occurs:
  - The path forks: the player continues right along the main road, while the parents veer onto a parallel route (e.g., up a gentle hill, or down a sloping path).
  - The parents do not stop—they keep walking their own path, still firing at distant enemies until they scroll completely off-screen.
  - The player crosses alone. **Stage 2 (Youth) begins.**
  - The music shifts from *Spring* to *Summer*.

---

## 5. Future Event Slots (To Be Designed)

The plan reserves space for 2–3 additional narrative beats between Stage 2 and Stage 5. Each beat should:

- Occur at a specific X-coordinate.
- Introduce or remove a mechanic, companion, or environmental hazard.
- Be accompanied by a music transition.

**Example ideas (not final):**

- **First Love (Stage 2→3):** A companion joins temporarily, then leaves.
- **Parenthood (Stage 3→4):** A child NPC follows you for a segment; you must protect them.
- **Loss (Stage 4→5):** An environmental event (storm, fire) changes the tileset palette and removes all companions.

---

## 6. Final Screen & Ending

- **Location:** X ≥ 9,000 (or whatever the final screen coordinate is).
- **Visual:** A bleak, minimal landscape. A single grave is visible at the far right edge.
- **Gameplay:** Enemies spawn continuously. The player (elderly) can still fight but has very low health and no healing.
- **Inevitability:** The player cannot win. Eventually, health reaches zero.
- **Death Animation:** The elder sprite kneels, lies down, and dissolves downward into the grave tile.
- **Fade to black.**
- **Credits roll** over a slowed, somber rendition of *Winter*.

**Message:** Death is not failure; it is the natural end of the journey.

---

## 7. Music Design (Vivaldi — The Four Seasons)

Use short, looping excerpts from public-domain recordings or MIDI renditions.

| Life Stage | Season | Mood | Trigger |
|------------|--------|------|---------|
| Childhood | *Spring* (1st mvt) | Cheerful, innocent | Start of game |
| Youth | *Summer* (1st & 3rd mvt) | Energetic, tense | Parents leave |
| Adulthood | *Summer* (3rd mvt) / *Autumn* (1st mvt) | Driven, busy | Stage 3 threshold |
| Middle Age | *Autumn* (2nd & 3rd mvt) | Melancholic, slower | Stage 4 threshold |
| Elderly | *Winter* (1st mvt) | Sparse, cold | Stage 5 threshold |
| Final Stand | *Winter* (2nd mvt — Largo) | Beautiful, resigned | Final screen |
| Credits | *Winter* (2nd mvt) solo | Somber, peaceful | After death |

- **Crossfade** between segments at stage boundaries.
- **Tempo** may slightly increase with enemy intensity, or stay fixed for emotional contrast.

---

## 8. Art & Asset Plan

### Player Sprites (per stage)

Each stage needs a distinct sprite sheet (idle, run, jump, attack, hit, death).

1. `player_child.png` — small, colorful, maybe holding a toy.
2. `player_teen.png` — lanky, energetic.
3. `player_adult.png` — confident, balanced proportions.
4. `player_middle.png` — slightly heavier, slower animations.
5. `player_elder.png` — hunched, cane or walking stick, fragile.

### Parent NPCs

- `parent_mom.png`, `parent_dad.png` — protective stances, each wielding a large ranged weapon (e.g., oversized rifle or energy cannon). They easily fend off enemies thanks to high damage output and satisfying muzzle flash / projectile effects.

### Tilesets (per stage)

Each stage has a 16×16 or 32×32 tileset for ground, platforms, background layers, and props.

1. `tiles_childhood.png` — bright greens, flowers, playgrounds, picket fences.
2. `tiles_youth.png` — open fields, schools, streets.
3. `tiles_adulthood.png` — cities, offices, construction.
4. `tiles_middle.png` — autumn forests, houses, rivers.
5. `tiles_elderly.png` — snow, bare trees, stone paths, gravestones.

### Enemies (thematic per stage)

- Childhood: Shadowy abstract shapes (fears) that parents blast away with their guns before they ever reach the player.
- Youth: Bullies, wild animals.
- Adulthood: Rats, thugs, paperwork monsters (abstract).
- Middle Age: Tax monsters, health issues (abstract).
- Elderly: Time itself (clock-faced spirits), decay.

### Background Parallax Layers

- 3–4 layers per stage, shifting in color palette to match the season.

---

## 9. Technical Architecture

Following the existing site patterns (see `src/games/hoot/` and `src/games/theMask/`).

### File Structure (proposed)

```
src/games/gmtk2026/
├── PLAN.md                 # This document
├── scenes/
│   ├── BootScene.ts        # Preload all assets
│   ├── GameScene.ts        # Main gameplay scene
│   └── DeathScene.ts       # Final fade + credits
├── entities/
│   ├── Player.ts           # State machine for age + input handling
│   ├── Parent.ts           # AI companion for Stage 1
│   └── Enemy.ts            # Base enemy class + variants
├── systems/
│   ├── AgingSystem.ts      # Tracks X-position, triggers stage changes
│   ├── CombatSystem.ts     # Hitboxes, damage, knockback
│   └── MusicSystem.ts      # Crossfades Vivaldi segments
├── data/
│   ├── stages.ts           # Stage definitions (X ranges, tilesets, abilities)
│   └── enemies.ts          // Enemy spawn tables per stage
├── assets.ts               // Asset manifest / keys
└── types.ts                // Shared interfaces
```

### React Page Wrapper

`src/pages/Gmtk2026.tsx` — mounts the Phaser game, handles menu overlay, back-to-home link, and mobile block (desktop-only).

### Routing

Add to `src/components/arcade/cabinetData.ts`:

```ts
{
  id: 'gmtk-2026',
  emoji: '🍂',
  title: 'Seasons of Life',
  subtitle: 'Side-Scroller Life Journey',
  description: 'A GMTK 2026 entry. Grow older as you move right, from childhood to the grave.',
  path: '/gmtk-2026',
  color: '#8b5cf6',
  availability: 'desktop',
}
```

### Level Data Structure

To place decorative graphics (grass, sun, trees, rocks, distant mountains, etc.) independently of the player-aging sprites, the world is divided into a 2D grid.

- **Cell size:** 64×64 world pixels.
- **World width:** 10,000 px → **157 columns** (0–156).
- **World height:** viewport height (≈ 768 px) → **12 rows** (0–11).
- **Ground row:** **row 0** is the ground surface. Higher rows extend upward into the sky.
- **World position:** `x = col * 64 + 32 + offsetX`, `y = groundTop - (row * 64 + 32 + offsetY)`.
- **Sparse:** empty cells mean nothing is placed there.

#### Layers

There is a separate 2D array per visual depth / parallax speed:

| Layer | Parallax | Purpose | Examples |
|-------|----------|---------|----------|
| `sky` | very slow | farthest backdrop | sun, moon, clouds, distant mountains |
| `background` | slow/medium | midground scenery | hills, city silhouettes, forests |
| `ground` | 1:1 | gameplay floor + props | grass tufts, rocks, ground tiles |
| `foreground` | 1:1 (overlays player) | near-camera details | nearby trees, fences, signs |

#### Cell Contents

Each non-empty cell contains a **list** of objects. An empty cell is `null` or `[]`.

```ts
interface LevelObject {
  type: string      // e.g. 'grass', 'sun', 'tree-1', 'rock-2'
  scale?: number    // default 1
  rotation?: number // degrees, default 0
  offsetX?: number  // pixel offset within the cell, default 0
  offsetY?: number  // pixel offset within the cell, default 0
  flipX?: boolean
  tint?: number
}
```

World position of an object:
- `x = column * 64 + 32 + offsetX`
- `y = row * 64 + 32 + offsetY`

Example cell:
```ts
[ { type: 'tree-1', scale: 1.2, offsetX: -10, offsetY: 0 } ]
```

#### Why 64×64 cells?

- Fine enough for individual grass tufts and rocks (with sub-cell `offsetX/Y`).
- Coarse enough that a 157×12 grid is manageable as data.
- Power-of-two size fits Phaser texture conventions.
- Multiple objects per cell allow clusters without increasing grid resolution.

#### Authoring

The array can be:
- Hand-written in segments (e.g. `childhood-level.ts`, `adult-level.ts`) and concatenated at runtime.
- Generated from a small visual editor or CSV/JSON export.
- Kept in a dedicated `src/games/gmtk2026/data/levels/` directory.

---

### Debug Configuration

Two ways to debug are supported:

1. **URL parameters** (currently implemented) — useful for quick browser tests and sharing specific starting states.
2. **A code-level `DEBUG` config object** (planned) — useful for persistent debug settings during development.

#### URL parameters

Add `?stage=<stage>&x=<x>` to the game URL:

- `stage` — one of: `baby`, `young-adult`, `adult`, `adult-plus`, `middle-aged`, `middle-ager`, `elderly`
- `x` — optional starting X coordinate

Examples:
- `/gmtk-2026?stage=young-adult` — start as young-adult
- `/gmtk-2026?stage=middle-aged&x=6000` — start as middle-aged at X=6000

The React page parses these, stores them on `window.__GMTK2026_DEBUG`, and `BootScene` passes them into the game scene.

#### Code-level DEBUG object (planned)

A single exported config object in `src/games/gmtk2026/data/debug.ts` (or `config.ts`) allows jumping to any point in the game for rapid iteration. This file is **not** exposed to players and should be reset to defaults before any build.

```ts
export const DEBUG = {
  /** Skip to a specific life stage on boot (0 = Childhood, 5 = Twilight). */
  startStage: 0,

  /** Override the player's starting X position. Ignored if -1. */
  startX: -1,

  /** Start with invincibility. */
  godMode: false,

  /** Draw hitboxes, stage boundaries, and spawn zones. */
  showDebugGraphics: false,

  /** Disable music for faster reloads. */
  muteMusic: false,
} as const;
```

**Usage examples:**

- `startStage: 2` — Boots straight into Youth with the teen sprite, melee attack unlocked, and parents already gone. The player is placed at the Stage 2 threshold X.
- `startStage: 5, startX: 9100` — Starts at the final screen near the grave to iterate on the death sequence.
- `godMode: true` — Health never drops; useful for testing level layouts and stage transitions without combat friction.

**Implementation notes:**

- `BootScene` reads `DEBUG` and passes it into the game registry (`this.game.registry.set('debug', DEBUG)`).
- `AgingSystem` checks the registry on init: if `startStage > 0`, it immediately calls `Player.enterStage(startStage)` and teleports the player to `stages[startStage].entryX` (or `startX` if overridden).
- Parent NPCs are spawned conditionally: they only appear if `startStage === 0`.
- Debug graphics are rendered in a dedicated `DebugRenderSystem` that runs only when `showDebugGraphics` is true.
- A bright **DEBUG MODE** watermark is drawn in the top-right corner of the screen whenever any non-default flag is active, preventing accidental shipping.

---

### 💡 Engine Tips for Phaser 3

**Additive Glows:** Use Phaser's `blendMode: 'ADD'` on secondary flare / light particles (like fire, magic slashes, muzzle flashes, or eye trails) layered over your character sprite. This creates a high-energy neon glow without needing custom shaders.

**Sprite Tinting:** When taking damage or gaining a power-up, use `sprite.setTint(0xff0055)` to give that high-contrast neon flash feeling. Reset with `sprite.clearTint()` once the effect duration ends.

---

### Key Systems

#### AgingSystem

- Monitors `player.x` every frame.
- On crossing a threshold:
  - Calls `Player.enterStage(nextStageId)`.
  - Notifies `MusicSystem`.
  - Triggers camera shake / flash.
- Stores `currentStageIndex` persistently for the session.

#### Player State Machine

```
States: idle, run, jump, attack, hurt, die
Stages: child, teen, adult, middle, elder
```

- Stage determines available states (child has no `attack`).
- Stage determines sprite sheet and physics body size.

#### Camera

- Smooth follow on the player.
- Dead zone so small movements don't jitter the view.
- World bounds expand as the player advances (or one large world from the start).

---

## 10. Controls

| Input | Action |
|-------|--------|
| A / D or ← / → | Move left / right |
| Space | Jump |
| J or Z | Attack (when unlocked) |
| K or X | Special / Dodge (when unlocked) |
| Escape | Pause |

---

## 11. UI / HUD

- **Top-left:** Current life stage name (e.g., "Childhood", "Adulthood").
- **Top-center:** Life bar (health). Color changes with stage.
- **Top-right:** Distance traveled / progress bar toward next stage.
- **Bottom-left (Stage 1 only):** Small parent icons indicating they are present.
- **Pause Menu:** Resume, Restart, Back to Arcade.

---

## 12. Milestones

### Phase 1 — Skeleton (Day 1)

- [ ] Project scaffold (`src/games/gmtk2026/`)
- [ ] Phaser boot + game scene running in React page
- [ ] Basic tilemap with first tileset
- [ ] Player movement (move + jump)
- [ ] Camera follow

### Phase 2 — Parents & Childhood (Day 1–2)

- [ ] Parent NPCs that follow and attack
- [ ] Child player (no attack)
- [ ] First enemy type
- [ ] Departure event at X ≈ 1,200
- [ ] *Spring* music loop

### Phase 3 — Youth & Combat (Day 2)

- [ ] Stage 2 threshold + teen sprite
- [ ] Player melee attack
- [ ] Second tileset + enemies
- [ ] *Summer* music loop

### Phase 4 — Middle Stages (Day 3)

- [ ] Stage 3 & 4 (adult, middle age)
- [ ] Additional event slots (placeholders OK)
- [ ] Ranged attack + dodge mechanics
- [ ] *Autumn* music loop

### Phase 5 — Ending (Day 3–4)

- [ ] Stage 5 (elderly)
- [ ] Final screen with grave
- [ ] Infinite enemy spawns
- [ ] Death animation → grave
- [ ] *Winter* music + credits

### Phase 6 — Polish (Remaining Time)

- [ ] All tilesets and sprites finalized
- [ ] Sound effects (hits, jumps, steps)
- [ ] Screen shake, particle effects
- [ ] Juice: hit stop, flash on damage
- [ ] Bug fixes & balance

---

## 13. Open Questions / Decisions

1. **Tile size:** 16×16 (retro) or 32×32 (more detail)?
2. **World size:** One continuous tilemap or chunked loading?
3. **Enemies:** Spawn at fixed positions or procedural waves?
4. **Save system:** None (arcade style) or checkpoint per stage?
5. **Special mechanics for elderly stage:** Should the elder have a unique ability (e.g., slowing time, wisdom burst) to make the final stand feel heroic rather than helpless?
6. **Additional events:** What are the 2–3 beats between youth and elderly? (Brainstorm during jam.)
7. **Art style:** Pixel art (consistent with Hoot) or hand-drawn?

---

## 14. Inspiration & References

- *Passage* (Jason Rohrer) — aging as horizontal progression.
- *That Dragon, Cancer* — emotional narrative through simple mechanics.
- *Celeste* — tight platforming + chapter-based progression.
- Vivaldi's *Four Seasons* — emotional arc through music.

---

*Plan created before GMTK 2026. Subject to change once the actual jam theme is announced.*
