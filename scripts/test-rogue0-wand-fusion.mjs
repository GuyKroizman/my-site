import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wand-fusion');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';

// The merge is renderer-independent. Use the actual Wand base and the fusion
// module, with tiny entity/presentation fakes for the parts that touch Phaser.
class EntityStub {
  x; y; context;
  level = 0;
  charges = 0;
  count = 1;
  type = 'item';
  equipSlot = 'junk';
  name = 'Item';
  get displayName() { return this.level > 0 ? `${this.name} +${this.level}` : this.name; }
  get isPhysicalEquipment() { return false; }
  init(context, x, y) {
    this.context = context;
    this.x = x;
    this.y = y;
  }
}

const dungeon = {
  log(context, text) { context.messages.push(text); },
  triggerArrowTrap() {},
};
const Phaser = { Math: { Between: (_min, max) => max } };
const Wand = load('src/games/rogue0/items/wand.ts', {
  Entity: EntityStub, Phaser, dungeon, identify: item => { item.identified = true; },
}).default;

class FireWand extends Wand {
  constructor(context, x, y) {
    super(context, {
      name: 'Wand of Firebolt', description: 'Fire.', tile: 1, attackTile: 2,
      damageType: 'fire', charges: 3,
    }, x, y);
  }
  get damageBounds() { return [3, 6]; }
  wandEffect() { return { id: 'burning', duration: 3 }; }
}
class FrostWand extends Wand {
  constructor(context, x, y) {
    super(context, {
      name: 'Wand of Frost', description: 'Frost.', tile: 3, attackTile: 4,
      damageType: 'ice', charges: 3,
    }, x, y);
  }
  get damageBounds() { return [2, 5]; }
  wandEffect() { return { id: 'frozen', duration: 1 }; }
}

function removeEntity(context, entity) {
  const index = context.entities.indexOf(entity);
  if (index >= 0) context.entities.splice(index, 1);
  entity.onDestroy?.();
  entity.x = undefined;
  entity.y = undefined;
}
const placeFloorItem = () => {};
const clearFloorSprite = () => {};
const fuseModule = load('src/games/rogue0/wandFusion.ts', {
  Entity: EntityStub, Wand, dungeon, removeEntity, placeFloorItem, clearFloorSprite,
});
const { tryFuseWands, canFuseWands } = fuseModule;

function context() {
  return { messages: [], entities: [], visibleTiles: new Set(), simulationTime: 5, floor: 1 };
}
function wand(Type, context, x, y, level = 0) {
  const item = new Type(context, x, y);
  item.level = level;
  item.fusionCount = 1;
  item.maxCharges = item.baseMaxCharges + level;
  item.charges = item.maxCharges;
  context.entities.push(item);
  return item;
}

// Two matching horizontal floor wands immediately left of the splash fuse into
// one wand at the right-hand tile with doubled damage and charge capacity.
{
  const ctx = context();
  const left = wand(FireWand, ctx, 5, 4);
  const right = wand(FireWand, ctx, 6, 4);
  const before = right.damage();
  right.charges = 2; left.charges = 2;
  const result = tryFuseWands(ctx, 7, 4);
  assert.ok(result, 'adjacent matching wands fuse');
  assert.equal(result.wand, right, 'the right-hand wand is the survivor');
  assert.equal(ctx.entities.includes(left), false, 'the left-hand wand is consumed');
  assert.equal(ctx.entities.includes(right), true);
  assert.equal(right.x, 6);
  assert.equal(right.y, 4);
  assert.equal(right.fusionCount, 2);
  assert.equal(right.fusionPower, 2);
  assert.equal(right.maxCharges, 6, 'two three-charge wands hold six charges');
  assert.equal(right.charges, 4, 'remaining charges combine instead of resetting');
  assert.equal(right.damage(), before * 2, 'the fused wand deals twice the damage');
  assert.match(right.displayName, /×2$/);
  assert.match(right.baseDescription, /multiplied by 2/);
  assert.ok(ctx.messages.some(line => /fuse the wands into Wand of Firebolt ×2/.test(line)));
  assert.equal(result.leftX, 5);
  assert.equal(result.rightX, 6);
}

// Upgrades are preserved, never averaged away.
{
  const ctx = context();
  wand(FireWand, ctx, 2, 2, 0);
  const right = wand(FireWand, ctx, 3, 2, 4);
  tryFuseWands(ctx, 4, 2);
  assert.equal(right.level, 4);
  assert.equal(right.maxCharges, 14, '(3 base + 4 upgrades) × 2');
  assert.equal(right.damage(), (6 + 4) * 2);
}

// A third fusion can combine two already-fused copies, doubling again.
{
  const ctx = context();
  const left = wand(FireWand, ctx, 8, 8);
  const right = wand(FireWand, ctx, 9, 8);
  left.fusionCount = right.fusionCount = 2;
  left.reconcileChargeScaling();
  right.reconcileChargeScaling();
  left.charges = right.charges = 3;
  tryFuseWands(ctx, 10, 8);
  assert.equal(right.fusionCount, 4);
  assert.equal(right.maxCharges, 12);
}

// Mixed fusion tiers and upgrade levels combine additively: a ×2 wand fused
// with an ordinary ×1 wand becomes a ×3 wand instead of being rejected.
{
  const ctx = context();
  const left = wand(FireWand, ctx, 4, 6, 3);
  left.fusionCount = 2;
  left.reconcileChargeScaling();
  left.charges = left.maxCharges; // (3 base + 3 upgrades) × 2 = 12
  const right = wand(FireWand, ctx, 5, 6, 0);
  right.identified = true;
  right.charges = 2;
  const result = tryFuseWands(ctx, 6, 6);
  assert.ok(result, 'a fused wand and an ordinary one of the same type fuse');
  assert.equal(result.wand, right, 'the right-hand wand is still the survivor');
  assert.equal(ctx.entities.includes(left), false);
  assert.equal(result.power, 3, 'fusion power adds up');
  assert.equal(right.fusionCount, 3);
  assert.equal(right.fusionPower, 3);
  assert.equal(right.level, 3, 'the higher upgrade level survives');
  assert.equal(right.maxCharges, 18, '(3 base + 3 upgrades) × 3');
  assert.equal(right.charges, 14, 'charges combine and cap at the new capacity');
  assert.equal(right.damage(), (6 + 3) * 3, 'damage scales with the summed power');
  assert.match(right.displayName, /×3$/);
  assert.ok(ctx.messages.some(line => /Wand of Firebolt \+3 ×3/.test(line)));
}

// The reverse pairing (ordinary on the left, ×2 on the right) fuses too, and
// two different fused tiers keep adding: ×4 + ×2 makes ×6.
{
  const ctx = context();
  const left = wand(FrostWand, ctx, 7, 3, 1);
  const right = wand(FrostWand, ctx, 8, 3, 0);
  right.fusionCount = 2;
  right.reconcileChargeScaling();
  right.charges = 1;
  assert.ok(tryFuseWands(ctx, 9, 3));
  assert.equal(right.fusionCount, 3);
  assert.equal(right.level, 1, 'the upgraded left wand still lends its level');
  assert.equal(right.maxCharges, 12, '(3 base + 1 upgrade) × 3');
  assert.equal(right.charges, 5, 'four charges plus one carried over');

  const secondCtx = context();
  const four = wand(FrostWand, secondCtx, 2, 9);
  const two = wand(FrostWand, secondCtx, 3, 9);
  four.fusionCount = 4;
  two.fusionCount = 2;
  four.reconcileChargeScaling();
  two.reconcileChargeScaling();
  assert.ok(tryFuseWands(secondCtx, 4, 9));
  assert.equal(two.fusionCount, 6);
  assert.equal(two.maxCharges, 18);
}

// Pair shape and type must still match exactly: no merging of different wand
// types, however their tiers line up, and no vertical pair or gap.
{
  const ctx = context();
  const left = wand(FireWand, ctx, 5, 5);
  left.fusionCount = 2;
  const wrongType = wand(FrostWand, ctx, 6, 5);
  wrongType.fusionCount = 1;
  assert.equal(canFuseWands(left, wrongType), false, 'different wand types never fuse');

  const same = new FireWand(ctx, 6, 5);
  same.fusionCount = 1;
  assert.equal(canFuseWands(left, same), true, 'mixed tiers of one type can fuse');
  same.x = 7;
  assert.equal(canFuseWands(left, same), false, 'horizontal pairs must be adjacent');
  same.x = 6; same.y = 6;
  assert.equal(canFuseWands(left, same), false, 'vertical pairs do not fuse');
  same.x = 6; same.y = 5;
  assert.equal(tryFuseWands(ctx, 9, 5), undefined, 'splash must be next to the pair');
  assert.equal(ctx.entities.length, 2, 'failed attempts consume nothing');
}

// A real thrown Liquid Flame flask consumes itself, calls the presentation
// hook and fuses the pair. Other potions must keep their old landing behavior.
{
  const Hero = load('src/games/rogue0/classes/basicHero.ts', {
    Entity: EntityStub, Wand, dungeon, removeEntity, tryFuseWands,
    tiles: { getFeature: () => undefined },
  }).default;
  const ctx = context();
  const left = wand(FireWand, ctx, 2, 3);
  const right = wand(FireWand, ctx, 3, 3);
  const potion = {
    name: 'Potion of Liquid Flame', consumable: true, type: 'item',
    displayName: 'Potion of Liquid Flame',
  };
  ctx.entities.push(potion);
  const events = [];
  ctx.onLiquidFlameShatter = event => events.push(event);
  const hero = Object.assign(Object.create(Hero.prototype), { context: ctx });
  hero.placeItemOnGround = () => assert.fail('Liquid Flame must shatter, not land');
  hero.resolveThrowLanding(potion, 4, 3);
  assert.equal(ctx.entities.includes(potion), false, 'the flask is consumed');
  assert.equal(ctx.entities.includes(left), false, 'the fire fused the pair');
  assert.equal(right.fusionCount, 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].x, 4);
  assert.equal(events[0].fusion.wand, right);

  // A mismatched pair is left untouched; the flask still shatters and the
  // callback still runs so the flame burst is shown.
  const failedContext = context();
  const fire = wand(FireWand, failedContext, 2, 3);
  const frost = wand(FrostWand, failedContext, 3, 3);
  const failedPotion = {
    name: 'Potion of Liquid Flame', consumable: true, type: 'item',
    displayName: 'Potion of Liquid Flame',
  };
  failedContext.entities.push(failedPotion);
  const failedEvents = [];
  failedContext.onLiquidFlameShatter = event => failedEvents.push(event);
  const failedHero = Object.assign(Object.create(Hero.prototype), { context: failedContext });
  failedHero.resolveThrowLanding(failedPotion, 4, 3);
  assert.equal(failedContext.entities.includes(failedPotion), false);
  assert.equal(failedContext.entities.includes(fire), true, 'different types do not merge');
  assert.equal(failedContext.entities.includes(frost), true);
  assert.equal(failedEvents.length, 1);
  assert.equal(failedEvents[0].fusion, undefined);
  assert.ok(failedContext.messages.some(line => /shatters on the floor/.test(line)));
}

// Browser saves retain fusion power without adding a new save version, and
// older wands without the field still reconcile as ordinary singles.
{
  const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
  const registry = { fireWand: FireWand };
  const ctx = context();
  const wandItem = wand(FireWand, ctx, 3, 3);
  wandItem.fusionCount = 2;
  wandItem.reconcileChargeScaling();
  wandItem.charges = 5;
  const graph = JSON.parse(JSON.stringify(encodeGraph({ wand: wandItem }, registry)));
  const loadedContext = context();
  const restored = decodeGraph(graph, registry, item => { item.context = loadedContext; }).wand;
  assert.equal(restored.fusionCount, 2);
  assert.equal(restored.maxCharges, 6);
  assert.equal(restored.charges, 5);
  assert.equal(restored.damage(), 12, 'restored fused wands stay doubled');
  delete restored.fusionCount;
  restored.reconcileChargeScaling();
  assert.equal(restored.maxCharges, 3, 'pre-fusion saves load as ordinary wands');
}

// Visual presentation: the burst is clipped to the tile, both ghost wands
// converge, the merged sprite fades in and every object cleans up. The module
// never advances world time.
{
  const source = fs.readFileSync('src/games/rogue0/wandFusionVisuals.ts', 'utf8')
    .replace(/^import.*;\n/gm, '');
  const exports = {};
  new Function('exports', ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(exports);
  const { showLiquidFlameShatter, clearWandFusionVisuals } = exports;

  const makeScene = () => {
    const tweens = [], sprites = [], graphics = [];
    const scene = {
      tweens: {
        add(config) { tweens.push(config); return { stop() { config.stopped = true; } }; },
        killTweensOf() {},
      },
      add: {
        sprite(x, y, texture, frame) {
          const sprite = {
            x, y, texture, frame, alpha: 1, scaleX: 1, scaleY: 1, destroyed: false,
            setOrigin() { return this; }, setDepth(depth) { this.depth = depth; return this; },
            setAlpha(alpha) { this.alpha = alpha; return this; },
            setScale(scale) { this.scaleX = this.scaleY = scale; return this; },
            destroy() { this.destroyed = true; },
          };
          sprites.push(sprite); return sprite;
        },
        graphics() {
          const g = {
            depth: 0, rects: [], alpha: 1, scaleX: 1, scaleY: 1, destroyed: false,
            setDepth(depth) { this.depth = depth; return this; },
            setPosition(x, y) { this.x = x; this.y = y; return this; },
            clear() { this.rects = []; this.circles = 0; return this; },
            fillStyle(color, alpha) { this.color = color; this.alphaValue = alpha; return this; },
            fillRect(...args) { this.rects.push(args); return this; },
            fillCircle() { this.circles = (this.circles ?? 0) + 1; return this; },
            destroy() { this.destroyed = true; },
          };
          graphics.push(g); return g;
        },
      },
    };
    return { scene, tweens, sprites, graphics };
  };

  const visibleContext = { visibleTiles: new Set(['4,3']), simulationTime: 12 };
  const plain = makeScene();
  showLiquidFlameShatter(plain.scene, visibleContext, { x: 4, y: 3 });
  assert.equal(plain.graphics[0].depth, 98, 'fire stays below fog');
  assert.ok(plain.graphics[0].rects.length > 0);
  const firstRects = JSON.stringify(plain.graphics[0].rects);
  plain.tweens[0].targets.t = 0.7;
  plain.tweens[0].onUpdate();
  assert.notEqual(JSON.stringify(plain.graphics[0].rects), firstRects, 'flames animate');
  for (const [x, y, w, h] of plain.graphics[0].rects) {
    assert.ok(x >= 64 && y >= 48 && x + w <= 80 && y + h <= 64,
      'burst stays inside the impact tile');
  }
  plain.tweens[0].onComplete();
  assert.equal(plain.graphics[0].destroyed, true);
  clearWandFusionVisuals(plain.scene);

  const hidden = makeScene();
  const mergedSprite = hidden.scene.add.sprite(96, 48, 'wand-fire', 0);
  const merged = {
    type: 'item', fusionCount: 2, sprite: mergedSprite,
    spriteTextureKey: 'wand-fire', spriteFrame: 0,
  };
  showLiquidFlameShatter(hidden.scene, visibleContext, {
    x: 4, y: 3,
    fusion: { wand: merged, impactX: 4, impactY: 3, leftX: 2, leftY: 3, rightX: 3, rightY: 3, power: 2 },
  });
  assert.equal(mergedSprite.alpha, 0, 'the real wand waits for the ghosts');
  assert.equal(hidden.sprites.filter(s => s !== mergedSprite).length, 2, 'two ghost wands carry the animation');
  assert.ok(hidden.sprites.filter(s => s !== mergedSprite).every(s => s.depth === 98));
  hidden.tweens[1].onComplete();
  hidden.tweens[2].onComplete();
  assert.equal(mergedSprite.alpha, 0.85, 'the merged wand appears at the meeting point');
  assert.equal(hidden.sprites.filter(s => s !== mergedSprite && s.destroyed).length, 2, 'ghosts are removed');
  const burstTween = hidden.tweens.at(-1);
  const revealTween = hidden.tweens.at(-2);
  assert.equal(revealTween.targets, mergedSprite);
  assert.equal(revealTween.alpha, 1, 'the reveal ends fully opaque');
  mergedSprite.alpha = revealTween.alpha;
  revealTween.onComplete();
  assert.equal(mergedSprite.alpha, 1);
  burstTween.onComplete();
  assert.equal(visibleContext.simulationTime, 12, 'presentation never advances world time');
  clearWandFusionVisuals(hidden.scene);
  clearWandFusionVisuals(hidden.scene);
  assert.equal(mergedSprite.alpha, 1, 'cleanup restores an interrupted merged sprite');
}

console.log('Rogue0 wand fusion: fire-potion trigger, pair rules, additive tiers, persistence-facing state and animation passed');
