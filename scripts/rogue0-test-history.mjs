import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendJsonl, readJsonl, gitState, newRunId, redact, failureId,
  classifyFailure, summarize, FAILURE_CATEGORIES,
} from './lib/rogue0-test-reporting.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const historyPath = path.join(root, 'logs/rogue0-tests.jsonl');
const annotationPath = path.join(root, 'logs/rogue0-test-classifications.jsonl');
const batchPath = path.join(root, 'logs/rogue0-test-batches.jsonl');

// Direct node invocations still record results. The runner records managed
// processes itself, including import/syntax failures before this module runs.
export function recordTestRun(suite) {
  if (process.env.ROGUE0_TEST_MANAGED === '1' && process.env.ROGUE0_TEST_RUN_ID) return;
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const purpose = process.env.ROGUE0_TEST_PURPOSE || 'development';
  const runId = newRunId();
  const metadata = gitState(root);
  let failure;
  process.on('uncaughtExceptionMonitor', error => { failure = redact(error?.stack || String(error)); });
  process.on('exit', code => {
    try {
      appendJsonl(historyPath, {
        runId, startedAt, suite, purpose, ...metadata, timingScope: 'in-process',
        durationMs: Math.round(performance.now() - start),
        status: code === 0 && !failure ? 'passed' : 'failed',
        exitCode: code, failure: failure || (code ? `Process exited with code ${code}` : null),
      });
    } catch (error) {
      console.error(`Could not save test history: ${redact(error.message)}`);
      process.exitCode = code || 1;
    }
  });
}

function report(summaryOnly) {
  console.log(`Rogue0 test history: ${historyPath}`);
  const { development, failures, excluded, latest, categories } = summarize(
    readJsonl(historyPath), readJsonl(annotationPath));
  const rate = development.length ? (100 * failures.length / development.length).toFixed(2) : '0.00';
  console.log(`${development.length} development suite executions; ${failures.length} failed (${rate}%).`);
  const recent = development.slice(-500);
  console.log(`Latest ${recent.length}: ${recent.filter(record => record.status === 'failed').length} failed.`);
  console.log(`Failure classifications: ${JSON.stringify(categories)} (manual diagnoses, not unique bug counts).`);
  if (excluded) console.log(`${excluded} non-development executions excluded (including verification/mutation).`);
  if (!summaryOnly) {
    for (const suite of [...new Set(development.map(record => record.suite))].sort()) {
      const runs = development.filter(record => record.suite === suite);
      const failed = runs.filter(record => record.status === 'failed').length;
      console.log(`${suite}: ${runs.length} runs, ${runs.length - failed} passed, ${failed} failed; latest: ${runs.at(-1).status}`);
    }
  }
  const batch = readJsonl(batchPath).filter(record => record.purpose === 'development').at(-1);
  if (batch) {
    console.log(`\nLatest runner batch (${batch.selection}, ${batch.status}): ${batch.completed}/${batch.planned} suites, ${(batch.durationMs / 1000).toFixed(2)}s wall time.`);
    console.log('Slowest processes in that batch (includes startup/imports):');
    for (const entry of [...batch.results].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5)) {
      console.log(`  ${entry.suite}: ${(entry.durationMs / 1000).toFixed(2)}s (${entry.status})`);
    }
  }
  if (!summaryOnly && failures.length) {
    console.log('\nLatest failures (up to 10; use the ID to classify):');
    for (const record of failures.slice(-10)) {
      const id = failureId(record), annotation = latest.get(id);
      console.log(`\n${id} | ${record.startedAt} | ${record.suite} | ${annotation?.category ?? 'unclassified'}`);
      if (annotation) console.log(`Diagnosis: ${redact(annotation.note)}`);
      console.log(redact(record.failure ?? 'No failure detail recorded.'));
    }
  }
  console.log('\nCounts are suite executions, not unique bugs or flakiness. Removed suites remain in history.');
  console.log('History starts when logging was installed. Legacy/direct durations exclude static imports; runner durations include process startup.');
  console.log('An uncommitted working tree is not identified exactly by its commit hash. Causes are never inferred automatically.');
}

export function historyMain(args) {
  if (args[0] === 'classify') {
    const [, id, category, ...note] = args;
    const entry = classifyFailure(readJsonl(historyPath), annotationPath, id, category, note.join(' '));
    console.log(`Appended classification for ${entry.failureId}: ${entry.category}. Original results unchanged.`);
  } else if (!args.length || (args.length === 1 && args[0] === '--summary')) {
    report(args[0] === '--summary');
  } else if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: npm run test:rogue0:history -- [--summary | classify <failure-id> <category> "cause and resolution"]');
    console.log(`Categories: ${FAILURE_CATEGORIES.join(', ')}`);
    console.log('Reclassification appends another annotation; latest annotation wins without deleting history.');
  } else { throw Error('Unknown arguments. Use --help.'); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { historyMain(process.argv.slice(2)); }
  catch (error) { console.error(redact(error.message)); process.exitCode = 1; }
}
