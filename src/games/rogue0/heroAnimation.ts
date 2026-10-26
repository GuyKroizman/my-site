import type { Entity } from './entity';

// Presentation clock only: never consume gameplay RNG or schedule world actions.
const poses = new WeakMap<object, { x: number; y: number; idleSince: number; distance: number; facingLeft: boolean; originX: number; originY: number }>();

export function updateHeroAnimation(hero: Entity | undefined, now: number): void {
  const sprite = hero?.sprite;
  if (!hero || !sprite || hero.healthPoints <= 0) return;
  let pose = poses.get(sprite);
  if (!pose) {
    pose = { x: sprite.x, y: sprite.y, idleSince: now, distance: 0,
      facingLeft: sprite.flipX, originX: sprite.displayOriginX, originY: sprite.displayOriginY };
    poses.set(sprite, pose);
  }
  const dx = sprite.x - pose.x;
  const dy = sprite.y - pose.y;
  pose.x = sprite.x;
  pose.y = sprite.y;
  let lift = 0;
  if (hero.moving) {
    if (dx !== 0) pose.facingLeft = dx < 0;
    // One small, pixel-snapped footfall per tile. Offset the drawing origin,
    // not position: movement tweens and camera tracking stay untouched.
    pose.distance += Math.hypot(dx, dy);
    lift = Math.round(Math.abs(Math.sin(pose.distance / 16 * Math.PI)) * 2);
    pose.idleSince = now;
    sprite.setFlipX(pose.facingLeft);
  } else if (hero.tweens > 0 || dx !== 0 || dy !== 0) {
    // Attack lunges and teleports are not walking; reset to a neutral pose.
    pose.idleSince = now;
    pose.distance = 0;
    sprite.setFlipX(pose.facingLeft);
  } else {
    pose.distance = 0;
    const idle = (now - pose.idleSince) % 6200;
    // A brief glance away, then back; long holds avoid nervous flickering.
    sprite.setFlipX(idle >= 2600 && idle < 3900 ? !pose.facingLeft : pose.facingLeft);
  }
  sprite.setDisplayOrigin(pose.originX, pose.originY + lift);
}
