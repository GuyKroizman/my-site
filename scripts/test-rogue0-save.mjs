import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('save');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
const { Entity, saveConsumableKnowledge, restoreConsumableKnowledge } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
const { TieredWeapon, TieredArmor } = load('src/games/rogue0/items/tieredEquipment.ts', {
  Entity, Phaser: { Math: { Between: (_min, max) => max } },
});
const effects = load('src/games/rogue0/effects.ts', { spawnEntityFloatingText() {}, dungeon: {} });
const ChaliceOfBlood = load('src/games/rogue0/items/ChaliceOfBlood.ts', { Entity }).default;
const { restoreEffects } = load('src/games/rogue0/saveEffects.ts', { effects, ChaliceOfBlood });
const registry = { weapon: TieredWeapon, armor: TieredArmor };
const context = { messages: [], visibleTiles: new Set(), simulationTime: 4.5 };
const weapon = new TieredWeapon(context, undefined, undefined, 5);
weapon.level = 3;
weapon.effects = [effects.createBlindedEffect(2), effects.createCursedEffect()];
weapon.effects[0].apply(weapon, context);
weapon.effects[0].nextTick = 5.5;
weapon.sprite = { circular: context };
context.entities = [weapon];
const armor = new TieredArmor(context, 5, 7, 4);
const sparseSeen = []; sparseSeen[4] = [true, false, true];
const state = { weapon, backpack: [weapon, armor], quickslots: [weapon, undefined],
  floors: new Map([[1, { entities: [armor], seen: sparseSeen }]]),
  visited: new Set([1, 2]), loot: [false, TieredWeapon], time: 4.5, nextTick: 5,
};
const encoded = JSON.parse(JSON.stringify(encodeGraph(state, registry)));
const restored = decodeGraph(encoded, registry, entity => {
  entity.context = context;
  entity.effects = restoreEffects(entity.effects);
});
assert.ok(restored.weapon instanceof TieredWeapon);
assert.equal(restored.weapon.damage(), 43);
assert.equal(restored.backpack[1].protection(), 8);
assert.equal(restored.weapon, restored.quickslots[0]);
assert.equal(restored.weapon, restored.backpack[0]);
assert.equal(restored.backpack[1], restored.floors.get(1).entities[0]);
assert.equal(restored.quickslots[1], undefined);
assert.equal(restored.weapon.maxLevel, Infinity);
assert.equal(restored.loot[1], TieredWeapon, 'monster loot constructors remain callable');
assert.deepEqual([...restored.visited], [1, 2]);
assert.equal(restored.weapon.sprite, undefined, 'Phaser objects never enter saves');
assert.equal(restored.time, 4.5);
assert.equal(restored.weapon.effects[0].nextTick, 5.5);
assert.equal(restored.weapon.accuracy, 70, 'restoration does not apply blindness twice');
restored.weapon.effects[0].remove(restored.weapon, context);
assert.equal(restored.weapon.accuracy, 95, 'blindness retains its original accuracy after reload');
assert.equal(restored.weapon.effects[1].duration, Infinity);
restored.weapon.healthPoints = 10;
restored.weapon.effects[1].tick(restored.weapon, context);
assert.equal(restored.weapon.healthPoints, 9, 'restored cursed effect retains its ticking behavior');
assert.deepEqual(restored.floors.get(1).seen[4], [true, false, true]);
// A sparse fog row becomes explicit undefined after JSON: snapshotting it again
// must not throw (browser resume regression).
assert.doesNotThrow(() => restored.floors.get(1).seen.map(row => [...(row ?? [])]));
const chalice = new ChaliceOfBlood(context);
chalice.level = 5;
chalice.healingTurns = 5;
chalice.bloodProgress = 7;
const artifactSave = encodeGraph({ artifact: chalice, effects: [chalice.regenEffect()] }, { chalice: ChaliceOfBlood });
const artifactRun = decodeGraph(JSON.parse(JSON.stringify(artifactSave)), { chalice: ChaliceOfBlood });
const artifactEffects = restoreEffects(artifactRun.effects, artifactRun.artifact);
const wounded = { healthPoints: 5, maxHealthPoints: 10 };
artifactEffects[0].tick(wounded);
assert.equal(wounded.healthPoints, 6, 'artifact resumes healing counter and callback against restored instance');
assert.equal(artifactRun.artifact.healingTurns, 0);
assert.equal(artifactRun.artifact.bloodProgress, 7);
assert.equal(chalice.healingTurns, 5, 'restored callback never touches original artifact');
const knowledge = { appearances: [['potion:Healing', 'potion-3']], known: ['potion:Healing'] };
restoreConsumableKnowledge(context, knowledge);
assert.deepEqual(saveConsumableKnowledge(context), knowledge);
assert.throws(() => decodeGraph({ root: { ref: 99 }, nodes: [] }, registry));
assert.throws(() => decodeGraph({ root: { ref: 0 }, nodes: [{ kind: 'entity', type: 'missing', data: [] }] }, registry));
assert.throws(() => decodeGraph({ root: { ref: 0 }, nodes: [{ kind: 'object', data: [['__proto__', {}]] }] }, registry));
assert.throws(() => restoreEffects([{ id: 'unknown', duration: 1 }]));

const memory = new Map();
let blocked = false;
const localStorage = {
  getItem(key) { if (blocked) throw Error('blocked'); return memory.get(key) ?? null; },
  setItem(key, value) { if (blocked) throw Error('quota'); memory.set(key, value); },
  removeItem(key) { if (blocked) throw Error('blocked'); memory.delete(key); },
};
const { SAVE_KEY, readRunSave, writeRunSave, clearRunSave } = load('src/games/rogue0/saveStorage.ts', { localStorage });
assert.deepEqual(readRunSave(), {});
const save = { version: 1, heroClass: 'Warrior', floor: 1, savedAt: new Date().toISOString(), graph: encoded };
assert.equal(writeRunSave(save), true);
assert.deepEqual(readRunSave().save, save);
blocked = true;
assert.equal(writeRunSave({ ...save, floor: 2 }), false);
assert.ok(readRunSave().error);
assert.equal(clearRunSave(), false);
blocked = false;
assert.equal(readRunSave().save.floor, 1, 'failed write retains last complete save');
memory.set(SAVE_KEY, '{broken'); assert.ok(readRunSave().error);
memory.set(SAVE_KEY, JSON.stringify({ ...save, version: 999 })); assert.ok(readRunSave().error);
assert.equal(clearRunSave(), true);
assert.deepEqual(readRunSave(), {});
console.log('Rogue0 save graph, prototypes, shared inventory, floor state, sparse fog, effects, knowledge, clocks and storage errors passed');
