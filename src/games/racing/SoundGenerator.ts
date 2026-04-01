/**
 * SoundGenerator - Generates simple beep tones using Web Audio API
 * No sound files needed - all sounds are generated programmatically
 */
export class SoundGenerator {
  private static isMuted: boolean = false
  private audioContext: AudioContext | null = null
  private crashBuffers: AudioBuffer[] = []
  private activeCrashSounds: number = 0
  private maxConcurrentCrashSounds: number = 3

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
          // Pre-generate crash sound buffers for efficiency
          this.preGenerateCrashBuffers()
        } catch (error) {
          console.warn('Failed to create AudioContext:', error)
          return null
        }
      }
    }
    return this.audioContext
  }

  /**
   * Pre-generate multiple crash sound buffers for variety and efficiency
   * Creates 10 variations so crashes have more variety in the noise content
   */
  private preGenerateCrashBuffers(): void {
    const ctx = this.audioContext
    if (!ctx) return

    const bufferSize = ctx.sampleRate * 0.5 // 0.5 seconds duration
    const numVariations = 10

    for (let v = 0; v < numVariations; v++) {
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Fill buffer with random noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }

      this.crashBuffers.push(buffer)
    }
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

    // Resume audio context if it's suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Ignore errors - audio will work after user interaction
      })
    }

    try {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine' // Sine wave for smooth beep

      // Create a smooth envelope: quick attack, smooth release
      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.01) // Quick attack
      gainNode.gain.linearRampToValueAtTime(0, now + duration) // Smooth release

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

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { })
    }

    try {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sine'
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

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { })
    }

    try {
      // Use pre-generated buffer (randomly select one for variety)
      if (this.crashBuffers.length === 0) {
        // Fallback: generate on the fly if buffers weren't pre-generated
        const bufferSize = ctx.sampleRate * 0.5
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1
        }
        this.crashBuffers.push(buffer)
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
      gain.gain.setValueAtTime(initialVolume, now)
      gain.gain.linearRampToValueAtTime(0, now + decayTime) // Linear = sharper, less echo

      // Track active sounds and clean up when done
      this.activeCrashSounds++
      noise.onended = () => {
        this.activeCrashSounds--
        // Disconnect nodes to allow garbage collection
        noise.disconnect()
        highpass.disconnect()
        filter.disconnect()
        gain.disconnect()
      }

      noise.start()
    } catch (error) {
      console.warn('Failed to play crash sound:', error)
      this.activeCrashSounds--
    }
  }

  /**
   * Play a mine explosion sound - deep boom with rumble and debris.
   */
  playExplosionSound(volume: number = 0.9): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

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
      const boomCurve = new Float32Array(512)
      for (let i = 0; i < 512; i++) {
        const x = (i * 2) / 512 - 1
        boomCurve[i] = Math.tanh(x * 4)
      }
      boomDistortion.curve = boomCurve
      boomGain.gain.setValueAtTime(volume, now)
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
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
      const curve = new Float32Array(512)
      for (let i = 0; i < 512; i++) {
        const x = (i * 2) / 512 - 1
        curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.15)
      }
      distortion.curve = curve
      punchGain.gain.setValueAtTime(volume * 0.7, now)
      punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
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
      const crackleCurve = new Float32Array(256)
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1
        crackleCurve[i] = Math.sign(x) * (1 - Math.exp(-Math.abs(x) * 8))
      }
      crackleDistortion.curve = crackleCurve
      crackleGain.gain.setValueAtTime(volume * 0.4, now)
      crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      crackleOsc.connect(crackleDistortion)
      crackleDistortion.connect(crackleGain)
      crackleGain.connect(masterGain)
      crackleOsc.start(now)
      crackleOsc.stop(now + 0.4)

      // Layer 4: Loud filtered noise for debris / shrapnel
      const noiseLen = Math.floor(ctx.sampleRate * 1.4)
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
      const noiseData = noiseBuf.getChannelData(0)
      for (let i = 0; i < noiseLen; i++) {
        // Mix white noise with crackly impulses
        const impulse = Math.random() < 0.03 ? (Math.random() * 2 - 1) * 3 : 0
        noiseData[i] = (Math.random() * 2 - 1) + impulse
      }
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuf
      const noiseDistortion = ctx.createWaveShaper()
      const noiseDCurve = new Float32Array(256)
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1
        noiseDCurve[i] = Math.tanh(x * 3)
      }
      noiseDistortion.curve = noiseDCurve
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.setValueAtTime(6000, now)
      noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 1.2)
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(volume * 0.7, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4)
      noiseSrc.connect(noiseDistortion)
      noiseDistortion.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(masterGain)
      noiseSrc.start(now)
      noiseSrc.stop(now + 1.4)

      // Cleanup
      const cleanup = () => {
        boomOsc.disconnect()
        boomDistortion.disconnect()
        boomGain.disconnect()
        punchOsc.disconnect()
        punchGain.disconnect()
        distortion.disconnect()
        crackleOsc.disconnect()
        crackleDistortion.disconnect()
        crackleGain.disconnect()
        noiseSrc.disconnect()
        noiseDistortion.disconnect()
        noiseFilter.disconnect()
        noiseGain.disconnect()
        masterGain.disconnect()
      }
      noiseSrc.onended = cleanup
    } catch (error) {
      console.warn('Failed to play explosion sound:', error)
    }
  }

  /**
   * Play a short cheerful sound when any car crosses the finish line.
   */
  playFinishSound(volume: number = 0.35): void {
    if (SoundGenerator.isMuted) return
    const ctx = this.getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
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
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
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
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    try {
      const now = ctx.currentTime

      // Short noise burst through bandpass — the metallic "thwack"
      const noiseLen = Math.floor(ctx.sampleRate * 0.015)
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
      const noiseData = noiseBuf.getChannelData(0)
      for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = Math.random() * 2 - 1
      }
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuf

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800 + Math.random() * 400
      filter.Q.value = 2

      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(volume, now)
      noiseGain.gain.linearRampToValueAtTime(0, now + 0.015)

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
      oscGain.gain.setValueAtTime(volume * 0.5, now)
      oscGain.gain.linearRampToValueAtTime(0, now + 0.03)
      osc.connect(oscGain)
      oscGain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.03)

      osc.onended = () => {
        noiseSrc.disconnect()
        filter.disconnect()
        noiseGain.disconnect()
        osc.disconnect()
        oscGain.disconnect()
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
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    try {
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const oscGain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(1200 + Math.random() * 200, now)
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.06)
      oscGain.gain.setValueAtTime(volume, now)
      oscGain.gain.linearRampToValueAtTime(0, now + 0.06)
      osc.connect(oscGain)
      oscGain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.06)

      osc.onended = () => {
        osc.disconnect()
        oscGain.disconnect()
      }
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
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}) }
    try {
      const now = ctx.currentTime
      const freq = 800 + progress * 600 // 800→1400 Hz
      const vol = volume + progress * 0.15
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.03)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.03)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
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
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}) }
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(150, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08)
      gain.gain.setValueAtTime(volume, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.08)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
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
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}) }
    try {
      const now = ctx.currentTime

      // Tone component
      const osc = ctx.createOscillator()
      const oscGain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.06)
      oscGain.gain.setValueAtTime(volume, now)
      oscGain.gain.linearRampToValueAtTime(0, now + 0.06)
      osc.connect(oscGain)
      oscGain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.06)

      // Tiny noise burst
      const noiseLen = Math.floor(ctx.sampleRate * 0.01)
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuf
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(volume * 0.5, now)
      noiseGain.gain.linearRampToValueAtTime(0, now + 0.01)
      noiseSrc.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noiseSrc.start(now)
      noiseSrc.stop(now + 0.01)

      osc.onended = () => {
        osc.disconnect(); oscGain.disconnect()
        noiseSrc.disconnect(); noiseGain.disconnect()
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
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}) }
    try {
      const now = ctx.currentTime

      // Sine sweep for body
      const osc = ctx.createOscillator()
      const oscGain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1)
      oscGain.gain.setValueAtTime(volume, now)
      oscGain.gain.linearRampToValueAtTime(0, now + 0.1)
      osc.connect(oscGain)
      oscGain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.1)

      // Short noise burst for impact
      const noiseLen = Math.floor(ctx.sampleRate * 0.02)
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuf
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1500
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(volume * 0.6, now)
      noiseGain.gain.linearRampToValueAtTime(0, now + 0.02)
      noiseSrc.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noiseSrc.start(now)
      noiseSrc.stop(now + 0.02)

      osc.onended = () => {
        osc.disconnect(); oscGain.disconnect()
        noiseSrc.disconnect(); filter.disconnect(); noiseGain.disconnect()
      }
    } catch (e) {
      console.warn('Failed to play ball car hit sound:', e)
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
  }
}
