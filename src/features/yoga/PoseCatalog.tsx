import { useState, type DragEvent } from 'react'
import { focuses, poseById, poses, type Pose } from './poses'
import { flows, flowEstimateSeconds, type Flow } from './flows'
import { formatDuration } from './model'
import { Icon, Modal, PoseImage } from './ui'

export const POSE_DRAG_TYPE = 'application/x-still-pose'
export const STEP_DRAG_TYPE = 'application/x-still-step'
export const FLOW_DRAG_TYPE = 'application/x-still-flow'

interface Props {
  onAdd: (poseId: string) => void
  onAddFlow: (flowId: string) => void
  onDragChange: (dragging: boolean) => void
  full: boolean
}

function phaseLabel(halves: number, start?: 'inhale' | 'exhale') {
  if (halves === 1) return start === 'exhale' ? 'exhale' : 'inhale'
  return `${Math.ceil(halves / 2)} ${Math.ceil(halves / 2) === 1 ? 'breath' : 'breaths'}`
}

export default function PoseCatalog({ onAdd, onAddFlow, onDragChange, full }: Props) {
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState('All poses')
  const [difficulty, setDifficulty] = useState('All levels')
  const [details, setDetails] = useState<Pose | null>(null)
  const [flowDetails, setFlowDetails] = useState<Flow | null>(null)
  const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const query = normalized(search.trim())
  const filtered = poses.filter(pose => (focus === 'All poses' || pose.focus.some(item => item === focus)) &&
    (difficulty === 'All levels' || pose.difficulty === difficulty) &&
    normalized(`${pose.name} ${pose.sanskrit} ${pose.focus.join(' ')} ${pose.difficulty}`).includes(query))

  function drag(event: DragEvent, pose: Pose) {
    event.dataTransfer.setData(POSE_DRAG_TYPE, pose.id)
    event.dataTransfer.effectAllowed = 'copy'
    onDragChange(true)
  }

  function dragFlow(event: DragEvent, flow: Flow) {
    event.dataTransfer.setData(FLOW_DRAG_TYPE, flow.id)
    event.dataTransfer.effectAllowed = 'copy'
    onDragChange(true)
  }

  return <section className="yoga-catalog" aria-labelledby="yoga-catalog-title">
    <div className="yoga-section-heading"><div><p className="yoga-eyebrow">01 / EXPLORE</p><h2 id="yoga-catalog-title">Find your next pose</h2></div><span className="yoga-count">{poses.length} essentials</span></div>
    <div className="yoga-catalog-search">
      <label className="yoga-search"><Icon name="search" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search English or Sanskrit name…" aria-label="Search poses by name or focus" /></label>
      <select value={difficulty} onChange={event => setDifficulty(event.target.value)} aria-label="Filter by difficulty"><option>All levels</option><option>Beginner</option><option>Intermediate</option></select>
    </div>
    <div className="yoga-filter-chips" aria-label="Filter by focus">{['All poses', ...focuses].map(item => <button key={item} className={`yoga-chip ${focus === item ? 'is-active' : ''}`} aria-pressed={focus === item} onClick={() => setFocus(item)}>{item}</button>)}</div>
    <p className="yoga-catalog-hint"><span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'pose' : 'poses'}</span><span>Add with +, or drag into your flow</span></p>
    <div className="yoga-pose-grid">
      {filtered.map(pose => <article className="yoga-pose-card" key={pose.id} draggable={!full} onDragStart={event => drag(event, pose)} onDragEnd={() => onDragChange(false)}>
        <button className="yoga-pose-art-button" onClick={() => setDetails(pose)} aria-label={`View ${pose.name} details`}><PoseImage pose={pose} /><span className="yoga-pose-info"><Icon name="info" size={16} /></span></button>
        <div className="yoga-pose-card-body"><button className="yoga-pose-name-button" onClick={() => setDetails(pose)}><h3>{pose.name}</h3><span>{pose.sanskrit}</span></button><div className="yoga-pose-card-bottom"><span className={`yoga-level ${pose.difficulty === 'Intermediate' ? 'is-intermediate' : ''}`}><i />{pose.difficulty}</span><button className="yoga-add-button" onClick={() => onAdd(pose.id)} disabled={full} aria-label={`Add ${pose.name} to flow`}><Icon name="plus" size={19} /></button></div></div>
      </article>)}
    </div>
    {!filtered.length && <div className="yoga-empty"><Icon name="search" size={32} /><h3>A little more room to explore.</h3><p>No poses match these filters. Try a different name or focus.</p><button className="yoga-button yoga-secondary" onClick={() => { setSearch(''); setFocus('All poses'); setDifficulty('All levels') }}>Clear filters</button></div>}

    <div className="yoga-flows" id="yoga-flows-title">
      <div className="yoga-section-heading"><div><p className="yoga-eyebrow">02 / MOVE WITH YOUR BREATH</p><h2 id="yoga-flows-heading">Breath-linked flows</h2><p className="yoga-muted">Fixed sequences that change pose with each breath. Set the rounds in your flow.</p></div><span className="yoga-count">{flows.length} flows</span></div>
      <div className="yoga-flow-grid">
        {flows.map(flow => <article className="yoga-flow-card" key={flow.id} draggable={!full} onDragStart={event => dragFlow(event, flow)} onDragEnd={() => onDragChange(false)}>
          <button className="yoga-flow-art-button" onClick={() => setFlowDetails(flow)} aria-label={`View ${flow.name} details`}>
            {flow.phases.slice(0, 3).map((phase, i) => <PoseImage key={`${phase.poseId}-${i}`} pose={poseById.get(phase.poseId)!} />)}
            <span className="yoga-pose-info"><Icon name="info" size={16} /></span>
          </button>
          <div className="yoga-flow-card-body"><button className="yoga-pose-name-button" onClick={() => setFlowDetails(flow)}><h3>{flow.name}</h3><span>{flow.sanskrit}</span></button>
            <div className="yoga-flow-meta"><span>{flow.phases.length} poses</span><span>{flow.defaultRounds} rounds</span><span>~ {formatDuration(flowEstimateSeconds(flow))}</span></div>
            <div className="yoga-pose-card-bottom"><span className={`yoga-level ${flow.difficulty === 'Intermediate' ? 'is-intermediate' : ''}`}><i />{flow.difficulty}</span><button className="yoga-add-button" onClick={() => onAddFlow(flow.id)} disabled={full} aria-label={`Add ${flow.name} to flow`}><Icon name="plus" size={19} /></button></div>
          </div>
        </article>)}
      </div>
    </div>

    {details && <Modal title={details.name} onClose={() => setDetails(null)}>
      <div className="yoga-detail-art"><PoseImage pose={details} /></div><p className="yoga-sanskrit">{details.sanskrit} · {details.difficulty}{details.sided && ' · Practice both sides'}</p>
      <div className="yoga-detail-tags">{details.focus.map(tag => <span className="yoga-chip" key={tag}>{tag}</span>)}</div>
      <h3>What it offers</h3><p>{details.benefit}</p><h3>Find the shape</h3><p>{details.cue}</p><h3>Make it yours</h3><p>{details.modification}</p>
      <p className="yoga-detail-safety">These illustrations are visual reminders, not a substitute for instruction. Move gently, avoid pain, and choose support when you need it.</p>
      <button className="yoga-button yoga-primary yoga-wide" disabled={full} onClick={() => { onAdd(details.id); setDetails(null) }}><Icon name="plus" /> Add to my flow</button>
    </Modal>}

    {flowDetails && <Modal title={flowDetails.name} onClose={() => setFlowDetails(null)}>
      <p className="yoga-sanskrit">{flowDetails.sanskrit} · {flowDetails.difficulty}</p>
      <p>{flowDetails.description}</p>
      <h3>The sequence</h3>
      <ol className="yoga-flow-detail-phases">{flowDetails.phases.map((phase, i) => <li key={`${phase.poseId}-${i}`}><PoseImage pose={poseById.get(phase.poseId)!} /><span><strong>{poseById.get(phase.poseId)!.name}</strong>{phase.side && ` · ${phase.side} side`}<small>{phaseLabel(phase.halves, phase.start)}</small></span></li>)}</ol>
      <button className="yoga-button yoga-primary yoga-wide" disabled={full} onClick={() => { onAddFlow(flowDetails.id); setFlowDetails(null) }}><Icon name="plus" /> Add to my flow</button>
    </Modal>}
  </section>
}
