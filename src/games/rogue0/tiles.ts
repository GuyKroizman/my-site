// Terrain feature overlay for rogue0.
//
// The base walkable map (0 = floor, 1 = wall) stays the single source of
// truth for pathfinding, FOV and fog. Terrain features live here as a
// coordinate-keyed overlay (`"x,y"`) so doors/traps/grass/water/chasms can
// carry per-tile state without turning the base map into a tile enum.

export type TerrainFeature = "door" | "secretDoor" | "trap" | "grass" | "water" | "ice" | "chasm";

export type DoorState = "open" | "closed";
export type TrapState = "hidden" | "visible" | "triggered";
export type TrapKind = "dart" | "arrow" | "fire" | "frost" | "teleport" | "summon" | "alarm";

export type TileState = {
  // Optical override for glass walls/crystal doors, independent of movement.
  blocksSight?: boolean;
  feature: TerrainFeature;
  door?: DoorState;
  trap?: TrapState;
  trapKind?: TrapKind;
  // Reusable traps stay visibly armed and activate on each new contact.
  trapReusable?: boolean;
};

// Placement returned by mapgen so scene0 can populate this overlay.
export type FeaturePlacement = {
  blocksSight?: boolean;
  x: number;
  y: number;
  feature: TerrainFeature;
  door?: DoorState;
  trap?: TrapState;
  trapKind?: TrapKind;
  trapReusable?: boolean;
};

// Placeholder tile indices picked from colored.png. These are intentionally
// arbitrary visual stand-ins; scene0.ts applies tints to tell features apart.
export const FeatureTiles = {
  doorClosed: 150,
  doorOpen: 301,
  grass: 7, // Grass blades (row 0, column 7), not a tree.
  water: 206,
  chasm: 5,
  trap: 593
} as const;

type StoredTile = TileState & { x: number; y: number };

const features = new Map<string, StoredTile>();

function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function setFeature(
  x: number,
  y: number,
  feature: TerrainFeature,
  opts: { door?: DoorState; trap?: TrapState; trapKind?: TrapKind; trapReusable?: boolean; blocksSight?: boolean } = {}
): void {
  const k = key(x, y);
  const existing = features.get(k);
  const stored: StoredTile = existing ?? { feature, x, y };

  stored.feature = feature;
  stored.blocksSight = opts.blocksSight;

  if (feature === "door") {
    stored.door = opts.door ?? stored.door ?? "closed";
    delete stored.trap;
    delete stored.trapKind;
    delete stored.trapReusable;
  } else if (feature === "trap") {
    stored.trap = opts.trap ?? stored.trap ?? "hidden";
    stored.trapKind = opts.trapKind ?? stored.trapKind ?? "dart";
    // Teleport traps never expend their charge, including older saved placements.
    stored.trapReusable = stored.trapKind === "teleport" || (opts.trapReusable ?? stored.trapReusable ?? false);
    delete stored.door;
  } else {
    delete stored.door;
    delete stored.trap;
    delete stored.trapKind;
    delete stored.trapReusable;
  }

  features.set(k, stored);
}

export function getFeature(x: number, y: number): TerrainFeature | undefined {
  return features.get(key(x, y))?.feature;
}

export function getTileState(x: number, y: number): TileState | undefined {
  return features.get(key(x, y));
}

export function clearFeature(x: number, y: number): void {
  features.delete(key(x, y));
}

export function clearAllFeatures(): void {
  features.clear();
}

export function getDoorState(x: number, y: number): DoorState | undefined {
  const tile = features.get(key(x, y));
  return tile?.feature === "door" ? tile.door : undefined;
}

export function setDoorState(x: number, y: number, state: DoorState): void {
  const tile = features.get(key(x, y));
  if (!tile || tile.feature !== "door") return;
  tile.door = state;
}

export function getTrapState(x: number, y: number): TrapState | undefined {
  const tile = features.get(key(x, y));
  return tile?.feature === "trap" ? tile.trap : undefined;
}

export function setTrapState(x: number, y: number, state: TrapState): void {
  const tile = features.get(key(x, y));
  if (!tile || tile.feature !== "trap") return;
  tile.trap = state;
}

// Consume the activation before resolving its effect (teleports can move actors).
// No timer: reusable traps reveal themselves and stay armed for the next entry.
export function activateTrap(x: number, y: number): boolean {
  const tile = features.get(key(x, y));
  if (!tile || tile.feature !== "trap" || tile.trap === "triggered") return false;
  tile.trap = tile.trapReusable ? "visible" : "triggered";
  return true;
}

export function getTrapKind(x: number, y: number): TrapKind | undefined {
  const tile = features.get(key(x, y));
  return tile?.feature === "trap" ? tile.trapKind : undefined;
}

export function isBlocking(x: number, y: number): boolean {
  const tile = features.get(key(x, y));
  if (!tile) return false;
  if (tile.feature === "door" && tile.door === "closed") return true;
  if (tile.feature === "chasm" || tile.feature === "secretDoor") return true;
  return false;
}

export function forEachFeature(
  callback: (x: number, y: number, state: TileState) => void
): void {
  features.forEach((tile) => callback(tile.x, tile.y, tile));
}

// Marks closed doors / chasms as unwalkable in a pathfinding grid.
// `dungeon.initialize` calls this right after building its grid.
export function applyToPathGrid(grid: {
  setWalkableAt: (x: number, y: number, walkable: boolean) => void;
}): void {
  features.forEach((tile) => {
    if (isBlocking(tile.x, tile.y)) {
      grid.setWalkableAt(tile.x, tile.y, false);
    }
  });
}

const TRAP_LABELS: Record<TrapKind, string> = {
  dart: "dart trap (poisons)",
  arrow: "arrow trap (throw an object onto it to shoot the nearest character)",
  fire: "fire trap (burns)",
  frost: "frost trap (freezes)",
  teleport: "teleport trap",
  summon: "summoning trap (calls one Skeleton into an empty adjacent tile)",
  alarm: "alarm trap (wakes enemies within 8 tiles, even through walls)"
};

// Human-readable description of a tile for the Inspect command.
export function describeTile(
  state: TileState | undefined,
  isWall: boolean
): string {
  if (state) {
    switch (state.feature) {
      case "secretDoor":
        return "A wall.";
      case "door":
        return state.door === "closed"
          ? "A closed door. Walk into it to open."
          : "An open door.";
      case "water":
        return "Water. Douses fire; frost turns it to ice. Shock hits arc through connected water into other grounded actors, including the caster.";
      case "ice":
        return "Ice. Grounded entry slows movement for 2 time units. Burning actors melt it back to water. Does not conduct shock.";
      case "grass":
        return "Tall grass. Blocks sight. Fire burns connected grass and ignites grounded actors.";
      case "chasm":
        return "A chasm. Only levitation allows safe passage.";
      case "trap": {
        // Hidden traps are invisible — inspect must not reveal them.
        if (state.trap === "hidden") return "Stone floor.";
        const label = TRAP_LABELS[state.trapKind ?? "dart"] ?? "trap";
        if (state.trap === "triggered") return `A triggered ${label}.`;
        return `A ${label}. ${state.trapReusable
          ? "Reusable: triggers on each entry; remains armed."
          : "Single-use: spent after activation."}`;
      }
    }
  }
  return isWall ? "A wall." : "Stone floor.";
}
