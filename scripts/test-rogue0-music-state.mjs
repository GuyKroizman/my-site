import assert from 'node:assert/strict';
import { selectMusicState, sameMusicState } from '../src/games/rogue0/musicState.ts';

const hero = { type: 'player', x: 10, y: 10, healthPoints: 20, name: 'Hero' };

function enemy(overrides = {}) {
  return {
    type: 'enemy',
    name: 'Goblin',
    healthPoints: 10,
    x: 10,
    y: 10,
    awareOfPlayer: false,
    sleeping: false,
    ...overrides,
  };
}

function context(entities, visible = []) {
  return {
    player: hero,
    entities: [hero, ...entities],
    visibleTiles: new Set(visible.map(([x, y]) => `${x},${y}`)),
  };
}

// No audible monsters: calm, with no cues.
assert.deepEqual(selectMusicState(context([])), { intensity: 'calm', cues: [] });

// No player cannot produce music.
assert.deepEqual(selectMusicState({ player: undefined, entities: [], visibleTiles: new Set() }), {
  intensity: 'calm',
  cues: [],
});

// A monster behind a wall still contributes a cue, quietly and not visible.
const behindDoor = selectMusicState(context([enemy({ x: 16, y: 10 })]));
assert.equal(behindDoor.intensity, 'uneasy');
assert.equal(behindDoor.cues[0].cue, 'goblin');
assert.equal(behindDoor.cues[0].visible, false);
assert.ok(behindDoor.cues[0].level > 0 && behindDoor.cues[0].level < 0.4);

// Visibility boosts the level, and closeness does too.
const seen = selectMusicState(context([enemy({ x: 12, y: 10 })], [[12, 10]]));
assert.equal(seen.intensity, 'combat');
assert.equal(seen.cues[0].visible, true);
assert.ok(seen.cues[0].level > behindDoor.cues[0].level);

// Sleeping monsters are audible but faint.
const sleeper = selectMusicState(context([enemy({ x: 14, y: 10, sleeping: true })]));
const awake = selectMusicState(context([enemy({ x: 14, y: 10, sleeping: false })]));
assert.ok(sleeper.cues[0].level < awake.cues[0].level);
assert.equal(sleeper.intensity, 'uneasy');

// A dormant mimic stays silent even if it has a cue; once triggered it plays.
// (The vertical slice gives no motif to mimics, so use an explicit test cue.)
const dormantMimic = enemy({ name: 'Mimic', musicCue: 'goblin', x: 12, y: 10, sleeping: true });
assert.equal(selectMusicState(context([dormantMimic])).intensity, 'calm');
const wokenMimic = selectMusicState(context([enemy({
  name: 'Mimic', musicCue: 'goblin', x: 12, y: 10,
})], [[12, 10]]));
assert.equal(wokenMimic.intensity, 'combat');

// A skeleton has its own motif and behaves like any other cued monster.
const skeleton = selectMusicState(context([enemy({
  name: 'Skeleton', musicCue: 'skeleton', x: 13, y: 10,
})], [[13, 10]]));
assert.equal(skeleton.cues[0].cue, 'skeleton');
assert.equal(skeleton.intensity, 'combat');

// Every expanded monster has a cue, and name fallbacks cover saved floors.
const names = {
  Goblin: 'goblin', Skeleton: 'skeleton', 'The Unblinking Coil': 'boss',
  Ghoul: 'ghoul', Brute: 'brute', Cultist: 'cultist', Wraith: 'wraith',
  Quloptsh: 'quloptsh', Mimic: 'mimic', 'Deadly Frog': 'deadlyFrog',
  'Swarm of Flies': 'swarmOfFlies', 'Fire Elemental': 'fireElemental',
  'Ice Elemental': 'iceElemental', 'Lightning Elemental': 'lightningElemental',
};
for (const [name, cue] of Object.entries(names)) {
  const state = selectMusicState(context([enemy({ name, x: 13, y: 10 })]));
  assert.equal(state.cues[0]?.cue, cue, `${name} maps to ${cue}`);
}

// Mirror images are decoys and must not add a motif.
assert.equal(selectMusicState(context([
  enemy({ name: 'Wraith', x: 12, y: 10, isDecoy: true }),
])).intensity, 'calm');

// The boss overrides everything, even from across the floor and asleep.
const boss = selectMusicState(context([
  enemy({ name: 'The Unblinking Coil', x: 24, y: 24, sleeping: true }),
  enemy({ x: 11, y: 10 }),
  enemy({ name: 'Skeleton', musicCue: 'skeleton', x: 12, y: 10 }),
]));
assert.equal(boss.intensity, 'boss');
assert.deepEqual(boss.cues, [{ cue: 'boss', level: 1, visible: false }]);

// An explicit music cue on a future monster type wins over the name fallback.
const explicit = selectMusicState(context([enemy({ name: 'Something New', musicCue: 'goblin', x: 15, y: 10 })]));
assert.equal(explicit.cues[0].cue, 'goblin');

// Items, decoys, dead enemies and distant enemies are ignored.
assert.equal(selectMusicState(context([
  enemy({ type: 'item', x: 10, y: 11 }),
  enemy({ type: 'decoy', x: 10, y: 11 }),
  enemy({ healthPoints: 0, x: 10, y: 11 }),
  enemy({ x: 30, y: 30 }),
])).intensity, 'calm');

// Awareness counts as combat even just outside melee range.
assert.equal(selectMusicState(context([enemy({ x: 15, y: 10, awareOfPlayer: true })])).intensity, 'combat');

// State comparison ignores tiny float drift but notices real changes.
const a = selectMusicState(context([enemy({ x: 14, y: 10 })]));
const b = selectMusicState(context([enemy({ x: 14, y: 10.0001 })]));
assert.equal(sameMusicState(a, b), true);
assert.equal(sameMusicState(a, selectMusicState(context([]))), false);

console.log('Rogue0 music state: calm/uneasy/combat/boss, walls, sleepers, mimics and overrides passed');
