import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const historyPath = path.join(root, 'logs/rogue0-tests.jsonl');

// Imported by each suite, so direct node invocations are recorded too.
export function recordTestRun(suite) {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const purpose = process.env.ROGUE0_TEST_PURPOSE || 'development';
  let failure;
  let commit = null;
  let dirty = null;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
  } catch { /* History also works outside a git checkout. */ }
  // Observe exceptions without suppressing Node's normal error/exit behavior.
  process.on('uncaughtExceptionMonitor', error => {
    failure = error?.stack || String(error);
  });
  process.on('exit', code => {
    const record = {
      startedAt, suite, purpose, commit, dirty,
      durationMs: Math.round(performance.now() - start),
      status: code === 0 && !failure ? 'passed' : 'failed',
      exitCode: code, failure: failure || (code ? `Process exited with code ${code}` : null),
    };
    try {
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.appendFileSync(historyPath, JSON.stringify(record) + '\n');
    } catch (error) {
      console.error(`Could not save test history: ${error.message}`);
      process.exitCode = code || 1;
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Rogue0 test history: ${historyPath}`);
  const records = [];
  if (fs.existsSync(historyPath)) {
    for (const line of fs.readFileSync(historyPath, 'utf8').split('\n').filter(Boolean)) {
      try { records.push(JSON.parse(line)); }
      catch { console.warn('Warning: skipped an unreadable history entry.'); }
    }
  }
  const development = records.filter(r => r.purpose === 'development');
  const other = records.length - development.length;
  if (!development.length) console.log('No development test runs recorded yet.');
  for (const suite of [...new Set(development.map(r => r.suite))].sort()) {
    const runs = development.filter(r => r.suite === suite);
    const failures = runs.filter(r => r.status === 'failed');
    console.log(`${suite}: ${runs.length} runs, ${runs.length - failures.length} passed, ${failures.length} failed; latest: ${runs.at(-1).status}`);
  }
  if (other) console.log(`${other} explicitly labelled verification/mutation runs excluded from the counts above.`);
  const failures = development.filter(r => r.status === 'failed').slice(-10);
  if (failures.length) {
    console.log('\nLatest failures (up to 10):');
    for (const r of failures) console.log(`\n${r.startedAt} | ${r.suite} | commit ${r.commit?.slice(0, 8) || 'unknown'}${r.dirty ? ' (modified)' : ''}\n${r.failure}`);
  }
  console.log('\nCounts represent suite executions, not unique bugs. History starts when logging was installed.');
}
