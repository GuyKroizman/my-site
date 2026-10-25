import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('talents');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path, bindings = {}) {
  const source = fs.readFileSync(`src/games/rogue0/${path}.ts`, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  }))(exports, ...Object.values(bindings));
  return exports;
}
const { Entity } = load('entity');
const dungeon = { log() {} };
const { default: BasicHero, CLASS_TALENTS } = load('classes/basicHero', { Entity, dungeon, sfx: { levelUp() {} } });
const effects = load('effects', { dungeon });
const classes = Object.fromEntries(Object.keys(CLASS_TALENTS).map(name => [name,
  load(`classes/${name.toLowerCase()}`, { BasicHero, dungeon, ...effects }).default
]));
function hero(name) {
  const h = Object.create(classes[name].prototype);
  Object.assign(h, { talentClass: name, talentRanks: {}, level: 1, xp: 0,
    baseAttack: 0, strength: 10, healthPoints: 20, maxHealthPoints: 30,
    evasion: 10, context: { simulationTime: 12.5 }, skillMaxCooldown: 6,
    refreshUI() {}, spendTurn() { this.spent = (this.spent ?? 0) + 1; } });
  return h;
}
for (const name of Object.keys(classes)) {
  const h = hero(name);
  const [a, b] = h.availableTalents;
  assert.equal(h.learnTalent(a.id), false, 'level 1 locked');
  assert.equal(h.learnTalent('not-a-talent'), false);
  h.gainXp(8);
  assert.equal(h.level, 2); assert.equal(h.talentPoints, 1);
  assert.equal(h.learnTalent(a.id), true);
  assert.equal(h.learnTalent(b.id), false, 'cannot overspend');
  h.gainXp(16 + 24);
  assert.equal(h.level, 4); assert.equal(h.talentPoints, 2);
  assert.equal(h.learnTalent(a.id), true);
  assert.equal(h.learnTalent(a.id), false, 'rank cap');
  assert.equal(h.learnTalent(b.id), true);
  assert.equal(h.talentPoints, 0);
  h.gainXp(32 + 40);
  assert.equal(h.level, 6); assert.equal(h.talentPoints, 0, 'first tier capped at three points');
  assert.equal(h.strength, 10); assert.equal(h.baseAttack, 5);
  assert.equal(h.maxHealthPoints, 55);
  assert.equal(h.context.simulationTime, 12.5); assert.equal(h.spent, undefined);
  assert.equal(h.talentRank('not-a-talent'), 0);
  h.healthPoints = 0; assert.equal(h.learnTalent(b.id), false);
}
const warrior = hero('Warrior');
warrior.healthPoints = 10; warrior.talentRanks = { fury: 2, power: 2 };
assert.equal(warrior.attack(), 4);
warrior.healthPoints = 30; assert.equal(warrior.attack(), 0);
warrior.adjacentEnemy = () => ({});
warrior.resolveSkillAttack = (_e, opts) => assert.equal(opts.bonusDamage, 7);
warrior.useSkill(); assert.equal(warrior.spent, 1);
const dwarf = hero('Dwarf'); dwarf.talentRanks = { armor: 2, bash: 2 };
assert.equal(dwarf.protection(), 3);
dwarf.adjacentEnemy = () => ({ name: 'Rat' });
dwarf.resolveSkillAttack = (_e, opts) => assert.equal(opts.onHitEffects[0].duration, 5);
dwarf.useSkill();
const cleric = hero('Cleric'); cleric.talentRanks = { heal: 2, prayer: 2 };
cleric.useSkill(); assert.equal(cleric.healthPoints, 30, 'healing capped at max HP');
assert.equal(cleric.skillCooldown, 4);
cleric.context.simulationTime += 1.5; assert.equal(cleric.skillCooldown, 3);
const elf = hero('Elf'); elf.talentRanks = { grace: 2, strike: 2 };
assert.equal(elf.effectiveEvasion, 20);
elf.armor = { requiredStrength: 11 }; assert.equal(elf.effectiveEvasion, 20 / 1.2);
elf.nearestVisibleEnemy = () => ({ healthPoints: 10 });
let hits = 0;
elf.resolveSkillAttack = (_e, opts) => { hits++; assert.equal(opts.bonusDamage, 2); };
elf.useSkill(); assert.equal(hits, 2); assert.equal(elf.spent, 1);
const wizard = hero('Wizard'); wizard.talentRanks = { nova: 2, focus: 2 };
const enemy = { effects: [], context: { messages: [] } };
wizard.visibleEnemiesInRadius = () => [enemy];
wizard.useSkill(); assert.equal(enemy.effects[0].duration, 5);
assert.equal(wizard.skillCooldown, 4);
// Learning a cooldown talent never retroactively resets an in-flight cooldown.
const waiting = hero('Cleric'); waiting.level = 2; waiting.skillCooldown = 6;
waiting.learnTalent('prayer'); assert.equal(waiting.skillCooldown, 6);
const foreign = hero('Warrior'); foreign.level = 4;
assert.equal(foreign.learnTalent('prayer'), false);
foreign.talentRanks.prayer = 2; assert.equal(foreign.talentRank('prayer'), 0);
// Real Hero-panel callbacks: tap navigation, spending and hidden-panel guards.
const { UI } = load('ui', { Phaser: { Scene: class {} } });
function widget() {
  return { events: {}, text: '', visible: true,
    setDepth() { return this; }, setOrigin() { return this; },
    setStrokeStyle() { return this; }, setInteractive() { return this; },
    setColor() { return this; }, add() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setText(value) { this.text = value; return this; },
    on(event, callback) { this.events[event] = callback; return this; }
  };
}
const ui = Object.create(UI.prototype);
const choosing = hero('Warrior'); choosing.level = 2; choosing.effects = [];
choosing.statsText = () => 'Hero stats';
ui.context = { player: choosing, simulationTime: 12.5 };
ui.add = { container: widget, rectangle: widget, text: widget };
ui.buildHeroModal(); ui.heroModalOpen = true;
ui.talentTab.events.pointerup();
assert.equal(ui.talentRows[0].visible, true);
assert.match(ui.heroModalText.text, /Points: 1/);
ui.talentRows[0].events.pointerup();
assert.equal(choosing.talentRank('power'), 1);
assert.match(ui.heroModalText.text, /Points: 0/);
ui.talentRows[1].events.pointerup(); assert.equal(choosing.talentRank('fury'), 0);
choosing.level = 3; ui.heroModalOpen = false;
ui.talentRows[0].events.pointerup(); assert.equal(choosing.talentRank('power'), 1);
ui.heroModalOpen = true; ui.talentTab.events.pointerup();
assert.equal(ui.talentRows[0].visible, false);
ui.talentRows[0].events.pointerup(); assert.equal(choosing.talentRank('power'), 1);
assert.equal(choosing.spent, undefined); assert.equal(ui.context.simulationTime, 12.5);
console.log('Rogue0 talent awards, ranks, class restrictions, skill effects, panel actions and world-time cooldowns passed');
