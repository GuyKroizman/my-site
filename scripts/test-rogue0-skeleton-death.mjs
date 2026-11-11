import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('skeleton-death');
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { playSkeletonDeath, skeletonBonePose, SKELETON_BONES, SKELETON_DEATH_DURATION, SKELETON_FRAME_WIDTH, SKELETON_FRAME_HEIGHT } from '../src/games/rogue0/monsters/skeletonDeathVisuals.ts';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

function fixture() {
  const images = [], tweens = [], killed = [], frames = new Map();
  const texture = { key: 'foreground-tiles', has: name => frames.has(name),
    add(name, ...rect) { frames.set(name, rect); } };
  const events = new EventEmitter();
  const scene = { events, add: { image(x, y, key, frame) {
    const image = { x, y, key, frame, destroyed: false,
      setPosition(x, y) { Object.assign(this, { x, y }); return this; },
      setScale(x, y) { this.scale = [x, y]; return this; },
      setDepth(depth) { this.depth = depth; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      setTint(tint) { this.tint = tint; return this; },
      setAngle(angle) { this.angle = angle; return this; },
      setVisible(visible) { this.visible = visible; return this; },
      destroy() { this.destroyed = true; },
    };
    images.push(image); return image;
  } }, tweens: { add(config) { tweens.push(config); }, killTweensOf(target) { killed.push(target); } } };
  // Matches the real sprite: 16x22 artwork, feet-anchored origin.
  const originY = 1 - 16 / SKELETON_FRAME_HEIGHT;
  const sprite = { x: 32, y: 48, displayOriginX: 0, displayOriginY: originY,
    scaleX: 1, scaleY: 1, depth: 55, alpha: 0.8, visible: true, tintTopLeft: 0xffffff,
    frame: { name: 323, width: SKELETON_FRAME_WIDTH, height: SKELETON_FRAME_HEIGHT,
      cutX: 493, cutY: 102, sourceIndex: 0 }, texture,
    destroy() { this.destroyed = true; } };
  const context = { scene, visibleTiles: new Set(['2,3']), entities: [] };
  const tick = elapsed => { const tween = tweens[0]; tween.targets.elapsed = elapsed; tween.onUpdate(); };
  const top = sprite.y - sprite.displayOriginY;
  return { context, sprite, images, tweens, killed, frames, events, tick, top };
}

for (let i = 0; i < SKELETON_BONES.length; i++) {
  const bone = SKELETON_BONES[i];
  const initial = skeletonBonePose(i, 0);
  assert.ok(initial.drop === 0 && initial.drift === 0 && initial.angle === 0 && initial.bounce === 0);
  assert.equal(initial.alpha, 1);
  assert.equal(skeletonBonePose(i, bone.fall / 2).drop, 0.25, 'gravity accelerates the fall');
  assert.equal(skeletonBonePose(i, bone.fall).drop, 1);
  assert.ok(skeletonBonePose(i, bone.fall + 75).bounce > 0, 'each bone bounces');
  assert.equal(skeletonBonePose(i, bone.fall + 150).bounce, 0, 'bones settle');
  assert.equal(skeletonBonePose(i, 600).alpha, 1, 'pile remains briefly visible');
  assert.equal(skeletonBonePose(i, SKELETON_DEATH_DURATION).alpha, 0);
}
{
  const f = fixture();
  assert.equal(playSkeletonDeath(f.context, f.sprite), true);
  assert.equal(f.sprite.destroyed, true);
  assert.equal(f.images.length, 6);
  assert.equal(f.tweens.length, 1, 'one visual clock, no gameplay timers');
  f.tick(0);
  f.images.forEach((image, i) => {
    const bone = SKELETON_BONES[i];
    assert.equal(image.x, 32 + bone.x + bone.width / 2);
    assert.equal(image.y, f.top + bone.y + bone.height / 2);
    assert.equal(image.depth, 55, 'pieces remain under fog');
    assert.equal(image.alpha, 0.8);
    assert.deepEqual(f.frames.get(image.frame), [0, 493 + bone.x, 102 + bone.y, bone.width, bone.height]);
  });
  f.tick(600);
  assert.ok(f.images[0].y > f.top + 12, 'skull falls from head height to the floor');
  f.context.visibleTiles.clear(); f.tick(610);
  assert.ok(f.images.every(image => !image.visible), 'leaving sight hides detached bones');
  f.context.visibleTiles.add('2,3'); f.tick(780);
  assert.ok(f.images.every(image => image.visible && image.alpha === 0.4));
  f.tweens[0].onComplete();
  assert.ok(f.images.every(image => image.destroyed));
  assert.equal(f.events.listenerCount('shutdown'), 0);
  assert.ok(f.killed.includes(f.tweens[0].targets));
}
{
  const f = fixture();
  playSkeletonDeath(f.context, f.sprite);
  f.events.emit('shutdown');
  assert.ok(f.images.every(image => image.destroyed), 'floor changes clean up fragments');
  assert.equal(f.events.listenerCount('shutdown'), 0);
}
for (const hidden of [{ visible: false }, { alpha: 0 }]) {
  const f = fixture(); Object.assign(f.sprite, hidden);
  assert.equal(playSkeletonDeath(f.context, f.sprite), true);
  assert.equal(f.sprite.destroyed, true);
  assert.equal(f.images.length, 0, 'unseen deaths spawn no bones');
  assert.equal(f.tweens.length, 0);
}
{
  const f = fixture(); f.sprite.frame.width = 32;
  assert.equal(playSkeletonDeath(f.context, f.sprite), false, 'unknown artwork uses default animation');
  assert.equal(f.sprite.destroyed, undefined);
  assert.equal(playSkeletonDeath({}, f.sprite), false, 'headless contexts are safe');
}
// Exercise the real removal path and Skeleton hook, not just the visual helper.
{
  let drops = 0, sounds = 0, reinforcements = 0;
  const { removeEntity } = loadLogic('src/games/rogue0/entity.ts', { sfx: { death() { sounds++; } } });
  const Skeleton = loadLogic('src/games/rogue0/monsters/skelaton.ts', {
    Monster: class { constructor(context) { this.context = context; } },
    BerserkPotion: class {}, playSkeletonDeath,
  }).default;
  const f = fixture();
  const skeleton = new Skeleton(f.context, 2, 3);
  Object.assign(skeleton, { type: 'enemy', x: 2, y: 3, sprite: f.sprite,
    onDestroy() { assert.equal(this.x, 2); assert.equal(this.y, 3); drops++; } });
  f.context.entities.push(skeleton);
  f.context.onMonsterRemoved = () => { reinforcements++; };
  removeEntity(f.context, skeleton);
  assert.equal(f.context.entities.length, 0, 'dead skeleton immediately stops blocking gameplay');
  assert.equal(skeleton.sprite, undefined);
  assert.equal(skeleton.x, undefined);
  assert.equal(f.images.length, 6, 'removal uses the skeleton-specific animation');
  assert.equal(f.tweens.length, 1, 'no simultaneous shrink tween');
  assert.deepEqual([drops, sounds, reinforcements], [1, 1, 1], 'rewards happen before animation completes');
  removeEntity(f.context, skeleton);
  assert.deepEqual([drops, sounds, reinforcements], [1, 1, 1], 'repeat removal is harmless');
  const other = { type: 'enemy', sprite: fixture().sprite, onDestroy() {} };
  f.context.entities.push(other); removeEntity(f.context, other);
  assert.equal(f.tweens[1].duration, 180, 'other monsters retain the existing death fade');
  f.tweens[1].onComplete();
}
console.log('Skeleton death: falling bones, bounce, fog, cleanup, and removal integration passed.');
