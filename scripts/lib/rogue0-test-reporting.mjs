import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const FAILURE_CATEGORIES = ['game-bug', 'test-bug', 'environment', 'intended-change', 'unknown'];

// Apply this both when recording new errors and displaying older history.
export function redact(text) {
  return String(text)
    .replace(/-----BEGIN[^\n]*-----[\s\S]*?(?:-----END[^\n]*-----|$)/g, '[REDACTED PRIVATE MATERIAL]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\b([\w.-]*(?:KEY|TOKEN|PASSWORD|SECRET)[\w.-]*\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s]+)/gi, '$1[REDACTED]');
}

export function readJsonl(file, warn = console.warn) {
  if (!fs.existsSync(file)) return [];
  const records = [];
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    try { records.push(JSON.parse(line)); }
    catch { warn(`Warning: unreadable JSON at ${file}:${index + 1}; original history retained.`); }
  });
  return records;
}

export function appendJsonl(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n');
}

export function gitState(root) {
  try {
    const options = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    return {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], options).trim(),
      dirty: Boolean(execFileSync('git', ['status', '--porcelain'], options).trim()),
    };
  } catch { return { commit: null, dirty: null }; }
}

export function newRunId() { return randomUUID(); }

// Legacy records get a stable ID without modifying the original JSONL file.
export function failureId(record) {
  return record.runId ?? createHash('sha256').update(JSON.stringify(record)).digest('hex').slice(0, 16);
}

export function classifyFailure(records, annotations, id, category, note) {
  if (!FAILURE_CATEGORIES.includes(category)) throw Error(`Category must be one of: ${FAILURE_CATEGORIES.join(', ')}`);
  if (!note?.trim()) throw Error('A cause/resolution note is required; do not infer causes from a stack trace alone.');
  const matches = records.filter(record => failureId(record) === id);
  if (matches.length !== 1 || matches[0].status !== 'failed') throw Error('ID must identify exactly one failed suite execution.');
  const entry = { failureId: id, category, note: redact(note.trim()), recordedAt: new Date().toISOString() };
  appendJsonl(annotations, entry);
  return entry;
}

export function summarize(records, annotations = []) {
  const development = records.filter(record => (record.purpose ?? 'development') === 'development');
  const failures = development.filter(record => record.status === 'failed');
  const latest = new Map(annotations.map(entry => [entry.failureId, entry]));
  const categories = {};
  for (const failure of failures) {
    const category = latest.get(failureId(failure))?.category ?? 'unclassified';
    categories[category] = (categories[category] ?? 0) + 1;
  }
  return { development, failures, latest, categories, excluded: records.length - development.length };
}
