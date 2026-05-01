import {
  createDistortionCurve,
  createNoiseBuffer,
  createOscillatorGain,
  resumeAudioContext,
  scheduleExpFade,
} from '../racing/soundUtils'

const MAX_CONCURRENT = 4

export class SpawnBoxHitSound {
  private ctx: AudioContext | null = null
  private noiseBuffer: AudioBuffer | null = null
  private thumpCurve: Float32Array | null = null
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
        Math.floor(ctx.sampleRate * 0.28),
        (index) => {
          const t = index / Math.max(1, Math.floor(ctx.sampleRate * 0.28))
          const envelope = Math.exp(-t * 8)
          return (Math.random() * 2 - 1) * envelope
        },
      )
      this.thumpCurve = createDistortionCurve(256, (x) => Math.tanh(x * 3.2))
    } catch {
      this.ctx = null
      this.noiseBuffer = null
      this.thumpCurve = null
    }

    return this.ctx
  }

  prewarm(): void {
    this.ensureContext()
  }

  play(): void {
    if (this.activeSounds >= MAX_CONCURRENT) return

    const ctx = this.ensureContext()
    if (!ctx || !this.noiseBuffer || !this.thumpCurve) return

    resumeAudioContext(ctx)

    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.38
    master.connect(ctx.destination)

    this.activeSounds++
    const cleanup = () => {
      this.activeSounds = Math.max(0, this.activeSounds - 1)
      master.disconnect()
    }

    const shaper = ctx.createWaveShaper()
    const shaperCurve = new Float32Array(this.thumpCurve.length)
    shaperCurve.set(this.thumpCurve)
    shaper.curve = shaperCurve
    shaper.connect(master)

    const { oscillator: thump, gain: thumpGain } = createOscillatorGain(ctx, 'sine', shaper)
    thump.frequency.setValueAtTime(78, now)
    thump.frequency.exponentialRampToValueAtTime(36, now + 0.18)
    scheduleExpFade(thumpGain, now, 0.95, 0.2)
    thump.start(now)
    thump.stop(now + 0.22)

    const { oscillator: body, gain: bodyGain } = createOscillatorGain(ctx, 'sawtooth', master)
    body.frequency.setValueAtTime(120, now)
    body.frequency.exponentialRampToValueAtTime(52, now + 0.16)
    scheduleExpFade(bodyGain, now, 0.08, 0.16)
    body.start(now)
    body.stop(now + 0.18)

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(220, now)
    filter.Q.value = 0.6
    const noiseGain = ctx.createGain()
    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(master)
    scheduleExpFade(noiseGain, now, 0.22, 0.14)
    noise.start(now)
    noise.stop(now + 0.16)
    noise.onended = cleanup
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
    this.noiseBuffer = null
    this.thumpCurve = null
    this.activeSounds = 0
  }
}
