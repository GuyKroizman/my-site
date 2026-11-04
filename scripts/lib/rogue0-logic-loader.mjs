import fs from 'node:fs';
import ts from 'typescript';
import { applyAttackResult } from '../../src/games/rogue0/combatApplication.ts';
import { createInventoryActions, splitStackItem } from '../../src/games/rogue0/inventory.ts';
import { clearFloorSprite, clearItemUI, placeFloorItem } from '../../src/games/rogue0/itemPresentation.ts';
import { heroStatsText, heroHudView } from '../../src/games/rogue0/heroViewModel.ts';

// Compatibility harness for existing isolated-method suites. Parse imports as
// TypeScript rather than deleting them with a regex. New boundary/integration
// tests should use normal module imports; this intentionally retains old fakes.
export function loadLogic(path, bindings = {}) {
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
  const dependencies = { applyAttackResult, heroInventory, splitStackItem,
    placeFloorItem, heroStatsText, heroHudView, ...bindings };
  const exports = {};
  new Function('exports', ...Object.keys(dependencies), js)(exports, ...Object.values(dependencies));
  return exports;
}
