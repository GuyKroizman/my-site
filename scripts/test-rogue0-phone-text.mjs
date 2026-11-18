import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('phone-text');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { throwTargetHint, stairsHint } from '../src/games/rogue0/uiLabels.ts';

// `Esc\b` deliberately does not match the verb "escape the dungeon".
const KEYBOARD = /\b(Enter|Esc|cursor|Arrow keys|HJKL|Page Up|press|> \(or)\b/i;

// Throw/wand targeting: desktop keeps hotkeys, phones get tap-only wording.
const wandDesktop = throwTargetHint('Wand of Frost', true, false);
const wandPhone = throwTargetHint('Wand of Frost', true, true);
assert.match(wandDesktop, /\(or Enter\)/);
assert.match(wandDesktop, /press Esc/);
assert.match(wandPhone, /tap an enemy, then tap it again to fire/);
assert.doesNotMatch(wandPhone, KEYBOARD, `phone wand hint leaks a keyboard reference: ${wandPhone}`);

const throwDesktop = throwTargetHint('Potion of Healing', false, false);
const throwPhone = throwTargetHint('Potion of Healing', false, true);
assert.match(throwDesktop, /move cursor \+ Enter\. Esc cancels\./);
assert.equal(throwPhone,
  'Target Potion of Healing: tap any tile in sight to throw. Open the backpack to cancel.');
assert.doesNotMatch(throwPhone, KEYBOARD, `phone throw hint leaks a keyboard reference: ${throwPhone}`);

// Stairs messages: same information, tap wording on phones.
assert.equal(stairsHint(false, false), 'You stand on the stairs. Press > (or .) to descend.');
assert.equal(stairsHint(true, false), 'You stand on the exit. Press > (or .) to escape the dungeon.');
for (const exit of [false, true]) {
  const phone = stairsHint(exit, true);
  assert.match(phone, /Tap the stairs/);
  assert.doesNotMatch(phone, KEYBOARD, `phone stairs hint leaks a keyboard reference: ${phone}`);
}

// Guard the real call sites so keyboard wording cannot leak back in.
const ui = fs.readFileSync(new URL('../src/games/rogue0/ui.ts', import.meta.url), 'utf8');
assert.match(ui, /throwTargetHint\(/);
assert.doesNotMatch(ui, /Target \$\{this\.context\.throwItem/, 'raw throw hint text is still inlined in ui.ts');

const scene = fs.readFileSync(new URL('../src/games/rogue0/scene0.ts', import.meta.url), 'utf8');
assert.match(scene, /stairsHint\(isExit\)/);
assert.doesNotMatch(scene, /Press > \(or \.\)/, 'raw stairs hint text is still inlined in scene0.ts');

// Help modal: the pages with keyboard instructions have touch-only variants,
// and none of those variants mentions a key.
const page = fs.readFileSync(new URL('../src/pages/Rogue0.tsx', import.meta.url), 'utf8');
assert.match(page, /isTouchFirstDevice\(\) && 'touchBody' in p \? p\.touchBody : p\.body/);
assert.match(page, /import \{ isTouchFirstDevice \} from '\.\.\/games\/rogue0\/uiLabels'/);
const touchBodies = [...page.matchAll(/touchBody: `([\s\S]*?)`/g)].map(([, body]) => body);
assert.equal(touchBodies.length, 3, 'Basics, Talents and Progress need touch-only help text');
for (const body of touchBodies) {
  assert.doesNotMatch(body, KEYBOARD, `phone help text leaks a keyboard reference: ${body}`);
}

console.log('Rogue0 phone text: targeting, stairs and help prose use tap-only wording on touch devices; keyboard wording stays on desktop');
