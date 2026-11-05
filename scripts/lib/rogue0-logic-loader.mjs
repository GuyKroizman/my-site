import fs from 'node:fs';
import ts from 'typescript';
import { applyAttackResult } from '../../src/games/rogue0/combatApplication.ts';
import { createInventoryActions, splitStackItem } from '../../src/games/rogue0/inventory.ts';
import { forgetInspectedEntity } from '../../src/games/rogue0/context.ts';
import { clearFloorSprite, clearItemUI, placeFloorItem } from '../../src/games/rogue0/itemPresentation.ts';
import { heroStatsText, heroHudView } from '../../src/games/rogue0/heroViewModel.ts';
import { createHeroNavigation } from '../../src/games/rogue0/heroNavigation.ts';
import { createHeroTargeting } from '../../src/games/rogue0/heroTargeting.ts';
import { createHeroInput } from '../../src/games/rogue0/heroInput.ts';
import { hostileAtTile, isHostile } from '../../src/games/rogue0/heroControlRules.ts';
import { createTerrain } from '../../src/games/rogue0/terrain.ts';
import * as tilePresentation from '../../src/games/rogue0/tiles.ts';
import * as sight from '../../src/games/rogue0/fov.ts';

// Compatibility harness for existing isolated-method suites. Parse imports as
// TypeScript rather than deleting them with a regex. New boundary/integration
// tests should use normal module imports; this intentionally retains old fakes.
export function loadLogic(path, bindings = {}) {
  // Legacy fixtures previously got a fresh overlay by evaluating tiles.ts.
  // Keep that fixture ownership, but execute the complete extracted modules.
  if (path.endsWith('/tiles.ts')) return { ...tilePresentation, ...createTerrain() };
  // Keep these fixtures' explicitly injected vision boundary, even where the
  // combat/AI fixture supplies a different, partial movement-terrain fake.
  if (path.endsWith('/fov.ts')) return { ...sight,
    blocksSight: (map, x, y) => sight.blocksSight(map, x, y, bindings),
    hasLineOfSight: (map, x, y, tx, ty) => sight.hasLineOfSight(map, x, y, tx, ty, bindings),
    canSee: (map, x, y, tx, ty, radius) => sight.canSee(map, x, y, tx, ty, radius, bindings),
    computeFOV: (map, x, y, radius, ignoreObstacles) =>
      sight.computeFOV(map, x, y, radius, ignoreObstacles, bindings),
  };
  const parsed = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'),
    ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const stripped = ts.factory.updateSourceFile(parsed,
    parsed.statements.filter(statement => !ts.isImportDeclaration(statement)));
  const source = ts.createPrinter().printFile(stripped);
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  // Use the real extracted operations with each legacy fixture's existing
  // effects/audio/log fakes. New inventory/view suites import modules directly.
  const heroInventory = createInventoryActions({
    log: (context, message) => bindings.dungeon.log(context, message),
    equipSound: () => bindings.sfx.equip(),
    removeEntity: (context, entity) => bindings.removeEntity(context, entity),
    removeEffect: (entity, id) => bindings.removeEffect(entity, id),
    clearFloorSprite, clearItemUI, placeFloorItem,
  });
  const heroControls = {
    ...createHeroNavigation(bindings),
    ...createHeroTargeting(bindings),
    ...createHeroInput(bindings),
  };
  const dependencies = { applyAttackResult, heroInventory, heroControlsFor: () => heroControls, isHostile, hostileAtTile,
    terrainFor: () => bindings.tiles ?? bindings, ...tilePresentation,
    forgetInspectedEntity, splitStackItem, placeFloorItem, heroStatsText, heroHudView, ...bindings };
  const exports = {};
  new Function('exports', ...Object.keys(dependencies), js)(exports, ...Object.values(dependencies));
  return exports;
}
