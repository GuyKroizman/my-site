import { Entity } from '../entity';
import type { GameContext } from '../context';
import { maybeCurse } from '../curses';
import { rollFoundUpgrade } from '../foundUpgrades';
import { rollEquipmentGlyph } from '../equipmentGlyphs';
import dungeon from '../dungeon';
import Gold from './gold';
import Ration from './ration';
import PotionOfHealing from './PotionOfHealing';
import { TieredWeapon, TieredArmor } from './tieredEquipment';
import { CHEST_TEXTURE } from '../chestTextures';

/** A real, non-hostile container. Contents are rolled once and saved with it. */
export default class Chest extends Entity {
  type = 'item' as const;
  name = 'Treasure Chest';
  description = 'A wooden treasure chest. Walk into it to open it.';
  // Legacy tilesheet frame, kept so old saves still round-trip. Rendering
  // uses the generated banded-chest texture instead.
  textureKey = CHEST_TEXTURE;
  isContainer = true;
  private opened = false;
  contents: Entity[];

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    const tier = Math.max(1, Math.min(5, Math.ceil((context.floor ?? 1) / 5)));
    // Keep all 18 slots: retired Gem outcomes now pay gold. Healing and gear
    // retain their original odds; no Upgrade Scrolls are added.
    const roll = Math.floor(Math.random() * 18);
    const weapon = new TieredWeapon(context, undefined, undefined, tier);
    const armor = new TieredArmor(context, undefined, undefined, tier);
    rollFoundUpgrade(weapon);
    rollFoundUpgrade(armor);
    maybeCurse(weapon);
    maybeCurse(armor);
    rollEquipmentGlyph(weapon);
    rollEquipmentGlyph(armor);
    this.contents = [roll < 5 ? new Gold(context, undefined, undefined, 10 + tier * 5)
      : roll < 9 ? new Ration(context)
      : roll < 13 ? new Gold(context, undefined, undefined, 10 + tier * 5)
      : roll === 13 ? new PotionOfHealing(context)
      : roll < 16 ? weapon
      : armor];
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
    const index = context.entities.indexOf(this);
    // Removing a container is not killing a monster or picking up its contents.
    if (this.sprite) {
      context.scene?.tweens.killTweensOf(this.sprite);
      this.sprite.destroy();
    }
    this.sprite = undefined;
    for (const item of this.contents) item.init(context, this.x, this.y);
    context.entities.splice(index, 1, ...this.contents);
    dungeon.log(context, `You open the treasure chest. Inside: ${this.contents.map(item => item.displayName).join(', ')}.`);
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
