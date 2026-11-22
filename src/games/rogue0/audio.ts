// Procedural retro sound effects using the Web Audio API (no audio files),
// plus a music engine that plays real instrument samples sequenced in code.

// The .ts extension is required by the node test loader; the repo already
// uses it for imports from other audio-consuming modules.
import { loadInstruments, playNote, stopAllInstruments } from './musicInstruments.ts';
import { musicProvider, resetMusicComposer, setMusicState } from './musicComposer.ts';
import type { MusicNoteEvent } from './musicComposer.ts';
import type { MusicState } from './musicState.ts';

export type { MusicNoteEvent } from './musicComposer.ts';

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
}

export function getMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  return muted;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function unlockAudio(): void {
  getCtx();
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.1,
  delay = 0,
  slideTo?: number
): void {
  const c = getCtx();
  if (!c || muted) return;

  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
  }

  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

function noise(duration: number, volume = 0.1, delay = 0): void {
  const c = getCtx();
  if (!c || muted) return;

  const t0 = c.currentTime + delay;
  const length = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  src.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
}

export const sfx = {
  hit(): void {
    tone(200, 0.08, 'square', 0.07, 0, 80);
    noise(0.06, 0.09);
  },
  surpriseHit(): void {
    tone(880, 0.07, 'square', 0.06, 0, 220);
    tone(220, 0.12, 'sawtooth', 0.09, 0.04, 60);
    noise(0.1, 0.1, 0.03);
  },
  hurt(): void {
    tone(150, 0.16, 'sawtooth', 0.11, 0, 65);
    noise(0.1, 0.08);
  },
  // Armour turned the blow: a short metallic clink with no pain under it.
  deflect(): void {
    tone(1046, 0.04, 'square', 0.05, 0, 1568);
    tone(1568, 0.05, 'square', 0.035, 0.02);
    noise(0.03, 0.04);
  },
  death(): void {
    tone(320, 0.28, 'square', 0.1, 0, 55);
    noise(0.18, 0.08);
  },
  playerDeath(): void {
    tone(220, 0.35, 'sawtooth', 0.12, 0, 45);
    tone(140, 0.45, 'square', 0.08, 0.08, 30);
    noise(0.3, 0.12);
  },
  revive(): void {
    tone(392, 0.1, 'sine', 0.08);
    tone(523, 0.12, 'sine', 0.08, 0.08);
    tone(659, 0.16, 'sine', 0.09, 0.16);
    tone(784, 0.22, 'triangle', 0.07, 0.24);
  },
  pickup(): void {
    tone(880, 0.06, 'square', 0.07);
    tone(1318, 0.08, 'square', 0.06, 0.06);
  },
  potion(): void {
    tone(380, 0.14, 'sine', 0.12, 0, 720);
  },
  step(): void {
    noise(0.04, 0.035);
  },
  stairs(): void {
    tone(620, 0.3, 'square', 0.09, 0, 130);
  },
  victory(): void {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.09, i * 0.12));
  },
  gameover(): void {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, 'square', 0.09, i * 0.16));
  },
  equip(cursed = false): void {
    if (cursed) {
      // A dissonant downward sting as the curse binds, not the normal click.
      tone(220, 0.3, 'sawtooth', 0.065, 0, 55);
      tone(311, 0.24, 'square', 0.045, 0, 78);
      tone(110, 0.18, 'sine', 0.08, 0.12, 55);
      return;
    }
    tone(1000, 0.04, 'square', 0.045);
  },
  // Two wands burn together: a crackle, the two wands sliding into each other
  // on opposite pitch glides, then a bright chime as the merged wand appears.
  // The chime lands after the ~280ms slide, matching the merge animation.
  wandFusion(): void {
    noise(0.26, 0.09);
    tone(240, 0.3, 'sawtooth', 0.045, 0, 140);
    tone(392, 0.26, 'square', 0.05, 0, 523);
    tone(523, 0.26, 'square', 0.05, 0, 349);
    tone(784, 0.09, 'square', 0.065, 0.28);
    tone(1046, 0.12, 'square', 0.055, 0.3);
    tone(1318, 0.16, 'sine', 0.045, 0.33);
  },
  levelUp(): void {
    [440, 554, 659, 880].forEach((f, i) => tone(f, 0.12, 'square', 0.09, i * 0.09));
  },
  // Spending a talent point is a small, bright sparkle climbing a scale,
  // deliberately lighter than the level-up fanfare it is often heard beside.
  talent(): void {
    tone(523, 0.08, 'square', 0.05, 0, 784);
    tone(784, 0.1, 'triangle', 0.08, 0.06);
    tone(1175, 0.16, 'sine', 0.07, 0.12);
    tone(1568, 0.2, 'sine', 0.045, 0.18);
  },
};

// ---------------------------------------------------------------------------
// Music engine
// ---------------------------------------------------------------------------

type MusicBus = {
  input: GainNode;
  master: GainNode;
  reverb: ConvolverNode;
  wet: GainNode;
};

const MUSIC_LOOKAHEAD = 0.12; // seconds
const MUSIC_TICK_MS = 25;

let musicBus: MusicBus | undefined;
let musicVolume = 0.55;
let musicMuted = false;
let musicDucked = false;
let musicStart: Promise<void> | undefined;
let schedulerTimer: number | undefined;
let noteProvider: ((from: number, to: number) => MusicNoteEvent[]) | undefined;

// A decaying noise impulse response gives the samples a concert-hall tail.
// This is room reverb, not instrument synthesis.
function makeImpulse(c: AudioContext): AudioBuffer {
  const length = Math.floor(c.sampleRate * 1.6);
  const buffer = c.createBuffer(2, length, c.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3);
    }
  }
  return buffer;
}

function createMusicBus(c: AudioContext): MusicBus {
  const input = c.createGain();
  const master = c.createGain();
  const reverb = c.createConvolver();
  const wet = c.createGain();
  reverb.buffer = makeImpulse(c);
  wet.gain.value = 0.22;
  input.connect(master); // dry signal
  input.connect(reverb);
  reverb.connect(wet);
  wet.connect(master);
  master.connect(c.destination);
  return { input, master, reverb, wet };
}

function applyMusicGain(): void {
  if (!musicBus || !ctx) return;
  const target = musicMuted ? 0 : musicVolume * (musicDucked ? 0.5 : 1);
  musicBus.master.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
}

function schedulerTick(): void {
  if (!ctx || !noteProvider) return;
  const from = ctx.currentTime;
  for (const event of noteProvider(from, from + MUSIC_LOOKAHEAD)) {
    playNote(event.instrument, event.note, event.time, {
      duration: event.duration,
      gain: event.gain,
    });
  }
}

function startScheduler(): void {
  if (schedulerTimer !== undefined) return;
  schedulerTick();
  schedulerTimer = window.setInterval(schedulerTick, MUSIC_TICK_MS);
}

function stopScheduler(): void {
  if (schedulerTimer !== undefined) {
    window.clearInterval(schedulerTimer);
    schedulerTimer = undefined;
  }
}

/** Override the note provider (used by dev spikes and tests). */
export function setMusicNoteProvider(
  provider: ((from: number, to: number) => MusicNoteEvent[]) | undefined
): void {
  noteProvider = provider;
}

/** Feed the current game state to the composer and keep the scheduler supplied. */
export function updateMusic(state: MusicState): void {
  setMusicState(state);
  if (!noteProvider) noteProvider = musicProvider;
}

/** Lazy-start music. A load failure calls `onError` and resolves — never silent. */
export function startMusic(onError?: (message: string) => void): Promise<void> {
  if (musicStart) return musicStart;
  const c = getCtx();
  if (!c) {
    onError?.('Audio is not available in this browser.');
    return Promise.resolve();
  }
  musicStart = (async () => {
    try {
      musicBus = createMusicBus(c);
      applyMusicGain();
      await loadInstruments(c, musicBus.input);
      startScheduler();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stopMusic();
      onError?.(`Music could not be loaded: ${message}`);
    }
  })();
  return musicStart;
}

/** Stop every note and tear down the bus. Safe to call more than once. */
export function stopMusic(): void {
  stopScheduler();
  noteProvider = undefined;
  resetMusicComposer();
  stopAllInstruments();
  if (musicBus && ctx) {
    musicBus.master.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.input.disconnect();
    musicBus.reverb.disconnect();
    musicBus.wet.disconnect();
    musicBus.master.disconnect();
  }
  musicBus = undefined;
  musicStart = undefined;
  musicDucked = false;
}

/** Lower the music (not the SFX) while a modal is open. */
export function setMusicDucked(ducked: boolean): void {
  if (musicDucked === ducked) return;
  musicDucked = ducked;
  applyMusicGain();
}

export function setMusicMuted(m: boolean): void {
  musicMuted = m;
  applyMusicGain();
}

export function setMusicVolume(volume: number): void {
  musicVolume = Math.max(0, Math.min(1, volume));
  applyMusicGain();
}
