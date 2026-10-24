import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('stairs');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8').replace(/^import[\s\S]*?;\s*/gm, '')
  .replace(/const LOOT_TABLE:[\s\S]*?\n\];/, 'const LOOT_TABLE = [];');
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const exports = {};
const map = [[0, 1], [0, 0]];
const door = { feature: 'door', door: 'open' };
const tiles = { forEachFeature: fn => fn(0, 1, door) };
const dungeon = { getCurrentLevel: () => map, log() {} };
let deaths = 0;
new Function('exports', 'Phaser', 'tiles', 'dungeon', 'isModalOpen', 'sfx', 'removeEntity', js)(
  exports, { Scene: class {} }, tiles, dungeon, () => false, { stairs() {} },
  () => { deaths++; });
const scene = Object.create(exports.Scene0.prototype);
const gear = { name: 'carried potion' };
const player = { x: 0, y: 0, canAct: () => true, getAllItems: () => [gear] };
const monster = { healthPoints: 7, x: 1, y: 1 };
const loot = { name: 'floor scroll', x: 1, y: 0 };
scene.context = { floor: 2, player, entities: [player, gear, monster, loot],
  upstairsX: 0, upstairsY: 0, stairsX: 1, stairsY: 1 };
scene.floors = new Map();
scene.seen = [[true, false], [true, true]];
scene.saveFloor();
const saved = scene.floors.get(2);
assert.deepEqual(saved.entities, [monster, loot]);
assert.equal(saved.entities[0].healthPoints, 7);
map[0][0] = 1;
door.door = 'closed';
scene.seen[0][0] = false;
assert.equal(saved.map[0][0], 0);
assert.equal(saved.features[0].door, 'open');
assert.equal(saved.seen[0][0], true);
let restored;
scene.restoreFloor = (...args) => { restored = args; };
scene.floors.set(1, { ...saved, down: { x: 4, y: 5 } });
scene.tryAscend();
assert.equal(restored[0], 1);
assert.deepEqual(restored[2], { x: 4, y: 5 });
restored = undefined;
player.x = 9;
scene.tryAscend();
assert.equal(restored, undefined, 'cannot ascend away from upstairs');
player.x = 0;
scene.context.floor = 1;
scene.tryAscend();
assert.equal(restored, undefined, 'first-floor entrance does not leave the dungeon');
scene.context.floor = 1;
scene.descend();
assert.equal(restored[0], 2);
assert.deepEqual(restored[2], saved.up);
// Falling uses the normal snapshot/restore path, never the exit/win path.
Object.assign(player, { healthPoints: 30, maxHealthPoints: 30,
  inputBuffer: ['ArrowRight'], walkPath: [{ x: 1, y: 1 }],
  cancelThrow() { this.throwCancelled = true; }, refreshUI() {},
  takeDamage(amount) { this.healthPoints -= amount; } });
scene.context.maxFloor = 5;
scene.context.floor = 1;
scene.context.pendingFall = true;
scene.restoreFloor = (floor, snapshot, arrival) => {
  restored = [floor, snapshot, arrival];
  scene.context.floor = floor;
};
scene.resolveFall();
assert.equal(scene.context.floor, 2);
assert.equal(player.healthPoints, 20);
assert.equal(scene.context.pendingFall, false);
assert.deepEqual(player.inputBuffer, []);
assert.deepEqual(player.walkPath, []);
assert.equal(player.throwCancelled, true);
assert.equal(deaths, 0);
scene.resolveFall();
assert.equal(player.healthPoints, 20, 'fall is resolved exactly once');
// First visit also generates a floor through the normal descent pipeline.
scene.context.floor = 2;
scene.context.pendingFall = true;
scene.generateLevel = floor => { assert.equal(floor, 3); return {
  levelArray: [[0]], spawn: { x: 0, y: 0 }, stairs: { x: 0, y: 0 }
}; };
dungeon.initialize = () => {};
scene.setupFloor = floor => { scene.context.floor = floor; };
player.healthPoints = 5;
scene.resolveFall();
assert.equal(scene.context.floor, 3);
assert.equal(player.healthPoints, -5, 'fall damage can kill on arrival');
assert.equal(deaths, 1);
scene.context.floor = 5;
scene.context.pendingFall = true;
player.healthPoints = 30;
scene.events = { emit() { assert.fail('falling must never win the run'); } };
scene.resolveFall();
assert.equal(scene.context.floor, 5);
assert.equal(player.healthPoints, 0);
assert.equal(deaths, 2);
console.log('Rogue0 floor snapshots, exploration, terrain, entity retention, stair travel and damaging falls passed');
