// Original music generated in code from real instrument samples.
//
// The motifs below are written for this game; none come from Prokofiev.
// They are developed by fixed rules (key/chord transposition, inversion,
// rhythmic thinning) driven by game state, never by randomness, so the score
// stays recognisable while reacting to the dungeon.

import type { MusicInstrument } from './musicInstruments.ts';
import type { MusicIntensity, MusicState } from './musicState.ts';

export type MusicNoteEvent = {
  instrument: MusicInstrument;
  note: number;
  // Absolute AudioContext time.
  time: number;
  duration: number;
  gain: number;
};

type Layer = 'strings' | 'clarinet' | 'horn' | 'timpani';

const LAYERS: Layer[] = ['strings', 'clarinet', 'horn', 'timpani'];
const INSTRUMENT: Record<Layer, MusicInstrument> = {
  strings: 'string_ensemble_1',
  clarinet: 'clarinet',
  horn: 'french_horn',
  timpani: 'timpani',
};

// Semitone offsets from D4 (MIDI 62); null is a rest. Sixteen eighth-note steps.
const STRINGS = [0, null, 3, null, 7, null, 5, null, 3, null, 2, null, 0, null, null, null];
const GOBLIN = [12, 15, 14, 10, 12, null, 10, null, 12, 15, 17, 15, 14, null, 12, null];
const BOSS = [-12, null, null, null, -5, null, null, null, -4, null, null, null, -12, null, null, null];
// D minor → Bb major → F major → C major (i–VI–III–VII), as semitone offsets.
const CHORDS = [0, 8, 3, 10];

let intensity: MusicIntensity = 'calm';
let stepIndex = 0;
let nextStepTime = 0;
let started = false;
let lastFrom = 0;

const current: Record<Layer, number> = { strings: 0, clarinet: 0, horn: 0, timpani: 0 };
const target: Record<Layer, number> = { strings: 0, clarinet: 0, horn: 0, timpani: 0 };

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
  const goblin = Math.max(0, ...state.cues.filter((c) => c.cue === 'goblin').map((c) => c.level));
  target.strings = state.intensity === 'boss' ? 0
    : state.intensity === 'calm' ? 0.16
    : state.intensity === 'uneasy' ? 0.18 : 0.2;
  target.clarinet = state.intensity === 'boss' ? 0 : 0.26 * goblin;
  target.horn = state.intensity === 'boss' ? 0.3 : 0;
  target.timpani = state.intensity === 'boss' ? 0.28
    : state.intensity === 'combat' ? 0.18 * goblin : 0;
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
  return clamp(62 + root + value);
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

    if (current.strings > 0.01) {
      const note = transformed(STRINGS, step, root, variant);
      if (note !== null) {
        events.push({
          instrument: INSTRUMENT.strings, note, time,
          duration: duration * 1.8, gain: current.strings,
        });
      }
      if (step % 4 === 0) {
        events.push({
          instrument: INSTRUMENT.strings, note: clamp(62 + root - 12), time,
          duration: duration * 3.5, gain: current.strings * 0.7,
        });
      }
    }

    if (current.clarinet > 0.01) {
      const note = transformed(GOBLIN, step, root, variant);
      // Uneasy keeps the goblin motif sparse; combat plays it in full.
      if (note !== null && !(intensity === 'uneasy' && step % 2 === 1)) {
        events.push({
          instrument: INSTRUMENT.clarinet, note, time,
          duration: duration * (intensity === 'combat' ? 0.55 : 0.8),
          gain: current.clarinet,
        });
      }
    }

    if (current.horn > 0.01) {
      const note = transformed(BOSS, step, 0, 0);
      if (note !== null) {
        events.push({
          instrument: INSTRUMENT.horn, note, time,
          duration: duration * 3.5, gain: current.horn,
        });
      }
    }

    if (current.timpani > 0.01 && (step === 0 || step === 8)) {
      events.push({
        instrument: INSTRUMENT.timpani, note: step === 0 ? 50 : 57, time,
        duration: duration * 2, gain: current.timpani,
      });
    }

    nextStepTime += duration;
    stepIndex++;
  }

  return events;
}
