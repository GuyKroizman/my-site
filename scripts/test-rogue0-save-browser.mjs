// Optional end-to-end suite: run a Vite server, then set PLAYWRIGHT_MODULE to
// your Playwright package if it is not installed locally. Uses a fresh browser
// profile, never the user's real browser save.
import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('save-browser');
import assert from 'node:assert/strict';
import fs from 'node:fs';
const legacyIds = JSON.parse(fs.readFileSync(new URL('./fixtures/rogue0-v1-save-ids.json', import.meta.url), 'utf8'));
const classModules = ['items', 'monsters', 'classes'].flatMap(dir =>
  fs.readdirSync(new URL(`../src/games/rogue0/${dir}/`, import.meta.url))
    .filter(name => name.endsWith('.ts')).map(name => `/src/games/rogue0/${dir}/${name}`));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 840 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/Rogue0 autosave failed|Cannot restore Rogue0/.test(message.text())) {
      errors.push(message.text()); console.error(message.text());
    }
  });
  const url = process.env.ROGUE0_URL || 'http://localhost:5173/rogue0';
  async function captureScene() {
    await page.getByRole('heading', { name: 'Rogue0', exact: true }).waitFor();
    await page.evaluate(async () => {
      // Use the exact Vite dependency URL: HMR may give scene modules newer
      // timestamped identities than a second dynamic import of their bare path.
      const url = performance.getEntriesByType('resource').find(e => /\/phaser\.js\?/.test(e.name)).name;
      window.testImport = async path => {
        const resource = performance.getEntriesByType('resource').findLast(e => e.name.includes(path));
        return import(resource?.name ?? path);
      };
      const { default: Phaser } = await import(url);
      const original = Phaser.Game.prototype.boot;
      Phaser.Game.prototype.boot = function() { window.testGame = this; return original.call(this); };
      Object.defineProperty(window, 'testScene', { configurable: true,
        get: () => window.testGame?.scene.getScene('scene0') });
    });
  }
  await page.goto(url);
  await captureScene();
  await page.getByRole('button', { name: 'Warrior sword & steel' }).click();
  await page.waitForFunction(() => window.testScene?.context.saveNow);
  await page.evaluate(async ({ legacyIds, classModules }) => {
    const { saveRegistry } = await window.testImport('/src/games/rogue0/saveRegistry.ts');
    const { encodeGraph, decodeGraph } = await window.testImport('/src/games/rogue0/saveCodec.ts');
    const { Entity } = await window.testImport('/src/games/rogue0/entity.ts');
    for (const id of legacyIds) {
      const Type = saveRegistry[id];
      if (!Type || !(Type.prototype instanceof Entity)) throw Error(`Missing historical save class: ${id}`);
      const decoded = decodeGraph({ root: { ref: 0 }, nodes: [{ kind: 'entity', type: id,
        data: [['lootClass', { constructorId: id }]] }] }, saveRegistry);
      if (!(decoded instanceof Type) || decoded.lootClass !== Type) throw Error(`Bad legacy decode: ${id}`);
      const roundTrip = decodeGraph(encodeGraph([decoded, decoded], saveRegistry), saveRegistry);
      if (roundTrip[0] !== roundTrip[1] || !(roundTrip[0] instanceof Type)) throw Error(`Bad round trip: ${id}`);
    }
    for (const path of classModules) {
      const exports = await window.testImport(path);
      for (const Type of Object.values(exports)) {
        if (typeof Type === 'function' && Type.prototype instanceof Entity && !Object.values(saveRegistry).includes(Type)) {
          throw Error(`Unregistered save class in ${path}`);
        }
      }
    }
  }, { legacyIds, classModules });
  const expected = await page.evaluate(async () => {
    const scene = window.testScene;
    const ctx = scene.context;
    const { default: dungeon } = await import('/src/games/rogue0/dungeon.ts');
    const firstMap = JSON.stringify(dungeon.getCurrentLevel());
    while (ctx.floor < 6) scene.descend();
    const p = ctx.player;
    p.healthPoints = 24; p.hunger = 63.5; p.gold = 77; p.weapon.level = 2;
    p.level = 3; p.talentRanks.power = 1;
    const { default: Wand } = await import('/src/games/rogue0/items/WandOfFrost.ts');
    const wand = new Wand(ctx); p.addItem(wand); p.assignQuickslot(0, wand); wand.charges = 2;
    const { default: Chalice } = await window.testImport('/src/games/rogue0/items/ChaliceOfBlood.ts');
    const chalice = new Chalice(ctx); p.addItem(chalice);
    // Set up the equipped fixture without spending a turn between async imports.
    p.backpack = p.backpack.filter(item => item !== chalice);
    p.artifact = chalice; chalice.equip();
    chalice.level = 5; chalice.healingTurns = 5; chalice.bloodProgress = 7;
    const { applyEffect, createBlindedEffect, createPoisonedEffect } = await import('/src/games/rogue0/effects.ts');
    applyEffect(p, createBlindedEffect(8)); applyEffect(p, createPoisonedEffect(6));
    const { saveConsumableKnowledge } = await import('/src/games/rogue0/entity.ts');
    ctx.poisonClouds = [{ x: 1, y: 1, nextTick: (ctx.simulationTime ?? 0) + 1, expiresAt: (ctx.simulationTime ?? 0) + 10 }];
    // A checkpoint must not resume queued movement, pursuit or targeting. Pause
    // world input so this fixture cannot execute commands before the reload.
    ctx.helpOpen = true;
    p.inputBuffer = ['ArrowRight'];
    p.walkPath = [{ x: p.x + 1, y: p.y }];
    p.walkTargetEntity = ctx.entities.find(entity => entity.type === 'enemy');
    p.acknowledgedWalkEnemies = new Set([p.walkTargetEntity]);
    p.zapping = true;
    ctx.throwMode = true;
    ctx.throwItem = wand;
    ctx.saveNow();
    return { firstMap, gas: ctx.poisonClouds, map: JSON.stringify(dungeon.getCurrentLevel()), knowledge: saveConsumableKnowledge(ctx),
      x: p.x, y: p.y, floor: ctx.floor, accuracy: p.accuracy,
      effects: p.effects.map(({id, duration, nextTick}) => ({id, duration, nextTick})),
      enemies: ctx.entities.filter(e => e.type === 'enemy').map(e => [e.name, e.x, e.y, e.healthPoints, e.sleepTurnsRemaining]),
    };
  });
  await page.reload();
  await captureScene();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForFunction(() => window.testScene?.context.saveNow);
  const actual = await page.evaluate(async () => {
    const s = window.testScene, c = s.context, p = c.player;
    const { default: dungeon } = await import('/src/games/rogue0/dungeon.ts');
    const { default: Wand } = await import('/src/games/rogue0/items/WandOfFrost.ts');
    const { saveConsumableKnowledge } = await import('/src/games/rogue0/entity.ts');
    c.saveNow();
    const keyboard = c.scene.input.keyboard, input = c.scene.input;
    const before = [keyboard.listenerCount('keydown'), input.listenerCount('pointerup'),
      c.scene.events.listenerCount('shutdown')];
    p.bindInput(); p.bindInput();
    const after = [keyboard.listenerCount('keydown'), input.listenerCount('pointerup'),
      c.scene.events.listenerCount('shutdown')];
    return { controls: [p.inputBuffer.length, p.walkPath.length, p.acknowledgedWalkEnemies.size,
        p.walkTargetEntity === undefined, p.zapping, c.throwMode, c.inspectMode],
      bindings: { before, after }, firstMap: JSON.stringify(s.floors.get(1).map), gas: c.poisonClouds, map: JSON.stringify(dungeon.getCurrentLevel()),
      knowledge: saveConsumableKnowledge(c), x: p.x, y: p.y, floor: c.floor, accuracy: p.accuracy,
      effects: p.effects.map(({id, duration, nextTick}) => ({id, duration, nextTick})),
      enemies: c.entities.filter(e => e.type === 'enemy').map(e => [e.name, e.x, e.y, e.healthPoints, e.sleepTurnsRemaining]),
      artifact: [p.artifact.level, p.artifact.healingTurns, p.artifact.bloodProgress,
        typeof p.effects.find(e => e.id === 'chalice-regeneration').tick],
      hp: p.healthPoints, hunger: p.hunger, gold: p.gold, upgrade: p.weapon.level, talent: p.talentRanks.power,
      wand: p.quickslots[0] instanceof Wand && p.backpack.includes(p.quickslots[0]), charges: p.quickslots[0].charges,
    };
  });
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, key);
  assert.deepEqual(actual.artifact, [5, 5, 7, 'function']);
  assert.deepEqual(actual.controls, [0, 0, 0, true, false, false, false], 'control state is reset after resume');
  assert.deepEqual(actual.bindings.after, actual.bindings.before, 'repeated binding does not accumulate real Phaser listeners');
  assert.deepEqual([actual.hp, actual.hunger, actual.gold, actual.upgrade, actual.talent, actual.wand, actual.charges],
    [24, 63.5, 77, 2, 1, true, 2]);

  // The live HUD and inventory must work without the retired hero-owned sidebar
  // or refreshUI calls, including immediately after restoring flat save fields.
  await page.waitForFunction(() => {
    const ui = window.testGame.scene.getScene('ui-scene');
    const p = window.testScene.context.player;
    return ui.healthText?.text === `${p.healthPoints}/${p.maxHealthPoints}`;
  });
  assert.deepEqual(await page.evaluate(() => {
    const ui = window.testGame.scene.getScene('ui-scene');
    const p = window.testScene.context.player;
    return [ui.healthText.text, ui.heroStatus.text, ui.floorStatus.text,
      typeof p.createUI, typeof p.refreshUI];
  }), ['24/30', 'Lv 3 · Food 64 · Fed', 'Floor 6', 'undefined', 'undefined']);
  const uiTime = await page.evaluate(() => window.testScene.context.simulationTime);
  await page.keyboard.press('i');
  await page.waitForFunction(() => window.testScene.context.inventoryOpen);
  assert.ok(await page.evaluate(() => {
    const inventory = window.testGame.scene.getScene('ui-scene').inventoryWindow;
    return inventory.winRoot.list.some(child => child.text === 'Gold: 77');
  }), 'restored inventory renders current wallet state');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.testScene.context.inventoryOpen);
  const heroButton = await page.evaluate(() => {
    const ui = window.testGame.scene.getScene('ui-scene');
    const button = ui.toolbar[0].bg;
    const rect = window.testGame.canvas.getBoundingClientRect();
    return { x: rect.x + button.x * rect.width / ui.scale.width,
      y: rect.y + button.y * rect.height / ui.scale.height };
  });
  await page.mouse.click(heroButton.x, heroButton.y);
  await page.waitForFunction(() => window.testScene.context.heroModalOpen);
  assert.match(await page.evaluate(() => window.testGame.scene.getScene('ui-scene').heroModalText.text),
    /Food: 64\/100 \(Fed\).*Gold: 77/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.testScene.context.heroModalOpen);
  assert.equal(await page.evaluate(() => window.testScene.context.simulationTime), uiTime,
    'opening and closing the actual inventory/hero HUD spends no world time');

  await page.evaluate(async () => {
    const s = window.testScene, p = s.context.player;
    const { removeEffect } = await import('/src/games/rogue0/effects.ts');
    removeEffect(p, 'blinded');
    if (p.accuracy !== 95) throw Error('Blindness did not restore accuracy');
    const floor = s.floors.get(1);
    s.saveFloor(); s.restoreFloor(1, floor, floor.down);
    s.context.saveNow();
  });
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rogue0.run.v1')));
  assert.equal(saved.floor, 1, 'revisited floor autosaves');
  await page.getByRole('button', { name: 'Game menu' }).click();
  await page.getByRole('button', { name: 'Save & title' }).click();
  if (process.env.ROGUE0_SCREENSHOT) await page.screenshot({ path: process.env.ROGUE0_SCREENSHOT });
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.ok(await page.getByRole('button', { name: /Continue/ }).isVisible());
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForFunction(() => window.testScene?.context.saveNow);
  await page.evaluate(() => window.testScene.endGame(false));
  await page.getByRole('heading', { name: 'You died' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('rogue0.run.v1')), null);
  assert.deepEqual(errors, [], 'no save or load errors');
  console.log('Rogue0 browser resume: floors, maps, stats, talents, shared quickslots, effects, knowledge, enemies, live inventory/HUD, clean control state, idempotent input binding, autosave, replacement cancellation and permadeath passed');
} finally {
  await browser.close();
}
