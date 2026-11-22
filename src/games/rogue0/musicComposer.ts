// Original music generated in code from real instrument samples.
//
// The motifs below are written for this game; none come from Prokofiev.
// They are developed by fixed rules (key/chord transposition, inversion,
// rhythmic thinning) driven by game state, never by randomness, so the score
// stays recognisable while reacting to the dungeon.

import type { MusicInstrument } from './musicInstruments.ts';
import type { MusicCue, MusicIntensity, MusicState } from './musicState.ts';

export type MusicNoteEvent = {
  instrument: MusicInstrument;
  note: number;
  // Absolute AudioContext time.
  time: number;
  duration: number;
  gain: number;
};

type Layer =
  | 'strings' | 'clarinet' | 'pizzicato' | 'oboe' | 'trombone' | 'bassoon'
  | 'flute' | 'piccolo' | 'tuba' | 'marimba' | 'tremolo' | 'trumpet'
  | 'glockenspiel' | 'xylophone' | 'horn' | 'timpani';

const LAYERS: Layer[] = [
  'strings', 'clarinet', 'pizzicato', 'oboe', 'trombone', 'bassoon', 'flute',
  'piccolo', 'tuba', 'marimba', 'tremolo', 'trumpet', 'glockenspiel',
  'xylophone', 'horn', 'timpani',
];

const INSTRUMENT: Record<Layer, MusicInstrument> = {
  strings: 'string_ensemble_1',
  clarinet: 'clarinet',
  pizzicato: 'pizzicato_strings',
  oboe: 'oboe',
  trombone: 'trombone',
  bassoon: 'bassoon',
  flute: 'flute',
  piccolo: 'piccolo',
  tuba: 'tuba',
  marimba: 'marimba',
  tremolo: 'tremolo_strings',
  trumpet: 'trumpet',
  glockenspiel: 'glockenspiel',
  xylophone: 'xylophone',
  horn: 'french_horn',
  timpani: 'timpani',
};

const CUE_LAYER: Partial<Record<MusicCue, Layer>> = {
  goblin: 'clarinet',
  skeleton: 'pizzicato',
  ghoul: 'oboe',
  brute: 'trombone',
  cultist: 'bassoon',
  wraith: 'flute',
  quloptsh: 'piccolo',
  mimic: 'tuba',
  deadlyFrog: 'marimba',
  swarmOfFlies: 'tremolo',
  fireElemental: 'trumpet',
  iceElemental: 'glockenspiel',
  lightningElemental: 'xylophone',
};

// Semitone offsets from D4 (MIDI 62); null is a rest. Sixteen eighth-note steps.
const PATTERNS: Record<Layer, (number | null)[]> = {
  strings: [0, null, 3, null, 7, null, 5, null, 3, null, 2, null, 0, null, null, null],
  clarinet: [12, 15, 14, 10, 12, null, 10, null, 12, 15, 17, 15, 14, null, 12, null],
  pizzicato: [7, null, 4, null, 2, null, 4, null, 7, null, 9, null, 7, null, 4, null],
  oboe: [2, null, 3, 5, 4, null, 2, 3, 5, null, 7, 5, 4, 3, 2, null],
  trombone: [-12, null, null, null, -10, null, null, null, -7, null, null, null, -12, null, null, null],
  bassoon: [0, null, null, 3, null, null, 5, null, 3, null, null, 0, null, null, -2, null],
  flute: [12, null, null, null, 14, null, null, null, 15, null, null, null, 12, null, null, null],
  piccolo: [19, null, 17, null, null, 16, null, null, 19, null, null, 14, null, null, 17, null],
  tuba: [-12, null, null, null, null, null, null, null, -12, null, null, null, null, null, null, null],
  marimba: [7, null, 9, null, 6, null, 7, null, 4, null, 6, null, 7, null, 9, null],
  tremolo: [10, 10, 11, 10, 10, 11, 10, 11, 10, 10, 11, 10, 10, 11, 10, 11],
  trumpet: [7, null, 7, 9, null, 7, null, 11, null, 9, null, 7, null, 7, null, null],
  glockenspiel: [19, null, null, null, 17, null, null, null, 15, null, null, null, 19, null, null, null],
  xylophone: [19, null, 16, null, 19, null, 21, null, 19, null, 16, null, 14, null, 19, null],
  horn: [-12, null, null, null, -5, null, null, null, -4, null, null, null, -12, null, null, null],
  timpani: [50, null, null, null, null, null, null, null, 57, null, null, null, null, null, null, null],
};

// Note length as a fraction of an eighth note. Sparse/low instruments ring
// longer; swarms and plucks are short.
const DURATION: Record<Layer, number> = {
  strings: 1.8,
  clarinet: 0.8,
  pizzicato: 0.5,
  oboe: 0.7,
  trombone: 2.5,
  bassoon: 1.4,
  flute: 3,
  piccolo: 0.5,
  tuba: 2,
  marimba: 0.6,
  tremolo: 0.4,
  trumpet: 0.7,
  glockenspiel: 3,
  xylophone: 0.5,
  horn: 3.5,
  timpani: 2,
};

// D minor → Bb major → F major → C major (i–VI–III–VII), as semitone offsets.
const CHORDS = [0, 8, 3, 10];

let intensity: MusicIntensity = 'calm';
let stepIndex = 0;
let nextStepTime = 0;
let started = false;
let lastFrom = 0;

const current = Object.fromEntries(LAYERS.map((layer) => [layer, 0])) as Record<Layer, number>;
const target = Object.fromEntries(LAYERS.map((layer) => [layer, 0])) as Record<Layer, number>;

function clamp(note: number): number {
  // The loader decodes C3–C6 only.
  return Math.max(48, Math.min(84, note));
}

function stepDuration(): number {
  const bpm = intensity === 'calm' ? 72
    : intensity === 'uneasy' ? 88
    : intensity === 'combat' ? 112
    : 96;
  return 60 / bpm / 2; // eighth notes
}

export function setMusicState(state: MusicState): void {
  intensity = state.intensity;
  const boss = state.intensity === 'boss';
  target.strings = boss ? 0
    : state.intensity === 'calm' ? 0.22
    : state.intensity === 'uneasy' ? 0.245 : 0.27;

  for (const layer of LAYERS) {
    if (layer === 'strings' || layer === 'horn' || layer === 'timpani') continue;
    target[layer] = 0;
  }
  for (const cue of state.cues) {
    const layer = CUE_LAYER[cue.cue];
    if (layer) target[layer] = Math.max(target[layer], 0.3 * cue.level);
  }
  target.horn = boss ? 0.4 : 0;
  const loudest = Math.max(0, ...state.cues.map((cue) => cue.level));
  target.timpani = boss ? 0.38 : state.intensity === 'combat' ? 0.245 * loudest : 0;
}

export function resetMusicComposer(): void {
  stepIndex = 0;
  started = false;
  lastFrom = 0;
  for (const layer of LAYERS) current[layer] = target[layer] = 0;
  intensity = 'calm';
}

function transformed(pattern: (number | null)[], step: number, root: number, variant: number): number | null {
  const offset = pattern[step];
  if (offset === null) return null;
  if (variant === 3 && step % 2 === 1) return null; // rhythmic thinning
  const value = variant === 1 ? offset + 12 : variant === 2 ? 7 - offset : offset;
  const note = 62 + root + value;
  // Timpani pitches are absolute; everything else is transposed from D4.
  return clamp(note);
}

/** Pull notes for the engine's lookahead window `[from, to)`. */
export function musicProvider(from: number, to: number): MusicNoteEvent[] {
  if (!started) {
    nextStepTime = from;
    lastFrom = from;
    started = true;
    // Begin at the current mix instead of fading up from silence on every run.
    for (const layer of LAYERS) current[layer] = target[layer];
  }

  // Smooth layer gains so cues fade in/out instead of cutting abruptly.
  const fade = Math.min(1, Math.max(0, from - lastFrom) / 0.5);
  lastFrom = from;
  for (const layer of LAYERS) current[layer] += (target[layer] - current[layer]) * fade;

  const events: MusicNoteEvent[] = [];
  if (nextStepTime < from) {
    const duration = stepDuration();
    const skipped = Math.floor((from - nextStepTime) / duration);
    nextStepTime += skipped * duration;
    stepIndex += skipped;
  }

  // Guard against an unbounded loop if `to` ever moves far ahead.
  for (let produced = 0; nextStepTime < to && produced < 64; produced++) {
    const duration = stepDuration();
    const time = nextStepTime;
    const bar = Math.floor(stepIndex / 16);
    const step = stepIndex % 16;
    const root = CHORDS[bar % CHORDS.length];
    const variant = Math.floor(bar / 4) % 4;

    for (const layer of LAYERS) {
      if (current[layer] <= 0.01) continue;
      const isPercussion = layer === 'timpani';
      const raw = PATTERNS[layer][step];
      // Timpani values are absolute MIDI pitches; the rest are offsets from D4.
      const note = isPercussion
        ? raw
        : transformed(PATTERNS[layer], step, layer === 'horn' ? 0 : root, layer === 'horn' ? 0 : variant);
      if (note === null) continue;
      // Uneasy keeps motifs sparse; combat plays them in full.
      if (intensity === 'uneasy' && !isPercussion && step % 2 === 1) continue;
      events.push({
        instrument: INSTRUMENT[layer], note, time,
        duration: duration * DURATION[layer], gain: current[layer],
      });
    }

    // Low string pedal anchors each chord.
    if (current.strings > 0.01 && step % 4 === 0) {
      events.push({
        instrument: INSTRUMENT.strings, note: clamp(62 + root - 12), time,
        duration: duration * 3.5, gain: current.strings * 0.7,
      });
    }

    nextStepTime += duration;
    stepIndex++;
  }

  return events;
}
