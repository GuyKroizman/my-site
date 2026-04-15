import {
  resumeAudioContext,
  createNoiseBuffer,
  createOscillatorGain,
  scheduleExpFade,
  scheduleLinearFade,
} from '../racing/soundUtils'

export class GiantSound {
  private ctx: AudioContext | null = null
  private noiseBuffer: AudioBuffer | null = null

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.noiseBuffer = createNoiseBuffer(
        this.ctx,
        Math.floor(this.ctx.sampleRate * 0.5),
        () => Math.random() * 2 - 1,
      )
    }
    resumeAudioContext(this.ctx)
    return this.ctx
  }

  playHit(): void {
    const ctx = this.ensureContext()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)

    // Low thud
    const { oscillator: thud, gain: thudGain } = createOscillatorGain(ctx, 'sine', master)
    thud.frequency.setValueAtTime(80, now)
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.15)
    scheduleExpFade(thudGain, now, 0.8, 0.15)
    thud.start(now)
    thud.stop(now + 0.2)

    // Crunch noise
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer!
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 800
    bp.Q.value = 1.5
    const noiseGain = ctx.createGain()
    noise.connect(bp)
    bp.connect(noiseGain)
    noiseGain.connect(master)
    scheduleExpFade(noiseGain, now, 0.6, 0.12)
    noise.start(now)
    noise.stop(now + 0.15)

    noise.onended = () => master.disconnect()
  }

  playDeath(): void {
    const ctx = this.ensureContext()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.6
    master.connect(ctx.destination)

    // Deep rumble
    const { oscillator: rumble, gain: rumbleGain } = createOscillatorGain(ctx, 'sawtooth', master)
    rumble.frequency.setValueAtTime(60, now)
    rumble.frequency.exponentialRampToValueAtTime(20, now + 1.0)
    scheduleExpFade(rumbleGain, now, 0.7, 1.0)
    rumble.start(now)
    rumble.stop(now + 1.2)

    // Crumbling noise sweep
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer!
    noise.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2000, now)
    lp.frequency.exponentialRampToValueAtTime(200, now + 1.0)
    const noiseGain = ctx.createGain()
    noise.connect(lp)
    lp.connect(noiseGain)
    noiseGain.connect(master)
    scheduleExpFade(noiseGain, now, 0.5, 1.0)
    noise.start(now)
    noise.stop(now + 1.2)

    // Impact boom
    const { oscillator: boom, gain: boomGain } = createOscillatorGain(ctx, 'sine', master)
    boom.frequency.setValueAtTime(40, now)
    boom.frequency.exponentialRampToValueAtTime(15, now + 0.4)
    scheduleExpFade(boomGain, now, 1.0, 0.4)
    boom.start(now)
    boom.stop(now + 0.5)

    // High crack
    const { oscillator: crack, gain: crackGain } = createOscillatorGain(ctx, 'square', master)
    crack.frequency.value = 3000
    scheduleLinearFade(crackGain, now, 0.3, 0.06)
    crack.start(now)
    crack.stop(now + 0.08)

    noise.onended = () => master.disconnect()
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
    this.noiseBuffer = null
  }
}
