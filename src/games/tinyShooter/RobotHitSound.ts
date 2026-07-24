import {
  createNoiseBuffer,
  createOscillatorGain,
  resumeAudioContext,
  scheduleExpFade,
  scheduleLinearFade,
} from '../racing/soundUtils'

const MAX_CONCURRENT = 5

export class RobotHitSound {
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
        Math.floor(ctx.sampleRate * 0.12),
        (index) => {
          const t = index / Math.max(1, Math.floor(ctx.sampleRate * 0.12))
          return (Math.random() * 2 - 1) * Math.exp(-t * 14)
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
    master.gain.value = 0.24
    master.connect(ctx.destination)

    this.activeSounds++
    const cleanup = () => {
      this.activeSounds = Math.max(0, this.activeSounds - 1)
      master.disconnect()
    }

    const { oscillator: ping, gain: pingGain } = createOscillatorGain(ctx, 'square', master)
    ping.frequency.setValueAtTime(860, now)
    ping.frequency.exponentialRampToValueAtTime(420, now + 0.045)
    scheduleLinearFade(pingGain, now, 0.08, 0.045)
    ping.start(now)
    ping.stop(now + 0.055)

    const { oscillator: clank, gain: clankGain } = createOscillatorGain(ctx, 'triangle', master)
    clank.frequency.setValueAtTime(290, now)
    clank.frequency.exponentialRampToValueAtTime(150, now + 0.09)
    scheduleExpFade(clankGain, now, 0.1, 0.095)
    clank.start(now)
    clank.stop(now + 0.11)

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2200, now)
    filter.Q.value = 1.3
    const noiseGain = ctx.createGain()
    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(master)
    scheduleExpFade(noiseGain, now, 0.09, 0.07)
    noise.start(now)
    noise.stop(now + 0.08)
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
