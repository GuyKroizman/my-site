import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('item-upgrades');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inflateSync } from 'node:zlib';
import ts from 'typescript';

function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(exports, ...Object.values(bindings));
  return exports;
}
const { Entity, upgrade, identify, removeEntity, saveConsumableKnowledge, restoreConsumableKnowledge,
  rememberIdentifiedWandTypes } = load('src/games/rogue0/entity.ts', load('src/games/rogue0/rendering.ts'));
// Every category keeps its floor texture/frame/tint before and after identification.
for (const equipSlot of ['weapon', 'armor', 'ring', 'artifact', 'consumable', 'junk']) {
  for (const textureKey of [undefined, 'custom-item']) {
    for (const identified of [false, true]) {
      const item = Object.assign(new Entity(), {
        type: 'item', equipSlot, textureKey, identified, tile: 123, tint: 0xabc123,
      });
      let rendered;
      const sprite = { x: 32, y: 48, setOrigin() {}, setDepth() {} };
      item.init({
        map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
        scene: { add: { sprite(...args) { rendered = args; return sprite; } }, tweens: { add() {} } },
      }, 2, 3);
      assert.deepEqual(rendered, [32, 48, item.spriteTextureKey, item.spriteFrame]);
      assert.equal(sprite.tint, item.tint);
      assert.equal(item.identified, identified, 'drawing must not identify an item');
    }
  }
}
// All inventory surfaces must use those same getters, not generic unknown icons.
for (const file of ['inventoryWindow.ts', 'quickslotPane.ts']) {
  const source = fs.readFileSync(`src/games/rogue0/${file}`, 'utf8');
  assert.doesNotMatch(source, /unidentifiedTextureKey/, `${file} must preserve floor artwork`);
  assert.match(source, /item\.spriteTextureKey/);
  assert.match(source, /item\.spriteFrame/);
  assert.doesNotMatch(source, /item\.identified\s*&&\s*item\.tint/);
}
// Upgrading reveals physical stats, but must not identify the curse status.
const unknownGear = Object.assign(new Entity(), {
  context: { messages: [] }, type: 'item', equipSlot: 'weapon',
  name: 'Secret Sword', identified: false, level: 2, maxLevel: 3,
});
upgrade(unknownGear);
assert.equal(unknownGear.level, 3);
assert.equal(unknownGear.identified, false);
assert.equal(unknownGear.context.messages[0], `${unknownGear.displayName} upgraded.`);
upgrade(unknownGear);
assert.equal(unknownGear.context.messages[0], `${unknownGear.displayName} is already at its maximum level.`);
unknownGear.identified = true;
unknownGear.level = 1;
upgrade(unknownGear);
assert.equal(unknownGear.context.messages[0], 'Secret Sword upgraded to level 2.');

let maximum = false;
const Phaser = { Math: { Between: (min, max) => maximum ? max : min } };
const dungeon = { log(context, text) { context.messages.push(text); } };
const bindings = { Entity, upgrade, identify, removeEntity, Phaser, dungeon };
const itemClass = (name, extra = {}) => load(`src/games/rogue0/items/${name}.ts`, { ...bindings, ...extra }).default;
// Strength is permanent progression, independent of XP and attack buffs.
const { actionCost } = load('src/games/rogue0/timing.ts');
const Hero = load('src/games/rogue0/classes/basicHero.ts', {
  Entity, dungeon, sfx: { levelUp() {} },
}).default;
// Unknown names remain stable across instances and state changes; identical
// unknown consumables merge even when the backpack is already full.
const unknownItem = (name = 'Healing Potion') => Object.assign(new Entity(), {
  type: 'item', equipSlot: 'consumable', name, identified: false,
});
const firstUnknown = unknownItem();
const secondUnknown = unknownItem();
const label = firstUnknown.displayName;
assert.match(label, /^Potion “.+”$/);
assert.doesNotMatch(label, /Healing/);
assert.equal(secondUnknown.displayName, label);
assert.notEqual(unknownItem('Poison Potion').displayName, label);
secondUnknown.level = 2;
secondUnknown.x = 8;
secondUnknown.count = 3;
assert.equal(secondUnknown.displayName, label);
secondUnknown.level = 0;
const stackContext = { entities: [secondUnknown] };
const stackHero = {
  backpack: [firstUnknown], capacity: 1, context: stackContext,
  refreshUI() {},
};
assert.equal(Hero.prototype.addItem.call(stackHero, secondUnknown), true);
assert.equal(stackHero.backpack.length, 1);
assert.equal(firstUnknown.count, 4);
assert.equal(firstUnknown.displayName, label);
assert.equal(firstUnknown.identified, false);
assert.equal(stackContext.entities.length, 0);
stackContext.messages = [];
stackContext.entities.push(unknownItem('Poison Potion'));
assert.equal(Hero.prototype.addItem.call(stackHero, stackContext.entities[0]), false);
assert.equal(firstUnknown.count, 4, 'different unknown kinds must not merge');
firstUnknown.identified = true;
assert.equal(firstUnknown.displayName, 'Healing Potion');

const strengthContext = {
  messages: [], entities: [],
  scene: { input: { on() {}, keyboard: { on() {} } } },
};
const hero = new Hero(strengthContext);
strengthContext.player = hero;
assert.equal(hero.strength, 10);
const attackBefore = hero.baseAttack;
const strengthPotion = new (itemClass('PotionOfStrength'))(strengthContext);
hero.removeItem = () => {};
strengthPotion.equip();
assert.equal(hero.strength, 11);
assert.equal(hero.baseAttack, attackBefore, 'Strength is not raw attack');
hero.gainXp(hero.xpForNextLevel());
assert.equal(hero.strength, 11, 'XP must not increase Strength');
const heavy = new (itemClass('sword'))(strengthContext);
heavy.tier = 3;
hero.weapon = heavy;
assert.equal(heavy.requiredStrength, 14);
assert.equal(hero.strengthDeficit(heavy), 3);
assert.equal(hero.effectiveAccuracy, hero.accuracy / 1.2 ** 3);
assert.equal(actionCost(hero, 'attack', 0.75), 0.75 * 1.2 ** 3);
assert.equal(actionCost(hero, 'move'), 1, 'weapon weight does not slow walking');
assert.equal(actionCost(hero, 'use'), 1);
for (const [level, requirement] of [[0,14], [1,13], [2,13], [3,12], [5,12], [6,11], [10,10]]) {
  heavy.level = level;
  assert.equal(heavy.requiredStrength, requirement);
  assert.equal(heavy.tier, 3, 'upgrading never changes tier');
}
heavy.level = 0;
assert.match(heavy.strengthDescription(hero.strength), /Under-strength by 3/);
heavy.identified = false;
assert.match(heavy.strengthDescription(hero.strength), /Under-strength by 3/, 'physical requirements are visible before identification');
heavy.identified = true;
hero.strength = 14;
assert.equal(actionCost(hero, 'attack', 0.75), 0.75);
assert.equal(hero.effectiveAccuracy, hero.accuracy);
hero.strength = 10;
const heavyArmor = new (itemClass('shield'))(strengthContext);
heavyArmor.tier = 2;
hero.armor = heavyArmor;
hero.evasion = 20;
assert.equal(hero.effectiveEvasion, 20 / 1.2 ** 2);
assert.equal(actionCost(hero, 'move'), 1.2 ** 2);
hero.effects = [{ id: 'haste' }];
assert.equal(actionCost(hero, 'move'), 1.2 ** 2 / 2);
assert.equal(actionCost(hero, 'wait'), 1, 'weight does not change world-time ticks');
assert.equal(new Entity().requiredStrength, 0, 'nonphysical items are exempt');
const { resolveAttack } = load('src/games/rogue0/combat.ts', { hasEffect: () => false });
const defender = Object.assign(new Entity(), {
  name: 'Target', attack: () => 1, protection: () => 0,
});
const oldRandom = Math.random;
try {
  Math.random = () => 0.7;
  hero.strength = 10;
  assert.equal(resolveAttack(strengthContext, hero, defender).hit, false,
    'combat actually uses under-strength accuracy');
  hero.strength = 14;
  assert.equal(resolveAttack(strengthContext, hero, defender).hit, true,
    'meeting the requirement restores accuracy');
} finally {
  Math.random = oldRandom;
}

const Shield = itemClass('shield');
const Gem = itemClass('gem', { Shield });
const Wand = itemClass('wand');
const ScrollOfUpgrade = itemClass('ScrollOfUpgrade', { Wand });
const Ring = itemClass('ring');
// Wands have distinct, stable aliases and identification is knowledge of a type,
// not a single copy. This also covers browser persistence and legacy local flags.
{
  const types = ['WandOfFirebolt', 'WandOfFrost', 'WandOfLightning'].map(name => itemClass(name, { Wand }));
  const ctx = { messages: [] };
  const originals = types.map(Type => new Type(ctx));
  const labels = originals.map(item => item.unidentifiedName);
  assert.equal(new Set(labels).size, types.length, 'different wand types never share an alias');
  for (const [i, Type] of types.entries()) {
    const copy = new Type(ctx);
    copy.level = 3; copy.charges = 0; copy.x = 9; copy.y = 7;
    assert.equal(copy.unidentifiedName, labels[i], 'upgrades, charges and floor locations never change a type alias');
    assert.equal(copy.spriteTextureKey, originals[i].textureKey, 'wand labels never replace the actual texture');
  }
  const Lightning = types[2];
  const sibling = new Lightning(ctx);
  sibling.level = 2;
  const offFloor = new Lightning(ctx); offFloor.x = 3; offFloor.y = 8;
  assert.equal(sibling.identified, false);
  originals[2].damage(); // First zap discovers the type.
  for (const copy of [originals[2], sibling, offFloor, new Lightning(ctx)]) assert.equal(copy.identified, true);
  assert.equal(sibling.displayName, 'Wand of Lightning +2');
  assert.equal(originals[0].identified, false);
  assert.equal(originals[1].identified, false);
  assert.equal(new Lightning({ messages: [] }).identified, false, 'separate runs do not share knowledge');
  const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
  const registry = Object.fromEntries(types.map((Type, i) => [`wand${i}`, Type]));
  const state = { items: [...originals, sibling, offFloor], knowledge: saveConsumableKnowledge(ctx) };
  const loadedContext = { messages: [] };
  const restored = decodeGraph(JSON.parse(JSON.stringify(encodeGraph(state, registry))), registry,
    item => { item.context = loadedContext; });
  restoreConsumableKnowledge(loadedContext, restored.knowledge);
  assert.equal(restored.items[3].identified, true);
  assert.equal(restored.items[4].identified, true);
  assert.equal(new Lightning(loadedContext).identified, true, 'future finds stay identified after reload');
  assert.equal(restored.items[0].identified, false);
  assert.deepEqual(restored.items.slice(0, 3).map(item => item.unidentifiedName), labels);
  // Old saves recorded identification only on the original instance. A known
  // copy on another floor must seed the shared knowledge without log spam.
  const legacyContext = { messages: [] };
  const known = new Lightning(legacyContext); known.identified = true;
  const unknown = new Lightning(legacyContext);
  restoreConsumableKnowledge(legacyContext, { appearances: [], known: [] });
  rememberIdentifiedWandTypes(legacyContext, [unknown, known]);
  assert.equal(unknown.identified, true);
  assert.equal(new Lightning(legacyContext).identified, true);
  assert.deepEqual(legacyContext.messages, []);
}
// Scrolls always request a target, even with one eligible item. Cancelling is
// free; confirmation upgrades only that item and consumes one stacked scroll.
{
  const TargetHero = load('src/games/rogue0/classes/basicHero.ts', { Entity, dungeon, Wand, Gem }).default;
  const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', { Wand, Gem });
  const ctx = { messages: [], entities: [], scene: { input: { enabled: true } } };
  let ready = true, spent = 0;
  const sword = new (itemClass('sword'))(ctx);
  const scroll = new ScrollOfUpgrade(ctx);
  scroll.count = 2;
  const owned = [sword, scroll];
  ctx.entities = [...owned];
  const player = Object.assign(Object.create(TargetHero.prototype), {
    context: ctx, weapon: sword, canAct: () => ready, getAllItems: () => owned,
    spendTurn(action) { assert.equal(action, 'use'); spent++; ready = false; },
    refreshUI() {}, removeItem(item) {
      if (item.count > 1) item.count--;
      else owned.splice(owned.indexOf(item), 1);
    },
  });
  ctx.player = player;
  const picker = new InventoryWindow({}, ctx);
  picker.render = () => {};
  picker.clearObjects = () => {};
  assert.equal(player.useItem(scroll), false);
  assert.equal(picker.targetedItem, scroll, 'single eligible item still opens selection');
  assert.equal(picker.isOpen(), true);
  assert.equal(sword.level, 0);
  picker.dismiss();
  assert.equal(scroll.count, 2);
  assert.equal(scroll.identified, false, 'cancel does not identify or consume');
  assert.equal(spent, 0);
  const backpackSword = new (itemClass('longSword'))(ctx);
  owned.push(backpackSword);
  player.useItem(scroll);
  picker.openMenu(backpackSword);
  assert.equal(backpackSword.level, 1, 'selected backpack item is upgraded');
  assert.equal(sword.level, 0, 'equipped weapon is not chosen automatically');
  assert.equal(scroll.count, 1);
  assert.ok(ctx.entities.includes(scroll), 'remaining stacked scroll stays live');
  assert.equal(scroll.identified, true);
  assert.equal(spent, 1);
  assert.equal(picker.isOpen(), false);
  assert.equal(scroll.useOnItem(sword), false, 'cannot confirm outside your turn');
  ready = true;
  assert.equal(scroll.canTargetItem(new (itemClass('sword'))(ctx)), false, 'unowned items rejected');
  assert.equal(scroll.canTargetItem(scroll), false);
  backpackSword.maxLevel = backpackSword.level;
  assert.equal(scroll.useOnItem(backpackSword), false, 'capped items do not waste scrolls');
  sword.maxLevel = sword.level;
  assert.equal(player.useItem(scroll), false);
  assert.equal(picker.isOpen(), false, 'no eligible targets keeps picker closed');
  assert.equal(scroll.count, 1);
  assert.equal(spent, 1);
  sword.maxLevel = Infinity;
  player.useItem(scroll);
  picker.openMenu(sword);
  assert.equal(sword.level, 1);
  assert.equal(spent, 2);
  assert.ok(!owned.includes(scroll) && !ctx.entities.includes(scroll), 'last scroll is removed');
  ready = true;
  assert.equal(scroll.useOnItem(sword), false, 'spent scroll cannot be reused');
  const wand = new (itemClass('WandOfFrost', { Wand }))(ctx);
  const ring = new (itemClass('RingOfMight', { Ring }))(ctx);
  const artifact = Object.assign(new Entity(), { equipSlot: 'artifact' });
  owned.push(wand, ring, artifact);
  assert.equal(scroll.canTargetItem(wand), true, 'backpack wands are eligible');
  assert.equal(scroll.canTargetItem(ring), true, 'rings are eligible');
  assert.equal(scroll.canTargetItem(artifact), false, 'artifacts retain their own progression');
}
const equipment = [
  ['sword', 1, 5], ['axe', 2, 7], ['longSword', 4, 8], ['hammer', 3, 8],
  ['scrolloffireball', 1, 4], ['scrolloflightning', 1, 2],
];
function contextFor(target) {
  const context = target.context;
  const items = [target];
  context.entities = [];
  context.player = {
    weapon: target.equipSlot === 'weapon' ? target : undefined,
    armor: target.equipSlot === 'armor' ? target : undefined,
    canAct: () => true, getAllItems: () => items,
    removeItem(item) { items.splice(items.indexOf(item), 1); },
    spendTurn(action) { assert.equal(action, 'use'); }, refreshUI() {},
  };
  return items;
}
for (const [name, min, max] of equipment) {
  const item = new (itemClass(name))({ messages: [] });
  const items = contextFor(item);
  for (let level = 0; level <= 3; level++) {
    assert.equal(item.level, level, name);
    const maxGain = equipment.slice(0, 4).some(([weapon]) => weapon === name) ? item.tier + 1 : 1;
    assert.ok(item.displayDescription.includes(`between ${min + level} and ${max + maxGain * level} damage`), name);
    maximum = false; assert.equal(item.damage(), min + level, name);
    maximum = true; assert.equal(item.damage(), max + maxGain * level, name);
    if (item.range()) assert.ok(item.displayDescription.includes(`Range is ${item.range()} tiles`));
    if (level === 0) {
      const gem = new Gem(item.context); items.push(gem);
      assert.equal(gem.enchant(item), true);
    } else if (level === 1) {
      const scroll = new ScrollOfUpgrade(item.context); items.push(scroll);
      assert.equal(scroll.useOnItem(item), true);
    } else if (level === 2) upgrade(item);
  }
  identify(item);
  assert.equal(item.context.messages[0], `Identified: ${item.name}`);
}
// Every physical weapon and armor uses tier-sensitive upgrade gains, including
// legacy starting gear. Scroll spell damage must keep its separate flat curve.
for (let tier = 1; tier <= 5; tier++) {
  for (const [name, min, max] of equipment.slice(0, 4)) {
    const item = new (itemClass(name))({ messages: [] });
    item.tier = tier;
    for (let level = 0; level <= 5; level++) {
      assert.equal(item.level, level);
      maximum = false; assert.equal(item.damage(), min + level);
      maximum = true; assert.equal(item.damage(), max + (tier + 1) * level);
      assert.ok(item.baseDescription.includes(`+${tier + 1} maximum damage`));
      upgrade(item);
      assert.equal(item.tier, tier);
    }
  }
  const armor = new Shield({ messages: [] });
  armor.tier = tier;
  for (let level = 0; level <= 5; level++) {
    assert.equal(armor.protection(), 1 + tier * level);
    assert.ok(armor.baseDescription.includes(`Each upgrade adds ${tier} protection`));
    upgrade(armor);
    assert.equal(armor.tier, tier);
  }
}
const shield = new Shield({ messages: [] });
const shieldItems = contextFor(shield);
for (let level = 0; level <= 2; level++) {
  assert.equal(shield.protection(), 1 + level);
  assert.ok(shield.displayDescription.includes(`+${1 + level} protection`));
  if (level === 0) {
    const gem = new Gem(shield.context); shieldItems.push(gem); assert.equal(gem.enchant(shield), true);
  } else if (level === 1) {
    const scroll = new ScrollOfUpgrade(shield.context); shieldItems.push(scroll);
    assert.equal(scroll.useOnItem(shield), true);
  }
}
for (const [name, min, max] of [['WandOfFirebolt', 3, 6], ['WandOfFrost', 2, 5], ['WandOfLightning', 2, 6]]) {
  const wand = new (itemClass(name, { Wand }))({ messages: [] });
  wand.identified = true;
  for (let level = 0; level <= 3; level++) {
    wand.refill();
    const before = wand.charges;
    assert.ok(wand.displayDescription.includes(`between ${min + level} and ${max + level} damage`));
    assert.equal(wand.range(), Infinity);
    assert.ok(wand.displayDescription.includes('No distance limit'));
    assert.ok(!wand.displayDescription.includes('Infinity'));
    assert.equal(wand.charges, before, 'describing a wand must not consume charges');
    maximum = false; assert.equal(wand.damage(), min + level);
    maximum = true; assert.equal(wand.damage(), max + level);
    assert.ok(wand.displayDescription.includes('Charges: 1/3'));
    if (level < 3) upgrade(wand);
  }
}
const might = new (itemClass('RingOfMight', { Ring }))({ messages: [] });
const fang = new (itemClass('FangOfTheBeast'))({ messages: [] });
assert.equal(fang.spriteTextureKey, 'fang-of-the-beast');
assert.equal(fang.spriteFrame, 0);
assert.equal(fang.unidentifiedTextureKey, fang.spriteTextureKey);
for (let level = 0; level <= 3; level++) {
  for (const item of [might, fang]) {
    assert.ok(item.displayDescription.includes(`+${2 + level} damage`));
    const before = item.level;
    for (let i = 0; i < 20; i++) void item.displayDescription;
    assert.equal(item.level, before, 'descriptions must not level artifacts');
    if (level < 3) upgrade(item);
  }
}
assert.equal(fang.strikes, 0);

let effect;
const Chalice = itemClass('ChaliceOfBlood', {
  applyEffect(_player, value) { effect = value; },
  removeEffect(_player, id) { assert.equal(id, 'chalice-regeneration'); effect = undefined; },
});
const context = { messages: [], player: { name: 'Elf', healthPoints: 99, maxHealthPoints: 100 } };
const chalice = new Chalice(context);
// Artifact identity is visible independently of identification and curse state.
for (const artifact of [chalice, fang]) {
  const original = { identified: artifact.identified, cursed: artifact.cursed };
  for (const cursed of [false, true]) {
    artifact.identified = false;
    artifact.cursed = cursed;
    const suffix = artifact.level > 0 ? ` +${artifact.level}` : '';
    assert.equal(artifact.displayName, `${artifact.name}${suffix}`);
    assert.equal(artifact.isRecognizableEquipment, true);
    assert.equal(artifact.isPhysicalEquipment, false, 'artifacts do not gain physical tiers');
    assert.equal(artifact.identified, false, 'recognizing an artifact does not identify it');
    assert.doesNotMatch(artifact.displayName, /cursed|Tier|“/);
  }
  Object.assign(artifact, original);
}
assert.equal(chalice.spriteTextureKey, 'chalice-of-blood');
assert.equal(chalice.spriteFrame, 0);
assert.equal(chalice.unidentifiedTextureKey, chalice.spriteTextureKey);
chalice.equip();
assert.equal(chalice.identified, true);
function healingTick(missing = 10) {
  context.player.healthPoints = context.player.maxHealthPoints - missing;
  effect.tick(context.player, context);
}
// Use the actual monster death callback, including its XP/kill accounting.
const Monster = load('src/games/rogue0/monsters/monster.ts', { Entity, dungeon, Phaser }).default;
const monster = Object.assign(Object.create(Monster.prototype), {
  context, name: 'Rat', xpValue: 1, loot: [], gold: 0,
});
context.player.gainXp = () => {};
monster.onDestroy();
assert.ok(chalice.displayDescription.includes('0/5 monster kills'), 'unequipped kills do not count');
context.player.artifact = chalice;
for (let level = 1; level <= 10; level++) {
  assert.equal(chalice.level, level);
  assert.equal(chalice.healingInterval, 11 - level);
  healingTick(0); // Full health resets the healing clock.
  for (let turn = 1; turn < chalice.healingInterval; turn++) {
    healingTick();
    assert.equal(context.player.healthPoints, 90, 'no early healing');
  }
  healingTick();
  assert.equal(context.player.healthPoints, 91, 'heals exactly one HP');
  for (let i = 0; i < 100; i++) healingTick();
  assert.equal(chalice.level, level, 'healing never grants levels');
  if (level === 10) break;
  const threshold = 5 * level;
  assert.equal(chalice.killsToNextLevel, threshold);
  for (let i = 0; i < threshold - 1; i++) monster.onDestroy();
  assert.equal(chalice.level, level, 'must not level early');
  assert.ok(chalice.displayDescription.includes(`${threshold - 1}/${threshold} monster kills`));
  context.player.healthPoints = context.player.maxHealthPoints;
  monster.onDestroy(); // Kills count even at full health.
  assert.equal(chalice.level, level + 1);
}
for (let i = 0; i < 1000; i++) { monster.onDestroy(); healingTick(); }
assert.equal(chalice.level, 10);
assert.equal(context.player.healthPoints, 91);
assert.match(chalice.displayDescription, /Level 10\/10.*1 health every 1 world turn.*Maximum level reached/);
upgrade(chalice);
assert.equal(chalice.level, 10, 'generic upgrades must respect the artifact cap');
healingTick(1);
assert.equal(context.player.healthPoints, 100);
assert.ok(!context.messages.some(message => message.includes('regenerates')), 'passive chalice healing is silent');
chalice.unequip(); assert.equal(effect, undefined);

// Actual inventory cell renderer: backpack/unidentified and equipped/identified
// use the same custom goblet texture, never the old character atlas frame.
const drawn = [];
const shape = { setOrigin() { return this; }, setStrokeStyle() { return this; }, setInteractive() { return this; }, on() { return this; } };
const scene = { add: { rectangle: () => shape, sprite: (_x, _y, key, frame = 0) => { drawn.push([key, frame]); return shape; } } };
const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', { Gem, Wand, attachTooltip() {} });
const inventory = new InventoryWindow(scene, {
  ...context, player: { ...context.player, slotOf: () => undefined }
});
inventory.winRoot = { add() {} };
chalice.identified = false; inventory.renderCell(0, 0, chalice, false);
chalice.identified = true; inventory.renderCell(0, 0, chalice, true);
assert.deepEqual(drawn, [['chalice-of-blood', 0], ['chalice-of-blood', 0]]);

const Sword = itemClass('sword');
class BasicHeroStub {
  talentRank() { return 0; }
  constructor(context) { this.context = context; this.items = []; this.turns = 0; this.hits = 0; }
  addItem(item) { this.items.push(item); }
  equipItem(item) { this.weapon = item; }
  init() {}
  nearestVisibleEnemy(range) { this.requestedRange = range; return this.enemyDistance <= range ? this.enemy : undefined; }
  resolveSkillAttack(enemy) { this.hits++; enemy.healthPoints--; }
  spendTurn(action) { assert.equal(action, 'attack'); this.turns++; }
}
const Elf = load('src/games/rogue0/classes/elf.ts', { BasicHero: BasicHeroStub, Sword, dungeon }).default;
const elf = new Elf({ messages: [] }, 0, 0);
assert.ok(elf.weapon instanceof Sword);
assert.equal(elf.skill, 'Double Strike');
elf.enemy = { name: 'Rat', healthPoints: 10 }; elf.enemyDistance = 2;
elf.useSkill(); assert.equal(elf.hits, 0); assert.equal(elf.turns, 0);
elf.enemyDistance = 1; elf.useSkill();
assert.equal(elf.requestedRange, 1); assert.equal(elf.hits, 2); assert.equal(elf.turns, 1);
assert.equal(elf.skillCooldown, 6);
elf.hits = 0; elf.enemy.healthPoints = 1; elf.useSkill(); assert.equal(elf.hits, 1);
assert.equal(fs.existsSync('src/games/rogue0/items/bow.ts'), false);

// Decode PNG using only Node's standard library; all food/goblet pixels must
// be opaque and the silhouette background transparent (no colour-key holes).
function pngPixels(path) {
  const png = fs.readFileSync(path), idat = [];
  let width, height;
  for (let p = 8; p < png.length;) {
    const length = png.readUInt32BE(p), type = png.toString('ascii', p + 4, p + 8);
    const data = png.subarray(p + 8, p + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8); assert.equal(data[9], 6); assert.equal(data[12], 0);
    } else if (type === 'IDAT') idat.push(data);
    p += length + 12;
  }
  assert.equal(width, 16); assert.equal(height, 16);
  const raw = inflateSync(Buffer.concat(idat)), pixels = Buffer.alloc(width * height * 4), stride = width * 4;
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 4 ? pixels[i - 4] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const estimate = a + b - c, pa = Math.abs(estimate - a), pb = Math.abs(estimate - b), pc = Math.abs(estimate - c);
      const predictor = [0, a, b, Math.floor((a + b) / 2), pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      pixels[i] = (raw[p++] + predictor) & 255;
    }
  }
  return pixels;
}
for (const name of ['ration', 'chalice-of-blood']) {
  const pixels = pngPixels(`public/rogue0/items/${name}.png`);
  const alpha = Array.from(pixels).filter((_value, i) => i % 4 === 3);
  assert.ok(alpha.every(value => value === 0 || value === 255));
  assert.equal(alpha[0], 0); assert.ok(alpha.filter(value => value === 255).length > 65);
  for (let y = 4; y <= 8; y++) {
    for (let x = name === 'ration' ? 4 : 6; x <= 8; x++) assert.equal(alpha[y * 16 + x], 255, `${name}: opaque interior`);
  }
}
const Ration = itemClass('ration');
assert.equal(new Ration({ messages: [] }).spriteTextureKey, 'ration');
// Passive wand recharge follows world upkeep, not frames or actor speed.
{
  const manager = load('src/games/rogue0/turnManager.ts', {
    dungeon, hasEffect: () => false, removeEffect() {},
  }).default;
  const Frost = itemClass('WandOfFrost', { Wand });
  const ctx = { messages: [], simulationTime: 0 };
  const first = new Frost(ctx), second = new Frost(ctx), ground = new Frost(ctx);
  first.charges = second.charges = ground.charges = 0;
  let carried = [first, second, first]; // Shared quickslot references cannot double-tick.
  const player = { type: 'player', healthPoints: 30, context: ctx, nextActionTime: 0,
    effects: [], moving: false, actionReady: true,
    refresh() {}, tickEffects() {}, turn() {}, getAllItems: () => carried };
  ctx.player = player;
  ctx.entities = [player, first, second, ground];
  manager.reset(ctx.entities);
  const advance = cost => { player.nextActionTime += cost; player.actionReady = false; manager.update(ctx.entities); };
  for (let i = 0; i < 100; i++) manager.update(ctx.entities);
  assert.equal(first.charges, 0, 'idle frames never recharge');
  for (let i = 0; i < 38; i++) advance(0.5);
  assert.equal(first.charges, 0, '19 world-time units are not enough');
  advance(1);
  assert.equal(first.charges, 1);
  assert.equal(second.charges, 1, 'all carried wands recharge independently');
  assert.equal(ground.charges, 0, 'floor wands do not recharge');
  carried = [second];
  for (let i = 0; i < 10; i++) advance(2);
  assert.equal(first.charges, 1, 'dropped wand stops recharging');
  assert.equal(second.charges, 2, 'slow actions recharge by elapsed time');
  for (let i = 0; i < 200; i++) advance(1);
  assert.equal(second.charges, second.maxCharges, 'charges never exceed maximum');
  second.charges--;
  for (let i = 0; i < 19; i++) advance(1);
  assert.equal(second.charges, second.maxCharges - 1, 'full wands do not bank extra recharge');
  advance(1);
  assert.equal(second.charges, second.maxCharges);
  second.charges = 0;
  for (let i = 0; i < 7; i++) advance(1);
  const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
  const restored = decodeGraph(JSON.parse(JSON.stringify(encodeGraph(second, { Frost }))), { Frost });
  restored.context = ctx;
  carried = [restored]; ctx.entities = [player, restored];
  manager.known = new Set(ctx.entities);
  for (let i = 0; i < 12; i++) advance(1);
  assert.equal(restored.charges, 0);
  advance(1);
  assert.equal(restored.charges, 1, 'partial recharge survives a browser save');
  for (let i = 0; i < 10; i++) advance(1);
  restored.refill(); restored.charges--;
  for (let i = 0; i < 19; i++) advance(1);
  assert.equal(restored.charges, restored.maxCharges - 1, 'Recharging scroll resets partial progress');
  advance(1); assert.equal(restored.charges, restored.maxCharges);
  delete restored.rechargeProgress; delete restored.rechargeInterval;
  restored.charges = 0;
  for (let i = 0; i < 20; i++) advance(1);
  assert.equal(restored.charges, 1, 'old saves without recharge fields work');
}
console.log('Rogue0 item upgrades: live weapon/armor/scroll/wand/artifact stats, gem and scroll upgrades, chalice pacing/cap/icons, opaque food, and Elf Double Strike passed');
