import {
  resumeAudioContext,
  createNoiseBuffer,
  createDistortionCurve,
  createOscillatorGain,
  scheduleExpFade,
  scheduleLinearFade,
} from '../racing/soundUtils'

const MAX_CONCURRENT = 3

export class ShotSound {
  private ctx: AudioContext | null = null
  private noiseBuffer: AudioBuffer | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private distortionCurve: any = null
  private activeSounds = 0

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.noiseBuffer = createNoiseBuffer(
        this.ctx,
        Math.floor(this.ctx.sampleRate * 0.15),
        () => Math.random() * 2 - 1
      )
      this.distortionCurve = createDistortionCurve(256, (x) => Math.tanh(x * 5))
    }
    resumeAudioContext(this.ctx)
    return this.ctx
  }

  play(): void {
    if (this.activeSounds >= MAX_CONCURRENT) return

    const ctx = this.ensureContext()
    const now = ctx.currentTime
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0.4
    masterGain.connect(ctx.destination)

    this.activeSounds++
    const cleanup = () => {
      this.activeSounds = Math.max(0, this.activeSounds - 1)
      masterGain.disconnect()
    }

    // Layer 1: transient low pop
    const { oscillator: pop, gain: popGain } = createOscillatorGain(ctx, 'sine', masterGain)
    pop.frequency.setValueAtTime(150, now)
    pop.frequency.exponentialRampToValueAtTime(30, now + 0.08)
    scheduleExpFade(popGain, now, 0.8, 0.08)
    pop.start(now)
    pop.stop(now + 0.1)

    // Layer 2: noise burst through bandpass + distortion
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer!
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3000
    filter.Q.value = 0.8
    const distortion = ctx.createWaveShaper()
    distortion.curve = this.distortionCurve
    const noiseGain = ctx.createGain()
    noise.connect(filter)
    filter.connect(distortion)
    distortion.connect(noiseGain)
    noiseGain.connect(masterGain)
    scheduleExpFade(noiseGain, now, 0.5, 0.1)
    noise.start(now)
    noise.stop(now + 0.15)

    // Layer 3: mechanical click
    const { oscillator: click, gain: clickGain } = createOscillatorGain(ctx, 'square', masterGain)
    click.frequency.value = 4000
    scheduleLinearFade(clickGain, now, 0.2, 0.02)
    click.start(now)
    click.stop(now + 0.025)

    // Cleanup after longest layer finishes
    noise.onended = cleanup
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
    this.noiseBuffer = null
    this.distortionCurve = null
    this.activeSounds = 0
  }
}
