// Procedural retro sound effects using the Web Audio API (no audio files).
// @ts-nocheck

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
    } catch (e) {
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
  hurt(): void {
    tone(150, 0.16, 'sawtooth', 0.11, 0, 65);
    noise(0.1, 0.08);
  },
  death(): void {
    tone(320, 0.28, 'square', 0.1, 0, 55);
    noise(0.18, 0.08);
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
  equip(): void {
    tone(1000, 0.04, 'square', 0.045);
  },
};
