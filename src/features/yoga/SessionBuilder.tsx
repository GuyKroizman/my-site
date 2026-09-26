import { Fragment, useEffect, useState, type DragEvent } from 'react'
import { durationSeconds, formatDuration, MAX_STEPS, stepPoseId, totalBreaths, type Routine, type Step } from './model'
import { flowById } from './flows'
import { focuses, poseById, type Focus } from './poses'
import { FLOW_DRAG_TYPE, POSE_DRAG_TYPE, STEP_DRAG_TYPE } from './PoseCatalog'
import { Icon, PoseImage } from './ui'

type PoseStep = Extract<Step, { kind: 'pose' }>
type FlowStep = Extract<Step, { kind: 'flow' }>

function BreathInput({ step, onChange }: { step: PoseStep; onChange: (breaths: number) => void }) {
  const [text, setText] = useState(String(step.breaths))
  useEffect(() => { setText(String(step.breaths)) }, [step.breaths])
  function commit() {
    const value = Math.min(60, Math.max(1, Math.round(Number(text) || 1)))
    setText(String(value))
    onChange(value)
  }
  return <label className="yoga-breath-input"><input type="number" min="1" max="60" step="1" value={text} aria-label={`Breaths for ${poseById.get(step.poseId)!.name}`} onChange={event => {
    setText(event.target.value)
    const value = Number(event.target.value)
    if (Number.isInteger(value) && value >= 1 && value <= 60) onChange(value)
  }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /><span>breaths</span></label>
}

function RoundsInput({ step, onChange }: { step: FlowStep; onChange: (rounds: number) => void }) {
  const [text, setText] = useState(String(step.rounds))
  useEffect(() => { setText(String(step.rounds)) }, [step.rounds])
  function commit() {
    const value = Math.min(60, Math.max(1, Math.round(Number(text) || 1)))
    setText(String(value))
    onChange(value)
  }
  return <label className="yoga-breath-input"><input type="number" min="1" max="60" step="1" value={text} aria-label={`Rounds for ${flowById.get(step.flowId)!.name}`} onChange={event => {
    setText(event.target.value)
    const value = Number(event.target.value)
    if (Number.isInteger(value) && value >= 1 && value <= 60) onChange(value)
  }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /><span>rounds</span></label>
}

interface Props {
  routine: Routine
  saved: boolean
  savingDisabled: boolean
  dragging: boolean
  onChange: (routine: Routine) => void
  onAdd: (poseId: string, slot?: number) => void
  onAddFlow: (flowId: string, slot?: number) => void
  onMove: (id: string, slot: number) => void
  onDuplicateStep: (step: Step) => void
  onDragChange: (dragging: boolean) => void
  onSave: () => void
  onStart: () => void
  onNew: () => void
}

export default function SessionBuilder({ routine, saved, savingDisabled, dragging, onChange, onAdd, onAddFlow, onMove, onDuplicateStep, onDragChange, onSave, onStart, onNew }: Props) {
  const [over, setOver] = useState<number | null>(null)
  const full = routine.steps.length >= MAX_STEPS
  function updateStep(id: string, patch: Partial<Step>) {
    onChange({ ...routine, steps: routine.steps.map(step => (step.id === id ? ({ ...(step as object), ...patch } as Step) : step)) })
  }
  function accepts(event: DragEvent) {
    return event.dataTransfer.types.includes(POSE_DRAG_TYPE) || event.dataTransfer.types.includes(STEP_DRAG_TYPE) || event.dataTransfer.types.includes(FLOW_DRAG_TYPE)
  }
  function drop(event: DragEvent, slot: number) {
    event.preventDefault()
    const stepId = event.dataTransfer.getData(STEP_DRAG_TYPE)
    const poseId = event.dataTransfer.getData(POSE_DRAG_TYPE)
    const flowId = event.dataTransfer.getData(FLOW_DRAG_TYPE)
    if (stepId) onMove(stepId, slot)
    else if (flowById.has(flowId)) onAddFlow(flowId, slot)
    else if (poseById.has(poseId)) onAdd(poseId, slot)
    setOver(null)
    onDragChange(false)
  }
  function slot(index: number) {
    return <li className={`yoga-drop-slot ${over === index ? 'is-over' : ''}`} aria-hidden="true" onDragOver={event => { if (accepts(event)) { event.preventDefault(); setOver(index) } }} onDragLeave={() => setOver(null)} onDrop={event => drop(event, index)}><span>Place pose here</span></li>
  }

  return <aside id="yoga-flow" className="yoga-builder" aria-labelledby="yoga-builder-title">
    <div className="yoga-builder-head"><a className="yoga-builder-back yoga-text-button" href="#yoga-catalog-title"><Icon name="arrow" size={15} />Back to pose library</a><div className="yoga-section-heading"><div><p className="yoga-eyebrow">03 / MAKE IT YOURS</p><h2 id="yoga-builder-title">Your flow</h2></div><button className="yoga-text-button" onClick={onNew}><Icon name="plus" size={16} /> New</button></div>
      <label className="yoga-field"><span>SESSION NAME</span><input maxLength={80} value={routine.name} onChange={event => onChange({ ...routine, name: event.target.value })} placeholder="Give your practice a name" /></label>
      <label className="yoga-focus-field"><span>Focus</span><select value={routine.focus} onChange={event => onChange({ ...routine, focus: event.target.value as Focus })}>{focuses.map(focus => <option key={focus}>{focus}</option>)}</select></label>
      <div className="yoga-session-stats"><span><Icon name="clock" size={16} />~ {formatDuration(durationSeconds(routine))}</span><span><Icon name="breath" size={17} />{totalBreaths(routine)} breaths</span><span>{routine.steps.length} steps</span></div>
    </div>
    <div className={`yoga-sequence-wrap ${dragging ? 'is-dragging' : ''}`}>
      <div className="yoga-sequence-caption"><span>THE SEQUENCE</span><span>Drag or use the arrows to reorder</span></div>
      {routine.steps.length ? <ol className="yoga-sequence">
        {slot(0)}
        {routine.steps.map((step, index) => {
          if (step.kind === 'flow') {
            const flow = flowById.get(step.flowId)
            return <Fragment key={step.id}><li className="yoga-step yoga-flow-step" onDragOver={event => { if (accepts(event)) { event.preventDefault(); setOver(index) } }} onDrop={event => drop(event, index)}>
              <span className="yoga-drag-handle" draggable aria-hidden="true" title="Drag to reorder" onDragStart={event => { event.dataTransfer.setData(STEP_DRAG_TYPE, step.id); event.dataTransfer.effectAllowed = 'move'; onDragChange(true) }} onDragEnd={() => { onDragChange(false); setOver(null) }}>⠿</span>
              <span className="yoga-step-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="yoga-flow-icon"><PoseImage pose={poseById.get(stepPoseId(step))!} /><span className="yoga-flow-badge">flow</span></div>
              <div className="yoga-step-info"><h3>{flow?.name ?? 'Flow'}</h3><div className="yoga-step-options"><RoundsInput step={step} onChange={rounds => updateStep(step.id, { rounds })} /><details className="yoga-flow-phases"><summary>{flow?.phases.length ?? 0} poses</summary><span>{(flow?.phases ?? []).map(phase => poseById.get(phase.poseId)?.name ?? phase.poseId).join(' → ')}</span></details></div></div>
              <div className="yoga-step-actions"><button className="yoga-mini-button" aria-label={`Move ${flow?.name ?? 'flow'} up`} disabled={index === 0} onClick={() => onMove(step.id, index - 1)}><Icon name="up" size={14} /></button><button className="yoga-mini-button" aria-label={`Move ${flow?.name ?? 'flow'} down`} disabled={index === routine.steps.length - 1} onClick={() => onMove(step.id, index + 2)}><Icon name="down" size={14} /></button><button className="yoga-mini-button" aria-label={`Duplicate ${flow?.name ?? 'flow'}`} title="Duplicate flow" disabled={full} onClick={() => onDuplicateStep(step)}><Icon name="copy" size={13} /></button><button className="yoga-mini-button yoga-remove" aria-label={`Remove ${flow?.name ?? 'flow'}`} onClick={() => onChange({ ...routine, steps: routine.steps.filter(item => item.id !== step.id) })}><Icon name="close" size={14} /></button></div>
            </li>{slot(index + 1)}</Fragment>
          }
          const pose = poseById.get(step.poseId)!
          return <Fragment key={step.id}><li className="yoga-step" onDragOver={event => { if (accepts(event)) { event.preventDefault(); setOver(index) } }} onDrop={event => drop(event, index)}>
            <span className="yoga-drag-handle" draggable aria-hidden="true" title="Drag to reorder" onDragStart={event => { event.dataTransfer.setData(STEP_DRAG_TYPE, step.id); event.dataTransfer.effectAllowed = 'move'; onDragChange(true) }} onDragEnd={() => { onDragChange(false); setOver(null) }}>⠿</span>
            <span className="yoga-step-number">{String(index + 1).padStart(2, '0')}</span><PoseImage pose={pose} />
            <div className="yoga-step-info"><h3>{pose.name}</h3><div className="yoga-step-options"><BreathInput step={step} onChange={breaths => updateStep(step.id, { breaths })} />{pose.sided && <select value={step.side} aria-label={`Side for ${pose.name}`} onChange={event => updateStep(step.id, { side: event.target.value as 'Left' | 'Right' })}><option value="Left">Left</option><option value="Right">Right</option></select>}</div></div>
            <div className="yoga-step-actions"><button className="yoga-mini-button" aria-label={`Move ${pose.name} up`} disabled={index === 0} onClick={() => onMove(step.id, index - 1)}><Icon name="up" size={14} /></button><button className="yoga-mini-button" aria-label={`Move ${pose.name} down`} disabled={index === routine.steps.length - 1} onClick={() => onMove(step.id, index + 2)}><Icon name="down" size={14} /></button><button className="yoga-mini-button" aria-label={pose.sided ? `Add other side of ${pose.name}` : `Duplicate ${pose.name}`} title={pose.sided ? 'Add the other side' : 'Duplicate pose'} disabled={full} onClick={() => onDuplicateStep(step)}><Icon name="copy" size={13} /></button><button className="yoga-mini-button yoga-remove" aria-label={`Remove ${pose.name}`} onClick={() => onChange({ ...routine, steps: routine.steps.filter(item => item.id !== step.id) })}><Icon name="close" size={14} /></button></div>
          </li>{slot(index + 1)}</Fragment>
        })}
      </ol> : <div className={`yoga-sequence-empty ${over === 0 ? 'is-over' : ''}`} onDragOver={event => { if (accepts(event)) { event.preventDefault(); setOver(0) } }} onDragLeave={() => setOver(null)} onDrop={event => drop(event, 0)}><Icon name="leaf" size={32} /><h3>A little space to begin.</h3><p>Add a pose or a flow from the library, or drop one here. Your practice, your pace.</p></div>}
      <button className="yoga-rest-button" disabled={full} onClick={() => onAdd('child')}><Icon name="plus" size={16} /> Add a resting pose <span>Child’s Pose · 5 breaths</span></button>
      {full && <p className="yoga-limit-notice">Your flow has reached its {MAX_STEPS}-step limit.</p>}
    </div>
    <div className="yoga-builder-bottom">
      <details className="yoga-pace-settings"><summary><Icon name="breath" /><span>Settle into your rhythm<small>{routine.phaseSeconds}s inhale · {routine.phaseSeconds}s exhale</small></span><Icon name="down" size={16} /></summary><div><label htmlFor="yoga-pace">Seconds per inhale and per exhale <strong>{routine.phaseSeconds}s</strong></label><input id="yoga-pace" type="range" min="2" max="8" step="1" value={routine.phaseSeconds} onChange={event => onChange({ ...routine, phaseSeconds: Number(event.target.value) })} /><p>One breath is one inhale + one exhale. Estimates exclude extra transition time. Choose an easy rhythm; never force your breath.</p></div></details>
      <div className="yoga-builder-buttons"><button className="yoga-button yoga-secondary" onClick={onSave} disabled={savingDisabled || !routine.steps.length || !routine.name.trim() || saved}><Icon name={saved ? 'check' : 'save'} size={17} />{saved ? 'Saved' : 'Save session'}</button><button id="yoga-start-practice" className="yoga-button yoga-primary" disabled={!routine.steps.length} onClick={onStart}><Icon name="play" size={17} />Practice</button></div>
      <p className="yoga-local-note"><span />{saved ? 'Saved on this browser. Just for you.' : 'Draft kept on this browser · no account needed'}</p>
    </div>
  </aside>
}
