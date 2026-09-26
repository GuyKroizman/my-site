import { durationSeconds, formatDuration, totalBreaths, type Routine } from './model'
import { poseById } from './poses'
import { Icon, PoseImage } from './ui'

interface Props {
  sessions: Routine[]
  disabled: boolean
  onEdit: (routine: Routine) => void
  onStart: (routine: Routine) => void
  onDuplicate: (routine: Routine) => void
  onDelete: (routine: Routine) => void
  onBuild: () => void
}

export default function SessionLibrary({ sessions, disabled, onEdit, onStart, onDuplicate, onDelete, onBuild }: Props) {
  return <section className="yoga-library" aria-labelledby="yoga-library-title">
    <div className="yoga-section-heading"><div><p className="yoga-eyebrow">COME BACK TO WHAT FEELS GOOD</p><h2 id="yoga-library-title">Your practice, collected.</h2><p className="yoga-muted">Saved on this browser, on this device. Clearing browser data removes your sessions.</p></div><button className="yoga-button yoga-secondary" onClick={onBuild}><Icon name="plus" /> Build a session</button></div>
    {!sessions.length ? <div className="yoga-empty yoga-library-empty"><span className="yoga-empty-symbol"><Icon name="book" size={36} /></span><h3>A home for your favorite flows.</h3><p>Build a session and choose “Save session” to keep it here.<br />Your next quiet moment will be a little closer.</p><button className="yoga-button yoga-primary" onClick={onBuild}>Find your flow <Icon name="plus" size={18} /></button></div> : <div className="yoga-library-grid">
      {sessions.map(routine => <article className="yoga-saved-card" key={routine.id}>
        <div className="yoga-saved-preview">{routine.steps.slice(0, 3).map(step => <PoseImage key={step.id} pose={poseById.get(step.poseId)!} />)}<span className="yoga-saved-focus">{routine.focus}</span></div>
        <div className="yoga-saved-body"><h3>{routine.name}</h3><p className="yoga-saved-stats">{routine.steps.length} poses <span>·</span> {totalBreaths(routine)} breaths <span>·</span> ~ {formatDuration(durationSeconds(routine))}</p><p className="yoga-saved-date">Saved {new Date(routine.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          <div className="yoga-saved-actions"><button className="yoga-button yoga-primary" onClick={() => onStart(routine)}><Icon name="play" size={16} />Practice</button><button className="yoga-button yoga-secondary" onClick={() => onEdit(routine)}>Edit</button><button className="yoga-icon-button" aria-label={`Duplicate ${routine.name}`} disabled={disabled} onClick={() => onDuplicate(routine)}><Icon name="copy" size={18} /></button><button className="yoga-icon-button yoga-remove" aria-label={`Delete ${routine.name}`} disabled={disabled} onClick={() => onDelete(routine)}><Icon name="trash" size={18} /></button></div>
        </div>
      </article>)}
    </div>}
  </section>
}
