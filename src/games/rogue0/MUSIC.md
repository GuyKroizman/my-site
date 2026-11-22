# Rogue0 music

Rogue0's soundtrack uses real orchestral instrument samples played by
[`soundfont-player`](https://github.com/danigb/soundfont-player), with the notes
composed in code. The melodies are original to this game; only the *idea* of
giving characters their own instruments is borrowed from Prokofiev's
*Peter and the Wolf*.

## Leitmotifs

| Character | Instrument | Musical idea |
|---|---|---|
| Exploration (hero) | String ensemble | Slow, sparse four-bar phrase in D minor |
| Goblin | Clarinet | Quick, staccato, skipping figure |
| Skeleton | Pizzicato strings | Dry, brittle plucks |
| Ghoul | Oboe | Fast, reedy, irregular scurry |
| Brute | Trombone | Slow, heavy brass downbeats |
| Cultist | Bassoon | Ceremonial, hollow chant |
| Wraith | Flute | Airy, long, floating notes |
| Quloptsh | Piccolo | Sparse, high, uneasy plucks |
| Mimic | Tuba | Silent until it wakes, then a low stab |
| Deadly Frog | Marimba | Bubbling, uneven taps |
| Swarm of Flies | Tremolo strings | Dense, fast buzz |
| Fire Elemental | Trumpet | Bright, insistent blare |
| Ice Elemental | Glockenspiel | Glassy, sustained bells |
| Lightning Elemental | Xylophone | Sharp, brittle cracks |
| The Unblinking Coil (boss) | French horn + timpani | Low, slow horn statement with heavy downbeats |

Only these monsters have motifs. Other monsters do not change the music.

## How the state is chosen

`musicState.ts` is a pure function of the game context:

- Sound travels **8 tiles**, through walls and closed doors. Distance sets the
  cue's level; a visible cue is louder.
- Sleeping monsters are audible at 25% level. A dormant Mimic contributes
  nothing, so its disguise is not spoiled by its own motif.
- An awake, cued monster within 3 tiles (or already aware of the player) makes
  the music **combat** intensity. Nearby cues with no threat make it **uneasy**;
  no cues means **calm**.
- A living guardian forces **boss** intensity anywhere on the floor and
  suppresses every other layer.

Only cued monsters affect tension; uncued monsters are deliberately musically
invisible.

## How the music is generated

`musicComposer.ts` turns that state into note events on demand:

- Fixed key of D minor with a i–VI–III–VII chord cycle. Each bar transposes the
  motifs by the current chord.
- Transformations cycle in a fixed order — original, octave, inversion,
  rhythmic thinning — so the score develops without random notes.
- Tempo follows intensity: calm 72 BPM, uneasy 88, combat 112, boss 96.
- Layer gains ease toward their targets over ~0.5 s instead of cutting.
- The composer is deterministic and keeps its own clock. A large clock jump
  (e.g. a suspended tab) skips the missed bars rather than replaying them.

`audio.ts` owns a lookahead scheduler (25 ms tick, 120 ms ahead), a dry/reverb
bus and a master gain. The reverb is a generated noise impulse response — room
acoustics, not instrument synthesis.

The five original instruments are preloaded when a run starts. Later instruments
are downloaded on the first note that needs them, so the 16-file library (~38 MB
in `dist/`) does not cost bandwidth up front.

## Controls

The in-game menu has **Music: ON/OFF** and a volume slider, independent of the
existing sound-effects mute. Preferences persist in `localStorage` under
`rogue0_musicMuted` and `rogue0_musicVolume`. Music ducks to half volume while
a modal is open, stops on run end or exit, and restarts with the next run.

A load failure is **fatal to the run**: the error is shown on the start screen
and the run exits. There is no silent fallback to no music.

## Adding a monster or instrument

1. Put the CC BY licensed `.js` soundfont file in `public/rogue0/audio/` and
   add it to that directory's `LICENSE`.
2. Add its name to `MusicInstrument` and the `FILES` map in
   `musicInstruments.ts`.
3. Add a `MusicCue` value and a name fallback in `musicState.ts`, then set
   `musicCue` in the monster's config.
4. Add a layer, motif array and target gain in `musicComposer.ts`.
5. Extend `test-rogue0-music-state.mjs` and
   `test-rogue0-music-composer.mjs`, then run `npm run test:rogue0`.

## Tests and further reading

- `npm run test:rogue0:music` — state selection rules.
- `npm run test:rogue0:music-composer` — motifs, layering, fades, clock jumps.
- `scripts/music-spike.html` — dev-only page for checking single notes.
- `MUSIC_PLAN.md` — decisions and implementation history.

Samples are CC BY 3.0 (FluidR3_GM via MIDI.js Soundfonts); see
`public/rogue0/audio/LICENSE`.
