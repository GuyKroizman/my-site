import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('inventory-core');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInventoryActions, canStackItems, splitStackItem } from '../src/games/rogue0/inventory.ts';
import { clearFloorSprite, clearItemUI, placeFloorItem } from '../src/games/rogue0/itemPresentation.ts';
import { heroStatsText, heroHudView, heroPortrait } from '../src/games/rogue0/heroViewModel.ts';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';
import { sfx, setMuted } from '../src/games/rogue0/audio.ts';

// No source stripping, injected class bodies, Phaser, DOM, or global dungeon.
let constructions = 0;
class Item {
  constructor(overrides = {}) {
    constructions++;
    Object.assign(this, {
      type: 'item', name: 'Potion', displayName: 'Potion', displayDescription: 'Description',
      equipSlot: 'consumable', count: 1, goldAmount: 0, effects: [],
      identified: true, level: 0, tier: 1, cursed: false, blessed: false, charges: 0,
      isPhysicalEquipment: false, curseId: '', x: 3, y: 4,
    }, overrides);
  }
  equip() { this.context.events.push('equip'); }
  unequip() { this.context.events.push('unequip'); }
  onUncursed() { this.context.events.push('uncursed'); }
}
class Owner {
  constructor() {
    this.context = { entities: [this], messages: [], events: [] };
    this.context.player = this;
    Object.assign(this, { backpack: [], capacity: 2, gold: 0, x: 1, y: 2,
      sprite: {}, actionReady: true, actions: [], nextActionTime: 0, effects: [], quickslots: [] });
  }
  canAct() { return this.actionReady; }
  spendTurn(action) { this.actions.push(action); this.nextActionTime++; this.actionReady = false; }
}
const equipSounds = [];
const inventory = createInventoryActions({
  log(context, message) { context.messages.unshift(message); },
  equipSound(cursed) { equipSounds.push(cursed); },
  removeEntity(context, item) {
    context.events.push('remove');
    context.entities = context.entities.filter(entity => entity !== item);
  },
  removeEffect(owner, id) {
    owner.context.events.push(`remove-effect:${id}`);
    owner.effects = owner.effects.filter(effect => effect.id !== id);
  },
  clearFloorSprite, clearItemUI, placeFloorItem,
});
function carry(owner, item) {
  item.context = owner.context;
  assert.equal(inventory.addItem(owner, item), true);
  return item;
}
function gear(slot = 'weapon', overrides = {}) {
  return new Item({ equipSlot: slot, isPhysicalEquipment: slot === 'weapon' || slot === 'armor',
    name: slot, displayName: slot, ...overrides });
}

// Pickup respects capacity, never auto-equips, and leaves rejected floor items intact.
{
  const owner = new Owner();
  const weapon = carry(owner, gear());
  assert.equal(owner.weapon, undefined);
  assert.deepEqual(owner.backpack, [weapon]);
  assert.deepEqual([weapon.x, weapon.y, weapon.context], [undefined, undefined, owner.context]);
  assert.equal(owner.nextActionTime, 0);
  carry(owner, gear('armor'));
  const rejected = gear('artifact');
  owner.context.entities.push(rejected);
  const original = { ...rejected };
  assert.equal(inventory.addItem(owner, rejected), false);
  assert.deepEqual({ ...rejected }, original);
  assert.ok(owner.context.entities.includes(rejected));
  assert.equal(inventory.addItem(owner, new Item({ isContainer: true })), false);
}

// Stacking is state- and class-sensitive, and still works with a full backpack.
{
  const owner = new Owner(); owner.capacity = 1;
  const original = carry(owner, new Item({ count: 2 }));
  owner.quickslots[0] = original;
  const incoming = new Item({ count: 3 });
  let destroyed = 0, killed = 0;
  incoming.sprite = { destroy() { destroyed++; } };
  owner.context.scene = { tweens: { killTweensOf() { killed++; } } };
  owner.context.entities.push(incoming);
  assert.equal(inventory.addItem(owner, incoming), true);
  assert.equal(original.count, 5);
  assert.equal(owner.backpack.length, 1);
  assert.equal(owner.quickslots[0], original);
  assert.ok(!owner.context.entities.includes(incoming));
  assert.deepEqual([destroyed, killed, incoming.sprite], [1, 1, undefined]);
  for (const overrides of [
    { name: 'Other' }, { equipSlot: 'junk' }, { identified: false }, { level: 1 },
    { tier: 2 }, { cursed: true }, { blessed: true }, { charges: 1 }, { effects: [{ id: 'burning' }] },
  ]) assert.equal(canStackItems(original, new Item(overrides)), false, JSON.stringify(overrides));
  class OtherItem extends Item {}
  assert.equal(canStackItems(original, new OtherItem()), false);
  original.effects = [{ id: 'poisoned' }];
  assert.equal(canStackItems(original, new Item()), false);
}

// Only live, positioned floor gold is credited, regardless of backpack capacity.
{
  const owner = new Owner(); owner.capacity = 0;
  const gold = new Item({ goldAmount: 17 });
  owner.context.entities.push(gold);
  assert.equal(inventory.addItem(owner, gold), true);
  assert.equal(inventory.addItem(owner, gold), false);
  assert.equal(owner.gold, 17);
  assert.deepEqual(owner.backpack, []);
  const carriedGold = new Item({ goldAmount: 8, x: undefined, y: undefined });
  owner.context.entities.push(carriedGold);
  assert.equal(inventory.addItem(owner, carriedGold), false);
  assert.equal(owner.gold, 17);
}

// Starting gear is free; live equipment swaps cost one action and preserve
// passive-hook ordering, including when the backpack is full.
{
  const owner = new Owner(); owner.sprite = undefined; owner.actionReady = false;
  const old = carry(owner, gear('weapon', { identified: false }));
  inventory.equipItem(owner, old);
  assert.equal(owner.weapon, old);
  assert.equal(old.identified, false, 'equipping alone does not identify unknown gear');
  assert.deepEqual(owner.actions, []);
  owner.sprite = {}; owner.actionReady = true;
  const replacement = carry(owner, gear());
  const extra = carry(owner, gear('armor'));
  old.unequip = () => {
    assert.equal(owner.weapon, replacement, 'new slot reference installed before old passive is removed');
    owner.context.events.push('unequip');
  };
  owner.context.events = [];
  inventory.equipItem(owner, replacement);
  assert.deepEqual(owner.backpack, [extra, old]);
  assert.deepEqual(owner.context.events, ['unequip', 'equip']);
  assert.deepEqual(owner.actions, ['equip']);
  assert.equal(owner.nextActionTime, 1);
  owner.actionReady = true;
  inventory.unequipItem(owner, replacement);
  assert.equal(owner.weapon, replacement, 'full backpack blocks unequip without losing gear');
  assert.equal(owner.nextActionTime, 1);
}

// Every equipment kind selects its sound by curse state, not identification.
for (const slot of ['weapon', 'armor', 'ring', 'artifact']) {
  for (const cursed of [false, true]) {
    for (const identified of [false, true]) {
      const owner = new Owner();
      const item = carry(owner, gear(slot, { cursed, identified }));
      const before = equipSounds.length;
      inventory.equipItem(owner, item);
      assert.deepEqual(equipSounds.slice(before), [cursed], `${slot}: exactly one matching equip sound`);
    }
  }
}

// Guards are free: unavailable turns, stale references, unsuitable slots and curses.
{
  const owner = new Owner();
  const cursed = carry(owner, gear('weapon', { cursed: true, identified: false }));
  inventory.equipItem(owner, cursed);
  assert.equal(cursed.identified, false, 'equipping reveals the curse, not the upgrade level');
  assert.ok(owner.context.messages.some(message => message.includes('cursed and cannot')),
    'equipping reveals that unknown gear is cursed');
  const replacement = carry(owner, gear());
  owner.actionReady = true;
  const time = owner.nextActionTime;
  const soundsBeforeGuards = equipSounds.length;
  inventory.equipItem(owner, replacement);
  inventory.unequipItem(owner, cursed);
  inventory.dropItem(owner, cursed);
  inventory.equipItem(owner, new Item());
  inventory.equipItem(owner, gear('armor'));
  assert.equal(owner.weapon, cursed);
  assert.equal(owner.nextActionTime, time);
  owner.actionReady = false;
  inventory.equipItem(owner, replacement);
  inventory.unequipItem(owner, cursed);
  inventory.dropItem(owner, replacement);
  assert.equal(owner.nextActionTime, time);
  owner.actionReady = true;
  inventory.dropItem(owner, gear());
  owner.x = undefined;
  inventory.dropItem(owner, replacement);
  assert.ok(owner.backpack.includes(replacement));
  assert.equal(owner.nextActionTime, time);
  assert.equal(equipSounds.length, soundsBeforeGuards, 'blocked actions play no equip sound');
}

// Ring placement uses two distinct slots; ownership is queried by identity.
{
  const owner = new Owner();
  for (const slot of ['weapon', 'armor', 'artifact']) {
    const item = carry(owner, gear(slot));
    owner.actionReady = true;
    inventory.equipItem(owner, item);
    assert.equal(inventory.slotOf(owner, item), slot);
  }
  const first = carry(owner, gear('ring'));
  assert.equal(inventory.slotFor(owner, first), 'ring1');
  owner.actionReady = true; inventory.equipItem(owner, first);
  const second = carry(owner, gear('ring'));
  assert.equal(inventory.slotFor(owner, second), 'ring2');
  owner.actionReady = true; inventory.equipItem(owner, second);
  assert.equal(inventory.slotFor(owner, gear('ring')), undefined);
  assert.equal(inventory.equippedItems(owner).length, 5);
  assert.equal(inventory.slotOf(owner, gear('ring')), undefined);
}

// Drops split without rerolls, preserve quickslot identity, and don't share
// presentation/effect objects. Equipped drops remove their passive exactly once.
{
  const owner = new Owner();
  const stack = carry(owner, new Item({ count: 3, level: 2, blessed: true }));
  owner.quickslots[0] = stack;
  stack.UISprite = { destroy() { throw Error('stack UI must remain alive'); } };
  const before = constructions;
  inventory.dropItem(owner, stack);
  const dropped = owner.context.entities.find(item => item !== owner && item !== stack);
  assert.ok(dropped instanceof Item);
  assert.equal(constructions, before);
  assert.deepEqual([dropped.count, dropped.level, dropped.blessed, dropped.x, dropped.y], [1, 2, true, 1, 2]);
  assert.equal(dropped.UISprite, undefined);
  assert.equal(stack.count, 2);
  assert.equal(owner.quickslots[0], stack);
  assert.deepEqual(owner.actions, ['drop']);
  const affected = new Item({ effects: [{ id: 'chilled', duration: 7 }] });
  const split = splitStackItem(affected);
  split.effects[0].duration--;
  assert.equal(affected.effects[0].duration, 7);
  const equipped = carry(owner, gear('armor'));
  owner.actionReady = true; inventory.equipItem(owner, equipped);
  owner.context.events = [];
  let uiDestroyed = 0;
  equipped.UIText = { destroy() { uiDestroyed++; } };
  owner.actionReady = true; inventory.dropItem(owner, equipped);
  assert.equal(owner.armor, undefined);
  assert.deepEqual(owner.context.events, ['unequip']);
  assert.equal(uiDestroyed, 1);
  assert.deepEqual([equipped.x, equipped.y], [1, 2]);
}

// Consuming decrements a stack without spending another action; final removal
// and bulk removal maintain equipment hooks and entity membership semantics.
{
  const owner = new Owner();
  const potion = carry(owner, new Item({ count: 2 }));
  inventory.removeItem(owner, potion);
  assert.equal(potion.count, 1);
  assert.ok(owner.backpack.includes(potion));
  inventory.removeItem(owner, potion);
  assert.ok(!owner.backpack.includes(potion));
  assert.ok(owner.context.entities.includes(potion), 'consumable caller owns world-entity removal');
  assert.deepEqual(owner.actions, []);
  const weapon = carry(owner, gear('weapon', { blessed: true }));
  inventory.equipItem(owner, weapon);
  const armor = carry(owner, gear('armor', { blessed: true }));
  inventory.removeItemsByProperty(owner, 'blessed', true);
  assert.equal(owner.weapon, undefined);
  assert.ok(!owner.backpack.includes(armor));
  assert.ok(!owner.context.entities.includes(weapon));
  assert.ok(!owner.context.entities.includes(armor));
}

// Targeted cleansing must leave another equipped cursed gem active. Targets
// outside the inventory cannot be cleansed, and repeated cleansing is harmless.
{
  const owner = new Owner();
  const first = gear('ring', { cursed: true, curseId: 'hex', curseEffectId: 'cursed' });
  const second = gear('artifact', { cursed: true, curseId: 'hex', curseEffectId: 'cursed' });
  first.context = second.context = owner.context;
  owner.ring1 = first; owner.artifact = second; owner.effects = [{ id: 'cursed' }];
  inventory.removeCurse(owner, first);
  assert.deepEqual([first.cursed, first.curseLifted, first.curseId], [false, true, '']);
  assert.equal(second.cursed, true);
  assert.equal(owner.effects.length, 1);
  const external = gear('weapon', { cursed: true });
  inventory.removeCurse(owner, external);
  assert.equal(external.cursed, true);
  inventory.removeCurse(owner);
  assert.equal(second.cursed, false);
  assert.deepEqual(owner.effects, []);
  const calls = owner.context.events.filter(event => event === 'uncursed').length;
  inventory.removeCurse(owner);
  assert.equal(owner.context.events.filter(event => event === 'uncursed').length, calls);
  assert.deepEqual(owner.actions, []);
}

// Two owners share operation code, not storage. Saves keep the legacy flat
// fields and item graph; no new controller or renderer enters the payload.
{
  const first = new Owner(), second = new Owner();
  const weapon = carry(first, gear());
  inventory.equipItem(first, weapon);
  const potion = carry(first, new Item({ count: 4 }));
  first.quickslots[0] = potion;
  carry(second, new Item());
  const registry = { 'legacy:hero': Owner, 'legacy:item': Item };
  const graph = encodeGraph(first, registry);
  const node = graph.nodes.find(node => node.type === 'legacy:hero');
  const fields = new Set(node.data.map(([key]) => key));
  for (const field of ['weapon', 'backpack', 'quickslots', 'capacity', 'gold']) assert.ok(fields.has(field));
  assert.ok(!fields.has('inventory'));
  assert.ok(!fields.has('context'));
  const restored = decodeGraph(JSON.parse(JSON.stringify(graph)), registry);
  assert.equal(restored.backpack[0], restored.quickslots[0]);
  assert.ok(restored.weapon instanceof Item);
  assert.equal(restored.backpack[0].count, 4);
  inventory.removeItem(first, potion);
  assert.equal(potion.count, 3);
  assert.equal(second.backpack[0].count, 1);
  assert.equal(restored.backpack[0].count, 4);
}

// Shared floor presentation keeps potion scale, tint, pulse and centred tiles.
{
  let destroyed = 0;
  const sprites = [], tweens = [];
  const item = new Item({ textureKey: 'potion-blue', spriteTextureKey: 'potion-3', spriteFrame: 0, tint: 0x123456 });
  item.sprite = { destroy() { destroyed++; } };
  item.context = {
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    scene: {
      add: { sprite(x, y, key, frame) {
        const sprite = { x, y, key, frame,
          setOrigin(origin) { this.origin = origin; return this; },
          setScale(scale) { this.scale = scale; return this; },
          setPosition(x, y) { this.x = x; this.y = y; return this; } };
        sprites.push(sprite); return sprite;
      } },
      tweens: { add(config) { tweens.push(config); } }
    }
  };
  placeFloorItem(item);
  assert.equal(destroyed, 1);
  assert.equal(item.sprite, sprites[0]);
  // A half-scale flask is inset 4px so it sits in the middle of the tile.
  assert.deepEqual([item.sprite.x, item.sprite.y, item.sprite.key, item.sprite.frame, item.sprite.scale, item.sprite.tint],
    [48 + 4, 64 + 4, 'potion-3', 0, 0.5, 0x123456]);
  assert.equal(tweens[0].targets, item.sprite);
  assert.equal(tweens[0].repeat, -1);
}

// Glyph stones drop half size, in the middle of the tile instead of its corner.
{
  const sprites = [];
  const stone = new Item({ textureKey: 'glyph-stone-blink', spriteTextureKey: 'glyph-stone-blink',
    spriteFrame: 0 });
  stone.sprite = { destroy() {} };
  stone.context = {
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    scene: {
      add: { sprite(x, y, key, frame) {
        const sprite = { x, y, key, frame,
          setOrigin(origin) { this.origin = origin; return this; },
          setScale(scale) { this.scale = scale; return this; },
          setPosition(x, y) { this.x = x; this.y = y; return this; } };
        sprites.push(sprite); return sprite;
      } },
      tweens: { add() {} }
    }
  };
  placeFloorItem(stone);
  assert.deepEqual([stone.sprite.x, stone.sprite.y, stone.sprite.scale], [3 * 16 + 4, 4 * 16 + 4, 0.5],
    'half-scale art sits 4px in from the tile corner, which centres it on the tile');
}

// HUD strings/health clipping are pure and independent of the simulation clock.
{
  const hero = Object.freeze({ level: 3, xp: 5, strength: 12, healthPoints: 24, maxHealthPoints: 30,
    hunger: 29.25, maxHunger: 100, hungerState: 'Hungry', gold: 77,
    xpForNextLevel: () => 24 });
  assert.equal(heroStatsText(hero), 'Lv 3  Xp 5/24  Str 12\nHp: 24/30\nFood: 30/100 (Hungry)  Gold: 77');
  assert.deepEqual(heroHudView(hero, 6), { healthFraction: 0.8, healthText: '24/30',
    heroStatus: 'Lv 3 · Food 30 · Hungry', floorStatus: 'Floor 6' });
  assert.doesNotMatch(heroStatsText(hero), /\[f\]|recharg|Power Strike/);
  assert.equal(heroHudView({ ...hero, healthPoints: -1 }, 1).healthFraction, 0);
  assert.equal(heroHudView({ ...hero, healthPoints: 50 }, 1).healthFraction, 1);
  assert.equal(heroHudView({ ...hero, healthPoints: 0, maxHealthPoints: 0 }, 1).healthFraction, 0);
}

// The character-info button must draw the hero's real sprite (custom hero art),
// not the legacy "tiles" atlas frame that shows a different character.
{
  const heroSprite = Object.freeze({ spriteTextureKey: 'hero-color', spriteFrame: 0 });
  assert.deepEqual(heroPortrait(heroSprite), { textureKey: 'hero-color', frame: 0 });
  assert.deepEqual(heroPortrait(undefined), { textureKey: 'tiles', frame: 26 });
  // A frame-carrying atlas hero keeps its frame rather than collapsing to 0.
  assert.deepEqual(heroPortrait({ spriteTextureKey: 'tiles', spriteFrame: 49 + 24 }),
    { textureKey: 'tiles', frame: 73 });
  const ui = fs.readFileSync(new URL('../src/games/rogue0/ui.ts', import.meta.url), 'utf8');
  assert.match(ui, /heroPortrait\(this\.context\.player\)/, 'toolbar portrait uses heroPortrait');
  assert.doesNotMatch(ui, /add\.sprite\(0, 0, "tiles", p \? p\.tile : 26\)/,
    'toolbar portrait must not use the legacy atlas tile');
}
// Cursed equipment gets a descending dissonant sting instead of the normal
// short click. Both variants obey the game's existing mute switch.
{
  const oscillators = [];
  class FakeParam {
    setValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.ramp = value; }
  }
  class FakeAudioContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createOscillator() {
      const osc = { frequency: new FakeParam(), connect() {}, start() {}, stop() {} };
      oscillators.push(osc);
      return osc;
    }
    createGain() { return { gain: new FakeParam(), connect() {} }; }
  }
  const previousWindow = globalThis.window;
  globalThis.window = { AudioContext: FakeAudioContext };
  try {
    sfx.equip(false);
    assert.equal(oscillators.length, 1, 'normal equip retains its single click');
    assert.equal(oscillators[0].frequency.value, 1000);
    oscillators.length = 0;
    sfx.equip(true);
    assert.equal(oscillators.length, 3, 'cursed equip replaces the click with a layered sting');
    assert.ok(oscillators.every(osc => osc.frequency.ramp < osc.frequency.value),
      'the curse tones slide downward');
    assert.ok(oscillators.some(osc => osc.type === 'sawtooth'));
    oscillators.length = 0;
    setMuted(true);
    sfx.equip(false);
    sfx.equip(true);
    assert.equal(oscillators.length, 0, 'muting silences both equip sounds');
  } finally {
    setMuted(false);
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

console.log('Rogue0 inventory core: storage, stacking, gold, equipment/passive order, curse guards, costs, drops, consumption, cleansing, save identity, owner isolation, presentation and HUD passed');
