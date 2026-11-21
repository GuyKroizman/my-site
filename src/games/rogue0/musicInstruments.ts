// Lazy, browser-only loader for the CC BY 3.0 MIDI.js instrument files.
//
// No top-level side effects: importing this module in node (the game test
// fixtures) must not touch `window`, `AudioContext`, or start a fetch.

export type MusicInstrument =
  | 'clarinet'
  | 'french_horn'
  | 'string_ensemble_1'
  | 'timpani';

type Player = {
  buffers: Record<string, AudioBuffer>;
  play(
    note: string | number,
    when?: number,
    options?: {
      gain?: number;
      duration?: number;
      attack?: number;
      decay?: number;
      sustain?: number;
      release?: number;
      adsr?: [number, number, number, number];
    }
  ): Player;
  stop(when?: number): unknown[];
  connect(destination: AudioNode): Player;
};

// C3..C6, using the flat note names the MIDI.js files actually use as keys
// (A0, Bb0, B0, C1, ...). `soundfont-player` passes `notes` through to
// audio-loader's `only` filter, which matches those raw keys *before* they are
// converted to MIDI numbers. Passing numbers here would decode zero notes and
// still resolve successfully — silent instruments.
const PITCHES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_NAMES: string[] = [];
for (let midi = 48; midi <= 84; midi++) {
  const octave = Math.floor(midi / 12) - 1;
  NOTE_NAMES.push(`${PITCHES[midi % 12]}${octave}`);
}

const FILES: Record<MusicInstrument, string> = {
  clarinet: 'clarinet-mp3.js',
  french_horn: 'french_horn-mp3.js',
  string_ensemble_1: 'string_ensemble_1-mp3.js',
  timpani: 'timpani-mp3.js',
};

let players: Partial<Record<MusicInstrument, Player>> | undefined;
let pending: Promise<void> | undefined;
// A stop during an in-flight load must prevent that load from resurrecting
// the instruments after it finishes.
let generation = 0;

function fileUrl(file: string): string {
  // Vite's base is '/', so this stays a plain string with no `import.meta`
  // syntax (node fixtures transpile these modules without it).
  return `/rogue0/audio/${file}`;
}

/**
 * Load the four instrument files in parallel. The dynamic import keeps the
 * loader (and the ~10 MB of samples) out of the initial page load. A failed
 * load rejects; the caller is responsible for surfacing a visible error.
 */
export function loadInstruments(
  ctx: AudioContext,
  destination: AudioNode
): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Instrument loading requires a browser.'));
  }
  if (!pending) {
    const startedAt = generation;
    pending = (async () => {
      const { instrument } = await import('soundfont-player');
      const names = Object.keys(FILES) as MusicInstrument[];
      const loaded = await Promise.all(
        names.map((name) => instrument(ctx, fileUrl(FILES[name]) as Parameters<typeof instrument>[1], {
          destination,
          notes: NOTE_NAMES,
        }))
      );
      // An empty buffer set still resolves successfully; treat it as a load
      // failure so the caller shows a message instead of playing silence.
      for (let i = 0; i < names.length; i++) {
        const buffers = (loaded[i] as unknown as Player).buffers;
        if (!buffers || Object.keys(buffers).length === 0) {
          throw new Error(`No samples decoded for ${names[i]}.`);
        }
      }
      if (startedAt !== generation) {
        loaded.forEach((player) => player.stop());
        return;
      }
      players = Object.fromEntries(names.map((name, i) => [name, loaded[i]]));
    })().catch((error) => {
      // Allow a later retry after a transient network failure.
      pending = undefined;
      players = undefined;
      throw error;
    });
  }
  return pending;
}

/** Silence every playing note and forget the loaded instruments. */
export function stopAllInstruments(): void {
  generation++;
  if (players) Object.values(players).forEach((player) => player.stop());
  players = undefined;
  pending = undefined;
}

export function isLoaded(): boolean {
  return players !== undefined;
}

/** Number of decoded notes per instrument, for the loader spike diagnostics. */
export function loadedNoteCounts(): Record<string, number> {
  if (!players) return {};
  return Object.fromEntries(
    Object.entries(players).map(([name, player]) => [name, Object.keys(player.buffers).length])
  );
}

/** Play one note now. Used by the Phase 1 loader spike and by the composer. */
export function playNote(
  instrument: MusicInstrument,
  note: string | number,
  when: number,
  options: Parameters<Player['play']>[2]
): void {
  if (!players) throw new Error('Instruments are not loaded.');
  players[instrument]?.play(note, when, options);
}
