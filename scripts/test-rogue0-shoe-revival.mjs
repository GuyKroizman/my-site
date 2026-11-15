import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('shoe-revival');
import assert from 'node:assert/strict';
import fs from 'node:fs';

// --- Source/plan invariants ---
const scene0 = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
const plan = fs.readFileSync('src/games/rogue0/PLAN.md', 'utf8');
const quloptsh = fs.readFileSync('src/games/rogue0/monsters/quloptsh.ts', 'utf8');
const shoeRevivalSrc = fs.readFileSync('src/games/rogue0/shoeRevival.ts', 'utf8');
const ritualSrc = fs.readFileSync('src/games/rogue0/shoeBlessingRitual.ts', 'utf8');
const shopItemsSrc = fs.readFileSync('src/games/rogue0/store/shopItems.ts', 'utf8');
const entitySrc = fs.readFileSync('src/games/rogue0/entity.ts', 'utf8');
const combatSrc = fs.readFileSync('src/games/rogue0/combatApplication.ts', 'utf8');
const heroSrc = fs.readFileSync('src/games/rogue0/classes/basicHero.ts', 'utf8');
const itemPresentationSrc = fs.readFileSync('src/games/rogue0/itemPresentation.ts', 'utf8');

assert.ok(!/loot: \[false, Shoe\]/.test(quloptsh), 'Quloptsh must not drop revival boot');
assert.ok(!/\[Shoe, 1\]/.test(scene0), 'Boot must not be in LOOT_TABLE');
assert.ok(/BOOT_RITUAL_MURAL_FRAME|SHOE_RITUAL_MURAL_FRAME/.test(scene0), 'floor 7 ritual mural is wired in scene');
assert.ok(/floor-7 mural/i.test(plan), 'plan documents the floor-7 ritual mural');
assert.ok(/find\(item => item instanceof BlessedShoe\)/.test(shoeRevivalSrc), 'blessed priority');
assert.ok(/onForgetFloorMemory/.test(shoeRevivalSrc), 'normal revive forgets floor memory');
assert.ok(/DroppedBackpack/.test(shoeRevivalSrc), 'normal revive drops backpack container');
assert.ok(/player\.ring1, player\.ring2, player\.artifact/.test(shoeRevivalSrc), 'rings/artifact dropped');
assert.ok(/container\.sprite[\s\S]{0,40}setDepth/.test(shoeRevivalSrc), 'dropped backpack kept above loose items');
assert.ok(/always stocked in every store/.test(shopItemsSrc), 'every store stocks a normal Boot');
assert.ok(/tryRevive/.test(entitySrc), 'entity removal guards player revive');
assert.ok(/tryRevive/.test(combatSrc), 'combat application guards player revive');
assert.ok(/tryReviveHero/.test(heroSrc), 'hero refresh/death paths use revive logic');
assert.ok(/onFloorItemPlaced/.test(scene0), 'ritual wired to floor item placement');
// shoeShopFloor may remain in saves for compatibility but is no longer required for stock selection.
assert.ok(/context\.onFloorItemPlaced\?\.\(item\)/.test(itemPresentationSrc), 'floor placement hook fires for placed/thrown items');
assert.ok(/shatterPotion/.test(heroSrc), 'thrown potions shatter path exists');

// --- Shop: every store stocks a normal Boot; Blessed Boot never sold ---
import { planShopStock, isShopFloor, SHOP_FLOORS } from '../src/games/rogue0/store/shopStock.ts';
import { buyPrice } from '../src/games/rogue0/store/shopPricing.ts';
{
  for (const floor of [6, 11, 16, 21]) {
    const planSlots = planShopStock(floor, () => 0.2);
    const boots = planSlots.filter(slot => slot.kind === 'boot');
    assert.equal(boots.length, 1, 'each store stocks exactly one normal Boot');
    assert.ok(planSlots.every(slot => slot.kind !== 'blessed-boot' && slot.kind !== 'blessed-shoe'), 'Blessed Boot never stocked');
  }
  assert.ok(SHOP_FLOORS.every(isShopFloor));
  assert.equal(buyPrice({ name: 'Boot', equipSlot: 'junk', textureKey: 'junk-boot', tier: 1, level: 0, charges: 0, cursed: false }), 180);
  assert.equal(buyPrice({ name: 'Blessed Boot', equipSlot: 'junk', textureKey: 'blessed-boot', tier: 1, level: 0, charges: 0, cursed: false }), 360);
}

// --- Ritual logic (structure checks) ---
assert.ok(/\[\[1, 0\], \[-1, 0\]\]/.test(ritualSrc) || /x - 1/.test(ritualSrc), 'ritual checks left/right');
assert.ok(/\[\[0, 1\], \[0, -1\]\]/.test(ritualSrc) || /y - 1/.test(ritualSrc), 'ritual checks above/below');
assert.ok(/BerserkPotion/.test(ritualSrc) && /PotionOfHealing/.test(ritualSrc), 'ritual requires berserk and healing potions');
assert.ok(/BlessedShoe/.test(ritualSrc) && /removeEntity/.test(ritualSrc), 'ritual transforms and consumes');
assert.ok(/sfx\.playerDeath|playerDeath/.test(shoeRevivalSrc), 'revival cues death sound');
assert.ok(/sfx\.revive|revive\(\)/.test(shoeRevivalSrc), 'revival plays revive sound/animation cues');
assert.ok(/playerDeath/.test(scene0) || /gameover/.test(scene0), 'death presentation wired in scene');

// --- Save/load persistence & registry shape checks ---
{
  const regSrc = fs.readFileSync('src/games/rogue0/saveRegistry.ts', 'utf8');
  assert.ok(/item:blessed-shoe/.test(regSrc), 'BlessedShoe registered for saves');
  assert.ok(/item:dropped-backpack/.test(regSrc), 'DroppedBackpack registered for saves');
}

console.log('Boot revival tests passed.');
