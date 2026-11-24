// Per-floor boss halls. Floors 5, 10, 15, 20 and 25 each get their own plan,
// so the Writhing Maw is fought in five recognisably different rooms
// instead of one repeated arena.
//
// Layouts are written in hall-local coordinates with the standard map in mind
// (80x50, which leaves a 72x36 span inside the rock border). mapgen clamps the
// footprint to whatever space is left and centres it, so the hall keeps the
// Writhing Maw on the map centre and its hidden north branch above the wall.

export type BossArenaLayoutId =
  | 'colonnade'
  | 'factory'
  | 'octagon'
  | 'cross'
  | 'throne';

export type BossArenaLayout = {
  id: BossArenaLayoutId;
  name: string;
  /** Hall footprint on the standard map. */
  width: number;
  height: number;
  /**
   * Hall-local wall test. `w`/`h` are the hall's actual (possibly clamped)
   * size, so shape rules can scale while fixed pillars stay where they are.
   */
  solid(lx: number, ly: number, w: number, h: number): boolean;
};

// A run of square pillar blocks, each `size` tiles across.
function pillarBlocks(
  positions: Array<[number, number]>,
  size = 2
): (lx: number, ly: number) => boolean {
  return (lx, ly) =>
    positions.some(
      ([bx, by]) =>
        lx >= bx && lx < bx + size && ly >= by && ly < by + size
    );
}

const combined =
  (...tests: Array<(lx: number, ly: number, w: number, h: number) => boolean>) =>
  (lx: number, ly: number, w: number, h: number): boolean =>
    tests.some((test) => test(lx, ly, w, h));

// Floor 5 — the introductory arena. A square hall with four 2x2 pillars set
// exactly 10 walkable tiles apart: the room the Writhing Maw is built for.
export const COLONNADE: BossArenaLayout = {
  id: 'colonnade',
  name: 'Pillared Rotunda',
  width: 16,
  height: 16,
  solid: pillarBlocks([
    [1, 1],
    [13, 1],
    [1, 13],
    [13, 13]
  ])
};

// Floor 10 — the Wand Factory. Same 16x16 footprint and ten-tile central
// span as floor 5, but the pillars sit one row lower on the north side and one
// row higher on the south side, so the hall reads as a different room and has
// room for the two machines along the side walls.
export const WAND_FACTORY_LAYOUT: BossArenaLayout = {
  id: 'factory',
  name: 'Wand Factory',
  width: 16,
  height: 16,
  solid: pillarBlocks([
    [1, 2],
    [13, 2],
    [1, 12],
    [13, 12]
  ])
};

// Floor 15 — an octagonal sanctum: the four corners are chamfered away, and
// four obelisks mark the inner corners of the octagon.
export const OCTAGON: BossArenaLayout = {
  id: 'octagon',
  name: 'Octagonal Sanctum',
  width: 18,
  height: 18,
  solid: combined(
    (lx, ly, w, h) => {
      // Triangular corner cuts make the octagon.
      const dx = Math.min(lx, w - 1 - lx);
      const dy = Math.min(ly, h - 1 - ly);
      return dx + dy < 3;
    },
    pillarBlocks([
      [4, 4],
      [12, 4],
      [4, 12],
      [12, 12]
    ])
  )
};

// Floor 20 — a cruciform vault: four square corner masses leave a plus-shaped
// room, and a ring of pillars frames the Writhing Maw at the crossing.
export const CROSS: BossArenaLayout = {
  id: 'cross',
  name: 'Cruciform Vault',
  width: 20,
  height: 20,
  solid: combined(
    (lx, ly, w, h) => {
      const cut = 6;
      const inCornerX = lx < cut || lx >= w - cut;
      const inCornerY = ly < cut || ly >= h - cut;
      return inCornerX && inCornerY;
    },
    pillarBlocks([
      [6, 6],
      [12, 6],
      [6, 12],
      [12, 12]
    ])
  )
};

// Floor 25 — the final throne hall. A full colonnade ring: corner piers plus a
// pier in the middle of every side, so the last fight happens in a circuit of
// eight columns.
export const THRONE: BossArenaLayout = {
  id: 'throne',
  name: 'Throne Hall',
  width: 20,
  height: 20,
  solid: pillarBlocks([
    [2, 2],
    [16, 2],
    [2, 16],
    [16, 16],
    [8, 2],
    [8, 16],
    [2, 8],
    [16, 8]
  ])
};

// One layout per boss floor. The mapping is explicit: per-floor encounters
// (see bossEncounters.ts) own the identity and win condition of their halls.
export const BOSS_FLOOR_LAYOUTS: Readonly<Record<number, BossArenaLayout>> = {
  5: COLONNADE,
  10: WAND_FACTORY_LAYOUT,
  15: OCTAGON,
  20: CROSS,
  25: THRONE
};

// Kept in floor order for tests and tools that iterate the five plans.
export const BOSS_ARENA_LAYOUTS: readonly BossArenaLayout[] = [
  COLONNADE,
  WAND_FACTORY_LAYOUT,
  OCTAGON,
  CROSS,
  THRONE
];

export const BOSS_FLOOR_STEP = 5;

/** Index into BOSS_ARENA_LAYOUTS for a boss floor, or -1 for other floors. */
export function bossArenaLayoutIndex(floor: number): number {
  return BOSS_ARENA_LAYOUTS.indexOf(BOSS_FLOOR_LAYOUTS[floor]);
}

export function bossArenaLayout(floor: number): BossArenaLayout {
  return BOSS_FLOOR_LAYOUTS[floor];
}
