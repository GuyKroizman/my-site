/**
 * SoundGenerator - Generates simple beep tones using Web Audio API
 * No sound files needed - all sounds are generated programmatically
 */
export class SoundGenerator {
  private audioContext: AudioContext | null = null

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
        } catch (error) {
          console.warn('Failed to create AudioContext:', error)
          return null
        }
      }
    }
    return this.audioContext
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
      ctx.resume().catch(() => {})
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
  }
}
