import fs from 'node:fs';
import ts from 'typescript';
import { applyAttackResult } from '../../src/games/rogue0/combatApplication.ts';

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
  const dependencies = { applyAttackResult, ...bindings };
  const exports = {};
  new Function('exports', ...Object.keys(dependencies), js)(exports, ...Object.values(dependencies));
  return exports;
}
