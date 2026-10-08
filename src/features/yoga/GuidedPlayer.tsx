import { useCallback, useEffect, useRef, useState } from 'react'
import { durationSeconds, formatDuration, playbackAt, stepPoseId, stepStartSeconds, totalBreaths, type Routine, type Step } from './model'
import { flowById } from './flows'
import { poseById, type Pose } from './poses'
import { AudioEngine, loadAudioPrefs, saveAudioPrefs, type AudioPrefs } from './audio'
import { Icon, PoseImage } from './ui'

function halfLabel(halves: number, start?: 'inhale' | 'exhale') {
  if (halves === 1) return start === 'exhale' ? 'exhale' : 'inhale'
  return `${Math.ceil(halves / 2)} ${Math.ceil(halves / 2) === 1 ? 'breath' : 'breaths'}`
}

export default function GuidedPlayer({ routine, onExit }: { routine: Routine; onExit: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [prefs, setPrefs] = useState<AudioPrefs>(loadAudioPrefs)
  const [notice, setNotice] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const engine = useRef<AudioEngine | null>(null)
  if (!engine.current) engine.current = new AudioEngine(prefs)
  const base = useRef(0)
  const started = useRef(0)
  const lastPose = useRef(0)
  const lastHalf = useRef(0)
  const finished = useRef(false)
  const view = playbackAt(routine, elapsed)
  const step = routine.steps[view.index]
  const pose = poseById.get(view.poseId)!
  const total = durationSeconds(routine)

  useEffect(() => {
    engine.current!.setPrefs(prefs)
    saveAudioPrefs(prefs)
  }, [prefs])

  const pause = useCallback(() => {
    if (started.current) base.current = Math.min(total, base.current + (performance.now() - started.current) / 1000)
    started.current = 0
    setElapsed(base.current)
    setPlaying(false)
  }, [total])

  const togglePlay = useCallback(() => {
    if (playing) { pause(); return }
    if (base.current >= total) {
      base.current = 0
      lastPose.current = 0
      lastHalf.current = 0
      finished.current = false
      setElapsed(0)
    }
    setNotice('')
    if (!engine.current!.unlock()) setNotice('Audio is unavailable. Follow the visual breath guide.')
    started.current = performance.now()
    setPlaying(true)
  }, [playing, pause, total])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      const time = Math.min(total, base.current + (performance.now() - started.current) / 1000)
      setElapsed(time)
      if (time >= total) {
        base.current = total
        started.current = 0
        setPlaying(false)
      } else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, total])

  // Varied chimes: pose transition, flow start, or completion.
  useEffect(() => {
    const changed = view.index !== lastPose.current
    lastPose.current = view.index
    if (view.complete) {
      if (!finished.current) { finished.current = true; engine.current!.chime('complete') }
    } else if (changed) {
      engine.current!.chime(routine.steps[view.index]?.kind === 'flow' ? 'flow' : 'step')
    }
  }, [view.index, view.complete, routine.steps])

  // Breath pacer tone at each half-breath boundary.
  useEffect(() => {
    if (!playing) return
    const half = Math.floor(elapsed / routine.phaseSeconds)
    if (half !== lastHalf.current) {
      lastHalf.current = half
      engine.current!.breath(view.inhale)
    }
  }, [playing, elapsed, routine.phaseSeconds, view.inhale])

  // Ambient breath bed, level following the eased expansion.
  useEffect(() => {
    const engineRef = engine.current!
    if (playing && prefs.breathMode === 'ambient') {
      engineRef.setAmbient(true)
      engineRef.setAmbientLevel(view.expansion)
    } else {
      engineRef.setAmbient(false)
    }
  }, [playing, prefs.breathMode, view.expansion])

  useEffect(() => {
    const hide = () => {
      if (document.hidden && playing) { pause(); setNotice('Practice paused while this tab was away. Resume when you’re ready.') }
    }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [playing, pause])

  useEffect(() => {
    if (!playing || !('wakeLock' in navigator)) return
    let disposed = false
    let lock: WakeLockSentinel | undefined
    void navigator.wakeLock.request('screen').then(acquired => {
      if (disposed) void acquired.release().catch(() => {})
      else lock = acquired
    }).catch(() => { /* Optional: unsupported devices still have visual guidance. */ })
    return () => { disposed = true; void lock?.release().catch(() => {}) }
  }, [playing])

  useEffect(() => {
    const fullscreenChanged = () => setFullscreen(document.fullscreenElement === container.current)
    document.addEventListener('fullscreenchange', fullscreenChanged)
    return () => document.removeEventListener('fullscreenchange', fullscreenChanged)
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const surface = container.current
    surface?.focus()
    return () => {
      document.body.style.overflow = previous
      engine.current?.dispose()
      if (document.fullscreenElement === surface) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.code === 'Space' && !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(target.tagName)) { event.preventDefault(); togglePlay() }
      if (event.key === 'Escape' && !document.fullscreenElement) pause()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [togglePlay, pause])

  function seek(index: number) {
    base.current = stepStartSeconds(routine, index)
    started.current = playing ? performance.now() : 0
    finished.current = false
    lastHalf.current = Math.floor(base.current / routine.phaseSeconds)
    setElapsed(base.current)
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (container.current?.requestFullscreen) await container.current.requestFullscreen()
      else setNotice('Full-screen is not available in this browser. Practice mode still fills the page.')
    } catch { setNotice('Full-screen is not available. Practice mode still fills the page.') }
  }

  function exit() {
    pause()
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    onExit()
  }

  function setBreathMode(breathMode: AudioPrefs['breathMode']) {
    if (breathMode !== 'off') engine.current!.unlock()
    setPrefs({ ...prefs, breathMode })
  }

  function toggleChime() {
    const chimeMuted = !prefs.chimeMuted
    if (!chimeMuted) engine.current!.unlock()
    setPrefs({ ...prefs, chimeMuted })
  }

  function upcoming(): { pose: Pose; side?: 'Left' | 'Right'; label: string } | null {
    const current: Step | undefined = routine.steps[view.index]
    if (current?.kind === 'flow') {
      const flow = flowById.get(current.flowId)
      if (flow) {
        if (view.phaseIndex + 1 < flow.phases.length) {
          const phase = flow.phases[view.phaseIndex + 1]
          return { pose: poseById.get(phase.poseId)!, side: phase.side, label: halfLabel(phase.halves, phase.start) }
        }
        if ((view.round ?? 1) < current.rounds) {
          const phase = flow.phases[0]
          return { pose: poseById.get(phase.poseId)!, side: phase.side, label: halfLabel(phase.halves, phase.start) }
        }
      }
    }
    const next = routine.steps[view.index + 1]
    if (next) {
      return next.kind === 'pose'
        ? { pose: poseById.get(next.poseId)!, side: next.side, label: `${next.breaths} ${next.breaths === 1 ? 'breath' : 'breaths'}` }
        : { pose: poseById.get(stepPoseId(next))!, label: `${next.rounds} ${next.rounds === 1 ? 'round' : 'rounds'}` }
    }
    return null
  }

  const upNext = upcoming()

  return <div className="yoga-player" ref={container} tabIndex={-1}>
    <header className="yoga-player-header">
      <button className="yoga-text-button" onClick={exit}><Icon name="arrow" /> Back to session</button>
      <span className="yoga-player-title">{routine.name}</span>
      <div className="yoga-button-row">
        <button className="yoga-icon-button" aria-label={prefs.chimeMuted ? 'Enable transition chimes' : 'Mute transition chimes'} aria-pressed={!prefs.chimeMuted} onClick={toggleChime}><Icon name={prefs.chimeMuted ? 'mute' : 'sound'} /></button>
        <button className="yoga-icon-button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'} aria-pressed={fullscreen}><Icon name="expand" /></button>
      </div>
    </header>
    {notice && <p role="status" className="yoga-player-notice">{notice}</p>}
    {view.complete ? <div className="yoga-completion">
      <span className="yoga-completion-symbol"><Icon name="leaf" size={52} /></span>
      <p className="yoga-eyebrow">A LITTLE TIME, JUST FOR YOU</p>
      <h1>Carry this calm with you.</h1>
      <p>You’ve reached the end of your flow. Take a moment before moving on.</p>
      <div className="yoga-completion-stats"><span>{routine.steps.length} steps</span><span>{totalBreaths(routine)} planned breaths</span><span>{formatDuration(total)} practice</span></div>
      <div className="yoga-button-row"><button className="yoga-button yoga-primary" onClick={exit}>Back to my session</button><button className="yoga-button yoga-secondary" onClick={togglePlay}><Icon name="play" /> Practice again</button></div>
    </div> : <>
      <main className="yoga-practice-stage">
        <section className="yoga-current-pose" aria-label="Current pose">
          <p className="yoga-eyebrow">{view.round ? `ROUND ${view.round} OF ${view.roundCount} · PHASE ${view.phaseIndex + 1} OF ${view.phaseCount}` : `POSE ${String(view.index + 1).padStart(2, '0')} OF ${String(routine.steps.length).padStart(2, '0')}`}</p>
          <PoseImage pose={pose} />
          <div aria-live="polite" aria-atomic="true" key={`${step.id}-${view.phaseIndex}-${view.round ?? 0}`}><h1>{pose.name}</h1><p className="yoga-sanskrit">{pose.sanskrit}{view.side && ` · ${view.side} side`}</p></div>
          <p className="yoga-pose-cue">{pose.cue}</p>
        </section>
        <section className="yoga-breath-guide" aria-label="Breath guidance">
          <div className="yoga-breath-orbit">
            <div className="yoga-breath-disc" style={{ transform: `scale(${0.7 + view.expansion * 0.3})` }} />
            <div className="yoga-breath-label"><span>{playing ? (view.inhale ? 'Breathe in' : 'Breathe out') : elapsed === 0 ? 'Find your ease' : 'Take your time'}</span><strong>{playing ? view.phaseRemaining : <Icon name={elapsed === 0 ? 'leaf' : 'pause'} size={36} />}</strong><small>{playing ? `${routine.phaseSeconds} seconds · ${view.inhale ? 'inhale' : 'exhale'}` : elapsed === 0 ? 'Press begin when you’re ready' : 'Your practice is paused'}</small></div>
          </div>
          <div className="yoga-breath-audio" role="group" aria-label="Breath sound">
            <span className="yoga-breath-audio-label"><Icon name="breath" size={14} /> Breath sound</span>
            <div className="yoga-segmented">
              <button className={prefs.breathMode === 'tone' ? 'is-active' : ''} aria-pressed={prefs.breathMode === 'tone'} onClick={() => setBreathMode('tone')}>Tone</button>
              <button className={prefs.breathMode === 'ambient' ? 'is-active' : ''} aria-pressed={prefs.breathMode === 'ambient'} onClick={() => setBreathMode('ambient')}>Ambient</button>
              <button className={prefs.breathMode === 'off' ? 'is-active' : ''} aria-pressed={prefs.breathMode === 'off'} onClick={() => setBreathMode('off')}>Off</button>
            </div>
          </div>
          <p className="yoga-breath-count"><strong>{view.remainingBreaths}</strong> {view.remainingBreaths === 1 ? 'breath' : 'breaths'} remaining</p>
          <p className="yoga-muted">Breath {view.breathNumber} of {view.phaseBreaths} · Follow your comfort, not the count.</p>
          <div className="yoga-player-controls">
            <button className="yoga-icon-button" disabled={view.index === 0} aria-label="Previous pose" onClick={() => seek(view.index - 1)}><Icon name="previous" size={25} /></button>
            <button className="yoga-button yoga-primary" onClick={togglePlay}><Icon name={playing ? 'pause' : 'play'} />{playing ? 'Pause' : elapsed === 0 ? 'Begin practice' : 'Resume'}</button>
            <button className="yoga-icon-button" aria-label={upNext ? 'Next pose' : 'Finish practice'} onClick={() => seek(view.index + 1)}><Icon name="next" size={25} /></button>
          </div>
        </section>
      </main>
      <footer className="yoga-player-footer">
        <div className="yoga-routine-progress"><div><span>YOUR PRACTICE</span><span>{formatDuration(Math.max(0, total - elapsed))} remaining · {Math.round(view.progress * 100)}%</span></div><progress value={view.progress} max="1" aria-label="Routine progress" /></div>
        <div className="yoga-up-next">{upNext ? <><PoseImage pose={upNext.pose} /><div><span className="yoga-eyebrow">UP NEXT</span><strong>{upNext.pose.name}</strong><small>{upNext.label}{upNext.side && ` · ${upNext.side} side`}</small></div></> : <><Icon name="leaf" size={30} /><div><span className="yoga-eyebrow">UP NEXT</span><strong>A moment of stillness</strong><small>Your final pose. No rush.</small></div></>}</div>
      </footer>
    </>}
  </div>
}
