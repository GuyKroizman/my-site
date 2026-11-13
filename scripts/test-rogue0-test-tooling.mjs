import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('test-tooling');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverSuites, selectSuites } from './run-rogue0-tests.mjs';
import {
  appendJsonl, readJsonl, classifyFailure, failureId, summarize, redact,
} from './lib/rogue0-test-reporting.mjs';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rogue0-tooling-'));
try {
  const scripts = path.join(temp, 'scripts');
  fs.mkdirSync(path.join(scripts, 'lib'), { recursive: true });
  for (const file of ['run-rogue0-tests.mjs', 'rogue0-test-history.mjs', 'lib/rogue0-test-reporting.mjs']) {
    fs.copyFileSync(path.join(projectRoot, 'scripts', file), path.join(scripts, file));
  }
  const fixture = (name, body) => fs.writeFileSync(path.join(scripts, `test-rogue0-${name}.mjs`), body);
  fixture('pass', "import { recordTestRun } from './rogue0-test-history.mjs'; recordTestRun('pass');");
  fixture('assertion', "import assert from 'node:assert/strict'; assert.equal(1, 2, 'deliberate fixture failure');");
  fixture('syntax', 'const = ;');
  fixture('import', "import './does-not-exist.mjs';");
  fs.writeFileSync(path.join(scripts, 'test-other.mjs'), 'throw Error("must not discover this");');
  assert.deepEqual(discoverSuites(temp), ['assertion', 'import', 'pass', 'syntax']);
  assert.deepEqual(selectSuites(['pass', 'syntax'], ['pass', 'pass']), ['pass']);
  assert.throws(() => selectSuites(['pass'], ['../pass']), /Unknown suite/);
  assert.throws(() => selectSuites(['pass'], ['pas']), /Unknown suite/);
  const store = ['store-layout', 'shop-pricing', 'shop-stock', 'shop-transactions',
    'store-glyph', 'portal'];
  assert.deepEqual(selectSuites(store, ['@store', 'portal']), store);

  // Deliberate failing child fixtures are isolated and labelled verification.
  // Capture their output so expected failures don't look like suite failures.
  const command = (file, args = []) => spawnSync(process.execPath, [path.join(scripts, file), ...args], {
    cwd: temp, encoding: 'utf8', env: { ...process.env, ROGUE0_TEST_PURPOSE: 'verification',
      ROGUE0_TEST_MANAGED: '', ROGUE0_TEST_RUN_ID: '' },
  });
  const run = (...args) => command('run-rogue0-tests.mjs', args);
  const history = path.join(temp, 'logs/rogue0-tests.jsonl');
  const batches = path.join(temp, 'logs/rogue0-test-batches.jsonl');
  assert.equal(run('--list').status, 0);
  assert.equal(fs.existsSync(history), false, 'listing does not execute or log suites');
  assert.equal(run('typo').status, 1);
  assert.equal(run('--bad-option').status, 1);
  assert.equal(fs.existsSync(history), false, 'invalid selection does not run a partial batch');
  const batchRun = run('assertion', 'syntax', 'import', 'pass');
  assert.equal(batchRun.status, 1, batchRun.stderr);
  const records = readJsonl(history);
  assert.equal(records.length, 4, 'one parent-owned record per process, no child logger duplicates');
  assert.deepEqual(records.map(record => record.status), ['failed', 'failed', 'failed', 'passed']);
  assert.ok(records.every(record => record.purpose === 'verification' && record.timingScope === 'process'));
  assert.ok(records.every(record => record.durationMs > 0 && record.runId && record.batchId));
  assert.match(records[1].failure, /SyntaxError/);
  assert.match(records[2].failure, /ERR_MODULE_NOT_FOUND/);
  assert.equal(new Set(records.map(record => record.runId)).size, 4);
  const batch = readJsonl(batches)[0];
  assert.equal(batch.completed, 4, 'a failure does not prevent later selected suites running');
  assert.equal(batch.status, 'failed');
  assert.ok(batch.durationMs >= batch.results.reduce((sum, result) => sum + result.durationMs, 0) - 4);
  assert.match(batchRun.stdout, /batch wall time/);
  assert.equal(run('--fail-fast', 'assertion', 'pass').status, 1);
  assert.equal(readJsonl(batches).at(-1).completed, 1);
  assert.equal(run('pass').status, 0);
  assert.equal(readJsonl(batches).at(-1).status, 'passed');
  assert.equal(command('test-rogue0-pass.mjs').status, 0);
  assert.equal(readJsonl(history).at(-1).timingScope, 'in-process', 'direct invocation still logs');

  // Historical IDs and annotations work without rewriting old results.
  const legacy = { startedAt: '2026-01-01T00:00:00.000Z', suite: 'legacy', purpose: 'development',
    status: 'failed', durationMs: 10, failure: 'Expected 1, received 2' };
  appendJsonl(history, legacy);
  const all = readJsonl(history), before = fs.readFileSync(history);
  const annotationPath = path.join(temp, 'logs/rogue0-test-classifications.jsonl');
  const id = failureId(legacy);
  assert.equal(id, failureId(JSON.parse(JSON.stringify(legacy))));
  assert.equal(command('rogue0-test-history.mjs', ['classify', id, 'test-bug', 'Incorrect expected result; fixture corrected.']).status, 0);
  classifyFailure(all, annotationPath, id, 'intended-change', 'Review showed the old expectation was an intentional rule change.');
  assert.equal(readJsonl(annotationPath).length, 2, 'corrections append, never overwrite');
  assert.deepEqual(fs.readFileSync(history), before, 'classification never edits original results');
  assert.throws(() => classifyFailure(all, annotationPath, 'missing', 'test-bug', 'note'), /exactly one failed/);
  assert.throws(() => classifyFailure(all, annotationPath, records[3].runId, 'test-bug', 'note'), /exactly one failed/);
  assert.throws(() => classifyFailure(all, annotationPath, id, 'invented', 'note'), /Category/);
  assert.throws(() => classifyFailure(all, annotationPath, id, 'test-bug', ''), /note is required/);
  const summary = summarize(all, readJsonl(annotationPath));
  assert.equal(summary.failures.length, 1, 'verification fixtures are excluded');
  assert.deepEqual(summary.categories, { 'intended-change': 1 }, 'latest annotation wins without inflating counts');
  assert.equal(summary.excluded, all.length - 1);
  const report = command('rogue0-test-history.mjs', ['--summary']);
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /1 development suite executions; 1 failed/);
  assert.match(report.stdout, /intended-change/);
  const warnings = [];
  const malformed = path.join(temp, 'malformed.jsonl');
  fs.writeFileSync(malformed, '{bad}\n' + JSON.stringify(legacy) + '\n');
  assert.deepEqual(readJsonl(malformed, text => warnings.push(text)), [legacy]);
  assert.equal(warnings.length, 1, 'malformed history is reported, not silently hidden');
  assert.match(redact('Bearer dummy-credential API_KEY=dummy-value sk-dummy-test'), /Bearer \[REDACTED\] API_KEY=\[REDACTED\] \[REDACTED\]/);

  // Compilation caching must not share module state or injected dependencies.
  const modulePath = path.join(temp, 'fixture.ts');
  fs.writeFileSync(modulePath, 'export const current = fixtureValue; export const values = [];');
  const first = loadLogic(modulePath, { fixtureValue: 1 });
  const second = loadLogic(modulePath, { fixtureValue: 2 });
  assert.equal(first.current, 1);
  assert.equal(second.current, 2);
  first.values.push('first run only');
  assert.deepEqual(second.values, []);
  fs.writeFileSync(modulePath, 'export const current = fixtureValue + 1;');
  assert.equal(loadLogic(modulePath, { fixtureValue: 2 }).current, 3, 'editing source invalidates compiled code');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('Rogue0 test tooling: selection, process timing, failure/import logging, direct logging, append-only classification, redaction and compilation isolation passed');
