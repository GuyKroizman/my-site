import { Entity } from '../entity';
import type { GameContext } from '../context';
import dungeon from '../dungeon';
import { placeFloorItem } from '../itemPresentation';

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

    // Stow the contents in the inventory using the normal pickup rules. The
    // equipped rings/artifact are separate loose floor items from the revival
    // drop and are deliberately never part of these contents, so they stay on
    // the floor here.
    const contents = this.contents;
    this.contents = [];
    const overflow = player.recoverItems(contents);

    // Anything that no longer fits (e.g. the backpack shrank since the drop)
    // stays on the tile instead of being lost.
    for (const item of overflow) {
      item.context = context;
      item.x = this.x;
      item.y = this.y;
      if (!context.entities.includes(item)) context.entities.push(item);
      placeFloorItem(item);
    }

    const index = context.entities.indexOf(this);
    if (index >= 0) context.entities.splice(index, 1);

    dungeon.log(context, contents.length
      ? `You recover your backpack. Inside: ${contents.map(item => item.displayName).join(', ')}.${overflow.length ? ' Some items are left on the floor.' : ''}`
      : 'You recover your backpack, but it is empty.');
    player.spendTurn('use');
    // Picking the backpack opens the inventory so the recovered items are
    // immediately visible, including anything that stacked with carried gear.
    context.onOpenInventory?.();
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
