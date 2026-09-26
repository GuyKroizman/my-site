import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PoseCatalog from '../features/yoga/PoseCatalog'
import SessionBuilder from '../features/yoga/SessionBuilder'
import SessionLibrary from '../features/yoga/SessionLibrary'
import GuidedPlayer from '../features/yoga/GuidedPlayer'
import { createRoutine, createFlowStep, createStep, DRAFT_KEY, duplicateRoutine, loadLibrary, MAX_SESSIONS, MAX_STEPS, moveStep, parseRoutine, saveLibrary, uid, type Routine, type Step } from '../features/yoga/model'
import { flowById } from '../features/yoga/flows'
import { poseById } from '../features/yoga/poses'
import { Icon, PoseImage } from '../features/yoga/ui'
import '../features/yoga/yoga.css'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return { routine: createRoutine(true), error: '' }
    const routine = parseRoutine(JSON.parse(raw))
    if (routine) return { routine, error: '' }
    return { routine: createRoutine(true), error: 'The previous draft was invalid. A fresh starter flow is ready; your saved library is unchanged.' }
  } catch { return { routine: createRoutine(true), error: 'Your draft could not be restored. You can still build and practice in this tab.' } }
}

export default function Yoga() {
  const [initialLibrary] = useState(loadLibrary)
  const [initialDraft] = useState(loadDraft)
  const [sessions, setSessions] = useState(initialLibrary.sessions)
  const [routine, setRoutine] = useState(initialDraft.routine)
  const [tab, setTab] = useState<'build' | 'library'>('build')
  const [dragging, setDragging] = useState(false)
  const [builderVisible, setBuilderVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [storageError, setStorageError] = useState(initialDraft.error)
  const [practice, setPractice] = useState<Routine | null>(null)
  const saved = sessions.some(item => item.id === routine.id && JSON.stringify(item) === JSON.stringify(routine))

  useEffect(() => {
    const previous = document.title
    const viewport = document.querySelector('meta[name="viewport"]')
    const previousViewport = viewport?.getAttribute('content')
    document.title = 'Still — Yoga Session Builder'
    // The game pages disable pinch zoom; restore it for this reading/form-based page.
    viewport?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
    return () => {
      document.title = previous
      if (previousViewport) viewport?.setAttribute('content', previousViewport)
    }
  }, [])

  useEffect(() => {
    // Schema v2 replaces v1; drop the old keys rather than migrating them.
    try {
      localStorage.removeItem('still-yoga-library-v1')
      localStorage.removeItem('still-yoga-draft-v1')
    } catch { /* Storage unavailable; nothing to clean up. */ }
  }, [])

  useEffect(() => {
    // Persist every committed edit so immediate navigation cannot lose the draft.
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...routine, name: routine.name.trim() || 'Untitled flow' }))
    } catch { setStorageError('Browser storage is unavailable or full. Changes are only kept in this tab; keep it open to preserve your flow.') }
  }, [routine])

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(''), 4200)
    return () => clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    const builder = document.querySelector('.yoga-builder')
    if (!builder || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setBuilderVisible(entry.isIntersecting), { threshold: 0.08 })
    observer.observe(builder)
    return () => observer.disconnect()
  }, [tab, practice])

  function addPose(poseId: string, slot = routine.steps.length) {
    if (!poseById.has(poseId) || routine.steps.length >= MAX_STEPS) return
    const steps = [...routine.steps]
    steps.splice(slot, 0, createStep(poseId))
    setRoutine({ ...routine, steps })
    setMessage(`${poseById.get(poseId)!.name} added to your flow.`)
  }

  function addFlow(flowId: string, slot = routine.steps.length) {
    if (!flowById.has(flowId) || routine.steps.length >= MAX_STEPS) return
    const steps = [...routine.steps]
    steps.splice(slot, 0, createFlowStep(flowId))
    setRoutine({ ...routine, steps })
    setMessage(`${flowById.get(flowId)!.name} added to your flow.`)
  }

  function replaceDraft(next: Routine) {
    if (!saved && routine.steps.length && !window.confirm('Replace the current draft? Save it first if you want to keep it in My sessions.')) return false
    setRoutine(next)
    setTab('build')
    return true
  }

  function persist(next: Routine[]): boolean {
    if (initialLibrary.error) return false
    if (!saveLibrary(next)) {
      setStorageError('Your library could not be saved. Browser storage may be blocked or full. Your current flow is still available in this tab.')
      return false
    }
    setSessions(next)
    return true
  }

  function save() {
    if (!routine.steps.length || !routine.name.trim()) return
    if (sessions.length >= MAX_SESSIONS && !sessions.some(item => item.id === routine.id)) { setMessage(`Your library holds up to ${MAX_SESSIONS} sessions. Delete one to make room.`); return }
    const next = { ...routine, name: routine.name.trim(), updatedAt: new Date().toISOString() }
    if (persist([next, ...sessions.filter(item => item.id !== routine.id)])) {
      setRoutine(next)
      setMessage('Session saved. Find it in My sessions anytime.')
    }
  }

  function duplicate(routineToCopy: Routine) {
    if (sessions.length >= MAX_SESSIONS) { setMessage(`Your library holds up to ${MAX_SESSIONS} sessions. Delete one to make room.`); return }
    const copy = duplicateRoutine(routineToCopy)
    if (persist([copy, ...sessions])) setMessage(`“${copy.name}” added to My sessions.`)
  }

  function duplicateStep(step: Step) {
    if (routine.steps.length >= MAX_STEPS) return
    const index = routine.steps.findIndex(item => item.id === step.id)
    const next = [...routine.steps]
    const copy: Step = step.kind === 'flow' ? { ...step, id: uid() } : { ...step, id: uid(), ...(step.side ? { side: step.side === 'Left' ? 'Right' as const : 'Left' as const } : {}) }
    next.splice(index + 1, 0, copy)
    setRoutine({ ...routine, steps: next })
    setMessage(step.kind === 'flow' ? 'Flow duplicated.' : step.side ? 'Other side added after this pose.' : 'Pose duplicated.')
  }

  function start(item: Routine) {
    if (item.steps.length) setPractice({ ...item, name: item.name.trim() || 'My mindful flow', steps: item.steps.map(step => ({ ...step })) })
  }

  if (practice) return <GuidedPlayer routine={practice} onExit={() => {
    setPractice(null)
    requestAnimationFrame(() => document.getElementById(tab === 'build' ? 'yoga-start-practice' : 'yoga-library-tab')?.focus())
  }} />

  return <div className="yoga-app">
    <header className="yoga-header"><Link to="/yoga" className="yoga-brand" aria-label="Still Yoga Session Builder"><span className="yoga-brand-symbol"><Icon name="leaf" size={27} /></span><span>still<span className="yoga-brand-subtitle">YOGA SESSION BUILDER</span></span></Link><div className="yoga-header-right"><span className="yoga-private"><span />A little time for yourself</span><Link to="/" className="yoga-home-link"><Icon name="arrow" size={15} /> Back to Guy’s page</Link></div></header>
    <main className="yoga-main">
      <section className="yoga-hero" aria-labelledby="yoga-page-title"><div className="yoga-hero-copy"><p className="yoga-eyebrow"><span /> MOVE MINDFULLY. BREATHE EASILY.</p><h1 id="yoga-page-title">Make space for<br /><em>your practice.</em></h1><p>A flow that feels like you. Choose your poses, find your rhythm,<br className="yoga-desktop-break" /> and let your breath lead the way.</p><div className="yoga-hero-note"><Icon name="breath" size={19} />Count breaths. Not seconds.</div></div><div className="yoga-hero-art" aria-hidden="true"><span className="yoga-hero-orbit yoga-orbit-one" /><span className="yoga-hero-orbit yoga-orbit-two" /><span className="yoga-hero-sun" /><PoseImage pose={poseById.get('easy-seat')!} /><span className="yoga-hero-caption">inhale intention, exhale expectation</span><span className="yoga-hero-spark">✳︎</span></div></section>
      <nav className="yoga-tabs" aria-label="Yoga workspace"><div><button id="yoga-build-tab" className={tab === 'build' ? 'is-active' : ''} aria-current={tab === 'build' ? 'page' : undefined} onClick={() => setTab('build')}><Icon name="plus" size={18} />Build a session</button><button id="yoga-library-tab" className={tab === 'library' ? 'is-active' : ''} aria-current={tab === 'library' ? 'page' : undefined} onClick={() => setTab('library')}><Icon name="book" size={17} />My sessions <span>{sessions.length}</span></button></div><span className="yoga-device-note"><Icon name="check" size={14} />Private by nature. Saved on your device.</span></nav>
      {(initialLibrary.error || storageError) && <div className="yoga-warning" role="alert"><Icon name="info" /><p>{initialLibrary.error || storageError}</p></div>}
      {tab === 'build' ? <div className="yoga-workspace">
        <PoseCatalog onAdd={addPose} onAddFlow={addFlow} onDragChange={setDragging} full={routine.steps.length >= MAX_STEPS} />
        <SessionBuilder routine={routine} saved={saved} savingDisabled={!!initialLibrary.error} dragging={dragging} onChange={setRoutine} onAdd={addPose} onAddFlow={addFlow} onMove={(id, slot) => {
          setRoutine({ ...routine, steps: moveStep(routine.steps, id, slot) })
          setMessage('Pose order updated.')
        }} onDuplicateStep={duplicateStep} onDragChange={setDragging} onSave={save} onStart={() => start(routine)} onNew={() => replaceDraft(createRoutine())} />
      </div> : <SessionLibrary sessions={sessions} disabled={!!initialLibrary.error} onEdit={replaceDraft} onStart={start} onDuplicate={duplicate} onDelete={item => {
        if (window.confirm(`Delete “${item.name}” from your saved sessions? This cannot be undone.`) && persist(sessions.filter(session => session.id !== item.id))) setMessage('Session removed from your library.')
      }} onBuild={() => setTab('build')} />}
      <footer className="yoga-footer"><span><Icon name="leaf" size={18} /> Small rituals. A little more room.</span><p>Listen to your body. Move within a comfortable range and stop if you feel pain or dizziness.<br />This is a practice companion, not medical advice or a substitute for a qualified teacher.</p></footer>
    </main>
    {tab === 'build' && !builderVisible && <nav className="yoga-mobile-jump" aria-label="Jump within builder"><a href="#yoga-catalog-title"><Icon name="book" size={15} />Pose library</a><a href="#yoga-flow">Your flow · {routine.steps.length} steps<Icon name="down" size={15} /></a></nav>}
    <div className={`yoga-toast ${message ? 'is-visible' : ''}`} role="status" aria-live="polite" aria-atomic="true">{message && <><Icon name="check" size={18} />{message}</>}</div>
  </div>
}
