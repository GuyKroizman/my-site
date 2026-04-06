/**
 * SoundGenerator - Generates simple beep tones using Web Audio API
 * No sound files needed - all sounds are generated programmatically
 */
import {
  createDistortionCurve,
  createNoiseBuffer,
  createOscillatorGain,
  disconnectNodes,
  resumeAudioContext,
  scheduleExpFade,
  scheduleLinearFade,
} from './soundUtils'

export class SoundGenerator {
  private static isMuted: boolean = false
  private audioContext: AudioContext | null = null
  private crashBuffers: AudioBuffer[] = []
  private activeCrashSounds: number = 0
  private maxConcurrentCrashSounds: number = 3

  // Pre-generated explosion sound data
  private explosionNoiseBuffers: AudioBuffer[] = []
  private boomCurve: Float32Array | null = null
  private punchCurve: Float32Array | null = null
  private crackleCurve: Float32Array | null = null
  private noiseDCurve: Float32Array | null = null
  private activeExplosionSounds: number = 0
  private maxConcurrentExplosionSounds: number = 3

  // Pre-generated turbo boost sound data
  private turboNoiseBuffer: AudioBuffer | null = null
  private turboCurve: Float32Array | null = null

  // Pre-generated mine drop sound data
  private mineDropNoiseBuffer: AudioBuffer | null = null

  // Pre-generated weapon switch click
  private weaponSwitchBuffer: AudioBuffer | null = null

  /**
   * Toggle mute state for all SoundGenerator instances
   */
  static toggleMute(): boolean {
    this.isMuted = !this.isMuted
    return this.isMuted
  }

  /**
   * Set mute state
   */
  static setMuted(muted: boolean): void {
    this.isMuted = muted
  }

  /**
   * Get current mute state
   */
  static getMuted(): boolean {
    return this.isMuted
  }

  /**
   * Get or create the AudioContext
   * Lazy initialization - only creates context when first sound is played
   */
  private getAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        try {
          this.audioContext = new AudioContextClass()
          // Pre-generate sound buffers for efficiency
          this.preGenerateBuffers()
        } catch (error) {
          console.warn('Failed to create AudioContext:', error)
          return null
        }
      }
    }
    return this.audioContext
  }

  /**
   * Pre-generate all sound buffers (crash + explosion) for efficiency.
   * Called once when AudioContext is first created.
   */
  private preGenerateBuffers(): void {
    const ctx = this.audioContext
    if (!ctx) return

    // --- Crash buffers (10 variations) ---
    const crashBufSize = ctx.sampleRate * 0.5
    for (let v = 0; v < 10; v++) {
      this.crashBuffers.push(
        createNoiseBuffer(ctx, crashBufSize, () => Math.random() * 2 - 1)
      )
    }

    // --- Explosion buffers & distortion curves ---
    // Noise buffers (3 variations for variety)
    const noiseLen = Math.floor(ctx.sampleRate * 1.4)
    for (let v = 0; v < 3; v++) {
      this.explosionNoiseBuffers.push(
        createNoiseBuffer(ctx, noiseLen, () => {
          const impulse = Math.random() < 0.03 ? (Math.random() * 2 - 1) * 3 : 0
          return (Math.random() * 2 - 1) + impulse
        })
      )
    }

    // Boom distortion curve
    this.boomCurve = createDistortionCurve(512, (x) => Math.tanh(x * 4))

    // Punch distortion curve
    this.punchCurve = createDistortionCurve(512, (x) => Math.sign(x) * Math.pow(Math.abs(x), 0.15))

    // Crackle distortion curve
    this.crackleCurve = createDistortionCurve(256, (x) => Math.sign(x) * (1 - Math.exp(-Math.abs(x) * 8)))

    // Noise distortion curve
    this.noiseDCurve = createDistortionCurve(256, (x) => Math.tanh(x * 3))

    // --- Turbo boost buffer: shaped noise for whoosh ---
    const turboLen = Math.floor(ctx.sampleRate * 0.8)
    this.turboNoiseBuffer = createNoiseBuffer(ctx, turboLen, (i) => {
      const t = i / turboLen
      const env = t < 0.05 ? t / 0.05 : t < 0.6 ? 1.0 : 1.0 - (t - 0.6) / 0.4
      return (Math.random() * 2 - 1) * env
    })

    // Turbo distortion curve — mild saturation for a breathy whoosh
    this.turboCurve = createDistortionCurve(256, (x) => Math.tanh(x * 2))

    // --- Mine drop buffer: short metallic clunk noise ---
    const mineDropLen = Math.floor(ctx.sampleRate * 0.15)
    this.mineDropNoiseBuffer = createNoiseBuffer(ctx, mineDropLen, (i) => {
      const t = i / mineDropLen
      const env = t < 0.02 ? t / 0.02 : Math.exp(-t * 20)
      return (Math.random() * 2 - 1) * env
    })

    // --- Weapon switch click buffer ---
    const switchLen = Math.floor(ctx.sampleRate * 0.03)
    this.weaponSwitchBuffer = createNoiseBuffer(ctx, switchLen, (i) => {
      const t = i / switchLen
      const env = t < 0.1 ? t / 0.1 : Math.exp(-t * 40)
      return (Math.random() * 2 - 1) * env
    })
  }

  /**
   * Play a beep tone at the specified frequency and duration
   * @param frequency - Frequency in Hz (e.g., 250 for low, 700 for high)
   * @param duration - Duration in seconds (e.g., 0.1 for short beep)
   * @param volume - Volume from 0.0 to 1.0 (default: 0.3)
   */
  playBeep(frequency: number, duration: number, volume: number = 0.3): void {
    if (SoundGenerator.isMuted) {
      return
    }
    const ctx = this.getAudioContext()
    if (!ctx) {
      // Silently fail if audio is not supported
      return
    }

    resumeAudioContext(ctx)

    try {
      const { oscillator, gain: gainNode } = createOscillatorGain(ctx, 'sine', ctx.destination)
      oscillator.frequency.value = frequency

      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.01)
      gainNode.gain.linearRampToValueAtTime(0, now + duration)

      oscillator.start(now)
      oscillator.stop(now + duration)
    } catch (error) {
      // Silently fail - don't break the game if audio fails
      console.warn('Failed to play beep:', error)
    }
  }

  /**
   * Play an ascending tone (two beeps going up in pitch)
   * Useful for "Go!" sound
   */
  playAscendingTone(startFreq: number, endFreq: number, duration: number, volume: number = 0.8): void {
    if (SoundGenerator.isMuted) {
      return
    }
    const ctx = this.getAudioContext()
    if (!ctx) {
      return
    }

    resumeAudioContext(ctx)

    try {
      const { oscillator, gain: gainNode } = createOscillatorGain(ctx, 'sine', ctx.destination)
      oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime)
      oscillator.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration)

      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.01)
      gainNode.gain.linearRampToValueAtTime(0, now + duration)

      oscillator.start(now)
      oscillator.stop(now + duration)
    } catch (error) {
      console.warn('Failed to play ascending tone:', error)
    }
  }

  playCrashSound(volume?: number): void {
    if (SoundGenerator.isMuted) {
      return
    }
    const ctx = this.getAudioContext()
    if (!ctx) {
      return
    }

    // Limit concurrent sounds to prevent audio glitches
    if (this.activeCrashSounds >= this.maxConcurrentCrashSounds) {
      return
    }

    resumeAudioContext(ctx)

    try {
      if (this.crashBuffers.length === 0) {
        this.crashBuffers.push(
          createNoiseBuffer(ctx, ctx.sampleRate * 0.5, () => Math.random() * 2 - 1)
        )
      }

      const buffer = this.crashBuffers[Math.floor(Math.random() * this.crashBuffers.length)]
      const noise = ctx.createBufferSource()
      noise.buffer = buffer

      // Car crash sounds are harsh and metallic - use bandpass to emphasize mid/high frequencies
      // Randomize center frequency for variety (800-2500 Hz) - metallic crash range
      const centerFreq = 800 + Math.random() * 1700
      
      // Low Q to avoid ringing/echo - car crashes are sharp, not resonant
      const filterQ = 0.5 + Math.random() * 0.5 // 0.5-1.0 range (much lower than before)

      // Bandpass filter to emphasize metallic crash frequencies
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = centerFreq
      filter.Q.value = filterQ

      // Highpass filter to remove low rumble and make it more metallic
      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 300 + Math.random() * 200 // 300-500 Hz
      highpass.Q.value = 1

      const gain = ctx.createGain()

      // Chain: noise -> highpass -> bandpass -> gain
      noise.connect(highpass)
      highpass.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      // Use provided volume, or randomize for variety at lower level so bumps aren't overpowering
      const initialVolume = volume !== undefined ? volume : 0.2 + Math.random() * 0.15
      
      // Much shorter, sharper decay for car crash (0.08-0.2 seconds)
      // Car crashes are abrupt, not sustained
      const decayTime = 0.08 + Math.random() * 0.12

      // Sharp, abrupt envelope - no smooth exponential ramp (that causes echo)
      // Use linear ramp for more abrupt cutoff
      const now = ctx.currentTime
      scheduleLinearFade(gain, now, initialVolume, decayTime)

      this.activeCrashSounds++
      noise.onended = () => {
        this.activeCrashSounds--
        disconnectNodes(noise, highpass, filter, gain)
      }

      noise.start()
    } catch (error) {
      console.warn('Failed to play crash sound:', error)
      this.activeCrashSounds--
    }
  }

  /**
   * Play a mine explosion sound - deep boom with rumble and debris.
   * Uses pre-generated buffers and distortion curves for performance.
   */
  playExplosionSound(volume: number = 0.9): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    if (this.activeExplosionSounds >= this.maxConcurrentExplosionSounds) return

    resumeAudioContext(ctx)

    try {
      const now = ctx.currentTime
      const masterGain = ctx.createGain()
      masterGain.connect(ctx.destination)

      // Layer 1: Deep saturated boom with sub-bass
      const boomOsc = ctx.createOscillator()
      const boomGain = ctx.createGain()
      const boomDistortion = ctx.createWaveShaper()
      boomOsc.type = 'sawtooth'
      boomOsc.frequency.setValueAtTime(60, now)
      boomOsc.frequency.exponentialRampToValueAtTime(15, now + 1.2)
      boomDistortion.curve = this.boomCurve as unknown as Float32Array<ArrayBuffer>
      scheduleExpFade(boomGain, now, volume, 1.2)
      boomOsc.connect(boomDistortion)
      boomDistortion.connect(boomGain)
      boomGain.connect(masterGain)
      boomOsc.start(now)
      boomOsc.stop(now + 1.2)

      // Layer 2: Heavily distorted mid crunch
      const punchOsc = ctx.createOscillator()
      const punchGain = ctx.createGain()
      const distortion = ctx.createWaveShaper()
      punchOsc.type = 'sawtooth'
      punchOsc.frequency.setValueAtTime(250, now)
      punchOsc.frequency.exponentialRampToValueAtTime(30, now + 0.6)
      distortion.curve = this.punchCurve as unknown as Float32Array<ArrayBuffer>
      scheduleExpFade(punchGain, now, volume * 0.7, 0.6)
      punchOsc.connect(distortion)
      distortion.connect(punchGain)
      punchGain.connect(masterGain)
      punchOsc.start(now)
      punchOsc.stop(now + 0.6)

      // Layer 3: Secondary crackle oscillator for grit
      const crackleOsc = ctx.createOscillator()
      const crackleGain = ctx.createGain()
      const crackleDistortion = ctx.createWaveShaper()
      crackleOsc.type = 'square'
      crackleOsc.frequency.setValueAtTime(150, now)
      crackleOsc.frequency.exponentialRampToValueAtTime(20, now + 0.4)
      crackleDistortion.curve = this.crackleCurve as unknown as Float32Array<ArrayBuffer>
      scheduleExpFade(crackleGain, now, volume * 0.4, 0.4)
      crackleOsc.connect(crackleDistortion)
      crackleDistortion.connect(crackleGain)
      crackleGain.connect(masterGain)
      crackleOsc.start(now)
      crackleOsc.stop(now + 0.4)

      // Layer 4: Pre-generated noise for debris / shrapnel
      const noiseBuf = this.explosionNoiseBuffers[Math.floor(Math.random() * this.explosionNoiseBuffers.length)]
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuf
      const noiseDistortion = ctx.createWaveShaper()
      noiseDistortion.curve = this.noiseDCurve as unknown as Float32Array<ArrayBuffer>
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.setValueAtTime(6000, now)
      noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 1.2)
      const noiseGain = ctx.createGain()
      scheduleExpFade(noiseGain, now, volume * 0.7, 1.4)
      noiseSrc.connect(noiseDistortion)
      noiseDistortion.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(masterGain)
      noiseSrc.start(now)
      noiseSrc.stop(now + 1.4)

      this.activeExplosionSounds++
      const cleanup = () => {
        this.activeExplosionSounds--
        disconnectNodes(
          boomOsc, boomDistortion, boomGain,
          punchOsc, punchGain, distortion,
          crackleOsc, crackleDistortion, crackleGain,
          noiseSrc, noiseDistortion, noiseFilter, noiseGain,
          masterGain
        )
      }
      noiseSrc.onended = cleanup
    } catch (error) {
      console.warn('Failed to play explosion sound:', error)
      this.activeExplosionSounds--
    }
  }

  /**
   * Play a short cheerful sound when any car crosses the finish line.
   */
  playFinishSound(volume: number = 0.35): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      // Two-note ascending chime (finish line crossed)
      this.playBeep(523, 0.12, volume) // C5
      setTimeout(() => {
        this.playBeep(659, 0.15, volume) // E5
      }, 120)
    } catch (error) {
      console.warn('Failed to play finish sound:', error)
    }
  }

  /**
   * Play a short sad sound when the player finishes but does not advance to the next level.
   */
  playSadFinishSound(volume: number = 0.35): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      // Descending minor third - "sad" resolution
      this.playBeep(392, 0.15, volume)  // G4
      setTimeout(() => {
        this.playBeep(330, 0.25, volume) // E4
      }, 140)
    } catch (error) {
      console.warn('Failed to play sad finish sound:', error)
    }
  }

  /**
   * Play a short metallic thwack when a bullet hits a car.
   */
  playBulletImpact(volume: number = 0.12): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime

      // Short noise burst through bandpass — the metallic "thwack"
      const noiseLen = Math.floor(ctx.sampleRate * 0.015)
      const noiseBuf = createNoiseBuffer(ctx, noiseLen, () => Math.random() * 2 - 1)
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuf

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800 + Math.random() * 400
      filter.Q.value = 2

      const noiseGain = ctx.createGain()
      scheduleLinearFade(noiseGain, now, volume, 0.015)

      noiseSrc.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noiseSrc.start(now)
      noiseSrc.stop(now + 0.015)

      // Brief pitch-drop tone for body
      const osc = ctx.createOscillator()
      const oscGain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.03)
      scheduleLinearFade(oscGain, now, volume * 0.5, 0.03)
      osc.connect(oscGain)
      oscGain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.03)

      osc.onended = () => {
        disconnectNodes(noiseSrc, filter, noiseGain, osc, oscGain)
      }
    } catch (error) {
      console.warn('Failed to play bullet impact sound:', error)
    }
  }

  /**
   * Play a short laser-like pew sound when a bullet is fired.
   */
  playBulletShoot(volume: number = 0.08): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime

      const { oscillator: osc, gain: oscGain } = createOscillatorGain(ctx, 'square', ctx.destination)
      osc.frequency.setValueAtTime(1200 + Math.random() * 200, now)
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.06)
      scheduleLinearFade(oscGain, now, volume, 0.06)
      osc.start(now)
      osc.stop(now + 0.06)

      osc.onended = () => { disconnectNodes(osc, oscGain) }
    } catch (error) {
      console.warn('Failed to play bullet shoot sound:', error)
    }
  }

  /**
   * Play a short tick for the bomb countdown. Pitch and volume increase as progress (0→1) increases.
   */
  playBombTick(progress: number, volume: number = 0.15): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime
      const freq = 800 + progress * 600 // 800→1400 Hz
      const vol = volume + progress * 0.15
      const { oscillator: osc, gain } = createOscillatorGain(ctx, 'sine', ctx.destination)
      osc.frequency.value = freq
      scheduleLinearFade(gain, now, vol, 0.03)
      osc.start(now)
      osc.stop(now + 0.03)
      osc.onended = () => { disconnectNodes(osc, gain) }
    } catch (e) {
      console.warn('Failed to play bomb tick:', e)
    }
  }

  /**
   * Play a short rubbery bounce when the ball hits the ground.
   */
  playBallBounce(volume: number = 0.15): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime
      const { oscillator: osc, gain } = createOscillatorGain(ctx, 'sine', ctx.destination)
      osc.frequency.setValueAtTime(150, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08)
      scheduleLinearFade(gain, now, volume, 0.08)
      osc.start(now)
      osc.stop(now + 0.08)
      osc.onended = () => { disconnectNodes(osc, gain) }
    } catch (e) {
      console.warn('Failed to play ball bounce sound:', e)
    }
  }

  /**
   * Play a brief hollow knock when the ball hits a track wall.
   */
  playBallWallHit(volume: number = 0.12): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime

      const { oscillator: osc, gain: oscGain } = createOscillatorGain(ctx, 'sine', ctx.destination)
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.06)
      scheduleLinearFade(oscGain, now, volume, 0.06)
      osc.start(now)
      osc.stop(now + 0.06)

      const noiseLen = Math.floor(ctx.sampleRate * 0.01)
      const noiseBuf = createNoiseBuffer(ctx, noiseLen, () => Math.random() * 2 - 1)
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuf
      const noiseGain = ctx.createGain()
      scheduleLinearFade(noiseGain, now, volume * 0.5, 0.01)
      noiseSrc.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noiseSrc.start(now)
      noiseSrc.stop(now + 0.01)

      osc.onended = () => {
        disconnectNodes(osc, oscGain, noiseSrc, noiseGain)
      }
    } catch (e) {
      console.warn('Failed to play ball wall hit sound:', e)
    }
  }

  /**
   * Play a punchy kick when a car hits the ball.
   */
  playBallCarHit(volume: number = 0.2): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime

      const { oscillator: osc, gain: oscGain } = createOscillatorGain(ctx, 'sine', ctx.destination)
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1)
      scheduleLinearFade(oscGain, now, volume, 0.1)
      osc.start(now)
      osc.stop(now + 0.1)

      const noiseLen = Math.floor(ctx.sampleRate * 0.02)
      const noiseBuf = createNoiseBuffer(ctx, noiseLen, () => Math.random() * 2 - 1)
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuf
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1500
      const noiseGain = ctx.createGain()
      scheduleLinearFade(noiseGain, now, volume * 0.6, 0.02)
      noiseSrc.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noiseSrc.start(now)
      noiseSrc.stop(now + 0.02)

      osc.onended = () => {
        disconnectNodes(osc, oscGain, noiseSrc, filter, noiseGain)
      }
    } catch (e) {
      console.warn('Failed to play ball car hit sound:', e)
    }
  }

  /**
   * Play a rushing whoosh sound for the turbo boost activation.
   * Uses pre-generated noise buffer filtered to sound like a jet burst.
   */
  playTurboBoost(volume: number = 0.25): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime

      // Layer 1: Filtered noise whoosh (pre-generated buffer)
      if (this.turboNoiseBuffer) {
        const noiseSrc = ctx.createBufferSource()
        noiseSrc.buffer = this.turboNoiseBuffer

        const bandpass = ctx.createBiquadFilter()
        bandpass.type = 'bandpass'
        bandpass.frequency.setValueAtTime(2000, now)
        bandpass.frequency.exponentialRampToValueAtTime(800, now + 0.6)
        bandpass.Q.value = 1.5

        const distortion = ctx.createWaveShaper()
        distortion.curve = this.turboCurve as unknown as Float32Array<ArrayBuffer>

        const noiseGain = ctx.createGain()
        noiseGain.gain.setValueAtTime(volume, now)
        noiseGain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.3)
        noiseGain.gain.linearRampToValueAtTime(0, now + 0.7)

        noiseSrc.connect(bandpass)
        bandpass.connect(distortion)
        distortion.connect(noiseGain)
        noiseGain.connect(ctx.destination)
        noiseSrc.start(now)
        noiseSrc.stop(now + 0.7)

        noiseSrc.onended = () => {
          disconnectNodes(noiseSrc, bandpass, distortion, noiseGain)
        }
      }

      const { oscillator: osc, gain: oscGain } = createOscillatorGain(ctx, 'sawtooth', ctx.destination)
      osc.frequency.setValueAtTime(120, now)
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.15)
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.5)
      oscGain.gain.setValueAtTime(volume * 0.3, now)
      oscGain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.3)
      oscGain.gain.linearRampToValueAtTime(0, now + 0.5)
      osc.start(now)
      osc.stop(now + 0.5)

      osc.onended = () => { disconnectNodes(osc, oscGain) }
    } catch (e) {
      console.warn('Failed to play turbo boost sound:', e)
    }
  }

  /**
   * Play a metallic clunk/thud for dropping a mine behind the car.
   * Uses pre-generated noise buffer for the impact texture.
   */
  playMineDrop(volume: number = 0.2): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime

      const { oscillator: osc, gain: oscGain } = createOscillatorGain(ctx, 'sine', ctx.destination)
      osc.frequency.setValueAtTime(180, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12)
      scheduleLinearFade(oscGain, now, volume, 0.12)
      osc.start(now)
      osc.stop(now + 0.12)

      // Layer 2: Metallic noise burst (pre-generated buffer)
      if (this.mineDropNoiseBuffer) {
        const noiseSrc = ctx.createBufferSource()
        noiseSrc.buffer = this.mineDropNoiseBuffer

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1200 + Math.random() * 600
        filter.Q.value = 2

        const noiseGain = ctx.createGain()
        scheduleLinearFade(noiseGain, now, volume * 0.7, 0.1)

        noiseSrc.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(ctx.destination)
        noiseSrc.start(now)
        noiseSrc.stop(now + 0.1)

        noiseSrc.onended = () => {
          disconnectNodes(noiseSrc, filter, noiseGain)
        }
      }

      const { oscillator: click, gain: clickGain } = createOscillatorGain(ctx, 'square', ctx.destination)
      click.frequency.value = 2500
      scheduleLinearFade(clickGain, now, volume * 0.15, 0.008)
      click.start(now)
      click.stop(now + 0.008)

      osc.onended = () => {
        disconnectNodes(osc, oscGain, click, clickGain)
      }
    } catch (e) {
      console.warn('Failed to play mine drop sound:', e)
    }
  }

  /**
   * Play a short click/pop for weapon switching.
   */
  playWeaponSwitch(volume: number = 0.15): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    resumeAudioContext(ctx)
    try {
      const now = ctx.currentTime

      const { oscillator: osc, gain: oscGain } = createOscillatorGain(ctx, 'sine', ctx.destination)
      osc.frequency.setValueAtTime(1800, now)
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04)
      scheduleLinearFade(oscGain, now, volume, 0.04)
      osc.start(now)
      osc.stop(now + 0.04)

      // Noise click from pre-generated buffer
      if (this.weaponSwitchBuffer) {
        const noiseSrc = ctx.createBufferSource()
        noiseSrc.buffer = this.weaponSwitchBuffer
        const filter = ctx.createBiquadFilter()
        filter.type = 'highpass'
        filter.frequency.value = 3000
        const noiseGain = ctx.createGain()
        scheduleLinearFade(noiseGain, now, volume * 0.5, 0.025)
        noiseSrc.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(ctx.destination)
        noiseSrc.start(now)
        noiseSrc.stop(now + 0.025)

        noiseSrc.onended = () => {
          disconnectNodes(noiseSrc, filter, noiseGain)
        }
      }

      osc.onended = () => { disconnectNodes(osc, oscGain) }
    } catch (e) {
      console.warn('Failed to play weapon switch sound:', e)
    }
  }

  /**
   * Clean up audio context
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // Ignore errors during cleanup
      })
      this.audioContext = null
    }
    this.crashBuffers = []
    this.activeCrashSounds = 0
    this.explosionNoiseBuffers = []
    this.boomCurve = null
    this.punchCurve = null
    this.crackleCurve = null
    this.noiseDCurve = null
    this.activeExplosionSounds = 0
    this.turboNoiseBuffer = null
    this.turboCurve = null
    this.mineDropNoiseBuffer = null
    this.weaponSwitchBuffer = null
  }
}
