import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('quickslots');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
const { foregroundEntities, createForegroundAtlas } = load('src/games/rogue0/rendering.ts');
// Match Phaser's Texture-input behavior: addSpriteSheet keeps the source key.
const textures = new Map();
const pixels = new Uint8ClampedArray([71, 45, 60, 255, 207, 198, 184, 255]);
const originalDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => ({
  drawImage() {}, getImageData: () => ({ data: pixels }), putImageData() {},
}) }) };
try {
  createForegroundAtlas({ textures: {
    exists: key => textures.has(key),
    get: () => ({ getSourceImage: () => ({ width: 2, height: 1 }) }),
    addCanvas(key) { const texture = { key }; textures.set(key, texture); return texture; },
    addSpriteSheet(_key, texture, config) { texture.config = config; return texture; },
  } });
  assert.ok(textures.get('foreground-tiles')?.config, 'foreground key must contain sprite-sheet frames');
  assert.equal(pixels[3], 0, 'legacy backdrop is transparent');
  assert.equal(pixels[7], 255, 'sprite artwork stays opaque');
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
const scrollOnFloor = { type: 'item', x: 2, y: 3 };
const potionOnFloor = { type: 'item', x: 2, y: 3 };
const monsterOnFloor = { type: 'enemy', x: 2, y: 3 };
const playerOnFloor = { type: 'player', x: 2, y: 3 };
assert.deepEqual([...foregroundEntities([scrollOnFloor, potionOnFloor])], [scrollOnFloor]);
assert.deepEqual([...foregroundEntities([scrollOnFloor, monsterOnFloor, potionOnFloor])], [monsterOnFloor]);
assert.deepEqual([...foregroundEntities([monsterOnFloor, scrollOnFloor])], [monsterOnFloor]);
assert.deepEqual([...foregroundEntities([scrollOnFloor, playerOnFloor], playerOnFloor)], [playerOnFloor]);
assert.deepEqual([...foregroundEntities([potionOnFloor])], [potionOnFloor]);
assert.equal(foregroundEntities([{ type: 'item' }]).size, 0);
assert.equal(foregroundEntities([scrollOnFloor, { type: 'item', x: 4, y: 3 }]).size, 2);
const { Entity } = load('src/games/rogue0/entity.ts');
for (const colour of ['red', 'green', 'blue', 'gold', 'purple']) {
  const potion = Object.assign(new Entity(), {
    name: 'Potion of Healing', type: 'item', equipSlot: 'consumable',
    identified: false, textureKey: `potion-${colour}`,
  });
  assert.equal(potion.unidentifiedTextureKey, potion.spriteTextureKey,
    'unidentified potion icons retain their floor colour in inventory and quickslots');
  assert.match(potion.displayName, /^Potion “.+”$/);
  assert.doesNotMatch(potion.displayName, /Healing/, 'colour must not reveal the potion effect');
  assert.equal(potion.identified, false);
  potion.identified = true;
  assert.equal(potion.spriteTextureKey, `potion-${colour}`);
  assert.equal(potion.displayName, 'Potion of Healing');
}
const genericPotion = Object.assign(new Entity(), { equipSlot: 'consumable', identified: false });
assert.equal(genericPotion.unidentifiedTextureKey, 'unknown-potion', 'missing art keeps a fallback icon');
const level = Array.from({length: 30}, () => Array(30).fill(0));
let clearSight = true;
let clearPath = true;
let intercepted;
const zaps = [];
const dungeon = { log() {}, getCurrentLevel: () => level,
  firstActorInPath: () => intercepted, entityAtTile: () => undefined,
  procWandCurse: () => false };
const Wand = load('src/games/rogue0/items/wand.ts', { Entity, dungeon, identify: i => { i.identified = true; } }).default;
for (const name of ['Wand of Firebolt', 'Wand of Frost', 'Wand of Lightning']) {
  const unknownWand = Object.assign(Object.create(Wand.prototype), {
    name, type: 'item', equipSlot: 'junk', identified: false, level: 0,
  });
  assert.match(unknownWand.displayName, /^Wand “.+” \?$/, 'backpack wands retain their category and hide the upgrade level');
  assert.equal(unknownWand.unidentifiedTextureKey, 'unknown-wand');
  unknownWand.identified = true;
  assert.equal(unknownWand.displayName, name);
  unknownWand.level = 2;
  assert.equal(unknownWand.displayName, `${name} +2`);
}
const Hero = load('src/games/rogue0/classes/basicHero.ts', {
  Entity, Wand, Gem: class {}, dungeon, hasLineOfSight: () => clearSight,
  hasClearProjectilePath: () => clearPath,
  isGrassConcealed: () => false,
  resolveAttack: () => ({ hit: false, damage: 0, appliedEffects: [] }),
  getFeature: () => 'floor',
}).default;
const hero = Object.assign(Object.create(Hero.prototype), {
  backpack: [], quickslots: Array(4).fill(undefined),
  context: {
    onWandZap: zap => zaps.push(zap),
    entities: [],
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    scene: {
      input: {},
      add: { sprite: () => ({ setOrigin() { return this; }, setDepth() { return this; }, destroy() {} }) },
      tweens: { add: () => {} },
    },
  },
  x: 1, y: 1,
  canAct: () => true, refreshUI() {}, spendTurn() { this.turns++; }, turns: 0,
});
const weapon = { equipSlot: 'weapon' };
hero.weapon = weapon;
const wand = Object.assign(Object.create(Wand.prototype), {
  equipSlot: 'junk', charges: 2, maxCharges: 2, wandRange: 5, context: hero.context,
  wandDamage: () => 3, wandEffect: () => ({ id: 'burning' }), damageType: 'fire', level: 0,
});
const potion = { consumable: true };
hero.backpack.push(wand, potion);
assert.equal(hero.slotFor(wand), undefined);
assert.equal(hero.assignQuickslot(0, weapon), false);
assert.equal(hero.assignQuickslot(0, {}), false);
assert.equal(hero.assignQuickslot(4, wand), false);
assert.equal(hero.assignQuickslot(0, wand), true);
assert.equal(hero.assignQuickslot(1, potion), true);
hero.activateQuickslot(0);
assert.equal(hero.context.throwMode, true);
assert.equal(wand.charges, 2);
assert.equal(hero.turns, 0);
hero.activateQuickslot(0);
assert.equal(hero.context.throwMode, false, 'tapping the aiming wand with no enemy selected deselects it');
assert.equal(hero.zapping, false);
assert.equal(hero.context.throwItem, undefined);
assert.equal(wand.charges, 2, 'deselecting spends no charge');
assert.equal(hero.turns, 0, 'deselecting spends no turn');
assert.deepEqual(zaps, [], 'deselecting fires no zap');
hero.cancelThrow();
assert.equal(wand.charges, 2);
hero.activateQuickslot(0);
hero.throwAt(30, 30); // outside the map still cannot be targeted
assert.equal(wand.charges, 2);
assert.equal(wand.range(), Infinity, 'old saved wandRange=5 does not impose a cap');
clearSight = false; // beyond sight, but the bolt still has a clear path
hero.activateQuickslot(0);
hero.throwAt(25, 1);
assert.equal(wand.charges, 1, 'zapping past the edge of sight spends one charge');
assert.equal(hero.turns, 1);
clearSight = true;
// Reset the fixture counters so the remaining path checks start from a full wand.
wand.charges = 2; hero.turns = 0; hero.moving = false; zaps.length = 0;
clearPath = false;
hero.activateQuickslot(0);
hero.throwAt(25, 1);
assert.equal(wand.charges, 2, 'a blocked projectile path consumes no charge');
assert.equal(hero.turns, 0);
clearPath = true;
level[1][25] = 1;
hero.activateQuickslot(0);
hero.throwAt(25, 1);
assert.equal(wand.charges, 2, 'wall targets remain invalid');
level[1][25] = 0;
hero.beginThrow(potion);
hero.throwAt(25, 1);
assert.equal(hero.turns, 1, 'ordinary throws have no distance cap');
assert.equal(hero.backpack.includes(potion), false, 'a distant throw consumes the item');
assert.equal(hero.moving, true, 'a distant throw still waits on the projectile');
hero.activateQuickslot(0);
hero.throwAt(25, 1); // a distant empty tile consumes exactly one charge
assert.equal(wand.charges, 1);
assert.equal(hero.turns, 2);
assert.equal(hero.weapon, weapon);
assert.ok(hero.backpack.includes(wand));
hero.activateQuickslot(0);
hero.throwAt(25, 25); // diagonal shots also have no distance cap
assert.equal(wand.charges, 0);
hero.activateQuickslot(0);
assert.equal(hero.context.throwMode, false);
assert.equal(hero.turns, 3);
hero.backpack = [wand];
assert.equal(hero.quickslotItem(1), undefined);
const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', { Wand, Gem: class {} });
hero.context.player = hero;
const inventory = new InventoryWindow({}, hero.context);
inventory.render = () => {};
inventory.clearObjects = () => {};
inventory.chooseQuickslot(2);
inventory.openMenu(weapon);
assert.equal(inventory.isOpen(), true);
inventory.openMenu(wand);
assert.equal(inventory.isOpen(), false);
assert.equal(hero.quickslotItem(2), wand);
assert.equal(hero.turns, 3);
assert.ok(!inventory.buildActions(hero, wand).some(a => a.action === 'equip'));
assert.ok(inventory.buildActions(hero, wand).some(a => a.label === 'Zap'));
// Destructive/movement actions stay last for every inventory item category.
for (const [item, equipped, equippable, expected] of [
  [wand, false, false, ['use', 'drop', 'throw']],
  [{ consumable: true }, false, false, ['use', 'drop', 'throw']],
  [{}, false, true, ['equip', 'drop', 'throw']],
  [{}, true, true, ['unequip', 'drop', 'throw']],
  [{ cursed: true }, true, true, ['unequip', 'drop', 'throw']],
  [{}, false, false, ['drop', 'throw']],
]) {
  const player = { slotOf: () => equipped ? 'weapon' : undefined,
    slotFor: () => equippable ? 'weapon' : undefined };
  const actions = inventory.buildActions(player, item);
  assert.deepEqual(actions.map(action => action.action), expected);
  assert.deepEqual(actions.slice(-2).map(action => action.label), ['Drop', 'Throw']);
  if (equipped && item.cursed) assert.ok(actions.every(action => !action.enabled), 'curses still block removal');
}
assert.deepEqual(zaps, [
  { fromX: 1, fromY: 1, toX: 25, toY: 1, damageType: 'fire' },
  { fromX: 1, fromY: 1, toX: 25, toY: 25, damageType: 'fire' },
], 'only valid casts emit projectiles, including shots at empty tiles');
intercepted = { type: 'enemy', x: 10, y: 1 };
wand.charges = 1;
hero.activateQuickslot(0);
hero.throwAt(25, 1);
assert.equal(zaps.at(-1).toX, 10, 'projectile stops at the first actor, even on a miss');
assert.equal(wand.charges, 0);
assert.equal(hero.turns, 4, 'visual callback does not add charge or action costs');

// A second tap on the aiming wand fires at the highlighted enemy. Opening the
// backpack (not a stray wand tap) is how the player changes their mind.
wand.charges = 2;
hero.turns = 0;
zaps.length = 0;
intercepted = undefined;
const goblin = { type: 'enemy', x: 6, y: 1, healthPoints: 5, displayName: 'goblin', sprite: {} };
hero.context.entities = [goblin];
hero.context.visibleTiles = new Set(['6,1']);
hero.activateQuickslot(0);
assert.equal(hero.context.throwMode, true);
assert.deepEqual([hero.context.cursorX, hero.context.cursorY], [6, 1], 'aim starts on the nearest visible enemy');
hero.activateQuickslot(0);
assert.equal(hero.context.throwMode, false, 'tapping the aiming wand again fires instead of cancelling');
assert.equal(wand.charges, 1, 'the confirming tap spends one charge');
assert.equal(hero.turns, 1, 'the confirming tap spends one turn');
assert.deepEqual(zaps.map(zap => [zap.toX, zap.toY]), [[6, 1]], 'the zap lands on the highlighted enemy');

hero.context.visibleTiles = new Set();
hero.activateQuickslot(0);
assert.equal(hero.context.throwMode, true);
inventory.openWindow();
assert.equal(hero.context.throwMode, false, 'opening the backpack abandons wand targeting');
assert.equal(hero.zapping, false);
assert.equal(hero.context.throwItem, undefined);
assert.equal(wand.charges, 1, 'abandoning a zap through the backpack spends no charge');
assert.equal(hero.turns, 1, 'abandoning a zap through the backpack spends no turn');
inventory.close();
// Exercise refresh output rather than grepping quickslotPane.ts for getters.
// Reuse the same icon to catch stale tint when a slot changes items.
const { QuickslotPane } = load('src/games/rogue0/quickslotPane.ts', { Wand });
let displayed;
const icon = {
  setVisible(value) { this.visible = value; },
  setTexture(key, frame) { this.key = key; this.frame = frame; },
  clearTint() { this.tint = undefined; },
  setTint(value) { this.tint = value; },
};
const label = { setText(value) { this.text = value; } };
const pane = Object.assign(Object.create(QuickslotPane.prototype), {
  context: { player: { quickslotItem: () => displayed } }, slots: [{ icon, label }],
});
for (const identified of [false, true]) {
  for (const [key, frame] of [['custom-item', 0], ['tiles', 123]]) {
    displayed = Object.freeze({ identified, count: 2, tint: 0xabc123,
      spriteTextureKey: key, spriteFrame: frame, unidentifiedTextureKey: 'wrong-placeholder' });
    pane.refresh();
    assert.deepEqual([icon.visible, icon.key, icon.frame, icon.tint, label.text],
      [true, key, frame, displayed.tint, '2']);
    displayed = { ...displayed, tint: undefined, count: 1 };
    pane.refresh();
    assert.equal(icon.tint, undefined, 'replacing a tinted item clears the old tint');
    assert.equal(label.text, '');
  }
}
displayed = Object.assign(Object.create(Wand.prototype), { charges: 3, count: 1 });
pane.refresh();
assert.equal(label.text, '3', 'wands show charges, not stack count');
displayed = undefined;
pane.refresh();
assert.equal(icon.visible, false, 'empty slot hides its previous item');
assert.equal(label.text, '+');
console.log('Rogue0 quickslot eligibility, selection, cleanup, item artwork and independent wand targeting/projectile events passed');
