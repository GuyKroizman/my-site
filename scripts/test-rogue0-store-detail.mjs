import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('store-detail');
import assert from 'node:assert/strict';
import fs from 'node:fs';

// StoreScene is a Phaser scene, so guard the rendered text the same way the
// button-hints suite does: read the real source, not a copy of the label.
const source = fs.readFileSync(new URL('../src/games/rogue0/store/StoreScene.ts', import.meta.url), 'utf8');

// The item-detail panel is shared: buy opens it from a shelf, sell-detail from
// the sell grid. Both must state how many of the item are on the stack.
const detailStart = source.indexOf('const item = this.detail!;');
assert.ok(detailStart !== -1, 'the shared item-detail block still exists');
const detailBlock = source.slice(detailStart);

assert.match(detailBlock, /`\$\{item\.displayName\} ×\$\{item\.count\}`/,
  'the item-detail header states the stack count');
assert.match(detailBlock, /buying \? 'Buy \[Enter\]' : 'Sell 1 \[Enter\]'/,
  'the counted header belongs to the same block as the buy / sell-one buttons');
assert.match(detailBlock, /'Sell all \[A\]'[^\n]*this\.trade\(item\.count\)/,
  'sell-all still trades that same count');

// Counts remain visible where the item is picked, too.
assert.match(source, /`×\$\{slot\.item\.count\}`/, 'shelves keep their stack badge');
assert.match(source, /String\(item\.count\), 16\)\.setOrigin\(1\)/, 'sell grid keeps its stack count');

console.log('Store detail: item-detail modals state the stack count in both buy and sell states');
