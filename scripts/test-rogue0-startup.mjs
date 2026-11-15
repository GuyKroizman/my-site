import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('startup');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// The isolated logic fixtures strip imports, hiding initialization cycles.
// Entity is a base class: none of its runtime dependencies should lead back to
// it (especially through a subclass that would extend an uninitialized value).
// Follow real imports/re-exports, but ignore erased TypeScript type imports.
const root = path.resolve('src/games/rogue0');
const entry = path.join(root, 'entity.ts');
const visited = new Set();
function visit(file, chain = []) {
  assert.ok(!chain.includes(file), `Runtime dependency cycle: ${[...chain, file].map(p => path.relative(root, p)).join(' -> ')}`);
  if (visited.has(file)) return;
  visited.add(file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    if (ts.isImportDeclaration(node)) {
      if (node.importClause?.isTypeOnly) continue;
      const clause = node.importClause;
      if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.every(element => element.isTypeOnly)) continue;
    } else if (node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.every(element => element.isTypeOnly))) continue;
    const specifier = node.moduleSpecifier.text;
    if (!specifier.startsWith('.')) continue; // External libraries are not game classes.
    const base = path.resolve(path.dirname(file), specifier);
    const dependency = [base, `${base}.ts`, path.join(base, 'index.ts')].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
    assert.ok(dependency, `Resolve ${specifier} from ${file}`);
    visit(dependency, [...chain, file]);
  }
}
visit(entry);
console.log(`Rogue0 startup: Entity's ${visited.size} runtime modules have no initialization cycles.`);
