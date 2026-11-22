import assert from 'node:assert/strict';
import {
  musicProvider,
  resetMusicComposer,
  setMusicState,
} from '../src/games/rogue0/musicComposer.ts';

function collect(state, from, to, steps = 8) {
  resetMusicComposer();
  setMusicState(state);
  const events = [];
  let start = from;
  for (let i = 0; i < steps; i++) {
    const window = (to - from) / steps;
    events.push(...musicProvider(start, start + window));
    start += window;
  }
  return events;
}

const calm = { intensity: 'calm', cues: [] };
const goblin = { intensity: 'combat', cues: [{ cue: 'goblin', level: 1, visible: true }] };
const skeleton = { intensity: 'combat', cues: [{ cue: 'skeleton', level: 1, visible: true }] };
const boss = { intensity: 'boss', cues: [{ cue: 'boss', level: 1, visible: true }] };

const calmNotes = collect(calm, 0, 8);
assert.ok(calmNotes.length > 0, 'calm music schedules notes');
assert.ok(calmNotes.every((e) => e.instrument === 'string_ensemble_1'));
assert.ok(calmNotes.every((e) => e.note >= 48 && e.note <= 84), 'notes stay in decoded range');
assert.ok(calmNotes.every((e) => e.time >= 0 && e.time < 8 && e.gain > 0 && e.gain <= 1));

const goblinNotes = collect(goblin, 0, 8);
assert.ok(goblinNotes.some((e) => e.instrument === 'clarinet'), 'goblin motif uses clarinet');
assert.ok(goblinNotes.some((e) => e.instrument === 'timpani'), 'combat adds a percussion pulse');

const skeletonNotes = collect(skeleton, 0, 8);
assert.ok(skeletonNotes.some((e) => e.instrument === 'pizzicato_strings'),
  'skeleton motif uses pizzicato strings');
assert.ok(skeletonNotes.every((e) => e.note >= 48 && e.note <= 84));

// Each expanded monster gets its own instrument.
const cueInstruments = {
  ghoul: 'oboe', brute: 'trombone', cultist: 'bassoon', wraith: 'flute',
  quloptsh: 'piccolo', mimic: 'tuba', deadlyFrog: 'marimba',
  swarmOfFlies: 'tremolo_strings', fireElemental: 'trumpet',
  iceElemental: 'glockenspiel', lightningElemental: 'xylophone',
};
for (const [cue, instrument] of Object.entries(cueInstruments)) {
  const notes = collect({ intensity: 'combat', cues: [{ cue, level: 1, visible: true }] }, 0, 8);
  assert.ok(notes.some((event) => event.instrument === instrument), `${cue} uses ${instrument}`);
  assert.ok(notes.every((event) => event.note >= 48 && event.note <= 84));
}

const bossNotes = collect(boss, 0, 8);
assert.ok(bossNotes.some((e) => e.instrument === 'french_horn'), 'boss motif uses French horn');
assert.ok(bossNotes.some((e) => e.instrument === 'timpani'), 'boss motif uses timpani');
assert.ok(bossNotes.every((e) => e.instrument === 'french_horn' || e.instrument === 'timpani'),
  'boss suppresses the other layers, including pizzicato');

// A long jump must not replay the intervening minutes of music.
resetMusicComposer();
setMusicState(calm);
musicProvider(0, 1);
const afterJump = musicProvider(300, 300.5);
assert.ok(afterJump.every((e) => e.time >= 300), 'no backlog after a clock jump');
assert.ok(afterJump.length < 20, 'clock jump does not produce a huge burst');

// Layer changes crossfade instead of cutting instantly.
resetMusicComposer();
setMusicState(calm);
musicProvider(0, 0.4);
setMusicState(boss);
const duringFade = musicProvider(0.4, 0.9);
assert.ok(duringFade.some((e) => e.instrument === 'string_ensemble_1'),
  'strings linger briefly while the boss layer fades in');
const afterFade = musicProvider(1.1, 2);
assert.ok(afterFade.every((e) => e.instrument === 'french_horn' || e.instrument === 'timpani'));

console.log('Rogue0 music composer: original motifs, layering, boss override and fades passed');
