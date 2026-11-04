import type { Entity } from './entity';
import type { GameContext } from './context';

export function clearFloorSprite(context: GameContext, item: Entity): void {
  if (item.sprite) {
    context.scene?.tweens.killTweensOf(item.sprite);
    item.sprite.destroy();
  }
  item.sprite = undefined;
}

export function clearItemUI(item: Entity): void {
  item.UISprite?.destroy();
  item.UISprite = undefined;
  item.UIText?.destroy();
  item.UIText = undefined;
}

// Dropping and throwing use the same floor-item presentation. World coordinates
// and entity membership are committed by inventory/projectile logic beforehand.
export function placeFloorItem(item: Entity): void {
  const { scene, map } = item.context;
  if (!scene || !map || item.x === undefined || item.y === undefined) return;
  item.sprite?.destroy();
  item.sprite = undefined;
  const sprite = scene.add.sprite(
    map.tileToWorldX(item.x)!, map.tileToWorldY(item.y)!, item.spriteTextureKey, item.spriteFrame
  ).setOrigin(0);
  if (item.tint) sprite.tint = item.tint;
  if (item.textureKey?.startsWith('potion-')) sprite.setScale(0.5);
  item.sprite = sprite;
  if (item.type === 'item') {
    scene.tweens.add({ targets: sprite, alpha: { from: 0.7, to: 1 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
