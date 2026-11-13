import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('tap-guard');
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createGameContext } from '../src/games/rogue0/context.ts';
import { isMapGesture, onTap } from '../src/games/rogue0/tapGuard.ts';

const context = createGameContext();
let taps = 0;
const target = new EventEmitter();
onTap(context, target, () => taps++);
const pointer = { id: 1, x: 100, y: 100, downTime: 1 };
const press = () => { pointer.downTime++; target.emit('pointerdown', pointer); };
const release = () => target.emit('pointerup', pointer);

press();
release();
assert.equal(taps, 1, 'a plain tap opens the control');

// Phaser's top UI scene consumes a HUD press: scene0 never receives that
// pointerdown to clear mapGesture. Do NOT manually clear it as the old test did.
context.mapGesture = true;
assert.equal(isMapGesture(context), true);
release();
assert.equal(taps, 1, 'a map drag released over the HUD does not activate it');
press();
release();
assert.equal(taps, 2, 'a fresh HUD press after a pan works without a map press');

// A release over the HUD can also be consumed before scene0 clears its camera
// state. Those stale world flags must not veto a new, button-owned gesture.
context.panning = true;
context.pinching = true;
press();
release();
assert.equal(taps, 3, 'a fresh HUD tap does not depend on world gesture cleanup');
release();
assert.equal(taps, 3, 'one press only activates once');

press();
pointer.x += 9;
release();
assert.equal(taps, 3, 'dragging inside a button is not a tap');
press();
pointer.y += 9;
release();
assert.equal(taps, 3, 'vertical drags are not taps either');
press();
pointer.x += 12;
target.emit('pointermove', pointer);
pointer.x -= 12;
release();
assert.equal(taps, 3, 'dragging away and back inside the button is not a tap');
press();
pointer.x += 2;
pointer.y += 2;
release();
assert.equal(taps, 4, 'small finger jitter is allowed');

press();
target.emit('pointerout', pointer);
release();
assert.equal(taps, 4, 'leaving and releasing over the control cancels the tap');

press();
const otherPointer = { id: 2, x: pointer.x, y: pointer.y, downTime: 1 };
target.emit('pointerup', otherPointer);
assert.equal(taps, 4, 'another finger cannot release the first finger’s button');
release();
assert.equal(taps, 5, 'the original finger can still release its own press');

press();
pointer.downTime++;
release();
assert.equal(taps, 5, 'a reused Phaser pointer cannot activate an old press');

const other = createGameContext();
const otherTarget = new EventEmitter();
let otherTaps = 0;
onTap(other, otherTarget, () => otherTaps++);
press();
otherTarget.emit('pointerup', pointer);
assert.equal(otherTaps, 0, 'a press belongs to its control, not every control');
release();
assert.equal(taps, 6);
assert.equal(context.mapGesture, true, 'HUD taps do not clear map release suppression');
assert.equal(isMapGesture(other), false, 'world gesture state remains context-local');

console.log('Rogue0 tap guard: fresh HUD presses work after pans; map releases, drags and unrelated fingers never activate controls');
