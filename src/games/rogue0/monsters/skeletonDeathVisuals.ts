import type Phaser from 'phaser';
import type { GameContext } from '../context';

// Cut the existing pixel art into anatomical pieces, rather than substituting
// generic particles. Rectangles are local to the skeleton's 16x22 sprite and
// together cover it exactly: skull + neck, ribcage, both arms, both legs (the
// ragged shroud falls with the legs it covers).
export const SKELETON_FRAME_WIDTH = 16;
export const SKELETON_FRAME_HEIGHT = 22;
export const SKELETON_BONES = [
  { name: 'skull', x: 4, y: 1, width: 8, height: 8, drift: 2, angle: 25, fall: 380 },
  { name: 'left-arm', x: 1, y: 9, width: 3, height: 8, drift: -3, angle: -85, fall: 280 },
  { name: 'ribs', x: 4, y: 9, width: 8, height: 6, drift: 0, angle: 90, fall: 320 },
  { name: 'right-arm', x: 12, y: 9, width: 3, height: 8, drift: 3, angle: 85, fall: 300 },
  { name: 'left-leg', x: 4, y: 15, width: 4, height: 7, drift: -2, angle: -90, fall: 180 },
  { name: 'right-leg', x: 8, y: 15, width: 4, height: 7, drift: 2, angle: 90, fall: 210 },
] as const;
export const SKELETON_DEATH_DURATION = 900;

/** Accelerate down, bounce once, then rest. No gameplay randomness or physics. */
export function skeletonBonePose(index: number, elapsed: number) {
  const bone = SKELETON_BONES[index];
  const fall = Math.min(1, Math.max(0, elapsed / bone.fall));
  const bounce = Math.min(1, Math.max(0, (elapsed - bone.fall) / 150));
  return {
    drop: fall * fall,
    drift: bone.drift * Math.min(1, Math.max(0, elapsed / (bone.fall + 150))),
    angle: bone.angle * fall,
    bounce: 4 * bounce * (1 - bounce) * (index === 0 ? 2 : 1),
    alpha: Math.min(1, Math.max(0, (SKELETON_DEATH_DURATION - elapsed) / 240)),
  };
}

/** Owns and destroys the detached sprite; returns false for the normal fallback. */
export function playSkeletonDeath(context: GameContext, sprite: Phaser.GameObjects.Sprite): boolean {
  const scene = context.scene;
  if (!scene || sprite.frame.width !== SKELETON_FRAME_WIDTH ||
    sprite.frame.height !== SKELETON_FRAME_HEIGHT) return false;
  // Never reveal a death in the fog (including status damage off-screen).
  if (!sprite.visible || sprite.alpha <= 0) {
    sprite.destroy();
    return true;
  }
  const tileX = Math.floor(sprite.x / 16), tileY = Math.floor(sprite.y / 16);
  const sx = Math.abs(sprite.scaleX), sy = Math.abs(sprite.scaleY);
  const left = sprite.x - sprite.displayOriginX * sx;
  const top = sprite.y - sprite.displayOriginY * sy;
  // Feet sit on the last artwork row, whatever the frame height.
  const ground = top + (sprite.frame.height - 1) * sy;
  const alpha = sprite.alpha;
  const texture = sprite.texture;
  // Phaser makes the first added subframe the default for image textures.
  // The bone frames share the living skeleton's texture, so leaving firstFrame
  // on "skull" renders every skeleton spawned afterwards as a bodiless head.
  const defaultFrame = texture.firstFrame;
  const fragments = SKELETON_BONES.map(bone => {
    const name = `skeleton-death-${sprite.frame.name}-${bone.name}`;
    if (!texture.has(name)) {
      texture.add(name, sprite.frame.sourceIndex,
        sprite.frame.cutX + bone.x, sprite.frame.cutY + bone.y, bone.width, bone.height);
    }
    return scene.add.image(left + (bone.x + bone.width / 2) * sx,
      top + (bone.y + bone.height / 2) * sy, texture.key, name)
      .setScale(sx, sy).setDepth(sprite.depth).setAlpha(alpha).setTint(sprite.tintTopLeft);
  });
  texture.firstFrame = defaultFrame;
  sprite.destroy();

  const clock = { elapsed: 0 };
  const cleanup = () => {
    scene.events.off('shutdown', cleanup);
    scene.tweens.killTweensOf(clock);
    fragments.forEach(fragment => fragment.destroy());
  };
  scene.events.once('shutdown', cleanup);
  scene.tweens.add({
    targets: clock, elapsed: SKELETON_DEATH_DURATION,
    duration: SKELETON_DEATH_DURATION, ease: 'Linear',
    onUpdate: () => {
      const visible = context.visibleTiles.has(`${tileX},${tileY}`);
      fragments.forEach((fragment, index) => {
        const bone = SKELETON_BONES[index];
        const pose = skeletonBonePose(index, clock.elapsed);
        const radians = bone.angle * Math.PI / 180;
        const restingHeight = Math.abs(Math.sin(radians)) * bone.width * sx +
          Math.abs(Math.cos(radians)) * bone.height * sy;
        const startY = top + (bone.y + bone.height / 2) * sy;
        const endY = ground - restingHeight / 2;
        fragment.setPosition(left + (bone.x + bone.width / 2 + pose.drift) * sx,
          startY + (endY - startY) * pose.drop - pose.bounce * sy)
          .setAngle(pose.angle).setAlpha(alpha * pose.alpha).setVisible(visible);
      });
    },
    onComplete: cleanup,
  });
  return true;
}
