import type { GameContext } from './context';
import type { DoorState, FeaturePlacement, TerrainFeature, TileState, TrapKind, TrapState } from './tiles';

type StoredTile = TileState & { x: number; y: number };

// One active-floor overlay per run. No renderer, active-run pointer, or shared
// feature map: callers may also create independent stores for tools/tests.
export function createTerrain() {
  const features = new Map<string, StoredTile>();
  const key = (x: number, y: number) => `${x},${y}`;

  function setFeature(x: number, y: number, feature: TerrainFeature,
    opts: { door?: DoorState; portal?: 'closed' | 'open'; trap?: TrapState; trapKind?: TrapKind; trapReusable?: boolean; blocksSight?: boolean } = {}): void {
    const k = key(x, y);
    const stored: StoredTile = features.get(k) ?? { feature, x, y };
    stored.feature = feature;
    if (feature === 'portal') stored.portal = opts.portal ?? stored.portal ?? 'closed';
    else delete stored.portal;
    stored.blocksSight = opts.blocksSight;
    if (feature === 'door') {
      stored.door = opts.door ?? stored.door ?? 'closed';
      delete stored.trap;
      delete stored.trapKind;
      delete stored.trapReusable;
    } else if (feature === 'trap') {
      stored.trap = opts.trap ?? stored.trap ?? 'hidden';
      stored.trapKind = opts.trapKind ?? stored.trapKind ?? 'dart';
      // Teleport traps never expend their charge, including older saves.
      stored.trapReusable = stored.trapKind === 'teleport' || (opts.trapReusable ?? stored.trapReusable ?? false);
      delete stored.door;
    } else {
      delete stored.door;
      delete stored.trap;
      delete stored.trapKind;
      delete stored.trapReusable;
    }
    features.set(k, stored);
  }

  function getFeature(x: number, y: number): TerrainFeature | undefined {
    return features.get(key(x, y))?.feature;
  }

  // Terrain stays visible; occupants beyond adjacent tiles are concealed.
  function isGrassConcealed(x: number | undefined, y: number | undefined,
    observerX: number | undefined, observerY: number | undefined): boolean {
    return x !== undefined && y !== undefined && observerX !== undefined && observerY !== undefined &&
      getFeature(x, y) === 'grass' && Math.max(Math.abs(x - observerX), Math.abs(y - observerY)) > 1;
  }

  function getTileState(x: number, y: number): TileState | undefined {
    return features.get(key(x, y));
  }

  function clearFeature(x: number, y: number): void { features.delete(key(x, y)); }
  function clearAllFeatures(): void { features.clear(); }

  function getDoorState(x: number, y: number): DoorState | undefined {
    const tile = features.get(key(x, y));
    return tile?.feature === 'door' ? tile.door : undefined;
  }

  function setDoorState(x: number, y: number, state: DoorState): void {
    const tile = features.get(key(x, y));
    if (!tile || tile.feature !== 'door') return;
    tile.door = state;
  }

  function getTrapState(x: number, y: number): TrapState | undefined {
    const tile = features.get(key(x, y));
    return tile?.feature === 'trap' ? tile.trap : undefined;
  }

  function setTrapState(x: number, y: number, state: TrapState): void {
    const tile = features.get(key(x, y));
    if (!tile || tile.feature !== 'trap') return;
    tile.trap = state;
  }

  // Consume activation before its effect: teleports can move actors. Reusable
  // traps reveal themselves and stay armed, with no timer between entries.
  function activateTrap(x: number, y: number): boolean {
    const tile = features.get(key(x, y));
    if (!tile || tile.feature !== 'trap' || tile.trap === 'triggered') return false;
    tile.trap = tile.trapReusable ? 'visible' : 'triggered';
    return true;
  }

  function getTrapKind(x: number, y: number): TrapKind | undefined {
    const tile = features.get(key(x, y));
    return tile?.feature === 'trap' ? tile.trapKind : undefined;
  }

  function isBlocking(x: number, y: number): boolean {
    const tile = features.get(key(x, y));
    if (!tile) return false;
    if (tile.feature === 'door' && tile.door === 'closed') return true;
    return tile.feature === 'chasm' || tile.feature === 'secretDoor' || tile.feature === 'portal';
  }

  function forEachFeature(callback: (x: number, y: number, state: TileState) => void): void {
    features.forEach(tile => callback(tile.x, tile.y, tile));
  }

  // dungeon.initialize applies the overlay after building its base grid.
  function applyToPathGrid(grid: { setWalkableAt(x: number, y: number, walkable: boolean): void }): void {
    features.forEach(tile => {
      if (isBlocking(tile.x, tile.y)) grid.setWalkableAt(tile.x, tile.y, false);
    });
  }

  // Keep v1 FeaturePlacement records detached from live state in both
  // directions. Visiting a floor must not mutate another floor's snapshot.
  function snapshot(): FeaturePlacement[] {
    return Array.from(features.values(), tile => ({ ...tile }));
  }

  function restore(placements: FeaturePlacement[]): void {
    clearAllFeatures();
    for (const tile of placements) setFeature(tile.x, tile.y, tile.feature, tile);
  }

  return { setFeature, getFeature, isGrassConcealed, getTileState, clearFeature,
    clearAllFeatures, getDoorState, setDoorState, getTrapState, setTrapState,
    activateTrap, getTrapKind, isBlocking, forEachFeature, applyToPathGrid, snapshot, restore };
}

export type Terrain = ReturnType<typeof createTerrain>;

// Runtime-only association: context/scene cycles can be collected after a run,
// and neither this store nor its functions enter the saved entity graph.
const terrains = new WeakMap<GameContext, Terrain>();
export function terrainFor(context: GameContext): Terrain {
  let terrain = terrains.get(context);
  if (!terrain) {
    terrain = createTerrain();
    terrains.set(context, terrain);
  }
  return terrain;
}
