import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('chests');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(exports, ...Object.values(bindings));
  return exports;
}
const { Entity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
const rewards = {};
for (const name of ['Gold', 'Gem', 'Ration', 'PotionOfHealing', 'TieredWeapon', 'TieredArmor']) {
  rewards[name] = class extends Entity {
    constructor(context, x, y, value) { super(); this.name = name; this.value = value; this.init(context, x, y); }
  };
}
let passable = true, openedDoors = 0;
const dungeon = { canStepBetween: () => passable,
  log: (ctx, text) => ctx.messages.push(text),
  entityAtTile: (ctx, x, y) => ctx.entities.find(e => e.x === x && e.y === y),
  isWalkableTile: () => false, canEnterChasm: () => false, openDoor() { openedDoors++; },
  getCurrentLevel: () => Array.from({ length: 5 }, () => Array(5).fill(0)),
};
const Chest = load('src/games/rogue0/items/chest.ts', { Entity, dungeon, ...rewards }).default;
const Hero = load('src/games/rogue0/classes/basicHero.ts', {
  Entity, dungeon, hasEffect: () => false, isModalOpen: () => false,
  getTrapState: () => undefined, isGrassConcealed: () => false,
}).default;
function setup() {
  const context = { floor: 11, messages: [], entities: [], visibleTiles: new Set() };
  let turns = 0, ready = true;
  const player = Object.assign(Object.create(Hero.prototype), {
    context, x: 1, y: 1, hunger: 100, healthPoints: 30, backpack: [], capacity: 0,
    walkPath: [], inputBuffer: [], acknowledgedWalkEnemies: new Set(),
    canAct: () => ready, spendTurn(action) { assert.equal(action, 'use'); turns++; ready = false; },
    refreshUI() {}, nextStepToward: () => ({ x: 2, y: 1 }),
  });
  context.player = player;
  const chest = new Chest(context, 2, 1);
  context.entities.push(chest);
  return { context, player, chest, turns: () => turns, ready: value => { ready = value; } };
}
const originalRandom = Math.random;
try {
  for (let roll = 0; roll < 6; roll++) {
    Math.random = () => (roll + 0.1) / 6;
    const { context, player, chest, turns, ready } = setup();
    const content = chest.contents[0];
    assert.ok(content instanceof rewards[['Gold', 'Ration', 'Gem', 'PotionOfHealing', 'TieredWeapon', 'TieredArmor'][roll]]);
    assert.equal(content.x, undefined, 'contents are not floor loot before opening');
    if (roll >= 4) assert.equal(content.value, 3, 'equipment matches floor tier');
    if (roll === 0) assert.equal(content.value, 25);
    assert.equal(player.addItem(chest), false, 'chests cannot enter inventory');
    ready(false); assert.equal(chest.openContainer(), false); ready(true);
    player.x = 0; assert.equal(chest.openContainer(), false, 'must be adjacent'); player.x = 1;
    passable = false; assert.equal(chest.openContainer(), false, 'cannot open diagonally through blocked corners'); passable = true;
    assert.equal(chest.openContainer(), true, 'opening works with a full backpack');
    assert.equal(turns(), 1);
    assert.deepEqual([player.x, player.y], [1, 1], 'opening does not also move the hero');
    assert.deepEqual(context.entities, [content]);
    assert.deepEqual([content.x, content.y], [2, 1]);
    ready(true); assert.equal(chest.openContainer(), false, 'cannot collect a chest twice');
    assert.equal(turns(), 1);
  }
  for (const mode of ['keyboard', 'auto-walk']) {
    const { player, chest, context, turns } = setup();
    if (mode === 'keyboard') player.processInput('ArrowRight');
    else { player.walkPath = [{ x: 2, y: 1 }]; player.stepAutoWalk(); }
    assert.equal(turns(), 1, mode);
    assert.ok(!context.entities.includes(chest));
    assert.equal(player.backpack.length, 0);
  }
  const { context, chest } = setup();
  const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
  const registry = { Chest, ...rewards };
  const encoded = JSON.parse(JSON.stringify(encodeGraph([chest], registry)));
  Math.random = () => { throw Error('restoration must never reroll chest contents'); };
  const [restored] = decodeGraph(encoded, registry, entity => { entity.context = context; });
  assert.ok(restored instanceof Chest);
  assert.equal(restored.contents[0].name, chest.contents[0].name);
  context.entities = [restored];
  assert.equal(restored.openContainer(), true);
  assert.equal(context.entities[0].name, chest.contents.length ? chest.contents[0].name : '');
  assert.ok(context.entities.every(e => !e.isContainer), 'opened chest stays gone in floor snapshots');
} finally { Math.random = originalRandom; }
console.log('Rogue0 chests: reward categories, depth, opening costs, keyboard/auto-walk, full backpack, no duplicates and saved contents passed');
