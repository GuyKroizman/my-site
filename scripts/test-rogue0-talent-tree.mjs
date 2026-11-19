import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('talent-tree');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import { TALENT_TREE, talentNodeById, isTalentUnlocked, unmetTalentRequirements } from '../src/games/rogue0/talents/talentTree.ts';
import { talentTreeLayout, talentNodeAt, treeScrollBounds } from '../src/games/rogue0/talents/talentTreeLayout.ts';

const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
const { Entity } = load('entity');
const dungeon = { log() {} };
const { default: BasicHero } = load('classes/basicHero',
  { Entity, dungeon, sfx: { levelUp() {} }, spawnEntityFloatingText() {} });
const Warrior = load('classes/warrior', { BasicHero, dungeon }).default;

function hero() {
  const h = Object.create(Warrior.prototype);
  Object.assign(h, {
    talentClass: 'Warrior', talentRanks: {}, talentPointsEarned: 0,
    level: 1, xp: 0, healthPoints: 20, maxHealthPoints: 30,
    context: { simulationTime: 12.5 }, refreshUI() {}, spendTurn() { this.spent = (this.spent ?? 0) + 1; },
  });
  return h;
}

// Tree integrity: unique ids, prerequisites exist in the same class and point
// backwards to a lower tier (so the graph cannot contain a cycle).
const ids = new Set();
for (const [className, nodes] of Object.entries(TALENT_TREE)) {
  assert.equal(nodes.length, 9, `${className} has three branches of three tiers`);
  for (const entry of nodes) {
    assert.ok(!ids.has(entry.id), `duplicate talent id ${entry.id}`);
    ids.add(entry.id);
    assert.equal(entry.maxRank, 2);
    for (const requirement of entry.requires) {
      const parent = nodes.find(node => node.id === requirement);
      assert.ok(parent, `${entry.id}'s prerequisite belongs to ${className}`);
      assert.ok(parent.tier < entry.tier, `${entry.id} requires a lower tier`);
    }
  }
}
assert.equal(talentNodeById('fury').name, 'Deep Fury');

// Award/spend rules, prerequisites, rank cap and no world time consumed.
const h = hero();
h.gainXp(8);
assert.equal(h.level, 2);
assert.equal(h.talentPoints, 1);
assert.equal(h.learnTalent('fury'), true);
assert.equal(h.learnTalent('fury'), false, 'rank cap is two');
assert.equal(h.learnTalent('bloodletter'), false, 'tier 2 locked by level');
h.gainXp(16 + 24 + 32); // level 5
assert.equal(h.level, 5);
assert.equal(h.learnTalent('bloodletter'), true);
assert.equal(h.learnTalent('sustainedRage'), false, 'tier 3 locked by prerequisite');
assert.equal(isTalentUnlocked(talentNodeById('sustainedRage'), h.talentRanks, 5), false);
assert.equal(h.talentPoints, 2);
assert.equal(h.context.simulationTime, 12.5);
assert.equal(h.spent, undefined);

// Locked talents must explain every gate. Ranking Quickstep twice is not enough
// on its own: Relentless is tier 2 and needs level 5 as well.
const relentless = talentNodeById('relentless');
assert.equal(isTalentUnlocked(relentless, { quickstep: 2 }, 3), false);
assert.deepEqual(unmetTalentRequirements(relentless, { quickstep: 2 }, 3), ['level 5 (you are 3)']);
assert.deepEqual(unmetTalentRequirements(relentless, {}, 5), ['Quickstep 1']);
assert.deepEqual(unmetTalentRequirements(relentless, {}, 3), ['level 5 (you are 3)', 'Quickstep 1']);
assert.equal(isTalentUnlocked(relentless, { quickstep: 2 }, 5), true);
assert.deepEqual(unmetTalentRequirements(relentless, { quickstep: 2 }, 5), []);

// Old saves: keep earned ranks, drop foreign ids, grant the new entitlement.
const old = hero();
old.level = 6;
old.talentRanks = { fury: 2, grace: 2 };
delete old.talentPointsEarned;
old.migrateTalentPoints();
assert.equal(old.talentRank('grace'), 0, 'foreign ranks are retired');
assert.equal(old.talentRanks.grace, undefined);
assert.equal(old.talentRank('fury'), 2);
assert.ok(old.talentPoints >= 3, 'level-based entitlement is restored');

// Pane/chrome containment, a two-axis scrollable canvas, and hit testing.
for (const [width, height] of [[1920, 1080], [1280, 720], [800, 400], [390, 844], [360, 640], [320, 240]]) {
  const layout = talentTreeLayout(width, height, TALENT_TREE.Warrior);
  const inside = rect => rect.x >= -1e-6 && rect.y >= -1e-6 &&
    rect.x + rect.width <= width + 1e-6 && rect.y + rect.height <= height + 1e-6;
  assert.ok(inside(layout.panel) && inside(layout.modal) && inside(layout.modalRankUp) &&
    inside(layout.modalClose) && inside(layout.close),
    `${width}x${height} keeps panel and buttons on screen`);
  assert.ok(inside(layout.viewport), `${width}x${height} keeps the tree pane on screen`);
  const bounds = treeScrollBounds(layout);
  assert.ok(layout.contentWidth > layout.viewport.width && bounds.maxX > 0,
    `${width}x${height} scrolls horizontally`);
  assert.ok(layout.contentHeight > layout.viewport.height && bounds.maxY > 0,
    `${width}x${height} scrolls vertically`);
  for (const box of layout.nodes) {
    assert.ok(box.rect.x >= 0 && box.rect.y >= 0 &&
      box.rect.x + box.rect.width <= layout.contentWidth + 1e-6 &&
      box.rect.y + box.rect.height <= layout.contentHeight + 1e-6,
      `${width}x${height} keeps ${box.id} inside the tree canvas`);
    const cx = box.rect.x + box.rect.width / 2, cy = box.rect.y + box.rect.height / 2;
    const scrollX = Math.max(0, Math.min(bounds.maxX, cx - layout.viewport.width / 2));
    const scrollY = Math.max(0, Math.min(bounds.maxY, cy - layout.viewport.height / 2));
    assert.equal(talentNodeAt(layout, layout.viewport.x + cx - scrollX,
      layout.viewport.y + cy - scrollY, scrollX, scrollY), box.id);
  }
}
assert.throws(() => talentTreeLayout(0, 100, []), RangeError);
console.log('Talent tree integrity, points, prerequisites, migration and layout passed');
