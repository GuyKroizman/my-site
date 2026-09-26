import { useEffect, useRef, type ReactNode } from 'react'
import type { Pose } from './poses'

const paths = {
  leaf: 'M12 21v-9M12 16C4 17 2 11 3 6c6 0 9 4 9 10ZM12 12C11 5 16 2 21 3c0 6-3 9-9 9Z',
  plus: 'M12 5v14M5 12h14',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow: 'M19 12H5m6-6-6 6 6 6',
  play: 'm8 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  close: 'm6 6 12 12M6 18 18 6',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  breath: 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3',
  save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h9V3M7 21v-8h10v8',
  check: 'm5 12 4 4L19 6',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  copy: 'M9 9h12v12H9ZM15 9V3H3v12h6',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  sound: 'M11 4 6 8H2v8h4l5 4ZM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16',
  mute: 'M11 4 6 8H2v8h4l5 4Zm5 5 6 6m-6 0 6-6',
  expand: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
  next: 'm5 5 10 7-10 7ZM19 5v14',
  previous: 'm19 5-10 7 10 7ZM5 5v14',
  book: 'M12 6C8 3 4 3 2 4v15c4-1 7-1 10 2m0-15c4-3 8-3 10-2v15c-4-1-7-1-10 2V6Z',
  info: 'M12 11v6M12 7v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
} as const

export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

export function PoseImage({ pose, className = '' }: { pose: Pose; className?: string }) {
  return <img className={`yoga-pose-image ${className}`} src={`/yoga/poses/${pose.id}.svg`} alt={`${pose.name} pose illustration`} width="220" height="170" draggable={false} />
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { node?.close(); document.body.style.overflow = previous }
  }, [])
  return <dialog ref={dialog} className="yoga-dialog" aria-labelledby="yoga-dialog-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="yoga-dialog-content">
      <div className="yoga-section-heading"><h2 id="yoga-dialog-title">{title}</h2><button className="yoga-icon-button" onClick={onClose} aria-label="Close pose details"><Icon name="close" /></button></div>
      {children}
    </div>
  </dialog>
}
