import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('monster-status');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { updateMonsterStatusVisuals, clearMonsterStatusVisuals } from '../src/games/rogue0/monsterStatusVisuals.ts';
import { MonsterInspectStatuses } from '../src/games/rogue0/monsterInspectStatuses.ts';
import { STATUS_ICON_TEXTURE, statusIconFrame } from '../src/games/rogue0/statusIconTextures.ts';

globalThis.Phaser = { TintModes: { FILL: 1 } };
const created = [];
function object(properties = {}) {
  const result = { ...properties, destroyed: false,
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setY(y) { this.y = y; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setVisible(visible) { this.visible = visible; return this; },
    setDisplaySize(width, height) { this.width = width; this.height = height; return this; },
    setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; },
    setScale(x, y) { this.scaleX = x; this.scaleY = y; return this; },
    setRotation(rotation) { this.rotation = rotation; return this; },
    setFlip(x, y) { this.flipX = x; this.flipY = y; return this; },
    setTexture(texture, frame) { this.texture = texture; this.frame = frame; return this; },
    setTint(tint) { this.tint = tint; return this; },
    setTintMode(mode) { this.tintMode = mode; return this; },
    setInteractive() { return this; },
    on(event, callback) { this[event] = callback; return this; },
    destroy() { this.destroyed = true; this.children?.forEach(child => child.destroy()); }
  };
  created.push(result);
  return result;
}
const scene = { add: {
  graphics() {
    return object({ kind: 'graphics', rects: [], points: [],
      clear() { this.rects = []; this.points = []; return this; },
      fillStyle(color) { this.color = color; return this; },
      fillRect(...rect) { this.rects.push(rect); return this; },
      lineStyle() { return this; }, beginPath() { return this; }, strokePath() { return this; },
      moveTo(x, y) { this.points.push([x, y]); return this; },
      lineTo(x, y) { this.points.push([x, y]); return this; }
    });
  },
  sprite(x, y, texture, frame) { return object({ kind: 'sprite', x, y, texture, frame }); },
  container(x, y) {
    return object({ kind: 'container', x, y, children: [],
      add(children) { this.children.push(...(Array.isArray(children) ? children : [children])); },
      removeAll(destroy) { if (destroy) this.children.forEach(child => child.destroy()); this.children = []; }
    });
  },
  image(x, y, texture, frame) { return object({ kind: 'image', x, y, texture, frame }); },
  text(x, y, text, style) { return object({ kind: 'text', x, y, text, style }); }
} };
const sprite = { x: 32, y: 48, width: 16, height: 24, displayOriginX: 0, displayOriginY: 8,
  originX: 0, originY: 1 / 3, scaleX: 1, scaleY: 1, depth: 5, alpha: 1, visible: true,
  texture: { key: 'monster' }, frame: { name: 0 }, rotation: 0, flipX: false, flipY: false, tint: 0xab1234 };
const monster = { type: 'enemy', x: 2, y: 3, healthPoints: 20, sprite, effects: [] };
const update = (time = 0, entities = [monster]) => updateMonsterStatusVisuals(scene, entities, time);
const live = () => created.filter(item => !item.destroyed);
const effect = (id, duration = 3) => ({ id, name: id[0].toUpperCase() + id.slice(1), duration });
const random = Math.random;
try {
  Math.random = () => { throw Error('status visuals must not consume gameplay RNG'); };
  update();
  assert.equal(created.length, 0, 'healthy monsters have no indicators');
  monster.effects = [effect('bleeding')];
  update();
  assert.equal(created.length, 0, 'other effects do not create overhead badges');
  monster.effects = ['burning', 'confused', 'poisoned'].map(id => effect(id));
  const original = structuredClone(sprite);
  update();
  assert.equal(created.length, 3, 'fire, swirl and body wash coexist without icons');
  const [fire, swirl, wash] = created;
  assert.equal(fire.rects.length, 8, 'two small flames rendered on the body');
  assert.equal(swirl.points.length, 66, 'outlined spiral');
  assert.ok(swirl.points.every(([, y]) => y < sprite.y - sprite.displayOriginY), 'confusion is above the head');
  assert.ok(fire.rects.every(([x, y, w, h]) => x >= 32 && x + w <= 48 && y >= 56 && y + h <= 64));
  assert.equal(wash.tint, 0x65d64b, 'poison is green');
  assert.equal(wash.tintMode, Phaser.TintModes.FILL, 'uses Phaser 4 tint fill mode, not removed setTintFill');
  assert.deepEqual(sprite, original, 'actor tint/alpha/animation are never mutated');
  assert.deepEqual(monster.effects, ['burning', 'confused', 'poisoned'].map(id => effect(id)));
  const initialFire = structuredClone(fire.rects), initialSwirl = structuredClone(swirl.points);
  update(120);
  assert.notDeepEqual(fire.rects, initialFire, 'flames flicker');
  assert.notDeepEqual(swirl.points, initialSwirl, 'spiral rotates');
  sprite.x += 4; sprite.y += 2; sprite.displayOriginY += 1; sprite.originY = 9 / 24;
  sprite.alpha = 0.4; sprite.flipX = true; sprite.rotation = 0.1; sprite.frame.name = 2;
  update();
  assert.equal(created.length, 3, 'reuses objects');
  assert.equal(fire.rects[0][0], initialFire[0][0] + 4);
  assert.equal(fire.rects[0][1], initialFire[0][1] + 1);
  assert.equal(swirl.points[0][0], initialSwirl[0][0] + 4);
  assert.equal(swirl.points[0][1], initialSwirl[0][1] + 1);
  assert.equal(fire.alpha, 0.4); assert.equal(swirl.alpha, 0.4);
  assert.equal(wash.alpha, 0.4 * 0.45); assert.equal(wash.frame, 2);
  assert.equal(wash.x, sprite.x); assert.equal(wash.y, sprite.y);
  assert.equal(wash.originY, sprite.originY); assert.equal(wash.rotation, 0.1); assert.equal(wash.flipX, true);
  assert.ok(live().every(visual => visual.depth > sprite.depth && visual.depth < 100), 'above actor but below fog');
  monster.effects.push(effect('frozen'));
  update();
  assert.equal(wash.tint, 0x65baff, 'frozen blue takes priority over green');
  monster.effects.push(effect('stunned'));
  update();
  assert.equal(wash.tint, 0xffffff, 'stun is a visible white wash, not a neutral multiplicative tint');
  assert.equal(wash.alpha, sprite.alpha * 0.65);
  monster.effects = [effect('frozen')];
  update();
  assert.equal(fire.destroyed, true); assert.equal(swirl.destroyed, true);
  assert.equal(wash.tint, 0x65baff, 'cleared stun reveals remaining frozen effect');
  monster.effects = [effect('confused')];
  update();
  assert.equal(wash.destroyed, true, 'cure removes tint without restoring stale combat tint');
  assert.equal(sprite.tint, original.tint);
  sprite.visible = false;
  update();
  assert.equal(live().length, 0, 'FOV/grass/foreground-hidden monsters reveal no effects');
  const count = created.length;
  update();
  assert.equal(created.length, count, 'hidden monsters allocate nothing');
  sprite.visible = true;
  update();
  assert.equal(live().length, 1, 'returning to sight recreates effects');
  monster.effects = [];
  update();
  assert.equal(live().length, 0, 'expiration cleans up');
  monster.effects = ['burning', 'confused', 'poisoned'].map(id => effect(id));
  update(); monster.healthPoints = 0; update();
  assert.equal(live().length, 0, 'death removes all visuals');
  monster.healthPoints = 20;
  update(); update(0, []);
  assert.equal(live().length, 0, 'despawn cleans up');
  update(); monster.sprite = undefined; update();
  assert.equal(live().length, 0, 'missing sprite cleans up');
  monster.sprite = sprite;
  update(); monster.x = undefined; update();
  assert.equal(live().length, 0, 'unplaced monster cleans up');
  monster.x = 2;
  update(); clearMonsterStatusVisuals(scene); clearMonsterStatusVisuals(scene);
  assert.equal(live().length, 0, 'floor/shutdown cleanup is idempotent');
  update();
  assert.equal(live().length, 3, 'restored statuses reappear after floor/load cleanup');
  update(0, [{ ...monster, type: 'player' }, { ...monster, type: 'item' }]);
  assert.equal(live().length, 0, 'hero and items excluded');
  sprite.width = 32; sprite.scaleX = 2; sprite.scaleY = 2; sprite.displayOriginX = 8;
  update();
  const bossSwirl = live().find(visual => visual.points?.length);
  assert.equal(bossSwirl.points[0][0], sprite.x + 16, 'wide/scaled boss swirl centered over art');
  assert.equal(bossSwirl.points[0][1], sprite.y - sprite.displayOriginY * 2 - 10);
  clearMonsterStatusVisuals(scene);

  // Inspection shows the icons, labels and durations; all effects remain accessible.
  const parent = scene.add.container(0, 0);
  const panel = new MonsterInspectStatuses(scene, parent);
  const root = parent.children[0];
  const icons = () => root.children.filter(child => child.kind === 'image');
  const labels = () => root.children.filter(child => child.kind === 'text');
  const more = () => labels().find(label => label.text.startsWith('More statuses'));
  assert.equal(panel.update(undefined, 320, 240), 0);
  monster.effects = ['burning', 'confused', 'poisoned', 'frozen', 'stunned'].map(id => effect(id));
  assert.equal(panel.update(monster, 320, 240), 152);
  assert.deepEqual(icons().map(icon => icon.frame), monster.effects.map(effect => statusIconFrame(effect.id)));
  assert.ok(icons().every(icon => icon.texture === STATUS_ICON_TEXTURE && icon.width === 24));
  assert.ok(labels().some(label => label.text === 'Burning (3)'));
  const oldIcons = [...icons()];
  panel.update(monster, 320, 240);
  assert.equal(icons()[0], oldIcons[0], 'stable inspection does not rebuild objects');
  monster.effects[0].duration = Infinity;
  panel.update(monster, 320, 240);
  assert.ok(labels().some(label => label.text === 'Burning (∞)'));
  assert.ok(oldIcons.every(icon => icon.destroyed), 'rebuild destroys old children');
  panel.setY(180);
  assert.equal(root.y, 180, 'badges can be positioned below the description');
  const height = panel.update(monster, 320, 84);
  assert.equal(icons().length, 2, 'short viewport paginates');
  assert.match(more().text, /1\/3/);
  more().pointerup();
  assert.deepEqual(icons().map(icon => icon.frame), ['poisoned', 'frozen'].map(statusIconFrame));
  more().pointerup();
  assert.deepEqual(icons().map(icon => icon.frame), [statusIconFrame('stunned')]);
  assert.equal(panel.update(monster, 320, 84), height, 'last page keeps stable dialog height');
  more().pointerup();
  assert.equal(icons()[0].frame, statusIconFrame('burning'), 'pagination cycles');
  panel.update({ ...monster }, 220, 84);
  assert.equal(icons().length, 1, 'narrow phone uses one column');
  assert.match(more().text, /1\/5/, 'changing inspected monster resets page');
  panel.update(undefined, 320, 84);
  assert.equal(root.children.length, 0, 'terrain/items/choices/closed modal have no monster status icons');
  monster.effects = [effect('brand-new-effect')];
  panel.update(monster, 320, 240);
  assert.equal(icons()[0].frame, statusIconFrame(''), 'unknown effects still get inspection fallback');
} finally { Math.random = random; }

const source = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.match(source, /this\.refreshFovIfNeeded\(\);\s*(?:updateTargetTelegraphs\([^\n]*\);\s*)?updateMonsterStatusVisuals\(this, this\.context\.entities, this\.time\.now\)/);
assert.match(source, /if \(isModalOpen\(this\.context\)\) \{\s*updateMonsterStatusVisuals/);
assert.equal((source.match(/clearMonsterStatusVisuals\(this\)/g) ?? []).length, 2);
const ui = fs.readFileSync('src/games/rogue0/ui.ts', 'utf8');
assert.match(ui, /new MonsterInspectStatuses\(this, root\)/);
assert.match(ui, /this\.context\.inspectedEntity\?\.type === 'enemy'/);
assert.match(ui, /this\.inspectStatuses\?\.setY\(contentBottom \+ 6\)/, 'inspection badges sit after description');
console.log('Rogue0 monster statuses: body flames, rotating confusion spiral, green/blue/white silhouette washes, visibility/cleanup, and paginated inspection badges passed');
