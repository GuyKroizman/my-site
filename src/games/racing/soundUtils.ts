export function resumeAudioContext(ctx: AudioContext): void {
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

export function createNoiseBuffer(
  ctx: AudioContext,
  sampleCount: number,
  sampleFactory: (index: number) => number
): AudioBuffer {
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < sampleCount; i++) {
    data[i] = sampleFactory(i)
  }
  return buffer
}

export function createDistortionCurve(length: number, sampleFactory: (x: number) => number): Float32Array {
  const curve = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const x = (i * 2) / length - 1
    curve[i] = sampleFactory(x)
  }
  return curve
}

export function createOscillatorGain(
  ctx: AudioContext,
  type: OscillatorType,
  destination: AudioNode
): { oscillator: OscillatorNode; gain: GainNode } {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.connect(gain)
  gain.connect(destination)
  return { oscillator, gain }
}

export function scheduleLinearFade(
  gain: GainNode,
  now: number,
  startVolume: number,
  duration: number,
  endVolume = 0
): void {
  gain.gain.setValueAtTime(startVolume, now)
  gain.gain.linearRampToValueAtTime(endVolume, now + duration)
}

export function scheduleExpFade(
  gain: GainNode,
  now: number,
  startVolume: number,
  duration: number,
  endVolume = 0.001
): void {
  gain.gain.setValueAtTime(startVolume, now)
  gain.gain.exponentialRampToValueAtTime(endVolume, now + duration)
}

export function disconnectNodes(...nodes: Array<AudioNode | AudioScheduledSourceNode | null | undefined>): void {
  nodes.forEach(node => node?.disconnect())
}
