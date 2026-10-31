import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('rings');
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
const { Entity, identify, upgrade, removeEntity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context) { this.context = context; };
const Ring = load('src/games/rogue0/items/ring.ts', { Entity, identify }).default;
const classes = Object.fromEntries(['Accuracy', 'Evasion', 'Elements', 'Haste', 'Might'].map(name =>
  [name, load(`src/games/rogue0/items/RingOf${name}.ts`, { Ring }).default]));
const Scroll = load('src/games/rogue0/items/ScrollOfUpgrade.ts', { Entity, identify, upgrade, removeEntity, Wand: class {} }).default;
const { actionCost } = load('src/games/rogue0/timing.ts');
const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
const Hero = load('src/games/rogue0/classes/basicHero.ts', { Entity }).default;
function setup() {
  const context = { messages: [], entities: [] };
  const player = { accuracy: 95, evasion: 10, movementSpeed: 1, attackDelay: 1, effects: [],
    resistance: { fire: 1, ice: 2, shock: 3 }, baseAttack: 1,
    items: [], canAct: () => true, getAllItems() { return this.items; },
    spendTurn(action) { assert.equal(action, 'use'); this.turns = (this.turns ?? 0) + 1; },
    removeItem(item) { this.items.splice(this.items.indexOf(item), 1); }, refreshUI() {},
  };
  context.player = player;
  return { context, player };
}
function check(name, p, level) {
  assert.equal(p.accuracy, name === 'Accuracy' ? 95 + 5 * (level + 1) : 95);
  assert.equal(p.evasion, name === 'Evasion' ? 10 + 5 * (level + 1) : 10);
  assert.deepEqual(p.resistance, name === 'Elements' ? { fire: 3 + level, ice: 4 + level, shock: 5 + level } : { fire: 1, ice: 2, shock: 3 });
  assert.equal(p.movementSpeed, name === 'Haste' ? 2 + level * 0.5 : 1);
  assert.equal(Hero.prototype.attack.call(p), name === 'Might' ? 3 + level : 1);
  assert.equal(actionCost(p, 'attack'), 1, 'Haste rings do not speed attacks');
}
for (const [name, Type] of Object.entries(classes)) {
  const { context, player } = setup();
  const ring = new Type(context);
  player.items.push(ring); player.ring1 = ring;
  ring.equip(); ring.equip();
  check(name, player, 0);
  for (let level = 1; level <= 3; level++) {
    const beforeDescription = ring.baseDescription;
    const scroll = new Scroll(context); player.items.push(scroll); context.entities.push(scroll);
    assert.equal(scroll.useOnItem(ring), true);
    assert.equal(ring.level, level); check(name, player, level);
    assert.notEqual(ring.baseDescription, beforeDescription, 'description reflects new bonus');
    assert.equal(player.turns, level, 'one action per upgrade');
  }
  const restored = decodeGraph(JSON.parse(JSON.stringify(encodeGraph({ ring, player }, { Ring: Type }))), { Ring: Type });
  restored.ring.context = { player: restored.player, messages: [] };
  restored.ring.onUpgrade(); restored.ring.onUpgrade();
  check(name, restored.player, 3);
  restored.ring.unequip(); restored.player.ring1 = undefined;
  check('none', restored.player, 0);
  ring.unequip(); ring.unequip(); player.ring1 = undefined;
  check('none', player, 0);
  upgrade(ring); check('none', player, 0); // Backpack upgrade must not grant stats.
  player.ring1 = ring; ring.equip(); check(name, player, 4);
  const second = new Type(context); player.ring2 = second; second.equip();
  upgrade(second);
  second.unequip(); player.ring2 = undefined;
  check(name, player, 4, 'removing a second ring retains the first bonus');
  ring.unequip(); player.ring1 = undefined;
  check('none', player, 0);
}
// Reconcile old saves: their level could be high while the installed bonus was fixed.
for (const [name, Type] of Object.entries(classes)) {
  const { context, player } = setup();
  const ring = new Type(context); player.ring1 = ring;
  ring.equip();
  if (name === 'Haste') {
    player.movementSpeed = 1;
    player.effects = [{ id: 'haste', duration: Infinity, manualExpiry: true }];
  }
  delete ring.passiveLevel;
  ring.level = 2;
  ring.onUpgrade(); check(name, player, 2);
  ring.onUpgrade(); check(name, player, 2);
  if (name === 'Haste') assert.equal(player.effects.length, 0, 'legacy permanent Haste is replaced, not double-counted');
}
// Ring changes during blindness must survive the effect wearing off.
{
  const { context, player } = setup();
  const ring = new classes.Accuracy(context); ring.equip();
  player.effects = [{ id: 'blinded', originalAccuracy: 100 }]; player.accuracy = 75;
  upgrade(ring);
  assert.equal(player.accuracy, 80);
  assert.equal(player.effects[0].originalAccuracy, 105);
  ring.unequip();
  assert.equal(player.accuracy, 70);
  assert.equal(player.effects[0].originalAccuracy, 95);
}
{
  const { context, player } = setup();
  player.effects = [{ id: 'haste', duration: 5 }];
  const ring = new classes.Haste(context); ring.equip(); upgrade(ring);
  assert.equal(actionCost(player, 'move'), 1 / 5);
  ring.unequip();
  assert.equal(actionCost(player, 'move'), 1 / 2);
  assert.equal(player.effects[0].duration, 5, 'unequipping does not cancel temporary Haste');
}
console.log('Rogue0 rings: all five upgrade curves, live passives, scroll costs, descriptions, removal, stacking, saves, legacy repair, blindness and Haste passed');
