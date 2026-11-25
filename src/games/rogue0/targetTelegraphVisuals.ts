import type Phaser from "phaser";
import type { Entity } from "./entity";

// Enemy attack telegraphs: up to nine red-bordered tiles drawn above fog,
// mirroring the player's cursor style in scene0.updateCursor().
export const TARGET_BORDER_COLOR = 0xff6a6a;

const OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

type TelegraphEntity = Entity & {
  telegraphStage?: number;
  targetX?: number;
  targetY?: number;
};

// Structural check keeps this module usable by headless tests without Phaser
// or a constructor import from the monster module.
function isTelegraphing(entity: TelegraphEntity): boolean {
  return entity.type === 'enemy' && entity.name === 'Fire Potion Thrower' &&
    (entity.telegraphStage ?? 0) > 0 && (entity.telegraphStage ?? 0) <= 2;
}

/** Tile list currently marked by an entity's telegraph stage. */
export function telegraphTiles(entity: TelegraphEntity): Array<{ x: number; y: number }> {
  const stage = entity.telegraphStage ?? 0;
  if (stage <= 0 || stage > 2 || entity.targetX === undefined || entity.targetY === undefined) return [];
  const offsets = stage === 1 ? [[0, 0]] : OFFSETS;
  return offsets.map(([dx, dy]) => ({ x: entity.targetX! + dx, y: entity.targetY! + dy }));
}

const states = new WeakMap<Phaser.Scene, Map<Entity, Phaser.GameObjects.Graphics>>();
const holds = new WeakMap<Phaser.Scene, Map<Entity, Phaser.Tweens.Tween>>();
export const TARGET_WARNING_HOLD_MS = 200;

/** Like a walk/lunge animation, presentation delays events, not their timestamps.
 * Without this barrier, a slow hero action can let the scheduler consume both
 * warning stages in one update, or buffered walking can leave the marked tile
 * before the centre warning has ever been drawn.
 */
export function holdTargetTelegraph(scene: Phaser.Scene, entity: Entity): void {
  let pending = holds.get(scene);
  if (!pending) {
    pending = new Map();
    holds.set(scene, pending);
  }
  pending.get(entity)?.stop();
  entity.moving = true;
  const tween = scene.tweens.addCounter({
    from: 0, to: 1, duration: TARGET_WARNING_HOLD_MS,
    onComplete: () => {
      entity.moving = false;
      pending.delete(entity);
    }
  });
  pending.set(entity, tween);
}

export function updateTargetTelegraphs(
  scene: Phaser.Scene,
  entities: readonly Entity[],
  map: Phaser.Tilemaps.Tilemap | undefined,
  visibleTiles?: ReadonlySet<string>
): void {
  let graphics = states.get(scene);
  if (!graphics) {
    graphics = new Map();
    states.set(scene, graphics);
  }
  const active = new Set<Entity>();
  for (const entity of entities) {
    const telegrapher = entity as TelegraphEntity;
    if (!isTelegraphing(telegrapher)) continue;
    active.add(entity);
    let g = graphics.get(entity);
    if (!g) {
      g = scene.add.graphics().setDepth(300);
      graphics.set(entity, g);
    }
    g.clear();
    if (!map) continue;
    for (const tile of telegraphTiles(telegrapher)) {
      if (visibleTiles && !visibleTiles.has(`${tile.x},${tile.y}`)) continue;
      const x = map.tileToWorldX(tile.x);
      const y = map.tileToWorldY(tile.y);
      if (x === null || y === null || x === undefined || y === undefined) continue;
      g.lineStyle(1, TARGET_BORDER_COLOR, 1);
      g.strokeRect(x + 1, y + 1, 14, 14);
      g.fillStyle(TARGET_BORDER_COLOR, 0.18);
      g.fillRect(x, y, 16, 16);
    }
  }
  for (const [entity, g] of graphics) {
    if (active.has(entity)) continue;
    g.destroy();
    graphics.delete(entity);
  }
}

export function clearTargetTelegraphs(scene: Phaser.Scene): void {
  const pending = holds.get(scene);
  if (pending) {
    for (const [entity, tween] of pending) {
      tween.stop();
      entity.moving = false;
    }
    pending.clear();
    holds.delete(scene);
  }
  const graphics = states.get(scene);
  if (!graphics) return;
  for (const g of graphics.values()) g.destroy();
  graphics.clear();
  states.delete(scene);
}
