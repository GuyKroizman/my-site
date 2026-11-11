// Terrain types and presentation for rogue0. Mutable overlays live in terrain.ts.
//
// The base walkable map (0 = floor, 1 = wall) stays the single source of
// truth for pathfinding, FOV and fog. Terrain features live here as a
// coordinate-keyed overlay (`"x,y"`) so doors/traps/grass/water/chasms can
// carry per-tile state without turning the base map into a tile enum.


export type TerrainFeature = "door" | "secretDoor" | "trap" | "grass" | "water" | "ice" | "chasm" | "portal";

export type DoorState = "open" | "closed";
export type TrapState = "hidden" | "visible" | "triggered";
export type TrapKind = "dart" | "arrow" | "fire" | "frost" | "teleport" | "summon" | "alarm" | "geyser" | "confusion";

export type TileState = {
  // Optical override for glass walls/crystal doors, independent of movement.
  blocksSight?: boolean;
  portal?: 'closed' | 'open';
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
  portal?: 'closed' | 'open';
  feature: TerrainFeature;
  door?: DoorState;
  trap?: TrapState;
  trapKind?: TrapKind;
  trapReusable?: boolean;
};

// Terrain visuals are generated per feature (doors, traps, water, ice, chasm,
// grass); nothing here indexes an atlas any more.

const TRAP_LABELS: Record<TrapKind, string> = {
  dart: "dart trap (poisons)",
  arrow: "arrow trap (throw an object onto it to shoot the nearest character)",
  fire: "fire trap (burns)",
  frost: "frost trap (freezes)",
  teleport: "teleport trap",
  summon: "summoning trap (calls one Skeleton into an empty adjacent tile)",
  alarm: "alarm trap (wakes enemies within 8 tiles, even through walls)",
  geyser: "geyser trap (pushes grounded actors one tile in their entry direction; diagonal entry pushes horizontally; can cause a chasm fall)",
  confusion: "confusion trap (confuses grounded actors for 4 time units; movement becomes random and can enter chasms)"
};

// Short names for the inspect choice list (the full text is the description).
const TRAP_SHORT_NAMES: Record<TrapKind, string> = {
  dart: "Dart trap",
  arrow: "Arrow trap",
  fire: "Fire trap",
  frost: "Frost trap",
  teleport: "Teleport trap",
  summon: "Summoning trap",
  alarm: "Alarm trap",
  geyser: "Geyser trap",
  confusion: "Confusion trap"
};

// Short terrain name for the inspect choice list. Returns undefined when the
// floor has nothing worth listing beside items: plain stone/wall, secret doors
// (still disguised) and hidden traps (invisible by design).
export function describeTileLabel(
  state: TileState | undefined,
  _isWall: boolean
): string | undefined {
  if (!state) return undefined;
  switch (state.feature) {
    case "portal":
      return state.portal === 'open' ? 'Store portal' : 'Strange door';
    case "secretDoor":
      return undefined;
    case "door":
      return state.door === "closed" ? "Closed door" : "Open door";
    case "water":
      return "Water";
    case "ice":
      return "Ice";
    case "grass":
      return "Tall grass";
    case "chasm":
      return "Chasm";
    case "trap":
      if (state.trap === "hidden") return undefined;
      return `${state.trap === "triggered" ? "Triggered " : ""}${TRAP_SHORT_NAMES[state.trapKind ?? "dart"]}`;
  }
  return undefined;
}

// Human-readable description of a tile for the Inspect command.
export function describeTile(
  state: TileState | undefined,
  isWall: boolean
): string {
  if (state) {
    switch (state.feature) {
      case "portal":
        return state.portal === 'open'
          ? 'An open door with a swirling portal inside. Move toward it to enter the store. Only the hero can enter.'
          : 'A strange door. Move toward it once to open it.';
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
        return "Tall grass. Blocks sight in both directions; only adjacent observers see an occupant. Walking onto it tramples it into bare floor, and fire burns it.";
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
