import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('tap-guard');
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createGameContext } from '../src/games/rogue0/context.ts';
import { isMapGesture, onTap } from '../src/games/rogue0/tapGuard.ts';

// A HUD control that opens something (the log strip, a toolbar button) must
// only react to a tap, never to the release that ends a map pan/pinch.
const context = createGameContext();
let taps = 0;
const target = new EventEmitter();
onTap(context, target, () => taps++);

context.mapGesture = false;
target.emit('pointerup');
assert.equal(taps, 1, 'a plain tap opens the control');

// The scene sets mapGesture when the drag crosses its pan threshold and keeps
// it set until the next fresh press, so every release of that gesture is
// ignored even when the finger comes up over the control.
context.mapGesture = true;
assert.equal(isMapGesture(context), true);
target.emit('pointerup');
assert.equal(taps, 1, 'a pan release over the control is not a tap');
context.mapGesture = false;
context.pinching = true;
target.emit('pointerup');
assert.equal(taps, 1, 'a pinch release is not a tap either');
context.pinching = false;
context.panning = true;
target.emit('pointerup');
assert.equal(taps, 1, 'the camera flags alone keep suppressing taps');
context.panning = false;

// The next fresh press clears the gesture, so the same control works normally.
context.mapGesture = false;
target.emit('pointerup');
assert.equal(taps, 2, 'the next tap after a gesture still opens the control');

// The guard reads the context it was attached with, not a global flag.
const other = createGameContext();
other.mapGesture = true;
let otherTaps = 0;
const otherTarget = new EventEmitter();
onTap(other, otherTarget, () => otherTaps++);
target.emit('pointerup');
assert.equal(taps, 3, 'another context does not suppress this control');
otherTarget.emit('pointerup');
assert.equal(otherTaps, 0, 'the control follows its own scene state');

console.log('Rogue0 tap guard: pan/pinch releases never open HUD controls, fresh taps still do');
