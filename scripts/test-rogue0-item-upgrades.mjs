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
const { Entity, upgrade, identify, removeEntity } = load('src/games/rogue0/entity.ts');
let maximum = false;
const Phaser = { Math: { Between: (min, max) => maximum ? max : min } };
const dungeon = { log(context, text) { context.messages.push(text); } };
const bindings = { Entity, upgrade, identify, removeEntity, Phaser, dungeon };
const itemClass = (name, extra = {}) => load(`src/games/rogue0/items/${name}.ts`, { ...bindings, ...extra }).default;
const Shield = itemClass('shield');
const Gem = itemClass('gem', { Shield });
const ScrollOfUpgrade = itemClass('ScrollOfUpgrade');
const Wand = itemClass('wand');
const Ring = itemClass('ring');
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
    assert.ok(item.displayDescription.includes(`between ${min + level} and ${max + level} damage`), name);
    maximum = false; assert.equal(item.damage(), min + level, name);
    maximum = true; assert.equal(item.damage(), max + level, name);
    if (item.range()) assert.ok(item.displayDescription.includes(`Range is ${item.range()} tiles`));
    if (level === 0) {
      const gem = new Gem(item.context); items.push(gem);
      assert.equal(gem.enchant(item), true);
    } else if (level === 1) {
      const scroll = new ScrollOfUpgrade(item.context); items.push(scroll); scroll.equip();
    } else if (level === 2) upgrade(item);
  }
  identify(item);
  assert.ok(item.context.messages[0].includes(item.displayDescription));
}
const shield = new Shield({ messages: [] });
const shieldItems = contextFor(shield);
for (let level = 0; level <= 2; level++) {
  assert.equal(shield.protection(), 1 + level);
  assert.ok(shield.displayDescription.includes(`+${1 + level} protection`));
  if (level === 0) {
    const gem = new Gem(shield.context); shieldItems.push(gem); assert.equal(gem.enchant(shield), true);
  } else if (level === 1) {
    const scroll = new ScrollOfUpgrade(shield.context); shieldItems.push(scroll); scroll.equip();
  }
}
for (const [name, min, max] of [['WandOfFirebolt', 3, 6], ['WandOfFrost', 2, 5], ['WandOfLightning', 2, 6]]) {
  const wand = new (itemClass(name, { Wand }))({ messages: [] });
  wand.identified = true;
  for (let level = 0; level <= 3; level++) {
    wand.refill();
    const before = wand.charges;
    assert.ok(wand.displayDescription.includes(`between ${min + level} and ${max + level} damage`));
    assert.ok(wand.displayDescription.includes(`Range is ${wand.range()} tiles`));
    assert.equal(wand.charges, before, 'describing a wand must not consume charges');
    maximum = false; assert.equal(wand.damage(), min + level);
    maximum = true; assert.equal(wand.damage(), max + level);
    assert.ok(wand.displayDescription.includes('Charges: 1/3'));
    if (level < 3) upgrade(wand);
  }
}
const might = new (itemClass('RingOfMight', { Ring }))({ messages: [] });
const fang = new (itemClass('FangOfTheBeast'))({ messages: [] });
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
assert.equal(chalice.spriteTextureKey, 'chalice-of-blood');
assert.equal(chalice.spriteFrame, 0);
assert.equal(chalice.unidentifiedTextureKey, chalice.spriteTextureKey);
chalice.equip();
assert.equal(chalice.identified, true);
function healingTick(missing = 10) {
  context.player.healthPoints = context.player.maxHealthPoints - missing;
  effect.tick(context.player, context);
}
for (let level = 0; level < 3; level++) {
  const threshold = 60 * (level + 1);
  assert.equal(chalice.healsToNextLevel, threshold);
  for (let i = 0; i < threshold - 1; i++) healingTick();
  assert.equal(chalice.level, level, 'must not level early');
  assert.ok(chalice.displayDescription.includes(`${threshold - 1}/${threshold} healing ticks`));
  context.player.healthPoints = context.player.maxHealthPoints;
  for (let i = 0; i < 100; i++) effect.tick(context.player, context);
  assert.equal(chalice.level, level, 'full-health turns do not advance progress');
  healingTick();
  assert.equal(chalice.level, level + 1);
}
for (let i = 0; i < 1000; i++) healingTick();
assert.equal(chalice.level, 3);
assert.equal(context.player.healthPoints, 94);
assert.match(chalice.displayDescription, /up to 4 health.*Maximum level reached.*Level cap: \+3/);
upgrade(chalice);
assert.equal(chalice.level, 3, 'generic upgrades must respect the artifact cap');
healingTick(1);
assert.equal(context.player.healthPoints, 100);
assert.equal(context.messages.at(-1), 'Elf regenerates 1 health.');
chalice.unequip(); assert.equal(effect, undefined);

// Actual inventory cell renderer: backpack/unidentified and equipped/identified
// use the same custom goblet texture, never the old character atlas frame.
const drawn = [];
const shape = { setOrigin() { return this; }, setStrokeStyle() { return this; }, setInteractive() { return this; }, on() { return this; } };
const scene = { add: { rectangle: () => shape, sprite: (_x, _y, key, frame = 0) => { drawn.push([key, frame]); return shape; } } };
const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', { Gem, Wand, attachTooltip() {} });
const inventory = new InventoryWindow(scene, context);
inventory.winRoot = { add() {} };
chalice.identified = false; inventory.renderCell(0, 0, chalice, false);
chalice.identified = true; inventory.renderCell(0, 0, chalice, true);
assert.deepEqual(drawn, [['chalice-of-blood', 0], ['chalice-of-blood', 0]]);

const Sword = itemClass('sword');
class BasicHeroStub {
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
console.log('Rogue0 item upgrades: live weapon/armor/scroll/wand/artifact stats, gem and scroll upgrades, chalice pacing/cap/icons, opaque food, and Elf Double Strike passed');
