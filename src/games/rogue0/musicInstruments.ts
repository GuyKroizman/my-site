// Lazy, browser-only loader for the CC BY 3.0 MIDI.js instrument files.
//
// No top-level side effects: importing this module in node (the game test
// fixtures) must not touch `window`, `AudioContext`, or start a fetch.

export type MusicInstrument =
  | 'bassoon'
  | 'clarinet'
  | 'flute'
  | 'french_horn'
  | 'glockenspiel'
  | 'marimba'
  | 'oboe'
  | 'piccolo'
  | 'pizzicato_strings'
  | 'string_ensemble_1'
  | 'timpani'
  | 'tremolo_strings'
  | 'trombone'
  | 'trumpet'
  | 'tuba'
  | 'xylophone';

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
  bassoon: 'bassoon-mp3.js',
  clarinet: 'clarinet-mp3.js',
  flute: 'flute-mp3.js',
  french_horn: 'french_horn-mp3.js',
  glockenspiel: 'glockenspiel-mp3.js',
  marimba: 'marimba-mp3.js',
  oboe: 'oboe-mp3.js',
  piccolo: 'piccolo-mp3.js',
  pizzicato_strings: 'pizzicato_strings-mp3.js',
  string_ensemble_1: 'string_ensemble_1-mp3.js',
  timpani: 'timpani-mp3.js',
  tremolo_strings: 'tremolo_strings-mp3.js',
  trombone: 'trombone-mp3.js',
  trumpet: 'trumpet-mp3.js',
  tuba: 'tuba-mp3.js',
  xylophone: 'xylophone-mp3.js',
};

// The five used by the original slice, preloaded once at run start. Everything
// else is fetched on its first note, so a monster introduced later does not
// cost bandwidth until the player actually meets it.
const CORE: MusicInstrument[] = [
  'clarinet', 'pizzicato_strings', 'string_ensemble_1', 'french_horn', 'timpani',
];

let players: Partial<Record<MusicInstrument, Player>> | undefined;
let loading = new Set<MusicInstrument>();
let pending: Promise<void> | undefined;
let ctx: AudioContext | undefined;
let destination: AudioNode | undefined;
// A stop during an in-flight load must prevent that load from resurrecting
// instruments after it finishes.
let generation = 0;

function fileUrl(file: string): string {
  // Vite's base is '/', so this stays a plain string with no `import.meta`
  // syntax (node fixtures transpile these modules without it).
  return `/rogue0/audio/${file}`;
}

async function decode(name: MusicInstrument): Promise<Player> {
  if (!ctx || !destination) throw new Error('Audio context is not ready.');
  const { instrument } = await import('soundfont-player');
  const player = await instrument(
    ctx,
    fileUrl(FILES[name]) as Parameters<typeof instrument>[1],
    { destination, notes: NOTE_NAMES }
  );
  // An empty buffer set still resolves successfully; treat it as a failure so
  // the caller shows a message instead of playing silence.
  const buffers = (player as unknown as Player).buffers;
  if (!buffers || Object.keys(buffers).length === 0) {
    throw new Error(`No samples decoded for ${name}.`);
  }
  return player as unknown as Player;
}

/**
 * Preload the core instruments at run start. The dynamic import keeps the
 * loader (and the ~12 MB of samples) out of the initial page load. A failed
 * load rejects; the caller is responsible for surfacing a visible error.
 */
export function loadInstruments(
  audioContext: AudioContext,
  output: AudioNode
): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Instrument loading requires a browser.'));
  }
  ctx = audioContext;
  destination = output;
  if (!pending) {
    const startedAt = generation;
    pending = (async () => {
      const decoded = await Promise.all(CORE.map(decode));
      if (startedAt !== generation) {
        decoded.forEach((player) => player.stop());
        return;
      }
      players = Object.fromEntries(CORE.map((name, i) => [name, decoded[i]]));
    })().catch((error) => {
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
  loading = new Set();
  ctx = undefined;
  destination = undefined;
}

export function isLoaded(): boolean {
  return players !== undefined;
}

/** Number of decoded notes per instrument, for diagnostics. */
export function loadedNoteCounts(): Record<string, number> {
  if (!players) return {};
  return Object.fromEntries(
    Object.entries(players).map(([name, player]) => [name, Object.keys(player.buffers).length])
  );
}

/** Play one note, fetching a non-core instrument on first use. */
export function playNote(
  instrument: MusicInstrument,
  note: string | number,
  when: number,
  options: Parameters<Player['play']>[2]
): void {
  if (!ctx || !destination) throw new Error('Instruments are not loaded.');
  const player = players?.[instrument];
  if (player) {
    player.play(note, when, options);
    return;
  }
  if (loading.has(instrument)) return; // note is skipped while it downloads
  loading.add(instrument);
  const startedAt = generation;
  void decode(instrument)
    .then((decoded) => {
      if (startedAt !== generation) {
        decoded.stop();
        return;
      }
      players ??= {};
      players[instrument] = decoded;
    })
    .catch(() => undefined)
    .finally(() => loading.delete(instrument));
}
