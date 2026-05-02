import {
  createNoiseBuffer,
  createOscillatorGain,
  resumeAudioContext,
  scheduleExpFade,
  scheduleLinearFade,
} from '../racing/soundUtils'

const MAX_CONCURRENT = 2

export class PlayerDamageSound {
  private ctx: AudioContext | null = null
  private noiseBuffer: AudioBuffer | null = null
  private activeSounds = 0

  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      return this.ctx
    }

    const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & {
      webkitAudioContext?: typeof AudioContext
    }).webkitAudioContext

    if (!AudioContextClass) {
      return null
    }

    try {
      this.ctx = new AudioContextClass()
      const ctx = this.ctx
      this.noiseBuffer = createNoiseBuffer(
        ctx,
        Math.floor(ctx.sampleRate * 0.16),
        (index) => {
          const t = index / Math.max(1, Math.floor(ctx.sampleRate * 0.16))
          return (Math.random() * 2 - 1) * Math.exp(-t * 11)
        },
      )
    } catch {
      this.ctx = null
      this.noiseBuffer = null
    }

    return this.ctx
  }

  prewarm(): void {
    this.ensureContext()
  }

  play(): void {
    if (this.activeSounds >= MAX_CONCURRENT) return

    const ctx = this.ensureContext()
    if (!ctx || !this.noiseBuffer) return

    resumeAudioContext(ctx)

    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.32
    master.connect(ctx.destination)

    this.activeSounds++
    const cleanup = () => {
      this.activeSounds = Math.max(0, this.activeSounds - 1)
      master.disconnect()
    }

    const { oscillator: tone, gain: toneGain } = createOscillatorGain(ctx, 'sawtooth', master)
    tone.frequency.setValueAtTime(460, now)
    tone.frequency.exponentialRampToValueAtTime(180, now + 0.12)
    scheduleExpFade(toneGain, now, 0.18, 0.13)
    tone.start(now)
    tone.stop(now + 0.14)

    const { oscillator: sting, gain: stingGain } = createOscillatorGain(ctx, 'square', master)
    sting.frequency.setValueAtTime(920, now)
    sting.frequency.exponentialRampToValueAtTime(420, now + 0.05)
    scheduleLinearFade(stingGain, now, 0.05, 0.05)
    sting.start(now)
    sting.stop(now + 0.06)

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(1300, now)
    noiseFilter.Q.value = 0.9
    const noiseGain = ctx.createGain()
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)
    scheduleExpFade(noiseGain, now, 0.12, 0.1)
    noise.start(now)
    noise.stop(now + 0.11)
    noise.onended = cleanup
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }

    this.noiseBuffer = null
    this.activeSounds = 0
  }
}
