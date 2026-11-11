import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('weapon-visuals');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';

const { Entity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) {
  Object.assign(this, { context, x, y });
  this.initialTexture = this.spriteTextureKey;
};
const { TieredWeapon, WEAPON_TEXTURES } = load('src/games/rogue0/items/tieredEquipment.ts', { Entity });
const { weaponPixels, generateWeaponTextures, LEGACY_WEAPON_ART, legacyWeaponPixels } =
  load('src/games/rogue0/weaponTextures.ts', { WEAPON_TEXTURES });
const silhouettes = new Set();
const textures = new Map();
let created = 0, destroyed = 0;
const scene = {
  textures: { exists: key => textures.has(key) },
  make: { graphics() {
    created++;
    const cells = [];
    return {
      fillStyle(color, alpha) { assert.equal(alpha, 1); this.color = color; },
      fillRect(x, y, w, h) {
        assert.equal(w, 1); assert.equal(h, 1);
        assert.ok(Number.isInteger(x) && x >= 0 && x < 16);
        assert.ok(Number.isInteger(y) && y >= 0 && y < 16);
        cells.push([x, y, this.color]);
      },
      generateTexture(key, w, h) { assert.deepEqual([w, h], [16, 16]); textures.set(key, cells); },
      destroy() { destroyed++; }
    };
  } }
};
generateWeaponTextures(scene);
assert.deepEqual([...textures.keys()], [...WEAPON_TEXTURES.slice(1), ...Object.keys(LEGACY_WEAPON_ART)]);
for (let tier = 1; tier <= 5; tier++) {
  const item = new TieredWeapon({}, 2, 3, tier);
  assert.equal(item.textureKey, WEAPON_TEXTURES[tier - 1]);
  assert.equal(item.spriteTextureKey, WEAPON_TEXTURES[tier - 1]);
  assert.equal(item.initialTexture, item.spriteTextureKey, 'texture selected before floor sprite initialization');
  assert.equal(item.spriteFrame, 0, 'every tier draws its own generated art');
  assert.equal(item.minDamage, tier);
  assert.equal(item.maxDamage, tier * 5);
  assert.equal(item.attackDelay, [0.8, 1, 1, 1.2, 1.4][tier - 1]);
  if (tier === 1) {
    // Tier 1 shares the legacy dagger silhouette instead of a tiered blade.
    assert.ok(LEGACY_WEAPON_ART[item.textureKey], 'tier 1 uses the dagger silhouette');
    continue;
  }
  const pixels = weaponPixels(tier);
  assert.equal(pixels.length, 256, 'art occupies exactly one 16px tile');
  assert.deepEqual(pixels, weaponPixels(tier), 'art is deterministic');
  assert.ok(pixels.every(c => c === -1 || Number.isInteger(c) && c >= 0 && c <= 0xffffff));
  for (const corner of [0, 15, 240, 255]) assert.equal(pixels[corner], -1);
  assert.ok(pixels.filter(c => c !== -1).length >= 45, 'readable silhouette');
  assert.ok(new Set(pixels).size >= 8, 'shaded metal and contrasting hilt detail');
  silhouettes.add(pixels.map(c => c === -1 ? '.' : '#').join(''));
  const expected = pixels.flatMap((color, i) => color === -1 ? [] : [[i % 16, Math.floor(i / 16), color]]);
  assert.deepEqual(textures.get(item.textureKey), expected, 'generated sprite matches the pixel design');
}
for (const key of Object.keys(LEGACY_WEAPON_ART)) {
  const pixels = legacyWeaponPixels(key);
  assert.equal(pixels.length, 256);
  assert.ok(pixels.every(c => c === -1 || Number.isInteger(c) && c >= 0 && c <= 0xffffff));
  assert.ok(pixels.filter(c => c !== -1).length >= 45, `${key} has a readable silhouette`);
  assert.deepEqual(pixels, legacyWeaponPixels(key), `${key} art is deterministic`);
  assert.deepEqual(textures.get(key), pixels.flatMap((color, i) =>
    color === -1 ? [] : [[i % 16, Math.floor(i / 16), color]]), `${key} generated sprite matches its design`);
  silhouettes.add(pixels.map(c => c === -1 ? '.' : '#').join(''));
}
assert.equal(silhouettes.size, 9, 'every weapon differs in shape, not just palette');
generateWeaponTextures(scene);
assert.equal(created, 9, 'scene restarts reuse existing textures');
assert.equal(destroyed, created, 'temporary graphics are released');
textures.delete(WEAPON_TEXTURES[3]);
generateWeaponTextures(scene);
assert.equal(created, 10, 'a missing texture can be independently rebuilt');
assert.equal(destroyed, 10);
assert.throws(() => weaponPixels(1), RangeError);
assert.throws(() => legacyWeaponPixels('weapon-nope'), TypeError);
const source = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.match(source, /generateWeaponTextures\(this\)/, 'scene registers weapon textures');
console.log('Weapon visuals: tier art, sprite selection, unchanged stats, transparent pixels and texture lifecycle passed.');
