import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('button-hints');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buttonLabel, isTouchFirstDevice } from '../src/games/rogue0/uiLabels.ts';

const STORE_LABELS = [
  ['Sell [S]', 'Sell'],
  ['X', 'X'],
  ['Back [Esc]', 'Back'],
  ['Buy [Enter]', 'Buy'],
  ['Sell 1 [Enter]', 'Sell 1'],
  ['Sell all [A]', 'Sell all'],
];
const HUD_LABELS = [
  ['Wait  [Space]', 'Wait'],
  ['Inspect  [x] · Search  [s]', 'Inspect · Search'],
  ['Backpack  [b]', 'Backpack'],
];
const TALENT_LABELS = [
  // The compact talent-tree close button is just "X"; Esc still closes it.
  ['X', 'X'],
];
const ALL_LABELS = [...STORE_LABELS, ...HUD_LABELS, ...TALENT_LABELS];

// With a keyboard, the hints stay exactly as authored.
for (const [label] of ALL_LABELS) {
  assert.equal(buttonLabel(label, false), label, `desktop keeps "${label}"`);
}

// On a touch-first device every bracketed shortcut disappears, including the
// second hint on the combined inspect/search button.
for (const [label, expected] of ALL_LABELS) {
  assert.equal(buttonLabel(label, true), expected, `phone rewrites "${label}" to "${expected}"`);
}

// The device check itself: mobile UA, or a touch screen with a coarse pointer.
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const realWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const setNavigator = (userAgent) => Object.defineProperty(globalThis, 'navigator',
  { value: { userAgent }, configurable: true, writable: true });
const setWindow = (value) => Object.defineProperty(globalThis, 'window',
  { value, configurable: true, writable: true });
try {
  setNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148');
  setWindow(undefined);
  assert.equal(isTouchFirstDevice(), true, 'iPhone UA is touch-first');
  assert.equal(buttonLabel('Backpack  [b]'), 'Backpack');

  setNavigator('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
  assert.equal(isTouchFirstDevice(), false, 'desktop UA without touch is not touch-first');
  assert.equal(buttonLabel('Backpack  [b]'), 'Backpack  [b]');

  setWindow({ ontouchstart: () => {}, matchMedia: (q) => ({ matches: q === '(pointer: coarse)' }) });
  assert.equal(isTouchFirstDevice(), true, 'touch screen with coarse pointer is touch-first');

  setWindow({ ontouchstart: () => {}, matchMedia: () => ({ matches: false }) });
  assert.equal(isTouchFirstDevice(), false, 'touch-capable laptop with a mouse keeps hints');
} finally {
  if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
  else delete globalThis.navigator;
  if (realWindow) Object.defineProperty(globalThis, 'window', realWindow);
  else delete globalThis.window;
}

// Guard the real call sites so a future label cannot accidentally bypass the
// helper and leak keyboard hints to phone players again.
const store = fs.readFileSync(new URL('../src/games/rogue0/store/StoreScene.ts', import.meta.url), 'utf8');
assert.match(store, /buttonLabel\('Sell \[S\]'\)/);
assert.match(store, /buttonLabel\('X'\)/,
  'top-right store close button drops its keyboard hint on phones');
assert.match(store, /buttonLabel\('Back \[Esc\]'\)/);
assert.match(store, /buttonLabel\(buying \? 'Buy \[Enter\]' : 'Sell 1 \[Enter\]'\)/);
assert.match(store, /buttonLabel\('Sell all \[A\]'\)/);

// The up/down/left/right selection arrows are a keyboard fallback for narrow
// layouts. Phone players tap shelves directly, so the arrows must be hidden.
assert.ok(store.includes("const labels = ['←', '↑', '↓', '→']"), 'arrow buttons still exist for keyboard layouts');
assert.match(store, /if \(layout\.mode === 'stacked' && !isTouchFirstDevice\(\)\) \{/,
  'arrow buttons are gated off on touch-first devices');
assert.match(store, /import \{ buttonLabel, isTouchFirstDevice \} from '\.\.\/uiLabels'/);

const ui = fs.readFileSync(new URL('../src/games/rogue0/ui.ts', import.meta.url), 'utf8');
assert.match(ui, /buttonLabel\("Wait  \[Space\]"\)/);
assert.match(ui, /buttonLabel\("Inspect  \[x\] · Search  \[s\]"\)/);
assert.match(ui, /buttonLabel\("Backpack  \[b\]"\)/);

const talents = fs.readFileSync(new URL('../src/games/rogue0/talents/TalentScene.ts', import.meta.url), 'utf8');
assert.match(talents, /buttonLabel\('X'\)/,
  'talent screen Close button drops its keyboard hint on phones');
assert.match(talents, /import \{ buttonLabel \} from '\.\.\/uiLabels'/);

console.log('Rogue0 phone UI: button labels drop keyboard shortcuts and stacked-layout arrow buttons are hidden; keyboard layouts keep both');
