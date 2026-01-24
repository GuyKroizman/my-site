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

      // Use provided volume, or randomize for variety (0.49-0.7, which is 70% of original 0.7-1.0 range)
      const initialVolume = volume !== undefined ? volume : (0.7 + Math.random() * 0.3) * 0.7
      
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
