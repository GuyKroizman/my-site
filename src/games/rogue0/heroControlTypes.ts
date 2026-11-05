import type { Entity } from './entity';
import type { GameContext } from './context';
import type { ActionKind, actionCost, starvationDamageDuring } from './timing';
import type dungeon from './dungeon';
import type { hasEffect } from './effects';
import type { hasLineOfSight } from './fov';
import type { Terrain } from './terrain';
import type { isModalOpen } from './context';

export type Direction = { dx: number; dy: number };
export type TilePosition = { x: number; y: number };
export type PointerPosition = Pick<Phaser.Input.Pointer, 'worldX' | 'worldY'>;

// Explicit facade contract, shared by input/targeting/navigation. These fields
// remain on the actor for compatibility; no controller is serialized in a save.
export interface HeroControlHost extends Entity {
  hunger: number;
  inputBuffer: string[];
  walkPath: TilePosition[];
  acknowledgedWalkEnemies: Set<Entity>;
  walkTargetEntity?: Entity;
  zapping: boolean;
  canAct(): boolean;
  spendTurn(action: ActionKind): void;
  currentWeapon(): Entity | undefined;
  getAllItems(): Entity[];
  slotOf(item: Entity): string | undefined;
  addItem(item: Entity): boolean;
  tryUseSkill(): void;
  processInput(key: string): void;
  processTouchInput(context: GameContext, event: PointerPosition): void;
  bufferKey(key: string): void;
  cursorActive(): boolean;
  isCursorKey(key: string): boolean;
  cursorDir(key: string): Direction | undefined;
  exitCursorModes(): void;
  moveCursor(dx: number, dy: number): void;
  inspectTile(x: number, y: number): void;
  updateInspectedFromCursor(): void;
  toggleInspectMode(): void;
  search(): void;
  waitTurn(): void;
  nextStepToward(x: number, y: number): TilePosition | null;
  setWalkTarget(x: number, y: number, target?: Entity): void;
  tryStepIntoChasm(x: number, y: number): boolean;
  stepManually(dx: number, dy: number): void;
  closestZapTarget(): Entity | undefined;
  cancelThrow(): void;
  throwAtCursor(): void;
  throwAt(x: number, y: number): void;
}

export type HeroControlServices = {
  dungeon: Pick<typeof dungeon, 'entityAtTile' | 'getCurrentLevel' | 'distanceBetweenEntities' |
    'attackEntity' | 'findPath' | 'log' | 'confusedMove' | 'itemPicked' | 'moveEntityTo' |
    'openDoor' | 'isWalkableTile' | 'canEnterChasm' | 'stepIntoChasm' | 'canStepBetween' |
    'inspectTile' | 'inspectTileInfo' | 'searchAround'>;
  hasEffect: typeof hasEffect;
  isGrassConcealed: Terrain['isGrassConcealed'];
  getTrapState: Terrain['getTrapState'];
  hasLineOfSight: typeof hasLineOfSight;
  isModalOpen: typeof isModalOpen;
  actionCost: typeof actionCost;
  starvationDamageDuring: typeof starvationDamageDuring;
};
