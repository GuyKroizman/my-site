import { useState, type DragEvent } from 'react'
import { focuses, poses, type Pose } from './poses'
import { Icon, Modal, PoseImage } from './ui'

export const POSE_DRAG_TYPE = 'application/x-still-pose'
export const STEP_DRAG_TYPE = 'application/x-still-step'

export default function PoseCatalog({ onAdd, onDragChange, full }: { onAdd: (poseId: string) => void; onDragChange: (dragging: boolean) => void; full: boolean }) {
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState('All poses')
  const [difficulty, setDifficulty] = useState('All levels')
  const [details, setDetails] = useState<Pose | null>(null)
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
    {details && <Modal title={details.name} onClose={() => setDetails(null)}>
      <div className="yoga-detail-art"><PoseImage pose={details} /></div><p className="yoga-sanskrit">{details.sanskrit} · {details.difficulty}{details.sided && ' · Practice both sides'}</p>
      <div className="yoga-detail-tags">{details.focus.map(tag => <span className="yoga-chip" key={tag}>{tag}</span>)}</div>
      <h3>What it offers</h3><p>{details.benefit}</p><h3>Find the shape</h3><p>{details.cue}</p><h3>Make it yours</h3><p>{details.modification}</p>
      <p className="yoga-detail-safety">These illustrations are visual reminders, not a substitute for instruction. Move gently, avoid pain, and choose support when you need it.</p>
      <button className="yoga-button yoga-primary yoga-wide" disabled={full} onClick={() => { onAdd(details.id); setDetails(null) }}><Icon name="plus" /> Add to my flow</button>
    </Modal>}
  </section>
}
