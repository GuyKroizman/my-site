import { Entity } from '../entity';
import type { GameContext } from '../context';
import dungeon from '../dungeon';

/** A recoverable container left behind by a normal Boot revival. */
export default class DroppedBackpack extends Entity {
  type = 'item' as const;
  name = 'Dropped Backpack';
  description = 'Your dropped backpack. Walk into it to recover its contents.';
  textureKey = 'dropped-backpack';
  isContainer = true;
  private opened = false;
  contents: Entity[];

  constructor(context: GameContext, contents: Entity[] = [], x?: number, y?: number) {
    super();
    this.contents = contents;
    this.init(context, x, y);
  }

  openContainer(): boolean {
    const context = this.context, player = context.player;
    if (this.opened || !player?.canAct() || !context.entities.includes(this) ||
        this.x === undefined || this.y === undefined || player.x === undefined || player.y === undefined ||
        Math.max(Math.abs(player.x - this.x), Math.abs(player.y - this.y)) > 1 ||
        !dungeon.canStepBetween(player.x, player.y, this.x, this.y, player)) return false;
    this.opened = true;
    player.walkPath = [];
    player.inputBuffer = [];
    if (this.sprite) {
      context.scene?.tweens.killTweensOf(this.sprite);
      this.sprite.destroy();
    }
    this.sprite = undefined;
    for (const item of this.contents) item.init(context, this.x, this.y);
    const index = context.entities.indexOf(this);
    if (index >= 0) context.entities.splice(index, 1, ...this.contents);
    else context.entities.push(...this.contents);
    dungeon.log(context, this.contents.length
      ? `You recover your backpack. Inside: ${this.contents.map(item => item.displayName).join(', ')}.`
      : 'You recover your backpack, but it is empty.');
    this.contents = [];
    player.spendTurn('use');
    return true;
  }

  equip(): void {}
  turn(): void {}
  refresh(): void {}
  isOver(): boolean { return true; }
  onDestroy(): void {}
  damage(): number { return 0; }
  attack(): number { return 0; }
  protection(): number { return 0; }
  range(): number { return 0; }
}
