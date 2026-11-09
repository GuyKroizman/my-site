import { Entity } from '../entity';
import type { GameContext } from '../context';
import dungeon from '../dungeon';
import Wraith from '../monsters/wraith';
import { createEquipmentFind } from '../equipmentFinds';

/** Contents and haunting are rolled once, then persisted even before searching. */
export default class SkeletalRemains extends Entity {
  type = 'item' as const;
  name = 'Skeletal Remains';
  description = 'A pile of old bones. Walk into it to search for equipment. Cursed finds awaken a Wraith.';
  textureKey = 'skeletal-remains';
  isContainer = true;
  private searched = false;
  contents: Entity[];
  private haunted: boolean;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    // Every pile holds one weapon or armor; cursed gear always raises a Wraith.
    this.contents = [createEquipmentFind(context)];
    this.haunted = this.contents.some(item => item.cursed);
    this.init(context, x, y);
  }

  openContainer(): boolean {
    const context = this.context, player = context.player;
    if (this.searched || !player?.canAct() || !context.entities.includes(this) ||
        this.x === undefined || this.y === undefined || player.x === undefined || player.y === undefined ||
        Math.max(Math.abs(player.x - this.x), Math.abs(player.y - this.y)) > 1 ||
        !dungeon.canStepBetween(player.x, player.y, this.x, this.y, player)) return false;
    this.searched = true;
    player.walkPath = [];
    player.inputBuffer = [];
    if (this.sprite) {
      context.scene?.tweens.killTweensOf(this.sprite);
      this.sprite.destroy();
    }
    this.sprite = undefined;
    const revealed: Entity[] = [];
    if (this.haunted) {
      // Occupy the vacated pile tile, so even a cramped corridor can be haunted.
      // Put the enemy before its loot for collision/pickup priority.
      const wraith = new Wraith(context, this.x, this.y);
      wraith.sleepTurnsRemaining = 0;
      wraith.awareOfPlayer = true;
      wraith.nextActionTime = player.nextActionTime;
      revealed.push(wraith);
    }
    for (const item of this.contents) item.init(context, this.x, this.y);
    revealed.push(...this.contents);
    context.entities.splice(context.entities.indexOf(this), 1, ...revealed);
    dungeon.log(context, this.contents.length
      ? `You search the skeletal remains and find ${this.contents.map(item => item.displayName).join(', ')}.`
      : 'You search the skeletal remains, but find nothing.');
    if (this.haunted) dungeon.log(context, 'A Wraith rises from the disturbed bones!');
    this.contents = [];
    player.spendTurn('use');
    return true;
  }

  equip() {}
  turn() {}
  refresh() {}
  isOver() { return true; }
  onDestroy() {}
  damage() { return 0; }
  attack() { return 0; }
  protection() { return 0; }
  range() { return 0; }
}
