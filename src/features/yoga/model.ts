import { focuses, poseById, type Focus } from './poses'

export interface Step {
  id: string
  poseId: string
  breaths: number
  side?: 'Left' | 'Right'
}

export interface Routine {
  id: string
  name: string
  focus: Focus
  phaseSeconds: number
  steps: Step[]
  updatedAt: string
}

export const STORAGE_KEY = 'still-yoga-library-v1'
export const DRAFT_KEY = 'still-yoga-draft-v1'
export const MAX_STEPS = 100
export const MAX_SESSIONS = 100

export function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `yoga-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createStep(poseId: string, breaths = 5): Step {
  return { id: uid(), poseId, breaths, ...(poseById.get(poseId)?.sided ? { side: 'Left' as const } : {}) }
}

export function createRoutine(starter = false): Routine {
  return {
    id: uid(), name: starter ? 'Everyday reset' : 'My mindful flow', focus: starter ? 'Spine' : 'Full body',
    phaseSeconds: 4, updatedAt: new Date().toISOString(),
    steps: starter ? [createStep('easy-seat', 5), createStep('cat', 4), createStep('cow', 4), createStep('downward-dog', 6), createStep('child', 6), createStep('savasana', 10)] : [],
  }
}

export function duplicateRoutine(routine: Routine): Routine {
  return { ...routine, id: uid(), name: `${routine.name} (copy)`.slice(0, 80), updatedAt: new Date().toISOString(), steps: routine.steps.map(step => ({ ...step, id: uid() })) }
}

export function totalBreaths(routine: Routine): number {
  return routine.steps.reduce((sum, step) => sum + step.breaths, 0)
}

export function durationSeconds(routine: Routine): number {
  return totalBreaths(routine) * routine.phaseSeconds * 2
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`
}

/** Move into an insertion slot (0 is before the first row; length is after the last). */
export function moveStep(steps: Step[], id: string, slot: number): Step[] {
  const from = steps.findIndex(step => step.id === id)
  if (from < 0 || slot < 0 || slot > steps.length) return steps
  const next = steps.filter(step => step.id !== id)
  next.splice(slot > from ? slot - 1 : slot, 0, steps[from])
  return next
}

export function stepStartSeconds(routine: Routine, index: number): number {
  return routine.steps.slice(0, index).reduce((sum, step) => sum + step.breaths * routine.phaseSeconds * 2, 0)
}

/** Derived from elapsed time, not interval counts, so animation frames cannot drop breaths. */
export function playbackAt(routine: Routine, elapsed: number) {
  const total = durationSeconds(routine)
  const safeElapsed = Math.max(0, Math.min(elapsed, total))
  let offset = 0
  let index = 0
  for (; index < routine.steps.length - 1; index++) {
    const duration = routine.steps[index].breaths * routine.phaseSeconds * 2
    if (safeElapsed < offset + duration) break
    offset += duration
  }
  const step = routine.steps[index]
  const within = Math.max(0, safeElapsed - offset)
  const cycle = routine.phaseSeconds * 2
  const cycleProgress = (within % cycle) / cycle
  const inhale = cycleProgress < 0.5
  return {
    index,
    complete: safeElapsed >= total,
    remainingBreaths: step ? Math.max(0, step.breaths - Math.floor(within / cycle)) : 0,
    breathNumber: step ? Math.min(step.breaths, Math.floor(within / cycle) + 1) : 0,
    inhale,
    // Cosine easing keeps the inhale/exhale transition soft, with no breath holds.
    expansion: (1 - Math.cos(cycleProgress * Math.PI * 2)) / 2,
    phaseRemaining: Math.max(1, Math.ceil(routine.phaseSeconds - within % routine.phaseSeconds)),
    progress: total ? safeElapsed / total : 1,
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Treat localStorage as untrusted input, including stale or manually edited versions. */
export function parseRoutine(value: unknown): Routine | null {
  if (!record(value) || typeof value.id !== 'string' || !value.id || value.id.length > 120 ||
    typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80 ||
    !focuses.includes(value.focus as Focus) || typeof value.phaseSeconds !== 'number' ||
    !Number.isInteger(value.phaseSeconds) || value.phaseSeconds < 2 || value.phaseSeconds > 8 ||
    !Array.isArray(value.steps) || value.steps.length > MAX_STEPS ||
    typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) return null
  const ids = new Set<string>()
  const steps: Step[] = []
  for (const step of value.steps) {
    if (!record(step) || typeof step.id !== 'string' || !step.id || step.id.length > 120 || ids.has(step.id) ||
      typeof step.poseId !== 'string' || !poseById.has(step.poseId) ||
      typeof step.breaths !== 'number' || !Number.isInteger(step.breaths) || step.breaths < 1 || step.breaths > 60 ||
      (step.side !== undefined && step.side !== 'Left' && step.side !== 'Right')) return null
    ids.add(step.id)
    const sided = poseById.get(step.poseId)?.sided
    steps.push({ id: step.id, poseId: step.poseId, breaths: step.breaths, ...(sided ? { side: step.side === 'Right' ? 'Right' as const : 'Left' as const } : {}) })
  }
  return { id: value.id, name: value.name.trim(), focus: value.focus as Focus, phaseSeconds: value.phaseSeconds, steps, updatedAt: value.updatedAt }
}

export function decodeLibrary(raw: string | null): Routine[] {
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!record(value) || value.version !== 1 || !Array.isArray(value.sessions) || value.sessions.length > MAX_SESSIONS) throw new Error('Invalid library')
  const ids = new Set<string>()
  return value.sessions.map(item => {
    const routine = parseRoutine(item)
    if (!routine || ids.has(routine.id) || !routine.steps.length) throw new Error('Invalid session')
    ids.add(routine.id)
    return routine
  })
}

export function loadLibrary(): { sessions: Routine[]; error: string | null } {
  try {
    return { sessions: decodeLibrary(localStorage.getItem(STORAGE_KEY)), error: null }
  } catch {
    return { sessions: [], error: 'Your saved library could not be read. Existing data has not been changed. You can still build and practice; saving is disabled to protect your library.' }
  }
}

export function saveLibrary(sessions: Routine[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, sessions }))
    return true
  } catch { return false }
}
