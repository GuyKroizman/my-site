import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('gold');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
const { Entity } = load('src/games/rogue0/entity.ts');
const Gold = load('src/games/rogue0/items/gold.ts', { Entity }).default;
Gold.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
let roll = 1;
const messages = [];
const Monster = load('src/games/rogue0/monsters/monster.ts', {
  Entity, Gold, Phaser: { Math: { Between: () => roll } },
  dungeon: { log: (_context, text) => messages.push(text) },
}).default;
const player = { gold: 0, gainXp() {}, refreshUI() {}, backpack: [], capacity: 0 };
const context = { player, entities: [], messages, visibleTiles: new Set() };
player.context = context;
const makeMonster = (overrides = {}) => Object.assign(Object.create(Monster.prototype), {
  context, name: 'Rat', gold: 3, xpValue: 5, loot: [], x: 4, y: 5, ...overrides,
});
let monster = makeMonster();
monster.onDestroy();
assert.equal(player.gold, 0);
assert.equal(context.messages.at(0), 'Rat was killed, dropping 3 gold.');
const pile = context.entities[0];
assert.ok(pile instanceof Gold);
assert.equal(pile.x, 4);
assert.equal(pile.y, 5);
assert.equal(pile.goldAmount, 3);
roll = 2;
monster = makeMonster();
monster.onDestroy();
assert.equal(context.entities.length, 1);
roll = 0;
monster = makeMonster({ loot: [class { name = 'Potion'; }] });
monster.onDestroy();
assert.equal(context.entities.length, 2);
assert.equal(context.messages.at(0), 'Rat was killed, dropping Potion.');
monster = makeMonster({ gold: 0 });
roll = 1;
monster.onDestroy();
assert.equal(context.entities.length, 2);
assert.equal(player.gold, 0);
const Hero = load('src/games/rogue0/classes/basicHero.ts', { Entity }).default;
assert.equal(Hero.prototype.addItem.call(player, pile), true);
assert.equal(player.gold, 3);
assert.equal(player.backpack.length, 0);
assert.ok(!context.entities.includes(pile));
assert.equal(Hero.prototype.addItem.call(player, pile), false);
assert.equal(player.gold, 3);
player.capacity = 20;
const texts = [];
function display() {
  return new Proxy({}, { get: (_target, key) => key === 'destroy' ? () => {} : () => display() });
}
const scene = {
  scale: { width: 800, height: 600 },
  add: { rectangle: display, container: display,
    text: (_x, _y, text) => { texts.push(text); return display(); },
  },
};
const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', {});
const inventory = new InventoryWindow(scene, context);
for (const balance of [0, 3, 123456]) {
  player.gold = balance;
  texts.length = 0;
  inventory.openWindow();
  assert.ok(texts.includes(`Gold: ${balance}`));
  assert.ok(texts.includes('BACKPACK (0/20)'));
  inventory.close();
}
console.log('Rogue0 chance-based floor loot, gold pickup and inventory balance passed');
