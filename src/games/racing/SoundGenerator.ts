/**
 * SoundGenerator - Generates simple beep tones using Web Audio API
 * No sound files needed - all sounds are generated programmatically
 */
export class SoundGenerator {
  private audioContext: AudioContext | null = null
  private crashBuffers: AudioBuffer[] = []
  private activeCrashSounds: number = 0
  private maxConcurrentCrashSounds: number = 3

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
   * Creates 5 variations so crashes don't all sound identical
   */
  private preGenerateCrashBuffers(): void {
    const ctx = this.audioContext
    if (!ctx) return

    const bufferSize = ctx.sampleRate * 0.5 // 0.5 seconds duration
    const numVariations = 5

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

  playCrashSound(): void {
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

      // Filter the noise to make it less harsh (Lowpass)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 800

      const gain = ctx.createGain()

      noise.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      // Percussive Envelope
      gain.gain.setValueAtTime(1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      // Track active sounds and clean up when done
      this.activeCrashSounds++
      noise.onended = () => {
        this.activeCrashSounds--
        // Disconnect nodes to allow garbage collection
        noise.disconnect()
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
