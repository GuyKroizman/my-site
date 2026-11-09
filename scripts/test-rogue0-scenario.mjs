import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('scenario');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

// Phase 17 scenario harness. Two layers:
//   1. source audit of saveRegistry: the scenario ids are class names, so they
//      must be unique (a duplicate would silently hide an entry).
//   2. behaviour of the real module against a fake registry/hero, because the
//      real registry pulls in Phaser and the whole entity graph.

// ---- 1. Registry ids ----
{
  const source = fs.readFileSync(new URL('../src/games/rogue0/saveRegistry.ts', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export const saveRegistry'));
  const entries = [...body.matchAll(/'(\.\/[^']+)':\s*([A-Za-z0-9_]+)/g)]
    .map(([, key, ident]) => ({ key, ident }));
  assert.ok(entries.length > 50, 'saveRegistry parsed');

  const classNames = new Map();
  const aliases = new Map();
  for (const { key, ident } of entries) {
    aliases.set(ident, (aliases.get(ident) ?? 0) + 1);
    const file = findClassFile(ident);
    assert.ok(file, `${ident} has a source file`);
    const declared = new RegExp(`class ${ident}\\b`).test(fs.readFileSync(file, 'utf8'));
    assert.ok(declared, `${ident} is declared in ${file.split('/rogue0/')[1]}`);
    classNames.set(ident, file);
  }
  // Distinct identifiers are distinct ids; the only repeats must be the same
  // class exposed under a historical key (elemental aliases and the two
  // retired healing potions, now one Potion of Healing).
  assert.ok(classNames.size > 50, 'every registry class is inspected');
  assert.equal(aliases.get('FireElemental'), 2, 'elemental aliases still share one id');
  assert.equal(aliases.get('PotionOfHealing'), 3,
    'Minor Heal Potion and Full Heal Potion load as the one Potion of Healing');
  assert.deepEqual([...aliases].filter(([, count]) => count > 1).map(([ident]) => ident),
    ['PotionOfHealing', 'FireElemental'], 'no other registry key collapses onto a different class');
}

function findClassFile(ident) {
  for (const dir of ['items', 'monsters', 'classes']) {
    const dirUrl = new URL(`../src/games/rogue0/${dir}/`, import.meta.url);
    for (const name of fs.readdirSync(dirUrl)) {
      if (!name.endsWith('.ts')) continue;
      const url = new URL(name, dirUrl);
      if (new RegExp(`class ${ident}\\b`).test(fs.readFileSync(url, 'utf8'))) return url.pathname;
    }
  }
  return undefined;
}

// ---- 2. Behaviour ----
class FakeEntity {}
class Monster extends FakeEntity {}
class Ring extends FakeEntity {}
class Wand extends FakeEntity {}
class BasicHero extends FakeEntity {
  constructor() {
    super();
    this.context = { entities: [this] };
    this.level = 1;
    this.xp = 0;
    this.maxHealthPoints = 30;
    this.healthPoints = 30;
    this.hunger = 100;
    this.maxHunger = 100;
    this.gold = 0;
    this.backpack = [];
    this.quickslots = [undefined, undefined, undefined, undefined];
    this.learnedTalents = [];
    this.weapon = undefined;
    this.armor = undefined;
    this.ring1 = undefined;
    this.ring2 = undefined;
    this.artifact = undefined;
  }
  xpForNextLevel() { return 8 + (this.level - 1) * 8; }
  gainXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpForNextLevel()) {
      this.xp -= this.xpForNextLevel();
      this.level += 1;
      this.maxHealthPoints += 5;
    }
  }
  learnTalent(id) { this.learnedTalents.push(id); return true; }
  getAllItems() {
    return [this.weapon, this.armor, this.ring1, this.ring2, this.artifact, ...this.backpack]
      .filter(Boolean);
  }
  addItem(item) {
    this.context.entities.push(item);
    this.backpack.push(item);
    return true;
  }
  equipItem(item) {
    this.backpack = this.backpack.filter(candidate => candidate !== item);
    this.weapon = item;
  }
}
class Warrior extends BasicHero {}

class Item extends FakeEntity {
  constructor(context) {
    super();
    this.context = context;
    this.level = 0;
    this.maxLevel = 5;
    this.tier = 1;
    this.identified = false;
    this.consumable = false;
    this.isContainer = false;
    this.unequipped = 0;
    this.upgrades = 0;
  }
  unequip() { this.unequipped += 1; }
  onUpgrade() { this.upgrades += 1; }
}
class Sword extends Item { constructor(context) { super(context); this.name = 'Sword'; } }
class PotionOfFrost extends Item {
  constructor(context) { super(context); this.name = 'Potion of Frost'; this.consumable = true; this.textureKey = 'potion-3'; }
}
class ScrollOfUpgrade extends Item {
  constructor(context) { super(context); this.name = 'Scroll of Upgrade'; this.consumable = true; this.textureKey = 'scroll-upgrade'; }
}
class TieredWeapon extends Item {
  constructor(context, _x, _y, tier = 1) { super(context); this.tier = tier; this.name = `Tier ${tier} weapon`; }
}
class TieredArmor extends Item {
  constructor(context, _x, _y, tier = 1) { super(context); this.tier = tier; this.name = `Tier ${tier} armor`; }
}
class RingOfMight extends Ring { constructor(context) { super(); this.name = 'Ring of Might'; this.context = context; this.level = 0; this.maxLevel = 5; this.isContainer = false; } onUpgrade() { this.upgraded = (this.upgraded ?? 0) + 1; } }
class WandOfFrost extends Wand {
  constructor(context) { super(); this.name = 'Wand of Frost'; this.context = context; this.level = 0; this.maxLevel = 5; this.identified = false; this.consumable = true; this.textureKey = 'wand-frost'; this.isContainer = false; }
  reconcileChargeScaling() { this.reconciled = true; }
}
class Chest extends Item { constructor(context) { super(context); this.name = 'Chest'; this.isContainer = true; } }
class Goblin extends Monster {
  constructor(context, x, y) {
    super();
    this.context = context;
    this.x = x;
    this.y = y;
    this.sleepTurnsRemaining = 9;
    this.awareOfPlayer = false;
  }
}
class Skeleton extends Monster {
  constructor(context, x, y) { super(); this.context = context; this.x = x; this.y = y; this.sleepTurnsRemaining = 12; }
}

const registry = {
  './classes/basicHero.ts:default': BasicHero,
  './classes/warrior.ts:default': Warrior,
  './items/sword.ts:default': Sword,
  './items/PotionOfFrost.ts:default': PotionOfFrost,
  './items/ScrollOfUpgrade.ts:default': ScrollOfUpgrade,
  './items/chest.ts:default': Chest,
  './items/tieredEquipment.ts:TieredWeapon': TieredWeapon,
  './items/tieredEquipment.ts:TieredArmor': TieredArmor,
  './items/ring.ts:default': Ring,
  './items/RingOfMight.ts:default': RingOfMight,
  './items/wand.ts:default': Wand,
  './items/WandOfFrost.ts:default': WandOfFrost,
  './monsters/monster.ts:default': Monster,
  './monsters/goblin.ts:default': Goblin,
  './monsters/skelaton.ts:default': Skeleton,
  // Registry keeps both elemental aliases pointing at one class.
  './monsters/elemental.ts:default': Goblin,
  './monsters/elemental.ts:FireElemental': Goblin,
};

const identified = [];
let removals = 0;
const scenarioModule = loadLogic('src/games/rogue0/scenario.ts', {
  saveRegistry: registry,
  identify: item => { identified.push(item.name); item.identified = true; },
  rememberIdentifiedWandTypes: () => {},
  BasicHero,
  Monster,
  Ring,
  Wand,
  TieredArmor,
  TieredWeapon,
  rollCurseId: () => 'polarized',
  floorProgression: () => ({ strengthPotions: 0, upgradeScrolls: 1, weapon: 0, armor: 0, tier: 3 }),
  dungeon: { log() {} },
  // loadLogic also builds the hero control/inventory adapters.
  removeEntity: () => { removals += 1; },
  removeEffect: () => {},
  sfx: { equip() {} },
  tiles: { isBlocking: () => false },
});

const {
  MAX_SCENARIO_LEVEL,
  normalizeScenario,
  scenarioCatalog,
  resolveScenarioClass,
  expandScenarioMonsters,
  scenarioReplacesPopulation,
  applyScenarioHero,
  applyScenarioInventory,
  finishScenarioInventory,
} = scenarioModule;

// Catalog: ids are class names, bases are excluded, aliases collapse.
{
  const { entries, byId } = scenarioCatalog();
  const ids = entries.map(entry => entry.id);
  assert.deepEqual(ids.filter(id => id === 'Goblin').length, 1, 'one entry per class');
  assert.ok(!ids.includes('Monster'), 'abstract monster base excluded');
  assert.ok(!ids.includes('Ring'), 'abstract ring base excluded');
  assert.ok(!ids.includes('Wand'), 'abstract wand base excluded');
  assert.ok(!ids.includes('BasicHero'), 'base hero excluded');
  assert.equal(byId.get('sword'), Sword);
  assert.equal(resolveScenarioClass('potionoffrost'), PotionOfFrost, 'ids are case-insensitive');
  assert.equal(resolveScenarioClass('nope'), undefined);

  const category = id => entries.find(entry => entry.id === id)?.category;
  assert.equal(category('Sword'), 'weapon');
  assert.equal(category('TieredArmor'), 'armor');
  assert.equal(category('RingOfMight'), 'ring');
  assert.equal(category('WandOfFrost'), 'wand');
  assert.equal(category('PotionOfFrost'), 'potion');
  assert.equal(category('ScrollOfUpgrade'), 'scroll');
  assert.equal(category('Chest'), 'treasure');
  assert.equal(category('Goblin'), 'monster');
  assert.equal(category('Warrior'), 'hero');
  assert.equal(entries[0].category, 'hero', 'heroes list first for the class picker');
}

// Normalization reports typos instead of dropping them.
{
  const { scenario, errors } = normalizeScenario({
    floor: 12,
    hero: { class: 'Warrior', level: 4, healthPoints: 2, hunger: 40, gold: 120, talents: { fury: 2, bogus: 1 } },
    inventory: [{ id: 'PotionOfFrost', count: 3, equip: true, cursed: true, upgrade: 2 }],
    monsters: { mode: 'replace', list: [{ kind: 'Goblin', count: 2, near: true, awake: true }] },
  });
  assert.deepEqual(errors, []);
  assert.equal(scenario.floor, 12);
  assert.equal(scenario.hero.level, 4);
  assert.deepEqual(scenario.inventory, [{ id: 'PotionOfFrost', count: 3, equip: true, cursed: true, upgrade: 2 }]);
  assert.deepEqual(scenario.monsters, { list: [{ kind: 'Goblin', count: 2, near: true, awake: true }] });
}
{
  const { errors } = normalizeScenario({
    floor: 99,
    hero: { class: 'Nope', level: 40 },
    inventory: [{ id: 'Goblin' }, { id: 'Sword', count: 999 }, { id: 'Sword', tier: 9 }],
    monsters: { mode: 'sometimes', list: [{ kind: 'Sword' }, { kind: 'Goblin', count: 0 }] },
  });
  assert.ok(errors.some(error => /Floor must be between 1 and 25/.test(error)), 'floor range');
  assert.ok(errors.some(error => /Unknown hero class/.test(error)), 'unknown hero');
  assert.ok(errors.some(error => /Hero level must be/.test(error)), 'level range');
  assert.ok(errors.some(error => /Unknown item "Goblin"/.test(error)), 'monsters are not items');
  assert.ok(errors.some(error => /count must be 1/.test(error)), 'item count range');
  assert.ok(errors.some(error => /tier must be 1–5/.test(error)), 'tier range');
  assert.ok(errors.some(error => /mode must be/.test(error)), 'monster mode');
  assert.ok(errors.some(error => /Unknown monster "Sword"/.test(error)), 'items are not monsters');
}
{
  const { scenario } = normalizeScenario({ floor: 3 }, 25);
  assert.equal(scenario.hero, undefined);
  assert.equal(scenario.inventory, undefined, 'no inventory means keep starting gear');
  assert.equal(scenario.monsters, undefined);
}

// Monster expansion.
{
  const { scenario } = normalizeScenario({
    floor: 2,
    monsters: { list: [{ kind: 'Goblin', count: 3, near: true }, { kind: 'Skeleton', awake: true }] },
  });
  const placements = expandScenarioMonsters(scenario);
  assert.equal(placements.length, 4);
  assert.deepEqual(placements.filter(entry => entry.cls === Goblin).map(entry => entry.near),
    [true, true, true]);
  const skeleton = placements.find(entry => entry.cls === Skeleton);
  assert.equal(skeleton.awake, true);
  assert.equal(skeleton.near, false);
  assert.equal(scenarioReplacesPopulation(scenario), true, 'replace is the default');
}

// Hero loadout.
{
  const hero = new Warrior();
  applyScenarioHero(hero, {
    floor: 6,
    hero: { level: 3, healthPoints: 5, hunger: 25, gold: 340, talents: { fury: 2 } },
  });
  assert.equal(hero.level, 3, 'level applied through gainXp');
  assert.equal(hero.maxHealthPoints, 40, 'levelling grants +5 max HP per level');
  assert.equal(hero.xp, 0, 'a scenario starts at the level floor, not mid-level');
  assert.equal(hero.healthPoints, 5, 'explicit HP wins');
  assert.equal(hero.hunger, 25);
  assert.equal(hero.gold, 340);
  assert.deepEqual(hero.learnedTalents, ['fury', 'fury']);
}
{
  const hero = new Warrior();
  applyScenarioHero(hero, { floor: 6, hero: { level: 4 } });
  assert.equal(hero.level, 4);
  assert.equal(hero.healthPoints, hero.maxHealthPoints, 'unspecified HP starts full');
  assert.ok(hero.level <= MAX_SCENARIO_LEVEL);
}

// Inventory replaces starting gear exactly.
{
  const hero = new Warrior();
  const startingSword = new Sword(hero.context);
  hero.addItem(startingSword);
  hero.equipItem(startingSword);
  assert.equal(hero.getAllItems().length, 1);

  const warnings = applyScenarioInventory(hero, {
    floor: 10,
    inventory: [
      { id: 'TieredWeapon', tier: 2, equip: true },
      { id: 'PotionOfFrost', count: 3 },
      { id: 'Sword', cursed: true, upgrade: 2, identified: false },
    ],
  });
  assert.deepEqual(warnings, []);
  assert.equal(startingSword.unequipped, 1, 'starting gear is unequipped, not silently dropped');
  assert.equal(hero.weapon.tier, 2, 'equip flag installs the weapon');
  assert.ok(!hero.getAllItems().includes(startingSword), 'starting gear left the hero');
  assert.ok(!hero.context.entities.includes(startingSword), 'starting gear left the entity list');

  const potions = hero.backpack.filter(item => item.name === 'Potion of Frost');
  assert.equal(potions.length, 3, 'count creates copies that stack');
  assert.ok(potions.every(item => item.identified), 'consumables are identified by default');
  assert.ok(identified.includes('Potion of Frost'), 'identify() registers potion knowledge');

  const cursed = hero.backpack.find(item => item.name === 'Sword');
  assert.equal(cursed.cursed, true);
  assert.equal(cursed.curseId, 'polarized');
  assert.equal(cursed.level, 2, 'upgrade level applied');
  assert.equal(cursed.upgrades, 2, 'upgrade hooks ran');
  assert.equal(cursed.identified, false, 'identified:false keeps the unknown flow');
  assert.equal(removals, 0, 'replace never deletes entities');
}

// undefined inventory keeps the class's gear.
{
  const hero = new Warrior();
  const sword = new Sword(hero.context);
  hero.addItem(sword);
  hero.equipItem(sword);
  assert.deepEqual(applyScenarioInventory(hero, { floor: 1 }), []);
  assert.equal(hero.weapon, sword, 'starting gear survives when no inventory is listed');
}

// Containers and a full backpack are reported, never silently dropped.
{
  const hero = new Warrior();
  hero.backpack.length = 0;
  const warnings = applyScenarioInventory(hero, {
    floor: 1,
    inventory: [{ id: 'Chest' }, { id: 'Nope' }],
  });
  assert.ok(warnings.some(warning => /cannot start in a backpack/.test(warning)));
  assert.ok(warnings.some(warning => /Unknown item/.test(warning)));
}

// Post-load fixups mirror restoreRunState.
{
  const hero = new Warrior();
  const ring = new RingOfMight(hero.context);
  hero.ring1 = ring;
  const wand = new WandOfFrost(hero.context);
  hero.backpack.push(wand);
  finishScenarioInventory(hero.context, hero);
  assert.equal(ring.upgraded, 1, 'equipped rings re-apply their passive');
  assert.equal(wand.reconciled, true, 'wand charges reconcile to the floor');
}

console.log('scenario: ok');
