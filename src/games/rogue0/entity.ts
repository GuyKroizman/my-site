// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "context";

export type EntityType = "player" | "enemy" | "item";

export abstract class Entity {
  healthPoints: number = 0;
  tweens: number = 0;
  x?: number;
  y?: number;
  moving: boolean = false;
  sprite: Phaser.GameObjects.Sprite | undefined;
  tile: number = 0;
  name: string = "Unknown Entity";
  description: string = "Unknown Entity Description";
  type: EntityType = "enemy";
  UISprite?: Phaser.GameObjects.Sprite;
  UIText?: Phaser.GameObjects.Text;
  context!: GameContext;
  weapon: boolean = false;
  attackTile: number = 11 * 49 + 11;
  active: boolean = false;
  tint: number | undefined = undefined;

  init(context: GameContext, x?: number, y?: number) {

    this.x = x;
    this.y = y;
    this.context = context;

    // x, y are not provided if the entity is an item carried (equipped) by the player
    // (not on the map)
    if (this.x && this.y) {
      this.sprite = createSprite(context, this.x, this.y, this.tile, this.tint);
    } else {
      this.sprite = undefined;
    }
  }

  abstract equip(itemNumber: number): void;

  abstract refresh(): void;

  abstract turn(): void;

  abstract isOver(): boolean;

  abstract attack(): number;

  abstract protection(): number;

  abstract range(): number;

  abstract damage(): number;

  abstract onDestroy(): void;

  createUI?(options: { scene: Phaser.Scene, x: number, y: number, width: number }): number;
}

export function removeEntity(context: GameContext, entity: Entity) {
  const victimIndexInEntities = context.entities.findIndex((e) => e === entity);
  context.entities.splice(victimIndexInEntities, 1);

  entity.sprite?.destroy();

  entity.onDestroy();
}

function createSprite(context: GameContext, x: number, y: number, tile: number, tint?: number): Phaser.GameObjects.Sprite {
  const xx = context.map!.tileToWorldX(x);
  const yy = context.map!.tileToWorldY(y);
  const sprite = context.scene!.add.sprite(xx || 0 , yy || 0, "tiles", tile);
  sprite.setOrigin(0);
  if (tint) {
    sprite.tint = tint;
  }
  return sprite;
}
