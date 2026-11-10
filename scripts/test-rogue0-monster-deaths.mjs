import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('monster-deaths');
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { MONSTER_DEATH_STYLES, DEATH_DURATIONS, monsterDeathStyle, monsterDeathParts,
  monsterDeathPose, monsterDeathMotes, playMonsterDeath } from '../src/games/rogue0/monsters/monsterDeathVisuals.ts';
import { resolveFootprint } from '../src/games/rogue0/footprint.ts';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

function fixture({ width = 16, height = 16, scale = 1, flipX = false } = {}) {
  const images = [], tweens = [], killed = [], frames = new Map();
  const texture = { key: 'monster', firstFrame: '__BASE', has: key => frames.has(key),
    add(key, ...rect) {
      frames.set(key, rect);
      // Match Phaser's default-frame side effect for generated/single images.
      if (this.firstFrame === '__BASE') this.firstFrame = key;
    } };
  const events = new EventEmitter();
  const graphics = { quads: [], clear() { this.quads = []; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    fillStyle(color, alpha) { this.color = color; this.alpha = alpha; return this; },
    fillRect(...rect) { this.quads.push({ rect, color: this.color, alpha: this.alpha }); return this; },
    destroy() { this.destroyed = true; } };
  const scene = { events, add: { graphics: () => graphics, image(x, y, key, frame) {
    const image = { x, y, key, frame, destroyed: false,
      setPosition(x, y) { Object.assign(this, { x, y }); return this; },
      setScale(scaleX, scaleY) { Object.assign(this, { scaleX, scaleY }); return this; },
      setDepth(depth) { this.depth = depth; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      setTint(tint) { this.tint = tint; return this; },
      setFlip(x, y) { this.flip = [x, y]; return this; },
      setAngle(angle) { this.angle = angle; return this; },
      setVisible(visible) { this.visible = visible; return this; },
      destroy() { this.destroyed = true; },
    }; images.push(image); return image;
  } }, tweens: { add(config) { tweens.push(config); }, killTweensOf(target) { killed.push(target); } } };
  const sprite = { x: 32, y: 48, displayOriginX: 0, displayOriginY: height - 16,
    scaleX: scale, scaleY: scale, depth: 55, alpha: 0.8, visible: true, tintTopLeft: 0xffffff,
    flipX, flipY: false, frame: { name: 0, width, height, cutX: 34, cutY: 51, sourceIndex: 0 }, texture,
    destroy() { this.destroyed = true; } };
  const context = { scene, floor: 1, currentLevel: [], visibleTiles: new Set(['2,3']), entities: [] };
  const tick = elapsed => { const tween = tweens[0]; tween.targets.elapsed = elapsed; tween.onUpdate(); };
  return { context, sprite, images, tweens, killed, frames, events, graphics, tick };
}

assert.equal(monsterDeathStyle('Skeleton'), undefined, 'skeleton keeps its own animation');
assert.equal(monsterDeathStyle('Unknown'), undefined);
assert.equal(monsterDeathStyle('toString'), undefined, 'only registered identities match');
assert.equal(new Set(Object.values(MONSTER_DEATH_STYLES)).size, 14, 'each supported identity has its own style');
for (const [name, style] of Object.entries(MONSTER_DEATH_STYLES)) {
  const width = name === 'Bone Lord' ? 24 : 16, height = name === 'Cultist' ? 24 : width;
  const parts = monsterDeathParts(style, width, height);
  assert.ok(parts.length > 0 && parts.length <= 16);
  const covered = new Set();
  parts.forEach((part, i) => {
    assert.ok(part.x >= 0 && part.y >= 0 && part.x + part.width <= width && part.y + part.height <= height);
    for (let y = part.y; y < part.y + part.height; y++) for (let x = part.x; x < part.x + part.width; x++) {
      assert.ok(!covered.has(`${x},${y}`), `${name}: fragments do not duplicate pixels`);
      covered.add(`${x},${y}`);
    }
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 1, 2]) {
      const pose = monsterDeathPose(style, part, i, t * DEATH_DURATIONS[style], width, height);
      assert.ok(Object.values(pose).every(Number.isFinite), `${name}: finite transforms`);
      assert.ok(pose.alpha >= 0 && pose.alpha <= 1);
      assert.ok(pose.scaleX > 0 && pose.scaleY > 0);
      if (t >= 1) assert.equal(pose.alpha, 0, `${name}: disappears fully`);
      if (t === 0) assert.ok(pose.x === 0 && pose.y === 0 && pose.angle === 0, `${name}: starts in place`);
    }
  });
  if (style !== 'scatter') assert.equal(covered.size, width * height, `${name}: no missing artwork`);
  const f = fixture({ width, height });
  assert.equal(playMonsterDeath(f.context, f.sprite, name, 2, 3), true);
  assert.equal(f.sprite.destroyed, true);
  assert.equal(f.sprite.texture.firstFrame, '__BASE', `${name}: future spawns/icons retain the full texture`);
  assert.equal(f.images.length, parts.length);
  assert.equal(f.tweens.length, 1);
  assert.equal(f.tweens[0].duration, DEATH_DURATIONS[style]);
  f.images.forEach((image, i) => {
    const part = parts[i];
    assert.equal(image.x, 32 + part.x + part.width / 2, `${name}: no initial horizontal jump`);
    assert.equal(image.y, 48 - (height - 16) + part.y + part.height / 2, `${name}: preserves lifted origin`);
    assert.equal(image.depth, 55, 'fragments stay below fog/UI');
    assert.equal(image.tint, 0xffffff);
    assert.deepEqual(f.frames.get(image.frame), [0, 34 + part.x, 51 + part.y, part.width, part.height]);
  });
  f.tick(DEATH_DURATIONS[style] / 2);
  f.context.visibleTiles.clear(); f.tick(DEATH_DURATIONS[style] * 0.6);
  assert.ok(f.images.every(image => !image.visible), `${name}: leaving FOV hides fragments`);
  assert.equal(f.graphics.quads.length, 0, 'motes do not leak unseen deaths');
  f.context.visibleTiles.add('2,3'); f.tick(DEATH_DURATIONS[style] * 0.7);
  assert.ok(f.images.every(image => image.visible));
  f.tweens[0].onComplete(); f.events.emit('shutdown');
  assert.ok(f.images.every(image => image.destroyed));
  assert.equal(f.graphics.destroyed, true);
  assert.equal(f.events.listenerCount('shutdown'), 0);
  assert.equal(f.killed.filter(target => target === f.tweens[0].targets).length, 1, 'cleanup is idempotent');
}
// Character-specific motion, not merely different durations on the same fade.
const pose = (style, t, i = 0) => monsterDeathPose(style, monsterDeathParts(style, 16, 16)[i], i,
  t * DEATH_DURATIONS[style], 16, 16);
assert.ok(pose('topple', 0.5).angle > 70);
assert.ok(pose('crumple', 0.3).scaleY < 0.5 && pose('crumple', 0.3).angle > -30);
assert.ok(pose('slam', 0.4).angle < -80);
assert.ok(pose('robe', 0.7).scaleY < 0.2);
assert.ok(pose('melt', 0.7).scaleX > 1.5);
assert.ok(pose('belly-flop', 0.3).y < 0 && pose('belly-flop', 0.6).angle === 180);
assert.ok(pose('splinter', 0.3, 0).y < pose('splinter', 0.3, 1).y);
assert.ok(pose('dissolve', 0.5).y < 0 && pose('dissolve', 0.5).scaleY > 1);
assert.ok(pose('scatter', 0.5, 0).x < 0 && pose('scatter', 0.5, 1).x > 0);
assert.ok(pose('embers', 0.5).y < 0 && pose('embers', 0.5).scaleX < 1);
assert.ok(pose('shatter', 0.7).y > 0);
assert.notEqual(pose('discharge', 0.3).alpha, pose('discharge', 0.4).alpha);
assert.ok(pose('deflate', 0.7).scaleY < 0.2);
assert.ok(pose('illusion', 0.5, 0).x < 0 && pose('illusion', 0.5, 1).x > 0);
assert.ok(monsterDeathMotes('slam', DEATH_DURATIONS.slam / 2).length > 0);
assert.ok(monsterDeathMotes('robe', DEATH_DURATIONS.robe / 2).every(mote => mote.y < -4));

for (const action of ['shutdown', 'floor', 'level']) {
  const f = fixture(); playMonsterDeath(f.context, f.sprite, 'Wraith');
  if (action === 'shutdown') f.events.emit('shutdown');
  else { if (action === 'floor') f.context.floor++; else f.context.currentLevel = []; f.tick(100); }
  assert.ok(f.images.every(image => image.destroyed), `${action}: no effects leak into another floor`);
  assert.equal(f.graphics.destroyed, true);
  assert.equal(f.events.listenerCount('shutdown'), 0);
}
for (const hidden of [{ visible: false }, { alpha: 0 }]) {
  const f = fixture(); Object.assign(f.sprite, hidden);
  assert.equal(playMonsterDeath(f.context, f.sprite, 'Goblin'), true);
  assert.equal(f.images.length, 0); assert.equal(f.tweens.length, 0); assert.equal(f.sprite.destroyed, true);
}
{
  const f = fixture();
  assert.equal(playMonsterDeath({}, f.sprite, 'Goblin'), false);
  assert.equal(playMonsterDeath(f.context, f.sprite, 'Unknown'), false);
  assert.equal(f.sprite.destroyed, undefined);
}
{
  const f = fixture();
  playMonsterDeath(f.context, f.sprite, 'Ice Elemental');
  const frameCount = f.frames.size;
  f.tweens[0].onComplete();
  const nextSprite = { ...f.sprite, destroyed: false };
  playMonsterDeath(f.context, nextSprite, 'Ice Elemental');
  assert.equal(f.frames.size, frameCount, 'cached fragments are reused across kills');
  assert.equal(nextSprite.texture.firstFrame, '__BASE', 'repeated kills never change default art');
}
{
  const f = fixture({ scale: 0.7, flipX: true });
  playMonsterDeath(f.context, f.sprite, 'Swarm of Flies');
  assert.equal(f.images.length, 3, 'actual winged insects separate, not arbitrary squares');
  assert.equal(f.images[0].scaleX, 0.7, 'offspring keep their scale');
  assert.equal(f.images[0].x, 32 + (16 - 3.5) * 0.7, 'flipped fragment positions match the source');
}
{
  const f = fixture({ width: 24, height: 24, scale: 2 });
  f.context.visibleTiles = new Set(['1,3']);
  playMonsterDeath(f.context, f.sprite, 'Bone Lord', 2, 3,
    resolveFootprint({ width: 3, height: 3, anchor: 'center' }));
  assert.equal(f.images[0].visible, true, 'a visible boss edge is sufficient even when its centre is unseen');
}
// Real Entity removal and inherited Monster hook: rewards are immediate and
// restore-created instances need no constructor-only animation state.
{
  let rewards = 0, sounds = 0, reinforcements = 0;
  const { Entity, removeEntity } = loadLogic('src/games/rogue0/entity.ts', { sfx: { death() { sounds++; } } });
  const Monster = loadLogic('src/games/rogue0/monsters/monster.ts', { Entity }).default;
  const roster = [
    ['goblin', 'Goblin'], ['ghoul', 'Ghoul'], ['brute', 'Brute'], ['cultist', 'Cultist'],
    ['quloptsh', 'Quloptsh'], ['deadlyFrog', 'Deadly Frog'], ['mimic', 'Mimic'],
    ['wraith', 'Wraith'], ['swarmOfFlies', 'Swarm of Flies'], ['boss', 'Bone Lord'],
    ['elemental', 'Fire Elemental', 'FireElemental'], ['elemental', 'Ice Elemental', 'IceElemental'],
    ['elemental', 'Lightning Elemental', 'ShockElemental'],
  ];
  for (const [file, name, exportName = 'default'] of roster) {
    const Type = loadLogic(`src/games/rogue0/monsters/${file}.ts`, { Monster })[exportName];
    const f = fixture();
    const enemy = Object.create(Type.prototype);
    Object.assign(enemy, { context: f.context, type: 'enemy', name, x: 2, y: 3, sprite: f.sprite,
      onDestroy() { assert.equal(this.x, 2); rewards++; } });
    f.context.entities.push(enemy); f.context.onMonsterRemoved = () => { reinforcements++; };
    removeEntity(f.context, enemy); removeEntity(f.context, enemy);
    assert.equal(f.context.entities.length, 0); assert.equal(enemy.sprite, undefined);
    assert.equal(enemy.x, undefined); assert.equal(f.images.length > 0, true, `${name}: wired to real removal`);
    assert.equal(f.tweens.length, 1, 'no simultaneous default fade');
  }
  assert.deepEqual([rewards, sounds, reinforcements], [roster.length, roster.length, roster.length]);
  const Mirror = loadLogic('src/games/rogue0/monsters/mirrorImage.ts', { Entity, removeEntity }).default;
  const f = fixture(); const mirror = Object.create(Mirror.prototype);
  Object.assign(mirror, { context: f.context, name: 'Mirror Image', type: 'enemy', isDecoy: true, x: 2, y: 3, sprite: f.sprite });
  f.context.entities.push(mirror); removeEntity(f.context, mirror);
  assert.equal(f.images.length, 4);
  assert.equal(sounds, roster.length, 'illusion expiry never becomes a real monster death');
}
console.log('Monster deaths: 14 distinct styles, atlas cuts, motion, visibility, scaling, cleanup and removal integration passed.');
