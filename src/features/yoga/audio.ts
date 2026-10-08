export type BreathMode = 'tone' | 'ambient' | 'off'
export type ChimeKind = 'step' | 'flow' | 'complete'

export interface AudioPrefs {
  breathMode: BreathMode
  chimeMuted: boolean
}

export const AUDIO_PREFS_KEY = 'still-yoga-audio-v1'

export const defaultAudioPrefs: AudioPrefs = { breathMode: 'tone', chimeMuted: false }

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(AUDIO_PREFS_KEY)
    if (!raw) return { ...defaultAudioPrefs }
    const value: unknown = JSON.parse(raw)
    const prefs = { ...defaultAudioPrefs }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if (record.breathMode === 'tone' || record.breathMode === 'ambient' || record.breathMode === 'off') prefs.breathMode = record.breathMode
      if (typeof record.chimeMuted === 'boolean') prefs.chimeMuted = record.chimeMuted
    }
    return prefs
  } catch { return { ...defaultAudioPrefs } }
}

export function saveAudioPrefs(prefs: AudioPrefs): void {
  try { localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs)) } catch { /* Optional persistence. */ }
}

/**
 * Owns the single AudioContext and the synthesized sounds (chimes, breath
 * pacer tones, and the ambient breath bed). Everything is quiet by design and
 * honours the mute state internally so the player never has to pass flags around.
 */
export class AudioEngine {
  private context: AudioContext | null = null
  private noise: { source: AudioBufferSourceNode; gain: GainNode } | null = null
  private prefs: AudioPrefs

  constructor(prefs: AudioPrefs) { this.prefs = { ...prefs } }

  setPrefs(prefs: AudioPrefs): void {
    this.prefs = { ...prefs }
    if (prefs.breathMode !== 'ambient') this.setAmbient(false)
  }

  /** Create/resume the context from a user gesture. Returns false when unavailable. */
  unlock(): boolean {
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
      return true
    } catch { return false }
  }

  /** A distinct, quiet chime per event: pose transition, flow start, or completion. */
  chime(kind: ChimeKind): void {
    if (this.prefs.chimeMuted || !this.context || this.context.state !== 'running') return
    if (kind === 'flow') { this.ring([659.25, 987.77, 1318.51], [0.07, 0.025, 0.012], 2.0); return }
    if (kind === 'complete') { this.ring([261.63, 392.0, 523.25, 659.25], [0.08, 0.05, 0.03, 0.02], 2.8); return }
    this.ring([523.25, 1046.5], [0.1, 0.03], 1.5)
  }

  /** A soft rising glide on inhale and falling glide on exhale. */
  breath(inhalation: boolean): void {
    if (this.prefs.breathMode !== 'tone' || !this.context || this.context.state !== 'running') return
    const ctx = this.context
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    const from = inhalation ? 392 : 523.25
    const to = inhalation ? 523.25 : 392
    const glide = inhalation ? 0.4 : 0.55
    osc.frequency.setValueAtTime(from, t0)
    osc.frequency.exponentialRampToValueAtTime(to, t0 + glide)
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.05, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + glide + 0.3)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(t0); osc.stop(t0 + glide + 0.35)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
  }

  /** Start/stop a continuous low-passed noise bed for the ambient mode. */
  setAmbient(on: boolean): void {
    if (!this.context || this.context.state !== 'running') return
    const ctx = this.context
    if (on && !this.noise) {
      const length = Math.max(1, Math.floor(ctx.sampleRate * 2))
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 520
      filter.Q.value = 0.5
      const gain = ctx.createGain()
      gain.gain.value = 0
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      source.start()
      gain.gain.setTargetAtTime(0.03, ctx.currentTime, 0.5)
      this.noise = { source, gain }
    } else if (!on && this.noise) {
      const { source, gain } = this.noise
      this.noise = null
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
      source.stop(ctx.currentTime + 1.5)
      source.onended = () => { source.disconnect(); gain.disconnect() }
    }
  }

  /** Follow the breath pacer's eased expansion so the ambient bed swells on inhale. */
  setAmbientLevel(level: number): void {
    if (!this.context || !this.noise) return
    const target = 0.015 + Math.max(0, Math.min(1, level)) * 0.045
    this.noise.gain.gain.setTargetAtTime(target, this.context.currentTime, 0.35)
  }

  private ring(frequencies: number[], peaks: number[], decay: number): void {
    if (!this.context) return
    const ctx = this.context
    const t0 = ctx.currentTime
    frequencies.forEach((frequency, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      const peak = peaks[index] ?? 0.03
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + decay)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t0); osc.stop(t0 + decay + 0.05)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    })
  }

  dispose(): void {
    this.noise = null
    if (this.context) {
      void this.context.close().catch(() => {})
      this.context = null
    }
  }
}
