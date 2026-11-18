import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('talents');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
const { Entity } = load('entity');
const dungeon = { log() {} };
const { default: BasicHero, CLASS_TALENTS, MAX_TALENT_RANK } = load('classes/basicHero',
  { Entity, dungeon, sfx: { levelUp() {} }, spawnEntityFloatingText() {} });
const effects = load('effects', { dungeon });
const classes = Object.fromEntries(Object.keys(CLASS_TALENTS).map(name => [name,
  load(`classes/${name.toLowerCase()}`, { BasicHero, dungeon, ...effects }).default
]));
function hero(name) {
  const h = Object.create(classes[name].prototype);
  Object.assign(h, { talentClass: name, talentRanks: {}, level: 1, xp: 0,
    baseAttack: 0, strength: 10, healthPoints: 20, maxHealthPoints: 30,
    hunger: 100, maxHunger: 100,
    evasion: 10, context: { simulationTime: 12.5 },
    refreshUI() {}, spendTurn() { this.spent = (this.spent ?? 0) + 1; } });
  return h;
}
// One point is earned per level from level 2; rank caps live on individual
// tree nodes, so unspent points can accumulate across levels.
assert.equal(MAX_TALENT_RANK, 2);
for (const name of Object.keys(classes)) {
  const h = hero(name);
  assert.equal(h.availableTalents.length, 1, `${name} offers one passive talent`);
  const [a] = h.availableTalents;
  assert.equal(h.learnTalent(a.id), false, 'level 1 locked');
  assert.equal(h.learnTalent('not-a-talent'), false);
  h.gainXp(8);
  assert.equal(h.level, 2); assert.equal(h.talentPoints, 1);
  assert.equal(h.learnTalent(a.id), true);
  assert.equal(h.learnTalent(a.id), false, 'cannot overspend');
  assert.equal(h.talentPoints, 0);
  h.gainXp(16 + 24);
  assert.equal(h.level, 4); assert.equal(h.talentPoints, 2, 'one point per level');
  assert.equal(h.learnTalent(a.id), true);
  assert.equal(h.learnTalent(a.id), false, 'rank cap');
  assert.equal(h.talentPoints, 1);
  h.gainXp(32 + 40);
  assert.equal(h.level, 6); assert.equal(h.talentPoints, 3, 'points keep accruing with levels');
  assert.equal(h.strength, 10); assert.equal(h.baseAttack, 5);
  assert.equal(h.maxHealthPoints, 55);
  assert.equal(h.context.simulationTime, 12.5); assert.equal(h.spent, undefined);
  assert.equal(h.talentRank('not-a-talent'), 0);
  h.healthPoints = 0; assert.equal(h.learnTalent(a.id), false);
}
// The active-skill API is gone from every class.
for (const name of Object.keys(classes)) {
  const h = hero(name);
  for (const removed of ['useSkill', 'tryUseSkill', 'skill', 'skillDescription', 'skillCooldown']) {
    assert.equal(h[removed], undefined, `${name} has no ${removed}`);
  }
}
const warrior = hero('Warrior');
warrior.healthPoints = 10; warrior.talentRanks = { fury: 2 };
assert.equal(warrior.attack(), 4);
warrior.healthPoints = 30; assert.equal(warrior.attack(), 0);
const dwarf = hero('Dwarf'); dwarf.talentRanks = { armor: 2 };
assert.equal(dwarf.protection(), 3);
const cleric = hero('Cleric'); cleric.talentRanks = { mending: 2 };
cleric.hunger = 20; // Hungry: isolate Divine Mending from natural regeneration.
cleric.healthPoints = 25; cleric.refresh();
assert.equal(cleric.healthPoints, 28, 'Divine Mending heals 1 + rank per turn');
cleric.healthPoints = 29; cleric.refresh();
assert.equal(cleric.healthPoints, 30, 'passive healing is capped at max HP');
cleric.talentRanks = {}; cleric.healthPoints = 20; cleric.refresh();
assert.equal(cleric.healthPoints, 21);
const elf = hero('Elf'); elf.talentRanks = { grace: 2 };
assert.equal(elf.effectiveEvasion, 20);
elf.armor = { requiredStrength: 11 }; assert.equal(elf.effectiveEvasion, 20 / 1.2);
const wizard = hero('Wizard'); wizard.talentRanks = { mastery: 2 };
wizard.weapon = { damage: () => 2, damageType: 'fire' };
wizard.currentWeapon = () => wizard.weapon;
assert.equal(wizard.attack(), 5, 'Elemental Mastery adds 1 + rank to typed damage');
wizard.weapon.damageType = 'physical'; assert.equal(wizard.attack(), 2);
wizard.talentRanks = {}; wizard.weapon.damageType = 'shock'; assert.equal(wizard.attack(), 3);
const foreign = hero('Warrior'); foreign.level = 4;
assert.equal(foreign.learnTalent('grace'), false);
foreign.talentRanks.grace = 2; assert.equal(foreign.talentRank('grace'), 0);
// The Hero-panel Talents button opens the fullscreen tree; ranks are spent
// there, never from the small modal, and opening it costs no world time.
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
let opened = 0;
ui.context = { player: choosing, simulationTime: 12.5, onOpenTalentTree: () => { opened += 1; } };
ui.add = { container: widget, rectangle: widget, text: widget };
ui.buildHeroModal(); ui.heroModalOpen = true;
ui.updateHeroModal();
assert.match(ui.talentButton.text, /Talents \(1\)/);
assert.match(ui.heroModalText.text, /Unspent talent points: 1/);
ui.talentButton.events.pointerup();
assert.equal(opened, 1, 'Talents button opens the fullscreen scene');
assert.equal(ui.heroModalOpen, false, 'the small modal closes first');
assert.equal(choosing.talentRank('fury'), 0, 'no spending happens in the modal');
assert.equal(choosing.spent, undefined); assert.equal(ui.context.simulationTime, 12.5);
console.log('Rogue0 talent awards, ranks, class restrictions, passive bonuses and panel actions passed');
