import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { appendJsonl, gitState, newRunId, redact } from './lib/rogue0-test-reporting.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const groups = { '@store': ['store-layout', 'shop-pricing', 'shop-stock', 'shop-transactions', 'portal'] };

export function discoverSuites(projectRoot) {
  return fs.readdirSync(path.join(projectRoot, 'scripts'))
    .filter(name => /^test-rogue0-[a-z0-9-]+\.mjs$/.test(name))
    .map(name => name.slice('test-rogue0-'.length, -4)).sort();
}

export function selectSuites(available, selectors) {
  if (!selectors.length) return [...available];
  const selected = [...new Set(selectors.flatMap(selector => groups[selector] ?? [selector]))];
  const unknown = selected.filter(suite => !available.includes(suite));
  if (unknown.length) throw Error(`Unknown suite(s): ${unknown.join(', ')}. Use --list; selection is exact, not a substring match.`);
  return selected;
}

export function runSuites({ projectRoot = root, suites, selection = 'focused', failFast = false,
  env = process.env, output = console.log }) {
  if (!suites.length) throw Error('No suites selected.');
  const available = discoverSuites(projectRoot);
  suites = selectSuites(available, suites); // Validate and deduplicate before executing anything.
  const start = performance.now(), startedAt = new Date().toISOString();
  const batchId = newRunId(), metadata = gitState(projectRoot);
  const purpose = env.ROGUE0_TEST_PURPOSE || 'development';
  const results = [];
  for (const suite of suites) {
    const runId = newRunId(), suiteStartedAt = new Date().toISOString(), suiteStart = performance.now();
    output(`\n[${results.length + 1}/${suites.length}] ${suite}`);
    // Each suite keeps its own process: globals, RNG overrides and module state
    // cannot leak between suites. Do not silently retry failures.
    const child = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', `test-rogue0-${suite}.mjs`)], {
      cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'], maxBuffer: 8 * 1024 * 1024,
      env: { ...env, ROGUE0_TEST_MANAGED: '1', ROGUE0_TEST_RUN_ID: runId },
    });
    const durationMs = Math.round(performance.now() - suiteStart);
    const stderr = redact(child.stderr ?? '');
    if (stderr) process.stderr.write(stderr);
    const status = !child.error && child.status === 0 ? 'passed' : 'failed';
    const failure = status === 'passed' ? null : redact([
      child.error?.message, child.signal && `Terminated by ${child.signal}`, stderr.trim(),
      `Process exited with code ${child.status}`,
    ].filter(Boolean).join('\n')).slice(-16000);
    // Parent-owned logging catches errors before recordTestRun initializes too.
    appendJsonl(path.join(projectRoot, 'logs/rogue0-tests.jsonl'), {
      runId, batchId, startedAt: suiteStartedAt, suite, purpose, ...metadata,
      timingScope: 'process', durationMs, status, exitCode: child.status, signal: child.signal, failure,
    });
    results.push({ runId, suite, status, durationMs });
    output(`${status.toUpperCase()} ${suite} — ${(durationMs / 1000).toFixed(2)}s${status === 'failed' ? ` — failure ID ${runId}` : ''}`);
    if (status === 'failed' && failFast) break;
  }
  const failed = results.filter(result => result.status === 'failed');
  const batch = { batchId, startedAt, purpose, ...metadata, selection,
    planned: suites.length, completed: results.length, status: failed.length ? 'failed' : 'passed',
    durationMs: Math.round(performance.now() - start), results };
  appendJsonl(path.join(projectRoot, 'logs/rogue0-test-batches.jsonl'), batch);
  output(`\nRogue0: ${results.length - failed.length} passed, ${failed.length} failed, ${suites.length - results.length} not run; ${(batch.durationMs / 1000).toFixed(2)}s batch wall time (includes suite startup/imports).`);
  if (failed.length) output(`Failed suites: ${failed.map(result => result.suite).join(', ')}`);
  return batch;
}

export function runnerMain(args) {
  if (args.includes('--help')) {
    console.log('Usage: npm run test:rogue0 -- [suite ... | @store] [--list] [--fail-fast]');
    console.log('No suite names runs all suites. --list prints the selection without running/logging it.');
    console.log('By default all selected suites run even after a failure; the command still exits nonzero.');
    return;
  }
  const unknownFlags = args.filter(arg => arg.startsWith('-') && !['--list', '--fail-fast'].includes(arg));
  if (unknownFlags.length) throw Error(`Unknown flags: ${unknownFlags.join(', ')}`);
  const selectors = args.filter(arg => !arg.startsWith('-'));
  const suites = selectSuites(discoverSuites(root), selectors);
  if (args.includes('--list')) { console.log(suites.join('\n')); return; }
  const batch = runSuites({ suites, selection: selectors.length ? selectors.join(', ') : 'all', failFast: args.includes('--fail-fast') });
  if (batch.status === 'failed') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runnerMain(process.argv.slice(2)); }
  catch (error) { console.error(redact(error.message)); process.exitCode = 1; }
}
