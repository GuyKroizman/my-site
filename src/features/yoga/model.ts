import { focuses, poseById, type Focus } from './poses'
import { flowById, flowHalvesPerRound, flowRoundDetail, type Flow } from './flows'

export type Step =
  | { kind: 'pose'; id: string; poseId: string; breaths: number; side?: 'Left' | 'Right' }
  | { kind: 'flow'; id: string; flowId: string; rounds: number }

export interface Routine {
  id: string
  name: string
  focus: Focus
  phaseSeconds: number
  steps: Step[]
  updatedAt: string
}

export const STORAGE_KEY = 'still-yoga-library-v2'
export const DRAFT_KEY = 'still-yoga-draft-v2'
export const MAX_STEPS = 100
export const MAX_SESSIONS = 100
export const MAX_ROUNDS = 60

export function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `yoga-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createStep(poseId: string, breaths = 5): Step {
  return { kind: 'pose', id: uid(), poseId, breaths, ...(poseById.get(poseId)?.sided ? { side: 'Left' as const } : {}) }
}

export function createFlowStep(flowId: string, rounds?: number): Step {
  const flow = flowById.get(flowId)
  return { kind: 'flow', id: uid(), flowId, rounds: rounds ?? flow?.defaultRounds ?? 1 }
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

/** Total half-breaths in a step (inhale and exhale are each one half). */
export function stepHalves(step: Step): number {
  if (step.kind === 'pose') return step.breaths * 2
  const flow = flowById.get(step.flowId)
  return (flow ? flowHalvesPerRound(flow) : 1) * step.rounds
}

export function stepSeconds(step: Step, phaseSeconds: number): number {
  return stepHalves(step) * phaseSeconds
}

export function totalBreaths(routine: Routine): number {
  return routine.steps.reduce((sum, step) => sum + Math.round(stepHalves(step) / 2), 0)
}

export function durationSeconds(routine: Routine): number {
  return routine.steps.reduce((sum, step) => sum + stepSeconds(step, routine.phaseSeconds), 0)
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`
}

/** The pose to use as a thumbnail for any step (first phase pose for a flow). */
export function stepPoseId(step: Step): string {
  if (step.kind === 'pose') return step.poseId
  return flowById.get(step.flowId)?.phases[0]?.poseId ?? 'easy-seat'
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
  return routine.steps.slice(0, index).reduce((sum, step) => sum + stepSeconds(step, routine.phaseSeconds), 0)
}

const fallbackHalf = { poseId: 'easy-seat', side: undefined, inhale: true, phaseIndex: 0, halfInPhase: 0, phaseHalves: 2 }

/** Derived from elapsed time, not interval counts, so animation frames cannot drop breaths. */
export function playbackAt(routine: Routine, elapsed: number) {
  const total = durationSeconds(routine)
  const safeElapsed = Math.max(0, Math.min(elapsed, total))
  if (!routine.steps.length) {
    return {
      index: 0, complete: true, poseId: 'easy-seat', side: undefined as 'Left' | 'Right' | undefined,
      round: undefined as number | undefined, roundCount: undefined as number | undefined,
      phaseIndex: 0, phaseCount: 1, inhale: true, expansion: 1,
      remainingBreaths: 0, breathNumber: 0, phaseBreaths: 0, phaseRemaining: 1, progress: 1,
    }
  }
  let offset = 0
  let index = 0
  for (; index < routine.steps.length - 1; index++) {
    const duration = stepSeconds(routine.steps[index], routine.phaseSeconds)
    if (safeElapsed < offset + duration) break
    offset += duration
  }
  const step = routine.steps[index]
  const within = Math.max(0, safeElapsed - offset)
  const halves = Math.max(1, stepHalves(step))
  const halfIndex = Math.min(halves - 1, Math.floor(within / routine.phaseSeconds))
  const secondsIntoHalf = within - halfIndex * routine.phaseSeconds
  const phaseRemaining = Math.max(1, Math.ceil(routine.phaseSeconds - secondsIntoHalf))
  const eased = (1 - Math.cos((secondsIntoHalf / routine.phaseSeconds) * Math.PI)) / 2

  let poseId: string
  let side: 'Left' | 'Right' | undefined
  let inhale: boolean
  let round: number | undefined
  let roundCount: number | undefined
  let phaseIndex = 0
  let phaseCount = 1
  let remainingBreaths: number
  let breathNumber: number
  let phaseBreaths: number

  if (step.kind === 'pose') {
    poseId = step.poseId
    side = step.side
    inhale = halfIndex % 2 === 0
    remainingBreaths = step.breaths - Math.floor(halfIndex / 2)
    breathNumber = Math.floor(halfIndex / 2) + 1
    phaseBreaths = step.breaths
  } else {
    const flow: Flow | undefined = flowById.get(step.flowId)
    const detail = flow ? flowRoundDetail(flow) : [fallbackHalf]
    const halvesPerRound = Math.max(1, detail.length)
    const roundIndex = Math.floor(halfIndex / halvesPerRound)
    const entry = detail[halfIndex % halvesPerRound] ?? fallbackHalf
    poseId = entry.poseId
    side = entry.side
    inhale = entry.inhale
    round = roundIndex + 1
    roundCount = step.rounds
    phaseIndex = entry.phaseIndex
    phaseCount = flow ? flow.phases.length : 1
    phaseBreaths = Math.max(1, Math.ceil(entry.phaseHalves / 2))
    remainingBreaths = Math.max(1, Math.ceil((entry.phaseHalves - entry.halfInPhase) / 2))
    breathNumber = Math.floor(entry.halfInPhase / 2) + 1
  }

  return {
    index,
    complete: safeElapsed >= total,
    poseId,
    side,
    round,
    roundCount,
    phaseIndex,
    phaseCount,
    inhale,
    expansion: inhale ? eased : 1 - eased,
    remainingBreaths,
    breathNumber,
    phaseBreaths,
    phaseRemaining,
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
    if (!record(step) || typeof step.id !== 'string' || !step.id || step.id.length > 120 || ids.has(step.id)) return null
    if (step.kind === 'pose') {
      if (typeof step.poseId !== 'string' || !poseById.has(step.poseId) ||
        typeof step.breaths !== 'number' || !Number.isInteger(step.breaths) || step.breaths < 1 || step.breaths > 60 ||
        (step.side !== undefined && step.side !== 'Left' && step.side !== 'Right')) return null
      const sided = poseById.get(step.poseId)?.sided
      steps.push({ kind: 'pose', id: step.id, poseId: step.poseId, breaths: step.breaths, ...(sided ? { side: step.side === 'Right' ? 'Right' as const : 'Left' as const } : {}) })
    } else if (step.kind === 'flow') {
      if (typeof step.flowId !== 'string' || !flowById.has(step.flowId) ||
        typeof step.rounds !== 'number' || !Number.isInteger(step.rounds) || step.rounds < 1 || step.rounds > MAX_ROUNDS) return null
      steps.push({ kind: 'flow', id: step.id, flowId: step.flowId, rounds: step.rounds })
    } else return null
    ids.add(step.id)
  }
  return { id: value.id, name: value.name.trim(), focus: value.focus as Focus, phaseSeconds: value.phaseSeconds, steps, updatedAt: value.updatedAt }
}

export function decodeLibrary(raw: string | null): Routine[] {
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!record(value) || value.version !== 2 || !Array.isArray(value.sessions) || value.sessions.length > MAX_SESSIONS) throw new Error('Invalid library')
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, sessions }))
    return true
  } catch { return false }
}
